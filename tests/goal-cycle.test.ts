import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { assessGeneratedAdvice, growthContext, validateStoredAdvice, diaryInput } from '../supabase/functions/chappy-advice/advice.ts';
import { initialReflection } from '../src/practiceReflection.js';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const goal = { date: '2026-09-01', goal: '次の守備で、スクリーンを見たら1回声を出そう。' };
const oldAdvice = { good: '記録できたね', focus: '守備で知らせよう', mission: goal.goal, growth: null };
const output = () => ({ ...oldAdvice, practice_advice: '次の3対3で、相手が近づく方向を見て「右！」と知らせよう。', follow_up: [], grounding: { current_quote: null, growth_current_quote: null, past_quotes: [], follow_up_quotes: [] } });

test('new five-field diary can be initialized from old data without mutating any legacy fields', () => {
  const record = { teams: [{ content: '3対3', taught: '教わった内容', good: 'パスできた', improve: '戻りが遅れた', next: '早く戻ろう' }], parentComment: 'preserve', chores: [{ name: 'preserve' }] };
  const before = JSON.stringify(record);
  const reflection = initialReflection(record);
  assert.equal(reflection.content, '3対3');
  assert.equal(reflection.good, 'パスできた');
  assert.equal(reflection.improve, '戻りが遅れた');
  assert.equal(reflection.next, '早く戻ろう');
  reflection.good = '編集した';
  assert.equal(JSON.stringify(record), before);
  const saved = { ...record, practiceReflection: { ...reflection, goal_review: { goal_date: goal.date, goal: goal.goal, status: 'partial', memo: '1回知らせた' } } };
  assert.deepEqual(initialReflection(JSON.parse(JSON.stringify(saved))), saved.practiceReflection);
  assert.equal(saved.teams[0].taught, record.teams[0].taught);
});

test('all three self-reports round-trip and do not fabricate objective growth', () => {
  for (const status of ['done', 'partial', 'not_yet']) {
    const current = { practiceReflection: { content: '守備練習', good: '', improve: '声を出すタイミングが難しかった', next: '1回知らせたい', goal_review: { goal_date: goal.date, goal: goal.goal, status, memo: 'タイミングを考えた' } } };
    const context = growthContext('2026-10-23', current, [], [goal]);
    assert.equal(context.previous_goal?.date, '2026-09-01');
    assert.equal(context.follow_up_advice[0].date, '2026-09-01');
    const assessment = assessGeneratedAdvice(output(), context);
    const stored = { ...assessment.advice, growth_status: assessment.growth_status };
    assert.equal(stored.previous_goal_review?.status, status);
    assert.equal(stored.priority_goal, stored.mission);
    assert.equal(stored.practice_advice, output().practice_advice);
    assert.equal(stored.growth, null);
    assert.deepEqual(validateStoredAdvice(JSON.parse(JSON.stringify(stored))), stored);
    assert.doesNotMatch(stored.previous_goal_review!.comment, /上達した|技術が向上|成功した/);
  }
});

test('no goal, missing answer, mismatched target and future goals never authorize achievement claims', () => {
  const reflection = { practiceReflection: { goal_review: { goal_date: '2026-10-24', goal: 'invented', status: 'done' } } };
  for (const prior of [[], [goal], [{ ...goal, date: '2026-10-24' }]]) {
    const result = assessGeneratedAdvice(output(), growthContext('2026-10-23', reflection, [], prior));
    assert.equal(result.advice.previous_goal_review?.status, prior[0]?.date === goal.date ? 'unknown' : 'no_goal');
    assert.equal(result.advice.growth, null);
  }
  assert.equal(assessGeneratedAdvice(output(), growthContext('2026-10-23', {}, [], [goal])).advice.previous_goal_review?.status, 'unknown');
});

test('new reflection facts can ground praise, while plans and self-report choices cannot establish growth', () => {
  const record = { practiceReflection: { good: 'パス前に味方を見られた', next: 'シュートを決めたい', goal_review: { status: 'done', memo: '味方の位置を考えた', parentComment: 'private' } }, parentComment: 'private', chores: 'private' };
  const context = growthContext('2026-10-23', record, []);
  const value = { ...output(), good: '「パス前に味方を見られた」と振り返れたね。', grounding: { ...output().grounding, current_quote: 'パス前に味方を見られた' } };
  assert.equal(assessGeneratedAdvice(value, context).advice.good, value.good);
  const planned = { ...value, good: '「シュートを決めたい」成功したね。', grounding: { ...value.grounding, current_quote: 'シュートを決めたい' } };
  assert.doesNotMatch(assessGeneratedAdvice(planned, context).advice.good, /成功/);
  assert.doesNotMatch(JSON.stringify(diaryInput(record)), /private/);
});

