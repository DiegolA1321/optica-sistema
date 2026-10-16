-- 0117 · Correcciones de la auditoría transversal (16 oct. 2026)
-- Tres cosas, ninguna borra datos clínicos ni financieros:
--   T3  Los catálogos predeterminados de una óptica nueva (motivos de consulta y diagnósticos rápidos) nacían SIN tildes
--       ("Adaptacion de Lentes", "Miopia"). Se corrigen el valor por defecto y las ópticas que aún tienen EXACTAMENTE la lista vieja.
--   T4  La bitácora de una óptica nueva traía entradas que su administrador no hizo ("Sistema cambió los permisos de un rol", de la migración
--       0115, y "Diego Alarcón creó un rol" de los tres roles predefinidos que nacen con la óptica). El registro ya no anota lo que no hace una
--       persona con sesión ni la creación de los roles predefinidos, y se quitan las entradas que ya estaban.
--   Rol Optómetra  Decisión de Diego: el Optómetra predefinido ya no tiene el módulo Ventas (ni saldos ni comprobantes de toda la óptica ni
--       exportarlos). Sigue viendo lo que compró cada paciente, en solo lectura, porque ese dato lo da "Pacientes: ver" (políticas de lectura de
--       facturas_venta, abonos_factura y órdenes de laboratorio, que ya incluyen pacientes y fichas). Los roles propios no se tocan.

-- ───────────── T4 · el registro de permisos solo anota lo que hace una persona ─────────────
create or replace function public.registrar_cambio_permisos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid;
  v_actor perfiles%rowtype;
  v_accion text;
  v_detalle text;
  v_rol roles%rowtype;
  v_persona text;
begin
  -- Sin una persona con sesión (una migración, un script) no hay quién lo hizo: no se registra (regla 40 de docs/principios-diseno.md).
  if auth.uid() is null then
    return null;
  end if;
  select * into v_actor from perfiles where id = auth.uid();
  if tg_table_name = 'roles' then
    v_rol := case when tg_op = 'DELETE' then old else new end;
    v_optica := v_rol.optica_id;
    -- Al borrar una óptica entera sus roles se borran en cascada: no hay nada que registrar.
    if tg_op = 'DELETE' and not exists (select 1 from opticas where id = v_optica) then
      return null;
    end if;
    -- Los tres roles predefinidos nacen con la óptica: no los creó su administrador.
    if tg_op = 'INSERT' and v_rol.es_predefinido then
      return null;
    end if;
    v_accion := case tg_op when 'INSERT' then 'Creó un rol' when 'DELETE' then 'Eliminó un rol' else 'Cambió los permisos de un rol' end;
    v_detalle := v_rol.nombre;
    if tg_op = 'UPDATE' and old.permisos = new.permisos and old.alcance = new.alcance and old.nombre = new.nombre and old.inicio = new.inicio and old.atiende_pacientes = new.atiende_pacientes then
      return null;
    end if;
  else
    select p.optica_id, p.nombre into v_optica, v_persona from perfiles p where p.id = coalesce(new.perfil_id, old.perfil_id);
    select * into v_rol from roles where id = coalesce(new.rol_id, old.rol_id);
    v_accion := case tg_op when 'INSERT' then 'Asignó un rol' else 'Quitó un rol' end;
    v_detalle := coalesce(v_rol.nombre, 'rol') || ' · ' || coalesce(v_persona, 'persona');
  end if;
  if v_optica is not null then
    insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
    values (v_optica, v_actor.id, coalesce(v_actor.nombre, 'Sistema'), 'usuarios', v_accion, v_detalle);
  end if;
  return null;
end;
$$;

-- Entradas que ya estaban: las de "Sistema" sobre roles y personas (las escribió una migración, no una persona) y la creación de los roles
-- predefinidos junto con su óptica (en el primer minuto de vida de la óptica).
delete from logs_optica
 where usuario_nombre = 'Sistema' and modulo = 'usuarios'
   and accion in ('Cambió los permisos de un rol', 'Creó un rol', 'Eliminó un rol', 'Asignó un rol', 'Quitó un rol');
delete from logs_optica l
  using opticas o
 where l.optica_id = o.id and l.modulo = 'usuarios' and l.accion = 'Creó un rol'
   and l.detalle in ('Optómetra', 'Recepción', 'Ventas')
   and l.created_at <= o.created_at + interval '1 minute';

