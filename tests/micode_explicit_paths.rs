mod common;

use std::path::{Path, PathBuf};

use common::EnvGuard;
use rusqlite::{params, Connection};
use tokscale_core::scanner::{scan_all_clients_with_scanner_settings, ScannerSettings};
use tokscale_core::{
    parse_local_clients, parse_local_unified_messages_with_pricing_uncached, ClientId,
    LocalParseOptions,
};

const SURFACES: [&str; 2] = ["micode", "micode-desktop"];

fn database(path: &Path) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    let conn = Connection::open(path).unwrap();
    conn.execute_batch(
        "CREATE TABLE message(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, data TEXT NOT NULL);
         CREATE TABLE session(id TEXT PRIMARY KEY, version TEXT, directory TEXT);",
    )
    .unwrap();
    for (index, (id, version)) in [
        ("cli-session", "1.0.0"),
        ("desktop-session", "desktop-test"),
    ]
    .into_iter()
    .enumerate()
    {
        conn.execute(
            "INSERT INTO session VALUES (?1, ?2, '/repo')",
            params![id, version],
        )
        .unwrap();
        let timestamp = 1_780_000_000_000_i64 + index as i64 * 1000;
        let data = serde_json::json!({
            "id": format!("message-{index}"),
            "role": "assistant", "modelID": "mimo-test", "providerID": "mimo",
            "tokens": {"input": 1000, "output": 500, "cache": {"read": 0, "write": 0}},
            "time": {"created": timestamp, "completed": timestamp + 500},
            "cost": 0.05,
        });
        conn.execute(
            "INSERT INTO message VALUES (?1, ?2, ?3)",
            params![format!("row-{index}"), id, data.to_string()],
        )
        .unwrap();
    }
}

fn options(home: &Path, requested: &str) -> LocalParseOptions {
    LocalParseOptions {
        home_dir: Some(home.to_string_lossy().into_owned()),
        use_env_roots: false,
        clients: Some(vec![requested.to_string()]),
        since: None,
        until: None,
        year: None,
        scanner_settings: ScannerSettings::default(),
    }
}

async fn assert_both_parse_lanes(options: LocalParseOptions, requested: &str) {
    let local = parse_local_clients(options.clone()).unwrap();
    assert_eq!(local.messages.len(), 1);
    assert_eq!(local.messages[0].client, requested);
    assert_eq!(local.counts.get(ClientId::from_str(requested).unwrap()), 1);
    let unified = parse_local_unified_messages_with_pricing_uncached(options, None)
        .await
        .unwrap();
    assert_eq!(unified.len(), 1);
    assert_eq!(unified[0].client, requested);
    assert_eq!(unified[0].tokens.total(), 1500);
}

fn scan(options: &LocalParseOptions) -> Vec<PathBuf> {
    scan_all_clients_with_scanner_settings(
        options.home_dir.as_deref().unwrap(),
        options.clients.as_deref().unwrap(),
        options.use_env_roots,
        &options.scanner_settings,
    )
    .micode_dbs
}

#[tokio::test]
#[serial_test::serial]
async fn configured_renamed_file_reaches_both_parse_lanes_from_either_surface() {
    let home = common::temp_home();
    let path = home.path().join("selected/custom.db");
    database(&path);
    for configured in SURFACES {
        for requested in SURFACES {
            let mut opts = options(home.path(), requested);
            opts.scanner_settings
                .extra_scan_paths
                .insert(configured.into(), vec![path.clone()]);
            assert_eq!(scan(&opts), vec![path.clone()]);
            assert_both_parse_lanes(opts, requested).await;
        }
    }
}

#[tokio::test]
#[serial_test::serial]
async fn environment_renamed_file_reaches_both_parse_lanes_from_either_surface() {
    let home = common::temp_home();
    let path = home.path().join("selected/custom.db");
    database(&path);
    let empty_xdg = home.path().join("empty-xdg");
    for configured in SURFACES {
        let extra = format!("{configured}:{}", path.display());
        let _env = EnvGuard::set(&[
            ("TOKSCALE_EXTRA_DIRS", std::ffi::OsStr::new(&extra)),
            ("XDG_DATA_HOME", empty_xdg.as_os_str()),
        ]);
        for requested in SURFACES {
            let mut opts = options(home.path(), requested);
            opts.use_env_roots = true;
            assert_eq!(scan(&opts), vec![path.clone()]);
            assert_both_parse_lanes(opts, requested).await;
        }
        // Explicit --home still disables the environment override.
        assert!(scan(&options(home.path(), "micode")).is_empty());
    }
}

