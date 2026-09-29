# 003 — Acotar `transition-all` a las propiedades reales que cambian en 5 botones de Citas.jsx

- **Status**: TODO
- **Commit**: 438458c
- **Severity**: MEDIUM
- **Category**: Performance (AUDIT.md §5)
- **Estimated scope**: 1 file, 5 call sites

## Problem

`transition: all` (vía la clase Tailwind `transition-all`) hace que el navegador vigile cambios en *todas* las propiedades del elemento, incluidas las que disparan layout/paint fuera de GPU — AUDIT.md §5 lo marca como "siempre un hallazgo", con o sin evidencia de un frame perdido real. Cinco botones de `src/paginas/Citas.jsx` la usan cuando en la práctica solo animan `transform` (por hover) o `transform` + `opacity` (por hover + disabled). Ya trackeado parcialmente en `docs/ux-audit.md` fila 40 (Medio, cita `Citas.jsx:80` como uno de ~82 elementos del sistema con este problema) — este plan resuelve los 5 de `Citas.jsx` específicamente, no los ~82 del sistema completo (fuera de alcance, pedido explícito del usuario).

Código actual, los 5 sitios verificados directamente (línea → contenido exacto):

```jsx
// src/paginas/Citas.jsx:81 — KpiBoton, actual
<button
  type="button"
  onClick={onClick}
  className="group flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition-all hover:-translate-y-0.5 cursor-pointer"
  style={{
    borderColor: activo ? c.ring : "rgba(14,43,51,0.08)",
    boxShadow: activo ? `0 0 0 3px ${c.ring}22` : "0 1px 2px rgba(14,43,51,0.04)",
  }}
>
```

**Importante — este botón NO es un caso de "solo transform"**: `borderColor` y `boxShadow` son valores inline que cambian según el prop `activo` (se reasignan en cada re-render cuando el filtro de KPI se activa/desactiva), no solo por `:hover`. Si se recortara a `transition-transform` a secas, se perdería la transición suave de borde/sombra al seleccionar este botón — una regresión, no una mejora. Este es el único de los 5 que necesita más de una propiedad.

```jsx
// src/paginas/Citas.jsx:692 — botón "Gestionar cita", actual
<button
  type="button"
  onClick={() => abrirModal()}
  className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
  style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
>
```
Aquí `background` y `boxShadow` son estáticos (no cambian con hover/active/ningún estado) — solo `transform` cambia (`hover:-translate-y-0.5`, `active:translate-y-0`). Caso limpio de "solo transform".

```jsx
// src/paginas/Citas.jsx:1282 — botón submit "Confirmar cita", actual
<button type="submit" className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
```
Mismo caso: `background`/`boxShadow` estáticos, solo `transform` por hover.

```jsx
// src/paginas/Citas.jsx:1390 — botón submit "Registrar y atender", actual
<button type="submit" disabled={cpGuardando} className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
```
Este además tiene `disabled:opacity-60` — `opacity` SÍ cambia (al pasar a `disabled` mientras `cpGuardando` es true), y `opacity` es una de las dos propiedades que AUDIT.md recomienda animar explícitamente (junto con `transform`). Necesita `transform` + `opacity`, no solo `transform`.

```jsx
// src/paginas/Citas.jsx:1484 — botón submit "Guardar cambios", actual
<button type="submit" className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
```
Mismo caso limpio que 692 y 1282: solo `transform`.

## Target

```jsx
/* target — línea 81, KpiBoton: transform + border-color + box-shadow, usa la clase Tailwind "transition" a secas (ver Repo conventions) */
className="group flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 cursor-pointer"
```

```jsx
/* target — línea 692, "Gestionar cita": solo transform */
className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
```

```jsx
/* target — línea 1282, "Confirmar cita": solo transform */
className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer"
```

```jsx
/* target — línea 1390, "Registrar y atender": transform + opacity, usa "transition" a secas */
className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
```

```jsx
/* target — línea 1484, "Guardar cambios": solo transform */
className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer"
```

