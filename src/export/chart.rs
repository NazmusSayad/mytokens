use crate::core::types::UsageDataMessage;
use crate::helpers::usage_options::UsageFilterOptions;

fn is_excluded_by(enabled: &Option<Vec<String>>, value: &str) -> bool {
    match enabled {
        Some(list) => !list.is_empty() && !list.iter().any(|item| item == value),
        None => false,
    }
}

fn is_included_in(disabled: &Option<Vec<String>>, value: &str) -> bool {
    match disabled {
        Some(list) => list.iter().any(|item| item == value),
        None => false,
    }
}

pub fn is_message_ignored(message: &UsageDataMessage, options: &UsageFilterOptions) -> bool {
    if options
        .date_end
        .is_some_and(|date_end| message.date > date_end)
    {
        return true;
    }

    if options
        .date_start
        .is_some_and(|date_start| message.date < date_start)
    {
        return true;
    }

    if is_excluded_by(&options.enabled_sources, &message.source)
        || is_included_in(&options.disabled_sources, &message.source)
    {
        return true;
    }

    if is_excluded_by(&options.enabled_providers, &message.model.provider)
        || is_included_in(&options.disabled_providers, &message.model.provider)
    {
        return true;
    }

    if is_excluded_by(&options.enabled_models, &message.model.id)
        || is_included_in(&options.disabled_models, &message.model.id)
    {
        return true;
    }

    if is_excluded_by(&options.enabled_agents, &message.agent)
        || is_included_in(&options.disabled_agents, &message.agent)
    {
        return true;
    }

    let project_name = message
        .project
        .as_ref()
        .and_then(|project| project.name.as_deref())
        .filter(|name| !name.is_empty());
    if let Some(name) = project_name {
        if is_excluded_by(&options.enabled_projects, name)
            || is_included_in(&options.disabled_projects, name)
        {
            return true;
        }
    }

    false
}
