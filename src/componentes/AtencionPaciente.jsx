"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Stethoscope, Printer, ClipboardList, Eye, ShieldAlert, Sparkles, IdCard, Pencil } from "lucide-react"
import { INK, GOLD } from "@/lib/tema"
import { fechaLegible, formatoFecha } from "../utilidades/formatoFecha"
import { edadEnAnios } from "../utilidades/edad"
import { textoDiagnostico } from "../utilidades/pasesVenta"
import { useModalAccesible } from "../utilidades/useModalAccesible"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

const BADGE_ESTADO_CITA = {
  "En Atención": "border-blue-200/60 bg-blue-50 text-blue-700",
  Atendida: "border-emerald-200/60 bg-emerald-50 text-emerald-700",
  "No Asistió": "border-red-200/60 bg-red-50 text-red-700",
  Cancelada: "border-slate-200/60 bg-slate-100 text-slate-500",
}
const ETIQUETA_ESTADO_CITA = { "En Atención": "En atención", "No Asistió": "No asistió" }

// Mensaje cuando un cuadro o una lista no tiene información: ícono suave, título y una línea que explica qué hacer o qué esperar.
export function SinInformacion({ Icono = Sparkles, titulo, texto, children }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-7 text-center">
      <div className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-cyan-50 to-blue-100 text-blue-600"><Icono size={24} aria-hidden="true" /></div>
      <p className="text-sm font-bold" style={{ color: INK }}>{titulo}</p>
      {texto && <p className="max-w-sm text-xs text-slate-500">{texto}</p>}
      {children}
    </div>
  )
}

// Ventana del sistema: cabecera blanca con el ícono de marca, igual que el detalle de la cita.
function Cascaron({ titulo, subtitulo, derecha, onCerrar, ancho = "max-w-3xl", children, pie, Icono = Stethoscope, capa = "z-50" }) {
  const refModal = useModalAccesible(true, onCerrar)
  return createPortal(
    <div className={"fixed inset-0 flex items-center justify-center p-4 backdrop-blur-sm " + capa} style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={onCerrar}>
      <div ref={refModal} role="dialog" aria-modal="true" aria-label={titulo} className={"flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl " + ancho} style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: GRAD }}><Icono size={21} aria-hidden="true" /></div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight" style={{ color: INK }}>{titulo}</h2>
              <p className="truncate text-xs text-slate-500">{subtitulo}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {derecha}
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><X size={20} /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">{pie}</div>
      </div>
    </div>,
    document.body,
  )
}

const BotonCerrar = ({ onCerrar }) => (
  <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
)

function Dato({ etiqueta, children, vacio }) {
  return (
    <div className="mt-3 first:mt-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{etiqueta}</dt>
      <dd className={"mt-0.5 text-sm break-words " + (vacio ? "text-slate-400" : "font-semibold")} style={vacio ? undefined : { color: INK }}>{children}</dd>
    </div>
  )
}

function Columna({ titulo, children }) {
  return (
    <section>
      <h3 className="mb-2 border-b border-slate-200/60 pb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">{titulo}</h3>
      <dl>{children}</dl>
    </section>
  )
}

const sinDato = (t) => { const x = String(t || "").trim().toLowerCase(); return !x || ["no", "sin", "n/a", "na", "-", "—"].includes(x) || x.startsWith("ningun") || x.startsWith("no ") || x.startsWith("sin ") }

