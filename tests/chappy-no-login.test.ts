import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { initialReflection, achievementOptions, reflectionFields } from '../src/practiceReflection.js';

const require = createRequire(import.meta.url);
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const third = '33333333-3333-4333-8333-333333333333';
const base = { good: '記録したね', focus: '守備で知らせよう', mission: 'スクリーンを見たら声で知らせよう', growth: null };

test('family_user picks the majority owner deterministically and existing data is untouched', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to public;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
      create table records(date text primary key,data jsonb);`);
    for (const file of ['chappy-advice.sql', 'chappy-growth.sql', 'chappy-oct09-revision.sql', 'chappy-goal-cycle.sql']) await db.exec(readFileSync('supabase/' + file, 'utf8'));
    // Extra records (10-05..10-10) are inserted before the no-login SQL so the
    // new trigger cannot auto-register them; their owner rows are added later.
    for (const date of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']) {
      await db.query('insert into records values($1,$2)', [date, { daySummary: { memo: 'パス練習' } }]);
    }
    for (const [date, id] of [['2026-10-01', owner], ['2026-10-02', owner], ['2026-10-03', owner], ['2026-10-04', other]] as const) {
      await db.query('insert into chappy_record_owners values($1,$2)', [date, id]);
    }
    await db.query('insert into chappy_growth_advice(user_id,date,source_data,advice) values($1,$2,$3,$4)', [owner, '2026-10-03', { daySummary: { memo: 'パス練習' } }, base]);
    const ownersBefore = (await db.query('select * from chappy_record_owners order by date')).rows;
    const adviceBefore = (await db.query('select * from chappy_growth_advice')).rows;
    await db.exec(readFileSync('supabase/chappy-no-login.sql', 'utf8'));
    assert.deepEqual((await db.query('select * from chappy_record_owners order by date')).rows, ownersBefore);
    assert.deepEqual((await db.query('select * from chappy_growth_advice')).rows, adviceBefore);
    const family = async () => (await db.query<{ v: string }>('select chappy_family_user() v')).rows[0].v;
    assert.equal(await family(), owner);
    // Tie (3 vs 3) breaks to the smallest user_id, still owner.
    for (const date of ['2026-10-05', '2026-10-06']) {
      await db.query('insert into chappy_record_owners values($1,$2)', [date, other]);
    }
    assert.equal(await family(), owner);
    // A clear majority for the other user wins instead.
    await db.query('insert into chappy_record_owners values($1,$2)', ['2026-10-07', other]);
    assert.equal(await family(), other);
    // Saved family advice stays readable through the existing RPCs.
    assert.deepEqual((await db.query('select chappy_growth_saved($1,$2) v', [owner, '2026-10-03'])).rows[0].v, base);
    // Browser roles cannot resolve the family user; service_role can.
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select chappy_family_user()'), /permission denied/);
      await assert.rejects(db.query('select chappy_internal.family_user()'), /permission denied/);
      await assert.rejects(db.query('select chappy_internal.register_owner()'), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('grant all on records to service_role; set role service_role');
    assert.equal(await family(), other);
    await db.exec('reset role');
  } finally { await db.close(); }
});

test('owner trigger attributes no-login inserts to the family user and keeps authenticated inserts', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to public;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
      create table records(date text primary key,data jsonb);`);
    for (const file of ['chappy-advice.sql', 'chappy-growth.sql', 'chappy-no-login.sql']) await db.exec(readFileSync('supabase/' + file, 'utf8'));
    const ownerOf = async (date: string) => (await db.query<{ user_id: string }>('select user_id from chappy_record_owners where date=$1', [date])).rows[0]?.user_id;
    // No family yet: a no-login insert registers nobody (never invents an owner).
    await db.query('insert into records values($1,$2)', ['2026-10-01', { daySummary: { memo: '最初の日記' } }]);
    assert.equal(await ownerOf('2026-10-01'), undefined);
    await db.query('insert into chappy_record_owners values($1,$2)', ['2026-10-01', owner]);
    // No-login (anon) insert is attributed to the family user.
    await db.query('insert into records values($1,$2)', ['2026-10-02', { daySummary: { memo: 'ログインなしで書いた日記' } }]);
    assert.equal(await ownerOf('2026-10-02'), owner);
    // Chappy can read the no-login diary through the family owner's RPC.
    assert.deepEqual((await db.query('select chappy_growth_record($1,$2) v', [owner, '2026-10-02'])).rows[0].v, { daySummary: { memo: 'ログインなしで書いた日記' } });
    // An authenticated insert still registers the caller, not the family user.
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [third]);
    await db.query('insert into records values($1,$2)', ['2026-10-03', {}]);
    assert.equal(await ownerOf('2026-10-03'), third);
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    // Non-date keys such as '__meta__' never get an owner row.
    await db.query('insert into records values($1,$2)', ['__meta__', {}]);
    assert.equal(await ownerOf('__meta__'), undefined);
    // Editing an existing record never reassigns its owner.
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [third]);
    await db.exec("update records set data='{}' where date='2026-10-02'");
    assert.equal(await ownerOf('2026-10-02'), owner);
    await db.query("select set_config('request.jwt.claim.sub','',false)");
  } finally { await db.close(); }
});

test('previous goal lookup runs without any session or login prompt', async () => {
  const goal = { date: '2026-10-01', goal: 'スクリーンを見たら声で知らせよう' };
  let calls = 0;
  const supabase = {
    functions: {
      invoke: async (_name: string, options: any) => {
        calls++;
        assert.equal(options.body.date, '2026-10-07');
        assert.equal(options.body.action, 'previous_goal');
        assert.deepEqual(Object.keys(options.body).sort(), ['action', 'date']);
        return { data: { status: 'ready', goal }, error: null };
      },
    },
  };
  const module = { exports: {} as { PracticeReflectionForm: React.ComponentType<any> } };
  const code = transformSync(readFileSync('src/PracticeReflection.jsx', 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code;
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => name === './supabase.js' ? { supabase } : name === './practiceReflection.js' ? { achievementOptions, reflectionFields } : require(name) });
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(React.createElement(module.exports.PracticeReflectionForm, { date: '2026-10-07', value: initialReflection({}), onChange: () => {}, onGoalState: () => {} })); });
  assert.equal(calls, 1);
  const text = JSON.stringify(tree!.toJSON());
  assert.match(text, /スクリーンを見たら声で知らせよう/);
  assert.doesNotMatch(text, /ログイン|signed_out/);
  await act(async () => tree!.unmount());
});
