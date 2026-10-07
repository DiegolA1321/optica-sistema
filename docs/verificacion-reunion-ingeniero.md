# Verificación de lo pedido por el ingeniero (reunión del 29 de septiembre)

**Fecha:** 7 de octubre de 2026 · **Sitio verificado:** https://optica-sistema-zeta.vercel.app (Óptica Demo, `?optica=qu7u2j`), commit `5b8690d` de `main`. El bundle publicado (`index-dn7CghCK.js`) es el mismo que genera un build local de ese commit.
**Cómo:** navegador a 1366×768, con las cuentas de la Óptica Demo (administrador, Paula/optómetra, Rosa/recepción y Vera/ventas; contraseñas nunca mostradas). Solo lectura: se abrieron modales y pantallas, pero no se guardó, creó, editó ni borró nada. Cada requisito se contrastó con las cuatro transcripciones (`docs/feedback-ing/reunion-29sep/1.txt` a `4.txt`, leídas completas, 948 líneas en total) y con `docs/feedback-ing/requisitos-reunion-29sep.md`.
**Capturas:** `docs/verificacion-capturas/` (70 archivos, ignorados por git; se nombran con el requisito que demuestran).

---

## 1. Resumen

### Totales

| Veredicto | R1 a R62 | Cosas nuevas (N1 a N9) | Total |
|---|---|---|---|
| Cumple | 53 | 5 | 58 |
| Cumple con mejora | 6 | 1 | 7 |
| Parcial | 3 | 3 | 6 |
| No cumple | 0 | 0 | 0 |
| **Total** | **62** | **9** | **71** |

Cumple con mejora: R3, R6, R7, R9, R30, R59 y N3. Ningún requisito quedó en "no cumple".

### Lo que no cumple del todo, por importancia

1. **R39. La cita queda "Atendida" al terminar la atención clínica, no al generar la factura.** El ingeniero lo dijo al revés (archivo 4, línea 30: "cuando yo ya le genere la factura total, la cita finalizada y automáticamente va a indicar cita atendida"). Es una decisión de Diego (6 oct.): quien consulta y no compra también fue atendido y así el embudo sale de datos reales. Es lo primero que conviene explicarle, porque contradice sus palabras.
2. **R51. Verificación de cuentas por correo.** Cédula única y correo obligatorio sí están (el formulario valida el correo y la cédula tiene asterisco). Falta confirmar la cuenta por correo: el ingeniero dijo "debería ser obligatorio… tendrías que añadirle el sistema de validación de cuentas, de correos" (archivo 1, líneas 206 a 208). Depende de un dominio propio verificado en Resend.
3. **N4. Ver desde Pacientes a los que solo consultaron y no compraron** (archivo 2, líneas 57 a 63). Esa lista existe en Ventas ("No compraron (8)", con motivo) y como cifras en Reportes, pero la lista de Pacientes no tiene un filtro para ellos (solo Todos, Visitas recientes, Recetas activas, Pagos pendientes).
4. **N1. Stock mínimo.** El ingeniero fijó "el stock mínimo va a ser 10" (archivo 1, líneas 84 y 85). El sistema tiene un mínimo por producto (campo "Stock mínimo (alerta)"), pero el valor por defecto es 3 (`UMBRAL_STOCK_BAJO`) y los productos de la Demo tienen 3 o 5. Con el criterio del ingeniero, Montura 13 (10 u.) y Montura 12 (5 u.) también estarían en alerta.
5. **N7. El administrador que también atiende no se asigna el rol desde Usuarios.** El ingeniero lo describió así (archivo 1, líneas 296 a 299: "ubico mi nombre… selecciono el rol que me voy a asignar"). Hoy el administrador aparece en Usuarios en solo lectura, y la marca "atiende pacientes" la pone el superadministrador. El cambio de vista sí funciona (R50).
6. **R62. Pulido visual final** de todas las pantallas y de las páginas públicas y el Portal del paciente. El propio ingeniero lo fijó para el final (Bloque G). La base visual está en el sistema interno; la página pública de la óptica se ve distinta del interior.

### Defectos vistos aunque el requisito se cumpla

