use std::path::PathBuf;

pub fn mytokens_path() -> PathBuf {
    dirs::home_dir()
        .expect("Unable to resolve the home directory")
        .join(".mytokens")
}

pub fn mytokens_groups_path() -> PathBuf {
    mytokens_path().join("groups.json")
}
