-- Hallazgo J2 de la auditoría 2026-09-09: faltaban índices en columnas que
-- ya se usan para filtrar en consultas reales, forzando full table scans que
-- van a doler a medida que crezcan los datos (por ahora invisibles porque el
-- volumen de datos aún es chico).
--
-- pacientes(optica_id, cedula) y pacientes(optica_id, usuario): usados por
-- verificar_login_paciente() (migración 0039) en CADA intento de login del
-- portal del paciente — "where optica_id = p_optica_id and (usuario = ... or
-- cedula = ...)". Compuestos (no columna suelta) porque la consulta siempre
-- filtra primero por optica_id.
--
-- citas(optica_id, fecha): patrón de acceso más común de la agenda (citas de
-- esta óptica en tal fecha). Hoy existen citas_optica_id_idx y
-- citas_fecha_idx por separado (bitmap AND funciona, pero es más lento que
-- un índice compuesto real) — se agrega el compuesto sin tocar los que ya
-- existen.

create index if not exists pacientes_optica_cedula_idx on pacientes_base (optica_id, cedula);
create index if not exists pacientes_optica_usuario_idx on pacientes_base (optica_id, usuario);
create index if not exists citas_optica_fecha_idx on citas_base (optica_id, fecha);
