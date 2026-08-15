// ============================================================================
// dsh-minimal-mode — DeepSeek Harness 極簡模式（Host 插件）
// ----------------------------------------------------------------------------
// 永久安裝於 profile 的 bundle 插件（透過 cordis.patch.yml 載入）。
// 職責：
//   - 安裝時自動建立極簡專屬 Agent 預設（聊天/工作/專家），永久存在
//   - 聊天模式補上聯網工具（tool-web）
// 其餘邏輯（UI、設置、模式切換）在 client 半邊（lib/client.js），
// 透過官方 API 通道（settings / credentials / agentPresets / sessions）完成，
// 因此本插件不需要任何自訂 RPC。
// ============================================================================
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { z } from '@deepseek-ai/schemastery'

export const name = 'dsh-minimal-mode'

/** 極簡狀態 namespace（保留供未來擴展；「自動進入」由 client 恆啟用）。 */
export const MINIMAL_STATE_NS = settingsNamespace('minimal-mode')

/** 極簡專屬 Agent 預設：聊天 = 極簡 + 聯網 + Flash；工作 = 標準 + Flash；專家 = PTC + Pro。 */
export const MINIMAL_PRESETS = [
  { id: 'chat', from: 'minimal', name: '聊天模式', model: 'deepseek-v4-flash', extraWeb: true, persistent: true },
  { id: 'work', from: 'standard', name: '工作模式', model: 'deepseek-v4-flash' },
  { id: 'expert', from: 'code', name: '專家模式', model: 'deepseek-v4-pro' },
]

export function apply(ctx) {
  const settings = ctx.get('settings')
  const agentPresets = ctx.get('agentPresets')
  const subprocess = ctx.get('subprocess')

  // 註冊極簡狀態 namespace（schema 極簡，僅標記安裝）
  try {
    settings.register(
      MINIMAL_STATE_NS,
      z.object({ installed: z.boolean().default(true) }),
    )
  } catch (error) {
    // 已註冊或 provider 缺位時忽略——不影響功能
  }

  const wsRoot = ctx.get('sandboxPolicy')?.workspaceRoot ?? process.cwd()

  // 確保三個極簡 preset 存在（不存在才複製；聊天模式額外補聯網工具）
  const ensurePresets = async () => {
    if (agentPresets === undefined) return
    const list = await agentPresets.list()
    const have = new Set(list.map((entry) => entry.id))
    for (const spec of MINIMAL_PRESETS) {
      if (have.has(spec.id)) continue
      await agentPresets.copy(spec.from, spec.id, spec.name)
      if (spec.extraWeb === true && subprocess !== undefined) {
        try {
          const composition = await agentPresets.read(spec.id)
          if (composition.indexOf('tool-web') === -1) {
            const resolved = await agentPresets.resolve(spec.id)
            const handle = subprocess.spawn({
              argv: ['bash', '-c', 'cat >> "$1"', 'minimal-chat-web', resolved.path + '/agent.cordis.yml'],
              cwd: wsRoot,
              stdio: { stdin: 'pipe', stdout: 'collect', stderr: 'collect' },
              graceMs: 15000,
            })
            handle.stdin.write('\n# ── web（聯網）──────────────────────────────────────────\n- id: tool-web\n  name: \'@deepseek-ai/dsh-tool-web\'\n')
            handle.stdin.end()
            const outcome = await handle.done
            if (outcome.exitCode !== 0) console.error('dsh-minimal-mode: append web to chat failed (sandbox 限制；可由安裝流程補上)')
          }
        } catch (error) {
          console.error('dsh-minimal-mode: append web to chat error', error)
        }
      }
    }
  }
  ensurePresets().catch((error) => {
    console.error('dsh-minimal-mode: ensurePresets failed', error)
  })
}
