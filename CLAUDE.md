# Guía de Arquitectura, Usabilidad y UI/UX del Sistema

## 1. Principios de Arquitectura y Código
- **KISS & DRY:** Mantén la menor cantidad de abstracciones posibles. Evita reescribir utilidades nativas o instalar librerías innecesarias.
- **Componentes Modulares & Reutilizables:** Reutiliza componentes UI de `@/components/ui` (patrón shadcn/Tailwind) para mantener consistencia visual en todas las vistas.
- **Gestión de Estado Limpia:** Evita propagar estados innecesarios por prop-drilling en `App.jsx`. Utiliza custom hooks o contextos locales cuando la vista sea compleja.
- **Integridad de Datos en Supabase:** Toda consulta o mutación a la base de datos debe incluir manejo explícito de errores y validaciones en tiempo real antes de enviar.

## 2. Estándares de Usabilidad, UX y Micro-interacciones
- **Micro-feedback Inmediato:** Toda acción del usuario (guardar ficha médica, agendar cita, actualizar inventario, eliminar usuario) DEBE mostrar una notificación flotante (Toast) o respuesta visual instantánea.
- **Estados de Carga (Skeleton Loaders):** Queda estrictamente prohibido mostrar pantallas vacías o parpadeos durante la petición de datos. Muestra componentes tipo "Skeleton" mientras se hidrata el estado.
- **Navegación Eficiente y Cero Redundancia:**
  - Garantiza que la barra de búsqueda global y paleta de comandos (`Ctrl + K`) permitan saltar a cualquier módulo o paciente.
  - Elimina clics intermedios: si un flujo sugiere una venta tras el diagnóstico clínico, el sistema debe precargar los productos y abrir el modal de cobro directamente.
- **Formularios Flexibles y Adaptativos:**
  - En formularios extensos (como la Ficha Clínica), prioriza acordeones/bloques colapsables.
  - Muestra badges claros (`Registrado` / `No registrado`) para que el profesional distinga a primera vista el estado del expediente sin tener que abrir cada sección.
- **Impresión Cautiva y Privacidad:** Ofrece selectores (checkboxes) para controlar si se imprimen datos sensibles (como valores dióptricos/graduación) o solo el diagnóstico cualitativo.

## 3. Automatización de Flujos de Negocio
- **Transición Automática de Estados de Citas:**
  - Al abrir la ficha clínica desde una cita: actualizar estado automáticamente a `En Atención` (badge azul).
  - Al guardar la ficha médica: actualizar estado automáticamente a `Atendida` (badge verde).
  - Tolerancia de inasistencia: Citas no iniciadas tras 15 minutos del horario agendado deben marcarse automáticamente como `No asistió` (badge rojo), permitiendo edición manual.
- **Prevención de Duplicados (Deduplicación):** Exigir validación por Cédula/DNI + Fecha de Nacimiento en el portal web antes de crear un nuevo paciente, enlazando la cita al registro existente si coincide la identificación.
- **Priorización Visual del Inventario:** Ordenar las alertas de stock crítico considerando el límite mínimo por producto (`Existencias < Stock Mínimo`), permitiendo la edición/reabastecimiento en un solo clic desde el Dashboard.

## 4. Reglas de Testing y Calidad de Código
- Antes de dar por finalizada cualquier tarea, ejecuta la suite de tests unitarios (`npm test` o `vitest`) y verifica que todos los tests pasen (mínimo 78 tests passing).
- Asegúrate de que no existan errores ni advertencias crísticas en la consola del navegador durante la navegación entre módulos.