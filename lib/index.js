// ============================================================================
// dsh-minimal-mode — DeepSeek Harness 極簡模式（Host 插件）
// ----------------------------------------------------------------------------
// 永久安裝於 profile 的 bundle 插件（透過 cordis.patch.yml 載入）。
// 職責：
//   - 安裝時自動建立極簡專屬 Agent 預設（聊天/工作/專家），永久存在
//   - 聊天模式補上聯網工具（tool-web）
//   - 餘額快照：讀取 DEEPSEEK_API_KEY，呼叫 DeepSeek 餘額 API，寫入
//     minimal-balance namespace（client 顯示 USD/CNY）
// 其餘邏輯（UI、設置、模式切換）在 client 半邊（lib/client.js），
// 透過官方 API 通道（settings / credentials / agentPresets / sessions）完成，
// 因此本插件不需要任何自訂 RPC。
// ============================================================================
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-minimal-mode'

/** 極簡狀態 namespace（安裝標記 + client 每輪對話結束的刷新 tick）。 */
export const MINIMAL_STATE_NS = settingsNamespace('minimal-mode')

/** 餘額快照 namespace（host 寫入，client 讀取顯示）。 */
export const MINIMAL_BALANCE_NS = settingsNamespace('minimal-balance')

/** 極簡專屬 Agent 預設：聊天 = 極簡 + 聯網 + Flash；工作 = 標準 + Flash；專家 = PTC + Pro。 */
export const MINIMAL_PRESETS = [
  { id: 'chat', from: 'minimal', name: '聊天模式', model: 'deepseek-v4-flash', extraWeb: true, persistent: true },
  { id: 'work', from: 'standard', name: '工作模式', model: 'deepseek-v4-flash' },
  { id: 'expert', from: 'code', name: '專家模式', model: 'deepseek-v4-pro' },
]

/** 固定匯率：1 USD ≈ 7.15 CNY（餘額的 USD 為約略換算）。 */
const USD_PER_CNY = 7.15

/** DeepSeek 餘額 API。 */
const BALANCE_URL = 'https://api.deepseek.com/user/balance'

export function apply(ctx) {
  const settings = ctx.get('settings')
  const agentPresets = ctx.get('agentPresets')
  const subprocess = ctx.get('subprocess')
  const credentials = ctx.get('credentials')

  // 註冊極簡狀態 namespace（schema 極簡，僅標記安裝 + 刷新 tick）
  try {
    settings.register(
      MINIMAL_STATE_NS,
      z.object({ installed: z.boolean().default(true), refreshTick: z.number().default(0) }),
    )
  } catch (error) {
    // 已註冊或 provider 缺位時忽略——不影響功能
  }

  // 註冊餘額快照 namespace（host 每輪對話結束時刷新）
  try {
    settings.register(
      MINIMAL_BALANCE_NS,
      z.object({
        cny: z.string().default('0.00'),
        usd: z.string().default('0.00'),
        updatedAt: z.number().default(0),
        error: z.string().default(''),
      }),
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

  // ---- 餘額快照 ----------------------------------------------------------
  // 讀取 DEEPSEEK_API_KEY → 呼叫 DeepSeek 餘額 API → 寫入 minimal-balance ns。
  // 3 秒內不重複執行（防多事件同時觸發）。
  let lastBalanceAt = 0
  let balanceBusy = false
  const refreshBalance = async () => {
    if (settings === undefined) return
    const now = Date.now()
    if (now - lastBalanceAt < 3000 || balanceBusy) return
    balanceBusy = true
    lastBalanceAt = now
    const fail = async (error) => {
      try {
        await settings.update(MINIMAL_BALANCE_NS, {
          cny: '0.00',
          usd: '0.00',
          updatedAt: Date.now(),
          error: error instanceof Error ? error.message : String(error),
        })
      } catch (inner) {
        console.error('dsh-minimal-mode: balance write failed', inner)
      }
    }
    try {
      if (credentials === undefined) return
      const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
      if (resolved === undefined) return // 未設定 key：不更新（client 不顯示餘額行）
      const res = await fetch(BALANCE_URL, {
        headers: { Authorization: `Bearer ${resolved.value}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`balance http ${res.status}`)
      const data = await res.json()
      const infos = Array.isArray(data.balance_infos) ? data.balance_infos : []
      const cny = infos.find((info) => info.currency === 'CNY')
      const total = cny !== undefined ? Number(cny.total_balance) : Number.NaN
      await settings.update(MINIMAL_BALANCE_NS, {
        cny: Number.isFinite(total) ? total.toFixed(2) : '0.00',
        usd: Number.isFinite(total) ? (total / USD_PER_CNY).toFixed(2) : '0.00',
        updatedAt: Date.now(),
        error: '',
      })
    } catch (error) {
      await fail(error)
    } finally {
      balanceBusy = false
    }
  }

  const disposers = []
  // 啟動時先刷一次（key 已配置的話，進入極簡模式即可見餘額）
  refreshBalance().catch(() => {})
  // client 每輪對話結束時遞增 refreshTick → 刷新餘額
  disposers.push(ctx.on('settings/updated', (ns, next, prev) => {
    if (ns !== MINIMAL_STATE_NS) return
    const prevTick = prev !== undefined && prev !== null ? prev.refreshTick ?? 0 : 0
    const nextTick = next !== undefined && next !== null ? next.refreshTick ?? 0 : 0
    if (nextTick !== prevTick) refreshBalance().catch(() => {})
  }))
  // API key 設定/變更後立即刷新
  disposers.push(ctx.on('credentials/updated', (ref) => {
    if (ref === 'DEEPSEEK_API_KEY') refreshBalance().catch(() => {})
  }))

  return () => {
    disposers.forEach((dispose) => {
      try { dispose() } catch (error) { /* 忽略清理錯誤 */ }
    })
  }
}
