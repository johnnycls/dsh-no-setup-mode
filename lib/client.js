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
window.__ModuleLoader__.load({
  id: 'dsh-no-setup-mode',
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
          fetch('/no-setup-mode/model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preset: id }),
          }).catch(() => {})
        }

        // 套用免設置偏好：busyEnter=steer（插話）、default=chat + 聊天模式（思考 off）；並記錄原值
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
            } else {
              await rpc(api.settings.update({ ns: 'ui-conversation', patch: { busyEnter: prevBusyEnter } }))
              prefsApplied = false
            }
          } catch (error) {
            console.error('dsh-no-setup-mode: applyPrefs failed', error)
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
          const [localeSnap, setLocaleSnap] = React.useState(() => {
            try { return locale.getSnapshot() } catch (e) { return { active: 'zh', locales: [] } }
          })
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
            let unsub = () => {}
            try { unsub = locale.subscribe(() => { if (alive) setLocaleSnap(locale.getSnapshot()) }) } catch (e) {}
            return () => { alive = false; unsub() }
          }, [])

          // 失焦保存：格式校驗通過後寫入 credentials（官方端點）
          const commitKey = async () => {
            const draft = keyDraft
            if (draft.length === 0) return
            const failure = apiKeyFailure(draft)
            if (failure !== undefined) {
              setKeyError(failure === 'blank' ? 'Key 不能為空白' : 'Key 包含非法字符，請檢查後重新貼上')
              setSavedMsg('')
              return
            }
            if (api === undefined) { setKeyError('API 通道不可用，未保存'); return }
            const res = await rpc(api.credentials.set({ ref: 'DEEPSEEK_API_KEY', value: draft.trim() }))
            if (res.ok === true) {
              setKeyConfigured(true)
              setKeyDraft('')
              setSavedMsg('已保存 ✓')
            } else {
              setKeyError('保存失敗')
            }
          }

          const wide = props.wide === true
          const trigger = React.createElement('button', {
            type: 'button',
            'aria-label': '設置',
            onClick: () => setOpen(true),
            style: wide
              ? { flex: 'none', display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% + 8px)', height: 34, margin: '4px -4px 4px', padding: '6px 2px 6px 10px', boxSizing: 'border-box', border: 'none', borderRadius: 12, background: 'transparent', cursor: 'pointer', overflow: 'hidden', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 14, lineHeight: '22px', textAlign: 'left' }
              : { width: 36, height: 36, margin: '8px 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '50%', background: 'transparent', cursor: 'pointer', color: 'var(--dsw-alias-label-primary)', fontSize: 15 },
          }, wide ? React.createElement(React.Fragment, null,
            React.createElement('span', null, '⚙'),
            React.createElement('span', { style: { overflow: 'hidden', whiteSpace: 'nowrap' } }, '設置'),
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
                React.createElement('span', { style: { fontSize: 16, lineHeight: '24px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)' } }, '設置'),
                React.createElement('button', {
                  type: 'button', 'aria-label': '關閉', onClick: () => setOpen(false),
                  style: { border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dsw-alias-label-secondary)', fontSize: 16, lineHeight: 1, padding: 4 },
                }, '✕'),
              ),
              React.createElement('div', { style: { padding: '0 24px 24px', display: 'flex', flexDirection: 'column' } },
                React.createElement('div', { style: rowStyle },
                  React.createElement('div', { style: rowTitle }, '語言 / Language'),
                  React.createElement('select', {
                    value: localeSnap.active,
                    onChange: (e) => { try { locale.setLocale(e.target.value) } catch (err) {} },
                    style: { ...inputStyle, width: 180, cursor: 'pointer' },
                  }, localeSnap.locales.map((def) =>
                    React.createElement('option', { key: def.id, value: def.id }, def.label),
                  )),
                ),
                React.createElement('div', { style: { ...rowStyle, alignItems: 'flex-start', flexDirection: 'column', gap: 8 } },
                  React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                    React.createElement('span', { style: rowTitle }, 'DeepSeek API Key'),
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
                    placeholder: keyConfigured ? '已設定（輸入以更換，離開輸入框自動保存）' : 'sk-…（離開輸入框自動保存）',
                    onChange: (e) => { setKeyDraft(e.target.value); setKeyError(''); setSavedMsg('') },
                    onBlur: () => { commitKey() },
                    style: inputStyle,
                  }),
                  React.createElement('span', { style: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)' } },
                    '還沒有 Key？',
                    React.createElement('a', { href: 'https://platform.deepseek.com/api_keys', target: '_blank', rel: 'noreferrer', style: { color: 'var(--dsw-alias-brand-primary)' } }, '點此獲取 →'),
                  ),
                  keyError ? React.createElement('p', { style: { margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary)' } }, keyError) : null,
                  savedMsg ? React.createElement('p', { style: { margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-state-success-primary)' } }, savedMsg) : null,
                ),
                React.createElement('button', {
                  type: 'button',
                  onClick: async () => {
                    await applyPrefs(false)
                    setEnabled(false)
                  },
                  style: { ...secondaryBtn, width: '100%', marginTop: 16 },
                }, '離開免設置模式'),
              ),
            ),
          )

          return React.createElement(React.Fragment, null, trigger, open ? panel : null)
        }

        function MinimalHeader(props) {
          // 進入免設置模式即自動選聊天模式（applyPrefs 已把 default 設為 chat）——
          // 初始直接高亮聊天，避免與 applyPrefs 非同步寫入的顯示競態。
          const [current, setCurrent] = React.useState('chat')

          const pick = async (id) => {
            if (api !== undefined) switchPreset(id)
            setCurrent(id)
          }

          const presets = [
            { id: 'chat', name: '免設置：聊天（Chat）', full: '免設置：聊天模式（No-Setup Chat Mode）' },
            { id: 'work', name: '免設置：工作（Work）', full: '免設置：工作模式（No-Setup Work Mode）' },
            { id: 'expert', name: '免設置：專家（Expert）', full: '免設置：專家模式（No-Setup Expert Mode）' },
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
              }, p.name)
            }),
          )
        }

        function MinimalComposer(props) {
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
            fetch('/no-setup-mode/balance', { cache: 'no-store' }).then((res) => (
              res.json()
            )).then((data) => {
              if (data !== undefined && data !== null && typeof data === 'object') {
                setBalance(data)
              }
            }).catch(() => {})
          }, [])

          React.useEffect(() => {
            readBalance()
            // 尚未取得餘額（key 未設定 / 獲取失敗）時輪詢重試：失敗間隔拉長，避免反覆打 DeepSeek API
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
              React.createElement('span', null, '餘額獲取失敗'),
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
                  placeholder: blocked !== undefined ? blocked.reason : (running ? 'Agent 忙碌中… Enter 插話發送' : '輸入訊息，Enter 送出（Shift+Enter 換行）'),
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
                    'aria-label': primaryStops ? '停止' : '發送',
                    title: primaryStops ? '停止' : '發送',
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
          id: 'no-setup-mode-entry',
          order: 999,
        }, (props) => React.createElement('div', {
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
          }, '進入免設置模式'),
          React.createElement('div', {
            style: { marginTop: 6, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)', textAlign: 'center' },
          }, '開箱即用：隱藏複雜功能，只保留核心對話與必要設置'),
        )))

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
              console.error('dsh-no-setup-mode: register no-setup UI failed', error)
            }
            applyPrefs(true).catch((error) => {
              console.error('dsh-no-setup-mode: applyPrefs failed', error)
            })
          } else {
            applyPrefs(false).catch((error) => {
              console.error('dsh-no-setup-mode: applyPrefs(restore) failed', error)
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
