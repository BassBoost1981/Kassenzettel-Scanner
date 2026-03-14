// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
// Mehr über Tauri-Befehle: https://tauri.app/develop/calling-rust/

pub mod commands;
pub mod db;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hallo, {}! Willkommen beim Kassenzettel Scanner.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Use exe directory for portable USB deployment
    // Verwende exe-Verzeichnis fuer portable USB-Installation
    let app_dir = std::env::current_exe()
        .expect("Failed to get exe path")
        .parent()
        .expect("Failed to get exe dir")
        .to_path_buf();

    let database = db::Database::new(app_dir)
        .expect("Failed to initialize database / Datenbank-Initialisierung fehlgeschlagen");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(database)
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            commands::stores::get_stores,
            commands::stores::create_store,
            commands::stores::update_store,
            commands::stores::delete_store,
            commands::receipts::create_receipt,
            commands::receipts::get_receipts,
            commands::receipts::get_receipt_detail,
            commands::receipts::delete_receipt,
            commands::receipts::search_receipts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
