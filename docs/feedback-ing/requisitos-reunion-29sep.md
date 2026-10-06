# Requisitos del ingeniero: reunión del 29 de septiembre

Fuente: transcripciones completas de la reunión (archivos 1 a 4), leídas de principio a fin. Este documento reemplaza al resumen generado por Gemini, que omitió varios pedidos importantes.

Regla de lectura: cuando el ingeniero dice "podría ser" o "habría que analizar", se trata como dirección a resolver con criterio, no como texto literal. Cuando dice "hay que" o "debería", es un requisito.

Prioridad que él mismo fijó (archivo 4): primero la integración de Citas con Pacientes y la atención; después roles y usuarios, con las tarjetas de Inicio por rol. El diseño visual se pule al final, módulo por módulo ("vamos a funcionalidad"). Para el viernes quería Citas y Pacientes terminados.

---

## 1. Citas médicas (prioridad 1)

### 1.1 Indicadores de arriba
- R1. El orden importa: "Citas de hoy" primero (es el dato clave) y "Total agendadas" al final (es el total de todo). (archivo 2)
- R2. Hoy los indicadores funcionan como filtros, pero no lo parecen: "parecen más tarjetas de información". Deben verse claramente como filtros (estado seleccionado, cursor, etc.). (archivo 2)

### 1.2 Filtros y búsqueda
- R3. Agrupar los filtros en un bloque de filtrado. Orden de prioridad: (1) estado de la cita: todas, en curso, finalizadas, canceladas; (2) origen (web o recepción); (3) primera vez o seguimiento, al final. (archivo 2)
  - Atención: la propuesta del PDF quitó los filtros de origen y de primera vez. El ingeniero NO pidió quitarlos, pidió ordenarlos. Hay que restaurarlos dentro del bloque de filtros.
- R4. Debe poder verse de forma continua todas las atendidas, todas las en curso y todas las canceladas, y también las vencidas. (archivo 2)
- R5. El buscador debe estar cerca de los filtros, no separado arriba. (archivo 2)
- R6. "Primera vez" es ambiguo: cuando el paciente tiene una segunda cita, deja de aparecer. Repensar qué significa (ver 2.4). (archivo 2)

### 1.3 Vistas
- R7. Ver citas por día y por mes, con el día actual siempre marcado y un botón "Hoy". La vista semanal es opcional ("para no complicarnos"). (archivo 3)
- R8. Filtro por rango de fechas para ver, por ejemplo, la próxima semana. (archivo 3)
- R9. Una vista de calendario "por color" para ver de un vistazo qué días tuvieron más o menos atención y planificar las citas futuras. (archivo 2)
- R10. Orden: lo más próximo primero; las citas futuras deben ser fáciles de ver. (archivo 2)
- R11. Al hacer clic en un día del mes: modal con las citas de ese día en una sola columna. (archivo 3)

### 1.4 Detalle de la cita
- R12. Clic en una cita: modal con toda la información: paciente, fecha en que se agendó, motivo, origen (web o recepción) y QUIÉN la atendió o está a cargo. (archivos 2 y 3)
- R13. Desde ese modal, botones "Ingresar" (a la ficha clínica de esa cita) y "Cerrar". (archivo 4)
- R14. "Ver perfil" del paciente no debe dejar al usuario sin poder volver (hoy "te pierdes"). Abrir en pestaña nueva o garantizar el regreso. (archivo 2)
- R15. Quitar "Crear paciente" del menú de la cita: el paciente ya se crea al agendar. (archivo 2)
- R16. "Paciente en atención" y "Marcar atendida" no deben ser acciones manuales: son automáticas. "No asistió" sí es manual. (archivos 2 y 4)
- R17. No se eliminan citas: se reagendan (o se cancelan conservando el registro). El paciente puede reagendar su cita a otro día disponible. (archivo 4)

### 1.5 Control del administrador sobre el personal
- R18. El administrador debe poder filtrar las citas no atendidas y ver qué miembro del personal estaba a cargo, para pedir explicaciones y tomar decisiones sobre el rendimiento del equipo. Esto requiere registrar el responsable de cada cita/atención. (archivo 2)
- R19. En Mi horario: cantidad de horarios ocupados y disponibles; el administrador ve los horarios de todo el personal y quién está ocupado. (archivo 3)

---

## 2. Atención: de la cita a la ficha clínica y a la venta (prioridad 1)

