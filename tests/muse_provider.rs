use std::collections::HashMap;

use serde_json::json;
use tokscale_core::pricing::{litellm::ModelPricing, lookup::ResolutionKind, PricingService};
use tokscale_core::sessions::{muse::parse_muse_file, UnifiedMessage};
use tokscale_core::{parse_local_unified_messages_with_pricing_uncached, LocalParseOptions};

fn metadata(provider: &str, model: Option<&str>) -> String {
    json!({
        "payload_type": "runtime.session.metadata",
        "payload": {"record": {"provider_id": provider, "model_id": model}}
    })
    .to_string()
}

fn completion(sequence: u32, model: &str) -> String {
    json!({
        "stream": {"id": "muse-provider-session"},
        "sequence": sequence,
        "recorded_at": 1789790455896395_i64,
        "payload_type": "runtime.session",
        "payload": {"kind": "run", "event": {
            "kind": "model_completed",
            "model": model,
            "usage": {
                "input_tokens": 1_000_000,
                "output_tokens": 1_000_000,
                "cached_tokens": 400_000,
                "reasoning_tokens": 250_000
            }
        }}
    })
    .to_string()
}

fn parse(lines: &[String]) -> Vec<UnifiedMessage> {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("session.jsonl");
    std::fs::write(&path, lines.join("\n")).unwrap();
    parse_muse_file(&path)
}

fn competing_pricing(model: &str) -> PricingService {
    // The Standard-model rates and competing provider roots mirror LiteLLM's
    // published muse-spark-1.2 rows. Reuse the fixture for Contributor to check
    // identity, without depending on a network pricing fetch in these tests.
    let mut rows = HashMap::new();
    rows.insert(
        format!("meta/{model}"),
        ModelPricing {
            input_cost_per_token: Some(1.25e-6),
            output_cost_per_token: Some(4.25e-6),
            cache_read_input_token_cost: Some(1.5e-7),
            ..Default::default()
        },
    );
    rows.insert(
        format!("aihubmix/{model}"),
        ModelPricing {
            input_cost_per_token: Some(1.375e-6),
            output_cost_per_token: Some(4.675e-6),
            ..Default::default()
        },
    );
    PricingService::new(rows, HashMap::new())
}

fn assert_meta_pricing(message: &UnifiedMessage, pricing: &PricingService) {
    let result = pricing
        .lookup_with_source_and_provider(&message.model_id, None, Some(&message.provider_id))
        .unwrap();
    assert_eq!(result.matched_key, format!("meta/{}", message.model_id));
    assert_eq!(result.evidence.kind, ResolutionKind::ProviderScoped);
    assert_eq!(result.evidence.candidate_count, 1);
    assert!(result.evidence.is_submission_safe());
    assert!(pricing.covers_usage_with_provider(
        &message.model_id,
        Some(&message.provider_id),
        &message.tokens,
    ));
    let cost = pricing.calculate_cost_with_provider(
        &message.model_id,
        Some(&message.provider_id),
        &message.tokens,
    );
    // 600K fresh input, 400K cached input, and 1M output including reasoning.
    assert!((cost - 5.06).abs() < 1e-10, "unexpected cost: {cost}");
}

#[test]
fn explicit_metadata_and_provider_aliases_select_submission_safe_meta_prices() {
    for model in ["muse-spark-1.2", "muse-spark-1.3-contributor"] {
        let pricing = competing_pricing(model);
        for provider in ["meta", " Meta ", "meta-llama", "meta_llama"] {
            for metadata_first in [true, false] {
                let mut lines = vec![metadata(provider, Some(model)), completion(39, model)];
                if !metadata_first {
                    lines.reverse();
                }
                let messages = parse(&lines);
                assert_eq!(messages.len(), 1);
                assert_eq!(messages[0].provider_id, provider.trim());
                assert_meta_pricing(&messages[0], &pricing);
            }
        }
    }
}

