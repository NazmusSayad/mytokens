use std::collections::{BTreeMap, HashMap};

use colored::Colorize;

use crate::core::types::UsageDataMessage;
use crate::export::chart::is_message_ignored;
use crate::helpers::model_groups::{apply_model_groups, load_model_groups, ResolvedModelGroups};

use super::color_generator::ColorGenerator;
use super::contrast::{bg_hex, fg_hex, foreground_for_background};
use super::stdout::print_ln;
use super::types::{RenderDataItem, RenderScreenMessage, RenderScreenOptions, RenderValueUnit};
use super::utils::{
    format_date_key, format_human_readable_number, get_date_label_width, place_labels, round_to,
    AxisLabel,
};

pub trait Screen {
    fn title(&self) -> &'static str;

    fn value_unit(&self) -> RenderValueUnit {
        RenderValueUnit::None
    }

    fn group_models(&self) -> bool {
        false
    }

    fn resolve_item(&self, item: &RenderScreenMessage, add: &mut dyn FnMut(RenderDataItem));
}

struct ItemMeta {
    name: String,
    color: Option<String>,
}

pub struct RenderScreen<'a> {
    screen: Box<dyn Screen>,
    data: &'a [UsageDataMessage],
    options: &'a RenderScreenOptions,
    color_generator: ColorGenerator,
    model_groups: Option<ResolvedModelGroups>,
}

impl<'a> RenderScreen<'a> {
    pub fn new(
        screen: Box<dyn Screen>,
        data: &'a [UsageDataMessage],
        options: &'a RenderScreenOptions,
    ) -> Self {
        Self {
            screen,
            data,
            options,
            color_generator: ColorGenerator::new(),
            model_groups: None,
        }
    }

    pub fn setup(&mut self) {
        if self.screen.group_models() && self.options.group_models {
            self.model_groups = Some(load_model_groups(self.options.auto_group_models));
        }
    }

    pub fn render(&mut self) {
        let mut resolved_data: Vec<RenderDataItem> = Vec::new();
        for message in self.data {
            if is_message_ignored(message, &self.options.filters) {
                continue;
            }

            let item = RenderScreenMessage {
                message,
                grouped_model: self
                    .model_groups
                    .as_ref()
                    .map(|groups| apply_model_groups(groups, &message.model)),
            };

            self.screen
                .resolve_item(&item, &mut |resolved| resolved_data.push(resolved));
        }

        if resolved_data.is_empty() {
            eprintln!("No data to display.");
            return;
        }

        let show_by = self.options.show_by;
        let screen_width = self.options.screen_width as i64;
        let screen_padding = self.options.screen_padding as i64;
        let value_unit = self.screen.value_unit();
        let title = self.screen.title();

        let mut grouped: BTreeMap<String, HashMap<String, f64>> = BTreeMap::new();
        let mut id_order: Vec<String> = Vec::new();
        let mut id_to_meta: HashMap<String, ItemMeta> = HashMap::new();

        for item in resolved_data {
            let key = format_date_key(item.date.date_naive(), show_by);
            *grouped
                .entry(key)
                .or_default()
                .entry(item.id.clone())
                .or_insert(0.0) += item.value;

            match id_to_meta.get_mut(&item.id) {
                Some(meta) => {
                    if meta.color.is_none() && item.color.is_some() {
                        meta.color = item.color;
                    }
                }
                None => {
                    id_order.push(item.id.clone());
                    id_to_meta.insert(
                        item.id,
                        ItemMeta {
                            name: item.name,
                            color: item.color,
                        },
                    );
                }
            }
        }

        let max_total = grouped
            .values()
            .map(|bucket| bucket.values().sum::<f64>())
            .fold(0.0, f64::max);

        if max_total == 0.0 {
            eprintln!("All values are zero.");
            return;
        }

        let date_width = get_date_label_width(show_by) as i64;
        let left_padding_chars = " ".repeat(screen_padding as usize);
        let separator_text = " │ ";
        let separator = separator_text.dimmed().to_string();

        let right_pad = 1;
        let available_width = screen_width - screen_padding * 2;
        let chart_width = 10
            .max(available_width - date_width - separator_text.chars().count() as i64 - right_pad);

        let mut id_to_total: HashMap<String, f64> = HashMap::new();
        for bucket in grouped.values() {
            for (id, value) in bucket {
                *id_to_total.entry(id.clone()).or_insert(0.0) += value;
            }
        }

        let mut ids = id_order;
        ids.sort_by(|a, b| id_to_total[b].total_cmp(&id_to_total[a]));

        let mut id_to_hex: HashMap<String, String> = HashMap::new();
        for id in &ids {
            let hex = match &id_to_meta[id].color {
                Some(color) => color.clone(),
                None => self.color_generator.generate(id),
            };
            id_to_hex.insert(id.clone(), hex);
        }

        let title_padding = 0.max((available_width - title.chars().count() as i64) / 2);

        print_ln("");
        print_ln(&format!(
            "{left_padding_chars}{}{}",
            " ".repeat(title_padding as usize),
            title.bold()
        ));
        print_ln("");

        for (key, bucket) in &grouped {
            let total: f64 = bucket.values().sum();

            let mut bar_width = ((total / max_total) * chart_width as f64).round() as i64;
            if bar_width == 0 && total > 0.0 {
                bar_width = 1;
            }

            let label = format!("{key:<width$}", width = date_width as usize);

            let segments: Vec<(&String, f64)> = ids
                .iter()
                .map(|id| (id, bucket.get(id).copied().unwrap_or(0.0)))
                .filter(|(_, value)| *value > 0.0)
                .collect();

            let widths = if segments.is_empty() {
                Vec::new()
            } else if segments.len() == 1 {
                vec![bar_width]
            } else {
                compute_segment_widths(total, &segments, bar_width)
            };

            let mut bar = String::new();
            for ((id, value), width) in segments.iter().zip(widths) {
                bar.push_str(&render_segment(&id_to_hex[*id], *value, total, width));
            }

            print_ln(&format!("{left_padding_chars}{label}{separator}{bar}"));
        }

        let corner_prefix = format!("{}└", " ".repeat(date_width as usize + 1));
        print_ln(&format!(
            "{left_padding_chars}{}",
            format!("{corner_prefix}{}", "─".repeat(chart_width as usize + 1)).dimmed()
        ));

        let labels = compute_axis_labels(max_total, chart_width, value_unit);
        let axis_labels = place_labels(chart_width as usize, &labels);
        let label_prefix = " ".repeat(date_width as usize + 2);
        print_ln(&format!("{left_padding_chars}{label_prefix}{axis_labels}"));

        print_ln("");

        let mut legend_items: Vec<(String, usize)> = ids
            .iter()
            .map(|id| {
                let name = &id_to_meta[id].name;
                let value = format!(
                    "({})",
                    format_human_readable_number(round_to(id_to_total[id], 2), value_unit)
                );
                let plain_length = 2 + name.chars().count() + 1 + value.chars().count();
                (
                    format!(
                        "{} {} {}",
                        fg_hex(&id_to_hex[id], "■"),
                        name,
                        value.dimmed()
                    ),
                    plain_length,
                )
            })
            .collect();

        let grand_total: f64 = id_to_total.values().sum();
        let total_value = format!(
            "({})",
            format_human_readable_number(round_to(grand_total, 2), value_unit)
        );
        legend_items.push((
            format!("● Total {}", total_value.dimmed()),
            8 + total_value.chars().count(),
        ));

        let legend_separator = "   ";
        let mut legend_lines: Vec<(Vec<String>, i64)> = vec![(Vec::new(), 0)];

        for (item, item_length) in legend_items {
            let item_length = item_length as i64;
            let current = legend_lines.last_mut().expect("legend has a line");
            if current.1 == 0 {
                current.0.push(item);
                current.1 = item_length;
            } else if current.1 + legend_separator.len() as i64 + item_length <= available_width {
                current.0.push(item);
                current.1 += legend_separator.len() as i64 + item_length;
            } else {
                legend_lines.push((vec![item], item_length));
            }
        }

        for (line, line_length) in legend_lines {
            let legend_padding = 0.max((available_width - line_length) / 2);
            print_ln(&format!(
                "{left_padding_chars}{}{}",
                " ".repeat(legend_padding as usize),
                line.join(legend_separator)
            ));
        }
        print_ln("");
    }
}

