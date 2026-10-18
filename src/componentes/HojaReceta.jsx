// La hoja de la receta: la MISMA que imprime el optómetra al terminar la consulta, la que se ve en «Imprimir receta» del perfil del paciente y la que el paciente guarda
// como PDF desde su portal (regla 18: un solo formato y un solo componente para los dos lados). Membrete de la óptica, datos del paciente, tabla de graduación, lente
// recomendado, indicaciones, el profesional con su firma y la fecha. Estilos en línea a propósito: la impresión no depende de las clases de la pantalla.
import { INK, GOLD } from "@/lib/tema"
import { formatoFecha } from "../utilidades/formatoFecha"
import { textoDiagnostico } from "../utilidades/pasesVenta"

const GRIS = "#64748b"
const dato = (valor) => (valor === "" || valor == null ? "—" : valor)

// El número de la receta sale de la fecha y el identificador de la consulta, igual en la consulta, en el perfil y en el portal.
export const numeroDeReceta = (receta = {}) => "RX-" + String(receta.fecha || "").replace(/-/g, "") + "-" + String(receta.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase()

function Fila({ etiqueta, children }) {
  return children ? <p style={{ margin: "0 0 6px" }}><b>{etiqueta}:</b> {children}</p> : null
}

// optica: { nombre, direccion, telefono, correo, logoUrl } · paciente: { nombre, cedula, edad } · receta: la consulta del paciente (fecha, od, oi, medidas, diagnostico,
// lenteRecomendado, indicaciones, profesionalNombre, profesionalRegistro). `mostrarMedidas`: la distancia pupilar y la altura de montaje (en el portal, solo si la óptica lo permite).
export default function HojaReceta({ optica = {}, paciente = {}, receta = {}, mostrarMedidas = true }) {
  const m = receta.medidas || {}
  const contacto = [optica.direccion, optica.telefono, optica.correo].filter(Boolean).join(" · ")
  const celda = { padding: "8px 10px", borderTop: "1px solid #e2e8f0", textAlign: "center", fontVariantNumeric: "tabular-nums" }
  const cab = { ...celda, borderTop: "none", background: "#f1f5f9", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: GRIS }
  const ojo = (sigla, nombre, o = {}) => (
    <tr>
      <td style={{ ...celda, textAlign: "left", fontWeight: 700 }}>{sigla} <span style={{ fontWeight: 400, color: GRIS, fontSize: 12 }}>· {nombre}</span></td>
      <td style={celda}>{dato(o.esfera)}</td><td style={celda}>{dato(o.cilindro)}</td><td style={celda}>{o.eje ? `${o.eje}°` : "—"}</td>
      <td style={celda}>{dato(o.avSc)}</td><td style={celda}>{dato(o.avCc)}</td>
    </tr>
  )
  const medidas = [m.adicion && ["Adición", m.adicion], mostrarMedidas && m.dp && ["Distancia pupilar", m.dp], mostrarMedidas && m.alt && ["Altura de montaje", m.alt]].filter(Boolean)
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
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: GOLD }}>Receta óptica</p>
          <p style={{ margin: "4px 0 0", fontFamily: "monospace", fontSize: 12 }}>N.º {numeroDeReceta(receta)}</p>
          <p style={{ margin: 0, fontSize: 12, color: GRIS }}>{formatoFecha(receta.fecha, "largoSinDia") || receta.fecha}</p>
        </div>
      </div>

      <div style={{ margin: "18px 0", padding: "12px 16px", background: "#f8fafc", borderRadius: 10, display: "flex", gap: 32, flexWrap: "wrap", fontSize: 13 }}>
        <span><b>Paciente:</b> {paciente.nombre || receta.paciente || "—"}</span>
        <span><b>Cédula:</b> {paciente.cedula || "—"}</span>
        {paciente.edad != null && <span><b>Edad:</b> {paciente.edad} años</span>}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e2e8f0", fontSize: 14, margin: "0 0 14px" }}>
        <thead><tr><th style={{ ...cab, textAlign: "left" }}>Ojo</th><th style={cab}>Esfera</th><th style={cab}>Cilindro</th><th style={cab}>Eje</th><th style={cab}>AV sin lentes</th><th style={cab}>AV con lentes</th></tr></thead>
        <tbody>{ojo("OD", "derecho", receta.od)}{ojo("OI", "izquierdo", receta.oi)}</tbody>
      </table>
      {medidas.length > 0 && <p style={{ margin: "0 0 14px", fontSize: 13 }}>{medidas.map(([t, v], i) => <span key={t}>{i > 0 && " · "}<b>{t}:</b> {v}</span>)}</p>}

      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
        <Fila etiqueta="Diagnóstico">{diagnostico}</Fila>
        <Fila etiqueta="Lente recomendado">{receta.lenteRecomendado}</Fila>
        <Fila etiqueta="Indicaciones y cuidados">{receta.indicaciones}</Fila>
      </div>

      <div style={{ marginTop: 44, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
        <p style={{ margin: 0, maxWidth: 260, fontSize: 12, lineHeight: 1.5, color: GRIS }}>Presente esta receta para la elaboración de sus lentes. Validez de 12 meses desde la fecha de emisión.</p>
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
