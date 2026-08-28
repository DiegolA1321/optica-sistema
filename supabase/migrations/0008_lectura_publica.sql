-- Lectura pública (sin sesión) para las páginas que no requieren cuenta:
-- agendar cita sin cuenta y el portal del paciente. Hoy `anon` ya tiene
-- permisos amplios de columna sobre `opticas` (default de Supabase) — RLS
-- es lo único que hoy lo bloquea, y así debe seguir para columnas
-- sensibles (estado_pago, monto_mensual, proximo_vencimiento). Por eso NO
-- se agrega una policy pública sobre `opticas` directamente: se expone una
-- vista con solo las columnas seguras. La vista corre con los privilegios
-- de quien la crea (esta conexión), por lo que sortea RLS de la tabla base
-- únicamente para las columnas que la vista decide mostrar.
create view opticas_publicas as
  select id, nombre, slug, logo_url, settings, motivos_consulta
  from opticas
  where activa = true;

grant select on opticas_publicas to anon, authenticated;

-- disponibilidad no tiene datos sensibles (son horarios de atención, ya
-- públicos en la práctica) — acá sí alcanza con una policy directa.
create policy disponibilidad_select_publico on disponibilidad
  for select to anon using (true);
