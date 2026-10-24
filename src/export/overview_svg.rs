use chrono::{DateTime, Local};

use crate::render::types::RenderValueUnit;
use crate::render::utils::format_human_readable_number;

use super::overview::{OverviewDailyPoint, OverviewRankItem, OverviewSummary};
use super::types::ExportTheme;

const SVG_WIDTH: f64 = 1200.0;
const PADDING_LEFT: f64 = 36.0;
const PADDING_RIGHT: f64 = 36.0;
const PADDING_TOP: f64 = 26.0;
const PADDING_BOTTOM: f64 = 28.0;
const CONTENT_X: f64 = PADDING_LEFT;
const CONTENT_WIDTH: f64 = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CARD_GAP: f64 = 16.0;
const SECTION_GAP: f64 = 34.0;
const FONT: &str =
    "'-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

struct Section {
    svg: String,
    height: f64,
}

pub fn render_overview_to_svg(model: &OverviewSummary, theme: &ExportTheme) -> String {
    let mut sections = vec![
        render_header(model, theme),
        render_stat_cards(model, theme),
        render_activity_section(&model.daily, theme),
        render_composition_section(&model.composition, theme),
        render_rankings_section(model, theme),
    ];
    if !model.projects.is_empty() {
        sections.push(render_projects_section(&model.projects, theme));
    }

    let mut y = PADDING_TOP;
    let mut body: Vec<String> = Vec::new();
    for section in sections {
        body.push(format!(
            "<g transform=\"translate(0 {y})\">\n{}\n</g>",
            section.svg
        ));
        y += section.height;
    }

    let total_height = y + PADDING_BOTTOM;
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{SVG_WIDTH}\" height=\"{total_height}\" viewBox=\"0 0 {SVG_WIDTH} {total_height}\">\n  <rect width=\"100%\" height=\"100%\" fill=\"{}\"/>\n{}\n</svg>",
        theme.background,
        body.join("\n")
    )
}

fn render_header(model: &OverviewSummary, theme: &ExportTheme) -> Section {
    Section {
        svg: format!(
            "<text x=\"{CONTENT_X}\" y=\"34\" font-size=\"26\" font-weight=\"700\" fill=\"{ink}\" font-family=\"{FONT}\">AI Coding Usage Overview</text>\n<text x=\"{right}\" y=\"34\" font-size=\"11\" fill=\"{faint}\" text-anchor=\"end\" font-family=\"{FONT}\">{range}</text>\n<line x1=\"{CONTENT_X}\" y1=\"56\" x2=\"{right}\" y2=\"56\" stroke=\"{border}\" stroke-width=\"1\"/>",
            ink = theme.ink,
            right = CONTENT_X + CONTENT_WIDTH,
            faint = theme.faint,
            range = escape_xml(&format_range(model.data_start, model.data_end)),
            border = theme.border,
        ),
        height: 80.0,
    }
}

fn format_range(data_start: Option<DateTime<Local>>, data_end: Option<DateTime<Local>>) -> String {
    match (data_start, data_end) {
        (Some(start), Some(end)) => {
            if format_date(start) == format_date(end) {
                format_date(start)
            } else {
                format!("{} - {}", format_date(start), format_date(end))
            }
        }
        (Some(start), None) => format!("From {}", format_date(start)),
        (None, Some(end)) => format!("Until {}", format_date(end)),
        (None, None) => String::new(),
    }
}

fn format_date(date: DateTime<Local>) -> String {
    date.format("%Y-%m-%d").to_string()
}

