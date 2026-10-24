use chrono::{DateTime, Local};

use crate::core::types::{UsageDataMessage, UsageDataModel};
use crate::helpers::usage_options::UsageFilterOptions;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RenderValueUnit {
    None,
    Dollar,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RenderValueShowBy {
    Day,
    Week,
    Month,
    Year,
}

impl RenderValueShowBy {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "day" => Some(RenderValueShowBy::Day),
            "week" => Some(RenderValueShowBy::Week),
            "month" => Some(RenderValueShowBy::Month),
            "year" => Some(RenderValueShowBy::Year),
            _ => None,
        }
    }
}

pub struct RenderScreenMessage<'a> {
    pub message: &'a UsageDataMessage,
    pub grouped_model: Option<UsageDataModel>,
}

pub struct RenderDataItem {
    pub id: String,
    pub name: String,
    pub date: DateTime<Local>,
    pub value: f64,
    pub color: Option<String>,
}

pub struct RenderScreenOptions {
    pub show_by: RenderValueShowBy,

    pub screen_width: usize,
    pub screen_padding: usize,

    pub filters: UsageFilterOptions,

    pub group_models: bool,
    pub auto_group_models: bool,
    pub refetch_remote: bool,
}
