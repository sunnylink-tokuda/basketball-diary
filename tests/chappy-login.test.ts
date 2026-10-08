import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const require = createRequire(import.meta.url);
const session = { user: { id: 'allowed-user' }, access_token: 'test-session' };

function fixture(restored: unknown = null) {
  let callback: (event: string, session: unknown) => void;
  let failLogin = false;
  let loginCalls = 0;
  let generationCalls = 0;
  let passwordUpdates = 0;
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
    functions: { invoke: async () => { generationCalls++; return { data: { status: 'ready', advice: { good: '工夫したね', focus: '周りを見よう', mission: 'パス前に顔を上げよう' } }, error: null }; } },
  };
  const module = { exports: {} as { default: React.ComponentType<any> } };
  const code = transformSync(readFileSync('src/ChappyAdvice.jsx', 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code;
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => name === './supabase.js' ? { supabase } : require(name) });
  return { Component: module.exports.default, fail: () => { failLogin = true; }, succeed: () => { failLogin = false; }, counts: () => ({ loginCalls, generationCalls, passwordUpdates }) };
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
