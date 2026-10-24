use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};
use tokscale_core::scanner::{scan_all_clients_with_scanner_settings, ScannerSettings};
use tokscale_core::sessions::micode::parse_micode_sqlite;
use tokscale_core::{
    parse_local_clients, parse_local_unified_messages_with_pricing,
    parse_local_unified_messages_with_pricing_uncached, ClientId, LocalParseOptions,
};

const TURN: i64 = 1_780_000_000_000;

mod common;
use common::EnvGuard;

fn database(path: &Path, chronology: bool) -> Connection {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    let conn = Connection::open(path).unwrap();
    conn.execute_batch("CREATE TABLE message(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, data TEXT NOT NULL); CREATE TABLE session(id TEXT PRIMARY KEY, version TEXT, directory TEXT);").unwrap();
    if chronology {
        conn.execute_batch("ALTER TABLE session ADD COLUMN time_created INTEGER;")
            .unwrap();
    }
    conn
}
fn session(conn: &Connection, id: &str, version: &str, created: Option<i64>, chronology: bool) {
    conn.execute(
        "INSERT INTO session(id,version,directory) VALUES (?1,?2,?3)",
        params![id, version, format!("/repo/{id}")],
    )
    .unwrap();
    if chronology {
        conn.execute(
            "UPDATE session SET time_created=?1 WHERE id=?2",
            params![created, id],
        )
        .unwrap();
    }
}
fn message(
    conn: &Connection,
    row: &str,
    session: &str,
    id: Option<&str>,
    timestamp: i64,
    cost: Option<f64>,
) {
    let mut data = serde_json::json!({"role":"assistant","modelID":"mimo-test","providerID":"mimo","tokens":{"input":1000,"output":500,"cache":{"read":0,"write":0}},"time":{"created":timestamp,"completed":timestamp+500}});
    if let Some(id) = id {
        data["id"] = id.into();
    }
    if let Some(cost) = cost {
        data["cost"] = cost.into();
    }
    conn.execute(
        "INSERT INTO message VALUES (?1,?2,?3)",
        params![row, session, data.to_string()],
    )
    .unwrap();
}
fn options(home: &Path, clients: &[&str]) -> LocalParseOptions {
    LocalParseOptions {
        home_dir: Some(home.to_string_lossy().into_owned()),
        use_env_roots: false,
        clients: Some(clients.iter().map(|s| s.to_string()).collect()),
        since: None,
        until: None,
        year: None,
        scanner_settings: ScannerSettings::default(),
    }
}
fn db_path(home: &Path, name: &str) -> PathBuf {
    home.join(".local/share/mimocode").join(name)
}

#[test]
fn cross_surface_forks_keep_original_owner_and_charge_new_turns_once() {
    for desktop_original in [false, true] {
        for copy_first in [false, true] {
            let home = tempfile::tempdir().unwrap();
            let path = db_path(home.path(), "mimocode.db");
            let conn = database(&path, true);
            let (original_version, fork_version, original_client, fork_client) = if desktop_original
            {
                ("desktop-old", "1.0.0", "micode-desktop", "micode")
            } else {
                ("1.0.0", "desktop-new", "micode", "micode-desktop")
            };
            session(&conn, "original", original_version, Some(TURN - 1000), true);
            session(&conn, "fork", fork_version, Some(TURN + 1000), true);
            let (original_row, copy_row) = if copy_first { ("z", "a") } else { ("a", "z") };
            message(
                &conn,
                original_row,
                "original",
                Some("original-id"),
                TURN,
                Some(0.05),
            );
            message(
                &conn,
                copy_row,
                "fork",
                Some("fork-rewritten-id"),
                TURN,
                Some(0.05),
            );
            message(
                &conn,
                "new",
                "fork",
                Some("new-turn"),
                TURN + 2000,
                Some(0.08),
            );
            drop(conn);
            let messages = parse_micode_sqlite(&path);
            assert_eq!(messages.len(), 2);
            let original = messages.iter().find(|m| m.timestamp == TURN).unwrap();
            assert_eq!(original.client, original_client);
            assert_eq!(original.session_id, "original");
            assert_eq!(original.workspace_key.as_deref(), Some("/repo/original"));
            assert_eq!(
                messages.iter().find(|m| m.timestamp > TURN).unwrap().client,
                fork_client
            );
            assert!((messages.iter().map(|m| m.cost).sum::<f64>() - 0.13).abs() < 1e-9);
        }
    }
}

