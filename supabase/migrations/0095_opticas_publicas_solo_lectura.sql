-- Seguridad: la vista pública de ópticas era escribible por cualquiera.
--
-- `opticas_publicas` (0008, 0013) es una vista simple sobre `opticas`, por lo tanto actualizable, y corre con los
-- privilegios de su dueño: sortea el RLS de la tabla. Los permisos por defecto de Supabase le dieron INSERT, UPDATE,
-- DELETE y TRUNCATE a `anon` y a `authenticated`. Con la clave pública (que va dentro del JavaScript de la app) se
-- podía sobrescribir `settings`, `motivos_consulta` y `diagnosticos_rapidos` de cualquier óptica y crear ópticas falsas
-- (los disparadores de `opticas` solo protegen nombre, slug, estado, logo y marca).
--
-- La vista queda de solo lectura: el login, agendar cita y el portal solo la leen.

revoke insert, update, delete, truncate, references, trigger
  on public.opticas_publicas
  from anon, authenticated;

-- Verificación (debe devolver solo SELECT para ambos roles):
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'opticas_publicas' and grantee in ('anon','authenticated');