fn render_segment(hex: &str, value: f64, total: f64, width: i64) -> String {
    let pct = format!("{}%", ((value / total) * 100.0).round());
    let pct_length = pct.chars().count() as i64;
    if width >= 10 {
        let left_pad = (width - pct_length) / 2;
        let right_pad = width - pct_length - left_pad;
        let (r, g, b) = super::contrast::parse_hex(hex);
        format!(
            "{}{}{}",
            bg_hex(hex, &" ".repeat(left_pad as usize)),
            foreground_for_background(hex, &pct).on_truecolor(r, g, b),
            bg_hex(hex, &" ".repeat(right_pad as usize))
        )
    } else {
        bg_hex(hex, &" ".repeat(width as usize)).to_string()
    }
}

fn compute_segment_widths(total: f64, segments: &[(&String, f64)], bar_width: i64) -> Vec<i64> {
    let portions: Vec<f64> = segments
        .iter()
        .map(|(_, value)| (value / total) * bar_width as f64)
        .collect();

    let mut chars: Vec<i64> = portions
        .iter()
        .map(|portion| 1.max(portion.floor() as i64))
        .collect();
    let mut allocated: i64 = chars.iter().sum();

    if allocated > bar_width {
        let scale = bar_width as f64 / allocated as f64;
        chars = chars
            .iter()
            .map(|c| 1.max((*c as f64 * scale).floor() as i64))
            .collect();
        allocated = chars.iter().sum();
    }

    let remainder = bar_width - allocated;
    let mut indexed: Vec<(usize, f64)> = portions
        .iter()
        .enumerate()
        .map(|(i, portion)| (i, portion - portion.floor()))
        .collect();
    indexed.sort_by(|a, b| b.1.total_cmp(&a.1));

    for r in 0..remainder.max(0) as usize {
        chars[indexed[r % indexed.len()].0] += 1;
    }

    chars
}

fn compute_axis_labels(max_total: f64, chart_width: i64, unit: RenderValueUnit) -> Vec<AxisLabel> {
    let mut divisions = 2.max(chart_width / 16);
    let mut labels: Vec<AxisLabel> = Vec::new();

    while divisions >= 2 {
        labels.clear();
        let mut fits = true;

        for i in 0..=divisions {
            let fraction = i as f64 / divisions as f64;
            let value = (max_total * fraction).round();
            let text = format_human_readable_number(value, unit);
            let text_length = text.chars().count() as i64;

            let pos = if i == 0 {
                1
            } else if i == divisions {
                chart_width - text_length
            } else {
                (chart_width as f64 * fraction).floor() as i64 - text_length / 2
            };

            let new_start = pos - 1;
            let new_end = pos + text_length + 1;
            let overlaps = labels.iter().any(|label| {
                let existing_start = label.pos - 1;
                let existing_end = label.pos + label.text.chars().count() as i64 + 1;
                new_start < existing_end && new_end > existing_start
            });

            if overlaps {
                fits = false;
                break;
            }

            labels.push(AxisLabel { text, pos });
        }

        if fits {
            break;
        }
        divisions -= 1;
    }

    labels
}