| # | Defecto | Gravedad |
|---|---|---|
| D1 | En 11 de las 20 órdenes de laboratorio de la Demo, la nota "Lente recomendado: …" nombra un material distinto al de la orden (ejemplo OL-0011: material CR-39, nota "Monofocal Policarbonato"). Sale impresa en la copia del laboratorio. Son datos de la demostración. | Media |
| D2 | La impresión "dos copias" (laboratorio y paciente) sale una a continuación de la otra, sin salto de página ni línea de corte. | Baja |
| D3 | "Mi horario habitual" del administrador muestra Lunes, Martes, Jueves a Domingo "Cerrado" (solo abre los miércoles), pero tiene 12 citas asignadas esta semana. Datos de la demostración. | Baja |
| D4 | La página pública para agendar ofrece tres motivos ("Atención por molestia o enfermedad", "Medición y examen visual", "Compra de lentes o monturas"); el catálogo configurado y la agenda interna usan otros cuatro (Consulta General, Examen de Control, Adaptación de Lentes, Garantía / Ajuste). | Media |
| D5 | El paciente puede reagendar o cancelar solo si la óptica lo permite; en la Demo está en "No permitido". No se pudo probar el portal: las cuentas de `.env.test` no incluyen un paciente. | Baja |
| D6 | En la ficha, la "Últ. graduación" usa punto decimal y un eje poco natural ("OD +0.75 -0.75 x180 · OI +1.50 -0.75 x1") mientras el perfil y la tendencia usan coma. | Baja |
| D7 | Recepción ve "Dejar de atender" sobre la atención abierta de otra persona (Daniela Vera, abierta por el administrador). Conviene confirmar que es intencional. | Baja |
| D8 | Daniela Vera Mero sigue con una atención abierta desde ayer. Es el caso que la Demo muestra a propósito (aparece como aviso en Inicio y en Citas); conviene saber explicarlo si el ingeniero pregunta. | Informativa |

### Lo que no se pudo ver en pantalla sin escribir datos

Estos pasos escriben en la base y no se ejecutaron. Cada uno se comprobó por el resultado visible o por el código, y se dice en su fila:
- El botón "Pasar a la óptica" (R34): aparece solo después de guardar la ficha.
- El cambio automático a "En atención" (R21) y a "Atendida" (R16, R39).
- Abrir la ficha desde Pacientes sin cita (R24).
- Enviar un mensaje por CRM (R44) y que el laboratorio marque "completada" (R37).
- El diálogo de impresión (R36): se capturó el documento que se imprimiría.
- El portal del paciente (R17, parte del paciente).

### Integridad de solo lectura

- Antes de empezar se tomó una huella (md5 de todas las filas) de citas, consultas, pacientes, comprobantes, órdenes, inventario, pases y perfiles de la Demo.
- Al final, **todas las filas que existían al empezar están idénticas**. Mis recorridos no escribieron nada.
- **Otra sesión del administrador sí escribió mientras yo verificaba** (11:38 a 11:41, hora local, según `logs_optica`):
  - Un paciente nuevo, "Diego alarcon" (cédula 1314160654).
  - Una cita "Atendió a un paciente de inmediato".
  - Una ficha clínica guardada.
  - La orden OL-0011 pasó a "Lista para entregar".
- Por eso las cifras de las capturas tomadas después difieren en uno (41 pacientes, 91 citas, "Atendidas" de este mes, "listas sin avisar" 3 en lugar de 2). Ninguno de esos cambios es mío y no afecta ningún veredicto. Si no los hizo Diego, hay que revisar quién tiene la sesión del administrador de la Demo abierta.

### Corrección a mi informe anterior

En el ensayo del 7 de octubre reporté, como hallazgo 19, que "la pestaña Fidelización del perfil saca al paciente del perfil y lo lleva al CRM". **Era falso:** mi selector había hecho clic en "CRM y fidelización" del menú lateral. La pestaña Fidelización funciona dentro del perfil (R42 y R43, abajo).

---

## 2. Lo que dijo el ingeniero y no estaba en la lista de requisitos

Ya cubierto por R1 a R62: todo lo demás que se dijo, incluidas las frases con "podría ser". Quedan **nueve cosas** que el documento de requisitos no recoge de forma explícita:

