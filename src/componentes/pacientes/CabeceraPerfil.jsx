"use client"

import { useEffect, useRef } from "react"
import { INK } from "@/lib/tema"
import { etiquetaDocumento } from "../../utilidades/documento"
import { etiquetaEstadoClinico } from "../../utilidades/listaPacientes"
import { useModoCelular } from "../../utilidades/modoCelular"

// La cabecera del perfil del paciente: UN solo componente, idéntico en las cuatro pestañas.
// Fila 1: la inicial, el nombre y debajo, en una línea, documento · teléfono · correo · edad · acceso al portal; los cuatro botones en una sola fila a la derecha.
// Fila 2: las pestañas a la izquierda (la activa, con línea azul debajo y sin fondo, para que no parezca un botón) y, al final, la atención (`atender`).
// Solo se muestra una etiqueta cuando hay algo fuera de lo normal (por ejemplo «Tratamiento finalizado»): «Activo» no se dice.
const BOTON = "inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"

// En el celular y la tablet (por debajo de 1093 px) la misma cabecera se apila: el nombre y su línea de datos, «Atender» y «Contactar» grandes, las demás acciones en una fila deslizable
// (Historia clínica, Datos y Agendar cita) y las pestañas deslizables si no caben. «Contactar» es el «Enviar mensaje» de la computadora (la misma ventana, el mismo teléfono necesario).
function CabeceraCelular({ paciente, edad, pestanas, pestana, onPestana, acciones, atender, accesoPortal }) {
  const estado = paciente.estadoClinico
  const fueraDeLoNormal = estado && estado !== "Activo"
  const datos = [paciente.cedula && `${etiquetaDocumento(paciente)} ${paciente.cedula}`, paciente.telefono, paciente.correo, edad].filter(Boolean)
  const contactar = acciones.find((a) => a.id === "mensaje")
  const lista = useRef(null)
  useEffect(() => { lista.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ inline: "nearest", block: "nearest" }) }, [pestana])
  const demas = acciones.filter((a) => a.id !== "mensaje")
  return (
    <header aria-label="Perfil del paciente" className="rounded-3xl border border-slate-200/60 bg-white px-4 pt-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-600 text-lg font-bold text-white">{paciente.nombre.charAt(0).toUpperCase()}</div>
        <div className="min-w-0">
          <h1 className="min-w-0 break-words font-serif text-xl font-bold leading-tight" style={{ color: INK }}>{paciente.nombre}</h1>
          {fueraDeLoNormal && <span className="mt-1 inline-block whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-600">{etiquetaEstadoClinico(estado)}</span>}
        </div>
      </div>
      <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-1.5 text-base text-slate-600">
        {datos.map((d, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">·</span>}
            <span className={"min-w-0 " + (d === paciente.correo ? "max-w-[15rem] truncate" : "whitespace-nowrap")} title={d === paciente.correo ? d : undefined}>{d}</span>
          </span>
        ))}
        {accesoPortal}
      </p>
      {(atender || contactar) && (
        <div className="perfil-principales mt-3">
          {atender}
          {contactar && <button type="button" onClick={contactar.onClick} disabled={contactar.deshabilitado} title={contactar.titulo || "Enviar un mensaje por WhatsApp o correo"} className={BOTON + " perfil-contactar"}>Contactar</button>}
        </div>
      )}
      {demas.length > 0 && (
        <div role="group" aria-label="Más acciones del paciente" className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {demas.map((a) => (
            <button key={a.id} type="button" onClick={a.onClick} disabled={a.deshabilitado} title={a.titulo} aria-haspopup={a.dialogo ? "dialog" : undefined} className={BOTON + " shrink-0"}>{a.etiqueta}</button>
          ))}
        </div>
      )}
      <div ref={lista} role="tablist" aria-label="Secciones del paciente" className="-mx-4 mt-2 flex overflow-x-auto border-t border-slate-100 px-2">
        {pestanas.map((t) => {
          const activa = pestana === t.id
          return (
            <button key={t.id} type="button" role="tab" id={"tab-" + t.id} aria-selected={activa} aria-controls="panel-paciente" onClick={() => onPestana(t.id)}
              className={"flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 text-base font-semibold " + (activa ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600")}>
              {t.etiqueta}
              {t.cuenta > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-sm font-bold text-slate-600">{t.cuenta}</span>}
            </button>
          )
        })}
      </div>
    </header>
  )
}

export default function CabeceraPerfil({ paciente, edad = "", pestanas = [], pestana, onPestana, acciones = [], atender = null, accesoPortal = null }) {
  const celular = useModoCelular()
  if (celular) return <CabeceraCelular paciente={paciente} edad={edad} pestanas={pestanas} pestana={pestana} onPestana={onPestana} acciones={acciones} atender={atender} accesoPortal={accesoPortal} />
  const estado = paciente.estadoClinico
  const fueraDeLoNormal = estado && estado !== "Activo"
  const datos = [
    paciente.cedula && `${etiquetaDocumento(paciente)} ${paciente.cedula}`,
    paciente.telefono,
    paciente.correo,
    edad,
  ].filter(Boolean)
  return (
    <header aria-label="Perfil del paciente" className="rounded-2xl border border-slate-200/60 bg-white px-5 pb-4 pt-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-80 items-center gap-3.5">
          <div aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-600 text-lg font-bold text-white">{paciente.nombre.charAt(0).toUpperCase()}</div>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 font-serif text-2xl font-bold leading-tight" style={{ color: INK }}>{paciente.nombre}</h1>
              {fueraDeLoNormal && <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{etiquetaEstadoClinico(estado)}</span>}
            </div>
            <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm text-slate-500">
              {datos.map((d, i) => (
                <span key={i} className="flex min-w-0 items-center gap-1.5">
                  {i > 0 && <span aria-hidden="true">·</span>}
                  <span className={"min-w-0 " + (d === paciente.correo ? "max-w-[16rem] truncate" : "whitespace-nowrap")} title={d === paciente.correo ? d : undefined}>{d}</span>
                </span>
              ))}
              {accesoPortal}
            </p>
          </div>
        </div>
        {acciones.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {acciones.map((a) => (
              <button key={a.id} type="button" onClick={a.onClick} disabled={a.deshabilitado} title={a.titulo} aria-haspopup={a.dialogo ? "dialog" : undefined} className={BOTON}>{a.etiqueta}</button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
        <div role="tablist" aria-label="Secciones del paciente" className="flex min-w-0 flex-wrap items-center gap-x-1">
          {pestanas.map((t) => {
            const activa = pestana === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={"tab-" + t.id}
                aria-selected={activa}
                aria-controls="panel-paciente"
                onClick={() => onPestana(t.id)}
                className={"flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 pb-2.5 pt-2.5 text-[15px] font-semibold transition-colors cursor-pointer " + (activa ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900")}
              >
                {t.etiqueta}
                {t.cuenta > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{t.cuenta}</span>}
              </button>
            )
          })}
        </div>
        {atender}
      </div>
    </header>
  )
}
