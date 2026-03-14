# Kassenzettel-Scanner MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a portable Windows desktop app that scans receipts via local AI (Qwen2.5-VL), extracts items/prices, stores them in SQLite, and displays receipt history — fully offline, USB-portable.

**Architecture:** Tauri v2 shell wrapping a React 18 frontend. Rust backend handles SQLite (rusqlite), image processing (image crate), WIA scanner dialog (windows crate), and manages a llama.cpp sidecar process for AI inference. All data stored in `./data/` relative to the app binary for USB portability.

**Tech Stack:** Tauri v2, Rust, React 18, TypeScript, shadcn/ui, TailwindCSS, Zustand, Recharts, SQLite (rusqlite), llama.cpp (Vulkan), Lexend font

**Spec:** `docs/superpowers/specs/2026-03-14-kassenzettel-scanner-design.md`

---

## File Structure

### Rust Backend (`src-tauri/`)

| File | Responsibility |
|------|---------------|
| `src/main.rs` | Tauri entry, plugin registration, command registration |
| `src/db/mod.rs` | DB module, connection pool, init |
| `src/db/schema.rs` | CREATE TABLE statements, migration logic |
| `src/db/seed.rs` | Default categories and stores |
| `src/commands/mod.rs` | Command module exports |
| `src/commands/receipts.rs` | CRUD for receipts + receipt_items |
| `src/commands/products.rs` | Products + aliases CRUD |
| `src/commands/settings.rs` | Settings key-value CRUD |
| `src/commands/stores.rs` | Stores CRUD |
| `src/commands/analyze.rs` | Image preprocessing, llama-server HTTP, JSON parsing |
| `src/commands/scanner.rs` | WIA scanner dialog via COM |
| `src/commands/export.rs` | CSV export |
| `src/sidecar.rs` | llama-server lifecycle (start, stop, health, download) |
| `Cargo.toml` | Dependencies |
| `tauri.conf.json` | Tauri config (window, sidecar, permissions) |
| `capabilities/default.json` | Tauri v2 capability permissions |

### React Frontend (`src/`)

| File | Responsibility |
|------|---------------|
| `src/main.tsx` | React entry point |
| `src/App.tsx` | Root layout with Sidebar + StatusBar + Router |
| `src/Router.tsx` | Route definitions (Scan, Bons, Settings) |
| `src/index.css` | Global styles, Lexend import, CSS variables, Tailwind |
| `src/types/receipt.ts` | Receipt, ReceiptItem interfaces |
| `src/types/product.ts` | Product, ProductAlias interfaces |
| `src/types/store.ts` | Store interface |
| `src/types/settings.ts` | Settings interface |
| `src/lib/tauri-commands.ts` | Typed invoke wrappers for all Tauri commands |
| `src/lib/utils.ts` | cn() helper, formatters |
| `src/hooks/useTheme.ts` | System theme detection + manual override |
| `src/hooks/useSidecar.ts` | Sidecar status polling |
| `src/hooks/useAnalyze.ts` | Receipt analysis with streaming |
| `src/hooks/useReceipts.ts` | Receipt CRUD operations |
| `src/hooks/useStores.ts` | Store CRUD operations |
| `src/hooks/useProducts.ts` | Products + aliases CRUD |
| `src/hooks/useSettings.ts` | Settings read/write |
| `src/store/receiptStore.ts` | Zustand store for receipts |
| `src/store/settingsStore.ts` | Zustand store for settings |
| `src/store/storeStore.ts` | Zustand store for stores (Märkte) |
| `src/store/sidecarStore.ts` | Zustand store for sidecar status |
| `src/components/layout/Sidebar.tsx` | Collapsible sidebar navigation |
| `src/components/layout/StatusBar.tsx` | Bottom bar: sidecar status |
| `src/components/layout/ThemeProvider.tsx` | Dark/Light/System theme context |
| `src/components/scan/DropZone.tsx` | Drag&drop + file + scanner buttons |
| `src/components/scan/ScanProgress.tsx` | Streaming tokens + progress |
| `src/components/scan/CorrectionTable.tsx` | Editable receipt items table |
| `src/components/receipts/ReceiptList.tsx` | Filterable receipt table |
| `src/components/receipts/ReceiptDetail.tsx` | Single receipt detail view |
| `src/components/settings/SettingsPage.tsx` | 4-tab settings page |
| `src/components/onboarding/ModelDownload.tsx` | First-start model download dialog |

### Config Files (Root)

| File | Responsibility |
|------|---------------|
| `package.json` | Node dependencies |
| `tsconfig.json` | TypeScript config |
| `vite.config.ts` | Vite config for Tauri |
| `tailwind.config.ts` | Tailwind with Lexend, dark mode, custom colors |
| `components.json` | shadcn/ui config |
| `.gitignore` | Ignore data/, node_modules/, target/ |

---

## Chunk 1: Project Scaffolding & Configuration

### Task 1: Initialize Tauri v2 + React + TypeScript project

