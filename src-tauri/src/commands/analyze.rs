// AI receipt analysis command
// KI-Kassenzettel-Analyse Befehl

use base64::Engine;
use futures_util::StreamExt;
use image::imageops::FilterType;
use image::GenericImageView;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::db::Database;

const OCR_PROMPT: &str = r#"Du analysierst einen deutschen Kassenzettel.
Extrahiere alle Informationen und antworte NUR mit einem validen JSON-Objekt. Keine Erklärungen, kein Markdown.

Regeln:
- Preise immer als Dezimalzahl (1.19, nicht "1,19")
- Datum im Format YYYY-MM-DD
- Menge als Zahl (2, nicht "2x")
- Rabatte und Pfand separat ausweisen
- Kategorie aus: Obst/Gemüse, Milchprodukte, Fleisch/Wurst, Backwaren, Getränke, Tiefkühl, Drogerie, Sonstiges
- confidence: 1.0 wenn sicher, 0.5 wenn unsicher, 0.0 wenn geraten
- Artikelnummer (EAN, PZN oder interne Nummer) wenn vorhanden extrahieren, sonst null

Schema: { "markt": "...", "datum": "YYYY-MM-DD", "uhrzeit": "HH:MM", "artikel": [{"name": "...", "artikelnummer": "06197481", "menge": 1, "einzelpreis": 0.00, "gesamtpreis": 0.00, "rabatt": 0.00, "pfand": 0.00, "kategorie": "...", "confidence": 1.0}], "gesamtbetrag": 0.00, "rabatte_gesamt": 0.00, "pfand_gesamt": 0.00, "zahlungsart": "..." }"#;

/// Result of AI receipt analysis / Ergebnis der KI-Kassenzettel-Analyse
#[derive(Serialize, Deserialize, Clone)]
pub struct AnalysisResult {
    pub markt: Option<String>,
    pub datum: Option<String>,
    pub uhrzeit: Option<String>,
    pub artikel: Vec<AnalyzedItem>,
    pub gesamtbetrag: Option<f64>,
    pub rabatte_gesamt: Option<f64>,
    pub pfand_gesamt: Option<f64>,
    pub zahlungsart: Option<String>,
    pub raw_text: String,
    pub image_path: Option<String>,
}

/// Single analyzed receipt item / Einzelner analysierter Kassenzettel-Artikel
#[derive(Serialize, Deserialize, Clone)]
pub struct AnalyzedItem {
    pub name: String,
    #[serde(default)]
    pub artikelnummer: Option<String>,
    pub menge: f64,
    pub einzelpreis: f64,
    pub gesamtpreis: f64,
    pub rabatt: f64,
    pub pfand: f64,
    pub kategorie: Option<String>,
    pub confidence: f64,
}

/// SSE delta structure from llama-server / SSE-Delta-Struktur vom llama-server
#[derive(Deserialize)]
struct SseDelta {
    choices: Vec<SseChoice>,
}

#[derive(Deserialize)]
struct SseChoice {
    delta: SseDeltaContent,
}

#[derive(Deserialize)]
struct SseDeltaContent {
    content: Option<String>,
}

/// Get app directory (portable USB deployment)
/// App-Verzeichnis ermitteln (portable USB-Installation)
fn get_app_dir() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| {
        format!("Failed to get exe path / Exe-Pfad konnte nicht ermittelt werden: {}", e)
    })?;
    let dir = exe.parent().ok_or_else(|| {
        "Failed to get exe dir / Exe-Verzeichnis konnte nicht ermittelt werden".to_string()
    })?;
    Ok(dir.to_path_buf())
}

/// Ensure images directory exists / Sicherstellen dass Bilderverzeichnis existiert
fn ensure_images_dir() -> Result<PathBuf, String> {
    let images_dir = get_app_dir()?.join("data").join("images");
    std::fs::create_dir_all(&images_dir).map_err(|e| {
        format!(
            "Failed to create images dir / Bilderverzeichnis konnte nicht erstellt werden: {}",
            e
        )
    })?;
    Ok(images_dir)
}

