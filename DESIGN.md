# Design System: PortSight Executive Summary (Beranda Keuangan — Pelindo Regional 4)

> **Scope:** Fitur **Summary / Beranda Eksekutif** pada aplikasi *PortSight — Dashboard BOD Pelindo Regional 4*.
> Dokumen ini berfungsi sebagai *single source of truth* berbasis bahasa desain semantik untuk **Google Stitch** maupun implementasi frontend produksi.

---

## 1. Visual Theme & Atmosphere

A disciplined, high-clarity **Maritime Executive Financial Cockpit** designed for Board of Directors decision-making. The atmosphere feels like a quiet, sun-lit port command briefing room — architectural, precision-calibrated, and free of visual noise. Surface contrast relies on razor-thin structural hairlines and cool slate-to-porcelain layering rather than heavy drop shadows or decorative gradients. Every pixel earns its place by accelerating scan speed from executive KPIs to branch-level outliers.

- **Density:** `7 / 10` — *Balanced-to-Cockpit Executive* (high information yield without claustrophobia; zero wasted sidebar real estate).
- **Variance:** `6 / 10` — *Structured Asymmetric Bento* (deliberate weighted grid ratios that emphasize analytical priority over cookie-cutter symmetry).
- **Motion:** `5 / 10` — *Fluid Tactile CSS & Restrained Micro-Motion* (spring-weighted reveals and subtle live-status pulse; never distracting during financial review).

---

## 2. Color Palette & Roles

Stick strictly to one unified **Cool Slate** neutral family across light and dark themes — zero warm/cool gray mixing, zero pure black (`#000000`), and zero AI purple/neon gradients.

### Primary UI Chrome & Neutrals (Light Executive Mode — Default)
- **Porcelain Canvas** (`#F8FAFC`) — Primary application canvas behind cards and filter bar.
- **Crisp Paper Surface** (`#FFFFFF`) — Elevated KPI cards, chart containers, and filter popovers.
- **Subtle Slate Well** (`#F1F5F9`) — Inset filter wells, inactive control surfaces, and hover fills.
- **Charcoal Ink** (`#0F172A`) — Primary headings, KPI headline numerals, and active branch labels (never `#000000`).
- **Graphite Body** (`#334155`) — Secondary labels, axis ticks, and table/tooltip body values.
- **Muted Steel** (`#64748B`) — Metadata units (`Dalam Juta Rupiah`, `Urutan Terendah ke Tertinggi`), subtitles, and inactive icons.
- **Whisper Hairline** (`#E2E8F0`) — `1px` card borders, chart gridlines, and structural separators.

### Primary UI Chrome & Neutrals (Dark Briefing Mode)
- **Obsidian Slate** (`#0B1120`) — Primary dark canvas (deep maritime slate, never `#000000`).
- **Midnight Hull Surface** (`#111827`) — Elevated KPI and chart card surfaces.
- **Steel Deck Well** (`#1E293B`) — Filter inputs, popovers, and hover states.
- **Cloud Chalk** (`#F1F5F9`) — Primary headings and headline numerals.
- **Cool Silver** (`#94A3B8`) — Secondary text, subtitles, and axis ticks.
- **Night Hairline** (`#1E293B` / `rgba(148, 163, 184, 0.16)`) — Subtle `1px` structural borders.

### Singular UI Accent (Saturation Strictly `< 80%`)
- **Harbor Cobalt** (`#295CA8`, HSL `216° 61% 41%`) — The **only** interactive UI accent for active navigation indicators, primary focus rings, active filter chips, drilldown links, and primary buttons.
- **Harbor Cobalt Tint** (`rgba(41, 92, 168, 0.10)`) — Subtle active chip fill and hover tint.

