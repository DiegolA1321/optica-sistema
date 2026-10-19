"use client"

import { useEffect, useRef, useState } from "react"
import { Bell, ChevronRight, ChevronDown, ChevronsLeft, ChevronsRight, LogOut, UserRound, Download } from "lucide-react"

const iniciales = (nombre = "") => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "P"

// Cierra un menú flotante al pulsar fuera o con Escape.
function useCerrarFuera(abierto, cerrar) {
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return undefined
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) cerrar() }
    const tecla = (e) => { if (e.key === "Escape") cerrar() }
    document.addEventListener("mousedown", fuera)
    document.addEventListener("keydown", tecla)
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla) }
  }, [abierto, cerrar])
  return ref
}

// La campanita de avisos: un punto naranja si hay algo nuevo (el número exacto lo lee quien usa lector de pantalla).
export function Campanita({ avisos, onIr }) {
  const [abierta, setAbierta] = useState(false)
  const ref = useCerrarFuera(abierta, () => setAbierta(false))
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setAbierta((v) => !v)} aria-haspopup="menu" aria-expanded={abierta} aria-label={avisos.length ? `Avisos: tienes ${avisos.length}` : "Avisos: no tienes avisos nuevos"} className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-pt-borde bg-white text-pt-marino transition-colors hover:bg-slate-50 cursor-pointer">
        <Bell size={24} aria-hidden="true" />
        {avisos.length > 0 && <span aria-hidden="true" className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-[#B45309] ring-2 ring-white" />}
      </button>
      {abierta && (
        <div role="menu" aria-label="Avisos" className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-pt-borde bg-white shadow-2xl">
          <p className="border-b border-pt-borde px-4 py-3 font-heading text-lg font-bold text-pt-marino">Tus avisos</p>
          {avisos.length === 0 ? <p className="px-4 py-5 text-lg text-pt-texto">No tienes avisos por ahora.</p> : (
            <ul className="p-2">{avisos.map((a) => (
              <li key={a.id}><button type="button" role="menuitem" onClick={() => { setAbierta(false); onIr(a.va) }} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-lg font-semibold text-slate-800 transition-colors hover:bg-pt-fondo cursor-pointer"><span className="min-w-0 flex-1">{a.texto}</span><ChevronRight size={20} className="shrink-0 text-slate-400" aria-hidden="true" /></button></li>
            ))}</ul>
          )}
        </div>
      )}
    </div>
  )
}

// La cuenta del paciente: su nombre y un menú con «Mis datos» y «Cerrar sesión» (igual que el menú de usuario del sistema del personal).
export function MenuCuenta({ nombre, onMisDatos, onDescargarDatos, onCerrarSesion }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useCerrarFuera(abierto, () => setAbierto(false))
  const item = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-base font-semibold transition-colors cursor-pointer"
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-haspopup="menu" aria-expanded={abierto} aria-label={`Mi cuenta: ${nombre}`} className="flex min-h-12 items-center gap-3 rounded-xl border border-pt-borde bg-white py-1.5 pl-2 pr-3 transition-colors hover:bg-slate-50 cursor-pointer">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base font-bold" style={{ background: "var(--portal-acento, #1D5FD6)", color: "var(--portal-texto-boton, #FFFFFF)" }}>{iniciales(nombre)}</span>
        <span className="min-w-0 text-left leading-tight"><span className="block max-w-[14rem] truncate text-base font-semibold text-pt-marino">{nombre}</span><span className="block text-base text-pt-texto">Paciente</span></span>
        <ChevronDown size={18} className={"shrink-0 text-slate-500 transition-transform " + (abierto ? "rotate-180" : "")} aria-hidden="true" />
      </button>
      {abierto && (
        <div role="menu" aria-label="Mi cuenta" className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-pt-borde bg-white p-2 shadow-2xl">
          <button type="button" role="menuitem" onClick={() => { setAbierto(false); onMisDatos() }} className={item + " text-slate-800 hover:bg-pt-fondo"}><UserRound size={20} aria-hidden="true" /> Mis datos</button>
          {onDescargarDatos && <button type="button" role="menuitem" onClick={() => { setAbierto(false); onDescargarDatos() }} className={item + " text-slate-800 hover:bg-pt-fondo"}><Download size={20} aria-hidden="true" /> Descargar mis datos</button>}
          {onCerrarSesion && <button type="button" role="menuitem" onClick={() => onCerrarSesion()} className={item + " text-red-700 hover:bg-red-50"}><LogOut size={20} aria-hidden="true" /> Cerrar sesión</button>}
        </div>
      )}
    </div>
  )
}

// La cabecera de laptop, en todas las pantallas del portal: el botón para ocultar el menú, el saludo con la fecha, la campanita y la cuenta.
export default function CabeceraPortal({ menuOculto, onAlternarMenu, saludo, fecha, avisos, onIr, nombre, onDescargarDatos, onCerrarSesion }) {
  return (
    <header className="relative z-30 flex shrink-0 items-center justify-between gap-4 border-b border-pt-borde bg-white px-8 py-3">
      <div className="flex min-w-0 items-center gap-4">
        <button type="button" onClick={onAlternarMenu} aria-label={menuOculto ? "Mostrar el menú" : "Ocultar el menú"} aria-expanded={!menuOculto} title={menuOculto ? "Mostrar el menú" : "Ocultar el menú"} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer">
          {menuOculto ? <ChevronsRight size={24} aria-hidden="true" /> : <ChevronsLeft size={24} aria-hidden="true" />}
        </button>
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-bold leading-tight text-pt-marino">{saludo}</p>
          <p className="truncate text-base text-pt-texto">{fecha}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Campanita avisos={avisos} onIr={onIr} />
        <MenuCuenta nombre={nombre} onMisDatos={() => onIr("datos")} onDescargarDatos={onDescargarDatos} onCerrarSesion={onCerrarSesion} />
      </div>
    </header>
  )
}
