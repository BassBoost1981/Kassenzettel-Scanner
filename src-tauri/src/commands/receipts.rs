// Receipt commands — CRUD for receipts and receipt items
// Kassenzettel-Befehle — CRUD fuer Kassenzettel und Kassenzettel-Positionen

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::Database;

// ── Structs / Datenstrukturen ──

#[derive(Serialize, Deserialize, Debug)]
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

#[derive(Serialize, Deserialize, Debug)]
pub struct NewReceiptItem {
    pub raw_name: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub total_price: f64,
    pub discount: f64,
    pub deposit: f64,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReceiptSummary {
    pub id: i64,
    pub store_name: String,
    pub date: String,
    pub total_amount: f64,
    pub item_count: i64,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ReceiptDetail {
    pub id: i64,
    pub store_id: i64,
    pub store_name: String,
    pub date: String,
    pub time: Option<String>,
    pub total_amount: f64,
    pub discount_total: f64,
    pub deposit_total: f64,
    pub payment_method: Option<String>,
    pub image_path: Option<String>,
    pub raw_json: Option<String>,
    pub items: Vec<ReceiptItemDetail>,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ReceiptItemDetail {
    pub id: i64,
    pub raw_name: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub total_price: f64,
    pub discount: f64,
    pub deposit: f64,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub product_id: Option<i64>,
}

#[derive(Serialize, Deserialize, Default, Debug)]
pub struct ReceiptFilter {
    pub store_id: Option<i64>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub amount_min: Option<f64>,
    pub amount_max: Option<f64>,
}

// ── Commands / Befehle ──

fn resolve_category_id(
    conn: &Connection,
    category_id: Option<i64>,
    category_name: Option<&str>,
) -> Result<Option<i64>, String> {
    if let Some(category_id) = category_id {
        return Ok(Some(category_id));
    }

    let Some(category_name) = category_name.map(str::trim) else {
        return Ok(None);
    };

    if category_name.is_empty() {
        return Ok(None);
    }

    let existing_category_id = conn
        .query_row(
            "SELECT id FROM categories WHERE lower(name) = lower(?1)",
            [category_name],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(existing_category_id) = existing_category_id {
        return Ok(Some(existing_category_id));
    }

    conn.execute("INSERT INTO categories (name) VALUES (?1)", [category_name])
        .map_err(|e| e.to_string())?;

    Ok(Some(conn.last_insert_rowid()))
}

/// Create a receipt with all items in a single transaction.
/// Kassenzettel mit allen Positionen in einer Transaktion erstellen.
#[tauri::command]
pub fn create_receipt(
    receipt: NewReceipt,
    db: State<'_, Database>,
) -> Result<ReceiptSummary, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Begin transaction / Transaktion starten
    conn.execute("BEGIN", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<ReceiptSummary, String> {
        conn.execute(
            "INSERT INTO receipts (store_id, date, time, total_amount, discount_total, deposit_total, payment_method, image_path, raw_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                receipt.store_id,
                receipt.date,
                receipt.time,
                receipt.total_amount,
                receipt.discount_total,
                receipt.deposit_total,
                receipt.payment_method,
                receipt.image_path,
                receipt.raw_json,
            ],
        )
        .map_err(|e| e.to_string())?;

        let receipt_id = conn.last_insert_rowid();

        // Insert all items / Alle Positionen einfuegen
        for item in &receipt.items {
            let category_id =
                resolve_category_id(&conn, item.category_id, item.category_name.as_deref())?;

            conn.execute(
                "INSERT INTO receipt_items (receipt_id, raw_name, quantity, unit_price, total_price, discount, deposit, category_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    receipt_id,
                    item.raw_name,
                    item.quantity,
                    item.unit_price,
                    item.total_price,
                    item.discount,
                    item.deposit,
                    category_id,
                ],
            )
            .map_err(|e| e.to_string())?;
        }

        // Build summary / Zusammenfassung erstellen
        let summary = conn
            .query_row(
                "SELECT r.id, s.name, r.date, r.total_amount, r.created_at
                 FROM receipts r JOIN stores s ON r.store_id = s.id
                 WHERE r.id = ?1",
                [receipt_id],
                |row| {
                    Ok(ReceiptSummary {
                        id: row.get(0)?,
                        store_name: row.get(1)?,
                        date: row.get(2)?,
                        total_amount: row.get(3)?,
                        item_count: receipt.items.len() as i64,
                        created_at: row.get(4)?,
                    })
                },
            )
            .map_err(|e| e.to_string())?;

        Ok(summary)
    })();

    match result {
        Ok(summary) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(summary)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Get receipts with optional filters, sorted by date DESC.
/// Kassenzettel mit optionalen Filtern abrufen, sortiert nach Datum absteigend.
#[tauri::command]
pub fn get_receipts(
    filter: Option<ReceiptFilter>,
    db: State<'_, Database>,
) -> Result<Vec<ReceiptSummary>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let filter = filter.unwrap_or_default();

    let mut sql = String::from(
        "SELECT r.id, s.name, r.date, r.total_amount,
                (SELECT count(*) FROM receipt_items ri WHERE ri.receipt_id = r.id) as item_count,
                r.created_at
         FROM receipts r
         JOIN stores s ON r.store_id = s.id
         WHERE 1=1",
    );
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut param_idx = 1;

    if let Some(store_id) = filter.store_id {
        sql.push_str(&format!(" AND r.store_id = ?{}", param_idx));
        params.push(Box::new(store_id));
        param_idx += 1;
    }
    if let Some(ref date_from) = filter.date_from {
        sql.push_str(&format!(" AND r.date >= ?{}", param_idx));
        params.push(Box::new(date_from.clone()));
        param_idx += 1;
    }
    if let Some(ref date_to) = filter.date_to {
        sql.push_str(&format!(" AND r.date <= ?{}", param_idx));
        params.push(Box::new(date_to.clone()));
        param_idx += 1;
    }
    if let Some(amount_min) = filter.amount_min {
        sql.push_str(&format!(" AND r.total_amount >= ?{}", param_idx));
        params.push(Box::new(amount_min));
        param_idx += 1;
    }
    if let Some(amount_max) = filter.amount_max {
        sql.push_str(&format!(" AND r.total_amount <= ?{}", param_idx));
        params.push(Box::new(amount_max));
        param_idx += 1;
    }
    let _ = param_idx; // suppress unused warning

    sql.push_str(" ORDER BY r.date DESC, r.id DESC");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(ReceiptSummary {
                id: row.get(0)?,
                store_name: row.get(1)?,
                date: row.get(2)?,
                total_amount: row.get(3)?,
                item_count: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

/// Get full receipt detail including all items and store name.
/// Vollstaendige Kassenzettel-Details mit allen Positionen und Marktname abrufen.
#[tauri::command]
pub fn get_receipt_detail(id: i64, db: State<'_, Database>) -> Result<ReceiptDetail, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get receipt header / Kassenzettel-Kopf abrufen
    let receipt = conn
        .query_row(
            "SELECT r.id, r.store_id, s.name, r.date, r.time, r.total_amount,
                    r.discount_total, r.deposit_total, r.payment_method,
                    r.image_path, r.raw_json, r.created_at
             FROM receipts r
             JOIN stores s ON r.store_id = s.id
             WHERE r.id = ?1",
            [id],
            |row| {
                Ok(ReceiptDetail {
                    id: row.get(0)?,
                    store_id: row.get(1)?,
                    store_name: row.get(2)?,
                    date: row.get(3)?,
                    time: row.get(4)?,
                    total_amount: row.get(5)?,
                    discount_total: row.get(6)?,
                    deposit_total: row.get(7)?,
                    payment_method: row.get(8)?,
                    image_path: row.get(9)?,
                    raw_json: row.get(10)?,
                    items: Vec::new(), // filled below / wird unten befuellt
                    created_at: row.get(11)?,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| {
            format!(
                "Receipt with id {} not found / Kassenzettel mit id {} nicht gefunden",
                id, id
            )
        })?;

    // Get items / Positionen abrufen
    let mut stmt = conn
        .prepare(
            "SELECT ri.id, ri.raw_name, ri.quantity, ri.unit_price, ri.total_price,
                    ri.discount, ri.deposit, ri.category_id,
                    c.name as category_name, ri.product_id
             FROM receipt_items ri
             LEFT JOIN categories c ON ri.category_id = c.id
             WHERE ri.receipt_id = ?1
             ORDER BY ri.id",
        )
        .map_err(|e| e.to_string())?;

    let items: Vec<ReceiptItemDetail> = stmt
        .query_map([id], |row| {
            Ok(ReceiptItemDetail {
                id: row.get(0)?,
                raw_name: row.get(1)?,
                quantity: row.get(2)?,
                unit_price: row.get(3)?,
                total_price: row.get(4)?,
                discount: row.get(5)?,
                deposit: row.get(6)?,
                category_id: row.get(7)?,
                category_name: row.get(8)?,
                product_id: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ReceiptDetail { items, ..receipt })
}

/// Delete a receipt (items are cascade-deleted by the DB).
/// Kassenzettel loeschen (Positionen werden per CASCADE geloescht).
#[tauri::command]
pub fn delete_receipt(id: i64, db: State<'_, Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute("DELETE FROM receipts WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!(
            "Receipt with id {} not found / Kassenzettel mit id {} nicht gefunden",
            id, id
        ));
    }
    Ok(())
}

/// Search receipts by item raw_name.
/// Kassenzettel nach Positionsname durchsuchen.
#[tauri::command]
pub fn search_receipts(
    query: String,
    db: State<'_, Database>,
) -> Result<Vec<ReceiptSummary>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT r.id, s.name, r.date, r.total_amount,
                    (SELECT count(*) FROM receipt_items ri2 WHERE ri2.receipt_id = r.id) as item_count,
                    r.created_at
             FROM receipts r
             JOIN stores s ON r.store_id = s.id
             JOIN receipt_items ri ON ri.receipt_id = r.id
             WHERE ri.raw_name LIKE ?1
             ORDER BY r.date DESC, r.id DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([&pattern], |row| {
            Ok(ReceiptSummary {
                id: row.get(0)?,
                store_name: row.get(1)?,
                date: row.get(2)?,
                total_amount: row.get(3)?,
                item_count: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Database {
        Database::new_in_memory().expect("Failed to create in-memory database")
    }

    /// Helper: insert a receipt with items directly via SQL.
    /// Hilfsfunktion: Kassenzettel mit Positionen direkt per SQL einfuegen.
    fn insert_test_receipt(
        conn: &rusqlite::Connection,
        store_id: i64,
        date: &str,
        total: f64,
        items: &[(&str, f64, f64)],
    ) -> i64 {
        conn.execute(
            "INSERT INTO receipts (store_id, date, total_amount) VALUES (?1, ?2, ?3)",
            rusqlite::params![store_id, date, total],
        )
        .unwrap();
        let receipt_id = conn.last_insert_rowid();
        for (name, qty, price) in items {
            conn.execute(
                "INSERT INTO receipt_items (receipt_id, raw_name, quantity, unit_price, total_price)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![receipt_id, name, qty, price, qty * price],
            )
            .unwrap();
        }
        receipt_id
    }

    #[test]
    fn test_create_receipt_with_items() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        let receipt_id = insert_test_receipt(
            &conn,
            1,
            "2024-06-15",
            5.87,
            &[
                ("Milch 3.5%", 1.0, 1.29),
                ("Brot Vollkorn", 1.0, 2.49),
                ("Butter", 1.0, 2.09),
            ],
        );

        // Verify receipt exists / Pruefe ob Kassenzettel existiert
        let total: f64 = conn
            .query_row(
                "SELECT total_amount FROM receipts WHERE id = ?1",
                [receipt_id],
                |row| row.get(0),
            )
            .unwrap();
        assert!((total - 5.87).abs() < 0.001);

        // Verify items / Pruefe Positionen
        let item_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM receipt_items WHERE receipt_id = ?1",
                [receipt_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(item_count, 3);
    }

    #[test]
    fn test_resolve_category_id_creates_missing_category() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        let category_id = resolve_category_id(&conn, None, Some("Haustier")).unwrap();
        assert!(category_id.is_some());

        let created_name: String = conn
            .query_row(
                "SELECT name FROM categories WHERE id = ?1",
                [category_id.unwrap()],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(created_name, "Haustier");
    }

    #[test]
    fn test_resolve_category_id_matches_existing_category_case_insensitive() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        let existing_id: i64 = conn
            .query_row(
                "SELECT id FROM categories WHERE name = 'Sonstiges'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        let resolved_id = resolve_category_id(&conn, None, Some(" sonstiges ")).unwrap();
        assert_eq!(resolved_id, Some(existing_id));
    }

    #[test]
    fn test_get_receipt_detail() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        let receipt_id = insert_test_receipt(
            &conn,
            1,
            "2024-06-15",
            3.58,
            &[("Milch", 1.0, 1.29), ("Kaese", 1.0, 2.29)],
        );

        // Query detail / Detail abfragen
        let detail = conn
            .query_row(
                "SELECT r.id, r.store_id, s.name, r.date, r.time, r.total_amount,
                        r.discount_total, r.deposit_total, r.payment_method,
                        r.image_path, r.raw_json, r.created_at
                 FROM receipts r JOIN stores s ON r.store_id = s.id
                 WHERE r.id = ?1",
                [receipt_id],
                |row| {
                    Ok(ReceiptDetail {
                        id: row.get(0)?,
                        store_id: row.get(1)?,
                        store_name: row.get(2)?,
                        date: row.get(3)?,
                        time: row.get(4)?,
                        total_amount: row.get(5)?,
                        discount_total: row.get(6)?,
                        deposit_total: row.get(7)?,
                        payment_method: row.get(8)?,
                        image_path: row.get(9)?,
                        raw_json: row.get(10)?,
                        items: Vec::new(),
                        created_at: row.get(11)?,
                    })
                },
            )
            .unwrap();

        assert_eq!(detail.id, receipt_id);
        assert!((detail.total_amount - 3.58).abs() < 0.001);

        // Check items / Positionen pruefen
        let mut stmt = conn
            .prepare("SELECT id, raw_name, quantity, unit_price, total_price, discount, deposit, category_id, NULL, product_id FROM receipt_items WHERE receipt_id = ?1")
            .unwrap();
        let items: Vec<ReceiptItemDetail> = stmt
            .query_map([receipt_id], |row| {
                Ok(ReceiptItemDetail {
                    id: row.get(0)?,
                    raw_name: row.get(1)?,
                    quantity: row.get(2)?,
                    unit_price: row.get(3)?,
                    total_price: row.get(4)?,
                    discount: row.get(5)?,
                    deposit: row.get(6)?,
                    category_id: row.get(7)?,
                    category_name: row.get(8)?,
                    product_id: row.get(9)?,
                })
            })
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].raw_name, "Milch");
    }

    #[test]
    fn test_get_receipts_with_filter() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        insert_test_receipt(&conn, 1, "2024-01-10", 10.0, &[("A", 1.0, 10.0)]);
        insert_test_receipt(&conn, 1, "2024-06-15", 25.0, &[("B", 1.0, 25.0)]);
        insert_test_receipt(&conn, 2, "2024-06-20", 50.0, &[("C", 1.0, 50.0)]);

        // Filter by date range / Nach Zeitraum filtern
        let mut stmt = conn
            .prepare(
                "SELECT r.id, s.name, r.date, r.total_amount,
                        (SELECT count(*) FROM receipt_items ri WHERE ri.receipt_id = r.id),
                        r.created_at
                 FROM receipts r JOIN stores s ON r.store_id = s.id
                 WHERE r.date >= ?1 AND r.date <= ?2
                 ORDER BY r.date DESC",
            )
            .unwrap();
        let results: Vec<ReceiptSummary> = stmt
            .query_map(["2024-06-01", "2024-06-30"], |row| {
                Ok(ReceiptSummary {
                    id: row.get(0)?,
                    store_name: row.get(1)?,
                    date: row.get(2)?,
                    total_amount: row.get(3)?,
                    item_count: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(results.len(), 2);

        // Filter by amount / Nach Betrag filtern
        let mut stmt2 = conn
            .prepare(
                "SELECT r.id, s.name, r.date, r.total_amount,
                        (SELECT count(*) FROM receipt_items ri WHERE ri.receipt_id = r.id),
                        r.created_at
                 FROM receipts r JOIN stores s ON r.store_id = s.id
                 WHERE r.total_amount >= ?1
                 ORDER BY r.date DESC",
            )
            .unwrap();
        let results2: Vec<ReceiptSummary> = stmt2
            .query_map([30.0], |row| {
                Ok(ReceiptSummary {
                    id: row.get(0)?,
                    store_name: row.get(1)?,
                    date: row.get(2)?,
                    total_amount: row.get(3)?,
                    item_count: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(results2.len(), 1);
        assert!((results2[0].total_amount - 50.0).abs() < 0.001);
    }

    #[test]
    fn test_search_receipts_by_item_name() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        insert_test_receipt(
            &conn,
            1,
            "2024-06-15",
            5.0,
            &[("Milch 3.5%", 1.0, 1.29), ("Brot", 1.0, 2.49)],
        );
        insert_test_receipt(&conn, 1, "2024-06-16", 3.0, &[("Kaese Gouda", 1.0, 3.0)]);

        // Search for "Milch" / Nach "Milch" suchen
        let pattern = "%Milch%";
        let mut stmt = conn
            .prepare(
                "SELECT DISTINCT r.id, s.name, r.date, r.total_amount,
                        (SELECT count(*) FROM receipt_items ri2 WHERE ri2.receipt_id = r.id),
                        r.created_at
                 FROM receipts r
                 JOIN stores s ON r.store_id = s.id
                 JOIN receipt_items ri ON ri.receipt_id = r.id
                 WHERE ri.raw_name LIKE ?1
                 ORDER BY r.date DESC",
            )
            .unwrap();
        let results: Vec<ReceiptSummary> = stmt
            .query_map([pattern], |row| {
                Ok(ReceiptSummary {
                    id: row.get(0)?,
                    store_name: row.get(1)?,
                    date: row.get(2)?,
                    total_amount: row.get(3)?,
                    item_count: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].item_count, 2); // receipt has 2 items total
    }

    #[test]
    fn test_delete_receipt_cascades_items() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();

        let receipt_id = insert_test_receipt(
            &conn,
            1,
            "2024-06-15",
            5.0,
            &[("Milch", 1.0, 1.29), ("Brot", 1.0, 2.49)],
        );

        // Verify items exist / Pruefe ob Positionen existieren
        let count_before: i64 = conn
            .query_row(
                "SELECT count(*) FROM receipt_items WHERE receipt_id = ?1",
                [receipt_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count_before, 2);

        // Delete receipt / Kassenzettel loeschen
        conn.execute("DELETE FROM receipts WHERE id = ?1", [receipt_id])
            .unwrap();

        // Items should be gone / Positionen sollten weg sein
        let count_after: i64 = conn
            .query_row(
                "SELECT count(*) FROM receipt_items WHERE receipt_id = ?1",
                [receipt_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count_after, 0);
    }
}
