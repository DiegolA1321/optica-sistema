-- Bloque D, paso D4 (R49): alcance de los datos por usuario.
--
-- Un rol puede limitar las citas, las consultas y los reportes a "lo propio"
-- (migración 0090: roles.alcance). Esta migración lo hace cumplir en la base:
--   * Citas "propias" = asignadas a la persona, atendidas por ella, o que todavía no
--     tienen ningún responsable (así una cita sin asignar no queda invisible para todos).
--   * Consultas "propias" = las que atendió la persona, más las antiguas sin profesional
--     identificado. Para eso `consultas_base` guarda ahora quién la registró
--     (profesional_id): hasta hoy solo guardaba el nombre.
--   * Los reportes se calculan con lo que la persona puede ver, así que quedan acotados
--     solos; la encuesta de satisfacción también (solo las de citas que puede ver).
--   * Los pacientes NO se acotan: son compartidos y recepción necesita buscar a cualquiera.
--   * El alcance es el más amplio entre los roles de la persona; el administrador y el
--     superadmin siempre ven todo. Quien hoy tiene el alcance "todo" (todos los
--     usuarios existentes) no nota ningún cambio.
--
-- Consecuencias a tener en cuenta con el alcance "propio":
--   * Quien agenda no ve las citas de otros en esos horarios; si agenda una hora ya
--     ocupada, la base responde "Ese horario ya no está disponible".
--   * En el perfil de un paciente solo verá sus propias citas y consultas.

-- ════════════════════════════════════════════════════════════════
-- Quién atendió cada consulta
-- ════════════════════════════════════════════════════════════════
alter table public.consultas_base
  add column profesional_id uuid references public.perfiles(id) on delete set null;
create index consultas_base_profesional_idx on public.consultas_base (optica_id, profesional_id) where profesional_id is not null;

-- Relleno de las consultas existentes: solo cuando el nombre guardado coincide con UNA persona
-- de la misma óptica (si hay dos personas con el mismo nombre no se adivina).
update public.consultas_base cb
   set profesional_id = p.id
  from (
    select optica_id, nombre, (array_agg(id))[1] as id
    from public.perfiles
    where rol in ('admin', 'asistente')
    group by optica_id, nombre
    having count(*) = 1
  ) p
 where cb.profesional_id is null and cb.optica_id = p.optica_id and cb.profesional_nombre = p.nombre;

-- Las consultas nuevas quedan a nombre de quien las registra (no se confía en lo que mande el cliente).
create or replace function public.consultas_asigna_profesional()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.profesional_id := (select p.id from perfiles p where p.id = auth.uid() and p.optica_id = new.optica_id);
  return new;
end;
$$;
create trigger consultas_asigna_profesional_trigger before insert on public.consultas_base
  for each row execute function public.consultas_asigna_profesional();

-- La vista expone la columna nueva (al final: mismo orden de siempre; conserva sus triggers).
create or replace view public.consultas with (security_invoker = true) as
 select id,
    optica_id,
    paciente_id,
    paciente,
    fecha,
    motivo,
    usa_lentes,
    descifrar_clinico(antecedentes_enc) as antecedentes,
    descifrar_clinico(alergias_enc) as alergias,
    descifrar_clinico(antecedentes_familiares_enc) as antecedentes_familiares,
    descifrar_clinico(datos_clinicos_enc)::jsonb as datos_clinicos,
    descifrar_clinico(diagnostico_enc) as diagnostico,
    lente_recomendado,
    descifrar_clinico(indicaciones_enc) as indicaciones,
    proximo_control_dias,
    evolucion_calculada,
    estado_correccion,
    producto_id,
    producto_nombre,
    monto_venta,
    profesional_nombre,
    created_at,
    imagenes,
    diagnostico_categorias,
    profesional_registro,
    descifrar_clinico(detalle_consulta_enc) as detalle_consulta,
    cita_id,
    profesional_id
   from public.consultas_base cb;

-- ════════════════════════════════════════════════════════════════
-- Lectura de citas, consultas y encuestas según el alcance
-- ════════════════════════════════════════════════════════════════
drop policy citas_select on public.citas_base;
create policy citas_select on public.citas_base for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('citas', 'ver')) or (select tiene_permiso('pacientes', 'ver')))
    and ((select alcance_efectivo('citas')) = 'todo'
         or asignado_a = auth.uid() or atendido_por = auth.uid() or (asignado_a is null and atendido_por is null)));

drop policy consultas_select on public.consultas_base;
create policy consultas_select on public.consultas_base for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('consultas', 'ver')) or (select tiene_permiso('pacientes', 'ver')))
    and ((select alcance_efectivo('consultas')) = 'todo' or profesional_id = auth.uid() or profesional_id is null));

-- La encuesta de satisfacción solo de las citas que la persona puede ver (la subconsulta ya respeta el alcance).
drop policy respuestas_satisfaccion_select on public.respuestas_satisfaccion;
create policy respuestas_satisfaccion_select on public.respuestas_satisfaccion for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('reportes', 'ver'))
    and exists (select 1 from public.citas_base c where c.id = respuestas_satisfaccion.cita_id));
