use crate::render::render_screen::Screen;
use crate::render::types::{RenderDataItem, RenderScreenMessage};

pub struct RenderAgentsByTokensScreen;

impl Screen for RenderAgentsByTokensScreen {
    fn title(&self) -> &'static str {
        "Agents by Tokens"
    }

    fn resolve_item(&self, item: &RenderScreenMessage, add: &mut dyn FnMut(RenderDataItem)) {
        let id = item.message.agent.clone();
        let value = item.message.tokens.total() as f64;

        if value > 0.0 {
            add(RenderDataItem {
                id: id.clone(),
                name: id,
                date: item.message.date,
                value,
                color: None,
            });
        }
    }
}
