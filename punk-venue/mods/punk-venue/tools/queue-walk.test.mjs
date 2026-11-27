import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  .replace(/^import [^\r\n]*$/gm, '')
  .replace(/^export default class /m, 'class ');

function element(asset) {
  const node = { asset, content: [] };
  return new Proxy(node, {
    get(target, key, self) {
      if (key in target) return target[key];
      if (key === 'child') return child => (target.content.push(child), self);
      if (key === 'children') return children => (target.content.push(...children), self);
      if (key === 'when') return (condition, apply) => condition ? apply(self) : self;
      return (...args) => ((target.props ??= {})[key] = args, self);
    },
  });
}

function* elements(node) {
  if (!node || typeof node !== 'object') return;
  yield node;
  for (const child of node.content) yield* elements(child);
}

function setup() {
  const branch = {
    id: 'scene', children: [{ id: 'node-map', content: { mod: 'punk-venue' } }],
  };
  const tree = { type: 'stack', active: branch.id, children: [branch, { id: 'other' }] };
  const reporting = [];
  let checking = true;
  const PunkVenue = runInNewContext(`${source}\nPunkVenue`, {
    View: class {},
    checking: () => checking,
    layout: () => tree,
    spaces: () => [{ id: 's', active: true, tabs: [] }],
    agents: () => reporting,
    terminals: () => [],
    setAgentOrder() {},
    theme: () => ({}),
    image: element,
    div: () => element(), h_flex: () => element(), v_flex: () => element(),
    ScrollHandle: { new: () => ({ scroll_to_item() {} }) },
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
    focus_handle: () => ({ is_focused: () => false }),
  };
  venue.init({}, cx);
  checking = false;
  venue.readStarted = true; // The existing feed is unrelated to the scene animation.
  return {
    render: () => Array.from(elements(venue.render(cx))),
    branch, tree, reporting, counts,
    sync: () => venue.syncQueueWalk(cx, true),
    tick: () => callback(cx),
    frame: () => venue.queueWalkFrame ?? (venue.queueWalkTick % 4),
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

function visibleFrames(nodes) {
  return Object.fromEntries(nodes.filter(node => node.props?.id?.[0].startsWith('entrance-person-')).map(node => {
    const visible = node.content.filter(layer => layer.props.opacity[0] === 1);
    assert.equal(visible.length, 1, 'exactly one frame is painted per person');
    return [node.props.id[0].slice('entrance-person-'.length), Number(visible[0].asset.match(/-(\d+)\.svg$/)[1])];
  }));
}

test('the shared entrance timer paints distinct phases and cadences and cycles the doorway', () => {
  const walk = setup();
  const cycles = [];
  for (let tick = 0; tick <= 160; tick++) {
    const frame = visibleFrames(walk.render());
    assert.deepEqual(Object.keys(frame).sort(), [
      'barrier-neighbor', 'doorway', 'left-drinker', 'left-punk', 'left-seated',
      'right-drinker', 'right-seated', 'walking-neighbor', 'walking-punk',
    ]);
    assert.equal(walk.counts.starts, 1, 'all nine people reuse one 100 ms timer');
    assert.equal(walk.counts.notifications, tick);
    assert.equal(walk.counts.cancels, 0);
    assert.equal(frame['walking-punk'], tick % 4, 'preserve the 10 fps punk walk');
    assert.notEqual(frame['left-drinker'], frame['right-drinker']);
    assert.notEqual(frame['left-seated'], frame['right-seated']);
    cycles.push(frame);
    if (tick < 160) walk.tick();
  }
  const doorway = cycles.map(frame => frame.doorway);
  assert.deepEqual(doorway.slice(0, 80).flatMap((frame, tick) =>
    tick === 0 || frame !== doorway[tick - 1] ? [[tick, frame]] : []),
  [[0, 0], [23, 1], [26, 2], [29, 3], [46, 2], [49, 1], [52, 0]]);
  assert.deepEqual(doorway.slice(80), doorway.slice(0, 81), 'the whole doorway cycle repeats every eight seconds');
  const gone = readFileSync(new URL('../art/queue-doorway-3.svg', import.meta.url), 'utf8');
  assert.doesNotMatch(gone, /<(?:path|rect|circle|use)\b/);
  const patterns = Object.keys(cycles[0]).map(id => cycles.slice(1).map((frame, index) => frame[id] !== cycles[index][id]).join(','));
  assert.equal(new Set(patterns).size, patterns.length, 'every person has a distinct change pattern');
  for (const id of ['left-drinker', 'right-drinker', 'left-seated', 'right-seated', 'barrier-neighbor']) {
    assert.deepEqual([...new Set(cycles.map(frame => frame[id]))].sort(), [0, 1, 2]);
  }
});

test('the crowd overlays use the full crop scale at their existing anchors without taking clicks', () => {
  const walk = setup();
  walk.reporting.push({ space: 's', address: 'a', status: 'working' });
  const nodes = walk.render();
  const strip = nodes.find(node => node.asset?.endsWith('/crowd-backplate.svg'));
  assert.ok(strip, 'the underlying strip omits the moving silhouettes');
  const [left] = strip.props.left;
  const [width] = strip.props.w;
  for (const [name, anchor, period] of [['punk', 206, 1120], ['neighbor', 243, 1730]]) {
    const { props } = nodes.find(node => node.asset?.endsWith(`/crowd-front-${name}.svg`));
    assert.equal(props.w[0], width / 8);
    assert.equal(props.h[0], width / 8);
    assert.equal(props.left[0] + props.w[0] / 2, left + width * anchor / 512);
    const [property, motion] = props.loop;
    assert.equal(property, 'top');
    assert.equal(motion.period, period);
    assert.ok(Math.abs(motion.to - motion.from) > width / 512);
    assert.equal(props.on_click, undefined);
    assert.equal(props.cursor_pointer, undefined);
  }
  assert.equal(walk.counts.starts, 0, 'a live stage does not start the entrance timer');
});
