# AI 造句評分 — Cloudflare Worker 部署說明

這支 Worker 是「成語小學堂」跟 OpenAI 之間的代理伺服器：
`OPENAI_API_KEY` 只會存在 Cloudflare 的 Secret 裡，不會出現在網頁原始碼、也不會出現在
GitHub 上，所以就算 repo 是 Public，也沒有人能偷看到你的金鑰。

只需要做一次（之後小朋友直接用網頁就好，不用再碰這些步驟）。

## 前置需求

- 一台你自己的電腦（Mac/Windows 皆可），裝好 Node.js（`node -v` 能跑出版本號就好）
- 一個 [Cloudflare](https://dash.cloudflare.com/sign-up) 帳號（免費，用 email 註冊即可）
- 一個 [OpenAI](https://platform.openai.com/) 帳號，並在 [API Keys](https://platform.openai.com/api-keys) 頁面建立一把新的 API Key

**強烈建議**：在 OpenAI 後台 → Settings → Billing → Limits，設一個每月花費上限（例如 US$5），
這樣就算未來 Worker 網址不小心外流，最多也只會花到你設定的上限。

## 步驟

1. 把這個 repo clone 到你自己的電腦上（或直接在 GitHub 網頁下載 zip 解壓縮），
   打開終端機 `cd` 進 `worker` 這個資料夾。

2. 安裝 wrangler（Cloudflare 官方的部署工具）：
   ```
   npm install -g wrangler
   ```

3. 登入 Cloudflare（會開瀏覽器要你按「Allow」授權）：
   ```
   wrangler login
   ```

4. 打開 `wrangler.toml`，把 `ALLOWED_ORIGINS` 改成你實際的 GitHub Pages 網址
   （只要「網域」那段，不用加後面的路徑），例如：
   ```
   ALLOWED_ORIGINS = "https://icelog-tu.github.io"
   ```
   這一步是安全關鍵：只有從這個網址開啟的網頁，才能呼叫你的 Worker。

5. 設定金鑰（執行後會提示你貼上 OpenAI API Key，貼上按 Enter 就好，畫面不會顯示金鑰內容）：
   ```
   wrangler secret put OPENAI_API_KEY
   ```

6. 部署：
   ```
   wrangler deploy
   ```
   成功後終端機會印出一個網址，長得像：
   ```
   https://idiom-grader.你的帳號名.workers.dev
   ```
   把這個網址記下來。

7. 回到專案根目錄，打開 `Justin-idioms.jsx`，找到接近檔案最上面的這一行：
   ```js
   const GRADE_API_URL = "https://idiom-grader.YOUR-SUBDOMAIN.workers.dev/grade";
   ```
   把網址換成你剛剛拿到的那個（**記得結尾要加 `/grade`**）。

8. 重新編譯出 `Justin-idioms.html`（第一次需要先 `npm install` 裝相依套件）：
   ```
   npm install
   npm run build
   ```

9. 把 `Justin-idioms.jsx` 和 `Justin-idioms.html` 一起 commit、push 上 GitHub，
   GitHub Pages 會自動更新。

10. 打開 Justin 平常用的網址，進到任一個成語頁面，點「✏️ 換我來造句」，
    寫（或用麥克風說）一句話，按「🧑‍🏫 AI 老師看看」測試看看。

## 之後要怎麼維護

- **金鑰過期或想換一把**：重新執行 `wrangler secret put OPENAI_API_KEY` 覆蓋舊的即可，不用重新部署。
- **修改評分的提示詞/規則**：編輯 `worker/index.js` 裡的 `systemPrompt`，改完後在 `worker` 資料夾裡重新
  `wrangler deploy` 一次就會套用，前端不用改也不用重新 build。
- **想看花了多少錢**：去 OpenAI 後台的 Usage 頁面查詢，`gpt-4o-mini` 每次評分大約幾百字 token，
  正常使用一個小孩每天用幾十次，一個月成本通常在幾毛錢到一兩塊美金之間，非常便宜。
- **Cloudflare Worker 本身免費額度**：每天 10 萬次請求以內完全免費，個人小孩使用絕對用不到。
