# Ficha clínica en cinco pasos — dónde quedó cada campo (19 oct. 2026)

**La ficha debe validarla la optómetra de la óptica** (orden de las pruebas, campos, opciones y rangos) antes de darla por buena.

Pasos: 1 Anamnesis · 2 Agudeza visual · 3 Refracción · 4 Salud ocular (opcional) · 5 Diagnóstico y receta. La barra deja ir a cualquiera; «Siguiente» solo sugiere el orden. A la derecha, un panel fijo con el contexto del paciente (en el paso 5, la vista previa de la receta).

## Tabla de campos

| Ficha anterior (3 pasos) | Ficha nueva |
|---|---|
| Paciente (buscador, solo si no viene precargado) | Paso 1, igual |
| Fecha de la consulta (editable) | Barra de la visita, visible en todos los pasos |
| Motivo (catálogo / el de la cita, con «Cambiar») | Paso 1, igual (alimenta Reportes) |
| Detalle de la consulta | Paso 1 «Lo que cuenta el paciente» (con «Otros» pasa a ser «Describe el motivo», obligatorio) |
| ¿Usa lentes? Sí / No | Paso 1 «Uso de lentes» + **nuevo:** qué usa (lentes, lentes de contacto, ambos) y desde cuándo |
| Antecedentes médicos / oculares | Paso 1, opciones + detalle; precargados del paciente, se actualiza solo lo que cambió |
| Alergias | Paso 1, opciones + detalle («Ninguna conocida»); destacadas en el panel |
| Antecedentes familiares | Paso 1, opciones (+ estrabismo, queratocono, catarata, degeneración macular) + detalle |
| — | **Nuevo:** síntomas (opciones + otros) y medicamentos (opciones + cuáles) |
| AV sin lentes (OD, OI) | Paso 2, columna «Sin corrección» (+ letras falladas) |
| AV con lentes (OD, OI) | Paso 2, columna «Con su corrección actual» (+ letras falladas) |
| — | **Nuevo:** columna «Con la receta nueva» (se escribe en el paso 3, un solo dato) y fila «Ambos ojos» |
| AV de cerca (Jaeger), un solo valor | Paso 2, lista Jaeger en las tres columnas |
| Distancia pupilar (DP) | Paso 2: total + de cada ojo + de cerca (opcional) |
| Altura pupilar (ALT) | **Sale de la ficha:** depende de la montura; se pide por ojo en la orden de laboratorio (Ventas) |
| — | **Nuevo:** lentes actuales (esfera, cilindro, eje, adición; «Copiar de la última receta») |
| Cover test lejos / cerca (Ortoforia, Exoforia, Esoforia, Exotropia, Esotropia, No realizado) | Paso 2: tipo (ortoforia, endoforia, exoforia, hiperforia, endotropia, exotropia, hipertropia) + magnitud (Δ) + distancia |
| Motilidad ocular | Paso 2 |
| Retinoscopía OD / OI (texto libre) | Paso 3 «Refracción objetiva»: método (retinoscopía o autorrefractómetro) + esfera, cilindro y eje por ojo + «Usar como punto de partida» |
| — | **Nuevo:** queratometría (K1, K2, eje) |
| Refracción subjetiva final OD / OI | Paso 3 «Refracción final» (validada; transposición del cilindro positivo) |
| Ojo no evaluado + motivo | Paso 3, igual |
| Copiar de la visita anterior | Paso 3, igual |
| Adición (ADD), una sola | Paso 3: por ojo, con «Igual en ambos ojos» (azul desde los 40 años) |
| — | **Nuevo:** prisma por ojo (cantidad y base) |
| Estado de corrección (chip) | Paso 3, bajo «Agudeza con la receta nueva»; se calcula con ella |
| Variación frente a la visita anterior | Paso 3, al pie |
| Biomicroscopía (párpados, córnea, cámara), un solo juego | Paso 4: por ojo, con «Sin hallazgos» e «Igual en el otro ojo» |
| Oftalmoscopia | Paso 4 «Fondo de ojo», por ojo |
| PIO OD / OI | Paso 4 + hora de la medición + método |
| Test de color (Normal, Deficiencia rojo-verde, azul-amarillo, No realizado) | Paso 4: prueba (Ishihara, Farnsworth D-15, otra) + resultado en texto («Ishihara 14 de 14») |
| Diagnóstico (categorías del catálogo + «Otro») y detalle | Paso 5, igual |
| Añadir recomendación de lente / lente a recomendar | Paso 5, igual |
| Indicaciones y cuidados | Paso 5, igual |
| Adjuntar imágenes (hasta 6) | Paso 5, igual |
| Tratamiento finalizado | Paso 5, igual |
| Próximo control + Agendar ahora / después (Agenda y CRM) | Paso 5, igual |
| Vista previa de la receta (hoja) | Paso 5, panel derecho (resumen con los mismos valores) + «Ver la hoja completa» |
| Imprimir / Descargar PDF | Paso 5, tras guardar |
| Ver historial, última visita, tendencia, alergias, última graduación | Panel derecho, todos los pasos; las últimas visitas se abren en solo lectura |
| Dejar de atender | Arriba a la derecha, igual |
| Terminar atención, Pasar a la óptica, Cobrar ahora, Nueva consulta | Paso 5, igual |
| Aviso de primera consulta, guardado automático del borrador | Igual |

Qué **cambia de valores**, no solo de lugar: el cover test «Esoforia/Esotropia» pasa a «Endoforia/Endotropia» (mismo hallazgo, nombre de la lista pedida); el test de color deja de ser una lista de cuatro opciones y es prueba + resultado.

## Cómo se guardan los datos (sin cambios de tablas)

Todo va en `consultas.datos_clinicos` (jsonb): los campos de siempre (`od`, `oi`, `medidas`, `examen`, `retinoscopia`) se siguen llenando para que el perfil, Reportes y las fichas anteriores sigan funcionando; lo nuevo del personal va en `datos_clinicos.ficha` (anamnesis, agudeza de ambos ojos, lentes actuales, cover test, objetiva, queratometría, salud ocular). `od`/`oi` ganan `avRx` (con la receta nueva) y las letras falladas; `medidas` gana la adición y la DP por ojo, la DP de cerca, el prisma y la agudeza de cerca por columna.

## Fichas anteriores

No se tocó ningún dato. Se ven con lo que tienen: «Con lentes» sigue siendo su agudeza con corrección, el estado de corrección sigue calculándose con ella, la altura de montaje que traían se sigue mostrando, y el detalle de la atención muestra cada dato en su sección.
