#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::json;
use std::{env, fs, path::PathBuf};

fn main() {
    let arguments = env::args_os().collect::<Vec<_>>();
    if let Some(index) = arguments
        .iter()
        .position(|value| value == "--self-check-file")
    {
        let Some(output) = arguments.get(index + 1) else {
            std::process::exit(2);
        };
        let output = PathBuf::from(output);
        match tilesim_workbench_launcher_lib::write_self_check(&output) {
            Ok(()) => std::process::exit(0),
            Err(error) => {
                let failure = json!({
                    "schema_version": "tilesim.workbench_launcher_check.v2",
                    "ready": false,
                    "error": error,
                    "credentials_read": false,
                    "provider_accessed": false,
                    "port_5173_touched": false
                });
                if let Ok(serialized) = serde_json::to_string_pretty(&failure) {
                    let _ = fs::write(&output, format!("{serialized}\n"));
                }
                std::process::exit(1)
            }
        }
    }
    tilesim_workbench_launcher_lib::run();
}