fn render_stat_cards(model: &OverviewSummary, theme: &ExportTheme) -> Section {
    let cards = [
        (
            "Total Tokens",
            format_human_readable_number(model.total_tokens, RenderValueUnit::None),
            format!("top model {}", truncate(&model.top_model, 20)),
        ),
        (
            "Est. Cost",
            format_human_readable_number(model.total_cost, RenderValueUnit::Dollar),
            "across filtered range".to_string(),
        ),
        (
            "Messages",
            format_human_readable_number(model.total_messages as f64, RenderValueUnit::None),
            "assistant messages".to_string(),
        ),
        (
            "Active Days",
            model.active_days.to_string(),
            format!("top source {}", truncate(&model.top_source, 20)),
        ),
    ];

    let card_count = cards.len() as f64;
    let card_width = (CONTENT_WIDTH - CARD_GAP * (card_count - 1.0)) / card_count;
    let card_height = 88.0;
    let mut parts: Vec<String> = Vec::new();

    for (index, (label, value, sub)) in cards.iter().enumerate() {
        let x = CONTENT_X + index as f64 * (card_width + CARD_GAP);
        parts.push(format!(
            "<rect x=\"{x}\" y=\"0\" width=\"{card_width}\" height=\"{card_height}\" rx=\"10\" fill=\"{card_fill}\"/>\n<text x=\"{tx}\" y=\"26\" font-size=\"11\" fill=\"{muted}\" font-family=\"{FONT}\">{label}</text>\n<text x=\"{tx}\" y=\"54\" font-size=\"24\" font-weight=\"700\" fill=\"{ink}\" font-family=\"{FONT}\">{value}</text>\n<text x=\"{tx}\" y=\"74\" font-size=\"10.5\" fill=\"{faint}\" font-family=\"{FONT}\">{sub}</text>",
            card_fill = theme.card_fill,
            tx = x + 16.0,
            muted = theme.muted,
            label = escape_xml(&label.to_uppercase()),
            ink = theme.ink,
            value = escape_xml(value),
            faint = theme.faint,
            sub = escape_xml(sub),
        ));
    }

    Section {
        svg: parts.join("\n"),
        height: card_height + SECTION_GAP,
    }
}

fn render_activity_section(daily: &[OverviewDailyPoint], theme: &ExportTheme) -> Section {
    Section {
        svg: format!(
            "<g transform=\"translate({CONTENT_X} 0)\">\n{}\n</g>",
            render_activity_chart(daily, theme)
        ),
        height: 264.0 + SECTION_GAP,
    }
}

