import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

export default function ChappyAdvice({ date, record }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [advice, setAdvice] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    setAdvice(null);
    setStatus('');
    setBusy(false);
    if (!session || !record || !Object.keys(record).length) return;
    setBusy(true);
    setStatus('チャッピーが日記を読んでいるよ…');
    // The server reads the saved record. Never send unsaved diary text or API keys.
    supabase.functions.invoke('chappy-advice', { body: { date, action: 'generate' } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        if (data.status === 'ready') { setAdvice(data.advice); setStatus(''); }
        else setStatus('生成中です。少し待ってから、もう一度ためしてね。');
      })
      .catch(() => { if (active) setStatus('アドバイスを取得できませんでした。日記は保存されています。保護者に設定を確認してもらうか、もう一度ためしてね。'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [date, record, session?.user?.id, retry]);
  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin } });
    setStatus(error ? 'ログインメールを送れませんでした。保護者に確認してもらってね。' : 'メールのリンクからログインしてね。');
    setBusy(false);
  }
  return <section style={{ background: '#f0edff', borderRadius: 12, padding: 14, margin: '16px 0' }} aria-label="チャッピーからのアドバイス">
    <h3 style={{ fontSize: 16, margin: '0 0 10px' }}>🤖 チャッピーからのアドバイス</h3>
    {!session ? <form onSubmit={signIn}>
      <p style={{ fontSize: 13 }}>アドバイスを使うには、保護者が登録したメールでログインしてね。保存した日記の練習内容をAIに送って考えてもらうよ。</p>
      <label>メールアドレス <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <button disabled={busy} type="submit">ログインメールを送る</button>
    </form> : <>
      {advice && [['good', '今日よかったところ'], ['focus', '次に意識すること'], ['mission', '次回ミッション']].map(([key, label]) => <div key={key} style={{ marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>{label}</strong><p style={{ margin: '4px 0', fontSize: 14, whiteSpace: 'pre-wrap' }}>{advice[key]}</p>
      </div>)}
      {!record && <p>日記を保存すると、アドバイスが届くよ。</p>}
      {!busy && status && <button onClick={() => setRetry(n => n + 1)}>もう一度ためす</button>}
      <button onClick={() => supabase.auth.signOut()} style={{ marginLeft: 8 }}>ログアウト</button>
      <p style={{ fontSize: 11 }}>AIのアドバイスです。痛みやけががあるときは無理せず、保護者やコーチに相談してね。</p>
    </>}
    <p role="status" aria-live="polite" style={{ fontSize: 13 }}>{status}</p>
  </section>;
}
