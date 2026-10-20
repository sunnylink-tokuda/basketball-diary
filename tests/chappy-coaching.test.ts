import { test } from 'node:test';
import assert from 'node:assert/strict';
import { growthContext, assessGeneratedAdvice, validateStoredAdvice, guardPrompt } from '../supabase/functions/chappy-advice/advice.ts';

const diary = (memo: string) => ({ daySummary: { memo } });
const prior = { good: '振り返ったね', focus: '守備でスクリーンを知らせよう', mission: '次の守備で、スクリーンを見たら「右！」と1回声を出そう。' };
const generated = (extra = {}) => ({
  good: '日記に残せたね。', focus: '次の守備でスクリーンを知らせよう。',
  mission: '次の3対3でスクリーンに気づいたら「右！」と1回声を出そう。',
  growth: null, follow_up: [],
  grounding: { current_quote: null, growth_current_quote: null, past_quotes: [], follow_up_quotes: [] }, ...extra,
});
const rows = [{ date: '2026-10-18', data: diary('スクリーンを知らせられなかった'), advice: prior }, { date: '2026-10-19', data: diary('声を出せなかった'), advice: prior }];

test('yesterday and day-before advice survives insufficient growth evidence; missing action becomes a question', () => {
  const context = growthContext('2026-10-20', diary('シュートを練習した'), rows);
  assert.equal(context.growth_allowed, false);
  assert.deepEqual(context.follow_up_advice.map(row => row.date), ['2026-10-18', '2026-10-19']);
  const result = assessGeneratedAdvice(generated(), context);
  assert.equal(result.advice.growth, null);
  assert.equal(result.advice.follow_up?.length, 2);
  for (const review of result.advice.follow_up!) {
    assert.equal(review.status, 'unknown');
    assert.match(review.comment, /試せたかな.*次の日記/);
    assert.match(review.comment, /スクリーン/);
  }
  const saved = { ...result.advice, growth_status: result.growth_status };
  assert.deepEqual(validateStoredAdvice(saved), saved);
});

test('practice and ongoing tasks require a current diary quote related to the earlier advice', () => {
  for (const [memo, status] of [['右にいるよと仲間へ声を出した', 'practiced'], ['声を出せなかった', 'ongoing']] as const) {
    const context = growthContext('2026-10-20', diary(memo), rows);
    const value = generated({
      follow_up: [{ date: '2026-10-19', status, comment: `「${memo}」と書いたね。次も知らせる場面を探そう。` }],
      grounding: { current_quote: null, growth_current_quote: null, past_quotes: [], follow_up_quotes: [{ date: '2026-10-19', quote: memo }] },
    });
    const result = assessGeneratedAdvice(value, context);
    assert.equal(result.advice.follow_up?.[1].status, status);
    assert.equal(result.advice.follow_up?.[0].status, 'unknown');
    assert.equal(result.advice.growth, null);
  }
});

test('invented actions, previous advice, plans, unrelated quotes and unknown dates cannot establish practice', () => {
  const context = growthContext('2026-10-20', { ...diary('シュートが入った'), teams: [{ next: '声を出せた' }] }, rows);
  for (const quote of ['声を出せた', prior.mission, 'シュートが入った']) {
    const result = assessGeneratedAdvice(generated({
      follow_up: [{ date: '2026-10-19', status: 'practiced', comment: `「${quote}」できたね。` }],
      grounding: { current_quote: null, past_quotes: [], follow_up_quotes: [{ date: '2026-10-19', quote }] },
    }), context);
    assert.equal(result.advice.follow_up?.[1].status, 'unknown');
  }
  const result = assessGeneratedAdvice(generated({ follow_up: [{ date: '2026-10-21', status: 'practiced', comment: '成功したね' }] }), context);
  assert.ok(result.advice.follow_up?.every(row => row.status === 'unknown'));
});

test('related actions with different wording support evidence; no improvement is forced', () => {
  const memo = '右にいるよと仲間へ声を出した';
  const context = growthContext('2026-10-20', diary(memo), rows);
  assert.equal(context.growth_allowed, true);
  const growth = { improved: '10/18と10/19は知らせる声が課題。今日は仲間へ声を出した記録があるね。', ongoing: '守備で知らせるタイミングを続けて確かめよう。', new_challenge: '次の提案：相手が近づいた方向も短く伝えてみよう。', next: '次もスクリーンが近づいたらすぐ知らせよう。', evidence_dates: rows.map(row => row.date) };
  const result = assessGeneratedAdvice(generated({ growth, grounding: { current_quote: null, growth_current_quote: memo, past_quotes: rows.map(row => ({ date: row.date, quote: row.data.daySummary.memo })), follow_up_quotes: [] } }), context);
  assert.deepEqual(result.advice.growth, growth);
  assert.equal(result.growth_status.code, 'available');
  const saved = { ...result.advice, growth_status: result.growth_status };
  assert.deepEqual(validateStoredAdvice(saved), saved);
  const repeated = growthContext('2026-10-20', diary('声を出せなかった'), rows);
  const unchanged = assessGeneratedAdvice(generated({ growth: { ...growth, improved: '成長はまだ記録から確認できないよ。' }, grounding: { current_quote: null, growth_current_quote: '声を出せなかった', past_quotes: rows.map(row => ({ date: row.date, quote: row.data.daySummary.memo })), follow_up_quotes: [] } }), repeated);
  assert.match(unchanged.advice.growth!.improved, /まだ記録から確認できない/);
});

