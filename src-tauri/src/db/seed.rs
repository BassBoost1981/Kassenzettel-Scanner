// Default data seeding — categories and stores
// Standard-Daten Seeding — Kategorien und Geschaefte

use rusqlite::Connection;

/// Insert default categories and stores (idempotent via ON CONFLICT IGNORE).
/// Fuegt Standard-Kategorien und -Geschaefte ein (idempotent via ON CONFLICT IGNORE).
pub fn insert_defaults(conn: &Connection) -> Result<(), rusqlite::Error> {
    let categories = [
        "Obst/Gemüse",
        "Milchprodukte",
        "Fleisch/Wurst",
        "Backwaren",
        "Getränke",
        "Tiefkühl",
        "Drogerie",
        "Sonstiges",
    ];

    let stores = [
        "Rewe",
        "Lidl",
        "Aldi Nord",
        "Aldi Süd",
        "Edeka",
        "Penny",
        "Kaufland",
        "Netto",
        "dm",
        "Rossmann",
    ];

    for cat in &categories {
        conn.execute(
            "INSERT OR IGNORE INTO categories (name) VALUES (?1)",
            [cat],
        )?;
    }

    for store in &stores {
        conn.execute(
            "INSERT OR IGNORE INTO stores (name) VALUES (?1)",
            [store],
        )?;
    }

    Ok(())
}
