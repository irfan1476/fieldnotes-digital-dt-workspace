# Project knowledge

Updated: 6 October 2026.

## Source of truth

Detailed plan: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

Current implementation handoff: [MULTI_ROOM_IMPLEMENTATION_HANDOFF.md](./MULTI_ROOM_IMPLEMENTATION_HANDOFF.md) — independent concurrent online facilitator rooms, 20 participants per room, implementation status, remaining gaps, and acceptance/load-test gates. The invite-redemption milestone is committed and deployed; full two-device board sync and load verification remain open.

Consolidated implementation inventory and current limitations: [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md). This is the latest summary of shipped/local behavior versus the remote-collaboration gaps; older dated entries below are a historical decision and implementation log.

AI product/architecture proposal: [AI_STRATEGY.md](./AI_STRATEGY.md).

Recent practice and standards review: [AI_CO_DESIGN_PRACTICE_REVIEW.md](./AI_CO_DESIGN_PRACTICE_REVIEW.md).

## Confirmed direction

- Build a team design-thinking web application in a few focused sessions.
- Methodology must derive exclusively from the two supplied books; no inspiration from the user's other projects.
- Primary navigation: Understand, Observe, Define point of view, Ideate, Prototype, Test, Reflect. Stages remain revisitable.
- Complete-cycle collaboration and documentation for each iteration are essential.
- FANOUT.SH is the requested visual reference. Homepage and `/ai/overview` were visually inspected on 24 September 2026.
- Reference details: light `#F7F7F8` background, `#272727` text, white paper-like cards, raised buttons, monospace labels, coloured directory cards; Overused Grotesk and Departure Mono observed in computed styles. Obtain font licences from official sources before bundling.
- Excalidraw is selected due to its MIT licence and its local integration is verified. Authenticated room collaboration now has an invite-redemption path and production Worker, but two-device board sync is still to be validated. Unity is outside initial scope.

## Sources

- `/Users/irfan/Downloads/TheDesignthinkingtoolbox-wiley.pdf`
- `/Users/irfan/Downloads/Design Thinking is a .... (Teun den Dekker).pdf`
- Extracted working text and selected rendered pages are under `tmp/pdfs/`. These are research intermediates, not app assets.

## Current state

**Current status (6 October 2026):** the Vite/React/TypeScript application contains seven book-grounded design-thinking stages and 14 methods, method-specific Excalidraw layouts, participation/review flows, iteration/checkpoint/report/export paths, and authenticated Cloudflare room revisions. The invite-redemption and 20-participant cap implementation is committed as `8204efc` and deployed to Cloudflare and Vercel production. See `IMPLEMENTATION_STATUS.md` for release evidence and collaboration limits.

- Workspace redesign: `src/fieldnotes-shell.css` establishes an ink-blue/paper FieldNotes shell with the board as the visual anchor. Both the cycle rail and method guide have accessible collapse controls and browser-local preference persistence. On compact screens with no saved preference, both start collapsed; opening either drawer exposes an outside-click close target. `npm run build` passes; the local browser accessibility tree shows the board-first shell and labelled controls. Compact visual and keyboard-focus review remain open.
- Deployment note (1 October 2026): sync-enabled client is live at `https://dt.teachmeai.in` (Vercel `dpl_J2SoY7EuGt8PHPBLdSQm7WcTJ8Z6`); Worker version `3d882719-307f-4419-9b17-b565f25b1ae0` is live at `fieldnotes-room.dtworker.workers.dev`. Production site/Worker health returned HTTP 200 and CORS preflight returned 204. Local two-client sync passed; two-client verification with a real production invite remains open.
- Invite release (6 October 2026): staging Worker `fieldnotes-room-staging` version `dfc067dc-ddff-4bc6-9ed1-c205efec96c2` passed live API checks for invite/no-seat, redemption, idempotent retry, conflicting token rejection, 20-participant capacity, revocation and seat release. Staging Vercel Preview `dpl_HAePVSp3iw7QT8WRrp3zx5MUZRSg` built with the staging Worker URL embedded. Production Worker version `ae737db9-fc66-45f8-81f9-87ff592e5442` and Vercel deployment `dpl_2TCQFMkydkRroGCxYpKJYF6uq6AB` are live; `https://dt.teachmeai.in` is aliased to the deployment. Live production site, bundle and Worker health checks returned HTTP 200; the bundle references the production Worker and not staging. `npm run build` and `git diff --check` pass. A real two-device production invite/session and load test remain outstanding. There is no Git remote configured; deployment used the linked provider CLIs.

