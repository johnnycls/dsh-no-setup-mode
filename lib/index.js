// ============================================================================
// dsh-no-setup-mode — DeepSeek Harness 免設置模式（Host 插件）
// ----------------------------------------------------------------------------
// 永久安裝於 profile 的 bundle 插件（透過 bundle patch 載入）。
// 職責：
//   - 安裝時自動建立免設置專屬 Agent 預設（聊天/工作/專家），永久存在
//   - 聊天模式補上聯網工具（tool-web）
//   - 餘額端點：GET /no-setup-mode/balance —— 讀取 DEEPSEEK_API_KEY，
//     呼叫 DeepSeek 餘額 API 後回傳 JSON（client 每輪對話結束時同源 fetch）
// 其餘邏輯（UI、設置、模式切換）在 client 半邊（lib/client.js），
// 透過官方 API 通道（settings / credentials / agentPresets / sessions）完成。
//
// 注意：apiproxy 只暴露 allowlist 內的 settings namespace（WEB_SETTINGS_
// NAMESPACES + model providers + product），第三方 ns 對 web client 不可見
// （settings-not-exposed），因此餘額改用自訂 HTTP 端點而非 settings。
// 安全：端點僅監聽於 DSH 的 loopback 位址，回傳內容只有餘額數字（不含
// API key）；任何請求都會現拉 DeepSeek 餘額，故僅接受 GET。
// ============================================================================

export const name = 'dsh-no-setup-mode'

/**
 * 依賴宣告：cordis 會等這些服務註冊後才 apply 本插件。
 * （bundle loader 並行載入插件，無 inject 時可能比基礎服務更早 apply，
 * 導致 ctx.get 全部 undefined —— 靜默失效。）
 * webServer 對 web profile 必然存在（client 半邊依賴 web 平台）。
 */
export const inject = ['settings', 'credentials', 'agentPresets', 'webServer']

/**
 * 免設置專屬 Agent 預設。名稱分層：id 為 key（chat/work/expert）；
 * name 為設置頁顯示的中英雙語名（免設置：聊天（Chat）等）。
 * 聊天 = shipped minimal preset + 聯網 + Flash（思考 off）；工作 = 標準 + Flash（思考 high）；
 * 專家 = PTC + Pro（思考 max）。
 */
export const MINIMAL_PRESETS = [
  { id: 'chat', from: 'minimal', name: '免設置：聊天（Chat）', extraWeb: true, persistent: true },
  { id: 'work', from: 'standard', name: '免設置：工作（Work）' },
  { id: 'expert', from: 'code', name: '免設置：專家（Expert）' },
]

/** 模式 → 模型 + 思考強度（寫入 agent-default-model；DeepSeek 支援 off / high / max）。 */
const PRESET_SPECS = {
  chat: { model: 'deepseek-v4-flash', reasoningEffort: 'off' },
  work: { model: 'deepseek-v4-flash', reasoningEffort: 'high' },
  expert: { model: 'deepseek-v4-pro', reasoningEffort: 'max' },
}

/** DeepSeek 餘額 API。 */
const BALANCE_URL = 'https://api.deepseek.com/user/balance'

/** 餘額端點路徑（client 同源 fetch）。 */
export const BALANCE_PATH = '/no-setup-mode/balance'

/** 模型切換端點路徑（client POST；agent-default-model 不在 apiproxy allowlist）。 */
export const MODEL_PATH = '/no-setup-mode/model'

