# Panel del superadmin v2 (16 oct. 2026, rama `superadmin-v2`, SIN publicar)

Pedido: que el panel del superadmin quede al nivel del resto del sistema. Responde "¿cómo va mi negocio y qué óptica necesita atención?" y se ve y se comporta como Reportes.

## Qué cambió

- **Resumen** (`src/componentes/superadmin/ResumenNegocio.jsx`): mismo selector de período que Reportes (`SelectorPeriodo.jsx`, extraído de Reportes sin cambiar su aspecto), tarjetas `TarjetaReporte` con comparación contra el período anterior equivalente y ⓘ, gráficas `BarrasMes` con su valor, "Exportar" por bloque, ventana de detalle `VentanaDetalle` con "Abrir en …". Siete secciones en el orden pedido: Ingresos · Clientes · Ópticas que necesitan atención · Uso del sistema · Soporte · Leads · Estado del sistema. Se quitó la gráfica circular, las mini gráficas sin valores y los números repetidos ("Pacientes" dos veces, "Pacientes atendidos en la red", "Volumen de consultas").
- **Salud de cada óptica** (`superadminNegocio.js`, `saludDeOptica`): Saludable · Atención · En riesgo, el peor de cuatro cosas (último ingreso del personal, uso de 30 días, pago, consultas de soporte abiertas), con el motivo escrito. El ⓘ lo explica con los umbrales. El detalle (ventana estándar) trae salud, uso, pagos y consultas, "Entrar como administrador" y "Abrir en Ópticas".
- **Ópticas de prueba**: columna `opticas.es_de_prueba` que cambia el superadmin (interruptor en el detalle de la óptica), insignia "Óptica de prueba" y el interruptor "Incluir ópticas de prueba" en Resumen, Ópticas, Soporte y Actividad. Todo lo que cuenta el negocio las excluye por defecto, así el Resumen y las listas dan el mismo número. No se borra nada.
- **Actividad** (`ActividadSuperadmin.jsx`): registro de auditoría con pestañas por tipo y su número (Todas · Ópticas · Accesos · Soporte · Pagos · Avisos del sistema · Superadmins · Leads), filtros de período, óptica, persona y texto con etiquetas "x", agrupada por día, cada acción abre su detalle (qué cambió antes/después, quién, óptica, cuándo, "Abrir en …"), "Exportar" con lo que se ve. La base impide borrar o editar un registro.
- **Ópticas, Leads, Soporte y Superadmins**: la misma cabecera (título + pregunta), caja de filtros con etiquetas, números en las pestañas que coinciden con el Resumen, detalle en la ventana estándar (Leads ya no trae botones en cada fila) y estados vacíos con mensaje.
- **Pendientes del superadmin de `revision-portal-y-superadmin.md`**: S1 (uso en el detalle y en la lista de Ópticas), S2 (roles de la óptica en solo lectura y "Restaurar los predefinidos"), S3 (entrar como administrador en el azul de la marca, no en el violeta de "En espera"), S5 ("CRM" ya se llama Soporte), S6 (sin "slug" ni "Supabase": "Dirección de la página"), S7 (suspender con motivo opcional que queda en Actividad y avisa al administrador; "Suspender ahora" cuando el pago está vencido), S8 (la suscripción se guarda con un botón "Guardar suscripción" y un aviso, y queda en Actividad), S9 (se quitó el estilo propio del panel: sombras, hover que se levanta, colores pastel por tipo), S10 (el panel ya no arma "hoy" a mano), S11 (estados vacíos revisados: ver abajo).

## Base de datos: migración `0119_superadmin_v2.sql` (ESCRITA y ensayada, SIN APLICAR)

Respaldo previo: `C:\Users\diego\backups-optica\pre-superadmin-v2-2026-10-16.dump`. Ensayo en transacción que revierte: `node --env-file=.env.local scripts/ensayo-0119.mjs` (todo pasa). Lo que hace:
1. `opticas.es_de_prueba` (falso por defecto; marca Demo, QA Test Claude y la óptica vacía) y protegida igual que nombre o estado de pago.
2. `datos_negocio_superadmin()` (solo superadmin): último ingreso por persona y, por óptica, pacientes, asistentes, citas, consultas, ventas y personas activas de los últimos 30 días y de los 30 anteriores, y acciones por módulo.
3. `restaurar_roles_predefinidos(óptica)` (solo superadmin).
4. `auditoria`: columnas `antes` y `despues`, cinco acciones nuevas (marcar óptica de prueba, estado de lead, estado de consulta de soporte, factura pagada, cambio de suscripción) y un disparador que impide borrar o editar un registro.

**Mientras no se aplique**, la versión publicada sigue igual (la migración solo agrega) y el panel nuevo funciona en modo reducido: dice "todavía no se puede leer el uso de las ópticas", no inventa números, y las ópticas de prueba no se pueden marcar (el interruptor avisa que no se pudo). Falta la verificación con sesiones reales (`scripts/verificar-0119.mjs`) después de aplicarla.

## Datos que faltan o decisiones que pide el pedido (dicho antes de inventar)

