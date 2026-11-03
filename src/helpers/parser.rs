use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::sync::Arc;

use chrono::{Local, TimeZone};
use tokscale_core::pricing::cache::get_cache_path;
use tokscale_core::pricing::PricingService;
use tokscale_core::{
    workspace_bucket, ClientId, LocalParseOptions, UnifiedMessage, WorkspaceLabeler, WorktreeRollup,
};

use crate::core::price_detector::PriceDetector;
use crate::core::types::{UsageDataMessage, UsageDataModel, UsageDataProject, UsageDataToken};

const PRICING_CACHE_FILES: [&str; 3] = [
    "pricing-litellm.json",
    "pricing-openrouter.json",
    "pricing-models-dev.json",
];

async fn load_pricing(refetch_remote: bool) -> Option<Arc<PricingService>> {
    if refetch_remote {
        for filename in PRICING_CACHE_FILES {
            match std::fs::remove_file(get_cache_path(filename)) {
                Ok(()) => {}
                Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
                Err(err) => eprintln!("Failed to remove {filename}: {err}"),
            }
        }
    }

    match PricingService::get_or_init().await {
        Ok(pricing) => Some(pricing),
        Err(_) => PricingService::load_cached_any_age().map(Arc::new),
    }
}

fn claude_project_cwd(projects_dir: &Path, slug: &str) -> Option<String> {
    let entries = std::fs::read_dir(projects_dir.join(slug)).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("jsonl") {
            continue;
        }
        let Ok(file) = std::fs::File::open(&path) else {
            continue;
        };
        for line in BufReader::new(file).lines().map_while(Result::ok) {
            if !line.contains("\"cwd\"") {
                continue;
            }
            let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) else {
                continue;
            };
            if let Some(cwd) = value.get("cwd").and_then(|cwd| cwd.as_str()) {
                return Some(cwd.to_string());
            }
        }
    }
    None
}

fn to_usage_message(
    message: UnifiedMessage,
    price_detector: &mut PriceDetector,
    labeler: &mut WorkspaceLabeler,
) -> Option<UsageDataMessage> {
    if message.timestamp <= 0 {
        return None;
    }
    let date = Local.timestamp_millis_opt(message.timestamp).single()?;
    let costs = price_detector.get_costs(&message);

    let project = match message.workspace_key {
        Some(_) => {
            let (_, path, label) =
                workspace_bucket(&message, WorktreeRollup::MergeIntoRepo, labeler);
            Some(UsageDataProject {
                name: Some(label),
                path,
            })
        }
        None => message.workspace_label.map(|name| UsageDataProject {
            name: Some(name),
            path: None,
        }),
    };

    Some(UsageDataMessage {
        source: message.client,
        agent: message.agent.unwrap_or_else(|| "default".to_string()),
        date,
        model: UsageDataModel {
            id: message.model_id,
            provider: message.provider_id,
        },
        tokens: UsageDataToken {
            input: message.tokens.input,
            output: message.tokens.output,
            reasoning: message.tokens.reasoning,
            cache_input: message.tokens.cache_read,
            cache_output: message.tokens.cache_write,
        },
        costs,
        requests: message.message_count as i64,
        project,
    })
}

pub async fn load_usage_data(
    fresh: bool,
    refetch_remote: bool,
) -> Result<Vec<UsageDataMessage>, String> {
    let pricing = load_pricing(refetch_remote).await;

    let options = LocalParseOptions {
        home_dir: None,
        use_env_roots: true,
        clients: None,
        since: None,
        until: None,
        year: None,
        scanner_settings: Default::default(),
    };

    let mut messages = if fresh {
        tokscale_core::parse_local_unified_messages_with_pricing_uncached(
            options,
            pricing.as_deref(),
        )
        .await?
    } else {
        tokscale_core::parse_local_unified_messages_with_pricing(options, pricing.as_deref())
            .await?
    };

    let mut price_detector = PriceDetector::new(pricing.as_deref());
    let mut labeler = WorkspaceLabeler::default();
    let home_dir = dirs::home_dir().ok_or("Could not determine home directory")?;
    let claude_projects_dir = ClientId::Claude
        .data()
        .resolve_path(&home_dir.to_string_lossy());
    let mut claude_cwds: HashMap<String, Option<String>> = HashMap::new();
    for message in &mut messages {
        if message.client != ClientId::Claude.as_str() {
            continue;
        }
        let Some(key) = message.workspace_key.clone() else {
            continue;
        };
        if key.contains('/') || labeler.path(&key).is_some() {
            continue;
        }
        let cwd = claude_cwds
            .entry(key.clone())
            .or_insert_with(|| claude_project_cwd(Path::new(&claude_projects_dir), &key));
        if let Some(cwd) = cwd {
            message.set_workspace(Some(cwd.clone()), None);
        }
    }
    Ok(messages
        .into_iter()
        .filter_map(|message| to_usage_message(message, &mut price_detector, &mut labeler))
        .collect())
}
