// La hoja de la receta: la MISMA que imprime el optómetra al terminar la consulta, la que se ve en «Imprimir receta» del perfil del paciente y la que el paciente guarda
// como PDF desde su portal (regla 18: un solo formato y un solo componente para los dos lados). Membrete de la óptica, datos del paciente, tabla de graduación, lente
// recomendado, indicaciones, el profesional con su firma y la fecha. Estilos en línea a propósito: la impresión no depende de las clases de la pantalla.
import { INK, GOLD } from "@/lib/tema"
import { formatoFecha } from "../utilidades/formatoFecha"
import { textoDiagnostico } from "../utilidades/pasesVenta"
import { textoAgudeza } from "../utilidades/agudeza"
import { dioptriaTexto } from "../utilidades/refraccion"
import { recetasDe } from "../utilidades/graduacion"
import { lineasDeExamen } from "../utilidades/resumenExamen"

const GRIS = "#64748b"
const dato = (valor) => (valor === "" || valor == null ? "—" : valor)
// La agudeza de la última columna: con la receta nueva si se anotó; si no (fichas anteriores), con sus lentes.
const avFinal = (o = {}) => (o.avRx ? textoAgudeza(o.avRx, o.avRxF) : textoAgudeza(o.avCc, o.avCcF))

// El número de la receta sale de la fecha y el identificador de la consulta, igual en la consulta, en el perfil y en el portal.
export const numeroDeReceta = (receta = {}, prefijo = "RX") => prefijo + "-" + String(receta.fecha || "").replace(/-/g, "") + "-" + String(receta.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase()

function Fila({ etiqueta, children }) {
  return children ? <p style={{ margin: "0 0 6px" }}><b>{etiqueta}:</b> {children}</p> : null
}

// optica: { nombre, direccion, telefono, correo, logoUrl } · paciente: { nombre, cedula, edad } · receta: la consulta del paciente (fecha, od, oi, medidas, diagnostico,
// lenteRecomendado, indicaciones, profesionalNombre, profesionalRegistro). `mostrarMedidas`: la distancia pupilar y la altura de montaje (en el portal, solo si la óptica lo permite).
// `completo`: «Imprimir diagnóstico» del perfil: la MISMA hoja, pero con todo el diagnóstico de la consulta (motivo, agudeza visual, la receta si hubo refracción, salud ocular, diagnóstico e
// indicaciones). Si la consulta no tuvo refracción, no lleva la tabla de graduación ni la nota de validez de la receta.
export default function HojaReceta({ optica = {}, paciente = {}, receta = {}, mostrarMedidas = true, completo = false }) {
  const conRefraccion = !completo || recetasDe([receta]).length > 0
  const examen = completo ? lineasDeExamen(receta) : []
  const m = receta.medidas || {}
  const contacto = [optica.direccion, optica.telefono, optica.correo].filter(Boolean).join(" · ")
  const celda = { padding: "8px 10px", borderTop: "1px solid #e2e8f0", textAlign: "center", fontVariantNumeric: "tabular-nums" }
  const cab = { ...celda, borderTop: "none", background: "#f1f5f9", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: GRIS }
  const ojo = (sigla, nombre, o = {}) => (
    <tr>
      <td style={{ ...celda, textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{sigla} <span style={{ fontWeight: 400, color: GRIS, fontSize: 12 }}>· {nombre}</span></td>
      {receta.ojoNoEvaluado?.[sigla.toLowerCase()] ? <td colSpan={(conReceta ? 3 : 2) + (conRefraccion ? 3 : 0)} style={{ ...celda, textAlign: "left", color: GRIS }}>Ojo no evaluado: {receta.ojoNoEvaluado[sigla.toLowerCase()]}</td> : <>
      {conRefraccion && <><td style={celda}>{dato(dioptriaTexto(o.esfera))}</td><td style={celda}>{dato(dioptriaTexto(o.cilindro))}</td><td style={celda}>{o.eje ? `${o.eje}°` : "—"}</td></>}
      <td style={celda}>{dato(textoAgudeza(o.avSc, o.avScF))}</td><td style={celda}>{dato(textoAgudeza(o.avCc, o.avCcF))}</td>{conReceta && <td style={celda}>{dato(textoAgudeza(o.avRx, o.avRxF))}</td>}</>}
    </tr>
  )
  const conReceta = Boolean(receta.od?.avRx || receta.oi?.avRx)
  // Adición y prisma van siempre; la distancia pupilar (total, de cada ojo y de cerca) y la altura, solo si se permite mostrar las medidas.
  const adOd = dioptriaTexto(m.adicionOd || m.adicion), adOi = dioptriaTexto(m.adicionOi || m.adicion)
  const adicion = adOd || adOi ? (adOd === adOi ? adOd : `OD ${adOd || "—"} · OI ${adOi || "—"}`) : ""
  const dpPorOjo = m.dpOd || m.dpOi ? `OD ${m.dpOd || "—"} · OI ${m.dpOi || "—"}` : ""
  const dpTexto = [m.dp && (dpPorOjo ? `${m.dp} mm (${dpPorOjo})` : m.dp), !m.dp && dpPorOjo].filter(Boolean).join("")
  const prismaOjo = (sigla, cant, base) => (cant ? `${sigla} ${cant}Δ base ${String(base || "").toLowerCase() || "—"}` : "")
  const prisma = [prismaOjo("OD", m.prismaOdCant, m.prismaOdBase), prismaOjo("OI", m.prismaOiCant, m.prismaOiBase)].filter(Boolean).join(" · ")
  const medidas = [adicion && ["Adición", adicion], mostrarMedidas && dpTexto && ["Distancia pupilar", dpTexto], mostrarMedidas && m.dpCerca && ["DP de cerca", m.dpCerca + " mm"], mostrarMedidas && m.alt && ["Altura de montaje", m.alt], prisma && ["Prisma", prisma]].filter(Boolean)
  const diagnostico = textoDiagnostico(receta)
  return (
    <div data-hoja-receta style={{ fontFamily: "system-ui, sans-serif", color: INK, padding: "32px 40px", maxWidth: 780, margin: "0 auto", background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24, borderBottom: `3px solid ${GOLD}`, paddingBottom: 14 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {optica.logoUrl && <img src={optica.logoUrl} alt="" style={{ height: 52, width: 52, objectFit: "contain" }} />}
          <div>
            <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 24 }}>{optica.nombre || "Tu óptica"}</h1>
            {contacto && <p style={{ margin: "4px 0 0", fontSize: 12, color: GRIS }}>{contacto}</p>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: GOLD }}>{completo ? "Diagnóstico" : "Receta óptica"}</p>
          <p style={{ margin: "4px 0 0", fontFamily: "monospace", fontSize: 12 }}>N.º {numeroDeReceta(receta, completo ? "DX" : "RX")}</p>
          <p style={{ margin: 0, fontSize: 12, color: GRIS }}>{formatoFecha(receta.fecha, "largoSinDia") || receta.fecha}</p>
        </div>
      </div>

      <div style={{ margin: "18px 0", padding: "12px 16px", background: "#f8fafc", borderRadius: 10, display: "flex", gap: 32, flexWrap: "wrap", fontSize: 13 }}>
        <span><b>Paciente:</b> {paciente.nombre || receta.paciente || "—"}</span>
        <span><b>Cédula:</b> {paciente.cedula || "—"}</span>
        {paciente.edad != null && <span><b>Edad:</b> {paciente.edad} años</span>}
      </div>

      {completo && receta.motivo && <p style={{ margin: "0 0 12px", fontSize: 14 }}><b>Motivo de la consulta:</b> {receta.motivo}{receta.detalleConsulta ? ` · ${receta.detalleConsulta}` : ""}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e2e8f0", fontSize: 14, margin: "0 0 14px" }}>
        <thead>
          <tr><th rowSpan={2} style={{ ...cab, textAlign: "left" }}>Ojo</th>{conRefraccion && <><th rowSpan={2} style={cab}>Esfera</th><th rowSpan={2} style={cab}>Cilindro</th><th rowSpan={2} style={cab}>Eje</th></>}<th colSpan={conReceta ? 3 : 2} style={{ ...cab, borderBottom: "1px solid #e2e8f0" }}>Agudeza visual</th></tr>
          <tr><th style={cab}>Sin corrección</th><th style={cab}>Con su corrección actual</th>{conReceta && <th style={cab}>Con la receta nueva</th>}</tr>
        </thead>
        <tbody>{ojo("OD", "derecho", receta.od)}{ojo("OI", "izquierdo", receta.oi)}</tbody>
      </table>
      {conRefraccion && medidas.length > 0 && <p style={{ margin: "0 0 14px", fontSize: 13 }}>{medidas.map(([t, v], i) => <span key={t}>{i > 0 && " · "}<b>{t}:</b> {v}</span>)}</p>}

      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
        {examen.map(([t, v]) => <Fila key={t} etiqueta={t}>{v}</Fila>)}
        <Fila etiqueta="Diagnóstico">{diagnostico}</Fila>
        <Fila etiqueta="Lente recomendado">{receta.lenteRecomendado}</Fila>
        <Fila etiqueta="Indicaciones y cuidados">{receta.indicaciones}</Fila>
      </div>

      <div style={{ marginTop: 44, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
        <p style={{ margin: 0, maxWidth: 260, fontSize: 12, lineHeight: 1.5, color: GRIS }}>{conRefraccion ? "Presente esta receta para la elaboración de sus lentes. Validez de 12 meses desde la fecha de emisión." : "Este documento resume el diagnóstico de su consulta. No es una receta de lentes."}</p>
        <div style={{ width: 220, textAlign: "center" }}>
          <div style={{ borderTop: "1px solid #94a3b8", marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{receta.profesionalNombre || "Optómetra"}</p>
          <p style={{ margin: 0, fontSize: 12, color: GRIS }}>{receta.profesionalRegistro ? `Reg. Prof. ${receta.profesionalRegistro}` : "Reg. Prof. ____________"}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: GRIS }}>{formatoFecha(receta.fecha, "largoSinDia") || receta.fecha}</p>
        </div>
      </div>
    </div>
  )
}
