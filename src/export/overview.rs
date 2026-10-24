use std::collections::{BTreeMap, HashMap, HashSet};

use chrono::{DateTime, Datelike, Duration, Local, Months, NaiveDate};

use crate::core::types::UsageDataMessage;
use crate::helpers::model_groups::{apply_model_groups, load_model_groups, ResolvedModelGroups};
use crate::render::color_generator::ColorGenerator;
use crate::render::types::RenderValueShowBy;
use crate::render::utils::format_date_key;

pub struct OverviewRankItem {
    pub name: String,
    pub value: f64,
    pub color: String,
}

pub struct OverviewDailyPoint {
    pub label: String,
    pub total: f64,
    pub cost: f64,
}

pub struct OverviewSummary {
    pub data_start: Option<DateTime<Local>>,
    pub data_end: Option<DateTime<Local>>,
    pub total_tokens: f64,
    pub total_cost: f64,
    pub total_messages: usize,
    pub active_days: usize,
    pub top_model: String,
    pub top_source: String,
    pub daily: Vec<OverviewDailyPoint>,
    pub composition: Vec<OverviewRankItem>,
    pub models: Vec<OverviewRankItem>,
    pub sources: Vec<OverviewRankItem>,
    pub providers: Vec<OverviewRankItem>,
    pub projects: Vec<OverviewRankItem>,
    pub agents: Vec<OverviewRankItem>,
}

pub struct OverviewOptions {
    pub usage_by: RenderValueShowBy,
    pub projects: usize,
    pub group_models: bool,
    pub auto_group_models: bool,
}

struct TotalsMap {
    order: Vec<String>,
    values: HashMap<String, f64>,
}

impl TotalsMap {
    fn new() -> Self {
        Self {
            order: Vec::new(),
            values: HashMap::new(),
        }
    }

    fn add(&mut self, id: &str, value: f64) {
        match self.values.get_mut(id) {
            Some(total) => *total += value,
            None => {
                self.order.push(id.to_string());
                self.values.insert(id.to_string(), value);
            }
        }
    }
}

pub fn compute_overview(
    messages: &[&UsageDataMessage],
    options: &OverviewOptions,
) -> Result<OverviewSummary, String> {
    if messages.is_empty() {
        return Err("No data to export.".to_string());
    }

    let model_groups = if options.group_models {
        load_model_groups(options.auto_group_models)
    } else {
        ResolvedModelGroups {
            groups: HashMap::new(),
            non_free_ids: HashSet::new(),
        }
    };

    let usage_by = options.usage_by;
    let mut daily: BTreeMap<String, OverviewDailyPoint> = BTreeMap::new();
    let mut token_input = 0.0;
    let mut token_output = 0.0;
    let mut token_reasoning = 0.0;
    let mut token_cache = 0.0;
    let mut model_totals = TotalsMap::new();
    let mut source_totals = TotalsMap::new();
    let mut provider_totals = TotalsMap::new();
    let mut project_totals = TotalsMap::new();
    let mut agent_totals = TotalsMap::new();
    let mut total_cost = 0.0;
    let mut data_start: Option<DateTime<Local>> = None;
    let mut data_end: Option<DateTime<Local>> = None;

    for message in messages {
        if data_start.is_none_or(|start| message.date < start) {
            data_start = Some(message.date);
        }
        if data_end.is_none_or(|end| message.date > end) {
            data_end = Some(message.date);
        }

        let tokens = &message.tokens;
        let input = tokens.input as f64;
        let output = tokens.output as f64;
        let reasoning = tokens.reasoning as f64;
        let cache = (tokens.cache_input + tokens.cache_output) as f64;
        let all = input + output + reasoning + cache;

        let grouped_model = apply_model_groups(&model_groups, &message.model);

        let cost = message.costs.total();
        total_cost += cost;

        let key = format_date_key(message.date.date_naive(), usage_by);
        let point = daily
            .entry(key.clone())
            .or_insert_with(|| OverviewDailyPoint {
                label: format_usage_label(&key, usage_by),
                total: 0.0,
                cost: 0.0,
            });
        point.total += all;
        point.cost += cost;

        token_input += input;
        token_output += output;
        token_reasoning += reasoning;
        token_cache += cache;

        model_totals.add(&grouped_model.id, all);
        source_totals.add(&message.source, all);
        provider_totals.add(&message.model.provider, all);
        agent_totals.add(&message.agent, all);

        if let Some(name) = message
            .project
            .as_ref()
            .and_then(|project| project.name.as_deref())
            .filter(|name| !name.is_empty())
        {
            project_totals.add(name, all);
        }
    }

    let active_days = daily.len();
    if let (Some(start), Some(end)) = (data_start, data_end) {
        fill_usage_periods(&mut daily, start.date_naive(), end.date_naive(), usage_by);
    }

    let models = to_rank_items(model_totals, 7);
    let sources = to_rank_items(source_totals, 7);
    let providers = to_rank_items(provider_totals, 7);
    let projects = to_rank_items(project_totals, options.projects);
    let agents = to_rank_items(agent_totals, 7);

    Ok(OverviewSummary {
        data_start,
        data_end,
        total_tokens: token_input + token_output + token_reasoning + token_cache,
        total_cost,
        total_messages: messages.len(),
        active_days,
        top_model: models
            .first()
            .map_or_else(|| "—".to_string(), |item| item.name.clone()),
        top_source: sources
            .first()
            .map_or_else(|| "—".to_string(), |item| item.name.clone()),
        daily: daily.into_values().collect(),
        composition: vec![
            OverviewRankItem {
                name: "Input".to_string(),
                value: token_input,
                color: "#6366f1".to_string(),
            },
            OverviewRankItem {
                name: "Output".to_string(),
                value: token_output,
                color: "#8b5cf6".to_string(),
            },
            OverviewRankItem {
                name: "Reasoning".to_string(),
                value: token_reasoning,
                color: "#f59e0b".to_string(),
            },
            OverviewRankItem {
                name: "Cache".to_string(),
                value: token_cache,
                color: "#10b981".to_string(),
            },
        ],
        models,
        sources,
        providers,
        projects,
        agents,
    })
}

