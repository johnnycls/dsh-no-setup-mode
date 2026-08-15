// ============================================================================
// dsh-minimal-mode — 極簡模式插件（Host 半邊）
// ----------------------------------------------------------------------------
// 安裝方式：將本文件的完整內容作為 cordis_define 的 code.host 參數。
// 本文件內容即「回傳 Cordis Plugin 的函數體」——可直接原樣貼入。
// 功能：
//   - 極簡模式狀態持久化（workspace 內 .dsh-minimal-mode.json）
//   - 進入/離開極簡模式時套用偏好（busyEnter=steer 插話、default=chat、模型 Flash）
//   - Full Access：透過官方 sandbox/mode session override 把極簡 session 切到
//     danger-full-access，離開或停用時自動恢復原權限
//   - DeepSeek API Key 驗證（curl 呼叫 /user/balance）與寫入 credentials
//   - 餘額查詢（全部幣種）
//   - 極簡專屬 Agent 預設（聊天/工作/專家）的建立與清理
//   - 中斷對話（agent.cancel，與 shipped Stop 同一路徑）
// ============================================================================
return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    const credentials = ctx.get('credentials')
    const settings = ctx.get('settings')
    const agentPresets = ctx.get('agentPresets')
    const agentDefaultModel = ctx.get('agentDefaultModel')
    const subprocess = ctx.get('subprocess')
    const agents = ctx.get('agents')

    const statePath = () => {
      const root = sandboxPolicy !== undefined ? sandboxPolicy.workspaceRoot : undefined
      if (root === undefined || root.length === 0) throw new Error('no workspace root')
      return root.replace(/[\\/\\\\]+$/, '') + '/.dsh-minimal-mode.json'
    }
    const wsRoot = sandboxPolicy !== undefined ? sandboxPolicy.workspaceRoot : '/'

    // 極簡專屬 Agent 預設：聊天 = 極簡 + 聯網 + Flash；工作 = 標準 + Flash；專家 = PTC + Pro
    const MINIMAL_PRESETS = [
      { id: 'chat', from: 'minimal', name: '聊天模式', model: 'deepseek-v4-flash', extraWeb: true, persistent: true },
      { id: 'work', from: 'standard', name: '工作模式', model: 'deepseek-v4-flash' },
      { id: 'expert', from: 'code', name: '專家模式', model: 'deepseek-v4-pro' },
    ]

    const readState = async () => {
      if (fs === undefined) return {}
      try {
        const target = await fs.resolve(statePath())
        const text = await fs.readText(target)
        return JSON.parse(text)
      } catch (e) {
        return {}
      }
    }
    const writeState = async (data) => {
      if (fs === undefined) return
      try {
        const target = await fs.resolve(statePath())
        await fs.writeText(target, JSON.stringify(data, null, 2))
      } catch (e) {}
    }

    const ensurePresets = async () => {
      if (agentPresets === undefined) return
      const list = await agentPresets.list()
      const have = new Set(list.map((p) => p.id))
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
              if (outcome.exitCode !== 0) console.error('minimal: append web to chat failed')
            }
          } catch (e) {
            console.error('minimal: append web to chat error', e)
          }
        }
      }
    }

    // 只刪除我們創建的 preset（按名稱匹配；用戶自建的同名 preset 絕不刪除）
    const cleanupPresets = async () => {
      if (agentPresets === undefined) return
      for (const spec of MINIMAL_PRESETS) {
        if (spec.persistent === true) continue
        try {
          const resolved = await agentPresets.resolve(spec.id)
          if (resolved.name !== spec.name) continue
          await agentPresets.remove(spec.id)
        } catch (e) {}
      }
    }

    const readDefaultPresetId = () => {
      try {
        const value = settings !== undefined ? settings.get('agent-presets') : undefined
        return (value !== undefined && value.default !== undefined) ? value.default : null
      } catch (e) {
        return null
      }
    }

    harness.handle('minimal/get', async () => {
      // 插件安裝 = 極簡模式：一打開 DSH 自動進入（「離開極簡模式」僅影響當前會話）
      return { enabled: true }
    })

    harness.handle('minimal/set', async (args) => {
      const next = args !== null && args !== undefined && args.enabled === true
      if (next) await writeState({ enabled: true })
      return { ok: true }
    })

    harness.handle('minimal/prefs-status', async () => {
      const state = await readState()
      return { prevBusyEnter: state.prevBusyEnter !== undefined ? state.prevBusyEnter : null }
    })

    // patch/model 一律由 client 構造（RPC 反序列化後是宿主 plain object，settings 才能接受）
    harness.handle('minimal/apply-prefs', async (args) => {
      const on = args !== null && args !== undefined && args.enabled === true
      const state = await readState()
      if (on) {
        try {
          const conv = settings !== undefined ? settings.get('ui-conversation') : undefined
          const current = conv !== undefined && conv !== null && conv.busyEnter !== undefined ? conv.busyEnter : 'queue'
          if (state.prevBusyEnter === undefined) {
            state.prevBusyEnter = current
            await writeState(state)
          }
        } catch (e) {}
        try {
          if (settings !== undefined && args.busyEnterPatch !== undefined && args.busyEnterPatch !== null) {
            await settings.update('ui-conversation', args.busyEnterPatch)
          }
        } catch (e) {}
        try {
          if (settings !== undefined && args.defaultPatch !== undefined && args.defaultPatch !== null) {
            await settings.update('agent-presets', args.defaultPatch)
          }
        } catch (e) {}
        try {
          if (agentDefaultModel !== undefined && args.model !== undefined && args.model !== null) {
            await agentDefaultModel.saveSelection(args.model)
          }
        } catch (e) {}
      } else {
        try {
          if (settings !== undefined && args.restorePatch !== undefined && args.restorePatch !== null) {
            await settings.update('ui-conversation', args.restorePatch)
          }
        } catch (e) {}
        state.prevBusyEnter = undefined
        await writeState(state)
      }
      return { ok: true }
    })

    // 極簡 session 切到 Full Access（官方 sandbox/mode session override）；記錄原 mode 以便離開時恢復
    harness.handle('sandbox/apply', async (args) => {
      const sessionId = args !== null && args !== undefined ? String(args.sessionId || '') : ''
      const on = args !== null && args !== undefined && args.enabled === true
      if (sessionId.length === 0 || agents === undefined || sandboxPolicy === undefined) return { ok: false }
      const agent = agents.get(sessionId)
      if (agent === undefined) return { ok: false }
      const state = await readState()
      try {
        if (on) {
          let prev = 'workspace-write'
          try {
            const resolved = sandboxPolicy.resolve({ session: agent.session })
            prev = resolved.mode
          } catch (e) {}
          if (state.sandboxSessions === undefined) state.sandboxSessions = {}
          state.sandboxSessions[sessionId] = prev
          await writeState(state)
          agent.session.append('sandbox/mode', { mode: 'danger-full-access' })
        } else {
          const prev = state.sandboxSessions !== undefined && state.sandboxSessions[sessionId] !== undefined
            ? state.sandboxSessions[sessionId] : 'workspace-write'
          agent.session.append('sandbox/mode', { mode: prev })
          if (state.sandboxSessions !== undefined) delete state.sandboxSessions[sessionId]
          await writeState(state)
        }
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e && e.message !== undefined ? e.message : e) }
      }
    })

    // 恢復所有極簡 session 的 sandbox mode（離開極簡模式 / 插件停用）
    harness.handle('sandbox/restore-all', async () => {
      if (agents === undefined) return { ok: false }
      const state = await readState()
      const sessions = state.sandboxSessions !== undefined ? state.sandboxSessions : {}
      for (const sessionId of Object.keys(sessions)) {
        const agent = agents.get(sessionId)
        if (agent === undefined) continue
        try {
          agent.session.append('sandbox/mode', { mode: sessions[sessionId] })
        } catch (e) {}
      }
      state.sandboxSessions = {}
      await writeState(state)
      return { ok: true }
    })

    harness.handle('credential/describe', async () => {
      if (credentials === undefined) return { configured: false }
      try {
        const info = await credentials.describe('DEEPSEEK_API_KEY')
        return { configured: info.configured === true }
      } catch (e) {
        return { configured: false }
      }
    })

    harness.handle('credential/set', async (args) => {
      if (credentials === undefined) return { ok: false, error: 'credentials unavailable' }
      const key = String((args !== null && args !== undefined && args.key !== undefined) ? args.key : '').trim()
      if (key.length === 0) return { ok: false, error: 'blank' }
      try {
        await credentials.set('DEEPSEEK_API_KEY', key)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e && e.message !== undefined ? e.message : e) }
      }
    })

    // 驗證 API key：呼叫 DeepSeek /user/balance（200 = 有效，401 = 無效）
    harness.handle('credential/verify', async (args) => {
      const key = String((args !== null && args !== undefined && args.key !== undefined) ? args.key : '').trim()
      if (key.length === 0) return { ok: false, valid: false, error: 'blank' }
      if (subprocess === undefined) return { ok: false, valid: false, error: 'subprocess unavailable' }
      try {
        const handle = subprocess.spawn({
          argv: ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '15', '-H', 'Authorization: Bearer ' + key, 'https://api.deepseek.com/user/balance'],
          cwd: wsRoot,
          stdio: { stdin: 'ignore', stdout: 'collect', stderr: 'collect' },
          graceMs: 20000,
        })
        const outcome = await handle.done
        const out = handle.collected.stdout !== undefined ? handle.collected.stdout.readFrom(0).text.trim() : ''
        if (outcome.exitCode !== 0) return { ok: false, valid: false, error: '無法連接 DeepSeek API' }
        if (out === '200') return { ok: true, valid: true }
        if (out === '401') return { ok: true, valid: false, error: 'API Key 無效（401），未保存' }
        return { ok: true, valid: false, error: 'DeepSeek API 回應異常（HTTP ' + out + '），未保存' }
      } catch (e) {
        return { ok: false, valid: false, error: '驗證失敗' }
      }
    })

    // 餘額：返回全部幣種（USD / CNY 等）
    harness.handle('credential/balance', async () => {
      if (credentials === undefined || subprocess === undefined) return { ok: false, error: 'unavailable' }
      let key
      try {
        const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
        if (resolved === undefined) return { ok: false, error: 'unconfigured' }
        key = resolved.value
      } catch (e) {
        return { ok: false, error: 'unconfigured' }
      }
      try {
        const handle = subprocess.spawn({
          argv: ['curl', '-s', '--max-time', '15', '-H', 'Authorization: Bearer ' + key, 'https://api.deepseek.com/user/balance'],
          cwd: wsRoot,
          stdio: { stdin: 'ignore', stdout: 'collect', stderr: 'collect' },
          graceMs: 20000,
        })
        const outcome = await handle.done
        const body = handle.collected.stdout !== undefined ? handle.collected.stdout.readFrom(0).text : ''
        if (outcome.exitCode !== 0) return { ok: false, error: 'network' }
        const data = JSON.parse(body)
        const infos = Array.isArray(data.balance_infos) ? data.balance_infos : []
        if (infos.length === 0) return { ok: false, error: 'no-balance-info' }
        return {
          ok: true,
          balances: infos.map((info) => ({
            balance: String(info.total_balance !== undefined ? info.total_balance : '0'),
            currency: String(info.currency !== undefined ? info.currency : ''),
          })),
        }
      } catch (e) {
        return { ok: false, error: 'network' }
      }
    })

    // 極簡 header：三個專屬模式
    harness.handle('presets/list', async () => {
      if (agentPresets === undefined) return { presets: [], defaultId: null }
      try {
        await ensurePresets()
        return {
          presets: MINIMAL_PRESETS.map((s) => ({ id: s.id, name: s.name })),
          defaultId: readDefaultPresetId(),
        }
      } catch (e) {
        return { presets: [], defaultId: null }
      }
    })

    // 模式切換：patch/model 由 client 構造傳入
    harness.handle('presets/select', async (args) => {
      const id = args !== null && args !== undefined ? String(args.id || '') : ''
      if (id.length === 0) return { ok: false, error: 'blank' }
      try {
        if (settings !== undefined && args.defaultPatch !== undefined && args.defaultPatch !== null) {
          await settings.update('agent-presets', args.defaultPatch)
        }
        if (agentDefaultModel !== undefined && args.model !== undefined && args.model !== null) {
          await agentDefaultModel.saveSelection(args.model)
        }
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e && e.message !== undefined ? e.message : e) }
      }
    })

    harness.handle('presets/cleanup', async () => {
      await cleanupPresets()
      return { ok: true }
    })

    // 中斷對話（與 shipped Stop 同一路徑：agent.cancel，保留待辦佇列）
    harness.handle('session/cancel', async (args) => {
      const id = args !== null && args !== undefined ? String(args.sessionId || '') : ''
      if (agents === undefined || id.length === 0) return { ok: false }
      const agent = agents.get(id)
      if (agent === undefined) return { ok: false }
      try {
        agent.cancel({ kind: 'user' }, { keepInbox: true })
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e && e.message !== undefined ? e.message : e) }
      }
    })

    // 插件停用時：清理我們創建的 preset + 恢復 sandbox mode + busyEnter（不影響其他插件）
    ctx.effect(() => {
      return () => {
        cleanupPresets().catch(() => {})
        readState().then((state) => {
          const sessions = state.sandboxSessions !== undefined ? state.sandboxSessions : {}
          for (const sessionId of Object.keys(sessions)) {
            const agent = agents !== undefined ? agents.get(sessionId) : undefined
            if (agent === undefined) continue
            try { agent.session.append('sandbox/mode', { mode: sessions[sessionId] }) } catch (e) {}
          }
          if (state.prevBusyEnter !== undefined && settings !== undefined) {
            settings.update('ui-conversation', { busyEnter: state.prevBusyEnter }).catch(() => {})
          }
        }).catch(() => {})
      }
    }, 'minimal: cleanup')
  },
}
