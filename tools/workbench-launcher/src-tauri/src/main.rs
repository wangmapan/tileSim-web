#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{env, path::PathBuf};

fn main() {
    let arguments = env::args_os().collect::<Vec<_>>();
    if let Some(index) = arguments.iter().position(|value| value == "--self-check-file") {
        let Some(output) = arguments.get(index + 1) else {
            std::process::exit(2);
        };
        match tilesim_workbench_launcher_lib::write_self_check(&PathBuf::from(output)) {
            Ok(()) => std::process::exit(0),
            Err(_) => std::process::exit(1),
        }
    }
    tilesim_workbench_launcher_lib::run();
}
