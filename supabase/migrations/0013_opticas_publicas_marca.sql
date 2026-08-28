-- Agrega la columna marca (nombre_marca/eslogan/color_acento, ver
-- migración 0011) a la vista pública opticas_publicas, para que el login
-- de cada óptica pueda leer su personalización sin sesión. No agrega
-- ninguna columna sensible nueva ni cambia el grant existente — solo
-- amplía qué columnas de la misma tabla ya expuesta se ven a través de la
-- vista. Mismo criterio que 0008_lectura_publica.sql.
create or replace view opticas_publicas as
  select id, nombre, slug, logo_url, settings, motivos_consulta, marca
  from opticas
  where activa = true;
