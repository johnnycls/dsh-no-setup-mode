# DeepSeek Harness 極簡模式（dsh-minimal-mode）

> **安裝後開箱即用，幫你做出最好的設置。**

**English version：[README.md](./README.md)**

一個給 DeepSeek Harness（DSH）的極簡模式插件：裝好之後自動進入極簡界面，隱藏複雜功能，自動完成最佳設置（模型、Agent 預設、輸入行為），只保留核心對話與必要設置。**永久安裝，重啟依然生效。**

---

## 這是什麼

極簡模式把 DSH 變成「打開就能聊」的工具：

- 安裝後**自動進入極簡模式**，不需任何手動設置
- 自動套用最佳設置：**聊天模式**（極簡 + 聯網 + DeepSeek-V4-Flash）、繁忙時**Enter 插話發送**、**Agent 預設**
- 隱藏 Logo、對話/軌跡 tab、Session Log、輸入框多餘按鈕、設置頁全部頁面
- 極簡設置 Dialog 只保留：語言、DeepSeek API Key、離開極簡模式
- 普通模式唯一改動：設置頁底部的「進入極簡模式」按鈕

## 適合誰

- **懶得設置的人**——不想研究模型、預設、沙箱、各種選項，裝完直接開始對話
- 想要**開箱即用**的體驗——每次啟動 DSH 自動進入極簡模式
- 被複雜界面干擾的人——只想專注對話本身
- 想讓 DSH 幫你做好所有決定的人

**不適合**：需要頻繁使用軌跡視圖、Session Log、子代理目錄、手動選模型等高級功能的人。

## 什麼情況用

- 剛安裝 DSH，對它說「**幫我設置好**」「**開箱即用**」「**安裝極簡模式**」——Agent 會自動完成安裝
- 想要一個乾淨、無干擾的日常對話界面
- 想讓 DSH 自己決定最好的默認設置

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

### 普通模式（離開極簡後）
唯一改動：**通用設置最底部的「進入極簡模式」按鈕**——隨時可再進入。其餘完全原樣。

---

## 安裝（永久）

### 讓 Agent 幫你裝

```bash
git clone https://github.com/johnnycls/dsh-minimal-mode.git
```

然後對 DSH 的 Agent 說：「**幫我設置好**」「**安裝極簡模式**」或「**開箱即用**」。

Agent 會完成：
1. 在本倉庫目錄執行 `dsh plugin add github:johnnycls/dsh-minimal-mode`（或由你手動執行該命令）
2. 重啟 DSH（如有需要）
3. 確認極簡模式生效

> 提示：把本倉庫的 `skill/極簡模式.md` 放入你的 Agent preset 的 `skills/` 目錄後，任何 session 說「幫我設置好」都會自動觸發安裝。

手動安裝：在倉庫目錄執行 `dsh plugin add github:johnnycls/dsh-minimal-mode`。

### 永久性

本插件是 **profile bundle 正式插件**（透過 `cordis.patch.yml` 安裝到你的 DSH profile）——**安裝一次，永久生效**，DSH 重啟後依然存在，不需要重新安裝。

---

## 使用

| 操作 | 結果 |
|---|---|
| 打開 DSH | 自動進入極簡模式，自動選聊天模式 |
| ⚙（側欄底部） | 極簡設置：語言、API Key、離開極簡模式 |
| 標題列三顆按鈕 | 切換 聊天 / 工作 / 專家 模式（含模型切換） |
| 圓形按鈕 | 發送；Agent 運行中變停止（中斷對話） |
| 離開極簡模式 | 當前會話恢復完整 UI；下次打開仍自動進入極簡 |

## 卸載

1. 對 Agent 說「移除極簡模式插件」或手動執行 `dsh plugin remove dsh-minimal-mode`，然後重啟 DSH
2. 工作/專家 preset 由插件建立；聊天模式為保留聯網而常駐，可手動刪除 `~/.dsh/.agent-presets/chat`（連同工作/專家目錄）

---

## 注意事項

- **聊天模式常駐**：帶聯網的 `chat` preset 常駐於 `~/.dsh/.agent-presets/`，普通模式的 Agent 列表會看到「聊天模式」。若不想看到，刪除該目錄即可（進入極簡模式時插件會嘗試重建並補上聯網工具）。
- **Logo 隱藏依賴 CSS Modules 命名**（`[class$="_logoRow"]`）——DSH 大幅升級若改變 CSS 命名規則可能失效（極簡模式其餘功能不受影響）。
- **模型名稱**：`deepseek-v4-flash` / `deepseek-v4-pro` 是部署內置的 DeepSeek 目錄模型；若你的部署模型 id 不同，請修改 `lib/index.js` 與 `lib/client.js` 中的 `MINIMAL_PRESETS` / `MODEL_BY_PRESET`。
- 插件不會替你做 API Key 配置——Key 需要你在極簡設置 Dialog 中自行填入（保存的是你提供的 Key）。

## License

MIT
