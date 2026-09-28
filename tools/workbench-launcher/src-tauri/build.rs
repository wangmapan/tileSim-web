use std::{env, path::PathBuf, process::Command};

fn find_node() -> PathBuf {
    if let Some(configured) = env::var_os("TILESIM_BUNDLED_NODE_SOURCE") {
        let path = PathBuf::from(configured);
        if path.is_file() {
            return path;
        }
        panic!("TILESIM_BUNDLED_NODE_SOURCE does not point to a file");
    }

    let output = Command::new("where.exe")
        .arg("node.exe")
        .output()
        .expect("Node.js is required to build the TileSim launcher");
    if !output.status.success() {
        panic!("Node.js is required to build the TileSim launcher");
    }
    let path = String::from_utf8_lossy(&output.stdout)
        .lines()
        .find(|line| !line.trim().is_empty())
        .map(str::trim)
        .map(PathBuf::from)
        .filter(|path| path.is_file())
        .expect("where.exe did not return a usable Node.js executable");
    path
}

fn main() {
    let node = find_node();
    println!("cargo:rerun-if-env-changed=TILESIM_BUNDLED_NODE_SOURCE");
    println!("cargo:rerun-if-changed={}", node.display());
    println!(
        "cargo:rustc-env=TILESIM_BUNDLED_NODE_SOURCE={}",
        node.display()
    );
    tauri_build::build();
}
