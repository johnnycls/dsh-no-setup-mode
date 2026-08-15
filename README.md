# 極簡模式（dsh-minimal-mode）

> **安裝後開箱即用，幫你完成所有設置。** 一個給 DeepSeek Harness（DSH）的「極簡模式」插件：裝好之後自動進入極簡界面，隱藏所有複雜功能，只保留核心對話與必要設置，並替你完成 API Key、模型、預設等所有配置。

**English:** A "Minimal Mode" plugin for DeepSeek Harness — one-click out-of-the-box setup. Hides all advanced UI, keeps only chat essentials, auto-configures DeepSeek API key / model / agent preset, and grants Full Access within minimal sessions.

---

## 這個插件是給誰用的？

### 適合你，如果你：
- **懶得設置**——不想要漫長的配置流程，裝完就想直接開始對話
- **被複雜界面困擾**——Logo、對話/軌跡 tab、Session Log、輸入框一堆按鈕、設置頁十幾個頁面，只想專注聊天
- **不熟悉 DSH**——第一次用，不知道 API Key 填哪裡、Agent 預設是什麼、模型怎麼選
- **想要「打開就能用」**——每次啟動 DSH 自動進入極簡模式，不用重新設置
- **想要全權限操作**——極簡模式下自動切到 Full Access，Agent 寫檔不再被 sandbox 攔截

### 不適合你，如果你：
- 需要隨時使用**軌跡（trajectory）視圖、Session Log、子代理目錄、模型手動選擇**等高級功能
- 不想被自動切換（模型、預設、Enter 行為）影響
- 對**安全敏感**——極簡模式會把當前 session 的 sandbox 升到 Full Access（離開極簡模式即恢復）

### 什麼情況用：
- 剛安裝 DSH，對 DSH 說「**幫我設置好**」「**安裝極簡模式**」「**開箱即用**」——本插件的 skill 會引導 Agent 自動完成安裝
- 想給長輩/新手/不折騰的人裝一台「打開就能聊」的 DSH
- 自己日常使用，偶爾需要完整界面（點「離開極簡模式」即可，刷新後又自動回到極簡）

---

## 功能總覽

### 安裝後自動生效
- **一打開 DSH 自動進入極簡模式**（「離開極簡模式」只影響當前會話，下次打開仍是極簡）
- 進入時自動：**選擇聊天模式**（極簡 + 聯網 + DeepSeek-V4-Flash）、設定默認 Agent 預設、把繁忙時 Enter 設為**插話發送**（busyEnter=steer）

### 極簡模式下隱藏
| 元素 | 方式 |
|---|---|
| Logo | CSS（`[class$="_logoRow"]`） |
| 對話/軌跡 tab、Session Log | 取代 header（極簡標題列只有模式按鈕） |
| 輸入框所有按鈕（除發送/停止） | 取代 composer（3 行輸入框 + shipped 圓形發送/停止按鈕） |
| 設置頁所有頁面、打開配置文件 | 取代設置面板（極簡設置 Dialog） |

### 極簡設置 Dialog（側欄底部 ⚙）
- **語言選擇**（即時生效）
- **DeepSeek API Key**：輸入框失焦時自動呼叫 DeepSeek API 驗證（`/user/balance`），有效才保存；含 spinner 動畫與獲取 Key 連結
- **離開極簡模式**按鈕

### 極簡標題列：三個模式
| 模式 | 基礎 | 模型 | 特點 |
|---|---|---|---|
| 聊天模式 | minimal + 聯網（web_search/web_fetch） | V4-Flash | 極簡 + 能上網查資料 |
| 工作模式 | standard | V4-Flash | 完整編碼能力（含 goal 工具） |
| 專家模式 | PTC（Code Mode） | V4-Pro | 最強推理，工具以 TypeScript 程序組合 |

點擊即切換默認 Agent 預設 + 模型（與官方設置寫入同一位置）。

### Full Access 權限
極簡 session 掛載時自動切到 **danger-full-access**（透過官方 `sandbox/mode` session override 機制，與 UI 切權限同一路徑）。**離開極簡模式或插件停用時自動恢復原權限**。只影響極簡 session，不影響其他 session。

### 餘額顯示
輸入框下方右對齊顯示 DeepSeek 帳戶餘額（**全部幣種**，如 `CNY 110.00 · USD 15.00`），**每輪對話結束時自動刷新**。

### 輸入體驗
- 3 行輸入框，Enter 送出（Shift+Enter 換行）
- **繁忙時 Enter = 插話發送**（消息直接送入運行中的回合）
- 圓形發送按鈕與普通模式一致；Agent 運行中自動變成**停止**按鈕（可中斷對話）

