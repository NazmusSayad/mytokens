use crate::render::render_screen::Screen;
use crate::render::types::{RenderDataItem, RenderScreenMessage};

pub struct RenderRequestsScreen;

impl Screen for RenderRequestsScreen {
    fn title(&self) -> &'static str {
        "Requests"
    }

    fn resolve_item(&self, item: &RenderScreenMessage, add: &mut dyn FnMut(RenderDataItem)) {
        add(RenderDataItem {
            id: "requests".to_string(),
            name: "Requests".to_string(),
            date: item.message.date,
            value: item.message.requests as f64,
            color: Some("#6b9af5".to_string()),
        });
    }
}
