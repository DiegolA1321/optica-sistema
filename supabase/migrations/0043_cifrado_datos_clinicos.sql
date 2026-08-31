-- Cifrado AES de datos clínicos sensibles — el anteproyecto (sección 7.4)
-- pide explícitamente "cifrado AES para datos sensibles", más específico
-- que el cifrado en reposo/tránsito que ya da la infraestructura de
-- Supabase. Se cifran los campos de `consultas` que son historia clínica
-- real: diagnóstico, antecedentes, alergias, antecedentes familiares,
-- indicaciones, y los datos clínicos estructurados (retinoscopia/OD/OI/
-- medidas/examen).
--
-- REQUIERE que la clave ya exista en Vault ANTES de correr esto:
--   select vault.create_secret('<clave>', 'clinical_data_key', 'Clave AES de datos clínicos');
-- (mismo patrón que resend_api_key/app_base_url — nunca en un archivo
-- versionado). Sin la clave, esta migración se detiene sola de entrada:
-- mejor eso que dejar datos sin cifrar o romper el guardado de consultas
-- en producción a medio camino.
--
-- Diseño (para no tocar el frontend): la tabla real pasa a llamarse
-- `consultas_base` (con columnas bytea *_enc en vez de texto plano). Una
-- VISTA llamada `consultas` — mismo nombre y misma forma de siempre —
-- descifra al leer y cifra al escribir vía triggers INSTEAD OF, con
-- security_invoker=true para que las políticas RLS de la tabla base se
-- sigan aplicando según quién consulta, no según el dueño de la vista.
-- ConsultaMedica.jsx, App.jsx y mis_consultas_paciente() siguen usando
-- "consultas" exactamente igual — no cambia una sola línea de frontend.
--
-- Nota de alcance: solo se cifra `consultas` (el núcleo de la historia
-- clínica). `pacientes.estado_clinico/evolucion` y `citas.triage` también
-- son datos de salud y quedan como candidatos para una ronda aparte si
-- Diego la pide — no se tocan acá para mantener este cambio auditable y
-- de bajo riesgo.

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'clinical_data_key') then
    raise exception 'Falta configurar el secreto clinical_data_key en Vault antes de correr esta migración.';
  end if;
end $$;

alter table consultas rename to consultas_base;

alter table consultas_base
  add column if not exists diagnostico_enc bytea,
  add column if not exists antecedentes_enc bytea,
  add column if not exists alergias_enc bytea,
  add column if not exists antecedentes_familiares_enc bytea,
  add column if not exists indicaciones_enc bytea,
  add column if not exists datos_clinicos_enc bytea;

-- ── Helpers de cifrado — la clave de Vault nunca sale de estas dos
--    funciones; todo lo demás (vista, triggers) las llama sin tocarla. ──
create or replace function public.cifrar_clinico(p_texto text)
returns bytea
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text;
begin
  if p_texto is null then return null; end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'clinical_data_key' limit 1;
  if v_key is null then
    raise exception 'clinical_data_key no configurada en Vault.';
  end if;
  return extensions.pgp_sym_encrypt(p_texto, v_key);
end;
$$;

create or replace function public.descifrar_clinico(p_data bytea)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text;
begin
  if p_data is null then return null; end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'clinical_data_key' limit 1;
  if v_key is null then return null; end if;
  return extensions.pgp_sym_decrypt(p_data, v_key);
end;
$$;

revoke all on function public.cifrar_clinico(text) from public;
revoke all on function public.descifrar_clinico(bytea) from public;
-- Ejecutable solo por cuentas reales (admin/asistente/superadmin) — son
-- ellas quienes leen/escriben "consultas" directo (la vista de abajo).
-- mis_consultas_paciente() no necesita este grant: al ser ella misma
-- security definer, todo lo que hace por dentro (incluida esta llamada
-- anidada) ya corre con privilegios elevados propios, sin pasar por el rol
-- anon.
grant execute on function public.cifrar_clinico(text) to authenticated;
grant execute on function public.descifrar_clinico(bytea) to authenticated;

