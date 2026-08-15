// ============================================================================
// dsh-minimal-mode — 極簡模式插件（Client 半邊）
// ----------------------------------------------------------------------------
// 安裝方式：將本文件的完整內容作為 cordis_define 的 code.client 參數。
// 本文件內容即「回傳 Cordis Plugin 的函數體」——可直接原樣貼入。
// 功能：
//   - 一打開 DSH 自動進入極簡模式（「離開極簡模式」僅影響當前會話）
//   - 隱藏 Logo（CSS）、對話/軌跡 tab、Session Log、輸入框多餘按鈕、設置頁
//   - 極簡設置 Dialog：語言選擇 + DeepSeek API Key（onBlur 真實 API 驗證、spinner）
//   - 極簡標題列：聊天 / 工作 / 專家 三模式切換（自動選聊天模式）
//   - 極簡輸入列：3 行 textarea（Enter 送出 / 繁忙插話）+ shipped 圓形發送/停止按鈕
//   - 輸入框下方餘額顯示（全部幣種、每輪對話結束刷新、右對齊）
//   - 普通模式唯一改動：通用設置最底部的「進入極簡模式」按鈕
// ============================================================================
return {
  async apply(ctx) {
    const slots = ctx.get('slots')
    const locale = ctx.get('locale')
    if (slots === undefined) return

    try { styles.insert('@keyframes dshMinimalSpin { to { transform: rotate(360deg); } }') } catch (e) {}

    let enabled = true
    const listeners = new Set()
    const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
    const setEnabled = (v) => { enabled = v; listeners.forEach((fn) => fn()) }

    const MODEL_BY_PRESET = { chat: 'deepseek-v4-flash', work: 'deepseek-v4-flash', expert: 'deepseek-v4-pro' }

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

    const sendIcon = React.createElement('svg', { viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': true },
      React.createElement('path', { d: 'M8.3125 0.980183C8.66767 1.0531 8.97902 1.20418 9.2627 1.43233C9.48724 1.61297 9.73029 1.85793 9.97949 2.10714L14.707 6.83468L13.293 8.24874L9 3.95577V15.0417H7V3.95577L2.70703 8.24874L1.29297 6.83468L6.02051 2.10714C6.26971 1.85793 6.51277 1.61297 6.7373 1.43233C6.97662 1.23986 7.28445 1.04402 7.6875 0.980183C7.8973 0.947006 8.1031 0.95516 8.3125 0.980183Z', fill: 'currentColor' }),
    )
    const stopIcon = React.createElement('svg', { viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': true },
      React.createElement('rect', { x: 3, y: 3, width: 10, height: 10, rx: 3, fill: 'currentColor' }),
    )

    const balanceRowStyle = {
      display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6,
      width: '100%', maxWidth: 'var(--dsh-composer-card-max-width, 900px)',
      boxSizing: 'border-box', margin: '0 auto',
      padding: '0 16px 16px', fontSize: 12,
      color: 'var(--dsw-alias-label-secondary)',
    }

    function MinimalSettingsShell(props) {
      const [open, setOpen] = React.useState(false)
      const [localeSnap, setLocaleSnap] = React.useState(() => {
        try { return locale.getSnapshot() } catch (e) { return { active: 'zh', locales: [] } }
      })
      const [keyDraft, setKeyDraft] = React.useState('')
      const [keyConfigured, setKeyConfigured] = React.useState(false)
      const [keyError, setKeyError] = React.useState('')
      const [savedMsg, setSavedMsg] = React.useState('')
      const [verifying, setVerifying] = React.useState(false)
      const busyRef = React.useRef(false)

      React.useEffect(() => {
        let alive = true
        host.call('credential/describe').then((info) => {
          if (alive) setKeyConfigured(info.configured === true)
        }).catch(() => {})
        let unsub = () => {}
        try { unsub = locale.subscribe(() => { if (alive) setLocaleSnap(locale.getSnapshot()) }) } catch (e) {}
        return () => { alive = false; unsub() }
      }, [])

      const commitKey = async () => {
        if (busyRef.current) return
        const draft = keyDraft
        if (draft.length === 0) return
        const failure = apiKeyFailure(draft)
        if (failure !== undefined) {
          setKeyError(failure === 'blank' ? 'Key 不能為空白' : 'Key 包含非法字符，請檢查後重新貼上')
          setSavedMsg('')
          return
        }
        busyRef.current = true
        setVerifying(true)
        setKeyError('')
        setSavedMsg('')
        try {
          const res = await host.call('credential/verify', { key: draft.trim() })
          if (res.valid === true) {
            const saved = await host.call('credential/set', { key: draft.trim() })
            if (saved.ok === true) {
              setKeyConfigured(true)
              setKeyDraft('')
              setSavedMsg('已保存 ✓')
            } else {
              setKeyError('保存失敗：' + (saved.error || '未知錯誤'))
            }
          } else {
            setKeyError(res.error || 'API Key 無效，未保存')
          }
        } catch (e) {
          setKeyError('驗證失敗，未保存')
        }
        busyRef.current = false
        setVerifying(false)
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
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, width: '100%' } },
                React.createElement('input', {
                  type: 'password',
                  value: keyDraft,
                  disabled: verifying,
                  placeholder: keyConfigured ? '已設定（輸入以更換，離開輸入框自動驗證保存）' : 'sk-…（離開輸入框自動驗證保存）',
                  onChange: (e) => { setKeyDraft(e.target.value); setKeyError(''); setSavedMsg('') },
                  onBlur: () => { commitKey() },
                  style: { ...inputStyle, flex: 1 },
                }),
                verifying ? React.createElement('span', {
                  'aria-label': '驗證中',
                  style: {
                    width: 14, height: 14, borderRadius: '50%', flex: 'none',
                    border: '2px solid var(--dsw-alias-border-l2)',
                    borderTopColor: 'var(--dsw-alias-brand-primary)',
                    animation: 'dshMinimalSpin 0.8s linear infinite',
                  },
                }) : null,
              ),
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
                try { await host.call('sandbox/restore-all') } catch (e) {}
                try { await host.call('presets/cleanup') } catch (e) {}
                try { await host.call('minimal/set', { enabled: false }) } catch (e) {}
                setEnabled(false)
              },
              style: { ...secondaryBtn, width: '100%', marginTop: 16 },
            }, '離開極簡模式'),
          ),
        ),
      )

      return React.createElement(React.Fragment, null, trigger, open ? panel : null)
    }

    function MinimalHeader(props) {
      const [presets, setPresets] = React.useState([])
      const [current, setCurrent] = React.useState(null)

      React.useEffect(() => {
        let alive = true
        host.call('presets/list').then((res) => {
          if (!alive) return
          setPresets(res.presets || [])
          setCurrent(res.defaultId || null)
        }).catch(() => {})
        return () => { alive = false }
      }, [])

      const pick = async (id) => {
        const model = MODEL_BY_PRESET[id]
        try {
          await host.call('presets/select', {
            id: id,
            defaultPatch: { default: id },
            model: model !== undefined ? { provider: 'deepseek-official', model: model } : null,
          })
        } catch (e) {}
        setCurrent(id)
      }

      return React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '6px 12px', borderBottom: '1px solid var(--dsw-alias-border-l1)' },
      },
        presets.map((p) => {
          const active = current === p.id
          return React.createElement('button', {
            key: p.id,
            type: 'button',
            onClick: () => pick(p.id),
            title: p.name,
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

    function BalanceLine(props) {
      const [state, setState] = React.useState({ status: 'loading' })

      React.useEffect(() => {
        let alive = true
        host.call('credential/balance').then((res) => {
          if (!alive) return
          if (res.ok === true) {
            setState({ status: 'ok', balances: res.balances || [] })
          } else if (res.error === 'unconfigured') {
            setState({ status: 'unconfigured' })
          } else {
            setState({ status: 'error' })
          }
        }).catch(() => { if (alive) setState({ status: 'error' }) })
        return () => { alive = false }
      }, [props.refreshKey])

      if (state.status === 'ok') {
        const parts = state.balances.map((b) => React.createElement('span', { key: b.currency }, b.currency, ' ', b.balance))
        return React.createElement('div', { style: balanceRowStyle },
          '餘額：', parts.reduce((acc, el, i) => acc.length === 0 ? [el] : acc.concat(React.createElement(React.Fragment, { key: 'sep' + i }, ' · '), el), []),
        )
      }
      if (state.status === 'unconfigured') {
        return React.createElement('div', { style: { ...balanceRowStyle, color: 'var(--dsw-alias-state-warn-primary)' } }, 'API Key 未設定（點側欄 ⚙ 設置）')
      }
      if (state.status === 'error') {
        return React.createElement('div', { style: { ...balanceRowStyle, color: 'var(--dsw-alias-label-dimmed, var(--dsw-alias-label-secondary))' } }, '餘額讀取失敗')
      }
      return React.createElement('div', { style: balanceRowStyle },
        React.createElement('span', {
          style: {
            width: 10, height: 10, borderRadius: '50%',
            border: '2px solid var(--dsw-alias-border-l2)',
            borderTopColor: 'var(--dsw-alias-brand-primary)',
            animation: 'dshMinimalSpin 0.8s linear infinite',
          },
        }),
        '讀取餘額中…',
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
      const [balanceRefresh, setBalanceRefresh] = React.useState(0)
      const prevRunning = React.useRef(false)

      // 極簡 session 掛載時切到 Full Access（sandbox/mode session override）
      React.useEffect(() => {
        if (props.sessionId !== undefined && props.sessionId !== null) {
          try { host.call('sandbox/apply', { sessionId: props.sessionId, enabled: true }) } catch (e) {}
        }
      }, [props.sessionId])

      // 每輪對話結束（running true→false）時刷新餘額
      React.useEffect(() => {
        if (prevRunning.current && !running) {
          setBalanceRefresh((k) => k + 1)
        }
        prevRunning.current = running
      }, [running])

      const submit = () => { try { actions.submit() } catch (e) {} }
      const stop = () => {
        try { host.call('session/cancel', { sessionId: props.sessionId }) } catch (e) {}
      }
      const primaryStops = running
      const empty = input === undefined || input.draft.trim().length === 0
      const btnDisabled = primaryStops ? false : (empty || disabled || busy)

      return React.createElement(React.Fragment, null,
        React.createElement('div', {
          style: { padding: '0 16px 4px', display: 'flex', justifyContent: 'center' },
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
        ),
        React.createElement(BalanceLine, { refreshKey: balanceRefresh }),
      )
    }

    // ---- 進入極簡模式按鈕（通用設置最底部，滿寬）——普通模式唯一保留的改動 ----
    slots.inject('settings.general.item', () => slots.register({
      name: 'settings.general.item',
      id: 'minimal-mode-entry',
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
        onClick: async () => {
          try { await host.call('minimal/set', { enabled: true }) } catch (e) {}
          setEnabled(true)
        },
      }, '進入極簡模式'),
      React.createElement('div', {
        style: { marginTop: 6, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)', textAlign: 'center' },
      }, '開箱即用：隱藏複雜功能，只保留核心對話與必要設置'),
    )))

    let disposers = []
    let modeSeq = 0
    const applyMode = async () => {
      const seq = ++modeSeq
      disposers.forEach((d) => { try { d() } catch (e) {} })
      disposers = []
      if (enabled) {
        // patch 由 client 構造（RPC 反序列化後為宿主 plain object，避免沙箱 prototype 問題）
        try {
          await host.call('minimal/apply-prefs', {
            enabled: true,
            busyEnterPatch: { busyEnter: 'steer' },
            defaultPatch: { default: 'chat' },
            model: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
          })
        } catch (e) {}
        if (seq !== modeSeq) return
        try { disposers.push(styles.insert('[class$="_logoRow"] { display: none !important; }')) } catch (e) {}
        disposers.push(slots.inject('sidebar.settings', () => slots.register({ name: 'sidebar.settings' }, MinimalSettingsShell)))
        disposers.push(slots.inject('conversation.session.header', () => slots.register({ name: 'conversation.session.header' }, MinimalHeader)))
        disposers.push(slots.inject('conversation.composer.bar', () => slots.register({ name: 'conversation.composer.bar' }, MinimalComposer)))
      } else {
        // 離開：恢復 Full Access 權限 + busyEnter
        try {
          await host.call('sandbox/restore-all')
          const status = await host.call('minimal/prefs-status')
          const prev = status !== null && status !== undefined ? status.prevBusyEnter : undefined
          await host.call('minimal/apply-prefs', {
            enabled: false,
            restorePatch: prev !== undefined && prev !== null ? { busyEnter: prev } : null,
          })
        } catch (e) {}
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
