-- D2 (reunión 29 sept.): pacientes_base.confirmado_recepcion.
--
-- El paciente se sigue registrando (o deduplicando) al agendar por la web
-- (ING6, crear_cita_publica, migración 0067) — eso no cambia. Lo nuevo: al
-- presionar "Atender" sobre una cita con origen='paciente' cuyo registro
-- todavía no fue confirmado por recepción, se muestra primero un paso para
-- confirmar o completar sus datos, antes de entrar a la ficha clínica
-- (Citas.jsx, implementado después de esta migración).
--
-- Backfill: origen='staff' siempre queda confirmado (lo registró el propio
-- personal). origen='paciente' que YA tiene consultas registradas también
-- queda confirmado — ya pasó por recepción alguna vez, no tiene sentido
-- pedirle el paso de confirmación a alguien que el sistema ya atendió.
--
-- pacientes_base se edita a través de la vista `pacientes` con triggers
-- "instead of" (0067) — hay que propagar la columna nueva a la vista y a
-- los dos triggers de escritura (insert/update), no solo a la tabla. La
-- vista y los triggers de abajo se extrajeron con pg_get_viewdef/
-- pg_get_functiondef directo de la base principal antes de escribir esta
-- migración (idénticos a como quedaron en 0067 — no hubo drift en el
-- camino) para no reconstruirlos de memoria.

alter table public.pacientes_base
  add column if not exists confirmado_recepcion boolean not null default false;

update public.pacientes_base
   set confirmado_recepcion = true
 where origen = 'staff';

update public.pacientes_base pb
   set confirmado_recepcion = true
  from public.consultas_base cb
 where cb.paciente_id = pb.id
   and pb.confirmado_recepcion = false;

create or replace view public.pacientes
with (security_invoker = true)
as
select
  pb.id, pb.optica_id, pb.nombre, pb.cedula, pb.telefono, pb.correo, pb.fecha_nacimiento,
  pb.ultima_consulta,
  descifrar_clinico(pb.estado_clinico_enc) as estado_clinico,
  pb.referido_por,
  descifrar_clinico(pb.evolucion_enc) as evolucion,
  descifrar_clinico(pb.estado_correccion_enc) as estado_correccion,
  pb.fecha_registro, pb.tiene_cuenta, pb.usuario, pb.clave_temporal,
  pb.created_at, pb.updated_at, pb.sesion_token, pb.ultimo_saludo_cumple_anio,
  pb.intentos_fallidos, pb.bloqueado_hasta, pb.referido_por_id, pb.origen,
  pb.confirmado_recepcion
from pacientes_base pb;

create or replace function public.pacientes_instead_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into pacientes_base (
    optica_id, nombre, cedula, telefono, correo, fecha_nacimiento, ultima_consulta,
    estado_clinico_enc, referido_por, referido_por_id, evolucion_enc, estado_correccion_enc,
    fecha_registro, tiene_cuenta, usuario, clave_temporal,
    sesion_token, ultimo_saludo_cumple_anio, intentos_fallidos, bloqueado_hasta, origen,
    confirmado_recepcion
  ) values (
    new.optica_id, new.nombre, new.cedula, new.telefono, new.correo, new.fecha_nacimiento, new.ultima_consulta,
    cifrar_clinico(new.estado_clinico), new.referido_por, new.referido_por_id, cifrar_clinico(new.evolucion), cifrar_clinico(new.estado_correccion),
    coalesce(new.fecha_registro, current_date), coalesce(new.tiene_cuenta, false), new.usuario, new.clave_temporal,
    new.sesion_token, new.ultimo_saludo_cumple_anio, coalesce(new.intentos_fallidos, 0), new.bloqueado_hasta,
    coalesce(new.origen, 'staff'),
    coalesce(new.confirmado_recepcion, coalesce(new.origen, 'staff') = 'staff')
  )
  returning id into v_id;

  select * into new from pacientes where id = v_id;
  return new;
end;
$$;

create or replace function public.pacientes_instead_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update pacientes_base set
    optica_id = new.optica_id,
    nombre = new.nombre,
    cedula = new.cedula,
    telefono = new.telefono,
    correo = new.correo,
    fecha_nacimiento = new.fecha_nacimiento,
    ultima_consulta = new.ultima_consulta,
    estado_clinico_enc = cifrar_clinico(new.estado_clinico),
    referido_por = new.referido_por,
    referido_por_id = new.referido_por_id,
    evolucion_enc = cifrar_clinico(new.evolucion),
    estado_correccion_enc = cifrar_clinico(new.estado_correccion),
    fecha_registro = new.fecha_registro,
    tiene_cuenta = new.tiene_cuenta,
    usuario = new.usuario,
    clave_temporal = new.clave_temporal,
    updated_at = new.updated_at,
    sesion_token = new.sesion_token,
    ultimo_saludo_cumple_anio = new.ultimo_saludo_cumple_anio,
    intentos_fallidos = new.intentos_fallidos,
    bloqueado_hasta = new.bloqueado_hasta,
    origen = coalesce(new.origen, old.origen),
    confirmado_recepcion = coalesce(new.confirmado_recepcion, old.confirmado_recepcion)
  where id = old.id;
  return new;
end;
$$;
