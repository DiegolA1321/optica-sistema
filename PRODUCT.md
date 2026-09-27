# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — staff de la óptica** (admin, asistente, optómetra): usan el panel de gestión (ficha clínica, citas, inventario, ventas/facturación, CRM, reportes) durante toda la jornada laboral. Necesitan velocidad, claridad y densidad de información sin saturar la interfaz — este es el uso que más debe pesar en cualquier decisión de UI para el panel principal.

**Secundarios:**
- **Pacientes** (portal de autoservicio / agendamiento público): necesitan simplicidad, confianza y lenguaje no técnico.
- **Superadmin** (Diego, panel interno de la plataforma): prioriza funcionalidad y claridad sobre estética. Este panel está activo y se mostrará en la defensa de tesis.
- **Dueños de óptica prospectos** (página de venta / funnel comercial multi-óptica): **fuera de alcance por ahora**. La capa SaaS multi-tenant (página de venta pública, formulario de solicitud, métricas de funnel) está implementada pero intencionalmente oculta — preservada para una futura comercialización, no es código muerto y no debe eliminarse. No proponer mejoras de diseño en esta superficie hasta que se reactive explícitamente.

## Product Purpose

Sistema web de gestión clínica, citas y CRM automatizado para una óptica — proyecto de tesis de titulación (Ingeniería en Sistemas de Información, Universidad Técnica de Manabí). El alcance actual del producto está acotado a **una sola óptica** ("Óptica Visión"), aunque la capa de infraestructura multi-tenant/SaaS ya existe por debajo, oculta, para una posible expansión futura.

Éxito para el alcance de tesis: cumplir y poder defender los compromisos del anteproyecto (historia optométrica digital, agendamiento con gestión de no-shows, módulo comercial/inventario, CRM automatizado con recordatorios) frente a evaluadores académicos, con evidencia real de funcionamiento (no solo mockups).

## Positioning

Unifica en un solo sistema lo que normalmente vive separado en una óptica: historia optométrica digital, agendamiento online con manejo de no-shows/reprogramaciones, módulo comercial/inventario ligado a la receta, y CRM automatizado con recordatorios reales (no solo un mensaje manual de WhatsApp). Respaldado por compromisos medibles del anteproyecto académico: reducción de no-shows 20–40% vía recordatorios multicanal, objetivo de usabilidad SUS ≥ 68.

## Operating Context

- Flujo clínico diario: apertura de ficha desde una cita (→ estado "En Atención"), diagnóstico, receta, venta de productos ligada a la consulta, facturación multi-línea, cierre de ficha (→ estado "Atendida").
- Citas no iniciadas 10 minutos después del horario agendado se marcan automáticamente "No asistió" (editable manualmente).
- Backend real: Supabase (Postgres + RLS), aislamiento multi-tenant por óptica ya construido (aunque solo una óptica está activa/visible en este alcance), autenticación con MFA (TOTP), cifrado a nivel de columna (pgcrypto) para datos clínicos sensibles, auditoría/logging, Sentry para monitoreo de errores.
- CRM con recordatorios automáticos reales (Resend + pg_cron + pg_net) y deep links manuales de WhatsApp como complemento.
- Suite de tests (Vitest + React Testing Library) con mínimo de tests pasando exigido antes de dar por terminada cualquier tarea (ver CLAUDE.md del repo); CI configurado.
- Desplegado en producción (Vercel), no solo entorno local.

## Capabilities and Constraints

**Construido y activo:**
- Backend real con RLS multi-tenant (aunque solo una óptica visible/comercializada en este alcance de tesis).
- MFA (Supabase Auth TOTP), cifrado de datos clínicos a nivel de columna, rate limiting, sesión con tokens, CSP, auditoría.
- Recordatorios automatizados por email (Resend + pg_cron), sin depender solo de WhatsApp manual.
- Portal de autoservicio de pacientes, agendamiento público sin cuenta.
- Capa comercial/SaaS multi-óptica: **implementada pero oculta a propósito** (no eliminar, no tratar como código muerto, no rediseñar sin pedido explícito).

**Deliberadamente no construido (decisión de Diego, no vacíos por descuido — no volver a proponerlos sin que él los traiga de nuevo):**
- SMS (Twilio) — el anteproyecto lo nombra explícitamente pero se sustituyó por email automatizado + WhatsApp manual.
- Modelo predictivo de no-shows (opcional en el anteproyecto).
- Soporte offline / service worker.

**Sin resolver, requiere decisión de Diego con su asesor (no asumir):**
- Módulo de teleoptometría / validación remota de agudeza visual — mencionado en el marco referencial del anteproyecto pero ambiguo si es un requisito literal.

**No es trabajo de código, no ofrecer "construirlo":**
- Prueba de usabilidad SUS ≥ 68 con usuarios reales (optómetra/paciente).
- Medición real de reducción de no-shows en un período de uso real.
- Diagramas de arquitectura/ER para el documento de tesis.

## Brand Commitments

La marca visible en este alcance es la de la óptica cliente real registrada en la base de datos: **"Óptica Solna Vision"** (slug `optica-solna`, id `b6eb867a-6b08-42c6-b493-27d139bed64e` — es la que resuelve `OPTICA_ID_DEFAULT` en `src/utilidades/opticaActual.js` para el despliegue de un solo tenant). El `<title>`/meta description de `index.html` ya refleja este nombre (corregido 2026-09-27; "Óptica Visión" fue un nombre descartado, no reabrir). La marca de la plataforma SaaS (para una eventual comercialización multi-óptica) queda **sin definir**, pendiente para el futuro — no inventar un nombre de plataforma.

## Evidence on Hand

- `Anteproyecto-Diego-Alarcon.pdf` en la raíz del repo: documento académico fuente de los compromisos que el sistema debe poder defender.
- Despliegue público real (Vercel), no solo entorno local.
- `src/assets/hero.png` es una imagen genérica de placeholder, no fotografía real de marca de "Óptica Visión" — no fabricar testimonios, casos de estudio ni fotografía de marca real que no exista.
- Credenciales de prueba (superadmin/óptica/paciente) ya compartidas para QA — no volver a pedirlas.

## Product Principles

1. El panel de staff (uso diario, alta frecuencia) prioriza velocidad y densidad de información clara por sobre la expresión visual; el portal de pacientes prioriza simplicidad y confianza; el panel de superadmin prioriza función sobre estética.
2. Toda promesa del anteproyecto académico debe poder demostrarse con el sistema real funcionando, no solo describirse — el anteproyecto es la vara de medir, no una sugerencia.
3. La capa SaaS multi-tenant es infraestructura preservada para el futuro, no una superficie activa hoy: no se rediseña, no se elimina, no se trata como si no existiera.
4. Ausencias deliberadas (SMS, modelo predictivo, offline) son decisiones tomadas, no huecos por completar — no se reabren sin que Diego lo pida.

## Accessibility & Inclusion

Objetivo: WCAG 2.2 nivel AA, sin certificación formal exigida. Prioridades explícitas:
- Contraste mínimo 4.5:1 en texto, 3:1 en componentes de interfaz.
- Navegación completa por teclado.
- Foco visible en todo momento.
- El estado nunca se comunica solo con color (ej. badges de estado de citas/fichas deben tener también texto/ícono, no solo color).
