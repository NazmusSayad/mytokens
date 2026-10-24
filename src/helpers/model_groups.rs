use std::collections::{HashMap, HashSet};

use crate::config::mytokens_groups_path;
use crate::core::types::UsageDataModel;

pub struct ModelGroupEntry {
    pub provider: String,
    pub model: String,
}

pub struct ResolvedModelGroups {
    pub groups: HashMap<String, ModelGroupEntry>,
    pub non_free_ids: HashSet<String>,
}

const ORG_PREFIXED_GATEWAYS: [&str; 2] = ["openrouter", "vercel"];

fn sanitize_model_groups(value: serde_json::Value) -> HashMap<String, ModelGroupEntry> {
    let mut result = HashMap::new();
    let serde_json::Value::Object(entries) = value else {
        return result;
    };

    for (key, entry) in entries {
        let provider = entry.get("provider").and_then(|value| value.as_str());
        let model = entry.get("model").and_then(|value| value.as_str());
        if let (Some(provider), Some(model)) = (provider, model) {
            result.insert(
                key,
                ModelGroupEntry {
                    provider: provider.to_string(),
                    model: model.to_string(),
                },
            );
        }
    }

    result
}

fn read_local_groups() -> HashMap<String, ModelGroupEntry> {
    let Ok(content) = std::fs::read_to_string(mytokens_groups_path()) else {
        return HashMap::new();
    };
    match serde_json::from_str(&content) {
        Ok(value) => sanitize_model_groups(value),
        Err(_) => HashMap::new(),
    }
}

fn load_non_free_ids() -> HashSet<String> {
    match tokscale_core::pricing::models_dev::load_cached_any_age() {
        Some(dataset) => dataset.into_keys().collect(),
        None => HashSet::new(),
    }
}

pub fn load_model_groups(auto: bool) -> ResolvedModelGroups {
    ResolvedModelGroups {
        groups: read_local_groups(),
        non_free_ids: if auto {
            load_non_free_ids()
        } else {
            HashSet::new()
        },
    }
}

fn has_non_free_id(resolved: &ResolvedModelGroups, provider: &str, id: &str) -> bool {
    resolved
        .non_free_ids
        .contains(&format!("{provider}/{id}").to_lowercase())
}

fn strip_free_suffix(id: &str) -> &str {
    let lower = id.to_ascii_lowercase();
    if lower.len() < 5 || !lower.ends_with("free") {
        return id;
    }
    let separator = lower.as_bytes()[lower.len() - 5];
    if matches!(separator, b'-' | b':' | b'_' | b'.' | b'/') {
        return &id[..id.len() - 5];
    }
    id
}

pub fn apply_model_groups(
    resolved: &ResolvedModelGroups,
    model: &UsageDataModel,
) -> UsageDataModel {
    if let Some(entry) = resolved.groups.get(&model.id) {
        return UsageDataModel {
            id: entry.model.clone(),
            provider: entry.provider.clone(),
        };
    }

    let non_free_id = strip_free_suffix(&model.id);
    if non_free_id != model.id && has_non_free_id(resolved, &model.provider, non_free_id) {
        return UsageDataModel {
            id: non_free_id.to_string(),
            provider: model.provider.clone(),
        };
    }

    if ORG_PREFIXED_GATEWAYS.contains(&model.provider.as_str()) {
        if let Some(slash_index) = model.id.find('/') {
            if slash_index > 0 {
                let provider = &model.id[..slash_index];
                let id = &model.id[slash_index + 1..];
                if !id.is_empty() && has_non_free_id(resolved, provider, id) {
                    return UsageDataModel {
                        id: id.to_string(),
                        provider: provider.to_string(),
                    };
                }
            }
        }
    }

    model.clone()
}
