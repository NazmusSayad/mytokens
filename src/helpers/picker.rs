use std::io::{stdout, Write};

use colored::Colorize;
use crossterm::cursor::{Hide, MoveToColumn, MoveUp, Show};
use crossterm::event::{read, Event, KeyCode, KeyEventKind, KeyModifiers};
use crossterm::execute;
use crossterm::terminal::{disable_raw_mode, enable_raw_mode, Clear, ClearType};

use crate::constants::screen::{AppScreenInfo, AppScreenType, APP_SCREENS_INFO};

const PAGE_SIZE: usize = 8;
const MESSAGE: &str = "Select a screen to display:";

fn truncate(text: &str, max_len: usize) -> String {
    let length = text.chars().count();
    if length <= max_len {
        return text.to_string();
    }
    if max_len <= 1 {
        return text.chars().take(max_len).collect();
    }
    format!("{}…", text.chars().take(max_len - 1).collect::<String>())
}

fn render_screen_line(choice: &AppScreenInfo, cursor: &str, width: usize) -> String {
    let right_pad = 2;
    let min_gap = 2;
    let left = format!("{cursor} {}", choice.title);
    let left_length = left.chars().count();
    let desc_space = 10.max(width as i64 - left_length as i64 - right_pad) as usize;
    let description = truncate(choice.description, desc_space);
    let gap = min_gap.max(desc_space.saturating_sub(description.chars().count()));
    format!("{left}{}{description}", " ".repeat(gap))
}

fn filter_screens(search_term: &str) -> Vec<&'static AppScreenInfo> {
    let term = search_term.trim().to_lowercase();
    APP_SCREENS_INFO
        .iter()
        .filter(|screen| {
            term.is_empty()
                || screen.title.to_lowercase().contains(&term)
                || screen.description.to_lowercase().contains(&term)
        })
        .collect()
}

fn render_prompt(filtered: &[&AppScreenInfo], active: usize, search_term: &str) -> Vec<String> {
    let width = crossterm::terminal::size()
        .map(|(columns, _)| columns as usize)
        .unwrap_or(80);

    let mut lines = vec![
        format!("{} {} {}", "?".blue(), MESSAGE.bold(), search_term.cyan())
            .trim_end()
            .to_string(),
    ];

    if filtered.is_empty() {
        lines.push("> No screens match your search.".red().to_string());
    } else {
        let start = if active < PAGE_SIZE {
            0
        } else {
            active + 1 - PAGE_SIZE
        };
        for (index, screen) in filtered.iter().enumerate().skip(start).take(PAGE_SIZE) {
            if index == active {
                lines.push(render_screen_line(screen, "❯", width).cyan().to_string());
            } else {
                lines.push(render_screen_line(screen, " ", width));
            }
        }
    }

    lines.push(" ".to_string());
    lines.push(
        "↑↓ navigate • type to search • ⏎ select"
            .dimmed()
            .to_string(),
    );
    lines
}

fn clear_previous(out: &mut impl Write, previous_lines: usize) -> std::io::Result<()> {
    if previous_lines > 1 {
        execute!(out, MoveUp((previous_lines - 1) as u16))?;
    }
    execute!(out, MoveToColumn(0), Clear(ClearType::FromCursorDown))
}

fn run_picker(out: &mut impl Write) -> std::io::Result<Option<AppScreenType>> {
    let mut search_term = String::new();
    let mut active = 0;
    let mut previous_lines = 0;

    loop {
        let filtered = filter_screens(&search_term);
        clear_previous(out, previous_lines)?;
        let lines = render_prompt(&filtered, active, &search_term);
        write!(out, "{}", lines.join("\r\n"))?;
        out.flush()?;
        previous_lines = lines.len();

        let Event::Key(key) = read()? else {
            continue;
        };
        if key.kind == KeyEventKind::Release {
            continue;
        }

        match key.code {
            KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                clear_previous(out, previous_lines)?;
                return Ok(None);
            }
            KeyCode::Esc => {
                clear_previous(out, previous_lines)?;
                return Ok(None);
            }
            KeyCode::Enter => {
                if let Some(selected) = filtered.get(active) {
                    clear_previous(out, previous_lines)?;
                    write!(
                        out,
                        "{} {} {}\r\n",
                        "✔".green(),
                        MESSAGE.bold(),
                        selected.title.cyan()
                    )?;
                    out.flush()?;
                    return Ok(Some(selected.screen_type));
                }
            }
            KeyCode::Up => {
                if active > 0 {
                    active -= 1;
                }
            }
            KeyCode::Down => {
                if active + 1 < filtered.len() {
                    active += 1;
                }
            }
            KeyCode::Backspace => {
                search_term.pop();
                active = 0;
            }
            KeyCode::Char(ch) if !key.modifiers.contains(KeyModifiers::CONTROL) => {
                search_term.push(ch);
                active = 0;
            }
            _ => {}
        }
    }
}

pub fn pick_screen() -> std::io::Result<Option<AppScreenType>> {
    let mut out = stdout();
    enable_raw_mode()?;
    execute!(out, Hide)?;
    let result = run_picker(&mut out);
    execute!(out, Show)?;
    disable_raw_mode()?;
    result
}
