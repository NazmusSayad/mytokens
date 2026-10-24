use crate::render::render_screen::Screen;
use crate::render::types::{RenderDataItem, RenderScreenMessage};

pub struct RenderTokensScreen;

impl Screen for RenderTokensScreen {
    fn title(&self) -> &'static str {
        "Types by Tokens"
    }

    fn resolve_item(&self, item: &RenderScreenMessage, add: &mut dyn FnMut(RenderDataItem)) {
        let tokens = &item.message.tokens;
        let types = [
            ("input", "Input", "#7b44e9", tokens.input),
            ("output", "Output", "#64a659", tokens.output),
            ("output", "Output", "#64a659", tokens.reasoning),
            ("cacheInput", "Cache Input", "#6b9af5", tokens.cache_input),
            (
                "cacheOutput",
                "Cache Output",
                "#b97c60",
                tokens.cache_output,
            ),
        ];

        for (id, name, color, value) in types {
            if value != 0 {
                add(RenderDataItem {
                    id: id.to_string(),
                    name: name.to_string(),
                    date: item.message.date,
                    value: value as f64,
                    color: Some(color.to_string()),
                });
            }
        }
    }
}
