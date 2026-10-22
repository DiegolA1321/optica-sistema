# Avisos de «Requiere tu atención»: acción y destino (Ronda 2c)

Criterio: la **acción** de cada aviso es lo que se hace para resolverlo; **«Ver en [módulo]»** lleva al módulo del área (con su filtro cuando el área tiene un solo tipo de aviso, y el enlace «Abrir en…» de la ventana lleva siempre al filtro exacto del aviso).

| Área | Aviso (leyenda) | Acción(es) | Destino del enlace «Abrir en…» | Descartable |
|---|---|---|---|---|
| Citas | atención abierta (rojo) | Seguir atendiendo | Citas · En atención | No |
| Citas | control sin agendar | Agendar (abre «Gestionar cita» con el paciente y el motivo de control) | Pacientes · Control sin agendar | Sí |
| Citas | cita por reasignar | Reasignar | Citas | No |
| Citas | por contactar | Reagendar · WhatsApp · Descartar | Citas · Contactar al paciente | Sí |
| Pacientes | pide eliminar su cuenta (rojo) | Ver paciente | Pacientes | No |
| Pacientes | **control vencido** | **Agendar control** (paciente y motivo de control ya elegidos) · **WhatsApp** (mensaje ya redactado) · **Descartar** | **Pacientes · Control vencido** (antes: CRM) | Sí |
| Pacientes | cambió su contacto (azul) | Visto | Pacientes | No |
| Pacientes | pide sus medidas (azul) | Responder | Pacientes | No |
| Pacientes | sin consulta (azul) | Ver paciente | Pacientes · Sin evaluación | Sí |
| Pacientes | cumpleaños cercano (azul) | Saludar | CRM · Cumpleaños | No |
| Ventas | pago por verificar | Revisar | Ventas · Pagos por verificar | No |
| Ventas | pide lentes (portal) | Atender | Ventas · Desde el portal | Sí |
| Ventas | espera su venta (+30 días) | Ver la cola | Ventas · Más de 30 días | No |
| Ventas | lentes sin avisar | Avisar | Ventas · Listas sin avisar | No |
| Ventas | orden atrasada (rojo) | Ver | Ventas · Órdenes atrasadas | No |
| Ventas | venta con saldo | Ver saldos | Ventas · Saldos por cobrar | No |
| Inventario | con stock bajo | Reabastecer | Inventario · Stock bajo | Sí |

**Quitado:** «Paciente de la web con los datos sin verificar» y su acción «Verificar datos (registro web)» (Inicio, Pacientes, detalle de la cita y el paso previo a atender). Lo reemplazan dos controles automáticos que ya estaban activos en el registro web: cédula con el dígito verificador oficial de Ecuador (se avisa en el momento y no deja continuar; igual al crear o editar un paciente) y asociación a la cédula existente en la óptica (`crear_cita_publica` reutiliza el paciente, sin duplicar). Sin cambios de base de datos.

**Color:** el punto de cada fila — rojo urgente, ámbar pendiente, azul informativo; el número va en rojo solo si es urgente.
