"use client"

import { useEffect, useState } from "react"
import { FileText, AlertTriangle, CheckCircle2, Paperclip } from "lucide-react"
import CampoFecha from "./CampoFecha"
import { Cascaron, PieFormulario } from "./AtencionPaciente"
import { LEYENDA_INTERNO, normalizarFacturaElectronica, numeroComprobante } from "../utilidades/comprobantes"
import { validarClaveAcceso, validarFechaAutorizacion, validarArchivo, revisarXml, claveEnGrupos } from "../utilidades/facturaElectronica"
import { guardarFacturaElectronica, leerFacturaElectronica } from "../utilidades/facturaElectronicaApi"
import { hoyISO } from "../utilidades/disponibilidad"
import { diaDeRegistro } from "../utilidades/periodoLista"
import { fechaLegible } from "../utilidades/formatoFecha"

const CAMPO = "w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
const kb = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

// Un archivo que se adjunta: muestra el que ya está guardado (y se puede reemplazar) o el que se acaba de elegir.
function SelectorArchivo({ id, etiqueta, tipo, guardado, elegido, onElegir }) {
  const hay = elegido || guardado
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-600">{etiqueta}</label>
      <div className={"flex items-center gap-2.5 rounded-xl border px-3 py-2.5 " + (hay ? "border-emerald-200/60 bg-emerald-50" : "border-dashed border-slate-300 bg-slate-50")}>
        {hay ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-hidden="true" /> : <Paperclip size={18} className="shrink-0 text-slate-400" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800" title={elegido?.name}>{elegido ? elegido.name : guardado ? `Guardado · ${kb(guardado.bytes)}` : `Sin ${tipo === "pdf" ? "PDF" : "XML"} todavía`}</p>
          <p className="truncate text-xs text-slate-500">{elegido ? `${kb(elegido.size)} · se guardará al pulsar Guardar` : guardado ? `Subido el ${fechaLegible(diaDeRegistro(guardado.subido_en))}` : `Máx. ${tipo === "pdf" ? "5" : "2"} MB`}</p>
        </div>
        <span className="relative shrink-0">
          <span className="rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">{hay ? "Reemplazar" : "Elegir archivo"}</span>
          <input id={id} type="file" accept={tipo === "pdf" ? "application/pdf,.pdf" : "application/xml,text/xml,.xml"} onChange={(e) => onElegir(e.target.files?.[0] || null)} className="absolute inset-0 cursor-pointer opacity-0" />
        </span>
      </div>
    </div>
  )
}

