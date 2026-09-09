<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Agent Documentation Protocol

Only update [`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) if a change is **major, structural, or important** to document. Do NOT update them for trivial tweaks, minor text/copy adjustments, or small non-breaking bug fixes.

1. **Architecture & Features:** Update [`ARCHITECTURE.md`](./ARCHITECTURE.md) ONLY for major architectural shifts, new core features, new routes, database schema modifications, new sports science formulas, or significant data pipeline changes.
2. **Design System & UI Components:** Update [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) ONLY for major design system updates, new shared UI components, new visual styling tokens, or significant structural layout additions.

