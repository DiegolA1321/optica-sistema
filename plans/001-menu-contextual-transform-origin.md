# 001 — Menú "Más acciones" debe animar desde su disparador, no como un modal centrado

- **Status**: TODO
- **Commit**: 438458c
- **Severity**: LOW
- **Category**: Physicality & origin (AUDIT.md §3)
- **Estimated scope**: 2 files (`src/index.css`, `src/paginas/Citas.jsx`, `src/paginas/Pacientes.jsx`) — 1 new keyframe + 2 call-site edits

## Problem

El menú contextual "Más acciones" (el que se abre al hacer clic en el ícono `MoreVertical` de una tarjeta de cita o de una fila de paciente) reutiliza el keyframe `modal-in` — diseñado para un diálogo centrado en pantalla — en vez de tener su propia animación anclada a la esquina de su disparador. `modal-in` combina `translateY(8px)` con `scale(0.98)` sin `transform-origin` explícito, así que el navegador usa el default `center`, y el menú "crece" desde su propio centro geométrico en vez de "desplegarse" desde el botón que lo abrió. Ya trackeado en `docs/ux-audit.md` fila 50 (Bajo): "Reusa la animación de diálogo centrado (`modal-in`, translateY+scale) para un menú posicionado junto a su disparador, en vez de una animación propia con `transform-origin` en el trigger."

Verificado en las dos ubicaciones citadas por el reporte, código actual leído directamente (no asumido):

```jsx
// src/paginas/Citas.jsx:960-964 — actual
<div
  ref={menuAccionesRef}
  className="fixed z-50 w-52 overflow-hidden rounded-xl border border-slate-200/60 bg-white py-1.5 text-left shadow-xl"
  style={{ top: menuAccionesPos.top, left: menuAccionesPos.left, animation: "modal-in 120ms ease-out" }}
>
```

```jsx
// src/paginas/Pacientes.jsx:1496-1500 — actual (idéntico patrón)
<div
  ref={menuAccionesRef}
  className="fixed z-50 w-52 overflow-hidden rounded-xl border border-slate-200/60 bg-white py-1.5 text-left shadow-xl"
  style={{ top: menuAccionesPos.top, left: menuAccionesPos.left, animation: "modal-in 120ms ease-out" }}
>
```

En ambos archivos, la posición del menú se calcula así (Citas.jsx:219-224, Pacientes.jsx:218-223 — idéntico):

```js
const abrirMenuAcciones = (id, e) => {
  if (menuAccionesId === id) { setMenuAccionesId(null); return }
  const rect = e.currentTarget.getBoundingClientRect()
  setMenuAccionesPos({ top: rect.bottom + 6, left: rect.right - 208 })
  setMenuAccionesId(id)
}
```

`left: rect.right - 208` (el menú mide `w-52` = 208px) hace que el **borde derecho del menú quede alineado con el borde derecho del botón disparador**, y `top: rect.bottom + 6` lo coloca justo debajo. El punto de anclaje real es la esquina superior derecha del menú — ahí es donde vive el botón que lo abrió.

**Fuera de alcance de este plan** (no tocar): `src/paginas/SuperadminPanel.jsx:3112` tiene el mismo patrón (`animation: "modal-in 120ms ease-out"`, mismo cálculo de posición en `abrirMenuAcciones` línea 594) pero el usuario pidió explícitamente solo Citas y Pacientes en esta ronda.

## Target

Un keyframe nuevo y dedicado, `menu-in`, con `transform-origin: top right` fijado en el propio elemento (no depende de que el navegador adivine), duración dentro del presupuesto de "Dropdowns, selects" de AUDIT.md (150–250ms) — se sube ligeramente de 120ms a 160ms, manteniéndose ágil pero dentro de presupuesto:

```css
/* target — src/index.css, junto a los otros @keyframes de entrada */
@keyframes menu-in {
  from { opacity: 0; transform: scale(0.95) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
```

Y en el mismo bloque `@media (prefers-reduced-motion: reduce)` donde ya se redefinen `modal-in`/`rise-in`/`rise-out` (src/index.css líneas 61-77), agregar la redefinición de `menu-in` con el mismo criterio (solo opacity, sin movimiento):

