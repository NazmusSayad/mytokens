use std::io::{IsTerminal, Write};

use base64::Engine;

use super::image::{parse_svg, render_pixmap, render_png, render_png_fit_max_dimension};

const MAX_KITTY_DIMENSION: f32 = 10000.0;

enum TerminalProtocol {
    Kitty,
    ITerm,
    Blocks,
}

fn detect_protocol() -> TerminalProtocol {
    let env = |name: &str| std::env::var(name).unwrap_or_default();

    if !env("KITTY_WINDOW_ID").is_empty()
        || env("TERM") == "xterm-kitty"
        || env("TERM_PROGRAM") == "ghostty"
    {
        return TerminalProtocol::Kitty;
    }

    if matches!(env("TERM_PROGRAM").as_str(), "iTerm.app" | "WezTerm")
        || env("LC_TERMINAL") == "iTerm2"
    {
        return TerminalProtocol::ITerm;
    }

    TerminalProtocol::Blocks
}

fn terminal_columns() -> u16 {
    crossterm::terminal::size()
        .map(|(columns, _)| columns)
        .unwrap_or(80)
}

pub fn render_image_in_terminal(svg: &str) -> Result<Vec<u8>, String> {
    let tree = parse_svg(svg)?;
    let base_width = tree.size().width();
    let columns = terminal_columns();
    let target_width = columns as f32 * read_terminal_cell_width().unwrap_or(0) as f32;

    let scale = if target_width > base_width {
        target_width / base_width
    } else {
        1.0
    };

    let width = tree.size().width() * scale;
    let height = tree.size().height() * scale;
    let png = if width > MAX_KITTY_DIMENSION || height > MAX_KITTY_DIMENSION {
        render_png_fit_max_dimension(&tree)?
    } else {
        render_png(&tree, scale)?
    };

    let output = match detect_protocol() {
        TerminalProtocol::Kitty => kitty_image(&png, columns),
        TerminalProtocol::ITerm => iterm_image(&png),
        TerminalProtocol::Blocks => block_image(&tree, columns)?,
    };

    let mut stdout = std::io::stdout();
    stdout
        .write_all(format!("{output}\n").as_bytes())
        .and_then(|()| stdout.flush())
        .map_err(|err| err.to_string())?;
    Ok(png)
}

fn kitty_image(png: &[u8], columns: u16) -> String {
    let encoded = base64::engine::general_purpose::STANDARD.encode(png);
    let chunks: Vec<&[u8]> = encoded.as_bytes().chunks(4096).collect();
    let mut output = String::new();
    for (index, chunk) in chunks.iter().enumerate() {
        let more = if index + 1 < chunks.len() { 1 } else { 0 };
        let chunk = std::str::from_utf8(chunk).expect("base64 is ascii");
        if index == 0 {
            output.push_str(&format!(
                "\x1b_Ga=T,f=100,c={columns},m={more};{chunk}\x1b\\"
            ));
        } else {
            output.push_str(&format!("\x1b_Gm={more};{chunk}\x1b\\"));
        }
    }
    output
}

fn iterm_image(png: &[u8]) -> String {
    let encoded = base64::engine::general_purpose::STANDARD.encode(png);
    format!(
        "\x1b]1337;File=inline=1;size={};width=100%;preserveAspectRatio=1:{encoded}\x07",
        png.len()
    )
}

fn block_image(tree: &resvg::usvg::Tree, columns: u16) -> Result<String, String> {
    let scale = columns as f32 / tree.size().width();
    let pixmap = render_pixmap(tree, scale)?;
    let width = pixmap.width();
    let height = pixmap.height();
    let mut output = String::new();

    for y in (0..height).step_by(2) {
        for x in 0..width {
            let top = pixmap.pixel(x, y).expect("pixel in bounds");
            let bottom = if y + 1 < height {
                pixmap.pixel(x, y + 1).expect("pixel in bounds")
            } else {
                top
            };
            output.push_str(&format!(
                "\x1b[38;2;{};{};{}m\x1b[48;2;{};{};{}m▀",
                top.red(),
                top.green(),
                top.blue(),
                bottom.red(),
                bottom.green(),
                bottom.blue()
            ));
        }
        output.push_str("\x1b[0m");
        if y + 2 < height {
            output.push('\n');
        }
    }

    Ok(output)
}

#[cfg(unix)]
fn read_terminal_cell_width() -> Option<u32> {
    use std::io::Read;
    use std::os::fd::AsRawFd;
    use std::time::{Duration, Instant};

    let stdin = std::io::stdin();
    if !stdin.is_terminal() {
        return None;
    }
    if crossterm::terminal::is_raw_mode_enabled().unwrap_or(true) {
        return None;
    }

    crossterm::terminal::enable_raw_mode().ok()?;
    let mut stdout = std::io::stdout();
    let _ = stdout.write_all(b"\x1b[16t").and_then(|()| stdout.flush());

    let deadline = Instant::now() + Duration::from_millis(100);
    let fd = stdin.as_raw_fd();
    let mut response: Vec<u8> = Vec::new();
    let mut width: Option<u32> = None;

    while width.is_none() {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            break;
        }
        let mut poll_fd = libc::pollfd {
            fd,
            events: libc::POLLIN,
            revents: 0,
        };
        let ready = unsafe { libc::poll(&mut poll_fd, 1, remaining.as_millis() as libc::c_int) };
        if ready <= 0 {
            break;
        }
        let mut buffer = [0u8; 64];
        let count = match stdin.lock().read(&mut buffer) {
            Ok(count) if count > 0 => count,
            _ => break,
        };
        response.extend_from_slice(&buffer[..count]);
        width = parse_cell_size_response(&String::from_utf8_lossy(&response));
    }

    let _ = crossterm::terminal::disable_raw_mode();
    width
}

#[cfg(not(unix))]
fn read_terminal_cell_width() -> Option<u32> {
    None
}

fn parse_cell_size_response(response: &str) -> Option<u32> {
    let start = response.find("\x1b[6;")?;
    let rest = &response[start + 4..];
    let end = rest.find('t')?;
    let (_, width) = rest[..end].split_once(';')?;
    width.parse().ok()
}
