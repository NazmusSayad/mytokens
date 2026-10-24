pub fn known_llm_brand(name: &str) -> Option<String> {
    let color = match name {
        "opencode" => "#adb2be",
        "kilo" => "#f7f767",

        "pi" => "#d393be",

        "codex" => "#72317b",
        "openai" => "#72317b",
        "chatgpt" => "#72317b",

        "claude" => "#c47d5c",
        "anthropic" => "#c47d5c",
        "claude-code" => "#c47d5c",

        "gemini" => "#64a65a",

        "minimax" => "#cd4769",

        "deepseek" => "#3d41df",

        "nvidia" => "#93b648",

        "x" => "#5f98eb",
        "xai" => "#5f98eb",
        "grok" => "#5f98eb",

        _ => return None,
    };
    Some(color.to_string())
}
