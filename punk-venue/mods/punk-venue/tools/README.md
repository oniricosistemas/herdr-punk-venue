# Punk venue art tooling

Original SVG pixel/stencil art for T2 (S1, S3, S7), with the wide-scene revision
covering S2-S3 and T7 stage variants covering S11's art increment.
The 78 shipped assets are in `../art/`; no tooling runs in the mod. No dependencies or network. No fonts, stylesheets, embedded
images, external resources, or copied band logos. All assets share six colors.
The owner-approved S3 lettering increment uses real band names as original
uppercase stencil shapes, not reproductions of band typography or logos.
Exact supplied spelling and casing are retained in SVG accessibility labels.

The stage and idle scenes (`backdrop.svg`, `entrance.svg`) plus the four
`backdrop-{club,galpon,plaza,salon}.svg` variants declare
`width="256" height="64" viewBox="0 0 256 64"` (4:1). The front-row overlay
`crowd.svg` declares `width="512" height="64" viewBox="0 0 512 64"` (8:1), so
it fills a 400 x 50 strip without consuming the stage height. The 28 musicians and six empty
gear assets remain `width="64" height="64" viewBox="0 0 64 64"`, byte-identical
to their pre-revision versions. Scenes are recomposed across the wide canvas,
not horizontally stretched square art.

Regenerate the crowd strip, its runtime backplate and its two cutouts from the repository root:

```sh
node punk-venue/mods/punk-venue/tools/generate.mjs --crowd-only
```

Regenerate all 62 generator-owned assets, including the shipping entrance
and its overlays, from the repository root:

```sh
node punk-venue/mods/punk-venue/tools/generate.mjs
```

`--preserved-entrance` is for validation in scratch only: it writes the
reference entrance with its nine static people, not the shipping version.

Run the banner layout and entrance queue timer tests directly with Node:

```sh
node --test punk-venue/mods/punk-venue/tools/banner-layout.test.mjs
node --test punk-venue/mods/punk-venue/tools/queue-walk.test.mjs
```

The queue test drives the mod's timer callback with stubbed layout and agent
inputs. It checks each person's rendered frames, distinct phases and cadences,
the doorway's gone/return sequence, timer reuse, notifications, five cancellation
paths, and the full-size no-click crowd overlays without launching Herdr.

XML and deterministic-regeneration validation on Windows, using built-in .NET:

```sh
powershell -NoProfile -ExecutionPolicy Bypass -File punk-venue/mods/punk-venue/tools/validate.ps1
```

The validator first runs eight deterministic Node layout tests and checks the
78 shipped assets, then runs the generator twice in system temp and compares
all three SHA-256 snapshots for all 62 generated files, including the original
41. It independently regenerates the preserved entrance, checks its original
hash, and applies exactly nine authorized figure removals (two T8, seven S8)
to match the shipped entrance byte for byte. It checks the exact filename set,
XML parsing with DTDs prohibited and resolution disabled, SVG namespace,
dimensions/viewBox, an element/attribute allowlist, palette, distinct state
files, and the 8 KiB budget. Scene-local `defs`/`use` reuse deterministic shape
groups; every `href` must be an internal fragment resolving within that SVG.
`square-sha256.json` records all 34 square assets before this revision; their
hashes are checked before and after regeneration. `scene-sha256.json` adds
the three original scene hashes captured before the T7 increment. Only its
`entrance.svg` entry was updated for the neutral ENTRADA sign and named poster.
The validator pins separate authorized hashes for the shipped entrance and the
S9 crowd redraw; the manifest's fallback/crowd entries and the entire square
manifest remain unchanged. The two cutouts are checked against deterministic
regeneration, not a preservation manifest. Variant hashes are compared across regeneration, not stored
in a preservation manifest. Do not refresh preservation manifests to conceal
an unintended change. The validator also checks exact accessible band names,
uppercase glyph spelling, line counts, condensation and scene uniqueness.
Variants must finish with solid near-black clearance masks
for the band and crowd zones. The validator cleans its scratch files and does
not judge visual quality.

## Palette

