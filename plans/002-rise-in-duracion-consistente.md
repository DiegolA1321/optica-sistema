# 002 — Estandarizar la duración de `rise-in` en el historial clínico de Pacientes

- **Status**: TODO
- **Commit**: 438458c
- **Severity**: LOW
- **Category**: Cohesion & tokens (AUDIT.md §7)
- **Estimated scope**: 1 file, 1 line

## Problem

`rise-in` (el keyframe de "el contenido se asienta" al montar una vista) se usa con duración `320ms` en absolutamente todos sus call sites del sistema — 21 ocurrencias confirmadas por grep en `Reportes.jsx`, `CRM.jsx`, `Inventario.jsx`, `Citas.jsx`, `SuperadminPanel.jsx` y la propia `Pacientes.jsx` (línea 869) — excepto una: la vista de historial clínico completo dentro de `Pacientes.jsx`, que usa `200ms`. Mismo keyframe, mismo tipo de momento (un panel de contenido que reemplaza a la vista anterior), duración distinta sin ninguna razón documentada. Ya trackeado en `docs/ux-audit.md` fila 51 (Bajo): "Mismo keyframe, dos duraciones distintas para lo que se lee como el mismo momento de 'el contenido se asienta'." Solución propuesta ahí mismo: "Estandarizar en 320ms."

Código actual, verificado directamente:

```jsx
// src/paginas/Pacientes.jsx:1643 — actual (el outlier)
<div className="absolute inset-0 z-40 flex flex-col overflow-hidden" style={{ backgroundColor: "#F7F5F0", animation: "rise-in 200ms ease-out" }}>
```

```jsx
// src/paginas/Pacientes.jsx:869 — mismo archivo, ya en 320ms (correcto)
<div className="w-full space-y-5 text-left" style={overlaySolo ? undefined : { animation: "rise-in 320ms ease-out both" }}>
```

El elemento de la línea 1643 es la vista de historial clínico completo del paciente (`{/* ─── MODAL HISTORIAL CLÍNICO ─── */}`, línea 1641) — un panel de página completa (`absolute inset-0`) que reemplaza el contenido visible, exactamente el mismo tipo de "asentamiento de contenido" que ya cubre `rise-in 320ms` en todo el resto del sistema. `320ms` cae dentro del presupuesto de AUDIT.md para "Modals, drawers" (200–500ms), así que subir de 200 a 320 sigue siendo válido por presupuesto, no solo por consistencia.

## Target

```jsx
// target — src/paginas/Pacientes.jsx:1643
<div className="absolute inset-0 z-40 flex flex-col overflow-hidden" style={{ backgroundColor: "#F7F5F0", animation: "rise-in 320ms ease-out" }}>
```

Un solo número cambia: `200ms` → `320ms`. Nada más en la línea se toca (el `both` que aparece en otros call sites es opcional aquí — el original de esta línea ya no lo tenía, así que se preserva tal cual para no introducir un cambio de comportamiento fuera de alcance).

## Repo conventions to follow

- `rise-in 320ms ease-out both` (o sin `both` en los paneles que no necesitan mantener el estado final antes de que el keyframe corra) es la duración estándar de facto en todo el sistema para "un bloque de contenido nuevo se asienta al aparecer" — no vive como variable/token CSS, se escribe inline en cada call site, pero el valor `320ms` es la convención real por repetición (21 de 22 usos).
- Exemplar en el mismo archivo: `src/paginas/Pacientes.jsx:869`.

## Steps

1. En `src/paginas/Pacientes.jsx`, línea 1643, cambiar `"rise-in 200ms ease-out"` por `"rise-in 320ms ease-out"`. Ningún otro carácter de la línea cambia.

## Boundaries

- Do NOT tocar `src/paginas/SuperadminPanel.jsx:2909` (`rise-out 220ms` del toast) — es una animación de salida distinta, con su propia razón de ser (temporizador de 3s del toast), no el mismo "asentamiento de contenido" que este plan estandariza. No es el hallazgo que este plan resuelve.
- Do NOT cambiar el keyframe `rise-in` en sí (`src/index.css`) — solo la duración inline en este único call site.
- Do NOT agregar `both` si no estaba en el original de esta línea.
- Si la línea 1643 de `Pacientes.jsx` no coincide exactamente con lo citado arriba (drift desde el commit `438458c`), STOP y reporta en vez de improvisar.

## Verification

- **Mechanical**: `npm test -- --run` debe seguir en 78/78.
- **Feel check**: en el panel de staff, abrir el perfil de un paciente con al menos una consulta registrada, hacer clic en "Ver historial completo" (o el control equivalente que abre la vista de historial clínico), y confirmar:
  - El panel se asienta con la misma velocidad/sensación que otras transiciones "rise-in" del sistema (por ejemplo, al entrar a Reportes.jsx o CRM.jsx) — ya no se siente perceptiblemente más rápido.
  - En DevTools → Animations panel, bajar el playback a 10% y confirmar que la animación dura ~320ms, no ~200ms.
- **Done when**: la línea 1643 de `Pacientes.jsx` dice `320ms`, y los 78 tests siguen pasando.
