import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessGeneratedAdvice, growthContext, normalizeQuotation, validateStoredAdvice } from '../supabase/functions/chappy-advice/advice.ts';
import { adviceFailure } from '../src/adviceFailure.js';

const rows = [
  { date: '2026-10-18', data: { daySummary: { memo: '声が出せなかった' } }, advice: { good: '記録したね', focus: '守備で知らせよう', mission: '次の守備で、スクリーンを見たら1回声を出そう' } },
  { date: '2026-10-19', data: { daySummary: { memo: '仲間に知らせられなかった' } } },
];
const context = growthContext('2026-10-20', { teams: [{ improve: 'ゲームで、声を出せなかった。\\n次も声のタイミングを考えた。' }] }, rows);
const value = () => ({
  good: '「声を出せなかった」と振り返れたね。', focus: '次はスクリーンを見たら短く知らせよう。',
  mission: '次の3対3で、スクリーンを見たら「右！」と1回知らせよう。',
  growth: null as any, follow_up: [] as any,
  grounding: { current_quote: '声を出せなかった', growth_current_quote: '声を出せなかった', past_quotes: [] as any, follow_up_quotes: [] },
});
const growth = { improved: '成長はまだ記録から確認できないよ。', ongoing: '声を出すタイミングが継続中の課題だね。', next: 'スクリーンに気づいた時に短く伝えよう。', new_challenge: '次の提案：方向を伝えよう。', evidence_dates: ['2026-10-18', '2026-10-19'] };

test('malformed optional comparison does not discard valid three-part advice or invent growth', () => {
  for (const bad of [
    { ...growth, evidence_dates: ['2026-10-18'] },
    { ...growth, evidence_dates: ['2026-10-21', '2026-10-22'] },
    { ...growth, ongoing: 'あ'.repeat(161) },
    { ...growth, unexpected: 'unsupported' },
    'malformed',
  ]) {
    const output = { ...value(), growth: bad };
    const result = assessGeneratedAdvice(output, context);
    assert.equal(result.advice.growth, null);
    assert.equal(result.growth_status.code, 'invalid_comparison');
    assert.equal(result.advice.good, output.good);
    assert.equal(result.advice.mission, output.mission);
    assert.doesNotThrow(() => validateStoredAdvice({ ...result.advice, growth_status: result.growth_status }));
  }
});

test('malformed/oversized/duplicate review falls back to questions about real saved advice', () => {
  const row = { date: '2026-10-18', status: 'practiced', comment: 'あ'.repeat(161) };
  for (const follow_up of [[row], [{ ...row, comment: '声が出た' }, { ...row, comment: '声が出た' }], 'invalid']) {
    const result = assessGeneratedAdvice({ ...value(), follow_up }, context);
    assert.equal(result.advice.follow_up?.length, 1);
    assert.equal(result.advice.follow_up?.[0].status, 'unknown');
    assert.match(result.advice.follow_up![0].comment, /試せたかな/);
    assert.equal(result.advice.mission, value().mission);
  }
});

test('escaped legacy line breaks match equivalent newlines without changing negation or numbers', () => {
  assert.equal(normalizeQuotation('声を出せなかった。\\n次も考えた。'), normalizeQuotation('声を出せなかった。\n次も考えた。'));
  assert.notEqual(normalizeQuotation('1回声を出せなかった。\\n'), normalizeQuotation('2回声を出せた。\n'));
});

test('bad optional grounding never supports praise or growth, and never invalidates the mission', () => {
  const result = assessGeneratedAdvice({ ...value(), growth, grounding: null }, context);
  assert.equal(result.advice.growth, null);
  assert.doesNotMatch(result.advice.good, /成功|上達/);
  assert.equal(result.advice.mission, value().mission);
  assert.throws(() => assessGeneratedAdvice({ ...value(), mission: 'あ'.repeat(121) }, context));
  assert.throws(() => assessGeneratedAdvice({ ...value(), focus: null }, context));
});

test('HTTP failures distinguish retry wait, quota and generation errors without reading private error text', async () => {
  for (const [body, status, match] of [
    [{ status: 'busy', retry_after: 60 }, 409, /60秒/],
    [{ status: 'limited' }, 429, /回数の上限/],
    [{ code: 'output_limit', retry_after: 60 }, 502, /回答が長く/],
    [{ code: 'format', retry_after: 60 }, 502, /回答を正しく確認できません/],
    [{ code: 'provider_rate_limit', retry_after: 60 }, 502, /利用制限/],
    [{ status: 'changed' }, 409, /状態が変わりました/],
  ] as const) {
    const result = await adviceFailure({ context: new Response(JSON.stringify({ ...body, error: 'private-provider-text' }), { status }) }, null);
    assert.match(result.message, match);
    assert.match(result.message, /日記/);
    assert.doesNotMatch(result.message, /private-provider-text|保護者に設定/);
    assert.ok(result.retryAfter >= 0 && result.retryAfter <= 60);
  }
  const offline = await adviceFailure(new Error('private-token'), null);
  assert.match(offline.message, /通信/);
  assert.doesNotMatch(offline.message, /private-token/);
});