| # | Qué dijo | Archivo | Dónde se ve | Captura | Veredicto |
|---|---|---|---|---|---|
| N1 | "El stock mínimo va a ser 10. Cualquiera de 10 para abajo es de stock bajo." | 1, líneas 84 y 85 | Inventario → "Stock mínimo (alerta)" por producto; el valor por defecto del sistema es 3 | `R57-R58-N1-inventario-monturas-y-accesorios.png` | **Parcial** (el mínimo es configurable por producto, pero por defecto es 3 y no 10) |
| N2 | A una secretaria se le pueden dar permisos de administración general: reportes globales, gestionar el inventario, mensajes. Ve pacientes y citas, ve la ficha clínica pero no la edita. | 1, líneas 255 a 266 | Editar rol → sección "ADMINISTRACIÓN" (Mensajes, Configuración), niveles Ver/Crear/Editar/Eliminar y "Alcance de los datos" | `R48-editar-rol-permisos-por-nivel.png` | **Cumple** |
| N3 | Alternativa: en cada rol definir "actividades principales y secundarias" para armar el Inicio. Si hay roles predefinidos, el Inicio sale de ahí. | 1, líneas 306 a 316 | El rol tiene "Inicio que verá" (General, Optómetra, Recepción, Ventas) y el Inicio cambia por rol | `R52-R56-inicio-optometra-paula.png` | **Cumple con mejora** (se eligió la opción de roles predefinidos) |
| N4 | Ver desde Pacientes a los que solo consultaron y no compraron, sin mezclarlos con las estadísticas. | 2, líneas 57 a 63 | Ventas → "No compraron (8)" con motivo; Reportes → embudo. Pacientes no tiene ese filtro. | `R34-R40-N4-pacientes-lista-listo-para-venta-y-filtros.png` | **Parcial** |
| N5 | La consulta no es gratis: se cobra aunque no compre lentes. Flujo "paciente, factura, cobrar". | 3, líneas 66 a 79 | La venta trae el renglón "Consulta — Consulta General"; Configuración → "Costo base de la consulta por motivo" | `R35-R38-R59-tomar-datos-proforma-y-pago.png` | **Cumple** |
| N6 | "Seleccione una categoría… esto está bugeado, otra vez aparece lo mismo, hay que quitarlo"; "estado de corrección, tendencia, datos de contexto" están de más en el paso del diagnóstico. | 3, líneas 185 a 203 | Paso 3 (Diagnóstico y receta): un solo bloque de categorías, sin tendencia ni contexto repetidos | `R28-R30-R31-R33-ficha-paso3-diagnostico-y-receta.png` | **Cumple** |
| N7 | El administrador que también es optómetra se asigna el rol desde Crear usuario ("ubico mi nombre y selecciono el rol"). | 1, líneas 296 a 299 | Usuarios: el administrador aparece en solo lectura; el cambio de vista está en el menú | `R46-R47-R50-usuarios-lista-con-roles.png`, `R50-cambio-de-vista-desde-el-menu.png` | **Parcial** (la vista funciona, pero no se asigna desde Usuarios; lo marca el superadministrador) |
| N8 | "Vender producto" y "Nueva factura" casi lo mismo: "lentes y productos es lo mismo… productos y servicios". | 4, líneas 49 a 76 | Una sola "Nueva venta" en la pestaña Productos y servicios; "Vender receta" en la cabecera es un atajo que precarga la receta | `R41-perfil-pestana-productos-y-servicios.png` | **Cumple** |
| N9 | En el perfil, cuando detecte el cumpleaños, ofrecer enviar un mensaje (aunque el automático esté apagado). | 4, líneas 106 a 114 | Fidelización: "1 día para su cumpleaños · Cumple 35 años" y "Gestionar recordatorios en CRM"; "Enviar mensaje" en la cabecera | `R43-R44-N9-fidelizacion-cumpleanos-proximo.png` | **Cumple** |

---

## 3. Verificación de R1 a R62

Las capturas se nombran con el requisito que demuestran y viven en `docs/verificacion-capturas/` (por ejemplo `R03-R08-R18-bloque-de-filtros.png`). Rol usado: administrador salvo que se diga otro.

### 3.1 Citas médicas