fn render_activity_chart(points: &[OverviewDailyPoint], theme: &ExportTheme) -> String {
    let width = CONTENT_WIDTH;
    let height = 264.0;
    let plot_top = 44.0;
    let plot_bottom = height - 28.0;
    let plot_height = plot_bottom - plot_top;
    let plot_left = 46.0;
    let plot_right = 50.0;
    let plot_width = width - plot_left - plot_right;
    let grid_lines = 4;
    let mut parts: Vec<String> = Vec::new();

    if points.is_empty() {
        return format!(
            "<text x=\"0\" y=\"15\" font-size=\"16\" font-weight=\"700\" fill=\"{}\" font-family=\"{FONT}\">Usage Over Time</text>\n<text x=\"{plot_left}\" y=\"{}\" font-size=\"12\" fill=\"{}\" font-family=\"{FONT}\">No data</text>",
            theme.ink,
            plot_top + 24.0,
            theme.faint
        );
    }

    let tokens_max = points
        .iter()
        .fold(0.0, |max: f64, point| max.max(point.total));
    let cost_max = points
        .iter()
        .fold(0.0, |max: f64, point| max.max(point.cost));
    let tokens_y_max = if tokens_max > 0.0 {
        tokens_max * 1.08
    } else {
        1.0
    };
    let cost_y_max = if cost_max > 0.0 { cost_max * 1.08 } else { 1.0 };

    parts.push(format!("<text x=\"0\" y=\"15\" font-size=\"16\" font-weight=\"700\" fill=\"{}\" font-family=\"{FONT}\">Usage Over Time</text>", theme.ink));
    parts.push(format!(
        "<circle cx=\"150\" cy=\"10\" r=\"4\" fill=\"{}\"/>",
        theme.accent
    ));
    parts.push(format!("<text x=\"160\" y=\"14\" font-size=\"11\" fill=\"{}\" font-family=\"{FONT}\">Tokens</text>", theme.muted));
    parts.push(format!(
        "<circle cx=\"224\" cy=\"10\" r=\"4\" fill=\"{}\"/>",
        theme.accent_alt
    ));
    parts.push(format!(
        "<text x=\"234\" y=\"14\" font-size=\"11\" fill=\"{}\" font-family=\"{FONT}\">Cost</text>",
        theme.muted
    ));

    for g in 0..=grid_lines {
        let fraction = g as f64 / grid_lines as f64;
        let y = plot_bottom - fraction * plot_height;
        let tokens_label =
            format_human_readable_number((tokens_y_max * fraction).round(), RenderValueUnit::None);
        let cost_label =
            format_human_readable_number(cost_y_max * fraction, RenderValueUnit::Dollar);
        parts.push(format!(
            "<line x1=\"{plot_left}\" y1=\"{y}\" x2=\"{x2}\" y2=\"{y}\" stroke=\"{border}\" stroke-width=\"1\"/>\n<text x=\"{tx}\" y=\"{ty}\" font-size=\"10\" fill=\"{faint}\" text-anchor=\"end\" font-family=\"{FONT}\">{tokens}</text>\n<text x=\"{cx}\" y=\"{ty}\" font-size=\"10\" fill=\"{faint}\" font-family=\"{FONT}\">{cost}</text>",
            x2 = plot_left + plot_width,
            border = theme.border,
            tx = plot_left - 6.0,
            ty = y + 4.0,
            faint = theme.faint,
            tokens = escape_xml(&tokens_label),
            cx = plot_left + plot_width + 6.0,
            cost = escape_xml(&cost_label),
        ));
    }

    let point_x = |index: usize| {
        if points.len() > 1 {
            plot_left + (index as f64 / (points.len() - 1) as f64) * plot_width
        } else {
            plot_left + plot_width / 2.0
        }
    };
    let token_coords: Vec<(String, String)> = points
        .iter()
        .enumerate()
        .map(|(index, point)| {
            let y = plot_bottom - (point.total / tokens_y_max).max(0.0) * plot_height;
            (format!("{:.1}", point_x(index)), format!("{y:.1}"))
        })
        .collect();
    let cost_coords: Vec<(String, String)> = points
        .iter()
        .enumerate()
        .map(|(index, point)| {
            let y = plot_bottom - (point.cost / cost_y_max).max(0.0) * plot_height;
            (format!("{:.1}", point_x(index)), format!("{y:.1}"))
        })
        .collect();
    let token_line_points: Vec<String> = token_coords
        .iter()
        .map(|(x, y)| format!("{x},{y}"))
        .collect();
    let cost_line_points: Vec<String> = cost_coords
        .iter()
        .map(|(x, y)| format!("{x},{y}"))
        .collect();

    let first_x: f64 = token_coords[0].0.parse().expect("formatted number");
    let last_x: f64 = token_coords[token_coords.len() - 1]
        .0
        .parse()
        .expect("formatted number");

    if points.len() == 1 {
        let (token_x, token_y) = &token_coords[0];
        let (_, cost_y) = &cost_coords[0];
        parts.push(format!("<line x1=\"{token_x}\" y1=\"{token_y}\" x2=\"{token_x}\" y2=\"{plot_bottom}\" stroke=\"{}\" stroke-width=\"2\"/>", theme.accent));
        parts.push(format!(
            "<circle cx=\"{token_x}\" cy=\"{token_y}\" r=\"3.5\" fill=\"{}\"/>",
            theme.accent
        ));
        parts.push(format!(
            "<circle cx=\"{token_x}\" cy=\"{cost_y}\" r=\"3.5\" fill=\"{}\"/>",
            theme.accent_alt
        ));
    } else {
        parts.push(format!(
            "<polygon points=\"{} {last_x},{plot_bottom} {first_x},{plot_bottom}\" fill=\"{}24\"/>",
            token_line_points.join(" "),
            theme.accent
        ));
        parts.push(format!(
            "<polyline points=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"2.5\"/>",
            token_line_points.join(" "),
            theme.accent
        ));
        parts.push(format!(
            "<polyline points=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"2.5\" stroke-dasharray=\"6 4\"/>",
            cost_line_points.join(" "),
            theme.accent_alt
        ));
    }

    let longest_label = points
        .iter()
        .map(|point| point.label.chars().count())
        .max()
        .unwrap_or(0);
    let max_labels = 2.max((plot_width / (longest_label as f64 * 6.6 + 18.0)).floor() as usize);
    for index in pick_label_indexes(points.len(), max_labels) {
        let x: f64 = token_coords[index].0.parse().expect("formatted number");
        parts.push(format!(
            "<text x=\"{x}\" y=\"{}\" font-size=\"10\" fill=\"{}\" text-anchor=\"middle\" font-family=\"{FONT}\">{}</text>",
            plot_bottom + 16.0,
            theme.faint,
            escape_xml(&points[index].label)
        ));
    }

    parts.join("\n")
}

fn pick_label_indexes(count: usize, max_labels: usize) -> Vec<usize> {
    if count <= max_labels {
        return (0..count).collect();
    }
    (0..max_labels)
        .map(|i| ((i as f64 / (max_labels - 1) as f64) * (count - 1) as f64).round() as usize)
        .collect()
}

