// Store commands — CRUD for grocery stores
// Markt-Befehle — CRUD fuer Einkaufsmaerkte

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::Database;

/// A grocery store.
/// Ein Einkaufsmarkt.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Store {
    pub id: i64,
    pub name: String,
    pub merge_variants: bool,
    pub created_at: String,
}

/// Get all stores.
/// Alle Maerkte abrufen.
#[tauri::command]
pub fn get_stores(db: State<'_, Database>) -> Result<Vec<Store>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, merge_variants, created_at FROM stores ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Store {
                id: row.get(0)?,
                name: row.get(1)?,
                merge_variants: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut stores = Vec::new();
    for row in rows {
        stores.push(row.map_err(|e| e.to_string())?);
    }
    Ok(stores)
}

/// Create a new store and return it.
/// Einen neuen Markt erstellen und zurueckgeben.
#[tauri::command]
pub fn create_store(name: String, db: State<'_, Database>) -> Result<Store, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO stores (name) VALUES (?1)",
        rusqlite::params![name],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let store = conn
        .query_row(
            "SELECT id, name, merge_variants, created_at FROM stores WHERE id = ?1",
            [id],
            |row| {
                Ok(Store {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    merge_variants: row.get(2)?,
                    created_at: row.get(3)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;
    Ok(store)
}

/// Update a store's name and merge_variants flag.
/// Name und merge_variants-Flag eines Marktes aktualisieren.
#[tauri::command]
pub fn update_store(
    id: i64,
    name: String,
    merge_variants: bool,
    db: State<'_, Database>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE stores SET name = ?1, merge_variants = ?2 WHERE id = ?3",
            rusqlite::params![name, merge_variants, id],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!("Store with id {} not found / Markt mit id {} nicht gefunden", id, id));
    }
    Ok(())
}

/// Delete a store by id.
/// Einen Markt anhand der ID loeschen.
#[tauri::command]
pub fn delete_store(id: i64, db: State<'_, Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute("DELETE FROM stores WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!("Store with id {} not found / Markt mit id {} nicht gefunden", id, id));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Database {
        Database::new_in_memory().expect("Failed to create in-memory database")
    }

    #[test]
    fn test_stores_crud_cycle() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        // Create / Erstellen
        conn.execute(
            "INSERT INTO stores (name) VALUES (?1)",
            rusqlite::params!["Testmarkt"],
        )
        .unwrap();
        let id = conn.last_insert_rowid();

        // Read / Lesen
        let store: Store = conn
            .query_row(
                "SELECT id, name, merge_variants, created_at FROM stores WHERE id = ?1",
                [id],
                |row| {
                    Ok(Store {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        merge_variants: row.get(2)?,
                        created_at: row.get(3)?,
                    })
                },
            )
            .unwrap();
        assert_eq!(store.name, "Testmarkt");
        assert!(!store.merge_variants);

        // Update / Aktualisieren
        conn.execute(
            "UPDATE stores SET name = ?1, merge_variants = ?2 WHERE id = ?3",
            rusqlite::params!["Testmarkt Neu", true, id],
        )
        .unwrap();
        let updated: Store = conn
            .query_row(
                "SELECT id, name, merge_variants, created_at FROM stores WHERE id = ?1",
                [id],
                |row| {
                    Ok(Store {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        merge_variants: row.get(2)?,
                        created_at: row.get(3)?,
                    })
                },
            )
            .unwrap();
        assert_eq!(updated.name, "Testmarkt Neu");
        assert!(updated.merge_variants);

        // Delete / Loeschen
        let affected = conn
            .execute("DELETE FROM stores WHERE id = ?1", rusqlite::params![id])
            .unwrap();
        assert_eq!(affected, 1);

        // Verify deleted / Pruefe Loeschung
        let count: i32 = conn
            .query_row(
                "SELECT count(*) FROM stores WHERE id = ?1",
                [id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_get_all_stores() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        // Should have 10 seeded stores / Sollte 10 voreingestellte Maerkte haben
        let mut stmt = conn
            .prepare("SELECT id, name, merge_variants, created_at FROM stores ORDER BY name")
            .unwrap();
        let stores: Vec<Store> = stmt
            .query_map([], |row| {
                Ok(Store {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    merge_variants: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(stores.len(), 10);
    }
}
