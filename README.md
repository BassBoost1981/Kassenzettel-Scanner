# Kassenzettel Scanner

<p align="center">
  <img src="public/logo-dark.svg" alt="Kassenzettel Scanner Logo" width="120" />
</p>

<p align="center">
  <strong>Kassenzettel per lokaler KI scannen und auswerten</strong><br>
  <em>Scan grocery receipts via local AI — no cloud, no subscription, 100% offline.</em>
</p>

---

## Features

- **Kassenzettel scannen** — Bild hochladen oder per Drag & Drop, automatische Erkennung via lokaler KI (Qwen2.5-VL-3B)
- **Korrektur-Tabelle** — Erkannte Artikel pruefen, bearbeiten und ergaenzen
- **Kassenzettel-Verwaltung** — Alle Scans durchsuchen, filtern und als CSV exportieren
- **Dashboard** — Monatliche Ausgaben und Kategorie-Auswertungen mit interaktiven Charts
- **Preishistorie** — Produktpreise ueber Zeit verfolgen und vergleichen
- **Kategorien & Geschaefte** — Frei konfigurierbare Kategorien und Geschaefte
- **Offline-first** — Alle Daten lokal in SQLite, KI laeuft lokal via llama-server
- **Dark Mode** — Automatische Erkennung des System-Themes

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | [Tauri 2](https://v2.tauri.app/) (Rust + WebView) |
| Frontend | React 18, TypeScript 5.6, Vite 6 |
| Styling | TailwindCSS 4, shadcn/ui |
| State | Zustand 5 |
| Charts | Recharts 2 |
| Datenbank | SQLite (rusqlite) |
| KI-Modell | Qwen2.5-VL-3B-Instruct (GGUF, lokal) |
| KI-Runtime | llama-server (llama.cpp) |

## Voraussetzungen

- **Node.js** >= 18
- **Rust** >= 1.70 (mit `cargo`)
- **Windows 10/11** (NSIS-Installer)

Das KI-Modell wird beim ersten Start ueber den integrierten Onboarding-Assistenten heruntergeladen.

## Installation & Entwicklung

```bash
# Repository klonen / Clone repository
git clone https://github.com/BassBoost1981/Kassenzettel-Scanner.git
cd Kassenzettel-Scanner

# Abhaengigkeiten installieren / Install dependencies
npm install

# Entwicklungsserver starten / Start dev server
npm run tauri dev
```

## Production Build

```bash
# Vollstaendiger Build (Frontend + Rust + NSIS Installer)
npm run tauri build
```

Der Installer wird erstellt unter:
```
src-tauri/target/release/bundle/nsis/Kassenzettel Scanner_0.1.0_x64-setup.exe
```

## Projektstruktur

```
Kassenzettel-Scanner/
├── src/                          # React Frontend
│   ├── components/
│   │   ├── charts/               # Dashboard, Preishistorie
│   │   ├── layout/               # Sidebar, StatusBar, ThemeProvider
│   │   ├── onboarding/           # KI-Modell Download
│   │   ├── receipts/             # Kassenzettel-Liste & Details
│   │   ├── scan/                 # DropZone, Fortschritt, Korrektur-Tabelle
│   │   ├── settings/             # Einstellungen
│   │   └── ui/                   # shadcn UI-Komponenten
│   ├── hooks/                    # Custom React Hooks
│   ├── store/                    # Zustand Stores
│   ├── types/                    # TypeScript Interfaces
│   └── lib/                      # Tauri Command Wrapper
├── src-tauri/                    # Rust Backend
│   ├── src/
│   │   ├── commands/             # Tauri Commands (30+)
│   │   ├── db/                   # SQLite Schema & Seed-Daten
│   │   └── sidecar.rs            # llama-server Lifecycle
│   ├── binaries/                 # llama.cpp DLLs
│   └── tauri.conf.json           # Tauri-Konfiguration
└── public/                       # Logos & Assets
```

## KI-Modell

Der Kassenzettel Scanner nutzt **Qwen2.5-VL-3B-Instruct** als lokales Vision-Language-Modell:

| Datei | Groesse |
|-------|---------|
| `Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` | ~2 GB |
| `mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf` | ~1.5 GB |

Die Modelle werden beim Onboarding automatisch von HuggingFace heruntergeladen und im App-Verzeichnis gespeichert. Der integrierte **llama-server** laeuft auf `http://127.0.0.1:8190`.

## Lizenz

Dieses Projekt hat noch keine Lizenz. / This project is not yet licensed.