### 普通模式（離開極簡後）
唯一改動：**通用設置最底部的「進入極簡模式」按鈕**——隨時可再進入。其他完全原樣。

---

## 安裝

### 方式 A：讓 Agent 幫你裝（推薦）

1. 把本倉庫 clone 到你的 workspace：
   ```bash
   git clone https://github.com/johnnycls/dsh-minimal-mode.git
   ```
2. 打開 DSH，對 Agent 說（任一句）：
   - 「**幫我設置好**」
   - 「**安裝極簡模式插件**」
   - 「**我想要開箱即用**」
   - 「**把界面弄簡單一點**」

   Agent 會（透過本倉庫的 skill 指南）：讀取 `host.js` 與 `client.js` → `cordis_define` 定義插件 → `cordis_run` 啟動。完成後 DSH 立即進入極簡模式。

### 方式 B：手動安裝

1. 讀取本倉庫的 `host.js` 全文 → 作為 `cordis_define` 的 `code.host`
2. 讀取 `client.js` 全文 → 作為 `cordis_define` 的 `code.client`
3. `cordis_define`（idPrefix 建議 `mini`），然後 `cordis_run`
4. 在頁面上核准運行請求

### 方式 C：安裝為 Agent Skill（讓「幫我設置好」永遠可用）

把 `skill/極簡模式.md` 放入你的 Agent preset 的 `skills/` 目錄（例如 `~/.dsh/.agent-presets/<preset>/skills/`）。之後任何 session 只要說「幫我設置好 / 開箱即用 / 極簡模式」，Agent 就會自動按 skill 指引安裝本插件。

---

## 使用

| 操作 | 結果 |
|---|---|
| 打開 DSH | 自動進入極簡模式，自動選聊天模式 |
| ⚙（側欄底部） | 極簡設置：語言、API Key（自動驗證保存）、離開極簡模式 |
| 標題列三顆按鈕 | 切換 聊天/工作/專家 模式（含模型切換） |
| 輸入框 Enter | 送出；繁忙時插話發送 |
| 圓形按鈕 | 發送 / 運行中變停止（中斷） |
| 輸入框下方 | 餘額（多幣種、每輪結束刷新） |
| 離開極簡模式 | 當前會話恢復完整 UI；刷新/重開又自動進入極簡 |

## 卸載

1. 對 Agent 說「停用極簡模式插件」或手動 `cordis_stop` / `cordis_undefine`
2. 插件停用時會自動：清理它創建的 preset（工作/專家；聊天模式為保留聯網而常駐，可手動刪 `~/.dsh/.agent-presets/chat`）、恢復 busyEnter、恢復 sandbox 權限
3. 刪除 workspace 下的 `.dsh-minimal-mode.json` 可清除狀態記錄

---

## 注意事項與限制

- **Full Access**：極簡模式下當前 session 的 sandbox 為 danger-full-access——Agent 可寫任意文件。離開極簡模式或停用插件即恢復，但請理解其影響。
- **聊天模式常駐**：因 sandbox 寫入限制，帶聯網的 `chat` preset 常駐於 `~/.dsh/.agent-presets/`（普通模式的 Agent 列表會看到「聊天模式」）。Full Access 生效後此限制已緩解；若普通模式不想看到它，可刪除該目錄（進入極簡模式時插件會嘗試重建並補上聯網工具）。
- **Logo 隱藏依賴 CSS Modules 命名**（`[class$="_logoRow"]`）——DSH 大幅升級若改變 CSS 命名規則可能失效（極簡模式其餘功能不受影響）。
- **模型名稱**：`deepseek-v4-flash` / `deepseek-v4-pro` 是部署內置的 DeepSeek 目錄模型；若你的部署模型 id 不同，請在 `host.js` 的 `MINIMAL_PRESETS` 中調整。
- 插件為**動態插件**（session 內安裝，重啟 DSH 後需重新安裝）——如需永久安裝，可將本代碼整合進你的 profile bundle（見 DSH 的 cordis.patch.yml 機制）。

## 架構簡述

- **Host 半邊**（`host.js`）：狀態持久化、偏好套用（settings）、Full Access（sandbox/mode override）、API Key 驗證與餘額（subprocess curl）、極簡 preset 管理（agentPresets.copy/remove）、對話中斷（agent.cancel）
- **Client 半邊**（`client.js`）：極簡 UI（取代 sidebar.settings / conversation.session.header / conversation.composer.bar）、設置 Dialog、模式按鈕、餘額行
- 通訊：Package-private RPC（`harness.handle` / `host.call`）；settings patch 由 client 構造以繞過動態沙箱的 prototype 差異
- 詳情見各文件頭部註釋

## License

MIT
