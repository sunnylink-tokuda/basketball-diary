export async function adviceFailure(error, data) {
  let body = data;
  const response = error?.context;
  if (response && typeof response.json === 'function') {
    try { body = await (typeof response.clone === 'function' ? response.clone() : response).json(); } catch { /* Network/non-JSON error. */ }
  }
  const retryAfter = Math.min(60, Math.max(0, Number(body?.retry_after) || (body?.status === 'busy' ? 60 : 0)));
  if (body?.status === 'busy') return { retryAfter, message: '前の生成・再試行から60秒の待ち時間があります。日記は保存されています。少し待ってから、もう一度ためしてね。' };
  if (body?.status === 'limited') return { retryAfter: 0, message: '今日はAIを使える回数の上限に達しました。日記は保存されています。時間をおいて、明日もう一度ためしてね。' };
  if (body?.status === 'changed') return { retryAfter: 0, message: '生成中に日記の状態が変わりました。日記を開き直して、もう一度ためしてね。' };
  const messages = {
    output_limit: 'AIの回答が長くなり、最後まで受け取れませんでした。少し待って、もう一度ためしてね。',
    format: 'AIの回答を正しく確認できませんでした。少し待って、もう一度ためしてね。',
    provider_rate_limit: 'AIが利用制限により応答できませんでした。時間をおいて、もう一度ためしてね。',
    provider: 'AIとの通信に失敗しました。少し待って、もう一度ためしてね。',
    save: 'アドバイスを保存できませんでした。少し待って、もう一度ためしてね。',
    incomplete: 'AIから完全な回答を受け取れませんでした。少し待って、もう一度ためしてね。',
  };
  if (messages[body?.code]) return { retryAfter, message: `${messages[body.code]} 日記は保存されています。` };
  if (response?.status === 401) return { retryAfter: 0, message: 'ログインの有効期限を確認できませんでした。ログインし直してね。日記は保存されています。' };
  if (response?.status === 403) return { retryAfter: 0, message: 'AIを利用するアカウントの権限を確認してください。日記は保存されています。' };
  return { retryAfter, message: 'アドバイスの取得に失敗しました。日記は保存されています。通信を確認して、もう一度ためしてね。' };
}
