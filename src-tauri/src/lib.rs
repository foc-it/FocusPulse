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
        // rundll32 url.dll,FileProtocolHandler safely opens URLs with query parameters (&, ?, =) in the default Windows browser
        let status = std::process::Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", trimmed])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        if status.is_err() {
            let _ = std::process::Command::new("explorer.exe")
                .arg(trimmed)
                .creation_flags(CREATE_NO_WINDOW)
                .status();
        }
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
fn start_external_google_auth(app: AppHandle, firebase_config_json: String) -> Result<u16, String> {
    #[cfg(desktop)]
    {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        use std::time::Duration;

        let listener = TcpListener::bind("127.0.0.1:45893")
            .or_else(|_| TcpListener::bind("127.0.0.1:0"))
            .map_err(|e| e.to_string())?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        let auth_url = format!("http://127.0.0.1:{}/auth", port);

        let app_clone = app.clone();
        let cfg_json = firebase_config_json.clone();

        std::thread::spawn(move || {
            let _ = listener.set_nonblocking(false);
            let start = std::time::Instant::now();
            while start.elapsed() < Duration::from_secs(180) {
                if let Ok((mut stream, _)) = listener.accept() {
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                    let mut buf = [0u8; 8192];
                    let n = stream.read(&mut buf).unwrap_or(0);
                    if n == 0 {
                        continue;
                    }
                    let req = String::from_utf8_lossy(&buf[..n]);
                    let first_line = req.lines().next().unwrap_or("");

                    if first_line.starts_with("GET /auth") {
                        let page = format!(
                            r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FocusPulse — Sign in with Google</title>
<style>
  body {{ margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#09090f; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; padding:20px; }}
  .card {{ max-width:420px; width:100%; background:rgba(22,22,35,0.88); border:1px solid rgba(255,255,255,0.14); border-radius:28px; padding:32px; text-align:center; box-shadow:0 24px 60px rgba(0,0,0,0.6); }}
  .logo {{ width:64px; height:64px; border-radius:18px; background:#5f5bf6; color:#fff; font-weight:900; font-size:24px; display:flex; align-items:center; justify-content:center; margin:0 auto 18px; box-shadow:0 12px 28px rgba(95,91,246,0.4); }}
  h1 {{ font-size:22px; font-weight:800; margin:0 0 8px; }}
  p {{ font-size:13px; color:#94a3b8; line-height:1.5; margin:0 0 22px; }}
  .btn {{ width:100%; padding:13px 18px; border-radius:16px; border:none; background:#5f5bf6; color:#fff; font-weight:800; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px; }}
  .btn:hover {{ background:#4f46e5; }}
  .status {{ margin-top:16px; font-size:12px; color:#a5b4fc; font-weight:600; }}
  .done {{ display:none; }}
</style>
</head>
<body>
  <div class="card">
    <div class="logo">FP</div>
    <div id="step-login">
      <h1>Sign in to FocusPulse</h1>
      <p>Choose your Google account in this browser window. Once signed in, you'll be returned directly to the FocusPulse Desktop App.</p>
      <button id="g-btn" class="btn" onclick="runGooglePopup()">Continue with Google Account</button>
      <div id="status-msg" class="status">Opening Google Account Chooser...</div>
    </div>
    <div id="step-done" class="done">
      <h1>Signed In Successfully! ✅</h1>
      <p>Your Google account and cloud workspace are now synced with FocusPulse Desktop. You can return to the FocusPulse app window now (or close this browser tab).</p>
      <button class="btn" onclick="window.close()">Return to FocusPulse App</button>
    </div>
  </div>
  <script type="module">
    import {{ initializeApp }} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
    import {{ getAuth, signInWithPopup, GoogleAuthProvider }} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
    const cfg = {cfg_json};
    const app = initializeApp(cfg);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({{ prompt: 'select_account' }});

    window.runGooglePopup = async () => {{
      const st = document.getElementById('status-msg');
      st.textContent = 'Waiting for Google Account selection...';
      try {{
        const res = await signInWithPopup(auth, provider);
        const cred = GoogleAuthProvider.credentialFromResult(res);
        const u = res.user;
        const payload = {{
          uid: u.uid,
          email: u.email || '',
          displayName: u.displayName || '',
          photoURL: u.photoURL || '',
          idToken: cred ? (cred.idToken || '') : '',
          accessToken: cred ? (cred.accessToken || '') : ''
        }};
        await fetch('/callback', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify(payload)
        }});
        document.getElementById('step-login').style.display = 'none';
        document.getElementById('step-done').style.display = 'block';
      }} catch (err) {{
        st.textContent = 'Click "Continue with Google Account" above to select your account (' + (err.code || err.message) + ').';
      }}
    }};
    setTimeout(() => window.runGooglePopup(), 250);
  </script>
</body>
</html>"#
                        );
                        let resp = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                            page.len(),
                            page
                        );
                        let _ = stream.write_all(resp.as_bytes());
                        let _ = stream.flush();
                    } else if first_line.starts_with("POST /callback") {
                        let body = if let Some(idx) = req.find("\r\n\r\n") {
                            req[idx + 4..].to_string()
                        } else {
                            "{}".to_string()
                        };
                        let ok_resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: 11\r\nConnection: close\r\n\r\n{\"ok\":true}";
                        let _ = stream.write_all(ok_resp.as_bytes());
                        let _ = stream.flush();
                        show_main_window(&app_clone);
                        let _ = app_clone.emit("fp_external_google_auth", body);
                        break;
                    } else {
                        let resp = "HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n";
                        let _ = stream.write_all(resp.as_bytes());
                    }
                }
            }
        });

        let _ = open_url_in_default_browser(&auth_url);
        return Ok(port);
    }
    #[cfg(mobile)]
    {
        let _ = (app, firebase_config_json);
        Err("Use mobile Google account chooser on Android".to_string())
    }
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
                        "/f",
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
                        "/f",
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
fn setup_single_instance_wakeup_listener(app: &AppHandle) {
    use std::io::Read;
    use std::net::TcpListener;

    let lock_path = std::env::temp_dir().join("focuspulse_single_instance.lock");
    let _ = std::fs::write(&lock_path, format!("{}\n", std::process::id()));

    if let Ok(listener) = TcpListener::bind("127.0.0.1:45892") {
        let app_handle = app.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let mut s = stream;
                let mut buf = [0u8; 64];
                let _ = s.read(&mut buf);
                show_main_window(&app_handle);
            }
        });
    }

    // Fallback file signal watcher
    let app_handle_poll = app.clone();
    std::thread::spawn(move || {
        let wakeup_path = std::env::temp_dir().join("focuspulse_wakeup.signal");
        loop {
            std::thread::sleep(std::time::Duration::from_millis(400));
            if wakeup_path.exists() {
                let _ = std::fs::remove_file(&wakeup_path);
                show_main_window(&app_handle_poll);
            }
        }
    });
}

#[cfg(desktop)]
fn check_existing_tray_instance_and_wakeup() -> bool {
    use std::io::Write;
    use std::net::{SocketAddr, TcpStream};
    use std::time::Duration;

    let addr: SocketAddr = "127.0.0.1:45892".parse().unwrap();
    if let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(350)) {
        let _ = stream.write_all(b"SHOW_WINDOW\n");
        let _ = stream.flush();
        return true;
    }

    let lock_path = std::env::temp_dir().join("focuspulse_single_instance.lock");
    if lock_path.exists() {
        let wakeup_path = std::env::temp_dir().join("focuspulse_wakeup.signal");
        let _ = std::fs::write(&wakeup_path, format!("{}\n", std::process::id()));
        std::thread::sleep(Duration::from_millis(150));
        return true;
    }

    false
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
    #[cfg(desktop)]
    {
        // If FocusPulse is already running hidden in the system tray, wake and focus the existing window
        if check_existing_tray_instance_and_wakeup() {
            return;
        }
    }

    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            {
                setup_single_instance_wakeup_listener(app.handle());
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
            open_external_url,
            start_external_google_auth
        ])
        .run(tauri::generate_context!())
        .expect("error while running FocusPulse Tauri application");
}
