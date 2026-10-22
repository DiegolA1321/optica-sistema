// La hoja de conteo físico, dibujada en páginas A4 (780 px de ancho): encabezado con el logo, el nombre, la dirección y el teléfono de la óptica; título, fecha y las líneas de quién contó y quién revisó;
// la tabla por categoría con filas alternadas (producto, en el sistema, contado, diferencia y observaciones; «Código» solo si algún producto lo tiene); al final, los totales y las firmas.
// Estilos en línea a propósito: el PDF lee cómo quedó dibujada (descargarHojaConteo) y no depende de las clases de la pantalla.
import { INK, GOLD } from "@/lib/tema"
import { ALTO_CABECERA_TABLA, ALTO_FILA, ALTO_PAGINA, ALTO_TITULO, hayCodigos, paginarConteo, totalesDeConteo } from "../../utilidades/conteoImpresion"

const GRIS = "#64748b"
const LINEA = "#cbd5e1"

export default function HojaConteo({ optica = {}, secciones = [], fecha = "" }) {
  const paginas = paginarConteo(secciones)
  const conCodigo = hayCodigos(secciones)
  const totales = totalesDeConteo(secciones)
  const contacto = [optica.direccion, optica.telefono].filter(Boolean).join(" · ")
  const celda = (extra = {}) => ({ boxSizing: "border-box", padding: "0 8px", display: "flex", alignItems: "center", height: "100%", borderLeft: `1px solid ${LINEA}`, ...extra })
  const columnas = [
    ...(conCodigo ? [{ id: "codigo", titulo: "Código", ancho: 84 }] : []),
    { id: "producto", titulo: "Producto", ancho: null },
    { id: "sistema", titulo: "En el sistema", ancho: 96, derecha: true },
    { id: "contado", titulo: "Contado", ancho: 84, derecha: true },
    { id: "diferencia", titulo: "Diferencia", ancho: 84, derecha: true },
    { id: "observaciones", titulo: "Observaciones", ancho: 150 },
  ]
  const estiloCol = (c, extra = {}) => ({ ...(c.ancho ? { width: c.ancho, flexShrink: 0 } : { flex: 1, minWidth: 0 }), ...(c.derecha ? { justifyContent: "flex-end" } : {}), ...extra })
  const fila = (p) => ({
    codigo: p.codigo || "", producto: p.nombre, sistema: String(Number(p.stock) || 0), contado: "", diferencia: "", observaciones: "",
  })

  return (
    <div>
      {paginas.map((pg, n) => (
        <div key={n} data-hoja-conteo-pagina style={{ boxSizing: "border-box", width: 780, height: ALTO_PAGINA, padding: "40px 40px", background: "#fff", fontFamily: "system-ui, sans-serif", color: INK, position: "relative", overflow: "hidden" }}>
          {pg.conEncabezado ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `3px solid ${GOLD}`, paddingBottom: 14 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  {optica.logoUrl && <div data-logo style={{ width: 56, height: 56 }} />}
                  <div>
                    <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 24 }}>{optica.nombre || "Tu óptica"}</h1>
                    {contacto && <p style={{ margin: "4px 0 0", fontSize: 12, color: GRIS }}>{contacto}</p>}
                  </div>
                </div>
              </div>
              <h2 style={{ margin: "18px 0 2px", fontSize: 20 }}>Hoja de conteo físico</h2>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: GRIS }}>{fecha}</p>
              <div style={{ display: "flex", gap: 24, marginBottom: 14, fontSize: 13 }}>
                <div style={{ flex: 1 }}><span>Contó:</span><div style={{ borderBottom: `1px solid ${GRIS}`, height: 22 }} /></div>
                <div style={{ flex: 1 }}><span>Revisó:</span><div style={{ borderBottom: `1px solid ${GRIS}`, height: 22 }} /></div>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: GRIS }}>Escribe lo que cuentes en «Contado». Las diferencias se corrigen en el sistema con «Ajustar stock».</p>
            </div>
          ) : (
            <div style={{ height: 46, fontSize: 12, color: GRIS, borderBottom: `1px solid ${LINEA}`, boxSizing: "border-box", paddingTop: 4 }}>{optica.nombre || "Tu óptica"} · Hoja de conteo físico · {fecha} · página {n + 1}</div>
          )}

          <div style={{ display: "flex", height: ALTO_CABECERA_TABLA, background: "#f1f5f9", border: `1px solid ${LINEA}`, boxSizing: "border-box", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: GRIS }}>
            {columnas.map((c, i) => <div key={c.id} style={estiloCol(c, celda({ borderLeft: i === 0 ? "none" : `1px solid ${LINEA}` }))}>{c.titulo}</div>)}
          </div>
          {pg.elementos.map((el, i) => el.tipo === "titulo" ? (
            <div key={i} style={{ height: ALTO_TITULO, display: "flex", alignItems: "flex-end", paddingBottom: 6, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: GRIS }}>{el.texto}</div>
          ) : (
            <div key={i} style={{ display: "flex", height: ALTO_FILA, boxSizing: "border-box", border: `1px solid ${LINEA}`, borderTop: "none", background: el.alterna ? "#f8fafc" : "#ffffff", fontSize: 13 }}>
              {columnas.map((c, j) => <div key={c.id} style={estiloCol(c, celda({ borderLeft: j === 0 ? "none" : `1px solid ${LINEA}`, overflow: "hidden", whiteSpace: "nowrap" }))}>{fila(el.producto)[c.id]}</div>)}
            </div>
          ))}

          {pg.conCierre && (
            <div>
              <p style={{ margin: "18px 0 0", fontSize: 13, fontWeight: 700 }}>Total en el sistema: {totales.productos} producto{totales.productos === 1 ? "" : "s"} · {totales.unidades} unidad{totales.unidades === 1 ? "" : "es"}</p>
              <div style={{ display: "flex", gap: 60, marginTop: 70, fontSize: 12, color: GRIS }}>
                <div style={{ flex: 1, borderTop: `1px solid ${GRIS}`, paddingTop: 4 }}>Contó</div>
                <div style={{ flex: 1, borderTop: `1px solid ${GRIS}`, paddingTop: 4 }}>Revisó</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
