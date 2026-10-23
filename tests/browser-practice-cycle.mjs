// Runs the actual app against an in-memory Supabase/OpenAI boundary.
// Never writes to production or sends email/model requests.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { growthContext, assessGeneratedAdvice } from '../supabase/functions/chappy-advice/advice.ts';
const base = 'http://127.0.0.1:4178';
const artifacts = process.env.TEST_ARTIFACT_DIR || '/tmp/chappy-goal-cycle-artifacts';
const previous = { date: '2026-10-19', goal: '次の守備で、スクリーンを見たら1回声を出そう。' };
const legacy = { teams: [{ teamName: 'テスト', content: '3対3', taught: '以前教えてもらったこと', good: 'パスできた', improve: '声を出せなかった', next: '知らせよう' }], chores: [{ name: 'テスト', amount: '10' }], parentComment: '変更しないコメント' };
const records = new Map([[previous.date, structuredClone(legacy)]]);
const cached = new Map([[previous.date, { good: '記録したね', focus: '声を出そう', mission: previous.goal, growth: null }]]);
let failSave = false;
let failLookup = false;
let generated = 0;
const errors = [];
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], {
  cwd: process.cwd(), env: { ...process.env, VITE_SUPABASE_URL: 'https://sandbox.invalid', VITE_SUPABASE_ANON_KEY: 'public-test-placeholder' }, stdio: 'pipe',
});
let browser;
try {
  for (let i=0;i<60;i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    const enc = v => btoa(JSON.stringify(v)).replaceAll('=','').replaceAll('+','-').replaceAll('/','_');
    const id = '11111111-1111-4111-8111-111111111111';
    localStorage.setItem('sb-sandbox-auth-token', JSON.stringify({ access_token: `${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:id,role:'authenticated',aud:'authenticated',exp:4102444800})}.test-signature`, refresh_token:'test-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',email:'test@example.invalid',created_at:'2026-01-01T00:00:00Z'} }));
  });
  await context.route('https://sandbox.invalid/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const fulfill = (data, status=200) => route.fulfill({ status, contentType:'application/json', body:JSON.stringify(data) });
    if (request.method()==='OPTIONS') return fulfill({});
    if (url.pathname==='/rest/v1/records') {
      if (request.method()==='GET') return fulfill([...records].map(([date,data])=>({date,data})));
      if (request.method()==='POST') {
        if (failSave) return fulfill({message:'simulated save failure'},500);
        const body=request.postDataJSON(); records.set(body.date,structuredClone(body.data)); return fulfill(null,201);
      }
    }
    if (url.pathname==='/functions/v1/chappy-advice') {
      const {date,action}=request.postDataJSON();
      const goals=[...cached].filter(([d,a])=>d<date&&records.has(d)&&a.mission).sort(([a],[b])=>b.localeCompare(a)).slice(0,2).map(([d,a])=>({date:d,goal:a.priority_goal||a.mission}));
      if (action==='previous_goal') return failLookup ? fulfill({error:'read failed'},502) : fulfill({status:'ready',goal:goals[0]||null});
      if (cached.has(date)) return fulfill({status:'ready',advice:cached.get(date)});
      const record=records.get(date);
      if (!record) return fulfill({error:'missing'},404);
      generated++;
      const model={good:`「${record.practiceReflection.good}」と振り返れたね。`,focus:'声を出すタイミングを1つ決めよう。',mission:'次の3対3で、スクリーンを見たら「右！」と1回知らせよう。',practice_advice:'相手が味方に近づいたら、方向を短い言葉で知らせよう。',growth:null,follow_up:[],grounding:{current_quote:record.practiceReflection.good,growth_current_quote:null,past_quotes:[],follow_up_quotes:[]}};
      const assessment=assessGeneratedAdvice(model,growthContext(date,record,[],goals));
      const advice={...assessment.advice,growth_status:assessment.growth_status};cached.set(date,structuredClone(advice));
      return fulfill({status:'ready',advice});
    }
    if (url.pathname.startsWith('/auth/v1/')) return fulfill({});
    throw new Error('Unexpected mock request '+url.pathname);
  });
  const page=await context.newPage();
  page.on('pageerror', error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-23T12:00:00+09:00'));
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(base);
  await page.getByRole('button',{name:'23',exact:true}).click();
  await page.getByRole('button',{name:'5項目の日記を書く',exact:true}).click();
  await page.getByText(previous.goal,{exact:true}).waitFor();
  await page.locator('#reflection-content').fill('3対3と守備練習');
  await page.getByRole('radio',{name:'少しできた',exact:true}).check();
  await page.locator('#goal-review-memo').fill('スクリーンに1回気づいて知らせた');
  await page.locator('#reflection-good').fill('味方に声をかけた');
  await page.locator('#reflection-improve').fill('声が遅い場面もあった');
  await page.locator('#reflection-next').fill('スクリーンに気づいたらすぐ知らせる');
  await mkdir(artifacts,{recursive:true});
  await page.screenshot({path:artifacts+'/iphone-form.png',fullPage:true});
  const width=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(width.page<=width.viewport,JSON.stringify(width));
  await page.getByRole('button',{name:'日記を保存',exact:true}).click();
  await page.getByLabel('5項目のAIアドバイス').waitFor();
  assert.equal(records.get('2026-10-23').practiceReflection.goal_review.status,'partial');
  assert.equal(records.get('2026-10-23').practiceReflection.goal_review.goal_date,previous.date);
  assert.equal(cached.get('2026-10-23').previous_goal_review.status,'partial');
  assert.equal(cached.get('2026-10-23').priority_goal,cached.get('2026-10-23').mission);
  await page.screenshot({path:artifacts+'/iphone-advice.png',fullPage:true});
  const oldAI=JSON.stringify(cached.get('2026-10-23'));
  await page.reload();
  await page.getByRole('button',{name:'23',exact:true}).click();
  await page.getByLabel('今日の5項目の日記').waitFor();
  assert.ok((await page.getByLabel('今日の5項目の日記').innerText()).includes('少しできた'));
  await page.getByRole('button',{name:'5項目の日記を編集',exact:true}).click();
  assert.equal(await page.locator('#goal-review-memo').inputValue(),'スクリーンに1回気づいて知らせた');
  await page.locator('#reflection-good').fill('味方に声をかけた。次も続けたい');
  failSave=true;
  await page.getByRole('button',{name:'日記を保存',exact:true}).click();
  await page.getByRole('button',{name:'日記を保存',exact:true}).waitFor({state:'visible'});
  assert.equal(await page.locator('#reflection-good').inputValue(),'味方に声をかけた。次も続けたい');
  assert.equal(records.get('2026-10-23').practiceReflection.good,'味方に声をかけた');
  failSave=false;
  await page.getByRole('button',{name:'日記を保存',exact:true}).click();
  await page.getByLabel('今日の5項目の日記').waitFor();
  assert.equal(JSON.stringify(cached.get('2026-10-23')),oldAI);
  assert.equal(generated,1);
  await page.getByRole('button',{name:'← カレンダー',exact:true}).click();
  await page.getByRole('button',{name:/^19/}).click();
  await page.getByRole('button',{name:'チーム練習を編集',exact:true}).click();
  await page.getByPlaceholder('うまくいったプレー',{exact:true}).fill('以前の日記を編集できた');
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await page.getByText('以前の日記を編集できた',{exact:true}).waitFor();
  assert.equal(records.get(previous.date).teams[0].taught,legacy.teams[0].taught);
  assert.equal(records.get(previous.date).parentComment,legacy.parentComment);
  assert.deepEqual(records.get(previous.date).chores,legacy.chores);
  await page.getByRole('button',{name:'← カレンダー',exact:true}).click();
  await page.getByRole('button',{name:'24',exact:true}).click();
  failLookup=true;
  await page.getByRole('button',{name:'5項目の日記を書く',exact:true}).click();
  await page.getByText('前回の目標を取得できませんでした。日記の入力は続けられます。',{exact:true}).waitFor();
  failLookup=false;
  await page.getByRole('button',{name:'目標をもう一度確認',exact:true}).click();
  await page.getByRole('radio',{name:'できた',exact:true}).waitFor();
  assert.equal(errors.length,0,errors.join('\n'));
  await writeFile(artifacts+'/result.json',JSON.stringify({passed:true,viewport:'390x844 touch',newDiary:true,reloadPersistence:true,threeChoice:true,oldDiaryEdit:true,previousGoalGap:true,aiFiveSections:true,savedAdvicePreserved:true,saveFailurePreservesDraft:true,goalReadFailureRecovery:true,modelCalls:generated,pageErrors:errors},null,2));
  console.log('Browser checks passed: '+artifacts);
} finally { await browser?.close(); server.kill('SIGTERM'); }
