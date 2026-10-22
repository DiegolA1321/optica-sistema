-- 0143 — Recordatorio del conteo del inventario: registrar que se generó la hoja de conteo (Ronda 5, punto 13).
--
-- «Recordar el conteo cada N días» (Configuración → Inventario) vive en la parametrizacion de la óptica (opticas.settings → recordatorioConteo: { activo, dias }): sin cambio de esquema.
-- Lo que falta es poder anotar «cuándo se contó por última vez» (opticas.settings → ultimoConteo, fecha) cuando se genera la hoja de conteo. La hoja la genera quien maneja el inventario,
-- que NO necesariamente puede editar la Configuración (la política de opticas pide «Configuración: editar»), así que lo hace esta función con el permiso del módulo:
--
--   registrar_conteo_inventario(p_fecha date default hoy)   → pide «Inventario: ver» (el mismo permiso con el que se ve el botón «Imprimir hoja de conteo»)
--
-- Solo escribe esa clave del settings de la óptica de quien llama; no toca ninguna otra clave ni ninguna otra óptica ni los campos protegidos de `opticas`.
-- Qué NO cambia: ningún dato existente. Una óptica sin ultimoConteo cuenta desde el día que se creó (lo resuelve la pantalla).
-- Óptica nueva: no necesita nada (activo y 30 días salen del código hasta que el administrador lo cambie).
--
-- Revertir: drop function public.registrar_conteo_inventario(date); (y, si se quiere, update opticas set settings = settings - 'ultimoConteo').

create function public.registrar_conteo_inventario(p_fecha date default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_inventario('ver');
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Guayaquil')::date);
begin
  if v_fecha > (now() at time zone 'America/Guayaquil')::date + 1 then raise exception 'La fecha del conteo no es válida.'; end if;
  update opticas
     set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{ultimoConteo}', to_jsonb(v_fecha::text), true)
   where id = v_optica;
end;
$function$;
revoke all on function public.registrar_conteo_inventario(date) from public, anon;
grant execute on function public.registrar_conteo_inventario(date) to authenticated;
