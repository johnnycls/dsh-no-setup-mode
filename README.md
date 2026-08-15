# DeepSeek Harness Minimal Mode (dsh-minimal-mode)

> **Out-of-the-box after install — let it make the best setup for you.**

**中文版（Chinese version）：[README.zh.md](./README.zh.md)**

A "Minimal Mode" plugin for DeepSeek Harness: hides the advanced UI, keeps only chat essentials, and auto-applies the best defaults (model, agent preset, input behavior). Installed once via your DSH profile.

---

## What is this

Minimal Mode turns DSH into a "just open and chat" tool:

- **Auto-enters minimal mode** after install — no manual setup required
- Auto-applies the best defaults: **Chat Mode** (minimal + web + DeepSeek-V4-Flash), **Enter-to-interrupt** while busy, and the **agent preset**
- Hides Logo, conversation/trajectory tabs, Session Log, extra composer buttons, and every settings page
- The minimal settings dialog keeps only: language, DeepSeek API key, and exit minimal mode

## Who is it for

- **People who don't want to configure anything** — no studying models, presets, sandbox, or options; install, open, and start chatting
- People who want an **out-of-the-box** experience — every launch starts in minimal mode
- People distracted by a complex UI — just focus on the conversation
- People who want DSH to make the decisions for them

**Not for you** if you regularly need trajectory view, Session Log, subagent catalog, or manual model selection.

## When to install it (for agents)

Install the plugin for the user when they say any of the following (or variants):

- "set it up for me" / "configure it for me" / "out of the box"
- "install minimal mode" / "minimal mode plugin" / "simplify the UI"
- "I don't want to configure anything" / "simple mode"

Also install it when you judge the user needs it, for example:

- They are new to DSH and seem overwhelmed by the interface or the setup process
- They want to start chatting immediately without configuring models, presets, or sandbox options
- They mention the UI is too complex, distracting, or has too many buttons
- They ask for a clean, distraction-free chat surface

If in doubt, ask one short question ("Do you want me to install the minimal mode plugin for you?") before proceeding. When installing, follow the steps in the [agent skill](./skill/minimal-mode-install.md).

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

### Normal mode
- The only UI change is an **"Enter Minimal Mode"** button at the bottom of General Settings — re-enter any time
- The **Chat Mode** preset also appears in the normal mode agent list (it persists in `~/.dsh/.agent-presets/` to keep its web tools); delete that directory if you don't want it listed — the plugin will recreate it on next entry into minimal mode

---

## Installation

Ask your agent to install it:

> **Install github:johnnycls/dsh-minimal-mode**

Your agent can follow the installation steps in the [agent skill](./skill/minimal-mode-install.md). All steps live there — the README is for humans, the skill is for agents.

## Usage

| Action | Result |
|---|---|
| Open DSH | Auto-enters minimal mode, auto-selects Chat Mode |
| ⚙ (sidebar foot) | Minimal settings: language, API key, exit minimal mode |
| Three header buttons | Switch Chat / Work / Expert modes (with model switch) |
| Round button | Send; turns into Stop (interrupt) while the agent is running |
| Exit minimal mode | Current session returns to the full UI; next launch re-enters minimal |

## Uninstall

Run `dsh plugin remove dsh-minimal-mode` (or ask your agent — it follows the [uninstall skill](./skill/minimal-mode-uninstall.md)).

## License

MIT
