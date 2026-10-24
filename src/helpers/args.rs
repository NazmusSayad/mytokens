use std::collections::HashMap;

use chrono::{DateTime, Datelike, Duration, Local, NaiveDate, TimeZone};
use colored::Colorize;

use crate::constants::screen::AppScreenType;
use crate::render::types::RenderValueShowBy;

const SCREEN_MAP: [(AppScreenType, &[&str]); 18] = [
    (
        AppScreenType::ModelsByTokens,
        &[
            "token",
            "tokens",
            "usage",
            "usages",
            "model",
            "models",
            "model/token",
            "models/token",
            "model/tokens",
            "models/tokens",
            "model/usage",
            "models/usage",
            "model/usages",
            "models/usages",
            "model.token",
            "models.token",
        ],
    ),
    (
        AppScreenType::ModelsByCosts,
        &[
            "cost",
            "costs",
            "price",
            "prices",
            "model.",
            "models.",
            "model/",
            "models/",
            "model/cost",
            "models/cost",
            "model/costs",
            "models/costs",
            "model/price",
            "models/price",
            "model/prices",
            "models/prices",
            "model.cost",
            "models.cost",
            "model.costs",
            "models.costs",
        ],
    ),
    (
        AppScreenType::SourcesByTokens,
        &[
            "source",
            "sources",
            "source/token",
            "sources/token",
            "source/tokens",
            "sources/tokens",
            "source/usage",
            "sources/usage",
            "source/usages",
            "sources/usages",
            "source.token",
            "sources.token",
            "app",
            "apps",
            "app/token",
            "apps/token",
            "app/tokens",
            "apps/tokens",
            "app/usage",
            "apps/usage",
            "app/usages",
            "apps/usages",
            "app.token",
            "apps.token",
        ],
    ),
    (
        AppScreenType::SourcesByCosts,
        &[
            "source.",
            "sources.",
            "source/",
            "sources/",
            "source/cost",
            "sources/cost",
            "source/costs",
            "sources/costs",
            "source/price",
            "sources/price",
            "source/prices",
            "sources/prices",
            "source.cost",
            "sources.cost",
            "source.costs",
            "sources.costs",
            "app.",
            "apps.",
            "app/",
            "apps/",
            "app/cost",
            "apps/cost",
            "app/costs",
            "apps/costs",
            "app/price",
            "apps/price",
            "app/prices",
            "apps/prices",
            "app.cost",
            "apps.cost",
            "app.costs",
            "apps.costs",
        ],
    ),
    (
        AppScreenType::AgentsByTokens,
        &[
            "agent",
            "agents",
            "agent/token",
            "agents/token",
            "agent/tokens",
            "agents/tokens",
            "agent/usage",
            "agents/usage",
            "agent/usages",
            "agents/usages",
            "agent.token",
            "agents.token",
        ],
    ),
    (
        AppScreenType::AgentsByCosts,
        &[
            "agent.",
            "agents.",
            "agent/",
            "agents/",
            "agent/cost",
            "agents/cost",
            "agent/costs",
            "agents/costs",
            "agent/price",
            "agents/price",
            "agent/prices",
            "agents/prices",
            "agent.cost",
            "agents.cost",
            "agent.costs",
            "agents.costs",
        ],
    ),
    (
        AppScreenType::ProjectsByTokens,
        &[
            "project",
            "projects",
            "project/token",
            "projects/token",
            "project/tokens",
            "projects/tokens",
            "project/usage",
            "projects/usage",
            "project/usages",
            "projects/usages",
            "project.token",
            "projects.token",
        ],
    ),
    (
        AppScreenType::ProjectsByCosts,
        &[
            "project.",
            "projects.",
            "project/",
            "projects/",
            "project/cost",
            "projects/cost",
            "project/costs",
            "projects/costs",
            "project/price",
            "projects/price",
            "project/prices",
            "projects/prices",
            "project.cost",
            "projects.cost",
            "project.costs",
            "projects.costs",
        ],
    ),
    (
        AppScreenType::ProvidersByTokens,
        &[
            "provider",
            "providers",
            "provider/token",
            "providers/token",
            "provider/tokens",
            "providers/tokens",
            "provider/usage",
            "providers/usage",
            "provider/usages",
            "providers/usages",
            "provider.token",
            "providers.token",
        ],
    ),
    (
        AppScreenType::ProvidersByCosts,
        &[
            "provider.",
            "providers.",
            "provider/",
            "providers/",
            "provider/cost",
            "providers/cost",
            "provider/costs",
            "providers/costs",
            "provider/price",
            "providers/price",
            "provider/prices",
            "providers/prices",
            "provider.cost",
            "providers.cost",
            "provider.costs",
            "providers.costs",
        ],
    ),
    (
        AppScreenType::TypeByTokens,
        &[
            "type",
            "types",
            "type/token",
            "types/token",
            "type/tokens",
            "types/tokens",
            "type/usage",
            "types/usage",
            "type/usages",
            "types/usages",
            "type.token",
            "types.token",
        ],
    ),
    (
        AppScreenType::TypeByCosts,
        &[
            "type.",
            "types.",
            "type/",
            "types/",
            "type/cost",
            "types/cost",
            "type/costs",
            "types/costs",
            "type/price",
            "types/price",
            "type/prices",
            "types/prices",
            "type.cost",
            "types.cost",
            "type.costs",
            "types.costs",
        ],
    ),
    (
        AppScreenType::ModelsByRequests,
        &[
            "request",
            "requests",
            "req",
            "reqs",
            "count",
            "counts",
            "model/request",
            "models/request",
            "model/requests",
            "models/requests",
            "model/req",
            "models/req",
            "model/reqs",
            "models/reqs",
            "model/count",
            "models/count",
            "model/counts",
            "models/counts",
            "model.request",
            "models.request",
            "models.requests",
        ],
    ),
    (
        AppScreenType::SourcesByRequests,
        &[
            "source/request",
            "sources/request",
            "source/requests",
            "sources/requests",
            "source/req",
            "sources/req",
            "source/count",
            "sources/count",
            "app/request",
            "apps/request",
            "app/requests",
            "apps/requests",
        ],
    ),
    (
        AppScreenType::AgentsByRequests,
        &[
            "agent/request",
            "agents/request",
            "agent/requests",
            "agents/requests",
            "agent/req",
            "agents/req",
            "agent/count",
            "agents/count",
        ],
    ),
    (
        AppScreenType::ProjectsByRequests,
        &[
            "project/request",
            "projects/request",
            "project/requests",
            "projects/requests",
            "project/req",
            "projects/req",
            "project/count",
            "projects/count",
        ],
    ),
    (
        AppScreenType::ProvidersByRequests,
        &[
            "provider/request",
            "providers/request",
            "provider/requests",
            "providers/requests",
            "provider/req",
            "providers/req",
            "provider/count",
            "providers/count",
        ],
    ),
    (
        AppScreenType::TypeByRequests,
        &[
            "type/request",
            "types/request",
            "type/requests",
            "types/requests",
            "type/req",
            "types/req",
            "type/count",
            "types/count",
        ],
    ),
];