```css
/* target — dentro del @media (prefers-reduced-motion: reduce) existente */
@keyframes menu-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

En ambos call sites (Citas.jsx y Pacientes.jsx), el `style` del menú pasa de:

```jsx
style={{ top: menuAccionesPos.top, left: menuAccionesPos.left, animation: "modal-in 120ms ease-out" }}
```

a:

```jsx
style={{ top: menuAccionesPos.top, left: menuAccionesPos.left, animation: "menu-in 160ms ease-out", transformOrigin: "top right" }}
```

## Repo conventions to follow

- Los keyframes de entrada/salida compartidos viven todos en `src/index.css`, arriba del archivo, junto a `overlay-in`/`modal-in`/`rise-in`/`rise-out` (líneas 11-29). `menu-in` va inmediatamente después de `rise-out` (línea 29), como un bloque más de la misma familia.
- El guard de `prefers-reduced-motion` para estos keyframes vive todo junto en el `@media` que empieza en la línea 61 — cada keyframe compartido se redefine ahí mismo, mismo nombre, solo con la parte de `transform`/`scale` quitada (comentario explicativo ya en el archivo, líneas 62-65). `menu-in` sigue el mismo patrón: se agrega como una cuarta redefinición dentro de ese mismo bloque, no uno nuevo aparte.
- `transform-origin` inline vía `style` (no clase Tailwind) es el patrón ya usado en el resto del sistema para valores calculados dinámicamente — aquí es un valor fijo ("top right"), así que puede ir como string literal directo en el objeto `style`, igual que `top`/`left` ya lo hacen en la misma línea.
- Exemplar de "keyframe redefinido en reduced-motion, mismo nombre, misma técnica": `src/index.css:66-69` (`modal-in` dentro del media query).

## Steps

1. En `src/index.css`, después del bloque `@keyframes rise-out { ... }` (termina en la línea 29), agregar:
   ```css
   @keyframes menu-in {
     from { opacity: 0; transform: scale(0.95) translateY(-4px); }
     to { opacity: 1; transform: scale(1) translateY(0); }
   }
   ```
2. En el mismo archivo, dentro de `@media (prefers-reduced-motion: reduce) { ... }` (el bloque que empieza en la línea 61), inmediatamente después de la redefinición de `rise-out` (termina en la línea 77, antes del `}` que cierra el `@keyframes rise-out` redefinido), agregar la redefinición de `menu-in`:
   ```css
   @keyframes menu-in {
     from { opacity: 0; }
     to { opacity: 1; }
   }
   ```
3. En `src/paginas/Citas.jsx`, línea 963, cambiar:
   ```jsx
   style={{ top: menuAccionesPos.top, left: menuAccionesPos.left, animation: "modal-in 120ms ease-out" }}
   ```
   a:
   ```jsx
   style={{ top: menuAccionesPos.top, left: menuAccionesPos.left, animation: "menu-in 160ms ease-out", transformOrigin: "top right" }}
   ```
4. En `src/paginas/Pacientes.jsx`, línea 1499, aplicar el mismo cambio exacto (código idéntico al de Citas.jsx en este punto):
   ```jsx
   style={{ top: menuAccionesPos.top, left: menuAccionesPos.left, animation: "menu-in 160ms ease-out", transformOrigin: "top right" }}
   ```

## Boundaries

- Do NOT touch `src/paginas/SuperadminPanel.jsx` (mismo patrón presente en la línea 3112, pero fuera de alcance de esta ronda).
- Do NOT cambiar el cálculo de posición (`abrirMenuAcciones`) en ningún archivo — solo la animación de entrada.
- Do NOT cambiar el markup, las clases de Tailwind del contenedor, ni ningún ítem dentro del menú.
- Do NOT tocar `modal-in`/`rise-in`/`rise-out` — quedan exactamente como están, solo se agrega `menu-in` junto a ellos.
- Si el código en Citas.jsx:963 o Pacientes.jsx:1499 no coincide exactamente con lo citado arriba (por drift desde el commit `438458c`), STOP y reporta en vez de improvisar.

## Verification

- **Mechanical**: `npm test -- --run` debe seguir en 78/78 (este cambio no toca lógica ni tests existentes).
- **Feel check**: en el panel de staff, abrir Citas médicas, hacer clic en el ícono "Más acciones" (⋮) de cualquier tarjeta de cita, y confirmar:
  - El menú aparece "desplegándose" desde su esquina superior derecha (donde está el botón ⋮), no creciendo desde su centro geométrico.
  - Repetir en Pacientes.jsx sobre una fila de la tabla — mismo comportamiento.
  - En DevTools → Animations panel, bajar el playback a 10% y confirmar que el `transform-origin` visual coincide con la esquina superior derecha del menú.
  - Con `prefers-reduced-motion` activado (DevTools → Rendering panel → Emulate CSS media feature), el menú debe seguir apareciendo con un fundido de opacity corto, sin el movimiento de escala/traslación.
- **Done when**: ambos menús (Citas.jsx y Pacientes.jsx) usan `menu-in` con `transformOrigin: "top right"`, el keyframe y su redefinición en reduced-motion existen en `src/index.css`, y los 78 tests siguen pasando.