### Semantic Financial Status Cues (Text & Status Pills Only)
- **Favorable Pine** (`#15803D` light / `#4ADE80` dark) — Positive YoY/RKA achievement (`>= 100%` for Pendapatan/Laba; `<= 100%` for Beban) and `Efisien` BOPO status badge.
- **Caution Amber** (`#B45309` light / `#FBBF24` dark) — `Moderat` BOPO threshold (`75%–85%`).
- **Deficit Crimson** (`#B91C1C` light / `#F87171` dark) — Negative financial deltas, `Waspada` BOPO status (`> 85%`), and negative PJM profit bars.

### Locked Data-Visualization Entity Palette (Charts & Inline Legends Only)
Used exclusively inside stacked bars, donut slices, and compact inline chart legends — never for UI chrome or buttons:
- **CABANG — Maritime Blue** (`#2563EB`)
- **PJM — Signal Emerald** (`#16A34A`)
- **PMT — Cool Slate** (`#94A3B8`)
- **PSL — Ochre Gold** (`#CA8A04`)
- **PTP — Harbor Terracotta** (`#F97316`)

---

## 3. Typography Rules

Dashboards strictly prohibit Serif fonts and ban `Inter`. Typography pairs a sharp geometric/neo-grotesque sans-serif with a crisp tabular monospace for financial precision.

- **Display & Section Headings:** `Satoshi` (fallback: `Geist`, `Plus Jakarta Sans`) — Tight tracking (`-0.025em`), controlled scale via `clamp()`, weight-driven hierarchy (`700`–`800`) rather than oversized screaming headers.
  - Page Title (`H1`): `clamp(1.125rem, 1.4vw, 1.375rem)`, weight `800`, Charcoal Ink (`#0F172A`).
  - Chart Card Title (`H2`): `0.875rem` (`14px`), weight `800`, tight line-height `1.25`.
- **Body & Controls:** `Satoshi` (fallback: `Geist`, `Plus Jakarta Sans`) — Minimum `0.875rem` (`14px`) for primary readable copy, `0.75rem` (`12px`) only for chart axes and micro-units, relaxed line-height (`1.5`), maximum `65ch` measure for explanatory notes.
- **Financial Numerals & High-Density Metrics (Mandatory Monospace):** `JetBrains Mono` (fallback: `Geist Mono`) with `font-variant-numeric: tabular-nums` enforced across **every** KPI value, Rupiah currency figure, BOPO percentage, YoY/RKA delta, and chart data label:
  - KPI Primary Numeral: `clamp(1.375rem, 1.8vw, 1.625rem)`, weight `700`, tracking `-0.02em`.
  - KPI YoY / RKA Sub-metrics: `0.75rem` (`12px`), weight `600`.
  - Chart Data Labels: `0.6875rem` (`11px`), weight `600`.
- **Strictly Banned Fonts:** `Inter`, `Roboto`, `Arial`, and all Serif fonts (`Times New Roman`, `Georgia`, `Garamond`, `Fraunces`).

---

## 4. Screen Anatomy & Component Stylings (Fitur Summary)

### A. Sticky Horizontal Executive Filter Bar (Replaces Legacy Left Slicer)
- **Container:** Full-width single-row crisp white bar (`#FFFFFF`), `1px` Whisper Hairline border (`#E2E8F0`), `14px` rounded corners (`0.875rem`), subtle tinted shadow (`0 1px 3px rgba(15, 23, 42, 0.04)`), sticky below the topbar (`top: 68px`).
- **Controls (Left-Aligned, Asymmetric Grouping):**
  1. `Tahun` compact select dropdown (`40px` height on desktop, `44px` on touch).
  2. `Bulan` compact select dropdown (`Januari`–`Desember`).
  3. `Cabang / Terminal` searchable multi-select trigger button displaying active count (e.g., `Semua Cabang (19)` or `Makassar, Balikpapan`) opening a clean `300px` popover with search input, `Pilih Semua` / `Hapus` actions, and checkable branch rows.
  4. **Right Utility Cluster:** `Terverifikasi` toggle pill (with restrained perpetual live-green pulse dot when active), `Bandingkan` outline trigger, `Reset`, and icon-only `Refresh`.
