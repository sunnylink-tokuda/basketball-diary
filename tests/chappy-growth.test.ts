import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { growthContext, validateGrowthAdvice, validateStoredAdvice, historyStart, guardPrompt } from '../supabase/functions/chappy-advice/advice.ts';

const diary = (memo: string) => ({ daySummary: { memo }, parentComment: 'excluded', chores: ['excluded'] });
const base = { good: '周りを見ようとしたね。', focus: 'パスの前に守備を見よう。', mission: '次は受け手と守備を見てからパスしよう。' };
const prior = [
  { date: '2026-10-01', data: diary('パスが守備に取られた'), advice: base },
  { date: '2026-10-04', data: diary('パスする前に顔を上げたが、守備を見られなかった'), advice: base },
];

test('no history or insufficient comparable records uses current diary only', () => {
  for (const rows of [[], prior.slice(0, 1), prior.map(row => ({ ...row, data: diary('シュートを練習した') }))]) {
    const context = growthContext('2026-10-07', diary('パスを練習した'), rows);
    assert.equal(context.growth_allowed, false);
    assert.deepEqual(context.history, []);
    assert.deepEqual(context.evidence_dates, []);
    assert.deepEqual(validateGrowthAdvice({ ...base, growth: null }, context.evidence_dates), { ...base, growth: null });
  }
  assert.match(guardPrompt, /今回の日記だけ/);
});

test('ongoing challenge retains chronological evidence and previous advice for more specific coaching', () => {
  const context = growthContext('2026-10-07', diary('今日もパスを取られた。顔は上げた'), [...prior].reverse());
  assert.equal(context.growth_allowed, true);
  assert.deepEqual(context.history.map(row => row.date), ['2026-10-01', '2026-10-04']);
  assert.deepEqual(context.history[0].previous_advice, base);
  assert.doesNotMatch(JSON.stringify(context), /excluded/);
  const growth = { improved: '10/4から顔を上げようと工夫しているね。改善はまだ記録から確認できないよ。', ongoing: '10/1も今日もパスを取られているね。守備の位置を確かめよう。', next: '受け手との間に守備がいたら、無理にパスせず運ぼう。', evidence_dates: context.evidence_dates };
  assert.deepEqual(validateGrowthAdvice({ ...base, growth }, context.evidence_dates).growth, growth);
  assert.match(guardPrompt, /そのまま繰り返さず/);
});

test('documented improvement supports growth, unsupported comparison is rejected', () => {
  const context = growthContext('2026-10-07', diary('パス前に守備を見た。通り道が空くまで待って、仲間に届けられた'), prior);
  const growth = { improved: '10/1はパスを取られ、10/4は守備を見られなかったけど、今日は守備を見て届けられたね。', ongoing: '空いた通り道を選ぶ判断を続けよう。', next: '次も守備が通り道にいたら、待つか運ぶか選ぼう。', evidence_dates: ['2026-10-01', '2026-10-04'] };
  assert.deepEqual(validateGrowthAdvice({ ...base, growth }, context.evidence_dates).growth, growth);
  assert.throws(() => validateGrowthAdvice({ ...base, growth: { ...growth, evidence_dates: ['2026-10-01', '2026-10-08'] } }, context.evidence_dates));
  assert.throws(() => validateGrowthAdvice({ ...base, growth }, []));
  assert.throws(() => validateGrowthAdvice({ ...base, growth: { ...growth, improved: 'a'.repeat(161) } }, context.evidence_dates));
  assert.deepEqual(validateStoredAdvice(base), base);
  assert.deepEqual(validateStoredAdvice({ ...base, growth }), { ...base, growth });
});

test('history excludes future/current/old dates, caps newest 20 and bounds prompt size', () => {
  assert.equal(historyStart('2026-10-07'), '2026-09-07');
  const rows = Array.from({ length: 35 }, (_, i) => ({ date: new Date(Date.UTC(2026, 8, 6 + i)).toISOString().slice(0, 10), data: diary('パス練習') }));
  const context = growthContext('2026-10-07', diary('パス練習'), [...rows, { date: '__meta__', data: diary('パス') }]);
  assert.equal(context.history.length, 20);
  assert.equal(context.history.at(-1)?.date, '2026-10-06');
  assert.equal(context.history[0].date, '2026-09-17');
  const large = growthContext('2026-10-07', diary('パス' + 'a'.repeat(15000)), rows.map(row => ({ ...row, data: diary('パス' + 'b'.repeat(3000)) })));
  assert.ok(JSON.stringify(large).length < 32000);
  assert.throws(() => growthContext('2026-10-07', diary('a'.repeat(17000)), []));
});

