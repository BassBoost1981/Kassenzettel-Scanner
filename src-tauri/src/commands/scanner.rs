// WIA Scanner dialog command (Windows)
// WIA-Scanner-Dialog Befehl (Windows)

// TODO: Implement full WIA scanner integration using Windows COM API
// TODO: Vollstaendige WIA-Scanner-Integration ueber Windows COM API implementieren
// This is a STUB for MVP — scanner functionality can be added later.
// Dies ist ein STUB fuer das MVP — Scanner-Funktionalitaet kann spaeter ergaenzt werden.

use tauri::AppHandle;

/// Check if a WIA scanner device is available
/// Pruefen ob ein WIA-Scanner-Geraet verfuegbar ist
#[tauri::command]
pub fn is_scanner_available() -> bool {
    // STUB: Always returns false until WIA integration is implemented
    // STUB: Gibt immer false zurueck bis WIA-Integration implementiert ist
    false
}

/// Open Windows scanner dialog and scan a document
/// Windows-Scanner-Dialog oeffnen und Dokument scannen
#[tauri::command]
pub fn scan_document(_app: AppHandle) -> Result<String, String> {
    // STUB: Returns error until WIA integration is implemented
    // STUB: Gibt Fehler zurueck bis WIA-Integration implementiert ist
    Err("Scanner nicht verfügbar — WIA-Integration noch nicht implementiert / Scanner not available — WIA integration not yet implemented".to_string())
}