### 2.1 Entrada a la atención
- R20. "Atender" desde la cita: modal de resumen, luego directo a la ficha clínica vinculada a esa cita. (archivos 3 y 4)
- R21. Al atender, la cita pasa sola a "En atención", y el administrador ve en tiempo real cuántas están en atención. (archivo 4)
- R22. Si el paciente se registró por la web, al atender se confirman o completan sus datos (cédula, teléfono, correo) antes de entrar. (archivo 3)
- R23. Una cita de mañana o de dos semanas puede atenderse hoy; lo que importa es registrar la fecha real de atención, distinta de la fecha agendada. (archivo 4)
- R24. Si el paciente llega sin cita, se le atiende desde Pacientes. (archivo 4)

### 2.2 Ficha clínica
- R25. Si ya estoy dentro de un paciente, no debe aparecer el buscador de pacientes. (archivo 3)
- R26. Mostrar una referencia clara de qué cita se está atendiendo (fecha de la cita). (archivo 3)
- R27. Primero el contexto del paciente (antecedentes, última cita, historial, tendencia de graduación), después el registro de lo atendido. Puede ser un bloque o un modal de "Datos de contexto". (archivo 3)
- R28. No repetir bloques entre pasos (los antecedentes aparecían en dos pasos). (archivo 3)
- R29. Todos los exámenes son opcionales; el optómetra entra solo a los que usa. (archivo 3)
- R30. Motivo de la consulta: categorías predefinidas (consulta general, examen de control...) configurables, más "Otros" con detalle. Si la cita ya trae el motivo, no se vuelve a pedir. Sirve para reportes. (archivo 3)
- R31. Diagnóstico: categoría identificada más detalle. Lente recomendado, adjuntar imágenes, indicaciones y próximo control están bien. (archivo 3)
- R32. Una vez iniciada la atención no se "pospone": se guarda y se sigue, o se "deja de atender" (lo no guardado se pierde y la cita se mantiene). (archivo 3)
- R33. "Terminar atención" / "Cerrar cita" genera la RECETA, no la factura. (archivo 3)

### 2.3 Paso a ventas y laboratorio
- R34. Al terminar la atención, un botón "Pasar a la óptica" deja al paciente en estado "Listo para venta", visible para la vendedora. (archivo 3)
- R35. La vendedora busca al paciente y, con "Tomar datos del diagnóstico", arma la proforma con lo recetado. (archivo 3)
- R36. Si el paciente compra, se registra la venta y se genera la ORDEN DE LABORATORIO con el número de factura y el detalle: montura, tipo de lente, filtros y la receta. Se imprimen dos: una para el paciente y otra para el laboratorio. (archivo 3)
- R37. El laboratorio marca la orden como "Completada", el administrador recibe el aviso y llama al paciente para que retire. (archivo 3)
- R38. Pagos al contado, a cuotas o con abonos, desde la venta. (archivo 3)
- R39. La cita queda "Atendida" cuando se genera la factura total (archivo 4). Combinado con R33: el optómetra cierra la atención con la receta; la cita termina de cerrarse con la factura de la venta.
  - Atención: hoy el sistema abre el panel de cobro al guardar la ficha, es decir, cobra el optómetra. El ingeniero describe que cobra la vendedora. En una óptica de una sola persona puede ser la misma, así que el paso a ventas debería permitir cobrar de inmediato a quien tenga permiso de ventas.

### 2.4 Pacientes que consultan y no compran
- R40. No se descarta a quien consultó y no compró: se necesita saber cuántos vinieron por primera vez y cuántos se volvieron clientes, para decisiones del negocio. Ordenar la información para distinguir pacientes accesibles de datos estadísticos. (archivo 2)

---

## 3. Perfil del paciente (prioridad 1)

- R41. "Lentes/Productos" pasa a "Productos y servicios", con la tabla de transacciones (productos comprados y servicios adquiridos: medición, cambio de armazón, limpieza). (archivo 4)
- R42. Separar controles de fidelización: el estado clínico y la evolución van al historial clínico; Fidelización queda con lo de la relación con el paciente. (archivo 4)
- R43. Fidelización: última visita, cliente frecuente, referidos y el cumpleaños con los días que faltan ("20 días para su cumpleaños"). El próximo control no se repite ahí. (archivo 4)
- R44. Acción "Enviar mensaje por CRM" desde el perfil, para enviar a ese paciente aunque los envíos automáticos estén desactivados. (archivo 4)
- R45. Historial y Ficha clínica se repetían. Propuesta del ingeniero: una sección de CITAS del paciente (citas pendientes, próxima cita, historial de citas, con botón para ingresar a la cita actual) y una sección de DIAGNÓSTICOS (lista con motivo y diagnóstico de cada atención; al hacer clic, se ve el formulario completo de ese día), con la tendencia de graduación arriba. (archivos 3 y 4)

---

## 4. Roles y usuarios (prioridad 2)

