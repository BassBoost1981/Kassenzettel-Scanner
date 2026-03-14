// Database connection wrapper and initialization
// Datenbank-Verbindungs-Wrapper und Initialisierung

pub mod schema;
pub mod seed;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

/// Wrapper around a SQLite connection protected by a Mutex.
/// Wrapper um eine SQLite-Verbindung, geschuetzt durch einen Mutex.
pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    /// Open (or create) the SQLite database and run migrations + seeding.
    /// Oeffnet (oder erstellt) die SQLite-Datenbank und fuehrt Migrationen + Seeding aus.
    pub fn new(app_dir: PathBuf) -> Result<Self, rusqlite::Error> {
        let db_dir = app_dir.join("data").join("db");
        // Create DB directory if missing / DB-Verzeichnis erstellen falls nicht vorhanden
        std::fs::create_dir_all(&db_dir)
            .map_err(|e| rusqlite::Error::InvalidParameterName(
                format!("Failed to create db directory / DB-Verzeichnis konnte nicht erstellt werden: {}", e),
            ))?;
        let db_path = db_dir.join("kassenzettel.db");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        schema::create_tables(&conn)?;
        seed::insert_defaults(&conn)?;
        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    /// Create an in-memory database for testing.
    /// Erstellt eine In-Memory-Datenbank fuer Tests.
    #[cfg(test)]
    pub fn new_in_memory() -> Result<Self, rusqlite::Error> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;
        schema::create_tables(&conn)?;
        seed::insert_defaults(&conn)?;
        Ok(Database {
            conn: Mutex::new(conn),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_creation_in_memory() {
        let db = Database::new_in_memory().expect("Failed to create in-memory database");
        let conn = db.conn.lock().unwrap();

        // Verify all 7 tables exist
        // Pruefe ob alle 7 Tabellen existieren
        let tables = vec![
            "settings",
            "categories",
            "stores",
            "receipts",
            "products",
            "product_aliases",
            "receipt_items",
        ];

        for table in &tables {
            let count: i32 = conn
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
                    [table],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 1, "Table '{}' should exist", table);
        }
    }

    #[test]
    fn test_default_categories_seeded() {
        let db = Database::new_in_memory().expect("Failed to create in-memory database");
        let conn = db.conn.lock().unwrap();

        let count: i32 = conn
            .query_row("SELECT count(*) FROM categories", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 8, "Should have 8 default categories");
    }

    #[test]
    fn test_default_stores_seeded() {
        let db = Database::new_in_memory().expect("Failed to create in-memory database");
        let conn = db.conn.lock().unwrap();

        let count: i32 = conn
            .query_row("SELECT count(*) FROM stores", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 10, "Should have 10 default stores");
    }

    #[test]
    fn test_foreign_keys_enabled() {
        let db = Database::new_in_memory().expect("Failed to create in-memory database");
        let conn = db.conn.lock().unwrap();

        let fk: i32 = conn
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .unwrap();
        assert_eq!(fk, 1, "Foreign keys should be enabled");
    }

    #[test]
    fn test_idempotent_creation() {
        // Running create_tables and insert_defaults twice should not fail
        // Zweimaliges Ausfuehren von create_tables und insert_defaults sollte nicht fehlschlagen
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        schema::create_tables(&conn).unwrap();
        seed::insert_defaults(&conn).unwrap();
        schema::create_tables(&conn).unwrap();
        seed::insert_defaults(&conn).unwrap();

        let count: i32 = conn
            .query_row("SELECT count(*) FROM categories", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 8, "Idempotent seeding should keep 8 categories");
    }

    #[test]
    fn test_receipt_items_cascade_delete() {
        let db = Database::new_in_memory().expect("Failed to create in-memory database");
        let conn = db.conn.lock().unwrap();

        // Insert a receipt
        // Einen Kassenzettel einfuegen
        conn.execute(
            "INSERT INTO receipts (store_id, date, total_amount) VALUES (1, '2024-01-01', 10.0)",
            [],
        )
        .unwrap();

        // Insert a receipt item
        // Ein Kassenzettel-Element einfuegen
        conn.execute(
            "INSERT INTO receipt_items (receipt_id, raw_name, quantity, unit_price, total_price) VALUES (1, 'Milch', 1, 1.29, 1.29)",
            [],
        )
        .unwrap();

        // Delete the receipt — items should cascade
        // Kassenzettel loeschen — Elemente sollten kaskadiert werden
        conn.execute("DELETE FROM receipts WHERE id = 1", [])
            .unwrap();

        let count: i32 = conn
            .query_row(
                "SELECT count(*) FROM receipt_items WHERE receipt_id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "Receipt items should be cascade-deleted");
    }

    #[test]
    fn test_indexes_exist() {
        let db = Database::new_in_memory().expect("Failed to create in-memory database");
        let conn = db.conn.lock().unwrap();

        let indexes = vec![
            "idx_receipts_date",
            "idx_receipts_store_id",
            "idx_receipt_items_product_id",
            "idx_receipt_items_receipt_id",
            "idx_products_category_id",
        ];

        for idx in &indexes {
            let count: i32 = conn
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type='index' AND name=?1",
                    [idx],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 1, "Index '{}' should exist", idx);
        }
    }
}
