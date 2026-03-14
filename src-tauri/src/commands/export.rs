// CSV export command / CSV-Export-Befehl
// Exports receipts and items as semicolon-separated CSV with German number format.
// Exportiert Kassenzettel und Positionen als CSV mit Semikolon und deutschem Zahlenformat.

use std::io::Write;
use tauri::State;

use crate::commands::receipts::ReceiptFilter;
use crate::db::Database;

/// Format a float with German decimal separator (comma instead of dot).
/// Zahl mit deutschem Dezimaltrennzeichen (Komma statt Punkt) formatieren.
fn german_number(value: f64) -> String {
    format!("{:.2}", value).replace('.', ",")
}

/// Escape a CSV field: wrap in quotes if it contains semicolons, quotes, or newlines.
/// CSV-Feld escapen: in Anführungszeichen setzen wenn Semikolon, Anführungszeichen oder Zeilenumbrüche enthalten.
fn csv_escape(s: &str) -> String {
    if s.contains(';') || s.contains('"') || s.contains('\n') || s.contains('\r') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

/// Export receipts as CSV file with German formatting.
/// Kassenzettel als CSV-Datei mit deutschem Format exportieren.
#[tauri::command]
pub fn export_receipts_csv(
    path: String,
    filter: Option<ReceiptFilter>,
    db: State<'_, Database>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let filter = filter.unwrap_or_default();

    // Build filtered receipt query / Gefilterte Kassenzettel-Abfrage erstellen
    let mut sql = String::from(
        "SELECT r.id, r.date, s.name as store_name
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
    let _ = param_idx; // suppress unused warning / Unterdrücke unused-Warnung

    sql.push_str(" ORDER BY r.date DESC, r.id DESC");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();

    let receipts: Vec<(i64, String, String)> = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Open output file / Ausgabedatei oeffnen
    let mut file = std::fs::File::create(&path).map_err(|e| {
        format!(
            "Could not create file / Datei konnte nicht erstellt werden: {}",
            e
        )
    })?;

    // Write UTF-8 BOM so Excel opens the file correctly
    // UTF-8 BOM schreiben damit Excel die Datei korrekt oeffnet
    file.write_all(b"\xEF\xBB\xBF")
        .map_err(|e| e.to_string())?;

    // Write header / Kopfzeile schreiben
    writeln!(
        file,
        "Datum;Markt;Artikel;Menge;Einzelpreis;Gesamtpreis;Kategorie;Rabatt;Pfand"
    )
    .map_err(|e| e.to_string())?;

    // For each receipt, get items and write rows
    // Fuer jeden Kassenzettel Positionen abrufen und Zeilen schreiben
    let mut item_stmt = conn
        .prepare(
            "SELECT ri.raw_name, ri.quantity, ri.unit_price, ri.total_price,
                    ri.discount, ri.deposit, c.name
             FROM receipt_items ri
             LEFT JOIN categories c ON ri.category_id = c.id
             WHERE ri.receipt_id = ?1
             ORDER BY ri.id",
        )
        .map_err(|e| e.to_string())?;

    for (receipt_id, date, store_name) in &receipts {
        let items: Vec<(String, f64, f64, f64, f64, f64, Option<String>)> = item_stmt
            .query_map([receipt_id], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        for (raw_name, quantity, unit_price, total_price, discount, deposit, category) in &items {
            writeln!(
                file,
                "{};{};{};{};{};{};{};{};{}",
                csv_escape(date),
                csv_escape(store_name),
                csv_escape(raw_name),
                german_number(*quantity),
                german_number(*unit_price),
                german_number(*total_price),
                csv_escape(category.as_deref().unwrap_or("")),
                german_number(*discount),
                german_number(*deposit),
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