| # | Lo que pidió (archivo) | Dónde se ve | Captura | Veredicto |
|---|---|---|---|---|
| R1 | "Citas de hoy" primero y "Total agendadas" al final (2) | Citas: Citas de hoy 2 · Próximas 13 · Total agendadas 81 | `R01-R02-R05-R10-citas-lista` | **Cumple** |
| R2 | Los indicadores deben verse como filtros, no como tarjetas (2) | Etiqueta "VER", botón activo en oscuro, `aria-pressed` verdadero solo en el elegido | `R02-indicador-proximas-seleccionado` | **Cumple** |
| R3 | Un bloque de filtros: estado, origen, primera vez al final (2) | Estado (selector) + "Filtros" con Rango, Origen, Visita, Asignada a, Atendida por | `R03-R08-R18-bloque-de-filtros` | **Cumple con mejora** (se agregaron rango y responsables) |
| R4 | Ver de forma continua atendidas, en curso, canceladas y vencidas (2) | Estado: Todas (81), Pendientes, En atención, Atendidas, Canceladas, No asistió; las pasadas bajo "Anteriores". Las vencidas pasan solas a "No asistió" a los 10 minutos | `R01-R02-R05-R10-citas-lista` | **Cumple** |
| R5 | El buscador cerca de los filtros (2) | "Buscar paciente o código" en la misma fila que Estado y Filtros | `R01-R02-R05-R10-citas-lista` | **Cumple** |
| R6 | "Primera vez" es ambiguo; repensarlo (2) | La etiqueta sale del historial real (sin atenciones previas), no de tener cuenta; filtro Visita y chip "Por registrar" | `R03-R08-R18-bloque-de-filtros` | **Cumple con mejora** |
| R7 | Vista por día y por mes, día actual marcado, botón "Hoy"; semana opcional (3) | Lista (agrupada por día), Semana y Mes; botón Hoy; hoy marcado | `R07-vista-semana`, `R07-R09-vista-mes` | **Cumple con mejora** (se hizo también Semana) |
| R8 | Filtro por rango de fechas (3) | Filtros → Rango de fechas (desde / hasta con flechas) | `R03-R08-R18-bloque-de-filtros` | **Cumple** |
| R9 | Calendario "por color" de carga de atención (2) | Mes → "Carga": intensidad por día; colores por estado en la leyenda | `R09-calendario-por-color-carga` | **Cumple con mejora** (dos modos: Citas y Carga) |
| R10 | Lo más próximo primero; futuras fáciles de ver (2) | Hoy, Mañana, luego fechas crecientes; indicador "Próximas"; las pasadas al final | `R01-R02-R05-R10-citas-lista` | **Cumple** |
| R11 | Clic en un día del mes: listado en una columna (3) | Mes → "+1 más" / día: ventana "6 de octubre · 4 citas" con hora, paciente y estado, y "Ver esa semana" | `R11-clic-en-dia-listado-de-citas` | **Cumple** |
| R12 | Clic en una cita: paciente, fecha de agendada, motivo, origen y quién la atendió (2, 3) | Detalle: Motivo, Fecha, Hora, Agendada el, Origen (Web / Recepción), Asignado a, Atendido por | `R12-R13-detalle-de-la-cita` | **Cumple** |
| R13 | Botones "Ingresar" y "Cerrar" en ese modal (4) | Cerrar · Ingresar (y Ver perfil, Editar cita, Cancelar cita) | `R12-R13-detalle-de-la-cita` | **Cumple** |
| R14 | "Ver perfil" no debe dejarte sin poder volver (2) | El enlace abre en pestaña nueva (`target=_blank`) | `R12-R13-detalle-de-la-cita` | **Cumple** |
| R15 | Quitar "Crear paciente" del menú de la cita (2) | Menú ⋮: solo "No asistió", "Editar cita" y "Cancelar cita" | `R15-R16-R17-menu-mas-acciones` | **Cumple** |
| R16 | "En atención" y "Atendida" automáticos; "No asistió" manual (2, 4) | Menú sin esas dos acciones; "No asistió" sí; además, no asistió automático a los 10 min. Los cambios automáticos se comprobaron por el código y los estados que muestra la Demo, sin forzarlos | `R15-R16-R17-menu-mas-acciones` | **Cumple** |
| R17 | No se eliminan citas: se reagendan; el paciente puede reagendar (4) | Sin "Eliminar"; "Editar cita" reagenda (motivo, asignado a, calendario); la cancelación conserva el registro. El portal lo permite si la óptica lo activa (en la Demo: "No permitido") | `R17-reagendar-cita-editar`, `R17-configuracion-reagendar-por-el-paciente` | **Cumple** (la parte del portal solo verificada por configuración y código: ver D5) |
| R18 | El administrador filtra las no atendidas y ve quién estaba a cargo (2) | Estado "No asistió" + "Asignada a: Paula Optómetra Demo" devuelve sus 3 citas; cada tarjeta dice "Asignada a" | `R18-no-asistio-filtrado-por-persona-a-cargo` | **Cumple** |
| R19 | Mi horario: horarios ocupados y disponibles; el administrador ve los del personal (3) | Horario → Mi horario: "12 ocupados · 51 turnos libres esta semana", por día, y "El equipo hoy" con selector "Ver el horario de" | `R19-mi-horario-ocupados-disponibles-y-equipo` | **Cumple** (ver D3) |

