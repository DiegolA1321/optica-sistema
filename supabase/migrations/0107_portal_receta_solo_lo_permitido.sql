-- Portal del paciente: el servidor entrega solo lo que el portal muestra (hallazgo del 10 oct. 2026).
--
-- Hasta ahora `mis_consultas_paciente` hacía `select c.* from consultas`: el navegador del paciente recibía la consulta completa
-- (examen, retinoscopia, antecedentes, alergias, imágenes, monto de venta, ids del personal...) y la política "mostrar medidas"
-- solo se aplicaba al dibujar la pantalla. `exportar_mis_datos_paciente` devolvía además filas completas de perfil y de citas.
--
-- Nueva regla:
--   · El portal recibe la receta (esfera, cilindro, eje, adición y agudeza visual), el diagnóstico, las indicaciones, el lente
--     recomendado, el profesional y sus citas.
--   · La distancia pupilar (dp) y la altura (alt) solo viajan si la óptica lo permite (opticas.settings.mostrarMedidasPaciente).
--     La clave se conserva para no migrar datos: las ópticas que la tenían encendida siguen entregando todo.
--   · "Descargar mis datos" (derecho de acceso) entrega los datos personales y clínicos completos, antecedentes y alergias
--     incluidos, y nunca campos internos (ids del personal, intentos de inicio de sesión, montos, tokens, campos de control).
--
-- COMPATIBILIDAD: la versión publicada del portal llama a estas dos funciones. Se conservan el nombre, los parámetros y la forma de
-- la respuesta (mis_consultas_paciente sigue devolviendo `setof consultas`, mis_citas_paciente `setof citas`, la exportación el mismo
-- jsonb con perfil/citas/consultas/exportado_en): lo que ya no se entrega llega como null, y el código publicado lee esos campos con
-- valores por defecto. Misma firma y mismo tipo de retorno => `create or replace` no crea un segundo overload.

-- ¿La óptica de este paciente permite mostrarle la distancia pupilar y la altura?
create or replace function public.portal_muestra_montaje(p_paciente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select o.settings ->> 'mostrarMedidasPaciente' = 'true'
                   from pacientes_base p join opticas o on o.id = p.optica_id
                   where p.id = p_paciente_id), false);
$$;

-- Una consulta, como jsonb, reducida a lo que se le puede entregar al paciente.
--   p_completa = false: lo que dibuja el portal.  p_completa = true: la descarga de sus datos (derecho de acceso).
create or replace function public.consulta_para_paciente(c jsonb, p_montaje boolean, p_completa boolean)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  dc jsonb := coalesce(c -> 'datos_clinicos', '{}'::jsonb);
  medidas jsonb := coalesce(dc -> 'medidas', '{}'::jsonb);
  resultado jsonb;
