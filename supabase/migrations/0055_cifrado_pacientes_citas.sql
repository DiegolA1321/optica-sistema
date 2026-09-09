-- Extiende el cifrado AES de datos clínicos (0043) a las dos columnas de
-- `pacientes` y la de `citas` que quedaron fuera de esa ronda a propósito
-- (documentado en el propio comentario de 0043 como "candidatos para una
-- ronda aparte") — hallazgo I1 de la auditoría exhaustiva 2026-09-09.
--
-- Se cifran: pacientes.estado_clinico, pacientes.evolucion,
-- pacientes.estado_correccion, citas.triage. (consultas_base.estado_correccion
-- es una columna DISTINTA, ya evaluada y dejada sin cifrar a propósito —
-- no se toca acá.)
--
-- REQUIERE que 'clinical_data_key' ya exista en Vault (la creó 0043) y que
-- cifrar_clinico()/descifrar_clinico() ya existan (también de 0043) — se
-- reutilizan tal cual, sin duplicarlas.
--
-- Mismo diseño que 0043, pero con una diferencia real importante: a
-- diferencia de `consultas` (solo se inserta, nunca se edita — cada visita
-- es una fila nueva), tanto `pacientes` como `citas` se ACTUALIZAN todo el
-- tiempo (editar datos de contacto, cambiar estado de una cita, vincular un
-- paciente nuevo a una cita, etc.), así que además del INSTEAD OF INSERT y
-- DELETE que ya se usaron para `consultas`, acá hace falta también un
-- INSTEAD OF UPDATE. Postgres arma automáticamente el `NEW` de una vista
-- actualizable copiando del `OLD` cualquier columna que un UPDATE parcial no
-- haya tocado, así que escribir el trigger con todas las columnas es
-- correcto y seguro — se comporta exactamente igual que un UPDATE directo
-- sobre la tabla real hubiera hecho.
--
-- Renombrar `pacientes`/`citas` es seguro para foreign keys, índices y RLS
-- existentes: Postgres los seguimiento por OID, no por nombre, así que
-- `citas.paciente_id references pacientes(id)` y las políticas RLS de
-- ambas tablas (y de cualquier otra que las referencie) siguen funcionando
-- sin cambios después del rename.

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'clinical_data_key') then
    raise exception 'Falta el secreto clinical_data_key en Vault (debería existir desde la migración 0043).';
  end if;
  if to_regprocedure('public.cifrar_clinico(text)') is null then
    raise exception 'Falta la función cifrar_clinico() (debería existir desde la migración 0043).';
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- PACIENTES
-- ════════════════════════════════════════════════════════════════
alter table pacientes rename to pacientes_base;

alter table pacientes_base
  add column if not exists estado_clinico_enc bytea,
  add column if not exists evolucion_enc bytea,
  add column if not exists estado_correccion_enc bytea;

update pacientes_base set
  estado_clinico_enc = cifrar_clinico(estado_clinico),
  evolucion_enc = cifrar_clinico(evolucion),
  estado_correccion_enc = cifrar_clinico(estado_correccion)
where estado_clinico_enc is null and evolucion_enc is null and estado_correccion_enc is null;

alter table pacientes_base
  drop column estado_clinico,
  drop column evolucion,
  drop column estado_correccion;

create view pacientes
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
  pb.intentos_fallidos, pb.bloqueado_hasta
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
    estado_clinico_enc, referido_por, evolucion_enc, estado_correccion_enc,
    fecha_registro, tiene_cuenta, usuario, clave_temporal,
    sesion_token, ultimo_saludo_cumple_anio, intentos_fallidos, bloqueado_hasta
  ) values (
    new.optica_id, new.nombre, new.cedula, new.telefono, new.correo, new.fecha_nacimiento, new.ultima_consulta,
    cifrar_clinico(new.estado_clinico), new.referido_por, cifrar_clinico(new.evolucion), cifrar_clinico(new.estado_correccion),
    coalesce(new.fecha_registro, current_date), coalesce(new.tiene_cuenta, false), new.usuario, new.clave_temporal,
    new.sesion_token, new.ultimo_saludo_cumple_anio, coalesce(new.intentos_fallidos, 0), new.bloqueado_hasta
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
    bloqueado_hasta = new.bloqueado_hasta
  where id = old.id;
  return new;
end;
$$;

create or replace function public.pacientes_instead_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from pacientes_base where id = old.id;
  return old;
end;
$$;

create trigger pacientes_insert_trigger instead of insert on pacientes
  for each row execute function public.pacientes_instead_insert();
create trigger pacientes_update_trigger instead of update on pacientes
  for each row execute function public.pacientes_instead_update();
create trigger pacientes_delete_trigger instead of delete on pacientes
  for each row execute function public.pacientes_instead_delete();

grant select, insert, update, delete on pacientes to authenticated;

-- ════════════════════════════════════════════════════════════════
-- CITAS
-- ════════════════════════════════════════════════════════════════
alter table citas rename to citas_base;

alter table citas_base
  add column if not exists triage_enc bytea;

update citas_base set
  triage_enc = cifrar_clinico(triage::text)
where triage_enc is null and triage is not null;

alter table citas_base
  drop column triage;

create view citas
with (security_invoker = true)
as
select
  cb.id, cb.optica_id, cb.paciente_id, cb.paciente, cb.cedula, cb.telefono, cb.fecha, cb.hora,
  cb.motivo, cb.motivo_publico, cb.estado, cb.created_at, cb.updated_at, cb.correo,
  cb.recordatorio_enviado_at, cb.confirmada_at,
  descifrar_clinico(cb.triage_enc)::jsonb as triage,
  cb.encuesta_enviada_at
from citas_base cb;

create or replace function public.citas_instead_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into citas_base (
    optica_id, paciente_id, paciente, cedula, telefono, fecha, hora,
    motivo, motivo_publico, estado, correo, recordatorio_enviado_at, confirmada_at,
    triage_enc, encuesta_enviada_at
  ) values (
    new.optica_id, new.paciente_id, new.paciente, new.cedula, new.telefono, new.fecha, new.hora,
    new.motivo, new.motivo_publico, coalesce(new.estado, 'Pendiente'), new.correo, new.recordatorio_enviado_at, new.confirmada_at,
    cifrar_clinico(new.triage::text), new.encuesta_enviada_at
  )
  returning id into v_id;

  select * into new from citas where id = v_id;
  return new;
end;
$$;

create or replace function public.citas_instead_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update citas_base set
    optica_id = new.optica_id,
    paciente_id = new.paciente_id,
    paciente = new.paciente,
    cedula = new.cedula,
    telefono = new.telefono,
    fecha = new.fecha,
    hora = new.hora,
    motivo = new.motivo,
    motivo_publico = new.motivo_publico,
    estado = new.estado,
    updated_at = new.updated_at,
    correo = new.correo,
    recordatorio_enviado_at = new.recordatorio_enviado_at,
    confirmada_at = new.confirmada_at,
    triage_enc = cifrar_clinico(new.triage::text),
    encuesta_enviada_at = new.encuesta_enviada_at
  where id = old.id;
  return new;
end;
$$;

create or replace function public.citas_instead_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from citas_base where id = old.id;
  return old;
end;
$$;

create trigger citas_insert_trigger instead of insert on citas
  for each row execute function public.citas_instead_insert();
create trigger citas_update_trigger instead of update on citas
  for each row execute function public.citas_instead_update();
create trigger citas_delete_trigger instead of delete on citas
  for each row execute function public.citas_instead_delete();

grant select, insert, update, delete on citas to authenticated;
