pub fn copy_png_to_clipboard(png: &[u8]) -> Result<(), String> {
    if !cfg!(target_os = "macos") {
        return Err("Copying images is currently supported on macOS only.".to_string());
    }

    let directory = std::env::temp_dir().join(format!("mytokens-{}", std::process::id()));
    std::fs::create_dir_all(&directory).map_err(|err| err.to_string())?;
    let image_path = directory.join("overview.png");

    let result = std::fs::write(&image_path, png)
        .map_err(|err| err.to_string())
        .and_then(|()| {
            let status = std::process::Command::new("osascript")
                .arg("-e")
                .arg(format!(
                    "set the clipboard to (read (POSIX file \"{}\") as «class PNGf»)",
                    image_path.display()
                ))
                .status()
                .map_err(|err| err.to_string())?;
            if status.success() {
                Ok(())
            } else {
                Err(format!("osascript exited with {status}"))
            }
        });

    let _ = std::fs::remove_dir_all(&directory);
    result
}
