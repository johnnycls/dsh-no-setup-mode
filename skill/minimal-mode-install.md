# Skill: Install Minimal Mode (dsh-minimal-mode)

Use this skill when the user asks for any of the following (or variants):

- "set it up for me" / "configure it for me" / "out of the box"
- "install minimal mode" / "minimal mode plugin" / "simplify the UI"
- "I don't want to configure anything" / "simple mode"

## Goal

**Permanently install** the Minimal Mode plugin for DeepSeek Harness: hides the advanced UI, keeps only chat essentials, and auto-applies the best defaults (Chat Mode, Enter-to-interrupt, agent preset). Installed once via the DSH profile — no re-installation needed after restarts.

## Prerequisites

- This repository is cloned into the workspace (e.g. `dsh-minimal-mode/`), containing `cordis.patch.yml`, `lib/index.js`, `lib/client.js`, and `package.json`.
- If the directory is missing, clone it first:
  ```bash
  git clone https://github.com/johnnycls/dsh-minimal-mode.git
  ```

## Steps

1. **Install the bundle plugin** from the repository directory (permanent profile install):
   ```bash
   dsh plugin add github:johnnycls/dsh-minimal-mode
   ```
   - If the `dsh plugin` command rejects the git spec, fall back to `dsh plugin add ./dsh-minimal-mode` (from a directory that contains this repo), or ask the user to add the package to their profile bundles manually and restart.
2. **Tell the user to restart DSH** (bundles load at startup).
3. **After restart, verify**:
   - The page auto-enters minimal mode: no Logo, a header with only three mode buttons (Chat / Work / Expert), a 3-row composer with a round send button.
   - `~/.dsh/settings.yaml` contains `agent-presets.default: chat` and `ui-conversation.busyEnter: steer` (written by the client on entering minimal mode).
   - `~/.dsh/.agent-presets/` contains `chat` / `work` / `expert` directories (created by the host plugin).

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
