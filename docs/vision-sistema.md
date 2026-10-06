# Visión del sistema: Óptica Solna Vision

Este documento define cómo debe ser el sistema terminado, no solo qué pidió el ingeniero. Se complementa con `requisitos-reunion-29sep.md` (lo que pidió, con su fuente). La regla es: cumplir todos sus requisitos y, donde se pueda, resolver su intención mejor de lo que él lo planteó.

## 1. Cómo piensa el ingeniero (y cómo vamos más allá)

Sus criterios, extraídos de todas las reuniones:

1. Cada pantalla responde a una pregunta del usuario que la usa. Nada vacío, nada que no ayude a decidir.
2. El sistema sabe lo que pasó y lo refleja solo: estados automáticos, datos que no se vuelven a pedir.
3. Nunca se pierde información: no se borra, se cancela o reagenda; quien consultó y no compró también cuenta.
4. Cada rol ve y puede hacer lo que le corresponde, con permisos por nivel (ver o gestionar).
5. Los flujos están conectados: cita → atención → receta → venta → orden de laboratorio → entrega, sin buscar dos veces.
6. Categorías en lugar de texto libre, para que después existan reportes.
7. Pensar en el usuario común ("clic, clic y listo") y también en el experto.

Ir más allá significa aplicar esos mismos criterios a lugares donde él no llegó a mirar, y anticiparse a lo que va a preguntar en la siguiente reunión.

## 2. Por qué el sistema no se ve mejor después de mes y medio

1. Se trabajó con un resumen de las reuniones, no con lo que se dijo; varios pedidos grandes nunca llegaron al código.
2. No había una visión del sistema terminado: se corrigieron observaciones una por una, y el resultado parece parchado.
3. Mucho del trabajo fue invisible (seguridad, datos, errores internos) y la cara del sistema, el marco común de todas las pantallas, no se tocó.
4. El sistema casi no tiene datos: con 8 citas pasadas, cualquier pantalla se ve vacía y pobre.
5. Se abrieron muchos frentes a la vez y no se terminó ninguno.
6. No había una definición de "terminado" ni una verificación de calidad antes de mostrar.

## 3. El sistema terminado, módulo por módulo

Para cada módulo: lo que pidió el ingeniero (resumido) y lo que agregamos para hacerlo mejor.

### 3.1 Base visual común (afecta a todo el sistema)
- Pedido: un mismo lenguaje de diseño en todo el sistema.
- Más allá: un sistema de componentes único (encabezado de página, tarjetas de indicadores, bloque de filtros, tablas, modales, estados vacíos, badges de estado) aplicado a todas las pantallas a la vez. Así, una sola mejora visual cambia todo el sistema, y cada módulo nuevo nace consistente. Estilo sobrio: blanco y grises, la marca solo en lo principal, color solo para estados.
- Decisiones (30 sep): las acciones principales usan INK `#0E2B33` sólido, sin degradado; el azul queda reservado para el estado "En atención", porque el color significa solo estados. Los títulos dentro del sistema son sans; el serif queda solo en las páginas públicas.
- Fuera del Bloque A: las páginas públicas (Login, PaginaVenta, AgendarCitaPublica) y el Portal del paciente. Se les aplica la misma base en el Bloque G.

### 3.2 Citas médicas
- Pedido: indicadores que se vean como filtros, con "Hoy" primero; bloque de filtros ordenado (estado, origen, primera vez) con el buscador al lado; vista por día, mes y calendario; detalle de la cita con su responsable; sin acciones manuales para estados automáticos; reagendar en lugar de borrar.
- Más allá:
  - Confirmación de citas por WhatsApp en un clic, con el estado "Confirmada" visible.
  - Marca de paciente con inasistencias repetidas, para pedir confirmación.
  - El administrador ve el rendimiento por profesional: atendidas, no asistidas y canceladas por persona.

### 3.3 Atención (ficha clínica)
- Pedido: entrar desde la cita, contexto primero, exámenes opcionales, motivo por categorías, terminar la atención con la receta y pasar al paciente a ventas.
- Más allá:
  - Receta en PDF profesional, con el logo de la óptica, el registro profesional y la firma, lista para imprimir o enviar por WhatsApp.
  - "Copiar la graduación anterior" y diagnósticos frecuentes en un clic, para atender más rápido.
  - Alertas clínicas siempre visibles (alergias, control vencido).