- **Active Filter Chips Row:** Appears cleanly beneath a `1px` top hairline only when a subset of branches is active; removable Harbor Cobalt-tinted pills with `Hapus Semua`.
- **No View-Mode Toggle:** All KPI cards and analytical charts remain visible together at all times (never hide cards or charts behind `Semua | Kartu | Grafik` tabs).

### B. Executive KPI Ribbon (4 Harmonized Cards)
- **Grid:** `4` columns on desktop (`>= 1280px`), `2x2` on tablet (`<= 1024px`), single column on mobile (`<= 640px`), `14px` gap.
- **Card Anatomy:** Crisp Paper Surface (`#FFFFFF`), `1px` Whisper Hairline border, `14px` rounded corners, `16px 18px` padding, subtle slate-tinted shadow (`0 2px 8px rgba(15, 23, 42, 0.04)`). Zero inner nested cards.
- **4 Mandatory Cards:**
  1. **PENDAPATAN** — Subtle top accent hairline (`2px` Harbor Cobalt `#295CA8`), monospace value (e.g., `Rp 4,82 T`), dynamic YoY (`106,42%`) and RKA (`101,85%`) inline sub-metrics.
  2. **LABA AREA** — Monospace value (e.g., `Rp 1,37 T`), Favorable Pine when positive or Deficit Crimson when negative, dynamic YoY and RKA sub-metrics.
  3. **BEBAN** — Monospace value (e.g., `Rp 3,45 T`), inverted lower-is-better semantic coloring for YoY and RKA (`<= 100%` green, `> 100%` red).
  4. **BOPO** — Uppercase label + dynamic status pill in top-right (`Efisien` `< 75%`, `Moderat` `75%–85%`, `Waspada` `> 85%`), monospace percentage (e.g., `71,58%`), concise threshold subtitle (`Beban / Pendapatan Area`).

### C. 2-Row Asymmetric Bento Analytical Grid
Never use generic 3-column equal card rows. Every row communicates analytical priority through unequal column tracks:

- **Row 1 — Comparative Revenue & Profit Leaders (`1.04fr : 0.96fr` Asymmetric Split on Wide Desktop, `1fr` `< 1024px`):**
  1. **Top 10 Laba Area per Cabang:** Horizontal stacked bar chart (`CABANG`, `PJM`, `PMT`, `PSL`, `PTP`), unit subtitle `Dalam Miliar Rupiah (Rp)`, crisp `Detail →` hairline button in header for modal drilldown, compact `<ChartInlineLegend />` anchored beneath.
  2. **Top 10 Pendapatan Area per Cabang:** Horizontal stacked bar chart using the exact same 5-entity palette, `Detail →` drilldown button, compact inline legend beneath.

- **Row 2 — Efficiency, Entity Mix & PJM Risk (`1.25fr : 0.85fr : 1.05fr` Weighted Asymmetric Split):**
  3. **BOPO Area per Cabang (All Branches, Scrollable Card, Ascending):** Displays **all** branches immediately (no `Top 10 | Semua` toggle) inside a bounded `300px` vertically scrollable container with thin slate scrollbar, sorted **ascending** by percentage (most efficient / lowest BOPO at the top), subtle vertical dashed gridlines, right-aligned monospace `%` data labels.
  4. **Kontribusi Laba per Entitas (Donut Chart):** Clean ring donut (`innerRadius: 54`, `outerRadius: 92`, `1.5px` card-colored slice separation) with a centered KPI readout (`TOTAL LABA` + monospace figure) and compact inline legend showing exact rounded percentages per entity.
  5. **10 Cabang Terendah Laba PJM (Horizontal Risk Bar, Ascending):** Right-anchored Y-axis with Deficit Crimson bars extending leftward, sorted **ascending by Rp Juta** so the lowest profit / deepest loss sits immediately at the top for instant BOD attention.