**Files:**
- Create: all root config files, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`

- [ ] **Step 1: Create Tauri v2 project**

```bash
cd e:/Vibe-Coding/Kassenzettel-Scanner
npm create tauri-app@latest . -- --template react-ts --manager npm
```

Select: React, TypeScript, npm when prompted.

- [ ] **Step 2: Verify project created successfully**

```bash
ls src-tauri/src/main.rs src/App.tsx package.json
```

Expected: All three files exist.

- [ ] **Step 3: Install frontend dependencies**

```bash
npm install zustand recharts react-router-dom
npm install -D @types/react-router-dom
```

- [ ] **Step 4: Commit scaffolding**

```bash
git init
git add -A
git commit -m "feat: initialize Tauri v2 + React + TypeScript project / Tauri v2 + React + TypeScript Projekt initialisiert"
```

---

### Task 2: Configure TailwindCSS + shadcn/ui

**Files:**
- Modify: `package.json`, `vite.config.ts`, `src/index.css`
- Create: `tailwind.config.ts`, `components.json`

- [ ] **Step 1: Install TailwindCSS v4**

@tailwind-patterns — Check Context7 for latest Tailwind v4 install steps for Vite.

```bash
npm install tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Add Tailwind plugin to vite.config.ts**

Add `@tailwindcss/vite` plugin to the Vite config.

- [ ] **Step 3: Setup src/index.css with Tailwind + Lexend + CSS variables**

```css
@import "tailwindcss";

@font-face {
  font-family: 'Lexend';
  src: url('/Font/Lexend-VariableFont_wght.ttf') format('truetype');
  font-weight: 100 900;
  font-display: swap;
}

:root {
  --font-sans: 'Lexend', system-ui, sans-serif;

  /* Light theme */
  --background: #F8FAFC;
  --foreground: #1E293B;
  --card: #FFFFFF;
  --card-foreground: #1E293B;
  --primary: #3B82F6;
  --primary-foreground: #FFFFFF;
  --secondary: #E2E8F0;
  --secondary-foreground: #475569;
  --muted: #F1F5F9;
  --muted-foreground: #94A3B8;
  --accent: #3B82F6;
  --accent-foreground: #FFFFFF;
  --destructive: #EF4444;
  --border: #E2E8F0;
  --ring: #3B82F6;
  --radius: 0.75rem;
}

.dark {
  --background: #0F172A;
  --foreground: #F1F5F9;
  --card: #1E293B;
  --card-foreground: #F1F5F9;
  --primary: #00FFFF;
  --primary-foreground: #0F172A;
  --secondary: #334155;
  --secondary-foreground: #CBD5E1;
  --muted: #1E293B;
  --muted-foreground: #64748B;
  --accent: #00FFFF;
  --accent-foreground: #0F172A;
  --destructive: #EF4444;
  --border: #334155;
  --ring: #00FFFF;
}

body {
  font-family: var(--font-sans);
  background-color: var(--background);
  color: var(--foreground);
}
```

- [ ] **Step 4: Initialize shadcn/ui**

@react-patterns — Check Context7 for shadcn/ui init with Vite + Tailwind v4.

```bash
npx shadcn@latest init
```

Select: New York style, slate base color, CSS variables.

- [ ] **Step 5: Install core shadcn/ui components**

```bash
npx shadcn@latest add button input table card dialog select dropdown-menu tabs badge separator scroll-area tooltip
```

- [ ] **Step 6: Copy Lexend font to public**

```bash
mkdir -p public/Font
cp Font/Lexend-VariableFont_wght.ttf public/Font/
```

- [ ] **Step 7: Verify Tailwind + shadcn works**

Update `src/App.tsx` with a simple Button component and verify it renders correctly:

```bash
npm run dev
```

Expected: Dev server starts, button renders with correct styling.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: configure TailwindCSS v4 + shadcn/ui + Lexend font / TailwindCSS v4 + shadcn/ui + Lexend Schrift konfiguriert"
```

---

### Task 3: Configure Tauri v2 permissions + portable data path

**Files:**
- Modify: `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
- Create: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Update tauri.conf.json**

Set app identifier, window config, and sidecar:

```json
{
  "productName": "Kassenzettel Scanner",
  "identifier": "com.kassenzettel.scanner",
  "build": {
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Kassenzettel Scanner",
        "width": 1200,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "center": true
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": [
      "icons/icon.png"
    ],
    "externalBin": [
      "binaries/llama-server"
    ]
  }
}
```

- [ ] **Step 2: Add Rust dependencies to Cargo.toml**

```toml
[dependencies]
tauri = { version = "2", features = ["shell-sidecar"] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
reqwest = { version = "0.12", features = ["json", "stream"] }
tokio = { version = "1", features = ["full"] }
image = "0.25"
base64 = "0.22"
uuid = { version = "1", features = ["v4"] }
```

- [ ] **Step 3: Create capabilities/default.json**

```json
{
  "identifier": "default",
  "description": "Default permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:path:default",
    "shell:allow-spawn",
    "shell:allow-execute",
    "dialog:default",
    "fs:default"
  ]
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
target/
data/
.superpowers/
*.exe
```

- [ ] **Step 5: Verify Rust compiles**

```bash
cd src-tauri && cargo check
```

