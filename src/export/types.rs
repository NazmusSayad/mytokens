use crate::helpers::usage_options::UsageFilterOptions;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportFormat {
    Svg,
    Png,
}

impl ExportFormat {
    pub const ALL: [ExportFormat; 2] = [ExportFormat::Svg, ExportFormat::Png];

    pub fn as_str(self) -> &'static str {
        match self {
            ExportFormat::Svg => "svg",
            ExportFormat::Png => "png",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        ExportFormat::ALL
            .into_iter()
            .find(|format| format.as_str() == value)
    }
}

#[derive(Debug)]
pub struct ExportTheme {
    pub id: &'static str,
    pub background: &'static str,
    pub card_fill: &'static str,
    pub border: &'static str,
    pub ink: &'static str,
    pub muted: &'static str,
    pub faint: &'static str,
    pub accent: &'static str,
    pub accent_alt: &'static str,
}

pub struct ExportFilterOptions {
    pub filters: UsageFilterOptions,

    pub group_models: bool,
    pub auto_group_models: bool,
    pub refetch_remote: bool,
}
