# CONSTITUTION — SuruchiWebsite

This is the law of the project. Every AI agent (Cursor, Antigravity, or any
other) reads this file in full before touching code. If a task seems to require
breaking a rule here, the agent must stop and ask the human curator — it must
not improvise around the law.

This file is short on purpose. If it grows too long to read in full, it has
failed at its job.

For the *reasoning* behind these rules — the reference sites and the design
psychology — see `references.md`. This file states the rules; that file
explains why they exist.

Where this file and the proposal PDF disagree, **this file wins.** The proposal
is the original client agreement; this Constitution is the current, evolving
truth. Differences are intentional and are recorded in `DECISIONS.md`.

---

## 1. What this project is

An experiential website for the artist Suruchi Choksi. It is not a portfolio
site and not an agency site. It is a cinematic, literary, spatial environment.

The site should feel like entering an atmosphere and moving through chambers —
navigating emotional and textual space, interacting with partial visibility and
revelation.

The guiding line, from the proposal: *most artist websites display work; this
one constructs an encounter.*

---

## 2. The aesthetic — non-negotiable

The site is: dark, sparse, cinematic, weighted, breathable, emotionally
restrained, intimate, textural, spatial.

The site is deliberately NOT: flashy, hyperactive, aggressively interactive.

We explicitly avoid: startup aesthetics, excessive UI chrome, glassmorphism,
generic motion design, overloaded interaction systems, "award-site" visual
noise.

The goal is not maximal interactivity. The goal is controlled atmosphere,
intimacy, pacing, and revelation.

---

## 3. The interaction hierarchy — the most important rule

The homepage has exactly THREE layers. Nothing may be added as a fourth. A new
idea must *displace* an existing layer, never stack on top of it.

- **Primary (input-driven): the cursor.** The cursor is a single coupled
  system. One pointer position, one velocity, one influence radius, one
  smoothing value. From that single input it drives three expressions:
  (a) illumination — it brightens the dark video locally; (b) elastic
  distortion of the video surface — the video's own pixels warp, stretch,
  and displace around the cursor like a thin rubber sheet under pressure,
  with a trail that lingers and relaxes back to flat; and (c) typographic
  influence — the fixed corner typography (the artist's name and the three
  section labels) responds to the cursor's light field, with characters
  displacing, brightening, and rippling within the cursor's radius. All
  three expressions share the same lagged position, the same radius, and
  the same smoothing. They are never tuned separately. There are no discrete
  decorative blocks; the video's own texture is what moves in (b), and the
  DOM characters are what move in (c). The typographic response is an
  extension of the primary layer — the cursor's light radiates into
  everything it touches, not only the video surface.

- **Secondary (input-driven): scroll transitions.** Between the intro video
  scenes, scrolling triggers a center-out box reveal — a masked rectangle
  opening from the center to fill the viewport with the next scene.
  Transitions are constrained, interruptible, and short (~600–900ms).

- **Ambient (NOT input-driven): the video and the blur.** The dark video
  planes simply play; the user does not control their playback. The
  progressive blur is decorative atmosphere. Neither responds to the
  cursor's position or velocity. The mesh distortion in §3(a) is a property
  of the cursor's effect ON the video, NOT a property of the video itself.

If an agent finds itself adding a behavior that is none of these three, it
is violating the Constitution.

---

## 4. The blur — deliberately independent

The site uses a progressive (gradient) blur. Its role is fixed by decision:

- The blur is a **fixed, screen-locked band along the bottom of the viewport.**
- It is **decorative atmosphere** — a filmic veil, not an interactive system.
- It is **completely independent of the cursor.** The cursor does NOT resolve,
  sharpen, or move the blur. Focus is not a cursor effect.
- Because the column headings sit at the TOP of their columns (see §5), the
  blur does NOT veil the headings. It veils whatever scrolls beneath it
  (intro text, buttons). It is a bottom-of-screen veil, not a heading
  treatment. No agent may wire the blur to the headings.

This independence is a deliberate choice of filmic framing over system
coherence. It is recorded and final unless the curator amends it.

---

## 5. Homepage structure

The homepage has two phases, scrolled in sequence.