Expected: Compilation succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: configure Tauri v2 permissions + portable data path / Tauri v2 Berechtigungen + portabler Datenpfad konfiguriert"
```

---

## Chunk 2: Database Layer

### Task 4: Implement SQLite database schema + initialization

**Files:**
- Create: `src-tauri/src/db/mod.rs`, `src-tauri/src/db/schema.rs`, `src-tauri/src/db/seed.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Create db/mod.rs — DB connection + init**

```rust
// src-tauri/src/db/mod.rs
pub mod schema;
pub mod seed;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_dir: PathBuf) -> Result<Self, rusqlite::Error> {
        let db_dir = app_dir.join("data").join("db");
        std::fs::create_dir_all(&db_dir).expect("Failed to create db directory");

        let db_path = db_dir.join("kassenzettel.db");
        let conn = Connection::open(&db_path)?;

        // Enable WAL mode for better concurrency
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        // Run schema + seed
        schema::create_tables(&conn)?;
        seed::insert_defaults(&conn)?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }
}
```

- [ ] **Step 2: Create db/schema.rs — All CREATE TABLE + indexes**

Full SQL from the spec, 6 tables: settings, categories, stores, receipts, products, product_aliases, receipt_items + indexes.

- [ ] **Step 3: Create db/seed.rs — Default categories + stores**

Insert 8 categories and 10 stores (with ON CONFLICT IGNORE for re-runs).

- [ ] **Step 4: Wire DB into main.rs**

```rust
// src-tauri/src/main.rs
mod db;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app.path().resource_dir()
                .unwrap_or_else(|_| std::env::current_exe()
                    .unwrap().parent().unwrap().to_path_buf());

            let database = db::Database::new(app_dir)
                .expect("Failed to initialize database");

            app.manage(database);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Test DB initialization compiles**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 6: Write Rust test for schema creation**

```rust
// In db/schema.rs
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_create_tables() {
        let conn = Connection::open_in_memory().unwrap();
        create_tables(&conn).unwrap();

        // Verify all tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"categories".to_string()));
        assert!(tables.contains(&"stores".to_string()));
        assert!(tables.contains(&"receipts".to_string()));
        assert!(tables.contains(&"products".to_string()));
        assert!(tables.contains(&"receipt_items".to_string()));
        assert!(tables.contains(&"settings".to_string()));
    }
}
```

- [ ] **Step 7: Run test**

```bash
cd src-tauri && cargo test
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: implement SQLite schema, seed data, DB initialization / SQLite Schema, Seed-Daten und DB-Initialisierung implementiert"
```

---

### Task 5: Implement Tauri commands for Settings + Stores

**Files:**
- Create: `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/settings.rs`, `src-tauri/src/commands/stores.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Create commands/mod.rs**

```rust
pub mod settings;
pub mod stores;
```

- [ ] **Step 2: Create commands/settings.rs**

Implement three Tauri commands:
- `get_setting(key: String) -> Option<String>`
- `set_setting(key: String, value: String) -> Result<()>`
- `get_all_settings() -> Vec<(String, String)>`

- [ ] **Step 3: Create commands/stores.rs**

Implement:
- `get_stores() -> Vec<Store>`
- `create_store(name: String) -> Result<Store>`
- `update_store(id: i64, name: String, merge_variants: bool) -> Result<()>`
- `delete_store(id: i64) -> Result<()>`

- [ ] **Step 4: Register commands in main.rs**

```rust
.invoke_handler(tauri::generate_handler![
    commands::settings::get_setting,
    commands::settings::set_setting,
    commands::settings::get_all_settings,
    commands::stores::get_stores,
    commands::stores::create_store,
    commands::stores::update_store,
    commands::stores::delete_store,
])
```

- [ ] **Step 5: Write tests for settings + stores**

Test CRUD operations against in-memory SQLite.

- [ ] **Step 6: Run tests**

```bash
cd src-tauri && cargo test
```

Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add settings + stores Tauri commands / Settings + Märkte Tauri-Commands hinzugefügt"
```

---

### Task 6: Implement Tauri commands for Receipts

**Files:**
- Create: `src-tauri/src/commands/receipts.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create commands/receipts.rs**

Implement:
- `create_receipt(receipt: NewReceipt) -> Result<Receipt>` — inserts receipt + items in transaction
- `get_receipts(filter: ReceiptFilter) -> Vec<ReceiptSummary>` — list with optional store/date/amount filter
- `get_receipt_detail(id: i64) -> Result<ReceiptDetail>` — full receipt with all items
- `delete_receipt(id: i64) -> Result<()>` — cascade deletes items
- `search_receipts(query: String) -> Vec<ReceiptSummary>` — search by item name

Define Serde structs:

```rust
#[derive(Serialize, Deserialize)]
pub struct NewReceipt {
    pub store_id: i64,
    pub date: String,
    pub time: Option<String>,
    pub total_amount: f64,
    pub discount_total: f64,
    pub deposit_total: f64,
    pub payment_method: Option<String>,
    pub image_path: Option<String>,
    pub raw_json: Option<String>,
    pub items: Vec<NewReceiptItem>,
}

#[derive(Serialize, Deserialize)]
pub struct NewReceiptItem {
    pub raw_name: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub total_price: f64,
    pub discount: f64,
    pub deposit: f64,
    pub category_id: Option<i64>,
}
```

- [ ] **Step 2: Add to mod.rs**