### 3.2 Atención: de la cita a la ficha, la venta y el laboratorio

| # | Lo que pidió (archivo) | Dónde se ve | Captura | Veredicto |
|---|---|---|---|---|
| R20 | "Atender": resumen y directo a la ficha de esa cita (3, 4) | Atender → "Resumen de la cita" → "Ingresar a la ficha clínica" | `R20-R22-R26-atender-resumen-previo` | **Cumple** |
| R21 | Al atender pasa a "En atención" y el administrador lo ve (4) | Inicio "en atención ahora", Citas "En atención (1)". El cambio de estado lo hace `marcarEstado` al confirmar; no se confirmó para no escribir | `R52-R56-inicio-administrador` | **Cumple** (sin ejecutar el cambio) |
| R22 | Si el paciente vino por web, confirmar sus datos antes de entrar (3) | Paciente web: "Confirmar datos del paciente"; cita sin paciente: "Completar registro" | `R22-confirmar-datos-del-paciente-web`, `R22-completar-registro-cita-web-sin-paciente` | **Cumple** |
| R23 | Atender hoy una cita de otro día; registrar la fecha real (4) | "Esta cita está agendada para Mañana. Se atenderá hoy y la fecha agendada no cambia." Botón "Atender hoy" | `R23-atender-cita-de-manana-hoy` | **Cumple** |
| R24 | Si llega sin cita, se atiende desde Pacientes (4) | Perfil del paciente: botón "Ficha clínica". No se abrió: la apertura puede pasar la cita a "En atención" | `R24-R42-R43-R44-perfil-cabecera-y-acciones` | **Cumple** (botón visible; sin ejecutar) |
| R25 | Dentro de un paciente no debe haber buscador de pacientes (3) | La ficha no tiene ningún campo de búsqueda (solo la búsqueda global del encabezado) | `R25-R26-R27-R28-ficha-paso1-anamnesis` | **Cumple** |
| R26 | Referencia clara de la cita que se atiende (3) | "Cita 05:00 PM · Garantía / Ajuste · agendada 6 oct 2026 · atención hoy" | `R25-R26-R27-R28-ficha-paso1-anamnesis` | **Cumple** |
| R27 | Primero el contexto (antecedentes, última cita, historial, tendencia) y luego el registro (3) | Paso 1: Última visita, Tendencia, "Ver historial (3)", Antecedentes, y después Motivo | `R25-R26-R27-R28-ficha-paso1-anamnesis` | **Cumple** |
| R28 | No repetir bloques entre pasos (3) | Antecedentes solo en el paso 1; ni Refracción ni Diagnóstico los repiten | `R29-ficha-paso2-refraccion-opcional`, `R28-R30-R31-R33-ficha-paso3-diagnostico-y-receta` | **Cumple** |
| R29 | Todos los exámenes son opcionales (3) | "Todo opcional · vacío significa 'no medido'"; cada bloque dice "Opcional" y "No registrado" | `R29-ficha-paso2-refraccion-opcional` | **Cumple** |
| R30 | Motivo por categorías configurables + "Otros"; si la cita ya lo trae no se vuelve a pedir (3) | Paso 1: "Garantía / Ajuste (de la cita)", "Cambiar", "+ Agregar detalle". Configuración → Catálogos edita los motivos | `R25-R26-R27-R28-ficha-paso1-anamnesis`, `R30-configuracion-catalogos-motivos-de-consulta` | **Cumple con mejora** (agrega "Costo base de la consulta por motivo"). Ver D4 |
| R31 | Diagnóstico: categoría + detalle; lente recomendado, imágenes, indicaciones, próximo control (3) | Paso 3: categorías (varias a la vez, incluida "Otro"), "Detalle (opcional)", "Añadir recomendación de lente", "Adjuntar imágenes", Indicaciones, Próximo control (1 mes a 1 año) | `R28-R30-R31-R33-ficha-paso3-diagnostico-y-receta` | **Cumple** |
| R32 | No se pospone: se guarda y se sigue, o se "deja de atender" (3) | Encabezado de la ficha: "Dejar de atender"; no hay "Posponer" | `R25-R26-R27-R28-ficha-paso1-anamnesis` | **Cumple** |
| R33 | "Terminar atención" genera la receta, no la factura (3) | Paso 3: vista previa "Receta óptica" y botón "Terminar atención" | `R28-R30-R31-R33-ficha-paso3-diagnostico-y-receta` | **Cumple** |
| R34 | Botón "Pasar a la óptica" que deja al paciente "Listo para venta", visible para la vendedora (3) | El botón sale tras guardar (`ConsultaMedica.jsx`, "Pasar a la óptica"); no se guardó. Resultado visible: cola "Listos para venta (5)" en Ventas, y marca "Listo para venta" en la lista de Pacientes | `R34-R35-ventas-cola-listos-para-venta`, `R34-R40-N4-pacientes-lista-listo-para-venta-y-filtros` | **Cumple** (botón por código; resultado en pantalla) |
| R35 | "Tomar datos del diagnóstico" arma la proforma (3) | Ventas → botón con ese nombre → modal con datos del diagnóstico, lente recomendado e "Imprimir proforma" | `R35-R38-R59-tomar-datos-proforma-y-pago` | **Cumple** |
| R36 | Al comprar, orden de laboratorio con N.º de factura y detalle; dos copias (3) | Orden con N.º de comprobante (CV-0014), receta, DP, lente, tratamientos, montura; "Imprimir copias" saca la del laboratorio y la del paciente | `R36-orden-de-laboratorio-dos-copias`, `R36-R37-ordenes-de-laboratorio-estados-y-avisar` | **Cumple** (ver D1 y D2) |
| R37 | El laboratorio la marca completada y el administrador avisa al paciente (3) | Estados Enviada, Lista, Entregada; acciones "Marcar lista", "Avisar por WhatsApp"; el Inicio del administrador y de Ventas dice "órdenes de laboratorio listas sin avisar" con botón "Avisar". Reportes → Laboratorios | `R36-R37-ordenes-de-laboratorio-estados-y-avisar`, `R52-R56-inicio-administrador`, `R37-reportes-laboratorios` | **Cumple** |
| R38 | Pago al contado, a cuotas o con abonos (3) | Método de pago: Directo, Tarjeta, Cuotas (con "Número de cuotas"), Abonos | `R38-R57-R59-venta-luna-como-texto-y-cuotas` | **Cumple** |
| R39 | La cita queda "Atendida" al generar la factura total (4) | El sistema la deja "Atendida" al terminar la atención clínica y la venta sigue aparte (pases: listo, vendido, descartado) | `R34-R35-ventas-cola-listos-para-venta` | **Parcial** (decisión de Diego del 6 oct., contraria a lo que dijo el ingeniero; ver el resumen) |
| R40 | Saber cuántos vinieron por primera vez y cuántos se volvieron clientes (2) | Reportes → Embudo: "18 vinieron por primera vez · 27 ya eran pacientes · de los de primera vez, 4 compraron (22%)" | `R40-reportes-embudo-primera-vez-y-compras` | **Cumple** |

