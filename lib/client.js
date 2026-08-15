// ============================================================================
// dsh-no-setup-mode — DeepSeek Harness 免設置模式（Client bundle）
// ----------------------------------------------------------------------------
// 手寫 ModuleLoader bundle（無需建置工具）：
//   window.__ModuleLoader__.load({ id, factory }) —
//   factory(require) 於 materialization 時執行並回傳 Cordis client 插件。
// 平台模塊（react / cordis）由瀏覽器模塊表解析；本 bundle 不 import 其他套件，
// 全部透過 ctx 服務與官方 API 通道（connection.api）運作。
// 功能：
//   - 安裝後自動進入免設置模式（enabled 恆啟用；「離開免設置模式」僅影響當前會話）
//   - 隱藏 Logo（CSS）、tab、Session Log、輸入框多餘按鈕、設置頁
//   - 免設置模式的設置 Dialog：語言 + DeepSeek API Key（格式校驗後保存）+ 離開
//   - 免設置模式的標題列：聊天 / 工作 / 專家 三模式切換（進入自動選聊天模式）
//   - 免設置模式的輸入列：3 行 textarea（Enter 送出 / 繁忙插話）+ shipped 圓形發送/停止按鈕
//   - 餘額顯示：輸入框下方右對齊（USD / CNY 各自實際餘額），每輪對話結束自動刷新
//   - 普通模式唯一改動：通用設置最底部的「進入免設置模式」按鈕
// ============================================================================
/**
 * MODE —— 與 lib/index.js 中的 MODE 對應（fork 本 repo 製作自己的模式插件時，
 * 兩處同步修改此物件 + package.json / cordis.patch.yml 即可，端點路徑與
 * 狀態檔名都由 code 派生，不會與其他插件衝突）。
 * 定義於 bundle 頂層：id: MODE.code 在 load 呼叫時即求值（早於 factory 執行）。
 */
const MODE = {
  code: 'no-setup-mode',
  nameZh: '免設置模式',
  nameEn: 'No-Setup Mode',
  presetPrefix: '免設置',
  presets: [
    { id: 'chat', nameSuffix: '聊天（Chat）' },
    { id: 'work', nameSuffix: '工作（Work）' },
    { id: 'expert', nameSuffix: '專家（Expert）' },
  ],
}