fn render_composition_section(composition: &[OverviewRankItem], theme: &ExportTheme) -> Section {
    let title_height = 30.0;
    let bar_height = 26.0;
    let legend_row_height = 24.0;
    let total: f64 = composition.iter().map(|slice| slice.value).sum();

    let mut cursor = CONTENT_X;
    let mut bar_parts: Vec<String> = Vec::new();
    for slice in composition {
        let width = if total > 0.0 {
            (slice.value / total) * CONTENT_WIDTH
        } else {
            0.0
        };
        bar_parts.push(format!(
            "<rect x=\"{cursor}\" y=\"0\" width=\"{}\" height=\"{bar_height}\" fill=\"{}\"/>",
            (width - 1.0).max(0.0),
            slice.color
        ));
        cursor += width;
    }

    let (legend_svg, legend_width) = render_legend_row(composition, 13.0, total, theme);
    let legend_rows = if legend_width > CONTENT_WIDTH {
        2.0
    } else {
        1.0
    };
    let legend_svg = if legend_rows == 1.0 {
        legend_svg
    } else {
        render_legend_wrapped(composition, total, theme)
    };

    Section {
        svg: format!(
            "<text x=\"{CONTENT_X}\" y=\"14\" font-size=\"16\" font-weight=\"700\" fill=\"{}\" font-family=\"{FONT}\">Token Composition</text>\n<g transform=\"translate(0 {title_height})\">\n{}\n</g>\n<g transform=\"translate({CONTENT_X} {})\">\n{legend_svg}\n</g>",
            theme.ink,
            bar_parts.join("\n"),
            title_height + bar_height + 8.0,
        ),
        height: title_height + bar_height + 8.0 + legend_rows * legend_row_height + SECTION_GAP,
    }
}

fn render_legend_row(
    slices: &[OverviewRankItem],
    y: f64,
    total: f64,
    theme: &ExportTheme,
) -> (String, f64) {
    let mut x = 0.0;
    let mut parts: Vec<String> = Vec::new();
    let gap = 18.0;
    for slice in slices {
        let text = format!(
            "{}  {} ({})",
            slice.name,
            format_human_readable_number(slice.value, RenderValueUnit::None),
            format_percent(slice.value, total)
        );
        let text_width = (text.chars().count() as f64 * 6.6).max(1.0);
        parts.push(format!(
            "<rect x=\"{x}\" y=\"{}\" width=\"10\" height=\"10\" rx=\"2\" fill=\"{}\"/>\n<text x=\"{}\" y=\"{y}\" font-size=\"11\" fill=\"{}\" font-family=\"{FONT}\">{}</text>",
            y - 9.0,
            slice.color,
            x + 16.0,
            theme.muted,
            escape_xml(&text)
        ));
        x += 16.0 + text_width + gap;
    }
    (parts.join("\n"), x)
}

fn render_legend_wrapped(slices: &[OverviewRankItem], total: f64, theme: &ExportTheme) -> String {
    let mid = slices.len().div_ceil(2);
    let (first, _) = render_legend_row(&slices[..mid], 13.0, total, theme);
    let (second, _) = render_legend_row(&slices[mid..], 37.0, total, theme);
    format!("{first}\n{second}")
}

