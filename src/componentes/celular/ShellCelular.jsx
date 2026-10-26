"use client"

import { Bell } from "lucide-react"
import { INK } from "@/lib/tema"
import LogoOptica from "../LogoOptica"
import "./celular.css"

// El panel del personal en celular y tablet (por debajo de 1093 px): una cabecera compacta arriba (logo de la óptica, nombre de la sección y las notificaciones),
// el contenido en medio y la barra fija abajo, con el estilo de la del portal del paciente. Nada queda tapado por la muesca ni por la barra del iPhone
// (env(safe-area-inset-*)) y con el teléfono en horizontal la barra y la cabecera ocupan menos alto.
// pestanas: [{ id, nombre, icono, onClick }]; pestanaActiva: el id de la que está activa (o null si ninguna).
export default function ShellCelular({ usuario, titulo, subtitulo, avisos = 0, onNotificaciones, pestanas, pestanaActiva, franjaSuperior = null, children }) {
  const lateral = "max(1rem, env(safe-area-inset-left))"
  const derecha = "max(1rem, env(safe-area-inset-right))"
  return (
    <div className="modo-celular flex h-[100dvh] flex-col font-sans" style={{ backgroundColor: "#F4F6FA" }}>
      {franjaSuperior}
      <header className="cabecera-celular relative z-30 shrink-0 border-b border-slate-200/80 bg-white" style={{ paddingTop: "env(safe-area-inset-top)", paddingLeft: lateral, paddingRight: derecha }}>
        <div className="flex min-h-[64px] items-center gap-3 py-2">
          <LogoOptica url={usuario?.opticaLogoUrl} nombre={usuario?.opticaNombre} tamano={40} />
          {/* Una pantalla a pantalla completa (el perfil del paciente) pone aquí su botón de volver; mientras lo haga, el título se oculta. */}
          <div id="encabezado-slot" className="min-w-0 empty:hidden" />
          <div className="min-w-0 flex-1 leading-tight [#encabezado-slot:not(:empty)+&]:hidden">
            <p className="truncate text-lg font-bold tracking-tight" style={{ color: INK }}>{titulo}</p>
            {subtitulo && <p className="truncate text-sm text-slate-600">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onNotificaciones} aria-label={avisos > 0 ? `Notificaciones: ${avisos}` : "Notificaciones"} className="relative grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border border-slate-200 bg-white text-slate-700">
            <Bell size={20} aria-hidden="true" />
            {avisos > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#f59e0b,#dc2626)" }}>
                {avisos > 9 ? "9+" : avisos}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Espacio de trabajo. El perfil de paciente a pantalla completa se ancla aquí (Pacientes.jsx lo porta a #vista-completa-root). */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div id="vista-completa-root" />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4" style={{ paddingLeft: lateral, paddingRight: derecha }}>
          {children}
        </main>
      </div>

      <nav aria-label="Menú del panel" className="barra-inferior relative z-30 shrink-0 border-t border-slate-200 bg-white" style={{ paddingBottom: "env(safe-area-inset-bottom)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
        <ul className="mx-auto grid max-w-3xl" style={{ gridTemplateColumns: `repeat(${pestanas.length}, minmax(0, 1fr))` }}>
          {pestanas.map((p) => {
            const Icono = p.icono
            const activa = pestanaActiva === p.id
            return (
              <li key={p.id} className="min-w-0">
                <button type="button" onClick={p.onClick} aria-current={activa ? "page" : undefined} aria-label={p.nombre}
                  className={"flex min-h-[64px] w-full cursor-pointer flex-col items-center justify-center gap-1 px-0.5 py-2 text-[13px] leading-tight tracking-tight whitespace-nowrap transition-colors " + (activa ? "font-bold text-blue-600" : "font-semibold text-slate-600")}>
                  <Icono size={24} aria-hidden="true" />
                  <span>{p.nombre}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
