# Revisión del resto del sistema en celular, tablet y laptop (17 oct. 2026)

**Solo lectura: no se corrigió nada.** Pedido de Diego al terminar el portal v2; regla nueva: la 48 de `docs/principios-diseno.md`.

## Cómo se hizo (y qué no se vio)
- `scripts/revision-adaptable.mjs` recorre, en 390 px (celular), 768 px (tablet) y 1366×768 (laptop): las páginas públicas, todos los módulos de cada rol del personal (Administrador, Optómetra, Recepción y Ventas, en la Óptica Demo, que es de solo lectura) y el panel del superadmin. En cada pantalla mide: desplazamiento horizontal de la página, elementos que se salen del ancho, botones y campos de menos de 44 px, textos de menos de 14 px y si el menú se adapta. 153 mediciones y sus capturas.
- **Para poder verlos hubo que engañar a la guarda de tamaño** (hallazgo 1): el script le hace creer que la ventana mide 1366 px. El CSS sí usa el ancho real.
- **Qué se miró con los ojos y qué solo con números:** se revisaron a mano las capturas de Inicio, Citas, Pacientes, Ventas y Reportes del Administrador en celular, Citas en tablet y el Inicio del superadmin en celular. El resto (Inventario, CRM, Mi horario, Soporte, Usuarios, Configuración, el resto del superadmin y las ventanas de cada módulo) **solo se midió con números**: ninguna tiene desplazamiento horizontal de la página, pero la medición no ve lo que queda recortado dentro de una barra o una tabla con desplazamiento propio, así que puede haber más casos como los de abajo. Las ventanas (modales) de los módulos no se abrieron (abrirlas escribe o puede escribir en la Demo).
- Los números de «botones pequeños» y «textos pequeños» son iguales en los tres tamaños (el sistema no cambia de tamaño de letra ni de botón al achicarse): **en laptop ya existen**, lo que cambia en el celular es que el dedo es menos preciso que el cursor.

## Hallazgos que valen para todo el personal y el superadmin

| # | Qué pasa | Importancia |
|---|---|---|
| 1 | **La guarda de tamaño bloquea todo el sistema del personal y del superadmin por debajo de 950 px de ancho** (y con zoom fuera de 65–150 %): se ve «Nivel de Zoom No Soportado». En celular y en tablet (768 px) **nada del personal ni del superadmin funciona hoy**. El portal y las páginas públicas ya quedaron fuera de la guarda (portal v2); la regla 48 pide que el resto también funcione. Quitar o bajar la guarda es una decisión de Diego (su comentario decía «sin excepciones»). | **Alta** |
| 2 | Sin la guarda, el menú se adapta bien: en celular y tablet el lateral pasa a un botón de hamburguesa que abre el menú, las tarjetas se apilan y no hay desplazamiento horizontal de la página en ninguna pantalla medida. | (bien) |
| 3 | Los botones y los campos miden menos de 44 px de alto: 10 a 60 por pantalla (filtros, pestañas, íconos de acción, menús desplegables). Ejemplo: «Pacientes» con 57 a 59 elementos pequeños. | Media |
| 4 | Hay muchos textos de 12–13 px (75 a 95 por pantalla en Pacientes, Usuarios, Mi horario, Reportes). Es el tamaño que fijó la regla 41 para el personal; para el dedo y en una pantalla chica cuesta leerlos. | Baja (laptop) · Media (celular) |
| 5 | Las listas desplegables de filtros (Reportes, Configuración…) usan la lista nativa del navegador, que en el celular se ve distinta en cada aparato. El portal ya usa `SelectorLista`. | Baja |

## Personal

### Inicio — Administrador, Optómetra, Recepción, Ventas
- **Celular:** las tarjetas de Totales y de «Requiere tu atención» se apilan en una columna y se leen bien (capturas vistas). Las líneas de avisos se cortan con «…» (ya previsto). Los atajos («Registrar paciente», «Agendar cita», «Agregar producto») ocupan tres filas.
- **Tablet:** dos columnas; sin cortes.
- **Laptop:** como siempre.
- Importancia: baja.

### Citas médicas
- **Celular:** la barra de controles **se corta por la derecha**: el campo «Buscar cita» muestra «Buscar cit», el conteo «0 citas h…» queda tapado por el selector «Hoy · Esta semana…» y el selector de fecha («Hoy · sáb 17 oct») y las flechas no se ven (quedan fuera de la pantalla dentro de una barra que no se desplaza a la vista). Sin esa barra no se puede cambiar de día ni de periodo. **Alta.**
- **Tablet:** la barra cabe; sin cortes.
- **Laptop:** correcta.
- Pendiente de ver (no se abrieron): Semana y Mes en celular, «Gestionar cita» y el detalle de la cita.

### Pacientes
- **Celular:** las cuatro tarjetas de estado se apilan de a dos y se leen bien. La barra de «Filtrar + buscador» corta el texto del buscador («Buscar paciente: nombre, cédula,…») y las pestañas de filtro («Todos», «Visitas recientes (16)», «Pagos pendientes (6)»…) se apilan en varias filas. La tabla de pacientes y el perfil 360° no se abrieron: **por ver**. Importancia: media.
- **Tablet y laptop:** sin cortes medidos.

