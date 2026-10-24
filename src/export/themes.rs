use super::types::ExportTheme;

pub const EXPORT_THEMES: [ExportTheme; 10] = [
    ExportTheme {
        id: "light",
        background: "#ffffff",
        card_fill: "#f9fafb",
        border: "#e5e7eb",
        ink: "#111827",
        muted: "#6b7280",
        faint: "#9ca3af",
        accent: "#6366f1",
        accent_alt: "#10b981",
    },
    ExportTheme {
        id: "dark",
        background: "#111827",
        card_fill: "#1f2937",
        border: "#374151",
        ink: "#f9fafb",
        muted: "#d1d5db",
        faint: "#9ca3af",
        accent: "#818cf8",
        accent_alt: "#34d399",
    },
    ExportTheme {
        id: "one-dark",
        background: "#282c34",
        card_fill: "#21252b",
        border: "#3e4451",
        ink: "#abb2bf",
        muted: "#d19a66",
        faint: "#565c64",
        accent: "#61afef",
        accent_alt: "#98c379",
    },
    ExportTheme {
        id: "dracula",
        background: "#282a36",
        card_fill: "#21222c",
        border: "#44475a",
        ink: "#f8f8f2",
        muted: "#bd93f9",
        faint: "#6272a4",
        accent: "#50fa7b",
        accent_alt: "#ff79c6",
    },
    ExportTheme {
        id: "nord",
        background: "#2e3440",
        card_fill: "#3b4252",
        border: "#434c5e",
        ink: "#eceff4",
        muted: "#81a1c1",
        faint: "#4c566a",
        accent: "#88c0d0",
        accent_alt: "#a3be8c",
    },
    ExportTheme {
        id: "monokai",
        background: "#272822",
        card_fill: "#3e3d32",
        border: "#49483e",
        ink: "#f8f8f2",
        muted: "#f92672",
        faint: "#75715e",
        accent: "#66d9ef",
        accent_alt: "#a6e22e",
    },
    ExportTheme {
        id: "gruvbox",
        background: "#282828",
        card_fill: "#32302f",
        border: "#3c3836",
        ink: "#ebdbb2",
        muted: "#fe8019",
        faint: "#a89984",
        accent: "#83a598",
        accent_alt: "#b8bb26",
    },
    ExportTheme {
        id: "solarized",
        background: "#002b36",
        card_fill: "#073642",
        border: "#0e4250",
        ink: "#eee8d5",
        muted: "#268bd2",
        faint: "#586e75",
        accent: "#2aa198",
        accent_alt: "#b58900",
    },
    ExportTheme {
        id: "github",
        background: "#ffffff",
        card_fill: "#f6f8fa",
        border: "#d0d7de",
        ink: "#1f2328",
        muted: "#57606a",
        faint: "#8c959f",
        accent: "#0969da",
        accent_alt: "#1a7f37",
    },
    ExportTheme {
        id: "github-dark",
        background: "#0d1117",
        card_fill: "#161b22",
        border: "#30363d",
        ink: "#e6edf3",
        muted: "#8b949e",
        faint: "#6e7681",
        accent: "#58a6ff",
        accent_alt: "#3fb950",
    },
];

pub const DEFAULT_EXPORT_THEME: &str = "light";

pub fn get_export_theme(id: &str) -> Option<&'static ExportTheme> {
    EXPORT_THEMES.iter().find(|theme| theme.id == id)
}

pub fn export_theme_names() -> String {
    EXPORT_THEMES
        .iter()
        .map(|theme| theme.id)
        .collect::<Vec<_>>()
        .join(", ")
}
