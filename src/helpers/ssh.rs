use std::process::{Command, Stdio};

use colored::Colorize;
use serde::Deserialize;

use crate::config::mytokens_ssh_path;
use crate::core::types::UsageDataMessage;
use crate::helpers::parser::load_usage_data;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SshDevice {
    host: String,
    user: Option<String>,
    port: Option<u16>,
    identity_file: Option<String>,
    command: Option<String>,
}

fn load_ssh_devices() -> Result<Vec<SshDevice>, String> {
    let path = mytokens_ssh_path();
    let content = match std::fs::read_to_string(&path) {
        Ok(content) => content,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(err) => return Err(format!("Failed to read {}: {err}", path.display())),
    };
    serde_json::from_str(&content).map_err(|err| format!("Invalid {}: {err}", path.display()))
}

fn fetch_device_usage_data(device: SshDevice) -> Result<Vec<UsageDataMessage>, String> {
    let mut ssh = Command::new("ssh");
    ssh.arg("-C")
        .arg("-o")
        .arg("BatchMode=yes")
        .arg("-o")
        .arg("ConnectTimeout=15");
    if let Some(user) = &device.user {
        ssh.arg("-l").arg(user);
    }
    if let Some(port) = device.port {
        ssh.arg("-p").arg(port.to_string());
    }
    if let Some(identity_file) = &device.identity_file {
        ssh.arg("-i").arg(identity_file);
    }
    let output = ssh
        .arg(&device.host)
        .arg(device.command.as_deref().unwrap_or("mytokens json"))
        .stdin(Stdio::null())
        .output()
        .map_err(|err| format!("{} failed: could not run ssh: {err}", device.host))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if error.is_empty() {
            return Err(format!("{} failed: ssh {}", device.host, output.status));
        }
        return Err(format!("{} failed: {error}", device.host));
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|err| format!("{} failed: invalid usage JSON: {err}", device.host))
}

pub async fn load_all_devices_usage_data(
    fresh: bool,
    refetch_remote: bool,
) -> Result<Vec<UsageDataMessage>, String> {
    let fetches: Vec<_> = load_ssh_devices()?
        .into_iter()
        .map(|device| tokio::task::spawn_blocking(move || fetch_device_usage_data(device)))
        .collect();

    let mut data = load_usage_data(fresh, refetch_remote).await?;
    for fetch in fetches {
        match fetch.await.map_err(|err| err.to_string())? {
            Ok(messages) => data.extend(messages),
            Err(message) => eprintln!("{}", message.yellow()),
        }
    }
    Ok(data)
}
