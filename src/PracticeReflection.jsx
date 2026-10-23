import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { achievementOptions, reflectionFields } from './practiceReflection.js';

const fieldStyle = { width: '100%', boxSizing: 'border-box', fontSize: 16, padding: 12, lineHeight: 1.6, border: '1px solid #c8d5df', borderRadius: 12, resize: 'vertical', background: '#fff', color: '#263445' };
const sectionStyle = { margin: '16px 0', padding: 14, borderRadius: 14, background: '#f2f7fc', overflowWrap: 'anywhere' };

export function PracticeReflectionForm({ date, value, onChange, onGoalState }) {
  const [lookup, setLookup] = useState({ state: 'loading', goal: null });
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    let epoch = 0;
    async function load(session) {
      const request = ++epoch;
      if (!session) { if (active) setLookup({ state: 'signed_out', goal: null }); return; }
      setLookup({ state: 'loading', goal: null });
      try {
        const { data, error } = await supabase.functions.invoke('chappy-advice', { body: { date, action: 'previous_goal' } });
        if (error || data?.status !== 'ready') throw new Error('Goal unavailable');
        if (active && request === epoch) setLookup({ state: 'ready', goal: data.goal });
      } catch { if (active && request === epoch) setLookup({ state: 'error', goal: null }); }
    }
    let observed = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { observed = true; load(session); });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || observed) return;
      if (error) setLookup({ state: 'error', goal: null }); else load(data.session);
    }).catch(() => { if (active) setLookup({ state: 'error', goal: null }); });
    return () => { active = false; epoch++; data.subscription.unsubscribe(); };
  }, [date, reload]);
  useEffect(() => { onGoalState?.(lookup.state); }, [lookup.state, onGoalState]);
  // Keep the exact goal answered when editing an existing diary. Never silently
  // attach an old achievement to a newer or different goal.
  const previous = value.goal_review?.goal ? { date: value.goal_review.goal_date, goal: value.goal_review.goal } : lookup.goal;
  useEffect(() => {
    if (lookup.state === 'ready' && lookup.goal && !value.goal_review?.goal) {
      onChange({ ...value, goal_review: { ...value.goal_review, goal_date: lookup.goal.date, goal: lookup.goal.goal } });
    }
  }, [lookup, value, onChange]);
  const review = value.goal_review || {};
  const changeReview = patch => onChange({ ...value, goal_review: { ...review, ...(previous ? { goal_date: previous.date, goal: previous.goal } : {}), ...patch } });
  const textField = (key, label) => <section key={key} style={sectionStyle}>
    <label style={{ display: 'block', fontWeight: 700, marginBottom: 8 }} htmlFor={`reflection-${key}`}>{label}</label>
    {key === 'next' && previous && <p style={{ fontSize: 13 }}>チャッピーの目標「{previous.goal}」も参考にしよう。</p>}
    <textarea id={`reflection-${key}`} rows={3} value={value[key] || ''} onChange={e => onChange({ ...value, [key]: e.target.value })} style={fieldStyle} placeholder={key === 'content' ? '例：3対3とシュート練習をした' : key === 'good' ? '例：パスを受ける前に味方を見られた' : key === 'improve' ? '例：守備に戻るのが遅れた' : '次の練習で試したいことを1つ書こう'} />
  </section>;
  return <div aria-label="5項目の日記">
    {textField(...reflectionFields[0])}
    <section style={sectionStyle}>
      <h3 style={{ fontSize: 16, margin: '0 0 10px' }}>② 前回のアドバイスを実践できた？</h3>
      {previous ? <>
        <p style={{ background: '#fff', padding: 12, borderRadius: 10, lineHeight: 1.7 }}>{previous.date}の重点目標<br /><strong>{previous.goal}</strong></p>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontSize: 14, marginBottom: 8 }}>いちばん近いものを選ぼう</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6 }}>
            {achievementOptions.map(([status, label]) => <label key={status} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap', padding: '8px 0', minHeight: 66, boxSizing: 'border-box', textAlign: 'center', borderRadius: 10, background: review.status === status ? '#d7edff' : '#fff', border: '1px solid #a8c6df', fontSize: 14 }}><input type="radio" name="goal-achievement" value={status} checked={review.status === status} onChange={() => changeReview({ status })} />{label}</label>)}
          </div>
        </fieldset>
        <label style={{ display: 'block', margin: '12px 0 6px' }} htmlFor="goal-review-memo">どんな場面だった？（書かなくてもOK）</label>
        <textarea id="goal-review-memo" rows={2} style={fieldStyle} value={review.memo || ''} onChange={e => changeReview({ memo: e.target.value })} />
      </> : lookup.state === 'ready' ? <p>前回の目標はありません</p> : <div role="status">
        <p>{lookup.state === 'loading' ? '前回の目標を確認中…' : lookup.state === 'signed_out' ? '前回の目標を表示するには、日記の詳細画面のチャッピー欄でログインしてね。日記はそのまま書けます。' : '前回の目標を取得できませんでした。日記の入力は続けられます。'}</p>
        {lookup.state === 'error' && <button type="button" onClick={() => setReload(n => n + 1)} style={{ minHeight: 44 }}>目標をもう一度確認</button>}
      </div>}
    </section>
    {reflectionFields.slice(1).map(([key, label]) => textField(key, label))}
  </div>;
}

export function PracticeReflectionDisplay({ value }) {
  const review = value.goal_review;
  return <section aria-label="今日の5項目の日記" style={sectionStyle}>
    <h3>🏀 今日の振り返り</h3>
    <h4>{reflectionFields[0][1]}</h4><p style={{ whiteSpace: 'pre-wrap' }}>{value.content || '未入力'}</p>
    <h4>② 前回のアドバイスを実践できた？</h4>
    <p>{review?.goal ? `${review.goal_date}の目標：${review.goal}` : '前回の目標は記録されていません'}</p>
    <p>{achievementOptions.find(([key]) => key === review?.status)?.[1] || '未回答'}</p>
    {review?.memo && <p style={{ whiteSpace: 'pre-wrap' }}>{review.memo}</p>}
    {reflectionFields.slice(1).map(([key, label]) => <div key={key}><h4>{label}</h4><p style={{ whiteSpace: 'pre-wrap' }}>{value[key] || '未入力'}</p></div>)}
  </section>;
}
