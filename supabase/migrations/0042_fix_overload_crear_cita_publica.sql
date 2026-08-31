-- Fix: la migración 0040 le agregó un parámetro nuevo (p_triage) a
-- crear_cita_publica con "create or replace function" — pero Postgres
-- distingue funciones por firma exacta de tipos, así que un parámetro de
-- más NO reemplaza la versión vieja, crea una segunda función sobrecargada
-- en paralelo. Resultado real, confirmado en la base: dos versiones (10 y
-- 11 parámetros) coexistiendo, lo que hace ambigua cualquier llamada que no
-- incluya p_triage explícitamente — error real "is not unique" verificado
-- al probar el flujo end-to-end recién creado. Se elimina la versión vieja
-- para que solo quede una.

drop function if exists public.crear_cita_publica(uuid, text, date, text, uuid, text, text, text, text, text);
