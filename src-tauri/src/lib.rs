use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;
#[cfg(desktop)]
use tauri::{Emitter, Manager};

static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(true);

fn open_url_in_default_browser(url: &str) -> Result<(), String> {
    let trimmed = url.trim();
    if !(trimmed.starts_with("https://")
        || trimmed.starts_with("http://")
        || trimmed.starts_with("mailto:"))
    {
        return Err("Only http://, https://, and mailto: URLs are permitted.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        // cmd.exe /C start "" "url" reliably launches the default Windows browser (Edge/Chrome/Firefox)
        let _ = std::process::Command::new("cmd.exe")
            .args(["/C", "start", "", trimmed])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .or_else(|_| {
                std::process::Command::new("explorer.exe")
                    .arg(trimmed)
                    .creation_flags(CREATE_NO_WINDOW)
                    .spawn()
            });
    }

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(trimmed).spawn();
    }

    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(trimmed).spawn();
    }

    #[cfg(target_os = "android")]
    {
        let _ = std::process::Command::new("am")
            .args(["start", "-a", "android.intent.action.VIEW", "-d", trimmed])
            .spawn();
    }

    Ok(())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    open_url_in_default_browser(&url)
}


#[tauri::command]
fn window_minimize(app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Some(w) = app.get_webview_window("main") {
            w.minimize().map_err(|e| e.to_string())?;
        }
    }
    #[cfg(mobile)]
    {
        let _ = app;
    }
    Ok(())
}

#[tauri::command]
fn window_toggle_maximize(app: AppHandle) -> Result<bool, String> {
    #[cfg(desktop)]
    {
        if let Some(w) = app.get_webview_window("main") {
            let is_max = w.is_maximized().unwrap_or(false);
            if is_max {
                w.unmaximize().map_err(|e| e.to_string())?;
                return Ok(false);
            } else {
                w.maximize().map_err(|e| e.to_string())?;
                return Ok(true);
            }
        }
    }
    #[cfg(mobile)]
    {
        let _ = app;
    }
    Ok(false)
}

#[tauri::command]
fn window_toggle_fullscreen(app: AppHandle) -> Result<bool, String> {
    #[cfg(desktop)]
    {
        if let Some(w) = app.get_webview_window("main") {
            let is_fs = w.is_fullscreen().unwrap_or(false);
            w.set_fullscreen(!is_fs).map_err(|e| e.to_string())?;
            return Ok(!is_fs);
        }
    }
    #[cfg(mobile)]
    {
        let _ = app;
    }
    Ok(false)
}

#[tauri::command]
fn window_close_or_hide(app: AppHandle, close_to_tray: bool) -> Result<(), String> {
    CLOSE_TO_TRAY.store(close_to_tray, Ordering::SeqCst);
    #[cfg(desktop)]
    {
        if close_to_tray {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.hide();
            }
        } else {
            app.exit(0);
        }
    }
    #[cfg(mobile)]
    {
        let _ = app;
    }
    Ok(())
}

#[tauri::command]
fn sync_exe_settings(run_at_startup: bool, close_to_tray: bool) -> Result<(), String> {
    CLOSE_TO_TRAY.store(close_to_tray, Ordering::SeqCst);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        if let Ok(exe_path) = std::env::current_exe() {
            let exe_str = format!("\"{}\"", exe_path.to_string_lossy());
            if run_at_startup {
                let _ = std::process::Command::new("reg")
                    .args([
                        "add",
                        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                        "/v",
                        "FocusPulse",
                        "/t",
                        "REG_SZ",
                        "/d",
                        &exe_str,
                        "/f"
        ])
                    .creation_flags(CREATE_NO_WINDOW)
                    .status();
            } else {
                let _ = std::process::Command::new("reg")
                    .args([
                        "delete",
                        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                        "/v",
                        "FocusPulse",
                        "/f"
        ])
                    .creation_flags(CREATE_NO_WINDOW)
                    .status();
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = run_at_startup;
    }
    Ok(())
}

#[tauri::command]
fn send_native_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Some(w) = app.get_webview_window("main") {
            let visible = w.is_visible().unwrap_or(true);
            let minimized = w.is_minimized().unwrap_or(false);
            if !visible || minimized {
                let _ = w.request_user_attention(Some(tauri::UserAttentionType::Informational));
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        std::thread::spawn(move || {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            let safe_title = title.replace('\'', "''").replace('\n', " ");
            let safe_body = body.replace('\'', "''").replace('\n', " ");
            let ps_script = format!(
                "$ErrorActionPreference = 'SilentlyContinue'; \
                [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; \
                [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null; \
                $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); \
                $textNodes = $template.GetElementsByTagName('text'); \
                $textNodes.Item(0).AppendChild($template.CreateTextNode('{}')) | Out-Null; \
                $textNodes.Item(1).AppendChild($template.CreateTextNode('{}')) | Out-Null; \
                $toast = [Windows.UI.Notifications.ToastNotification]::new($template); \
                [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('FocusPulse').Show($toast);",
                safe_title, safe_body
            );
            let _ = std::process::Command::new("powershell")
                .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &ps_script])
                .creation_flags(CREATE_NO_WINDOW)
                .status();
        });
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, title, body);
    }
    Ok(())
}

#[cfg(desktop)]
fn show_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_always_on_top(true);
        let _ = w.set_focus();
        let _ = w.set_always_on_top(false);
        let _ = w.emit("fp_window_restored", ());
    }
}

#[cfg(desktop)]
fn setup_system_tray(app: &AppHandle) -> Result<(), String> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let open_item = MenuItem::with_id(app, "open", "Open FocusPulse", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let timer_item = MenuItem::with_id(app, "toggle_timer", "Start / Pause Pomodoro", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let sep = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit FocusPulse", true, None::<&str>)
        .map_err(|e| e.to_string())?;

    let menu = Menu::with_items(app, &[&open_item, &timer_item, &sep, &quit_item])
        .map_err(|e| e.to_string())?;

    let mut builder = TrayIconBuilder::with_id("focuspulse-tray")
        .tooltip("FocusPulse — Study, Tasks, Habits & Hydration")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "toggle_timer" => {
                let _ = app.emit("tray_toggle_timer", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }));
    }

    builder = builder.plugin(tauri_plugin_opener::init());

    builder
        .setup(|app| {
            #[cfg(desktop)]
            {
                let _ = setup_system_tray(app.handle());
            }
            let _ = app;
            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(desktop)]
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    if CLOSE_TO_TRAY.load(Ordering::SeqCst) {
                        api.prevent_close();
                        let _ = window.hide();
                    } else {
                        window.app_handle().exit(0);
                    }
                }
            }
            #[cfg(mobile)]
            let _ = (window, event);
        })
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_toggle_maximize,
            window_toggle_fullscreen,
            window_close_or_hide,
            sync_exe_settings,
            send_native_notification,
            open_external_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running FocusPulse Tauri application");
}
