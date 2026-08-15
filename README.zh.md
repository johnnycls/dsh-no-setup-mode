# DeepSeek Harness 免設置模式（dsh-no-setup-mode）

> **主人，歡迎回來～** 一條指令裝好，剩下的交給 DeepSeek 女僕打理就好。

**English version：[README.md](./README.md)**

一個給 DeepSeek Harness（DSH）的免設置模式插件：裝好之後自動進入免設置界面，隱藏複雜功能，自動完成最佳設置（模型、Agent 預設、輸入行為），只保留核心對話與必要設置。透過 DSH profile 安裝一次即可。

---

## 這是什麼

免設置模式把 DSH 變成「打開就能聊」的工具——一位裝在插件裡的女僕：

- 安裝後**自動進入免設置模式**，不需任何手動設置
- 自動套用最佳設置：**聊天模式**（免設置 + 聯網 + DeepSeek-V4-Flash）、繁忙時**Enter 插話發送**、**Agent 預設**
- 把 Logo、對話/軌跡 tab、Session Log、輸入框多餘按鈕、設置頁全部頁面都收好
- 免設置設置 Dialog 只留真正重要的：語言、DeepSeek API Key、離開

## 適合誰

- **懶得設置的人**——不想研究模型、預設、沙箱、各種選項，裝完直接開始對話
- 想要**開箱即用**的體驗——每次啟動 DSH 自動進入免設置模式
- 被複雜界面干擾的人——只想專注對話本身
- 想讓 DSH 幫你做好所有決定的人

**不適合**：需要頻繁使用軌跡視圖、Session Log、子代理目錄、手動選模型等高級功能的人——主人您太進階了，這簡單的生活配不上您（這是誇獎）。

## 什麼時候安裝（給 Agent 看）

當用戶說出以下任一句（或變體）時，幫用戶安裝本插件：

- 「幫我設置好」「幫我配置好」「開箱即用」
- 「安裝免設置模式」「免設置模式插件」「把界面弄簡單」
- 「我懶得設置」「簡單模式」

當你判斷用戶需要時，也應該幫用戶安裝，例如：

- 用戶是 DSH 新手，看起來被界面或設置流程淹沒
- 用戶想立即開始對話，不想配置模型、預設或沙箱選項
- 用戶提到界面太複雜、太多按鈕、令人分心
- 用戶想要乾淨、無干擾的對話界面

不確定時，先問一句「要我幫你安裝免設置模式插件嗎？」再動手。安裝時按 [agent skill](./skill/no-setup-mode-install.md) 的步驟執行。

---

## 功能

### 自動完成的最佳設置
- 進入免設置模式時自動：選擇**聊天模式**（免設置 + 聯網 + DeepSeek-V4-Flash）、設定默認 Agent 預設、把繁忙時 Enter 設為**插話發送**（busyEnter=steer）
- 所有設置寫入官方 settings（與手動設置完全一致，隨時可在普通模式查看）

### 人設（角色扮演）
- 標題列右側提供三個人設：**無人設 / 女僕 / 管家**——選女僕，您的 Agent 真的會變成女僕；選管家，它會變成一位得體的紳士
- 選擇女僕或管家時，會在該對話的 system prompt 中注入完整角色卡（性格、設定、背景資料、祕密、三觀、喜好）加上文字處理職責與回應規範
- 人設按對話獨立記憶、重啟後保持，**新對話自動繼承您最近的選擇**

### 免設置模式下的 Full Access
- 進入免設置模式時把當前對話切到 **Full Access**（danger-full-access）：對話過程不再彈出審核；離開免設置模式即恢復部署默認
- **新開的對話也會自動 Full Access**——全程不打擾
- ⚠️ Full Access 代表 Agent 可以**不經詢問修改本機任何東西**——只在信任對話內容時使用免設置模式

### 免設置模式下隱藏
| 元素 | 方式 |
|---|---|
| Logo | CSS |
| 對話/軌跡 tab、Session Log | 免設置標題列取代 header |
| 輸入框多餘按鈕 | 免設置輸入列取代 composer（保留發送/停止） |
| 設置頁所有頁面、打開配置文件 | 免設置設置 Dialog 取代設置面板 |

### 免設置設置 Dialog（側欄底部 ⚙）
- **語言選擇**（即時生效——整個 UI 跟著切換，中/英）
- **DeepSeek API Key**：輸入後失焦自動保存（格式校驗），附獲取 Key 連結
- **離開免設置模式**按鈕（同時把人設歸零、恢復默認權限）

### 免設置標題列：三個模式
| 模式 | 基礎 | 模型 | 思考強度 |
|---|---|---|---|
| 免設置：聊天（Chat） | 免設置 + 聯網（web_search / web_fetch） | DeepSeek-V4-Flash | off |
| 免設置：工作（Work） | 標準模式 | DeepSeek-V4-Flash | high |
| 免設置：專家（Expert） | PTC（Code Mode） | DeepSeek-V4-Pro | max |

