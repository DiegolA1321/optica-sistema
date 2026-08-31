-- Dos adiciones pedidas por Diego tras revisar el anteproyecto de nuevo:
--
-- 1) "Teleoptometría / triage remoto" (marco referencial del anteproyecto:
--    la tele-optometría se usa sobre todo para TRIAGE — decidir si hace
--    falta una visita presencial o si basta con seguimiento a distancia).
--    En vez de inventar un test de agudeza visual casero (el propio
--    anteproyecto advierte que la validez clínica de esas pruebas varía
--    mucho por herramienta y no está validada localmente), se agrega un
--    cuestionario corto de síntomas al reservar una cita por molestia —
--    el optómetra lo revisa antes de la cita y decide con más contexto.
--
-- 2) Vínculo receta → venta: `consultas.producto_id` ya existía (cierra el
--    ciclo clínico → inventario, descuenta stock), pero no había un monto
--    asociado — sin eso, Reportes no puede calcular ingresos ni "tasa de
--    conversión de recetas a ventas" (ambas explícitas en el anteproyecto).
--    Se agrega el monto cobrado por esa venta, capturado junto al producto.

alter table citas add column if not exists triage jsonb;

alter table consultas add column if not exists monto_venta numeric(10,2);

-- crear_cita_publica: mismo contrato de siempre, con p_triage opcional al
-- final (default null) para no romper ningún llamador existente.
create or replace function public.crear_cita_publica(
  p_optica_id uuid,
  p_paciente text,
  p_fecha date,
  p_hora text,
  p_paciente_id uuid default null,
  p_cedula text default null,
  p_telefono text default null,
  p_motivo text default null,
  p_motivo_publico text default null,
  p_correo text default null,
  p_triage jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_paciente text := trim(p_paciente);
  v_hora text := trim(p_hora);
  v_correo text := nullif(trim(p_correo), '');
begin
  if not exists (select 1 from opticas where id = p_optica_id and activa) then
    raise exception 'Óptica no válida.';
  end if;
  if v_paciente = '' then
    raise exception 'El nombre del paciente es obligatorio.';
  end if;
  if v_hora = '' then
    raise exception 'La hora es obligatoria.';
  end if;
  if v_correo is not null and v_correo !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo no es válido.';
  end if;

  insert into citas (optica_id, paciente_id, paciente, cedula, telefono, fecha, hora, motivo, motivo_publico, correo, triage, estado)
  values (
    p_optica_id, p_paciente_id,
    left(v_paciente, 200),
    left(nullif(trim(p_cedula), ''), 30),
    left(nullif(trim(p_telefono), ''), 30),
    p_fecha,
    left(v_hora, 20),
    left(nullif(trim(p_motivo), ''), 300),
    left(nullif(trim(p_motivo_publico), ''), 300),
    left(v_correo, 200),
    p_triage,
    'Pendiente'
  )
  returning id into v_id;
  return v_id;
end;
$$;
