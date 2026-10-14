"use client"

import { useMemo, useState } from "react"
import { MessageCircle, ShoppingBag, ShoppingCart, Stethoscope, Undo2, UserX } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { BarraBusquedaFiltros, ConteoCitas } from "../FiltrosCitas"
import { Cascaron } from "../AtencionPaciente"
import { Columna, Dato } from "./Detalle"
import { ContenedorLista, EncabezadoLista, Insignia, Vacio } from "./Lista"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, BOTON_CERRAR, plural } from "./estilos"
import { dinero } from "../../utilidades/formatoMoneda"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { coincideTexto } from "../../utilidades/busqueda"
import { linkWhatsApp } from "../../utilidades/whatsapp"
import { registrarLog } from "../../utilidades/logs"
import { diasEnEspera, etiquetaMotivo } from "../../utilidades/pasesVenta"
import { FILTROS_POR_VENDER, DIAS_PARA_SEGUIMIENTO, listaPorVender, llevaProforma, lineaDiagnosticoYLente, diagnosticoCorto, textoDiasEspera, mensajeSeguimientoVenta } from "../../utilidades/ventasModulo"
import { ahoraEcuador } from "../../utilidades/horaEcuador"

// Las mismas columnas en el encabezado y en cada fila, para que nada baile entre filtros (regla 1).
const COLUMNAS = "lg:grid-cols-[minmax(0,1.6fr)_6.5rem_minmax(0,2fr)_7.5rem_8.5rem_15rem]"
const ENCABEZADO = (nocompraron) => [{ texto: "Paciente" }, { texto: "Consulta" }, { texto: "Diagnóstico y lente" }, { texto: nocompraron ? "Motivo" : "Espera" }, { texto: "Proforma" }, { texto: "" }]

