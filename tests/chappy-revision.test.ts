import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { transformSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import * as adviceModule from '../supabase/functions/chappy-advice/advice.ts';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const request = '33333333-3333-4333-8333-333333333333';
const old = { good: '以前の回答', focus: '周りを見よう', mission: '一度見よう', growth: null };
const fresh = { good: 'パスを強く投げれたね。', focus: '受け手を見よう', mission: '次のパス前に一度見よう', growth: null, growth_status: { code: 'model_declined', history_count: 20, comparable_count: 5 } };

test('October 9 version switches only after successful save; originals and other dates remain immutable', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to public;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;
      create table records(date text primary key,data jsonb);
      insert into records values ('2026-10-09','{"teams":[{"good":"パスを強く投げれた"}]}'),('2026-10-08','{}');`);
    await db.exec(readFileSync('supabase/chappy-advice.sql', 'utf8'));
    await db.exec(readFileSync('supabase/chappy-growth.sql', 'utf8'));
    await db.query('insert into chappy_record_owners select date,$1 from records', [owner]);
    await db.query('insert into chappy_growth_advice(user_id,date,source_data,advice) select $1,date,data,$2 from records', [owner, old]);
    const originals = (await db.query('select * from chappy_growth_advice order by date')).rows;
    const records = (await db.query('select * from records order by date')).rows;
    await db.exec(readFileSync('supabase/chappy-oct09-revision.sql', 'utf8'));
    const rpc = async <T>(name: string, args: unknown[]) => (await db.query<{ v: T }>(`select ${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) v`, args)).rows[0].v;
    const source = records.find((row: any) => row.date === '2026-10-09')!.data;
    const saved = () => rpc('chappy_oct09_saved', [owner, '2026-10-09']);
    assert.deepEqual(await saved(), { advice: old, regenerated: false });
    assert.equal(await rpc('chappy_oct09_saved', [other, '2026-10-09']), null);
    assert.equal(await rpc('chappy_oct09_claim', [owner, '2026-10-08', {}, request]), 'forbidden');
    assert.equal(await rpc('chappy_oct09_claim', [other, '2026-10-09', source, request]), 'changed');
    await db.query('insert into chappy_usage(user_id,day,attempts) values ($1,current_date,30)', [owner]);
    assert.equal(await rpc('chappy_oct09_claim', [owner, '2026-10-09', source, request]), 'limited');
    await db.query('delete from chappy_usage where user_id=$1', [owner]);
    assert.equal(await rpc('chappy_oct09_claim', [owner, '2026-10-09', source, request]), 'claimed');
    assert.equal(await rpc('chappy_oct09_claim', [owner, '2026-10-09', source, other]), 'busy');
    assert.deepEqual(await saved(), { advice: old, regenerated: false });
    assert.equal(await rpc('chappy_oct09_finish', [owner, '2026-10-09', other, fresh]), false);
    assert.equal(await rpc('chappy_oct09_finish', [other, '2026-10-09', request, fresh]), false);
    await db.exec("update records set data='{}' where date='2026-10-09'");
    assert.equal(await rpc('chappy_oct09_finish', [owner, '2026-10-09', request, fresh]), false);
    await db.query("update records set data=$1 where date='2026-10-09'", [source]);
    await db.query("update chappy_record_owners set user_id=$1 where date='2026-10-09'", [other]);
    assert.equal(await rpc('chappy_oct09_finish', [owner, '2026-10-09', request, fresh]), false);
    await db.query("update chappy_record_owners set user_id=$1 where date='2026-10-09'", [owner]);
    assert.equal(await rpc('chappy_oct09_finish', [owner, '2026-10-09', request, fresh]), true);
    assert.deepEqual(await saved(), { advice: fresh, regenerated: true });
    assert.equal(await rpc('chappy_oct09_claim', [owner, '2026-10-09', source, request]), 'ready');
    assert.equal((await db.query<{ attempts: number }>('select attempts from chappy_usage')).rows[0].attempts, 1);
    await assert.rejects(db.exec('update chappy_oct09_revision set advice=null'), /immutable/);
    await assert.rejects(db.exec('delete from chappy_oct09_revision'), /immutable/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select chappy_oct09_claim($1,$2,$3,$4)', [owner, '2026-10-09', source, request]), /permission denied/);
    await assert.rejects(db.exec('insert into chappy_oct09_revision(user_id,date,source_data) values (null,null,null)'), /permission denied/);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from chappy_oct09_revision')).rows.length, 0);
    await db.exec('reset role');
    assert.deepEqual((await db.query('select * from records order by date')).rows, records);
    assert.deepEqual((await db.query('select * from chappy_growth_advice order by date')).rows, originals);
    assert.deepEqual(await rpc('chappy_growth_saved', [owner, '2026-10-08']), old);
  } finally { await db.close(); }
});

test('Edge regeneration is limited to owned October 9, reuses cached version, and leaves old advice on failure', async () => {
  let handler: (req: Request) => Promise<Response>;
  let cached: unknown = old;
  let regenerated = false;
  let owned = true;
  let providerOk = false;
  let calls = 0;
  let finishes = 0;
  let finishOk = false;
  const source = { teams: [{ good: 'パスを強く投げれた' }] };
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
    from: (name: string) => { assert.equal(name, 'chappy_oct09_revision'); const q = { update: () => q, eq: () => q, is: () => q }; return q; },
    rpc: async (name: string, args: any) => {
      assert.equal(args.p_user, owner);
      assert.equal(args.p_date, '2026-10-09');
      if (name === 'chappy_growth_record') return { data: owned ? source : null, error: null };
      if (name === 'chappy_oct09_saved') return { data: { advice: cached, regenerated }, error: null };
      if (name === 'chappy_growth_history') return { data: [], error: null };
      if (name === 'chappy_oct09_claim') return { data: 'claimed', error: null };
      if (name === 'chappy_oct09_finish') { if (!finishOk) return { data: false, error: null }; finishes++; cached = args.p_advice; regenerated = true; return { data: true, error: null }; }
      throw Error('Unexpected RPC');
    },
  };
  runInNewContext(transformSync(readFileSync('supabase/functions/chappy-advice/index.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
    exports: {}, Response, Request, AbortSignal, crypto,
    Deno: { env: { get: (key: string) => ({ CHAPPY_ALLOWED_USER_IDS: owner, OPENAI_API_KEY: 'test-only', SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only' })[key] }, serve: (fn: typeof handler) => { handler = fn; } },
    require: (name: string) => name === './advice.ts' ? adviceModule : { createClient: () => db },
    fetch: async () => { calls++; return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ good: fresh.good, focus: fresh.focus, mission: fresh.mission, growth: null, grounding: { current_quote: 'パスを強く投げれた', growth_current_quote: null, past_quotes: [] } }) } }] }), { status: providerOk ? 200 : 500 }); },
  });
  const invoke = (action = 'regenerate_oct09', date = '2026-10-09') => handler!(new Request('https://example.invalid', { method: 'POST', headers: { Authorization: 'Bearer jwt' }, body: JSON.stringify({ date, action }) }));
  assert.equal((await invoke('regenerate_oct09', '2026-10-08')).status, 400);
  assert.equal(calls, 0);
  assert.deepEqual(await (await invoke('generate')).json(), { status: 'ready', advice: old, regenerated: false });
  assert.equal(calls, 0);
  owned = false;
  assert.equal((await invoke()).status, 404);
  owned = true;
  assert.equal((await invoke()).status, 502);
  assert.equal(finishes, 0);
  assert.deepEqual(await (await invoke('read')).json(), { status: 'ready', advice: old, regenerated: false });
  providerOk = true;
  assert.equal((await invoke()).status, 409);
  assert.deepEqual(await (await invoke('read')).json(), { status: 'ready', advice: old, regenerated: false });
  finishOk = true;
  const result = await (await invoke()).json();
  assert.equal(result.regenerated, true);
  assert.equal(result.advice.good, fresh.good);
  assert.equal(result.advice.growth_status.code, 'no_history');
  assert.equal(finishes, 1);
  assert.equal((await invoke()).status, 200);
  assert.equal(calls, 3);
});
