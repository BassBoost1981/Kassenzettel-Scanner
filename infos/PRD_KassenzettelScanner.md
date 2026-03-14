# PRD — Kassenzettel-Scanner & Preisanalyse-App

**Version:** 1.0  
**Datum:** 2026-03-14  
**Status:** Entwurf  

---

## 1. Projektübersicht

### 1.1 Produktvision

Eine lokale Windows-Desktop-Applikation, mit der Nutzer Kassenzettel einscannen oder als Bild importieren können. Eine lokal laufende KI (Qwen2.5-VL via llama.cpp) extrahiert die Artikel und Preise automatisch. Die Daten werden in einer lokalen SQLite-Datenbank gespeichert und ermöglichen langfristige Preisverlaufsanalysen, Ausgabenauswertungen und Preisvergleiche zwischen Supermärkten — vollständig offline, ohne Cloud-Abhängigkeiten.

### 1.2 Zielgruppe

- Privatpersonen, die ihre Haushaltsausgaben analysieren möchten
- Nutzer, die Preisentwicklungen einzelner Produkte (z. B. Butter, Eier) über Zeit verfolgen wollen
- Sparfüchse, die Preise zwischen verschiedenen Supermärkten vergleichen möchten

### 1.3 Kernprinzipien

- **100% offline** — keine Cloud, keine API-Kosten, keine Datenweitergabe
- **Keine Installation von Drittanbieter-Software** durch den Nutzer — alles ist in der App gebündelt
- **Breite Hardware-Kompatibilität** — läuft auf CPU, Intel iGPU, AMD iGPU und NVIDIA GPU
- **Transparenz** — KI-Ergebnisse sind immer vor dem Speichern prüf- und korrigierbar

---

## 2. Tech-Stack

| Komponente | Technologie |
|---|---|
| Desktop-Framework | Tauri v2 (Rust) |
| Frontend | React 18 + TypeScript |
| UI-Bibliothek | shadcn/ui |
| Charts | Recharts |
| Datenbank | SQLite (via `rusqlite`) |
| KI-Inference | llama.cpp Server (Vulkan-Build, als Tauri-Sidecar) |
| Modell | Qwen2.5-VL 3B Q4_K_M (GGUF) |
| Bildverarbeitung | Rust (`image` crate) |
| Build/Packaging | Tauri Bundler (`.msi` / portable `.exe`) |

### 2.1 llama.cpp Sidecar

Der `llama-server.exe` (Vulkan-Build) läuft als Tauri-Sidecar-Prozess und wird beim App-Start automatisch gestartet. Er exponiert eine lokale HTTP-API auf `127.0.0.1:8190`.

**Hardware-Priorisierung durch Vulkan-Backend (automatisch):**

1. NVIDIA GPU (via Vulkan)
2. Intel Arc / Iris Xe iGPU
3. AMD Radeon iGPU / dGPU
4. CPU-Fallback (AVX2/AVX512) — immer verfügbar

### 2.2 Modell-Management