// Pestaña "Por vender": los pacientes atendidos con receta que esperan su venta, y los que no compraron. Una sola acción por fila
// ("Tomar datos del diagnóstico"); lo demás está en el detalle de la fila.
export default function PestanaPorVender({ v, usuario, puedeVender, onVerPaciente, onNuevaVenta, filtroInicial = "todos" }) {
  const [filtro, setFiltro] = useState(filtroInicial)
  const [texto, setTexto] = useState("")
  const [detalle, setDetalle] = useState(null) // { item, descartado }
  const hoy = useMemo(() => ahoraEcuador(), [])
  const nocompraron = filtro === "nocompraron"

  const base = useMemo(() => listaPorVender(filtro, { listos: v.colaListos, descartados: v.colaDescartados }), [filtro, v.colaListos, v.colaDescartados])
  const items = base.filter(({ paciente }) => coincideTexto(texto, paciente?.nombre, paciente?.cedula))
  const hayAlgo = v.colaListos.length + v.colaDescartados.length > 0
  const etiquetas = [filtro !== "todos" && { id: "lista", texto: FILTROS_POR_VENDER.find((f) => f.id === filtro).etiqueta, quitar: () => setFiltro("todos") }].filter(Boolean)
  const secciones = [{ id: "lista", titulo: "Mostrar", valor: filtro, onChange: setFiltro, opciones: FILTROS_POR_VENDER }]
  const limpiar = () => { setFiltro("todos"); setTexto("") }
  const hayFiltros = etiquetas.length > 0 || texto.trim() !== ""

  const conteo = nocompraron ? plural(items.length, "paciente no compró", "pacientes no compraron") : filtro === "con" ? plural(items.length, "paciente con proforma", "pacientes con proforma") : filtro === "sin" ? plural(items.length, "paciente sin proforma", "pacientes sin proforma") : plural(items.length, "paciente por vender", "pacientes por vender")

  const escribir = (item) => {
    const tel = item.paciente?.telefono
    if (!tel) return
    window.open(linkWhatsApp(tel, mensajeSeguimientoVenta({ paciente: item.paciente, opticaNombre: usuario?.opticaNombre, conProforma: llevaProforma(item) })), "_blank", "noopener")
    registrarLog(usuario, "ventas", "Escribió por WhatsApp a un paciente por vender", item.paciente?.nombre || "")
  }

  return (
    <div className="space-y-3">
      {hayAlgo && (
        <div className="space-y-2.5">
          <BarraBusquedaFiltros texto={texto} onTexto={setTexto} secciones={secciones} etiquetas={etiquetas} onLimpiar={limpiar} placeholder="Buscar paciente: nombre o cédula" inputId="por-vender-busqueda" etiquetaPanel="Filtrar los pacientes por vender" panelId="por-vender-filtrar-panel" />
          <div className="flex h-9 items-center px-2"><ConteoCitas texto={conteo} /></div>
        </div>
      )}

      {items.length === 0 ? (
        !hayAlgo ? (
          <Vacio Icono={ShoppingBag} titulo="No hay pacientes esperando para venta" texto="Cuando el optómetra termine una atención con receta y pulse «Pasar a la óptica», el paciente aparece aquí. Si alguien llega a comprar sin consulta, registra su venta directamente.">
            {puedeVender && <button type="button" onClick={onNuevaVenta} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><ShoppingCart size={15} aria-hidden="true" /> Nueva venta</button>}
          </Vacio>
        ) : hayFiltros ? (
          <Vacio Icono={ShoppingBag} titulo={texto.trim() ? "Ningún paciente coincide con la búsqueda" : "Ningún paciente coincide con el filtro"}>
            <button type="button" onClick={limpiar} className={CLASE_ACCION_SECUNDARIA}>Quitar filtros</button>
          </Vacio>
        ) : (
          <Vacio Icono={ShoppingBag} titulo={nocompraron ? "Nadie ha dejado de comprar" : "No hay pacientes esperando para venta"} texto={nocompraron ? "Aquí quedan quienes consultaron y no compraron, con su motivo." : "Todos los pacientes con receta ya compraron o no compraron."} />
        )
      ) : (
        <ContenedorLista etiqueta={nocompraron ? "Pacientes que no compraron" : "Pacientes por vender"} encabezado={<EncabezadoLista plantilla={COLUMNAS} etiquetas={ENCABEZADO(nocompraron)} />}>
          {items.map((item) => {
            const { pase, paciente, consulta } = item
            const dias = diasEnEspera(pase, hoy)
            const largo = !nocompraron && dias > DIAS_PARA_SEGUIMIENTO
            const linea = lineaDiagnosticoYLente(consulta)
            return (
              <li key={pase.id} className={"relative grid grid-cols-1 gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-slate-50/70 lg:items-center " + COLUMNAS}>
                <div className="min-w-0">
                  <button type="button" onClick={() => setDetalle({ item, descartado: nocompraron })} title={paciente?.nombre} className="block max-w-full truncate text-left text-sm font-bold transition-colors after:absolute after:inset-0 hover:text-blue-700 cursor-pointer" style={{ color: INK }}>{paciente?.nombre || "Paciente"}</button>
                  {paciente?.cedula && <p className="truncate text-xs text-slate-500">{paciente.cedula}</p>}
                </div>
                <p className="text-sm text-slate-600">{fechaLegible(consulta?.fecha) || "—"}</p>
                <p className="min-w-0 truncate text-sm text-slate-700" title={linea}>{linea || <span className="text-slate-400">Sin diagnóstico</span>}</p>
                <div className="min-w-0">
                  {nocompraron
                    ? <Insignia tono="gris" title={etiquetaMotivo(pase.motivoDescarte, pase.detalleDescarte)} className="max-w-full"><span className="truncate">{etiquetaMotivo(pase.motivoDescarte, pase.detalleDescarte) || "Sin motivo"}</span></Insignia>
                    : largo ? <Insignia tono="ambar" title={`Lleva más de ${DIAS_PARA_SEGUIMIENTO} días esperando: contáctalo o ciérralo`}>{textoDiasEspera(dias)}</Insignia> : <span className="text-sm text-slate-600">{textoDiasEspera(dias)}</span>}
                </div>
                <div className="min-w-0">
                  {pase.proformaEntregadaEn
                    ? <Insignia tono="azul" title={`Proforma entregada el ${fechaLegible(pase.proformaEntregadaEn)}`}>{pase.proformaTotal ? `Proforma ${dinero(Number(pase.proformaTotal))}` : "Proforma"}</Insignia>
                    : <span className="text-sm text-slate-400">Sin proforma</span>}
                </div>
                <div className="relative z-10 flex justify-end">
                  {puedeVender && !nocompraron && (
                    <button type="button" onClick={() => v.setVentaCola(item)} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><ShoppingBag size={14} aria-hidden="true" /> Tomar datos del diagnóstico</button>
                  )}
                  {puedeVender && nocompraron && (
                    <button type="button" onClick={() => v.reabrirPase(item)} disabled={v.reabriendoId === pase.id} className={CLASE_ACCION_SECUNDARIA}><Undo2 size={14} aria-hidden="true" /> {v.reabriendoId === pase.id ? "Volviendo…" : "Volver a la lista de espera"}</button>
                  )}
                </div>
              </li>
            )
          })}
        </ContenedorLista>
      )}

      {detalle && (
        <DetallePorVender
          item={detalle.item} descartado={detalle.descartado} hoy={hoy} puedeVender={puedeVender}
          onCerrar={() => setDetalle(null)}
          onVerPerfil={() => { const p = detalle.item.paciente; setDetalle(null); if (p) onVerPaciente?.(p.id) }}
          onEscribir={() => escribir(detalle.item)}
          onTomarDatos={() => { const it = detalle.item; setDetalle(null); v.setVentaCola(it) }}
          onNoCompro={() => { const it = detalle.item; setDetalle(null); v.setNoComproPara(it) }}
          onReabrir={() => { const it = detalle.item; setDetalle(null); v.reabrirPase(it) }}
        />
      )}
    </div>
  )
}

