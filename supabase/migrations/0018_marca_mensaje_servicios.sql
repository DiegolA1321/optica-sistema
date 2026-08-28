-- Extiende lo que un admin puede personalizar del login de su óptica más
-- allá de nombre/eslogan/color/logo: el párrafo de bienvenida del hero y el
-- contenido (título/texto/puntos) de las 3 tarjetas de servicios. El default
-- reproduce exactamente el contenido hardcodeado que Login.jsx ya mostraba
-- para no cambiar el aspecto de ninguna óptica existente hasta que su admin
-- edite algo explícitamente (mismo patrón ya usado para nombreMarca/eslogan).
-- Solo afecta nuevas filas — las existentes se resuelven con fallback en
-- Login.jsx cuando marca.mensaje/marca.servicios no están presentes.

alter table opticas alter column marca set default
  '{"nombreMarca": "Diego Óptica", "eslogan": "Ve el mundo con claridad.", "colorAcento": "#2563EB",
    "mensaje": "En Diego Óptica cuidamos tu salud visual de principio a fin: examen de precisión, lentes a tu medida y un acompañamiento cercano después de tu compra.",
    "servicios": [
      {"titulo": "Exámenes optométricos", "texto": "Evaluación completa de tu salud visual con equipos de precisión.", "features": ["Agudeza visual y refracción", "Historial clínico digital", "Detección temprana de patologías"]},
      {"titulo": "Monturas y lentes", "texto": "Un catálogo pensado para tu estilo y tu graduación exacta.", "features": ["Armazones para cada rostro", "Lentes según tu receta", "Asesoría de estilo personalizada"]},
      {"titulo": "Seguimiento personalizado", "texto": "No te dejamos solo después de la compra: te acompañamos.", "features": ["Seguimiento de tu próximo control visual", "Acceso a tu portal de paciente", "Atención posventa y garantía"]}
    ]}'::jsonb;