Das Modell (`qwen2.5-vl-3b-instruct-q4_k_m.gguf`, ~2,1 GB) wird **nicht** mit der App gebündelt, sondern beim ersten Start automatisch von Hugging Face heruntergeladen und in `%APPDATA%\kassenzettel-app\models\` gespeichert. Der Nutzer wird durch diesen Prozess geführt.

---

## 3. Systemvoraussetzungen

| Anforderung | Minimum | Empfohlen |
|---|---|---|
| Betriebssystem | Windows 10 64-bit | Windows 11 64-bit |
| RAM | 8 GB | 16 GB |
| Speicherplatz | 4 GB (inkl. Modell) | 8 GB |
| CPU | x64 mit AVX2 | Modern i5/Ryzen 5+ |
| GPU | nicht erforderlich | Intel Xe / AMD / NVIDIA |
| Internet | nur beim Erststart (Modell-Download) | — |

---

## 4. Funktionsumfang

### 4.1 Phase 1 — MVP

#### F-01: Bild-Import

- Drag & Drop von JPEG, PNG, WebP, HEIC ins Hauptfenster
- Datei-Dialog ("Öffnen")
- Kamera-Integration via Web-API (falls Webcam vorhanden)
- Automatische Bildvorverarbeitung: Graustufen, Kontrastverstärkung, Begradigung (via `image` crate in Rust)

#### F-02: KI-Analyse (OCR + Parsing)

- Bild wird als Base64 an den lokalen llama-server gesendet
- Qwen2.5-VL analysiert das Bild und gibt strukturiertes JSON zurück
- Streaming-Output: Tokens werden in Echtzeit in der UI angezeigt
- Fortschrittsindikator mit geschätzter Restzeit

**Ausgabe-JSON-Schema:**

```json
{
  "markt": "Rewe",
  "datum": "2025-03-14",
  "uhrzeit": "14:32",
  "artikel": [
    {
      "name": "Vollmilch 3,5% 1L",
      "menge": 2,
      "einzelpreis": 1.19,
      "gesamtpreis": 2.38,
      "rabatt": 0.00,
      "pfand": 0.00,
      "kategorie": "Milchprodukte"
    }
  ],
  "zwischensumme": 15.42,
  "rabatte_gesamt": 0.50,
  "pfand_gesamt": 0.25,
  "gesamtbetrag": 15.17,
  "zahlungsart": "Karte"
}
```

#### F-03: Korrektur-UI

- Tabellarische Anzeige der erkannten Artikel vor dem Speichern
- Jedes Feld ist inline editierbar (Name, Menge, Preis, Kategorie)
- Artikel können hinzugefügt oder gelöscht werden
- Konfidenz-Markierung: unsichere Felder werden farblich hervorgehoben
- Originalbild bleibt während der Korrektur sichtbar (Split-View)
- "Speichern" und "Verwerfen"-Buttons

#### F-04: Markt-Erkennung

- Automatische Erkennung des Supermarkts aus dem Kassenzettelbild (Rewe, Lidl, Aldi, Edeka, Penny, Kaufland, Netto, Aldi Süd, Aldi Nord, dm, Rossmann etc.)
- Manuelles Überschreiben möglich
- Neue Märkte können in den Einstellungen angelegt werden

#### F-05: Bon-Übersicht

- Liste aller gespeicherten Kassenzettel (Datum, Markt, Gesamtbetrag)
- Filter nach Markt, Datumsbereich, Betrag
- Suche nach Artikelname
- Klick auf Bon öffnet Detailansicht mit allen Positionen und Originalfoto

#### F-06: Einstellungen

- Modell-Auswahl (3B / 7B, sofern vorhanden)
- GPU-Layer-Anzahl konfigurierbar (für fortgeschrittene Nutzer)
- Datenbankpfad / Backup
- Kategorien verwalten

---

### 4.2 Phase 2 — Preisverlauf & Analyse

#### F-07: Produkt-Normalisierung

- Beim Speichern wird geprüft, ob ein Artikel einem bekannten Produkt entspricht (Fuzzy-Matching via `rapidfuzz`-ähnlicher Logik in Rust)
- Bei Unsicherheit: Dialog "Ist das dasselbe wie `Vollmilch 3,5% 1L`?"
- Bestätigte Mappings werden in der `products`-Tabelle gespeichert
- Manuelle Verwaltung der Produkt-Aliasse in den Einstellungen

#### F-08: Preisverlauf-Chart

- Liniendiagramm für ein ausgewähltes Produkt über Zeit
- Mehrere Märkte überlagert (farbkodiert)
- Hover-Tooltips mit Datum, Markt, Preis
- Zeitraum-Filter (letzte 30 Tage / 3 Monate / 1 Jahr / alles)

#### F-09: Dashboard

- Monatsausgaben als Balkendiagramm
- Top-Ausgaben-Kategorien (Donut-Chart)
- Teuerste Einkäufe des Monats
- Preisalarm: Artikel, die gegenüber dem Durchschnitt > 10% teurer wurden

#### F-10: Preisvergleich

- Tabelle: Welcher Markt ist für welches Produkt am günstigsten?
- Basierend auf dem Durchschnittspreis der letzten 90 Tage
- Exportierbar als CSV

---

### 4.3 Phase 3 — Komfort & Export

#### F-11: Export

- Alle Daten als CSV exportieren
- Monatsauswertung als PDF
- Charts als PNG speichern

#### F-12: Backup & Restore

- Datenbank-Backup als einzelne `.zip`-Datei (inkl. Bildarchiv optional)
- Wiederherstellung aus Backup
- Automatisches tägliches Backup in konfigurierbaren Pfad

#### F-13: Modell-Upgrade

- In-App-Download des 7B-Modells für bessere Erkennungsqualität
- Modell-Benchmark: Testbild analysieren, Erkennungszeit messen

---

## 5. Datenbankschema

```sql
-- Märkte
CREATE TABLE stores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,       -- "Rewe", "Lidl" etc.
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
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
    image_path      TEXT,                   -- Pfad zum Originalbild
    raw_json        TEXT,                   -- KI-Output für Debugging
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Normalisierte Produkte (für Preisverlauf)
CREATE TABLE products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,              -- Kanonischer Name
    category    TEXT,                       -- "Milchprodukte", "Gemüse" etc.
    unit        TEXT,                       -- "kg", "L", "Stück"
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Alias-Mapping (verschiedene Namen → gleiches Produkt)
CREATE TABLE product_aliases (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER REFERENCES products(id),
    alias       TEXT NOT NULL UNIQUE        -- "Vollmilch 3,5% 1L", "Frische Vollmilch" etc.
);

