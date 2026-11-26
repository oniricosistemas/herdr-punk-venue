import { View, div, image } from "gpui-kit";
import { h_flex, v_flex, ScrollHandle } from "gpui-base";
import { spaces, agents, terminals, theme, run, nextCommand, checking, setAgentOrder, exec, home, watchFolder, layout } from "herdr";

const PAGE = 12;
const LANES = ["Cartelera", "Escena", "Banda"];
const LANE_WEIGHTS = [2, 5, 2];
const LANE_TOTAL = LANE_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
const ROOT_PADDING = 6;
const ROOT_BORDER_WIDTH = 1;
const LANE_ROW_GAP = 6;
const PARTS = ["guitar", "bass", "drums", "singer", "guitar2", "keys", "sax"];
const EMPTY = ["guitar", "bass", "drums", "mic", "guitar", "keys", "sax"];
// Stage variants are chosen per space, never per render, so a gig never changes venue.
const STAGES = ["club", "galpon", "plaza", "salon"];
const stageOf = id => {
  let hash = 2166136261;
  for (const ch of String(id ?? "")) {
    hash ^= ch.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return STAGES[(hash >>> 0) % STAGES.length];
};
const stateText = status => status ?? "no reporting agents";
const art = name => image(`mods/punk-venue/art/${name}.svg`);
const STEP_PERIOD = 800;
const IDLE_PERIOD = 1800;
const WALK_TICK = 100;
// A pose's hold and a person's phase are measured in 100 ms ticks. The shared
// drinker/seated pairs use staggered holds so they never show the same pose.
const queuePerson = (id, asset, holds, phase = 0, position, sequence = holds.map((_hold, i) => i)) => ({
  id, asset, phase, position, holds, sequence,
  period: holds.reduce((sum, hold) => sum + hold, 0),
  frames: [...new Set(sequence)],
});
const ENTRANCE_PEOPLE = [
  queuePerson("doorway", "queue-doorway", [23, 3, 3, 17, 3, 3, 28], 0, null, [0, 1, 2, 3, 2, 1, 0]),
  queuePerson("left-drinker", "queue-drinker", [4, 4, 4], 0, [9, 28]),
  queuePerson("left-punk", "queue-punk", [2, 2, 2, 2], 3, [38, 29]),
  queuePerson("walking-punk", "queue-walk-punk", [1, 1, 1, 1]),
  queuePerson("barrier-neighbor", "queue-neighbor", [3, 3, 3], 4, [169, 32]),
  queuePerson("right-drinker", "queue-drinker", [3, 4, 5], 5, [193, 33]),
  queuePerson("walking-neighbor", "queue-walk-neighbor", [1, 1, 2, 1], 1),
  queuePerson("left-seated", "queue-seated", [6, 6, 6], 0, [6, 37]),
  queuePerson("right-seated", "queue-seated", [5, 6, 7], 8, [42, 37]),
];
const entranceFrames = tick => ENTRANCE_PEOPLE.map(({ holds, period, phase, sequence }) => {
  let elapsed = (tick + phase) % period;
  const pose = holds.findIndex(hold => {
    if (elapsed < hold) return true;
    elapsed -= hold;
    return false;
  });
  return sequence[pose];
});
// As in World of Codecraft's place.hidden(), use the shown Herdr layout;
// an absent block, hidden ancestor or inactive stack child isn't drawn.
const venueVisible = node => {
  if (!node || node.hidden) return false;
  if (node.id === "node-map") return node.content?.mod === "punk-venue";
  return node.children?.some(child => (node.type !== "stack" || child.id === node.active) && venueVisible(child)) ?? false;
};
// As in Fellowship, crossing past 0..1 makes the linear opacity swap crisp.
const SWAP_LOW = -6;
const SWAP_HIGH = 7;

// Only the fields the marquee shows. No prompts, results or conversation content.
const FEED_SCRIPT = `
const fs=require("fs"),path=require("path"),os=require("os");
const dirs=[path.join(os.homedir(),".gentle-shell","agent"),path.join(os.homedir(),".pi","agent")];
const out=[];
for(const d of dirs){const s=path.join(d,"desktop","sessions");let ns=[];try{ns=fs.readdirSync(s).filter(n=>n.endsWith(".json"));}catch{continue;}
for(const n of ns){let j;try{j=JSON.parse(fs.readFileSync(path.join(s,n),"utf8"));}catch{continue;}
const a=j.activity||{};out.push({u:j.updatedAt??0,state:a.state??null,phase:a.phase??null});}}
process.stdout.write(JSON.stringify(out));
`;
const PHASES = ["authorizing", "exploring", "researching", "deciding", "planning", "implementing", "checking", "closing"];

export default class PunkVenue extends View {
  init(_props, cx) {
    this.cx = cx;
    this.handle = cx.focus_handle();
    this.scroll = LANES.map(() => ScrollHandle.new());
    this.selected = [null, null, null];
    this.active = [null, null, null];
    this.reveal = [null, null, null];
    this.stage = 0;
    this.size = { width: 900, height: 300 };
    this.formations = new Map();
    this.phase = null;
    this.feedState = null;
    this.feedError = null;
    this.reading = false;
    if (checking()) return;
    this.readFeed(cx);
    cx.spawn(async cx => {
      const dir = `${home()}/.gentle-shell/agent/desktop/sessions`;
      for (;;) {
        try {
          await watchFolder(dir);
          this.readFeed(cx);
        } catch {
          return;
        }
      }
    });
    cx.spawn(async cx => {
      for (;;) {
        if (await nextCommand() === "focus") { this.handle.focus(); cx.notify(); }
      }
    });
  }

  // One process per folder event, never per render. Newest live snapshot wins, because
  // this Herdr build reports no pane id to attribute a feed to a specific space.
  async readFeed(cx) {
    if (this.reading) return;
    this.reading = true;
    try {
      const result = await exec("node", ["-e", FEED_SCRIPT], { timeout: 8000 });
      const feeds = JSON.parse(String(result?.stdout ?? "[]").trim() || "[]");
      const newest = feeds.sort((a, b) => (b.u ?? 0) - (a.u ?? 0))[0] ?? null;
      this.phase = newest && PHASES.includes(newest.phase) ? newest.phase : null;
      this.feedState = newest?.state ?? null;
      this.feedError = null;
    } catch (e) {
      this.phase = null;
      this.feedState = null;
      this.feedError = String(e?.message ?? e).slice(0, 80);
    } finally {
      this.reading = false;
    }
    cx.notify();
  }

  // One address owns one instrument until it stops reporting in this space.
  // Free slots form a FIFO: removing a member never compacts the formation.
  formation(spaceId, members) {
    let formation = this.formations.get(spaceId);
    if (!formation) {
      formation = { assigned: new Map(), free: PARTS.map((_p, i) => i) };
      this.formations.set(spaceId, formation);
    }
    const present = new Set(members.map(a => a.address));
    for (const [address, slot] of formation.assigned) {
      if (!present.has(address)) {
        formation.assigned.delete(address);
        if (slot !== null) formation.free.push(slot);
      }
    }
    for (const agent of members) {
      if (!formation.assigned.has(agent.address)) formation.assigned.set(agent.address, null);
    }
    // Map insertion order keeps overflow members waiting in arrival order.
    for (const [address, slot] of formation.assigned) {
      if (slot === null && formation.free.length) formation.assigned.set(address, formation.free.shift());
    }
    const slots = PARTS.map(() => null);
    const overflow = [];
    const byAddress = new Map(members.map(a => [a.address, a]));
    for (const [address, slot] of formation.assigned) {
      if (slot === null) overflow.push(byAddress.get(address));
      else slots[slot] = byAddress.get(address);
    }
    return { slots, overflow };
  }

  snapshot() {
    const allSpaces = spaces(), allAgents = agents();
    const formations = new Map();
    for (const s of allSpaces) formations.set(s.id, this.formation(s.id, allAgents.filter(a => a.space === s.id)));
    for (const id of this.formations.keys()) if (!formations.has(id)) this.formations.delete(id);
    const space = allSpaces.find(s => s.active);
    const tab = space?.tabs.find(t => t.active);
    const band = formations.get(space?.id) ?? { slots: PARTS.map(() => null), overflow: [] };
    const members = [...band.slots.filter(Boolean), ...band.overflow];
    setAgentOrder(members.map(a => a.address));
    // Only core terminals that herdr-core recorded as started by a member. Internal
    // subagents without a terminal never appear here, so this is never guessed.
    const coreTerminals = terminals();
    const guests = members.flatMap(a => coreTerminals.filter(t => t.parent === a.address && t.state === "live"));
    const memberRow = (a, slot) => ({ key: `agent:${a.address}`, name: a.title || a.program?.name || a.app || a.address,
      context: `${slot} / ${a.tab_name} / ${a.address}`, status: a.status, active: a.focused,
      command: "agent.focus", args: { terminal: a.address } });
    const groups = [
      allSpaces.map(s => ({ key: `space:${s.id}`, name: s.name, context: `${s.machine ?? "local"} / ${s.tabs.length} tabs`,
        status: s.status, active: s.active, command: "space.select", args: { id: s.id } })),
      (space?.tabs ?? []).map(t => ({ key: `tab:${t.id}`, name: `${t.index}. ${t.name}${t.settled ? " [settled]" : ""}`,
        context: space.name, status: t.status, active: t.active, command: "tab.select", args: { id: t.id } })),
      [...band.slots.flatMap((a, i) => a ? [memberRow(a, PARTS[i])] : []), ...band.overflow.map(a => memberRow(a, "overflow"))]
    ];
    groups.forEach((rows, i) => {
      const activeIndex = rows.findIndex(r => r.active);
      const activeKey = rows[activeIndex]?.key ?? null;
      if (activeKey !== this.active[i]) {
        this.active[i] = activeKey;
        if (activeKey) { this.selected[i] = activeKey; this.reveal[i] = activeIndex; }
      }
      if (!rows.some(r => r.key === this.selected[i])) {
        const at = activeIndex >= 0 ? activeIndex : rows.length ? 0 : -1;
        this.selected[i] = rows[at]?.key ?? null;
        this.reveal[i] = at >= 0 ? at : null;
      }
    });
    return { groups, space, tab, band, members, guests };
  }

  activate(stage, row, cx) {
    if (!row) return;
    this.stage = stage;
    this.selected[stage] = row.key;
    run(row.command, row.args);
    cx.notify();
  }

  moveItem(stage, delta, groups, cx) {
    const rows = groups[stage];
    if (!rows.length) return;
    const at = Math.max(0, rows.findIndex(r => r.key === this.selected[stage]));
    const next = (at + delta + rows.length) % rows.length;
    this.reveal[stage] = next;
    this.activate(stage, rows[next], cx);
  }

  key(e, cx, groups) {
    const rows = groups[this.stage];
    const at = Math.max(0, rows.findIndex(r => r.key === this.selected[this.stage]));
    const key = e.keystroke;
    if (key === "enter" || key === "space") this.activate(this.stage, rows[at], cx);
    else if (key === "escape") run("pane.go", { direction: "down" });
    else if (key === "m" || key === "shift-m") run("layout.switch", { name: "main" });
    else if (key === "left" || key === "right") this.stage = Math.max(0, Math.min(2, this.stage + (key === "left" ? -1 : 1)));
    else if (["up", "down", "home", "end", "pageup", "pagedown"].includes(key)) {
      let next = key === "home" ? 0 : key === "end" ? rows.length - 1
        : key === "pageup" || key === "pagedown" ? (Math.floor(at / PAGE) + (key === "pageup" ? -1 : 1)) * PAGE
        : at + (key === "up" ? -1 : 1);
      next = Math.max(0, Math.min(rows.length - 1, next));
      this.selected[this.stage] = rows[next]?.key ?? null;
      this.reveal[this.stage] = rows.length ? next : null;
    } else return;
    cx.stop_propagation();
    cx.notify();
  }

  stopQueueWalk() {
    this.queueWalkTimer?.cancel();
    this.queueWalkTimer = null;
    this.queueWalkRendered = false;
  }

  syncQueueWalk(cx, drawEntrance) {
    if (!drawEntrance || checking() || !venueVisible(layout())) {
      this.stopQueueWalk();
      return;
    }
    // A render renews one tick. If drawing stops without the layout changing,
    // don't keep the timer alive on the strength of its own notifications.
    this.queueWalkRendered = true;
    if (this.queueWalkTimer) return;
    this.queueWalkTimer = cx.timer.every(WALK_TICK, cx => {
      if (!this.queueWalkRendered || !venueVisible(layout())) {
        this.stopQueueWalk();
        return;
      }
      // Herdr may switch spaces/agents between renders. Recheck the live inputs
      // without rebuilding the snapshot or running its list side effects.
      const active = spaces().find(space => space.active);
      if (active && agents().some(agent => agent.space === active.id)) {
        this.stopQueueWalk();
        return;
      }
      this.queueWalkRendered = false;
      const previous = this.queueWalkFrames ?? entranceFrames(0);
      this.queueWalkTick = (this.queueWalkTick ?? 0) + 1;
      this.queueWalkFrames = entranceFrames(this.queueWalkTick);
      if (this.queueWalkFrames.some((frame, i) => frame !== previous[i])) cx.notify();
    });
  }

  render(cx) {
    // Reads start from the first render, so a reused mod instance still picks up the feed.
    if (!this.readStarted && !this.reading && !checking()) {
      this.readStarted = true;
      if (this.cx) this.readFeed(this.cx);
    }
    const t = theme(), { groups, space, tab, band, members, guests } = this.snapshot();
    this.reveal.forEach((at, i) => {
      if (at !== null) {
        let child = at % PAGE;
        if (i === 2 && at < PAGE) {
          const address = groups[2][at]?.args.terminal;
          const slot = band.slots.findIndex(a => a?.address === address);
          const slotCount = Math.max(4, band.slots.reduce((n, a, index) => a ? index + 1 : n, 0));
          child = slot >= 0 ? slot : slotCount + 1 + band.overflow.findIndex(a => a.address === address);
        } else if (i === 2 && band.overflow.length) child += 1;
        this.scroll[i].scroll_to_item(child);
        this.reveal[i] = null;
      }
    });
    const bodyHeight = Math.max(0, this.size.height - 110);
    const rowInsets = 2 * (ROOT_PADDING + ROOT_BORDER_WIDTH) + (LANES.length - 1) * LANE_ROW_GAP;
    const sceneWidth = Math.max(0, this.size.width - rowInsets) * LANE_WEIGHTS[1] / LANE_TOTAL;
    // Scene art is a 4:1 strip, so the box follows that aspect instead of stretching it.
    const sceneHeight = Math.max(72, Math.min(Math.floor(sceneWidth / 4), Math.floor(bodyHeight * 0.9)));
    const figure = Math.max(0, Math.min(sceneWidth / 8, sceneHeight * 0.52));
    // image() fits by aspect ratio, so the art rect is what everything aligns to.
    const artWidth = Math.max(0, Math.min(sceneWidth, Math.round(sceneHeight * 4)));
    const artHeight = Math.round(artWidth / 4);
    const artLeft = Math.max(0, Math.round((sceneWidth - artWidth) / 2));
    const button = (id, label, action) => div().id(id).px(6).py(2).rounded(3).flex_none().border(1).border_color(t.border)
      .bg(t.chrome).text_color(t.accent).cursor_pointer().hover(s => s.bg(t.hover)).on_click(action).child(label);
    const rowCard = (r, stage, poster = false) => v_flex().id(r.key).flex_none().min_w(0).h(56).px(7).py(4).gap(2)
      .bg(r.active ? t.selected : t.surface).border(poster ? 2 : 1)
      .border_color(this.handle.is_focused() && this.stage === stage && this.selected[stage] === r.key ? t.accent : r.active ? t.ansi5 : t.border)
      .rounded(3).cursor_pointer().hover(s => s.bg(t.hover)).tooltip(`${r.name}\n${r.context}\n${stateText(r.status)}`)
      .on_click((_e, cx) => this.activate(stage, r, cx))
      .child(div().truncate().font_semibold().child(`${r.active ? "◆ " : ""}${r.name}`))
      .child(div().truncate().text_size(10).text_color(t.muted).child(r.context))
      .child(div().truncate().text_size(10).text_color(t[r.status] ?? t.muted).child(stateText(r.status)));
    const list = (stage, height) => {
      const rows = groups[stage];
      const at = Math.max(0, rows.findIndex(r => r.key === this.selected[stage]));
      const page = Math.floor(at / PAGE);
      return v_flex().id(`list-${stage}`).h(height).flex_none().min_w(0).gap(4).overflow_y_scrollbar().track_scroll(this.scroll[stage])
        .when(stage === 0, el => el.child(div().h(12).flex_none().text_size(9).text_color(t.accent).child("FECHAS · PUNK VENUE")))
        .children(rows.slice(page * PAGE, (page + 1) * PAGE).map(r => rowCard(r, stage, stage === 0)))
        .when(!rows.length, el => el.child(div().p(5).text_color(t.muted).child(stage === 0 ? "No spaces" : "No tabs")));
    };
    const figureTop = Math.round(sceneHeight * 0.34);
    const figureLeft = i => Math.round(artLeft + (i + 0.5) * artWidth / 7 - figure / 2);
    const stageFigures = () => {
      // Every position is always drawn, so the formation spans the stage instead of bunching
      // into the left third when few agents report, and no figure shifts when a member joins.
      const children = band.slots.map((a, i) => {
        const part = PARTS[i];
        const period = a?.status === "working" ? STEP_PERIOD : a?.status === "idle" ? IDLE_PERIOD : null;
        const still = art(a ? `${part}-${a.status}` : `empty-${EMPTY[i]}`).w(figure).h(figure);
        return div().id(`figure-${part}`).absolute().left(figureLeft(i)).top(figureTop).w(figure).h(figure + 3)
          .child(div().id(`motion-${part}`).relative().top(0).w(figure).h(figure)
            .child(period === null ? still : still.loop("opacity", { from: SWAP_HIGH, to: SWAP_LOW, period, easing: "linear" }))
            .when(period !== null, el => el.child(art(`${part}-strike`).absolute().top(0).left(0).w(figure).h(figure)
              .loop("opacity", { from: SWAP_LOW, to: SWAP_HIGH, period, easing: "linear" }))))
          .when(a, el => el.cursor_pointer().tooltip(`${a.address} / ${a.status}`).on_click((_e, cx) => this.activate(2, groups[2].find(r => r.key === `agent:${a.address}`), cx)));
      });
      const unit = figure / 64;
      const size = figure * 0.28;
      const left = figureLeft(0) + 39 * unit;
      // Stage backdrops mark the floor at y=54; the wedge stands just inside it.
      const monitorFeetY = Math.round(artWidth / 4) * 55 / 64;
      const top = monitorFeetY - size;
      // Test the solid wedge face against painted boots, not the transparent sprite boxes.
      // Both poses of every occupied slot share the same two boot rectangles.
      const figureFeetY = figureTop + 61 * unit;
      const overlaps = size > 0 && top + size * 24 / 64 < figureFeetY
        && monitorFeetY > figureTop + 57 * unit
        && band.slots.some((a, i) => a && [19, 35].some(x => {
          const bootLeft = figureLeft(i) + x * unit;
          return left < bootLeft + 10 * unit && bootLeft < left + size;
        }));
      // The shared boot baseline puts all figures on one side of the wedge. On a
      // tie the wedge paints last, like a monitor at the front edge of the stage.
      if (overlaps) children.splice(figureFeetY > monitorFeetY ? 0 : children.length, 0,
        art("monitor-riser").absolute().left(left).top(top).w(size).h(size));
      return children;
    };
    const crowdCutouts = () => {
      const unit = artWidth / 512;
      if (unit <= 0) return [];
      // Each square uses 64 native crowd units and starts three units below
      // the strip's top. Lower bodies continue past its hem and are clipped
      // by the scene, so the bob doesn't uncover the bottom of a cutout.
      const size = 64 * unit;
      const top = sceneHeight - 61 * unit;
      return ["punk", "neighbor"].map((name, i) => {
        const from = top - (i ? 0.5 : 2) * unit;
        const to = top - (i ? 3 : 0.5) * unit;
        return art(`crowd-front-${name}`).absolute()
          .left(artLeft + artWidth * (i ? 243 : 206) / 512 - size / 2).top(from).w(size).h(size)
          .loop("top", { from, to, period: i ? 1730 : 1120 });
      });
    };
    const washX = x => artLeft + artWidth * x / 256;
    const washY = y => artHeight * y / 64;
    // The gaps between side placards and the cloth are clear in all four backdrops:
    // x=56..78 and 178..200, past the bunting at y=17. Stay below the marquee
    // even when the artwork shrinks, and above the entire band/guest area.
    const washTop = Math.max(22, washY(18));
    const washHeight = Math.max(0, Math.min(washY(4), figureTop - 1 - washTop));
    const washSides = [56, 178];
    const entrance = !members.length;
    this.syncQueueWalk(cx, entrance && artWidth > 0 && artHeight > 0);
    const entranceLayer = name => art(name).absolute().left(artLeft).top(0).w(artWidth).h(artHeight);
    const entrancePeople = () => {
      const frames = this.queueWalkFrames ?? entranceFrames(0);
      const unit = artWidth / 256;
      return ENTRANCE_PEOPLE.map(({ id, asset, position, frames: poses }, index) => {
        const [x, y] = position ?? [0, 0];
        const left = position ? artLeft + (x - 4) * unit : artLeft;
        const top = position ? (y - 10) * unit : 0;
        const width = position ? 64 * unit : artWidth;
        const height = position ? 64 * unit : artHeight;
        // Stack the frames for preloading; only the selected pose is visible.
        return div().id(`entrance-person-${id}`).absolute().left(left).top(top).w(width).h(height)
          .children(poses.map(pose =>
            art(`${asset}-${pose}`).absolute().left(0).top(0).w(width).h(height).opacity(pose === frames[index] ? 1 : 0)));
      });
    };
    // Fixed scene box: entrance and stage share geometry. Working and idle figures
    // swap poses in place; GPUI loops run only while their elements are drawn.
    const scene = div().id("venue-scene").relative().w_full().h(sceneHeight).flex_none().overflow_hidden().bg(t.canvas)
      .when(entrance, el => el.child(entranceLayer("entrance"))
        .children(entrancePeople()).child(entranceLayer("entrance-foreground")))
      .when(members.length, el => el
        .child(art(`backdrop-${stageOf(space?.id)}`).absolute().left(artLeft).top(0).w(artWidth).h(artHeight))
        .children([0, 1].map(i => div().id(`light-${i}`).absolute().left(artLeft + (i ? artWidth * 0.85 : artWidth * 0.08)).top(4).w(7).h(7).rounded_full()
          .bg(t.accent).loop("opacity", { from: 0.35, to: 1, period: 1600 + i * 200 })))
        // Passive paint only, clipped by the scene and drawn behind the figures.
        .when(washHeight > 0, stage => stage
          .children(washSides.map((x, i) => div().id(`light-pool-${i}`).absolute()
            .left(washX(x + 2)).top(washTop + washHeight * 0.25)
            .w(artWidth * 14 / 256).h(washHeight * 0.65).rounded_full().bg(t.accent)
            .loop("opacity", { from: 0.05, to: 0.16, period: 1600 + i * 200 })))
          .children(washSides.map((x, i) => {
            const from = washX(x + (i ? 10 : 1));
            const to = washX(x + (i ? 1 : 10));
            const top = washTop + washHeight * 0.5;
            const period = i ? 9700 : 7300;
            return div().id(`haze-puff-${i}`).absolute().left(from).top(top)
              .w(artWidth * 11 / 256).h(washHeight * 0.33).rounded_full().bg(t.accent)
              .loop("left", { from, to, period })
              .loop("top", { from: top, to: washTop + washHeight * 0.1, period })
              .loop("opacity", { from: 0.03, to: 0.09, period });
          })))
        .children(stageFigures())
        .when(band.overflow.length, el => el.child(div().absolute().right(3).top(3).px(4).bg(t.chrome).text_color(t.accent).child(`+${band.overflow.length}`)))
        .when(guests.length, el => el
          .child(div().absolute().left(artLeft + 5).top(3).px(4).bg(t.chrome).text_color(t.muted).text_size(9)
            .tooltip("Terminales lanzados por un agente de este space")
            .child(`${guests.length} invitados`))
          .children(guests.slice(0, 3).map((g, i) => {
            const size = Math.max(10, Math.round(figure * 0.62));
            const pose = g.status === "working" ? "working" : "idle";
            return div().id(`guest-${g.address}`).absolute()
              .left(Math.round(artLeft + 6 + i * (size + 2))).top(Math.round(sceneHeight - size - 8))
              .w(size).h(size).cursor_pointer()
              .tooltip(`invitado / ${g.title || g.name || g.address} / ${g.status ?? "no reporta"}`)
              .on_click(() => run("terminal.peek", { terminal: g.address }))
              .child(art(`${["guitar2", "keys", "sax"][i]}-${pose}`).w(size).h(size));
          })))
        .child(art("crowd-backplate").absolute().left(artLeft).bottom(0).w(artWidth).h(Math.max(8, Math.round(artWidth / 8))))
        .children(crowdCutouts()));
    const marquee = () => {
      const label = String(this.phase ?? this.feedState).toUpperCase();
      // The phase can outlive the work; use live status from the current space.
      const working = members.some(a => a.status === "working");
      const text = div().truncate().text_size(9).text_color(t.accent);
      return div().id("phase-marquee").absolute()
        .left(artLeft + 4).top(2).w(108).px(4).py(2).rounded(2)
        .bg(t.chrome).border(1).border_color(t.accent)
        .tooltip(`Gentle Shell · phase=${this.phase ?? "-"} · state=${this.feedState ?? "-"}${this.feedError ? ` · ${this.feedError}` : ""} (sesión más reciente; sin atribución por space)`)
        .child(working ? text.frames([label, `${label}.`, `${label}..`, `${label}...`], 420) : text.child(label));
    };
    // A sibling of the scene, painted after it, so stage art never covers the sign.
    const sceneBlock = div().relative().w_full().h(sceneHeight).flex_none()
      .child(scene)
      .when(this.phase || this.feedState, el => el.child(marquee()));
    const bandList = () => {
      const rows = groups[2], at = Math.max(0, rows.findIndex(r => r.key === this.selected[2]));
      const page = Math.floor(at / PAGE);
      return v_flex().id("list-2").h(bodyHeight).flex_none().min_w(0).gap(4).overflow_y_scrollbar().track_scroll(this.scroll[2])
        .children(page === 0 ? band.slots.slice(0, Math.max(4, band.slots.reduce((n, a, i) => a ? i + 1 : n, 0))).map((a, i) => a
          ? rowCard(rows.find(r => r.key === `agent:${a.address}`), 2)
          : h_flex().id(`empty-${i}`).h(40).flex_none().gap(4).items_center().text_color(t.muted)
            .child(art(`empty-${EMPTY[i]}`).w(32).h(32)).child(`${PARTS[i]} / empty`)) : [])
        .when(band.overflow.length, el => el.child(div().text_color(t.muted).child(`+${band.overflow.length} overflow / off stage`)))
        .children(rows.slice(page * PAGE, (page + 1) * PAGE).filter(r => !band.slots.some(a => a && r.key === `agent:${a.address}`)).map(r => rowCard(r, 2)));
    };
    const lane = stage => {
      const rows = groups[stage], at = rows.findIndex(r => r.key === this.selected[stage]);
      return v_flex().id(`lane-${stage}`).flex_1().flex_grow(LANE_WEIGHTS[stage]).min_w(0).min_h(0).gap(4)
        .child(button(`lane-title-${stage}`, LANES[stage], (_e, cx) => { this.stage = stage; cx.notify(); }).border_color(this.stage === stage ? t.accent : t.border))
        .when(stage === 0, el => el.child(list(0, bodyHeight)))
        .when(stage === 1, el => el.child(v_flex().h(bodyHeight).flex_none().min_w(0)
          .child(sceneBlock).child(div().h(18).flex_none().truncate().text_size(10).text_color(t.muted)
            .child(`${space?.name ?? "No active space"} / ${tab?.name ?? "No active tab"}`))
          .child(list(1, Math.max(0, bodyHeight - sceneHeight - 18)))))
        .when(stage === 2, el => el.child(bandList()))
        .child(h_flex().h(22).flex_none().gap(5).items_center()
          .child(button(`prev-${stage}`, "‹", (_e, cx) => this.moveItem(stage, -1, groups, cx)))
          .child(div().text_size(10).text_color(t.muted).child(`${at >= 0 ? at + 1 : 0}/${rows.length}`))
          .child(button(`next-${stage}`, "›", (_e, cx) => this.moveItem(stage, 1, groups, cx))));
    };
    return v_flex().id("punk-venue-root").size_full().min_w(0).min_h(0).overflow_hidden().p(ROOT_PADDING).gap(4).text_size(11).text_color(t.foreground)
      .track_focus(this.handle).border(ROOT_BORDER_WIDTH).border_color(this.handle.is_focused() ? t.accent : t.border)
      .on_size_change((size, cx) => { if (size.width !== this.size.width || size.height !== this.size.height) { this.size = size; cx.notify(); } })
      .on_mouse_down("left", (_e, cx) => { this.handle.focus(); cx.notify(); })
      .on_key_down((e, cx) => this.key(e, cx, groups))
      .child(h_flex().h(22).flex_none().gap(6).items_center().child(div().flex_1().truncate().font_semibold().child("PUNK VENUE"))
        .child(button("return-main", "Herdr / main [M]", () => run("layout.switch", { name: "main" }))))
      .child(h_flex().flex_1().min_h(0).min_w(0).gap(LANE_ROW_GAP).children(LANES.map((_label, i) => lane(i))))
      .child(div().h(12).flex_none().truncate().text_size(9).text_color(t.muted)
        .tooltip("←/→ lane; ↑/↓ candidate; Home/End; PageUp/PageDown; Enter/Space select/focus; ‹/› circular select; Escape: pane.go down; M: main. Scene follows Herdr's active space, not an unopened keyboard candidate. Banda includes every reporting agent in that space.")
        .child("←→ lane · ↑↓ candidate · Home/End · PgUp/PgDn · Enter/Space open · Esc terminal · M main"));
  }
}
