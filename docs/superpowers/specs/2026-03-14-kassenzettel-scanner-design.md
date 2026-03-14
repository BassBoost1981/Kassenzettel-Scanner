# Design-Spec — Kassenzettel-Scanner & Preisanalyse-App

**Version:** 1.0
**Datum:** 2026-03-14
**Status:** Genehmigt

---

## 1. Projektübersicht

Eine lokale Windows-Desktop-Applikation zum Scannen/Importieren von Kassenzettel-Bildern. Eine lokal laufende KI (Qwen2.5-VL via llama.cpp) extrahiert Artikel und Preise automatisch. Die Daten werden in SQLite gespeichert und ermöglichen Preisverlaufsanalysen, Ausgabenauswertungen und Preisvergleiche zwischen Supermärkten — vollständig offline.

**Kernprinzipien:**
- 100% offline — keine Cloud, keine API-Kosten
- 100% portabel (USB-kompatibel) — alle Daten im App-Ordner, kein %APPDATA%, keine Registry
- Keine Drittanbieter-Installation durch den Nutzer
- Breite Hardware-Kompatibilität (CPU, Intel iGPU, AMD iGPU, NVIDIA GPU)
- KI-Ergebnisse immer vor dem Speichern prüf- und korrigierbar

---

## 2. Tech-Stack

| Komponente | Technologie |
|---|---|
| Desktop-Framework | Tauri v2 (Rust) |
| Frontend | React 18 + TypeScript |
| UI-Bibliothek | shadcn/ui |
| Schriftart | Lexend (Variable Font) |
| Charts | Recharts |
| State Management | Zustand |
| Datenbank | SQLite (via rusqlite) |
| KI-Inference | llama.cpp Server (Vulkan-Build, Tauri-Sidecar) |
| Modell | Qwen2.5-VL 3B Q4_K_M (GGUF) |
| Bildverarbeitung | Rust (image crate) |
| Scanner | Windows WIA Dialog (COM-API) |
| Build/Packaging | Tauri Bundler (portable .exe — kein Installer) |

---

## 3. Architektur

```
┌─────────────────────────────────────────────────────┐
│                    Tauri v2 Shell                    │
│  ┌──────────────┐         ┌──────────────────────┐  │
│  │  React 18 +  │  Tauri  │   Rust Backend       │  │
│  │  TypeScript   │ Commands│                      │  │
│  │  shadcn/ui   │◄───────►│  commands/            │  │
│  │  Recharts    │         │   analyze.rs          │  │
│  │  Zustand     │         │   receipts.rs         │  │
│  │  Lexend Font │         │   products.rs         │  │
│  │              │         │   scanner.rs (WIA)    │  │
│  │  Dark/Light  │         │   settings.rs         │  │
│  │  Auto-Theme  │         │   export.rs           │  │
│  └──────────────┘         │                      │  │
│                           │  db/                  │  │
│                           │   SQLite (rusqlite)   │  │
│                           │                      │  │
│                           │  sidecar.rs           │  │
│                           │   └─► llama-server    │  │
│                           │       (Port 8190)     │  │
│                           └──────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Datenfluss:**
1. Nutzer importiert Bild (Drag&Drop / Datei-Dialog / WIA Scanner-Dialog)
2. Rust erstellt Analysekopie: Skalierung auf max 1024px, Graustufen, Kontrastverstärkung, Base64-Enkodierung
3. Rust erstellt Archivkopie (optional): JPEG 80%, max 1920px → gespeichert unter image_path
4. HTTP POST an localhost:8190 (llama-server) mit Analysekopie
5. SSE-Stream: Token-für-Token an Frontend via Tauri Events
6. KI gibt JSON zurück mit Markt, Datum, Artikeln, Preisen
7. JSON-Ergebnis in Korrektur-UI anzeigen (Markt automatisch erkannt, manuell überschreibbar)
8. Nach Bestätigung: Markt in stores anlegen/zuordnen, Artikel in receipt_items speichern
9. Produkt-Normalisierung (Phase 2): Beim Speichern Fuzzy-Match gegen bekannte Produkte, bei Unsicherheit Nutzer-Dialog

---

## 4. Datenbank-Schema

### 4.1 Tabellen

```sql
-- App-Einstellungen (Key-Value Store)
CREATE TABLE settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL
);

