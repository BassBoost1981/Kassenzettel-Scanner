// Price chart data commands / Preisverlauf-Daten Befehle

use crate::db::Database;
use serde::Serialize;
use tauri::State;

/// A single price data point for the chart.
/// Ein einzelner Preis-Datenpunkt fuer das Diagramm.
#[derive(Serialize)]
pub struct PricePoint {
    pub date: String,
    pub store_name: String,
    pub price: f64,
    pub quantity: f64,
}

/// Search for distinct product names matching a query.
/// Sucht nach eindeutigen Produktnamen die einer Anfrage entsprechen.
#[tauri::command]
pub fn search_product_names(query: String, db: State<'_, Database>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT raw_name FROM receipt_items
             WHERE raw_name LIKE ?1
             ORDER BY raw_name
             LIMIT 20",
        )
        .map_err(|e| e.to_string())?;

    let names: Vec<String> = stmt
        .query_map([&pattern], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e: rusqlite::Error| e.to_string())?;

    Ok(names)
}

/// Get min/max price for a product name.
/// Gibt Min/Max-Preis fuer einen Produktnamen zurueck.
#[tauri::command]
pub fn get_price_range(
    product_name: String,
    db: State<'_, Database>,
) -> Result<Option<(f64, f64)>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let result = conn
        .query_row(
            "SELECT MIN(unit_price), MAX(unit_price) FROM receipt_items WHERE raw_name = ?1",
            [&product_name],
            |row| {
                let min: Option<f64> = row.get(0)?;
                let max: Option<f64> = row.get(1)?;
                Ok(min.zip(max))
            },
        )
        .map_err(|e| e.to_string())?;
    Ok(result)
}

/// Get price history for a product across all stores.
/// Gibt den Preisverlauf fuer ein Produkt ueber alle Maerkte zurueck.
#[tauri::command]
pub fn get_price_history(
    product_name: String,
    db: State<'_, Database>,
) -> Result<Vec<PricePoint>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT r.date, s.name as store_name, ri.unit_price, ri.quantity
             FROM receipt_items ri
             JOIN receipts r ON ri.receipt_id = r.id
             JOIN stores s ON r.store_id = s.id
             WHERE ri.raw_name = ?1
             ORDER BY r.date ASC",
        )
        .map_err(|e| e.to_string())?;

    let points: Vec<PricePoint> = stmt
        .query_map([&product_name], |row| {
            Ok(PricePoint {
                date: row.get(0)?,
                store_name: row.get(1)?,
                price: row.get(2)?,
                quantity: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e: rusqlite::Error| e.to_string())?;

    Ok(points)
}