| Color | Hex | Role |
| --- | --- | --- |
| Near-black | `#151412` | Ink, hair, jeans, wall shadows |
| Bone/cream | `#eee3c5` | Paper, cloth, faces, silhouette edges |
| Red | `#b93b36` | Mohawks, guitar, banners, drum shells |
| Mustard | `#c4a34f` | Brass, cymbals, beer, wood |
| Bottle green | `#385947` | Shirts, amp cloth, mortar |
| Desaturated denim | `#627b88` | Jackets, jeans edges, tin roof, gear stands |

## Delivered files (all in `../art/`)

- `backdrop.svg` (generic fallback), `crowd.svg` (larger front row), `entrance.svg` (neutral shared entrance)
- `crowd-front-punk.svg` and `crowd-front-neighbor.svg` (generated overlays), `monitor-riser.svg`
- `crowd-backplate.svg` and `entrance-foreground.svg` (generated)
- Seven `*-strike.svg` musician poses and eight preserved `queue-walk-{punk,neighbor}-*.svg` entrance frames
- Seventeen generated `queue-{doorway,drinker,neighbor,punk,seated}-*.svg` entrance poses
- `backdrop-club.svg`, `backdrop-galpon.svg`, `backdrop-plaza.svg`, `backdrop-salon.svg`
- `guitar-working.svg`, `guitar-idle.svg`, `guitar-blocked.svg`, `guitar-done.svg`
- `bass-working.svg`, `bass-idle.svg`, `bass-blocked.svg`, `bass-done.svg`
- `drums-working.svg`, `drums-idle.svg`, `drums-blocked.svg`, `drums-done.svg`
- `singer-working.svg`, `singer-idle.svg`, `singer-blocked.svg`, `singer-done.svg`
- `guitar2-working.svg`, `guitar2-idle.svg`, `guitar2-blocked.svg`, `guitar2-done.svg`
- `keys-working.svg`, `keys-idle.svg`, `keys-blocked.svg`, `keys-done.svg`
- `sax-working.svg`, `sax-idle.svg`, `sax-blocked.svg`, `sax-done.svg`
- `empty-guitar.svg`, `empty-bass.svg`, `empty-drums.svg`, `empty-mic.svg`,
  `empty-keys.svg`, `empty-sax.svg`

## Silhouettes and scene

- **working:** elbows bent into the instrument: strumming/plucking arm across
  guitar/bass, lifted drumsticks, both hands on keys, hands around sax, singer
  gripping the microphone near the mouth with the other arm reaching outward.
- **idle:** a present, upright musician, both arms resting down outside the
  torso. Guitars/bass hang more vertically. Gear remains visible.
- **blocked:** front-facing, one arm extended horizontally with a pointing
  finger, other hand raised open in a questioning gesture. No playing pose.
- **done:** both arms above the head in a wide V, hands/fingers raised. Gear
  remains in place. Distinguishable from working even without color.
- **empty:** gear and stands only; no head, torso, arms, or legs. Guitar/bass
  have an amp and cradle; drums/keys include an unoccupied stool; sax rests on
  a stand; the microphone stands alone.

The corrugated shed roof, exposed brick, taped photocopied bills, fraying
cloth banner, beer cups, mixed punk/neighborhood queue and seated spectators
establish the DIY venue rather than a neon/cyberpunk setting. Only the protected
generic fallback and crowd retain the invented Barro Sur / Ruido Roto banners;
the crowd flags expose those exact accessible names, and the legacy `BS` shirt
stencils remain unchanged. The four venue variants now use
the owner's real-band mapping below. All lettering is hand-defined 3x5 shape
geometry, not text/font rendering.

## Stage/entrance at 560 x 140; front row at 400 x 50

Stage and entrance retain the panel's 4:1 aspect ratio. The crowd is an 8:1
transparent overlay, not another full-height scene. At 560 x 140, one stage
unit is 2.1875 screen pixels; at 400 x 50, one crowd unit is 0.78125 pixels.
These are composition and geometry expectations, not a new optical review.

