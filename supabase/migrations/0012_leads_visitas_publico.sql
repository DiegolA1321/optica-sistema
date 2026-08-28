-- Acceso público (anon) para que la página de venta y las landings de cada
-- óptica puedan registrar un lead / una visita sin sesión. Solo permite
-- INSERT — nunca lectura ni edición (eso sigue siendo exclusivo del
-- superadmin, vía leads_superadmin_all/visitas_superadmin_all de la
-- migración 0011). Mismo patrón que disponibilidad_select_publico en
-- 0008_lectura_publica.sql.

create policy leads_insert_publico on leads
  for insert to anon with check (true);

create policy visitas_insert_publico on visitas
  for insert to anon with check (true);
