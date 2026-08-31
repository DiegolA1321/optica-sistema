"use client"

import { useState } from "react"
import { Settings, ShieldCheck, Eye, EyeOff, Layers, CalendarClock, Stethoscope, Pencil, Trash2, Plus, CalendarX, CalendarCheck, Package, BellRing, BellOff } from "lucide-react"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

// Interruptor tipo iOS reutilizable (mismo patrón que el de CRM.jsx)
function Interruptor({ activo, onClick, etiqueta }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={onClick}
      className={"relative h-7 w-12 shrink-0 rounded-full transition-colors cursor-pointer " + (activo ? "" : "bg-slate-200")}
      style={activo ? { background: GRAD } : undefined}
    >
      <span className={"absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all " + (activo ? "left-6" : "left-1")} />
    </button>
  )
}

function FilaParametro({ icon: Icon, titulo, descripcion, activo, onClick, etiquetaOn, etiquetaOff }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
          <Icon size={18} />
        </span>
        <div>
          <p className="text-sm font-bold" style={{ color: INK }}>{titulo}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{descripcion}</p>
          <p className="mt-1.5 text-[11px] font-semibold" style={{ color: activo ? "#059669" : "#94a3b8" }}>
            {activo ? etiquetaOn : etiquetaOff}
          </p>
        </div>
      </div>
      <Interruptor activo={activo} onClick={onClick} etiqueta={titulo} />
    </div>
  )
}

