-- Paso 12 del plan de prioridad 1 (reunión 29 sept., R17 y R40): eliminar un
-- paciente lo ANONIMIZA en vez de borrarlo.
--
-- Por qué: hasta hoy "Eliminar paciente" borraba sus citas y consultas desde el
-- navegador y luego a la persona, y como ventas, facturas, órdenes de
-- laboratorio y solicitudes dependen del paciente con "on delete cascade",
-- borrar a la persona también se llevaba su historial de ventas. Con la
-- anonimización el paciente deja de ser identificable pero sus visitas, ventas
-- y datos clínicos sin nombre se conservan: los reportes y el embudo siguen
-- contando esas visitas.
--
-- Qué hace anonimizar_paciente(id), todo en una sola transacción:
--   * pacientes_base: nombre → "Paciente anonimizado"; cédula, teléfono, correo,
--     "referido por" (nombre de otra persona) y credenciales del portal
--     (usuario, clave, sesión) se borran; la fecha de nacimiento conserva solo
--     el año (para estadísticas por edad). Se conservan los datos clínicos
--     cifrados (estado de corrección, evolución) y el origen.
--   * citas_base y consultas_base: se limpian las COPIAS del nombre, cédula,
--     teléfono, correo y código de confirmación (incluidas las filas antiguas
--     que solo se enlazaban por nombre) y los textos libres (motivos, lente
--     recomendado). Los textos clínicos cifrados conservan todo su contenido
--     clínico; solo se quitan los datos de identidad escritos dentro.
--   * Textos libres de ventas: motivo de anulación, descripción de líneas,
--     notas de abonos, observaciones/tratamientos/montura de las órdenes de
--     laboratorio y su historial, detalle de "No compró", comentario de la
--     encuesta, aviso del CRM, motivo de la solicitud del portal. Mensajes de
--     soporte y actividad de la óptica que lo nombran. Notificaciones enviadas.
--   * Otros pacientes referidos por esta persona dejan de mostrar su nombre.
--   * La solicitud de eliminación del portal (si existe) queda atendida.
--   * Ventas, facturas, abonos, órdenes de laboratorio y pases no se borran ni
--     cambian en montos, productos, recetas ni estados: solo dejan de apuntar a
--     una persona identificable.
--
-- Un paciente anonimizado desaparece de la vista `pacientes` (no sale en
-- listas, búsquedas ni dedupe por cédula); sus registros siguen en las demás
-- vistas. La función es idempotente.
--
-- Permisos: solo el administrador de la óptica (rol admin), con óptica activa y
-- segundo factor. En el Bloque D pasará a ser el permiso "eliminar" de Pacientes.

alter table public.pacientes_base add column anonimizado_en timestamptz;

-- La vista deja de mostrar a los anonimizados. Mismas columnas y mismo orden
-- (create or replace conserva sus triggers, permisos y security_invoker).
create or replace view public.pacientes with (security_invoker = true) as
 select id,
    optica_id,
    nombre,
    cedula,
    telefono,
    correo,
    fecha_nacimiento,
    ultima_consulta,
    descifrar_clinico(estado_clinico_enc) as estado_clinico,
    referido_por,
    descifrar_clinico(evolucion_enc) as evolucion,
    descifrar_clinico(estado_correccion_enc) as estado_correccion,
    fecha_registro,
    tiene_cuenta,
    usuario,
    clave_temporal,
    created_at,
    updated_at,
    sesion_token,
    ultimo_saludo_cumple_anio,
    intentos_fallidos,
    bloqueado_hasta,
    referido_por_id,
    origen,
    confirmado_recepcion,
    medidas_solicitadas_en
   from public.pacientes_base pb
  where pb.anonimizado_en is null;

-- ════════════════════════════════════════════════════════════════
-- Ayuda interna: quita de un texto libre los datos personales conocidos del
-- paciente (nombre completo, cédula, teléfono y correo, sin importar
-- mayúsculas). Solo se usa dentro de anonimizar_paciente; no se expone a la API.
-- ════════════════════════════════════════════════════════════════
create or replace function public._limpiar_datos_personales(
  p_texto text, p_nombre text, p_cedula text, p_telefono text, p_correo text
) returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_texto text := p_texto;
  v_dato text;
