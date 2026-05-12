pub mod models;
pub mod commands;
pub mod bandwidth;
pub mod server;

use tauri::Manager;
use tokio::sync::Mutex;
use std::sync::Arc;
use std::collections::{HashMap, HashSet};
use commands::TelegramState;
use commands::streaming::StreamConfig;
use rand::Rng;

fn generate_stream_token() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..16).map(|_| rng.gen()).collect();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

pub struct ActixServerHandle(pub Arc<std::sync::Mutex<Option<actix_web::dev::ServerHandle>>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Bind to an ephemeral port to avoid conflicts, falling back to 14201 if unavailable
    let stream_port = match std::net::TcpListener::bind("127.0.0.1:0") {
        Ok(listener) => listener.local_addr().unwrap().port(),
        Err(_) => 14201, 
    };

    let stream_token = generate_stream_token();
    let server_handle: Arc<std::sync::Mutex<Option<actix_web::dev::ServerHandle>>> = Arc::new(std::sync::Mutex::new(None));
    let server_handle_for_setup = server_handle.clone();

    let mut builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .plugin(tauri_plugin_window_state::Builder::default().build());
    }

    builder.setup(move |app| {
            app.manage(TelegramState {
                client: Arc::new(Mutex::new(None)),
                login_token: Arc::new(Mutex::new(None)),
                password_token: Arc::new(Mutex::new(None)),
                api_id: Arc::new(Mutex::new(None)),
                runner_shutdown: Arc::new(std::sync::Mutex::new(None)),
                runner_count: Arc::new(std::sync::atomic::AtomicU32::new(0)),
                peer_cache: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
                cancelled_transfers: Arc::new(tokio::sync::RwLock::new(HashSet::new())),
            });
            
            // Initialize state containers to prevent early access panics on the frontend
            app.manage(StreamConfig { token: stream_token.clone(), port: stream_port });
            app.manage(ActixServerHandle(server_handle_for_setup.clone()));

            // Initialize cross-platform bandwidth monitoring
            app.manage(bandwidth::BandwidthManager::new(&app.handle().clone()));
            
            // Spawn the Actix streaming server on a dedicated thread
            let state = Arc::new(app.state::<TelegramState>().inner().clone());
            let token_for_server = stream_token.clone();
            let handle_for_thread = server_handle_for_setup.clone();
            
            std::thread::spawn(move || {
                let sys = actix_rt::System::new();
                sys.block_on(async move {
                    match server::start_server(state, stream_port, token_for_server).await {
                        Ok(server) => {
                            *handle_for_thread.lock().unwrap() = Some(server.handle());
                            server.await.ok();
                        }
                        Err(e) => log::error!("Streaming server failed: {}", e),
                    }
                });
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::cmd_auth_request_code,
            commands::cmd_auth_sign_in,
            commands::cmd_auth_check_password,
            commands::cmd_get_files,
            commands::cmd_upload_file,
            commands::cmd_connect,
            commands::cmd_log,
            commands::cmd_delete_file,
            commands::cmd_download_file,
            commands::cmd_move_files,
            commands::cmd_create_folder,
            commands::cmd_delete_folder,
            commands::cmd_get_bandwidth,
            commands::cmd_get_preview,
            commands::cmd_logout,
            commands::cmd_scan_folders,
            commands::cmd_search_global,
            commands::cmd_check_connection,
            commands::cmd_is_network_available,
            commands::cmd_clean_cache,
            commands::cmd_get_thumbnail,
            commands::cmd_get_stream_info,
            commands::cmd_cancel_transfer,
            commands::cmd_auth_qr_login,
            commands::cmd_auth_qr_poll,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Trigger graceful shutdown of background runners and active transfers
                let shutdown_arc = app_handle.state::<TelegramState>().runner_shutdown.clone();
                if let Some(tx) = shutdown_arc.lock().ok().and_then(|mut g| g.take()) {
                    let _ = tx.send(());
                }

                // Halt the streaming server
                let server_arc = app_handle.state::<ActixServerHandle>().0.clone();
                if let Some(handle) = server_arc.lock().ok().and_then(|mut g| g.take()) {
                    drop(handle.stop(true));
                }
            }
        });
}