use clap::Args;
use colored::Colorize;

use crate::core::types::UsageDataMessage;
use crate::export::chart::is_message_ignored;
use crate::helpers::parser::load_usage_data;
use crate::helpers::usage_options::{
    build_usage_filter_options, ProjectFilterArgs, UsageFilterArgs,
};

#[derive(Args, Debug, Clone)]
#[command(after_help = "Examples:
  $ mytokens json
  $ mytokens json --last 7
  $ mytokens json --sources claude,codex > usage.json")]
pub struct JsonCommandArgs {
    #[command(flatten)]
    pub filters: UsageFilterArgs,
    #[command(flatten)]
    pub projects: ProjectFilterArgs,
    #[arg(
        long,
        help = "Parse all sources from scratch, ignoring the parse cache."
    )]
    pub fresh: bool,
    #[arg(
        long = "no-cache",
        help = "Refetch remote price tables ignoring the fetch cache."
    )]
    pub no_cache: bool,
}

pub async fn run_json(args: JsonCommandArgs) {
    let result = async {
        let filters =
            build_usage_filter_options(&args.filters, false, Some(&args.projects), None, None)?;
        let data = load_usage_data(args.fresh, args.no_cache).await?;
        let messages: Vec<&UsageDataMessage> = data
            .iter()
            .filter(|message| !is_message_ignored(message, &filters))
            .collect();
        serde_json::to_string_pretty(&messages).map_err(|err| err.to_string())
    }
    .await;

    match result {
        Ok(json) => println!("{json}"),
        Err(message) => {
            eprintln!("{}", message.red());
            std::process::exit(1);
        }
    }
}
