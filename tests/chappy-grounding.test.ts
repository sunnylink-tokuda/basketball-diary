import { test } from 'node:test';
import assert from 'node:assert/strict';
import { growthContext, validateGeneratedAdvice, recordedGood } from '../supabase/functions/chappy-advice/advice.ts';

const reflection = (memo: string) => ({ daySummary: { memo } });
const rows = [
  { date: '2026-10-01', data: reflection('パスを守備に取られた') },
  { date: '2026-10-04', data: reflection('パス前に守備を見られなかった') },
];
const context = growthContext('2026-10-07', reflection('パス前に守備を見て、仲間に届けた'), rows);
const generated = () => ({
  good: '「守備を見て、仲間に届けた」と書けたね。見る工夫を続けよう。',
  focus: '投げる前に、受け手との間に守備がいるか見よう。',
  mission: '次のパス練習で、投げる前に守備の位置を一度見よう。',
  growth: {
    improved: '10/1は「パスを守備に取られた」、10/4は「パス前に守備を見られなかった」。今日は守備を見て届けたね。',
    ongoing: '守備の位置を見てからパスする判断を続けよう。',
    next: '通り道に守備がいたら、無理に投げず運ぼう。',
    evidence_dates: ['2026-10-01', '2026-10-04'],
  },
  grounding: {
    current_quote: '守備を見て、仲間に届けた',
    past_quotes: [
      { date: '2026-10-01', quote: 'パスを守備に取られた' },
      { date: '2026-10-04', quote: 'パス前に守備を見られなかった' },
    ],
  },
});

test('verified current-day and past quotations allow comparison without changing persisted shape', () => {
  const value = generated();
  const { grounding, ...expected } = value;
  assert.deepEqual(validateGeneratedAdvice(value, context), expected);
  assert.equal('grounding' in validateGeneratedAdvice(value, context), false);
});

test('invented play, past-day success and missing current quotation fall back to recording praise', () => {
  for (const quote of ['ドライブで点を取った', 'パスを守備に取られた', null]) {
    const original = generated();
    const value = { ...original, grounding: { ...original.grounding, current_quote: quote }, good: quote ? `「${quote}」よくできたね。` : 'シュートが上達したね。' };
    const result = validateGeneratedAdvice(value, context);
    assert.equal(result.good, recordedGood);
    assert.equal(result.growth, null);
    assert.equal(result.mission, value.mission);
  }
  const value = generated();
  value.good = 'シュートもドライブも成功したね。';
  assert.equal(validateGeneratedAdvice(value, context).good, recordedGood);
});

test('matching dates alone, invented quotes, previous advice and unused quotes do not establish growth', () => {
  for (const mutate of [
    (v: ReturnType<typeof generated>) => { v.grounding.past_quotes[0].quote = 'パスが成功した'; },
    (v: ReturnType<typeof generated>) => { v.grounding.past_quotes[0].quote = '顔を上げよう'; },
    (v: ReturnType<typeof generated>) => { v.grounding.past_quotes[1].date = '2026-10-01'; },
    (v: ReturnType<typeof generated>) => { v.grounding.past_quotes = []; },
    (v: ReturnType<typeof generated>) => { v.growth.improved = '前より上手になったね。'; },
  ]) {
    const value = generated();
    mutate(value);
    const result = validateGeneratedAdvice(value, context);
    assert.equal(result.growth, null);
    assert.equal(result.good, value.good);
  }
});

test('plans, taught techniques and drill names cannot authorize comparison or substantiate a compliment', () => {
  const planned = { teams: [{ taught: 'パス前に守備を見る', next: 'パスを成功させたい', content: 'パス練習' }], solos: [{ drills: ['パス練習'] }], daySummary: { next: '守備を見て、仲間に届けた' } };
  const candidate = growthContext('2026-10-07', planned, rows);
  assert.equal(candidate.growth_allowed, false);
  assert.deepEqual(candidate.evidence_dates, []);
  const pastPlans = growthContext('2026-10-07', reflection('パスを守備に取られた'), rows.map(row => ({ ...row, data: planned })));
  assert.equal(pastPlans.growth_allowed, false);
  const value = { ...generated(), growth: null };
  assert.equal(validateGeneratedAdvice(value, candidate).good, recordedGood);
});

test('unchanged challenge can explicitly acknowledge that improvement is not confirmed', () => {
  const unchanged = growthContext('2026-10-07', reflection('今日もパスを守備に取られた'), rows);
  const value = generated();
  value.grounding.current_quote = 'パスを守備に取られた';
  value.good = '「パスを守備に取られた」と振り返れたね。次の練習を考えよう。';
  value.growth.improved = '10/1は「パスを守備に取られた」、10/4は「パス前に守備を見られなかった」。改善はまだ記録から確認できないよ。';
  assert.match(validateGeneratedAdvice(value, unchanged).growth!.improved, /改善はまだ記録から確認できない/);
});