begin
  if v_texto is null then
    return null;
  end if;
  -- (token, reemplazo): un dato corto no se busca para no alterar palabras de otros textos
  for v_dato in select unnest(array[p_nombre, p_cedula, p_telefono, p_correo]) loop
    if v_dato is not null and length(btrim(v_dato)) >= 6 then
      v_texto := regexp_replace(
        v_texto,
        regexp_replace(btrim(v_dato), '([.\\+*?\[^\]$(){}=!<>|:-])', '\\\1', 'g'),
        case when v_dato = p_nombre then 'Paciente anonimizado' else '(dato eliminado)' end,
        'gi'
      );
    end if;
  end loop;
  return v_texto;
end;
$$;
revoke all on function public._limpiar_datos_personales(text, text, text, text, text) from public, anon, authenticated;

create or replace function public.anonimizar_paciente(p_paciente_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_anon constant text := 'Paciente anonimizado';
  v_optica uuid;
  v_p pacientes_base%rowtype;
  v_citas integer;
  v_consultas integer;
  v_textos integer := 0;
  v_n integer;
begin
  -- Solo el administrador de la óptica
  select p.optica_id into v_optica
  from perfiles p
  where p.id = auth.uid() and p.rol = 'admin';
  if v_optica is null then
    raise exception 'Solo el administrador puede eliminar pacientes.';
  end if;
  if not optica_activa_actual() then
    raise exception 'La óptica está suspendida.';
  end if;
  if not mfa_satisfecho() then
    raise exception 'Verifica tu segundo factor para continuar.';
  end if;

  select * into v_p from pacientes_base where id = p_paciente_id and optica_id = v_optica for update;
  if not found then
    raise exception 'El paciente no existe.';
  end if;
  if v_p.anonimizado_en is not null then
    return jsonb_build_object('ya_anonimizado', true);
  end if;

  -- Comentario de la encuesta de satisfacción de sus citas (antes de limpiar las citas, que se ubican por nombre)
  update respuestas_satisfaccion r
     set comentario = _limpiar_datos_personales(r.comentario, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)
   where r.optica_id = v_optica and r.comentario is not null
     and r.cita_id in (select cb.id from citas_base cb where cb.optica_id = v_optica and (cb.paciente_id = p_paciente_id or (cb.paciente_id is null and cb.paciente = v_p.nombre)));

  -- ── Citas y consultas: copias de identidad y textos libres (por id, y las filas
  --    antiguas sin id por nombre). Los datos clínicos cifrados se conservan.
  update citas_base
     set paciente = c_anon, cedula = null, telefono = null, correo = null, codigo = null,
         motivo = _limpiar_datos_personales(motivo, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo),
         motivo_publico = _limpiar_datos_personales(motivo_publico, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo),
         triage_enc = cifrar_clinico(_limpiar_datos_personales(descifrar_clinico(triage_enc), v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo))
   where optica_id = v_optica
     and (paciente_id = p_paciente_id or (paciente_id is null and paciente = v_p.nombre));
  get diagnostics v_citas = row_count;

  update consultas_base
     set paciente = c_anon,
         motivo = _limpiar_datos_personales(motivo, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo),
         lente_recomendado = _limpiar_datos_personales(lente_recomendado, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo),
         -- Textos clínicos cifrados: se conserva todo el contenido clínico, solo se quitan
         -- los datos de identidad que alguien haya escrito dentro (nombre, cédula, teléfono, correo).
         diagnostico_enc = cifrar_clinico(_limpiar_datos_personales(descifrar_clinico(diagnostico_enc), v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)),
         antecedentes_enc = cifrar_clinico(_limpiar_datos_personales(descifrar_clinico(antecedentes_enc), v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)),
         alergias_enc = cifrar_clinico(_limpiar_datos_personales(descifrar_clinico(alergias_enc), v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)),
         antecedentes_familiares_enc = cifrar_clinico(_limpiar_datos_personales(descifrar_clinico(antecedentes_familiares_enc), v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)),
         indicaciones_enc = cifrar_clinico(_limpiar_datos_personales(descifrar_clinico(indicaciones_enc), v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)),
         detalle_consulta_enc = cifrar_clinico(_limpiar_datos_personales(descifrar_clinico(detalle_consulta_enc), v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)),
         datos_clinicos_enc = cifrar_clinico(_limpiar_datos_personales(descifrar_clinico(datos_clinicos_enc), v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo))
   where optica_id = v_optica
     and (paciente_id = p_paciente_id or (paciente_id is null and paciente = v_p.nombre));
  get diagnostics v_consultas = row_count;

  -- ── Ventas: textos libres de sus facturas, abonos, órdenes de laboratorio y pases.
  --    Los montos, las líneas (productos y precios) y las recetas se conservan.
  update facturas_venta
     set anulada_motivo = _limpiar_datos_personales(anulada_motivo, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)
   where optica_id = v_optica and paciente_id = p_paciente_id and anulada_motivo is not null;
  get diagnostics v_n = row_count; v_textos := v_textos + v_n;

  update facturas_venta_lineas l
     set descripcion = _limpiar_datos_personales(l.descripcion, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)
   where l.factura_id in (select f.id from facturas_venta f where f.optica_id = v_optica and f.paciente_id = p_paciente_id);

  update abonos_factura a
     set nota = _limpiar_datos_personales(a.nota, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)
   where a.optica_id = v_optica and a.nota is not null
     and a.factura_id in (select f.id from facturas_venta f where f.optica_id = v_optica and f.paciente_id = p_paciente_id);
  get diagnostics v_n = row_count; v_textos := v_textos + v_n;

  update ordenes_laboratorio
     set observaciones = _limpiar_datos_personales(observaciones, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo),
         otros_tratamientos = _limpiar_datos_personales(otros_tratamientos, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo),
         montura = _limpiar_datos_personales(montura, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)
   where optica_id = v_optica and paciente_id = p_paciente_id;
  get diagnostics v_n = row_count; v_textos := v_textos + v_n;

  update ordenes_laboratorio_historial h
     set nota = _limpiar_datos_personales(h.nota, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)
   where h.nota is not null
     and h.orden_id in (select o.id from ordenes_laboratorio o where o.optica_id = v_optica and o.paciente_id = p_paciente_id);

  update pases_a_venta
     set detalle_descarte = _limpiar_datos_personales(detalle_descarte, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)
   where optica_id = v_optica and paciente_id = p_paciente_id and detalle_descarte is not null;

  -- ── CRM, notificaciones y solicitudes
  update avisos
     set destinatario_nombre = c_anon, destinatario_telefono = null,
         texto = _limpiar_datos_personales(texto, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)
   where optica_id = v_optica and destinatario_id = p_paciente_id;

  update notificaciones_enviadas
     set destinatario = '(anonimizado)'
   where optica_id = v_optica
     and destinatario in (select x from (values (nullif(btrim(v_p.correo), '')), (nullif(btrim(v_p.telefono), ''))) as t(x) where x is not null);

  update solicitudes_eliminacion_paciente
     set motivo = _limpiar_datos_personales(motivo, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo),
         estado = 'atendida', atendida_at = coalesce(atendida_at, now())
   where paciente_id = p_paciente_id;

  -- ── Textos de toda la óptica que pueden nombrarlo: actividad y mensajes de soporte
  update logs_optica
     set detalle = _limpiar_datos_personales(detalle, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)
   where optica_id = v_optica and detalle is not null and detalle <> _limpiar_datos_personales(detalle, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo);
  get diagnostics v_n = row_count; v_textos := v_textos + v_n;

  update mensajes
     set asunto = _limpiar_datos_personales(asunto, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo),
         cuerpo = _limpiar_datos_personales(cuerpo, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo),
         respuesta = _limpiar_datos_personales(respuesta, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)
   where optica_id = v_optica
     and (asunto, cuerpo, respuesta) is distinct from (_limpiar_datos_personales(asunto, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo), _limpiar_datos_personales(cuerpo, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo), _limpiar_datos_personales(respuesta, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo));

  -- ── Quienes fueron referidos por esta persona dejan de mostrar su nombre
  update pacientes_base set referido_por = c_anon where optica_id = v_optica and referido_por_id = p_paciente_id;

  -- ── El paciente
  update pacientes_base
     set nombre = c_anon,
         cedula = null,
         telefono = null,
         correo = null,
         fecha_nacimiento = case when fecha_nacimiento is null then null
                                 else make_date(extract(year from fecha_nacimiento)::integer, 1, 1) end,
         referido_por = null,
         tiene_cuenta = false,
         usuario = null,
         clave_temporal = null,
         sesion_token = null,
         sesion_token_creado_en = null,
         bloqueado_hasta = null,
         intentos_fallidos = 0,
         medidas_solicitadas_en = null,
         anonimizado_en = now()
   where id = p_paciente_id;

  return jsonb_build_object('ya_anonimizado', false, 'citas', v_citas, 'consultas', v_consultas, 'textos_limpiados', v_textos);
end;
$$;

revoke all on function public.anonimizar_paciente(uuid) from public, anon;
grant execute on function public.anonimizar_paciente(uuid) to authenticated;
