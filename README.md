# 旅途手札

行程規劃加旅遊分帳的 PWA。Next.js＋Neon＋Vercel。

- 只有建立者（你）用 Google 登入；同行者點邀請連結、選自己的名字就能加入，不用註冊。
- 行程：每日時間軸、拖曳排序、Google 地圖上的編號圖釘與直線路線。
- 分帳：均分＋指定參與者、多幣別（每趟旅程每種外幣一個手動匯率）、個人花費、最少轉帳次數結算、逐筆標記已付。
- 沒有網路時仍可新增花費，連線後自動補傳。
- 另有花費統計，以及每個人各自獨立的待辦清單。

## 在自己電腦上跑

需要 Node.js 20.9 以上（這台 Mac 裝在 `~/.local/node`，所以指令前要先把它加進 PATH）。

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npm install
npm run dev        # http://localhost:3210
```

什麼環境變數都不設也能跑：

- 沒有 `DATABASE_URL` 時，資料存在專案裡的 `.pglite/` 資料夾（不會進 git）。
- 沒有 `GOOGLE_CLIENT_ID` 時，登入頁會出現「開發模式登入」按鈕。正式環境永遠不會出現。
- 沒有 `NEXT_PUBLIC_GOOGLE_MAPS_KEY` 時，行程頁只顯示清單與示意底圖，新增地點只能手打名稱。

## 測試

```bash
npm test                    # 分帳與換算的單元測試
node scripts/smoke.mjs      # 整合測試：需要 npm run dev 正在執行
```

`smoke.mjs` 會建立一趟測試旅程，跑完登入、認領、記帳、結算鎖定、重置連結等流程後刪除。

離線功能要用正式模式才測得到（開發模式不註冊 service worker）：

```bash
npm run build
LOCAL_PGLITE=1 SESSION_SECRET='dev-only-secret-do-not-use-in-production' OWNER_EMAILS='dev@localhost' npm run start
```

## 上線步驟

1. **Neon**：建立專案，複製連線字串。把 `sql/001_init.sql` 貼到 SQL Editor 執行一次，或在本機執行
   `DATABASE_URL="..." npm run db:migrate`。
2. **Google Cloud**（同一個專案即可）：
   - 「API 和服務 → 憑證」建立 OAuth 用戶端（網頁應用程式），已授權的重新導向 URI 填
     `https://你的網域/api/auth/callback`。
   - 啟用 **Maps JavaScript API** 與 **Places API (New)**，建立 API 金鑰，限制為你的網域（HTTP 參照網址），
     並在「配額」設定每日用量上限。
3. **Vercel**：匯入這個 repo，設定下列環境變數後部署。

| 變數 | 說明 |
|---|---|
| `DATABASE_URL` | Neon 連線字串 |
| `SESSION_SECRET` | 至少 32 個隨機字元，用來簽署登入與邀請 cookie |
| `OWNER_EMAILS` | 允許登入的 Google 帳號，逗號分隔 |
| `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` | OAuth 用戶端 |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Google Maps 金鑰 |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | 選填，自訂地圖樣式的地圖 ID |
| `NEXT_PUBLIC_APP_NAME` | 選填，預設「旅途手札」 |

## 程式結構

| 位置 | 內容 |
|---|---|
| `lib/money.ts` | 幣別、換算、均分、最少轉帳。伺服器與瀏覽器共用，有單元測試 |
| `lib/trip.ts` | 權限判斷、一次取回整趟旅程的資料、所有寫入操作與驗證 |
| `lib/auth.ts` | 建立者登入 cookie、同行者邀請 cookie |
| `lib/db.ts` | Neon 或本機 PGlite 的連線 |
| `app/api/` | 登入、建立旅程、取資料、執行操作、認領 |
| `components/TripApp.tsx` | 旅程內所有畫面的外殼與切換（只改網址參數，離線也能切） |
| `components/useTrip.ts` | 資料同步、手機端快取、離線花費佇列 |
| `components/views/` | 總覽、行程、記帳／記一筆／結算／統計、待辦、設定 |
| `components/Scenes.tsx` | 四個封面場景插畫（山城、山海、海邊、都市） |
| `public/sw.js` | service worker：離線時能開啟旅程頁 |

## 已知限制

- 同行者沒有帳號，「個人花費」與「個人待辦」只是介面上不顯示別人的，並非真正保密。
- 離線時只能新增花費；修改花費、編輯行程、勾待辦都需要連線。
- 地圖本身離線時無法顯示。
- 結算幣別在建立旅程後不能更改。
