// ============================================================================
// dsh-minimal-mode — DeepSeek Harness 極簡模式（Host 插件）
// ----------------------------------------------------------------------------
// 永久安裝於 profile 的 bundle 插件（透過 bundle patch 載入）。
// 職責：
//   - 安裝時自動建立極簡專屬 Agent 預設（聊天/工作/專家），永久存在
//   - 聊天模式補上聯網工具（tool-web）
//   - 餘額端點：GET /minimal-mode/balance —— 讀取 DEEPSEEK_API_KEY，
//     呼叫 DeepSeek 餘額 API 後回傳 JSON（client 每輪對話結束時同源 fetch）
// 其餘邏輯（UI、設置、模式切換）在 client 半邊（lib/client.js），
// 透過官方 API 通道（settings / credentials / agentPresets / sessions）完成。
//
// 注意：apiproxy 只暴露 allowlist 內的 settings namespace（WEB_SETTINGS_
// NAMESPACES + model providers + product），第三方 ns 對 web client 不可見
// （settings-not-exposed），因此餘額改用自訂 HTTP 端點而非 settings。
// ============================================================================
import { appendFileSync } from 'node:fs'

export const name = 'dsh-minimal-mode'

/**
 * 依賴宣告：cordis 會等這些服務註冊後才 apply 本插件。
 * （bundle loader 並行載入插件，無 inject 時可能比基礎服務更早 apply，
 * 導致 ctx.get 全部 undefined —— 靜默失效。）
 */
export const inject = ['credentials', 'agentPresets', 'webServer']

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

/** 餘額端點路徑（client 同源 fetch）。 */
export const BALANCE_PATH = '/minimal-mode/balance'

/** 診斷日誌（臨時；確認端點正常後移除）。 */
const HOST_LOG = '/home/johnny/.dsh/.dsh-minimal-mode.log'
const log = (message) => {
  try { appendFileSync(HOST_LOG, `[${new Date().toISOString()}] ${message}\n`) } catch (error) { /* 忽略 */ }
}

export function apply(ctx) {
  const agentPresets = ctx.get('agentPresets')
  const subprocess = ctx.get('subprocess')
  const credentials = ctx.get('credentials')
  const webServer = ctx.get('webServer')
  log(`apply start credentials=${credentials !== undefined} agentPresets=${agentPresets !== undefined} webServer=${webServer !== undefined}`)

  const wsRoot = ctx.get('sandboxPolicy')?.workspaceRoot ?? process.cwd()

  // 確保三個極簡 preset 存在（不存在才複製；聊天模式額外補聯網工具）
  const ensurePresets = async () => {
    if (agentPresets === undefined) {
      log('ensurePresets: agentPresets undefined, skip')
      return
    }
    const list = await agentPresets.list()
    const have = new Set(list.map((entry) => entry.id))
    for (const spec of MINIMAL_PRESETS) {
      if (have.has(spec.id)) continue
      log(`ensurePresets: copy ${spec.from} -> ${spec.id}`)
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

  const disposers = []

  // ---- 餘額端點：每次請求現拉 DeepSeek 餘額 ----
  if (webServer !== undefined) {
    try {
      disposers.push(webServer.register({
        kind: 'exact',
        path: BALANCE_PATH,
        handler: async (req, res) => {
          const send = (body) => {
            try {
              res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
              res.end(JSON.stringify(body))
            } catch (error) { /* 客戶端已斷線 */ }
          }
          try {
            if (credentials === undefined) return send({ ok: false, configured: false })
            const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
            if (resolved === undefined) return send({ ok: false, configured: false })
            const response = await fetch(BALANCE_URL, {
              headers: { Authorization: `Bearer ${resolved.value}`, Accept: 'application/json' },
              signal: AbortSignal.timeout(10000),
            })
            if (!response.ok) return send({ ok: false, error: `balance http ${response.status}` })
            const data = await response.json()
            const infos = Array.isArray(data.balance_infos) ? data.balance_infos : []
            const cny = infos.find((info) => info.currency === 'CNY')
            const total = cny !== undefined ? Number(cny.total_balance) : Number.NaN
            const cnyText = Number.isFinite(total) ? total.toFixed(2) : '0.00'
            const usdText = Number.isFinite(total) ? (total / USD_PER_CNY).toFixed(2) : '0.00'
            log(`balance ok cny=${cnyText}`)
            send({ ok: true, cny: cnyText, usd: usdText, updatedAt: Date.now() })
          } catch (error) {
            log(`balance error ${error instanceof Error ? error.message : String(error)}`)
            send({ ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      }))
      log('balance route registered')
    } catch (error) {
      log(`balance route FAILED: ${error instanceof Error ? error.message : String(error)}`)
    }
  } else {
    log('webServer undefined, balance route not registered')
  }

  return () => {
    disposers.forEach((dispose) => {
      try { dispose() } catch (error) { /* 忽略清理錯誤 */ }
    })
  }
}