### 3.3 Perfil del paciente

| # | Lo que pidió (archivo) | Dónde se ve | Captura | Veredicto |
|---|---|---|---|---|
| R41 | "Productos y servicios" con la tabla de transacciones (4) | Pestaña "Productos y servicios": Ventas, Productos y Servicios (con texto "consulta, limpieza, ajustes") | `R41-perfil-pestana-productos-y-servicios` | **Cumple** |
| R42 | Estado clínico y evolución al historial clínico; Fidelización solo la relación (4) | Pestaña Diagnósticos: estado de corrección más reciente, próximo control, tendencia. Pestaña Fidelización: solo cliente frecuente, referidos, cumpleaños | `R42-R45-perfil-pestana-diagnosticos-tendencia`, `R42-R43-perfil-pestana-fidelizacion` | **Cumple** |
| R43 | Fidelización: última visita, cliente frecuente, referidos, días para el cumpleaños; sin repetir el próximo control (4) | Fidelización: "Cliente frecuente · Sí", "Referidos · 0", "214 días para su cumpleaños · Cumple 67 años". "Última consulta" está en la cabecera del perfil | `R42-R43-perfil-pestana-fidelizacion`, `R24-R42-R43-R44-perfil-cabecera-y-acciones` | **Cumple** |
| R44 | "Enviar mensaje por CRM" desde el perfil (4) | Botón "Enviar mensaje" en la cabecera y "Gestionar recordatorios en CRM". No se envió nada | `R24-R42-R43-R44-perfil-cabecera-y-acciones`, `R42-R44-crm-fidelizacion` | **Cumple** (botón visible; sin enviar) |
| R45 | Citas por un lado y Diagnósticos por otro, con la tendencia arriba (3, 4) | Pestaña Citas: cita en atención, historial; pestaña Diagnósticos: gráfica de tendencia arriba y lista con motivo y diagnóstico de cada atención, que se despliega | `R45-perfil-pestana-citas`, `R42-R45-perfil-pestana-diagnosticos-tendencia` | **Cumple** |

