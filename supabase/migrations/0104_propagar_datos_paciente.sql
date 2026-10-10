-- Datos de contacto del paciente: una sola verdad, venga el cambio de donde venga.
--
-- Por qué: `citas` y `consultas` guardan una COPIA del nombre del paciente (y la cita, también su cédula, teléfono y correo). Al editar al
-- paciente la copia quedaba vieja: la agenda y las listas seguían mostrando el nombre anterior, y los recordatorios por correo salían al
-- correo viejo (el recordatorio usa primero el correo de la cita).
--
-- Qué hace esta migración:
--   1. Un trigger sobre la tabla de pacientes (`pacientes_base`, la que escriben la vista `pacientes`, el personal, el portal y cualquier
--      otra vía) copia el nombre, la cédula, el teléfono y el correo nuevos a las citas y consultas de ESE paciente (por su identificador,
--      nunca por el nombre), en la misma transacción del cambio.
--   2. `actualizar_contacto_paciente`: lo único que el portal del paciente puede cambiar — su teléfono y su correo. Mismo patrón de
--      sesión que las demás funciones del portal (`sesion_paciente_valida`). No acepta nombre, cédula ni fecha de nacimiento: esos los
--      cambia solo el personal. Valida el formato de cada dato y deja constancia en la actividad de la óptica.
--
-- No cambia ninguna función ni vista existente.

-- ═══════════════════════════════════════════════════════
-- 1. Propagación a citas y consultas
-- ═══════════════════════════════════════════════════════
create or replace function public.propagar_datos_paciente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nombre is distinct from old.nombre
     or new.cedula is distinct from old.cedula
     or new.telefono is distinct from old.telefono
     or new.correo is distinct from old.correo then
    update citas_base
       set paciente = new.nombre,
           cedula = new.cedula,
           telefono = new.telefono,
           -- "Sin Correo" es el relleno del formulario del personal: en la cita queda vacío, como si nunca se hubiera dado
           correo = case when new.correo is null or new.correo = 'Sin Correo' then null else new.correo end
     where paciente_id = new.id
       and (paciente is distinct from new.nombre
            or cedula is distinct from new.cedula
            or telefono is distinct from new.telefono
            or correo is distinct from (case when new.correo is null or new.correo = 'Sin Correo' then null else new.correo end));
  end if;
  if new.nombre is distinct from old.nombre then
    update consultas_base set paciente = new.nombre where paciente_id = new.id and paciente is distinct from new.nombre;
  end if;
  return new;
end;
$$;
revoke all on function public.propagar_datos_paciente() from public, anon, authenticated;

drop trigger if exists propagar_datos_paciente_trigger on public.pacientes_base;
create trigger propagar_datos_paciente_trigger
  after update of nombre, cedula, telefono, correo on public.pacientes_base
  for each row execute function public.propagar_datos_paciente();

-- ═══════════════════════════════════════════════════════
-- 2. El paciente edita su teléfono y su correo desde el portal
-- ═══════════════════════════════════════════════════════
-- Devuelve { ok: true, telefono, correo } o { ok: false, error }. error = 'sesion' cuando la sesión no es válida o expiró.
-- Un parámetro vacío (null o '') significa "no cambiar ese dato".
create or replace function public.actualizar_contacto_paciente(
  p_paciente_id uuid,
  p_token text,
  p_telefono text default null,
  p_correo text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tel text := nullif(btrim(p_telefono), '');
  v_cor text := nullif(btrim(p_correo), '');
  v_p pacientes_base%rowtype;
  v_cambia_tel boolean;
  v_cambia_cor boolean;
  v_accion text;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return jsonb_build_object('ok', false, 'error', 'sesion');
  end if;
  if v_tel is null and v_cor is null then
    return jsonb_build_object('ok', false, 'error', 'Indica el teléfono o el correo que quieres cambiar.');
  end if;
  if v_tel is not null and v_tel !~ '^[0-9]{7,10}$' then
    return jsonb_build_object('ok', false, 'error', 'El teléfono debe tener entre 7 y 10 dígitos, sin espacios ni guiones.');
  end if;
  if v_cor is not null and (length(v_cor) > 120 or v_cor !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    return jsonb_build_object('ok', false, 'error', 'Ingresa un correo válido (ej. nombre@dominio.com).');
  end if;

  select * into v_p from pacientes_base where id = p_paciente_id and anonimizado_en is null for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'sesion');
  end if;

  v_cambia_tel := v_tel is not null and v_tel is distinct from v_p.telefono;
  v_cambia_cor := v_cor is not null and lower(v_cor) is distinct from lower(coalesce(v_p.correo, ''));

  if v_cambia_tel or v_cambia_cor then
    -- Solo estas dos columnas, solo esta fila: nombre, cédula y fecha de nacimiento no se tocan desde aquí. El trigger de arriba copia
    -- el cambio a las citas del paciente.
    update pacientes_base
       set telefono = case when v_cambia_tel then v_tel else telefono end,
           correo = case when v_cambia_cor then v_cor else correo end
     where id = p_paciente_id;

    v_accion := case
      when v_cambia_tel and v_cambia_cor then 'El paciente actualizó su teléfono y su correo'
      when v_cambia_tel then 'El paciente actualizó su teléfono'
      else 'El paciente actualizó su correo'
    end;
    insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
    values (v_p.optica_id, null, v_p.nombre, 'pacientes', v_accion, v_p.nombre || ' (desde el portal del paciente)');
  end if;

  select * into v_p from pacientes_base where id = p_paciente_id;
  return jsonb_build_object('ok', true, 'telefono', v_p.telefono, 'correo', v_p.correo, 'cambio', v_cambia_tel or v_cambia_cor);
end;
$$;

revoke all on function public.actualizar_contacto_paciente(uuid, text, text, text) from public;
grant execute on function public.actualizar_contacto_paciente(uuid, text, text, text) to anon;
