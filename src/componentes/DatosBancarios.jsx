"use client"

import { useEffect, useState } from "react"
import { Landmark } from "lucide-react"
import { INK } from "@/lib/tema"
import { supabase } from "../lib/supabaseClient"

// Configuración · «Cuenta para transferencias» (migración 0131): lo que el paciente ve en su portal al pagar por transferencia. Se guarda en opticas.datos_bancarios (solo el administrador de la óptica lo escribe;
// el paciente lo lee únicamente con su sesión, por datos_transferencia_paciente). Sin banco ni número de cuenta, el portal no ofrece «Pagar por transferencia».
const CAMPOS = [
  ["banco", "Banco", { maxLength: 60 }],
  ["tipo_cuenta", "Tipo de cuenta", { maxLength: 30, placeholder: "Ahorros o Corriente" }],
  ["numero", "Número de cuenta", { maxLength: 30, inputMode: "numeric" }],
  ["titular", "A nombre de", { maxLength: 80 }],
  ["documento", "Cédula o RUC del titular", { maxLength: 20 }],
  ["correo", "Correo para el comprobante (opcional)", { maxLength: 80, inputMode: "email" }],
]
const VACIO = { banco: "", tipo_cuenta: "", numero: "", titular: "", documento: "", correo: "", instrucciones: "" }

export default function DatosBancarios({ usuario, onExito, onError }) {
  const [guardados, setGuardados] = useState(null) // null mientras carga
  const [borrador, setBorrador] = useState({})
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    if (!supabase || !usuario?.opticaId) { setGuardados(VACIO); return undefined }
    let vivo = true
    supabase.from("opticas").select("datos_bancarios").eq("id", usuario.opticaId).maybeSingle().then(({ data }) => { if (vivo) setGuardados({ ...VACIO, ...(data?.datos_bancarios || {}) }) })
    return () => { vivo = false }
  }, [usuario?.opticaId])
  if (!guardados) return <div className="mt-4 h-48 animate-pulse rounded-xl border border-slate-200/60 bg-white" aria-label="Cargando la cuenta para transferencias" />
  const valor = (k) => (k in borrador ? borrador[k] : guardados[k])
  const hayCambios = Object.keys(borrador).length > 0
  const completo = valor("banco").trim() && valor("numero").trim() && valor("titular").trim()
  const vacioTodo = Object.keys(VACIO).every((k) => !valor(k).trim())

  const guardar = async () => {
    if (!vacioTodo && !completo) { onError?.("Para recibir transferencias escribe al menos el banco, el número de cuenta y a nombre de quién está."); return }
    setGuardando(true)
    const nuevo = vacioTodo ? null : Object.fromEntries(Object.keys(VACIO).map((k) => [k, valor(k).trim()]).filter(([, v]) => v))
    const { error } = supabase ? await supabase.from("opticas").update({ datos_bancarios: nuevo }).eq("id", usuario.opticaId) : { error: null }
    setGuardando(false)
    if (error) { onError?.("No se pudieron guardar los datos de la cuenta. Revisa tu conexión e intenta de nuevo."); return }
    setGuardados({ ...VACIO, ...(nuevo || {}) })
    setBorrador({})
    onExito?.(nuevo ? "Cuenta para transferencias guardada: los pacientes ya pueden pagar por transferencia desde su portal." : "Se quitó la cuenta: el portal ya no ofrece pagar por transferencia.")
  }
  const poner = (k, v) => setBorrador((b) => (v === guardados[k] ? Object.fromEntries(Object.entries(b).filter(([x]) => x !== k)) : { ...b, [k]: v }))
  const clase = "w-full rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2 text-base text-slate-700 outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-100"
  return (
    <div className="mt-4 rounded-xl border border-slate-200/60 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Landmark size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: INK }}>Cuenta para transferencias</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Es lo que el paciente ve en su portal cuando elige «Pagar por transferencia»: hace la transferencia en su banco y sube su comprobante, que tú revisas en Ventas · Cobros y saldos. Si la dejas vacía, el portal no ofrece esta opción.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CAMPOS.map(([k, etiqueta, extra]) => (
              <label key={k} className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">{etiqueta}</span>
                <input value={valor(k)} onChange={(e) => poner(k, e.target.value)} className={clase} {...extra} />
              </label>
            ))}
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Indicaciones para el paciente (opcional)</span>
              <textarea rows={2} maxLength={300} value={valor("instrucciones")} onChange={(e) => poner("instrucciones", e.target.value)} placeholder="Por ejemplo: pon tu cédula en el motivo de la transferencia" className={clase + " resize-none"} />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={guardar} disabled={!hayCambios || guardando} className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)" }}>
              {guardando ? "Guardando…" : "Guardar cuenta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
