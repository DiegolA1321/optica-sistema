# Bloque F: Reportes (R60 y R61)

Rama `bloque-f` (desde `bloque-e`). Fuentes: sección 7 de `requisitos-reunion-29sep.md` y sección 3.9 de `vision-sistema.md`.

**Estado (6 oct.): construido, pendiente de la auditoría completa junto con el Bloque E.** No hizo falta migración: todo sale de datos que ya existen y que el rol ya puede leer.

## 1. Análisis de brechas

| Requisito | Estado antes | Brecha | Resultado |
|---|---|---|---|
| R60 Diagnósticos por mes y año | Solo un "Top 5" global, sin tiempo | Faltaba la dimensión mes/año y contar **pacientes**, no fichas | ✔ Tabla de calor "Diagnósticos por mes" con selector de año |
| R61 Filtro por motivo de consulta | No existía | `consultas.motivo` ya es una categoría de la óptica | ✔ Selector "Motivo de consulta" |
| Órdenes atrasadas por laboratorio | `atrasosPorLaboratorio` existía en lógica, sin pantalla | Mostrarlo | ✔ Tarjeta "Laboratorios" |
| Tiempo promedio de entrega por laboratorio | No existía | La orden no guardaba la fecha de entrega, pero `ordenes_laboratorio_historial` sí (cambio de estado con fecha) y su política de lectura es la misma de las órdenes | ✔ Se carga el historial junto con las órdenes (sin SQL) |
| Ventas por tipo de luna | No existía | Las líneas de tipo `luna` guardan `detalle.tipo_lente` (migración 0094) | ✔ Tarjeta "Ventas por tipo de luna" |
| Alcance "propio" y montos | Parcial: solo ocultaba montos al optómetra no administrador | Ocultar montos también a quien no ve Ventas; acotar las órdenes | ✔ Ver sección 3 |

## 2. Qué se hizo

- `utilidades/reportesDiagnosticos.js` (+ tests): pacientes distintos por diagnóstico y mes, años disponibles, lista y filtro de motivos.
- `utilidades/reportesLaboratorio.js` (+ tests): resumen por laboratorio (abiertas, atrasadas, entrega promedio en días) y lunas por tipo.
- `ordenesLaboratorio.js` / `App.jsx` / `OrdenesLaboratorio.jsx`: la orden trae su `historial`; se mantiene al cambiar de estado y al editar la orden en la misma sesión.
- `Reportes.jsx`: filtro por motivo, diagnósticos por mes, laboratorios y lunas por tipo.
- `Dashboard.jsx`: pasa `ordenesLab` (acotadas) y `verMontos`.

Decisiones:
- El filtro por motivo acota todo lo que nace de consultas (consultas, diagnósticos, conversión, embudo). **No** afecta "Controles atrasados", que es una foto del paciente y no de una consulta.
- Un paciente con varios diagnósticos cuenta en cada uno; en un mismo mes cuenta una vez por diagnóstico (se avisa en pantalla).
- El tiempo de entrega solo promedia órdenes **entregadas dentro del período elegido**, medido de creación a entrega. Las abiertas/atrasadas son el estado de hoy.
- Las fichas viejas con diagnóstico en texto libre (por ejemplo "Sin alteracion refractiva" sin tilde) aparecen como filas aparte: es un dato histórico, no un error del reporte.

## 3. Alcance y montos

- **Montos** (ingresos, conversión a venta, productos más vendidos, embudo y ventas por tipo de luna) solo los ve quien tiene `ventas: ver` en su vista activa y no está en vista "propia" de Reportes ni es optómetra no administrador.
- **Alcance "propio"**: citas y consultas ya llegaban filtradas; ahora las órdenes de laboratorio también (las que creó la persona o que salen de sus consultas).
- Las órdenes siguen sujetas a la política de lectura de la base (inventario, pacientes o consultas): quien no la tiene ve la tarjeta de laboratorios vacía.

## 4. Verificación

- Tests: 292 pasan (10 nuevos). Build correcto.
- Recorrido en el navegador con la cuenta de la óptica: filtro de motivo, tabla de diagnósticos con datos reales, laboratorios con un atraso (Lab Sur), sin errores de consola.
- Sin datos de prueba escritos en la base (no hubo que crearlos).
- **Pendiente para la auditoría final:** probar con una orden entregada para ver un promedio real, con una venta con luna, y con un usuario sin permiso de Ventas y otro con alcance propio.
