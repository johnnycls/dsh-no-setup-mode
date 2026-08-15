# DeepSeek Harness 極簡模式（dsh-minimal-mode）

> **安裝後開箱即用，幫你做出最好的設置。**

**English version：[README.md](./README.md)**

一個給 DeepSeek Harness（DSH）的極簡模式插件：裝好之後自動進入極簡界面，隱藏複雜功能，自動完成最佳設置（模型、Agent 預設、輸入行為），只保留核心對話與必要設置。透過 DSH profile 安裝一次即可。

---

## 這是什麼

極簡模式把 DSH 變成「打開就能聊」的工具：

- 安裝後**自動進入極簡模式**，不需任何手動設置
- 自動套用最佳設置：**聊天模式**（極簡 + 聯網 + DeepSeek-V4-Flash）、繁忙時**Enter 插話發送**、**Agent 預設**
- 隱藏 Logo、對話/軌跡 tab、Session Log、輸入框多餘按鈕、設置頁全部頁面
- 極簡設置 Dialog 只保留：語言、DeepSeek API Key、離開極簡模式

## 適合誰

- **懶得設置的人**——不想研究模型、預設、沙箱、各種選項，裝完直接開始對話
- 想要**開箱即用**的體驗——每次啟動 DSH 自動進入極簡模式
- 被複雜界面干擾的人——只想專注對話本身
- 想讓 DSH 幫你做好所有決定的人

**不適合**：需要頻繁使用軌跡視圖、Session Log、子代理目錄、手動選模型等高級功能的人。

## 什麼時候安裝（給 Agent 看）

當用戶說出以下任一句（或變體）時，幫用戶安裝本插件：

- 「幫我設置好」「幫我配置好」「開箱即用」
- 「安裝極簡模式」「極簡模式插件」「把界面弄簡單」
- 「我懶得設置」「簡單模式」

當你判斷用戶需要時，也應該幫用戶安裝，例如：

- 用戶是 DSH 新手，看起來被界面或設置流程淹沒
- 用戶想立即開始對話，不想配置模型、預設或沙箱選項
- 用戶提到界面太複雜、太多按鈕、令人分心
- 用戶想要乾淨、無干擾的對話界面

不確定時，先問一句「要我幫你安裝極簡模式插件嗎？」再動手。安裝時按 [agent skill](./skill/minimal-mode-install.md) 的步驟執行。

---

## 功能

### 自動完成的最佳設置
- 進入極簡模式時自動：選擇**聊天模式**（極簡 + 聯網 + DeepSeek-V4-Flash）、設定默認 Agent 預設、把繁忙時 Enter 設為**插話發送**（busyEnter=steer）
- 所有設置寫入官方 settings（與手動設置完全一致，隨時可在普通模式查看）

### 極簡模式下隱藏
| 元素 | 方式 |
|---|---|
| Logo | CSS |
| 對話/軌跡 tab、Session Log | 極簡標題列取代 header |
| 輸入框多餘按鈕 | 極簡輸入列取代 composer（保留發送/停止） |
| 設置頁所有頁面、打開配置文件 | 極簡設置 Dialog 取代設置面板 |

### 極簡設置 Dialog（側欄底部 ⚙）
- **語言選擇**（即時生效）
- **DeepSeek API Key**：輸入後失焦自動保存（格式校驗），附獲取 Key 連結
- **離開極簡模式**按鈕

### 極簡標題列：三個模式
| 模式 | 基礎 | 模型 |
|---|---|---|
| 聊天模式 | 極簡 + 聯網（web_search / web_fetch） | DeepSeek-V4-Flash |
| 工作模式 | 標準模式 | DeepSeek-V4-Flash |
| 專家模式 | PTC（Code Mode） | DeepSeek-V4-Pro |

點擊即切換默認 Agent 預設與模型。

### 餘額顯示
- 輸入框下方右對齊顯示 DeepSeek 帳戶餘額——**API 返回的每個幣種（USD、CNY）各自顯示**，每輪對話結束自動刷新
- 需要先設定 DeepSeek API Key（在極簡設置 ⚙ 中輸入；未設定 Key 前不顯示）

### 普通模式
- UI 唯一改動：**通用設置最底部的「進入極簡模式」按鈕**——隨時可再進入
- **聊天模式也會出現在普通模式的 Agent 預設列表中**（它常駐於 `~/.dsh/.agent-presets/` 以保留聯網工具）；不想看到可刪除該目錄——下次進入極簡模式時插件會重建

---

## 安裝

叫你的 Agent 安裝即可：

> **安裝 github:johnnycls/dsh-minimal-mode**

Agent 可參考 [agent skill](./skill/minimal-mode-install.md) 中的安裝步驟。全部安裝步驟都在 skill 裡——README 是給人看的，skill 是給 Agent 看的。

**前置要求：** 已安裝 `git`（倉庫是公開的，無需認證）且能連上 GitHub。

**安裝後請重啟 DSH**——插件在啟動時載入，下次打開就會自動進入極簡模式。（只刷新瀏覽器不夠：插件的 host 半邊必須重啟才生效。）

### 疑難排解

| 問題 | 解法 |
|---|---|
| 重啟後沒有任何變化 | 強制刷新瀏覽器（Ctrl+Shift+R）；若仍無效再重啟一次 DSH |
| 輸入框下方沒有餘額 | 打開 ⚙ 輸入你的 DeepSeek API Key——設定後餘額即出現 |
| `dsh plugin add` 報 pnpm/corepack 錯誤 | 先 `export COREPACK_HOME="$HOME/.cache/node/corepack"` 再重試安裝 |

### 更新

執行 `dsh plugin update dsh-minimal-mode`，然後重啟 DSH。（或叫你的 Agent 處理——它會參考安裝 skill。）

## 使用

| 操作 | 結果 |
|---|---|
| 打開 DSH | 自動進入極簡模式，自動選聊天模式 |
| ⚙（側欄底部） | 極簡設置：語言、API Key、離開極簡模式 |
| 標題列三顆按鈕 | 切換 聊天 / 工作 / 專家 模式（含模型切換） |
| 圓形按鈕 | 發送；Agent 運行中變停止（中斷對話） |
| 離開極簡模式 | 當前會話恢復完整 UI；下次打開仍自動進入極簡 |

## 卸載

執行 `dsh plugin remove dsh-minimal-mode`（或叫你的 Agent 處理——它會參考 [uninstall skill](./skill/minimal-mode-uninstall.md)）。

## License

MIT
