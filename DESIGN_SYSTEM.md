# Design System: Rugged Neo-Brutalist Sports Instrument (Concept A)

Official documentation of the design system, visual tokens, UI philosophy, component architecture, and implementation recipes for **my-coros-app**.

---

## 1. Philosophy & Aesthetic Vision

### 1.1 Inception & Context
This design system is termed **Rugged Neo-Brutalist Sports Instrument (Concept A)**. It synthesizes the editorial punch and tactile geometric energy of modern neo-brutalism with the precision telemetry of high-performance alpine instruments (e.g., *COROS Vertix/Apex* outdoor telemetry, aircraft cockpit barometers, and high-contrast digital chronographs).

### 1.2 Core Architectural Pillars
1. **Sunlight-Readable High-Contrast:**
   - Replaces dark, murky glassmorphism with an organic, chalk-tinted field canvas (*Warm Sports Chalk* `#F6F4EE`) bounded by deep obsidian strokes (`#09090b` / `zinc-950`). This delivers crystal-clear legibility under direct sunlight.
2. **Zero-Blur Tangibility:**
   - Soft, ambient CSS glows and blurry box-shadows are strictly prohibited. Elevation is created exclusively via **crisp, solid offset drop-shadows** with sharp 90° angles (`shadow-[4px_4px_0px_0px_#09090b]`).
3. **Tactile Physics & Micro-Interactions:**
   - Interactive components (buttons, segmented pills, dropdowns, log cards) mimic real physical instrumentation dials and switches. On press, elements depress 1–2 pixels downward-right while removing their offset shadow (`active:translate-x-0.5 active:translate-y-0.5 active:shadow-none`).
4. **Telemetric Density with Clarity:**
   - Athletic metrics (heart rate, pace, elevation, VAM, finish predictions) are always rendered in **heavy monospace typography (`font-mono font-black`)**, establishing an authoritative, data-dense instrument feel.

---

## 2. Color Palette & Design Tokens

### 2.1 Surfaces & Geometry Tokens

| Token Name | Hex Value | Tailwind Class | Semantic Usage |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `#F6F4EE` | `bg-[#F6F4EE]` | Global page canvas (*Warm Sports Chalk*) |
| **Primary Surface** | `#FFFFFF` | `bg-white` | Primary instrument cards, navbar shell, modals, drawers |
| **Secondary Well** | `#FAF9F5` | `bg-[#FAF9F5]` | Inset sub-panels, table alternating rows, card inner wells |
| **Stroke / Border** | `#09090b` | `border-zinc-950` | 2px to 4px crisp bounding borders on all containers |
| **Solid Drop Shadow** | `#09090b` | `shadow-[4px_4px_0px_0px_#09090b]` | Zero-blur offset shadow creating tactile elevation |

### 2.2 Sports Telemetry Accent Palette

| Accent Color | Hex Value | Background Token | Text / Border Token | Athletic & Contextual Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **COROS Blaze Amber** | `#F59E0B` | `bg-amber-400` | `text-zinc-950 border-zinc-950` | Brand primary highlight, primary CTA actions, ITRA Points |
| **Alpine Sky / Cyan** | `#38BDF8` | `bg-sky-300` | `text-sky-800 border-zinc-950` | Altimetry, ITRA Mountain Level, weather, course GPS track |
| **Recovery Mint** | `#4ADE80` | `bg-emerald-300` | `text-emerald-700 border-zinc-950` | Full recovery (100%), safe COT buffer zone, elevation gain D+ |
| **Steep Wall Rose** | `#F87171` | `bg-rose-400` | `text-rose-700 border-zinc-950` | Extreme steep gradients (>25%), high fatigue, COT cutoff hazard |
| **Technical Violet** | `#C084FC` | `bg-purple-300` | `text-purple-700 border-zinc-950` | Night headlamp zone, technical descents, eccentric quad braking |
| **Power Hike Orange** | `#FB923C` | `bg-orange-400` | `text-orange-700 border-zinc-950` | Gradients 15–25%, Cat 1 climbs, warning zones, high strain |

---

## 3. Typography System