/// Resize image maintaining aspect ratio / Bild skalieren mit Seitenverhältnis
fn resize_image(img: &image::DynamicImage, max_size: u32) -> image::DynamicImage {
    let (w, h) = img.dimensions();
    if w <= max_size && h <= max_size {
        return img.clone();
    }
    let ratio = max_size as f64 / w.max(h) as f64;
    let new_w = (w as f64 * ratio) as u32;
    let new_h = (h as f64 * ratio) as u32;
    img.resize(new_w, new_h, FilterType::Lanczos3)
}

/// Encode image as Base64 JPEG / Bild als Base64-JPEG kodieren
fn encode_jpeg_base64(img: &image::DynamicImage, quality: u8) -> Result<String, String> {
    let mut buf = Cursor::new(Vec::new());
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, quality);
    img.write_with_encoder(encoder).map_err(|e| {
        format!(
            "Failed to encode JPEG / JPEG-Kodierung fehlgeschlagen: {}",
            e
        )
    })?;
    Ok(base64::engine::general_purpose::STANDARD.encode(buf.into_inner()))
}

/// Analyze a receipt image using local AI / Kassenzettel-Bild mit lokaler KI analysieren
#[tauri::command]
pub async fn analyze_receipt(
    app: AppHandle,
    image_path: String,
    db: State<'_, Database>,
) -> Result<AnalysisResult, String> {
    // 1. Load image / Bild laden
    // Try guessing format from content if extension fails (e.g. HEIC not supported)
    let img = image::open(&image_path)
        .or_else(|_| {
            // Fallback: read bytes and try to decode without relying on extension
            let bytes = std::fs::read(&image_path).map_err(|e| image::ImageError::IoError(e))?;
            image::load_from_memory(&bytes)
        })
        .map_err(|e| {
            format!(
                "Failed to load image / Bild konnte nicht geladen werden: {}",
                e
            )
        })?;

    // 2. Create analysis copy: resize, grayscale, enhance contrast
    // Analysekopie erstellen: skalieren, Graustufen, Kontrast verbessern
    let analysis_img = resize_image(&img, 1024);
    let analysis_img = analysis_img.grayscale();
    let analysis_img =
        image::DynamicImage::ImageLuma8(image::imageops::contrast(&analysis_img.to_luma8(), 20.0));

    // 3. Encode as Base64 JPEG / Als Base64-JPEG kodieren
    let base64_img = encode_jpeg_base64(&analysis_img, 85)?;

    // 4. Check keep_images setting and save archive copy if needed
    // keep_images-Einstellung pruefen und Archivkopie speichern falls noetig
    let mut saved_image_path: Option<String> = None;
    let keep_setting = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT value FROM settings WHERE key = ?1")
            .map_err(|e| e.to_string())?;
        use rusqlite::OptionalExtension;
        stmt.query_row(["keep_images"], |row| row.get::<_, String>(0))
            .optional()
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| "ask".to_string())
    };

    if keep_setting == "keep" || keep_setting == "ask" {
        let images_dir = ensure_images_dir()?;
        let archive_img = resize_image(&img, 1920);
        let file_name = format!("{}.jpg", Uuid::new_v4());
        let file_path = images_dir.join(&file_name);

        let mut file = std::fs::File::create(&file_path).map_err(|e| {
            format!(
                "Failed to create archive image / Archivbild konnte nicht erstellt werden: {}",
                e
            )
        })?;
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut file, 80);
        archive_img.write_with_encoder(encoder).map_err(|e| {
            format!(
                "Failed to save archive image / Archivbild konnte nicht gespeichert werden: {}",
                e
            )
        })?;

        saved_image_path = Some(file_path.to_string_lossy().to_string());
    }

    // 5. POST to llama-server / POST an llama-server senden
    let client = reqwest::Client::new();
    let request_body = serde_json::json!({
        "model": "qwen2.5-vl",
        "stream": true,
        "temperature": 0.1,
        "max_tokens": 2048,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": format!("data:image/jpeg;base64,{}", base64_img)
                        }
                    },
                    {
                        "type": "text",
                        "text": OCR_PROMPT
                    }
                ]
            }
        ]
    });

    let response = client
        .post("http://127.0.0.1:8190/v1/chat/completions")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to llama-server / Verbindung zum llama-server fehlgeschlagen: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "llama-server error ({}): {} / llama-server Fehler ({}): {}",
            status, body, status, body
        ));
    }

    // 6. Read SSE stream and emit token events
    // SSE-Stream lesen und Token-Events senden
    let mut full_text = String::new();
    let mut stream = response.bytes_stream();

    let mut buffer = String::new();
    // Flag to break outer loop when [DONE] is received
    // Flag um aeussere Schleife zu beenden wenn [DONE] empfangen wird
    let mut done = false;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error / Stream-Fehler: {}", e))?;
        let chunk_str = String::from_utf8_lossy(&chunk);
        buffer.push_str(&chunk_str);

        // Process complete SSE lines / Vollstaendige SSE-Zeilen verarbeiten
        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim().to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            if line == "data: [DONE]" {
                done = true;
                break;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if let Ok(delta) = serde_json::from_str::<SseDelta>(data) {
                    for choice in &delta.choices {
                        if let Some(content) = &choice.delta.content {
                            full_text.push_str(content);
                            let _ = app.emit("analysis-token", content.clone());
                        }
                    }
                }
            }
        }

        // Exit outer loop when stream is done / Aeussere Schleife beenden wenn Stream fertig
        if done {
            break;
        }
    }

    // 7. Emit completion event / Abschlussevent senden
    let _ = app.emit("analysis-complete", &full_text);

    // 8. Parse final JSON into AnalysisResult
    // Finales JSON in AnalysisResult parsen
    let result = parse_analysis_result(&full_text, saved_image_path.clone());

    // 9. Return result / Ergebnis zurueckgeben
    Ok(result)
}

