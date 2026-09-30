# Bug corregido: validación prematura en "Diagnóstico y receta"

**Estado: ✅ Corregido y verificado (2026-09-30).** Los dos problemas de este informe (submit fantasma al llegar a Diagnóstico, y "Otro" sin detalle obligatorio) ya están arreglados en `main`. Ver [Corrección aplicada](#corrección-aplicada-2026-09-30) al final.

**Fecha**: 2026-09-30
**Metodología**: solo lectura de código + QA en vivo con Playwright sobre el sistema en local (`npm run dev`), sesión de Andres Rosado Vera (administrador). No se guardó ninguna ficha clínica — cada reproducción se descartó con "Salir de todas formas" / "Cerrar ficha clínica" antes de confirmar el guardado. Se usaron solo pacientes/citas de prueba (`Prueba Control Vencido Reverso`, `Walkin Prueba QA`).

**Origen**: `docs/feedback-ing/reunion-zoom-29sep.md`, líneas 37-39 (minuto ~11-13 del Video 1):
> Ing. Supervisor: Me pide seleccionar una categoría de diagnóstico. Bueno, esto está bugeado aquí. Diagnóstico y receta.
> Tesista: Es que está la receta.

Este punto **no quedó registrado como fila propia** en `docs/feedback-ing/plan-reunion-29sep.md` (el análisis de esa reunión cubre motivo de consulta, antecedentes duplicados y tendencia de graduación, pero no este comentario puntual) — de ahí el pedido de reproducirlo hoy.

---

## Resumen del hallazgo

**Sí hay un bug real, reproducible 4/4 veces con dos pacientes de prueba distintos.** No es un malentendido ("es que está la receta") ni una validación que funcione como se espera: es una condición de carrera real del navegador que hace que, al hacer clic en "Siguiente" para entrar a "Diagnóstico y receta", el formulario **se autoenvíe** una fracción de segundo antes de que el usuario haya podido ver la pantalla, mostrando de inmediato el error "Selecciona al menos una categoría de diagnóstico" — exactamente lo que describió el ing.

### Captura del bug

![Banner de error al llegar a Diagnóstico](capturas-bug-diagnostico/04-BUG-diagnostico-error-inmediato.png)

Banner rojo "No puedes continuar todavía — Selecciona al menos una categoría de diagnóstico y el costo de la consulta (puede ser 0) antes de guardar la receta", visible **apenas se entra al paso 3**, antes de tocar nada en él.

Reproducido de nuevo con un segundo paciente de prueba, sin ninguna relación con el primero (ficha en curso distinta, sin datos compartidos):

![Mismo bug con un segundo paciente](capturas-bug-diagnostico/07-BUG-segundo-paciente-walkin.png)

---

## Causa raíz (identificada en código, sin modificarlo)

El botón inferior de navegación del wizard (`src/paginas/ConsultaMedica.jsx:2530-2546`) usa un único slot condicional para dos botones distintos:

```jsx
{subTab !== "diagnostico" ? (
  <button type="button" onClick={() => irA(...)}>
    Siguiente <ArrowRight size={15} />
  </button>
) : !fichaGuardada ? (
  <button type="submit">
    <Save size={15} /> Guardar ficha clínica
  </button>
) : ( ... )}
```

Ambos botones ocupan la **misma posición en el árbol de JSX, sin `key` que los distinga**. Cuando React reconcilia el cambio de paso Refracción → Diagnóstico, en vez de desmontar el botón "Siguiente" (`type="button"`) y montar uno nuevo, **reutiliza el mismo nodo del DOM** y solo le cambia el atributo `type` a `"submit"`.

El problema es el orden de eventos de un clic real de mouse:

1. El clic dispara el evento nativo `click` sobre el botón (en ese instante todavía es `type="button"`).
2. React ejecuta el `onClick` → `irA("diagnostico")` → `setSubTab("diagnostico")` → **re-render síncrono** dentro del mismo despacho del evento.
3. Ese re-render muta el `type` del mismo nodo DOM a `"submit"` **antes de que el navegador termine de procesar el clic**.
4. El navegador evalúa el "activation behavior" del clic (¿es esto un botón de envío?) **al final** del despacho del evento — y para entonces el nodo ya dice `type="submit"` → dispara `form.requestSubmit()`.
5. Eso ejecuta `intentarGuardar` (`ConsultaMedica.jsx:821-835`), el manejador de **envío del formulario completo**, que valida los 3 pasos (Anamnesis, Refracción, Diagnóstico) de una vez. Anamnesis y Refracción pasan (ya están llenos); Diagnóstico falla porque el usuario acaba de llegar y no ha elegido nada — y el propio `intentarGuardar` fuerza `setSubTab("diagnostico")` + el banner de error, **aunque el usuario ya estaba yendo hacia ahí por su cuenta**.

Esto se confirmó de forma instrumentada (sin editar el archivo fuente): se agregó un listener temporal de `submit` sobre el `<form>` vía consola del navegador y se registró que **un solo clic real en "Siguiente" dispara exactamente 1 evento `click` en el botón + 1 evento `submit` en el formulario** — ese `submit` no debería poder ocurrir nunca desde ese botón.

### Evidencia de que es justo este mecanismo (y no otra cosa)

| Prueba | Resultado |
|---|---|
| Clic real de mouse (`page.locator(...).click()` / `getByRole().click()`) en "Siguiente" desde Refracción | ❌ Bug se reproduce (4/4 intentos, 2 pacientes distintos) |
| Clic directo en la pestaña **"3 Diagnóstico y receta"** del stepper de arriba (tiene `key` propio, nunca cambia de `type`) | ✅ Limpio, sin error — confirma que el problema es específico del botón compartido "Siguiente"/"Guardar", no de la navegación en general |
| `el.click()` (método DOM nativo) en "Siguiente" | ✅ Limpio — no siempre alcanza a reproducir el mismo timing de evento nativo |
| `dispatchEvent(new MouseEvent('click'))` sintético (con o sin mousedown/mouseup previos) | ✅ Limpio — un evento sintético no disparado por el navegador no llega a activar el "activation behavior" nativo de envío de formulario |
| Clic real de Anamnesis → Refracción (mismo botón, pero ahí NO cambia de `type` porque las dos veces es "Siguiente") | ✅ Limpio siempre — refuerza que el disparador es específicamente el cambio de `type` |

Es decir: el bug depende del **clic real con mouse**, que es justo la forma en que el ing interactúa con el sistema — no es un artefacto de la automatización, es más bien lo opuesto: la automatización con clics sintéticos lo *esconde*, y solo un clic de verdad lo expone.

No se encontró ningún error en la consola del navegador ni en Network (0 errores/advertencias en toda la sesión, todas las peticiones a Supabase en `200`) — el bug es silencioso: no rompe nada visiblemente en devtools, solo arruina la primera impresión del paso 3.

### Por qué "es que está la receta" no es la explicación

La respuesta del tesista en la reunión sugiere que se interpretó el comentario del ing como una confusión sobre la vista previa de la receta (que en efecto se muestra junto con los campos de diagnóstico en el mismo paso). Pero el comentario del ing ("me pide seleccionar una categoría... esto está bugeado") describe con precisión el síntoma que se reprodujo acá: el sistema **exige** algo antes de que el usuario haya tenido oportunidad de completarlo — no una confusión sobre el layout.

---

## Otros hallazgos menores durante la reproducción (no bloqueantes, no eran el foco del pedido)

1. **"Otro" como categoría de diagnóstico no era realmente obligatorio en el detalle**, pese a que la UI lo presenta así ("el detalle deja de ser una nota opcional... es la única fuente del diagnóstico", comentario en `ConsultaMedica.jsx:2006-2010`). `validarPaso("diagnostico")` (`ConsultaMedica.jsx:1065-1070`) solo exigía que `diagnosticoCategorias` no estuviera vacío y que `costoConsulta` fuera un número — nunca validaba que, si la categoría era "Otro", el textarea de detalle tuviera contenido. Se podía guardar una receta con diagnóstico = "Otro" sin ninguna descripción. **Corregido — ver abajo.**
2. No se observaron bloques de la receta superpuestos o mal alineados en ningún paso, con o sin "Otro" seleccionado, con o sin "Añadir recomendación de lente" — el layout se ve correcto en las capturas 04, 06 y 07.
3. El buscador de paciente dentro de la ficha (el hallazgo de "no debería aparecer si ya estoy en el paciente", ING9/29-sept) sigue efectivamente ausente al entrar por "Atender" — confirmado en ambas repeticiones (capturas 02).

---

## Corrección aplicada (2026-09-30)

Ambos problemas se corrigieron en `main`, un commit por corrección, `npm test` en verde después de cada uno:

### 1. Submit fantasma al llegar a Diagnóstico — commit `254fd10` *(fix(consulta): key distinta por botón para evitar el submit fantasma en Diagnóstico)*

Se aplicó la opción 1 ya identificada en la causa raíz: `key` distinta para cada uno de los 3 botones que comparten el slot de navegación (`ConsultaMedica.jsx:2530-2576` — "Siguiente", "Guardar ficha clínica" y "Nueva consulta", las 3 ramas del mismo condicional, no solo las 2 que se veían en el bug original). Con `key` propia, React desmonta/monta en vez de reutilizar el mismo nodo `<button>` y mutarle el `type` a mitad del clic.

No se encontró ningún otro lugar en `ConsultaMedica.jsx` (ni en el resto de `src/`, revisado con foco en este mismo archivo) donde un botón cambie de `type="button"` a `type="submit"` compartiendo slot sin `key` — es el único `type="submit"` de todo el componente.

### 2. "Otro" sin detalle obligatorio — commit `d86e349` *(fix(consulta): exige detalle al elegir "Otro" como categoría de diagnóstico)*

`validarPaso("diagnostico")` ahora exige, además de al menos una categoría y el costo, que si `diagnosticoCategorias` incluye "Otro" el campo de detalle no esté vacío — mismo criterio que ya existía para "Otros" en motivo de consulta. Error dedicado (`errores.diagnosticoDetalle`), borde rojo + mensaje bajo el textarea, y el banner de la parte superior también menciona el caso "Otro". Se limpia al tipear o al deseleccionar la categoría.

### 3. Prueba automática — commit `eb92396` *(test(consulta): regresión para el submit fantasma y validación de "Otro" en Diagnóstico)*

`src/paginas/ConsultaMedica.test.jsx`, 4 pruebas. La más importante no prueba el síntoma (el navegador real evalúa "¿es este un botón de envío?" *después* de que React re-renderiza en el mismo clic — jsdom no reproduce esa condición de carrera, se confirmó empíricamente quitando las 3 `key` y viendo que el síntoma seguía sin aparecer en el test), sino la causa raíz, que sí es 100% observable con el mismo motor de reconciliación de React en cualquier entorno: que "Siguiente" y "Guardar ficha clínica" son dos nodos `<button>` distintos al cambiar de paso, no el mismo reutilizado. Se verificó quitando las 3 `key` de nuevo — ese test específico falla como se espera, y vuelve a pasar con el fix puesto. Las otras 3 pruebas cubren el comportamiento observable: llegar a Diagnóstico con "Siguiente" no muestra ningún error todavía; "Otro" sin detalle y guardar sí muestra el error nuevo; "Otro" con detalle no lo muestra.

### Verificación en vivo (Playwright, mismo flujo del informe original)

Repetido con el patch de HMR ya aplicado (`npm run dev`), paciente de prueba con "Ficha clínica en curso":

- **Refracción → Diagnóstico con "Siguiente" (clic real)**: se instrumentó de nuevo un listener de `submit` sobre el formulario antes del clic — esta vez el clic real solo disparó el evento `click` del botón, **ningún** evento `submit` del formulario. Sin banner de error, sin categoría/costo marcados en rojo. Screenshot no necesaria (ausencia de contenido); confirmado por consola + snapshot de accesibilidad limpio.
- **"Otro" sin detalle + "Guardar ficha clínica"**: muestra el error nuevo bajo el textarea ("Describe el diagnóstico en el detalle — con 'Otro' no puede quedar vacío.") y también el de costo (vacío en la prueba) — sin guardar nada (0 peticiones `POST`/`PATCH` a `consultas` o `facturas_venta` en la sesión, solo los `GET` de carga inicial).

![Fix verificado: "Otro" exige detalle](capturas-bug-diagnostico/08-FIX-otro-requiere-detalle.png)

Ninguna ficha clínica se guardó durante la verificación. Las dos citas de prueba (`Prueba Control Vencido Reverso`, `Walkin Prueba QA`), que habían quedado "En Atención" tras la sesión de reproducción original, se devolvieron a "Pendiente" directamente en la base de datos al cerrar esta sesión — **nota**: al ser citas con fecha pasada, el cron de auto-inasistencia del sistema (migraciones `0071`/`0076`, cada ~5 min) las vuelve a marcar "No Asistió" poco después, que es su comportamiento normal y esperado para una cita "Pendiente" ya vencida — no es un efecto de este trabajo ni algo que haya que corregir.

---

## Capturas incluidas

| Archivo | Contenido |
|---|---|
| `01-modal-resumen-cita-historial.png` | Modal "Resumen de la cita" antes de entrar a la ficha (paciente con historial) |
| `02-ficha-abre-historial.png` | Ficha clínica recién abierta, paso Anamnesis, sin buscador de paciente |
| `03-refraccion-historial.png` | Paso Refracción con comparación contra visita anterior |
| `04-BUG-diagnostico-error-inmediato.png` | **Bug reproducido** — banner de error al llegar a Diagnóstico (1er paciente) |
| `05-diagnostico-limpio-via-tab.png` | Mismo paso, llegada limpia al hacer clic en la pestaña del stepper en vez de "Siguiente" |
| `06-categoria-otro-seleccionada.png` | Categoría "Otro" seleccionada, textarea de detalle visible |
| `07-BUG-segundo-paciente-walkin.png` | **Bug reproducido** — segundo paciente de prueba, ficha independiente |
| `08-FIX-otro-requiere-detalle.png` | **Fix verificado** — "Otro" sin detalle + costo vacío muestra ambos errores nuevos al intentar guardar |

Las citas de prueba usadas (`Prueba Control Vencido Reverso`, `Walkin Prueba QA`) terminaron la sesión de reproducción en estado "En Atención" — comportamiento esperado al usar "Atender"/"Paciente en atención", no un efecto secundario del bug. Al cerrar la sesión de corrección se devolvieron a "Pendiente" (ver nota del cron de auto-inasistencia arriba). Ninguna ficha clínica ni factura fue guardada en ningún momento de este trabajo (0 inserciones a `consultas` o `facturas_venta` en las peticiones de red de ambas sesiones).
