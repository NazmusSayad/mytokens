use colored::{ColoredString, Colorize};

pub fn parse_hex(hex: &str) -> (u8, u8, u8) {
    let h = hex.trim_start_matches('#');
    let channel = |range: std::ops::Range<usize>| {
        u8::from_str_radix(&h[range], 16).unwrap_or_else(|_| panic!("Invalid hex color: {hex}"))
    };
    (channel(0..2), channel(2..4), channel(4..6))
}

fn linearize(channel: u8) -> f64 {
    let c = channel as f64 / 255.0;
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

pub fn relative_luminance(hex: &str) -> f64 {
    let (r, g, b) = parse_hex(hex);
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

pub fn foreground_for_background(bg_hex: &str, text: &str) -> ColoredString {
    if relative_luminance(bg_hex) > 0.179 {
        text.black()
    } else {
        text.white()
    }
}

pub fn bg_hex(hex: &str, text: &str) -> ColoredString {
    let (r, g, b) = parse_hex(hex);
    text.on_truecolor(r, g, b)
}

pub fn fg_hex(hex: &str, text: &str) -> ColoredString {
    let (r, g, b) = parse_hex(hex);
    text.truecolor(r, g, b)
}