-- Einzelne Positionen eines Kassenzettels
CREATE TABLE receipt_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id      INTEGER REFERENCES receipts(id) ON DELETE CASCADE,
    product_id      INTEGER REFERENCES products(id),  -- NULL wenn noch nicht normalisiert
    raw_name        TEXT NOT NULL,          -- Original-Name vom Kassenzettel
    quantity        REAL DEFAULT 1,
    unit_price      REAL NOT NULL,
    total_price     REAL NOT NULL,
    discount        REAL DEFAULT 0,
    deposit         REAL DEFAULT 0,
    category        TEXT
);

-- Indizes für Performance
CREATE INDEX idx_receipt_items_product ON receipt_items(product_id);
CREATE INDEX idx_receipts_date ON receipts(date);
CREATE INDEX idx_receipts_store ON receipts(store_id);
```

---

## 6. KI-Integrations-Architektur

### 6.1 Sidecar-Lebenszyklus

```
App-Start
  └── Tauri prüft: llama-server.exe vorhanden?
        ├── Ja  → llama-server.exe starten (Port 8190)
        └── Nein → Fehler: App-Installation beschädigt

  └── Tauri prüft: Modell vorhanden? (%APPDATA%\...\models\)
        ├── Ja  → Modell in llama-server laden
        └── Nein → Download-Dialog anzeigen
                    → Hugging Face Download (~2,1 GB)
                    → Fortschrittsanzeige
                    → Modell laden

App bereit → Hauptfenster öffnen
```

### 6.2 Inference-Request

```
Frontend (React)
  └── Bild auswählen
  └── Rust Command: analyze_receipt(image_path)
        └── Bild lesen + auf max. 1024px skalieren
        └── Base64-enkodieren
        └── HTTP POST → localhost:8190/v1/chat/completions
              Body: {
                model: "qwen2.5-vl",
                messages: [{
                  role: "user",
                  content: [
                    { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } },
                    { type: "text", text: "<OCR-Prompt>" }
                  ]
                }],
                stream: true,
                temperature: 0.1,
                max_tokens: 2048
              }
        └── SSE-Stream → Rust liest Token für Token
        └── JSON parsen + validieren
        └── Ergebnis an Frontend senden
```

### 6.3 OCR-Prompt

```
Du analysierst einen deutschen Kassenzettel. 
Extrahiere alle Informationen und antworte NUR mit einem 
validen JSON-Objekt. Keine Erklärungen, kein Markdown.

Regeln:
- Preise immer als Dezimalzahl (1.19, nicht "1,19")
- Datum im Format YYYY-MM-DD
- Menge als Zahl (2, nicht "2x")
- Rabatte und Pfand separat von Einzelpreisen ausweisen
- Kategorie aus: Obst/Gemüse, Milchprodukte, Fleisch/Wurst, 
  Backwaren, Getränke, Tiefkühl, Drogerie, Sonstiges

Schema: { "markt": ..., "datum": ..., "artikel": [...], ... }
```

### 6.4 Fehlerbehandlung

| Fehler | Verhalten |
|---|---|
| llama-server nicht erreichbar | Fehlermeldung + Neustart-Button |
| JSON-Parse-Fehler | Rohergebnis anzeigen + manuelle Eingabe |
| Timeout (> 120s) | Abbruch + Hinweis auf schwereres Modell |
| Modell nicht geladen | Automatischer Reload-Versuch |

---

## 7. UI/UX-Konzept

### 7.1 Navigation (Sidebar)

```
[Kassenzettel-Scanner]
─────────────────────
  📷  Neu scannen
  📋  Alle Bons
  📈  Preisverlauf
  🏪  Preisvergleich
  📊  Dashboard
─────────────────────
  ⚙️  Einstellungen
```

### 7.2 Scan-Workflow (Hauptansicht)

```
┌─────────────────────────────────────────────┐
│  Kassenzettel importieren                   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │                                      │   │
│  │     Bild hier hineinziehen           │   │
│  │     oder [Datei auswählen]           │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘

