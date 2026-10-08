import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

export default function ChappyAdvice({ date, record }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authStatus, setAuthStatus] = useState('');
  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [advice, setAdvice] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let authEventObserved = false;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventObserved = true;
      if (active) {
        setSession(next);
        if (!next) { setEditingPassword(false); setNewPassword(''); setConfirmPassword(''); }
      }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (active && !authEventObserved) {
        if (error) setAuthStatus('ログイン状態を確認できませんでした。もう一度ログインしてね。');
        else setSession(data.session);
      }
    }).catch(() => { if (active) setAuthStatus('ログイン状態を確認できませんでした。'); });
    return () => { active = false; data.subscription.unsubscribe(); };
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
    if (authBusy) return;
    setAuthBusy(true);
    setAuthStatus('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.session) {
        setAuthStatus('ログインできませんでした。メールアドレスとパスワードを確認してね。まだパスワードを設定していない場合は、保護者に相談してね。');
      } else { setSession(data.session); setPassword(''); }
    } catch { setAuthStatus('通信できませんでした。少し待って、もう一度ログインしてね。'); }
    finally { setAuthBusy(false); }
  }
  async function signOut() {
    setAuthBusy(true);
    setAuthStatus('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null); setAdvice(null); setPassword('');
      setEditingPassword(false); setNewPassword(''); setConfirmPassword('');
    } catch { setAuthStatus('ログアウトできませんでした。もう一度ためしてね。'); }
    finally { setAuthBusy(false); }
  }
  async function savePassword(event) {
    event.preventDefault();
    if (authBusy) return;
    if (newPassword !== confirmPassword) { setAuthStatus('確認用パスワードが一致していません。'); return; }
    setAuthBusy(true); setAuthStatus('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword(''); setConfirmPassword(''); setEditingPassword(false);
      setAuthStatus('パスワードを設定しました。次回はメールアドレスとパスワードでログインできます。');
    } catch { setAuthStatus('パスワードを設定できませんでした。Supabaseのパスワード条件を確認してね。ログインし直すか、新しい再設定リンクが必要な場合もあります。'); }
    finally { setAuthBusy(false); }
  }
  return <section style={{ background: '#f0edff', borderRadius: 12, padding: 14, margin: '16px 0' }} aria-label="チャッピーからのアドバイス">
    <h3 style={{ fontSize: 16, margin: '0 0 10px' }}>🤖 チャッピーからのアドバイス</h3>
    {!session ? <form onSubmit={signIn}>
      <p style={{ fontSize: 13 }}>保護者が登録したメールアドレスとパスワードでログインしてね。保存した日記の練習内容をAIに送って考えてもらうよ。</p>
      <label style={{ display: 'block', marginBottom: 8 }}>メールアドレス <input type="email" required autoComplete="username" disabled={authBusy} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label style={{ display: 'block', marginBottom: 8 }}>パスワード <input type="password" required autoComplete="current-password" disabled={authBusy} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button disabled={authBusy} type="submit">{authBusy ? 'ログイン中…' : 'ログイン'}</button>
    </form> : <>
      {advice && [['good', '今日よかったところ'], ['focus', '次に意識すること'], ['mission', '次回ミッション']].map(([key, label]) => <div key={key} style={{ marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>{label}</strong><p style={{ margin: '4px 0', fontSize: 14, whiteSpace: 'pre-wrap' }}>{advice[key]}</p>
      </div>)}
      {!record && <p>日記を保存すると、アドバイスが届くよ。</p>}
      {!busy && status && <button onClick={() => setRetry(n => n + 1)}>もう一度ためす</button>}
      <button disabled={authBusy} onClick={signOut} style={{ marginLeft: 8 }}>ログアウト</button>
      <button disabled={authBusy} onClick={() => { setEditingPassword(!editingPassword); setNewPassword(''); setConfirmPassword(''); setAuthStatus(''); }} style={{ marginLeft: 8 }}>パスワードを設定・変更</button>
      {editingPassword && <form onSubmit={savePassword} style={{ marginTop: 12 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>新しいパスワード <input type="password" required minLength={8} autoComplete="new-password" disabled={authBusy} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
        <label style={{ display: 'block', marginBottom: 8 }}>新しいパスワード（確認） <input type="password" required minLength={8} autoComplete="new-password" disabled={authBusy} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
        <button type="submit" disabled={authBusy}>{authBusy ? '設定中…' : 'パスワードを保存'}</button>
      </form>}
      <p style={{ fontSize: 11 }}>AIのアドバイスです。痛みやけががあるときは無理せず、保護者やコーチに相談してね。</p>
    </>}
    <p role="status" aria-live="polite" style={{ fontSize: 13 }}>{status}</p>
    <p role="status" aria-live="polite" style={{ fontSize: 13 }}>{authStatus}</p>
  </section>;
}