### 3.4 Roles y usuarios

| # | Lo que pidió (archivo) | Dónde se ve | Captura | Veredicto |
|---|---|---|---|---|
| R46 | Separar Roles de Usuarios; al crear un usuario elegir el rol con vista previa (1) | Usuarios tiene pestañas Usuarios y Roles; Crear usuario → rol → "LO QUE VERÁ Y PODRÁ HACER" | `R46-R47-R50-usuarios-lista-con-roles`, `R46-crear-usuario-vista-previa-de-permisos-del-rol` | **Cumple** |
| R47 | Roles predefinidos editables pero no eliminables; roles propios eliminables (1) | Optómetra, Recepción y Ventas "Predefinido" con Editar y Restaurar; "Rol predefinido: puedes editarlo y restaurarlo, pero no eliminarlo"; "Nuevo rol" | `R46-R47-R48-roles-predefinidos-con-niveles`, `R47-crear-rol-propio` | **Cumple** |
| R48 | Permisos por nivel, no solo por módulo (1) | Matriz Ver / Crear / Editar / Eliminar por módulo. Comprobado en pantalla: el optómetra y Recepción ven Inventario sin "Agregar producto"; Recepción y Ventas ven la ficha clínica en solo lectura y sin "Atender"; el optómetra ve Ventas sin "Nueva venta"; en Mi horario el optómetra no edita el horario general | `R48-editar-rol-permisos-por-nivel`, `R48-inventario-solo-lectura-optometra`, `R48-inventario-recepcion`, `R48-perfil-diagnosticos-ventas-solo-lectura`, `R48-ventas-solo-lectura-optometra`, `R48-citas-ventas` | **Cumple** |
| R49 | El optómetra solo ve sus pacientes y su horario; los reportes globales son del administrador (1) | Paula ve 40 citas (el administrador, 81) y Reportes con "28 de 44 citas"; "Solo lo suyo: citas, fichas clínicas, reportes" en su rol; Mi horario solo el suyo | `R49-citas-de-paula-solo-las-suyas`, `R49-reportes-de-paula-solo-lo-suyo`, `R19-R48-mi-horario-optometra-solo-el-suyo` | **Cumple** |
| R50 | Más de un perfil y cambiar desde el menú (1) | Menú de usuario → "Vista: Administrador / Optómetra"; el Inicio cambia a "2 citas tuyas hoy", "Fichas sin terminar" | `R50-cambio-de-vista-desde-el-menu`, `R50-R56-inicio-en-vista-optometra-del-administrador` | **Cumple** |
| R51 | Cédula única, correo obligatorio y verificación por correo (1) | Crear usuario: "Cédula *"; el correo se valida al guardar. No hay verificación de la cuenta por correo | `R46-R51-crear-usuario-con-rol-y-vista-previa` | **Parcial** (falta la verificación por correo; depende de Resend) |

### 3.5 Inicio por rol