### D. Interactive Controls & States
- **Buttons:** Flat architectural fill or `1px` Whisper Hairline outline. Tactile `translateY(-1px)` on hover and `scale(0.98)` press feedback on active. Zero neon outer glows, zero custom cursors. Primary CTA (maximum 1 per toolbar context) uses Harbor Cobalt (`#295CA8`) with white text.
- **Inputs & Dropdowns:** Explicit label above or crisp prefix label inside toolbar slot; `2px` Harbor Cobalt focus ring (`outline-offset: 2px`). Never use floating Material-style labels.
- **Tooltips (Charts):** Frosted high-contrast surface matching active theme, `1px` border, `10px` radius, `0 10px 24px rgba(15, 23, 42, 0.14)`, tabular monospace numbers aligned right against muted left labels.
- **Loading States:** Dimension-matched **skeletal shimmer blocks** mimicking the exact 4-KPI ribbon and 2-row Bento card heights. **Circular spinners are strictly banned.**
- **Empty States:** Composed minimal architectural illustration (clean geometric SVG port/chart line graphic) + clear action copy ("Tidak ada data pada filter aktif") + single `Reset Filter` button. Never dump raw `"No data"` text.
- **Error States:** Inline left-bordered crimson callout bar inside the Summary workspace with clear Indonesian error message and a single `Muat Ulang` button.

---

## 5. Layout & Responsive Principles

- **CSS Grid First:** All KPI ribbons and Bento rows use native CSS Grid (`minmax(0, 1fr)`). Zero flexbox `calc()` percentage hacks.
- **Viewport & Containment:** Workspace container constrained to `max-width: 1440px`, centered, using `min-h-[100dvh]` (never `h-screen`). Generous internal card padding (`16px`–`18px`) and `14px`–`16px` grid rhythm.
- **Zero Overlapping Zones:** Text never overlaps charts, badges, or icons; chart labels have dedicated right/left margins (`right: 54px` for BOPO `%`, `left: 86px` for PJM negative labels).
- **Responsive Breakpoints:**
  - `>= 1280px`: 4-col KPI ribbon + 2-col Row 1 + asymmetric 3-track Row 2 (`1.25fr 0.85fr 1.05fr`).
  - `1025px – 1279px`: 4-col KPI ribbon + 2-col Row 1 + 2-col wrapped Row 2 (PJM full-width below BOPO + Donut).
  - `768px – 1024px`: 2x2 KPI grid + single-column chart stack.
  - `< 768px` (**Strict Mobile Collapse**): Every grid collapses to **1 column**, zero horizontal overflow (`overflow-x: hidden`), all interactive buttons/inputs meet `44px` minimum touch target, desktop sidebar collapses to slide-over drawer + thumb-friendly bottom nav.

---

## 6. Motion & Interaction Philosophy

- **Physics Signature:** Spring-weighted transitions (`stiffness: 100, damping: 20`, CSS cubic-bezier equivalent `cubic-bezier(0.22, 1, 0.36, 1)`) — decisive and weighty, never bouncy or linear.
- **Staggered Cascade Reveal:** On initial load or period change, KPI cards and Bento panels reveal in a crisp `40ms` staggered waterfall (`opacity: 0 → 1`, `translateY(8px) → 0`).
- **Perpetual Restrained Micro-Interactions:**
  - Active `Terverifikasi` status indicator carries a slow, calm opacity pulse (`2.4s ease-in-out infinite`).
  - Skeletal loading cards run a continuous left-to-right translucent slate shimmer (`1.6s infinite`) using `transform: translateX()`.
- **Hardware-Accelerated Performance:** Animate **exclusively** via `transform` and `opacity`. Never animate `width`, `height`, `top`, or `left`. Respect `@media (prefers-reduced-motion: reduce)` by disabling motion instantaneously.

---

## 7. Anti-Patterns (Strictly Banned — NEVER DO)

