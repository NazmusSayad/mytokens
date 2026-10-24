use crate::render::render_screen::Screen;
use crate::screens::agents_by_costs::RenderAgentsByCostsScreen;
use crate::screens::agents_by_requests::RenderAgentsByRequestsScreen;
use crate::screens::agents_by_tokens::RenderAgentsByTokensScreen;
use crate::screens::costs::RenderCostsScreen;
use crate::screens::models_by_costs::RenderModelsByCostsScreen;
use crate::screens::models_by_requests::RenderModelsByRequestsScreen;
use crate::screens::models_by_tokens::RenderModelsByTokensScreen;
use crate::screens::projects_by_costs::RenderProjectsByCostsScreen;
use crate::screens::projects_by_requests::RenderProjectsByRequestsScreen;
use crate::screens::projects_by_tokens::RenderProjectsByTokensScreen;
use crate::screens::providers_by_costs::RenderProvidersByCostsScreen;
use crate::screens::providers_by_requests::RenderProvidersByRequestsScreen;
use crate::screens::providers_by_tokens::RenderProvidersByTokensScreen;
use crate::screens::requests::RenderRequestsScreen;
use crate::screens::sources_by_costs::RenderSourcesByCostsScreen;
use crate::screens::sources_by_requests::RenderSourcesByRequestsScreen;
use crate::screens::sources_by_tokens::RenderSourcesByTokensScreen;
use crate::screens::tokens::RenderTokensScreen;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AppScreenType {
    ModelsByCosts,
    ModelsByTokens,
    ModelsByRequests,
    SourcesByCosts,
    SourcesByTokens,
    SourcesByRequests,
    ProjectsByCosts,
    ProjectsByTokens,
    ProjectsByRequests,
    ProvidersByCosts,
    ProvidersByTokens,
    ProvidersByRequests,
    AgentsByCosts,
    AgentsByTokens,
    AgentsByRequests,
    TypeByCosts,
    TypeByTokens,
    TypeByRequests,
}

impl AppScreenType {
    pub const ALL: [AppScreenType; 18] = [
        AppScreenType::ModelsByCosts,
        AppScreenType::ModelsByTokens,
        AppScreenType::ModelsByRequests,
        AppScreenType::SourcesByCosts,
        AppScreenType::SourcesByTokens,
        AppScreenType::SourcesByRequests,
        AppScreenType::ProjectsByCosts,
        AppScreenType::ProjectsByTokens,
        AppScreenType::ProjectsByRequests,
        AppScreenType::ProvidersByCosts,
        AppScreenType::ProvidersByTokens,
        AppScreenType::ProvidersByRequests,
        AppScreenType::AgentsByCosts,
        AppScreenType::AgentsByTokens,
        AppScreenType::AgentsByRequests,
        AppScreenType::TypeByCosts,
        AppScreenType::TypeByTokens,
        AppScreenType::TypeByRequests,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            AppScreenType::ModelsByCosts => "models-by-costs",
            AppScreenType::ModelsByTokens => "models-by-tokens",
            AppScreenType::ModelsByRequests => "models-by-requests",
            AppScreenType::SourcesByCosts => "sources-by-costs",
            AppScreenType::SourcesByTokens => "sources-by-tokens",
            AppScreenType::SourcesByRequests => "sources-by-requests",
            AppScreenType::ProjectsByCosts => "projects-by-costs",
            AppScreenType::ProjectsByTokens => "projects-by-tokens",
            AppScreenType::ProjectsByRequests => "projects-by-requests",
            AppScreenType::ProvidersByCosts => "providers-by-costs",
            AppScreenType::ProvidersByTokens => "providers-by-tokens",
            AppScreenType::ProvidersByRequests => "providers-by-requests",
            AppScreenType::AgentsByCosts => "agents-by-costs",
            AppScreenType::AgentsByTokens => "agents-by-tokens",
            AppScreenType::AgentsByRequests => "agents-by-requests",
            AppScreenType::TypeByCosts => "type-by-costs",
            AppScreenType::TypeByTokens => "type-by-tokens",
            AppScreenType::TypeByRequests => "type-by-requests",
        }
    }

    pub fn create_screen(self) -> Box<dyn Screen> {
        match self {
            AppScreenType::ModelsByCosts => Box::new(RenderModelsByCostsScreen),
            AppScreenType::ModelsByTokens => Box::new(RenderModelsByTokensScreen),
            AppScreenType::ModelsByRequests => Box::new(RenderModelsByRequestsScreen),
            AppScreenType::SourcesByCosts => Box::new(RenderSourcesByCostsScreen),
            AppScreenType::SourcesByTokens => Box::new(RenderSourcesByTokensScreen),
            AppScreenType::SourcesByRequests => Box::new(RenderSourcesByRequestsScreen),
            AppScreenType::ProjectsByCosts => Box::new(RenderProjectsByCostsScreen),
            AppScreenType::ProjectsByTokens => Box::new(RenderProjectsByTokensScreen),
            AppScreenType::ProjectsByRequests => Box::new(RenderProjectsByRequestsScreen),
            AppScreenType::ProvidersByCosts => Box::new(RenderProvidersByCostsScreen),
            AppScreenType::ProvidersByTokens => Box::new(RenderProvidersByTokensScreen),
            AppScreenType::ProvidersByRequests => Box::new(RenderProvidersByRequestsScreen),
            AppScreenType::AgentsByCosts => Box::new(RenderAgentsByCostsScreen),
            AppScreenType::AgentsByTokens => Box::new(RenderAgentsByTokensScreen),
            AppScreenType::AgentsByRequests => Box::new(RenderAgentsByRequestsScreen),
            AppScreenType::TypeByCosts => Box::new(RenderCostsScreen),
            AppScreenType::TypeByTokens => Box::new(RenderTokensScreen),
            AppScreenType::TypeByRequests => Box::new(RenderRequestsScreen),
        }
    }
}