#[test]
fn missing_metadata_infers_verified_spark_family_not_the_client_name() {
    for model in ["muse-spark-1.2", "muse-spark-1.3-contributor"] {
        let messages = parse(&[completion(39, model)]);
        assert_eq!(messages[0].provider_id, "meta");
        assert_meta_pricing(&messages[0], &competing_pricing(model));
    }
    let unknown = parse(&[completion(39, "local-custom-model")]);
    assert_eq!(unknown[0].provider_id, "unknown");
    for provider in ["", "  ", "unknown", "UNKNOWN"] {
        let messages = parse(&[
            metadata(provider, Some("muse-spark-1.2")),
            completion(39, "muse-spark-1.2"),
        ]);
        assert_eq!(messages[0].provider_id, "meta");
    }
}

#[test]
fn native_client_provider_sentinel_does_not_override_meta_pricing() {
    // Official Muse 1.3.0-R3401.1 session/start with providerId omitted writes
    // this metadata even though model/list identifies the provider as Meta.
    // The usage row is synthetic; no model request is needed for this case.
    let native_metadata = r#"{"payload_type":"runtime.session.metadata","payload":{"kind":"metadata","record":{"provider_id":"muse","model_id":"muse-spark-1.2"}}}"#;
    let pricing = competing_pricing("muse-spark-1.2");
    for sentinel in ["muse", "MUSE", " Muse "] {
        let messages = parse(&[
            native_metadata.replace(
                r#""provider_id":"muse""#,
                &format!(r#""provider_id":"{sentinel}""#),
            ),
            completion(39, "muse-spark-1.2"),
        ]);
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].provider_id, "meta");
        assert_meta_pricing(&messages[0], &pricing);
    }
    let unknown_model = parse(&[
        metadata("muse", Some("local-custom-model")),
        completion(39, "local-custom-model"),
    ]);
    assert_eq!(unknown_model[0].provider_id, "unknown");
}

#[test]
fn explicit_reseller_provider_takes_precedence_over_model_family_inference() {
    let messages = parse(&[
        metadata("aihubmix", Some("muse-spark-1.2")),
        completion(39, "muse-spark-1.2"),
    ]);
    assert_eq!(messages[0].provider_id, "aihubmix");
    let result = competing_pricing("muse-spark-1.2")
        .lookup_with_source_and_provider(
            &messages[0].model_id,
            None,
            Some(&messages[0].provider_id),
        )
        .unwrap();
    assert_eq!(result.matched_key, "aihubmix/muse-spark-1.2");
}

#[test]
fn metadata_provider_does_not_leak_across_model_or_provider_switches() {
    let messages = parse(&[
        metadata("meta", Some("muse-spark-1.2")),
        completion(39, "muse-spark-1.2"),
        completion(40, "gpt-5.2"),
        metadata("aihubmix", Some("muse-spark-1.2")),
        completion(41, "muse-spark-1.2"),
        metadata("meta", Some("muse-spark-1.2")),
        completion(42, "muse-spark-1.2"),
    ]);
    let providers: Vec<&str> = messages
        .iter()
        .map(|message| message.provider_id.as_str())
        .collect();
    assert_eq!(providers, ["meta", "openai", "aihubmix", "meta"]);
}

fn provider_reset_metadata(provider: Option<serde_json::Value>, model: Option<&str>) -> String {
    let mut record = json!({"model_id": model});
    if let Some(provider) = provider {
        record["provider_id"] = provider;
    }
    json!({
        "payload_type": "runtime.session.metadata",
        "payload": {"record": record}
    })
    .to_string()
}

fn nonauthoritative_provider_values() -> Vec<Option<serde_json::Value>> {
    vec![
        Some(json!("muse")),
        Some(json!(" MuSe ")),
        Some(json!("unknown")),
        Some(json!(" UNKNOWN ")),
        Some(json!("")),
        Some(json!("  ")),
        None,
        Some(serde_json::Value::Null),
    ]
}

