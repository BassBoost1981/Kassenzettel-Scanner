// Sidecar lifecycle management for llama-server
// Sidecar-Lebenszyklus-Verwaltung fuer llama-server

use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::ShellExt;

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
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percent: f64,
}

/// Managed Tauri state that holds sidecar status and child handle.
/// Verwalteter Tauri-Zustand mit Sidecar-Status und Kind-Prozess-Handle.
pub struct SidecarState {
    pub status: Mutex<SidecarStatus>,
    pub model_path: Mutex<Option<String>>,
    pub child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
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
fn get_app_dir() -> PathBuf {
    std::env::current_exe()
        .expect("Failed to get exe path / Exe-Pfad konnte nicht ermittelt werden")
        .parent()
        .expect("Failed to get exe dir / Exe-Verzeichnis konnte nicht ermittelt werden")
        .to_path_buf()
}

/// Get the model storage directory.
/// Gibt das Modell-Speicherverzeichnis zurueck.
fn get_model_dir() -> PathBuf {
    get_app_dir().join("data").join("models")
}

/// Default model filename.
/// Standard-Modelldateiname.
const MODEL_FILENAME: &str = "qwen2.5-vl-3b-instruct-q4_k_m.gguf";

/// Placeholder download URL for the model.
/// Platzhalter-Download-URL fuer das Modell.
const MODEL_DOWNLOAD_URL: &str = "https://huggingface.co/Qwen/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/qwen2.5-vl-3b-instruct-q4_k_m.gguf";

// ---------------------------------------------------------------------------
// Tauri commands / Tauri-Befehle
// ---------------------------------------------------------------------------

/// Return the current sidecar status.
/// Gibt den aktuellen Sidecar-Status zurueck.
#[tauri::command]
pub fn get_sidecar_status(state: State<'_, SidecarState>) -> SidecarStatus {
    state.status.lock().unwrap().clone()
}

/// Check whether the default model file exists on disk.
/// Prueft, ob die Standard-Modelldatei auf der Festplatte existiert.
#[tauri::command]
pub fn check_model_exists() -> bool {
    get_model_dir().join(MODEL_FILENAME).exists()
}

/// Start the llama-server sidecar process.
/// Startet den llama-server Sidecar-Prozess.
#[tauri::command]
pub async fn start_llama_server(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> Result<(), String> {
    // Determine model path / Modellpfad ermitteln
    let model_path = {
        let mp = state.model_path.lock().map_err(|e| e.to_string())?;
        match mp.clone() {
            Some(p) => PathBuf::from(p),
            None => get_model_dir().join(MODEL_FILENAME),
        }
    };

    if !model_path.exists() {
        let mut s = state.status.lock().map_err(|e| e.to_string())?;
        *s = SidecarStatus::ModelMissing;
        return Err("Model file not found / Modelldatei nicht gefunden".into());
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

    // Spawn sidecar / Sidecar starten
    let sidecar_command = app
        .shell()
        .sidecar("llama-server")
        .map_err(|e| format!("Failed to create sidecar command / Sidecar-Befehl fehlgeschlagen: {e}"))?
        .args([
            "--model",
            &model_str,
            "--port",
            "8190",
            "--host",
            "127.0.0.1",
            "--n-gpu-layers",
            &gpu_layers,
        ]);

    let (mut rx, child) = sidecar_command
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar / Sidecar konnte nicht gestartet werden: {e}"))?;

    // Store child handle / Kind-Handle speichern
    {
        let mut c = state.child.lock().map_err(|e| e.to_string())?;
        *c = Some(child);
    }

    // Spawn background task to consume sidecar stdout/stderr
    // Hintergrund-Task zum Lesen von stdout/stderr starten
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    log::info!("[llama-server stdout] {}", text);
                }
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    log::warn!("[llama-server stderr] {}", text);
                }
                CommandEvent::Terminated(payload) => {
                    log::info!("[llama-server] terminated: {:?}", payload);
                    let ss = app_handle.state::<SidecarState>();
                    if let Ok(mut s) = ss.status.lock() {
                        *s = SidecarStatus::Stopped;
                    }
                    break;
                }
                CommandEvent::Error(err) => {
                    log::error!("[llama-server] error: {}", err);
                }
                _ => {}
            }
        }
    });

    // Poll health endpoint for up to 30 seconds
    // Health-Endpunkt bis zu 30 Sekunden lang abfragen
    let client = reqwest::Client::new();
    let health_url = "http://127.0.0.1:8190/health";
    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(30);

    loop {
        if start.elapsed() > timeout {
            let mut s = state.status.lock().map_err(|e| e.to_string())?;
            *s = SidecarStatus::Error(
                "Server did not become ready within 30s / Server wurde nicht innerhalb von 30s bereit"
                    .into(),
            );
            return Err(
                "Timeout waiting for llama-server / Zeitueberschreitung beim Warten auf llama-server"
                    .into(),
            );
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
    if let Some(child) = child_guard.take() {
        child
            .kill()
            .map_err(|e| format!("Failed to kill sidecar / Sidecar konnte nicht beendet werden: {e}"))?;
    }
    let mut s = state.status.lock().map_err(|e| e.to_string())?;
    *s = SidecarStatus::Stopped;
    Ok(())
}

/// Download the default model from Hugging Face with progress events.
/// Laedt das Standard-Modell von Hugging Face mit Fortschritts-Events herunter.
#[tauri::command]
pub async fn download_model(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> Result<(), String> {
    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    let model_dir = get_model_dir();
    std::fs::create_dir_all(&model_dir)
        .map_err(|e| format!("Failed to create model dir / Modellverzeichnis konnte nicht erstellt werden: {e}"))?;

    let file_path = model_dir.join(MODEL_FILENAME);

    // Check for existing partial download (resume support)
    // Pruefen auf bestehenden Teil-Download (Fortsetzung)
    let existing_len = if file_path.exists() {
        std::fs::metadata(&file_path)
            .map(|m| m.len())
            .unwrap_or(0)
    } else {
        0
    };

    let client = reqwest::Client::new();
    let mut request = client.get(MODEL_DOWNLOAD_URL);

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

    // Determine total size / Gesamtgroesse ermitteln
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

    // Open file for writing (append if resuming)
    // Datei zum Schreiben oeffnen (anhaengen bei Fortsetzung)
    let file = if response.status().as_u16() == 206 {
        tokio::fs::OpenOptions::new()
            .append(true)
            .open(&file_path)
            .await
            .map_err(|e| format!("Failed to open file for append / Datei konnte nicht zum Anhaengen geoeffnet werden: {e}"))?
    } else {
        tokio::fs::File::create(&file_path)
            .await
            .map_err(|e| format!("Failed to create file / Datei konnte nicht erstellt werden: {e}"))?
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
            },
        );
    }

    writer
        .flush()
        .await
        .map_err(|e| format!("Flush error / Flush-Fehler: {e}"))?;

    // Update model path in state / Modellpfad im State aktualisieren
    {
        let mut mp = state.model_path.lock().map_err(|e| e.to_string())?;
        *mp = Some(
            file_path
                .to_str()
                .unwrap_or_default()
                .to_string(),
        );
    }

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
    let source_path = source_pathbuf
        .to_str()
        .ok_or("Invalid file path encoding / Ungueltige Dateipfad-Kodierung")?
        .to_string();

    let model_dir = get_model_dir();
    std::fs::create_dir_all(&model_dir)
        .map_err(|e| format!("Failed to create model dir / Modellverzeichnis konnte nicht erstellt werden: {e}"))?;

    let file_name = std::path::Path::new(&source_path)
        .file_name()
        .ok_or("Invalid file name / Ungueltiger Dateiname")?
        .to_str()
        .ok_or("Invalid file name encoding / Ungueltige Dateinamen-Kodierung")?
        .to_string();

    let dest_path = model_dir.join(&file_name);

    // Copy file to model directory / Datei in Modellverzeichnis kopieren
    std::fs::copy(&source_path, &dest_path).map_err(|e| {
        format!("Failed to copy model file / Modelldatei konnte nicht kopiert werden: {e}")
    })?;

    let dest_str = dest_path
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