| # | Lo que pidió (archivo) | Dónde se ve | Captura | Veredicto |
|---|---|---|---|---|
| R52 | Tarjetas coherentes: todas del mismo tipo de dato (1) | Administrador: bloque "Totales" (todo lo registrado), bloque "Desenlace de las citas · este mes" con selector de período, bloque "Requiere tu atención" | `R52-R56-inicio-administrador` | **Cumple** |
| R53 | Administrador: totales y atendidas, no atendidas, canceladas, pacientes sin atender (1, 2) | Pacientes registrados 40, Pacientes sin atender 7, Citas registradas 90, Productos en inventario 20; Atendidas, No atendidas, Canceladas | `R52-R56-inicio-administrador` | **Cumple** |
| R54 | "10 productos con stock bajo", no "alertas"; sin repetirlo (1, 2) | "7 productos con stock bajo" una sola vez en "Requiere tu atención", con "Reabastecer" | `R52-R56-inicio-administrador` | **Cumple** |
| R55 | Atajos "Registrar paciente", "Agendar cita", "Añadir producto" (1) | Los tres, con enlace de un clic bajo cada total | `R52-R56-inicio-administrador` | **Cumple** |
| R56 | Cada rol ve en Inicio lo suyo (1, 4) | Optómetra: "Tu agenda del día", "Siguiente paciente", "Fichas sin terminar"; Recepción: "Por llegar", "En sala de espera", "No asistieron"; Ventas: "Listos para venta", "Proformas en seguimiento", "Saldos por cobrar" | `R52-R56-inicio-optometra-paula`, `R52-R56-inicio-recepcion`, `R52-R56-inicio-ventas` | **Cumple** |

### 3.6 Inventario y ventas

| # | Lo que pidió (archivo) | Dónde se ve | Captura | Veredicto |
|---|---|---|---|---|
| R57 | Las lunas no son stock; son un detalle de texto con precio general (3) | Inventario: "Las lunas no se registran aquí: se escriben en la venta". En la venta, "Luna": tipo, material, filtros, otros, precio | `R57-R58-N1-inventario-monturas-y-accesorios`, `R38-R57-R59-venta-luna-como-texto-y-cuotas` | **Cumple** |
| R58 | Solo monturas, de forma genérica (3) | "Monturas y accesorios"; categorías Armazones y Accesorios; ítems "Montura 1, marco negro, acetato" | `R57-R58-N1-inventario-monturas-y-accesorios` | **Cumple** |
| R59 | La venta: buscar al paciente, tomar el diagnóstico, elegir montura, escribir luna y filtros, precio final (3) | Modal: paciente, datos del diagnóstico, "Montura / accesorio", "Luna", "Servicio", Total, método de pago | `R35-R38-R59-tomar-datos-proforma-y-pago`, `R38-R57-R59-venta-luna-como-texto-y-cuotas` | **Cumple con mejora** (el total se arma con renglones: consulta, luna, montura, servicios; no hay un solo campo de "precio final") |

### 3.7 Reportes

| # | Lo que pidió (archivo) | Dónde se ve | Captura | Veredicto |
|---|---|---|---|---|
| R60 | Gráficas de diagnósticos por año y por mes (3) | Reportes → "Diagnósticos por mes" (pacientes distintos por diagnóstico, ene a dic y año) y "Diagnósticos más frecuentes" | `R60-reportes-diagnosticos-por-mes` | **Cumple** |
| R61 | Filtrar reportes por motivo de consulta (3) | Reportes → "Motivo de consulta" (Consulta General 29, Examen de Control 19, etc.); aplica a consultas, diagnósticos, conversión y embudo | `R49-R61-reportes-filtro-por-motivo-y-kpis` | **Cumple** |

### 3.8 Diseño

| # | Lo que pidió (archivo) | Dónde se ve | Captura | Veredicto |
|---|---|---|---|---|
| R62 | Pulir el diseño al final, módulo por módulo, con el mismo lenguaje (1, 2, 3) | El sistema interno comparte la base visual (menú, tarjetas, tipografía); la página pública de la óptica y el portal del paciente tienen otro estilo (Bloque G, fijado por el ingeniero "al final") | `R62-pagina-publica-de-la-optica`, `R52-R56-inicio-administrador` | **Parcial** |

---

## 4. Notas de método

- Cada captura se tomó en el sitio publicado, a 1366×768. Las de los modales de venta y de "Atender" se cerraron sin confirmar.
- El documento "dos copias" de la orden (`R36-orden-de-laboratorio-dos-copias`) se obtuvo interceptando el HTML que genera "Imprimir copias" en el sitio publicado y renderizándolo; no se abrió el diálogo de impresión.
- Las cifras de Reportes y Pacientes en las capturas posteriores a las 11:38 incluyen los registros creados por la otra sesión descrita en el resumen.
