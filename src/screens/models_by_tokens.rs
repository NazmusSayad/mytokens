use crate::render::render_screen::Screen;
use crate::render::types::{RenderDataItem, RenderScreenMessage};

pub struct RenderModelsByTokensScreen;

impl Screen for RenderModelsByTokensScreen {
    fn title(&self) -> &'static str {
        "Models by Tokens"
    }

    fn group_models(&self) -> bool {
        true
    }

    fn resolve_item(&self, item: &RenderScreenMessage, add: &mut dyn FnMut(RenderDataItem)) {
        let id = item
            .grouped_model
            .as_ref()
            .unwrap_or(&item.message.model)
            .id
            .clone();
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