begin
  -- Distancia pupilar y altura de montaje: solo con permiso de la óptica.
  if not p_montaje then
    medidas := medidas - 'dp' - 'alt';
  end if;

  resultado := jsonb_build_object(
    'id', c -> 'id', 'paciente_id', c -> 'paciente_id', 'paciente', c -> 'paciente',
    'fecha', c -> 'fecha', 'created_at', c -> 'created_at', 'usa_lentes', c -> 'usa_lentes',
    'diagnostico', c -> 'diagnostico', 'lente_recomendado', c -> 'lente_recomendado', 'indicaciones', c -> 'indicaciones',
    'profesional_nombre', c -> 'profesional_nombre', 'profesional_registro', c -> 'profesional_registro'
  );

  if p_completa then
    -- Descarga de sus datos: todo lo clínico y personal, sin campos internos.
    resultado := resultado || jsonb_build_object(
      'motivo', c -> 'motivo', 'antecedentes', c -> 'antecedentes', 'alergias', c -> 'alergias',
      'antecedentes_familiares', c -> 'antecedentes_familiares', 'detalle_consulta', c -> 'detalle_consulta',
      'diagnostico_categorias', c -> 'diagnostico_categorias', 'proximo_control_dias', c -> 'proximo_control_dias',
      'estado_correccion', c -> 'estado_correccion', 'evolucion_calculada', c -> 'evolucion_calculada',
      'datos_clinicos', (dc - 'control_agenda' - 'control_asignado_a' - 'lente_producto_id')
                         || jsonb_build_object('medidas', medidas)
    );
  else
    -- Portal: la receta y nada más.
    resultado := resultado || jsonb_build_object(
      'datos_clinicos', jsonb_build_object(
        'od', jsonb_build_object('esfera', dc #> '{od,esfera}', 'cilindro', dc #> '{od,cilindro}', 'eje', dc #> '{od,eje}', 'avSc', dc #> '{od,avSc}', 'avCc', dc #> '{od,avCc}'),
        'oi', jsonb_build_object('esfera', dc #> '{oi,esfera}', 'cilindro', dc #> '{oi,cilindro}', 'eje', dc #> '{oi,eje}', 'avSc', dc #> '{oi,avSc}', 'avCc', dc #> '{oi,avCc}'),
        'medidas', jsonb_strip_nulls(jsonb_build_object('adicion', medidas -> 'adicion', 'avCerca', medidas -> 'avCerca', 'dp', medidas -> 'dp', 'alt', medidas -> 'alt'))
      )
    );
  end if;
  return resultado;
end;
$$;

-- Funciones de apoyo: solo las usan las dos funciones públicas de abajo (que son security definer), nunca la API.
revoke all on function public.portal_muestra_montaje(uuid) from public, anon, authenticated;
revoke all on function public.consulta_para_paciente(jsonb, boolean, boolean) from public, anon, authenticated;

-- Misma firma y mismo tipo de retorno (setof consultas): lo que no se entrega llega como null.
create or replace function public.mis_consultas_paciente(p_paciente_id uuid, p_token text default null)
returns setof consultas
language sql
security definer
set search_path = public
as $$
  select r.*
  from consultas c
  cross join lateral jsonb_populate_record(
    null::consultas,
    consulta_para_paciente(to_jsonb(c), portal_muestra_montaje(c.paciente_id), false)
  ) r
  where c.paciente_id = p_paciente_id
    and sesion_paciente_valida(p_paciente_id, p_token)
  order by c.fecha desc;
$$;

-- Sus citas, sin ids del personal ni campos de control (recordatorios, encuesta, triaje, origen).
create or replace function public.mis_citas_paciente(p_paciente_id uuid, p_token text default null)
returns setof citas
language sql
security definer
set search_path = public
as $$
  select r.*
  from citas c
  cross join lateral jsonb_populate_record(
    null::citas,
    to_jsonb(c) - array['triage', 'recordatorio_enviado_at', 'encuesta_enviada_at', 'origen', 'asignado_a', 'atendido_por', 'asignado_original']
  ) r
  where c.paciente_id = p_paciente_id
    and sesion_paciente_valida(p_paciente_id, p_token)
  order by c.fecha desc, c.hora desc;
$$;

-- Descargar mis datos: datos personales y clínicos del paciente, sin campos internos. Misma forma de respuesta.
create or replace function public.exportar_mis_datos_paciente(p_paciente_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_montaje boolean;
  v_resultado jsonb;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return null;
  end if;
  v_montaje := portal_muestra_montaje(p_paciente_id);

  select jsonb_build_object(
    'perfil', (select jsonb_build_object(
                 'id', p.id, 'nombre', p.nombre, 'cedula', p.cedula, 'telefono', p.telefono, 'correo', p.correo,
                 'fecha_nacimiento', p.fecha_nacimiento, 'fecha_registro', p.fecha_registro, 'usuario', p.usuario,
                 'ultima_consulta', p.ultima_consulta, 'estado_clinico', p.estado_clinico, 'evolucion', p.evolucion,
                 'estado_correccion', p.estado_correccion, 'referido_por', p.referido_por)
               from pacientes p where p.id = p_paciente_id),
    'citas', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', c.id, 'fecha', c.fecha, 'hora', c.hora, 'motivo', c.motivo, 'motivo_publico', c.motivo_publico,
                 'estado', c.estado, 'codigo', c.codigo, 'triage', c.triage, 'duracion_minutos', c.duracion_minutos,
                 'confirmada_at', c.confirmada_at, 'cancelada_por', c.cancelada_por, 'created_at', c.created_at
               ) order by c.fecha desc, c.hora desc), '[]'::jsonb)
              from citas c where c.paciente_id = p_paciente_id),
    'consultas', (select coalesce(jsonb_agg(consulta_para_paciente(to_jsonb(co), v_montaje, true) order by co.fecha desc), '[]'::jsonb)
                  from consultas co where co.paciente_id = p_paciente_id),
    'exportado_en', now()
  ) into v_resultado;

  return v_resultado;
end;
$$;
