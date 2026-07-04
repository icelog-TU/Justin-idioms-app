/**
 * 成語小學堂 — AI 造句評分代理
 *
 * 這個 Cloudflare Worker 是前端 Justin-idioms.html/.jsx 與 OpenAI 之間的中間人：
 * OPENAI_API_KEY 只存在 Cloudflare 的 Secret 裡，永遠不會出現在前端程式碼或這個
 * repo 裡，瀏覽器只會呼叫這支 Worker，Worker 才會拿著金鑰去問 OpenAI。
 *
 * 部署步驟見 worker/README.md。
 */

const MODEL = "gpt-4o-mini";
const MAX_IDIOM_LEN = 12;
const MAX_MEANING_LEN = 200;
const MAX_SENTENCE_LEN = 150;

function corsHeaders(origin, allowedOrigins) {
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigins = getAllowedOrigins(env);
    const cors = corsHeaders(origin, allowedOrigins);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (allowedOrigins.length && !allowedOrigins.includes(origin)) {
      return json({ error: "origin not allowed" }, 403, cors);
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/grade") {
      return json({ error: "not found" }, 404, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "invalid json" }, 400, cors);
    }

    const idiom = typeof body.idiom === "string" ? body.idiom.trim() : "";
    const meaning = typeof body.meaning === "string" ? body.meaning.trim() : "";
    const sentence = typeof body.sentence === "string" ? body.sentence.trim() : "";

    if (!idiom || !sentence || idiom.length > MAX_IDIOM_LEN || meaning.length > MAX_MEANING_LEN || sentence.length > MAX_SENTENCE_LEN) {
      return json({ error: "invalid input" }, 400, cors);
    }

    const systemPrompt = `你是一位溫暖、有耐心又很會鼓勵小朋友的國小國語老師，正在批改小朋友用成語造句的作業。
規則：
1. 判斷這個句子有沒有正確、合理地用出這個成語（意思要符合成語原意，句子要通順）。
2. 一定要非常有建設性、正向、花式誇獎小朋友，語氣活潑溫暖，可以用一些可愛的形容詞和表情符號，但內容要具體（提到句子哪裡寫得好），不能只是空泛地說「很棒」。
3. 就算句子有錯誤或成語用得不太對，也絕對不能負面或讓小朋友難過；先肯定他願意嘗試，再用「tip」欄位溫柔地給一個具體、好懂的小建議，幫助他下次寫得更好。
4. score 是 1 到 5 的整數：5 分＝用得又對又生動、句子通順；分數越低代表越需要調整，但即使是 1~2 分也要維持鼓勵的語氣。
5. 只能輸出 JSON，格式為 {"score": 整數1-5, "praise": "花式誇獎的話，繁體中文", "tip": "具體小建議，繁體中文；如果句子已經很好，可以是鼓勵繼續嘗試更難句型的話，不能是空字串"}，不要輸出任何其他文字。`;

    const userPrompt = `成語：${idiom}\n成語的意思：${meaning}\n小朋友寫的句子：${sentence}`;

    let aiRes;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 300,
          temperature: 0.9,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
    } catch (e) {
      return json({ error: "upstream request failed" }, 502, cors);
    }

    if (!aiRes.ok) {
      return json({ error: "upstream error" }, 502, cors);
    }

    let data;
    try {
      data = await aiRes.json();
    } catch (e) {
      return json({ error: "bad upstream response" }, 502, cors);
    }

    let parsed;
    try {
      parsed = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      return json({ error: "bad model output" }, 502, cors);
    }

    const score = Math.max(1, Math.min(5, Math.round(Number(parsed.score) || 3)));
    const praise = typeof parsed.praise === "string" && parsed.praise.trim() ? parsed.praise.trim() : "你好棒，願意動手寫句子就已經很厲害了！";
    const tip = typeof parsed.tip === "string" ? parsed.tip.trim() : "";

    return json({ score, praise, tip }, 200, cors);
  },
};
