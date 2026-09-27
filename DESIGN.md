---
name: Sistema Óptica
description: "Ve el mundo con claridad — panel clínico, de citas y CRM para una óptica, con un portal público de venta/agendamiento."
colors:
  ink: "#0E2B33"
  porcelain: "#F7F5F0"
  gold: "#C8A24E"
  action-blue: "#2563EB"
  action-blue-deep: "#1D4ED8"
  action-blue-soft: "#EFF6FF"
  signature-cyan: "#22D3EE"
  success-emerald: "#059669"
  success-emerald-deep: "#047857"
  success-emerald-soft: "#ECFDF5"
  danger-red: "#DC2626"
  danger-red-deep: "#B91C1C"
  danger-red-soft: "#FEF2F2"
  warning-amber: "#F59E0B"
  warning-amber-soft: "#FFFBEB"
  tag-purple: "#A855F7"
  tag-pink: "#EC4899"
  neutral-ink-text: "#334155"
  neutral-muted-text: "#64748B"
  neutral-surface: "#F8FAFC"
  neutral-border: "#E2E8F0"
typography:
  display:
    fontFamily: "Newsreader, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2.25rem, 2vw + 2rem, 3.75rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Newsreader, Georgia, 'Times New Roman', serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.action-blue-deep}"
  button-danger:
    backgroundColor: "{colors.danger-red}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-danger-hover:
    backgroundColor: "{colors.danger-red-deep}"
  badge-success:
    backgroundColor: "{colors.success-emerald-soft}"
    textColor: "{colors.success-emerald-deep}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  card:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.xl}"
    padding: "24px"
  input:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-ink-text}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
---

# Design System: Sistema Óptica

## Overview

**Creative North Star: "The Clinic in Porcelain and Ink"**

Sistema Óptica reads as a clean, editorial clinical tool: warm porcelain and white surfaces, deep-navy ink for authority and text, a single restrained gold accent for the rare premium moment, and one saturated cyan→blue gradient reserved for identity marks (avatars, the active nav item, the brand tile). It is not a flat SaaS grey dashboard and not a clinical-sterile white box — the serif display face (Newsreader) on page titles, hero copy, and KPI numbers gives it an editorial, slightly upscale "boutique óptica" character over a otherwise plain, dense, utilitarian Public Sans UI.

