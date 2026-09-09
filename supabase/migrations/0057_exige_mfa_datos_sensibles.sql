-- I7 de la auditoría 2026-09-09: MFA (verificación en dos pasos) solo se
-- exigía en la capa de aplicación (Login.jsx pide el código antes de dar
-- acceso al panel) — no había ninguna regla a nivel de base de datos. Una
-- sesión ya emitida por Supabase Auth ANTES de completar el segundo factor
-- (aal1) podía llamar la API directo y las políticas RLS existentes no lo
-- distinguían de una sesión con MFA ya verificado (aal2).
--
-- SeccionMfa.jsx ya documentaba esto explícitamente como una limitación
-- conocida ("esto sería lo más riguroso, pero implica revisar cada policy
-- existente — fuera de alcance... Diego lo sabe"). La razón de fondo para
-- no haberlo hecho antes era el riesgo de tener que tocar las políticas ya
-- existentes y probadas (76 en total).
--
-- Solución de bajo riesgo que evita exactamente ese problema: en vez de
-- MODIFICAR ninguna política permisiva ya existente, se agrega UNA política
-- RESTRICTIVE nueva por tabla. En RLS de Postgres, las políticas
-- PERMISSIVE se combinan con OR entre sí, pero cualquier política
-- RESTRICTIVE se exige con AND por encima de eso — así que esto no cambia
-- en nada el comportamiento de las 76 políticas existentes (que siguen
-- decidiendo QUÉ filas se pueden ver/editar), solo agrega una condición más
-- que se debe cumplir además. Verificado con la suite de RLS
-- (scripts/test-rls.mjs) que el aislamiento multi-tenant existente sigue
-- intacto después de este cambio.
--
-- La condición dice: "si esta cuenta tiene un factor MFA verificado, la
-- sesión actual debe tener aal2 (segundo factor ya completado); si la
-- cuenta nunca activó MFA, no se exige nada nuevo" — así ningún admin que
-- todavía no activó la verificación en dos pasos pierde acceso.
--
-- Aplicado a las tres tablas de datos clínicos: pacientes_base, citas_base
-- y consultas_base. service_role y las funciones security definer (que
-- corren con BYPASSRLS) no se ven afectadas por ningún cambio de este
-- archivo.
--
-- Deliberadamente NO se aplica a `perfiles`: Login.jsx necesita leer la
-- fila de perfiles de la propia cuenta (rol, si tiene MFA activado) ANTES
-- de mostrar la pantalla de código MFA, con la sesión todavía en aal1 —
-- exigir aal2 ahí crearía un candado sin llave: la cuenta nunca podría
-- leer su propio perfil para llegar a la pantalla que le pide el código.
-- Ese es exactamente el tipo de policy-por-policy que el comentario de
-- SeccionMfa.jsx advertía que había que revisar con cuidado.

create or replace function public.mfa_satisfecho()
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    not exists (
      select 1 from auth.mfa_factors
      where user_id = auth.uid() and status = 'verified'
    )
    or (auth.jwt() ->> 'aal') = 'aal2';
$$;

revoke all on function public.mfa_satisfecho() from public;
grant execute on function public.mfa_satisfecho() to authenticated;

create policy exige_aal2_si_mfa_activo on pacientes_base
  as restrictive for all
  using (mfa_satisfecho())
  with check (mfa_satisfecho());

create policy exige_aal2_si_mfa_activo on citas_base
  as restrictive for all
  using (mfa_satisfecho())
  with check (mfa_satisfecho());

create policy exige_aal2_si_mfa_activo on consultas_base
  as restrictive for all
  using (mfa_satisfecho())
  with check (mfa_satisfecho());
