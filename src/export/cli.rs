use std::io::IsTerminal;
use std::path::Path;

use clap::Args;
use colored::Colorize;

use crate::helpers::usage_options::{build_usage_filter_options, UsageByArgs, UsageFilterArgs};
use crate::render::contrast::bg_hex;

use super::themes::{export_theme_names, get_export_theme, DEFAULT_EXPORT_THEME, EXPORT_THEMES};
use super::types::{ExportFilterOptions, ExportFormat, ExportTheme};
use super::{export_report_to_svg, show_report_image};

fn format_names() -> String {
    ExportFormat::ALL
        .iter()
        .map(|format| format.as_str())
        .collect::<Vec<_>>()
        .join(", ")
}

fn parse_format(value: &str) -> Result<ExportFormat, String> {
    ExportFormat::parse(&value.to_lowercase())
        .ok_or_else(|| format!("Supported formats: {}", format_names()))
}

fn parse_theme(value: &str) -> Result<&'static ExportTheme, String> {
    get_export_theme(&value.to_lowercase())
        .ok_or_else(|| format!("Supported themes: {}", export_theme_names()))
}

fn parse_project_count(value: &str) -> Result<usize, String> {
    value
        .parse::<usize>()
        .map_err(|_| "Must be a non-negative whole number.".to_string())
}

fn parse_scale(value: &str) -> Result<f32, String> {
    match value.parse::<f32>() {
        Ok(scale) if scale > 0.0 && scale.is_finite() => Ok(scale),
        _ => Err("Must be a positive number.".to_string()),
    }
}

#[derive(Args, Debug, Clone)]
pub struct ExportOutputArgs {
    #[arg(
        long,
        value_name = "path",
        help = "Output file path. Defaults to mytokens.svg (or the chosen format)."
    )]
    pub output: Option<String>,
    #[arg(short = 'f', long, value_name = "format", value_parser = parse_format, help = format!("Output format: {}. Inferred from --output extension when omitted.", format_names()))]
    pub format: Option<ExportFormat>,
}

#[derive(Args, Debug, Clone)]
pub struct ExportSharedArgs {
    #[arg(short = 'p', long, value_name = "count", value_parser = parse_project_count, help = "Number of top projects to show. Use 0 to hide the projects section. Default: 10.")]
    pub projects: Option<usize>,
    #[arg(short = 't', long, value_name = "theme", value_parser = parse_theme, help = format!("Color theme: {}. Default: {DEFAULT_EXPORT_THEME}.", export_theme_names()))]
    pub theme: Option<&'static ExportTheme>,
}

#[derive(Args, Debug, Clone)]
pub struct GroupingArgs {
    #[arg(long = "no-group", help = "Disable model grouping entirely.")]
    pub no_group: bool,
    #[arg(
        long = "no-auto-group",
        help = "Disable automatic free-variant/gateway grouping (explicit groups still apply)."
    )]
    pub no_auto_group: bool,
    #[arg(
        long = "no-cache",
        help = "Refetch remote data (model groups, price tables) ignoring the fetch cache."
    )]
    pub no_cache: bool,
}

#[derive(Args, Debug, Clone)]
#[command(after_help = "Examples:
  $ mytokens export
  $ mytokens export --last 30 --output overview.svg
  $ mytokens export --from 2026-01-01 --to 2026-03-01
  $ mytokens export --format png
  $ mytokens export --format png --output overview.png
  $ mytokens export --theme dark --format png --scale 2")]
pub struct ExportCommandArgs {
    #[command(flatten)]
    pub output: ExportOutputArgs,
    #[command(flatten)]
    pub filters: UsageFilterArgs,
    #[command(flatten)]
    pub usage_by: UsageByArgs,
    #[command(flatten)]
    pub shared: ExportSharedArgs,
    #[command(flatten)]
    pub grouping: GroupingArgs,
    #[arg(long, value_name = "scale", value_parser = parse_scale, help = "Output scale multiplier (PNG only). Default: 1.")]
    pub scale: Option<f32>,
}

#[derive(Args, Debug, Clone)]
#[command(after_help = "Examples:
  $ mytokens image
  $ mytokens image --this-month
  $ mytokens image --last 5
  $ mytokens image --theme one-dark
  $ mytokens image --copy")]
pub struct ImageCommandArgs {
    #[command(flatten)]
    pub filters: UsageFilterArgs,
    #[command(flatten)]
    pub usage_by: UsageByArgs,
    #[command(flatten)]
    pub shared: ExportSharedArgs,
    #[arg(
        short = 'c',
        long,
        help = "Copy the rendered PNG image to the macOS clipboard."
    )]
    pub copy: bool,
    #[command(flatten)]
    pub grouping: GroupingArgs,
}

