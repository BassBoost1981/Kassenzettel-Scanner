// Sidecar lifecycle management for llama-server
// Sidecar-Lebenszyklus-Verwaltung fuer llama-server

use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

// ---------------------------------------------------------------------------
// State & types / Zustand & Typen
// ---------------------------------------------------------------------------

/// Current status of the llama-server sidecar process.
/// Aktueller Status des llama-server Sidecar-Prozesses.
#[derive(Serialize, Clone, Debug)]
pub enum SidecarStatus {
    Stopped,
    Starting,
    Ready,
    Error(String),
    ModelMissing,
}

/// Progress information emitted during model download.
/// Fortschrittsinformation waehrend des Modell-Downloads.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percent: f64,
    pub file_name: String,
}

/// Managed Tauri state that holds sidecar status and child handle.
/// Verwalteter Tauri-Zustand mit Sidecar-Status und Kind-Prozess-Handle.
pub struct SidecarState {
    pub status: Mutex<SidecarStatus>,
    pub model_path: Mutex<Option<String>>,
    pub child: Mutex<Option<std::process::Child>>,
}

impl SidecarState {
    pub fn new() -> Self {
        Self {
            status: Mutex::new(SidecarStatus::Stopped),
            model_path: Mutex::new(None),
            child: Mutex::new(None),
        }
    }
}

// ---------------------------------------------------------------------------
// Helper functions / Hilfsfunktionen
// ---------------------------------------------------------------------------

/// Get the directory of the running executable (portable path).
/// Gibt das Verzeichnis der laufenden EXE zurueck (portabler Pfad).
fn get_app_dir() -> Result<PathBuf, String> {
    let exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path / Exe-Pfad konnte nicht ermittelt werden: {e}"))?;
    exe.parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "Failed to get exe dir / Exe-Verzeichnis konnte nicht ermittelt werden".to_string())
}

/// Get the model storage directory.
/// Gibt das Modell-Speicherverzeichnis zurueck.
fn get_model_dir() -> Result<PathBuf, String> {
    Ok(get_app_dir()?.join("data").join("models"))
}

/// Get the llama binary directory (contains llama-server.exe + DLLs).
/// Gibt das llama-Binary-Verzeichnis zurueck (enthält llama-server.exe + DLLs).
fn get_llama_dir() -> Result<PathBuf, String> {
    Ok(get_app_dir()?.join("llama"))
}

/// Default model filename / Standard-Modelldateiname
const MODEL_FILENAME: &str = "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf";
const MMPROJ_FILENAME: &str = "mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf";

/// Download URL for the model / Download-URL fuer das Modell
const MODEL_DOWNLOAD_URL: &str = "https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf";
const MMPROJ_DOWNLOAD_URL: &str = "https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf";

fn default_model_path() -> Result<PathBuf, String> {
    Ok(get_model_dir()?.join(MODEL_FILENAME))
}

fn default_mmproj_path() -> Result<PathBuf, String> {
    Ok(get_model_dir()?.join(MMPROJ_FILENAME))
}

fn model_files_exist(model_path: &PathBuf, mmproj_path: &PathBuf) -> bool {
    model_path.exists() && mmproj_path.exists()
}

// ---------------------------------------------------------------------------
// Tauri commands / Tauri-Befehle
// ---------------------------------------------------------------------------

/// Return the current sidecar status.
/// Gibt den aktuellen Sidecar-Status zurueck.
#[tauri::command]
pub fn get_sidecar_status(state: State<'_, SidecarState>) -> Result<SidecarStatus, String> {
    Ok(state.status.lock().map_err(|e| e.to_string())?.clone())
}

/// Check whether the model file exists on disk.
/// Prueft, ob die Modelldatei auf der Festplatte existiert.
#[tauri::command]
pub fn check_model_exists() -> Result<bool, String> {
    Ok(model_files_exist(&default_model_path()?, &default_mmproj_path()?))
}

