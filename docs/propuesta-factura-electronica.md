# Propuesta: guardar y entregar la factura electrónica que la óptica emite por fuera

**Estado: propuesta, sin implementar ni aplicar nada.** Maqueta en `docs/maquetas/factura-electronica.html` (se abre en el navegador).

## Lo que el sistema hace y lo que no
- **No emite** facturas electrónicas. Eso queda como trabajo futuro (integración con un proveedor de facturación electrónica; anotado en `docs/estado-actual.md`).
- **Sí guarda y entrega** la que la óptica emite por fuera: el XML firmado y autorizado por el SRI y su RIDE (el PDF). Ambos se conservan 7 años.

## 1. Registrar la factura electrónica de un comprobante
Hoy solo se guarda el número (`facturas_venta.factura_electronica`, que se queda). La ventana "Factura electrónica (SRI)" pasa a pedir:

| Campo | Regla |
|---|---|
| Número | como hoy (`001-001-000000123`, único por óptica entre ventas vigentes) |
| Clave de acceso | 49 dígitos; se valida el formato y el dígito verificador (módulo 11). Además se cruza con el número: la serie (posiciones 25–30) y el secuencial (31–39) de la clave deben ser los del número, y el tipo de comprobante debe ser `01` (factura) |
| Fecha de autorización | no puede ser futura ni anterior a la venta |
| RIDE (PDF) | obligatorio para entregarla; máx. 5 MB, solo PDF |
| XML | máx. 2 MB, solo XML; se comprueba que sea un XML bien formado y que contenga la misma clave de acceso |

Se puede registrar solo el número (como hoy) y adjuntar los archivos después. Corregir o reemplazar un archivo conserva el anterior (nunca se borra: son documentos que se guardan 7 años) y queda en la actividad.

## 2. Dónde se ve y qué se puede hacer
- **Detalle del comprobante y "Productos y servicios" del perfil:** bloque "Factura electrónica" con número, clave, fecha de autorización y los botones **Descargar PDF**, **Descargar XML** y **Enviar al paciente**.
- **Comprobante interno impreso:** muestra el número y la clave de acceso si están registrados.
- **Portal del paciente:** nueva sección **Mis compras**: sus comprobantes (fecha, total, estado, saldo) y, en cada uno que la tenga, **Descargar factura (PDF)** y **(XML)**. Solo ve lo suyo.
- **Quién:** ver y descargar con Ventas "ver"; registrar, reemplazar y enviar con Ventas "editar" (cada óptica lo ajusta desde sus roles).

## 3. Enviar al paciente
- **WhatsApp (desde ya):** abre WhatsApp con un mensaje y un **enlace seguro**. El enlace lleva un código aleatorio (no adivinable), vence a los **7 días** (ajustable), se puede revocar y registra cada uso. El enlace no apunta al archivo: pasa por una función del servidor que lo valida y entrega el archivo con una URL firmada de pocos minutos.
- **Correo (cuando exista el dominio propio en Resend):** una Edge Function envía el correo con el PDF y el XML adjuntos. Mientras no haya dominio, el botón aparece desactivado y dice "Disponible cuando la óptica tenga su dominio de correo configurado". Si el paciente no tiene correo, lo dice y ofrece WhatsApp.
- **Impresa:** el botón "Imprimir RIDE" abre el PDF para imprimirlo (cuando el cliente no la recibe por correo, la ley pide entregar el RIDE impreso).

## 4. Actividad
Cada registro, reemplazo, descarga, envío (WhatsApp o correo) y descarga hecha por el paciente queda en la actividad, con quién, cuándo y de qué comprobante: *"Vera Ventas descargó el PDF de la factura electrónica de Rosa Bravo · CV-0017"*. Las descargas del paciente se registran en el servidor (el paciente no escribe en la actividad).

## 5. Base de datos y almacenamiento (para aprobar antes de aplicar)