#[test]
fn independent_turns_and_unproven_copies_are_not_cross_surface_duplicates() {
    // Existing independent-id behavior remains, including legacy schemas,
    // NULL metadata, original history missing, and only one known owner.
    for (chronology, original_created, other_created) in [
        (false, None, None),
        (true, None, None),
        (true, Some(TURN - 1000), Some(TURN - 1000)),
        (true, Some(TURN + 1000), Some(TURN + 2000)),
        (true, Some(TURN - 1000), None),
    ] {
        let home = tempfile::tempdir().unwrap();
        let path = db_path(home.path(), "mimocode.db");
        let conn = database(&path, chronology);
        session(&conn, "cli", "1.0.0", original_created, chronology);
        session(&conn, "desktop", "desktop-abc", other_created, chronology);
        message(&conn, "a", "cli", Some("cli-id"), TURN, Some(0.05));
        message(&conn, "b", "desktop", Some("desktop-id"), TURN, Some(0.05));
        assert_eq!(parse_micode_sqlite(&path).len(), 2);
    }
}

#[test]
fn historical_same_surface_policy_and_missing_session_table_still_work() {
    let home = tempfile::tempdir().unwrap();
    let path = db_path(home.path(), "mimocode.db");
    let conn = database(&path, false);
    session(&conn, "original", "1.0.0", None, false);
    session(&conn, "fork", "1.0.0", None, false);
    message(
        &conn,
        "a",
        "original",
        Some("original-id"),
        TURN,
        Some(0.05),
    );
    message(&conn, "b", "fork", Some("rewritten-id"), TURN, Some(0.05));
    assert_eq!(parse_micode_sqlite(&path).len(), 1);
    conn.execute_batch("DROP TABLE session").unwrap();
    let legacy = parse_micode_sqlite(&path);
    assert_eq!(legacy.len(), 1);
    assert_eq!(legacy[0].client, "micode");
}

#[tokio::test]
#[serial_test::serial]
async fn both_lanes_choose_original_across_database_order_and_warm_cache() {
    let cache = tempfile::tempdir().unwrap();
    let _env = EnvGuard::set(&[("TOKSCALE_CONFIG_DIR", cache.path().as_os_str())]);
    for original_first in [false, true] {
        let home = tempfile::tempdir().unwrap();
        let (root_name, copy_name) = if original_first {
            ("mimocode-a.db", "mimocode-z.db")
        } else {
            ("mimocode-z.db", "mimocode-a.db")
        };
        let root = database(&db_path(home.path(), root_name), true);
        session(&root, "original", "1.0.0", Some(TURN - 1000), true);
        message(&root, "root", "original", Some("root-id"), TURN, Some(0.05));
        let fork = database(&db_path(home.path(), copy_name), true);
        session(&fork, "fork", "desktop-abc", Some(TURN + 1000), true);
        message(
            &fork,
            "copy",
            "fork",
            Some("rewritten-id"),
            TURN,
            Some(0.05),
        );
        message(
            &fork,
            "new",
            "fork",
            Some("new-id"),
            TURN + 2000,
            Some(0.08),
        );
        let another_copy = database(&db_path(home.path(), "mimocode-0.db"), true);
        session(
            &another_copy,
            "second-fork",
            "desktop-abc",
            Some(TURN + 1500),
            true,
        );
        message(
            &another_copy,
            "copy",
            "second-fork",
            Some("second-rewritten-id"),
            TURN,
            Some(0.05),
        );
        drop((root, fork, another_copy));
        for (clients, expected) in [
            (vec!["micode", "micode-desktop"], 2),
            (vec!["micode"], 1),
            (vec!["micode-desktop"], 1),
        ] {
            let local = parse_local_clients(options(home.path(), &clients)).unwrap();
            assert_eq!(local.messages.len(), expected);
            for _ in 0..2 {
                let unified =
                    parse_local_unified_messages_with_pricing(options(home.path(), &clients), None)
                        .await
                        .unwrap();
                assert_eq!(unified.len(), expected);
                assert!(
                    (unified.iter().map(|m| m.cost).sum::<f64>()
                        - local.messages.iter().map(|m| m.cost).sum::<f64>())
                    .abs()
                        < 1e-9
                );
                let expected_cli = usize::from(clients.contains(&"micode"));
                let expected_desktop = usize::from(clients.contains(&"micode-desktop"));
                assert_eq!(local.counts.get(ClientId::MiMoCode), expected_cli as i32);
                assert_eq!(
                    local.counts.get(ClientId::MiMoDesktop),
                    expected_desktop as i32
                );
            }
        }
    }
    assert!(
        cache.path().join("cache").exists(),
        "persistent calls should populate the isolated cache"
    );
}

