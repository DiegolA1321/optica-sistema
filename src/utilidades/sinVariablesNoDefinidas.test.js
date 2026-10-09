// Guarda: ningún archivo de src/ usa una variable o función que no existe. El lint normal no lo detecta y un caso así solo
// revienta al ejecutar esa línea (el filtro por rango de Citas llevaba días rompiendo la pantalla por `textoDia`).
import { describe, it, expect } from "vitest"
import { execSync } from "node:child_process"

// Globales del navegador, de Node y de las pruebas: el linter no las conoce sin configuración, y aquí no son errores.
const GLOBALES = new Set([
  "window", "document", "localStorage", "sessionStorage", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "ResizeObserver",
  "getComputedStyle", "URLSearchParams", "navigator", "requestAnimationFrame", "cancelAnimationFrame", "fetch", "URL", "Blob", "FileReader",
  "Image", "Event", "CustomEvent", "MutationObserver", "IntersectionObserver", "AbortController", "performance", "console", "crypto",
  "structuredClone", "alert", "confirm", "history", "location", "HTMLElement", "Intl", "FormData", "DOMParser", "Notification", "matchMedia",
  "atob", "btoa", "TextEncoder", "TextDecoder", "queueMicrotask", "File", "Node", "KeyboardEvent", "MouseEvent", "XMLHttpRequest", "process",
  "global", "globalThis", "screen", "print", "open", "prompt", "getSelection", "scrollTo", "CSS", "Audio", "WebSocket", "BroadcastChannel",
  "ClipboardItem", "indexedDB", "caches", "self", "Element", "Response", "Request", "Headers", "vi", "describe", "it", "expect", "beforeEach",
  "afterEach", "beforeAll", "afterAll", "test", "__dirname",
])

describe("variables no definidas", () => {
  it("no hay ninguna fuera de los globales conocidos", () => {
    let salida = ""
    try { salida = execSync("npx oxlint -D no-undef src", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) } catch (e) { salida = `${e.stdout || ""}${e.stderr || ""}` }
    const problemas = salida.split("\n").filter((l) => l.includes("no-undef")).filter((l) => !GLOBALES.has((l.match(/'([^']+)' is not defined/) || [])[1]))
    expect(problemas).toEqual([])
  }, 60_000)
})
