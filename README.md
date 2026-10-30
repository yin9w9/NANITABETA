# 何食べた · 飲食手帳

正式網站：[https://yin9w9.github.io/NANITABETA/](https://yin9w9.github.io/NANITABETA/)

已建立獨立 Firebase 專案 `nanitabeta-8d597`（Spark），Firestore 位於台灣 asia-east1，已啟用 Google 登入、正式網域授權及本人存取規則，公開 Web config 已隨網站部署。

日系低飽和配色的響應式飲食紀錄網頁，純 HTML / CSS / JavaScript，支援 GitHub Pages 專案路徑。

## 使用

`node server.cjs` → http://127.0.0.1:4174 ，不要直接以 file:// 開啟。

- 每日餐點新增、修改、刪除；份數或克數輸入；五項獨立圓環圖。
- 預設蛋白質15份、碳水6份、蔬菜3份、水3000ml、油脂2份；目標可修改。
- 日／週（週一開始）／月／季詳細紀錄與平均。包含無紀錄日；當期僅計到今天。歷史進度使用目前目標。
- 克數：碳水÷15 → max(0, (蛋白質−碳水份數×2)÷7) → max(0, (油脂−蛋白質份數×基數)÷5)。基數3／5／10，保留完整精度加總，畫面顯示到小數2位。蔬菜直接輸入份數，飲水輸入ml。份數模式直接統計。
- 混合餐點只有一個肉類基數，若含不同脂肪類別，請拆成多筆輸入。
- CSV 匯出、JSON 備份及合併還原。還原保留目前目標，相同ID保留現有紀錄。
- 本機資料儲存在瀏覽器 localStorage，清除網站資料會移除紀錄，請定期備份。

## Firebase

1. 建立獨立 Firebase 專案，新增 Web app。
2. 將公開 Web config 填入 `firebase-config.js` 的 `window.FIREBASE_CONFIG`，不可放服務帳號金鑰。
3. Authentication 啟用 Google，設定支援電子郵件；Authorized domains 加入 `yin9w9.github.io` 與本機測試的 `127.0.0.1`、`localhost`。
4. 建立 Cloud Firestore Standard，選 production mode，再發布 `firestore.rules` 全文。
5. 手機與電腦以相同 Google 帳號登入。需允許登入彈出視窗，請使用 Safari 或 Chrome。

資料路徑為 `foodUsers/{uid}/entries/{id}` 與 `foodUsers/{uid}/settings/goals`，規則只允許本人存取。不同餐點獨立寫入；同一餐點多裝置編輯採最後寫入者。登入顯示雲端紀錄，本機資料不自動上傳，可按「將本機紀錄合併至雲端」，相同ID保留雲端內容，目標保留雲端設定。雲端編輯需要連線，快取不代表已同步。

## GitHub Pages

將本資料夾內容上傳至儲存庫根目錄，Settings → Pages → Deploy from a branch → main / (root)。公開程式碼不包含使用者飲食紀錄。不要上傳個人備份。

## 驗證

`node --test nutrition.test.mjs`：8項測試通過，涵蓋營養換算、負值、基數、跨年週、閏月、季度、含空白日平均。瀏覽器驗證新增克數餐點、編輯基數、重新載入保留、歷史清單與平均，以及390px內嵌手機版。正式站已驗證 Google 登入及 Firestore 連線和目標寫入。實體手機與電腦的跨裝置驗收仍待使用者完成。

官方文件：[Firebase Google 登入](https://firebase.google.com/docs/auth/web/google-signin)、[Firestore 即時監聽](https://firebase.google.com/docs/firestore/query-data/listen)、[GitHub Pages 設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。
