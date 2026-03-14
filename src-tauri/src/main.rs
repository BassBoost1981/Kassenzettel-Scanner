// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// Verhindert zusätzliches Konsolenfenster unter Windows im Release, NICHT ENTFERNEN!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    kassenzettel_scanner_lib::run()
}