The system is actually two coherent voices sharing one token set. **Operate** (everything behind login: the staff panel shell, every clinical/inventory/CRM page, the patient portal) is dense, flat-white-card, high-frequency-use software — spacing is tight, borders are hairline, and color is used almost exclusively as semantic signal (status badges), not decoration. **Persuade** (the public marketing/booking pages — `Login.jsx`'s hero and `PaginaVenta.jsx`) loosens up: italic serif headlines, soft blurred radial-gradient orbs behind the hero, glowing gradient CTAs. Both pull from the same INK/PORCELAIN/GOLD/GRAD vocabulary; Persuade just turns the volume up on it.

Confirmed rejection, stated directly in the code: a dark hero on any public-facing page. `Login.jsx` and `PaginaVenta.jsx` both comment that a dark tone "contradice el mensaje de claridad" — INK is chrome (headers, footers, the login modal band, selected calendar cells), never the surface a visitor lands on.

**Key Characteristics:**
- Warm porcelain/white surfaces with deep-navy ink for text and chrome, never the reverse on a public-facing hero.
- Newsreader serif for anything that should feel like a headline or a hero number; Public Sans for everything functional.
- Status is always communicated through a soft pastel badge (50-shade background, 700-shade text), never a bare color dot.
- One signature gradient (cyan → blue) marks identity: avatars, the active sidebar item, the brand tile — not general decoration.
- Gold is a single accent used sparingly (a small dot, one highlighted callout card) — never a fill, never a large surface.

## Colors

Palette is small and role-driven: two brand neutrals (ink/porcelain), one scarce accent (gold), one signature gradient, and Tailwind's stock blue/emerald/red/amber/purple/pink used consistently as semantic roles rather than as decoration.

### Primary
- **Ink** (`#0E2B33`): the brand's dark tone. Applied via inline `style` from `src/lib/tema.js`'s `INK` constant (not a Tailwind class, not a CSS custom property) to page titles, hero copy on light surfaces, and dark chrome bars (header/footer bands, the login modal top band, selected day in the appointment calendar). Never the background of a public hero section.
- **Porcelain** (`#F7F5F0`): the brand's warm light surface, also from `tema.js`. Used for hero backgrounds on public pages and as text-on-ink.
- **Action Blue** (`#2563EB`, deep `#1D4ED8`, soft `#EFF6FF`): the default interactive color — primary buttons, links, focused inputs (`focus:border-blue-500 focus:ring-2 focus:ring-blue-50`), "info"/in-progress badges.

### Secondary
- **Gold** (`#C8A24E`): "acento óptico premium, usar con moderación" per its own source comment. Confirmed sparse in practice — used in only 6 of 22 page files, always as a small dot, border, or single highlighted callout (e.g. a gold-tinted stock-alert card on the dashboard), never as a large fill.
- **Signature Cyan→Blue Gradient** (`linear-gradient(135deg, #22D3EE, #2563EB)`): copy-pasted as a local `GRAD` constant in 14+ page files (not centralized in `tema.js`, unlike INK/PORCELAIN/GOLD — an observed inconsistency, not something this pass changes). Marks identity and active state specifically: user-initial avatars, the brand/logo tile, the active sidebar nav item, and glowing marketing CTAs (paired with a colored `box-shadow` echoing the gradient's hue).

### Tertiary — categorical tag palette
A 6-hue rotation (`blue`, `emerald`, `amber`, `purple` `#A855F7`, `pink` `#EC4899`, `cyan`) used specifically to color-code appointment "motivo" tags in `Citas.jsx`, each with its own soft-badge pairing. This is a distinct, smaller use case from the semantic status colors below even where hues overlap.

### Neutral
- **Neutral Ink Text** (`#334155`, slate-700): default body/label text on white or porcelain surfaces.
- **Neutral Muted Text** (`#64748B`, slate-500): secondary/meta text, placeholder-weight copy.
- **Neutral Surface** (`#F8FAFC`, slate-50): the app shell background, filled-input background at rest, sidebar tint.
- **Neutral Border** (`#E2E8F0`, slate-200): the near-universal card/input/divider border — almost always applied at reduced opacity (`border-slate-200/60`) rather than full strength, giving the hairline look rather than a hard line.

### Named Rules
**The Light Hero Rule.** Any surface a visitor lands on unauthenticated (`Login.jsx` hero, `PaginaVenta.jsx`) stays on Porcelain or white. Ink is for chrome (bars, bands, selected states) and text, never the primary background of a persuasive first screen.

**The Soft Badge Rule.** Every status, category, or state indicator pairs a `{color}-50` background with `{color}-700` text and a `{color}-100/200` border at reduced opacity — never a solid-fill badge, never a bare color dot standing alone as the only signal (a label or icon always accompanies the color, satisfying the project's own "never color-only" accessibility commitment).

**The Sparse Gold Rule.** Gold marks exactly one premium moment per screen at most — a dot, a border, a single highlighted card. It is never a background fill and never repeats more than once in the same view.

## Typography

**Display/Title Font:** Newsreader (with Georgia, Times New Roman fallback)
**Body/Label Font:** Public Sans (with system-ui fallback)
**Wordmark Font:** Sora — reserved almost exclusively for the "Sistema Óptica" logo wordmark in `PaginaVenta.jsx`'s header/footer (2 occurrences total); not a general heading font despite being wired as `font-heading` in `index.css`.

**Character:** An editorial serif carries every moment that should feel like a headline, a hero statement, or a headline number, dropped into an otherwise plain, dense, high-legibility sans-serif UI. The pairing reads as "boutique clinic," not "generic dashboard."

### Hierarchy
- **Display** (weight 600, `clamp(2.25rem, 2vw + 2rem, 3.75rem)`, line-height 1.1, *italic*): the `PaginaVenta`/`Login` hero headline only. Italic is what separates Persuade-mode display type from the in-app Title role below — confirmed distinct by exact code inspection, not inferred.
- **Title** (weight 700, 24px/1.5rem, line-height 1.25, tracking `-0.01em`, upright): every in-app page `<h1>` ("Citas médicas", "CRM y fidelización", "Ficha clínica", …) and every large KPI number (appointment counts, revenue figures) — the same serif/weight/size pair does double duty as both page heading and hero statistic, in Ink.
- **Body** (weight 400, 14px, line-height 1.5): the dominant UI text size — table cells, form values, descriptions, card copy.
- **Label** (weight 700, 11px, letter-spacing `0.08em`, uppercase, `neutral-muted-text` or a semantic color): section eyebrows, KPI captions, and any small all-caps tag (e.g. "Módulo clínico activo", "Óptica suspendida").

### Named Rules
**The Serif Authority Rule.** Newsreader appears only on things that assert or headline: hero copy, page `<h1>`s, and standalone KPI numbers. Everything else — labels, body copy, table data, form fields, buttons — stays in Public Sans. Mixing serif into a body sentence or a button label does not happen anywhere in the current system.

## Layout

The staff panel is a fixed-sidebar shell: a 288px (`w-72`) left sidebar (`bg-slate-50/80`, hairline right border) that collapses on smaller viewports, with a scrollable main content area on `neutral-surface` (`bg-slate-50`) holding a stack of white cards. Content is not width-capped inside the panel — cards fill the available column and rely on internal grid/flex layout (commonly `grid-cols-1 sm:grid-cols-3` for KPI rows) rather than a fixed container width.

Public pages (`PaginaVenta.jsx`) use a classic marketing container: `mx-auto max-w-6xl` with generous vertical rhythm (`pt-16 pb-24` on the hero, growing on `md:`).

Card padding is consistently generous relative to the density of the data inside: `p-5`/`p-6` for standard panels, `p-6 sm:p-8` for hero/summary panels. Interactive elements (buttons, inputs) use a tighter `py-2/2.5` vertical rhythm. Modals cap at `max-h-[85vh]` or `max-h-[60vh]` with internal `overflow-y-auto` rather than growing past the viewport — confirmed deliberate (not every modal in the system respects this, but it is the established, intended pattern for new ones).

A command palette (`Ctrl/Cmd+K`) and a global search live in the sidebar header, both opening the same rounded-2xl white modal pattern described under Components.

## Elevation & Depth

Mostly flat with light, situational shadow — not a layered elevation system with named tokens. Cards rest at `shadow-sm` (a barely-there lift off the slate-50 background) and gain `shadow-lg` plus a `-translate-y-0.5` nudge only on hover when the card itself is a clickable action tile (e.g. the Inicio.jsx quick-action grid). Modals and open dropdowns jump straight to `shadow-2xl` — there is no intermediate step between resting-card and floating-surface elevation.

Persuade-mode CTAs break from this: gradient buttons carry a colored, diffuse glow shadow tinted to match the gradient (e.g. `0 16px 32px -12px rgba(37,99,235,0.6)`) rather than a neutral drop shadow — the glow is treated as part of the gradient's identity, not generic elevation.

### Shadow Vocabulary
- **Resting card** (`shadow-sm`): default state for any white card/panel.
- **Hover-lift** (`shadow-lg` + `-translate-y-0.5`): clickable card tiles only, on hover.
- **Floating surface** (`shadow-2xl`): modals, open dropdown/menu panels.
- **Gradient glow** (`0 Npx 24-32px -8/-12px rgba(<gradient hue>, 0.5-0.6)`): reserved for GRAD-background elements (primary marketing CTAs, the brand tile).

### Named Rules
**The Two-Step Rule.** There is no mid-elevation state. A surface is either a resting card (`shadow-sm`) or a floating one (`shadow-2xl`) — nothing fills the gap, so a new elevated surface should pick one of those two, not invent a `shadow-md` moment.

## Shapes

Radius is the primary shape signal — there are no hard corners anywhere in the system outside of table row dividers. The scale, from actual usage:
- **`rounded-md`/`rounded-lg`** (8–12px): small chips, category tags, compact buttons, table-skeleton bars.
- **`rounded-xl`** (16px): the default for inputs, icon tiles, and most buttons and small cards.
- **`rounded-2xl`** (24px): the default for standard content cards, modals, and skeleton placeholders that stand in for them.
- **`rounded-3xl`** (32px, via arbitrary Tailwind scale): hero panels and the largest summary cards only.
- **`rounded-full`**: avatars, initials circles, status dots, and lifecycle-state badges (as opposed to category-tag badges, which use `rounded-md`).

Borders are near-universally hairline and translucent (`border-slate-200/60`, i.e. the neutral border color at 60% opacity) rather than solid — this is what gives cards their "barely there" separation from the porcelain/slate-50 background instead of a hard outline.

## Components

### Buttons
- **Shape:** `rounded-lg`/`rounded-xl` (12–16px), never sharp, never fully pill-shaped except icon-only circular buttons.
- **Primary (in-app action):** solid semantic fill — `action-blue` for the default/save action, `success-emerald` for confirm, `danger-red` for destructive — white text, `font-semibold`, hover darkens one Tailwind step (e.g. `blue-600 → blue-700`).
- **Primary (marketing CTA):** the signature gradient fill (`GRAD`) with a matching colored glow shadow, white text, `hover:-translate-y-0.5`.
- **Disabled:** `opacity-50/60` plus `cursor-not-allowed`; no separate disabled color.
- **Ghost/tertiary:** transparent background, `text-slate-500` → `hover:bg-{color}-50 hover:text-{color}-600`, used for row-level actions (ver/editar/eliminar) — see `ACCION_VER`/`ACCION_EDITAR`/`ACCION_CONFIRMAR`/`ACCION_ELIMINAR` in `tema.js` for the canonical set.

### Badges / Chips
- **Lifecycle state** (appointment/record status — "En Atención", "Atendida", "No asistió", confirmed/pending): `rounded-full`, soft-badge pairing (`bg-{color}-50 text-{color}-600/700 border-{color}-100/200`), always paired with a text label.
- **Category tag** (appointment "motivo"): `rounded-md`, same soft-badge pairing, drawn from the 6-hue tertiary palette.
- **Eyebrow/status pill** (marketing page, e.g. "Gestión clínica y de citas para ópticas"): `rounded-full`, white or near-white background, `border-slate-200`, uppercase label text, often with a small colored dot (frequently gold) as the only color accent.

### Cards / Containers
- **Corner Style:** `rounded-2xl` standard, `rounded-3xl` for hero/summary panels.
- **Background:** white, on a `slate-50`/porcelain page background.
- **Shadow Strategy:** `shadow-sm` resting; see Elevation & Depth.
- **Border:** `border-slate-200/60`, always present even on white-on-slate-50 cards.
- **Internal Padding:** `p-5`/`p-6` standard, `p-6 sm:p-8` for hero-weight panels.

### Inputs / Fields
- **Style:** filled, not outlined at rest — `bg-slate-50` fill, `border-slate-200/60`, `rounded-xl` (or `rounded-lg` in denser forms), `text-sm`.
- **Focus:** background lifts to white and the border shifts to `blue-500`, paired with a soft `ring-2 ring-blue-50` — a background + border + ring combination, not a single treatment.
- **Error:** border shifts to `red-400`, focus border/ring shift to `red-500`/`red-100` — same structure as the default focus state, just re-colored, so the pattern stays recognizable under error.

### Navigation
- **Sidebar:** dark-on-light isn't used here — the sidebar itself sits on `bg-slate-50/80` (matching the shell, not a separate dark rail); items are `rounded-xl`, `text-slate-700`, and the active item gets the signature gradient fill with white text rather than a simple highlight color.
- **Top bar:** `bg-white/80` with `backdrop-blur-md`, hairline bottom border; houses global search, notifications, and the user menu.
- **Mobile:** sidebar collapses behind a toggle; no separate mobile nav pattern observed (same components, responsive width behavior).

### Skeleton Loaders (signature component)
Every loading state reuses one language: `animate-pulse` over `bg-slate-200/70` (or `/60` for a visually lighter secondary line), shaped to exactly match what it's replacing — `rounded-2xl` blocks for cards, `rounded-full` circles for avatars, short `rounded` bars for text lines. Never a generic gray rectangle unrelated to the real content's shape. This is an explicit, source-commented rule (`TablaSkeleton.jsx`): "reusa el mismo lenguaje visual... en vez de inventar uno nuevo."

## Do's and Don'ts

### Do:
- **Do** apply `INK`/`PORCELAIN`/`GOLD` via the `src/lib/tema.js` constants (inline `style`, or the `font-heading`/`ACCION_*` helper exports it also carries) — this is the system's actual source of truth for brand color, not the Tailwind theme.
- **Do** pair every status/state color with a text label, never a bare colored dot as the sole signal.
- **Do** use `rounded-full` for lifecycle-state pills and avatars, `rounded-md`/`rounded-lg` for category tags and compact controls, `rounded-xl`/`2xl`/`3xl` for the card scale — pick from this existing scale rather than a new radius value.
- **Do** keep public-facing hero surfaces on Porcelain/white; reserve Ink for chrome bars and in-app accents.
- **Do** reuse the `animate-pulse` + shape-matched `bg-slate-200/70` skeleton pattern for any new loading state.

### Don't:
- **Don't** reach for `@/components/ui/button` or `@/components/ui/dialog` as a base for new UI — both are unused shadcn scaffolding (confirmed by import search: nothing in `src/paginas` or `src/componentes` imports either). Every real button and modal in the live system is hand-rolled Tailwind per-page; that hand-rolled vocabulary above is the actual system, not the shadcn primitives sitting in the repo.
- **Don't** rely on the Tailwind theme's `--color-primary`/`--color-background` custom properties (in `src/index.css`) for brand color — they carry shadcn's generic default palette and are not wired to INK/PORCELAIN/GOLD anywhere in the live pages.
- **Don't** put a dark (Ink) background on a page a first-time, unauthenticated visitor lands on — confirmed explicit rejection in both `Login.jsx` and `PaginaVenta.jsx`.
- **Don't** use the signature cyan→blue gradient as generic decorative fill — it is reserved for identity/active-state marks (avatars, active nav, brand tile, marketing CTA glow).
- **Don't** introduce a solid-fill badge or a mid-tone shadow between `shadow-sm` and `shadow-2xl` — both break the two established patterns (soft badges; two-step elevation) documented above.
