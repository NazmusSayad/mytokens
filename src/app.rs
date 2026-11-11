use crate::config::mytokens_ssh_path;
use crate::constants::screen::AppScreenType;
use crate::helpers::ssh::{load_all_devices_usage_data, load_ssh_devices};
use crate::render::render_screen::RenderScreen;
use crate::render::types::RenderScreenOptions;

pub async fn run_app(
    screen: AppScreenType,
    options: RenderScreenOptions,
    fresh: bool,
) -> Result<(), String> {
    let is_devices_screen = matches!(
        screen,
        AppScreenType::DevicesByCosts
            | AppScreenType::DevicesByTokens
            | AppScreenType::DevicesByRequests
    );
    if is_devices_screen && load_ssh_devices()?.is_empty() {
        return Err(format!(
            "Devices screens need at least one SSH device in {}",
            mytokens_ssh_path().display()
        ));
    }

    let data = load_all_devices_usage_data(fresh, options.refetch_remote).await?;

    let mut screen = RenderScreen::new(screen.create_screen(), &data, &options);
    screen.setup();
    screen.render();
    Ok(())
}