The typographical scale pairs a punchy, tight-tracking Sans-Serif font for UI labels and prose with a rugged Monospace font for telemetry data.

```
UI Headings & Labels   ───▶  Sans Serif (Geist / Inter / UI Sans) ───▶  font-black / tracking-tight
Telemetry & Numbers    ───▶  Monospace (Geist Mono / UI Mono)     ───▶  font-mono / font-black
Body & Notes           ───▶  Sans Serif (Geist / Inter)           ───▶  font-medium / text-zinc-700
```

### 3.1 Typographic Scale & Hierarchy

| Scale Level | Typeface | Weight | Tracking | Example Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Title** | Sans | `font-black` | `tracking-tight` | Page banners, Bannister PMC hero numbers |
| **Card Heading** | Sans | `font-black` | `tracking-tight` | Module headers, workout session titles, course names |
| **Metric Hero** | Monospace | `font-black` | Normal | `503 m/h`, `04:12/km`, `+2,450m`, `18h 30m` |
| **Sub-Metric** | Monospace | `font-bold` | Normal | `48 bpm`, `68 ms`, `14.2 km`, `7.5 hrs` |
| **Body Copy** | Sans | `font-medium` | Normal | Scientific notes, station descriptions, methodology tips |
| **Micro Badge** | Sans/Mono | `font-black` | `uppercase` | `PRO TRAIL 360`, `SAFE BUFFER`, `HC CLIMB`, `SWEET SPOT` |

---

## 4. Elevation, Borders & Geometry

### 4.1 Border Thickness Hierarchy
- **Border-4 (`border-4 border-zinc-950`):** Reserved for major page focal anchors (e.g., GPX Course Upload Hero Dropzone).
- **Border-2 (`border-2 border-zinc-950`):** Standard for instrument cards, interactive buttons, modal panels, segmented tabs, and data tables.
- **Border-1 (`border border-zinc-950`):** Used exclusively for micro-pills, badges, and secondary sub-well dividers.

### 4.2 Solid Drop Shadow Hierarchy
```css
/* Primary Instrument Cards, Modals, Map Containers */
shadow-[4px_4px_0px_0px_#09090b]

/* Sub-Cards, Standard Buttons, Interactive Badges */
shadow-[2px_2px_0px_0px_#09090b]

/* Focal Heroes (e.g. Upload Hero) */
shadow-[6px_6px_0px_0px_#09090b]

/* Micro Badges & Embedded Status Pills */
shadow-[1px_1px_0px_0px_#09090b]
```

### 4.3 Corner Radii
- **Outer Instrument Cards:** `rounded-2xl` (16px) for a confident, balanced silhouette.
- **Sub-Wells & Data Panels:** `rounded-xl` (12px).
- **Buttons & Input Controls:** `rounded-xl` (12px) or `rounded-lg` (8px).
- **Badges & Status Pills:** `rounded-md` (6px) or `rounded-full`.

---

## 5. Micro-Interactions & Physics

Every interactive component must provide instantaneous physical tactile feedback:

```tsx
// Canonical Neo-Brutalist Interactive Button Recipe
<button className="
  px-4 py-2 text-xs font-black rounded-xl
  bg-amber-400 text-zinc-950
  border-2 border-zinc-950
  shadow-[2px_2px_0px_0px_#09090b]
  hover:bg-amber-300
  active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
  transition-all cursor-pointer
">
  Execute Action
</button>
```

---

## 6. Component Catalog & Code Recipes

### 6.1 Instrument Card
```tsx
<div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-4">
  <div className="flex items-center justify-between border-b-2 border-zinc-950 pb-3">
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-lg bg-amber-400 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-black text-zinc-950 tracking-tight">Metric Name</h3>
        <p className="text-[11px] text-zinc-600 font-medium">Concise explanation of telemetry function</p>
      </div>
    </div>
  </div>
  
  {/* Inner Sub-Well */}
  <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
    <span className="text-[10px] text-zinc-600 font-sans font-bold block">TELEMETRY</span>
    <div className="text-xl font-black text-zinc-950 font-mono">1,240 <span className="text-xs font-normal text-zinc-600">m</span></div>
  </div>
</div>
```