- **backdrop:** the tin roof and brick wall extend edge to edge. Two pairs of
  amp stacks frame a broad central cloth banner and a clear lower center for
  live musician overlays. The low stage lip spans the entire width. Banner
  glyphs are roughly 11-16 screen pixels high; the cream cloth reads as a
  photocopied gig banner without becoming a centered miniature scene.
- **crowd at 400 x 50:** 24 figures instead of 31, arranged in two staggered,
  overlapping rows. Crowd-only 2.5x shape groups make the face 15 canvas units
  tall instead of 9 (about 12 display pixels instead of 7), without changing
  the strip height or the entrance figures. The hem crops lower bodies so
  there is room for faces, mohawks, raised fists and bent bottle-holding arms.
  Both invented flags and their uppercase stencils remain unobstructed.
  Their roughly 6-pixel-high lettering is still poster texture at this size.
  The two cutouts are 64-unit square crops at the strip's 1:1 art scale,
  centered on the same front-row faces at x=206 and x=243. They show the whole
  figure down to the original hem, with a 0.5–2 unit upward offset for the
  punk (1120 ms loop) and 0.5–3 units for the neighbor (1730 ms). The runtime
  backplate omits those two fixed silhouettes so they do not double; the
  preserved `crowd.svg` still contains all 24 figures.
- **entrance:** a cream/red entrance and neutral ENTRADA sign sit left of
  center, with a small Alerta Roja pasted poster and a queue stretching right.
  The scene adds nine animated people to the generated base. The original
  punk walks every 100 ms, and the original neighbor walks with holds of
  100/100/200/100 ms. The other punk has four 200 ms poses; the barrier
  neighbor has three 300 ms poses. The left and right drinkers share three
  poses with holds of 400/400/400 and 300/400/500 ms; the two seated figures
  share three poses with holds of 600/600/600 and 500/600/700 ms. Both pairs
  start out of phase and never share a pose on any tick.
  The doorway figure is the original neighbor at (103,30): in an 8 s cycle
  it stands for 2.3 s, takes two 300 ms steps inward, disappears for 1.7 s,
  reverses those steps, then stands for 2.8 s before the cycle repeats.
  All poses stay inside the opening. A foreground layer restores the barrier,
  the bottle and the Alerta Roja poster over the figures.

## T7 venue variants at 400 x 100

All four variants are original 256 x 64 compositions. At 400 x 100, one
scene unit is 1.5625 screen pixels. No new hues, gradients or opacity washes
are introduced: temperature comes from palette dominance and solid shapes.

| File | Silhouette / props | Light at 400 x 100 |
| --- | --- | --- |
| `backdrop-club.svg` | Thick low ceiling beam, cramped brick wings, tight amp pairs; Los Violadores cloth and two wall stickers | Mustard amber wash and red brick, warm and compressed |
| `backdrop-galpon.svg` | Corrugated ribs, angular rafters, crooked Todos Tus Muertos cloth, stacked braced cases and labels | Denim/cream overhead fixtures, cold and industrial |
| `backdrop-plaza.svg` | Open horizon, tree silhouettes, suspended bulbs, Boom Boom Kid cloth and two side flags; no ceiling | Light cream/denim sky with mustard bulbs, airy daylight |
| `backdrop-salon.svg` | Green hall, triangular guirnaldas, Embajada Boliviana cloth, two taped posters and plastic chairs | Muted green with cream trim and festive warm accents, softer than the warehouse |

Every variant ends with a near-black musician clearance rectangle at
`x=56..200, y=22..56` (screen x=87.5..312.5, y=34.375..87.5). This preserves
contrast behind the centered figures starting around 34% scene height.
Bright banners, lights, posters and props remain above or beside that zone.
The entire bottom eighth, `y=56..64` (screen y=87.5..100), is a flat near-black
mask with no high-contrast detail underneath the crowd. Masks are painted last
and validated, so even a prior shape cannot leak into the protected areas.

`backdrop.svg` remains the unchanged generic fallback. This increment supplies
only variant art; deterministic space-id selection and runtime fallback are
parent-owned mod integration, not functionality implemented by the generator.
Composition notes above are geometry expectations, not a fresh optical review.