- First implementation pass is now scaffolded as a Vite + React + TypeScript workspace.
- `src/domain/activity-model.ts` and `src/data/activity-templates.ts` encode the seven book-grounded stages and eight initial team activities with source/page metadata.
- `src/main.tsx` provides the FANOUT-inspired team workspace shell, cycle rail, typed activity context, Excalidraw canvas, explicit local/shared-room status, immediate Save & sync control, export boundary, iteration snapshots, facilitator role controls and review history.
- `src/canvas.css` contains the visual system and canvas styling; `package.json` includes the MIT-licensed Excalidraw package.
- `bun install` and `npm run build` pass. The browser was verified at `http://127.0.0.1:5174/` with the interactive Excalidraw toolbar, seeded empathy-map quadrants, team notes, iteration history and presence panel rendered without console errors.
- The plan separates confirmed requirements from proposed stack, session scope and open infrastructure choices.
- Initial acceptance: a real team completes two iterations; closed history stays unchanged; saved boards survive reload/restart.
- The local single-client portion of the first build gate is complete. Two-client editing and durable server-backed saving remain outstanding.
- Deferred: private mode, anonymous voting, AI synthesis, 3D, full offline collaboration, enterprise features and full canvas accessibility equivalence.
- Team rules updated 1 October: the user capped rooms at **20 participants**, superseding the former 3–8/12 rule. An additional facilitator seat follows the prior convention and is the proposed implementation default. Participants retain shared contribution permissions; observers/guests are read-only. Ten simultaneous rooms (210 members including facilitators) is a proposed load-test target, not proven capacity.
- Facilitators may change the current method blueprint at the start or end of using that method. Blueprint changes are versioned, visible to all current participants, and preserve prior participant work untouched. A changed blueprint may optionally be saved as a reusable template.
- Board telemetry will capture semantic actions rather than pointer noise. Element creation, deletion, completed text edits, meaningful moves, grouping, voting, status changes, blueprint changes, locking and checkpoint actions become events; micro-movements and keystroke-by-keystroke updates are coalesced or ignored.
- Iteration lifecycle is Started, Working, Checkpoint saved, Team review, Decision recorded, then Closed or Reopened. Autosave remains continuous, with named append-only checkpoints and restore-as-new-version behavior.
- The current local prototype has one fixed `design-iteration-01`; `?activity=...` selects a method only and is not a share or join link. LocalStorage and simulated presence do not synchronize browsers or devices. The hosted design therefore separates a durable design iteration, a live workshop session within it, and an opaque revocable invitation scoped to workspace/iteration membership.
- Correct prior overstatement: AGPL is not categorically incompatible with every closed application; integration-specific obligations matter. No AGPL dependency is selected.
- AI participation recommendations are accepted as a later-stage product requirement. Finish the core human collaboration app first, then add AI-free, on-demand, facilitated-assist and active-co-design modes with participant acknowledgement, contributor exclusion, provenance and human review.
- Bring your own model-provider key is accepted for the later AI stage. Keys must be submitted to and encrypted by the server, represented to clients by opaque IDs, scoped to an owner/project/role and protected by budgets, logging redaction, rotation and revocation. Raw keys must never enter browser persistence, collaboration records, logs or exports.
- Model access will be provisioned through versioned LLM pilot profiles so each provider/model/method-action combination can be evaluated, approved, paused or retired independently.

## Verification of this planning deliverable

### Concurrent online facilitator rooms — 1 October 2026 (agreed scope; implementation ongoing)

- Objective: document a complete implementation handoff for another model. User selected multiple online facilitator-led design-team sessions on one Vercel app, with 20 participants per room. Prior Android-hotspot/laptop LAN exploration remains deferred; no separate router is acceptable for that future option.
- Source inspection: `package.json`, `worker/index.ts`, `wrangler.toml`, room protocol/client/service, workspace/local-room persistence, `src/main.tsx`, room UI and existing implementation records. Existing Vercel frontend and Cloudflare per-room Durable Objects should be extended, not replaced just for room count.
- Key findings: cache keys are not consistently room-scoped; bootstrap conflict handling is not authenticated recovery; invites currently mint members; server participant snapshot writes can carry protected data; status is hardcoded open; request IDs lack durable deduplication; socket identity is in memory despite hibernation API use. These are implementation tasks, not fixes completed in this turn.
- Plan: isolate rooms, implement atomic 20-seat admission and unique redeemed identities, enforce permissions/lifecycle on the server, harden durable sync/recovery, then validate concurrent sessions and measured cost/capacity. Account login, shared cross-room workspaces, binary assets and offline transport are explicit follow-ups or bounded extensions.
- Proposed defaults remain distinguishable from user decisions: one extra facilitator, admitted-membership seat counting, initial 5-observer limit, 24-hour invites, controlled facilitator provisioning, 10-room performance target and stated latency goals.
- Artifact: `MULTI_ROOM_IMPLEMENTATION_HANDOFF.md`; linked from main plan and status. Prior changes in the dirty working tree preserved. Verification for this turn is documentation/source consistency and scoped whitespace checking only; no application build, load test, production inspection or deployment was performed.

### Concurrent rooms implementation started — 1 October 2026

