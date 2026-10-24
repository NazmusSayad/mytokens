use crate::constants::screen::AppScreenType;
use crate::helpers::parser::load_usage_data;
use crate::render::render_screen::RenderScreen;
use crate::render::types::RenderScreenOptions;

pub async fn run_app(
    screen: AppScreenType,
    options: RenderScreenOptions,
    fresh: bool,
) -> Result<(), String> {
    let data = load_usage_data(fresh, options.refetch_remote).await?;

    let mut screen = RenderScreen::new(screen.create_screen(), &data, &options);
    screen.setup();
    screen.render();
    Ok(())
}