- **Precio de la suscripción**: `opticas.monto_mensual` está vacío en las 5 ópticas. Facturado y Cobrado salen de la tabla `facturas` (hay pocas). Sin precio por óptica no hay "ingreso mensual recurrente"; no se calculó.
- **"Dadas de baja"**: el sistema solo suspende (no existe una baja definitiva). Se definió como "suspendidas durante el período y que siguen suspendidas al cierre", calculada con los eventos de suspender y reactivar de la actividad. Las ópticas "activas" y "suspendidas" al cierre de cada mes se reconstruyen con esos mismos eventos.
- **"Vencida"**: las facturas no tienen fecha de vencimiento; una factura por cobrar se considera vencida a los 30 días de emitida (dicho en el ⓘ). El estado de pago de cada óptica (Al día / Pendiente / Vencido) sigue siendo el que marca el superadmin.
- **"Qué módulos usa cada óptica"**: se cuenta por las acciones que el personal anotó en la actividad de la óptica (`logs_optica`) en los últimos 30 días. Una persona que solo mira pantallas no deja huella. Se muestran siete módulos (los seis pedidos más Ficha clínica, que es uno propio en el sistema).
- **Personas activas**: quienes anotaron al menos una acción en 30 días. El último ingreso (que sí viene del inicio de sesión) se usa para la salud.
- **Leads**: el embudo muestra cada interesado en un solo estado (Nuevo, Contactado, Convertido, Descartado), así las partes suman el total y coinciden con las pestañas de la sección Leads.
- **Primera respuesta y satisfacción de Soporte** son del período; abiertas y urgentes son de hoy (se comparan con el cierre del período anterior). "Abrir en Soporte" lleva al mismo período con los mismos números.
- **Hecho sin preguntar** (reversible): "Abrir" una óptica desde la Actividad o el Resumen abre el detalle de siempre (no se duplicó la ventana de gestión).

## Pruebas

- `src/utilidades/superadminNegocio.test.js` (24): salud de la óptica (umbrales de ingreso, uso, pago y soporte), exclusión de las ópticas de prueba, comparación con el período anterior (ingresos y clientes), estado de una óptica en una fecha pasada, uso, embudo de leads, tipos y filtros de la actividad.
- `ResumenNegocio.test.jsx` (8) y `ActividadSuperadmin.test.jsx` (6): las siete secciones y su orden, las de prueba fuera por defecto y dentro con el interruptor, cada número abre una lista con tantas filas como dice, las tarjetas de Soporte y Leads coinciden con la bandeja y la sección Leads (mismas funciones y mismo conteo), la salud de la tabla es la de la función, el detalle de una óptica y de una acción, el registro no ofrece editar ni borrar, estados vacíos con una sola acción.
- Pasan también en UTC, Tokio y Los Ángeles. Guardas (`textoMinimo12px`, `ventanasEstandar`, `fuenteUnicaFechas`, `sinVariablesNoDefinidas`) en verde. Sin desplazamiento horizontal ni texto de menos de 12 px a 1366×768 en las seis secciones (medido en el navegador). No se corrió la suite completa de Vitest ni la de Playwright.

## Comparación con los criterios del ingeniero (`feedback-ing/criterios-ingeniero.md`)

| # | Criterio | Cómo queda |
|---|---|---|
| 1 | Evitar pantallas vacías | Cada bloque dice qué pasa y qué hacer (sin facturas, sin interesados, sin ópticas, todo es de prueba, filtros sin resultado). La salud siempre muestra algo. |
| 2 | Contexto antes de la acción | Desde una óptica del Resumen se entra como administrador sin buscarla otra vez; los "Abrir en …" llegan con el período y los filtros puestos. |
| 3 | No duplicar | Se quitaron los números repetidos del Resumen; "Limpiar filtros" solo está en la barra (no se repite en el mensaje vacío); el botón de ver detalle de cada fila de Ópticas se fue (la fila abre el detalle). |
| 4 | Automatizar lo comprobable | La salud, "activas al cierre" y "vencida" se calculan solas; nada depende de que alguien se acuerde. |
| 5 | Conservar el registro | La actividad no se borra ni se edita (lo impide la base) y cada acción guarda antes y después. Las ópticas de prueba se marcan, no se borran. |
| 6 | Categorías fijas | Salud, tipos de actividad y estados de lead son listas fijas con un solo nombre y color. |
| 7 | Orden consistente | Las secciones siguen el orden del pedido; los botones de cabecera van en el mismo lugar que Reportes. |
| 8 | Vista según el rol | El panel es solo del superadmin; lo de las ópticas se ve por permiso en cada óptica como siempre. |
| 9 | Flujos conectados | Resumen → detalle de la óptica → entrar como administrador; Actividad → "Abrir en …"; suspender → aviso al administrador y registro. |

Reglas de `principios-diseno.md` repasadas: 1 (posiciones estables: período y filtros siempre arriba), 2 y 5 (un número, una función, igual en Resumen y secciones), 3 y 8 (un solo camino), 6 (filtros con "x"), 12 (fechas y dinero con las funciones únicas), 14 (color de estado; impersonación en el azul de la marca), 17 y 26 (vacíos con un solo mensaje), 41 (≥ 12 px), 42 (cada número lleva a lo que promete) y 43 (ventana estándar).

## Falta (para el siguiente paso)

- Aplicar la 0119 con tu aprobación y correr la verificación con sesiones reales (superadmin, administrador, personal y sin sesión).
- Revisar la rama en localhost ya con la migración (hoy se ve el modo reducido) y, si todo bien, la suite completa de Playwright y publicar.
- Las pruebas de Playwright que abran el panel del superadmin (`e2e/soporte-v2.spec.js`, `comunicacion-interna.spec.js`) buscan textos del Soporte; no se corrieron aquí.