/// Parse the AI response text into AnalysisResult
/// KI-Antworttext in AnalysisResult parsen
fn parse_analysis_result(text: &str, image_path: Option<String>) -> AnalysisResult {
    // Try to extract JSON from the text (may be wrapped in markdown code blocks)
    // JSON aus dem Text extrahieren (kann in Markdown-Codeblocks eingebettet sein)
    let json_str = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
        AnalysisResult {
            markt: parsed
                .get("markt")
                .and_then(|v| v.as_str())
                .map(String::from),
            datum: parsed
                .get("datum")
                .and_then(|v| v.as_str())
                .map(String::from),
            uhrzeit: parsed
                .get("uhrzeit")
                .and_then(|v| v.as_str())
                .map(String::from),
            artikel: parsed
                .get("artikel")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|item| {
                            Some(AnalyzedItem {
                                name: item.get("name")?.as_str()?.to_string(),
                                artikelnummer: item
                                    .get("artikelnummer")
                                    .and_then(|v| v.as_str())
                                    .map(String::from),
                                menge: item.get("menge").and_then(|v| v.as_f64()).unwrap_or(1.0),
                                einzelpreis: item
                                    .get("einzelpreis")
                                    .and_then(|v| v.as_f64())
                                    .unwrap_or(0.0),
                                gesamtpreis: item
                                    .get("gesamtpreis")
                                    .and_then(|v| v.as_f64())
                                    .unwrap_or(0.0),
                                rabatt: item.get("rabatt").and_then(|v| v.as_f64()).unwrap_or(0.0),
                                pfand: item.get("pfand").and_then(|v| v.as_f64()).unwrap_or(0.0),
                                kategorie: item
                                    .get("kategorie")
                                    .and_then(|v| v.as_str())
                                    .map(String::from),
                                confidence: item
                                    .get("confidence")
                                    .and_then(|v| v.as_f64())
                                    .unwrap_or(0.5),
                            })
                        })
                        .collect()
                })
                .unwrap_or_default(),
            gesamtbetrag: parsed.get("gesamtbetrag").and_then(|v| v.as_f64()),
            rabatte_gesamt: parsed.get("rabatte_gesamt").and_then(|v| v.as_f64()),
            pfand_gesamt: parsed.get("pfand_gesamt").and_then(|v| v.as_f64()),
            zahlungsart: parsed
                .get("zahlungsart")
                .and_then(|v| v.as_str())
                .map(String::from),
            raw_text: text.to_string(),
            image_path,
        }
    } else {
        // Return raw text if JSON parsing fails
        // Rohtext zurueckgeben wenn JSON-Parsing fehlschlaegt
        AnalysisResult {
            markt: None,
            datum: None,
            uhrzeit: None,
            artikel: Vec::new(),
            gesamtbetrag: None,
            rabatte_gesamt: None,
            pfand_gesamt: None,
            zahlungsart: None,
            raw_text: text.to_string(),
            image_path,
        }
    }
}
