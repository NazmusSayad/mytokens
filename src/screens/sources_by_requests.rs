use crate::constants::providers::known_llm_brand;
use crate::render::render_screen::Screen;
use crate::render::types::{RenderDataItem, RenderScreenMessage};

pub struct RenderSourcesByRequestsScreen;

impl Screen for RenderSourcesByRequestsScreen {
    fn title(&self) -> &'static str {
        "Sources by Requests"
    }

    fn resolve_item(&self, item: &RenderScreenMessage, add: &mut dyn FnMut(RenderDataItem)) {
        let id = item.message.source.clone();
        let value = item.message.requests as f64;

        add(RenderDataItem {
            id: id.clone(),
            name: id,
            date: item.message.date,
            value,
            color: known_llm_brand(&item.message.source),
        });
    }
}
