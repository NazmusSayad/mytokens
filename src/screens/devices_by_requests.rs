use crate::render::render_screen::Screen;
use crate::render::types::{RenderDataItem, RenderScreenMessage};

pub struct RenderDevicesByRequestsScreen;

impl Screen for RenderDevicesByRequestsScreen {
    fn title(&self) -> &'static str {
        "Devices by Requests"
    }

    fn resolve_item(&self, item: &RenderScreenMessage, add: &mut dyn FnMut(RenderDataItem)) {
        let id = item.message.device.clone();
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