test('decision, off-ball, defense, communication, initiative and persistence are comparison candidates', () => {
  for (const [past, current] of [
    ['パスかシュートか選べなかった', '相手の位置を見てからドライブを選んだ'],
    ['スペースが作れなかった', '味方との距離をとって広がった'],
    ['マークを見失った', '戻ってから守る位置を確かめた'],
    ['仲間に知らせられなかった', '味方を励ました'],
    ['自分から動けなかった', '思い切って挑戦した'],
    ['練習を続けた', '今日も同じことに取り組んだ'],
  ]) {
    const context = growthContext('2026-10-20', diary(current), rows.map(row => ({ ...row, data: diary(past) })));
    assert.equal(context.growth_allowed, true, `${past} -> ${current}`);
  }
});

test('follow-up excludes future/old/invalid dates, bounds to two, preserves inputs and uses latest available dates for gaps', () => {
  const input = [...rows, { ...rows[0], date: '2026-09-01' }, { ...rows[0], date: '2026-10-21' }, { ...rows[0], date: 'invalid' }];
  const before = JSON.stringify(input);
  const context = growthContext('2026-10-23', diary('声を出した'), input);
  assert.deepEqual(context.follow_up_advice.map(row => row.date), ['2026-10-19', '2026-10-21']);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(growthContext('2026-10-20', diary('声を出した'), []).follow_up_advice, []);
  assert.equal('follow_up' in assessGeneratedAdvice(generated(), growthContext('2026-10-20', diary('声を出した'), [])).advice, false);
});

test('coaching policy prioritizes four areas, one practical mission, safety and unresolved-task carryover', () => {
  for (const phrase of ['状況判断', 'オフボール', 'ディフェンス', '声掛け', '基本のドリブルを毎回勧めません', '1つだけ', '場面・動作・目標', '継続中/未確認の課題は次回にも引き継ぎ', '痛みやけが', '実践したことと成功・成長は別']) assert.ok(guardPrompt.includes(phrase));
});

test('a negated attempt is not labelled as practiced even if the model says it was', () => {
  const quote = '声を出せなかった';
  const result = assessGeneratedAdvice(generated({
    follow_up: [{ date: '2026-10-19', status: 'practiced', comment: `「${quote}」と記録したね。` }],
    grounding: { current_quote: null, past_quotes: [], follow_up_quotes: [{ date: '2026-10-19', quote }] },
  }), growthContext('2026-10-20', diary(quote), rows));
  assert.equal(result.advice.follow_up?.[1].status, 'unknown');
});

test('new stored format rejects duplicate/oversized follow-ups and retains legacy answers unchanged', () => {
  const review = { date: '2026-10-19', status: 'unknown', comment: '試せたかな？' };
  const base = { good: '記録できたね', focus: '周りを見よう', mission: 'パス前に守備を見よう', growth: null };
  assert.throws(() => validateStoredAdvice({ ...base, follow_up: [review, review] }));
  assert.throws(() => validateStoredAdvice({ ...base, follow_up: [{ ...review, comment: 'あ'.repeat(161) }] }));
  assert.deepEqual(validateStoredAdvice(base), base);
  const longMission = { ...prior, mission: '声'.repeat(120) };
  const context = growthContext('2026-10-20', diary('シュートした'), [{ ...rows[1], advice: longMission }]);
  const result = assessGeneratedAdvice(generated(), context);
  assert.doesNotThrow(() => validateStoredAdvice({ ...result.advice, growth_status: result.growth_status }));
});

test('large past diaries may be skipped for comparison without dropping their short saved missions', () => {
  const context = growthContext('2026-10-20', diary('シュートした'), [{ ...rows[1], data: diary('あ'.repeat(5000)) }]);
  assert.equal(context.history.length, 0);
  assert.equal(context.growth_allowed, false);
  assert.equal(context.follow_up_advice.length, 1);
  assert.equal(context.follow_up_advice[0].date, '2026-10-19');
  assert.equal(assessGeneratedAdvice(generated(), context).advice.follow_up?.[0].status, 'unknown');
});