-- Supermärkte
CREATE TABLE stores (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    merge_variants  BOOLEAN DEFAULT 0,  -- Aldi Nord/Süd zusammenfassen?
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Kassenzettel
CREATE TABLE receipts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id        INTEGER REFERENCES stores(id),
    date            DATE NOT NULL,
    time            TEXT,
    total_amount    REAL NOT NULL,
    discount_total  REAL DEFAULT 0,
    deposit_total   REAL DEFAULT 0,
    payment_method  TEXT,
    image_path      TEXT,
    raw_json        TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Kategorien (verwaltbar in Einstellungen)
CREATE TABLE categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Normalisierte Produkte
CREATE TABLE products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    category_id INTEGER REFERENCES categories(id),
    unit        TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Alias-Mapping
CREATE TABLE product_aliases (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER REFERENCES products(id),
    alias       TEXT NOT NULL UNIQUE
);

-- Kassenzettel-Positionen
CREATE TABLE receipt_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id      INTEGER REFERENCES receipts(id) ON DELETE CASCADE,
    product_id      INTEGER REFERENCES products(id),
    raw_name        TEXT NOT NULL,
    quantity        REAL DEFAULT 1,
    unit_price      REAL NOT NULL,
    total_price     REAL NOT NULL,
    discount        REAL DEFAULT 0,
    deposit         REAL DEFAULT 0,
    category_id     INTEGER REFERENCES categories(id)
);

