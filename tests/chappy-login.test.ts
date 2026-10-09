import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { growthExplanation } from '../src/growthExplanation.js';
import TestRenderer, { act } from 'react-test-renderer';

const require = createRequire(import.meta.url);
const session = { user: { id: 'allowed-user' }, access_token: 'test-session' };

function fixture(restored: unknown = null, advice: unknown = { good: '工夫したね', focus: '周りを見よう', mission: 'パス前に顔を上げよう' }) {
  let callback: (event: string, session: unknown) => void;
  let failLogin = false;
  let loginCalls = 0;
  let generationCalls = 0;
  let passwordUpdates = 0;
  let failRevision = false;
  let regenerationCalls = 0;
  let latestAdvice = advice;
  let regenerated = false;
  let holdRevision = false;
  let releaseRevision: (() => void) | undefined;
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: restored } }),
      onAuthStateChange: (fn: typeof callback) => { callback = fn; return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: async (credentials: { email: string, password: string }) => {
        loginCalls++;
        assert.equal(credentials.email, 'parent@example.com');
        assert.equal(credentials.password, 'test-password');
        if (failLogin) return { data: { session: null }, error: new Error('Invalid credentials') };
        callback('SIGNED_IN', session);
        return { data: { session }, error: null };
      },
      signOut: async () => { callback('SIGNED_OUT', null); return { error: null }; },
      updateUser: async ({ password }: { password: string }) => { passwordUpdates++; assert.equal(password, 'new-test-password'); return { error: null }; },
    },
    functions: { invoke: async (_name: string, options: any) => { generationCalls++; if (options.body.action === 'regenerate_oct09') { regenerationCalls++; if (holdRevision) await new Promise<void>(resolve => { releaseRevision = resolve; }); if (failRevision) return { data: null, error: new Error('Generation failed') }; latestAdvice = { good: '新しい回答', focus: '一つを見る', mission: '次に一度見る', growth: null }; regenerated = true; } return { data: { status: 'ready', advice: latestAdvice, regenerated }, error: null }; } },
  };
  const module = { exports: {} as { default: React.ComponentType<any> } };
  const code = transformSync(readFileSync('src/ChappyAdvice.jsx', 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code;
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => name === './supabase.js' ? { supabase } : name === './growthExplanation.js' ? { growthExplanation } : require(name) });
  return { Component: module.exports.default, holdRevision: () => { holdRevision = true; }, releaseRevision: () => releaseRevision?.(), failRevision: () => { failRevision = true; }, succeedRevision: () => { failRevision = false; }, fail: () => { failLogin = true; }, succeed: () => { failLogin = false; }, counts: () => ({ loginCalls, generationCalls, passwordUpdates, regenerationCalls }) };
}