**Phase 1 — intro video sequence.** Six dark, low-contrast video scenes
arranged as a continuous loop. Within them the cursor reveals brightness,
localized visibility, and atmospheric perception — the dark plane becomes
legible where the cursor is, and the video's surface elastically distorts
around the cursor's motion, with a fluid trail. The cursor does NOT sharpen
the image, restore focus, or resolve the blur; the blur is independent
decorative framing (§4) and is untouched by the cursor.

Scroll advances through the scenes as a smooth continuous dial — scrolling
forward progresses from scene to scene in an infinite loop; scrolling
backward reverses through the same loop. Adjacent scenes cross-dissolve
via the distortion field as the scroll advances. The original center-out
box reveal is deferred; the current looping-blend model is the ratified
Phase 1 direction. See `specs/scroll-transitions.md` for the full contract.

**Phase 2 — the split screen.** A single screen. A video plays behind it.
The screen is divided into three vertical columns: **Poet**, **Painter**,
**Pilgrim** — left to right. Each column's heading sits at its TOP.

Phase 2 scroll behavior:
- When Phase 2 enters the viewport, scroll **locks**. It no longer moves
  the page. It becomes a **progress dial.**
- Scrolling paints the columns full, left to right (Poet, then Painter,
  then Pilgrim), while the screen stays fixed in place.
- Each column fills only its own third of the screen — never fullscreen.
- When all three columns are filled, scroll **releases** and normal page
  behavior resumes.
- Each column has a soft line of intro text and an Enter button.

**The three columns are a GATEWAY, not the Works section itself.** Each
Enter button routes to a separate Works page (Poet, Painter, Pilgrim),
each of which has its own interaction system, built later as its own
quest. The homepage establishes the universe and hands off. It does not
contain the works.

**OPEN QUESTION — do not invent an answer:** what sits below Phase 2
(a footer, a contact area, or nothing) is deferred. Until the curator
decides, build nothing there. An agent reaching this point stops and
asks.

---

## 6. Technical floor

- Language: **TypeScript**, strict mode. No `any`.
- The homepage is a WebGL application. The elastic distortion of video and
  the progressive blur of video both require shader access to the video
  texture, so the video is composited as a WebGL texture sampled through a
  cursor-driven displacement field. There is no lightweight CSS-only
  version of the main effect.
- **Fallback:** where WebGL is unavailable, or where the user has
  `prefers-reduced-motion` set, the homepage degrades to a static dark
  poster image with no effects. This is the floor, not a richer fallback.
- Mobile has no cursor. The mobile homepage is a separate interaction
  design, built as its own quest — it is not a port of this one.
- Library and stack details live in `specs/tech-stack.md`. Where that spec
  and the proposal PDF disagree on libraries, the spec wins and the reason
  is logged in `DECISIONS.md`.

---

## 7. How agents work

- Read this Constitution fully before any task.
- Read the relevant file in `specs/` for the system being built.
- The agent that *writes* a system is never the agent that *reviews* it. A
  different agent audits, against the spec.
- Every system exposes a typed, plain-language interface. The interface is
  the curator's control surface — it must stay readable even when the
  implementation is not.
- Settled decisions live in `DECISIONS.md` (append-only, dated). Before
  re-opening any decision, check that file. Do not re-litigate what is
  logged.
- Current working state lives in `STATE.md`, rewritten each session.
- The human curator is the final aesthetic authority. Disagreement between
  agents is healthy — but all agents argue from this Constitution.

### Agent roles

- **ChatGPT** — concept development, interaction logic, documentation
  structure, critique, orchestration.
- **Claude** — independent architectural review, specification auditing,
  technical sanity checking.
- **Cursor** — production implementation within the repository.
- **Antigravity** — experimental prototypes, especially motion and WebGL
  systems.

Two binding rules:

- The agent that writes a system must not review the same system.
- No agent may redefine another agent's role without curator approval.

Operational detail — handoff, audits, file permissions — lives in
`AGENTS.md`, not here.

---

## 8. The standing warning

The risk to this project is not too little interactivity. It is "VFX soup"
— too many systems competing at once. Every time an agent considers adding
something, it weighs against §3. Restraint is the brief. When in doubt,
build less.
