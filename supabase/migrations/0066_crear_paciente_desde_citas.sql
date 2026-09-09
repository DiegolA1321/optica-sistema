-- Un asistente con permiso solo de "Citas médicas" (sin "Pacientes"/"Ficha
-- clínica") no podía crear un paciente nuevo desde el flujo de Citas
-- ("Añadir nuevo paciente" / "Completar registro" al Atender una cita sin
-- paciente vinculado) — el insert a pacientes_base caía silenciosamente en
-- RLS porque pacientes_staff_write solo evalúa permiso de 'pacientes' o
-- 'consultas'. Registrar un paciente nuevo es parte del flujo de Citas en sí
-- (así lo describe el propio diseño del módulo: "Añadir nuevo paciente"
-- vive dentro de "Gestionar cita"), así que el permiso de 'citas' también
-- debe habilitar esa creación puntual, sin ampliar UPDATE/DELETE sobre
-- pacientes ya existentes (eso sigue exigiendo 'pacientes'/'consultas').
create policy pacientes_citas_insert
  on pacientes_base
  for insert
  with check (
    optica_id = (select optica_id from perfiles where id = auth.uid())
    and tiene_permiso_modulo('citas')
  );
