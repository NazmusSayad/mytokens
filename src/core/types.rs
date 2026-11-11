use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageDataModel {
    pub id: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageDataToken {
    pub input: i64,
    pub output: i64,
    pub reasoning: i64,
    pub cache_input: i64,
    pub cache_output: i64,
}

impl UsageDataToken {
    pub fn total(&self) -> i64 {
        self.input + self.output + self.reasoning + self.cache_input + self.cache_output
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UsageDataCost {
    pub input: f64,
    pub output: f64,
    pub reasoning: f64,
    pub cache_input: f64,
    pub cache_output: f64,
}

impl UsageDataCost {
    pub fn total(&self) -> f64 {
        self.input + self.output + self.reasoning + self.cache_input + self.cache_output
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageDataProject {
    pub name: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageDataMessage {
    #[serde(skip)]
    pub device: String,
    pub source: String,
    pub agent: String,
    pub date: DateTime<Local>,
    pub model: UsageDataModel,
    pub tokens: UsageDataToken,
    pub costs: UsageDataCost,
    pub requests: i64,
    pub project: Option<UsageDataProject>,
}
