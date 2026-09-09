-- F4 del roadmap de modernización: contarReferidos() en fidelizacion.js
-- empareja pacientes por nombre normalizado en texto libre, no por
-- identidad real — el mismo patrón de bug ("identidad por nombre") que ya
-- causó un incidente real documentado en este proyecto (Cuarta Mirada),
-- ahora en el módulo de fidelización. Si el paciente que refirió cambia de
-- nombre (matrimonio, corrección de tilde, etc.), el conteo de referidos
-- se rompe silenciosamente.
--
-- "pacientes" es una vista (cifrado transparente) sobre pacientes_base con
-- triggers INSTEAD OF — el ALTER va sobre la tabla real, la vista y los 2
-- triggers de escritura se actualizan para pasar la columna nueva.
alter table public.pacientes_base
  add column if not exists referido_por_id uuid references public.pacientes_base(id) on delete set null;

comment on column public.pacientes_base.referido_por_id is
  'Resuelto al guardar si el texto libre de referido_por coincide con un paciente existente. Null si no coincide o si el referente no es paciente.';

create or replace view public.pacientes as
 SELECT id,
    optica_id,
    nombre,
    cedula,
    telefono,
    correo,
    fecha_nacimiento,
    ultima_consulta,
    descifrar_clinico(estado_clinico_enc) AS estado_clinico,
    referido_por,
    descifrar_clinico(evolucion_enc) AS evolucion,
    descifrar_clinico(estado_correccion_enc) AS estado_correccion,
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
    referido_por_id
   FROM pacientes_base pb;

create or replace function public.pacientes_instead_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  insert into pacientes_base (
    optica_id, nombre, cedula, telefono, correo, fecha_nacimiento, ultima_consulta,
    estado_clinico_enc, referido_por, referido_por_id, evolucion_enc, estado_correccion_enc,
    fecha_registro, tiene_cuenta, usuario, clave_temporal,
    sesion_token, ultimo_saludo_cumple_anio, intentos_fallidos, bloqueado_hasta
  ) values (
    new.optica_id, new.nombre, new.cedula, new.telefono, new.correo, new.fecha_nacimiento, new.ultima_consulta,
    cifrar_clinico(new.estado_clinico), new.referido_por, new.referido_por_id, cifrar_clinico(new.evolucion), cifrar_clinico(new.estado_correccion),
    coalesce(new.fecha_registro, current_date), coalesce(new.tiene_cuenta, false), new.usuario, new.clave_temporal,
    new.sesion_token, new.ultimo_saludo_cumple_anio, coalesce(new.intentos_fallidos, 0), new.bloqueado_hasta
  )
  returning id into v_id;

  select * into new from pacientes where id = v_id;
  return new;
end;
$function$;

create or replace function public.pacientes_instead_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    bloqueado_hasta = new.bloqueado_hasta
  where id = old.id;
  return new;
end;
$function$;
