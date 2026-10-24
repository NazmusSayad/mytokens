#![allow(dead_code)] // Integration-test crates each use a different subset of these helpers.

use std::ffi::{OsStr, OsString};
use tempfile::TempDir;

pub fn temp_home() -> TempDir {
    tempfile::TempDir::new().expect("create integration-test home")
}

/// Restore process-global environment changes even when a test panics.
/// Callers must serialize tests that read or write the same environment keys.
pub struct EnvGuard(Vec<(&'static str, Option<OsString>)>);

impl EnvGuard {
    pub fn capture(keys: &[&'static str]) -> Self {
        Self(
            keys.iter()
                .map(|key| (*key, std::env::var_os(key)))
                .collect(),
        )
    }

    pub fn set(values: &[(&'static str, &OsStr)]) -> Self {
        let guard = Self::capture(&values.iter().map(|(key, _)| *key).collect::<Vec<_>>());
        for (key, value) in values {
            std::env::set_var(key, value);
        }
        guard
    }
}

impl Drop for EnvGuard {
    fn drop(&mut self) {
        for (key, previous) in self.0.drain(..).rev() {
            match previous {
                Some(value) => std::env::set_var(key, value),
                None => std::env::remove_var(key),
            }
        }
    }
}
