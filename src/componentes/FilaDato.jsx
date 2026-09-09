import { INK } from "@/lib/tema"

// Estaba copy-pasteado verbatim entre ConfirmarCitaModal.jsx y
// ConfirmarFichaModal.jsx — mismo componente, dos archivos.
export default function FilaDato({ icon: Icon, label, valor }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <Icon size={14} className="shrink-0 text-slate-500" />
      <span className="text-slate-500">{label}:</span>
      <span className="ml-auto truncate font-semibold" style={{ color: INK }}>{valor}</span>
    </div>
  )
}
