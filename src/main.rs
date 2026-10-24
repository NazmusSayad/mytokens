mod app;
mod cache_cli;
mod config;
mod constants;
mod core;
mod export;
mod helpers;
mod render;
mod screens;

use std::io::IsTerminal;

use clap::{Parser, Subcommand};
use colored::Colorize;

use crate::app::run_app;
use crate::cache_cli::{run_cache_command, CacheCommand};
use crate::config::mytokens_path;
use crate::constants::screen::{app_screen_names, AppScreenType};
use crate::export::cli::{run_export, run_image, run_themes, ExportCommandArgs, ImageCommandArgs};
use crate::helpers::args::{parse_screen_arg, resolve_by};
use crate::helpers::picker::pick_screen;
use crate::helpers::usage_options::{
    build_usage_filter_options, ProjectFilterArgs, UsageFilterArgs,
};
use crate::render::types::RenderScreenOptions;

#[derive(Parser, Debug)]
#[command(
    name = "mytokens",
    version = tokscale_core::version(),
    about = "CLI tool to see detailed all the coding cli usage"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,

    #[arg(value_name = "screen", help = format!("Screen to display. Available screens: {}", app_screen_names()))]
    screen: Option<String>,

    #[arg(short = 's', long = "screen", value_name = "screen", num_args = 0..=1, help = format!("Screen to display. Available screens: {}. example: --screen models", app_screen_names()))]
    screen_option: Option<Option<String>>,

    #[arg(short = 'd', long = "display", value_name = "display", num_args = 0..=1, help = "Alias for --screen. example: --display models")]
    display: Option<Option<String>>,

    #[arg(
        long,
        value_name = "by",
        help = "Grouping by time. possible values: day, week, month, year. example: --by month"
    )]
    by: Option<String>,
    #[arg(long, help = "shorthand for --by day")]
    day: bool,
    #[arg(long, help = "shorthand for --by week")]
    week: bool,
    #[arg(long, help = "shorthand for --by month")]
    month: bool,
    #[arg(long, help = "shorthand for --by year")]
    year: bool,

    #[command(flatten)]
    filters: UsageFilterArgs,
    #[command(flatten)]
    projects: ProjectFilterArgs,

    #[arg(long, help = "Show all history instead of the default last 30 days.")]
    all: bool,
    #[arg(
        long,
        help = "Parse all sources from scratch, ignoring the parse cache."
    )]
    fresh: bool,
    #[arg(long = "no-group", help = "Disable model grouping entirely.")]
    no_group: bool,
    #[arg(
        long = "no-auto-group",
        help = "Disable automatic free-variant/gateway grouping (explicit groups still apply)."
    )]
    no_auto_group: bool,
    #[arg(
        long = "no-cache",
        help = "Refetch remote data (model groups, price tables) ignoring the fetch cache."
    )]
    no_cache: bool,
}

#[derive(Subcommand, Debug)]
enum Command {
    #[command(
        about = "Export the aggregated usage overview (all sources, models and providers) as a single image."
    )]
    Export(ExportCommandArgs),
    #[command(
        about = "Render the aggregated usage overview (all sources, models and providers) as an image in the terminal."
    )]
    Image(ImageCommandArgs),
    #[command(about = "List all available export themes.")]
    Themes,
    #[command(about = "Manage the local parse cache.")]
    Cache {
        #[command(subcommand)]
        command: CacheCommand,
    },
}

fn resolve_screen(cli: &Cli) -> AppScreenType {
    if cli.screen.is_some() && (cli.screen_option.is_some() || cli.display.is_some()) {
        eprintln!(
            "{}",
            format!(
                "Cannot use the {} argument together with {}/{}",
                "[screen]".bold(),
                "--screen".bold(),
                "--display".bold()
            )
            .red()
        );
        std::process::exit(1);
    }

    let screen_input = match (&cli.screen_option, &cli.display, &cli.screen) {
        (Some(Some(screen)), _, _) => Some(screen),
        (_, Some(Some(display)), _) => Some(display),
        (_, _, screen) => screen.as_ref(),
    };

    if let Some(screen_input) = screen_input {
        return match parse_screen_arg(screen_input) {
            Some(screen) => screen,
            None => {
                eprintln!(
                    "{}",
                    format!("Invalid screen argument: {}", screen_input.bold()).red()
                );
                println!("Available screens: {}", app_screen_names());
                std::process::exit(1);
            }
        };
    }

    if cli.screen_option.is_some() || cli.display.is_some() {
        return match pick_screen() {
            Ok(Some(screen)) => screen,
            Ok(None) => std::process::exit(0),
            Err(err) => {
                eprintln!("{err}");
                std::process::exit(1);
            }
        };
    }

    AppScreenType::ModelsByTokens
}

async fn run_dashboard(cli: Cli) {
    let screen = resolve_screen(&cli);

    let options =
        build_usage_filter_options(&cli.filters, cli.all, Some(&cli.projects), None, Some(30))
            .and_then(|filters| {
                let show_by =
                    resolve_by(cli.by.as_deref(), cli.day, cli.week, cli.month, cli.year)?;
                Ok(RenderScreenOptions {
                    show_by,
                    screen_width: crossterm::terminal::size()
                        .map(|(columns, _)| columns as usize)
                        .unwrap_or(80),
                    screen_padding: 1,
                    filters,
                    group_models: !cli.no_group,
                    auto_group_models: !cli.no_auto_group,
                    refetch_remote: cli.no_cache,
                })
            });

    let options = match options {
        Ok(options) => options,
        Err(message) => {
            eprintln!("{message}");
            std::process::exit(1);
        }
    };

    if let Err(message) = run_app(screen, options, cli.fresh).await {
        eprintln!("{}", message.red());
        std::process::exit(1);
    }
}

async fn run(mut cli: Cli) {
    match cli.command.take() {
        Some(Command::Export(args)) => run_export(args).await,
        Some(Command::Image(args)) => run_image(args).await,
        Some(Command::Themes) => run_themes(),
        Some(Command::Cache { command }) => run_cache_command(command),
        None => run_dashboard(cli).await,
    }
}

fn main() {
    if std::env::var_os("TOKSCALE_CONFIG_DIR").is_none() {
        std::env::set_var("TOKSCALE_CONFIG_DIR", mytokens_path());
    }

    if !std::io::stdout().is_terminal() {
        colored::control::set_override(false);
    }

    let cli = Cli::parse();
    tokio::runtime::Runtime::new()
        .expect("Failed to start the async runtime")
        .block_on(run(cli));
}