test('password login failure, success, immediate advice and logout', async () => {
  const f = fixture();
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(React.createElement(f.Component, { date: '2026-10-07', record: { solos: [] } })); });
  await act(async () => {
    tree!.root.findByProps({ type: 'email' }).props.onChange({ target: { value: ' parent@example.com ' } });
    tree!.root.findByProps({ autoComplete: 'current-password' }).props.onChange({ target: { value: 'test-password' } });
  });
  f.fail();
  await act(async () => { await tree!.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(f.counts().generationCalls, 0);
  assert.match(JSON.stringify(tree!.toJSON()), /ログインできませんでした/);
  f.succeed();
  await act(async () => { await tree!.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(f.counts().generationCalls, 1);
  assert.match(JSON.stringify(tree!.toJSON()), /工夫したね/);
  assert.equal(tree!.root.findAllByProps({ autoComplete: 'current-password' }).length, 0);
  const logout = tree!.root.findAllByType('button').find(button => button.props.children === 'ログアウト')!;
  await act(async () => { await logout.props.onClick(); });
  assert.equal(tree!.root.findByProps({ autoComplete: 'current-password' }).props.value, '');
  assert.doesNotMatch(JSON.stringify(tree!.toJSON()), /工夫したね/);
  await act(async () => tree!.unmount());
});

test('restored session skips login; existing user can set password without email', async () => {
  const f = fixture(session);
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(React.createElement(f.Component, { date: '2026-10-07', record: { solos: [] } })); });
  assert.equal(f.counts().loginCalls, 0);
  assert.equal(f.counts().generationCalls, 1);
  await act(async () => { tree!.root.findAllByType('button').find(button => button.props.children === 'パスワードを設定・変更')!.props.onClick(); });
  await act(async () => {
    const inputs = tree!.root.findAllByProps({ autoComplete: 'new-password' });
    inputs[0].props.onChange({ target: { value: 'new-test-password' } });
    inputs[1].props.onChange({ target: { value: 'different' } });
  });
  await act(async () => { await tree!.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(f.counts().passwordUpdates, 0);
  await act(async () => { tree!.root.findAllByProps({ autoComplete: 'new-password' })[1].props.onChange({ target: { value: 'new-test-password' } }); });
  await act(async () => { await tree!.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(f.counts().passwordUpdates, 1);
  assert.equal(tree!.root.findAllByType('input').length, 0);
  await act(async () => tree!.unmount());
});

test('optional growth section shows evidence; legacy and insufficient-history advice keep three sections', async () => {
  const base = { good: '工夫したね', focus: '周りを見よう', mission: 'パス前に顔を上げよう' };
  for (const growth of [undefined, null, { improved: '守備を見てパスできたね', ongoing: '通り道を選ぼう', next: '空くまで待とう', evidence_dates: ['2026-10-01', '2026-10-04'] }]) {
    const f = fixture(session, growth === undefined ? base : { ...base, growth });
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => { tree = TestRenderer.create(React.createElement(f.Component, { date: '2026-10-07', record: { solos: [] } })); });
    const text = JSON.stringify(tree!.toJSON());
    assert.match(text, /今日よかったところ/);
    assert.match(text, /次に意識すること/);
    assert.match(text, /次回ミッション/);
    if (growth) {
      assert.match(text, /チャッピーの成長チェック/);
      assert.match(text, /守備を見てパスできたね/);
      assert.match(text, /2026-10-01/);
      assert.match(text, /2026-10-04/);
    } else assert.doesNotMatch(text, /チャッピーの成長チェック/);
    await act(async () => tree!.unmount());
  }
});

test('parents see persisted reason and counts; old missing reasons are never inferred', async () => {
  for (const status of [undefined, { code: 'past_evidence_unverified', history_count: 20, comparable_count: 5 }]) {
    const f = fixture(session, { good: '記録したね', focus: '周りを見よう', mission: '一度見よう', growth: null, ...(status ? { growth_status: status } : {}) });
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => { tree = TestRenderer.create(React.createElement(f.Component, { date: '2026-10-09', record: { teams: [] } })); });
    const text = JSON.stringify(tree!.toJSON());
    assert.match(text, /保護者の方へ/);
    assert.match(text, /成長していないという意味ではありません/);
    assert.match(text, status ? /過去の日記の引用を確認できなかった/ : /生成時の理由が記録されていません/);
    if (status) { assert.match(text, /20/); assert.match(text, /5/); }
    assert.equal(f.counts().generationCalls, 1);
    await act(async () => tree!.unmount());
  }
});

test('October 9 regeneration keeps old advice on failure, switches on success and disappears on other dates', async () => {
  const f = fixture(session);
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(React.createElement(f.Component, { date: '2026-10-09', record: { teams: [] } })); });
  const button = () => tree!.root.findAllByType('button').find(b => b.props.children === '10月9日のアドバイスを再生成');
  assert.ok(button());
  f.failRevision();
  await act(async () => { await button()!.props.onClick(); });
  assert.match(JSON.stringify(tree!.toJSON()), /工夫したね/);
  assert.match(JSON.stringify(tree!.toJSON()), /以前のアドバイスはそのまま残っています/);
  f.succeedRevision();
  await act(async () => { await button()!.props.onClick(); });
  assert.match(JSON.stringify(tree!.toJSON()), /新しい回答/);
  assert.match(JSON.stringify(tree!.toJSON()), /以前の回答も保存されています/);
  assert.equal(button(), undefined);
  await act(async () => { tree!.update(React.createElement(f.Component, { date: '2026-10-08', record: { teams: [] } })); });
  assert.equal(button(), undefined);
  assert.equal(f.counts().regenerationCalls, 2);
  await act(async () => tree!.unmount());
});

test('a late October 9 regeneration response cannot replace another date on screen', async () => {
  const f = fixture(session);
  f.holdRevision();
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(React.createElement(f.Component, { date: '2026-10-09', record: { teams: [] } })); });
  let pending: Promise<void>;
  await act(async () => { pending = tree!.root.findAllByType('button').find(b => b.props.children === '10月9日のアドバイスを再生成')!.props.onClick(); });
  assert.match(JSON.stringify(tree!.toJSON()), /工夫したね/);
  await act(async () => { tree!.update(React.createElement(f.Component, { date: '2026-10-08', record: { teams: [] } })); });
  await act(async () => { f.releaseRevision(); await pending!; });
  assert.doesNotMatch(JSON.stringify(tree!.toJSON()), /新しい回答/);
  await act(async () => tree!.unmount());
});