### Tabla `facturas_electronicas` (una por comprobante)
```sql
create table public.facturas_electronicas (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  factura_id uuid not null unique references public.facturas_venta(id) on delete cascade,
  clave_acceso text check (clave_acceso ~ '^[0-9]{49}$'),
  autorizada_el date,
  pdf_ruta text,  pdf_bytes integer,
  xml_ruta text,  xml_bytes integer,
  registrada_por uuid references public.perfiles(id) on delete set null,
  registrada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
create unique index on public.facturas_electronicas (optica_id, clave_acceso) where clave_acceso is not null;
-- RLS: lectura con Ventas "ver" de la misma óptica (y óptica activa, MFA); sin escritura directa: solo por funciones.
```
Funciones (`security definer`, validan permiso y óptica): `registrar_factura_electronica_datos(factura, clave, autorizada_el, pdf_ruta, xml_ruta)` (Ventas "editar"; valida la clave y su dígito verificador **en el servidor**), `crear_enlace_descarga(factura, tipo, dias)`, `revocar_enlace_descarga(id)`, `mis_compras_paciente(token)` (devuelve solo lo del paciente, sin campos internos: regla 36).

### Tabla `facturas_electronicas_versiones`
Cada archivo reemplazado conserva su ruta, quién lo reemplazó, cuándo y por qué (retención de 7 años).

### Tabla `enlaces_descarga`
`token` (hash, nunca el valor en claro), `factura_id`, `tipo` (pdf/xml), `expira_en`, `revocado_en`, `usos`, `creado_por`. Sin lectura directa para nadie; la lee la función del servidor que entrega el archivo.

### Tabla `facturas_electronicas_eventos`
`factura_id`, `accion` (`registro`, `reemplazo`, `descarga_pdf`, `descarga_xml`, `envio_whatsapp`, `envio_correo`, `descarga_paciente`), `actor` (persona o paciente), `creado_en`. Se escribe solo desde funciones.

### Almacenamiento (Storage)
- Bucket **privado** `facturas-electronicas` (no público), tipos permitidos `application/pdf` y `application/xml` / `text/xml`, 5 MB por archivo.
- Ruta: `{optica_id}/{factura_id}/ride-{versión}.pdf` y `factura-{versión}.xml`.
- Políticas de `storage.objects` para ese bucket: **select** si la primera carpeta es la óptica de quien pregunta, está activa y tiene Ventas "ver"; **insert** si además tiene Ventas "editar"; **sin update ni delete** para nadie (los documentos no se borran ni se sobrescriben: un reemplazo es un archivo nuevo). El paciente no tiene acceso directo: baja los archivos solo por la función del servidor.

### Edge Functions
`entregar-factura` (valida el código del enlace o la sesión del paciente y redirige a una URL firmada de 5 minutos, registrando el evento) y `enviar-factura-correo` (Resend, con adjuntos; apagada hasta tener dominio).

## 6. Pruebas previstas
Clave de acceso (formato, dígito verificador, cruce con el número, ejemplos reales del SRI); permisos por rol; un paciente no puede ver la factura de otro; el enlace vence y se revoca; nadie lee el bucket sin sesión; cada descarga y envío deja su evento; Playwright de "registrar → descargar → enviar → ver en Mis compras".

## 7. Preguntas para Diego
1. ¿Vence a los **7 días** el enlace de WhatsApp? ¿Se permite alargarlo desde el botón?
2. ¿Registrar y reemplazar con Ventas "editar", y descargar con "ver"? (propuesto)
3. ¿Mis compras muestra también los comprobantes **con saldo** y sus abonos, o solo lo pagado? (propuesto: todo, con el saldo a la vista)
4. ¿El paciente puede descargar el XML o solo el PDF? (propuesto: ambos, como pide el SRI)
5. ¿Quién configura el dominio de Resend y cuándo? Hasta entonces el correo queda apagado.
