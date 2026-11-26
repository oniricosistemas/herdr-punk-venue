# Herdr layouts

Two custom layouts for the [Herdr](https://herdr.dev) desktop app: `punk-venue`, an Argentine punk gig where your agents are the band, and `neon-dashboard`, a cyberpunk node map. Both are source trees that get copied into the app's own home, `~/.config/herdr-app`.

```
punk-venue/     layouts/, mods/, themes/   the gig
package/        layouts/, mods/, themes/   the neon node map
odd/tasks/      one record per feature: specs, tasks, evidence log
```

## Install

The app treats `~/.config/herdr-app/AGENTS.md` as its contract: it redraws itself from those files while running, so copying a layout or a mod applies it live. This machine's home is `C:\Users\HP\.config\herdr-app`.

```sh
cp layouts/<name>.json  ~/.config/herdr-app/layouts/
cp -r mods/<name>       ~/.config/herdr-app/mods/
cp themes/<name>.json   ~/.config/herdr-app/themes/
```

Then check the mod and switch to it:

```sh
herdr-app check ~/.config/herdr-app/mods/<name>
herdr-app do layout.switch --name <name>
```

Staging is the source of truth. Keep the installed copy byte-identical to it, except `gpui-kit.d.ts`, which the app rewrites on every start.

## Verify

- `herdr-app check <mod folder>` loads a mod once and validates its initial description. It does not lay out the mod or run deferred rows, so a passing check is necessary, not sufficient.
- `punk-venue/mods/punk-venue/tools/validate.ps1` regenerates and diffs all 41 generated SVGs, checks the 51-asset inventory, the six-colour palette, the 4:1 scene and 8:1 crowd aspect ratios, and every preserved SHA-256. It writes only in system temp.
- `herdr-app shot <file.png>` captures the window for visual proof. Screenshots stay out of git.

## Design notes that cost build iterations

- Keep the shipped coupling IDs (`sidebar`, `tabs`, `main`, `panel`, `panel-body`, `files`, `changes`). A layout that renames them breaks the mods it reuses.
- `image()` fits by aspect ratio, so scene art must match its box ratio; square art letterboxes tiny. Everything aligns to a computed art rect, not to the box.
- Native `.loop` runs only while its element is drawn; that is what keeps motion free in the background. Prefer `.loop` over `cx.timer`. A timer that cannot stop is a leak — `pasture` ships one and it should not be copied.
- Editing a mod's `main.js` hot-reloads the render but does not re-run `init` on the live instance, so one-time async work must also be started lazily from `render`.
- A node painted earlier in a container chain is covered by later children. Overlay a sign as a sibling painted after the scene.
- On Windows the system draws no window buttons, so a root `"titlebar": "none"` without a bar mod that calls `window.minimize`/`maximize`/`close` leaves the window with no controls.
- The app rewrites the shown layout file when a mod folder appears while it is displayed. Install mods with a plain layout on screen, or check the JSON afterwards.

## Task records

`odd/tasks/*.md` hold the specification, the task table and an evidence log for each feature. Read one through `## Log` before changing that feature: the log records the corrections that already failed once.
