import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import * as adviceModule from '../supabase/functions/chappy-advice/advice.ts';

test('dates, output format and minimal diary input', () => {
  assert.equal(adviceModule.validDate('2026-02-30'), false);
  assert.equal(adviceModule.validDate('__meta__'), false);
  assert.equal(adviceModule.validDate('2026-10-07'), true);
  assert.throws(() => adviceModule.validateAdvice({ good: 'いいね' }));
  assert.throws(() => adviceModule.validateAdvice({ good: 'a'.repeat(121), focus: 'b', mission: 'c' }));
  assert.throws(() => adviceModule.validateAdvice({ good: 'a', focus: 'b', mission: 'c', extra: 'd' }));
  const input = adviceModule.diaryInput({ parentComment: 'private', chores: [{ amount: 500 }], teams: [{ teamName: 'private', good: 'パスできた' }] });
  assert.equal(JSON.stringify(input).includes('private'), false);
  assert.deepEqual(input.teams, [{ good: 'パスできた' }]);
});

test('database caching, leases, changed records, RLS, budget and cascade', async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.records(date text primary key, data jsonb);
    insert into records values ('2026-10-07','{"solos":[]}');`);
  await db.exec(readFileSync('supabase/chappy-advice.sql', 'utf8'));
  const id = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const claim = async (request = id) => (await db.query<{ result: string }>(`select chappy_claim('2026-10-07', (select data from records where date='2026-10-07'), $1, $2) result`, [request, id])).rows[0].result;
  assert.equal(await claim(), 'claimed');
  assert.equal(await claim(other), 'busy');
  const output = { good: '練習を記録できたね。', focus: '顔を上げよう。', mission: '次はパスの前に周りを見よう。' };
  const finish = async (request = id) => (await db.query<{ result: boolean }>('select chappy_finish($1,$2,$3) result', ['2026-10-07', request, output])).rows[0].result;
  assert.equal(await finish(other), false);
  assert.equal(await finish(), true);
  assert.equal(await claim(), 'ready');
  assert.deepEqual((await db.query<{ result: unknown }>("select chappy_current_advice('2026-10-07') result")).rows[0].result, output);
  await db.exec(`update records set data='{"solos":[{"memo":"新しい日記"}]}';`);
  assert.equal((await db.query<{ result: unknown }>("select chappy_current_advice('2026-10-07') result")).rows[0].result, null);
  await db.exec("update chappy_advice set attempted_at=now()-interval '61 seconds'");
  assert.equal(await claim(), 'claimed');
  await db.exec(`update records set data='{"solos":[]}';`);
  assert.equal(await finish(), false);
  await db.exec("update chappy_advice set attempted_at=now()-interval '61 seconds'; update chappy_usage set attempts=30");
  assert.equal(await claim(), 'limited');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from chappy_advice'), /permission denied/);
    await assert.rejects(db.query("select chappy_current_advice('2026-10-07')"), /permission denied/);
    await db.exec('reset role');
  }
  assert.equal((await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname='chappy_advice'")).rows[0].relrowsecurity, true);
  await db.exec("delete from records where date='2026-10-07'");
  assert.equal((await db.query('select * from chappy_advice')).rows.length, 0);
  await db.close();
});

test('Edge Function fails closed before any generation for missing/invalid auth', async () => {
  let handler: (req: Request) => Promise<Response>;
  let apiCalls = 0;
  let allowlist = 'allowed-user';
  let user: unknown = { id: 'outsider' };
  const code = transformSync(readFileSync('supabase/functions/chappy-advice/index.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  runInNewContext(code, {
    exports: {}, Response, Request, AbortSignal, crypto,
    Deno: { env: { get: (key: string) => ({ CHAPPY_ALLOWED_USER_IDS: allowlist, OPENAI_API_KEY: 'test-only-placeholder', SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only-placeholder' })[key] }, serve: (fn: typeof handler) => { handler = fn; } },
    require: (name: string) => name === './advice.ts' ? adviceModule : { createClient: () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) },
    fetch: () => { apiCalls++; throw Error('Must not call OpenAI'); },
  });
  const request = (body: string, auth?: string) => new Request('https://example.invalid', { method: 'POST', headers: auth ? { Authorization: auth } : {}, body });
  assert.equal((await handler!(request('{}'))).status, 401);
  assert.equal((await handler!(request('{}', 'Bearer jwt'))).status, 403);
  user = { id: 'allowed-user', is_anonymous: true };
  assert.equal((await handler!(request('{}', 'Bearer jwt'))).status, 403);
  user = { id: 'allowed-user' };
  assert.equal((await handler!(request('invalid json', 'Bearer jwt'))).status, 400);
  assert.equal((await handler!(request('{"date":"__meta__","action":"generate"}', 'Bearer jwt'))).status, 400);
  allowlist = '';
  assert.equal((await handler!(request('{}', 'Bearer jwt'))).status, 503);
  assert.equal(apiCalls, 0);
});

test('Edge Function generates from saved data, persists, caches, and handles stale/failing results', async () => {
  let handler: (req: Request) => Promise<Response>;
  let calls = 0;
  let finishes = 0;
  let cached: unknown = null;
  let saved = true;
  let providerOk = true;
  let output: unknown = { good: 'パスを工夫したね。', focus: '顔を上げよう。', mission: '次回、パス前に周りを見よう。', growth: null };
  const record = { teams: [{ good: 'パスを工夫した', teamName: 'private' }], parentComment: 'private' };
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'allowed-user' } }, error: null }) },
    from: () => {
      const chain = { select: () => chain, update: () => chain, eq: () => chain, is: () => chain, maybeSingle: async () => ({ data: { data: record }, error: null }) };
      return chain;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === 'chappy_growth_record') return { data: record, error: null };
      if (name === 'chappy_growth_history') return { data: [], error: null };
      if (name === 'chappy_growth_saved') return { data: cached, error: null };
      if (name === 'chappy_growth_claim') { assert.deepEqual(args.p_source, record); return { data: 'claimed', error: null }; }
      if (name === 'chappy_growth_finish') { finishes++; assert.deepEqual(JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(args.p_advice as object).filter(([key]) => key !== 'growth_status')))), output); return { data: saved, error: null }; }
      throw Error('Unexpected RPC');
    },
  };
  const code = transformSync(readFileSync('supabase/functions/chappy-advice/index.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  runInNewContext(code, {
    exports: {}, Response, Request, AbortSignal, crypto,
    Deno: { env: { get: (key: string) => ({ CHAPPY_ALLOWED_USER_IDS: 'allowed-user', OPENAI_API_KEY: 'test-only-placeholder', SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only-placeholder' })[key] }, serve: (fn: typeof handler) => { handler = fn; } },
    require: (name: string) => name === './advice.ts' ? adviceModule : { createClient: () => db },
    fetch: async (url: string, options: { body: string }) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
      const payload = JSON.parse(options.body);
      assert.equal(payload.store, false);
      assert.equal(payload.messages[1].content.includes('private'), false);
      assert.equal(payload.messages[1].content.includes('パスを工夫した'), true);
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ ...(output as object), grounding: { current_quote: 'パスを工夫した', past_quotes: [] } }) } }] }), { status: providerOk ? 200 : 500 });
    },
  });
  const invoke = () => handler!(new Request('https://example.invalid', { method: 'POST', headers: { Authorization: 'Bearer jwt' }, body: JSON.stringify({ date: '2026-10-07', action: 'generate', data: 'untrusted unsaved text' }) }));
  const generated = await invoke();
  assert.equal(generated.status, 200);
  assert.deepEqual(await generated.json(), { status: 'ready', advice: { ...(output as object), growth_status: { code: 'no_history', history_count: 0, comparable_count: 0 } } });
  assert.equal(finishes, 1);
  cached = output;
  assert.equal((await invoke()).status, 200);
  assert.equal(calls, 1);
  cached = null; saved = false;
  assert.equal((await invoke()).status, 409);
  providerOk = false;
  const failed = await invoke();
  assert.equal(failed.status, 502);
  assert.equal((await failed.text()).includes('test-only-placeholder'), false);
  providerOk = true; output = { good: 'a', focus: 'b' };
  assert.equal((await invoke()).status, 502);
  assert.equal(finishes, 2);
});

test('Edge Function scopes historical reads to authenticated owner and preserves cached legacy advice', async () => {
  let handler: (req: Request) => Promise<Response>;
  let owned = true;
  let calls = 0;
  let historyReads = 0;
  let cache: unknown = null;
  const base = { good: '「顔は上げた」と振り返れたね。', focus: '守備を見てからパスしよう。', mission: '通り道がふさがったら運ぼう。' };
  const dates = ['2026-10-01', '2026-10-04'];
  let rows = dates.map(date => ({ date, data: { daySummary: { memo: 'パスを守備に取られた' }, parentComment: 'private' }, advice: base }));
  let output: unknown = { ...base, growth: { improved: '10/1と10/4から顔を上げる工夫を続けているね。', ongoing: '10/1と10/4は「パスを守備に取られた」と書いていたね。今日も同じ課題に取り組もう。', next: '受け手との間に守備がいたら、待つか運ぼう。', evidence_dates: dates } };
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'allowed-user' } }, error: null }) },
    from: () => { const chain = { update: () => chain, eq: () => chain, is: () => chain }; return chain; },
    rpc: async (name: string, args: Record<string, unknown>) => {
      assert.equal(args.p_user, 'allowed-user');
      assert.equal(args.p_date, '2026-10-07');
      if (name === 'chappy_growth_record') return { data: owned ? { daySummary: { memo: '今日もパスを取られた。顔は上げた' } } : null, error: null };
      if (name === 'chappy_growth_saved') return { data: cache, error: null };
      if (name === 'chappy_growth_history') { historyReads++; return { data: rows, error: null }; }
      if (name === 'chappy_growth_claim') return { data: 'claimed', error: null };
      if (name === 'chappy_growth_finish') { assert.deepEqual(JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(args.p_advice as object).filter(([key]) => key !== 'growth_status')))), output); return { data: true, error: null }; }
      throw Error('Unexpected RPC');
    },
  };
  const code = transformSync(readFileSync('supabase/functions/chappy-advice/index.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  runInNewContext(code, {
    exports: {}, Response, Request, AbortSignal, crypto,
    Deno: { env: { get: (key: string) => ({ CHAPPY_ALLOWED_USER_IDS: 'allowed-user', OPENAI_API_KEY: 'test-only-placeholder', SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only-placeholder' })[key] }, serve: (fn: typeof handler) => { handler = fn; } },
    require: (name: string) => name === './advice.ts' ? adviceModule : { createClient: () => db },
    fetch: async (_url: string, options: { body: string }) => {
      calls++;
      const payload = JSON.parse(options.body);
      const input = JSON.parse(payload.messages[1].content);
      assert.equal(payload.max_completion_tokens, 1100);
      assert.doesNotMatch(JSON.stringify(input), /private/);
      assert.equal(input.growth_allowed, rows.length >= 2);
      assert.deepEqual(input.history.map((row: { date: string }) => row.date), rows.length >= 2 ? dates : []);
      assert.match(payload.messages[0].content, /小学5年生の男子ガード/);
      assert.match(payload.messages[0].content, /目線、足の運び/);
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ ...(output as object), grounding: { current_quote: '顔は上げた', past_quotes: rows.map(row => ({ date: row.date, quote: 'パスを守備に取られた' })) } }) } }] }));
    },
  });
  const invoke = (action = 'generate') => handler!(new Request('https://example.invalid', { method: 'POST', headers: { Authorization: 'Bearer jwt' }, body: JSON.stringify({ date: '2026-10-07', action, user_id: 'outsider' }) }));
  assert.equal((await invoke()).status, 200);
  assert.equal(calls, 1);
  cache = base;
  assert.deepEqual(await (await invoke()).json(), { status: 'ready', advice: base });
  assert.equal(calls, 1);
  assert.equal(historyReads, 1);
  cache = null;
  assert.deepEqual(await (await invoke('read')).json(), { status: 'missing' });
  assert.equal(historyReads, 1);
  owned = false;
  assert.equal((await invoke()).status, 404);
  assert.equal(historyReads, 1);
  owned = true;
  rows = [];
  // Provider must not fabricate growth without comparable history.
  assert.equal((await invoke()).status, 502);
  output = { ...base, growth: null };
  assert.equal((await invoke()).status, 200);
});
