// Settings commands — key/value store for app configuration
// Einstellungen-Befehle — Schluessel/Wert-Speicher fuer App-Konfiguration

use tauri::State;

use crate::db::Database;

/// Get a single setting by key.
/// Eine einzelne Einstellung anhand des Schluessels abrufen.
#[tauri::command]
pub fn get_setting(key: String, db: State<'_, Database>) -> Result<Option<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    let result = stmt
        .query_row([&key], |row| row.get::<_, String>(0))
        .optional()
        .map_err(|e| e.to_string())?;
    Ok(result)
}

/// Set a setting (insert or update).
/// Eine Einstellung setzen (einfuegen oder aktualisieren).
#[tauri::command]
pub fn set_setting(key: String, value: String, db: State<'_, Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get all settings as key-value pairs.
/// Alle Einstellungen als Schluessel-Wert-Paare abrufen.
#[tauri::command]
pub fn get_all_settings(db: State<'_, Database>) -> Result<Vec<(String, String)>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings ORDER BY key")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

// We need this import for .optional()
use rusqlite::OptionalExtension;

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: create in-memory DB and wrap in tauri::State-compatible way.
    /// Hilfsfunktion: In-Memory-DB erstellen.
    fn test_db() -> Database {
        Database::new_in_memory().expect("Failed to create in-memory database")
    }

    #[test]
    fn test_get_setting_not_found() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT value FROM settings WHERE key = ?1")
            .unwrap();
        let result: Option<String> = stmt
            .query_row(["nonexistent"], |row| row.get(0))
            .optional()
            .unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_set_and_get_setting() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        // Set a value / Wert setzen
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params!["theme", "dark"],
        )
        .unwrap();

        // Get it back / Wert zuruecklesen
        let mut stmt = conn
            .prepare("SELECT value FROM settings WHERE key = ?1")
            .unwrap();
        let result: Option<String> = stmt
            .query_row(["theme"], |row| row.get(0))
            .optional()
            .unwrap();
        assert_eq!(result, Some("dark".to_string()));

        // Update it / Wert aktualisieren
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params!["theme", "light"],
        )
        .unwrap();

        let result: Option<String> = stmt
            .query_row(["theme"], |row| row.get(0))
            .optional()
            .unwrap();
        assert_eq!(result, Some("light".to_string()));
    }

    #[test]
    fn test_get_all_settings() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params!["alpha", "1"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params!["beta", "2"],
        )
        .unwrap();

        let mut stmt = conn
            .prepare("SELECT key, value FROM settings ORDER BY key")
            .unwrap();
        let rows: Vec<(String, String)> = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .unwrap()
            .map(|r| r.unwrap())
            .collect();

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0], ("alpha".to_string(), "1".to_string()));
        assert_eq!(rows[1], ("beta".to_string(), "2".to_string()));
    }
}
