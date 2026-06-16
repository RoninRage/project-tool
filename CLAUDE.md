# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Projekt Prio** — a personal project-prioritization tool. Projects are scored against 8 weighted criteria and ranked; the UI offers a card view and an effort-vs-value matrix view. Next.js 15 (App Router) + Prisma/SQLite + Tailwind v4. UI strings are in German.

## Commands

```bash
npm run dev          # Dev server on :3000
npm run build        # Production build (output: 'standalone')
npm run db:push      # Apply prisma/schema.prisma to the SQLite DB (no migration files)
npm run db:seed      # Load sample data (tsx prisma/seed.ts)
npm run db:migrate   # prisma migrate dev — present but unused; the project tracks schema via db push
```

There are no tests, linter, or typecheck script configured. `npm run build` is the de facto correctness gate (Next.js type-checks during build). Requires a `.env` with `DATABASE_URL` (e.g. `file:./dev.db`).

## Scoring engine — the core of the app

Everything revolves around `lib/criteria.ts`. Read it before touching scoring, forms, or the dashboard.

- `CRITERIA` is the single source of truth: 8 criteria, each with 5 ordered `options` (UI selects an index 0–4) and an `inverted` flag.
- `inverted: true` means "more is worse" (e.g. Zeitaufwand, Kosten, Komplexität). In `calculateScore`, inverted criteria contribute `5 - value`, non-inverted contribute `value + 1`. Adding/removing a criterion or flipping `inverted` changes everyone's score.
- Final score is normalized to **0–100** against the weighted maximum, so it stays comparable when weights change.
- `getScoreColor` is intentionally inverted from intuition: **low score = green, high score = blue**. A high score means high effort/cost relative to value here.
- `DEFAULT_WEIGHTS` is the fallback used whenever no `Settings` row exists.

The computed score is **never persisted**. It's recalculated on demand — server-side in `GET /api/projects` and again client-side in `app/page.tsx` (which lets weight changes re-rank instantly without a round-trip). Keep both call sites consistent if you change the scoring contract.

## Data model (prisma/schema.prisma)

- `Project` — metadata only (name, status, category, nextStep). `status` is a free string; allowed values live in TypeScript (`Status` in `lib/types.ts`), not the DB.
- `Score` — one row per (project, criterionId) holding the raw 0–4 index. Scores are **rows, not columns**, so `criterionId` values are loose strings that must match `CRITERIA[].id`. Deletes cascade from Project.
- `Settings` — a single row with fixed id `"singleton"`; `weights` is a JSON **string**, parsed/stringified at the API boundary.

## Structure

- `app/page.tsx` — the dashboard. Large `'use client'` component holding all filtering, sorting, card/matrix view logic, and client-side score recompute.
- `app/api/projects/` and `app/api/settings/` — route handlers; settings is upsert-by-singleton.
- `components/ProjectForm.tsx` — shared create/edit form, driven by `CRITERIA`.
- `lib/prisma.ts` — standard global-singleton PrismaClient (avoids hot-reload connection leaks in dev).

## Offene Ideen (Backlog)

1. **Obsidian-Verbindung** — noch zu detailieren (bidirektional, REST gegen `/api/projects`)

### AI-Features (alle nur sichtbar wenn `ANTHROPIC_API_KEY` gesetzt)
2. ~~**AI: Score-Vorschlag aus Freitext**~~ ✓ — Im Projekt-Formular: Freitext-Eingabe, Claude schlägt Scores für alle 8 Kriterien vor. Jeden einzeln übernehmbar.
3. ~~**AI: Nächster Schritt vorschlagen**~~ ✓ — Im Formular: "✦ Vorschlag"-Button neben dem Nächster-Schritt-Label, Claude Haiku generiert aus Name, Description, Status und Tasks einen konkreten Schritt. Ein-Klick-Übernahme.
4. ~~**AI: Review-Assistent**~~ ✓ — Im Review-Ritual: "✦ KI-Einschätzung"-Button pro Projektkarte, Claude Haiku gibt 2–3 Sätze zu Score, Inaktivität und Task-Fortschritt als Entscheidungshilfe.
5. ~~**AI: Projekt-Beschreibung generieren**~~ ✓ — Im Formular: "✦ Vorschlag"-Button neben dem Beschreibung-Label, Claude Haiku generiert aus Titel + allen Kriterien-Scores einen deutschen Kurztext. Vorschlag erscheint als Inline-Preview mit Übernehmen/✕.
6. ~~**AI: Kategorie-Vorschlag**~~ ✓ — Ersetzt durch AI Tag-Vorschlag (siehe 7).

### Non-AI Features
7. ~~**Projekt-Tags**~~ ✓ — Mehrere Tags pro Projekt, filterbar im Dashboard (OR-Logik). KI-Vorschlag via Claude Haiku.
8. ~~**Score-Vergleichsansicht**~~ ✓ — 2–3 Projekte nebeneinander mit allen Kriterien im Detail. Hilft bei Entscheidungen zwischen ähnlich bewerteten Projekten.
9. ~~**Projekt-Archiv**~~ ✓ — Eigene Ansicht für DONE-Projekte mit Abschlussdatum, finalem Score und optionalem Abschluss-Notizfeld. Persönliche Historie statt einfach "weggefiltert".
10. ~~**Tastaturnavigation**~~ ✓ — Shortcuts für häufige Aktionen: `N` neues Projekt, `R` Review starten, `?` Roulette, `Esc` Modal schließen. Passt zum Maker-Feeling des Tools.
11. ~~**Tags auf Projektkarte**~~ ✓ — Tags werden auf der Projektkarte im Dashboard angezeigt (in der Badges-Zeile neben dem Status-Badge, bereits implementiert in Projekt-Tags commit).

## Deployment

Docker multi-stage build using Next.js standalone output. `docker-entrypoint.sh` runs `prisma db push` on every start (and seeds when `SEED_DB=true`), then launches the server. SQLite lives in a named volume in prod (`docker-compose.prod.yml`); locally it's `./data/dev.db`. Prisma is invoked via `node ./node_modules/prisma/build/index.js` rather than the `.bin` symlink or `npx` — recent commits fixed this to stop npx from pulling Prisma v7. The runner stage copies `.prisma`, `@prisma`, and `prisma` packages explicitly.
