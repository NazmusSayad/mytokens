use chrono::{DateTime, Local};
use clap::Args;

use crate::render::types::RenderValueShowBy;

use super::args::{resolve_date_range, DateRangeOptions};

fn parse_positive_days(value: &str) -> Result<u32, String> {
    match value.parse::<u32>() {
        Ok(days) if days > 0 => Ok(days),
        _ => Err("Must be a positive number.".to_string()),
    }
}

fn parse_usage_by(value: &str) -> Result<RenderValueShowBy, String> {
    RenderValueShowBy::parse(value)
        .ok_or_else(|| "Supported usage periods: day, week, month, year.".to_string())
}

#[derive(Args, Debug, Clone)]
pub struct UsageFilterArgs {
    #[arg(
        long,
        value_name = "from",
        help = "Start date for the period. example: 2024-01-01"
    )]
    pub from: Option<String>,
    #[arg(
        long,
        value_name = "to",
        help = "End date for the period. example: 2024-12-31"
    )]
    pub to: Option<String>,
    #[arg(long, help = "Show data for today only.")]
    pub today: bool,
    #[arg(long, help = "Show data for yesterday only.")]
    pub yesterday: bool,
    #[arg(long, help = "Show data for the last 7 days.")]
    pub last_week: bool,
    #[arg(long, help = "Show data for the last 30 days.")]
    pub last_month: bool,
    #[arg(long, help = "Show data for the last 365 days.")]
    pub last_year: bool,
    #[arg(long, help = "Show data for the current week (from Sunday).")]
    pub this_week: bool,
    #[arg(long, help = "Show data for the current month.")]
    pub this_month: bool,
    #[arg(long, help = "Show data for the current year.")]
    pub this_year: bool,
    #[arg(long, value_name = "days", value_parser = parse_positive_days, help = "Show data for the last n days.")]
    pub last: Option<u32>,
    #[arg(
        long,
        value_name = "sources",
        value_delimiter = ',',
        help = "Sources to include. example: opencode,codex"
    )]
    pub sources: Option<Vec<String>>,
    #[arg(
        long,
        value_name = "sources",
        value_delimiter = ',',
        help = "Sources to exclude. example: claude"
    )]
    pub skip_sources: Option<Vec<String>>,
    #[arg(
        long,
        value_name = "agents",
        value_delimiter = ',',
        help = "Agents to include. example: agent,default"
    )]
    pub agents: Option<Vec<String>>,
    #[arg(
        long,
        value_name = "agents",
        value_delimiter = ',',
        help = "Agents to exclude. example: edit"
    )]
    pub skip_agents: Option<Vec<String>>,
    #[arg(
        long,
        value_name = "models",
        value_delimiter = ',',
        help = "Models to include. example: gpt-4o,claude-3-5-sonnet"
    )]
    pub models: Option<Vec<String>>,
    #[arg(
        long,
        value_name = "models",
        value_delimiter = ',',
        help = "Models to exclude. example: gpt-3.5-turbo"
    )]
    pub skip_models: Option<Vec<String>>,
    #[arg(
        long,
        value_name = "providers",
        value_delimiter = ',',
        help = "Providers to include. example: openai,anthropic"
    )]
    pub providers: Option<Vec<String>>,
    #[arg(
        long,
        value_name = "providers",
        value_delimiter = ',',
        help = "Providers to exclude. example: groq"
    )]
    pub skip_providers: Option<Vec<String>>,
}

#[derive(Args, Debug, Clone)]
pub struct ProjectFilterArgs {
    #[arg(
        long,
        value_name = "projects",
        value_delimiter = ',',
        help = "Projects to include. example: my-api,frontend"
    )]
    pub projects: Option<Vec<String>>,
    #[arg(
        long,
        value_name = "projects",
        value_delimiter = ',',
        help = "Projects to exclude. example: legacy-source"
    )]
    pub skip_projects: Option<Vec<String>>,
}

#[derive(Args, Debug, Clone)]
pub struct UsageByArgs {
    #[arg(long, value_name = "period", value_parser = parse_usage_by, help = "Aggregate overview usage by: day, week, month, year. Default: day.")]
    pub usage_by: Option<RenderValueShowBy>,
}

#[derive(Debug, Clone)]
pub struct UsageFilterOptions {
    pub usage_by: RenderValueShowBy,
    pub date_start: Option<DateTime<Local>>,
    pub date_end: Option<DateTime<Local>>,
    pub enabled_sources: Option<Vec<String>>,
    pub disabled_sources: Option<Vec<String>>,
    pub enabled_providers: Option<Vec<String>>,
    pub disabled_providers: Option<Vec<String>>,
    pub enabled_models: Option<Vec<String>>,
    pub disabled_models: Option<Vec<String>>,
    pub enabled_agents: Option<Vec<String>>,
    pub disabled_agents: Option<Vec<String>>,
    pub enabled_projects: Option<Vec<String>>,
    pub disabled_projects: Option<Vec<String>>,
}

pub fn build_usage_filter_options(
    args: &UsageFilterArgs,
    all: bool,
    projects: Option<&ProjectFilterArgs>,
    usage_by: Option<RenderValueShowBy>,
    default_last_days: Option<u32>,
) -> Result<UsageFilterOptions, String> {
    let (date_start, date_end) = resolve_date_range(
        &DateRangeOptions {
            all,
            from: args.from.clone(),
            to: args.to.clone(),
            today: args.today,
            yesterday: args.yesterday,
            last_week: args.last_week,
            last_month: args.last_month,
            last_year: args.last_year,
            this_week: args.this_week,
            this_month: args.this_month,
            this_year: args.this_year,
            last: args.last,
        },
        default_last_days,
    )?;

    Ok(UsageFilterOptions {
        usage_by: usage_by.unwrap_or(RenderValueShowBy::Day),
        date_start,
        date_end,
        enabled_sources: args.sources.clone(),
        disabled_sources: args.skip_sources.clone(),
        enabled_agents: args.agents.clone(),
        disabled_agents: args.skip_agents.clone(),
        enabled_models: args.models.clone(),
        disabled_models: args.skip_models.clone(),
        enabled_projects: projects.and_then(|projects| projects.projects.clone()),
        disabled_projects: projects.and_then(|projects| projects.skip_projects.clone()),
        enabled_providers: args.providers.clone(),
        disabled_providers: args.skip_providers.clone(),
    })
}