fn render_rankings_section(model: &OverviewSummary, theme: &ExportTheme) -> Section {
    let cell_gap = 20.0;
    let cell_width = (CONTENT_WIDTH - cell_gap) / 2.0;
    let cell_height = 224.0;
    let row_gap = 18.0;

    let render_row = |cells: [(&str, &[OverviewRankItem]); 2]| {
        cells
            .iter()
            .enumerate()
            .map(|(index, (title, items))| {
                let translate_x = if index == 0 {
                    0.0
                } else {
                    cell_width + cell_gap
                };
                format!(
                    "<g transform=\"translate({translate_x} 0)\">\n{}\n</g>",
                    render_ranking_cell(title, items, cell_width, theme)
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    let first_row = render_row([("Models", &model.models), ("Sources", &model.sources)]);
    let second_row = render_row([("Providers", &model.providers), ("Agents", &model.agents)]);

    Section {
        svg: format!(
            "<g transform=\"translate({CONTENT_X} 0)\">\n{first_row}\n</g>\n<g transform=\"translate({CONTENT_X} {})\">\n{second_row}\n</g>",
            cell_height + row_gap
        ),
        height: cell_height * 2.0
            + row_gap
            + if model.projects.is_empty() { 0.0 } else { SECTION_GAP },
    }
}

fn render_ranking_cell(
    title: &str,
    items: &[OverviewRankItem],
    width: f64,
    theme: &ExportTheme,
) -> String {
    let cx = 92.0;
    let cy = 116.0;
    let outer = 76.0;
    let inner = 42.0;
    let mut parts: Vec<String> = vec![format!(
        "<text x=\"0\" y=\"16\" font-size=\"16\" font-weight=\"700\" fill=\"{}\" font-family=\"{FONT}\">{}</text>",
        theme.ink,
        escape_xml(title)
    )];

    if items.is_empty() {
        parts.push(format!(
            "<text x=\"{cx}\" y=\"{cy}\" font-size=\"12\" fill=\"{}\" text-anchor=\"middle\" font-family=\"{FONT}\">No data</text>",
            theme.faint
        ));
    } else {
        let total: f64 = items.iter().map(|item| item.value).sum();
        parts.push(render_donut(items, cx, cy, outer, inner));
        parts.push(format!(
            "<text x=\"{cx}\" y=\"{}\" font-size=\"16\" font-weight=\"700\" fill=\"{}\" text-anchor=\"middle\" font-family=\"{FONT}\">{}</text>",
            cy + 5.0,
            theme.ink,
            escape_xml(&format_human_readable_number(total, RenderValueUnit::None))
        ));
        parts.push(format!(
            "<text x=\"{cx}\" y=\"{}\" font-size=\"9\" fill=\"{}\" text-anchor=\"middle\" font-family=\"{FONT}\">TOTAL</text>",
            cy + 21.0,
            theme.faint
        ));
    }

    parts.push(render_donut_legend(
        items,
        188.0,
        38.0,
        width - 188.0 - 8.0,
        theme,
    ));

    parts.join("\n")
}

fn render_donut(items: &[OverviewRankItem], cx: f64, cy: f64, outer: f64, inner: f64) -> String {
    let total: f64 = items.iter().map(|item| item.value).sum();
    if total <= 0.0 {
        return String::new();
    }

    let visible: Vec<&OverviewRankItem> = items.iter().filter(|item| item.value > 0.0).collect();
    if visible.len() == 1 {
        return format!(
            "<path d=\"{}\" fill=\"{}\" fill-rule=\"evenodd\"/>",
            donut_ring(cx, cy, outer, inner),
            visible[0].color
        );
    }

    let mut start_angle = 0.0;
    let mut parts: Vec<String> = Vec::new();
    for item in visible {
        let sweep = (item.value / total) * 360.0;
        parts.push(format!(
            "<path d=\"{}\" fill=\"{}\"/>",
            donut_arc(cx, cy, outer, inner, start_angle, start_angle + sweep),
            item.color
        ));
        start_angle += sweep;
    }
    parts.join("\n")
}

fn donut_ring(cx: f64, cy: f64, outer: f64, inner: f64) -> String {
    format!(
        "M {} {cy} A {outer} {outer} 0 1 1 {} {cy} A {outer} {outer} 0 1 1 {} {cy} Z M {} {cy} A {inner} {inner} 0 1 1 {} {cy} A {inner} {inner} 0 1 1 {} {cy} Z",
        cx - outer,
        cx + outer,
        cx - outer,
        cx - inner,
        cx + inner,
        cx - inner
    )
}

fn donut_arc(cx: f64, cy: f64, outer: f64, inner: f64, start_angle: f64, end_angle: f64) -> String {
    let sweep = end_angle - start_angle;
    let large_arc = if sweep > 180.0 { 1 } else { 0 };
    let (osx, osy) = polar(cx, cy, outer, start_angle);
    let (oex, oey) = polar(cx, cy, outer, end_angle);
    let (isx, isy) = polar(cx, cy, inner, start_angle);
    let (iex, iey) = polar(cx, cy, inner, end_angle);
    format!(
        "M {osx} {osy} A {outer} {outer} 0 {large_arc} 1 {oex} {oey} L {iex} {iey} A {inner} {inner} 0 {large_arc} 0 {isx} {isy} Z"
    )
}

fn polar(cx: f64, cy: f64, radius: f64, angle_deg: f64) -> (f64, f64) {
    let radians = ((angle_deg - 90.0) * std::f64::consts::PI) / 180.0;
    (cx + radius * radians.cos(), cy + radius * radians.sin())
}

fn render_donut_legend(
    items: &[OverviewRankItem],
    x: f64,
    y: f64,
    width: f64,
    theme: &ExportTheme,
) -> String {
    if items.is_empty() {
        return String::new();
    }

    let total: f64 = items.iter().map(|item| item.value).sum();
    let row_height = 23.0;
    let value_text_width = 9.0 * 6.6;
    let max_name_chars = 4.max(((width - 16.0 - value_text_width) / 6.6).floor() as usize);
    let mut parts: Vec<String> = Vec::new();

    for (index, item) in items.iter().enumerate() {
        let row_y = y + index as f64 * row_height;
        let name = truncate(&item.name, max_name_chars);
        let value = format!(
            "{} ({})",
            format_human_readable_number(item.value, RenderValueUnit::None),
            format_percent(item.value, total)
        );
        parts.push(format!(
            "<rect x=\"{x}\" y=\"{}\" width=\"10\" height=\"10\" rx=\"2\" fill=\"{}\"/>\n<text x=\"{}\" y=\"{row_y}\" font-size=\"11\" fill=\"{}\" font-family=\"{FONT}\">{}</text>\n<text x=\"{}\" y=\"{row_y}\" font-size=\"11\" fill=\"{}\" text-anchor=\"end\" font-family=\"{FONT}\">{}</text>",
            row_y - 9.0,
            item.color,
            x + 16.0,
            theme.muted,
            escape_xml(&name),
            x + width,
            theme.faint,
            escape_xml(&value)
        ));
    }

    parts.join("\n")
}

fn render_projects_section(projects: &[OverviewRankItem], theme: &ExportTheme) -> Section {
    let title_height = 30.0;
    let row_height = 26.0;
    let bar_height = 16.0;
    let rows = &projects[..projects.len().min(8)];
    let max_value = rows.iter().fold(0.0, |max: f64, item| max.max(item.value));

    let label_width = 150.0;
    let value_width = 110.0;
    let bar_width = CONTENT_WIDTH - label_width - value_width;
    let mut parts: Vec<String> = Vec::new();

    for (index, item) in rows.iter().enumerate() {
        let y = index as f64 * row_height;
        let bar_length = if max_value > 0.0 {
            ((item.value / max_value) * bar_width).max(2.0)
        } else {
            0.0
        };
        parts.push(format!(
            "<text x=\"{CONTENT_X}\" y=\"{}\" font-size=\"12\" fill=\"{}\" font-family=\"{FONT}\">{}</text>",
            y + 12.0,
            theme.muted,
            escape_xml(&truncate(&item.name, 22))
        ));
        parts.push(format!(
            "<rect x=\"{}\" y=\"{}\" width=\"{bar_length}\" height=\"{bar_height}\" rx=\"3\" fill=\"{}\"/>",
            CONTENT_X + label_width,
            y + 2.0,
            item.color
        ));
        parts.push(format!(
            "<text x=\"{}\" y=\"{}\" font-size=\"12\" fill=\"{}\" font-weight=\"600\" font-family=\"{FONT}\">{}</text>",
            CONTENT_X + label_width + bar_width + 10.0,
            y + 12.0,
            theme.ink,
            escape_xml(&format_human_readable_number(item.value, RenderValueUnit::None))
        ));
    }

    Section {
        svg: format!(
            "<text x=\"{CONTENT_X}\" y=\"14\" font-size=\"16\" font-weight=\"700\" fill=\"{}\" font-family=\"{FONT}\">Projects</text>\n<g transform=\"translate(0 {title_height})\">\n{}\n</g>",
            theme.ink,
            parts.join("\n")
        ),
        height: title_height + rows.len() as f64 * row_height + 6.0,
    }
}

fn format_percent(value: f64, total: f64) -> String {
    if total <= 0.0 {
        return "0%".to_string();
    }
    let percent = (value / total) * 100.0;
    if percent > 0.0 && percent < 1.0 {
        return "<1%".to_string();
    }
    format!("{}%", percent.round())
}

fn truncate(input: &str, max_chars: usize) -> String {
    if input.chars().count() <= max_chars {
        return input.to_string();
    }
    format!(
        "{}…",
        input
            .chars()
            .take(max_chars.saturating_sub(1))
            .collect::<String>()
    )
}

fn escape_xml(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