#[tokio::test]
#[serial_test::serial]
async fn recursive_roots_keep_known_names_and_ignore_unrelated_databases() {
    let home = common::temp_home();
    let directory = home.path().join("selected");
    let known = directory.join("nested/mimocode-nightly.db");
    database(&known);
    database(&directory.join("nested/custom.db"));
    for suffix in ["-wal", "-shm", "-journal"] {
        std::fs::write(directory.join(format!("nested/mimocode.db{suffix}")), b"").unwrap();
    }
    for requested in SURFACES {
        let mut opts = options(home.path(), requested);
        opts.scanner_settings
            .extra_scan_paths
            .insert("micode".into(), vec![directory.clone()]);
        assert_eq!(scan(&opts), vec![known.clone()]);
        assert_both_parse_lanes(opts, requested).await;
    }
    let extra = format!("micode-desktop:{}", directory.display());
    let empty_xdg = home.path().join("empty-xdg");
    let _env = EnvGuard::set(&[
        ("TOKSCALE_EXTRA_DIRS", std::ffi::OsStr::new(&extra)),
        ("XDG_DATA_HOME", empty_xdg.as_os_str()),
    ]);
    let mut opts = options(home.path(), "micode");
    opts.use_env_roots = true;
    assert_eq!(scan(&opts), vec![known]);
    assert_both_parse_lanes(opts, "micode").await;
}

#[test]
#[serial_test::serial]
fn explicit_files_reject_wrong_extensions_and_sqlite_sidecars() {
    let home = common::temp_home();
    let empty_xdg = home.path().join("empty-xdg");
    for filename in [
        "custom.sqlite",
        "custom.txt",
        "custom.db.bak",
        "mimocode.db-wal",
        "mimocode.db-shm",
        "mimocode.db-journal",
    ] {
        let path = home.path().join(filename);
        std::fs::write(&path, b"").unwrap();
        for configured in SURFACES {
            let mut opts = options(home.path(), "micode-desktop");
            opts.scanner_settings
                .extra_scan_paths
                .insert(configured.into(), vec![path.clone()]);
            assert!(scan(&opts).is_empty(), "accepted {filename} in settings");

            let extra = format!("{configured}:{}", path.display());
            let _env = EnvGuard::set(&[
                ("TOKSCALE_EXTRA_DIRS", std::ffi::OsStr::new(&extra)),
                ("XDG_DATA_HOME", empty_xdg.as_os_str()),
            ]);
            let mut env_opts = options(home.path(), "micode");
            env_opts.use_env_roots = true;
            assert!(scan(&env_opts).is_empty(), "accepted {filename} from env");
        }
    }
}

#[cfg(unix)]
#[tokio::test]
#[serial_test::serial]
async fn explicit_file_aliases_collapse_with_default_and_recursive_roots() {
    let home = common::temp_home();
    let directory = home.path().join(".local/share/mimocode");
    let original = directory.join("mimocode.db");
    database(&original);
    let alias = home.path().join("custom.db");
    std::os::unix::fs::symlink(&original, &alias).unwrap();
    let wrong_extension = home.path().join("alias.txt");
    std::os::unix::fs::symlink(&original, &wrong_extension).unwrap();
    let mut opts = options(home.path(), "micode-desktop");
    opts.scanner_settings.extra_scan_paths.insert(
        "micode".into(),
        vec![wrong_extension.clone(), alias.clone(), directory],
    );
    opts.scanner_settings
        .extra_scan_paths
        .insert("micode-desktop".into(), vec![original.clone(), alias]);
    let paths = scan(&opts);
    assert_eq!(paths.len(), 1);
    assert_eq!(
        std::fs::canonicalize(&paths[0]).unwrap(),
        std::fs::canonicalize(&original).unwrap()
    );
    assert_both_parse_lanes(opts, "micode-desktop").await;

    // Use a separate home so the built-in scan cannot find the target store.
    let isolated_home = common::temp_home();
    let mut alias_opts = options(isolated_home.path(), "micode-desktop");
    alias_opts.scanner_settings.extra_scan_paths.insert(
        "micode".into(),
        vec![wrong_extension.clone(), original.clone()],
    );
    assert_eq!(scan(&alias_opts), vec![original]);
    assert_both_parse_lanes(alias_opts, "micode-desktop").await;
    let mut wrong_opts = options(isolated_home.path(), "micode");
    wrong_opts
        .scanner_settings
        .extra_scan_paths
        .insert("micode-desktop".into(), vec![wrong_extension]);
    assert!(scan(&wrong_opts).is_empty());
}