```rust
pub mod receipts;
```

- [ ] **Step 3: Register receipt commands in main.rs**

- [ ] **Step 4: Write tests**

Test creating a receipt with items, retrieving it, filtering, searching, and deleting.

- [ ] **Step 5: Run tests**

```bash
cd src-tauri && cargo test
```

Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add receipt CRUD Tauri commands / Kassenzettel CRUD Tauri-Commands hinzugefügt"
```

---

## Chunk 3: Sidecar & AI Integration

### Task 7: Implement llama-server sidecar lifecycle

**Files:**
- Create: `src-tauri/src/sidecar.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Create sidecar.rs**

Implement:
- `start_server(app: AppHandle, gpu_layers: i32) -> Result<()>` — spawn llama-server.exe as Tauri sidecar on port 8190
- `stop_server(app: AppHandle) -> Result<()>` — kill sidecar process
- `health_check() -> Result<bool>` — GET http://127.0.0.1:8190/health
- `get_sidecar_status() -> SidecarStatus` — returns Ready/Loading/Error/ModelMissing

Store sidecar child process in Tauri state.

```rust
pub struct SidecarState {
    pub child: Mutex<Option<CommandChild>>,
    pub status: Mutex<SidecarStatus>,
}

#[derive(Serialize, Clone)]
pub enum SidecarStatus {
    Starting,
    Ready,
    Error(String),
    ModelMissing,
    Stopped,
}
```

- [ ] **Step 2: Add sidecar state to main.rs setup**

Initialize SidecarState and manage it. Attempt to start server in setup if model exists.

- [ ] **Step 3: Register sidecar commands**

```rust
commands::sidecar::start_llama_server,
commands::sidecar::stop_llama_server,
commands::sidecar::get_sidecar_status,
```

- [ ] **Step 4: Verify compiles**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement llama-server sidecar lifecycle / llama-server Sidecar-Lifecycle implementiert"
```

---

### Task 8: Implement model download with progress

**Files:**
- Modify: `src-tauri/src/sidecar.rs`

- [ ] **Step 1: Add download_model command**

Implement `download_model(app: AppHandle) -> Result<()>`:
- Download from Hugging Face URL
- Stream response with reqwest
- Emit progress events to frontend via `app.emit("model-download-progress", payload)`
- Save to `./data/models/qwen2.5-vl-3b-instruct-q4_k_m.gguf`
- Support resumable download (check existing file size, use Range header)

```rust
#[derive(Serialize, Clone)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percent: f64,
}
```

- [ ] **Step 2: Add check_model_exists command**

```rust
#[tauri::command]
pub fn check_model_exists(app: AppHandle) -> bool {
    let model_path = get_model_path(&app);
    model_path.exists()
}
```

- [ ] **Step 3: Verify compiles**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add model download with progress events / Modell-Download mit Fortschritts-Events hinzugefügt"
```

---

### Task 9: Implement receipt analysis (AI inference)

**Files:**
- Create: `src-tauri/src/commands/analyze.rs`
- Modify: `src-tauri/src/commands/mod.rs`, `src-tauri/src/main.rs`

- [ ] **Step 1: Create commands/analyze.rs**

Implement `analyze_receipt(app: AppHandle, image_path: String) -> Result<AnalysisResult>`:

1. Load image with `image` crate
2. Resize to max 1024px (maintaining aspect ratio)
3. Convert to grayscale, enhance contrast
4. Encode as Base64 JPEG
5. POST to `http://127.0.0.1:8190/v1/chat/completions` with:
   - model: "qwen2.5-vl"
   - stream: true
   - temperature: 0.1
   - max_tokens: 2048
   - messages with image_url + OCR prompt
6. Read SSE stream, emit token events to frontend
7. Parse final JSON, return `AnalysisResult`

```rust
#[derive(Serialize, Deserialize)]
pub struct AnalysisResult {
    pub markt: Option<String>,
    pub datum: Option<String>,
    pub uhrzeit: Option<String>,
    pub artikel: Vec<AnalyzedItem>,
    pub gesamtbetrag: Option<f64>,
    pub rabatte_gesamt: Option<f64>,
    pub pfand_gesamt: Option<f64>,
    pub zahlungsart: Option<String>,
    pub raw_text: String,  // Always include raw for fallback
}

#[derive(Serialize, Deserialize)]
pub struct AnalyzedItem {
    pub name: String,
    pub menge: f64,
    pub einzelpreis: f64,
    pub gesamtpreis: f64,
    pub rabatt: f64,
    pub pfand: f64,
    pub kategorie: Option<String>,
    pub confidence: f64,  // 0.0 - 1.0
}
```

- [ ] **Step 2: Implement image archiving**

If setting "keep_images" is true, save a copy at JPEG 80% quality, max 1920px to `./data/images/{uuid}.jpg`.

- [ ] **Step 3: Add OCR prompt as const**

