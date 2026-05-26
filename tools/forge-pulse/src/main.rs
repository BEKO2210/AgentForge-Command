// forge-pulse — optional Rust accelerator for the AgentForge server.
//
// Stdin:  newline-separated JSON `{"id":"<agent>", "d":"<chunk>"}`
//         where the chunk is UTF-8 PTY output (Node decodes for us).
// Stdout: newline-separated JSON events, flushed eagerly:
//           {"t":"prompt","id":"<agent>","reason":"(y/n)","kind":"permission"}
//           {"t":"activity","id":"<agent>","kind":"working","reason":"chunk"}
//
// Zero external dependencies on purpose — keeps the binary small, the audit
// surface tiny, and makes Rust easy to drop in/out.

use std::collections::HashMap;
use std::io::{self, BufRead, Write};

struct AgentBuf {
    tail: String,
    last_activity_ms: u128,
}

const PROMPT_PATTERNS: &[(&str, &str)] = &[
    ("(y/n)",                   "permission"),
    ("[y/n]",                   "permission"),
    ("(yes/no)",                "permission"),
    ("[yes/no]",                "permission"),
    ("press enter to continue", "press-enter"),
    ("press any key",           "press-enter"),
    ("approve?",                "permission"),
    ("approve this?",           "permission"),
    ("do you want to",          "permission"),
    ("are you sure",            "permission"),
    ("continue?",               "permission"),
    ("confirm?",                "permission"),
    ("allow this to run",       "permission"),
    ("allow this tool to run",  "permission"),
];

fn matches_lower(tail: &str) -> Option<(&'static str, &'static str)> {
    for (pat, kind) in PROMPT_PATTERNS {
        if tail.contains(pat) { return Some((pat, kind)); }
    }
    None
}

fn parse_chunk(line: &str) -> Option<(&str, String)> {
    // Minimal JSON pulled apart by hand. Tuned for the exact shape the Node
    // server emits — `{"id":"...","d":"..."}`. Avoids the serde dep weight.
    let id = extract_string(line, "\"id\"")?;
    let d  = extract_string(line, "\"d\"")?;
    Some((id, unescape(d)))
}

fn extract_string<'a>(s: &'a str, key: &str) -> Option<&'a str> {
    let i = s.find(key)?;
    let rest = &s[i + key.len()..];
    let after_colon = rest.find(':')?;
    let rest = rest[after_colon + 1..].trim_start();
    let rest = rest.strip_prefix('"')?;
    // Walk until unescaped closing quote.
    let bytes = rest.as_bytes();
    let mut esc = false;
    let mut end: Option<usize> = None;
    for (i, b) in bytes.iter().enumerate() {
        if esc { esc = false; continue; }
        if *b == b'\\' { esc = true; continue; }
        if *b == b'"' { end = Some(i); break; }
    }
    end.map(|e| &rest[..e])
}

fn unescape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut it = s.chars();
    while let Some(c) = it.next() {
        if c == '\\' {
            match it.next() {
                Some('n')  => out.push('\n'),
                Some('t')  => out.push('\t'),
                Some('r')  => out.push('\r'),
                Some('"')  => out.push('"'),
                Some('\\') => out.push('\\'),
                Some('/')  => out.push('/'),
                Some(o)    => out.push(o),
                None       => {},
            }
        } else { out.push(c); }
    }
    out
}

fn now_ms() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    for c in s.chars() {
        match c {
            '"'  => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                out.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => out.push(c),
        }
    }
    out
}

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut out = stdout.lock();
    eprintln!("forge-pulse ready");

    let mut bufs: HashMap<String, AgentBuf> = HashMap::new();

    for line in stdin.lock().lines() {
        let line = match line { Ok(s) => s, Err(_) => break };
        if line.is_empty() { continue; }

        let Some((id, d)) = parse_chunk(&line) else { continue };
        let id = id.to_string();
        let agent = bufs.entry(id.clone()).or_insert(AgentBuf {
            tail: String::new(),
            last_activity_ms: 0,
        });
        agent.tail.push_str(&d.to_lowercase());
        if agent.tail.len() > 2048 {
            let cut = agent.tail.len() - 1024;
            agent.tail.drain(..cut);
        }

        // Activity classifier — anything alphabetic counts. Rate-limit so a
        // hot PTY doesn't flood the UI with activity pings.
        let now = now_ms();
        if d.chars().any(|c| c.is_alphanumeric()) && now - agent.last_activity_ms > 750 {
            agent.last_activity_ms = now;
            let _ = writeln!(out,
                "{{\"t\":\"activity\",\"id\":\"{}\",\"kind\":\"working\",\"reason\":\"chunk\"}}",
                json_escape(&id));
            let _ = out.flush();
        }

        // Prompt detection — literal-substring on a 2KB rolling tail.
        if let Some((pat, kind)) = matches_lower(&agent.tail) {
            agent.tail.clear();
            let _ = writeln!(out,
                "{{\"t\":\"prompt\",\"id\":\"{}\",\"reason\":\"{}\",\"kind\":\"{}\"}}",
                json_escape(&id), json_escape(pat), kind);
            let _ = out.flush();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_y_n_prompt() {
        assert!(matches_lower("waiting for input — continue? (y/n)").is_some());
    }
    #[test]
    fn detects_press_enter() {
        let m = matches_lower("press enter to continue").unwrap();
        assert_eq!(m.1, "press-enter");
    }
    #[test]
    fn ignores_plain_text() {
        assert!(matches_lower("hello world, nothing to see here").is_none());
    }
    #[test]
    fn parses_chunk() {
        let (id, d) = parse_chunk(r#"{"id":"lead","d":"continue? (y/n)\n"}"#).unwrap();
        assert_eq!(id, "lead");
        assert!(d.contains("(y/n)"));
    }
    #[test]
    fn json_escape_quotes() {
        assert_eq!(json_escape("a\"b"), "a\\\"b");
        assert_eq!(json_escape("a\nb"), "a\\nb");
    }
}