-- ── Migra a cifrado lo que ya existía en texto plano ──
update consultas_base set
  diagnostico_enc = cifrar_clinico(diagnostico),
  antecedentes_enc = cifrar_clinico(antecedentes),
  alergias_enc = cifrar_clinico(alergias),
  antecedentes_familiares_enc = cifrar_clinico(antecedentes_familiares),
  indicaciones_enc = cifrar_clinico(indicaciones),
  datos_clinicos_enc = cifrar_clinico(datos_clinicos::text)
where diagnostico_enc is null and antecedentes_enc is null and alergias_enc is null
  and antecedentes_familiares_enc is null and indicaciones_enc is null and datos_clinicos_enc is null;

alter table consultas_base
  drop column diagnostico,
  drop column antecedentes,
  drop column alergias,
  drop column antecedentes_familiares,
  drop column indicaciones,
  drop column datos_clinicos;

-- ── Vista pública "consultas" — mismo nombre, misma forma de siempre ──
create view consultas
with (security_invoker = true)
as
select
  cb.id, cb.optica_id, cb.paciente_id, cb.paciente, cb.fecha, cb.motivo, cb.usa_lentes,
  descifrar_clinico(cb.antecedentes_enc) as antecedentes,
  descifrar_clinico(cb.alergias_enc) as alergias,
  descifrar_clinico(cb.antecedentes_familiares_enc) as antecedentes_familiares,
  descifrar_clinico(cb.datos_clinicos_enc)::jsonb as datos_clinicos,
  descifrar_clinico(cb.diagnostico_enc) as diagnostico,
  cb.lente_recomendado,
  descifrar_clinico(cb.indicaciones_enc) as indicaciones,
  cb.proximo_control_dias, cb.evolucion_calculada, cb.estado_correccion,
  cb.producto_id, cb.producto_nombre, cb.monto_venta, cb.profesional_nombre, cb.created_at
from consultas_base cb;

-- INSTEAD OF a propósito SIN security definer: el insert real a
-- consultas_base debe correr con los permisos de quien lo pide, para que
-- las policies de RLS (consultas_staff_write, migración 0034) lo sigan
-- filtrando por optica_id igual que siempre. Solo cifrar_clinico() de
-- arriba necesita estar elevada (para leer la clave de Vault).
create or replace function public.consultas_instead_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into consultas_base (
    optica_id, paciente_id, paciente, fecha, motivo, usa_lentes,
    antecedentes_enc, alergias_enc, antecedentes_familiares_enc,
    datos_clinicos_enc, diagnostico_enc, lente_recomendado, indicaciones_enc,
    proximo_control_dias, evolucion_calculada, estado_correccion,
    producto_id, producto_nombre, monto_venta, profesional_nombre
  ) values (
    new.optica_id, new.paciente_id, new.paciente, new.fecha, new.motivo, new.usa_lentes,
    cifrar_clinico(new.antecedentes), cifrar_clinico(new.alergias), cifrar_clinico(new.antecedentes_familiares),
    cifrar_clinico(new.datos_clinicos::text), cifrar_clinico(new.diagnostico), new.lente_recomendado, cifrar_clinico(new.indicaciones),
    new.proximo_control_dias, new.evolucion_calculada, new.estado_correccion,
    new.producto_id, new.producto_nombre, new.monto_venta, new.profesional_nombre
  )
  returning id into v_id;

  select * into new from consultas where id = v_id;
  return new;
end;
$$;

create trigger consultas_insert_trigger
  instead of insert on consultas
  for each row execute function public.consultas_instead_insert();

-- INSTEAD OF delete: mismo criterio, sin security definer, para que
-- consultas_staff_write siga controlando quién puede borrar.
create or replace function public.consultas_instead_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from consultas_base where id = old.id;
  return old;
end;
$$;

create trigger consultas_delete_trigger
  instead of delete on consultas
  for each row execute function public.consultas_instead_delete();

-- Grant explícito sobre la vista (además del que Supabase ya da por
-- defecto a las tablas nuevas — las vistas no siempre lo heredan igual, y
-- es barato dejarlo explícito). La fila a fila la sigue filtrando RLS en
-- consultas_base vía security_invoker.
grant select, insert, delete on consultas to authenticated;