test('additive goal RPC is owner-scoped, excludes deleted/current/future days, supports legacy/revisions and long gaps', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      create function auth.uid() returns uuid language sql as $$select null::uuid$$;
      create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;
      create table records(date text primary key,data jsonb);`);
    for (const file of ['chappy-advice.sql','chappy-growth.sql','chappy-oct09-revision.sql']) await db.exec(readFileSync('supabase/'+file, 'utf8'));
    for (const date of ['2026-06-01','2026-09-01','2026-10-01','2026-10-09','2026-10-23','2026-10-24']) {
      await db.query('insert into records values($1,$2)', [date, { original: date }]);
      await db.query('insert into chappy_record_owners values($1,$2)', [date, date === '2026-10-01' ? other : owner]);
    }
    await db.query('insert into chappy_advice(date,source_data,advice) values($1,$2,$3)', ['2026-06-01',{},oldAdvice]);
    for (const date of ['2026-09-01','2026-10-01','2026-10-09','2026-10-23','2026-10-24']) {
      await db.query('insert into chappy_growth_advice(user_id,date,source_data,advice) values($1,$2,$3,$4)', [date === '2026-10-01' ? other : owner,date,{},oldAdvice]);
    }
    const revision = { ...oldAdvice, mission: '再生成した目標', growth_status: { code: 'no_history', history_count: 0, comparable_count: 0 } };
    await db.query('insert into chappy_oct09_revision(user_id,date,source_data,advice) values($1,$2,$3,$4)', [owner,'2026-10-09',{},revision]);
    const before = (await db.query('select * from records order by date')).rows;
    const adviceBefore = (await db.query('select * from chappy_growth_advice order by date')).rows;
    await db.exec(readFileSync('supabase/chappy-goal-cycle.sql','utf8'));
    const read = async (id: string, date: string) => (await db.query<{result: any}>('select chappy_previous_goals($1,$2) result',[id,date])).rows[0].result;
    assert.deepEqual(await read(owner,'2026-10-23'), [{ date: '2026-10-09', goal: revision.mission }, goal]);
    assert.deepEqual(await read(other,'2026-10-23'), [{ date: '2026-10-01', goal: goal.goal }]);
    assert.deepEqual(await read(owner,'2026-01-01'), []);
    assert.deepEqual(await read(owner,'2026-09-01'), [{ date: '2026-06-01', goal: goal.goal }]);
    assert.deepEqual((await db.query('select * from records order by date')).rows,before);
    assert.deepEqual((await db.query('select * from chappy_growth_advice order by date')).rows,adviceBefore);
    await db.exec("delete from records where date='2026-10-09'");
    assert.deepEqual(await read(owner,'2026-10-23'), [goal,{ date: '2026-06-01', goal: goal.goal }]);
    for (const role of ['anon','authenticated']) {
      await db.exec('set role '+role);
      await assert.rejects(read(owner,'2026-10-23'),/permission denied/);
      await db.exec('reset role');
    }
    await db.exec('grant all on records to service_role; set role service_role');
    assert.equal((await read(owner,'2026-10-23')).length,2);
    await db.exec('reset role');
  } finally { await db.close(); }
});

test('goal lookup authenticates/allowlists the caller and works before a new diary exists without generation or writes', async () => {
  const { transformSync } = await import('esbuild');
  const { runInNewContext } = await import('node:vm');
  const adviceModule = await import('../supabase/functions/chappy-advice/advice.ts');
  let handler: (request: Request) => Promise<Response>;
  let identity = owner;
  let reads = 0;
  const db = { auth: { getUser: async () => ({ data: { user: { id: identity } }, error: null }) }, rpc: async (name: string, args: any) => {
    assert.equal(name,'chappy_previous_goals');
    assert.equal(args.p_user,owner);
    assert.equal(args.p_date,'2026-10-23');
    reads++;
    return { data: [goal], error: null };
  } };
  const code=transformSync(readFileSync('supabase/functions/chappy-advice/index.ts','utf8'),{loader:'ts',format:'cjs'}).code;
  runInNewContext(code, { exports: {}, Response, Request, AbortSignal, crypto,
    Deno: { env: { get: (key: string) => ({CHAPPY_ALLOWED_USER_IDS:owner,OPENAI_API_KEY:'test-placeholder'})[key] }, serve: (fn: typeof handler) => {handler=fn;} },
    require: (name: string) => name==='./advice.ts' ? adviceModule : {createClient:()=>db},
    fetch: () => { throw new Error('Must not invoke OpenAI for goal lookup'); },
  });
  const invoke = (auth=true) => handler!(new Request('https://example.invalid',{method:'POST',headers:auth?{Authorization:'Bearer test'}:{},body:JSON.stringify({action:'previous_goal',date:'2026-10-23',p_user:other})}));
  assert.deepEqual(await (await invoke()).json(),{status:'ready',goal});
  assert.equal(reads,1);
  identity=other;
  assert.equal((await invoke()).status,403);
  assert.equal((await invoke(false)).status,401);
  assert.equal(reads,1);
});
