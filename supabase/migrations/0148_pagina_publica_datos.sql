-- 0148 — Datos públicos de «Quiénes somos» (Ingreso y página pública, puntos 8 y 9).
--
-- La página pública de cada óptica muestra al optómetra (foto, nombre y registro, que salen de Usuarios) y tres números automáticos (años, pacientes atendidos, optómetras).
-- Esos datos no se escriben dos veces: la foto es nueva (perfiles.foto_url, la sube el administrador en Usuarios) y el resto se calcula aquí. Una función pública entrega SOLO lo que la
-- página muestra: nombre, registro profesional y foto de quienes atienden pacientes, y un conteo. Nunca cédula, correo, permisos ni datos de los pacientes (el conteo es un número).
--
-- Los textos, el logo, el color y los servicios/preguntas editables viven en `opticas.marca` (ya editable por el administrador y ya visible en la vista `opticas_publicas`): no necesitan
-- cambio de esquema; una óptica sin esas claves (existente o nueva) recibe los textos de ejemplo desde la aplicación.
--
-- Qué NO cambia: ninguna fila existente (foto_url nace vacía), ninguna política ni permiso. Una óptica nueva no necesita nada.
-- Revertir: drop function public.pagina_publica_datos(uuid); alter table public.perfiles drop column foto_url.

alter table public.perfiles add column if not exists foto_url text;

create or replace function public.pagina_publica_datos(p_optica_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'optometras', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'registro', p.registro_profesional, 'foto', p.foto_url) order by p.nombre)
        from perfiles p
       where p.optica_id = p_optica_id and p.activo and p.rol in ('admin', 'asistente') and coalesce(p.es_optometra, false)), '[]'::jsonb),
    'pacientesAtendidos', (
      select count(*) from (
        select paciente_id from citas_base where optica_id = p_optica_id and estado = 'Atendida' and paciente_id is not null
        union
        select paciente_id from consultas_base where optica_id = p_optica_id and paciente_id is not null
      ) t)
  )
  where exists (select 1 from opticas o where o.id = p_optica_id and o.activa);
$$;

revoke all on function public.pagina_publica_datos(uuid) from public;
grant execute on function public.pagina_publica_datos(uuid) to anon, authenticated;
