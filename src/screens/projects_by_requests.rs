use crate::render::render_screen::Screen;
use crate::render::types::{RenderDataItem, RenderScreenMessage};

pub struct RenderProjectsByRequestsScreen;

impl Screen for RenderProjectsByRequestsScreen {
    fn title(&self) -> &'static str {
        "Projects by Requests"
    }

    fn resolve_item(&self, item: &RenderScreenMessage, add: &mut dyn FnMut(RenderDataItem)) {
        let id = item
            .message
            .project
            .as_ref()
            .and_then(|project| project.name.clone().or_else(|| project.path.clone()))
            .unwrap_or_else(|| "(no project)".to_string());
        let value = item.message.requests as f64;

        add(RenderDataItem {
            id: id.clone(),
            name: id,
            date: item.message.date,
            value,
            color: None,
        });
    }
}
