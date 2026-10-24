use crate::constants::providers::known_llm_brand;
use crate::render::render_screen::Screen;
use crate::render::types::{RenderDataItem, RenderScreenMessage};

pub struct RenderProvidersByTokensScreen;

impl Screen for RenderProvidersByTokensScreen {
    fn title(&self) -> &'static str {
        "Providers by Tokens"
    }

    fn resolve_item(&self, item: &RenderScreenMessage, add: &mut dyn FnMut(RenderDataItem)) {
        let id = item.message.model.provider.clone();
        let value = item.message.tokens.total() as f64;

        if value > 0.0 {
            add(RenderDataItem {
                id: id.clone(),
                name: id,
                date: item.message.date,
                value,
                color: known_llm_brand(&item.message.model.provider),
            });
        }
    }
}
