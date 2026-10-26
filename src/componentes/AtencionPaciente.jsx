"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Stethoscope, Printer, ClipboardList, Eye, ShieldAlert, Sparkles, IdCard, Pencil } from "lucide-react"
import { INK, GOLD } from "@/lib/tema"
import { etiquetaEstadoCita } from "../utilidades/estadosCita"
import { fechaLegible, formatoFecha, horaSinCero } from "../utilidades/formatoFecha"
import { edadEnAnios } from "../utilidades/edad"
import { textoDiagnostico } from "../utilidades/pasesVenta"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import PermisosMensajes from "./PermisosMensajes"
import { imprimirHojaReceta } from "../utilidades/imprimirHojaReceta"
import { textoAgudeza } from "../utilidades/agudeza"
import { dioptriaTexto } from "../utilidades/refraccion"
import { datosOpticaReceta } from "../utilidades/datosReceta"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

const BADGE_ESTADO_CITA = {
  "En Atención": "border-blue-200/60 bg-blue-50 text-blue-700",
  Atendida: "border-emerald-200/60 bg-emerald-50 text-emerald-700",
  "No Asistió": "border-red-200/60 bg-red-50 text-red-700",
  Cancelada: "border-slate-200/60 bg-slate-100 text-slate-500",
}

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

// Ventana del sistema: cabecera blanca con el ícono de marca. `marca` reemplaza el ícono (la fecha del día, las iniciales del paciente); `sinAnimarFondo` evita volver a animar el fondo cuando se abre sobre otra ventana.
export function Cascaron({ titulo, subtitulo, derecha, onCerrar, ancho = "max-w-3xl", children, pie, Icono = Stethoscope, capa = "z-50", formulario = null, marca = null, sinAnimarFondo = false, etiqueta = null, pantallaCompletaEnCelular = false, hojaEnCelular = false }) {
  const Raiz = formulario ? "form" : "div"
  const refModal = useModalAccesible(true, onCerrar)
  return createPortal(
    <div data-ventana-fondo className={"fixed inset-0 flex items-center justify-center backdrop-blur-sm " + (pantallaCompletaEnCelular ? "p-0 sm:p-4 " : "p-4 ") + capa} style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: sinAnimarFondo ? "none" : "overlay-in 150ms ease-out" }} onClick={onCerrar}>
      <Raiz data-ventana {...(hojaEnCelular ? { "data-ventana-hoja": "" } : {})} ref={refModal} role="dialog" aria-modal="true" aria-label={etiqueta || titulo} {...(formulario ? { onSubmit: formulario.onSubmit, ...(formulario.noValidate ? { noValidate: true } : {}), ...(formulario.autoComplete ? { autoComplete: formulario.autoComplete } : {}) } : {})} className={"flex w-full flex-col overflow-hidden border border-slate-200/60 bg-white shadow-2xl " + (pantallaCompletaEnCelular ? "h-[100dvh] max-h-none rounded-none sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl " : "max-h-[calc(100dvh-2rem)] rounded-2xl ") + ancho} style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
        <div data-ventana-cabecera className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {marca || <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: GRAD }}><Icono size={21} aria-hidden="true" /></div>}
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight" style={{ color: INK }}>{titulo}</h2>
              <p className={pantallaCompletaEnCelular ? "text-base text-slate-600" : "text-xs text-slate-500"}>{subtitulo}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {derecha}
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className={(pantallaCompletaEnCelular ? "grid h-12 w-12 place-items-center rounded-lg " : "rounded-lg p-1.5 ") + "text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"}><X size={pantallaCompletaEnCelular ? 24 : 20} /></button>
          </div>
        </div>
        <div data-ventana-cuerpo className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {pie && <div data-ventana-pie className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">{pie}</div>}
      </Raiz>
    </div>,
    document.body,
  )
}

// Pie estándar de una ventana-formulario: nota opcional a la izquierda; a la derecha, Cancelar y la acción principal (la que hace submit).
export function PieFormulario({ onCancelar, etiquetaGuardar = "Guardar", guardando = false, deshabilitado = false, nota = null }) {
  return (
    <>
      {nota ? <span className="text-xs text-slate-500">{nota}</span> : <span />}
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={onCancelar} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cancelar</button>
        <button type="submit" disabled={guardando || deshabilitado} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>
          {guardando ? "Guardando…" : etiquetaGuardar}
        </button>
      </div>
    </>
  )
}

const BotonCerrar = ({ onCerrar }) => (
  <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
)