- User explicitly asked to start implementation from the handoff. Added a facilitator action that navigates to a fresh random room ID; explicit room routes now use a room-and-iteration-scoped workspace storage key while old no-room local storage keeps its key.
- Explicit room IDs also namespace the workspace identity used by iteration metadata and the collaboration join context, keeping the browser-local iteration index isolated per room.
- Worker now binds bootstrap room ID to path, validates workspace and requested role at join, checks that revisions target the connected room, prevents generic facilitator invites, and caps allocated active participant credentials at 20 and observers at 5. This is a first safety/capacity slice, not complete admission: invites allocate members immediately and a bearer invite can be reused by multiple devices.
- Room roster shows allocated participant seats separately from active online presence.
- Updated status and implementation handoff. No build/tests/deployment were run in this turn. Critical remaining work: server-authoritative protected mutation policy, invite redemption/expiry/revocation, persisted lifecycle, hibernation-safe authentication, idempotency, independent-room checks and measured multi-room load.
- Continued implementation: Worker now persists room status; enforces facilitator-only status and member revocation; closes revoked sockets; restores WebSocket member identity from Durable Object attachments after hibernation; checks participant document scope/protected state; authenticates new contribution/event actors; enforces each participant's own bounded vote allocation; redacts other open-round ballots; and deduplicates revision request IDs. Client status/revoke controls call these endpoints, and permanent rejections stop retrying while retaining local state. Worker byte bounds apply before JSON parsing and to serialized workspace snapshots. Repeated bootstrap resumes only with the original facilitator token; invalid room reuse is rejected. Connected non-facilitator checkpoint/restore/reset is guarded locally and server-side.
- Invite lifecycle follow-up: invites now expire in 24 hours, are single-use, do not reserve seats at issue time, and redeem into a separate client-generated member capability. The capability is persisted for idempotent retry, and the invite is in the URL fragment and removed from browser history after redemption. Ordinary room-context links strip member credentials.
- Verification: frontend `npm run build` passes after correcting one previously undefined UI reference; standalone strict Worker TypeScript check and Node module syntax import pass; `git diff --check` passes. An ephemeral Node SQLite shim tested invite expiry, single-use/idempotent redemption, 20/21 seats, revoke-and-release and concurrent last-seat redemption. There is no committed test or load-test harness, and Wrangler/local Durable Object runtime tooling is not configured. The SQL behavior checks are not a Cloudflare runtime test. No deployment/live verification was run.
- Remaining limitations: no account-backed identity or lost-device recovery; room payload is snapshot-based rather than CRDT; large binary assets are not synced; separate rooms do not share a common project workspace; method/iteration conflict policy and multi-room capacity remain unmeasured. See the handoff for the prioritized acceptance checklist.

### Sticky-note board clarity repair — 24 September 2026

- User reported that the Post-it/sticky-note simulation on the Excalidraw board was unclear.
- Added a visible Sticky-note workspace bar with note count, Fit board and Add sticky note actions. The guidance now states that observations are entered in Participate and arranged/connected on Board.
- The board now fits the complete method template whenever Excalidraw opens or the template resets, rather than opening zoomed into only part of the four-region map.
- New contribution cards use a stronger yellow note treatment, author initials and a Sticky note label. Board text is wrapped to three compact lines; the complete contribution remains available in Participate and Review.
- Repaired the Participate-to-Board lifecycle: a newly added contribution is loaded into a remounted Excalidraw instance, missing note elements are reconstructed from semantic contributions, and stale unmounted canvas instances no longer receive structured contribution updates.
- Verification: `npm run build` passes. Browser testing at `http://127.0.0.1:5177/` confirmed the full empathy map is visible, Add sticky note opens Participate, a submitted observation returns as a visible yellow card, text wraps, authorship appears, and the note count updates.

### Generative AI strategy — 24 September 2026

- User requested an explicit strategy for generative AI across individual/team design thinking, method-specific model roles, agents, background assistance, and UI placement.
- Proposed in `AI_STRATEGY.md`: one method-aware assistant with bounded specialist functions and fast/deep model routes, optional retrieval/media capabilities, evidence-linked suggestions, human acceptance, and checkpoint-based continuity. MoE architecture is distinct from app-level specialist roles and reasoning capabilities.
- Proposed UI: desktop Assist inspector, selected-contribution actions, mobile/tablet sheet, checkpoint review, and project learning summary. Proposed first slice: empathy-map guidance, assumption checks, themes with evidence, and follow-up questions; later connect insights and framing candidates.
- Earlier blanket AI deferral is being revisited; pilot inclusion and provider/budget/data-policy choices remain proposed/open. No AI feature, provider integration, data upload, or deployment was performed.
- Superseded inspection note: `src/main.tsx` was absent during this earlier AI-strategy audit. It now exists; Participate is integrated and the current build/runtime evidence is recorded under Touch participation implementation below.
- Researched primary sources on agent/workflow distinctions, MoE architecture, retrieval, reasoning configuration, and AI-assisted design fixation; linked in the strategy. Existing book-only methodological scope is preserved.

### Generative AI co-design practice review — 24 September 2026

- User requested current web research, particularly from 2024–2026, on how GenAI changes design thinking, recommended human–AI co-design frameworks, and standards suitable for teams whose practitioners disagree about AI use.
- Added `AI_CO_DESIGN_PRACTICE_REVIEW.md`. Sources include recent IDEO and Stanford practitioner guidance; CHI/Microsoft nonlinear co-design; a NASA/ASME study of intimate, selective and minimal AI use; research on fixation and collective diversity; the 2025 Co-Creative Design Framework; and NIST, OECD, ISO, EU and C2PA governance/provenance references.
- Proposed requirement: the app supports four explicit activity modes—AI-free, on-demand, facilitated assist and active co-design. The project sets a maximum; activities may be more restrictive. Mode escalation requires renewed acknowledgement from affected active participants.
- Proposed requirement: the complete design-thinking workflow functions without AI. Contributors can exclude individual items from inference, retrieval, embeddings, caches and derived summaries; facilitators cannot override this. The system must disclose when excluded content makes an AI synthesis incomplete.
- Proposed practice rules: preserve human-first divergence by default; treat generated personas as hypotheses rather than research; keep evidence, human interpretation and AI hypotheses as separate types; review suggestions before shared writes; retain provenance and contradictions; give AI no vote, participant seat or decision authority.
- There is no single accepted Design Thinking + GenAI standard. The proposal combines practice evidence with NIST AI RMF/GenAI Profile, 2024 OECD principles, ISO/IEC 42001 themes, EU AI Act literacy/transparency duties and optional C2PA provenance for exported media. No certification or compliance claim is made.
- Updated `AI_STRATEGY.md` and `IMPLEMENTATION_PLAN.md` to reference this participation model. This was documentation and research only; no AI provider, external data transfer or app implementation was added.