// El detalle de una fila: la consulta, el seguimiento (espera, proforma, motivo) y el paciente. Todas las acciones, aquí.
function DetallePorVender({ item, descartado, hoy, puedeVender, onCerrar, onVerPerfil, onEscribir, onTomarDatos, onNoCompro, onReabrir }) {
  const { pase, paciente, consulta } = item
  const dias = diasEnEspera(pase, hoy)
  const largo = !descartado && dias > DIAS_PARA_SEGUIMIENTO
  const diagnostico = diagnosticoCorto(consulta)
  return (
    <Cascaron
      titulo={paciente?.nombre || "Paciente"}
      subtitulo={descartado ? "No compró" : "Por vender"}
      Icono={ShoppingBag}
      ancho="max-w-3xl"
      etiqueta={`Por vender: ${paciente?.nombre || "Paciente"}`}
      onCerrar={onCerrar}
      derecha={largo ? <Insignia tono="ambar">Más de {DIAS_PARA_SEGUIMIENTO} días esperando</Insignia> : null}
      pie={(
        <>
          <button type="button" onClick={onVerPerfil} className="text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer">Ver perfil del paciente</button>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {paciente?.telefono && <button type="button" onClick={onEscribir} className={CLASE_ACCION_SECUNDARIA}><MessageCircle size={14} aria-hidden="true" /> Escribir por WhatsApp</button>}
            {puedeVender && !descartado && <button type="button" onClick={onNoCompro} className={CLASE_ACCION_SECUNDARIA}><UserX size={14} aria-hidden="true" /> No compró</button>}
            {puedeVender && descartado && <button type="button" onClick={onReabrir} className={CLASE_ACCION_SECUNDARIA}><Undo2 size={14} aria-hidden="true" /> Volver a la lista de espera</button>}
            {puedeVender && !descartado && <button type="button" onClick={onTomarDatos} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><ShoppingBag size={14} aria-hidden="true" /> Tomar datos del diagnóstico</button>}
            <button type="button" onClick={onCerrar} className={BOTON_CERRAR}>Cerrar</button>
          </div>
        </>
      )}
    >
      <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-3">
        <Columna titulo="La consulta">
          <Dato etiqueta="Fecha">{fechaLegible(consulta?.fecha) || "—"}</Dato>
          <Dato etiqueta="Motivo" vacio={!consulta?.motivo}>{consulta?.motivo || "Sin motivo"}</Dato>
          <Dato etiqueta="Diagnóstico" vacio={!diagnostico}><span className="inline-flex items-start gap-1.5">{diagnostico ? <Stethoscope size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" /> : null}{diagnostico || "Sin diagnóstico"}</span></Dato>
          <Dato etiqueta="Lente recomendado" vacio={!consulta?.lenteRecomendado}>{consulta?.lenteRecomendado || "Sin lente recomendado"}</Dato>
        </Columna>
        <Columna titulo="Seguimiento">
          <Dato etiqueta="Pasó a la óptica">{fechaLegible(pase.pasadaEn) || "—"}{!descartado ? ` · espera ${textoDiasEspera(dias).toLowerCase()}` : ""}</Dato>
          <Dato etiqueta="Proforma" vacio={!pase.proformaEntregadaEn}>{pase.proformaEntregadaEn ? `Entregada el ${fechaLegible(pase.proformaEntregadaEn)}${pase.proformaTotal ? ` · ${dinero(Number(pase.proformaTotal))}` : ""}` : "No se ha entregado"}</Dato>
          {descartado && <Dato etiqueta="No compró">{etiquetaMotivo(pase.motivoDescarte, pase.detalleDescarte) || "Sin motivo indicado"}</Dato>}
          {largo && <Dato etiqueta="Qué hacer">Contactarlo por WhatsApp o cerrarlo con «No compró». No se cierra solo.</Dato>}
        </Columna>
        <Columna titulo="Paciente">
          <Dato etiqueta="Cédula" vacio={!paciente?.cedula}>{paciente?.cedula || "Sin cédula"}</Dato>
          <Dato etiqueta="Teléfono" vacio={!paciente?.telefono}>{paciente?.telefono || "Sin teléfono"}</Dato>
          <Dato etiqueta="Correo" vacio={!paciente?.correo}>{paciente?.correo || "Sin correo"}</Dato>
        </Columna>
      </div>
    </Cascaron>
  )
}