### 3.4 Ventas y laboratorio (nuevo)
- Pedido: cola de pacientes listos para venta, "tomar datos del diagnóstico", proforma, venta con montura del inventario y luna como detalle, orden de laboratorio con dos copias, estado "completada" y aviso al administrador; pagos al contado, a cuotas o con abonos.
- Más allá:
  - Tablero de órdenes por estado: enviada, en laboratorio, lista para entregar, entregada.
  - Aviso al paciente en un clic, "Tus lentes están listos", por WhatsApp, y el estado visible en su portal.
  - Saldo pendiente de los abonos visible en el perfil del paciente y en el momento de la entrega.

### 3.5 Perfil del paciente
- Pedido: Productos y servicios; Fidelización con cumpleaños; enviar mensaje; sección de citas y sección de diagnósticos con la tendencia arriba.
- Más allá: una cabecera con todo lo urgente del paciente (alergias, control vencido, saldo pendiente, lentes listos para retirar, cumpleaños cercano) y sus acciones directas.

### 3.6 Roles y usuarios
- Pedido: roles separados de usuarios, roles predefinidos editables y roles propios, permisos por nivel, alcance de datos por usuario, varios perfiles por persona, cédula, correo obligatorio y verificado.
- Pendiente para este bloque: el formulario "Crear óptica" del superadmin acepta contraseñas débiles (por ejemplo, 6 números), mientras que el de Usuarios exige 8 caracteres con letras y números. Todas las formas de crear una cuenta deben aplicar la misma regla.
- Las cuentas de optómetra y recepcionista de la Óptica Demo se crean en este bloque, con el nuevo sistema de roles.
- Más allá: "Ver como este rol", para que el administrador compruebe lo que verá cada persona antes de asignarle el rol.

### 3.7 Inicio por rol
- Pedido: tarjetas coherentes; el administrador ve el negocio (totales y atendidas, no atendidas y canceladas); el optómetra ve sus citas de hoy; cada rol según sus actividades.
- Más allá: cada Inicio responde a "¿qué tengo que hacer ahora?", con la lista de pendientes de ese rol y su acción directa.

### 3.8 Inventario
- Pedido: simplificar; solo monturas genéricas; las lunas como detalle de la orden.
- Más allá: alertas de stock en número de productos y reposición desde la misma alerta.

### 3.9 Reportes
- Pedido: diagnósticos por mes y por año, filtros por motivo de consulta.
- Más allá: el embudo de la óptica: cuántos consultaron, cuántos compraron y cuántos volvieron, que es la pregunta de negocio que planteó el ingeniero ("vinieron 20, se quedaron 5, ¿qué pasa?").

## 4. Cómo trabajamos desde ahora

1. Fuente única: los requisitos y esta visión. Nada se construye sin un requisito o una mejora de esta lista detrás.
2. Un bloque a la vez, terminado antes de pasar al siguiente.
3. Datos realistas: una óptica de demostración dentro del mismo sistema (usando la capa multi-óptica que ya existe), con pacientes, citas, ventas y órdenes ficticias. Así cada pantalla se ve como en un día real, para probar y para presentar, sin tocar los datos de Óptica Solna Vision.
4. Definición de terminado de cada bloque: cumple todos sus requisitos, pasa los tests, Claude Code recorre los casos de uso del ingeniero en el navegador, revisa sus capturas contra el estándar visual y corrige antes de mostrar.
5. Tú juzgas el resultado como usuario; el agente es responsable de la calidad antes de mostrártelo.

## 5. Orden de trabajo y lo que se verá en cada bloque

| Bloque | Qué incluye | Lo que vas a ver |
|---|---|---|
| A. Base | Componentes visuales comunes aplicados a todo el sistema; óptica de demostración con datos | Todo el sistema con una cara nueva y coherente, y pantallas llenas de datos realistas |
| B. Citas y atención | Secciones 3.2 y 3.3 | El flujo completo: agendar, confirmar, atender, recetar y pasar a ventas |
| C. Paciente | Sección 3.5 | Un perfil que muestra todo lo urgente y su historia ordenada |
| D. Roles e Inicio | Secciones 3.6 y 3.7 | Cada persona entra y ve su trabajo; el administrador controla al equipo |
| E. Ventas y laboratorio | Secciones 3.4 y 3.8 | La venta con su orden de laboratorio y el seguimiento hasta la entrega |
| F. Reportes | Sección 3.9 | Gráficas de diagnósticos y el embudo del negocio |
| G. Pulido final | Revisión visual y de usabilidad de todo, medición de Nielsen; aplicar la base visual a las páginas públicas y al Portal del paciente | El sistema listo para presentar |

