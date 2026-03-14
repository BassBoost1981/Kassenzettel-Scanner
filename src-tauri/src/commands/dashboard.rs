// Dashboard data commands / Dashboard-Daten Befehle

use crate::db::Database;
use serde::Serialize;
use tauri::State;

/// Monthly spending per store / Monatsausgaben pro Markt
#[derive(Serialize)]
pub struct MonthlySpending {
    pub month: String,       // "2026-01"
    pub month_label: String, // "Jan 2026"
    pub store_name: String,
    pub total: f64,
    pub receipt_count: i64,
}

/// Top category spending / Top-Kategorie-Ausgaben
#[derive(Serialize)]
pub struct CategorySpending {
    pub category: String,
    pub total: f64,
}

/// Get monthly spending grouped by store.
/// Gibt monatliche Ausgaben gruppiert nach Markt zurueck.
#[tauri::command]
pub fn get_monthly_spending(db: State<'_, Database>) -> Result<Vec<MonthlySpending>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT
                strftime('%Y-%m', r.date) as month,
                s.name as store_name,
                SUM(r.total_amount) as total,
                COUNT(r.id) as receipt_count
             FROM receipts r
             JOIN stores s ON r.store_id = s.id
             GROUP BY month, s.name
             ORDER BY month ASC, total DESC",
        )
        .map_err(|e| e.to_string())?;

    let months_de = [
        "", "Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
    ];

    let results: Vec<MonthlySpending> = stmt
        .query_map([], |row| {
            let month: String = row.get(0)?;
            let parts: Vec<&str> = month.split('-').collect();
            let year = parts.get(0).unwrap_or(&"");
            let m: usize = parts.get(1).unwrap_or(&"0").parse().unwrap_or(0);
            let label = format!("{} {}", months_de.get(m).unwrap_or(&"?"), year);

            Ok(MonthlySpending {
                month: row.get(0)?,
                month_label: label,
                store_name: row.get(1)?,
                total: row.get(2)?,
                receipt_count: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e: rusqlite::Error| e.to_string())?;

    Ok(results)
}

/// Get spending by category for a given time range.
/// Gibt Ausgaben nach Kategorie fuer einen Zeitraum zurueck.
#[tauri::command]
pub fn get_category_spending(
    months: Option<i32>,
    db: State<'_, Database>,
) -> Result<Vec<CategorySpending>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let months_val = months.unwrap_or(6);

    let mut stmt = conn
        .prepare(
            "SELECT
                COALESCE(c.name, 'Sonstiges') as category,
                SUM(ri.total_price) as total
             FROM receipt_items ri
             JOIN receipts r ON ri.receipt_id = r.id
             LEFT JOIN categories c ON ri.category_id = c.id
             WHERE r.date >= date('now', ? || ' months')
             GROUP BY category
             ORDER BY total DESC",
        )
        .map_err(|e| e.to_string())?;

    let offset = format!("-{}", months_val);
    let results: Vec<CategorySpending> = stmt
        .query_map([&offset], |row| {
            Ok(CategorySpending {
                category: row.get(0)?,
                total: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e: rusqlite::Error| e.to_string())?;

    Ok(results)
}