fn format_usage_label(key: &str, usage_by: RenderValueShowBy) -> String {
    let parts: Vec<&str> = key.split('/').collect();
    match usage_by {
        RenderValueShowBy::Year => key.to_string(),
        RenderValueShowBy::Month => format!("{}/{}", &parts[0][2..], parts[1]),
        RenderValueShowBy::Week | RenderValueShowBy::Day => {
            format!("{}/{}", parts[1], parts[2])
        }
    }
}

fn start_usage_period(date: NaiveDate, usage_by: RenderValueShowBy) -> NaiveDate {
    match usage_by {
        RenderValueShowBy::Day => date,
        RenderValueShowBy::Week => {
            date - Duration::days(date.weekday().num_days_from_monday() as i64)
        }
        RenderValueShowBy::Month => date.with_day(1).expect("day 1 exists"),
        RenderValueShowBy::Year => {
            NaiveDate::from_ymd_opt(date.year(), 1, 1).expect("January 1 exists")
        }
    }
}

fn fill_usage_periods(
    points: &mut BTreeMap<String, OverviewDailyPoint>,
    start: NaiveDate,
    end: NaiveDate,
    usage_by: RenderValueShowBy,
) {
    let mut cursor = start_usage_period(start, usage_by);
    let last = start_usage_period(end, usage_by);

    while cursor <= last {
        let key = format_date_key(cursor, usage_by);
        points
            .entry(key.clone())
            .or_insert_with(|| OverviewDailyPoint {
                label: format_usage_label(&key, usage_by),
                total: 0.0,
                cost: 0.0,
            });

        cursor = match usage_by {
            RenderValueShowBy::Day => cursor + Duration::days(1),
            RenderValueShowBy::Week => cursor + Duration::days(7),
            RenderValueShowBy::Month => cursor + Months::new(1),
            RenderValueShowBy::Year => cursor + Months::new(12),
        };
    }
}

fn to_rank_items(totals: TotalsMap, top_count: usize) -> Vec<OverviewRankItem> {
    if top_count == 0 {
        return Vec::new();
    }

    let mut sorted: Vec<(String, f64)> = totals
        .order
        .into_iter()
        .map(|id| {
            let value = totals.values[&id];
            (id, value)
        })
        .collect();
    sorted.sort_by(|a, b| b.1.total_cmp(&a.1));

    let mut color_generator = ColorGenerator::new();
    let mut items: Vec<OverviewRankItem> = sorted
        .iter()
        .take(top_count)
        .map(|(id, value)| OverviewRankItem {
            name: id.clone(),
            value: *value,
            color: color_generator.generate(id),
        })
        .collect();

    if sorted.len() > top_count {
        let rest: f64 = sorted[top_count..].iter().map(|(_, value)| value).sum();
        items.push(OverviewRankItem {
            name: "Others".to_string(),
            value: rest,
            color: "#9ca3af".to_string(),
        });
    }

    items
}