// Lista editable de etiquetas (motivos, diagnósticos rápidos...): agregar,
// renombrar y eliminar — el sistema trae opciones por defecto, pero cada
// óptica ajusta el catálogo a su propio lenguaje clínico.
function CatalogoEditable({ icon: Icon, titulo, descripcion, items, setItems, placeholder }) {
  const [nuevo, setNuevo] = useState("")
  const [editandoIdx, setEditandoIdx] = useState(null)
  const [textoEdit, setTextoEdit] = useState("")

  const agregar = () => {
    const v = nuevo.trim()
    if (!v || items.includes(v)) return
    setItems([...items, v])
    setNuevo("")
  }
  const eliminar = (idx) => setItems(items.filter((_, i) => i !== idx))
  const iniciarEdicion = (idx) => { setEditandoIdx(idx); setTextoEdit(items[idx]) }
  const guardarEdicion = (idx) => {
    const v = textoEdit.trim()
    setEditandoIdx(null)
    if (!v || v === items[idx]) return
    setItems(items.map((it, i) => (i === idx ? v : it)))
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: INK }}>{titulo}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{descripcion}</p>

          <div className="mt-3 space-y-1.5">
            {items.length === 0 && <p className="text-xs italic text-slate-500">Sin opciones — agrega al menos una abajo.</p>}
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                {editandoIdx === idx ? (
                  <input
                    autoFocus
                    value={textoEdit}
                    onChange={(e) => setTextoEdit(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && guardarEdicion(idx)}
                    onBlur={() => guardarEdicion(idx)}
                    className="flex-1 rounded-md border border-blue-300 bg-white px-2 py-1 text-sm text-slate-800 outline-none"
                  />
                ) : (
                  <span className="flex-1 truncate text-sm font-medium text-slate-700">{item}</span>
                )}
                <button type="button" onClick={() => iniciarEdicion(idx)} title="Renombrar" aria-label={`Renombrar ${item}`} className="rounded p-1 text-slate-500 transition hover:bg-white hover:text-blue-600 cursor-pointer">
                  <Pencil size={13} />
                </button>
                <button type="button" onClick={() => eliminar(idx)} title="Eliminar" aria-label={`Eliminar ${item}`} className="rounded p-1 text-slate-500 transition hover:bg-white hover:text-red-600 cursor-pointer">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-2.5 flex gap-2">
            <input
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar() } }}
              placeholder={placeholder}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500"
            />
            <button
              type="button"
              onClick={agregar}
              disabled={!nuevo.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              style={{ background: GRAD }}
            >
              <Plus size={14} /> Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Configuracion({ parametrizacion, setParametrizacion, motivosConsulta = [], setMotivosConsulta, diagnosticosRapidos = [], setDiagnosticosRapidos, categoriasInventario = [], setCategoriasInventario }) {
  const alternar = (clave) => setParametrizacion((prev) => ({ ...prev, [clave]: !prev[clave] }))

  return (
    <div className="w-full space-y-6 text-left">
      {/* ─── HEADER ─── */}
      <div className="flex items-center gap-3.5">
        <div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
          <Settings size={24} />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Configuración de la óptica</h1>
          <p className="text-sm text-slate-500">Define qué ofrece tu óptica y qué políticas aplicas de cara al paciente.</p>
        </div>
      </div>

      {/* ─── NOTA DE ALCANCE ─── */}
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-blue-800">
        <ShieldCheck size={17} className="mt-0.5 shrink-0" />
        <p className="text-xs leading-relaxed">
          El sistema soporta todas estas opciones; aquí decidís cuáles aplican a tu óptica. Estos parámetros solo los ve y edita el administrador.
        </p>
      </div>

      {/* ─── POLÍTICAS HACIA EL PACIENTE ─── */}
      <div>
        <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Políticas hacia el paciente</p>
        <div className="space-y-3">
          <FilaParametro
            icon={parametrizacion.mostrarMedidasPaciente ? Eye : EyeOff}
            titulo="Medidas de la receta en el portal del paciente"
            descripcion="Esfera, cilindro y eje son datos técnicos de la receta. Podés dejarlos visibles gratis en el portal, o mantenerlos protegidos y ofrecerlos solo bajo solicitud (con costo adicional)."
            activo={parametrizacion.mostrarMedidasPaciente}
            onClick={() => alternar("mostrarMedidasPaciente")}
            etiquetaOn="Visibles sin costo adicional"
            etiquetaOff="Protegidas · el paciente debe solicitarlas"
          />

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                {parametrizacion.permitirReagendarPaciente ? <CalendarCheck size={18} /> : <CalendarX size={18} />}
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: INK }}>El paciente puede reagendar o cancelar su propia cita</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Solo aplica a citas hechas por un paciente con cuenta desde su portal. Si la desactivas, tiene que escribirte para cambiar o cancelar su cita.</p>
                <p className="mt-1.5 text-[11px] font-semibold" style={{ color: parametrizacion.permitirReagendarPaciente ? "#059669" : "#94a3b8" }}>
                  {parametrizacion.permitirReagendarPaciente ? "Permitido" : "No permitido"}
                </p>
                {parametrizacion.permitirReagendarPaciente && (
                  <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600">
                    Con al menos
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={parametrizacion.horasAntesReagendar ?? 2}
                      onChange={(e) => setParametrizacion((prev) => ({ ...prev, horasAntesReagendar: Math.max(1, Number(e.target.value) || 1) }))}
                      className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                    horas de anticipación
                  </label>
                )}
              </div>
            </div>
            <Interruptor activo={parametrizacion.permitirReagendarPaciente} onClick={() => alternar("permitirReagendarPaciente")} />
          </div>

          <FilaParametro
            icon={parametrizacion.recordatoriosCitaActivo === false ? BellOff : BellRing}
            titulo="Recordatorio automático un día antes de la cita"
            descripcion="Se envía por correo a cada paciente con cita al día siguiente (tenga o no cuenta en el portal), con un link para confirmar su asistencia. Reduce las inasistencias por olvido."
            activo={parametrizacion.recordatoriosCitaActivo !== false}
            onClick={() => setParametrizacion((prev) => ({ ...prev, recordatoriosCitaActivo: !(prev.recordatoriosCitaActivo !== false) }))}
            etiquetaOn="Activo"
            etiquetaOff="Desactivado — nadie recibirá el recordatorio"
          />
        </div>
      </div>

      {/* ─── SERVICIOS QUE OFRECE ─── */}
      <div>
        <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Servicios que ofrece tu óptica</p>
        <div className="space-y-3">
          <FilaParametro
            icon={Layers}
            titulo="Adaptación de lentes de progresión"
            descripcion="Si no ofreces este servicio, el campo de adición (ADD) se oculta en la ficha clínica para no pedir un dato que no vas a usar."
            activo={parametrizacion.manejaProgresion}
            onClick={() => alternar("manejaProgresion")}
            etiquetaOn="Disponible en la ficha clínica"
            etiquetaOff="No se ofrece — campo oculto"
          />
        </div>
      </div>

      {/* ─── CATÁLOGOS EDITABLES ─── */}
      <div>
        <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Catálogos editables</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CatalogoEditable
            icon={CalendarClock}
            titulo="Motivos de consulta"
            descripcion="Aparecen al agendar una cita, tanto en tu agenda interna como en el portal del paciente."
            items={motivosConsulta}
            setItems={setMotivosConsulta}
            placeholder="Ej. Revisión de lentes de contacto"
          />
          <CatalogoEditable
            icon={Stethoscope}
            titulo="Diagnósticos rápidos"
            descripcion="Aparecen como accesos rápidos al registrar el diagnóstico en la ficha clínica — el texto libre siempre sigue disponible."
            items={diagnosticosRapidos}
            setItems={setDiagnosticosRapidos}
            placeholder="Ej. Ambliopía"
          />
          <CatalogoEditable
            icon={Package}
            titulo="Categorías de inventario"
            descripcion="Organizan los productos en Inventario — se usan al registrar un producto nuevo y para filtrar la lista."
            items={categoriasInventario}
            setItems={setCategoriasInventario}
            placeholder="Ej. Lentes de contacto"
          />
        </div>
      </div>
    </div>
  )
}