window.__ModuleLoader__.load({
  // ModuleLoader 註冊 id 必須等於 package.json 的 name（loader 按包名比對）；
  // 由 MODE.code 派生（dsh-<code>），fork 時改 code 即自動對應。
  id: `dsh-${MODE.code}`,
  factory: (require) => {
    const React = require('react')

    return {
      inject: ['slots', 'locale', 'connection'],
      apply(ctx) {
        const slots = ctx.get('slots')
        const locale = ctx.get('locale')
        if (slots === undefined) return

        // 官方 API 通道（connection.api；缺位時所有寫入安全降級）
        let api
        try {
          const connection = ctx.get('connection')
          api = connection !== undefined && connection !== null ? connection.api : undefined
        } catch (e) {
          api = undefined
        }
        const rpc = (call) => {
          if (call === undefined) return Promise.resolve({ ok: false })
          return call.then((res) => (
            res !== undefined && res !== null && res.result !== undefined ? res.result : { ok: false }
          )).catch(() => ({ ok: false }))
        }

        let enabled = true
        const listeners = new Set()
        const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
        const setEnabled = (v) => {
          if (v === enabled) return // 狀態無變化時不重跑 applyMode（避免無謂的 dispose + 重註冊）
          enabled = v
          listeners.forEach((fn) => fn())
        }

        // 進入免設置模式時的原 busyEnter（離開時恢復）
        let prevBusyEnter = 'queue'
        let prefsApplied = false

        // 固定幣種顯示順序（USD 在前、CNY 在後；其他幣種依字母序）——API 回傳順序不穩定
        const CURRENCY_ORDER = { USD: 0, CNY: 1 }

        // 取代型 single slot 的 shadow priority：shipped 註冊在 0，同 priority 會 throw；
        // 必須用更低 priority 註冊（最低者渲染），才能覆蓋設置頁 / 標題列 / 輸入列。
        const SHADOW_PRIORITY = -1000

        // ---- i18n：UI 文字隨用戶選擇的語言（locale 服務）切換 ----
        const STRINGS = {
          zh: {
            settings: '設置', close: '關閉', language: '語言',
            apiKey: 'DeepSeek API Key',
            keyConfiguredPlaceholder: '已設定（輸入以更換，離開輸入框自動保存）',
            keyPlaceholder: 'sk-…（離開輸入框自動保存）',
            noKeyYet: '還沒有 Key？', getKey: '點此獲取 →',
            keyBlank: 'Key 不能為空白', keyIllegal: 'Key 包含非法字符，請檢查後重新貼上',
            apiUnavailable: 'API 通道不可用，未保存', saveFailed: '保存失敗', saved: '已保存 ✓',
            exitMode: '離開免設置模式',
            modeChat: '聊天', modeWork: '工作', modeExpert: '專家',
            personaNone: '無人設', personaMaid: '女僕', personaButler: '管家',
            personaNoneFull: '無人設（不注入角色扮演提示詞）',
            personaMaidFull: '女僕（DeepSeek 鯨魚娘）',
            personaButlerFull: '管家（DeepSeek 男性）',
            placeholder: '輸入訊息，Enter 送出（Shift+Enter 換行）',
            busyPlaceholder: 'Agent 忙碌中… Enter 插話發送',
            send: '發送', stop: '停止', balanceError: '餘額獲取失敗',
            enterMode: '進入免設置模式',
            tagline: '開箱即用：隱藏複雜功能，只保留核心對話與必要設置',
          },
          en: {
            settings: 'Settings', close: 'Close', language: 'Language',
            apiKey: 'DeepSeek API Key',
            keyConfiguredPlaceholder: 'Configured (type to replace, auto-saves on blur)',
            keyPlaceholder: 'sk-… (auto-saves on blur)',
            noKeyYet: 'No key yet?', getKey: 'Get one →',
            keyBlank: 'Key cannot be blank', keyIllegal: 'Key contains invalid characters — please re-paste',
            apiUnavailable: 'API channel unavailable, not saved', saveFailed: 'Save failed', saved: 'Saved ✓',
            exitMode: 'Exit no-setup mode',
            modeChat: 'Chat', modeWork: 'Work', modeExpert: 'Expert',
            personaNone: 'None', personaMaid: 'Maid', personaButler: 'Butler',
            personaNoneFull: 'None (no role-play prompt injected)',
            personaMaidFull: 'Maid (DeepSeek, whale-girl)',
            personaButlerFull: 'Butler (DeepSeek, male valet)',
            placeholder: 'Type a message, Enter to send (Shift+Enter for newline)',
            busyPlaceholder: 'Agent is busy… Enter to interrupt',
            send: 'Send', stop: 'Stop', balanceError: 'Balance unavailable',
            enterMode: 'Enter No-Setup Mode',
            tagline: 'Out-of-the-box: hides complex features, keeps only the essentials',
          },
        }

        // 語言快照 hook：訂閱 locale 服務，語言切換時組件自動重渲染
        const useLocale = () => {
          const [snap, setSnap] = React.useState(() => {
            try { return locale.getSnapshot() } catch (e) { return { active: 'zh', locales: [] } }
          })
          React.useEffect(() => {
            let alive = true
            let unsub = () => {}
            try { unsub = locale.subscribe(() => { if (alive) setSnap(locale.getSnapshot()) }) } catch (e) {}
            return () => { alive = false; unsub() }
          }, [])
          const t = (key) => {
            const table = STRINGS[snap.active] !== undefined ? STRINGS[snap.active] : STRINGS.zh
            return table[key] !== undefined ? table[key] : STRINGS.zh[key]
          }
          return { active: snap.active, locales: snap.locales, t }
        }

        // 讀取一個已註冊 settings namespace 的解析值（未註冊或缺位時返回 undefined）
        const describeValue = async (ns) => {
          if (api === undefined) return undefined
          const described = await rpc(api.settings.describe({}))
          const namespaces = described.value !== undefined && described.value.namespaces !== undefined
            ? described.value.namespaces : []
          const found = namespaces.find((n) => n.ns === ns)
          return found !== undefined && found.value !== undefined && found.value !== null ? found.value : undefined
        }

        const LEGAL_API_KEY = /^[\x21-\x7E]+$/
        const ENV_LINE = /^[A-Z][A-Z0-9_]*=[^=]/
        const isQuoted = (value) => {
          const first = value[0]
          if (first !== '"' && first !== '\'' && first !== '`') return false
          return value.length > 1 && value.endsWith(first)
        }
        const apiKeyFailure = (draft) => {
          if (draft.length === 0) return undefined
          const value = draft.trim()
          if (value.length === 0) return 'blank'
          if (ENV_LINE.test(value) || isQuoted(value)) return 'illegal'
          if (!LEGAL_API_KEY.test(value)) return 'illegal'
          return undefined
        }

        // 切換模式（agent-presets.default 由 client 寫入；模型 + 思考強度走 host 端點）
        const switchPreset = (id) => {
          rpc(api.settings.update({ ns: 'agent-presets', patch: { default: id } }))
          fetch(`/${MODE.code}/model`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preset: id }),
          }).catch(() => {})
        }

        // 取當前 session id（running 優先，否則最新）
        const currentSessionId = () => {
          if (api === undefined) return Promise.resolve(undefined)
          return rpc(api.sessions.list({})).then((res) => {
            const items = res.value !== undefined && res.value.items !== undefined ? res.value.items : []
            const current = items.find((s) => s.running === true) ?? items[0]
            return current !== undefined && current.sessionId !== undefined && current.sessionId !== null ? current.sessionId : undefined
          }).catch(() => undefined)
        }

        // Full Access：把某個 session 切到 danger-full-access（免審核）或恢復默認。
        // 重啟瞬間 host 路由尚未註冊會短暫 404——失敗時重試幾次，避免靜默失效。
        const setSessionAccess = (sessionId, mode, attempt = 0) => {
          if (sessionId === undefined || sessionId === null) return
          fetch(`/${MODE.code}/access`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, mode }),
          }).then((res) => {
            if (!res.ok && attempt < 4) {
              setTimeout(() => { setSessionAccess(sessionId, mode, attempt + 1) }, 1000)
            }
          }).catch(() => {
            if (attempt < 4) setTimeout(() => { setSessionAccess(sessionId, mode, attempt + 1) }, 1000)
          })
        }

        // 設定某個 session 的人設（none / maid / butler）
        const setPersona = (sessionId, persona) => {
          if (sessionId === undefined || sessionId === null) return
          fetch(`/${MODE.code}/persona`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, persona }),
          }).catch(() => {})
        }

        // 套用免設置偏好：busyEnter=steer（插話）、default=chat + 聊天模式（思考 off）、Full Access；並記錄原值
        // 全程 try/catch：任何一步失敗都不影響免設置 UI 的註冊與顯示
        const applyPrefs = async (on) => {
          try {
            if (api === undefined) return
            if (on) {
              if (!prefsApplied) {
                const conv = await describeValue('ui-conversation')
                prevBusyEnter = conv !== undefined && conv.busyEnter !== undefined && conv.busyEnter !== null ? conv.busyEnter : 'queue'
                prefsApplied = true
              }
              await rpc(api.settings.update({ ns: 'ui-conversation', patch: { busyEnter: 'steer' } }))
              await rpc(api.settings.update({ ns: 'agent-presets', patch: { default: 'chat' } }))
              switchPreset('chat')
              currentSessionId().then((sid) => { setSessionAccess(sid, 'full') })
            } else {
              await rpc(api.settings.update({ ns: 'ui-conversation', patch: { busyEnter: prevBusyEnter } }))
              // 離開免設置模式：恢復默認權限，人設調整為無人設
              currentSessionId().then((sid) => {
                setSessionAccess(sid, 'normal')
                setPersona(sid, 'none')
              })
              prefsApplied = false
            }
          } catch (error) {
            console.error(`${MODE.code}: applyPrefs failed`, error)
          }
        }

        const sendIcon = React.createElement('svg', { viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': true },
          React.createElement('path', { d: 'M8.3125 0.980183C8.66767 1.0531 8.97902 1.20418 9.2627 1.43233C9.48724 1.61297 9.73029 1.85793 9.97949 2.10714L14.707 6.83468L13.293 8.24874L9 3.95577V15.0417H7V3.95577L2.70703 8.24874L1.29297 6.83468L6.02051 2.10714C6.26971 1.85793 6.51277 1.61297 6.7373 1.43233C6.97662 1.23986 7.28445 1.04402 7.6875 0.980183C7.8973 0.947006 8.1031 0.95516 8.3125 0.980183Z', fill: 'currentColor' }),
        )
        const stopIcon = React.createElement('svg', { viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': true },
          React.createElement('rect', { x: 3, y: 3, width: 10, height: 10, rx: 3, fill: 'currentColor' }),
        )

        function MinimalSettingsShell(props) {
          const [open, setOpen] = React.useState(false)
          const { active: localeActive, locales, t } = useLocale()
          const [keyDraft, setKeyDraft] = React.useState('')
          const [keyConfigured, setKeyConfigured] = React.useState(false)
          const [keyError, setKeyError] = React.useState('')
          const [savedMsg, setSavedMsg] = React.useState('')

          React.useEffect(() => {
            let alive = true
            if (api !== undefined) {
              rpc(api.credentials.describe({ refs: ['DEEPSEEK_API_KEY'] })).then((res) => {
                if (!alive) return
                const creds = res.value !== undefined && res.value.credentials !== undefined ? res.value.credentials : {}
                const entry = creds['DEEPSEEK_API_KEY']
                setKeyConfigured(entry !== undefined && entry.configured === true)
              })
            }
            return () => { alive = false }
          }, [])

          // 失焦保存：格式校驗通過後寫入 credentials（官方端點）；錯誤存 key，渲染時翻譯
          const commitKey = async () => {
            const draft = keyDraft
            if (draft.length === 0) return
            const failure = apiKeyFailure(draft)
            if (failure !== undefined) {
              setKeyError(failure === 'blank' ? 'keyBlank' : 'keyIllegal')
              setSavedMsg('')
              return
            }
            if (api === undefined) { setKeyError('apiUnavailable'); return }
            const res = await rpc(api.credentials.set({ ref: 'DEEPSEEK_API_KEY', value: draft.trim() }))
            if (res.ok === true) {
              setKeyConfigured(true)
              setKeyDraft('')
              setSavedMsg('saved')
            } else {
              setKeyError('saveFailed')
            }
          }

          const wide = props.wide === true
          const trigger = React.createElement('button', {
            type: 'button',
            'aria-label': t('settings'),
            onClick: () => setOpen(true),
            style: wide
              ? { flex: 'none', display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% + 8px)', height: 34, margin: '4px -4px 4px', padding: '6px 2px 6px 10px', boxSizing: 'border-box', border: 'none', borderRadius: 12, background: 'transparent', cursor: 'pointer', overflow: 'hidden', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 14, lineHeight: '22px', textAlign: 'left' }
              : { width: 36, height: 36, margin: '8px 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '50%', background: 'transparent', cursor: 'pointer', color: 'var(--dsw-alias-label-primary)', fontSize: 15 },
          }, wide ? React.createElement(React.Fragment, null,
            React.createElement('span', null, '⚙'),
            React.createElement('span', { style: { overflow: 'hidden', whiteSpace: 'nowrap' } }, t('settings')),
          ) : React.createElement('span', null, '⚙'))

          const inputStyle = {
            boxSizing: 'border-box', width: '100%', height: 32, padding: '0 10px',
            border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8,
            font: 'inherit', fontSize: 14, lineHeight: '22px',
            background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
            outline: 'none',
          }
          const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)' }
          const rowTitle = { fontSize: 14, lineHeight: '22px', color: 'var(--dsw-alias-label-primary)', flex: 1, minWidth: 0 }
          const secondaryBtn = {
            boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            height: 36, padding: '0 14px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 18,
            font: 'inherit', fontSize: 14, background: 'transparent', color: 'var(--dsw-alias-label-primary)', cursor: 'pointer',
          }

          const panel = React.createElement('div', {
            style: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
            onClick: () => setOpen(false),
          },
            React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.24)', backdropFilter: 'blur(2px)' } }),
            React.createElement('div', {
              style: {
                position: 'relative', zIndex: 1, boxSizing: 'border-box',
                width: 560, maxWidth: 'calc(100vw - 48px)',
                borderRadius: 24, overflow: 'hidden',
                background: 'var(--dsw-alias-bg-layer-2)',
                boxShadow: '0 18px 50px rgba(0, 0, 0, 0.35)',
                display: 'flex', flexDirection: 'column',
              },
              onClick: (e) => e.stopPropagation(),
            },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54, padding: '0 24px', boxSizing: 'border-box' } },
                React.createElement('span', { style: { fontSize: 16, lineHeight: '24px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)' } }, t('settings')),
                React.createElement('button', {
                  type: 'button', 'aria-label': t('close'), onClick: () => setOpen(false),
                  style: { border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dsw-alias-label-secondary)', fontSize: 16, lineHeight: 1, padding: 4 },
                }, '✕'),
              ),
              React.createElement('div', { style: { padding: '0 24px 24px', display: 'flex', flexDirection: 'column' } },
                React.createElement('div', { style: rowStyle },
                  React.createElement('div', { style: rowTitle }, t('language')),
                  React.createElement('select', {
                    value: localeActive,
                    onChange: (e) => { try { locale.setLocale(e.target.value) } catch (err) {} },
                    style: { ...inputStyle, width: 180, cursor: 'pointer' },
                  }, locales.map((def) =>
                    React.createElement('option', { key: def.id, value: def.id }, def.label),
                  )),
                ),
                React.createElement('div', { style: { ...rowStyle, alignItems: 'flex-start', flexDirection: 'column', gap: 8 } },
                  React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                    React.createElement('span', { style: rowTitle }, t('apiKey')),
                    React.createElement('span', {
                      style: {
                        width: 8, height: 8, borderRadius: '50%', flex: 'none',
                        background: keyConfigured ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)',
                      },
                    }),
                  ),
                  React.createElement('input', {
                    type: 'password',
                    value: keyDraft,
                    placeholder: keyConfigured ? t('keyConfiguredPlaceholder') : t('keyPlaceholder'),
                    onChange: (e) => { setKeyDraft(e.target.value); setKeyError(''); setSavedMsg('') },
                    onBlur: () => { commitKey() },
                    style: inputStyle,
                  }),
                  React.createElement('span', { style: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)' } },
                    t('noKeyYet'),
                    React.createElement('a', { href: 'https://platform.deepseek.com/api_keys', target: '_blank', rel: 'noreferrer', style: { color: 'var(--dsw-alias-brand-primary)' } }, t('getKey')),
                  ),
                  keyError ? React.createElement('p', { style: { margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary)' } }, t(keyError)) : null,
                  savedMsg ? React.createElement('p', { style: { margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-state-success-primary)' } }, t(savedMsg)) : null,
                ),
                React.createElement('button', {
                  type: 'button',
                  onClick: async () => {
                    await applyPrefs(false)
                    setEnabled(false)
                  },
                  style: { ...secondaryBtn, width: '100%', marginTop: 16 },
                }, t('exitMode')),
              ),
            ),
          )

          return React.createElement(React.Fragment, null, trigger, open ? panel : null)
        }

        function MinimalHeader(props) {
          // 進入免設置模式即自動選聊天模式（applyPrefs 已把 default 設為 chat）——
          // 初始直接高亮聊天，避免與 applyPrefs 非同步寫入的顯示競態。
          const [current, setCurrent] = React.useState('chat')
          const { t } = useLocale()

          const pick = async (id) => {
            if (api !== undefined) {
              const known = MODE.presets.some((p) => p.id === id)
              rpc(api.settings.update({ ns: 'agent-presets', patch: { default: id } }))
              if (known) {
                // 插件自帶模式：模型 + 思考強度也一起切（host 端點）
                fetch(`/${MODE.code}/model`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ preset: id }),
                }).catch(() => {})
              }
              // 用戶自定義 preset：只切默認（模型/思考強度保持）
            }
            setCurrent(id)
          }

          const presets = MODE.presets.map((p) => ({
            id: p.id,
            nameKey: { chat: 'modeChat', work: 'modeWork', expert: 'modeExpert' }[p.id],
            full: `${MODE.presetPrefix}：${p.nameSuffix}`,
          }))

          // 用戶自定義 preset（非系統內建、非插件自帶的三個）也加入切換列表
          const [userPresets, setUserPresets] = React.useState([])
          React.useEffect(() => {
            if (api === undefined) return undefined
            let alive = true
            rpc(api.agentPresets.list({})).then((res) => {
              if (!alive) return
              const list = res.value !== undefined && res.value.presets !== undefined ? res.value.presets : []
              const mine = new Set(MODE.presets.map((p) => p.id))
              const custom = list.filter((p) => p.trust !== 'system' && !mine.has(p.id))
              setUserPresets(custom)
            }).catch(() => {})
            return () => { alive = false }
          }, [])

          // ---- 人設（角色扮演）：無人設 / 女僕 / 管家；狀態存 host，注入 system prompt ----
          const [persona, setPersona] = React.useState('none')

          React.useEffect(() => {
            const sid = props.sessionId
            if (sid === undefined || sid === null) return undefined
            let alive = true
            fetch(`/${MODE.code}/persona?sessionId=${encodeURIComponent(sid)}`, { cache: 'no-store' })
              .then((res) => res.json())
              .then((data) => {
                if (alive && data !== undefined && data !== null && typeof data === 'object' && typeof data.persona === 'string') {
                  setPersona(data.persona)
                }
              }).catch(() => {})
            return () => { alive = false }
          }, [props.sessionId])

          const pickPersona = (id) => {
            const sid = props.sessionId
            if (sid === undefined || sid === null) return
            setPersona(id)
            fetch(`/${MODE.code}/persona`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: sid, persona: id }),
            }).catch(() => {})
          }

          const personaOptions = [
            { id: 'none', nameKey: 'personaNone', fullKey: 'personaNoneFull' },
            { id: 'maid', nameKey: 'personaMaid', fullKey: 'personaMaidFull' },
            { id: 'butler', nameKey: 'personaButler', fullKey: 'personaButlerFull' },
          ]

          return React.createElement('div', {
            style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '6px 12px', borderBottom: '1px solid var(--dsw-alias-border-l1)' },
          },
            presets.map((p) => {
              const active = current === p.id
              return React.createElement('button', {
                key: p.id,
                type: 'button',
                onClick: () => pick(p.id),
                title: p.full,
                style: {
                  display: 'inline-flex', alignItems: 'center',
                  height: 26, padding: '0 12px', borderRadius: 13, cursor: 'pointer', fontSize: 12, lineHeight: '26px',
                  border: active ? '1px solid #0A82FF' : '1px solid var(--dsw-alias-border-l1)',
                  background: active ? '#0A82FF' : 'var(--dsw-alias-bg-module-platform)',
                  color: active ? '#ffffff' : 'var(--dsw-alias-label-primary)',
                },
              }, t(p.nameKey))
            }),
            userPresets.map((p) => {
              const active = current === p.id
              return React.createElement('button', {
                key: p.id,
                type: 'button',
                onClick: () => pick(p.id),
                title: p.description !== undefined && p.description !== null ? p.description : p.name,
                style: {
                  display: 'inline-flex', alignItems: 'center',
                  height: 26, padding: '0 12px', borderRadius: 13, cursor: 'pointer', fontSize: 12, lineHeight: '26px',
                  border: active ? '1px solid #0A82FF' : '1px solid var(--dsw-alias-border-l1)',
                  background: active ? '#0A82FF' : 'var(--dsw-alias-bg-module-platform)',
                  color: active ? '#ffffff' : 'var(--dsw-alias-label-primary)',
                },
              }, p.name)
            }),
            React.createElement('div', {
              style: { display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' },
            },
              personaOptions.map((p) => {
                const active = persona === p.id
                return React.createElement('button', {
                  key: p.id,
                  type: 'button',
                  onClick: () => pickPersona(p.id),
                  title: t(p.fullKey),
                  style: {
                    display: 'inline-flex', alignItems: 'center',
                    height: 26, padding: '0 10px', borderRadius: 13, cursor: 'pointer', fontSize: 12, lineHeight: '26px',
                    border: active ? '1px solid #0A82FF' : '1px solid var(--dsw-alias-border-l1)',
                    background: active ? '#0A82FF' : 'var(--dsw-alias-bg-module-platform)',
                    color: active ? '#ffffff' : 'var(--dsw-alias-label-primary)',
                  },
                }, t(p.nameKey))
              }),
            ),
          )
        }

        function MinimalComposer(props) {
          const { t } = useLocale()
          const input = props.useInput ? props.useInput((s) => s) : undefined
          const session = props.useSession ? props.useSession((s) => s) : undefined
          const actions = props.inputActions
          const disabled = props.disabled === true
          const blocked = props.blocked
          const busy = input !== undefined && input.phase === 'submitting'
          const running = session !== undefined && session.running === true
          const locked = disabled || blocked !== undefined

          // ---- 餘額顯示：每輪對話結束時同源 fetch host 端點（現拉最新餘額） ----
          const [balance, setBalance] = React.useState(undefined)
          const prevRunningRef = React.useRef(running)

          const readBalance = React.useCallback(() => {
            fetch(`/${MODE.code}/balance`, { cache: 'no-store' }).then((res) => (
              res.json()
            )).then((data) => {
              if (data !== undefined && data !== null && typeof data === 'object') {
                setBalance(data)
              }
            }).catch(() => {})
          }, [])

          // 掛載一次（空依賴）：新對話自動 Full Access + 首次讀餘額。
          // ⚠️ 不要把 balance 放進依賴：balance 每次更新（updatedAt 不同）都會重跑本
          // effect，造成 access/balance 請求無限循環（每秒多次）。
          React.useEffect(() => {
            if (props.sessionId !== undefined && props.sessionId !== null) {
              setSessionAccess(props.sessionId, 'full')
            }
            readBalance()
            // eslint-disable-next-line react-hooks/exhaustive-deps
          }, [])

          // 輪詢：僅在餘額未就緒時（依賴 balance 只控制 interval，不重跑掛載邏輯）
          React.useEffect(() => {
            if (balance === undefined || balance.ok !== true) {
              const interval = balance !== undefined && balance.ok === false ? 30000 : 10000
              const timer = setInterval(() => { readBalance() }, interval)
              return () => { clearInterval(timer) }
            }
            return undefined
          }, [balance, readBalance])

          React.useEffect(() => {
            const wasRunning = prevRunningRef.current
            prevRunningRef.current = running
            if (wasRunning === true && running === false) {
              // 每輪對話結束：host 端點會現拉 DeepSeek 餘額
              const timer = setTimeout(() => { readBalance() }, 400)
              return () => { clearTimeout(timer) }
            }
            return undefined
          }, [running, readBalance])

          const submit = () => { try { actions.submit() } catch (e) {} }
          const stop = () => {
            if (api !== undefined && props.sessionId !== undefined && props.sessionId !== null) {
              rpc(api.sessions.cancel({ sessionId: props.sessionId }))
            }
          }
          const primaryStops = running
          const empty = input === undefined || input.draft.trim().length === 0
          const btnDisabled = primaryStops ? false : (empty || disabled || busy)

          // 餘額行：與輸入卡片同寬、貼卡片右緣；未設定 key 或尚未取得時不渲染
          const balanceRowStyle = {
            boxSizing: 'border-box', width: '100%', maxWidth: 'var(--dsh-composer-card-max-width, 900px)',
            padding: '4px 20px 6px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
            gap: 12, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)',
          }
          const orderedBalances = balance !== undefined && balance !== null && Array.isArray(balance.balances)
            ? [...balance.balances].sort((a, b) => {
              const rankA = CURRENCY_ORDER[a.currency] !== undefined ? CURRENCY_ORDER[a.currency] : 99
              const rankB = CURRENCY_ORDER[b.currency] !== undefined ? CURRENCY_ORDER[b.currency] : 99
              return rankA - rankB
            })
            : []
          let balanceRow = null
          if (balance !== undefined && balance !== null && balance.ok === true && orderedBalances.length > 0) {
            balanceRow = React.createElement('div', { style: balanceRowStyle },
              orderedBalances.map((entry) => React.createElement('span', { key: entry.currency },
                `${entry.currency === 'USD' ? '$' : entry.currency === 'CNY' ? '¥' : ''}${Number(entry.total).toFixed(2)} ${entry.currency}`,
              )),
            )
          } else if (balance !== undefined && balance !== null && balance.ok === false && balance.error !== undefined) {
            balanceRow = React.createElement('div', { style: balanceRowStyle },
              React.createElement('span', null, t('balanceError')),
            )
          }

          return React.createElement(React.Fragment, null,
            React.createElement('style', null, '@keyframes dshMinimalSpin { to { transform: rotate(360deg); } } [class$="_logoRow"] { display: none !important; }'),
            React.createElement('div', {
              style: { padding: '0 16px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
            },
              React.createElement('div', {
                style: {
                  boxSizing: 'border-box', width: '100%',
                  maxWidth: 'var(--dsh-composer-card-max-width, 900px)',
                  display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10,
                  border: '1px solid var(--dsw-alias-border-l2-darkmode-thin, var(--dsw-alias-border-l1))',
                  borderRadius: 22,
                  background: 'var(--dsw-specific-input-major, var(--dsw-alias-bg-layer-1))',
                  boxShadow: '0 6px 24px rgba(0, 0, 0, 0.15)',
                  font: 'inherit', fontSize: 16, lineHeight: '24px',
                },
              },
                React.createElement('textarea', {
                  value: input !== undefined ? input.draft : '',
                  disabled: locked,
                  placeholder: blocked !== undefined ? blocked.reason : (running ? t('busyPlaceholder') : t('placeholder')),
                  onChange: (e) => { try { actions.setDraft(e.target.value) } catch (err) {} },
                  onKeyDown: (e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      submit()
                    }
                  },
                  rows: 3,
                  style: {
                    width: '100%', boxSizing: 'border-box', resize: 'none',
                    padding: '0 16px', border: 'none', outline: 'none',
                    background: 'transparent', font: 'inherit', fontSize: 16, lineHeight: '24px',
                    color: 'var(--dsw-alias-label-primary)',
                  },
                }),
                React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', padding: '0 16px 12px' } },
                  React.createElement('button', {
                    type: 'button',
                    disabled: btnDisabled,
                    onClick: primaryStops ? stop : submit,
                    'aria-label': primaryStops ? t('stop') : t('send'),
                    title: primaryStops ? t('stop') : t('send'),
                    style: {
                      display: 'grid', placeItems: 'center', flex: 'none',
                      width: 34, height: 34, border: 'none', borderRadius: 999,
                      background: 'var(--dsw-alias-button-info-fill)',
                      color: '#ffffff', cursor: btnDisabled ? 'default' : 'pointer',
                      opacity: btnDisabled ? 0.4 : 1,
                      transform: 'translateY(-2px)',
                    },
                  }, primaryStops ? stopIcon : sendIcon),
                ),
              ),
              balanceRow,
            ),
          )
        }

        // ---- 進入免設置模式按鈕（通用設置最底部，滿寬）——普通模式唯一保留的改動 ----
        slots.inject('settings.general.item', () => slots.register({
          name: 'settings.general.item',
          id: `${MODE.code}-entry`,
          order: 999,
        }, (props) => {
          const { t } = useLocale()
          return React.createElement('div', {
            style: { padding: '14px 0' },
          },
            React.createElement('button', {
              type: 'button',
              style: {
                boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: 36, padding: '0 14px', border: 'none', borderRadius: 18,
                font: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                background: '#0A82FF', color: '#ffffff',
              },
              onClick: () => { setEnabled(true) },
            }, t('enterMode')),
            React.createElement('div', {
              style: { marginTop: 6, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)', textAlign: 'center' },
            }, t('tagline')),
          )
        }))

        let disposers = []
        const applyMode = () => {
          disposers.forEach((d) => { try { d() } catch (e) {} })
          disposers = []
          if (enabled) {
            // 先註冊免設置 UI（不阻塞於偏好套用；偏好失敗不影響進入免設置模式）
            try {
              disposers.push(slots.inject('sidebar.settings', () => slots.register({ name: 'sidebar.settings', priority: SHADOW_PRIORITY }, MinimalSettingsShell)))
              disposers.push(slots.inject('conversation.session.header', () => slots.register({ name: 'conversation.session.header', priority: SHADOW_PRIORITY }, MinimalHeader)))
              disposers.push(slots.inject('conversation.composer.bar', () => slots.register({ name: 'conversation.composer.bar', priority: SHADOW_PRIORITY }, MinimalComposer)))
            } catch (error) {
              console.error(`${MODE.code}: register no-setup UI failed`, error)
            }
            applyPrefs(true).catch((error) => {
              console.error(`${MODE.code}: applyPrefs failed`, error)
            })
          } else {
            applyPrefs(false).catch((error) => {
              console.error(`${MODE.code}: applyPrefs(restore) failed`, error)
            })
          }
        }
        const unsub = subscribe(() => { applyMode() })
        applyMode()

        return () => {
          unsub()
          disposers.forEach((d) => { try { d() } catch (e) {} })
        }
      },
    }
  },
})
