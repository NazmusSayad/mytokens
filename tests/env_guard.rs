mod common;

use common::EnvGuard;
use std::ffi::OsStr;

#[test]
#[serial_test::serial]
fn environment_guard_restores_values_and_absence_during_unwinding() {
    const EXISTING: &str = "TOKSCALE_INTEGRATION_ENV_EXISTING";
    const ABSENT: &str = "TOKSCALE_INTEGRATION_ENV_ABSENT";
    let _outer = EnvGuard::capture(&[EXISTING, ABSENT]);
    std::env::set_var(EXISTING, "original");
    std::env::remove_var(ABSENT);

    let outcome = std::panic::catch_unwind(|| {
        let _inner = EnvGuard::set(&[
            (EXISTING, OsStr::new("redirected")),
            (ABSENT, OsStr::new("temporary")),
        ]);
        assert_eq!(std::env::var(EXISTING).unwrap(), "redirected");
        assert_eq!(std::env::var(ABSENT).unwrap(), "temporary");
        panic!("simulate a failing test assertion");
    });

    assert!(outcome.is_err());
    assert_eq!(
        std::env::var_os(EXISTING).as_deref(),
        Some(OsStr::new("original"))
    );
    assert!(std::env::var_os(ABSENT).is_none());
}
