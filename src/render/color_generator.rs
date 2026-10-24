use std::collections::HashSet;

use sha2::{Digest, Sha256};

use super::contrast::parse_hex;

fn rgb_to_xyz(r: u8, g: u8, b: u8) -> (f64, f64, f64) {
    let linear = |channel: u8| {
        let c = channel as f64 / 255.0;
        if c > 0.04045 {
            ((c + 0.055) / 1.055).powf(2.4)
        } else {
            c / 12.92
        }
    };
    let (r, g, b) = (linear(r), linear(g), linear(b));

    let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    let y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
    let z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

    (x * 100.0, y * 100.0, z * 100.0)
}

fn xyz_to_lab(x: f64, y: f64, z: f64) -> (f64, f64, f64) {
    let f = |value: f64, white: f64| {
        let ratio = value / white;
        if ratio > 0.008856 {
            ratio.powf(1.0 / 3.0)
        } else {
            7.787 * ratio + 16.0 / 116.0
        }
    };

    let fx = f(x, 95.047);
    let fy = f(y, 100.0);
    let fz = f(z, 108.883);

    (116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz))
}

fn delta_e(hex1: &str, hex2: &str) -> f64 {
    let (r1, g1, b1) = parse_hex(hex1);
    let (r2, g2, b2) = parse_hex(hex2);

    let (x1, y1, z1) = rgb_to_xyz(r1, g1, b1);
    let (x2, y2, z2) = rgb_to_xyz(r2, g2, b2);

    let (l1, a1, b1) = xyz_to_lab(x1, y1, z1);
    let (l2, a2, b2) = xyz_to_lab(x2, y2, z2);

    ((l1 - l2).powi(2) + (a1 - a2).powi(2) + (b1 - b2).powi(2)).sqrt()
}

fn hsl_to_hex(h: f64, s: f64, l: f64) -> String {
    let s_norm = s / 100.0;
    let l_norm = l / 100.0;
    let c = (1.0 - (2.0 * l_norm - 1.0).abs()) * s_norm;
    let x = c * (1.0 - ((h / 60.0) % 2.0 - 1.0).abs());
    let m = l_norm - c / 2.0;

    let (r, g, b) = if (0.0..60.0).contains(&h) {
        (c, x, 0.0)
    } else if (60.0..120.0).contains(&h) {
        (x, c, 0.0)
    } else if (120.0..180.0).contains(&h) {
        (0.0, c, x)
    } else if (180.0..240.0).contains(&h) {
        (0.0, x, c)
    } else if (240.0..300.0).contains(&h) {
        (x, 0.0, c)
    } else if (300.0..360.0).contains(&h) {
        (c, 0.0, x)
    } else {
        (0.0, 0.0, 0.0)
    };

    let to_hex = |n: f64| format!("{:02x}", ((n + m) * 255.0).round() as u8);

    format!("#{}{}{}", to_hex(r), to_hex(g), to_hex(b))
}

pub struct ColorGenerator {
    cache: HashSet<String>,
    min_delta_e: f64,
    max_attempts: usize,
}

impl ColorGenerator {
    pub fn new() -> Self {
        Self {
            cache: HashSet::new(),
            min_delta_e: 20.0,
            max_attempts: 64,
        }
    }

    fn is_too_similar(&self, hex: &str) -> bool {
        self.cache
            .iter()
            .any(|previous| delta_e(hex, previous) < self.min_delta_e)
    }

    fn accept(&mut self, hex: &str) -> bool {
        if !self.cache.contains(hex) && !self.is_too_similar(hex) {
            self.cache.insert(hex.to_string());
            return true;
        }
        false
    }

    pub fn generate(&mut self, input: &str) -> String {
        let bytes = Sha256::digest(input.as_bytes());

        let base_hue = ((bytes[0] as f64 * 256.0 + bytes[1] as f64) / 65535.0) * 360.0;
        let base_sat = 35.0 + (bytes[2] as f64 / 255.0) * 30.0;
        let base_light = 45.0 + (bytes[3] as f64 / 255.0) * 10.0;

        let mut hex = hsl_to_hex(base_hue, base_sat, base_light);
        if self.accept(&hex) {
            return hex;
        }

        for attempt in 0..self.max_attempts {
            let i = 4 + (attempt % (bytes.len() - 4));
            let j = (i + 1) % bytes.len();
            let k = (i + 2) % bytes.len();

            let hue = ((bytes[i] as f64 * 256.0 + bytes[j] as f64) / 65535.0) * 360.0;
            let sat = 30.0 + (bytes[k] as f64 / 255.0) * 40.0;
            let light = 40.0 + (bytes[(k + 1) % bytes.len()] as f64 / 255.0) * 20.0;

            hex = hsl_to_hex(hue, sat, light);
            if self.accept(&hex) {
                return hex;
            }
        }

        let mut hue = base_hue;
        for _ in 0..360 {
            hue = (hue + 47.5) % 360.0;
            hex = hsl_to_hex(hue, base_sat, base_light);
            if self.accept(&hex) {
                return hex;
            }
        }

        self.cache.insert(hex.clone());
        hex
    }
}