- R46. Separar "Roles" de "Usuarios": primero se definen los roles con sus permisos; al crear un usuario se elige su rol, con vista previa de sus permisos. Hoy está mezclado y se repite el trabajo en cada usuario. (archivo 1)
- R47. Roles predefinidos, por ejemplo Optómetra y Asistente/Secretaria, con permisos ya configurados: no se pueden eliminar, pero sí editar. El administrador puede crear roles propios (por ejemplo "Optómetra principal" con inventario y "Optómetra secundario" sin él), y esos sí se pueden eliminar. Así sirve al usuario que quiere "clic, clic y listo" y al experto. (archivo 1)
- R48. Permisos por nivel, no solo por módulo: ver o gestionar (registrar, editar, eliminar). Ejemplos: el optómetra ve el inventario pero no lo modifica; la secretaria ve la ficha clínica pero no la edita ni borra; editar horarios es solo del administrador. (archivo 1)
- R49. Alcance de los datos según el usuario: el optómetra genera reportes solo de sus pacientes y ve solo su horario; los reportes globales son del administrador o de quien tenga ese permiso. (archivo 1)
- R50. Un usuario puede tener más de un perfil (por ejemplo administrador y optómetra) y cambiar de perfil desde el menú para ver la información de cada uno. (archivo 1)
- R51. Al crear un usuario: cédula para garantizar un usuario único, correo obligatorio y verificación de cuentas por correo. (archivo 1)

---

## 5. Inicio por rol (prioridad 2)

- R52. Las tarjetas deben tener coherencia: todas deben hablar del mismo tipo de dato (si una muestra totales, todas totales; si una muestra "hoy", todas "hoy"). (archivo 1)
- R53. Administrador: información del negocio. Totales (pacientes registrados, citas registradas, inventario registrado) e información complementaria: citas atendidas, no atendidas y canceladas, y pacientes sin atender. Si hay 10 citas no atendidas, el administrador va a Citas a ver qué pasó (ver R18). (archivos 1 y 2)
- R54. Stock bajo expresado como "10 productos con stock bajo", no "alertas". No repetir el stock bajo en dos lugares. (archivos 1 y 2)
- R55. Los atajos "Registrar paciente", "Agendar cita" y "Añadir producto" tienen sentido porque abren directamente la acción (un clic). (archivo 1)
- R56. Optómetra: le interesan las citas de hoy, no el total de pacientes ni el stock bajo. Cada rol ve en Inicio lo que corresponde a sus actividades principales. Si los roles son configurables, las tarjetas se basan en las actividades principales del rol; con roles predefinidos, cada uno tiene sus tarjetas. (archivo 1)

---

## 6. Inventario y ventas (prioridad 3)

- R57. Simplificar: el inventario no es de tienda. Las lunas (vidrios) no se manejan como stock con marcas: son un detalle de texto en la orden de laboratorio, con un precio general. (archivo 3)
- R58. Solo las monturas/armazones van en inventario, y de forma genérica ("Montura 1, marco negro, modelo tal"). (archivo 3)
- R59. La venta: buscar al paciente, tomar su diagnóstico, elegir la montura del inventario, escribir el tipo de luna y filtros, y poner el precio final total. (archivo 3)

---

## 7. Reportes (prioridad 3)

- R60. Gráficas de diagnósticos: cuántos pacientes tuvieron miopía, astigmatismo, etc., en el año y por mes, para ver tendencias. (archivo 3)
- R61. Filtrar reportes por motivo de consulta (por eso el motivo debe ser una categoría). (archivo 3)

---

## 8. Diseño (al final)

- R62. El diseño se pule poco a poco, módulo por módulo, después de la funcionalidad, manteniendo el mismo lenguaje de diseño en todo el sistema. El diseño es lo que se presenta al final. (archivos 1, 2 y 3)

---

## Diferencias detectadas con lo ya implementado

1. Filtros de Citas: se quitaron origen y primera vez; el ingeniero pidió ordenarlos, no quitarlos (R3).
2. Cobro: hoy cobra el optómetra al guardar la ficha; el ingeniero describe receta → paso a ventas → venta y orden de laboratorio (R33 a R39).
3. Responsable de la cita: no se registra quién atiende, y el administrador lo necesita (R12, R18).
4. Roles: hoy hay usuarios con permisos por módulo y una marca de optómetra; el ingeniero pide roles predefinidos y configurables, con niveles de permiso (R46 a R50).
5. Perfil del paciente: se unificó Historial con Ficha clínica; el ingeniero propone Citas por un lado y Diagnósticos por otro (R45).
6. Inventario: hoy se manejan lunas como productos con stock; el ingeniero pide simplificar (R57 a R59).