### AI protocol and BYOK accepted for later implementation — 24 September 2026

- User accepted the full AI strategy and research recommendations. The former proposal is now a confirmed later-stage direction, while construction of the dependable non-AI web application remains first priority.
- Updated `IMPLEMENTATION_PLAN.md` to version 1.1 with sessions 5–6 for AI governance/BYOK and method-aware assistance. Core sessions 1–4 must pass permissions, revision, closure and AI-free workflow gates before AI work begins.
- Accepted secure BYOK boundary: server-side provider gateway; encrypted secret reference; personal connection by default; explicit shared-team scope; project/role/budget limits; no raw key in browser persistence, logs, telemetry, exports or collaborator-visible data; metadata-only validation; rotation and revocation.
- Accepted versioned LLM pilot profiles with provider/model/capabilities/method actions, limits, data notes, budgets, evaluation version and draft/evaluation/approved/paused/retired lifecycle. Arbitrary custom endpoints are disabled initially.
- Added later-stage data entities, API groups, acceptance checks and risks for participation modes, excluded contributions, provider failures, prompt injection, secret leakage and costs.
- Updated `AI_STRATEGY.md` and marked `AI_CO_DESIGN_PRACTICE_REVIEW.md` as the accepted protocol. No application code or provider connection was added in this documentation turn.

### Touch participation decision — 24 September 2026

- Agreed requirement: tablet and mobile users must meaningfully participate in design iterations through touch, beyond resizing the desktop UI.
- Proposed design added to `IMPLEMENTATION_PLAN.md`, section 6: synchronized Board and Participate views, region-based contribution cards, tap alternatives to dragging, readable guidance, method-specific voting/facilitation and keyboard-aware composition. Phones default to Participate; tablets default to Board, with user choice in both cases.
- Role and blueprint rules apply across devices. Facilitator is an additional seat and may participate; observers are fully read-only. Current blueprint changes remain visible, versioned and preserve earlier participant work; optional reusable template saving is planned.
- Superseded implementation note: this inspection identified touch and persistence gaps. The subsequent implementation repaired field/scene/file persistence, restore behavior and checkpoint retention, and added the synchronized touch participation views described below.
- A design iteration contains activities and checkpoints; a checkpoint alone is not a new design iteration. Proposed lifecycle language above is conceptual, not an implemented state machine.
- Proposed storage evolution: unified versioned IndexedDB persistence for the local phase, later authenticated server persistence and collaboration. Local saves do not sync across devices. Real-device and mixed-device acceptance gates are specified separately.
- Research: official Excalidraw documentation and W3C dragging/target-size guidance linked in the plan. No app code changed in this planning turn; real-device validation remains outstanding.

### Touch participation implementation — 24 September 2026

- Implemented synchronized Board, Participate and Review views for the empathy-map slice. The Participate view offers Say/Think/Do/Feel prompts, contribution cards, editing, deletion and explicit region movement without dragging. Contributions generate linked Excalidraw note elements and survive reload through the shared activity document.
- Added responsive phone/tablet styles, safe-area-aware bottom navigation, 44px touch controls, keyboard-safe text sizing and read-only observer handling. Excalidraw is now dynamically loaded only when Board is opened, keeping the structured participation path lighter.
- Added schema-v2 local persistence with legacy migration, scene/files/fields/contributions, append-only checkpoints, restore-as-new-revision, semantic events and movement filtering/coalescing. The application no longer silently truncates history after eight checkpoints.
- Added role, capacity, iteration-lifecycle and versioned-blueprint contracts plus the empathy-map facilitator-control definition. Participant seats are 3–8 by default, opt-in to 12, with the facilitator as an additional participating seat; observers/guests are read-only.
- Verification: `npm run build` passes. Browser checks confirmed live Excalidraw, contribution creation, board/participate navigation, checkpoint creation, persistence across a fresh tab and no console errors. The integrated browser viewport was 895px wide; real 360–430px phones, iOS/Android gesture behavior and mixed-device realtime remain unverified.

### Facilitated empathy-map vertical slice — 24 September 2026

