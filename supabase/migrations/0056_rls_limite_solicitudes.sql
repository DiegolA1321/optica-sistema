-- Hallazgo I9 de la auditoría 2026-09-09: limite_solicitudes (rate-limit de
-- RPCs públicos, migración 0035) era la única tabla de todo el esquema sin
-- RLS habilitado — exponía IPs y timestamps de intentos si los privilegios
-- por defecto de Supabase sobre `public` lo permitían.
--
-- Sin ninguna policy (deny-all para anon/authenticated): nadie necesita
-- nunca leer o escribir esta tabla directo. limite_excedido() sigue
-- funcionando exactamente igual porque es security definer, propiedad de un
-- rol con BYPASSRLS — RLS nunca la afecta a ella, solo bloquea el acceso
-- directo por PostgREST/el cliente.

alter table limite_solicitudes enable row level security;