### 6.2 Segmented Route / Tab Switcher
```tsx
<div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border-2 border-zinc-950 text-xs">
  <button className="px-4 py-1.5 rounded-lg font-black bg-amber-400 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
    Active Tab
  </button>
  <button className="px-4 py-1.5 rounded-lg font-bold text-zinc-600 hover:text-zinc-950 transition-colors">
    Inactive Tab
  </button>
</div>
```

### 6.3 Recharts Light-Mode Chart Specifications
For charts (Bannister PMC, Altimetry Profile, HR Distributions):
- **Grid Lines:** `stroke="#e4e4e7"`
- **Axis & Ticks:** `tick={{ fontSize: 10, fill: "#18181b", fontWeight: 700 }}`
- **Interactive Tooltip Container:**
```tsx
<div className="p-3 rounded-xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] text-xs font-mono space-y-1 text-zinc-950">
  <div className="font-black text-zinc-950">{label}</div>
  <div className="text-amber-600 font-black">{value}</div>
</div>
```

### 6.4 Status Badges (Safe, Caution, Danger)
```tsx
// Safe Status
<span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border-2 border-zinc-950 bg-emerald-300 text-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
  Safe (+45m Buffer)
</span>

// Caution Status
<span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border-2 border-zinc-950 bg-amber-300 text-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
  Caution (+12m Buffer)
</span>

// Danger / Cut-off Status
<span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border-2 border-zinc-950 bg-rose-300 text-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
  Cut-Off Hazard (-15m)
</span>
```

---

## 7. Strict Anti-Patterns & Quality Rules

When maintaining or extending this interface, adhere to these rules:

1. ❌ **No Low-Contrast Grey Text on Colored Backgrounds (`gray-on-color`):**
   - *Prohibited:* `bg-amber-400 text-zinc-500` (unreadable).
   - *Mandatory:* `bg-amber-400 text-zinc-950 font-black`.
2. ❌ **No Blurry Ambient Shadows or Glows:**
   - *Prohibited:* `shadow-xl`, `shadow-2xl`, `shadow-cyan-500/20`.
   - *Mandatory:* `shadow-[4px_4px_0px_0px_#09090b]` or `shadow-[2px_2px_0px_0px_#09090b]`.
3. ❌ **No Dark Mode Contamination:**
   - *Prohibited:* `bg-zinc-900 text-zinc-100` inside dashboard card bodies.
   - *Mandatory:* Maintain `#F6F4EE` canvas, `bg-white` card surfaces, and `text-zinc-950` typography.
4. ❌ **No Regular Sans-Serif Numbers for Telemetry Data:**
   - *Prohibited:* `<span className="font-sans">4:12/km</span>`.
   - *Mandatory:* `<span className="font-mono font-black">04:12/km</span>`.

---

## 8. Codebase File Mapping

- **Core CSS & Global Utilities:** `src/app/globals.css`
- **Global Instrument Navigation:** `src/components/Header.tsx`
- **Core Visualizations & Telemetry:**
  - Bannister PMC Chart: `src/components/PmcChart.tsx`
  - ACWR & Workload Gauge: `src/components/AcwrCard.tsx`
  - TID & Aerobic Decoupling: `src/components/TidCard.tsx`
  - Daily Recovery Radar: `src/components/RecoveryRadar.tsx`
  - EvoLab & Race Predictor: `src/components/EvoLabSuite.tsx`
  - Ultra Mountain & Trail Suite: `src/components/TrailSuite.tsx`
  - Activity Feed & Inspector: `src/components/ActivityFeed.tsx`
  - Topographic Geospatial Map: `src/components/TrailMap.tsx`
  - AI Coach Drawer: `src/components/AiCoachDrawer.tsx`
  - BYOK Settings: `src/components/SettingsModal.tsx`
  - Auth Gate: `src/components/AuthGate.tsx`
- **Application Pages:**
  - Overview Dashboard: `src/app/page.tsx`
  - Activity Logbook: `src/app/activities/page.tsx`
  - GPX Course & COT Simulator: `src/app/trail-planner/page.tsx`
