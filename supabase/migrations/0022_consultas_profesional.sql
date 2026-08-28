-- Bug real (revisión total 2026-08-28): la receta impresa y el portal del
-- paciente mostraban "Optómetra Diego" fijo en el código, sin importar
-- quién atendió la consulta ni de qué óptica se trata. No había ninguna
-- columna que registrara quién la hizo — se agrega ahora, nullable para no
-- romper las consultas ya existentes (que se resuelven con un fallback
-- genérico en el frontend, ver ConsultaMedica.jsx/PortalPaciente.jsx).
alter table consultas add column if not exists profesional_nombre text;
