use crate::render::render_screen::Screen;
use crate::render::types::{RenderDataItem, RenderScreenMessage, RenderValueUnit};

pub struct RenderCostsScreen;

impl Screen for RenderCostsScreen {
    fn title(&self) -> &'static str {
        "Types by Costs"
    }

    fn value_unit(&self) -> RenderValueUnit {
        RenderValueUnit::Dollar
    }

    fn resolve_item(&self, item: &RenderScreenMessage, add: &mut dyn FnMut(RenderDataItem)) {
        let costs = &item.message.costs;
        let types = [
            ("input", "Input", "#7b44e9", costs.input),
            ("output", "Output", "#64a659", costs.output),
            ("output", "Output", "#64a659", costs.reasoning),
            ("cacheInput", "Cache Input", "#6b9af5", costs.cache_input),
            ("cacheOutput", "Cache Output", "#b97c60", costs.cache_output),
        ];

        for (id, name, color, value) in types {
            if value != 0.0 {
                add(RenderDataItem {
                    id: id.to_string(),
                    name: name.to_string(),
                    date: item.message.date,
                    value,
                    color: Some(color.to_string()),
                });
            }
        }
    }
}
