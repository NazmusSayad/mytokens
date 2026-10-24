use std::path::Path;
use tokscale_core::{
    parse_local_clients, parse_local_unified_messages_with_pricing, ClientId, LocalParseOptions,
};

mod common;
use common::EnvGuard;

fn options(home: &Path) -> LocalParseOptions {
    LocalParseOptions {
        home_dir: Some(home.to_string_lossy().into_owned()),
        use_env_roots: false,
        clients: Some(vec!["mcode".into()]),
        since: None,
        until: None,
        year: None,
        scanner_settings: Default::default(),
    }
}
fn capture(envelope: bool, turn: &str) -> String {
    let usage = serde_json::json!({"inputTokens":1000,"outputTokens":250,"cacheReadTokens":400,"cacheWriteTokens":50});
    let model = serde_json::json!({"providerId":"minimax","modelId":"MiniMax-M2.7"});
    if envelope {
        serde_json::json!({"type":"exec.completed","sessionId":"session","turnId":turn,"timestampMs":1780000000000i64,"result":{"model":model,"usage":usage}}).to_string()
    } else {
        format!(
            "{}\n{}\n",
            serde_json::json!({"type":"message","message":{"role":"assistant","turnId":turn,"timestamp":1780000000000i64,"usage":usage}}),
            serde_json::json!({"type":"exec.result","sessionId":"session","turnId":turn,"model":model})
        )
    }
}
#[tokio::test]
#[serial_test::serial]
async fn copied_mcode_captures_are_one_turn_in_both_lanes_cold_and_warm() {
    let cache = tempfile::tempdir().unwrap();
    let _env = EnvGuard::set(&[("TOKSCALE_CONFIG_DIR", cache.path().as_os_str())]);
    for envelope in [false, true] {
        let home = tempfile::tempdir().unwrap();
        let root = home.path().join(".config/tokscale/headless/mcode");
        std::fs::create_dir_all(&root).unwrap();
        let contents = capture(envelope, "turn-1");
        std::fs::write(root.join("a.jsonl"), &contents).unwrap();
        std::fs::write(root.join("b.jsonl"), &contents).unwrap();
        // Equal usage in another genuine turn must not collapse.
        std::fs::write(root.join("c.jsonl"), capture(envelope, "turn-2")).unwrap();
        let local = parse_local_clients(options(home.path())).unwrap();
        assert_eq!(local.messages.len(), 2);
        assert_eq!(local.counts.get(ClientId::Mcode), 2);
        assert_eq!(local.messages.iter().map(|m| m.input).sum::<i64>(), 2000);
        for _ in 0..2 {
            let messages = parse_local_unified_messages_with_pricing(options(home.path()), None)
                .await
                .unwrap();
            assert_eq!(messages.len(), 2);
            assert_eq!(messages.iter().map(|m| m.tokens.input).sum::<i64>(), 2000);
            assert_eq!(messages.iter().map(|m| m.tokens.output).sum::<i64>(), 500);
            assert_eq!(
                messages.iter().map(|m| m.tokens.cache_read).sum::<i64>(),
                800
            );
            assert_eq!(
                messages.iter().map(|m| m.tokens.cache_write).sum::<i64>(),
                100
            );
        }
    }
    assert!(cache.path().join("cache").exists());
}
