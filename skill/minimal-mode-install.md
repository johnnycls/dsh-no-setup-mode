# Skill: Install Minimal Mode (dsh-minimal-mode)

Use this skill when the user asks for any of the following (or variants):

- "set it up for me" / "configure it for me" / "out of the box"
- "install minimal mode" / "minimal mode plugin" / "simplify the UI"
- "I don't want to configure anything" / "simple mode"

## Goal

**Permanently install** the Minimal Mode plugin for DeepSeek Harness: hides the advanced UI, keeps only chat essentials, and auto-applies the best defaults (Chat Mode, Enter-to-interrupt, agent preset). Installed once via the DSH profile — no re-installation needed after restarts.

## Prerequisites

- `git` is installed and GitHub is reachable (the repo is **public** — no authentication or token needed).
- The DSH CLI works (`dsh --version`).
- **Never install from a local path** (`dsh plugin add ./dsh-minimal-mode` or `pnpm add /abs/path/to/dsh-minimal-mode`): a local-path install creates a symlink whose realpath breaks dependency resolution inside the profile, and the plugin fails to load at boot. **Always install from the GitHub spec** (`github:johnnycls/dsh-minimal-mode`).
- If you need the repo checked out for reference, clone it:
  ```bash
  git clone https://github.com/johnnycls/dsh-minimal-mode.git
  ```

## Steps

1. **Install the bundle plugin** from the GitHub spec (permanent profile install):
   ```bash
   dsh plugin add github:johnnycls/dsh-minimal-mode
   ```
2. **Tell the user to restart DSH** — bundles load at startup. The host half of this plugin only activates on restart; a browser refresh alone is NOT enough.
3. **After restart, verify**:
   - The page auto-enters minimal mode: no Logo, a header with only three mode buttons (Chat / Work / Expert), a 3-row composer with a round send button.
   - `~/.dsh/settings.yaml` contains `ui-conversation.busyEnter: steer` (written by the client on entering minimal mode).
   - `~/.dsh/.agent-presets/` contains `chat` / `work` / `expert` directories (created by the host plugin).
   - If a DeepSeek API key is set, a balance line (`$… USD · ¥… CNY`) appears right-aligned under the composer.

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `dsh plugin add` fails with a pnpm/corepack error (e.g. `COREPACK_HOME`, `EACCES`, "Cannot find module 'pnpm'") | `dsh plugin` forwards to pnpm. Point corepack at a writable directory and retry: `export COREPACK_HOME="$HOME/.cache/node/corepack"` then rerun `dsh plugin add github:johnnycls/dsh-minimal-mode`. |
| Install succeeds but nothing changes after restart | Hard-refresh the browser (Ctrl+Shift+R). If still nothing, open the browser console and look for `dsh-minimal-mode:` errors. |
| No `chat` / `work` / `expert` in `~/.dsh/.agent-presets/` (host half did not load) | Verify the install: `ls ~/.dsh/profiles/web/node_modules/dsh-minimal-mode` and `dsh --profile web --dump-config \| grep -A2 'minimal-mode'` (the merged config must contain `- id: minimal-mode`). Then restart DSH again. |
| Minimal UI appears but no balance line | No DeepSeek API key is set yet. Open ⚙ in the sidebar, paste the key, and the balance appears (the endpoint answers `configured: false` until a key exists). |
| `dsh plugin add` cannot resolve `github:...` | Check `git --version` and network access to github.com. |
| Chat Mode has no web tools | The host plugin appends `tool-web` automatically; if that write was blocked by a sandbox, append it manually (see "Supplementary" below). |

## Updating

```bash
dsh plugin update dsh-minimal-mode
```

Then tell the user to restart DSH.

## Supplementary: web tools for Chat Mode

If `chat`'s `agent.cordis.yml` lacks `tool-web` (the host plugin's write may be blocked by the sandbox), append it with bash (escalate permissions if necessary):

```bash
cat >> ~/.dsh/.agent-presets/chat/agent.cordis.yml <<'EOF'

# ── web（聯網）──────────────────────────────────────────
- id: tool-web
  name: '@deepseek-ai/dsh-tool-web'
EOF
```

## Notes for the agent

- This is a **formal profile bundle plugin** (permanent), not a dynamic plugin — do **not** install it with `cordis_define` unless the user explicitly asks for a temporary install.
- Do not modify `lib/` or `cordis.patch.yml` unless the user explicitly asks.
- The user-facing README is for humans; keep installation steps here in this skill.