// Registrar o corregir la factura electrónica (SRI o proveedor) de un comprobante de venta interno: el número, la clave de acceso (49 dígitos, con su dígito
// verificador), la fecha de autorización y los archivos que entrega el SRI (el RIDE en PDF y el XML autorizado). El sistema no la emite: guarda la que la
// óptica emitió por fuera, en almacenamiento privado y por 7 años. Se puede registrar solo el número y adjuntar el resto después.
export default function FacturaElectronicaModal({ factura, paciente, usuario, onGuardado, onCerrar }) {
  const [numero, setNumero] = useState(factura.facturaElectronica || "")
  const [clave, setClave] = useState("")
  const [autorizada, setAutorizada] = useState("")
  const [pdf, setPdf] = useState(null)
  const [xml, setXml] = useState(null)
  const [guardado, setGuardado] = useState({ pdf: null, xml: null })
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [errorArchivo, setErrorArchivo] = useState({ pdf: "", xml: "" })
  const fe = normalizarFacturaElectronica(numero)
  const revisionClave = clave.trim() ? validarClaveAcceso(clave, numero) : null
  const fechaVenta = diaDeRegistro(factura.creadoEn)

  useEffect(() => {
    let vivo = true
    leerFacturaElectronica(factura.id).then(({ datos, archivos }) => {
      if (!vivo) return
      if (datos) { setClave(claveEnGrupos(datos.claveAcceso)); setAutorizada(datos.autorizadaEl || "") }
      setGuardado(archivos)
      setCargando(false)
    })
    return () => { vivo = false }
  }, [factura.id])

  // El archivo elegido se revisa de una vez: extensión, tamaño y que sea de verdad un PDF o un XML.
  const elegir = (tipo) => async (archivo) => {
    const poner = tipo === "pdf" ? setPdf : setXml
    const avisar = (t) => setErrorArchivo((e) => ({ ...e, [tipo]: t }))
    if (!archivo) { poner(null); avisar(""); return }
    const inicio = await archivo.slice(0, 64).text()
    const problema = validarArchivo(tipo, { nombre: archivo.name, bytes: archivo.size, inicio })
    if (problema) { poner(null); avisar(problema); return }
    avisar("")
    poner(archivo)
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (fe.demasiadoLargo) { setError("El número es demasiado largo (máximo 60 caracteres)."); return }
    if ((clave.trim() || autorizada || pdf || xml) && !fe.valor) { setError("Escribe el número de la factura electrónica."); return }
    if (revisionClave && !revisionClave.ok) { setError(revisionClave.error); return }
    if (autorizada) { const f = validarFechaAutorizacion(autorizada, { fechaVenta, hoy: hoyISO() }); if (f) { setError(f); return } }
    if (xml && revisionClave?.ok) {
      const problema = revisarXml(await xml.text(), revisionClave.clave)
      if (problema) { setError(problema); return }
    }
    setGuardando(true)
    setError("")
    const { error: errorGuardar } = await guardarFacturaElectronica({ opticaId: usuario?.opticaId, factura, numero: fe.valor, clave: revisionClave?.clave || "", autorizada, pdf, xml })
    setGuardando(false)
    if (errorGuardar) { setError(errorGuardar); return }
    onGuardado?.({ numero: fe.valor, conArchivos: Boolean(pdf || xml) })
    onCerrar()
  }

  return (
    <Cascaron
      titulo="Factura electrónica (SRI)"
      subtitulo={`${numeroComprobante(factura.numero)}${paciente?.nombre ? ` · ${paciente.nombre}` : ""}`}
      Icono={FileText}
      ancho="max-w-xl"
      onCerrar={() => { if (!guardando) onCerrar() }}
      formulario={{ onSubmit: guardar }}
      pie={<PieFormulario onCancelar={onCerrar} etiquetaGuardar="Guardar" guardando={guardando} deshabilitado={cargando} nota="Puedes guardar solo el número y adjuntar los archivos después." />}
    >
      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="fe-numero" className="mb-1 block text-xs font-semibold text-slate-600">Número de la factura</label>
            <input id="fe-numero" type="text" autoFocus value={numero} onChange={(e) => setNumero(e.target.value)} onBlur={() => setNumero((v) => normalizarFacturaElectronica(v).valor)} placeholder="001-001-000000123" className={CAMPO + " font-mono"} />
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Fecha de autorización</span>
            <CampoFecha id="fe-autorizada" etiqueta="Fecha de autorización" valor={autorizada} onCambiar={setAutorizada} min={fechaVenta || ""} max={hoyISO()} />
          </div>
        </div>
        {numero.trim() && !fe.formatoSri && <p className="-mt-2 text-xs text-amber-700">El número no tiene el formato 001-001-000000123 del SRI. Puedes guardarlo igual si tu proveedor lo numera distinto.</p>}

        <div>
          <label htmlFor="fe-clave" className="mb-1 block text-xs font-semibold text-slate-600">Clave de acceso (49 dígitos)</label>
          <input id="fe-clave" type="text" inputMode="numeric" value={clave} onChange={(e) => setClave(e.target.value)} onBlur={() => setClave((v) => (validarClaveAcceso(v).clave ? claveEnGrupos(validarClaveAcceso(v).clave) : v))} placeholder="49 dígitos" className={CAMPO + " font-mono"} />
          {revisionClave && (revisionClave.ok
            ? <p className="mt-1 text-xs font-medium text-emerald-700">✓ 49 dígitos · ✓ dígito verificador correcto{numero.trim() && fe.formatoSri ? ` · ✓ coincide con el número ${revisionClave.numero}` : ""}</p>
            : <p role="alert" className="mt-1 text-xs font-medium text-red-700">{revisionClave.error}</p>)}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <SelectorArchivo id="fe-pdf" etiqueta="RIDE (PDF)" tipo="pdf" guardado={guardado.pdf} elegido={pdf} onElegir={elegir("pdf")} />
            {errorArchivo.pdf && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{errorArchivo.pdf}</p>}
          </div>
          <div>
            <SelectorArchivo id="fe-xml" etiqueta="XML autorizado" tipo="xml" guardado={guardado.xml} elegido={xml} onElegir={elegir("xml")} />
            {errorArchivo.xml && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{errorArchivo.xml}</p>}
          </div>
        </div>
        <p className="text-xs text-slate-500">Se guardan en almacenamiento privado durante 7 años. Un archivo reemplazado se conserva: nada se borra. {LEYENDA_INTERNO} El sistema no emite facturas electrónicas: guarda las que emites por fuera.</p>
        <p className="text-xs text-slate-500">Déjalo todo vacío para quitar el número.</p>
        {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-sm font-medium text-red-700"><AlertTriangle size={14} aria-hidden="true" /> {error}</div>}
      </div>
    </Cascaron>
  )
}