#[tokio::test]
#[serial_test::serial]
async fn same_embedded_id_is_one_charge_and_zero_cost_provenance_survives() {
    for original_first in [false, true] {
        let home = tempfile::tempdir().unwrap();
        let (original_name, copy_name) = if original_first {
            ("mimocode-a.db", "mimocode-z.db")
        } else {
            ("mimocode-z.db", "mimocode-a.db")
        };
        for (file, session_id, version, created, cost) in [
            (original_name, "original", "desktop-abc", TURN - 1000, None),
            (copy_name, "copy", "1.0.0", TURN + 1000, Some(0.0)),
        ] {
            let conn = database(&db_path(home.path(), file), true);
            session(&conn, session_id, version, Some(created), true);
            message(&conn, "row", session_id, Some("shared-id"), TURN, cost);
        }
        for (clients, expected) in [
            (vec!["micode", "micode-desktop"], 1),
            (vec!["micode"], 0),
            (vec!["micode-desktop"], 1),
        ] {
            let local = parse_local_clients(options(home.path(), &clients)).unwrap();
            let unified = parse_local_unified_messages_with_pricing_uncached(
                options(home.path(), &clients),
                None,
            )
            .await
            .unwrap();
            assert_eq!(local.messages.len(), expected);
            assert_eq!(unified.len(), expected);
            if let Some(message) = unified.first() {
                assert_eq!(message.session_id, "original");
                assert_eq!(message.client, "micode-desktop");
                assert_eq!(message.cost, 0.0);
                assert_eq!(
                    message.cost_source,
                    tokscale_core::sessions::CostSource::ProviderReported
                );
            }
        }
    }
}

#[tokio::test]
#[serial_test::serial]
async fn different_databases_do_not_merge_same_surface_fingerprints_or_rowids() {
    let home = tempfile::tempdir().unwrap();
    for (name, created) in [
        ("mimocode-a.db", TURN - 1000),
        ("mimocode-b.db", TURN + 1000),
    ] {
        let conn = database(&db_path(home.path(), name), true);
        session(&conn, "session", "1.0.0", Some(created), true);
        message(&conn, "same-rowid", "session", None, TURN, Some(0.05));
    }
    let local = parse_local_clients(options(home.path(), &["micode"])).unwrap();
    let unified =
        parse_local_unified_messages_with_pricing_uncached(options(home.path(), &["micode"]), None)
            .await
            .unwrap();
    assert_eq!(local.messages.len(), 2);
    assert_eq!(unified.len(), 2);
}

