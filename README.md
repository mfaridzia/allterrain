# COROS Athletic Intelligence Platform

> **Professional Athletic Telemetry, Bannister Impulse-Response PMC, Ultra Trail & Mountain Planning, and Context-Aware AI Coaching for COROS Athletes.**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.4-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Turbopack](https://img.shields.io/badge/Turbopack-Ready-blue?style=flat)](https://turbo.build/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=flat&logo=sqlite)](https://www.sqlite.org/)
[![COROS MCP](https://img.shields.io/badge/COROS-Official_MCP-FF5722?style=flat)](https://mcp.coros.com/mcp)
[![Design System](https://img.shields.io/badge/Design_System-Concept_A_Neo--Brutalist-amber)](./DESIGN_SYSTEM.md)

---

## 🌟 Overview

**COROS Athletic Intelligence** is an advanced athletic telemetry dashboard and planning suite engineered for road, trail, and ultra-marathon runners who train with **COROS GPS watches**. 

Built with a local-first philosophy, the application connects directly to the official **COROS MCP Server** (`mcp.coros.com/mcp`) via OAuth 2.0 PKCE, calculating complex impulse-response workloads (*Performance Science PMC*), monitoring cardiac drift ($Pa:HR$), predicting race finishing times, simulating mountain course Cut-Off Times (COT), and providing an in-house AI coach aware of your live biological readiness.

---

## ⚡ Key Modules & Features

### 1. Bannister Impulse-Response PMC (*Performance Science Engine*)
* **Continuous EMA Tracking:** Daily calculation of Chronic Training Load (CTL / Fitness), Acute Training Load (ATL / Fatigue), and Training Stress Balance (TSB / Form).
* **Dynamic Form Zones:** Instant classification into 5 distinct training readiness states: *High Risk Overreaching*, *Optimal Training*, *Grey Maintenance*, *Fresh / Race Ready*, and *Transition*.
* **Ramp Rate Safeguard:** 7-day rolling CTL delta tracking to prevent bone, tendon, and ligament stress injuries from rapid volume spikes.

### 2. ACWR & Injury Prevention Suite (*Gabbett & Foster*)
* **Acute:Chronic Workload Ratio (ACWR):** 7-day acute strain divided by 28-day chronic baseline to identify the *Optimal Sweet Spot* ($0.8 - 1.3$) versus high-injury danger zones ($> 1.5$).
* **Foster’s Monotony & Strain:** Statistical analysis of daily training load variability ($\mu / \sigma$) to identify stale, recovery-depleted micro-cycles.

### 3. Physiological Efficiency & 80/20 Polarized Distribution
* **Aerobic Decoupling ($Pa:HR$ / Cardiac Drift %):** Automatic half-split efficiency evaluation ($EF_1$ vs $EF_2$) to detect early cardiac drift ($> 5\%$) caused by thermoregulatory stress or glycogen depletion.
* **Efficiency Factor ($EF$):** Longitudinal tracking of running speed produced per single heart beat ($Speed / HR$).
* **Training Intensity Distribution (TID 80/20):** Visual breakdown of Low Intensity (Z1-Z2), Threshold (Z3), and High Intensity (Z4-Z5) to prevent falling into the *"Zone 3 Black Hole"*.

### 4. Ultra Mountain & Trail Running Suite
* **Ascent Speed (VAM $m/h$):** Net vertical climbing velocity calibrated from historical uphill efforts.
* **Kilian Jornet & Uphill Athlete Climb Density:** Terrain classification based on vertical meters gained per horizontal kilometer ($m D+/km$).
* **Aerobic Deficiency Syndrome (ADS) Diagnostic:** Identifies aerobic base deficiencies by analyzing the gap between Aerobic Threshold (AeT) and Anaerobic Threshold (AnT).
* **Scientific Fueling & Hydration Planner:** Evidence-based hourly carbohydrate ($g/h$), fluid ($L/h$), and sodium ($mg/h$) targets based on exercise duration.
* **Race Preparation Volume Targets:** Personalized weekly volume and key long-run simulations for *Realistic Finishers* vs *Alpine Elites*.

### 5. GPX Course & Cut-Off Time (COT) Simulator
* **Interactive Leaflet GIS Map:** Topographic, satellite, and road maps with synchronized 2-way hover radar tracking with the elevation profile.
* **7-Spectrum Slope Cross-Section:** Real-time terrain slope gradient coloring (from runnable flat to extreme walls $>25\%$).
* **Major Mountain Passes:** Automatic identification of categorized climbs (HC, Cat 1, Cat 2, Cat 3) with gradient details and estimated climbing times.
* **Non-Linear COT Simulation:** Front-loaded effort exponent modeling ($0.88$ power law) with penalties for night headlamp running, altitude hypoxia ($>2,200m$), and second-half muscular fatigue.
* **Printable Cheat-Sheet Wristband:** Generates a high-contrast, print-ready pace card for wristbands on race day.

### 6. Context-Aware AI Training Coach (BYOK)
* Multi-provider LLM support: **Google Gemini (Gemini 2.5 Flash)**, **OpenAI (GPT-4o)**, **Groq**, or local offline models via **Ollama**.
* Context-injection engine feeds current TSB, ACWR, daily HRV, VAM calibrations, and recent workout streams into AI prompts for precision advice.

---

## 🎨 Design System: Concept A (Neo-Brutalist Sports Instrument)

The entire interface follows the **Rugged Neo-Brutalist Sports Instrument** visual standard:
- **Canvas:** Warm Sports Chalk (`#F6F4EE`) for maximum sunlight legibility.
- **Surfaces:** Pure White (`#FFFFFF`) instrument cards with deep obsidian borders (`border-2 border-zinc-950`).
- **Elevation:** Zero-blur solid offset drop shadows (`shadow-[4px_4px_0px_0px_#09090b]`).
- **Physics:** Tactile click feedback (`active:translate-x-0.5 active:translate-y-0.5 active:shadow-none`).
- **Telemetry Typography:** High-contrast monospace digits (`font-mono font-black`).

> 📖 **Read the complete design specification in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).**

---

## 📐 Scientific Formulas & Equations

All calculations are mathematically grounded in peer-reviewed exercise physiology and sports science literature:
- **Bannister Impulse-Response PMC** (Bannister 1991)
- **Acute:Chronic Workload Ratio** (Tim Gabbett 2016)
- **Training Monotony & Strain** (Carl Foster 1998)
- **Aerobic Decoupling & Cardiac Drift** (Joe Friel)
- **Energy Cost of Running on Slopes & GAP** (Minetti et al. 2002)
- **Ascent Velocity (VAM)** (Dr. Michele Ferrari)
- **ITRA Km-Effort & Points Scale** (International Trail Running Association / World Athletics)
- **Endurance Nutrition & Fueling** (Asker Jeukendrup 2014, Ricardo Costa 2019)

> 🔬 **Read the complete mathematical formulas and citations in [ARCHITECTURE.md](./ARCHITECTURE.md).**

---

## 🛠️ Tech Stack

| Domain | Technology |
| :--- | :--- |
| **Framework** | Next.js 16.3.4 (App Router, Turbopack, React 19) |
| **Styling** | Tailwind CSS v4, Lucide React Icons |
| **Visualizations** | Recharts (Light-Mode Instrument Theme) |
| **Geospatial GIS** | Leaflet, OpenTopoMap, Esri World Imagery |
| **Local Database** | SQLite via `better-sqlite3` (WAL Mode) |
| **COROS Integration** | Official COROS MCP (`@modelcontextprotocol/sdk`) + OAuth 2.0 PKCE |
| **AI Integration** | BYOK Multi-Provider Router (Google Gemini, OpenAI, Groq, Ollama) |
| **Language** | TypeScript (Strict Mode) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js:** v18.18.0 or higher
- **Package Manager:** `pnpm` (recommended), `npm`, or `bun`

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/my-coros-app.git
cd my-coros-app
pnpm install
```

### 2. Start the Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 3. Connect COROS Account
1. On the landing screen, click **"Hubungkan Akun COROS"** (Connect COROS).
2. Authorize via official COROS OAuth 2.0 PKCE.
3. *Alternative:* Paste your personal COROS API Bearer Token directly for manual access.

### 4. Build for Production
```bash
pnpm build
pnpm start
```

---

## 🔒 Privacy & Local-First Architecture

Your athletic telemetry is sensitive health data. This application is engineered with a **local-first privacy architecture**:
- All workouts, sensor laps, sleep logs, and HRV metrics are stored locally on your own machine in `./data/coros_athlete.db`.
- API keys for AI providers (Gemini, OpenAI, Groq) remain strictly on your local database or browser session.
- No telemetry data is sent to external third-party analytics trackers.

---

## 📚 Documentation Index

- [**`ARCHITECTURE.md`**](./ARCHITECTURE.md) — Detailed system architecture, SQLite schemas, feature breakdown, and complete mathematical derivations.
- [**`DESIGN_SYSTEM.md`**](./DESIGN_SYSTEM.md) — Comprehensive visual token system, color palettes, typographic hierarchy, and UI component code recipes.

---

## 📄 License

This project is licensed under the MIT License.
