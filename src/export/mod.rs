pub mod chart;
pub mod cli;
pub mod clipboard;
pub mod image;
pub mod overview;
pub mod overview_svg;
pub mod terminal_image;
pub mod themes;
pub mod types;

use crate::core::types::UsageDataMessage;
use crate::helpers::parser::load_usage_data;

use self::chart::is_message_ignored;
use self::clipboard::copy_png_to_clipboard;
use self::image::{parse_svg, render_png};
use self::overview::{compute_overview, OverviewOptions};
use self::overview_svg::render_overview_to_svg;
use self::terminal_image::render_image_in_terminal;
use self::types::{ExportFilterOptions, ExportFormat, ExportTheme};

pub async fn build_overview_svg(
    options: &ExportFilterOptions,
    theme: &ExportTheme,
    projects: usize,
) -> Result<String, String> {
    let data = load_usage_data(false, options.refetch_remote).await?;
    let messages: Vec<&UsageDataMessage> = data
        .iter()
        .filter(|message| !is_message_ignored(message, &options.filters))
        .collect();
    let overview = compute_overview(
        &messages,
        &OverviewOptions {
            usage_by: options.filters.usage_by,
            projects,
            group_models: options.group_models,
            auto_group_models: options.auto_group_models,
        },
    )?;
    Ok(render_overview_to_svg(&overview, theme))
}

pub async fn export_report_to_svg(
    output_path: &str,
    options: &ExportFilterOptions,
    format: ExportFormat,
    theme: &ExportTheme,
    scale: f32,
    projects: usize,
) -> Result<String, String> {
    let svg = build_overview_svg(options, theme, projects).await?;
    let content = match format {
        ExportFormat::Png => render_png(&parse_svg(&svg)?, scale)?,
        ExportFormat::Svg => svg.into_bytes(),
    };

    let path = std::path::Path::new(output_path);
    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    std::fs::write(path, content).map_err(|err| err.to_string())?;
    Ok(output_path.to_string())
}

pub async fn show_report_image(
    options: &ExportFilterOptions,
    copy: bool,
    theme: &ExportTheme,
    projects: usize,
) -> Result<String, String> {
    let svg = build_overview_svg(options, theme, projects).await?;
    let png = render_image_in_terminal(&svg)?;
    if copy {
        copy_png_to_clipboard(&png)?;
    }
    Ok(svg)
}
