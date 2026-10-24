use std::sync::Arc;

use chrono::{Local, TimeZone};
use tokscale_core::pricing::cache::get_cache_path;
use tokscale_core::pricing::PricingService;
use tokscale_core::{LocalParseOptions, UnifiedMessage};

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

fn to_usage_message(
    message: UnifiedMessage,
    price_detector: &mut PriceDetector,
) -> Option<UsageDataMessage> {
    if message.timestamp <= 0 {
        return None;
    }
    let date = Local.timestamp_millis_opt(message.timestamp).single()?;
    let costs = price_detector.get_costs(&message);

    let project = match (message.workspace_label, message.workspace_key) {
        (None, None) => None,
        (name, path) => Some(UsageDataProject { name, path }),
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

    let messages = if fresh {
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
    Ok(messages
        .into_iter()
        .filter_map(|message| to_usage_message(message, &mut price_detector))
        .collect())
}
