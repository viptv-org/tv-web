//! The VIPTV desktop shell: the shared tv-web UI in a Tauri webview with the
//! native video engine attached. The DOM owns every visible control and
//! overlay; `tauri-plugin-video` owns only the native playback surface, and
//! the HTTP and opener plugins carry the backend transport and external
//! sign-in links. All behavior beyond this registration lives in the
//! shared frontend (`../src`).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_video::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running the VIPTV desktop app");
}
