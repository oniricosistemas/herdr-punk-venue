import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  .replace(/^import [^\r\n]*$/gm, '')
  .replace(/^export default class /m, 'class ');

function setup() {
  const branch = {
    id: 'scene', children: [{ id: 'node-map', content: { mod: 'punk-venue' } }],
  };
  const tree = { type: 'stack', active: branch.id, children: [branch, { id: 'other' }] };
  const reporting = [];
  const PunkVenue = runInNewContext(`${source}\nPunkVenue`, {
    View: class {},
    checking: () => false,
    layout: () => tree,
    spaces: () => [{ id: 's', active: true }],
    agents: () => reporting,
  }, { filename: 'main.js' });
  const venue = new PunkVenue();
  const counts = { starts: 0, cancels: 0, notifications: 0 };
  let callback;
  const cx = {
    timer: {
      every(ms, fn) {
        assert.equal(ms, 100, 'queue timer period in milliseconds');
        counts.starts++;
        callback = fn;
        return { cancel: () => { counts.cancels++; } };
      },
    },
    notify() { counts.notifications++; },
  };
  return {
    branch, tree, reporting, counts,
    sync: () => venue.syncQueueWalk(cx, true),
    tick: () => callback(cx),
    frame: () => venue.queueWalkFrame,
  };
}

test('the entrance queue advances on one timer only while the scene is drawn', () => {
  const walk = setup();
  for (const [i, frame] of [1, 2, 3, 0].entries()) {
    walk.sync();
    assert.equal(walk.counts.starts, 1, `render ${i + 1}: reuse the timer`);
    assert.equal(walk.counts.notifications, i, `render ${i + 1}: do not notify`);
    walk.tick();
    assert.equal(walk.frame(), frame, `tick ${i + 1}: advance in cycle order`);
    assert.equal(walk.counts.notifications, i + 1, `tick ${i + 1}: notify once`);
  }
  assert.equal(walk.counts.cancels, 0, 'the timer stays live while painting');

  for (const [reason, change] of [
    ['missing block', ({ branch }) => { branch.children = []; }],
    ['hidden ancestor', ({ branch }) => { branch.hidden = true; }],
    ['inactive stack branch', ({ tree }) => { tree.active = 'other'; }],
    ['reporting agent in the active space', ({ reporting }) => { reporting.push({ space: 's' }); }],
  ]) {
    const walk = setup();
    walk.sync();
    walk.tick();
    assert.equal(walk.frame(), 1, `${reason}: start from an advanced frame`);
    // Renew the lease so the next tick must check live inputs to stop.
    walk.sync();
    change(walk);
    walk.tick();
    assert.equal(walk.frame(), 1, `${reason}: do not advance`);
    assert.equal(walk.counts.notifications, 1, `${reason}: do not notify again`);
    assert.equal(walk.counts.cancels, 1, `${reason}: cancel exactly once`);
  }

  const lease = setup();
  lease.sync();
  lease.tick();
  assert.equal(lease.frame(), 1, 'the last paint grants one tick');
  assert.equal(lease.counts.notifications, 1, 'notify for the granted tick');
  assert.equal(lease.counts.cancels, 0, 'the granted tick leaves the timer running');
  lease.tick();
  assert.equal(lease.frame(), 1, 'without another paint, do not advance');
  assert.equal(lease.counts.notifications, 1, 'without another paint, do not notify again');
  assert.equal(lease.counts.cancels, 1, 'cancel exactly once when the lease expires');
});
