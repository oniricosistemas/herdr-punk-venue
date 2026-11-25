import { View, div, image } from "gpui-kit";
import { h_flex, v_flex, ScrollHandle } from "gpui-base";
import { spaces, agents, terminals, theme, run, nextCommand, checking, setAgentOrder, exec, home, watchFolder } from "herdr";

const PAGE = 12;
const LANES = ["Cartelera", "Escena", "Banda"];
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

  render() {
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
    // Lane shares, Cartelera / Escena / Banda. Escena carries the stage, so it takes
    // most of the row while the two list panes stay readable.
    const LANE_WEIGHTS = [2, 5, 2];
    const LANE_TOTAL = LANE_WEIGHTS.reduce((sum, w) => sum + w, 0);
    const sceneWidth = Math.max(0, ((this.size.width - 48) * LANE_WEIGHTS[1]) / LANE_TOTAL);
    // Scene art is a 4:1 strip, so the box follows that aspect instead of stretching it.
    const sceneHeight = Math.max(72, Math.min(Math.floor(sceneWidth / 4), Math.floor(bodyHeight * 0.9)));
    const figure = Math.max(0, Math.min(sceneWidth / 8, sceneHeight * 0.52));
    // image() fits by aspect ratio, so the art rect is what everything aligns to.
    const artWidth = Math.max(0, Math.min(sceneWidth, Math.round(sceneHeight * 4)));
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
      const children = band.slots.slice(0, Math.max(4, band.slots.reduce((n, a, i) => a ? i + 1 : n, 0))).map((a, i) => {
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
      // Keep both sweeps below the figure boxes and inside the static strip.
      const clearance = Math.min(sceneHeight - (figureTop + figure + 3), Math.round(artWidth / 8));
      const size = clearance * 0.7;
      if (size <= 0) return [];
      const bob = Math.min(5, size / 6);
      const top = sceneHeight - size - bob;
      return ["punk", "neighbor"].map((name, i) => {
        const offset = Math.sin((i - 0.5) * Math.PI) * bob;
        const from = top + offset / 3;
        const to = top + offset;
        return art(`crowd-front-${name}`).absolute()
          .left(artLeft + artWidth * (i ? 243 : 206) / 512 - size / 2).top(from).w(size).h(size)
          .loop("top", { from, to, period: i ? 1730 : 1120 });
      });
    };
    // Fixed scene box: entrance and stage share geometry. Working and idle figures
    // swap poses in place; GPUI loops run only while their elements are drawn.
    const scene = div().id("venue-scene").relative().w_full().h(sceneHeight).flex_none().overflow_hidden().bg(t.canvas)
      .when(!members.length, el => el.child(art("entrance").absolute().left(artLeft).top(0).w(artWidth).h(Math.round(artWidth / 4))))
      .when(members.length, el => el
        .child(art(`backdrop-${stageOf(space?.id)}`).absolute().left(artLeft).top(0).w(artWidth).h(Math.round(artWidth / 4)))
        .children([0, 1].map(i => div().id(`light-${i}`).absolute().left(artLeft + (i ? artWidth * 0.85 : artWidth * 0.08)).top(4).w(7).h(7).rounded_full()
          .bg(t.accent).loop("opacity", { from: 0.35, to: 1, period: 1600 + i * 200 })))
        // Decorative only: two washes and two puffs, clipped by the scene and behind the figures.
        .when(artWidth > 0, stage => stage
          .children([0, 1].map(i => div().id(`light-pool-${i}`).absolute()
            .left(artLeft + artWidth * (i ? 0.73 : 0.01)).top(sceneHeight * 0.56)
            .w(artWidth * 0.26).h(sceneHeight * 0.4).rounded_full().bg(t.accent)
            .loop("opacity", { from: 0.05, to: 0.16, period: 1600 + i * 200 })))
          .children([0, 1].map(i => {
            const from = artLeft + artWidth * (i ? 0.66 : 0.05);
            const to = artLeft + artWidth * (i ? 0.05 : 0.66);
            const top = sceneHeight * (i ? 0.84 : 0.7);
            const period = i ? 9700 : 7300;
            return div().id(`haze-puff-${i}`).absolute().left(from).top(top)
              .w(artWidth * 0.3).h(sceneHeight * 0.07).rounded_full().bg(t.accent)
              .loop("left", { from, to, period })
              .loop("top", { from: top, to: top - sceneHeight * 0.05, period })
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
        .child(art("crowd").absolute().left(artLeft).bottom(0).w(artWidth).h(Math.max(8, Math.round(artWidth / 8))))
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
    return v_flex().id("punk-venue-root").size_full().min_w(0).min_h(0).overflow_hidden().p(6).gap(4).text_size(11).text_color(t.foreground)
      .track_focus(this.handle).border(1).border_color(this.handle.is_focused() ? t.accent : t.border)
      .on_size_change((size, cx) => { if (size.width !== this.size.width || size.height !== this.size.height) { this.size = size; cx.notify(); } })
      .on_mouse_down("left", (_e, cx) => { this.handle.focus(); cx.notify(); })
      .on_key_down((e, cx) => this.key(e, cx, groups))
      .child(h_flex().h(22).flex_none().gap(6).items_center().child(div().flex_1().truncate().font_semibold().child("PUNK VENUE"))
        .child(button("return-main", "Herdr / main [M]", () => run("layout.switch", { name: "main" }))))
      .child(h_flex().flex_1().min_h(0).min_w(0).gap(6).children(LANES.map((_label, i) => lane(i))))
      .child(div().h(12).flex_none().truncate().text_size(9).text_color(t.muted)
        .tooltip("←/→ lane; ↑/↓ candidate; Home/End; PageUp/PageDown; Enter/Space select/focus; ‹/› circular select; Escape: pane.go down; M: main. Scene follows Herdr's active space, not an unopened keyboard candidate. Banda includes every reporting agent in that space.")
        .child("←→ lane · ↑↓ candidate · Home/End · PgUp/PgDn · Enter/Space open · Esc terminal · M main"));
  }
}
