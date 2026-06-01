# Projekt Prio

Persönliches Projekt-Priorisierungs-Tool auf Basis von Next.js 15, Prisma/SQLite und Tailwind CSS v4.

## Features

- Bewertung von Projekten nach 8 gewichteten Kriterien
- Karten-Ansicht mit Score-Balken und Status-Badges
- Matrix-Ansicht: Aufwand vs. Wert (Quadrantenanalyse)
- Filter nach Status und Kategorie
- Sortierung nach Score, Datum oder Name
- CSV-Export
- Gewichtung der Kriterien anpassbar
- Dark Mode (Standard)

---

## Setup

### Voraussetzungen

- Node.js 20+
- npm

### 1. Lokale Entwicklung (ohne Docker)

```bash
# Abhängigkeiten installieren
npm install

# .env Datei anlegen
cp .env.example .env
# DATABASE_URL in .env setzen: file:./dev.db

# Datenbank initialisieren
npm run db:push

# (Optional) Beispieldaten laden
npm run db:seed

# Entwicklungsserver starten
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000).

---

### 2. Lokale Entwicklung mit Docker

```bash
# Container bauen und starten (mit Seed)
docker compose up --build

# Nur starten (wenn bereits gebaut)
docker compose up
```

Die App ist unter [http://localhost:3000](http://localhost:3000) erreichbar.
Datenbankdatei liegt in `./data/dev.db`.

---

### 3. Homelab Deployment (Produktion)

```bash
# Image bauen
docker build -t projekt-prio:latest .

# Produktions-Stack starten
docker compose -f docker-compose.prod.yml up -d

# Logs prüfen
docker compose -f docker-compose.prod.yml logs -f
```

Die Datenbank wird in einem benannten Docker Volume (`projekt-prio-data`) persistiert.

---

### 4. Update-Workflow

```bash
# Neues Image bauen
docker build -t projekt-prio:latest .

# Container neu starten (0-Downtime mit Rolling Restart)
docker compose -f docker-compose.prod.yml up -d --no-deps --build app

# Datenbank-Migrationen laufen automatisch beim Start
```

---

## Umgebungsvariablen

| Variable       | Standard              | Beschreibung                         |
|----------------|-----------------------|--------------------------------------|
| `DATABASE_URL` | `file:./dev.db`       | Pfad zur SQLite-Datenbankdatei       |
| `SEED_DB`      | `false`               | Seed beim Start ausführen (Docker)   |

---

## Projektstruktur

```
├── app/
│   ├── api/
│   │   ├── projects/        # CRUD Projekte
│   │   └── settings/        # Gewichtungs-Einstellungen
│   ├── projects/
│   │   ├── new/             # Neues Projekt anlegen
│   │   └── [id]/edit/       # Projekt bearbeiten
│   ├── settings/            # Gewichtungs-Konfiguration
│   └── page.tsx             # Dashboard
├── components/
│   ├── ProjectForm.tsx      # Shared Formular-Komponente
│   └── ThemeProvider.tsx    # Dark/Light Mode
├── lib/
│   ├── criteria.ts          # Kriterien-Definition + Score-Berechnung
│   ├── prisma.ts            # Prisma Client Singleton
│   └── types.ts             # TypeScript-Typen
└── prisma/
    ├── schema.prisma        # Datenbankschema
    └── seed.ts              # Beispieldaten
```
