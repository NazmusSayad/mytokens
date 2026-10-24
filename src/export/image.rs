use resvg::tiny_skia::{Color, Pixmap, Transform};
use resvg::usvg::{Options, Tree};

const MAX_KITTY_DIMENSION: f32 = 10000.0;

const SANS_SERIF_CANDIDATES: [&str; 7] = [
    "Helvetica Neue",
    "Segoe UI",
    "Arial",
    "Helvetica",
    "Liberation Sans",
    "Noto Sans",
    "DejaVu Sans",
];

pub fn parse_svg(svg: &str) -> Result<Tree, String> {
    let mut options = Options::default();
    let fontdb = options.fontdb_mut();
    fontdb.load_system_fonts();
    let family = SANS_SERIF_CANDIDATES.into_iter().find(|family| {
        fontdb
            .faces()
            .any(|face| face.families.iter().any(|(name, _)| name == family))
    });
    if let Some(family) = family {
        fontdb.set_sans_serif_family(family);
    }
    Tree::from_str(svg, &options).map_err(|err| err.to_string())
}

pub fn render_pixmap(tree: &Tree, scale: f32) -> Result<Pixmap, String> {
    let size = tree.size();
    let width = (size.width() * scale).ceil() as u32;
    let height = (size.height() * scale).ceil() as u32;
    let mut pixmap = Pixmap::new(width, height)
        .ok_or_else(|| format!("Cannot allocate a {width}x{height} image."))?;
    pixmap.fill(Color::WHITE);
    resvg::render(
        tree,
        Transform::from_scale(scale, scale),
        &mut pixmap.as_mut(),
    );
    Ok(pixmap)
}

fn encode_png(pixmap: &Pixmap) -> Result<Vec<u8>, String> {
    pixmap.encode_png().map_err(|err| err.to_string())
}

pub fn render_png(tree: &Tree, scale: f32) -> Result<Vec<u8>, String> {
    encode_png(&render_pixmap(tree, scale)?)
}

pub fn render_png_fit_max_dimension(tree: &Tree) -> Result<Vec<u8>, String> {
    let size = tree.size();
    let mut scale = MAX_KITTY_DIMENSION / size.height();
    if size.width() * scale > MAX_KITTY_DIMENSION {
        scale = MAX_KITTY_DIMENSION / size.width();
    }
    render_png(tree, scale)
}
