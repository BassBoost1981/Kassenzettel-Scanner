// Category commands — CRUD for receipt categories
// Kategorie-Befehle — CRUD fuer Kassenzettel-Kategorien

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::Database;

/// A receipt category.
/// Eine Kassenzettel-Kategorie.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

fn normalize_category_name(name: &str) -> String {
    name.trim().to_string()
}

fn get_all_categories(conn: &Connection) -> Result<Vec<Category>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT id, name, created_at FROM categories ORDER BY name")?;
    let rows = stmt.query_map([], |row| {
        Ok(Category {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
        })
    })?;

    let mut categories = Vec::new();
    for row in rows {
        categories.push(row?);
    }
    Ok(categories)
}

fn create_category_record(conn: &Connection, name: &str) -> Result<Category, String> {
    let normalized_name = normalize_category_name(name);
    if normalized_name.is_empty() {
        return Err("Category name must not be empty / Kategoriename darf nicht leer sein".into());
    }

    let existing = conn
        .query_row(
            "SELECT id, name, created_at FROM categories WHERE lower(name) = lower(?1)",
            [&normalized_name],
            |row| {
                Ok(Category {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(category) = existing {
        return Err(format!(
            "Category '{}' already exists / Kategorie '{}' existiert bereits",
            category.name, category.name
        ));
    }

    conn.execute(
        "INSERT INTO categories (name) VALUES (?1)",
        [&normalized_name],
    )
    .map_err(|e| e.to_string())?;

    let category_id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, name, created_at FROM categories WHERE id = ?1",
        [category_id],
        |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

fn delete_category_record(conn: &Connection, id: i64) -> Result<(), String> {
    let usage_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM receipt_items WHERE category_id = ?1",
            [id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if usage_count > 0 {
        return Err(format!(
            "Category is still used by {} receipt items / Kategorie wird noch von {} Artikeln verwendet",
            usage_count, usage_count
        ));
    }

    let affected = conn
        .execute("DELETE FROM categories WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err(format!(
            "Category with id {} not found / Kategorie mit id {} nicht gefunden",
            id, id
        ));
    }

    Ok(())
}

/// Get all categories.
/// Alle Kategorien abrufen.
#[tauri::command]
pub fn get_categories(db: State<'_, Database>) -> Result<Vec<Category>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_all_categories(&conn).map_err(|e| e.to_string())
}

/// Create a category and return it.
/// Eine Kategorie erstellen und zurueckgeben.
#[tauri::command]
pub fn create_category(name: String, db: State<'_, Database>) -> Result<Category, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    create_category_record(&conn, &name)
}

/// Delete an unused category by id.
/// Eine unbenutzte Kategorie anhand der ID loeschen.
#[tauri::command]
pub fn delete_category(id: i64, db: State<'_, Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    delete_category_record(&conn, id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Database {
        Database::new_in_memory().expect("Failed to create in-memory database")
    }

    #[test]
    fn test_create_category_record() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        let created = create_category_record(&conn, "Haustier").unwrap();
        assert_eq!(created.name, "Haustier");

        let categories = get_all_categories(&conn).unwrap();
        assert!(categories
            .iter()
            .any(|category| category.name == "Haustier"));
    }

    #[test]
    fn test_duplicate_category_is_rejected_case_insensitive() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        let result = create_category_record(&conn, "obst/gemüse");
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_category_record_rejects_used_categories() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        let category_id: i64 = conn
            .query_row(
                "SELECT id FROM categories WHERE name = 'Sonstiges'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        conn.execute(
            "INSERT INTO receipts (store_id, date, total_amount) VALUES (1, '2026-03-14', 10.0)",
            [],
        )
        .unwrap();
        let receipt_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO receipt_items (receipt_id, raw_name, quantity, unit_price, total_price, category_id)
             VALUES (?1, 'Test', 1, 1.0, 1.0, ?2)",
            rusqlite::params![receipt_id, category_id],
        )
        .unwrap();

        let result = delete_category_record(&conn, category_id);
        assert!(result.is_err());
    }
}
