use clap::Subcommand;
use colored::Colorize;
use tokscale_core::{
    clear_source_cache, list_source_cache_entries, source_cache_dir, source_cache_file_bytes,
};

#[derive(Subcommand, Debug, Clone)]
pub enum CacheCommand {
    #[command(about = "Delete all cached parser results.")]
    Clear,
    #[command(about = "List files currently in the parse cache.")]
    Ls,
    #[command(about = "Show parse cache size on disk.")]
    Size,
}

fn format_bytes(bytes: u64) -> String {
    if bytes >= 1024 * 1024 {
        return format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0));
    }
    if bytes >= 1024 {
        return format!("{:.1} KB", bytes as f64 / 1024.0);
    }
    format!("{bytes} B")
}

fn cache_path() -> String {
    match source_cache_dir() {
        Some(path) => path.display().to_string(),
        None => String::new(),
    }
}

pub fn run_cache_command(command: CacheCommand) {
    match command {
        CacheCommand::Clear => {
            if let Err(err) = clear_source_cache() {
                eprintln!("{}", format!("Failed to clear parse cache: {err}").red());
                std::process::exit(1);
            }
            println!("{}", "Parse cache cleared.".green());
        }
        CacheCommand::Ls => {
            let entries = list_source_cache_entries();
            if entries.is_empty() {
                println!("Parse cache is empty.");
                return;
            }

            println!(
                "{}",
                format!("{:>8}  {:>9}  PATH", "MESSAGES", "SIZE").dimmed()
            );
            for entry in &entries {
                println!(
                    "{:>8}  {:>9}  {}",
                    entry.messages,
                    format_bytes(entry.bytes),
                    entry.path.display()
                );
            }

            let messages: usize = entries.iter().map(|entry| entry.messages).sum();
            let file_bytes = source_cache_file_bytes().unwrap_or(0);
            println!(
                "{}",
                format!(
                    "\n{} files, {messages} messages, {} on disk\n{}",
                    entries.len(),
                    format_bytes(file_bytes),
                    cache_path()
                )
                .dimmed()
            );
        }
        CacheCommand::Size => {
            let Some(file_bytes) = source_cache_file_bytes() else {
                println!("No parse cache on disk yet.");
                return;
            };
            let entries = list_source_cache_entries();
            let messages: usize = entries.iter().map(|entry| entry.messages).sum();
            println!("File:     {}", format_bytes(file_bytes));
            println!("Path:     {}", cache_path());
            println!("Entries:  {} files", entries.len());
            println!("Messages: {messages}");
        }
    }
}
