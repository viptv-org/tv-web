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
        .invoke_handler(tauri::generate_handler![
            test_autoplay_enabled,
            playback_engine_override,
            test_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running the VIPTV desktop app");
}

/// Harness switch: `VIPTV_TEST_AUTOPLAY=1` (or `true`) makes the webview
/// autoplay the first playable title and mirror player snapshots to stdout,
/// so a shell can watch real playback without driving the UI.
#[tauri::command]
fn test_autoplay_enabled() -> bool {
    autoplay_test_mode(std::env::var("VIPTV_TEST_AUTOPLAY").ok().as_deref())
}

/// `VIPTV_ENGINE=mpv|gstreamer|auto` overrides the persisted engine choice
/// for this launch without rewriting it.
#[tauri::command]
fn playback_engine_override() -> Option<String> {
    std::env::var("VIPTV_ENGINE")
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

/// The harness's stdout channel; the shell prefixes every line so the
/// output stays greppable regardless of webview logging.
#[tauri::command]
fn test_log(message: String) {
    println!("[test] {message}");
}

fn autoplay_test_mode(value: Option<&str>) -> bool {
    matches!(value.map(str::trim), Some("1" | "true"))
}

#[cfg(test)]
mod tests {
    use super::autoplay_test_mode;

    #[test]
    fn autoplay_mode_accepts_only_one_or_true() {
        assert!(autoplay_test_mode(Some("1")));
        assert!(autoplay_test_mode(Some("true")));
        assert!(autoplay_test_mode(Some(" 1 ")));
        assert!(!autoplay_test_mode(None));
        assert!(!autoplay_test_mode(Some("")));
        assert!(!autoplay_test_mode(Some("0")));
        assert!(!autoplay_test_mode(Some("yes")));
    }
}
