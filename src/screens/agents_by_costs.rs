use crate::render::render_screen::Screen;
use crate::render::types::{RenderDataItem, RenderScreenMessage, RenderValueUnit};

pub struct RenderAgentsByCostsScreen;

impl Screen for RenderAgentsByCostsScreen {
    fn title(&self) -> &'static str {
        "Agents by Costs"
    }

    fn value_unit(&self) -> RenderValueUnit {
        RenderValueUnit::Dollar
    }

    fn resolve_item(&self, item: &RenderScreenMessage, add: &mut dyn FnMut(RenderDataItem)) {
        let id = item.message.agent.clone();
        let value = item.message.costs.total();

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
