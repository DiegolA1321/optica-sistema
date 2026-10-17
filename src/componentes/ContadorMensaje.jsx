"use client"

import { contadorVisible, textoContador, LIMITE_MENSAJE } from "../utilidades/limiteMensaje"

// «N de 2000», debajo de un cuadro de mensaje: solo aparece desde los 1800 caracteres. Al llegar al límite se pone en rojo y lo dice.
export default function ContadorMensaje({ valor = "" }) {
  const n = valor.length
  if (!contadorVisible(n)) return null
  const lleno = n >= LIMITE_MENSAJE
  return <p role="status" className={"text-right text-xs " + (lleno ? "font-bold text-red-600" : "text-slate-500")}>{textoContador(n)}{lleno ? " · llegaste al límite" : ""}</p>
}