## Real-band lettering mapping (owner-approved S3 increment)

These are real band names used at the owner's request for a personal desktop
scene. The package must not be redistributed publicly with them without
permission. No logo, album art or distinctive band lettering was copied.
This owner-approved increment replaces the earlier invented-only rule for the
four variants and entrance poster; the fallback and crowd keep their invented
names.

The generator's `banner()` helper uses `layoutBanner()` from
`banner-layout.mjs`. Up to 11 characters use one line; 12-16 use two lines at
word boundaries balanced to minimize the widest line. Longer names use two
slightly condensed lines. The seven names explicitly designated long by the
owner always use condensed two-line treatment, even when their actual count
is 16 or less: Todos Tus Muertos, Cadena Perpetua, Eterna Inocencia, Embajada
Boliviana, Cultura Violenta, Sugar Tampaxxx, Boom Boom Kid.

Visible lettering is uppercase, as approved. Each named panel is a
`role="img"` group with the exact original-cased `aria-label` below. Glyphs
are scene-local shapes reused with internal fragment references. At 400 x 100,
letter height is approximately 11 screen pixels, with the narrowest stencil
cut at least 1.7 pixels across in these panels. Panels stay outside the dark
musician zone and bottom eighth. There are 13 distinct names, three per venue,
one on the entrance poster, with no repetitions inside any scene.

Coordinates below are design-space panel bounds `(x, y, width, height)`.

| Exact accessible name | SVG file | Position / bounds | Visible lines |
| --- | --- | --- | --- |
| Los Violadores | `backdrop-club.svg` | Main cloth `(87,1,82,20)` | `LOS` / `VIOLADORES` |
| Flema | `backdrop-club.svg` | Left wall sticker `(3,22,50,12)` | `FLEMA` |
| Argies | `backdrop-club.svg` | Right wall sticker `(203,22,50,12)` | `ARGIES` |
| Todos Tus Muertos | `backdrop-galpon.svg` | Main crooked cloth `(86,1,84,19)`, rotated 2 degrees | `TODOS TUS` / `MUERTOS` (condensed) |
| Attaque 77 | `backdrop-galpon.svg` | Left wall stencil `(3,17,50,12)` | `ATTAQUE 77` |
| 2 Minutos | `backdrop-galpon.svg` | Right case label `(203,30,50,12)` | `2 MINUTOS` |
| Boom Boom Kid | `backdrop-plaza.svg` | Main suspended cloth `(85,1,86,20)` | `BOOM` / `BOOM KID` (condensed) |
| Fun People | `backdrop-plaza.svg` | Left flag `(3,21,50,12)` | `FUN PEOPLE` |
| Loquero | `backdrop-plaza.svg` | Right flag `(203,21,50,12)` | `LOQUERO` |
| Embajada Boliviana | `backdrop-salon.svg` | Main cloth `(83,1,90,20)` | `EMBAJADA` / `BOLIVIANA` (condensed) |
| Sin Ley | `backdrop-salon.svg` | Left taped poster `(3,20,50,12)` | `SIN LEY` |
| Bulldog | `backdrop-salon.svg` | Right taped poster `(203,20,50,12)` | `BULLDOG` |
| Alerta Roja | `entrance.svg` | Small pasted poster `(146,12,60,12)` | `ALERTA ROJA` |

The shared entrance's main sign is `ENTRADA`, both visible and accessible,
located at `(75,10,61,13)`. It is neutral, not a band name.

## Small-size limitations / integration review

Use the final layout preview to judge the revised scenes at the actual display
size; no new raster or live-layout optical review was performed by this tooling.
Tiny shirt initials are texture, not UI labels. For individual musician sprites
at 24-32 px, guitar and bass share a broad instrument family outline; bass's
mustard body and different pickup help but are not a monochrome role guarantee.
State differences use arm geometry, not color. Drumsticks, sax keys and beer
foam may disappear at those sizes. Art does not itself implement animation,
clickability, or agent-to-slot mapping; those are integration responsibilities.
