-- 0128 · El portal cuenta los puntos de fidelidad con la misma regla que el CRM
-- Los puntos son 10 por cada consulta y 15 por cada paciente que el paciente refirió (utilidades/fidelizacion.js: puntosFidelidad). El portal ya cuenta las consultas del paciente, pero
-- no puede saber a cuántos pacientes refirió: la tabla de pacientes no es visible para él. Esta función entrega SOLO ese número (un entero, sin nombres ni datos de nadie).
--
-- Mismo criterio que `listarReferidos` del sistema del personal: se cuenta a quien tiene `referido_por_id` igual al paciente y, si esa persona no tiene el id resuelto (registros viejos),
-- a quien escribió su nombre como referente. Pacientes anonimizados no cuentan. Mismo token de sesión que las demás funciones del portal.

create or replace function public.mis_referidos_paciente(p_paciente_id uuid, p_token text default null)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((
    select count(*)::int
    from pacientes_base p, pacientes_base yo
    where yo.id = p_paciente_id and sesion_paciente_valida(p_paciente_id, p_token)
      and p.optica_id = yo.optica_id and p.id <> yo.id and p.anonimizado_en is null
      and (p.referido_por_id = yo.id or (p.referido_por_id is null and lower(btrim(coalesce(p.referido_por, ''))) = lower(btrim(yo.nombre)) and btrim(yo.nombre) <> ''))
  ), 0);
$function$;
revoke all on function public.mis_referidos_paciente(uuid, text) from public;
grant execute on function public.mis_referidos_paciente(uuid, text) to anon, authenticated;

-- ───────────────────────── Reversión (no se ejecuta) ─────────────────────────
--   drop function public.mis_referidos_paciente(uuid, text);
