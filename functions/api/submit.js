export async function onRequestPost(context) {
  try {
    const data = await context.request.json();

    const gasUrl = context.env.GAS_WEB_APP_URL;
    const secret = context.env.GAS_API_SECRET;

    if (!gasUrl || !secret) {
      return json({ success:false, message:"サーバー設定が完了していません。" }, 500);
    }

    const url = gasUrl + (gasUrl.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(secret);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const text = await response.text();
    let result;
    try { result = JSON.parse(text); }
    catch (_) { result = { success:false, message:"バックエンドから正しい応答を取得できませんでした。" }; }

    return json(result, response.ok ? 200 : 502);
  } catch (error) {
    return json({ success:false, message:"通信中にエラーが発生しました。" }, 500);
  }
}

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type":"application/json; charset=utf-8" }
  });
}