- Integrated the book-grounded empathy-map facilitator controls into the running workspace: 5/10/15-minute timer, one-at-a-time guided prompts, per-region contribution locks, team-review mode and explicit method completion.
- Added Facilitator as a preview role. A facilitator remains able to contribute and is an additional seat; participants cannot modify the framework; observers remain read-only. Closing a region blocks new cards and modifications in that region while leaving its contents visible.
- Team review pauses contribution and makes the board read-only. Completing the method records a closed status and opens Review without changing participant contributions.
- Review now contains an actor- and action-filtered semantic history. It records completed contribution actions, prompt/lock changes, review/closed status changes and checkpoint saves; it does not record pointer movement or timer ticks.
- Added `src/responsive.css` after the component and canvas styles. Browser validation at 390×844 confirmed the touch contribution path and fixed navigation without clipping. Validation at 768×1024 confirmed the pannable Excalidraw board and usable facilitator controls. Both checks completed without console warnings or errors.
- Production verification: `npm run build` passes. Real iOS/Android gestures, on-screen keyboards, rotation and mixed-device realtime remain hardware/infrastructure checks.

### Core method workspace expansion — 24 September 2026

- Added a shared method registry and book-grounded blueprints for Problem Statement, How Might We, Brainwriting/6-3-5 and Dot Voting. Each method now opens from the cycle rail with its own Excalidraw layout, structured Participate view, facilitator controls, Review view, semantic events, checkpoints and local activity record.
- Problem Statement follows the Toolbox problem/actor/context/current-response prompts before consolidation. How Might We separates evidence/need, candidate questions, scope checking and selected framing. Brainwriting implements six silent build-on rounds plus clustering/carry-forward. Dot Voting separates criteria, candidates, decision and objections/parking-lot records.
- Generalized facilitator controls so the active blueprint supplies the prompts and regions. Region locks, guided prompts, review and completion therefore apply consistently without copying the empathy-map component.
- Added a generic touch participation surface for method-defined regions, including card creation, editing, movement and deletion. Wider methods use an auto-fitting region tab grid; the seven-part Brainwriting surface was visually checked at 390×844.
- Fixed repeated unchanged Excalidraw autosaves with a scene fingerprint guard. A Problem Statement contribution was created, reloaded and recovered from its own local activity record; the empathy-map record remained separate.
- Verification: `npm run build` passes; all eight implemented methods load; Brainwriting exposes all six rounds and carry-forward; no browser warnings or errors were reported.

### Local Dot Voting round — 24 September 2026

- Implemented Dot Voting as application records rather than movable Excalidraw dots. The local round has `setup`, `open` and `closed` states controlled by the facilitator.
- The vote budget defaults to three and is clamped to the Toolbox's typical 1–5 range. Each participant can distribute multiple votes to one candidate or across candidates. Controls disable as soon as the budget is exhausted.
- Open rounds show each participant only their own allocation and remaining budget. Aggregate totals remain hidden until closure to limit bandwagon effects. Closing reveals a sorted tally and highlights the leading candidate; reopening preserves allocations for deliberate adjustment.
- Vote casts and retractions create attributed semantic events. The tally remains distinct from the required decision, rationale and objections fields because the highest count does not automatically become the team's decision.
- Browser verification created two candidates, opened the round, enforced a three-vote maximum, revealed a 2–1 tally, reloaded the page and recovered the closed tally, reopened the round, retracted and recast a vote, and confirmed both vote event types in Activity History. The 390×844 review layout remained usable and the console reported no errors.

### Curated Excalidraw toolbar and sticky-note data contract — 24 September 2026

- User accepted adding the sticky-note decision to the implementation plan and asked that no data be lost when notes are created or when the Excalidraw toolbar is simplified.
- The plan now defines a curated primary toolbar: Select, Pan, Sticky note, Text, Draw, Arrow/connector, Shape, Image/upload, Frame, Eraser, Undo/Redo, Zoom/Fit and Export. Less frequent native tools remain in a labelled More tools/full-tool escape hatch during the pilot; presets may foreground tools by method without changing permissions or deleting elements.
- Sticky note is an application command backed by a semantic contribution plus its Excalidraw elements. The contract preserves contribution identity, activity/iteration, author, region, content, evidence and classification fields, tags/status, timestamps, revision, visibility and AI policy, along with the complete raw element payload, group/bound IDs, geometry, styling, locks, links and file references.
- Copy, edit, move, group, export, reset, restore and migration must preserve the semantic-to-scene relationship. Detached or manually altered notes are reconciled or flagged; they are never silently dropped. Deleted content remains recoverable through checkpoints/version history.
- The visual treatment is a square paper card with focused text entry, permitted colours, author/provenance metadata, rapid entry and touch placement. Product copy uses “Sticky note” rather than “Post-it.”
- This is a planning decision; no toolbar customization or data-model migration was implemented in this documentation update.

### Method-specific board visual design — 24 September 2026