// ─── Historia clínica: los datos permanentes que se piden al principio, en solo lectura ───
// Hoy viven dentro de cada ficha y se copian a la siguiente, así que se muestran los de la ficha más reciente que los tenga.
// El único color es el de la alergia: avisa de algo que importa; el resto sigue el estilo neutro del sistema.
export function ModalHistoriaClinica({ paciente, consultas, onCerrar }) {
  const ficha = consultas.find((c) => c.usaLentes || c.antecedentes || c.alergias || c.antecedentesFamiliares)
  const alergia = ficha && !sinDato(ficha.alergias)
  return (
    <Cascaron
      titulo="Historia clínica"
      subtitulo={paciente.nombre + " · datos permanentes, solo lectura"}
      Icono={ClipboardList}
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      pie={<><p className="text-xs text-slate-500">{ficha ? "Datos de la ficha del " + (fechaLegible(ficha.fecha) || "—") + ". Se actualizan en cada ficha clínica." : "Se registra en la primera ficha clínica."}</p><BotonCerrar onCerrar={onCerrar} /></>}
    >
      {ficha ? (
        <>
          {alergia && (
            <div role="alert" className="mx-5 mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p><span className="font-bold">Alergias:</span> {ficha.alergias}</p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-3">
            <Columna titulo="Salud visual">
              <Dato etiqueta="¿Usa lentes?" vacio={!ficha.usaLentes}>{ficha.usaLentes === "si" ? "Sí" : ficha.usaLentes === "no" ? "No" : "No registrado"}</Dato>
            </Columna>
            <Columna titulo="Antecedentes">
              <Dato etiqueta="Médicos y oculares" vacio={!ficha.antecedentes}>{ficha.antecedentes || "Ninguno registrado"}</Dato>
              {!alergia && <Dato etiqueta="Alergias" vacio={!ficha.alergias}>{ficha.alergias || "Ninguna registrada"}</Dato>}
            </Columna>
            <Columna titulo="Familiares">
              <Dato etiqueta="Antecedentes familiares" vacio={!ficha.antecedentesFamiliares}>{ficha.antecedentesFamiliares || "Ninguno registrado"}</Dato>
            </Columna>
          </div>
        </>
      ) : (
        <SinInformacion Icono={ClipboardList} titulo="Aún no hay historia clínica" texto="Se registra en la primera ficha clínica del paciente." />
      )}
    </Cascaron>
  )
}

// ─── Datos del paciente: lo que se registró al darlo de alta, con acceso a editarlo ───
export function ModalDatosPaciente({ paciente, onEditar, onCerrar }) {
  const fn = paciente.fecha_nacimiento || paciente.fechaNacimiento
  const edad = edadEnAnios(fn)
  const real = (t) => (t && !/^sin /i.test(t) ? t : null)
  return (
    <Cascaron
      titulo="Datos del paciente"
      subtitulo={paciente.nombre}
      Icono={IdCard}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
      pie={<>
        {onEditar ? <button type="button" onClick={onEditar} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"><Pencil size={14} aria-hidden="true" /> Editar</button> : <span />}
        <BotonCerrar onCerrar={onCerrar} />
      </>}
    >
      <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-3">
        <Columna titulo="Identificación">
          <Dato etiqueta="Cédula" vacio={!paciente.cedula}>{paciente.cedula || "Sin registrar"}</Dato>
          <Dato etiqueta="Fecha de nacimiento" vacio={!fn}>{fn ? fechaLegible(fn) : "Sin registrar"}</Dato>
          <Dato etiqueta="Edad" vacio={edad == null}>{edad != null ? `${edad} año${edad === 1 ? "" : "s"}` : "Sin registrar"}</Dato>
        </Columna>
        <Columna titulo="Contacto">
          <Dato etiqueta="Teléfono" vacio={!real(paciente.telefono)}>{real(paciente.telefono) || "Sin registrar"}</Dato>
          <Dato etiqueta="Correo" vacio={!real(paciente.correo)}>{real(paciente.correo) || "Sin registrar"}</Dato>
        </Columna>
        <Columna titulo="Expediente">
          <Dato etiqueta="Registrado el" vacio={!paciente.fechaRegistro}>{fechaLegible(paciente.fechaRegistro) || "—"}</Dato>
          {paciente.referidoPor && <Dato etiqueta="Referido por">{paciente.referidoPor}</Dato>}
          <Dato etiqueta="Cuenta del portal">{paciente.tieneCuenta ? "Activa" : "Sin cuenta"}</Dato>
        </Columna>
      </div>
    </Cascaron>
  )
}

// ─── Atención de un día, en solo lectura, con su receta imprimible ───
const textoMedida = (o) => (o?.esfera || o?.cilindro || o?.eje ? `${o?.esfera || "—"} ${o?.cilindro || ""} x${o?.eje || "—"}°` : "No registrada")

function Seccion({ titulo, children }) {
  return (
    <section className="border-b border-slate-100 px-5 py-4 last:border-b-0">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">{titulo}</h3>
      {children}
    </section>
  )
}

// Todo lo que se registró ese día. Lo usan la ventana de la atención y el despliegue de "Última consulta" en el Resumen.
export function DetalleAtencion({ consulta, adjuntos, compacto = false }) {
  const ex = consulta.examen || {}
  const bio = ex.biomicroscopia || {}
  const hayExamen = ex.testMotor || ex.oftalmoscopia || (ex.testColor && ex.testColor !== "Normal") || ex.pioOd || ex.pioOi || (ex.coverTestLejos && ex.coverTestLejos !== "Ortoforia") || (ex.coverTestCerca && ex.coverTestCerca !== "Ortoforia") || bio.parpados || bio.cornea || bio.camara || consulta.retinoscopia?.od || consulta.retinoscopia?.oi || consulta.imagenes?.length > 0
  const ojo = (nombre, color, o) => (
    <tr className="border-t border-slate-100">
      <td className="px-2 py-1.5 font-bold" style={{ color }}>{nombre}</td>
      <td className="px-2 py-1.5">{o?.esfera || "—"}</td><td className="px-2 py-1.5">{o?.cilindro || "—"}</td><td className="px-2 py-1.5">{o?.eje ? o.eje + "°" : "—"}</td>
      <td className="px-2 py-1.5">{o?.avSc || "—"}</td><td className="px-2 py-1.5">{o?.avCc || "—"}</td>
    </tr>
  )
  return (
    <div className={compacto ? "rounded-xl border border-slate-200/60 bg-white" : ""}>
      <Seccion titulo="Diagnóstico">
        <p className="flex items-center gap-2 text-base font-bold" style={{ color: INK }}><Stethoscope size={16} className="shrink-0 text-blue-600" aria-hidden="true" />{textoDiagnostico(consulta) || "Sin diagnóstico registrado"}</p>
        {consulta.motivo && <p className="mt-1 text-sm text-slate-600">Motivo: {consulta.motivo}</p>}
      </Seccion>
      <Seccion titulo="Refracción y agudeza visual">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] border-collapse font-mono text-sm">
            <thead><tr className="text-left text-[10px] uppercase text-slate-400"><th className="px-2 py-1" /><th className="px-2 py-1">Esfera</th><th className="px-2 py-1">Cilindro</th><th className="px-2 py-1">Eje</th><th className="px-2 py-1">AV s/c</th><th className="px-2 py-1">AV c/c</th></tr></thead>
            <tbody>{ojo("OD", "#1d4ed8", consulta.od)}{ojo("OI", "#0891b2", consulta.oi)}</tbody>
          </table>
        </div>
      </Seccion>
      {(consulta.indicaciones || consulta.lenteRecomendado || consulta.productoNombre) && (
        <Seccion titulo="Indicaciones y lente recomendado">
          {consulta.indicaciones && <p className="flex items-start gap-2 text-sm text-slate-700"><ClipboardList size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />{consulta.indicaciones}</p>}
          {consulta.lenteRecomendado && <p className="mt-1.5 flex items-start gap-2 text-sm text-slate-700"><Eye size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />Lente recomendado: <span className="font-semibold">{consulta.lenteRecomendado}</span></p>}
          {consulta.productoNombre && <p className="mt-1.5 text-xs text-blue-700">Vinculado a bodega: <span className="font-semibold">{consulta.productoNombre}</span></p>}
        </Seccion>
      )}
      {hayExamen && (
        <Seccion titulo="Examen, biomicroscopía, retinoscopía e imágenes">
          <div className="space-y-1 text-sm text-slate-600">
            {ex.testMotor && <p><span className="font-semibold text-slate-700">Motilidad ocular:</span> {ex.testMotor}</p>}
            {((ex.coverTestLejos && ex.coverTestLejos !== "Ortoforia") || (ex.coverTestCerca && ex.coverTestCerca !== "Ortoforia")) && <p><span className="font-semibold text-slate-700">Cover test:</span> lejos {ex.coverTestLejos || "—"} · cerca {ex.coverTestCerca || "—"}</p>}
            {ex.oftalmoscopia && <p><span className="font-semibold text-slate-700">Oftalmoscopia:</span> {ex.oftalmoscopia}</p>}
            {ex.testColor && ex.testColor !== "Normal" && <p><span className="font-semibold text-slate-700">Test de color:</span> {ex.testColor}</p>}
            {(ex.pioOd || ex.pioOi) && <p><span className="font-semibold text-slate-700">PIO:</span> OD {ex.pioOd || "—"} · OI {ex.pioOi || "—"} mmHg</p>}
            {bio.parpados && <p><span className="font-semibold text-slate-700">Párpados/conjuntiva:</span> {bio.parpados}</p>}
            {bio.cornea && <p><span className="font-semibold text-slate-700">Córnea:</span> {bio.cornea}</p>}
            {bio.camara && <p><span className="font-semibold text-slate-700">Cámara anterior/cristalino:</span> {bio.camara}</p>}
            {(consulta.retinoscopia?.od || consulta.retinoscopia?.oi) && <p><span className="font-semibold text-slate-700">Retinoscopía:</span> OD {consulta.retinoscopia?.od || "—"} · OI {consulta.retinoscopia?.oi || "—"}</p>}
          </div>
          {adjuntos}
        </Seccion>
      )}
    </div>
  )
}

function Receta({ consulta, paciente, usuario }) {
  const marca = usuario?.opticaMarca
  const numero = "RX-" + String(consulta.fecha || "").replace(/-/g, "") + "-" + String(consulta.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase()
  const fila = (etiqueta, valor) => valor ? <p style={{ margin: "0 0 4px" }}><b>{etiqueta}:</b> {valor}</p> : null
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: INK, padding: "32px 40px", maxWidth: 780, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24, borderBottom: `3px solid ${GOLD}`, paddingBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 24 }}>{usuario?.opticaNombre || "Tu óptica"}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>{[marca?.direccion, marca?.telefono, marca?.correo].filter(Boolean).join(" · ")}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: GOLD }}>Receta óptica</p>
          <p style={{ margin: "4px 0 0", fontFamily: "monospace", fontSize: 12 }}>N.º {numero}</p>
          <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{formatoFecha(consulta.fecha, "largoSinDia") || consulta.fecha}</p>
        </div>
      </div>
      <div style={{ margin: "18px 0", padding: "12px 16px", background: "#f8fafc", borderRadius: 10, display: "flex", gap: 32, flexWrap: "wrap", fontSize: 13 }}>
        <span><b>Paciente:</b> {paciente?.nombre || consulta.paciente || "—"}</span>
        {paciente?.cedula && <span><b>Cédula:</b> {paciente.cedula}</span>}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
        {fila("Diagnóstico", textoDiagnostico(consulta))}
        {fila("Lente recomendado", consulta.lenteRecomendado)}
        {fila("Indicaciones y cuidados", consulta.indicaciones)}
      </div>
      <div style={{ margin: "18px 0", padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: 10, display: "flex", gap: 40, fontSize: 14 }}>
        <span><b>OD (derecho):</b> {textoMedida(consulta.od)}</span>
        <span><b>OI (izquierdo):</b> {textoMedida(consulta.oi)}</span>
      </div>
      {consulta.profesionalNombre && <p style={{ marginTop: 40, fontSize: 12, color: "#475569" }}>{consulta.profesionalNombre}{consulta.profesionalRegistro ? ` · Reg. ${consulta.profesionalRegistro}` : ""}</p>}
    </div>
  )
}