pub fn app_screen_names() -> String {
    AppScreenType::ALL
        .iter()
        .map(|screen| screen.as_str())
        .collect::<Vec<_>>()
        .join(", ")
}

pub struct AppScreenInfo {
    pub screen_type: AppScreenType,
    pub title: &'static str,
    pub description: &'static str,
}

pub const APP_SCREENS_INFO: [AppScreenInfo; 18] = [
    AppScreenInfo {
        screen_type: AppScreenType::ModelsByTokens,
        title: "Models by Tokens",
        description: "Token usage grouped by the underlying AI model (e.g. gpt-5, claude-sonnet-4).",
    },
    AppScreenInfo {
        screen_type: AppScreenType::ModelsByCosts,
        title: "Models by Costs",
        description:
            "Estimated cost grouped by the underlying AI model (e.g. gpt-5, claude-sonnet-4).",
    },
    AppScreenInfo {
        screen_type: AppScreenType::SourcesByTokens,
        title: "Sources by Tokens",
        description: "Token usage grouped by the coding CLI source that produced it (e.g. opencode, codex, claude).",
    },
    AppScreenInfo {
        screen_type: AppScreenType::SourcesByCosts,
        title: "Sources by Costs",
        description: "Estimated cost grouped by the coding CLI source that produced it (e.g. opencode, codex, claude).",
    },
    AppScreenInfo {
        screen_type: AppScreenType::ProjectsByTokens,
        title: "Projects by Tokens",
        description:
            "Token usage grouped by the project or working directory where usage was recorded.",
    },
    AppScreenInfo {
        screen_type: AppScreenType::ProjectsByCosts,
        title: "Projects by Costs",
        description:
            "Estimated cost grouped by the project or working directory where usage was recorded.",
    },
    AppScreenInfo {
        screen_type: AppScreenType::ProvidersByTokens,
        title: "Providers by Tokens",
        description:
            "Token usage grouped by the provider that served the model (e.g. openai, anthropic).",
    },
    AppScreenInfo {
        screen_type: AppScreenType::ProvidersByCosts,
        title: "Providers by Costs",
        description:
            "Estimated cost grouped by the provider that served the model (e.g. openai, anthropic).",
    },
    AppScreenInfo {
        screen_type: AppScreenType::AgentsByTokens,
        title: "Agents by Tokens",
        description: "Token usage grouped by the agent that produced it such as default, build, agent or plan.",
    },
    AppScreenInfo {
        screen_type: AppScreenType::AgentsByCosts,
        title: "Agents by Costs",
        description: "Estimated cost grouped by the agent that produced it such as default, build, agent or plan.",
    },
    AppScreenInfo {
        screen_type: AppScreenType::TypeByTokens,
        title: "Types by Tokens",
        description: "Total token usage broken down by input, output, cache and reasoning tokens over time.",
    },
    AppScreenInfo {
        screen_type: AppScreenType::TypeByCosts,
        title: "Types by Costs",
        description: "Estimated dollar cost of token usage broken down by input, output, cache and reasoning tokens over time.",
    },
    AppScreenInfo {
        screen_type: AppScreenType::ModelsByRequests,
        title: "Models by Requests",
        description:
            "Request count grouped by the underlying AI model (e.g. gpt-5, claude-sonnet-4).",
    },
    AppScreenInfo {
        screen_type: AppScreenType::SourcesByRequests,
        title: "Sources by Requests",
        description: "Request count grouped by the coding CLI source that produced it (e.g. opencode, codex, claude).",
    },
    AppScreenInfo {
        screen_type: AppScreenType::ProjectsByRequests,
        title: "Projects by Requests",
        description:
            "Request count grouped by the project or working directory where usage was recorded.",
    },
    AppScreenInfo {
        screen_type: AppScreenType::ProvidersByRequests,
        title: "Providers by Requests",
        description:
            "Request count grouped by the provider that served the model (e.g. openai, anthropic).",
    },
    AppScreenInfo {
        screen_type: AppScreenType::AgentsByRequests,
        title: "Agents by Requests",
        description: "Request count grouped by the agent that produced it such as default, build, agent or plan.",
    },
    AppScreenInfo {
        screen_type: AppScreenType::TypeByRequests,
        title: "Requests",
        description: "Total request count over time.",
    },
];