fn build_export_filter_options(
    filters: &UsageFilterArgs,
    usage_by: &UsageByArgs,
    grouping: &GroupingArgs,
) -> Result<ExportFilterOptions, String> {
    Ok(ExportFilterOptions {
        filters: build_usage_filter_options(filters, false, None, usage_by.usage_by, None)?,
        group_models: !grouping.no_group,
        auto_group_models: !grouping.no_auto_group,
        refetch_remote: grouping.no_cache,
    })
}

fn default_theme() -> &'static ExportTheme {
    get_export_theme(DEFAULT_EXPORT_THEME).expect("default theme exists")
}

fn exit_with_error(message: String) -> ! {
    eprintln!("{}", message.red());
    std::process::exit(1);
}

pub async fn run_export(args: ExportCommandArgs) {
    let result = async {
        let options = build_export_filter_options(&args.filters, &args.usage_by, &args.grouping)?;
        let (output_path, format) =
            resolve_output(args.output.output.as_deref(), args.output.format)?;
        export_report_to_svg(
            &output_path,
            &options,
            format,
            args.shared.theme.unwrap_or(default_theme()),
            args.scale.unwrap_or(1.0),
            args.shared.projects.unwrap_or(10),
        )
        .await
    }
    .await;

    match result {
        Ok(saved_path) => println!(
            "{}",
            format!("Saved usage overview to {}", saved_path.bold()).green()
        ),
        Err(message) => exit_with_error(message),
    }
}

pub async fn run_image(args: ImageCommandArgs) {
    if !std::io::stdout().is_terminal() {
        eprintln!(
            "{}",
            "stdout is not a TTY; run `mytokens export` to save the SVG file instead.".yellow()
        );
        return;
    }

    let result = async {
        let options = build_export_filter_options(&args.filters, &args.usage_by, &args.grouping)?;
        show_report_image(
            &options,
            args.copy,
            args.shared.theme.unwrap_or(default_theme()),
            args.shared.projects.unwrap_or(10),
        )
        .await
    }
    .await;

    match result {
        Ok(_) => println!(
            "{} {}",
            " WARN ".on_yellow().dimmed().white(),
            "If your terminal fails to render the image, run `mytokens export` to export it and view it normally."
                .dimmed()
                .yellow()
        ),
        Err(message) => exit_with_error(message),
    }
}

pub fn run_themes() {
    println!("{}", "Available export themes:".bold());
    println!();

    let name_width = EXPORT_THEMES
        .iter()
        .map(|theme| theme.id.len())
        .max()
        .unwrap_or(0)
        .max("github-dark".len());
    for theme in &EXPORT_THEMES {
        let label = if theme.id == DEFAULT_EXPORT_THEME {
            format!("{} (default)", theme.id)
        } else {
            theme.id.to_string()
        };
        let swatches: String = [
            theme.background,
            theme.card_fill,
            theme.border,
            theme.ink,
            theme.muted,
            theme.faint,
            theme.accent,
            theme.accent_alt,
        ]
        .iter()
        .map(|hex| bg_hex(hex, "  ").to_string())
        .collect();
        println!("  {label:<width$}{swatches}", width = name_width + 8);
        println!();
    }
}

fn resolve_output(
    output_path: Option<&str>,
    format: Option<ExportFormat>,
) -> Result<(String, ExportFormat), String> {
    let Some(output_path) = output_path else {
        return match format {
            Some(format) => Ok((format!("mytokens.{}", format.as_str()), format)),
            None => Ok(("mytokens.svg".to_string(), ExportFormat::Svg)),
        };
    };

    let extension = Path::new(output_path)
        .extension()
        .map(|extension| extension.to_string_lossy().to_lowercase());

    if let (Some(extension), Some(format)) = (&extension, format) {
        if extension != format.as_str() {
            return Err(format!(
                "--format {} does not match output extension \".{extension}\".",
                format.as_str()
            ));
        }
    }

    let extension_format = match &extension {
        Some(extension) => Some(ExportFormat::parse(extension).ok_or_else(|| {
            format!(
                "Unsupported output extension \".{extension}\". Supported formats: {}",
                format_names()
            )
        })?),
        None => None,
    };

    Ok((
        output_path.to_string(),
        format.or(extension_format).unwrap_or(ExportFormat::Svg),
    ))
}