fn screen_keywords() -> Vec<(&'static str, AppScreenType)> {
    let mut keywords: Vec<(&'static str, AppScreenType)> = Vec::new();
    for (screen, screen_keywords) in SCREEN_MAP {
        keywords.push((screen.as_str(), screen));
        for keyword in screen_keywords {
            keywords.push((keyword, screen));
        }
    }

    let mut seen: HashMap<&str, AppScreenType> = HashMap::new();
    for (keyword, screen) in &keywords {
        if seen.insert(keyword, *screen).is_some() {
            panic!("Duplicate keyword found in ScreenMap");
        }
    }

    keywords
}

fn fuzzy_score(pattern: &str, text: &str) -> Option<f64> {
    let pattern: Vec<char> = pattern.to_lowercase().chars().collect();
    let text: Vec<char> = text.to_lowercase().chars().collect();
    let m = pattern.len();

    let mut previous: Vec<usize> = (0..=m).collect();
    let mut best: Option<f64> = None;

    for (j, text_char) in text.iter().enumerate() {
        let mut current = vec![0; m + 1];
        for i in 1..=m {
            let substitution = previous[i - 1] + usize::from(pattern[i - 1] != *text_char);
            current[i] = substitution.min(previous[i] + 1).min(current[i - 1] + 1);
        }

        let errors = current[m];
        let start = (j + 1).saturating_sub(m);
        let score = errors as f64 / m as f64 + start as f64 / 100.0;
        if score <= 0.6 && best.is_none_or(|best| score < best) {
            best = Some(score);
        }

        previous = current;
    }

    best
}

pub fn parse_screen_arg(input: &str) -> Option<AppScreenType> {
    let keywords = screen_keywords();

    if let Some((_, screen)) = keywords.iter().find(|(keyword, _)| *keyword == input) {
        return Some(*screen);
    }

    if input.is_empty() {
        return None;
    }

    let mut best: Option<(f64, AppScreenType)> = None;
    for (keyword, screen) in &keywords {
        if let Some(score) = fuzzy_score(input, keyword) {
            if best.is_none_or(|(best_score, _)| score < best_score) {
                best = Some((score, *screen));
            }
        }
    }

    let (_, screen) = best?;
    eprintln!(
        "{}",
        format!(
            "🤖 Unrecognized screen {}; rendering {} screen.",
            input.red(),
            screen.as_str().green()
        )
        .yellow()
    );

    Some(screen)
}

pub fn resolve_by(
    by: Option<&str>,
    day: bool,
    week: bool,
    month: bool,
    year: bool,
) -> Result<RenderValueShowBy, String> {
    let shorthand_options: Vec<&str> = [
        (day, "--day"),
        (week, "--week"),
        (month, "--month"),
        (year, "--year"),
    ]
    .into_iter()
    .filter(|(enabled, _)| *enabled)
    .map(|(_, name)| name)
    .collect();

    if shorthand_options.len() > 1 {
        return Err(format!(
            "Cannot use multiple shorthand options at once: {}",
            shorthand_options.join(", ")
        ));
    }

    if by.is_some() && !shorthand_options.is_empty() {
        return Err(format!("Cannot use --by with {}", shorthand_options[0]));
    }

    if day {
        return Ok(RenderValueShowBy::Day);
    }
    if week {
        return Ok(RenderValueShowBy::Week);
    }
    if month {
        return Ok(RenderValueShowBy::Month);
    }
    if year {
        return Ok(RenderValueShowBy::Year);
    }

    match by {
        Some(value) => RenderValueShowBy::parse(value).ok_or_else(|| {
            format!("Invalid --by value: {value}. possible values: day, week, month, year")
        }),
        None => Ok(RenderValueShowBy::Day),
    }
}

pub struct DateRangeOptions {
    pub all: bool,
    pub from: Option<String>,
    pub to: Option<String>,
    pub today: bool,
    pub yesterday: bool,
    pub last_week: bool,
    pub last_month: bool,
    pub last_year: bool,
    pub this_week: bool,
    pub this_month: bool,
    pub this_year: bool,
    pub last: Option<u32>,
}

fn local_midnight(date: NaiveDate) -> DateTime<Local> {
    Local
        .from_local_datetime(&date.and_hms_opt(0, 0, 0).expect("midnight is valid"))
        .earliest()
        .expect("local midnight exists")
}

fn days_back_start(now: DateTime<Local>, days: u32) -> DateTime<Local> {
    let days_back = days.saturating_sub(1) as i64;
    local_midnight(now.date_naive() - Duration::days(days_back))
}

fn parse_date(value: &str) -> Result<DateTime<Local>, String> {
    if let Ok(date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
        return Ok(local_midnight(date));
    }
    if let Ok(date) = DateTime::parse_from_rfc3339(value) {
        return Ok(date.with_timezone(&Local));
    }
    Err(format!("Invalid date: {value}. example: 2024-01-01"))
}

pub fn resolve_date_range(
    options: &DateRangeOptions,
    default_last_days: Option<u32>,
) -> Result<(Option<DateTime<Local>>, Option<DateTime<Local>>), String> {
    let shorthand_options: Vec<&str> = [
        (options.all, "--all"),
        (options.today, "--today"),
        (options.yesterday, "--yesterday"),
        (options.last_week, "--last-week"),
        (options.last_month, "--last-month"),
        (options.last_year, "--last-year"),
        (options.this_week, "--this-week"),
        (options.this_month, "--this-month"),
        (options.this_year, "--this-year"),
        (options.last.is_some(), "--last"),
    ]
    .into_iter()
    .filter(|(enabled, _)| *enabled)
    .map(|(_, name)| name)
    .collect();

    if shorthand_options.len() > 1 {
        return Err(format!(
            "Cannot use multiple shorthand options at once: {}",
            shorthand_options.join(", ")
        ));
    }

    if options.from.is_some() && !shorthand_options.is_empty() {
        return Err(format!("Cannot use --from with {}", shorthand_options[0]));
    }

    let now = Local::now();
    let today = now.date_naive();

    if options.all {
        return Ok((None, None));
    }

    if options.today {
        return Ok((
            Some(local_midnight(today)),
            Some(local_midnight(today + Duration::days(1))),
        ));
    }

    if options.yesterday {
        return Ok((
            Some(local_midnight(today - Duration::days(1))),
            Some(local_midnight(today)),
        ));
    }

    if options.last_week {
        return Ok((Some(now - Duration::days(7)), Some(now)));
    }

    if options.last_month {
        return Ok((Some(now - Duration::days(30)), Some(now)));
    }

    if options.last_year {
        return Ok((Some(now - Duration::days(365)), Some(now)));
    }

    if options.this_week {
        let days_since_sunday = today.weekday().num_days_from_sunday() as i64;
        return Ok((
            Some(local_midnight(today - Duration::days(days_since_sunday))),
            Some(now),
        ));
    }

    if options.this_month {
        return Ok((
            Some(local_midnight(today.with_day(1).expect("day 1 exists"))),
            Some(now),
        ));
    }

    if options.this_year {
        return Ok((
            Some(local_midnight(
                NaiveDate::from_ymd_opt(today.year(), 1, 1).expect("January 1 exists"),
            )),
            Some(now),
        ));
    }

    if let Some(last) = options.last {
        return Ok((Some(days_back_start(now, last)), Some(now)));
    }

    if options.from.is_some() || options.to.is_some() {
        let date_start = options.from.as_deref().map(parse_date).transpose()?;
        let date_end = options.to.as_deref().map(parse_date).transpose()?;
        return Ok((date_start, date_end));
    }

    if let Some(last_days) = default_last_days {
        return Ok((Some(days_back_start(now, last_days)), Some(now)));
    }

    Ok((None, None))
}