- User asked to use the supplied design-thinking knowledge base to move beyond repeated rectangular card layouts, then specifically pointed to the Toolbox book's linked framework references as examples of each method's intended look.
- Inspected public basic templates linked from the Toolbox site: Problem Statement, Empathy Map, Brainwriting/6-3-5, Dot Voting and I Like/I Wish/I Wonder. The templates show question-led exploration followed by synthesis; multiple user perspectives; the distinct issue → rounds → consolidation → cluster → evaluate sequence; criteria → appraisal → cluster/evaluate → next steps; and an expanded reflection flow with I Like/I Wish/I Wonder/What If.
- Added a source-informed visual grammar to `IMPLEMENTATION_PLAN.md`, with links to these basic templates and a rule to derive original editable layouts rather than copy illustrations.
- Implemented method-specific seeded board geometry in `src/main.tsx`: sequential problem definition, four-region empathy-map layout, asymmetric How Might We funnel, cumulative brainwriting sequence, voting stages, storyboard panels, testing sequence and reflection triad/next step. How Might We includes six source-informed lens markers. Sticky-note placement now follows each region's dimensions.
- Saved scenes are not automatically rewritten. New/explicitly reset boards use the refreshed template; any future saved-board layout update requires a versioned migration preview and a restorable source revision.
- This turn did not run tests/build or browser visual QA. The method compositions need visual review in the local app, especially canvas zoom/readability and fit at mobile widths.

### Fullscreen whiteboard mode — 24 September 2026

- User requires a control to expand the whiteboard to at least 90% of the visible screen and a one-click control to return to the original workspace size.
- Implemented an immersive CSS workspace mode in `src/main.tsx` and `src/canvas.css`: the canvas fills the viewport, surrounding project/workshop panels and view switcher hide, native Excalidraw behavior remains mounted, and a floating board strip retains note count, Fit board, Add sticky note and Exit fullscreen.
- Escape exits fullscreen unless focus is inside a text editor/input. The document scroll is locked only while expanded and restored on exit. The app uses dynamic viewport height and safe-area offsets for mobile.
- Enter/exit changes layout only; it does not reset board data or intentionally alter canvas state. `npm run build` passes. Browser visual QA and touch-device checks remain pending.

- Read relevant book sections and tool references in earlier turns.
- Visually inspected FANOUT homepage and public course overview and sampled rendered CSS values.
- Consulted official Excalidraw integration, licence and room-server references.
- Implementation document and knowledge record are current. The shared local method surface now covers empathy mapping, problem statements, How Might We, six-round Brainwriting, Dot Voting, Storyboard / Prototype, Testing Sheet and Reflection. Dot Voting now has explicit completion validation and tie-resolution capture. Review supports facilitator-selected carry-forward into another method with source revision and blueprint provenance, while the source activity remains unchanged. Next, run the complete local sequence with explicit carry-forward and validate tied-vote completion on a clean browser profile. Realtime collaboration, authentication and server persistence remain the following infrastructure milestone.

### Parallel method expansion and carry-forward — 24 September 2026

- Parallel agents delivered two isolated domain modules: `src/domain/dot-voting-rules.ts` for deterministic tallying, ties and completion validation, and `src/domain/carry-forward.ts` for provenance-preserving copies of contributions and generic outputs.
- Added `src/components/CarryForwardPanel.tsx` with touch-sized selection controls. Facilitators can choose outputs in Review and copy them to another implemented method. Target records are created locally when needed; copied contributions receive new IDs and a manifest records source activity, revision and blueprint version.
- Added book-grounded blueprints for Storyboard / Prototype, Testing Sheet and Reflection. These methods now open through the cycle rail and use the same Participate, Board, Review, checkpoint and role rules as the initial core methods.
- Dot Voting now shows explicit tie state and requires a facilitator resolution. Completing the method is blocked until the round is closed, votes exist, decision/rationale is recorded and objections are acknowledged.
- Verification: `npm run build` passes. Browser checks loaded all expanded methods, opened facilitator Review, carried a selected output into Dot Voting, and displayed Dot Voting completion errors when required records were empty. No console errors were observed.

### Updated board compositions and migration affordance — 24 September 2026

- Audited the running app against the source-informed board visual grammar. The renderer now produces distinct compositions: a sequential Problem Statement, four-region Empathy Map, asymmetric How Might We funnel with six lens markers, cumulative Brainwriting sequence with a cluster ellipse, staged Dot Voting, storyboard shots, testing sequence and reflection layout.
- Visual inspection found that an existing local activity can still contain the earlier repeated two-column scene because saved scenes are intentionally not rewritten automatically. This was a plan/implementation clarity gap: the board did not tell the facilitator why the older geometry remained.
- Made the method-specific compositions the canonical first board layout version (`v1`). On load, a legacy local scene is converted automatically: old template geometry is removed, freeform elements/files/contributions and existing note placement are preserved, missing linked sticky-note elements are reconstructed, and the layout version is persisted. A facilitator fallback action remains for an older browser session already mounted in memory; it checkpoints before applying the same conversion and records a `layout-migrated` semantic event. Observers and participants do not receive an administrative migration control.
- Added responsive wrapping for the migration action row at compact desktop/tablet widths. `npm run build` passes. Browser visual checks confirmed the refreshed How Might We funnel and the existing Empathy Map composition; the Excalidraw toolbar and sticky-note relationship remain intact.
- Remaining design validation: verify migration against a checkpoint restore on a clean profile, then run the complete method sequence at 390px and 768px. Saved boards are still localStorage records; this is not a cross-device migration service.

### Spacious whiteboard regions and resize mode — 24 September 2026

