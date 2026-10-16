-- Panel del superadmin v2: óptica de prueba, último ingreso y uso de cada óptica, y una actividad que no se puede borrar ni editar.
--
-- Qué hace (todo suma; nada de lo que usa la versión publicada cambia):
--   1. `opticas.es_de_prueba` (boolean, falso por defecto). Solo el superadmin la cambia (el disparador de columnas reservadas la
--      protege igual que nombre, slug o estado de pago). Se marcan las tres ópticas de prueba que hay hoy: Óptica Demo (qu7u2j),
--      QA Test Claude (v8twzq) y la óptica vacía (3pldf1). Nada se borra.
--   2. `datos_negocio_superadmin()`: SOLO para el superadmin. Entrega por persona del personal su último ingreso (auth.users) y por
--      óptica lo que hizo en los últimos 30 días: citas, consultas y ventas registradas, y cuántas acciones de cada módulo anotó el
--      personal en la actividad de la óptica. Sin esto el navegador no puede leer el último ingreso (auth.users no es legible).
--   3. `auditoria`: dos columnas nuevas (`antes`, `despues`) para mostrar qué cambió, más acciones permitidas (marcar óptica de prueba,
--      cambiar el estado de un lead, cambiar el estado de una consulta de soporte, marcar una factura como pagada, cambiar la
--      suscripción) y un disparador que impide borrar o editar un registro. Lo único que puede cambiar es que `optica_id` o
--      `actor_id` pasen a nulo cuando se elimina esa óptica o esa cuenta (así lo hace la llave foránea, y es lo que hoy ocurre).

-- 1. Óptica de prueba ---------------------------------------------------------------------------------------------------
alter table public.opticas add column if not exists es_de_prueba boolean not null default false;
update public.opticas set es_de_prueba = true where slug in ('qu7u2j', 'v8twzq', '3pldf1') and es_de_prueba is distinct from true;

create or replace function opticas_bloquea_columnas_reservadas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from perfiles where id = auth.uid() and rol = 'superadmin'
  ) then
    return new;
  end if;

  if new.nombre is distinct from old.nombre
    or new.slug is distinct from old.slug
    or new.activa is distinct from old.activa
    or new.estado_pago is distinct from old.estado_pago
    or new.monto_mensual is distinct from old.monto_mensual
    or new.proximo_vencimiento is distinct from old.proximo_vencimiento
    or new.es_de_prueba is distinct from old.es_de_prueba
  then
    raise exception 'Solo el superadministrador puede modificar nombre, slug o estado de la óptica.';
  end if;

  if (new.marca is distinct from old.marca or new.logo_url is distinct from old.logo_url)
    and not exists (
      select 1 from perfiles where id = auth.uid() and rol = 'admin' and optica_id = old.id
    )
  then
    raise exception 'Solo el administrador de esta óptica (o el superadministrador) puede modificar su marca o logo.';
  end if;

  return new;
end;
$$;

-- 2. Último ingreso y uso de cada óptica ---------------------------------------------------------------------------------
create or replace function datos_negocio_superadmin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desde timestamptz := now() - interval '30 days';
  v_antes timestamptz := now() - interval '60 days';
  v_personas jsonb;
  v_opticas jsonb;
begin
  if not es_superadmin() then
    raise exception 'Solo el superadministrador puede ver esto.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'perfil_id', p.id, 'optica_id', p.optica_id, 'rol', p.rol, 'nombre', p.nombre, 'activo', coalesce(p.activo, true),
           'ultimo_ingreso', u.last_sign_in_at) order by p.nombre), '[]'::jsonb)
    into v_personas
    from perfiles p
    left join auth.users u on u.id = p.id
   where p.rol in ('admin', 'asistente');

  select coalesce(jsonb_agg(jsonb_build_object(
           'optica_id', o.id,
           'citas', (select count(*) from citas_base c where c.optica_id = o.id and c.created_at >= v_desde),
           'consultas', (select count(*) from consultas_base c where c.optica_id = o.id and c.created_at >= v_desde),
           'ventas', (select count(*) from facturas_venta f where f.optica_id = o.id and f.created_at >= v_desde and f.estado <> 'anulada'),
           'personas_activas', (select count(distinct l.usuario_id) from logs_optica l where l.optica_id = o.id and l.created_at >= v_desde),
           -- Los 30 días anteriores a esos 30, para comparar.
           'previo', jsonb_build_object(
             'citas', (select count(*) from citas_base c where c.optica_id = o.id and c.created_at >= v_antes and c.created_at < v_desde),
             'consultas', (select count(*) from consultas_base c where c.optica_id = o.id and c.created_at >= v_antes and c.created_at < v_desde),
             'ventas', (select count(*) from facturas_venta f where f.optica_id = o.id and f.created_at >= v_antes and f.created_at < v_desde and f.estado <> 'anulada'),
             'personas_activas', (select count(distinct l.usuario_id) from logs_optica l where l.optica_id = o.id and l.created_at >= v_antes and l.created_at < v_desde)),
           'modulos', coalesce((select jsonb_object_agg(m.modulo, m.n)
                                  from (select l.modulo, count(*) n from logs_optica l
                                         where l.optica_id = o.id and l.created_at >= v_desde group by l.modulo) m), '{}'::jsonb)
         ) order by o.nombre), '[]'::jsonb)
    into v_opticas
    from opticas o;

  return jsonb_build_object('generado', now(), 'desde', v_desde, 'personas', v_personas, 'opticas', v_opticas);
end;
$$;
revoke all on function datos_negocio_superadmin() from public, anon;
grant execute on function datos_negocio_superadmin() to authenticated;

-- 3. Registro de auditoría: qué cambió, más acciones y sin borrar ni editar ----------------------------------------------
alter table public.auditoria add column if not exists antes text;
alter table public.auditoria add column if not exists despues text;

alter table public.auditoria drop constraint if exists auditoria_accion_check;
alter table public.auditoria add constraint auditoria_accion_check check (accion in (
  'crear_optica', 'suspender_optica', 'reactivar_optica', 'renombrar_optica',
  'agregar_administrador', 'eliminar_administrador',
  'crear_superadmin', 'eliminar_superadmin',
  'responder_mensaje', 'publicar_anuncio', 'actualizar_pago', 'generar_factura',
  'entrar_como_optica', 'salir_de_optica',
  'marcar_optica_prueba', 'cambiar_estado_lead', 'cambiar_estado_soporte', 'pagar_factura', 'cambiar_suscripcion'
));

create or replace function auditoria_no_se_edita()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'El registro de actividad no se borra.';
  end if;
  -- Lo único permitido: que la llave foránea ponga en nulo la óptica o la cuenta eliminadas.
  if (to_jsonb(new) - 'optica_id' - 'actor_id') is distinct from (to_jsonb(old) - 'optica_id' - 'actor_id')
     or (new.optica_id is distinct from old.optica_id and new.optica_id is not null)
     or (new.actor_id is distinct from old.actor_id and new.actor_id is not null) then
    raise exception 'El registro de actividad no se edita.';
  end if;
  return new;
end;
$$;
drop trigger if exists auditoria_inmutable on public.auditoria;
create trigger auditoria_inmutable before update or delete on public.auditoria for each row execute function auditoria_no_se_edita();
