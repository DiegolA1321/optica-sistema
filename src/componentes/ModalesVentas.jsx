"use client"

import ComprobanteVentaModal from "../paginas/ComprobanteVentaModal"
import OrdenLaboratorioModal from "./OrdenLaboratorioModal"
import AbonoModal from "./AbonoModal"
import AnularVentaModal from "./AnularVentaModal"
import NoComproModal from "./NoComproModal"
import FacturaElectronicaModal from "./FacturaElectronicaModal"
import { lineasProformaDeConsulta } from "../utilidades/proforma"

// Los modales de venta que abren tanto el módulo de Ventas como el perfil del paciente.
// `v` es lo que devuelve useVentas(); el resto es contexto de la óptica.
export default function ModalesVentas({ v, usuario, parametrizacion, inventario, setInventario, categoriasInventario, setCategoriasInventario, abonos = [], ordenesLab = [] }) {
  return (
    <>
      {/* Venta desde la cola: datos del diagnóstico, proforma y venta vinculada a su consulta */}
      {v.ventaCola && v.ventaCola.paciente && (
        <ComprobanteVentaModal
          usuario={usuario}
          inventario={inventario}
          setInventario={setInventario}
          categorias={categoriasInventario}
          setCategorias={setCategoriasInventario}
          pacienteFijo={v.ventaCola.paciente}
          titulo={`Venta de ${v.ventaCola.paciente.nombre}`}
          subtitulo="Listo para venta: toma los datos, arma la proforma o registra la venta."
          etiquetaGuardar="Registrar venta"
          lineasIniciales={lineasProformaDeConsulta(v.ventaCola.consulta, parametrizacion)}
          consultaId={v.ventaCola.pase.consultaId}
          citaId={v.ventaCola.pase.citaId}
          diagnostico={v.ventaCola.consulta}
          onProforma={v.imprimirProformaCola}
          onNoCompro={() => { const item = v.ventaCola; v.setVentaCola(null); v.setNoComproPara(item) }}
          onGuardado={v.alVenderDesdeCola}
          onCerrar={() => v.setVentaCola(null)}
        />
      )}
      {v.ordenParaVenta && (
        <OrdenLaboratorioModal
          paciente={v.ordenParaVenta.paciente}
          facturaId={v.ordenParaVenta.factura.id}
          consultaId={v.ordenParaVenta.factura.consultaId}
          facturaNumero={v.ordenParaVenta.factura.numero}
          usuario={usuario}
          onCerrar={() => v.setOrdenParaVenta(null)}
        />
      )}
      {v.abonoPara && (
        <AbonoModal factura={v.abonoPara.factura} paciente={v.abonoPara.paciente} abonos={abonos} usuario={usuario} onRegistrado={v.alAbonar} onCerrar={() => v.setAbonoPara(null)} />
      )}
      {v.anularPara && (
        <AnularVentaModal
          factura={v.anularPara.factura}
          paciente={v.anularPara.paciente}
          abonos={abonos}
          ordenesAbiertas={ordenesLab.filter((o) => o.facturaId === v.anularPara.factura.id && (o.estado === "enviada" || o.estado === "lista")).length}
          usuario={usuario}
          onAnulada={v.alAnular}
          onCerrar={() => v.setAnularPara(null)}
        />
      )}
      {v.noComproPara && (
        <NoComproModal
          nombrePaciente={v.noComproPara.paciente?.nombre || "Paciente"}
          paseId={v.noComproPara.pase.id}
          onCancelar={() => v.setNoComproPara(null)}
          onHecho={v.alNoComprar}
        />
      )}
      {v.facturaElectronicaPara && (
        <FacturaElectronicaModal
          factura={v.facturaElectronicaPara.factura}
          paciente={v.facturaElectronicaPara.paciente}
          onGuardar={v.guardarFacturaElectronica}
          onCerrar={() => v.setFacturaElectronicaPara(null)}
        />
      )}
    </>
  )
}