點擊即切換默認 Agent 預設、模型與思考強度（reasoning effort）。

### 餘額顯示
- 輸入框下方右對齊顯示 DeepSeek 帳戶餘額——**API 返回的每個幣種（USD、CNY，順序固定）各自顯示**，每輪對話結束自動刷新
- 需要先設定 DeepSeek API Key（在免設置設置 ⚙ 中輸入；未設定 Key 前不顯示）

### 普通模式
- UI 唯一改動：**通用設置最底部的「進入免設置模式」按鈕**——隨時可再進入
- **聊天模式也會出現在普通模式的 Agent 預設列表中**（它常駐於 `~/.dsh/.agent-presets/` 以保留聯網工具）；不想看到可刪除該目錄——下次進入免設置模式時插件會重建

---

## 安裝

> **安裝 github:johnnycls/dsh-no-setup-mode**

Agent 可參考 [agent skill](./skill/no-setup-mode-install.md) 中的安裝步驟。全部安裝步驟都在 skill 裡——README 是給人看的，skill 是給 Agent 看的。

**前置要求：** 已安裝 `git`（倉庫是公開的，無需認證）且能連上 GitHub。

**安裝後請重啟 DSH**——插件在啟動時載入，下次打開就會自動進入免設置模式。（只刷新瀏覽器不夠：插件的 host 半邊必須重啟才生效。）

### 疑難排解

| 問題 | 解法 |
|---|---|
| 重啟後沒有任何變化 | 強制刷新瀏覽器（Ctrl+Shift+R）；若仍無效再重啟一次 DSH |
| 輸入框下方沒有餘額 | 打開 ⚙ 輸入你的 DeepSeek API Key——設定後餘額即出現 |
| `dsh plugin add` 報 pnpm/corepack 錯誤 | 先 `export COREPACK_HOME="$HOME/.cache/node/corepack"` 再重試安裝 |
| 其他問題 | 執行 `bash scripts/smoke-test.sh` 並把輸出貼給求助對象 |

### 更新

執行 `dsh plugin update dsh-no-setup-mode`，然後重啟 DSH。（或叫你的 Agent 處理——它會參考安裝 skill。）

## 使用

| 操作 | 結果 |
|---|---|
| 打開 DSH | 自動進入免設置模式，自動選聊天模式 |
| ⚙（側欄底部） | 免設置設置：語言、API Key、離開免設置模式 |
| 標題列三顆按鈕 | 切換 聊天 / 工作 / 專家 模式（含模型與思考強度切換） |
| 右側按鈕 | 切換人設：無人設 / 女僕 / 管家（下一輪回覆起生效） |
| 圓形按鈕 | 發送；Agent 運行中變停止（中斷對話） |
| 輸入框下方餘額行 | DeepSeek 帳戶餘額，每輪對話結束刷新 |
| 離開免設置模式 | 當前會話恢復完整 UI，人設歸零，權限恢復默認 |

## 卸載

執行 `dsh plugin remove dsh-no-setup-mode`（或叫你的 Agent 處理——它會參考 [uninstall skill](./skill/no-setup-mode-uninstall.md)）。


## 打造你自己的模式（Fork 指南）

想要一個屬於自己的模式？這個 repo 專為 fork 設計：所有對外名稱都派生自單一的 `MODE` 物件——fork 之後就是一個獨立的插件，不會與原版衝突（端點路徑、狀態檔、插件 id、設置項 id 全部由 `MODE.code` 派生）。

製作自己的模式插件：

1. **修改 `MODE`**（`lib/index.js` 與 `lib/client.js` 各一份，兩處值一致）：
   - `code` —— 唯一的小寫連字號 id；派生端點路徑（`/<code>/...`）、人設狀態檔（`~/.dsh/.<code>-persona.json`）、cordis 插件 id 與設置項 id。改它即可與其他模式插件徹底隔離。
   - `nameZh` / `nameEn` —— 你的模式顯示名
   - `presetPrefix` —— preset 名稱前綴（如「免設置」換成你自己的）
   - `presets` —— 模式清單（id、複製來源、顯示名後綴）
2. **改名套件**：`package.json`（name / description / keywords）與 `cordis.patch.yml` 中的插件行（id 與 name 須與新的 code / 包名一致）。
3. **改名 GitHub repo。**
4. 重新安裝：`dsh plugin add github:<你的帳號>/<repo>`，然後重啟 DSH。


## 執行測試

冒煙測試會檢查 bundle 語法與結構、名稱一致性（MODE / package / patch）、端點路徑，以及（DSH 運行中時）boot manifest 與實際端點：

```bash
bash scripts/smoke-test.sh
```


## License

MIT
