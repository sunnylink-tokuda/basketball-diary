import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase, passwordRecovery } from './supabase.js';

export default function RecoveryGate({ children }) {
  const state = useSyncExternalStore(passwordRecovery.subscribe, passwordRecovery.getSnapshot);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setSaved(false); setPassword(''); setConfirmation(''); setMessage('');
  }, [state.recovery]);
  async function submit(event) {
    event.preventDefault();
    if (busy || !state.session || state.error) return;
    if (password.length < 8) { setMessage('パスワードは8文字以上で入力してください。'); return; }
    if (password !== confirmation) { setMessage('確認用パスワードが一致していません。'); return; }
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword(''); setConfirmation(''); setSaved(true);
      setMessage('パスワードを設定しました。次回はメールアドレスとこのパスワードでログインできます。');
    } catch {
      setMessage('設定できませんでした。パスワードの条件や通信状態を確認してください。リンクが失効した場合は新しい再設定メールが必要です。');
    } finally { setBusy(false); }
  }
  if (!state.ready) return <main style={{ padding: 24 }}><p role="status">認証リンクを確認しています…</p></main>;
  if (!state.recovery) return children;
  const inputStyle = { display: 'block', boxSizing: 'border-box', width: '100%', fontSize: 16, padding: 12, margin: '8px 0 16px', border: '1px solid #aaa', borderRadius: 8 };
  return <main style={{ maxWidth: 440, margin: '24px auto', padding: 20 }}>
    <h1 style={{ fontSize: 22 }}>パスワードの再設定</h1>
    {state.error ? <>
      <p role="alert">{state.reason === 'format' ? '再設定リンクの形式を確認できませんでした。メールテンプレートとリンク先の設定を確認してください。'
        : state.reason === 'pkce' ? 'このリンクを開いたブラウザーには認証用の情報がありません。再設定を開始した同じブラウザーで開いてください。'
        : state.reason === 'network' ? 'Supabaseへの通信に失敗しました。接続状態やSafariのサイト設定を確認してください。'
        : state.reason === 'expired' ? '再設定リンクが期限切れ、または使用済みです。再送を繰り返さず、メール送信制限が解除されてから新しいリンクを一度取得してください。'
        : 'リンクからセッションを取得できませんでした。Supabaseのプロジェクトとメールのリンク先が一致するか確認してください。'}</p>
      <button onClick={passwordRecovery.complete}>通常画面へ戻る</button>
    </> : saved ? <>
      <p role="status">{message}</p>
      <button onClick={passwordRecovery.complete}>カレンダーへ進む</button>
    </> : <form onSubmit={submit}>
      <p>新しいパスワードを設定してください。</p>
      <label>新しいパスワード<input style={inputStyle} type="password" autoComplete="new-password" required minLength={8} disabled={busy} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label>新しいパスワード（確認）<input style={inputStyle} type="password" autoComplete="new-password" required minLength={8} disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
      <button style={{ padding: '12px 16px', fontSize: 16 }} type="submit" disabled={busy}>{busy ? '設定中…' : 'パスワードを保存'}</button>
      <p role="status" aria-live="polite">{message}</p>
    </form>}
  </main>;
}