#[test]
fn nonauthoritative_metadata_resets_previous_provider_until_next_explicit_snapshot() {
    for (model, inferred_provider) in [
        ("muse-spark-1.2", "meta"),
        ("local-custom-model", "unknown"),
    ] {
        for reset_provider in nonauthoritative_provider_values() {
            for reset_model in [Some(model), None] {
                let reset = provider_reset_metadata(reset_provider.clone(), reset_model);
                let messages = parse(&[
                    metadata("aihubmix", Some(model)),
                    completion(39, model),
                    reset.clone(),
                    completion(40, model),
                    metadata("private-gateway", Some(model)),
                    completion(41, model),
                ]);
                let providers: Vec<&str> = messages
                    .iter()
                    .map(|message| message.provider_id.as_str())
                    .collect();
                assert_eq!(
                    providers,
                    ["aihubmix", inferred_provider, "private-gateway"],
                    "model={model}, reset={reset}"
                );
                if inferred_provider == "meta" {
                    assert_meta_pricing(&messages[1], &competing_pricing(model));
                }
            }
        }
    }
}

#[test]
fn reset_metadata_does_not_revive_an_older_model_paired_provider() {
    for reset_provider in nonauthoritative_provider_values() {
        let model = "muse-spark-1.2";
        let messages = parse(&[
            metadata("aihubmix", Some(model)),
            completion(39, model),
            provider_reset_metadata(reset_provider, Some("local-custom-model")),
            completion(40, "local-custom-model"),
            completion(41, model),
            metadata("private-gateway", Some("local-custom-model")),
            completion(42, model),
            completion(43, "local-custom-model"),
        ]);
        let providers: Vec<&str> = messages
            .iter()
            .map(|message| message.provider_id.as_str())
            .collect();
        assert_eq!(
            providers,
            ["aihubmix", "unknown", "meta", "meta", "private-gateway"]
        );
    }
}

#[test]
fn initial_delayed_nonauthoritative_metadata_blocks_later_provider_backfill() {
    for (model, inferred_provider) in [
        ("muse-spark-1.2", "meta"),
        ("local-custom-model", "unknown"),
    ] {
        for reset_provider in nonauthoritative_provider_values() {
            let reset = provider_reset_metadata(reset_provider, Some(model));
            let messages = parse(&[
                completion(39, model),
                reset.clone(),
                completion(40, model),
                metadata("aihubmix", Some(model)),
                completion(41, model),
            ]);
            let providers: Vec<&str> = messages
                .iter()
                .map(|message| message.provider_id.as_str())
                .collect();
            assert_eq!(
                providers,
                [inferred_provider, inferred_provider, "aihubmix"],
                "model={model}, reset={reset}"
            );
        }
    }
}

#[test]
fn provider_only_metadata_keeps_explicit_unknown_model_attribution() {
    let messages = parse(&[
        completion(39, "local-custom-model"),
        metadata("private-gateway", None),
    ]);
    assert_eq!(messages[0].provider_id, "private-gateway");
}

#[tokio::test]
async fn scanner_pricing_path_keeps_authoritative_provider_and_nonzero_cost() {
    let home = tempfile::tempdir().unwrap();
    let dir = home
        .path()
        .join(".local/share/muse/sessions/2026/09/18/provider-session");
    std::fs::create_dir_all(&dir).unwrap();
    let model = "muse-spark-1.2";
    std::fs::write(
        dir.join("session.jsonl"),
        [metadata("meta", Some(model)), completion(39, model)].join("\n"),
    )
    .unwrap();
    let pricing = competing_pricing(model);
    let messages = parse_local_unified_messages_with_pricing_uncached(
        LocalParseOptions {
            home_dir: Some(home.path().to_string_lossy().into_owned()),
            clients: Some(vec!["muse".to_string()]),
            ..Default::default()
        },
        Some(&pricing),
    )
    .await
    .unwrap();
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].provider_id, "meta");
    assert_meta_pricing(&messages[0], &pricing);
    assert!((messages[0].cost - 5.06).abs() < 1e-10);
}