/// Start the llama-server sidecar process.
/// Startet den llama-server Sidecar-Prozess.
#[tauri::command]
pub async fn start_llama_server(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> Result<(), String> {
    // Bug 1 fix: Stop any already running process before starting a new one
    // Bug 1 Fix: Bereits laufenden Prozess stoppen bevor ein neuer gestartet wird
    {
        let mut child_guard = state.child.lock().map_err(|e| e.to_string())?;
        if let Some(mut old_child) = child_guard.take() {
            let _ = old_child.kill();
            let _ = old_child.wait();
        }
    }

    // Determine model path / Modellpfad ermitteln
    let model_path = {
        let mp = state.model_path.lock().map_err(|e| e.to_string())?;
        match mp.clone() {
            Some(p) => PathBuf::from(p),
            None => default_model_path()?,
        }
    };
    let mmproj_path = default_mmproj_path()?;

    if !model_files_exist(&model_path, &mmproj_path) {
        let mut s = state.status.lock().map_err(|e| e.to_string())?;
        *s = SidecarStatus::ModelMissing;
        return Err("Model files not found / Modelldateien nicht gefunden".into());
    }

    // Read GPU layers from settings (default -1 = auto)
    // GPU-Layer aus Einstellungen lesen (Standard -1 = auto)
    let gpu_layers: String = {
        let db = app.state::<crate::db::Database>();
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT value FROM settings WHERE key = 'gpu_layers'")
            .map_err(|e| e.to_string())?;
        use rusqlite::OptionalExtension;
        stmt.query_row([], |row| row.get::<_, String>(0))
            .optional()
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| "-1".to_string())
    };

    // Update status to Starting / Status auf Starting setzen
    {
        let mut s = state.status.lock().map_err(|e| e.to_string())?;
        *s = SidecarStatus::Starting;
    }

    let model_str = model_path
        .to_str()
        .ok_or("Invalid model path / Ungueltiger Modellpfad")?
        .to_string();

    // Spawn llama-server as a regular process from the llama/ directory
    // llama-server als normalen Prozess aus dem llama/-Verzeichnis starten
    let llama_dir = get_llama_dir()?;
    let llama_exe = llama_dir.join("llama-server.exe");

    if !llama_exe.exists() {
        let mut s = state.status.lock().map_err(|e| e.to_string())?;
        *s = SidecarStatus::Error("llama-server.exe not found in llama/ folder / llama-server.exe nicht im llama/-Ordner gefunden".into());
        return Err(format!(
            "llama-server.exe not found at {} — copy all files from the llama.cpp Vulkan build into the llama/ folder next to the app",
            llama_exe.display()
        ));
    }

    let mut args = vec![
        "--model".to_string(),
        model_str.clone(),
        "--port".to_string(),
        "8190".to_string(),
        "--host".to_string(),
        "127.0.0.1".to_string(),
        "--n-gpu-layers".to_string(),
        gpu_layers.clone(),
    ];

    // Add mmproj if found / mmproj hinzufuegen falls vorhanden
    if mmproj_path.exists() {
        args.push("--mmproj".to_string());
        args.push(mmproj_path.to_str().unwrap_or_default().to_string());
    }

    #[cfg(windows)]
    use std::os::windows::process::CommandExt;

    let mut cmd = std::process::Command::new(&llama_exe);
    cmd.current_dir(&llama_dir) // DLLs are found via working directory
        .args(&args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());

    // Hide console window on Windows / Konsolenfenster auf Windows verstecken
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let child = cmd.spawn().map_err(|e| {
        format!("Failed to spawn llama-server / llama-server konnte nicht gestartet werden: {e}")
    })?;

    // Store child handle / Kind-Handle speichern
    {
        let mut c = state.child.lock().map_err(|e| e.to_string())?;
        *c = Some(child);
    }

    // Poll health endpoint for up to 30 seconds
    // Health-Endpunkt bis zu 30 Sekunden lang abfragen
    let client = reqwest::Client::new();
    let health_url = "http://127.0.0.1:8190/health";
    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(60);

    loop {
        if start.elapsed() > timeout {
            let mut s = state.status.lock().map_err(|e| e.to_string())?;
            *s = SidecarStatus::Error(
                "Server did not become ready within 60s / Server wurde nicht innerhalb von 60s bereit"
                    .into(),
            );
            return Err(
                "Timeout waiting for llama-server / Zeitueberschreitung beim Warten auf llama-server"
                    .into(),
            );
        }

        // Bug 5 fix: Check if child process crashed during health poll
        // Bug 5 Fix: Pruefen ob der Kind-Prozess waehrend der Health-Abfrage abgestuerzt ist
        {
            let mut child_guard = state.child.lock().map_err(|e| e.to_string())?;
            if let Some(ref mut child) = *child_guard {
                match child.try_wait() {
                    Ok(Some(exit_status)) => {
                        // Process exited prematurely / Prozess hat sich vorzeitig beendet
                        child_guard.take(); // Clean up handle / Handle aufraeumen
                        let mut s = state.status.lock().map_err(|e| e.to_string())?;
                        *s = SidecarStatus::Error(format!(
                            "llama-server exited with {exit_status} / llama-server beendet mit {exit_status}"
                        ));
                        return Err(format!(
                            "llama-server process exited prematurely with {exit_status} / llama-server Prozess vorzeitig beendet mit {exit_status}"
                        ));
                    }
                    Ok(None) => { /* Still running / Laeuft noch */ }
                    Err(e) => {
                        let mut s = state.status.lock().map_err(|e| e.to_string())?;
                        *s = SidecarStatus::Error(format!(
                            "Failed to check process status / Prozessstatus konnte nicht geprueft werden: {e}"
                        ));
                        return Err(format!("Failed to check child process status: {e}"));
                    }
                }
            }
        }

        match client.get(health_url).send().await {
            Ok(resp) if resp.status().is_success() => {
                let mut s = state.status.lock().map_err(|e| e.to_string())?;
                *s = SidecarStatus::Ready;
                return Ok(());
            }
            _ => {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
        }
    }
}

/// Stop the llama-server sidecar process.
/// Stoppt den llama-server Sidecar-Prozess.
#[tauri::command]
pub fn stop_llama_server(state: State<'_, SidecarState>) -> Result<(), String> {
    let mut child_guard = state.child.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    // Fallback: kill any remaining llama-server process by name
    // Fallback: verbliebene llama-server Prozesse per Name beenden
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "llama-server.exe"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
    }
    let mut s = state.status.lock().map_err(|e| e.to_string())?;
    *s = SidecarStatus::Stopped;
    Ok(())
}

