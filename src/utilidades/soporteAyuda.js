// Preguntas frecuentes de la pestaña Ayuda, por módulo. Escritas a partir de cómo funciona el sistema hoy (docs/estado-actual.md y las pantallas),
// cortas y con los nombres exactos de los botones. Si una pantalla cambia un nombre o un paso, se cambia aquí.
// "modulo" usa los mismos identificadores que las consultas (MODULOS_SOPORTE).

export const AYUDA_POR_MODULO = [
  {
    modulo: "citas", nombre: "Citas",
    preguntas: [
      { p: "¿Cómo agendo una cita?", r: "En Citas médicas, pulsa «Gestionar cita». Elige al paciente (o «Añadir nuevo paciente»), el motivo y un horario libre; los horarios ocupados salen tachados. Si el paciente ya está en el local, marca «Atender ahora»." },
      { p: "¿Qué significa cada estado de una cita?", r: "Pendiente (naranja): agendada. En espera (violeta): el paciente llegó. En atención (azul): se abrió su ficha. Atendida (verde): la ficha se guardó. No efectuada (rojo) y Cancelada (gris) cierran la cita sin atención." },
      { p: "Llegó un paciente, ¿qué hago?", r: "Abre la cita y pulsa «Llegó»: pasa a «En espera» y el optómetra la ve en su Inicio. Para atenderla, «Atender» abre directo la ficha clínica y la cita pasa sola a «En atención»." },
      { p: "¿Por qué una cita se marcó «No efectuada» sola?", r: "Una cita Pendiente que nadie abrió pasa a «No efectuada» cuando termina su horario (hora de inicio más la duración), con el motivo «El paciente no asistió». Una atención que se inició y no se terminó pasa a «No efectuada» al cerrar la jornada del día y conserva el borrador de la ficha. Las citas «En espera» o «En atención» no cambian solas durante su horario. Solo el administrador puede corregir el estado después, con «Corregir estado (excepción)»." },
      { p: "¿Cómo cancelo o cambio una cita?", r: "Abre la cita y usa «Editar» para cambiar fecha u hora, o «Cancelar». Una cita cancelada no se borra: queda como Cancelada (se ve con el filtro Estado: Canceladas) y, si el paciente la canceló, aparece en «Contactar al paciente». Al cancelar se pide el motivo." },
      { p: "No me deja agendar en un día, ¿por qué?", r: "El día puede estar cerrado (feriado u otro motivo) o no tener horarios libres. Quien tiene permiso de editar el horario de la óptica puede abrirlo con «Abrir este día» desde las citas del día." },
    ],
  },
  {
    modulo: "pacientes", nombre: "Pacientes",
    preguntas: [
      { p: "¿Cómo registro un paciente?", r: "En Pacientes, pulsa «Crear paciente» y completa nombre, cédula y teléfono. La cédula no se puede repetir: si ya existe, el sistema avisa en lugar de crear un duplicado." },
      { p: "¿Qué son «Recordatorios de salud» y «Promociones y saludos»?", r: "Son los dos permisos del paciente para recibir mensajes. Los recordatorios (control, citas, seguimiento de la compra) vienen marcados; las promociones y el saludo de cumpleaños, no: solo se activan si el paciente los acepta. Se cambian desde «Datos» en su perfil." },
      { p: "¿Dónde abro la ficha clínica?", r: "Toda atención pasa por una cita: usa «Atender» en la cita o «Atender ahora» si el paciente ya está en el local. Lo ya atendido está en «Historia clínica» del perfil, con «Ver atención» y la receta imprimible." },
      { p: "¿Cómo corrijo los datos de un paciente?", r: "Abre su perfil, pulsa «Datos» y luego «Editar». Los cambios también se aplican a sus citas." },
      { p: "¿Qué hace «Eliminar paciente»?", r: "No borra la historia: anonimiza al paciente (quita su nombre, cédula, teléfono y correo) y conserva los registros clínicos y de ventas sin identificarlo. Solo lo hace quien tiene el permiso de eliminar en Pacientes." },
    ],
  },
  {
    modulo: "ventas", nombre: "Ventas",
    preguntas: [
      { p: "¿Cómo hago una venta?", r: "Pulsa «Nueva venta» y elige al paciente: si ya tiene un diagnóstico, «Usar como guía» lleva el tipo de luna y sus filtros a la venta. Agrega las líneas (montura, lunas, servicios), escribe cuánto paga hoy y con qué (puedes dividir el pago) y confirma. Lo que no pague hoy queda como saldo. Si hay lunas, se crea el pedido de lentes con su laboratorio." },
      { p: "¿Qué hay en cada pestaña de Ventas?", r: "Ventas: lo vendido, lo cobrado, lo que falta por cobrar, los pagos por verificar y los pedidos en proceso (cada dato filtra la lista). Pedidos: lo que se encarga afuera (las lunas), con su entrega (retira en la óptica o envío a domicilio) y la fecha aproximada en que estará listo; pasa de En proceso a Listo y a Entregado, y aparece Atrasado si pasa la fecha sin estar listo. Los pacientes que recibieron su diagnóstico y no han comprado están en «Para contactar» del CRM." },
      { p: "¿Cómo registro, corrijo o anulo un abono?", r: "Abre la venta y pulsa «Registrar abono». Para corregirlo o anularlo se pide un motivo; un abono anulado no se borra: queda marcado, con quién lo anuló, y deja de contar." },
      { p: "¿Cómo guardo la factura electrónica?", r: "El sistema no emite la factura: guarda la que la óptica emite por fuera. En el comprobante registra la clave de acceso y sube el PDF y el XML. Después puedes descargarla, imprimir el RIDE o enviarla al paciente por WhatsApp (el enlace vence en 7 días)." },
      { p: "¿Cómo anulo una venta?", r: "Desde el detalle del comprobante, con el permiso de eliminar en Ventas. Se pide el motivo de la anulación y la venta queda anulada, sin borrarse." },
    ],
  },
  {
    modulo: "inventario", nombre: "Inventario",
    preguntas: [
      { p: "¿Cómo agrego stock o lo corrijo?", r: "Abre el producto y usa «Registrar ingreso» para lo que llega o «Ajustar stock» para corregir. Ambos piden un motivo y quedan en la pestaña Movimientos del producto, que no se puede editar." },
      { p: "¿Puedo eliminar un producto?", r: "No: todo producto tiene movimientos. Si ya no se vende, descontínualo; deja de contarse en los totales, pero conserva su historial y se puede reactivar desde los descontinuados." },
      { p: "¿Cómo hago el conteo físico?", r: "Pulsa «Conteo físico», escribe lo que cuentas en el estante sin ver el stock del sistema y revisa las diferencias antes de confirmar. Al confirmar se registran los ajustes y queda un acta que puedes imprimir o guardar en PDF." },
      { p: "¿Por qué no veo el costo ni el margen?", r: "El costo solo lo ve quien tiene permiso de editar el Inventario. Los demás ven precios y stock." },
    ],
  },
  {
    modulo: "reportes", nombre: "Reportes",
    preguntas: [
      { p: "¿Qué muestra cada pestaña?", r: "Resumen, Citas, Clínico, Ventas, Pedidos e Inventario. Todas comparten los mismos filtros (período, motivo, origen, visita y profesional) y comparan con el período anterior equivalente." },
      { p: "¿Cómo compruebo un número?", r: "Pulsa el número o la barra: se abre el detalle con las filas que lo forman. Desde ahí, «Abrir en…» te lleva al módulo con el mismo filtro." },
      { p: "¿Cómo exporto a Excel o PDF?", r: "Usa «Exportar» en la cabecera para elegir módulos y fechas, o el botón «Exportar» de cada bloque y de cada ventana de detalle. Los datos personales exportados quedan en la actividad de la óptica." },
      { p: "¿Por qué mis reportes muestran menos que los de otra persona?", r: "Si tu rol tiene alcance «propio», Reportes se calcula solo con tus citas y fichas. Los montos de ventas solo se ven con permiso de Ventas." },
    ],
  },
  {
    modulo: "crm", nombre: "CRM",
    preguntas: [
      { p: "¿A quién contacto hoy?", r: "En «Para contactar» está la lista del día: control vencido o próximo, cumpleaños, seguimiento de la compra y quienes llevan más de un año sin venir. «Contactar» abre WhatsApp con el mensaje ya escrito." },
      { p: "¿Qué hago después de contactar?", r: "Pulsa «Registrar resultado»: Agendó cita, No respondió, Volver a contactar, No le interesa o No desea recibir mensajes. Según lo que pasó, el paciente descansa unos días de la lista, y todo queda anotado en «Seguimiento»." },
      { p: "¿Por qué un paciente no aparece o no puedo escribirle?", r: "Solo se escribe a quien aceptó ese tipo de mensaje: los recordatorios de salud para el control y el seguimiento, y «Promociones y saludos» para cumpleaños y campañas." },
      { p: "¿Cómo hago una campaña?", r: "En «Campañas», pulsa «Nueva campaña», elige el grupo, revisa el mensaje y créala. El sistema no envía nada solo: tú envías cada mensaje por WhatsApp y cada envío queda en Seguimiento." },
      { p: "¿Cómo cambio el texto de los mensajes?", r: "En «CRM y fidelización» abre la pestaña «Plantillas»: elige el motivo, edita el mensaje y usa los datos automáticos ({nombre}, {optica}, {fecha_cita}…): se insertan donde tienes el cursor. La vista previa muestra cómo queda con un paciente de ejemplo." },
    ],
  },
  {
    modulo: "horario", nombre: "Mi horario",
    preguntas: [
      { p: "¿Cuál es la diferencia entre «Horario de la óptica» y «Mi horario»?", r: "El de la óptica es el horario general (días y horas que se atiende). «Mi horario» es el tuyo: lo asigna la administración (por defecto es el de la óptica), y ahí ves tus ausencias y puedes pedir una. Si necesitas un cambio de horario, escríbele a la administración desde Soporte." },
      { p: "¿Cómo pido una ausencia?", r: "En «Mi horario», pulsa «Solicitar ausencia»: elige el tipo (cita médica, vacaciones, permiso personal, calamidad u otro), el día o los días, si es todo el día, la mañana o la tarde, y si quieres el motivo y un documento de respaldo (PDF o foto, hasta 5 MB; solo lo ve la administración). La administración la aprueba o la rechaza y te avisa. Al aprobarla, ese tiempo se bloquea en tu agenda y en la web." },
      { p: "¿Cómo asigno el horario de una persona?", r: "Solo el administrador: en «Horario», pestaña «Horarios del personal», elige a la persona, activa o apaga su mañana y su tarde de cada día (debe quedar dentro del horario de la óptica) y pulsa «Guardar horario». También puedes copiarlo a otras personas o volver al horario de la óptica. Las citas que queden fuera se avisan antes de guardar." },
      { p: "¿Cómo cierro un feriado?", r: "En Citas, abre el día y usa «Cerrar este día» (con nombre opcional). No se puede cerrar un día que tiene citas por atender: primero reagéndalas o cancélalas. Requiere permiso de editar el horario de la óptica." },
    ],
  },
  {
    modulo: "usuarios", nombre: "Usuarios y permisos",
    preguntas: [
      { p: "¿Cómo creo un usuario?", r: "En «Usuarios y permisos», pestaña Usuarios, pulsa «Crear usuario» y elige uno o más roles. Los roles predefinidos son Optómetra, Recepción y Ventas." },
      { p: "¿Cómo armo un rol propio?", r: "En la pestaña Roles, crea uno y elige para cada módulo qué puede hacer: Ver, Crear, Editar o Eliminar. Cada nivel incluye «Ver». Si alguien tiene varios roles, se suman sus permisos." },
      { p: "¿Qué pasa si desactivo a alguien?", r: "Pierde el acceso de inmediato, aunque tenga la sesión abierta. Su historial se conserva y se puede reactivar." },
      { p: "Tengo varios roles, ¿cómo cambio de vista?", r: "En el menú de tu usuario (arriba a la derecha) elige la vista con la que quieres trabajar. Cambia el menú y el Inicio; tus permisos siguen siendo la suma de todos tus roles." },
    ],
  },
  {
    modulo: "configuracion", nombre: "Configuración",
    preguntas: [
      { p: "¿Qué puedo cambiar en Configuración?", r: "Tres secciones: «Políticas y servicios» (reglas de la óptica), «Catálogos» (motivos de consulta, diagnósticos rápidos y categorías del inventario) y «Página pública» (cómo se ve la página de ingreso y de reserva)." },
      { p: "¿Cómo agrego un motivo de consulta?", r: "En «Catálogos», agrégalo a la lista de motivos. Aparecerá al agendar una cita y en los reportes, donde se puede filtrar por motivo." },
      { p: "¿Cómo cambio lo que ve el paciente en la reserva web?", r: "En «Página pública» puedes editar el mensaje de bienvenida y los datos que se muestran. Los cambios se ven en la página de la óptica." },
    ],
  },
]