## 6. Hallazgos de la investigación y cómo ajustan el plan

Investigación hecha sobre software profesional de ópticas, normativa de Ecuador, diseño de roles y permisos, recordatorios de citas y métodos de validación de usabilidad.

### 6.1 Lo que hacen los sistemas profesionales de óptica
- El corazón de un sistema de óptica, y lo que lo distingue de un software médico general, es conectar el examen clínico con la orden de laboratorio: la receta y las medidas generan la orden completa, que se sigue hasta la entrega.
- Las órdenes se siguen por etapas: presupuesto, confirmada, en laboratorio, lista, entregada; con aviso cuando el laboratorio se atrasa.
- Los recordatorios de control (recalls) se automatizan.
- Ajuste al plan: el módulo de Ventas y laboratorio (3.4) usa esas etapas y alerta las órdenes atrasadas. La orden de laboratorio incluye: receta (esfera, cilindro, eje, adición por ojo), distancia pupilar de lejos y de cerca, altura de montaje, tipo de lente (monofocal, bifocal, progresivo), material (CR-39, policarbonato, alto índice), tratamientos (antirreflejo, filtro azul, fotocromático) y la montura con sus medidas (calibre, puente, varilla).

### 6.2 Facturación en Ecuador
- Desde el 29 de noviembre de 2022 todos los contribuyentes deben emitir facturas electrónicas autorizadas por el SRI, con firma electrónica, mediante la herramienta gratuita del SRI o un proveedor. Desde 2026 el SRI además registra a los proveedores de sistemas de facturación.
- Ajuste al plan: el sistema NO debe presentar sus documentos como "factura", porque no son facturas electrónicas autorizadas. Se renombran como "Comprobante de venta interno" u "Orden de venta", y se registra el número de la factura electrónica emitida por fuera (SRI o proveedor). La integración con el SRI queda como trabajo futuro, declarado en la tesis.

### 6.3 Protección de datos (LOPDP, Ecuador)
- La Ley Orgánica de Protección de Datos Personales trata los datos de salud como categoría especial, con obligaciones reforzadas: consentimiento, conservación definida y derechos del titular (acceso, rectificación, eliminación, oposición).
- Ajuste al plan:
  - Consentimiento informado de tratamiento de datos al registrar al paciente y al agendar por la web.
  - Acceso por mínimo privilegio: cada rol ve solo los datos clínicos que necesita (ya contemplado en 3.6).
  - Registro de auditoría de quién vio o modificó datos clínicos (el sistema ya tiene un registro de actividad que se amplía).
  - La solicitud de eliminación de datos del paciente, que ya existe, se mantiene.

### 6.4 Roles y permisos
- Buenas prácticas: roles basados en funciones del trabajo, no en personas; una matriz de permisos legible (roles por un lado, acciones por el otro); un usuario puede tener varios roles y sus permisos se suman; mínimo privilegio por defecto; registro de cambios de roles.
- Ajuste al plan: la pantalla de Roles muestra una matriz legible por módulo con niveles Ver / Crear / Editar / Eliminar, roles predefinidos como plantillas editables y un registro de cambios de permisos.

### 6.5 Recordatorios de citas
- La evidencia muestra que los recordatorios por SMS y WhatsApp reducen las inasistencias, y que funcionan mejor si permiten confirmar o reprogramar, enviados 24 a 48 horas antes y el mismo día.
- Ajuste al plan: en Citas, recordatorio por WhatsApp en un clic con enlace para confirmar o reagendar; tasa de inasistencia por paciente; confirmación obligatoria para pacientes con historial de ausencias.

### 6.6 Validación para la tesis
- La medición de Nielsen es una evaluación de expertos. Para validar con usuarios, el estándar es el System Usability Scale (SUS): 10 preguntas en escala de 1 a 5, puntaje de 0 a 100, con 68 como promedio de referencia; funciona con pocos participantes.
- Ajuste al plan: se agrega el bloque H. Prueba con usuarios reales de la óptica (optómetra, recepción y administrador), con tareas concretas de los casos de uso del ingeniero, tiempo y errores por tarea, y el cuestionario SUS al final. Junto con las tres mediciones de Nielsen, da una validación completa: experta y con usuarios.

| Bloque | Qué incluye | Lo que vas a ver |
|---|---|---|
| H. Validación | Prueba con usuarios reales, cuestionario SUS y comparación con Nielsen | Evidencia medida de que el sistema es usable, para defender la tesis |
