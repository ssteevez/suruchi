# AGENTS.md — operating procedure

This file is operating procedure, not law. The law is `CONSTITUTION.md`, and
§7 of it defines who the agents are. This file defines only *how* they work:
read order, edit permissions, handoff, audits, and how `STATE.md` is kept
current.

Nothing here overrides the Constitution. Where this file and the Constitution
appear to disagree, the Constitution wins and this file is the thing that needs
fixing.

**On enforcement — read this honestly.** The "may edit" and "must never edit"
rules below are *conventions the agents are instructed to follow.* They are not
technical locks. An IDE agent can physically modify any file in the repository.
The real protection is two things, and only these two: the human curator
reviews every change before it is committed, and the curator is the sole editor
of the protected files. If an agent edits something it should not have, that is
caught by curator review, not prevented by the filesystem. Do not treat any
file here as locked. The curator is the gatekeeper.

---

## 1. Who does what

Roles are defined in `CONSTITUTION.md` §7. In short:

- **ChatGPT** — concept, interaction logic, documentation structure, critique,
  orchestration.
- **Claude** — independent architectural review, spec auditing, technical
  sanity checking.
- **Cursor** — production implementation in the repository.
- **Antigravity** — experimental prototypes, especially motion and WebGL.

No agent redefines another agent's role without the curator's approval.

---

## 2. What each agent reads first

Every agent, every task, reads in this order before doing anything:

1. `CONSTITUTION.md` — in full. Always.
2. `DECISIONS.md` — to avoid re-opening settled questions. Also check for
   any `CURATOR OVERRIDE:` notes in `WORKLOG.md` that post-date the last
   relevant DECISIONS.md entry.
3. `STATE.md` — to know what is currently in progress and what is broken.
4. `WORKLOG.md` — scan the last 2–3 entries to know what Cursor just did
   and whether any open questions were left for the curator.
5. The relevant file(s) in `specs/` for the system being touched.
6. `references.md` — only when the task needs design *intent*, not just rules.

An agent that has not read items 1–4 is not ready to start.

---

## 3. What each agent may edit

- **ChatGPT** — may edit `references.md` and propose changes to `specs/` and to
  the Constitution. Proposals to the Constitution go to the curator; ChatGPT
  does not commit Constitution changes itself.
- **Claude** — edits nothing in the repository by default. Claude produces
  reviews, audits, and drafts that the curator places. Claude may draft `specs/`
  and documentation files for curator approval.
- **Cursor** — may edit everything under `src/`. May update `STATE.md` (see §6).
  Must append to `WORKLOG.md` at the end of every session (see §7).
  May create and edit files within the quest it is working on.
- **Antigravity** — may edit everything under `experiments/`. May update
  `STATE.md`. It does not edit `src/` — finished experimental code is handed off
  (see §5), not merged directly.

---

## 4. What each agent must never edit

These are curator-only. Agents are instructed not to touch them. Enforcement is
curator review, per the note at the top of this file.

- `CONSTITUTION.md` — curator only. Agents may *propose* amendments; only the
  curator commits them.
- `DECISIONS.md` — curator only, and append-only even for the curator. No agent
  writes to it. A decision is logged by the curator after it is settled.
- `AGENTS.md` — this file. Curator only.
- Another agent's working area — Cursor does not edit `experiments/`,
  Antigravity does not edit `src/`. Crossing that line requires a handoff (§5).

`WORKLOG.md` is append-only for Cursor — Cursor adds entries but never
rewrites them. The curator may add `CURATOR OVERRIDE:` notes inline to
redirect future sessions (see §7).

---

## 5. How handoff works

Handoff is the moment work moves from one agent's hands to another's. It is
where multi-agent projects fail, so it is deliberate, never implicit.

**Experiment → production (Antigravity → Cursor).**
1. Antigravity builds the prototype in `experiments/`.
2. The curator reviews it and decides it should become real.
3. Antigravity (or the curator) writes a short plain-language interface note:
   what the system takes in, what it produces, what it must not do. This note
   matches the relevant `specs/` file.
4. Cursor re-implements it in `src/` against that note and the spec. Cursor
   does not copy experimental code verbatim — experiments are throwaway; `src/`
   is production.
5. The experiment is then frozen. It is not maintained in parallel. One system,
   one home.

**Spec → implementation (ChatGPT/Claude → Cursor).**
1. A `specs/` file is written and approved by the curator.
2. Cursor implements against it.
3. Any gap or contradiction Cursor finds is reported to the curator, not
   silently resolved.

A handoff is complete only when the receiving agent confirms it has read the
spec and the interface note.

---

## 6. How audits happen

Auditing enforces `CONSTITUTION.md` §7: *the agent that writes a system does
not review it.*

- When Cursor finishes a system, **Claude audits it** — against the relevant
  `specs/` file and against the Constitution's interaction hierarchy (§3).
- When Antigravity produces an experiment that will be promoted, **Claude
  audits the interface** before Cursor re-implements it.
- The audit checks three things: (a) does the code match the spec's interface,
  (b) does it violate the three-layer hierarchy or add a fourth system, (c) are
  the types honest — no `any`, no hidden state outside the declared interface.
- The audit output is a plain-language report to the curator. The curator
  decides what happens next. The auditing agent does not edit the code itself.
- The curator, who does not read code directly, uses the audit as the bridge:
  the typed interface plus Claude's audit is how the curator stays the final
  authority.

---

## 7. How STATE.md gets updated

`STATE.md` is volatile working memory. It is **rewritten wholesale**, not
appended to. It is always current because it is always replaced.

- Whichever agent does work in a session updates `STATE.md` at the end of that
  session: what is now done, what is in progress, what is broken, what is next.
- Old content is overwritten. `STATE.md` is never a history — history that
  matters goes into `DECISIONS.md` as a dated line.
- If two agents work in one session, the later one rewrites `STATE.md` to
  reflect the combined state.
- An agent starting a session trusts `STATE.md` as the current picture. If it
  finds `STATE.md` stale or wrong, it flags that to the curator before
  proceeding — a wrong `STATE.md` is worse than none.

---

## 8. How WORKLOG.md gets updated

`WORKLOG.md` is Cursor's implementation diary. It is **append-only** —
new entries are added at the bottom; old ones are never edited or removed.

**Cursor appends one entry per work session.** The entry must include:
- The date.
- A one-line title describing the session's work.
- Which files were touched.
- What was done, in plain language the curator can read without reading code.
- Why — which spec, decision, or curator instruction drove the change.
- Any open questions left for the curator.

**The curator may write `CURATOR OVERRIDE:` notes** directly below any
entry to redirect Cursor's next session. Cursor reads the log at the start
of each session (per §2) and treats `CURATOR OVERRIDE:` notes as binding
instructions, superseding any prior spec or decision they conflict with.
Once Cursor has acted on an override, it notes `(acted on YYYY-MM-DD)` next
to the override line, and the curator logs the decision in `DECISIONS.md`.

This is the mechanism for evolving the design without a formal Constitution
amendment every time. Quick overrides go here; settled decisions go to
`DECISIONS.md`.

**What WORKLOG is not:**
- Not a replacement for `STATE.md` (that is the current snapshot).
- Not a replacement for `DECISIONS.md` (that is the settled law).
- Not a place for long design discussions — those go to the curator
  directly and are resolved before Cursor is asked to act.

---

## 9. The one rule behind all of this

Every procedure here exists to serve one fact: the curator is the final
authority but does not read code directly. So the project stays legible through
typed interfaces, plain-language specs, separated audits, and a Constitution
short enough to actually read. If a procedure ever stops serving that, it is
the procedure that is wrong.