function Dato({ etiqueta, children, vacio }) {
  return (
    <div className="mt-3 first:mt-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{etiqueta}</dt>
      <dd className={"mt-0.5 text-sm break-words " + (vacio ? "text-slate-400" : "font-semibold")} style={vacio ? undefined : { color: INK }}>{children}</dd>
    </div>
  )
}

function Columna({ titulo, children }) {
  return (
    <section>
      <h3 className="mb-2 border-b border-slate-200/60 pb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">{titulo}</h3>
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
// permisos: { recordatorios, promociones, actualizadoPor, actualizadoEn, onCambiar } (sin onCambiar solo se muestran); sin `permisos` no hay sección.
export function ModalDatosPaciente({ paciente, onEditar, permisos = null, onCerrar }) {
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
      {permisos && (
        <section aria-label="Permisos para recibir mensajes" className="border-t border-slate-100 px-5 py-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Permisos para recibir mensajes</h3>
          <PermisosMensajes {...permisos} />
        </section>
      )}
    </Cascaron>
  )
}

// ─── Atención de un día, en solo lectura, con su receta imprimible ───
const textoMedida = (o) => (o?.esfera || o?.cilindro || o?.eje ? `${dioptriaTexto(o?.esfera) || "—"} ${dioptriaTexto(o?.cilindro)} x${o?.eje || "—"}°` : "No registrada")

// `ocultar` y `orden` (de `secciones` en DetalleAtencion) dejan elegir cuáles bloques se ven y en qué orden.
function Seccion({ titulo, children, ocultar = false, orden = 0 }) {
  if (ocultar) return null
  return (
    <section className="border-b border-slate-100 px-5 py-4 last:border-b-0" style={{ order: orden }}>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">{titulo}</h3>
      {children}
    </section>
  )
}

// Todo lo que se registró ese día. Lo usan la ventana de la atención, el despliegue de "Última consulta" en el Resumen y las fichas anteriores abiertas desde la ficha clínica. Sirve para las fichas
// de cinco pasos (con su anamnesis, las tres agudezas, adición y prisma por ojo y salud ocular por ojo) y para las anteriores, que se ven con los datos que tienen, cada uno en su lugar.
// `secciones`: cuáles bloques se ven y en qué orden (por defecto todos, en el de siempre): "diagnostico" | "anamnesis" | "agudeza" | "refraccion" | "indicaciones" | "examen".
// `refraccion`: undefined = la tabla de siempre; null = sin ese bloque; un nodo = en su lugar (el perfil pone ahí los ojos ilustrados).
export function DetalleAtencion({ consulta, adjuntos, compacto = false, secciones = null, refraccion }) {
  const sec = (k) => ({ ocultar: !!secciones && !secciones.includes(k), orden: secciones ? secciones.indexOf(k) : 0 })
  const ex = consulta.examen || {}
  const bio = ex.biomicroscopia || {}
  const fi = consulta.ficha || null
  const an = fi?.anamnesis || null
  const salud = fi?.salud || null
  const m = consulta.medidas || {}
  const tex = (v) => (v == null || v === "" ? "—" : v)
  const filaAv = (nombre, color, o, ambos) => (
    <tr className="border-t border-slate-100">
      <td className="px-2 py-1.5 font-bold" style={{ color }}>{nombre}</td>
      <td className="px-2 py-1.5">{tex(textoAgudeza(ambos ? ambos.sc : o?.avSc, ambos ? ambos.scF : o?.avScF))}</td>
      <td className="px-2 py-1.5">{tex(textoAgudeza(ambos ? ambos.cc : o?.avCc, ambos ? ambos.ccF : o?.avCcF))}</td>
      <td className="px-2 py-1.5">{tex(textoAgudeza(ambos ? ambos.rx : o?.avRx, ambos ? ambos.rxF : o?.avRxF))}</td>
    </tr>
  )
  const ojo = (nombre, color, o) => (
    <tr className="border-t border-slate-100">
      <td className="px-2 py-1.5 font-bold" style={{ color }}>{nombre}</td>
      <td className="px-2 py-1.5">{dioptriaTexto(o?.esfera) || "—"}</td><td className="px-2 py-1.5">{dioptriaTexto(o?.cilindro) || "—"}</td><td className="px-2 py-1.5">{o?.eje ? o.eje + "°" : "—"}</td>
    </tr>
  )
  const conReceta = Boolean(consulta.od?.avRx || consulta.oi?.avRx)
  const adOd = dioptriaTexto(m.adicionOd || m.adicion), adOi = dioptriaTexto(m.adicionOi || m.adicion)
  const medidas = [
    (adOd || adOi) && ["Adición", adOd === adOi ? adOd : `OD ${adOd || "—"} · OI ${adOi || "—"}`],
    (m.dp || m.dpOd || m.dpOi) && ["Distancia pupilar", [m.dp && `${m.dp} mm`, (m.dpOd || m.dpOi) && `OD ${m.dpOd || "—"} · OI ${m.dpOi || "—"}`, m.dpCerca && `de cerca ${m.dpCerca} mm`].filter(Boolean).join(" · ")],
    m.alt && ["Altura de montaje", m.alt],
    (m.prismaOdCant || m.prismaOiCant) && ["Prisma", [m.prismaOdCant && `OD ${m.prismaOdCant}Δ ${(m.prismaOdBase || "").toLowerCase()}`, m.prismaOiCant && `OI ${m.prismaOiCant}Δ ${(m.prismaOiBase || "").toLowerCase()}`].filter(Boolean).join(" · ")],
    (m.avCerca || m.avCercaSc || m.avCercaCc || m.avCercaRx) && ["Agudeza de cerca (Jaeger)", m.avCercaSc || m.avCercaCc || m.avCercaRx ? [m.avCercaSc && `sin corrección ${m.avCercaSc}`, m.avCercaCc && `con su corrección ${m.avCercaCc}`, m.avCercaRx && `con la receta ${m.avCercaRx}`].filter(Boolean).join(" · ") : m.avCerca],
  ].filter(Boolean)
  const cover = fi?.coverTest?.tipo ? `${fi.coverTest.tipo}${fi.coverTest.magnitud ? ` ${fi.coverTest.magnitud}Δ` : ""}${fi.coverTest.distancia ? ` (${{ lejos: "lejos", cerca: "cerca", ambas: "lejos y cerca" }[fi.coverTest.distancia]})` : ""}`
    : ((ex.coverTestLejos && ex.coverTestLejos !== "Ortoforia") || (ex.coverTestCerca && ex.coverTestCerca !== "Ortoforia")) ? `lejos ${ex.coverTestLejos || "—"} · cerca ${ex.coverTestCerca || "—"}` : ""
  const porOjo = (x) => (x?.od || x?.oi ? `OD ${x.od || "—"} · OI ${x.oi || "—"}` : "")
  const bioNueva = salud?.biomicroscopia
  const hayExamen = ex.testMotor || ex.oftalmoscopia || (ex.testColor && ex.testColor !== "Normal") || ex.pioOd || ex.pioOi || cover || bio.parpados || bio.cornea || bio.camara || consulta.retinoscopia?.od || consulta.retinoscopia?.oi || fi?.queratometria
  const listaAnam = an ? [
    ["Síntomas", [...(an.sintomas || []), an.sintomasOtros].filter(Boolean).join(", ")],
    ["Antecedentes médicos", [...(an.antMedicos?.chips || []), an.antMedicos?.detalle].filter(Boolean).join(", ")],
    ["Antecedentes familiares", [...(an.antFamiliares?.chips || []), an.antFamiliares?.detalle].filter(Boolean).join(", ")],
    ["Alergias", [...(an.alergias?.chips || []), an.alergias?.detalle].filter(Boolean).join(", ")],
    ["Medicamentos", [...(an.medicamentos?.chips || []), an.medicamentos?.detalle].filter(Boolean).join(", ")],
    ["Uso de lentes", an.usaLentes === "si" ? [{ lentes: "Lentes", contacto: "Lentes de contacto", ambos: "Lentes y lentes de contacto" }[an.tipoLentes] || "Sí", an.usaLentesDesde && `desde ${an.usaLentesDesde}`].filter(Boolean).join(" · ") : an.usaLentes === "no" ? "No usa" : ""],
  ].filter(([, v]) => v) : [
    ["Antecedentes médicos", consulta.antecedentes], ["Antecedentes familiares", consulta.antecedentesFamiliares], ["Alergias", consulta.alergias],
  ].filter(([, v]) => v)
  const kerato = fi?.queratometria && ["od", "oi"].some((l) => fi.queratometria[l]?.k1 || fi.queratometria[l]?.k2)
  return (
    <div className={"flex flex-col " + (compacto ? "rounded-xl border border-slate-200/60 bg-white" : "")}>
      <Seccion titulo="Diagnóstico" {...sec("diagnostico")}>
        <p className="flex items-center gap-2 text-base font-bold" style={{ color: INK }}><Stethoscope size={16} className="shrink-0 text-blue-600" aria-hidden="true" />{textoDiagnostico(consulta) || "Sin diagnóstico registrado"}</p>
        {consulta.motivo && <p className="mt-1 text-sm text-slate-600">Motivo: {consulta.motivo}{consulta.detalleConsulta ? ` · «${consulta.detalleConsulta}»` : ""}</p>}
      </Seccion>
      {listaAnam.length > 0 && (
        <Seccion titulo="Anamnesis" {...sec("anamnesis")}>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {listaAnam.map(([t, v]) => <div key={t}><dt className="inline font-semibold text-slate-700">{t}: </dt><dd className="inline text-slate-600">{v}</dd></div>)}
          </dl>
        </Seccion>
      )}
      <Seccion titulo="Agudeza visual" {...sec("agudeza")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] border-collapse font-mono text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="px-2 py-1" /><th className="px-2 py-1">Sin corrección</th><th className="px-2 py-1">Con su corrección actual</th>{conReceta && <th className="px-2 py-1">Con la receta nueva</th>}</tr></thead>
            <tbody>
              {[["OD", "#1d4ed8", consulta.od, null], ["OI", "#0891b2", consulta.oi, null], ...(fi?.agudeza?.ambos && Object.values(fi.agudeza.ambos).some(Boolean) ? [["Ambos", "#475569", null, fi.agudeza.ambos]] : [])].map(([n, c, o, a]) => (
                <tr key={n} className="border-t border-slate-100">
                  <td className="px-2 py-1.5 font-bold" style={{ color: c }}>{n}</td>
                  <td className="px-2 py-1.5">{tex(textoAgudeza(a ? a.sc : o?.avSc, a ? a.scF : o?.avScF))}</td>
                  <td className="px-2 py-1.5">{tex(textoAgudeza(a ? a.cc : o?.avCc, a ? a.ccF : o?.avCcF))}</td>
                  {conReceta && <td className="px-2 py-1.5">{tex(textoAgudeza(a ? a.rx : o?.avRx, a ? a.rxF : o?.avRxF))}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
      <Seccion titulo="Refracción final" {...sec("refraccion")} ocultar={refraccion === null || sec("refraccion").ocultar}>
        {refraccion !== undefined ? refraccion : <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[18rem] border-collapse font-mono text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="px-2 py-1" /><th className="px-2 py-1">Esfera</th><th className="px-2 py-1">Cilindro</th><th className="px-2 py-1">Eje</th></tr></thead>
            <tbody>{ojo("OD", "#1d4ed8", consulta.od)}{ojo("OI", "#0891b2", consulta.oi)}</tbody>
          </table>
        </div>
        {medidas.length > 0 && <dl className="mt-2 space-y-0.5 text-sm text-slate-600">{medidas.map(([t, v]) => <div key={t}><dt className="inline font-semibold text-slate-700">{t}: </dt><dd className="inline">{v}</dd></div>)}</dl>}
        </>}
      </Seccion>
      {(consulta.indicaciones || consulta.lenteRecomendado || consulta.productoNombre) && (
        <Seccion titulo="Indicaciones y lente recomendado" {...sec("indicaciones")}>
          {consulta.indicaciones && <p className="flex items-start gap-2 text-sm text-slate-700"><ClipboardList size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />{consulta.indicaciones}</p>}
          {consulta.lenteRecomendado && <p className="mt-1.5 flex items-start gap-2 text-sm text-slate-700"><Eye size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />Lente recomendado: <span className="font-semibold">{consulta.lenteRecomendado}</span></p>}
          {consulta.productoNombre && <p className="mt-1.5 text-xs text-blue-700">Vinculado al inventario: <span className="font-semibold">{consulta.productoNombre}</span></p>}
        </Seccion>
      )}
      {(hayExamen || kerato || adjuntos) && (
        <Seccion titulo="Examen, salud ocular e imágenes" {...sec("examen")}>
          <div className="space-y-1 text-sm text-slate-600">
            {ex.testMotor && <p><span className="font-semibold text-slate-700">Motilidad ocular:</span> {ex.testMotor}</p>}
            {cover && <p><span className="font-semibold text-slate-700">Cover test:</span> {cover}</p>}
            {(consulta.retinoscopia?.od || consulta.retinoscopia?.oi) && <p><span className="font-semibold text-slate-700">{{ autorrefractometro: "Autorrefractómetro", retinoscopia: "Retinoscopía" }[fi?.objetiva?.metodo] || "Retinoscopía"}:</span> OD {consulta.retinoscopia?.od || "—"} · OI {consulta.retinoscopia?.oi || "—"}</p>}
            {kerato && <p><span className="font-semibold text-slate-700">Queratometría:</span> OD {["k1", "k2"].map((k) => fi.queratometria.od?.[k]).filter(Boolean).join(" / ") || "—"}{fi.queratometria.od?.eje ? ` × ${fi.queratometria.od.eje}°` : ""} · OI {["k1", "k2"].map((k) => fi.queratometria.oi?.[k]).filter(Boolean).join(" / ") || "—"}{fi.queratometria.oi?.eje ? ` × ${fi.queratometria.oi.eje}°` : ""}</p>}
            {bioNueva
              ? ["parpados", "cornea", "camara"].map((k) => (bioNueva.od?.[k] || bioNueva.oi?.[k]) && <p key={k}><span className="font-semibold text-slate-700">{{ parpados: "Párpados y conjuntiva", cornea: "Córnea", camara: "Cámara anterior y cristalino" }[k]}:</span> OD {bioNueva.od?.[k] || "—"} · OI {bioNueva.oi?.[k] || "—"}</p>)
              : <>
                {bio.parpados && <p><span className="font-semibold text-slate-700">Párpados/conjuntiva:</span> {bio.parpados}</p>}
                {bio.cornea && <p><span className="font-semibold text-slate-700">Córnea:</span> {bio.cornea}</p>}
                {bio.camara && <p><span className="font-semibold text-slate-700">Cámara anterior/cristalino:</span> {bio.camara}</p>}
              </>}
            {ex.oftalmoscopia && <p><span className="font-semibold text-slate-700">{salud ? "Fondo de ojo" : "Oftalmoscopia"}:</span> {salud ? porOjo(salud.fondo) || ex.oftalmoscopia : ex.oftalmoscopia}</p>}
            {(ex.pioOd || ex.pioOi) && <p><span className="font-semibold text-slate-700">Presión intraocular:</span> OD {ex.pioOd || "—"} · OI {ex.pioOi || "—"} mmHg{salud?.pio?.metodo ? ` · ${salud.pio.metodo}` : ""}{salud?.pio?.hora ? ` · a las ${horaSinCero(salud.pio.hora)}` : ""}</p>}
            {ex.testColor && ex.testColor !== "Normal" && <p><span className="font-semibold text-slate-700">Test de color:</span> {ex.testColor}</p>}
          </div>
          {adjuntos}
        </Seccion>
      )}
    </div>
  )
}

// El detalle de una atención: solo «Imprimir diagnóstico» (el diagnóstico de esa consulta, con la receta dentro si hubo refracción).
export function ModalAtencion({ cita: citaDeLaLista, consulta, paciente, usuario, parametrizacion, adjuntos, onCerrar }) {
  // La cita de la ficha: la de la lista o, si esa cita no es de esta persona (alcance de citas más estrecho que el de fichas), su fecha, hora y estado que entrega la base con la ficha.
  const cita = citaDeLaLista || consulta.citaResumen || null
  // La hoja de la receta es la misma que imprime el optómetra al terminar la consulta (HojaReceta) y la que el paciente guarda como PDF desde su portal.
  const imprimirReceta = () => imprimirHojaReceta({
    optica: datosOpticaReceta(usuario, parametrizacion),
    paciente: { nombre: paciente?.nombre || consulta.paciente, cedula: paciente?.cedula, edad: edadEnAnios(paciente?.fecha_nacimiento || paciente?.fechaNacimiento) },
    receta: consulta,
    completo: true,
  })

  return (
    <>
      <Cascaron
        titulo={"Atención del " + (fechaLegible(consulta.fecha) || "—")}
        subtitulo={[cita?.hora && cita.hora !== "Sin cita" ? cita.hora : "Sin cita", consulta.motivo, consulta.profesionalNombre].filter(Boolean).join(" · ")}
        derecha={<span className={"rounded-full border px-2.5 py-0.5 text-xs font-semibold " + (BADGE_ESTADO_CITA[cita?.estado] || "border-emerald-200/60 bg-emerald-50 text-emerald-700")}>{etiquetaEstadoCita(cita?.estado || "Atendida")}</span>}
        onCerrar={onCerrar}
        pie={<>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={imprimirReceta} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"><Printer size={15} aria-hidden="true" /> Imprimir diagnóstico</button>
          </div>
          <BotonCerrar onCerrar={onCerrar} />
        </>}
      >
        <DetalleAtencion consulta={consulta} adjuntos={adjuntos} />
      </Cascaron>
    </>
  )
}