- User feedback: method regions felt constrained because a few sticky notes filled the geometry, and there was no way to enlarge a working area.
- Expanded default region dimensions across all implemented methods, retaining each method's spatial logic and stable region IDs. The Problem Statement sequence, Brainwriting rounds, storyboard frames and other templates now provide substantially more writing area.
- Added a visible **Resize spaces / Done resizing** control to the board context bar. It unlocks only generated method frames so the user can resize them in Excalidraw, then relocks them. Observers and review/completed sessions cannot resize. The frame geometry and mode persist with the board.
- Sticky-note insertion, moving between regions and recovery of missing linked note elements now derive placement from the current frame dimensions. Layout version `v2` migrates older template geometry while retaining contribution records, existing note positions, freeform scene elements and files; the existing migration checkpoint remains available for restoration.
- Updated `IMPLEMENTATION_PLAN.md` to define roomy method spaces and extensibility as a whiteboard interaction requirement. `npm run build` passed. Visual checks for every method and responsive widths remain pending.

### Cycle-to-method navigation alignment — 24 September 2026

- User reported that selecting a design-thinking cycle changed the cycle heading without changing the active method, while the method list continued to offer tools from every other cycle.
- The activity template registry already assigns each implemented method to a Toolbox stage: Problem Statement → Understand; Empathy Map → Observe; How Might We → Define point of view; Brainwriting and Dot Voting → Ideate; Storyboard / Prototype → Prototype; Testing Sheet → Test; Reflection → Reflect.
- Made the active method's registered stage the single source of truth. Selecting a cycle now opens its first implemented method, and the method navigation is filtered to methods in that active cycle. The title, stage context, method links and activity data therefore cannot point at different cycles. Direct `?activity=` links derive the cycle from the same registry.
- Kept the stage/method navigation available on mobile so cycle and method selection remain connected at narrow widths. Updated the implementation-plan acceptance criterion accordingly.
- Validation: `npm run build` and `git diff --check` passed; browser navigation across cycle/method links remains to be checked.

### Excalidraw community-link removal — 24 September 2026

- User requested removal of the upstream Excalidraw GitHub, Follow us/X and Discord destinations from every embedded frame and menu surface.
- Excalidraw 0.18.0 does not expose a public `UIOptions` switch for its Socials menu items. Added a scoped CSS integration override in `src/canvas.css` that hides those upstream link targets and their containing menu group inside the embedded `.excalidraw` root, covering the main menu and dialogs without removing drawing tools, help or workspace controls.
- Verification: `npm run build` passes. Browser DOM and visibility checks confirm the GitHub, X and Discord anchors and the social-link menu group are not visible in the running workspace.

### Freeform board action audit trail — 24 September 2026

- Continued the local implementation plan by covering the missing semantic audit for direct Excalidraw work. Added `src/domain/board-events.ts` to compare successive scenes and derive element-created, element-deleted, content-edited, style-changed, element-moved, grouped, ungrouped and connected events.
- Movement uses the existing eight-pixel meaningful-distance policy. The pending event batch is persisted through `appendSemanticEvent`, so repeated drag/typing snapshots coalesce while pan, zoom and sub-threshold jitter remain absent from Activity History.
- Events use the active actor, activity, design iteration and blueprint version, and the existing Review filters/labels can display them. `npm run build` passes; an interactive drag/shape verification remains part of the next browser walkthrough.

### Vercel preview deployment — 30 September 2026

