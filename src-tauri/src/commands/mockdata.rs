// Mock data generator for testing price history and dashboard
// Mock-Daten-Generator zum Testen von Preisverlauf und Dashboard

use crate::db::Database;
use tauri::State;

/// Insert mock receipts spanning 6 months across multiple stores.
/// Fuegt Mock-Kassenzettel ueber 6 Monate in verschiedenen Maerkten ein.
#[tauri::command]
pub fn insert_mock_data(db: State<'_, Database>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Products with realistic price ranges / Produkte mit realistischen Preisbereichen
    let products = vec![
        // (name, category, base_price, price_variance)
        ("Vollmilch 3,5% 1L", "Milchprodukte", 1.19, 0.30),
        ("Butter 250g", "Milchprodukte", 1.89, 0.40),
        ("Eier 10er Pack", "Sonstiges", 2.49, 0.60),
        ("Bananen 1kg", "Obst/Gemüse", 1.49, 0.30),
        ("Äpfel 1kg", "Obst/Gemüse", 2.29, 0.50),
        ("Kartoffeln 2kg", "Obst/Gemüse", 1.99, 0.40),
        ("Tomaten 500g", "Obst/Gemüse", 1.79, 0.50),
        ("Hackfleisch 500g", "Fleisch/Wurst", 3.99, 0.80),
        ("Hähnchenbrust 400g", "Fleisch/Wurst", 4.49, 1.00),
        ("Gouda Scheiben 200g", "Milchprodukte", 1.69, 0.30),
        ("Vollkornbrot 500g", "Backwaren", 1.49, 0.20),
        ("Brötchen 6er", "Backwaren", 1.29, 0.20),
        ("Mineralwasser 1,5L", "Getränke", 0.49, 0.10),
        ("Orangensaft 1L", "Getränke", 1.29, 0.30),
        ("Cola 1,5L", "Getränke", 1.19, 0.20),
        ("Tiefkühlpizza", "Tiefkühl", 2.49, 0.50),
        ("Spinat TK 450g", "Tiefkühl", 1.29, 0.20),
        ("Zahnpasta 75ml", "Drogerie", 1.45, 0.30),
        ("Spülmittel 500ml", "Drogerie", 1.19, 0.20),
        ("Nudeln 500g", "Sonstiges", 0.99, 0.20),
        ("Reis 1kg", "Sonstiges", 1.79, 0.30),
        ("Olivenöl 500ml", "Sonstiges", 3.99, 0.80),
    ];

    // Store IDs (from seed data) / Markt-IDs (aus Seed-Daten)
    let store_names = vec!["Rewe", "Lidl", "Edeka", "Aldi Süd", "Penny"];

    // Get store IDs / Markt-IDs ermitteln
    let mut store_ids: Vec<(i64, &str)> = Vec::new();
    for name in &store_names {
        let id: i64 = conn
            .query_row("SELECT id FROM stores WHERE name = ?1", [name], |row| {
                row.get(0)
            })
            .map_err(|e| format!("Store '{}' not found: {}", name, e))?;
        store_ids.push((id, name));
    }

    // Get category IDs / Kategorie-IDs ermitteln
    let get_category_id = |cat: &str| -> Result<i64, String> {
        conn.query_row("SELECT id FROM categories WHERE name = ?1", [cat], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Category '{}' not found: {}", cat, e))
    };

    let mut receipt_count = 0;
    let mut item_count = 0;

    // Generate receipts for 6 months (Oct 2025 - Mar 2026)
    // Kassenzettel fuer 6 Monate generieren (Okt 2025 - Mär 2026)
    let months = vec![
        (2025, 10),
        (2025, 11),
        (2025, 12),
        (2026, 1),
        (2026, 2),
        (2026, 3),
    ];

    // Simple deterministic "random" using index
    let mut seed: u64 = 42;
    let mut pseudo_rand = || -> f64 {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        ((seed >> 33) as f64) / (u32::MAX as f64)
    };

    for (year, month) in &months {
        // 2-4 receipts per store per month / 2-4 Kassenzettel pro Markt pro Monat
        for (store_id, _store_name) in &store_ids {
            let trips = 2 + (pseudo_rand() * 3.0) as i32; // 2-4 trips

            for trip in 0..trips {
                let day = 1 + (pseudo_rand() * 27.0) as i32; // day 1-28
                let hour = 8 + (pseudo_rand() * 12.0) as i32; // 8-20 Uhr
                let minute = (pseudo_rand() * 59.0) as i32;
                let date = format!("{:04}-{:02}-{:02}", year, month, day);
                let time = format!("{:02}:{:02}", hour, minute);

                // 3-8 items per receipt / 3-8 Artikel pro Kassenzettel
                let num_items = 3 + (pseudo_rand() * 6.0) as usize;
                let mut receipt_total = 0.0;
                let mut receipt_items: Vec<(String, String, f64, f64, i64)> = Vec::new();

                for i in 0..num_items {
                    let prod_idx = ((trip as usize * 7 + i * 3 + *store_id as usize)
                        + (pseudo_rand() * products.len() as f64) as usize)
                        % products.len();
                    let (name, category, base_price, variance) = &products[prod_idx];

                    // Price varies by store and month / Preis variiert nach Markt und Monat
                    let price_factor = 1.0 + (pseudo_rand() - 0.5) * variance / base_price;
                    let price = (*base_price * price_factor * 100.0).round() / 100.0;
                    let quantity = if pseudo_rand() > 0.8 { 2.0 } else { 1.0 };
                    let total = (price * quantity * 100.0).round() / 100.0;

                    let cat_id = get_category_id(category)?;
                    receipt_items.push((
                        name.to_string(),
                        category.to_string(),
                        quantity,
                        price,
                        cat_id,
                    ));
                    receipt_total += total;
                }

                receipt_total = (receipt_total * 100.0).round() / 100.0;

                // Insert receipt / Kassenzettel einfuegen
                conn.execute(
                    "INSERT INTO receipts (store_id, date, time, total_amount, payment_method) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![store_id, date, time, receipt_total, if pseudo_rand() > 0.5 { "Karte" } else { "Bar" }],
                ).map_err(|e| e.to_string())?;

                let receipt_id = conn.last_insert_rowid();
                receipt_count += 1;

                // Insert items / Artikel einfuegen
                for (name, _category, quantity, price, cat_id) in &receipt_items {
                    let total = (price * quantity * 100.0).round() / 100.0;
                    conn.execute(
                        "INSERT INTO receipt_items (receipt_id, raw_name, quantity, unit_price, total_price, category_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        rusqlite::params![receipt_id, name, quantity, price, total, cat_id],
                    ).map_err(|e| e.to_string())?;
                    item_count += 1;
                }
            }
        }
    }

    Ok(format!(
        "{} Kassenzettel mit {} Artikeln eingefuegt / {} receipts with {} items inserted",
        receipt_count, item_count, receipt_count, item_count
    ))
}

/// Delete all mock data (all receipts and items).
/// Loescht alle Mock-Daten (alle Kassenzettel und Artikel).
#[tauri::command]
pub fn delete_all_receipts(db: State<'_, Database>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM receipt_items", [])
        .map_err(|e| e.to_string())?;
    let deleted = conn
        .execute("DELETE FROM receipts", [])
        .map_err(|e| e.to_string())?;
    Ok(format!(
        "{} Kassenzettel geloescht / {} receipts deleted",
        deleted, deleted
    ))
}