export function apply(ctx) {
  const agentPresets = ctx.get('agentPresets')
  const subprocess = ctx.get('subprocess')
  const credentials = ctx.get('credentials')
  const webServer = ctx.get('webServer')

  const wsRoot = ctx.get('sandboxPolicy')?.workspaceRoot ?? process.cwd()

  // 確保三個免設置 preset 存在（不存在才複製；名稱過時（舊版）時重建；聊天模式額外補聯網工具）
  const ensurePresets = async () => {
    if (agentPresets === undefined) return
    const list = await agentPresets.list()
    const byId = new Map(list.map((entry) => [entry.id, entry]))
    for (const spec of MINIMAL_PRESETS) {
      const existing = byId.get(spec.id)
      if (existing !== undefined && existing.name === spec.name) continue
      if (existing !== undefined) {
        // 舊版名稱（或名稱不符）：重建，避免殘留舊命名
        await agentPresets.remove(spec.id)
      }
      await agentPresets.copy(spec.from, spec.id, spec.name)
      if (spec.extraWeb === true && subprocess !== undefined) {
        try {
          const composition = await agentPresets.read(spec.id)
          if (composition.indexOf('tool-web') === -1) {
            const resolved = await agentPresets.resolve(spec.id)
            const handle = subprocess.spawn({
              argv: ['bash', '-c', 'cat >> "$1"', 'no-setup-chat-web', resolved.path + '/agent.cordis.yml'],
              cwd: wsRoot,
              stdio: { stdin: 'pipe', stdout: 'collect', stderr: 'collect' },
              graceMs: 15000,
            })
            handle.stdin.write('\n# ── web（聯網）──────────────────────────────────────────\n- id: tool-web\n  name: \'@deepseek-ai/dsh-tool-web\'\n')
            handle.stdin.end()
            const outcome = await handle.done
            if (outcome.exitCode !== 0) console.error('dsh-no-setup-mode: append web to chat failed (sandbox 限制；可由安裝流程補上)')
          }
        } catch (error) {
          console.error('dsh-no-setup-mode: append web to chat error', error)
        }
      }
    }
  }
  ensurePresets().catch((error) => {
    console.error('dsh-no-setup-mode: ensurePresets failed', error)
  })

  const disposers = []

  // ---- 餘額端點：每次 GET 現拉 DeepSeek 餘額 ----
  if (webServer !== undefined) {
    try {
      disposers.push(webServer.register({
        kind: 'exact',
        path: BALANCE_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'method not allowed' }))
            return
          }
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
            // 透傳每個幣種的實際餘額（DeepSeek 同時返回 USD 與 CNY，不做匯率換算）
            const balances = infos.map((info) => ({
              currency: String(info.currency),
              total: Number(info.total_balance),
            }))
            send({ ok: true, balances, updatedAt: Date.now() })
          } catch (error) {
            send({ ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      }))
    } catch (error) {
      console.error('dsh-no-setup-mode: balance route register failed', error)
    }
  }

  // ---- 模型切換端點：POST /no-setup-mode/model ----
  // agent-default-model 不在 apiproxy allowlist（settings-not-exposed），client 無法直接寫，
  // 因此由 host 代寫。CSRF 防禦：僅接受 loopback 來源的 Origin（無 Origin 的非瀏覽器請求允許）。
  if (webServer !== undefined) {
    try {
      disposers.push(webServer.register({
        kind: 'exact',
        path: MODEL_PATH,
        handler: async (req, res) => {
          const send = (status, body) => {
            try {
              res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
              res.end(JSON.stringify(body))
            } catch (error) { /* 客戶端已斷線 */ }
          }
          const origin = req.headers.origin
          if (origin !== undefined && origin !== '' && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
            return send(403, { ok: false, error: 'forbidden origin' })
          }
          if (req.method !== 'POST') return send(405, { ok: false, error: 'method not allowed' })
          let raw = ''
          for await (const chunk of req) raw += chunk
          let payload = {}
          try { payload = JSON.parse(raw) } catch (error) { return send(400, { ok: false, error: 'invalid json' }) }
          const spec = PRESET_SPECS[payload.preset]
          if (spec === undefined) return send(400, { ok: false, error: `unknown preset "${payload.preset}"` })
          try {
            await settings.update('agent-default-model', {
              provider: 'deepseek-official',
              model: spec.model,
              reasoningEffort: spec.reasoningEffort,
            })
            send(200, { ok: true, preset: payload.preset, model: spec.model, reasoningEffort: spec.reasoningEffort })
          } catch (error) {
            send(500, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      }))
    } catch (error) {
      console.error('dsh-no-setup-mode: model route register failed', error)
    }
  }

  return () => {
    disposers.forEach((dispose) => {
      try { dispose() } catch (error) { /* 忽略清理錯誤 */ }
    })
  }
}