-- Indizes
CREATE INDEX idx_receipts_date ON receipts(date);
CREATE INDEX idx_receipts_store ON receipts(store_id);
CREATE INDEX idx_receipt_items_product ON receipt_items(product_id);
CREATE INDEX idx_receipt_items_receipt ON receipt_items(receipt_id);
CREATE INDEX idx_products_category ON products(category_id);
```

### 4.2 Seed-Daten

**Kategorien (in categories-Tabelle):** Obst/Gemüse, Milchprodukte, Fleisch/Wurst, Backwaren, Getränke, Tiefkühl, Drogerie, Sonstiges

**Märkte:** Rewe, Lidl, Aldi Nord, Aldi Süd, Edeka, Penny, Kaufland, Netto, dm, Rossmann

---

## 5. UI/UX-Konzept

### 5.1 Design-System

- **Schrift:** Lexend (Variable Font) — überall
- **Theme:** Dark/Light Mode mit System-Automatik
  - Dark: Slate-Background (#1E293B → #0F172A) + Cyan (#00FFFF) Akzente
  - Light: Silbergrau (#F8FAFC → #E2E8F0) + Blau (#3B82F6) Akzente
  - CSS-Variablen + Tailwind `dark:` Klassen
  - Logos automatisch je nach Theme gewechselt
- **Komponenten:** shadcn/ui (Table, Dialog, Input, Button, Card, Select, Dropdown)
- **Charts:** Recharts (responsive, Dark-Mode-fähig)

### 5.2 Navigation

Collapsible Sidebar (links). MVP zeigt nur die aktiven Views, Phase-2-Views werden später freigeschaltet:

| Icon | View | Beschreibung | Phase |
|------|------|-------------|-------|
| Scan | Neu scannen | Drop-Zone, Scanner-Button, Datei-Button | MVP |
| Bons | Alle Bons | Tabelle mit Filter/Suche, Detailansicht | MVP |
| Chart | Preisverlauf | Produktsuche → Liniendiagramm pro Markt | Phase 2 |
| Vergleich | Preisvergleich | Produkt × Markt Tabelle (90-Tage-Schnitt) | Phase 2 |
| Dashboard | Dashboard | Monatsausgaben, Kategorien, Preisalarme | Phase 2 |
| Einstellungen | Settings | Allgemein, KI-Modell, Märkte, Daten | MVP |

**Statusleiste** (unten): llama-server Status (bereit / lädt / Fehler)

### 5.3 Scan-Workflow

1. **Import:** Drop-Zone zentriert, "Scannen" + "Datei auswählen" Buttons
2. **Analyse:** Split-View — Originalbild links, KI-Fortschritt rechts (Streaming-Tokens)
3. **Korrektur:** Tabellarische Anzeige, jedes Feld inline editierbar, unsichere Felder gelb markiert (⚠️), Artikel hinzufügen/löschen
4. **Speichern/Verwerfen:** Zwei Buttons am unteren Rand

### 5.4 Einstellungen (4 Tabs)

| Tab | Inhalte |
|-----|---------|
| Allgemein | Theme (System/Dark/Light), Kategorien verwalten |
| KI-Modell | Aktives Modell, GPU-Layers (Auto/0-99), Modellpfad, Download/Manuell |
| Märkte | Liste bekannter Märkte, + Neuer Markt, Aldi-Varianten (Getrennt/Zusammen) |
| Daten | Bilder nach Analyse (Behalten/Löschen/Fragen), Backup/Restore, Speicherort-Info (./data/) |

---

## 6. KI-Integration

### 6.1 Sidecar-Lifecycle (sidecar.rs)

| Funktion | Beschreibung |
|----------|-------------|
| start_server() | Startet llama-server mit Vulkan, konfigurierbare GPU-Layers |
| stop_server() | Graceful Shutdown bei App-Exit |
| health_check() | Periodischer Ping auf /health |
| restart_server() | Bei Crash auto-restart (max 3 Versuche) |
| download_model() | HuggingFace Download mit Fortschritt-Events an Frontend |

### 6.2 App-Start-Sequenz

1. Prüfe llama-server.exe in binaries/ → Fehler wenn nicht vorhanden
2. Prüfe Modell in ./data/models/
   - Nicht vorhanden → Onboarding: [Auto-Download] oder [Manuell wählen]
3. llama-server starten (Port 8190, Vulkan)
4. Health-Check (max 30s warten)
5. App bereit → Hauptfenster

### 6.3 Inference-Flow (analyze.rs)

1. Bildvorverarbeitung (image crate): Skalieren auf max 1024px, Graustufen, Kontrastverstärkung
2. Base64-Enkodierung
3. POST localhost:8190/v1/chat/completions (stream: true, temperature: 0.1, max_tokens: 2048)
4. SSE-Stream Token-für-Token via Tauri Events an Frontend
5. JSON parsen + validieren → Korrektur-UI oder Rohtext bei Fehler

### 6.4 Modell-Management

- Standard: Automatischer Download von Hugging Face (~2,1 GB) mit Fortschrittsbalken
- Alternativ: Manueller Import einer .gguf-Datei über Datei-Dialog
- Modelle gespeichert in ./data/models/ (relativ zum App-Ordner, USB-portabel)
- Späteres Upgrade auf 7B-Modell möglich

### 6.5 Fehlerbehandlung

| Fehler | Reaktion |
|--------|----------|
| llama-server nicht erreichbar | Statusleiste rot, Neustart-Button |
| JSON ungültig | Rohtext anzeigen, manuelles Ausfüllen |
| Timeout > 120s | Abbruch, Hinweis "Versuche weniger GPU-Layers" |
| Modell nicht geladen | Auto-Reload, max 3 Versuche |
| Download abgebrochen | Fortschritt gespeichert, Wiederaufnahme möglich |

---

## 7. Scanner-Integration (scanner.rs)

- Windows WIA Dialog über COM-API in Rust (windows crate)
- Nutzer klickt "Scannen" → Windows Scan-Dialog öffnet sich
- Nutzer wählt Scanner, Einstellungen, bestätigt
- Gescanntes Bild wird als temporäre Datei zurückgegeben
- Weiterverarbeitung identisch zum Datei-Import

**Fehlerbehandlung Scanner:**

| Fehler | Reaktion |
|--------|----------|
| Kein Scanner angeschlossen | Hinweis "Kein Scanner gefunden", Button bleibt deaktiviert |
| WIA-Dienst nicht verfügbar | Fehlermeldung, Scanner-Button ausgegraut |
| Scan abgebrochen (Nutzer) | Stille Rückkehr zur Drop-Zone |
| Scan liefert ungültiges Bild | Fehlermeldung "Bild konnte nicht gelesen werden" |

**Fehlerbehandlung Bild-Import:**

| Fehler | Reaktion |
|--------|----------|
| Ungültiges Dateiformat | Hinweis "Nur JPEG, PNG, WebP, HEIC werden unterstützt" |
| Korrupte Bilddatei | Fehlermeldung "Bild konnte nicht geladen werden" |
| Bild zu klein (< 200px) | Warnung "Bild möglicherweise zu klein für zuverlässige Erkennung" |

**Fehlerbehandlung Datenbank:**

| Fehler | Reaktion |
|--------|----------|
| DB-Datei gesperrt | Fehlermeldung, Retry nach 2s (max 3x) |
| Festplatte voll | Fehlermeldung "Nicht genügend Speicherplatz" |
| DB korrupt | Hinweis auf Backup-Restore in Einstellungen |

---

## 8. Entscheidungslog

| Entscheidung | Ergebnis | Begründung |
|---|---|---|
| Webcam-Integration | Entfernt | Scanner liefert bessere Bildqualität |
| Scanner-Typ | WIA Dialog (einfach) | MVP-tauglich, wenig Code, jeder WIA-Scanner |
| Farbschema | Dark + Light (System-Auto) | Beide Logos vorhanden, professionell |
| llama.cpp Binary | Vorkompiliertes Release | Weniger Build-Komplexität |
| Kategorien | 8 Standard aus PRD | Nutzer kann in Einstellungen erweitern |
| Aldi Nord/Süd | Nutzer-Einstellung | Getrennt oder zusammen, konfigurierbar |
| Bilder behalten | Nutzer-Einstellung | Behalten / Löschen / Fragen |
| Modell-Import | Auto-Download + manuell | Flexibel für alle Nutzer |
| Portabilität | 100% USB-portabel, alles in ./data/ | Kein %APPDATA%, kein Installer, USB-Stick-fähig |
| Build-Typ | Portable .exe (kein .msi) | Konsistent mit USB-Portabilität |
| Entwicklungsansatz | Sequentiell mit Orchestrator | Klare Abhängigkeiten, weniger Fehler |

---

## 9. Agent-Swarm-Zuordnung

Sequentielle Orchestrierung mit dem Antigravity Kit:

```
orchestrator (Koordination)
│
├─► Phase 1: database-architect
│     Skills: database-design
│     Output: schema.rs, migrations.rs, seed.rs
│
├─► Phase 2: backend-specialist
│     Skills: api-patterns, clean-code
│     Output: commands/*.rs, sidecar.rs, scanner.rs
│
├─► Phase 3: frontend-specialist
│     Skills: react-patterns, tailwind-patterns, frontend-design
│     Output: src/components/*, src/hooks/*, src/store/*
│
└─► Phase 4: test-engineer
      Skills: testing-patterns
      Output: tests/*
```

---

## 10. Projektstruktur

```
kassenzettel-scanner/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── analyze.rs
│   │   │   ├── receipts.rs
│   │   │   ├── products.rs
│   │   │   ├── scanner.rs
│   │   │   ├── settings.rs
│   │   │   └── export.rs
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   ├── schema.rs
│   │   │   ├── migrations.rs
│   │   │   └── seed.rs
│   │   └── sidecar.rs
│   ├── binaries/
│   │   └── llama-server.exe
│   └── tauri.conf.json
│
├── src/
│   ├── App.tsx
│   ├── Router.tsx                -- React Router Setup (Views)
│   ├── types/
│   │   ├── receipt.ts            -- Receipt, ReceiptItem Interfaces
│   │   ├── product.ts            -- Product, ProductAlias Interfaces
│   │   ├── store.ts              -- Store Interface
│   │   └── settings.ts           -- Settings Interface
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── ThemeProvider.tsx
│   │   ├── scan/
│   │   │   ├── DropZone.tsx
│   │   │   ├── ScanProgress.tsx
│   │   │   └── CorrectionTable.tsx
│   │   ├── receipts/
│   │   │   ├── ReceiptList.tsx
│   │   │   └── ReceiptDetail.tsx
│   │   ├── charts/               -- Phase 2
│   │   │   ├── PriceChart.tsx
│   │   │   ├── PriceComparison.tsx
│   │   │   └── Dashboard.tsx
│   │   └── settings/
│   │       └── SettingsPage.tsx
│   ├── hooks/
│   │   ├── useAnalyze.ts
│   │   ├── useReceipts.ts
│   │   ├── useProducts.ts        -- Produkte & Preisverlauf
│   │   ├── useStores.ts          -- Märkte CRUD
│   │   ├── useSettings.ts        -- Einstellungen Wrapper
│   │   ├── useTheme.ts
│   │   └── useSidecar.ts
│   ├── store/
│   │   ├── receiptStore.ts
│   │   ├── settingsStore.ts
│   │   └── storeStore.ts         -- Märkte State
│   └── lib/
│       ├── tauri-commands.ts     -- Typisierte Tauri invoke Wrapper
│       └── utils.ts
│
├── Font/
│   └── Lexend-VariableFont_wght.ttf
│
└── data/                         -- Portabler Datenordner (USB-kompatibel)
    ├── db/
    │   └── kassenzettel.db       -- SQLite Datenbank
    ├── models/
    │   └── .gitkeep              -- GGUF-Modelle (zur Laufzeit)
    ├── images/                   -- Archivierte Kassenzettel-Bilder
    └── backups/                  -- Automatische/manuelle Backups
```

---

## 11. MVP-Scope (Phase 1)

| Feature | Beschreibung |
|---------|-------------|
| F-01 | Bild-Import: Drag&Drop, Datei-Dialog, WIA Scanner-Dialog |
| F-02 | KI-Analyse: llama.cpp Sidecar + Qwen2.5-VL, Streaming |
| F-03 | Korrektur-UI: Inline-editierbare Tabelle, Split-View, Konfidenz-Markierung |
| F-04 | Markt-Erkennung: Automatisch + manuell überschreibbar |
| F-05 | Bon-Übersicht: Liste, Filter, Suche, Detailansicht |
| F-06 | Einstellungen: Theme, KI-Modell, Märkte, Daten |

---

## 12. Nicht-funktionale Anforderungen

| Anforderung | Zielwert |
|---|---|
| Analyse-Zeit (3B, CPU) | < 60 Sekunden |
| Analyse-Zeit (3B, iGPU) | < 20 Sekunden |
| App-Startzeit | < 3 Sekunden (nach Erststart) |
| App-Größe (ohne Modell) | < 50 MB |
| DB-Größe (1000 Bons) | < 10 MB |
| Bildkompression | JPEG 80%, max 1920px |
