-- 0012 dio insert público a anon, pero el INSERT seguía fallando con
-- "new row violates row-level security policy" a pesar de que la policy
-- (WITH CHECK true) existía y era correcta a nivel de catálogo. La causa
-- más probable es la combinación de una policy "FOR ALL" (superadmin) con
-- una policy específica "FOR INSERT" (anon) sobre la misma tabla — patrón
-- que Supabase/PostgREST no siempre resuelve igual que el OR puro de los
-- docs de Postgres. Se reemplaza "FOR ALL" por policies explícitas por
-- comando, dejando el INSERT exclusivamente a la policy de anon (el
-- superadmin nunca inserta leads/visitas directamente, solo lee/actualiza/
-- borra).

drop policy if exists leads_superadmin_all on leads;
create policy leads_superadmin_select on leads
  for select using (es_superadmin());
create policy leads_superadmin_update on leads
  for update using (es_superadmin()) with check (es_superadmin());
create policy leads_superadmin_delete on leads
  for delete using (es_superadmin());

drop policy if exists visitas_superadmin_all on visitas;
create policy visitas_superadmin_select on visitas
  for select using (es_superadmin());
create policy visitas_superadmin_delete on visitas
  for delete using (es_superadmin());