```rust
const OCR_PROMPT: &str = r#"Du analysierst einen deutschen Kassenzettel.
Extrahiere alle Informationen und antworte NUR mit einem validen JSON-Objekt. Keine Erklärungen, kein Markdown.

Regeln:
- Preise immer als Dezimalzahl (1.19, nicht "1,19")
- Datum im Format YYYY-MM-DD
- Menge als Zahl (2, nicht "2x")
- Rabatte und Pfand separat ausweisen
- Kategorie aus: Obst/Gemüse, Milchprodukte, Fleisch/Wurst, Backwaren, Getränke, Tiefkühl, Drogerie, Sonstiges
- confidence: 1.0 wenn sicher, 0.5 wenn unsicher, 0.0 wenn geraten

Schema: { "markt": "...", "datum": "YYYY-MM-DD", "uhrzeit": "HH:MM", "artikel": [{"name": "...", "menge": 1, "einzelpreis": 0.00, "gesamtpreis": 0.00, "rabatt": 0.00, "pfand": 0.00, "kategorie": "...", "confidence": 1.0}], "gesamtbetrag": 0.00, "rabatte_gesamt": 0.00, "pfand_gesamt": 0.00, "zahlungsart": "..." }"#;
```

- [ ] **Step 4: Register command + verify compiles**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement AI receipt analysis with streaming / KI-Kassenzettel-Analyse mit Streaming implementiert"
```

---

### Task 10: Implement WIA scanner dialog

**Files:**
- Create: `src-tauri/src/commands/scanner.rs`
- Modify: `src-tauri/src/commands/mod.rs`, `src-tauri/src/main.rs`, `Cargo.toml`

- [ ] **Step 1: Add windows crate dependency**

```toml
# Cargo.toml
[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = [
    "Win32_Devices_ImageAcquisition",
    "Win32_System_Com",
] }
```

- [ ] **Step 2: Create commands/scanner.rs**

Implement `scan_document() -> Result<String>`:
- Initialize COM
- Create WIA Device Manager
- Show WIA Select Device dialog
- Show WIA Acquire Image dialog
- Save result to temp file
- Return temp file path

Fallback: If WIA fails, return error with user-friendly message.

```rust
#[tauri::command]
pub async fn scan_document(app: tauri::AppHandle) -> Result<String, String> {
    // COM + WIA logic here
    // Returns path to scanned image
}

#[tauri::command]
pub fn is_scanner_available() -> bool {
    // Check if any WIA device is connected
}
```

- [ ] **Step 3: Register commands, verify compiles**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: implement WIA scanner dialog integration / WIA Scanner-Dialog Integration implementiert"
```

---

## Chunk 4: Frontend — Types, Hooks, Stores

### Task 11: Create TypeScript types + Tauri command wrappers

**Files:**
- Create: `src/types/receipt.ts`, `src/types/product.ts`, `src/types/store.ts`, `src/types/settings.ts`, `src/lib/tauri-commands.ts`, `src/lib/utils.ts`

- [ ] **Step 1: Create all type files**

`src/types/receipt.ts`:
```typescript
export interface Receipt {
  id: number;
  store_id: number;
  store_name?: string;
  date: string;
  time: string | null;
  total_amount: number;
  discount_total: number;
  deposit_total: number;
  payment_method: string | null;
  image_path: string | null;
  created_at: string;
}

export interface ReceiptItem {
  id: number;
  receipt_id: number;
  product_id: number | null;
  raw_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount: number;
  deposit: number;
  category_id: number | null;
  category_name?: string;
}

export interface ReceiptDetail extends Receipt {
  items: ReceiptItem[];
}

export interface AnalysisResult {
  markt: string | null;
  datum: string | null;
  uhrzeit: string | null;
  artikel: AnalyzedItem[];
  gesamtbetrag: number | null;
  rabatte_gesamt: number | null;
  pfand_gesamt: number | null;
  zahlungsart: string | null;
  raw_text: string;
}

export interface AnalyzedItem {
  name: string;
  menge: number;
  einzelpreis: number;
  gesamtpreis: number;
  rabatt: number;
  pfand: number;
  kategorie: string | null;
  confidence: number;
}
```

Similar for `store.ts`, `product.ts`, `settings.ts`.

- [ ] **Step 2: Create lib/tauri-commands.ts**

Typed wrappers around `invoke()` for all Tauri commands:

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { Receipt, ReceiptDetail, AnalysisResult } from "../types/receipt";
import type { Store } from "../types/store";

// Settings
export const getSetting = (key: string) => invoke<string | null>("get_setting", { key });
export const setSetting = (key: string, value: string) => invoke("set_setting", { key, value });

// Stores
export const getStores = () => invoke<Store[]>("get_stores");
export const createStore = (name: string) => invoke<Store>("create_store", { name });

// Receipts
export const getReceipts = (filter?: ReceiptFilter) => invoke<Receipt[]>("get_receipts", { filter });
export const getReceiptDetail = (id: number) => invoke<ReceiptDetail>("get_receipt_detail", { id });
export const createReceipt = (receipt: NewReceipt) => invoke<Receipt>("create_receipt", { receipt });
export const deleteReceipt = (id: number) => invoke("delete_receipt", { id });

// Analysis
export const analyzeReceipt = (imagePath: string) => invoke<AnalysisResult>("analyze_receipt", { imagePath });

// Scanner
export const scanDocument = () => invoke<string>("scan_document");
export const isScannerAvailable = () => invoke<boolean>("is_scanner_available");

