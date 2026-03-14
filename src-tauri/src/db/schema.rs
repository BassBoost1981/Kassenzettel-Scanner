// Database schema — CREATE TABLE statements and indexes
// Datenbank-Schema — CREATE TABLE Anweisungen und Indizes

use rusqlite::Connection;

/// Create all tables and indexes (idempotent via IF NOT EXISTS).
/// Erstellt alle Tabellen und Indizes (idempotent via IF NOT EXISTS).
pub fn create_tables(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS stores (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL UNIQUE,
            merge_variants  BOOLEAN NOT NULL DEFAULT 0,
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS receipts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id        INTEGER REFERENCES stores(id),
            date            DATE NOT NULL,
            time            TEXT,
            total_amount    REAL NOT NULL,
            discount_total  REAL NOT NULL DEFAULT 0,
            deposit_total   REAL NOT NULL DEFAULT 0,
            payment_method  TEXT,
            image_path      TEXT,
            raw_json        TEXT,
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS products (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            category_id INTEGER REFERENCES categories(id),
            unit        TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS product_aliases (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL REFERENCES products(id),
            alias      TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS receipt_items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_id  INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
            product_id  INTEGER REFERENCES products(id),
            raw_name    TEXT NOT NULL,
            quantity    REAL NOT NULL DEFAULT 1,
            unit_price  REAL NOT NULL,
            total_price REAL NOT NULL,
            discount    REAL NOT NULL DEFAULT 0,
            deposit     REAL NOT NULL DEFAULT 0,
            category_id INTEGER REFERENCES categories(id)
        );

        -- Indexes for common queries
        -- Indizes fuer haeufige Abfragen
        CREATE INDEX IF NOT EXISTS idx_receipts_date
            ON receipts(date);
        CREATE INDEX IF NOT EXISTS idx_receipts_store_id
            ON receipts(store_id);
        CREATE INDEX IF NOT EXISTS idx_receipt_items_product_id
            ON receipt_items(product_id);
        CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id
            ON receipt_items(receipt_id);
        CREATE INDEX IF NOT EXISTS idx_products_category_id
            ON products(category_id);
        ",
    )?;
    Ok(())
}