export function ModalAtencion({ cita, consulta, paciente, usuario, adjuntos, onCerrar }) {
  const [imprimiendo, setImprimiendo] = useState(false)

  // Imprime una capa pegada al <body> y oculta todo lo demás solo mientras dura la impresión.
  useEffect(() => {
    if (!imprimiendo) return undefined
    document.body.classList.add("printing-atencion")
    const limpiar = () => { document.body.classList.remove("printing-atencion"); setImprimiendo(false) }
    window.addEventListener("afterprint", limpiar, { once: true })
    const t = setTimeout(() => window.print(), 50)
    return () => { clearTimeout(t); window.removeEventListener("afterprint", limpiar); document.body.classList.remove("printing-atencion") }
  }, [imprimiendo])

  return (
    <>
      <Cascaron
        titulo={"Atención del " + (fechaLegible(consulta.fecha) || "—")}
        subtitulo={[cita?.hora && cita.hora !== "Sin cita" ? cita.hora : "Sin cita", consulta.motivo, consulta.profesionalNombre].filter(Boolean).join(" · ")}
        derecha={<span className={"rounded-full border px-2.5 py-0.5 text-xs font-semibold " + (BADGE_ESTADO_CITA[cita?.estado] || "border-emerald-200/60 bg-emerald-50 text-emerald-700")}>{ETIQUETA_ESTADO_CITA[cita?.estado] || cita?.estado || "Atendida"}</span>}
        onCerrar={onCerrar}
        pie={<>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setImprimiendo(true)} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"><Printer size={15} aria-hidden="true" /> Imprimir receta</button>
          </div>
          <BotonCerrar onCerrar={onCerrar} />
        </>}
      >
        <DetalleAtencion consulta={consulta} adjuntos={adjuntos} />
      </Cascaron>
      {imprimiendo && createPortal(
        <div id="print-atencion">
          <style>{`#print-atencion{display:none}@media print{body.printing-atencion>*:not(#print-atencion){display:none!important}body.printing-atencion #print-atencion{display:block!important}}`}</style>
          <Receta consulta={consulta} paciente={paciente} usuario={usuario} />
        </div>,
        document.body,
      )}
    </>
  )
}