// Sidecar
export const getSidecarStatus = () => invoke<string>("get_sidecar_status");
export const startLlamaServer = () => invoke("start_llama_server");
export const checkModelExists = () => invoke<boolean>("check_model_exists");
export const downloadModel = () => invoke("download_model");
```

- [ ] **Step 3: Create lib/utils.ts**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("de-DE");
}
```

- [ ] **Step 4: Install clsx + tailwind-merge**

```bash
npm install clsx tailwind-merge
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add TypeScript types + Tauri command wrappers / TypeScript-Typen + Tauri-Command-Wrapper hinzugefügt"
```

---

### Task 12: Create Zustand stores + hooks

**Files:**
- Create: `src/store/receiptStore.ts`, `src/store/settingsStore.ts`, `src/store/sidecarStore.ts`
- Create: `src/hooks/useTheme.ts`, `src/hooks/useSidecar.ts`, `src/hooks/useAnalyze.ts`, `src/hooks/useReceipts.ts`, `src/hooks/useStores.ts`, `src/hooks/useSettings.ts`

- [ ] **Step 1: Create settingsStore.ts**

```typescript
import { create } from "zustand";
import { getSetting, setSetting } from "../lib/tauri-commands";

interface SettingsState {
  theme: "system" | "dark" | "light";
  keepImages: "keep" | "delete" | "ask";
  aldiMerge: boolean;
  gpuLayers: number;
  setTheme: (theme: "system" | "dark" | "light") => void;
  setKeepImages: (value: "keep" | "delete" | "ask") => void;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "system",
  keepImages: "keep",
  aldiMerge: false,
  gpuLayers: -1,
  setTheme: async (theme) => {
    await setSetting("theme", theme);
    set({ theme });
  },
  setKeepImages: async (value) => {
    await setSetting("keep_images", value);
    set({ keepImages: value });
  },
  loadSettings: async () => {
    const theme = (await getSetting("theme")) as "system" | "dark" | "light" || "system";
    const keepImages = (await getSetting("keep_images")) as "keep" | "delete" | "ask" || "keep";
    set({ theme, keepImages });
  },
}));
```

- [ ] **Step 2: Create sidecarStore.ts**

Track sidecar status, polling, model download progress.

- [ ] **Step 3: Create receiptStore.ts**

Receipts list, current detail, filters, loading states.

- [ ] **Step 4: Create useTheme.ts**

```typescript
import { useEffect } from "react";
import { useSettingsStore } from "../store/settingsStore";

export function useTheme() {
  const { theme } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = (e: MediaQueryList | MediaQueryListEvent) => {
        root.classList.toggle("dark", e.matches);
      };
      apply(mediaQuery);
      mediaQuery.addEventListener("change", apply);
      return () => mediaQuery.removeEventListener("change", apply);
    }

    root.classList.toggle("dark", theme === "dark");
  }, [theme]);
}
```

- [ ] **Step 5: Create remaining hooks**

