# DeepSeek Harness Minimal Mode (dsh-minimal-mode)

> **Out-of-the-box after install — let it make the best setup for you.**

**中文版（Chinese version）：[README.zh.md](./README.zh.md)**

A "Minimal Mode" plugin for DeepSeek Harness: hides the advanced UI, keeps only chat essentials, and auto-applies the best defaults (model, agent preset, input behavior). **Permanently installed — survives restarts.**

---

## What is this

Minimal Mode turns DSH into a "just open and chat" tool:

- **Auto-enters minimal mode** after install — no manual setup required
- Auto-applies the best defaults: **Chat Mode** (minimal + web + DeepSeek-V4-Flash), **Enter-to-interrupt** while busy, and the **agent preset**
- Hides Logo, conversation/trajectory tabs, Session Log, extra composer buttons, and every settings page
- The minimal settings dialog keeps only: language, DeepSeek API key, and exit minimal mode
- In normal mode, the only change is an "Enter Minimal Mode" button at the bottom of General Settings

## Who is it for

- **People who don't want to configure anything** — no studying models, presets, sandbox, or options; install, open, and start chatting
- People who want an **out-of-the-box** experience — every launch starts in minimal mode
- People distracted by a complex UI — just focus on the conversation
- People who want DSH to make the decisions for them

**Not for you** if you regularly need trajectory view, Session Log, subagent catalog, or manual model selection.

## When to use it

- Fresh DSH install — say "**set it up for me**", "**out of the box**", or "**install minimal mode**" to your agent; it will install the plugin for you
- You want a clean, distraction-free daily chat surface
- You want DSH to decide the best defaults itself

---

## Features

### Best setup applied automatically
- Entering minimal mode automatically: selects **Chat Mode** (minimal + web + DeepSeek-V4-Flash), sets the default agent preset, and switches busy Enter to **interrupt-and-send** (`busyEnter: steer`)
- All settings are written to the official settings store — identical to manual configuration, inspectable in normal mode at any time

### Hidden in minimal mode
| Element | How |
|---|---|
| Logo | CSS |
| Conversation/trajectory tabs, Session Log | Replaced header (minimal header shows only mode buttons) |
| Extra composer buttons | Replaced composer (keeps send/stop) |
| All settings pages, open-config button | Replaced settings panel (minimal settings dialog) |

### Minimal settings dialog (⚙ at the sidebar foot)
- **Language** (applies immediately)
- **DeepSeek API key**: auto-saved on blur (with format validation), plus a link to get a key
- **Exit minimal mode** button

### Minimal header: three modes
| Mode | Base | Model |
|---|---|---|
| Chat Mode | Minimal + web (`web_search` / `web_fetch`) | DeepSeek-V4-Flash |
| Work Mode | Standard | DeepSeek-V4-Flash |
| Expert Mode | PTC (Code Mode) | DeepSeek-V4-Pro |

Clicking a mode switches the default agent preset and the model.

### Normal mode (after leaving minimal)
The only change: an **"Enter Minimal Mode"** button at the bottom of General Settings — re-enter any time. Everything else stays untouched.

---

## Installation (permanent)

### Let your agent install it

```bash
git clone https://github.com/johnnycls/dsh-minimal-mode.git
```

Then tell your DSH agent: "**set it up for me**", "**install minimal mode**", or "**out of the box**".

The agent will:
1. Run `dsh plugin add github:johnnycls/dsh-minimal-mode` in this repository (or you can run it manually)
2. Restart DSH if needed
3. Verify minimal mode is active

> Tip: put `skill/極簡模式.md` (or an English copy) into your agent preset's `skills/` directory — then any session saying "set it up for me" will auto-trigger installation.

Manual alternative: `dsh plugin add github:johnnycls/dsh-minimal-mode` from this repository.

### Permanence

This is a **profile bundle plugin** (installed via `cordis.patch.yml` into your DSH profile) — **installed once, permanent**, survives DSH restarts. No re-installation needed.

---

## Usage

| Action | Result |
|---|---|
| Open DSH | Auto-enters minimal mode, auto-selects Chat Mode |
| ⚙ (sidebar foot) | Minimal settings: language, API key, exit minimal mode |
| Three header buttons | Switch Chat / Work / Expert modes (with model switch) |
| Round button | Send; turns into Stop (interrupt) while the agent is running |
| Exit minimal mode | Current session returns to the full UI; next launch re-enters minimal |

## Uninstall

1. Tell your agent "remove the minimal mode plugin" or run `dsh plugin remove dsh-minimal-mode` manually, then restart DSH
2. The work/expert presets are created by the plugin; Chat Mode persists to keep web tools — delete `~/.dsh/.agent-presets/chat` (and the work/expert dirs) manually if you want them gone

---

## Notes

- **Chat Mode persists**: the `chat` preset with web tools lives in `~/.dsh/.agent-presets/`, so normal mode's agent list shows "Chat Mode". Delete the directory if you don't want it listed (the plugin will try to recreate it with web tools on next entry).
- **Logo hiding depends on CSS Modules naming** (`[class$="_logoRow"]`) — a major DSH upgrade that changes CSS naming may break only this cosmetic part; everything else is unaffected.
- **Model names**: `deepseek-v4-flash` / `deepseek-v4-pro` are the built-in DeepSeek catalog models. If your deployment uses different ids, adjust `MINIMAL_PRESETS` in `lib/index.js` and `MODEL_BY_PRESET` in `lib/client.js`.
- The plugin does **not** configure your API key for you — enter your own key in the minimal settings dialog.

## License

MIT
