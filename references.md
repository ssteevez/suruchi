# references.md

The reference sites that informed the project, and the design psychology
behind them. This file explains *why* the Constitution's rules exist. It does
not state rules itself — those live in `CONSTITUTION.md` and the relevant
specs.

An agent reads this file only when a task needs design *intent*, not just
rules. Most implementation work does not require reading this file.

---

## 1. The two primary references

### sileent.com

**The mechanics observed:**
- Cinematic, fullscreen scenes that take over the viewport.
- Transitions between scenes via a center-out box reveal — a masked rectangle
  opening from the screen's center and expanding to fill it with the next
  scene.
- Constrained, theatrical reveals rather than continuous scroll.
- Cursor-displaced blocks: elements that push away from the pointer as it moves
  across a fullscreen scene.
- Slow, weighted motion. Restraint over flourish.

**The design idea, not just the mechanic:**
The important thing is *not* "scrolling sections." It is that the next world
emerges through a controlled aperture. This produces anticipation, compression
into expansion, and a chamber-like sense of theatrical unveiling. Sections are
not flat panels stacked vertically — they are rooms revealed.

**Where this shows up in the project:**
The center-out box reveal between Phase 1 video scenes
(`specs/scroll-transitions.md`). The block displacement around the cursor
(`specs/cursor-system.md` and `specs/video-compositing.md`). The Phase 2
progress-dial scroll-lock inherits the same psychology — scroll does not move
you, it advances a reveal.

### aboutluca.com

**The mechanics observed:**
- A localized cursor-following light over a dimmed environment.
- Smooth inertia: the light lags the pointer with weighted feel, not snap.
- Partial revelation — only what is near the cursor is legible.
- Darkness used as layered, navigable space rather than empty background.

**The design idea, not just the mechanic:**
The important thing is *not* "flashlight cursor." It is that darkness becomes
*active and navigable* rather than empty. Darkness is a medium, not the
absence of one. The cursor's light is the gesture of attending to something.

**Where this shows up in the project:**
The cursor system itself (`specs/cursor-system.md`). The dark, low-contrast
video planes that the cursor brightens. The whole homepage assumption that
darkness is the resting state, and visibility is local and earned.

---

## 2. The progressive blur reference

### Codrops — "Progressive Blur Effect Using WebGL with OGL and GLSL Shaders"
(Jorge Toloza, 2024)

**The mechanic:**
A multi-pass blur whose strength varies across the surface, driven per-fragment
by a `smoothstep` over screen position. Sharp at one edge, smoothly increasing
in blur toward the other. Not a uniform blur.

**The design idea:**
Blur as a *gradient property of a surface*, not a uniform filter. It produces
a filmic, lens-like quality — the soft edges of a projected image, or the
focus falloff of a real camera.

**Where this shows up in the project:**
The decorative blur band along the bottom of the homepage viewport
(`CONSTITUTION.md` §4, future `specs/video-compositing.md`). Deliberately
**not** wired to the cursor — this is decorative atmospheric framing, not
interactive focus. That independence is a Constitution-level rule and is the
hardest call in the project to hold to discipline.

**Honest caveat:**
This is a *later addition* to the project, made during planning. It is not in
the original proposal PDF. The cursor-as-light system (aboutluca-derived) does
not require it. They sit on the page as independent atmospheres.

---

## 3. The supporting references

These are named in the proposal PDF and inform later modules, not the
homepage.

- **the-next.org/visualizations/experience#11** — referenced for the Books
  mini-site. Books as digital objects, engaged through movement and
  perspective. Not relevant to the homepage. Will inform `quests/books/`
  when that quest opens.
- **stefanvitasovic.dev/about** — referenced for About / Press / Contact.
  Minimal interaction, clean typographic hierarchy, fast and accessible.
  Restraint as the design language for informational pages. Will inform the
  About page when it is built.

---

## 4. Where the project deviates from its own references

This is important and honest. The Constitution and specs do not slavishly
copy the references; they take psychology from them and reject specifics.

**Taken from the references:**
- The sense of theatrical, weighted reveal (sileent.com).
- The sense of darkness as navigable space (aboutluca.com).
- Block displacement around a moving point (sileent.com).
- Cursor as a soft, lagged light source (aboutluca.com).
- Filmic gradient blur (Codrops).

**Deliberately not taken:**
- The brightness or saturation of either reference site. The project is darker
  and more restrained than either.
- aboutluca.com couples its light tightly to revealed text. The project does
  not — the cursor reveals brightness only, not text legibility or focus.
- sileent.com uses full theatrical scene transitions for every section. The
  project uses them only between Phase 1 video scenes; Phase 2 uses a
  progress-dial instead, which is the project's own invention.
- The Codrops blur tutorial drives its blur gradient by screen position alone,
  static. The project's blur could in principle be driven by anything — but is
  deliberately kept static and independent of the cursor, to enforce the
  three-layer hierarchy.

If an agent finds itself reproducing a reference effect *exactly*, it should
stop. The references are starting points, not targets.

---

## 5. The standing reminder

Restraint is the brief. Both reference sites are quieter and more controlled
than most "experiential" sites. Suruchi's site is meant to be quieter still.
When in doubt about what an interaction should do, the answer is usually
*less*.
