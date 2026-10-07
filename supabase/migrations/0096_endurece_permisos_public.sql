-- Seguridad: mínimo privilegio en los permisos (grants) del esquema public. Partes A, B y D.
-- (La parte C, quitar la escritura directa de `authenticated` en las tablas que solo se usan por RPC, va aparte en
-- 0097, para aplicarla después de las pruebas con Playwright.)
--
-- Supabase da por defecto todos los permisos de tabla a `anon` y `authenticated`; hasta hoy el único freno era el RLS.
-- Esto quita lo que la app no usa, como segunda barrera (si una política se escribiera mal, el permiso ya no existe).
-- Se apoya en un recorrido del código: las páginas públicas solo usan funciones RPC y la vista opticas_publicas.
--
-- ¿Cómo se revierte? Al final del archivo hay el bloque de reversión.

-- ───────────────────────── A. Permisos que ninguna ruta de la app usa ─────────────────────────
-- TRUNCATE no está sujeto a RLS; REFERENCES y TRIGGER solo sirven para crear objetos. PostgREST no usa ninguno.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- ───────────────────────── B. anon: solo lectura de lo público ─────────────────────────
-- Las páginas públicas (agendar, portal, venta, login) trabajan con RPC y con la vista opticas_publicas.
revoke select, insert, update, delete on all tables in schema public from anon;
grant select on public.opticas_publicas, public.disponibilidad to anon;
revoke all on all sequences in schema public from anon;

-- ───────────────────────── D. Funciones internas ejecutables desde la API ─────────────────────────
-- Estas tres solo las debe llamar pg_cron (corre como postgres, no le afecta). Hoy cualquiera podía llamarlas por /rpc.
revoke execute on function public.enviar_recordatorios_citas()   from public, anon, authenticated;
revoke execute on function public.enviar_saludos_cumpleanos()    from public, anon, authenticated;
revoke execute on function public.marcar_no_asistio_automatico() from public, anon, authenticated;

-- El cifrado clínico lo usan las vistas (como quien consulta, authenticated) y las RPC (como su dueño); anon no lo necesita.
revoke execute on function public.cifrar_clinico(text)    from public, anon;
revoke execute on function public.descifrar_clinico(bytea) from public, anon;
grant  execute on function public.cifrar_clinico(text), public.descifrar_clinico(bytea) to authenticated, service_role;

-- ───────────────────────── Reversión (no se ejecuta; solo para tenerla a mano) ─────────────────────────
-- grant select, insert, update, delete, truncate, references, trigger on all tables in schema public to anon, authenticated;
-- grant all on all sequences in schema public to anon;
-- grant execute on function public.enviar_recordatorios_citas(), public.enviar_saludos_cumpleanos(),
--   public.marcar_no_asistio_automatico(), public.cifrar_clinico(text), public.descifrar_clinico(bytea) to public;
-- (la reversión de 0095 NO se recomienda: reabre la escritura anónima de opticas_publicas)
