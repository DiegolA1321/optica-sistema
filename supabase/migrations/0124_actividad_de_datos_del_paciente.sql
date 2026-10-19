-- 0124 · Lo que el paciente hace con sus datos queda en la actividad de la óptica
-- Pedido de Diego (17 oct. 2026, portal v2): «descargar sus datos o pedir su eliminación: en la actividad». Hoy ninguna de las dos acciones deja rastro en la
-- actividad (logs_optica) y la óptica no se entera de que una copia de los datos de una persona salió del sistema.
--
--   1. exportar_mis_datos_paciente: igual que antes (mismos datos, misma firma) y además anota «El paciente descargó una copia de sus datos».
--   2. solicitar_eliminacion_paciente: igual que antes (idempotente, misma firma) y además anota «El paciente pidió eliminar su cuenta» la primera vez
--      (no cada vez que insiste mientras la solicitud sigue pendiente).
-- No cambia ninguna tabla ni dato existente. La solicitud de eliminación ya la ve el administrador en el perfil del paciente y, desde el portal v2, en
-- «Requiere tu atención» del Inicio (eso es solo de la pantalla).

create or replace function public.solicitar_eliminacion_paciente(p_paciente_id uuid, p_token text, p_motivo text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica_id uuid;
  v_nombre text;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;

  select optica_id, nombre into v_optica_id, v_nombre from pacientes where id = p_paciente_id;

  if exists (select 1 from solicitudes_eliminacion_paciente where paciente_id = p_paciente_id and estado = 'pendiente') then
    return true;
  end if;

  insert into solicitudes_eliminacion_paciente (optica_id, paciente_id, motivo)
  values (v_optica_id, p_paciente_id, left(nullif(trim(p_motivo), ''), 500));

  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_optica_id, null, v_nombre, 'pacientes', 'El paciente pidió eliminar su cuenta', v_nombre);
  return true;
end;
$$;

-- Descargar mis datos: datos personales y clínicos del paciente, sin campos internos (la misma respuesta de la 0107).
create or replace function public.exportar_mis_datos_paciente(p_paciente_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_montaje boolean;
  v_resultado jsonb;
  v_p record;
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

  -- Queda en la actividad de la óptica: un archivo con todos los datos personales y clínicos de una persona sale del sistema.
  select optica_id, nombre into v_p from pacientes where id = p_paciente_id;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_p.optica_id, null, v_p.nombre, 'pacientes', 'El paciente descargó una copia de sus datos', v_p.nombre);

  return v_resultado;
end;
$$;

-- ───────────────────────── Reversión (no se ejecuta) ─────────────────────────
--   Volver a crear las dos funciones con sus definiciones anteriores: solicitar_eliminacion_paciente (0063) y exportar_mis_datos_paciente (0107).
