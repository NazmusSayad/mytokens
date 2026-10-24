use chrono::{Datelike, Duration, NaiveDate};

use super::types::{RenderValueShowBy, RenderValueUnit};

pub fn format_date_key(date: NaiveDate, show_by: RenderValueShowBy) -> String {
    match show_by {
        RenderValueShowBy::Year => format!("{}", date.year()),
        RenderValueShowBy::Month => format!("{}/{:02}", date.year(), date.month()),
        RenderValueShowBy::Week => {
            let monday = date - Duration::days(date.weekday().num_days_from_monday() as i64);
            format!(
                "{}/{:02}/{:02}",
                monday.year(),
                monday.month(),
                monday.day()
            )
        }
        RenderValueShowBy::Day => {
            format!("{}/{:02}/{:02}", date.year(), date.month(), date.day())
        }
    }
}

pub fn get_date_label_width(show_by: RenderValueShowBy) -> usize {
    match show_by {
        RenderValueShowBy::Year => 4,
        RenderValueShowBy::Month => 7,
        RenderValueShowBy::Week => 10,
        RenderValueShowBy::Day => 10,
    }
}

pub fn round_to(value: f64, decimals: usize) -> f64 {
    format!("{value:.decimals$}").parse().unwrap_or(f64::NAN)
}

pub fn format_human_readable_number(n: f64, unit: RenderValueUnit) -> String {
    if n.is_nan() {
        return "N/A".to_string();
    }

    if n == 0.0 {
        return match unit {
            RenderValueUnit::Dollar => "$0".to_string(),
            RenderValueUnit::None => "0".to_string(),
        };
    }

    let abs_n = n.abs();
    let sign = if n < 0.0 { "-" } else { "" };

    if abs_n < 1000.0 {
        return match unit {
            RenderValueUnit::Dollar => {
                let decimals = if abs_n < 0.01 { 4 } else { 2 };
                format!("{sign}${}", round_to(abs_n, decimals))
            }
            RenderValueUnit::None => format!("{sign}{}", round_to(abs_n, 0)),
        };
    }

    let units = ["", "K", "M", "B", "T"];
    let magnitude = ((abs_n.log10() / 3.0).floor() as usize).min(units.len() - 1);
    let scaled = abs_n / 10f64.powi(magnitude as i32 * 3);

    let formatted = format!("{scaled:.1}");
    let formatted = formatted.strip_suffix(".0").unwrap_or(&formatted);
    let value = format!("{sign}{formatted}{}", units[magnitude]);
    match unit {
        RenderValueUnit::Dollar => format!("${value}"),
        RenderValueUnit::None => value,
    }
}

pub struct AxisLabel {
    pub text: String,
    pub pos: i64,
}

pub fn place_labels(width: usize, labels: &[AxisLabel]) -> String {
    let mut chars = vec![' '; width];
    for label in labels {
        for (i, ch) in label.text.chars().enumerate() {
            let p = label.pos + i as i64;
            if p >= 0 && (p as usize) < width {
                chars[p as usize] = ch;
            }
        }
    }
    chars.into_iter().collect()
}
