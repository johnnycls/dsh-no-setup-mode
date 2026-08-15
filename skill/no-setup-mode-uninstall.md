# Skill: Uninstall No-Setup Mode (dsh-no-setup-mode)

Use this skill when the user asks for any of the following (or variants):

- "remove the no-setup mode plugin" / "uninstall no-setup mode"
- "undo the setup" / "restore the original UI" / "get rid of the no-setup mode"
- "delete dsh-no-setup-mode"

## Goal

Cleanly remove the No-Setup Mode plugin and every trace it left behind, restoring DSH to its pre-install state.

## Steps

1. **Remove the bundle plugin**:
   ```bash
   dsh plugin remove dsh-no-setup-mode
   ```
   If the command is unavailable, ask the user to remove `dsh-no-setup-mode` from their profile bundles manually.

2. **Tell the user to restart DSH** (bundles load at startup).

3. **Delete the presets the plugin created** — only those whose `preset.yml` name matches `免設置：聊天模式` / `免設置：工作模式` / `免設置：專家模式` (never delete user-authored presets with the same directory name):
   ```bash
   for d in chat work expert; do
     if [ -f "$HOME/.dsh/.agent-presets/$d/preset.yml" ] && grep -qE 'name: 免設置：(聊天模式|工作模式|專家模式)' "$HOME/.dsh/.agent-presets/$d/preset.yml"; then
       rm -rf "$HOME/.dsh/.agent-presets/$d"
     fi
   done
   ```

4. **Restore settings the plugin changed** (edit `~/.dsh/settings.yaml` with a text tool or the settings surface):
   - `agent-presets.default`: if it is `chat` / `work` / `expert`, remove the field (falls back to the deployment default) or set it back to the user's previous choice.
   - `ui-conversation.busyEnter`: if it is `steer`, remove the field or restore the user's previous value (default is `queue`).
   - `agent-default-model`: if it was changed by the plugin, restore the user's previous model if known; otherwise leave it (the plugin only switched to `deepseek-v4-flash`).

5. **Verify**:
   - No "Enter No-Setup Mode" button remains in General Settings.
   - No no-setup UI appears on launch.
   - `~/.dsh/.agent-presets/` no longer contains `chat` / `work` / `expert` (unless the user had their own presets there — those were preserved by the name check above).

## Notes for the agent

- Only delete presets whose `preset.yml` name matches the plugin's names — user-authored presets with the same directory ids must be preserved.
- Do not touch other settings or plugins.
