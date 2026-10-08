import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createRecoveryController, recoveryLink } from '../src/passwordRecovery.js';

const require = createRequire(import.meta.url);
const session = { user: { id: 'allowed-user' }, access_token: 'test-session' };
function fixture(url = 'https://example.invalid/', blockedStorage = false, store = new Map()) {
  let callback: (event: string, session: unknown) => void;
  let resolve: (value: unknown) => void;
  let writes = 0;
  let fail = false;
  const initialization = new Promise(r => { resolve = r; });
  const auth = {
    onAuthStateChange: fn => { callback = fn; },
    getSession: () => initialization,
    updateUser: async ({ password }) => {
      writes++;
      assert.equal(password, 'new-test-password');
      if (fail) return { error: new Error('Provider failed') };
      callback('USER_UPDATED', session);
      return { error: null };
    },
  };
  const browser = {
    location: new URL(url),
    sessionStorage: {
      getItem: key => { if (blockedStorage) throw Error('Safari storage unavailable'); return store.get(key); },
      setItem: (key, value) => { if (blockedStorage) throw Error('Safari storage unavailable'); store.set(key, value); },
      removeItem: key => { if (blockedStorage) throw Error('Safari storage unavailable'); store.delete(key); },
    },
    history: { replaceState: (_state, _title, path) => { browser.location = new URL(path, browser.location); } },
  };
  const controller = createRecoveryController(auth, browser, recoveryLink(browser.location));
  const module = { exports: {} as { default: React.ComponentType<any> } };
  const code = transformSync(readFileSync('src/RecoveryGate.jsx', 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code;
  runInNewContext(code, { module, exports: module.exports, require: name => name === './supabase.js' ? { supabase: { auth }, passwordRecovery: controller } : require(name) });
  return {
    Component: module.exports.default, controller, store,
    event: (event, next = session) => callback(event, next),
    initialize: (next: unknown = session, error = null) => resolve({ data: { session: next }, error }),
    writes: () => writes, fail: value => { fail = value; },
  };
}

test('waits for auth; pre-mount recovery event survives URL cleanup and StrictMode mounting', async () => {
  const f = fixture('https://example.invalid/#type=recovery&access_token=test');
  f.event('PASSWORD_RECOVERY');
  let calendars = 0;
  function Calendar() { calendars++; return React.createElement('p', {}, 'calendar'); }
  let tree;
  await act(async () => { tree = TestRenderer.create(React.createElement(React.StrictMode, {}, React.createElement(f.Component, {}, React.createElement(Calendar)))); });
  assert.match(JSON.stringify(tree.toJSON()), /認証リンクを確認/);
  assert.equal(calendars, 0);
  await act(async () => { f.initialize(); await f.controller.initialized; });
  assert.equal(tree.root.findAllByProps({ type: 'password' }).length, 2);
  assert.equal(calendars, 0);
  f.controller.complete();
  await act(async () => tree.unmount());
});

test('PASSWORD_RECOVERY without a URL marker overrides normal navigation', async () => {
  const f = fixture();
  f.initialize(); await f.controller.initialized;
  let tree;
  await act(async () => { tree = TestRenderer.create(React.createElement(f.Component, {}, React.createElement('p', {}, 'calendar'))); });
  assert.match(JSON.stringify(tree.toJSON()), /calendar/);
  await act(async () => f.event('PASSWORD_RECOVERY'));
  assert.doesNotMatch(JSON.stringify(tree.toJSON()), /calendar/);
  assert.equal(tree.root.findAllByProps({ type: 'password' }).length, 2);
  await act(async () => tree.unmount());
});

test('Safari unavailable storage still permits validated recovery; errors do not redirect', async () => {
  const f = fixture('https://example.invalid/#type=recovery&access_token=test', true);
  f.event('PASSWORD_RECOVERY'); f.initialize(); await f.controller.initialized;
  let tree;
  await act(async () => { tree = TestRenderer.create(React.createElement(f.Component, {}, React.createElement('p', {}, 'calendar'))); });
  await act(async () => {
    const inputs = tree.root.findAllByProps({ type: 'password' });
    inputs[0].props.onChange({ target: { value: 'new-test-password' } });
    inputs[1].props.onChange({ target: { value: 'wrong' } });
  });
  await act(async () => { await tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(f.writes(), 0);
  await act(async () => tree.root.findAllByProps({ type: 'password' })[1].props.onChange({ target: { value: 'new-test-password' } }));
  f.fail(true);
  await act(async () => { await tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.match(JSON.stringify(tree.toJSON()), /設定できませんでした/);
  assert.doesNotMatch(JSON.stringify(tree.toJSON()), /calendar/);
  f.fail(false);
  await act(async () => { await tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.match(JSON.stringify(tree.toJSON()), /パスワードを設定しました/);
  assert.equal(tree.root.findAllByType('input').length, 0);
  assert.doesNotMatch(JSON.stringify(tree.toJSON()), /calendar/);
  await act(async () => tree.root.findByType('button').props.onClick());
  assert.match(JSON.stringify(tree.toJSON()), /calendar/);
  await act(async () => tree.unmount());
});

test('refresh retains unfinished recovery without storing a token or password', async () => {
  const first = fixture('https://example.invalid/#type=recovery&access_token=test');
  first.event('PASSWORD_RECOVERY'); first.initialize(); await first.controller.initialized;
  assert.deepEqual([...first.store.values()], ['pending']);
  const reloaded = fixture('https://example.invalid/', false, first.store);
  reloaded.initialize(); await reloaded.controller.initialized;
  assert.equal(reloaded.controller.getSnapshot().recovery, true);
  assert.equal(reloaded.controller.getSnapshot().error, false);
  reloaded.controller.complete();
  assert.equal(first.store.size, 0);
});

test('invalid recovery cannot use an old ordinary session; expired URL shows an error', async () => {
  for (const url of ['https://example.invalid/#type=recovery&access_token=invalid', 'https://example.invalid/#error=access_denied&error_code=otp_expired']) {
    const f = fixture(url);
    f.initialize(); await f.controller.initialized;
    assert.equal(f.controller.getSnapshot().error, true);
    let tree;
    await act(async () => { tree = TestRenderer.create(React.createElement(f.Component, {}, React.createElement('p', {}, 'calendar'))); });
    assert.equal(tree.root.findAllByType('input').length, 0);
    assert.match(JSON.stringify(tree.toJSON()), /期限切れ/);
    assert.doesNotMatch(JSON.stringify(tree.toJSON()), /calendar/);
    await act(async () => tree.unmount());
  }
});

test('ordinary access still reaches the calendar when initialization finishes', async () => {
  const f = fixture();
  f.initialize(null); await f.controller.initialized;
  assert.equal(f.controller.getSnapshot().recovery, false);
  assert.equal(f.controller.getSnapshot().ready, true);
});

test('SDK-delayed PASSWORD_RECOVERY is handled after getSession resolves', async () => {
  const f = fixture('https://example.invalid/#type=recovery&access_token=test');
  f.initialize(); await f.controller.initialized;
  let tree;
  await act(async () => { tree = TestRenderer.create(React.createElement(f.Component, {}, React.createElement('p', {}, 'calendar'))); });
  assert.doesNotMatch(JSON.stringify(tree.toJSON()), /calendar/);
  await act(async () => f.event('PASSWORD_RECOVERY'));
  assert.equal(tree.root.findAllByProps({ type: 'password' }).length, 2);
  assert.doesNotMatch(JSON.stringify(tree.toJSON()), /calendar/);
  await act(async () => tree.unmount());
});

test('a stale initial session read cannot overwrite a newer recovery event', async () => {
  const f = fixture('https://example.invalid/#type=recovery&access_token=test');
  f.event('PASSWORD_RECOVERY');
  f.initialize(null); await f.controller.initialized;
  assert.equal(f.controller.getSnapshot().session, session);
  assert.equal(f.controller.getSnapshot().error, false);
});