test('new SQL isolates ownership, preserves old data/advice, bounds history and makes saved growth immutable', async () => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const request = '33333333-3333-4333-8333-333333333333';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to public;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
      create table records(date text primary key,data jsonb);
      insert into records values ('2026-10-07','{"daySummary":{"memo":"パス練習"}}');`);
    await db.exec(readFileSync('supabase/chappy-advice.sql', 'utf8'));
    await db.query('insert into chappy_advice(date,source_data,advice) select date,data,$1 from records', [base]);
    const before = (await db.query('select * from records')).rows;
    const oldAdvice = (await db.query('select * from chappy_advice')).rows;
    await db.exec(readFileSync('supabase/chappy-growth.sql', 'utf8'));
    assert.deepEqual((await db.query('select * from records')).rows, before);
    assert.deepEqual((await db.query('select * from chappy_advice')).rows, oldAdvice);
    const rpc = async <T>(name: string, args: unknown[]) => (await db.query<{ result: T }>(`select ${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) result`, args)).rows[0].result;
    assert.equal(await rpc('chappy_growth_record', [owner, '2026-10-07']), null);
    await db.query('insert into chappy_record_owners values ($1,$2)', ['2026-10-07', owner]);
    assert.deepEqual(await rpc('chappy_growth_saved', [owner, '2026-10-07']), base);
    assert.equal(await rpc('chappy_growth_saved', [other, '2026-10-07']), null);
    await db.exec(`update records set data='{"daySummary":{"memo":"編集したパス日記"}}' where date='2026-10-07'`);
    assert.deepEqual(await rpc('chappy_growth_saved', [owner, '2026-10-07']), base);
    const source = (await db.query<{ data: unknown }>("select data from records where date='2026-10-07'")).rows[0].data;
    assert.equal(await rpc('chappy_growth_claim', [owner, '2026-10-07', source, request]), 'ready');
    assert.equal((await db.query('select * from chappy_usage')).rows.length, 0);
    // Legacy rows require explicit mapping; even an authenticated edit cannot claim them.
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    await db.exec("insert into records values ('2026-10-08','{}')");
    assert.equal((await db.query<{ user_id: string }>("select user_id from chappy_record_owners where date='2026-10-08'")).rows[0].user_id, owner);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
    await db.exec("update records set data=data where date='2026-10-08'");
    assert.equal((await db.query<{ user_id: string }>("select user_id from chappy_record_owners where date='2026-10-08'")).rows[0].user_id, owner);
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    for (let i = 0; i < 35; i++) {
      const date = new Date(Date.UTC(2026, 8, 6 + i)).toISOString().slice(0, 10);
      if (date === '2026-10-07' || date === '2026-10-08') continue;
      await db.query('insert into records values ($1,$2)', [date, diary('パス')]);
      await db.query('insert into chappy_record_owners values ($1,$2)', [date, date === '2026-10-06' ? other : owner]);
    }
    const history = await rpc<Array<{ date: string }>>('chappy_growth_history', [owner, '2026-10-07']);
    assert.equal(history.length, 20);
    assert.equal(history[0].date, '2026-09-16');
    assert.equal(history.at(-1)?.date, '2026-10-05');
    assert.ok(history.every(row => row.date >= '2026-09-07' && row.date < '2026-10-07'));
    assert.deepEqual(await rpc('chappy_growth_history', [other, '2026-10-07']), []);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    await db.exec('set role authenticated');
    assert.ok((await db.query<{ user_id: string }>('select * from chappy_record_owners')).rows.every(row => row.user_id === owner));
    await assert.rejects(db.query('insert into chappy_record_owners values ($1,$2)', ['2026-10-09', owner]), /permission denied/);
    await assert.rejects(db.query('select chappy_growth_history($1,$2)', [owner, '2026-10-07']), /permission denied/);
    await assert.rejects(db.query('select chappy_internal.register_owner()'), /permission denied/);
    await db.exec('reset role');
    const emptySource = {};
    assert.equal(await rpc('chappy_growth_claim', [other, '2026-10-08', emptySource, request]), 'changed');
    assert.equal(await rpc('chappy_growth_claim', [owner, '2026-10-08', emptySource, request]), 'claimed');
    assert.equal(await rpc('chappy_growth_claim', [owner, '2026-10-08', emptySource, other]), 'busy');
    assert.equal(await rpc('chappy_growth_finish', [other, '2026-10-08', request, { ...base, growth: null }]), false);
    assert.equal(await rpc('chappy_growth_finish', [owner, '2026-10-08', other, { ...base, growth: null }]), false);
    await db.exec("update records set data='{" + '"changed":true' + "}' where date='2026-10-08'");
    assert.equal(await rpc('chappy_growth_finish', [owner, '2026-10-08', request, { ...base, growth: null }]), false);
    await db.exec("update records set data='{}' where date='2026-10-08'");
    const withReason = { ...base, growth: null, growth_status: { code: 'model_declined', history_count: 20, comparable_count: 5 } };
    assert.equal(await rpc('chappy_growth_finish', [owner, '2026-10-08', request, withReason]), true);
    assert.deepEqual(await rpc('chappy_growth_saved', [owner, '2026-10-08']), withReason);
    await assert.rejects(db.query("update chappy_growth_advice set advice=null"), /immutable/);
    await assert.rejects(db.query("delete from chappy_growth_advice"), /immutable/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from chappy_growth_advice')).rows.length, 0);
    await db.exec('reset role');
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from chappy_record_owners'), /permission denied/);
    await assert.rejects(db.query('select * from chappy_growth_advice'), /permission denied/);
    await db.exec('reset role');
    const pendingSource = diary('パス');
    assert.equal(await rpc('chappy_growth_claim', [owner, '2026-10-09', pendingSource, request]), 'claimed');
    await db.query("update chappy_record_owners set user_id=$1 where date='2026-10-09'", [other]);
    assert.equal(await rpc('chappy_growth_finish', [owner, '2026-10-09', request, { ...base, growth: null }]), false);
    await db.query("update chappy_record_owners set user_id=$1 where date='2026-10-09'", [owner]);
    await db.exec("update chappy_growth_advice set attempted_at=now()-interval '61 seconds' where date='2026-10-09'; update chappy_usage set attempts=30");
    assert.equal(await rpc('chappy_growth_claim', [owner, '2026-10-09', pendingSource, request]), 'limited');
    // A valid service role can run the RPC; browser roles cannot impersonate it.
    await db.exec('grant all on records to service_role; set role service_role');
    assert.equal((await rpc<Array<{ date: string }>>('chappy_growth_history', [owner, '2026-10-07'])).length, 20);
    await db.exec('reset role');
    assert.deepEqual((await db.query('select * from chappy_advice')).rows, oldAdvice);
  } finally { await db.close(); }
});
