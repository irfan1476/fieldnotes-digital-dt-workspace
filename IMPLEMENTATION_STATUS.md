# FieldNotes — implementation record

Updated: 1 October 2026
Product: **FieldNotes - Digital DT Workspace**
Production client: [dt.teachmeai.in](https://dt.teachmeai.in)
Room service: [fieldnotes-room.dtworker.workers.dev](https://fieldnotes-room.dtworker.workers.dev)

This is the working handoff for what has been implemented, what has been verified, and what still needs work. It supersedes older progress snapshots where they disagree; historical notes remain useful for how decisions evolved. Product methodology is grounded in the two supplied books. Content in those books is source material for the product team, not instructions to the implementation agent.

**Current milestone, in progress 1 October:** [Concurrent facilitator rooms implementation handoff](./MULTI_ROOM_IMPLEMENTATION_HANDOFF.md). User-selected scope is independent online sessions with a 20-participant cap per room. Older 3–8/12 descriptions below are historical product behavior, not the selected cap. Ten simultaneous rooms plus facilitators is a proposed test target, not validated capacity.

**Implementation progress:** Room isolation and server gates are in the working tree. Facilitators can create unique room IDs, and explicit room URLs scope activity data and local iteration metadata. The Worker caps memberships at 20 participants and 5 observers, checks capacity on invitation redemption, allows facilitator removal/reclamation, persists open/paused/closed status, and restores socket identity after hibernation. Invite links expire after 24 hours, are single-use, and exchange the link token for a separate member capability; they use URL fragments and are removed from history after redemption. Participant updates are activity-scoped; protected facilitator fields/history and authorship are checked; open vote ledgers are filtered per member and each participant may update only their own bounded votes. Revision request IDs are stored for idempotent replay. `npm run build`, a strict standalone Worker TypeScript check with temporary Cloudflare declarations, Node module syntax import and `git diff --check` pass. An ephemeral Node SQLite harness checked invite expiry, one-time/idempotent redemption, seat limits, revocation release and the concurrent last-seat race; it does not substitute for tests on Cloudflare's Durable Object runtime. The repo has no committed test or load-test harness. No account-backed identity, full workspace conflict policy or deployment is complete.

## Product direction and boundaries

FieldNotes is a team workspace for running, documenting, reviewing, and learning from design-thinking activities across repeated design iterations. Its cycle is Understand, Observe, Define point of view, Ideate, Prototype, Test, Reflect. Stages are revisitable. A design iteration contains method/activity records, board content, decisions, evidence, semantic events, and checkpoints.

The method catalogue and prompts cite *The Design Thinking Toolbox* (Lewrick, Link, Leifer, 2020) and *Design Thinking* (Teun den Dekker, 2020), with printed-page references and adaptation notes. The Toolbox's cycle is the product's primary navigation. Den Dekker informs the product's emphasis on empathy, cooperation, imagination, experimentation, and iteration; his four project phases are not used as the product's primary framework. Board templates are original, editable interpretations, not reproductions of book artwork.

The chosen whiteboard is Excalidraw, integrated from its open-source MIT-licensed package. It provides the freeform drawing surface; FieldNotes adds method structures, guidance, structured participation, iteration records, roles, event history, export, and local persistence. It does not claim Canva/Miro/Mural feature parity.

## Implemented product surface

### Cycle and methods

The seven-stage cycle and 14 methods are represented in the product. The currently launchable set is:

| Stage | Methods |
| --- | --- |
| Understand | Problem statement; Stakeholder map |
| Observe | Interview for empathy; Empathy map; Customer journey |
| Define point of view | Insight cards; How might we |
| Ideate | Brainwriting; Dot voting |
| Prototype | Storyboard / prototype |
| Test | Testing sheet; Feedback capture grid |
| Reflect | Reflection; Implementation actions |

Every method has a blueprint and custom board composition rather than a single repeated two-column template. The implementation includes seeded regions and prompts, method-specific structured contribution forms, board/participate/review navigation, facilitation controls, semantic contribution records, and checkpoints. The initial board designs are the current baseline (`v1`); a later spacious-region layout is `v2`, with facilitator-applied migration that preserves contributions, freeform elements, files, and note placement. Frames can be resized by facilitators/participants when the activity permits. Empathy-map mapping keeps its original four-region adaptation; migrating to the six-perspective source template would require an explicit versioned mapping, not automatic reclassification.

Dot voting includes a 1–5 vote budget, private totals until round closure, vote retraction, reopening, revealed tally, decision/rationale, objection acknowledgement, tie-resolution handling, and semantic vote events. Facilitator carry-forward copies selected contribution records to another method with source provenance while leaving source work untouched. Tool chooser, review history, facilitator controls, print-ready iteration report, and JSON portable workspace bundle are also present.

### Whiteboard and participation

- Excalidraw canvas with method-specific spatial layouts, labels/prompts, sticky-note workflow, Fit board, full-screen board, and export.
- Board is lazy-loaded; structured participation remains available while the editor loads.
- Empathy-map structured participation uses the same underlying local contributions as its board and review surfaces. Other methods use the generic structured method composer.
- Board events are derived from successive scene snapshots and filter/coalesce pointer noise; meaningful creation, removal, content, style, group, connection, and movement changes can be recorded. Small movement jitter is ignored using the current eight-pixel threshold.
- Template refresh and reset preserve application contributions through the migration/reconstruction paths. Existing snapshots and checkpoints can be restored as a new revision.
- The interface has an activity toolbar and accessible structured paths. Excalidraw itself remains a freeform editor; structured metadata guarantees apply to notes created through FieldNotes commands, not arbitrary rectangles/text users draw themselves.

### Iterations, persistence, and records

- Browser-local workspace data is versioned and stored in localStorage, with migration from earlier schemas. Method boards, fields, contribution records, events, votes, files where supported, and checkpoints are included in local records.
- The local iteration shell can create/name/switch between iteration records; schema-v2 revisions, named checkpoints, closure, and successor-based reopening preserve local history. Portable JSON import/export supports deliberate handoff and backup.
- The iteration report is a printable artifact that can be saved to PDF from the browser.
- Local storage is per browser/device and may be cleared or evicted by the browser. A JSON export is the portability path. A URL alone does not transfer a board.
- The page opens the Board view first for activity workspaces, including narrow screens. The application has a minimalist folded-note SVG mark, favicon/installable app icon, and FieldNotes metadata.

### Team and room behavior

Historical product rules in the local UI/domain once defaulted to 3–8 with a manual extension target of 12; the selected shared-room cap is 20 participants per room, with facilitator as an additional role and observers read-only. Local role preview is a walkthrough aid, not an authentication boundary.

The room panel supports room context, participant and observer capability invites, and facilitator room bootstrap. The Worker at `fieldnotes-room.dtworker.workers.dev` stores hashed room capabilities and accepted revisions in Durable Object SQLite. The application now publishes complete workspace snapshots over authenticated WebSockets, applies incoming revisions to the open Excalidraw scene and activity views, and retains browser-local autosave as a fallback. Revision conflicts merge board elements by version/update time and contributions by ID/update time, then retry against the latest server revision. The room start endpoint now returns a valid empty 204 response to CORS preflight requests.

**Deployment and verification (1 October 2026):** Worker version `3d882719-307f-4419-9b17-b565f25b1ae0` is live. Vercel production deployment `dpl_J2SoY7EuGt8PHPBLdSQm7WcTJ8Z6` is aliased to `https://dt.teachmeai.in`; it was built locally and uploaded with `vercel deploy --prebuilt --prod --yes`. Production site and Worker health both return HTTP 200, and Worker CORS preflight returns an empty HTTP 204. `npm run build`, `vercel build --prod --yes`, Worker dry run, and `git diff --check` pass. A two-client test against the local Worker confirmed a participant contribution is durably stored and appears in the facilitator's open board and participation view. A production two-client session has not been run against a real user invite.

This is snapshot-based collaboration with revision conflict checks, not an object-level CRDT: concurrent edits to the same field or same element can still resolve by last update, while independent elements and contributions are merged. Cursor sharing, live drag interpolation, binary image assets, account identity and audit-grade authorship remain future work. The local role-preview selector remains a walkthrough aid; the room capability on the server is the actual write boundary.

**Invite-flow release (6 October 2026, commit `8204efc`):** the staging Worker `fieldnotes-room-staging` (version `dfc067dc-ddff-4bc6-9ed1-c205efec96c2`) passed live API checks for bootstrap, invite creation without seat reservation, redemption, same-member retry, rejection of a different member token, the 20-participant cap, revocation releasing a seat, and final room state. Vercel Preview `dpl_HAePVSp3iw7QT8WRrp3zx5MUZRSg` built with `VITE_ROOM_SERVICE_URL` set to staging, and the deployed bundle was checked for the staging endpoint. Production Worker version `ae737db9-fc66-45f8-81f9-87ff592e5442` and Vercel deployment `dpl_2TCQFMkydkRroGCxYpKJYF6uq6AB` are live; the Vercel deployment is aliased to `https://dt.teachmeai.in`. Live read-only checks confirmed site HTTP 200, bundle HTTP 200 with the production Worker endpoint and no staging endpoint, and Worker `/health` HTTP 200. `npm run build` and `git diff --check` pass. `.vercelignore` excludes local `tmp/` artifacts and Markdown docs from deployment uploads. A browser-level two-device shared-board walkthrough and load test remain outstanding.

**Sync control update (1 October 2026):** the Board now has a visible `Save & sync` action. It cancels the canvas debounce, persists the latest board snapshot, queues it over the authenticated room WebSocket, and reports success after the latest queued revision is accepted. The Worker broadcasts accepted revisions to connected room members; members who are offline receive the latest accepted snapshot when they rejoin. Checkpoint saves now enqueue their updated document too. The header and guide identify `Local only` until the root board connection has joined a shared room; simulated participant avatars were removed. The local production build and local-only UI state were verified. The client was deployed as Vercel deployment `dpl_9FL7Eh2o17PVTWa9R7eeFaUsuAFo`, which is READY and aliased to `https://dt.teachmeai.in`; a live read-only check confirmed the updated `Save locally` state loads. The latest manual-save fanout still needs a two-browser run with a freshly generated participant invite before it can be called end-to-end verified.

Historical note, superseded by the current progress above: this earlier snapshot predates invite expiry/redemption, member revocation and room pause/close enforcement. Account-backed identity, durable asset synchronization and complete audit export remain gaps. Do not describe the room as production-secure collaboration or the local role preview as secured permissions. The service is a low-cost pilot path; free-tier availability/limits may change.

## Current workspace UI refresh

The board remains the visual anchor. The application shell uses a dark ink-blue rail and header, warm paper guide, pale board field, restrained blue and ochre accents, compact mono-like section labels, and original FieldNotes branding. This adapts the clear hierarchy and editorial character of FANOUT.SH to a workshop workspace; it is not a pixel copy of that site.

The two side panels are the cycle/method rail and the method guide/iteration inspector. Both have explicit controls in the board heading, accessible names/expanded state, and saved collapse preferences. On compact screens (up to 1180 CSS px), if a user has no saved preference both panels start collapsed so the board is visible. Opening either panel uses a drawer; a dimmed outside-click target closes both. On phones the controls reduce to icon buttons while retaining assistive-technology labels. The panel state remains user-controlled and is stored in this browser. Full-screen board mode remains a separate immersive option.

The visual goal is an intentional FieldNotes experience: clear reading order, paper-like work surfaces, understated facilitation cues, responsive drawers, and the Excalidraw canvas as the open work area. The current CSS refresh is a first implementation of that direction and still needs direct visual review at desktop/tablet/phone widths and keyboard/screen-reader review.

## Code map

| Area | Key files |
| --- | --- |
| Application shell, Excalidraw adapter, method switching | `src/main.tsx`, `src/canvas.css`, `src/responsive.css`, `src/fieldnotes-shell.css` |
| Book-sourced stages and activities | `src/data/activity-templates.ts`, `src/data/method-blueprints.ts`, `src/domain/activity-model.ts`, `src/domain/blueprint-model.ts` |
| Structured participation and facilitation | `src/components/MethodParticipateView.tsx`, `src/components/ParticipateView.tsx`, `src/components/StructuredMethodComposer.tsx`, `src/components/FacilitatorControls.tsx`, `src/components/DotVotingPanel.tsx` |
| Iteration, report, export, carry-forward, history | `src/components/LocalIterationShell.tsx`, `src/components/IterationReport.tsx`, `src/components/CarryForwardPanel.tsx`, `src/components/ActivityHistory.tsx`, `src/domain/local-iteration-shell.ts`, `src/domain/local-workspace-bundle.ts`, `src/domain/carry-forward.ts` |
| Local workspace storage and board event semantics | `src/domain/workspace-persistence.ts`, `src/domain/board-events.ts` |
| Local room session and remote connection | `src/components/LocalRoomSessionPanel.tsx`, `src/domain/local-room-session.ts`, `src/domain/remote-room-service.ts`, `src/domain/collaboration-protocol.ts`, `src/domain/collaboration-client.ts` |
| Cloudflare room service | `worker/index.ts`, `worker/README.md`, `wrangler.toml` |
| Product and AI strategy | `IMPLEMENTATION_PLAN.md`, `AI_STRATEGY.md`, `AI_CO_DESIGN_PRACTICE_REVIEW.md` |

## Verification and releases recorded

- Prior implementation notes record successful `npm run build` runs and browser walkthroughs across the cycle/method surfaces, sticky-note participation, dot voting, local iterations, portable bundle, room presence, and several viewport sizes. These are historical checks; they are not proof that every current branch/state or device was tested.
- Latest client release: Vercel deployment `dpl_Ah8kmtCbHgViQbn1NykUCZBg7Pcm` is READY and aliased to [`dt.teachmeai.in`](https://dt.teachmeai.in). It contains the responsive shell, collapsed-by-default compact layout, outside-click drawer close, and screen-reader names for both panel toggles.
- `npm run build` passes after the UI refresh. Reloading the production page at `https://dt.teachmeai.in/?activity=reflection` confirmed the Board view opens first and the cycle/guide controls are present and named in the accessibility tree. A screenshot-level compact-device review and a full keyboard-focus pass remain outstanding.
- Required before calling the team-collaboration milestone complete: inspect compact/desktop layouts visually, exercise both panel toggles and persisted state at different widths, verify keyboard focus and accessible names, and complete a two-browser shared-board edit/reload/conflict walkthrough.

## Remaining work, in priority order

1. Complete end-to-end board/activity synchronization: client submits versioned activity/board document changes and checkpoints; reconnect loads accepted server revision; edits reconcile with clear conflict/reload behavior; successful save UI reflects server acknowledgements; observer writes are rejected at both UI and server.
2. Finish room lifecycle and invitation hardening: add revocation/rotation for unused invites, validate configured activity/iteration on every join/update, add rate limits and a restrictive origin policy, and document/review member-token storage and recovery. Decide whether identity/accounts are needed for this pilot.
3. Add authenticated durable storage for iteration and assets, or explicitly keep the pilot as browser-local boards plus remote presence. Align user-facing copy and `IMPLEMENTATION_PLAN.md` with the chosen boundary.
4. Validate the refreshed shell visually on desktop, tablet, phone portrait/landscape; verify drawer focus/escape/backdrop behavior, browser zoom, keyboard access, reduced motion and large text. Test with actual iOS Safari/Android Chrome before making device-gesture claims.
5. Run a complete seven-stage iteration walkthrough, create a second iteration, preserve the first, export/re-import its portable bundle, print its report, and verify meaningful event history and voting.
6. Reconcile older plan milestones that now describe already implemented local features while keeping unimplemented account access, remote synchronization, lifecycle security, and real-device checks open.
7. Consider the accepted AI protocol/BYOK roadmap only after the dependable human workflow and sharing boundary pass their acceptance checks.

## Source documents and project decisions

- `IMPLEMENTATION_PLAN.md` is the detailed product/architecture plan; its dated progress notes are historical and this status record is the current summary.
- `PROJECT_KNOWLEDGE.md` is the durable decision and handoff log.
- `AI_STRATEGY.md` and `AI_CO_DESIGN_PRACTICE_REVIEW.md` describe the accepted later AI direction, not shipped product features.
- The original supplied books are `/Users/irfan/Downloads/TheDesignthinkingtoolbox-wiley.pdf` and `/Users/irfan/Downloads/Design Thinking is a .... (Teun den Dekker).pdf`. Their source files and illustrations are not shipped as app assets.