- **No Emojis Anywhere:** Never use emojis in headings, KPI cards, filter pills, tooltips, or empty states — use crisp `1.75px`-stroke vector icons (`Lucide`) only.
- **No `Inter` Font & No Serif Fonts:** `Inter`, `Roboto`, `Georgia`, `Times New Roman`, and decorative serifs are banned across the entire Summary screen.
- **No Pure Black (`#000000`):** Always use Charcoal Ink (`#0F172A`) in light mode and Obsidian Slate (`#0B1120`) in dark mode.
- **No AI Purple / Neon Glows:** Zero purple accents, zero neon outer box-shadows, zero multi-stop rainbow gradients on text or cards.
- **No Generic 3-Column Equal Card Grids:** Row 2 must use deliberate asymmetric track weights (`1.25fr : 0.85fr : 1.05fr`), never `repeat(3, 1fr)`.
- **No Circular Loading Spinners:** Always render layout-matched skeletal shimmer placeholders.
- **No Fake Round Placeholder Numbers:** Never mock `50%`, `100%`, `99.99%`, or `Rp 1,00 T` — always use realistic Pelindo Regional 4 financial figures (`Rp 4,82 T`, `71,58%`, `-Rp 412,60 Jt`) and real branch names (`Makassar`, `Balikpapan`, `Bitung`, `Samarinda`, `Ambon`, `Sorong`, `Jayapura`, `Pantoloan`, `Kendari`, `Parepare`).
- **No Nested Cards-Inside-Cards:** Keep card depth strictly flat (1 surface elevation layer per Bento panel).
- **No Overlapping Elements or Filler Copy:** Zero "Scroll to explore" hints, zero bouncing chevrons, zero AI marketing clichés ("Elevate", "Seamless", "Unleash", "Next-Gen").

---

## 8. Google Stitch Generation Prompt (Ready to Paste)

```text
Follow DESIGN.md strictly. Design the desktop (1440px) Executive Summary ("Beranda Keuangan") screen for PortSight — Pelindo Regional 4 BOD Financial Dashboard in Light Executive Mode.

Layout from top to bottom inside the main content workspace (beside a slim 240px Slate left sidebar and a minimal 60px topbar showing breadcrumb "Eksekutif / Ringkasan Keuangan" on the left and notification bell, theme toggle, and executive profile pill on the right):
1. Sticky horizontal Executive Filter Bar with Tahun ("2026"), Bulan ("September"), searchable Cabang multi-select ("Semua Cabang (19)"), active "Terverifikasi" pill with subtle green pulse dot, "Bandingkan", "Reset", and refresh icon.
2. Harmonized 4-column KPI Ribbon in tabular JetBrains Mono: Pendapatan ("Rp 4,82 T", YoY 106,42%, RKA 101,85%), Laba Area ("Rp 1,37 T", YoY 111,28%, RKA 104,12%), Beban ("Rp 3,45 T", YoY 98,14%, RKA 97,60%), and BOPO ("71,58%" with green "Efisien" status badge).
3. Row 1 Asymmetric Bento (1.04fr : 0.96fr): "Top 10 Laba Area per Cabang" and "Top 10 Pendapatan Area per Cabang" horizontal stacked bar charts across 5 locked entity colors (CABANG #2563EB, PJM #16A34A, PMT #94A3B8, PSL #CA8A04, PTP #F97316) with "Detail" drilldown buttons and compact inline legends.
4. Row 2 Asymmetric Bento (1.25fr : 0.85fr : 1.05fr):
   - Left: "BOPO Area per Cabang" showing all 19 Regional 4 branches inside a 300px scrollable card, sorted ascending from lowest/most efficient BOPO percentage at top, with tabular % data labels.
   - Center: "Kontribusi Laba per Entitas" ring donut chart with "TOTAL LABA / Rp 1,37 T" centered inside the ring and compact inline entity legend below.
   - Right: "10 Cabang Terendah Laba PJM" leftward crimson horizontal bar chart sorted ascending by Rp Juta so the deepest loss sits at the top.

Use Satoshi for headings/UI and JetBrains Mono for every number. Crisp white cards on #F8FAFC canvas, 1px #E2E8F0 borders, Harbor Cobalt (#295CA8) single UI accent, zero purple, zero neon glows, zero emojis.
```