#[tokio::test]
#[serial_test::serial]
async fn configured_shared_store_roots_reach_either_surface_recursively() {
    let home = tempfile::tempdir().unwrap();
    let extra = home.path().join("imported");
    let path = extra.join("nested/mimocode.db");
    let conn = database(&path, true);
    session(&conn, "desktop", "desktop-abc", Some(TURN - 1000), true);
    message(&conn, "row", "desktop", Some("msg"), TURN, Some(0.05));
    drop(conn);
    std::fs::write(extra.join("nested/unrelated.db"), b"not a MiMo store").unwrap();
    std::fs::write(extra.join("nested/mimocode.db-wal"), b"").unwrap();
    let mut opts = options(home.path(), &["micode-desktop"]);
    opts.scanner_settings
        .extra_scan_paths
        .insert("micode".into(), vec![extra.clone()]);
    opts.scanner_settings
        .extra_scan_paths
        .insert("micode-desktop".into(), vec![extra.join("nested")]);
    let scan = scan_all_clients_with_scanner_settings(
        home.path().to_str().unwrap(),
        &["micode-desktop".into()],
        false,
        &opts.scanner_settings,
    );
    assert_eq!(scan.micode_dbs, vec![path]);
    let local = parse_local_clients(opts.clone()).unwrap();
    let unified = parse_local_unified_messages_with_pricing_uncached(opts, None)
        .await
        .unwrap();
    assert_eq!(local.messages.len(), 1);
    assert_eq!(local.counts.get(ClientId::MiMoDesktop), 1);
    assert_eq!(unified.len(), 1);

    // The env spelling has the same sibling-root and recursive contract.
    let extra_env = format!("micode:{}", extra.display());
    let xdg = home.path().join("empty-xdg");
    let _env = EnvGuard::set(&[
        ("TOKSCALE_EXTRA_DIRS", std::ffi::OsStr::new(&extra_env)),
        ("XDG_DATA_HOME", xdg.as_os_str()),
    ]);
    let mut opts = options(home.path(), &["micode-desktop"]);
    opts.use_env_roots = true;
    assert_eq!(parse_local_clients(opts.clone()).unwrap().messages.len(), 1);
    assert_eq!(
        parse_local_unified_messages_with_pricing_uncached(opts, None)
            .await
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
#[serial_test::serial]
async fn same_id_without_chronology_has_deterministic_ownership_and_filter_parity() {
    let home = tempfile::tempdir().unwrap();
    for (name, id, version) in [
        ("mimocode-a.db", "z-cli", "1.0.0"),
        ("mimocode-b.db", "a-desktop", "desktop-abc"),
    ] {
        let conn = database(&db_path(home.path(), name), false);
        session(&conn, id, version, None, false);
        message(&conn, "row", id, Some("shared-id"), TURN, Some(0.0));
    }
    let all = parse_local_clients(options(home.path(), &["micode", "micode-desktop"])).unwrap();
    assert_eq!(all.messages.len(), 1);
    for client in ["micode", "micode-desktop"] {
        let local = parse_local_clients(options(home.path(), &[client])).unwrap();
        let unified = parse_local_unified_messages_with_pricing_uncached(
            options(home.path(), &[client]),
            None,
        )
        .await
        .unwrap();
        let expected = usize::from(all.messages[0].client == client);
        assert_eq!(local.messages.len(), expected);
        assert_eq!(unified.len(), expected);
    }
}

#[cfg(unix)]
#[test]
fn overlapping_symlink_roots_do_not_duplicate_a_shared_store() {
    let home = tempfile::tempdir().unwrap();
    let extra = home.path().join("imported");
    let path = extra.join("nested/mimocode.db");
    let conn = database(&path, false);
    drop(conn);
    let alias = home.path().join("alias");
    std::os::unix::fs::symlink(&extra, &alias).unwrap();
    let mut settings = ScannerSettings::default();
    settings
        .extra_scan_paths
        .insert("micode".into(), vec![extra]);
    settings
        .extra_scan_paths
        .insert("micode-desktop".into(), vec![alias]);
    let scan = scan_all_clients_with_scanner_settings(
        home.path().to_str().unwrap(),
        &["micode-desktop".into()],
        false,
        &settings,
    );
    assert_eq!(scan.micode_dbs.len(), 1);
    assert_eq!(
        std::fs::canonicalize(&scan.micode_dbs[0]).unwrap(),
        std::fs::canonicalize(path).unwrap()
    );
}

#[test]
fn fractional_timestamps_and_completion_presence_preserve_exact_fingerprints() {
    for desktop in [false, true] {
        let home = tempfile::tempdir().unwrap();
        let path = db_path(home.path(), "mimocode.db");
        let conn = database(&path, true);
        session(&conn, "original", "1.0.0", Some(TURN - 1000), true);
        session(
            &conn,
            "other",
            if desktop { "desktop-abc" } else { "1.0.0" },
            Some(TURN + 1000),
            true,
        );
        for (row, sid, created, completed) in [
            (
                "a",
                "original",
                TURN as f64 + 0.125,
                Some(TURN as f64 + 500.125),
            ),
            (
                "b",
                "other",
                TURN as f64 + 0.625,
                Some(TURN as f64 + 500.625),
            ),
        ] {
            let data = serde_json::json!({"id":row,"role":"assistant","modelID":"mimo-test","providerID":"mimo","cost":0.05,"tokens":{"input":1000,"output":500},"time":{"created":created,"completed":completed}});
            conn.execute(
                "INSERT INTO message VALUES (?1,?2,?3)",
                params![row, sid, data.to_string()],
            )
            .unwrap();
        }
        // Both rows normalize to identical integer timestamp/duration but are
        // not the same immutable payload, even when the other is old history.
        assert_eq!(parse_micode_sqlite(&path).len(), 2);
        conn.execute_batch("DELETE FROM message").unwrap();
        for (row, completed) in [("a", None), ("b", Some(TURN as f64))] {
            let mut data = serde_json::json!({"id":row,"role":"assistant","modelID":"mimo-test","providerID":"mimo","cost":0.05,"tokens":{"input":1000,"output":500},"time":{"created":TURN}});
            if let Some(completed) = completed {
                data["time"]["completed"] = completed.into();
            }
            conn.execute(
                "INSERT INTO message VALUES (?1,'original',?2)",
                params![row, data.to_string()],
            )
            .unwrap();
        }
        assert_eq!(
            parse_micode_sqlite(&path).len(),
            2,
            "absent completion is not a zero-duration completion"
        );
    }
}

#[tokio::test]
#[serial_test::serial]
async fn positive_cost_upgrade_reindexes_fingerprint_before_fork_matching() {
    let cache = tempfile::tempdir().unwrap();
    let _env = EnvGuard::set(&[("TOKSCALE_CONFIG_DIR", cache.path().as_os_str())]);
    for reverse in [false, true] {
        let home = tempfile::tempdir().unwrap();
        let (missing, reported) = if reverse {
            ("mimocode-z.db", "mimocode-a.db")
        } else {
            ("mimocode-a.db", "mimocode-z.db")
        };
        for (name, cost) in [(missing, None), (reported, Some(0.05))] {
            let conn = database(&db_path(home.path(), name), true);
            session(&conn, "original", "1.0.0", Some(TURN - 1000), true);
            message(&conn, "row", "original", Some("X"), TURN, cost);
        }
        let conn = database(&db_path(home.path(), "mimocode-copy.db"), true);
        session(&conn, "fork", "desktop-abc", Some(TURN + 1000), true);
        message(&conn, "row", "fork", Some("Y"), TURN, Some(0.05));
        drop(conn);
        let local =
            parse_local_clients(options(home.path(), &["micode", "micode-desktop"])).unwrap();
        assert_eq!(local.messages.len(), 1);
        assert_eq!(local.messages[0].cost, 0.05);
        for _ in 0..2 {
            let unified = parse_local_unified_messages_with_pricing(
                options(home.path(), &["micode", "micode-desktop"]),
                None,
            )
            .await
            .unwrap();
            assert_eq!(unified.len(), 1);
            assert_eq!(unified[0].client, "micode");
            assert_eq!(unified[0].cost, 0.05);
            assert_eq!(
                unified[0].cost_source,
                tokscale_core::sessions::CostSource::ProviderReported
            );
        }
    }
}

#[tokio::test]
#[serial_test::serial]
async fn absorbed_aliases_remain_available_to_other_database_copies() {
    let cache = tempfile::tempdir().unwrap();
    let _env = EnvGuard::set(&[("TOKSCALE_CONFIG_DIR", cache.path().as_os_str())]);
    for same_surface in [false, true] {
        for original_first in [false, true] {
            let home = tempfile::tempdir().unwrap();
            let (first, second) = if original_first {
                ("mimocode-a.db", "mimocode-z.db")
            } else {
                ("mimocode-z.db", "mimocode-a.db")
            };
            let conn = database(&db_path(home.path(), first), true);
            session(&conn, "original", "1.0.0", Some(TURN - 1000), true);
            let copy_version = if same_surface { "1.0.0" } else { "desktop-abc" };
            session(&conn, "fork", copy_version, Some(TURN + 1000), true);
            message(&conn, "a", "original", Some("X"), TURN, Some(0.05));
            message(&conn, "b", "fork", Some("Y"), TURN, Some(0.05));
            let copied_db = database(&db_path(home.path(), second), false);
            session(&copied_db, "fork", copy_version, None, false);
            message(&copied_db, "b", "fork", Some("Y"), TURN, Some(0.05));
            message(&copied_db, "c", "fork", Some("Z"), TURN, Some(0.05));
            drop((conn, copied_db));
            let local =
                parse_local_clients(options(home.path(), &["micode", "micode-desktop"])).unwrap();
            assert_eq!(local.messages.len(), 1);
            assert_eq!(local.messages[0].session_id, "original");
            for _ in 0..2 {
                let unified = parse_local_unified_messages_with_pricing(
                    options(home.path(), &["micode", "micode-desktop"]),
                    None,
                )
                .await
                .unwrap();
                assert_eq!(unified.len(), 1);
                assert_eq!(unified[0].session_id, "original");
                assert_eq!(unified[0].workspace_key.as_deref(), Some("/repo/original"));
                assert_eq!(unified[0].cost, 0.05);
            }
        }
    }
}

#[tokio::test]
#[serial_test::serial]
async fn upgraded_cost_cannot_invent_a_same_store_fingerprint_observation() {
    let cache = tempfile::tempdir().unwrap();
    let _env = EnvGuard::set(&[("TOKSCALE_CONFIG_DIR", cache.path().as_os_str())]);
    for union_case in [false, true] {
        let home = tempfile::tempdir().unwrap();
        if union_case {
            // X is the earliest owner; Y's cost is learned from a different
            // store before Y's observed paid copy in X's store joins the slots.
            let z = database(&db_path(home.path(), "mimocode-z.db"), true);
            session(&z, "earliest", "1.0.0", Some(TURN - 3000), true);
            session(&z, "middle", "1.0.0", Some(TURN - 2000), true);
            message(&z, "x", "earliest", Some("X"), TURN, Some(0.05));
            message(&z, "y", "middle", Some("Y"), TURN, Some(0.05));
            let b = database(&db_path(home.path(), "mimocode-b.db"), true);
            session(&b, "middle", "1.0.0", Some(TURN - 2000), true);
            message(&b, "y", "middle", Some("Y"), TURN, Some(0.05));
        } else {
            let paid = database(&db_path(home.path(), "mimocode-z.db"), true);
            session(&paid, "earliest", "1.0.0", Some(TURN - 3000), true);
            message(&paid, "x", "earliest", Some("X"), TURN, Some(0.05));
        }
        let a = database(&db_path(home.path(), "mimocode-a.db"), true);
        let (shared, session_id, created) = if union_case {
            ("Y", "middle", TURN - 2000)
        } else {
            ("X", "earliest", TURN - 3000)
        };
        session(&a, session_id, "1.0.0", Some(created), true);
        message(&a, "shared", session_id, Some(shared), TURN, None);
        session(&a, "independent", "1.0.0", Some(TURN - 1000), true);
        message(
            &a,
            "independent",
            "independent",
            Some("Z"),
            TURN,
            Some(0.05),
        );
        drop(a);
        let local = parse_local_clients(options(home.path(), &["micode"])).unwrap();
        assert_eq!(
            local.messages.len(),
            2,
            "cost known in another DB does not change the two raw fingerprints in A"
        );
        for _ in 0..2 {
            let unified =
                parse_local_unified_messages_with_pricing(options(home.path(), &["micode"]), None)
                    .await
                    .unwrap();
            assert_eq!(unified.len(), 2);
            assert!(unified.iter().any(|m| m.session_id == "independent"));
            assert!((unified.iter().map(|m| m.cost).sum::<f64>() - 0.1).abs() < 1e-9);
        }
    }
}
