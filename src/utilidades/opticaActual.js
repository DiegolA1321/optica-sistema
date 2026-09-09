import { supabase } from '../lib/supabaseClient'

// Óptica por defecto para las páginas públicas (agendar cita sin cuenta,
// portal de paciente) mientras no exista ruteo real por slug/dominio propio
// por óptica (J12 — DOMINIOS_RAIZ en resolverSitio.js sigue vacío). Es el
// último fallback de resolverOpticaPublica() (ver abajo): cualquiera que
// entre sin `?optica=<slug>` cae aquí. Decisión explícita de Diego
// (2026-09-09, hallazgo J11): mientras exista más de una óptica real en el
// sistema, mantener este default tal cual en vez de mostrar un mensaje
// neutral — no cambiar sin volver a consultarlo, porque afecta a pacientes
// reales que ya usan el link base hoy.
//
// Configurable por variable de entorno (antes vivía como literal fijo en el
// código — cambiar la óptica default exigía un deploy). Con VITE_OPTICA_ID_DEFAULT
// sin definir, cae en el mismo id de siempre (Óptica Solna Vision) para que
// un entorno donde falte configurarla (ej. si Vercel no la tiene) no rompa
// producción.
export const OPTICA_ID_DEFAULT = import.meta.env.VITE_OPTICA_ID_DEFAULT || "b6eb867a-6b08-42c6-b493-27d139bed64e"

// Dado el slug resuelto por resolverSitio() (o null), busca la óptica real
// en la vista pública opticas_publicas por slug; si no hay slug o no
// encuentra nada, cae en OPTICA_ID_DEFAULT por id — mismo comportamiento de
// siempre. columnas incluye siempre id/slug/marca/logo_url además de lo que
// pida el llamador (settings/motivos_consulta, etc.).
export async function resolverOpticaPublica(slug, columnasExtra = 'settings, motivos_consulta') {
  if (!supabase) return null
  const columnas = `id, slug, nombre, logo_url, marca, ${columnasExtra}`
  if (slug) {
    const { data } = await supabase.from('opticas_publicas').select(columnas).eq('slug', slug).maybeSingle()
    if (data) return data
  }
  const { data } = await supabase.from('opticas_publicas').select(columnas).eq('id', OPTICA_ID_DEFAULT).maybeSingle()
  return data
}