/// Download the default model from Hugging Face with progress events.
/// Laedt das Standard-Modell von Hugging Face mit Fortschritts-Events herunter.
#[tauri::command]
pub async fn download_model(app: AppHandle, state: State<'_, SidecarState>) -> Result<(), String> {
    let model_dir = get_model_dir()?;
    std::fs::create_dir_all(&model_dir).map_err(|e| {
        format!("Failed to create model dir / Modellverzeichnis konnte nicht erstellt werden: {e}")
    })?;

    let client = reqwest::Client::new();
    download_model_file(
        &app,
        &client,
        MODEL_DOWNLOAD_URL,
        &default_model_path()?,
        "Basis-Modell",
    )
    .await?;
    download_model_file(
        &app,
        &client,
        MMPROJ_DOWNLOAD_URL,
        &default_mmproj_path()?,
        "Vision-Projektor",
    )
    .await?;

    // Update model path in state / Modellpfad im State aktualisieren
    {
        let mut mp = state.model_path.lock().map_err(|e| e.to_string())?;
        *mp = Some(
            default_model_path()?
                .to_str()
                .unwrap_or_default()
                .to_string(),
        );
    }

    Ok(())
}

async fn download_model_file(
    app: &AppHandle,
    client: &reqwest::Client,
    url: &str,
    file_path: &PathBuf,
    file_name: &str,
) -> Result<(), String> {
    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    let existing_len = if file_path.exists() {
        std::fs::metadata(file_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    let mut request = client.get(url);
    if existing_len > 0 {
        request = request.header("Range", format!("bytes={}-", existing_len));
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Download request failed / Download-Anfrage fehlgeschlagen: {e}"))?;

    if !response.status().is_success() && response.status().as_u16() != 206 {
        return Err(format!(
            "Download failed with status {} / Download fehlgeschlagen mit Status {}",
            response.status(),
            response.status()
        ));
    }

    let content_length = response.content_length().unwrap_or(0);
    let total = if response.status().as_u16() == 206 {
        existing_len + content_length
    } else {
        content_length
    };

    let mut downloaded = if response.status().as_u16() == 206 {
        existing_len
    } else {
        0
    };

    let file = if response.status().as_u16() == 206 {
        tokio::fs::OpenOptions::new()
            .append(true)
            .open(file_path)
            .await
            .map_err(|e| format!("Failed to open file for append / Datei konnte nicht zum Anhaengen geoeffnet werden: {e}"))?
    } else {
        tokio::fs::File::create(file_path).await.map_err(|e| {
            format!("Failed to create file / Datei konnte nicht erstellt werden: {e}")
        })?
    };

    let mut writer = tokio::io::BufWriter::new(file);
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk =
            chunk.map_err(|e| format!("Download stream error / Download-Stream-Fehler: {e}"))?;
        writer
            .write_all(&chunk)
            .await
            .map_err(|e| format!("Write error / Schreibfehler: {e}"))?;
        downloaded += chunk.len() as u64;

        let percent = if total > 0 {
            (downloaded as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        let _ = app.emit(
            "model-download-progress",
            DownloadProgress {
                downloaded,
                total,
                percent,
                file_name: file_name.to_string(),
            },
        );
    }

    writer
        .flush()
        .await
        .map_err(|e| format!("Flush error / Flush-Fehler: {e}"))?;

    Ok(())
}

/// Open a file dialog so the user can select a .gguf model file.
/// Oeffnet einen Dateidialog, damit der Benutzer eine .gguf Modelldatei auswaehlen kann.
#[tauri::command]
pub async fn select_model_file(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let dialog = app.dialog();
    let file = dialog
        .file()
        .add_filter("GGUF Model / GGUF-Modell", &["gguf"])
        .blocking_pick_file();

    let selected = file.ok_or("No file selected / Keine Datei ausgewaehlt")?;
    let source_pathbuf = selected
        .into_path()
        .map_err(|e| format!("Invalid file path / Ungueltiger Dateipfad: {e}"))?;

    let model_dir = get_model_dir()?;
    std::fs::create_dir_all(&model_dir).map_err(|e| {
        format!("Failed to create model dir / Modellverzeichnis konnte nicht erstellt werden: {e}")
    })?;

    let file_name = source_pathbuf
        .file_name()
        .ok_or("Invalid file name / Ungueltiger Dateiname")?
        .to_str()
        .ok_or("Invalid file name encoding / Ungueltige Dateinamen-Kodierung")?
        .to_string();

    let source_dir = source_pathbuf
        .parent()
        .ok_or("Invalid source directory / Ungueltiges Quellverzeichnis")?;

    let (selected_dest, sibling_source, sibling_dest) =
        if file_name.eq_ignore_ascii_case(MMPROJ_FILENAME) {
            (
                default_mmproj_path()?,
                source_dir.join(MODEL_FILENAME),
                default_model_path()?,
            )
        } else {
            (
                default_model_path()?,
                source_dir.join(MMPROJ_FILENAME),
                default_mmproj_path()?,
            )
        };

    // Copy file to model directory / Datei in Modellverzeichnis kopieren
    std::fs::copy(&source_pathbuf, &selected_dest).map_err(|e| {
        format!("Failed to copy model file / Modelldatei konnte nicht kopiert werden: {e}")
    })?;

    if sibling_source.exists() {
        std::fs::copy(&sibling_source, &sibling_dest).map_err(|e| {
            format!("Failed to copy mmproj file / mmproj-Datei konnte nicht kopiert werden: {e}")
        })?;
    }

    if !model_files_exist(&default_model_path()?, &default_mmproj_path()?) {
        return Err(
            "Both model files are required. Please choose a file from a folder that contains the base model and the matching mmproj file / Es werden beide Modelldateien benötigt. Bitte wähle eine Datei aus einem Ordner, der das Basismodell und die passende mmproj-Datei enthält."
                .into(),
        );
    }

    let dest_str = default_model_path()?
        .to_str()
        .ok_or("Invalid destination path / Ungueltiger Zielpfad")?
        .to_string();

    // Update state / State aktualisieren
    {
        let mut mp = state.model_path.lock().map_err(|e| e.to_string())?;
        *mp = Some(dest_str.clone());
    }

    Ok(dest_str)
}