-- ───────────── Rol Optómetra · sin el módulo Ventas ─────────────
create or replace function public._plantilla_rol(p_clave text)
returns jsonb
language sql
immutable
as $$
  select case p_clave
    when 'optometra' then '{
      "nombre": "Optómetra", "atiende": true, "inicio": "optometra",
      "descripcion": "Atiende pacientes: su agenda, la ficha clínica y la receta. Ve el inventario sin modificarlo y, en el perfil de cada paciente, lo que compró.",
      "permisos": {"pacientes":["ver","crear","editar"],"consultas":["ver","crear","editar"],"citas":["ver","crear","editar"],
                   "inventario":["ver"],"crm":["ver"],"reportes":["ver"],"horario":["ver"],"horario_optica":["ver"],"mensajes":["ver","crear"]},
      "alcance": {"citas":"propio","consultas":"propio","reportes":"propio"}}'::jsonb
    when 'recepcion' then '{
      "nombre": "Recepción", "atiende": false, "inicio": "recepcion",
      "descripcion": "Agenda citas, registra pacientes y cobra. Ve la ficha clínica sin editarla.",
      "permisos": {"pacientes":["ver","crear","editar"],"consultas":["ver"],"citas":["ver","crear","editar"],
                   "ventas":["ver","crear","editar"],"inventario":["ver"],"crm":["ver","crear","editar"],"horario":["ver"],"horario_optica":["ver"],"mensajes":["ver","crear"]},
      "alcance": {}}'::jsonb
    when 'ventas' then '{
      "nombre": "Ventas", "atiende": false, "inicio": "ventas",
      "descripcion": "Vende, arma proformas, cobra abonos y gestiona las órdenes de laboratorio. Ve la ficha clínica sin editarla.",
      "permisos": {"pacientes":["ver"],"consultas":["ver"],"citas":["ver"],"ventas":["ver","crear","editar"],
                   "inventario":["ver","crear","editar"],"crm":["ver"],"horario":["ver"],"horario_optica":["ver"],"mensajes":["ver","crear"]},
      "alcance": {}}'::jsonb
  end;
$$;

-- Los Optómetra predefinidos que existen: solo si todavía tienen Ventas EXACTAMENTE como venía de fábrica (solo ver). Los que el administrador
-- ya personalizó (por ejemplo con Ventas "crear") y los roles propios no se tocan. La descripción solo cambia si era la de fábrica.
update roles
   set permisos = permisos - 'ventas',
       descripcion = case
         when descripcion = 'Atiende pacientes: su agenda, la ficha clínica y la receta. Ve el inventario y las ventas sin modificarlos.'
         then 'Atiende pacientes: su agenda, la ficha clínica y la receta. Ve el inventario sin modificarlo y, en el perfil de cada paciente, lo que compró.'
         else descripcion end
 where es_predefinido and clave = 'optometra' and permisos -> 'ventas' = '["ver"]'::jsonb;

-- ───────────── T3 · catálogos predeterminados con sus tildes ─────────────
alter table opticas alter column motivos_consulta
  set default array['Consulta General', 'Adaptación de Lentes', 'Examen de Control', 'Garantía / Ajuste']::text[];
alter table opticas alter column diagnosticos_rapidos
  set default array['Miopía', 'Hipermetropía', 'Astigmatismo', 'Presbicia', 'Miopía y astigmatismo', 'Hipermetropía y astigmatismo', 'Sin alteración refractiva']::text[];

-- Las ópticas que todavía tienen la lista vieja, tal cual (ninguna cita ni ficha usa esas palabras sin tilde, salvo una ficha de prueba).
update opticas
   set motivos_consulta = array['Consulta General', 'Adaptación de Lentes', 'Examen de Control', 'Garantía / Ajuste']::text[]
 where motivos_consulta = array['Consulta General', 'Adaptacion de Lentes', 'Examen de Control', 'Garantia / Ajuste']::text[];
update opticas
   set diagnosticos_rapidos = array['Miopía', 'Hipermetropía', 'Astigmatismo', 'Presbicia', 'Miopía y astigmatismo', 'Hipermetropía y astigmatismo', 'Sin alteración refractiva']::text[]
 where diagnosticos_rapidos = array['Miopia', 'Hipermetropia', 'Astigmatismo', 'Presbicia', 'Miopia y astigmatismo', 'Hipermetropia y astigmatismo', 'Sin alteracion refractiva']::text[];
