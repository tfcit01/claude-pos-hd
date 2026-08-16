# POS 硬碟汰換管理系統

全館 250 台 POS 設備硬碟汰換進度管理後台。React + Vite 前端,資料儲存於 Firebase(專案 `pos-hd-25e72`),部署於 GitHub Pages。

## 功能

- Email/密碼登入(Firebase Authentication,不開放自助註冊)
- 儀表板:硬碟更換進度總覽(未排程/已排程/施工中/已完成/異常暫緩)
- 設備清單:搜尋、篩選、單筆編輯、停用
- Excel 匯入:以 POS機號比對現有資料,產生「新增/異動/資料庫多出」三類差異畫面,人工勾選確認後才寫入
- 歷史紀錄:所有匯入與手動編輯的異動軌跡(僅可新增,不可竄改,供稽核使用)

## 一、Firebase 後台設定(部署前必做)

1. **Authentication → Sign-in method**:啟用「電子郵件/密碼」
2. **Authentication → Users**:手動新增 1~3 組管理帳號(不開放自助註冊)
3. **Firestore Database → 規則**:貼上本專案 `firestore.rules` 的內容並發布
4. **Authentication → Settings → 已授權網域**:加入 `<你的帳號>.github.io`

## 二、本機開發

```bash
npm install
npm run dev
```

## 三、部署到 GitHub Pages

網址預計為:`https://tfcit01.github.io/claude-pos-hd`,對應 repo 名稱 `claude-pos-hd`。

### 建議做法:GitHub Actions 自動部署(已內建 workflow)

1. 建立 GitHub repo,名稱為 `claude-pos-hd`
2. 將本專案所有檔案 push 上去(見下方指令)
3. 到 repo 的 **Settings → Pages**,「Source」選擇 **GitHub Actions**
4. 之後每次 push 到 `main` 分支,會自動建置並部署,網址不變

```bash
cd pos-hd-system
git init
git add .
git commit -m "init: POS 硬碟汰換管理系統"
git branch -M main
git remote add origin https://github.com/tfcit01/claude-pos-hd.git
git push -u origin main
```

首次 push 後,到 repo 的 **Actions** 分頁確認 workflow 是否執行成功(通常 1~2 分鐘)。

> ⚠️ 若之後 repo 名稱或帳號有變動,記得同步修改 `vite.config.js` 的 `base` 與 `src/App.jsx` 的 `basename`,否則頁面資源路徑與登入導頁會跑掉。

## 四、Excel 匯入格式

第一列需為欄位標題,系統會自動辨識以下欄位名稱(允許些微差異):

| 欄位 | 可辨識的標題文字 |
|---|---|
| 店櫃名稱 | 店櫃名稱、店櫃 |
| POS機號(必要,唯一鍵) | POS機號、POS 機號、機號 |
| 作業系統 | 作業系統、OS |
| 完成硬碟更換 | 完成硬碟更換、硬碟更換狀態(接受:未排程/已排程/施工中/已完成/異常暫緩,或是/否) |
| 硬碟版號 | 硬碟版號 |
| 發票機驅動程式版本 | 發票機驅動程式版本、發票機驅動程式 |

「店櫃名稱」與「POS機號」為必要欄位,缺少會無法匯入。

## 五、資料結構(Firestore)

```
/pos_devices/{POS機號}
  storeName, posId, os, hdStatus, hdVersion, printerDriverVer,
  status ("active" | "inactive"), lastUpdated, lastUpdatedBy

/history/{自動ID}
  posId, action, field, oldValue, newValue, operator, timestamp
```

## 六、安全性備註

- 本專案 Firebase 專案與貴公司既有的收銀機硬體管理系統**完全獨立**,互不影響
- `firebaseConfig` 中的 `apiKey` 公開於前端屬正常設計,真正的存取控制來自 Firestore 安全規則(見 `firestore.rules`)與 Firebase Authentication
- 若要新增/移除管理帳號,直接在 Firebase Console → Authentication → Users 操作即可,不需改程式碼