### Ventas
- **Celular:** el botón **«Nueva venta» se sale de la pantalla por la derecha** (queda cortado) y el buscador de la lista también. Las filas de «Por vender» se apilan bien. **Alta** (no se puede tocar «Nueva venta» completo).
- **Tablet:** correcta. **Laptop:** correcta.
- Pestañas Comprobantes, Órdenes de laboratorio y Cobros y saldos: solo medidas (sin desplazamiento de la página); por ver a ojo.

### Inventario
- Sin desplazamiento horizontal en los tres tamaños (medido). 40 elementos pequeños por pantalla. La tabla de productos y la ficha del producto en celular: **por ver**. Importancia: media (sin confirmar).

### CRM y fidelización
- Sin desplazamiento horizontal (medido). 42 elementos pequeños y 50 textos pequeños en celular. Las cuatro pestañas (Para contactar, Seguimiento, Campañas, Fidelización) y la lista de contactos en celular: **por ver**. Importancia: media (sin confirmar).

### Mi horario
- Sin desplazamiento horizontal (medido). 44 elementos pequeños para el Administrador (el calendario de días y los interruptores de cada día). Importancia: media (sin confirmar).

### Reportes
- **Celular:** los filtros ocupan toda la primera pantalla (período, motivo, origen, visita y profesional), con listas nativas. La barra de pestañas («Resumen · Citas · Clínico · Ventas · Laboratorios») **se corta**: «Laboratorios» queda como «Labo» y no se ve que se puede desplazar. Los gráficos y las tablas de cada pestaña: **por ver**. Importancia: media.
- **Tablet:** menos elementos pequeños (30 contra 43); sin cortes en lo visto.

### Soporte
- Sin desplazamiento horizontal (medido); pocos elementos pequeños (8). La conversación, «Nueva consulta» y las capturas adjuntas en celular: **por ver**. Importancia: baja (sin confirmar).

### Usuarios y permisos (solo Administrador)
- Sin desplazamiento horizontal (medido). 70 textos pequeños (la matriz de permisos). La matriz de permisos por rol en celular: **por ver**; es una pantalla ancha por naturaleza. Importancia: media (sin confirmar).

### Configuración (solo Administrador)
- Sin desplazamiento horizontal (medido). Las pestañas de Configuración y los formularios de dirección, teléfono y vigencia en celular: **por ver**. Importancia: baja (sin confirmar).

## Superadmin

### Inicio
- **Celular:** se ve bien: franja de estado, «Requiere tu atención», «Uso de la óptica» y «Actividad» se apilan; los atajos ocupan tres filas. «Entrar a la óptica» está desactivado con su motivo. Importancia: baja.

### La óptica, Soporte, Actividad, Superadmins
- Sin desplazamiento horizontal en los tres tamaños (medido). La tabla de actividad, el detalle de un módulo y la conversación de Soporte en celular: **por ver**. Importancia: media (sin confirmar).
- Hallazgo 1 aplica también aquí: por debajo de 950 px el panel está bloqueado por la guarda.

## Páginas públicas

| Pantalla | Celular (390) | Tablet (768) | Laptop |
|---|---|---|---|
| Página de la óptica | Sin desplazamiento horizontal; 7 botones o enlaces de menos de 44 px (barra y pie) | Igual | Igual |
| Ventana de inicio de sesión | Cabe; campos de 48 px; 8 elementos pequeños (cerrar, mostrar contraseña, enlaces del pie) | Igual | Igual |
| Reserva de cita sin cuenta | Sin desplazamiento horizontal, pero **27 a 30 textos de menos de 14 px** (selector de fecha y hora con los mismos tamaños del personal) | Igual | Igual |
| Página de venta del sistema | Sin desplazamiento horizontal; 3 a 6 elementos pequeños | Igual | Igual |
| Política de privacidad y Términos | Sin desplazamiento horizontal | Igual | Igual |

- **Reserva de cita sin cuenta (media):** es la puerta de entrada de un paciente nuevo desde el celular y usa letra de 12–13 px y botones pequeños; el portal v2 ya usa 16 px y 48 px, la reserva no.
- Las demás páginas públicas: baja.

## Orden propuesto para corregir
1. Guarda de tamaño (hallazgo 1): decidir qué hace con el personal por debajo de 950 px.
2. Citas y Ventas en celular (barras cortadas, «Nueva venta» fuera de pantalla).
3. Reserva de cita sin cuenta (16 px y 48 px, como el portal).
4. Pestañas de Reportes y filtros de Pacientes.
5. Tamaño de toque (44 px) de los controles del personal.
6. Ver a ojo y medir con ventanas abiertas lo que quedó «por ver» (todas las ventanas de cada módulo, la tabla de Pacientes, el perfil 360°, Inventario, CRM, Mi horario, Usuarios, Configuración y Soporte en celular).