- `useSidecar.ts` — polls sidecar status, listens for download events
- `useAnalyze.ts` — triggers analysis, listens for streaming tokens
- `useReceipts.ts` — wraps receiptStore actions
- `useStores.ts` — wraps store CRUD commands
- `useProducts.ts` — wraps product CRUD commands
- `useSettings.ts` — wraps settingsStore

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Zustand stores + React hooks / Zustand Stores + React Hooks hinzugefügt"
```

---

## Chunk 5: Frontend — Layout & Navigation

### Task 13: Implement ThemeProvider + Layout Shell

**Files:**
- Create: `src/components/layout/ThemeProvider.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/StatusBar.tsx`
- Modify: `src/App.tsx`
- Create: `src/Router.tsx`

- [ ] **Step 1: Create ThemeProvider.tsx**

Wraps app, calls `useTheme()`, provides logo switching (dark logo in dark mode, light logo in light mode).

- [ ] **Step 2: Create Sidebar.tsx**

Collapsible sidebar with:
- App logo (top, switches by theme)
- Navigation items: Scan (camera icon), Bons (list icon), Einstellungen (gear icon)
- Phase 2 items disabled/hidden: Preisverlauf, Preisvergleich, Dashboard
- Collapse button (hamburger)
- Active state highlighting with primary color

Use shadcn/ui Button + Tooltip for icon-only collapsed state.

- [ ] **Step 3: Create StatusBar.tsx**

Bottom bar showing:
- Sidecar status dot (green=ready, yellow=loading, red=error)
- Status text ("KI bereit" / "KI wird geladen..." / "KI Fehler")
- Model name if loaded

- [ ] **Step 4: Create Router.tsx**

```typescript
import { Routes, Route, Navigate } from "react-router-dom";
import ScanView from "./components/scan/DropZone";
import ReceiptList from "./components/receipts/ReceiptList";
import ReceiptDetail from "./components/receipts/ReceiptDetail";
import SettingsPage from "./components/settings/SettingsPage";

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/scan" replace />} />
      <Route path="/scan" element={<ScanView />} />
      <Route path="/receipts" element={<ReceiptList />} />
      <Route path="/receipts/:id" element={<ReceiptDetail />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
```

- [ ] **Step 5: Wire up App.tsx**

```typescript
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./components/layout/ThemeProvider";
import Sidebar from "./components/layout/Sidebar";
import StatusBar from "./components/layout/StatusBar";
import Router from "./Router";

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <div className="flex h-screen bg-background text-foreground">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <main className="flex-1 overflow-auto p-6">
              <Router />
            </main>
            <StatusBar />
          </div>
        </div>
      </ThemeProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Verify layout renders**

```bash
npm run dev
```

Expected: Sidebar + main area + status bar visible, theme switching works.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: implement app shell with Sidebar, StatusBar, Router / App-Shell mit Sidebar, StatusBar, Router implementiert"
```

---

## Chunk 6: Frontend — Scan Workflow

### Task 14: Implement DropZone (image import)

**Files:**
- Create: `src/components/scan/DropZone.tsx`

- [ ] **Step 1: Create DropZone.tsx**

Central drop zone with:
- Drag & Drop area (border-dashed, primary color)
- "Datei auswählen" button → Tauri file dialog (JPEG, PNG, WebP, HEIC)
- "Scannen" button → calls `scanDocument()`, disabled if no scanner
- Drop handler: validates file type, stores path in local state
- On valid image: transition to analysis state

Use shadcn/ui Button, Card.

- [ ] **Step 2: Add file dialog integration**

```typescript
import { open } from "@tauri-apps/plugin-dialog";

const handleFileSelect = async () => {
  const path = await open({
    filters: [{ name: "Bilder", extensions: ["jpg", "jpeg", "png", "webp", "heic"] }],
  });
  if (path) startAnalysis(path as string);
};
```

- [ ] **Step 3: Verify DropZone renders and file dialog works**

```bash
npm run tauri dev
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: implement DropZone with drag&drop + file dialog + scanner / DropZone mit Drag&Drop + Datei-Dialog + Scanner implementiert"
```

---

### Task 15: Implement ScanProgress (streaming analysis)

**Files:**
- Create: `src/components/scan/ScanProgress.tsx`

- [ ] **Step 1: Create ScanProgress.tsx**

Split-view component:
- Left: Original image preview (resized to fit)
- Right: Streaming token output + progress bar
- Listen to Tauri events for tokens: `listen("analysis-token", ...)`
- Show estimated time remaining
- On complete: transition to CorrectionTable

- [ ] **Step 2: Verify streaming display works with mock data**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: implement ScanProgress with streaming tokens / ScanProgress mit Streaming-Tokens implementiert"
```

---

### Task 16: Implement CorrectionTable (editable results)

**Files:**
- Create: `src/components/scan/CorrectionTable.tsx`

- [ ] **Step 1: Create CorrectionTable.tsx**

Split-view:
- Left: Original image (scrollable)
- Right: Editable table with columns: Artikel, Menge, Einzelpreis, Gesamtpreis, Kategorie
- Each cell is inline-editable (click → input)
- Rows with confidence < 0.7 get yellow/warning highlight
- Header: Detected store name (editable dropdown) + date + time
- Footer: Gesamtbetrag, Rabatte, Pfand
- Buttons: "Verwerfen" (secondary) + "Speichern" (primary)
- Add row (+) and delete row (x) buttons

Use shadcn/ui Table, Input, Select, Button, Badge.

- [ ] **Step 2: Implement save handler**

On "Speichern":
1. Map AnalysisResult to NewReceipt struct
2. Look up or create store by name
3. Call `createReceipt()` via Tauri command
4. Navigate to `/receipts`

- [ ] **Step 3: Implement discard handler**

On "Verwerfen": Reset state, navigate back to DropZone.

- [ ] **Step 4: Verify full scan workflow end-to-end**

```bash
npm run tauri dev
```

Expected: Import → Progress → Correction → Save → Appears in receipt list.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement CorrectionTable with inline editing / KorrrekturTabelle mit Inline-Bearbeitung implementiert"
```

---

## Chunk 7: Frontend — Receipts & Settings

### Task 17: Implement ReceiptList + ReceiptDetail

**Files:**
- Create: `src/components/receipts/ReceiptList.tsx`, `src/components/receipts/ReceiptDetail.tsx`

- [ ] **Step 1: Create ReceiptList.tsx**

- Table with columns: Datum, Markt, Gesamtbetrag, Anzahl Artikel
- Filter bar: Store dropdown, date range picker, amount range
- Search input (searches item names)
- Click row → navigate to `/receipts/:id`
- Delete button per row (with confirmation dialog)
- Empty state: "Noch keine Kassenzettel. Scanne deinen ersten Bon!"

Use shadcn/ui Table, Input, Select, Dialog, Button.

- [ ] **Step 2: Create ReceiptDetail.tsx**

- Header: Store, Date, Payment method
- Items table (read-only): Artikel, Menge, Einzelpreis, Gesamtpreis, Kategorie
- Original image (if available, clickable for full-size)
- Summary: Zwischensumme, Rabatte, Pfand, Gesamtbetrag
- Back button, Delete button

- [ ] **Step 3: Verify list + detail rendering**

```bash
npm run tauri dev
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: implement receipt list + detail views / Kassenzettel-Liste + Detailansicht implementiert"
```

---

### Task 18: Implement SettingsPage

**Files:**
- Create: `src/components/settings/SettingsPage.tsx`

- [ ] **Step 1: Create SettingsPage.tsx with 4 tabs**

Use shadcn/ui Tabs.

**Tab "Allgemein":**
- Theme selector: System / Dark / Light (radio group or select)
- Categories list with add/edit/delete

**Tab "KI-Modell":**
- Current model status (loaded / missing)
- GPU-Layers setting (Auto / number input)
- Download model button (if missing) with progress bar
- "Modell manuell wählen" button → file dialog for .gguf

**Tab "Märkte":**
- List of known stores with edit/delete
- Add new store input + button
- Aldi variants toggle (Getrennt / Zusammengefasst)

**Tab "Daten":**
- Images setting: Behalten / Löschen / Fragen (radio)
- Storage info: path to ./data/, used disk space
- Backup button → creates .zip of ./data/
- Restore button → file dialog for .zip

- [ ] **Step 2: Wire up all settings to Zustand store + Tauri commands**

- [ ] **Step 3: Verify all tabs work**

```bash
npm run tauri dev
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: implement settings page with all tabs / Einstellungsseite mit allen Tabs implementiert"
```

---

### Task 19: Implement Onboarding / Model Download Dialog

**Files:**
- Create: `src/components/onboarding/ModelDownload.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create ModelDownload.tsx**

Full-screen dialog shown on first start when model is missing:
- Explanation text: "Das KI-Modell wird für die Erkennung benötigt (~2,1 GB)"
- Two buttons: "Automatisch herunterladen" / "Manuell auswählen"
- Progress bar for download (listens to `model-download-progress` event)
- Download speed + ETA display
- Cancel button during download

- [ ] **Step 2: Add first-start check to App.tsx**

On mount: call `checkModelExists()`. If false, show ModelDownload overlay.

- [ ] **Step 3: Verify onboarding flow**

```bash
npm run tauri dev
```

Expected: On first start without model, dialog appears. After download/select, app becomes usable.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: implement model download onboarding dialog / Modell-Download Onboarding-Dialog implementiert"
```

---

## Chunk 8: Integration, Export & Polish

### Task 20: Implement CSV export

**Files:**
- Create: `src-tauri/src/commands/export.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create commands/export.rs**

Implement `export_receipts_csv(path: String, filter: Option<ReceiptFilter>) -> Result<()>`:
- Query all receipts + items matching filter
- Write CSV with headers: Datum, Markt, Artikel, Menge, Einzelpreis, Gesamtpreis, Kategorie, Rabatt, Pfand
- German number format (comma as decimal separator)

- [ ] **Step 2: Add export button to ReceiptList**

"Als CSV exportieren" button → Tauri save dialog → calls export command.

- [ ] **Step 3: Test export**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: implement CSV export for receipts / CSV-Export für Kassenzettel implementiert"
```

---

### Task 21: Add app icons + logos

**Files:**
- Create: `src-tauri/icons/` (generated from SVG)
- Copy: SVG logos to `public/`

- [ ] **Step 1: Convert SVG logos to PNG icons**

Use the dark logo SVG to generate Tauri icons (32x32, 128x128, 256x256, icon.ico).

- [ ] **Step 2: Copy both SVG logos to public/**

```bash
cp "infos/dunkel logo.svg" public/logo-dark.svg
cp "infos/hell logo.svg" public/logo-light.svg
```

- [ ] **Step 3: Update Sidebar to use theme-aware logo**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add app icons + theme-aware logos / App-Icons + Theme-bewusste Logos hinzugefügt"
```

---

### Task 22: Error handling + edge cases

**Files:**
- Modify: Multiple frontend components

- [ ] **Step 1: Add error boundaries**

Wrap main content in React error boundary with fallback UI.

- [ ] **Step 2: Add empty states**

- ReceiptList: "Noch keine Kassenzettel" with scan link
- DropZone: Disabled state when sidecar not ready

- [ ] **Step 3: Add loading states**

- Skeleton loaders for ReceiptList
- Spinner for analysis
- Disabled buttons during operations

- [ ] **Step 4: Handle scanner errors**

- Scanner not available → button disabled with tooltip
- Scan cancelled → silent return
- Invalid image → toast notification

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add error handling, empty states, loading states / Fehlerbehandlung, Leerzustände, Ladezustände hinzugefügt"
```

---

### Task 23: Final integration test + build

- [ ] **Step 1: Full workflow test**

```bash
npm run tauri dev
```

Test manually:
1. App starts, onboarding shows if no model
2. Sidebar navigation works
3. Theme switching works (System/Dark/Light)
4. Import image via file dialog → analysis runs → correction table shows
5. Edit items, save → appears in receipt list
6. Receipt detail shows all data + image
7. Settings: all tabs functional
8. CSV export works

- [ ] **Step 2: Build portable exe**

```bash
npm run tauri build
```

Expected: `.exe` in `src-tauri/target/release/bundle/nsis/`

- [ ] **Step 3: Test portable build**

Copy built exe + data/ folder to USB stick, run from there. Verify all data stays in ./data/.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete MVP — Kassenzettel Scanner v1.0 / MVP fertiggestellt — Kassenzettel Scanner v1.0"
```