En los 5 casos, únicamente el token `transition-all` cambia (a `transition` o `transition-transform` según corresponda) — el resto de la cadena de clases y el `style` inline quedan exactamente iguales.

## Repo conventions to follow

- La clase Tailwind `transition` (sin sufijo) ya es el patrón establecido en este mismo archivo para "más de una propiedad no-layout cambia junto con el color/sombra/transform" — exemplar a dos líneas de distancia de cada botón corregido: `Citas.jsx:1279` (`className="... transition hover:bg-slate-50 cursor-pointer"`, el botón "Cancelar" justo al lado del de línea 1282), y también en los inputs del formulario (`Citas.jsx:751`: `"... outline-none transition focus-visible:border-blue-500..."`). Tailwind's `transition` por defecto cubre `color`, `background-color`, `border-color`, `opacity`, `box-shadow`, `transform`, entre otras — nunca `width`/`height`/`margin`/`padding`/`top`/`left`, así que sigue cumpliendo AUDIT.md §5 sin necesitar una lista de propiedades arbitraria.
- `transition-transform` (Tailwind) para "solo transform" ya se usa en el mismo archivo, ej. `Citas.jsx:806` (`ChevronDown ... transition-transform`).

## Steps

1. En `src/paginas/Citas.jsx`, línea 81, reemplazar `transition-all` por `transition` dentro de la cadena de clases del botón KpiBoton. No tocar ningún otro token de la clase ni el `style` inline.
2. En la misma archivo, línea 692, reemplazar `transition-all` por `transition-transform` en el botón "Gestionar cita".
3. Línea 1282, reemplazar `transition-all` por `transition-transform` en el botón submit "Confirmar cita".
4. Línea 1390, reemplazar `transition-all` por `transition` en el botón submit "Registrar y atender" (necesita cubrir `opacity` por el `disabled:opacity-60`).
5. Línea 1484, reemplazar `transition-all` por `transition-transform` en el botón submit "Guardar cambios".

## Boundaries

- Do NOT tocar ningún otro archivo — este plan es exclusivo de `src/paginas/Citas.jsx`. Los ~77 elementos restantes del hallazgo sistémico (`docs/ux-audit.md` fila 40) quedan fuera de alcance de esta ronda.
- Do NOT cambiar el `style` inline (`background`, `boxShadow`) de ningún botón — solo el token `transition-all` de la clase.
- Do NOT usar `transition-transform` en la línea 81 ni en la línea 1390 — ambas necesitan más de una propiedad (ver Problem).
- Si alguna de las 5 líneas citadas no coincide exactamente con el código actual (drift desde el commit `438458c`), STOP y reporta esa línea específica en vez de adivinar el reemplazo.

## Verification

- **Mechanical**: `npm test -- --run` debe seguir en 78/78.
- **Feel check**: en el panel de staff, en Citas médicas:
  - Pasar el mouse sobre las tarjetas KPI de filtro (arriba de la lista) y confirmar que el hover (elevación) se sigue viendo suave, y que al hacer clic para activar/desactivar un filtro, el cambio de color de borde y sombra también se sigue viendo suave (no un salto instantáneo) — esto confirma que `transition` (no `transition-transform` a secas) fue la elección correcta ahí.
  - Pasar el mouse sobre "Gestionar cita" y sobre los 3 botones "Confirmar cita" / "Registrar y atender" / "Guardar cambios" (dentro de sus respectivos modales) y confirmar que la elevación por hover se sigue viendo idéntica a antes.
  - Disparar el estado `disabled` del botón "Registrar y atender" (enviar el formulario y observar mientras `cpGuardando` es true) y confirmar que la opacidad baja con una transición suave, no un salto.
  - En DevTools → Performance, grabar un hover repetido sobre estos 5 botones y confirmar que no aparecen entradas de "Layout"/"Recalculate Style" de gran duración asociadas a ellos (antes, `transition-all` podía forzar a Chrome a vigilar layout en cada frame aunque no cambiara nada layout-afectante).
- **Done when**: las 5 líneas usan `transition` o `transition-transform` según lo especificado, ningún botón perdió su transición de hover/disabled existente, y los 78 tests siguen pasando.