- Deployed the Vite client as Vercel project `dt-teachmeai` and attached the owned custom domain [https://dt.teachmeai.in](https://dt.teachmeai.in).
- DNS verification reports the domain configured correctly; the production deployment returned HTTP 200 and the hosted Reflection route rendered in the browser.
- At launch, this was a client-only preview without shared rooms; the collaboration milestone below supersedes that limitation.

### Board-first workspace entry — 30 September 2026

- User decision: every workspace and activity URL must open on the **Board** tab, including mobile. Mobile users can still switch to Participate for touch-friendly contribution, but the initial context is always the spatial board.
- Changed `src/main.tsx` to remove the mobile-specific Participate startup default. The hosted Reflection route was redeployed and verified with the Board navigation button carrying the active state.

### FieldNotes product identity — 30 September 2026

- User decision: the product name is **FieldNotes - Digital DT Workspace**.
- Updated the document title, description, theme color, visible workspace wordmark and accessible brand label. Added the minimalist folded-note mark at `public/fieldnotes-icon.svg` and exposed it as the browser favicon and installable web-app icon through `public/manifest.webmanifest`.
- The production Vercel deployment was refreshed and verified on the hosted Reflection workspace. The new FieldNotes wordmark and icon are visible, and the page title reports the new product name.

### Local collaboration and immutable iteration controls — 30 September 2026

- Added a browser-local room/session model with room status, participant records, role labels, simulated presence, and context-bearing room links. The Iteration view now exposes this panel and clearly states that the link does not yet authenticate or synchronize another browser.
- Added local iteration schema v2 with append-only iteration versions, named checkpoints, immutable close records, and successor-based reopen behavior. The Iteration view now exposes checkpoint, close, and reopen-as-successor controls.
- Added structured contribution forms for Stakeholder Map, Customer Journey, and Insight Cards. Their fields are serialized into the existing contribution records, so board rendering, review, export, persistence and carry-forward continue to use one data model.
- Validation: `npm run build` passes. Authenticated cross-device rooms and server persistence remain intentionally outstanding.
- The milestone is deployed as Vercel production deployment `dpl_BcuwN9Z335EwYCRzrFB8oa8Sw9Kk` and verified at `https://dt.teachmeai.in` with the Reflection board, Iteration room panel, lifecycle controls, portable workspace controls, and Stakeholder Map structured composer.
- Added a validated FieldNotes JSON bundle for explicit file transfer of board/activity history, local iteration history, and room context. The Iteration view exposes Export workspace and Import workspace controls; imported data is written to the selected browser workspace and the page reloads to reconcile state.
- Completed a touch/keyboard pass: structured fields have stable labels and required semantics, mobile composers no longer open the keyboard unexpectedly, local controls use 44px targets, room status controls wrap on narrow screens, and focus outlines remain visible.

### Realtime collaboration protocol foundation — 30 September 2026

- Added provider-neutral room protocol types in `src/domain/collaboration-protocol.ts`: authenticated join/leave, role and room status, ephemeral presence, durable revision pointers, optimistic base revisions, acknowledgements, rejection/conflict errors, and bounded reconnect delays.
- Added `WebSocketCollaborationTransport` in `src/domain/collaboration-client.ts`. It joins only after the socket opens, exposes connection state and server events, reconnects with exponential backoff, and never treats a socket connection as authorization.
- For the cost-zero pilot, Cloudflare Workers Durable Objects with SQLite are the selected provider: one object per room holds durable revisions and WebSocket connections while Vercel serves the client. The adapter keeps the provider replaceable; Supabase remains an alternative if conventional account authentication and Postgres become priorities.
- Production deployment `dpl_9qm7TgvGUKN7Ffi9dBAxks7gxLUP` is live. The visible app remains local-first until the provider configuration and server room adapter are connected.
- Added the first cost-zero room server in `worker/index.ts` with one Durable Object per room, SQLite room/member/revision records, signed capability tokens, WebSocket join/presence/revision handling, observer write rejection and optimistic revision conflicts. `wrangler.toml` is configured for SQLite-backed Durable Objects.
- Deployed the worker as `fieldnotes-room` from the logged-in Cloudflare account. Cloudflare returned `https://fieldnotes-room.design-thinking-workspace.workers.dev`; the account still needs its workers.dev subdomain registered before that hostname can complete TLS requests. The client remains local-first until the hostname is reachable and the two-browser room flow is verified.
- The registered hostname is `https://fieldnotes-room.dtworker.workers.dev`. The Iteration room panel supports facilitator bootstrap, participant/observer invite links, WebSocket presence, and room role display.
- 1 October 2026 collaboration fix: wired `src/main.tsx` local persistence to authenticated `room.revision.append`, applied snapshots and accepted revisions into active board/activity state, added retry/conflict handling and merges for independent elements/contributions, and fixed Worker CORS preflight (`worker/index.ts`). The room panel now describes board sync accurately. Local two-client test verified that a participant note appears on the facilitator's open board and participation view.
- Deployed Worker version `3d882719-307f-4419-9b17-b565f25b1ae0` and Vercel production deployment `dpl_J2SoY7EuGt8PHPBLdSQm7WcTJ8Z6`, aliased to `https://dt.teachmeai.in`. Verification: `npm run build`, `vercel build --prod --yes`, Wrangler dry run, `git diff --check`, production site HTTP 200, Worker health HTTP 200, and production CORS preflight HTTP 204. The production domain has not yet been tested with a real participant invite in two clients.
- Remaining collaboration limits: snapshot conflict handling is not CRDT; simultaneous edits to the same field/element may resolve by latest update; no live cursor interpolation or image-file syncing; invite expiry/revocation and account identity remain open. The server-issued capability token is the write permission boundary; local role preview is only a UI walkthrough.

### Local iteration workflow and method chooser — 24 September 2026

- Implemented a searchable method chooser with stage, purpose, and duration filters. Method cards explain when and how to use the method, its inputs, and retained outputs. Planned-only templates are visibly unavailable instead of appearing launchable.
- Added six catalog methods from the supplied Toolbox references: Stakeholder Map, Interview for Empathy, Customer Journey, Insight Cards, Feedback Capture Grid, and Implementation Actions. The app now has 14 launchable methods across seven stages. These additions use the shared local workspace scaffold; stakeholder mapping and customer journey still need richer dedicated interactions.
- Added a local iteration shell to name iterations, start a successor, and return to stored local iterations. Each iteration uses a separate local activity document key, preserving the pre-existing `design-iteration-01` workspace and preventing a new iteration from importing its legacy activity data. The iteration link is a local navigation convenience, not access control or collaboration.
- Added a printable iteration report with a browser Print / Save as PDF path. Added an iteration query parameter so method and stage navigation retains the selected local iteration.
- Validation: `npm run build` and `git diff --check` pass. The running Vite app loaded the stage/method nav and the methods/iteration/report views in browser accessibility inspection. Full end-to-end checks for iteration switching, report printing, preservation of an existing populated browser profile, and responsive/keyboard accessibility remain outstanding.
- Limits: iteration closure is not yet immutable; local storage is not shared across browsers or devices; names/roles remain client-side previews; there is no authenticated membership, durable asset service, or realtime room. BYOK and AI participation modes remain planned, not implemented.