// Todas las preguntas con su módulo, para el buscador.
// El módulo de la Ayuda que corresponde a cada módulo de uso (la ficha clínica se explica dentro de Pacientes).
export const AYUDA_DE_MODULO = { citas: "citas", pacientes: "pacientes", consultas: "pacientes", ventas: "ventas", inventario: "inventario", crm: "crm", reportes: "reportes" }
// Cómo se llama cada módulo de uso (los mismos nombres del menú y del Inicio del superadmin).
export const NOMBRE_MODULO_DE_USO = { citas: "Citas médicas", pacientes: "Pacientes", consultas: "Ficha clínica", ventas: "Ventas", inventario: "Inventario", crm: "CRM y fidelización", reportes: "Reportes" }
export const nombreModuloDeUso = (id) => NOMBRE_MODULO_DE_USO[id] || id
export const moduloDeAyuda = (moduloDeUso) => AYUDA_DE_MODULO[moduloDeUso] || ""
export const TODAS_LAS_PREGUNTAS = AYUDA_POR_MODULO.flatMap((g) => g.preguntas.map((q) => ({ ...q, modulo: g.modulo, moduloNombre: g.nombre })))

const sinTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Filtra por texto (pregunta y respuesta) y, opcionalmente, por módulo. Cada palabra escrita debe aparecer.
export function buscarAyuda(texto, modulo = "") {
  const palabras = sinTildes(texto).split(/\s+/).filter(Boolean)
  return TODAS_LAS_PREGUNTAS.filter((q) => (!modulo || q.modulo === modulo) && palabras.every((w) => sinTildes(`${q.p} ${q.r} ${q.moduloNombre}`).includes(w)))
}