Nach Import:
┌───────────────┬─────────────────────────────┐
│               │  KI analysiert...           │
│  [Vorschau    │  ████████░░░░ ~20 Sek.      │
│   Bild]       │                             │
│               │  Artikel          Preis     │
│               │  ─────────────────────────  │
│               │  Vollmilch 3,5%   1,19 €    │
│               │  Butter 250g      1,89 €    │
│               │  ...                        │
│               │                             │
│               │  [Verwerfen]  [Speichern ✓] │
└───────────────┴─────────────────────────────┘
```

### 7.3 Preisverlauf-Ansicht

```
┌─────────────────────────────────────────────┐
│  🔍 Produkt suchen: [Vollmilch___________]  │
│                                             │
│  Vollmilch 3,5% 1L — Preisverlauf          │
│                                             │
│  1,60 ┤                    ●               │
│  1,40 ┤         ●─────●   ╱               │
│  1,20 ┤  ●─────╱       ╲─╱                │
│  1,00 ┤                                    │
│       └──────────────────────────────       │
│       Jan   Mär   Mai   Jul   Sep          │
│                                             │
│  ● Rewe  ● Lidl  ● Aldi                   │
└─────────────────────────────────────────────┘
```

---

## 8. Projektstruktur

```
kassenzettel-scanner/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   │   ├── analyze.rs       -- Inference-Aufruf
│   │   │   ├── receipts.rs      -- CRUD-Operationen
│   │   │   ├── products.rs      -- Normalisierung
│   │   │   └── export.rs        -- CSV/PDF-Export
│   │   ├── db/
│   │   │   ├── schema.rs        -- SQLite-Schema
│   │   │   └── migrations.rs
│   │   └── sidecar.rs           -- llama-server Lifecycle
│   ├── binaries/
│   │   └── llama-server.exe     -- llama.cpp Vulkan-Build
│   └── tauri.conf.json
│
├── src/
│   ├── components/
│   │   ├── ScanView/
│   │   ├── ReceiptList/
│   │   ├── PriceChart/
│   │   ├── Dashboard/
│   │   └── CorrectionTable/
│   ├── hooks/
│   │   ├── useAnalyze.ts
│   │   └── useReceipts.ts
│   ├── store/                   -- Zustand (Zustand-Bibliothek)
│   └── App.tsx
│
└── models/                      -- .gitignore, wird zur Laufzeit befüllt
    └── .gitkeep
```

---

## 9. Nicht-funktionale Anforderungen

| Anforderung | Zielwert |
|---|---|
| Analyse-Zeit (3B, CPU only) | < 60 Sekunden |
| Analyse-Zeit (3B, iGPU) | < 20 Sekunden |
| App-Startzeit | < 3 Sekunden (nach erstem Start) |
| Erster Start (inkl. Modell-Download) | geführter Prozess, klarer Fortschritt |
| App-Größe (ohne Modell) | < 50 MB |
| Datenbankgröße (1000 Bons, ohne Bilder) | < 10 MB |
| Bildarchiv-Kompression | JPEG 80%, max. 1920px |

---

## 10. Abhängigkeiten & Lizenzen

| Komponente | Lizenz | Bemerkung |
|---|---|---|
| Tauri v2 | MIT / Apache-2.0 | — |
| React 18 | MIT | — |
| shadcn/ui | MIT | — |
| Recharts | MIT | — |
| rusqlite | MIT | SQLite-Bindings für Rust |
| llama.cpp | MIT | Vulkan-Build als Sidecar |
| Qwen2.5-VL 3B | Qwen License | Kommerzielle Nutzung erlaubt |
| image (Rust crate) | MIT / Apache-2.0 | Bildvorverarbeitung |

---

## 11. Offene Fragen / To-Do vor Implementierung

- [ ] Modell-Download-URL finalisieren (Hugging Face Repo bestätigen)
- [ ] llama.cpp Vulkan-Build: eigener Compile oder vorgefertigte Binary?
- [ ] Kategorie-Liste finalisieren (welche Kategorien sollen Standard sein?)
- [ ] Umgang mit Aldi-Nord vs. Aldi-Süd (gleiche Preise oder getrennt tracken?)
- [ ] Bildarchiv: Originale behalten oder nach Analyse löschen? (Datenschutz)
- [ ] Produktnormalisierung Phase 2: Schwellwert für Fuzzy-Match definieren
- [ ] HeroUI v2 oder alternatives UI-Framework evaluieren (Shadcn/ui?) → **entschieden: shadcn/ui**

---

## 12. Meilensteine

| Meilenstein | Inhalt | Ziel |
|---|---|---|
| M1 — Proof of Concept | llama-server als Sidecar starten, Bild analysieren, JSON ausgeben | KI-Integration funktioniert |
| M2 — MVP | Import, Analyse, Korrektur-UI, SQLite-Speicherung, Bon-Liste | Grundfunktionalität nutzbar |
| M3 — Analyse | Preisverlauf-Charts, Dashboard, Produktnormalisierung | Mehrwert durch Datenanalyse |
| M4 — Polish | Export, Backup, Onboarding, Fehlerbehandlung, Performance | Release-fähig |
