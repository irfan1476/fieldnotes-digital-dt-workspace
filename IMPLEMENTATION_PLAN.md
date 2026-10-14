# Team Design Thinking Workspace — Implementation Plan

Version: 1.5 · 30 September 2026
Status: living implementation plan; broad local workflow and room presence pilot implemented, end-to-end shared board synchronization and room lifecycle hardening remain open.
Product name: **FieldNotes - Digital DT Workspace**.

### 1 October 2026 planning addendum — concurrent facilitator rooms

The next collaboration milestone is specified in [MULTI_ROOM_IMPLEMENTATION_HANDOFF.md](./MULTI_ROOM_IMPLEMENTATION_HANDOFF.md). User-confirmed scope: multiple independent online facilitator sessions through one Vercel app, capped at **20 participants per room**. This supersedes the earlier 3–8/12 participant planning limit. The existing frontend/Cloudflare Durable Object architecture is the implementation starting point. Ten simultaneous rooms plus one facilitator per room is a **proposed validation target**, not measured capacity. Offline Android-hotspot/laptop hosting is documented as a deferred option, not part of the immediate online milestone. This addendum is documentation only; older implementation snapshots below must be read against `IMPLEMENTATION_STATUS.md` and the new source-inspected handoff.

## 1. Product intent and decisions

Build one browser application in which a team can investigate a challenge, run design-thinking activities, develop and test concepts, reflect, and preserve each iteration. The central surface is a collaborative whiteboard accompanied by concise guidance and structured outcomes.

The success criterion is a real team completing two documented iterations, returning later, and understanding what changed and why.

### Confirmed requirements

- Methodology and tool content derive exclusively from the two supplied books. Do not import frameworks, branding, or assumptions from the user's other projects.
- Use the Toolbox cycle as the primary navigation: Understand, Observe, Define point of view, Ideate, Prototype, Test, Reflect.
- Treat stages as revisitable workspaces, not sequential gates. Team activity can span stages.
- Support teams, live collaboration, asynchronous contributions, and documented iterations.
- Use FANOUT.SH as the visual reference, including its theme and interface character.
- Build a bounded usable pilot in a few focused sessions. Earlier estimates spanning weeks or months are superseded.
- Minimise canvas licensing dependencies and commercial licence administration.
- Complete the reliable human collaboration application before adding model-dependent assistance. AI is a later implementation stage, not a dependency for completing a design-thinking cycle.
- Adopt the AI participation protocol in `AI_CO_DESIGN_PRACTICE_REVIEW.md`: AI-free, on-demand, facilitated-assist and active-co-design modes; a complete AI-free path; contributor-level exclusion; visible provenance; human review; and no AI vote or decision authority.
- Allow a user to connect a supported language-model provider with their own API key. Route model calls through the application server, protect credentials as secrets, and support explicit project-level selection and budgets.

### Proposed implementation defaults

- Excalidraw is the selected canvas and has passed the local integration proof: live editing, export, local reload persistence, contribution-to-board mapping and observer view mode. Authenticated multiplayer and server persistence remain unproven.
- Default to 3–8 participant seats, manually extendable to 12, plus one facilitator who may also participate. This is a product rule and testing target, not a measured concurrency claim.
- Use one board per activity, collected under an iteration. This keeps boards manageable and makes snapshots and navigation clear.
- Start with four build sessions organised around working outcomes, not fixed durations or an unconditional delivery promise.
- Use a conventional web application. Unity and other game engines are outside the initial build. A future simulation module must be justified by a specific activity.

### Current implementation reality — 30 September 2026

The detailed feature inventory is maintained in [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md). It supersedes older delivery snapshots below when they describe current state.

- The app contains 14 launchable methods across the seven stages, method-specific board layouts, structured participation/review, facilitator controls, semantic local events/checkpoints, local iteration records, carry-forward, portable JSON export/import and a printable iteration report.
- Excalidraw remains the open-source whiteboard. Board/activity content still persists per browser. A context-bearing link does not share local board contents.
- A Cloudflare Durable Object Worker is deployed and connected for room bootstrap/invites and live presence; it stores room membership/token hashes and protocol revisions. Board/activity changes are not yet wired through that protocol, so participants do not co-edit a synchronized server-backed board.
- The current visual refresh adapts FANOUT.SH's editorial hierarchy to FieldNotes: ink-blue navigation/header, warm paper guide, restrained blue/ochre accents and a central open board. Both sidebars have accessible, preference-persisted collapse controls. Compact layouts default to both panels closed when no preference exists and use outside-click dismissible drawers. `npm run build` passes; a local browser accessibility-tree check confirmed board-first landmarks and labelled toggles. Visual compact-device review and keyboard focus checks remain before release.
- The latest workspace refresh is live at `https://dt.teachmeai.in` under Vercel deployment `dpl_Ah8kmtCbHgViQbn1NykUCZBg7Pcm`; production reload confirmed Board-first entry and named cycle/guide controls. This client deployment does not change the room boundary: real board/activity document synchronization remains outstanding.

The remaining implementation order is shared board document integration and acknowledgement/reconnect/conflict handling; invite and room lifecycle security; deployment-aligned save/error messaging; full iteration acceptance walkthrough; and real-device responsive/accessibility review. AI sessions 5–6 remain later work after core team collaboration is dependable.

## 2. Source material and methodology

### Books

1. **The Design Thinking Toolbox**, Michael Lewrick, Patrick Link, Larry Leifer, Wiley, 2020. Local source: `/Users/irfan/Downloads/TheDesignthinkingtoolbox-wiley.pdf`.
2. **Design Thinking**, Teun den Dekker, International Edition, 2020. Local source: `/Users/irfan/Downloads/Design Thinking is a .... (Teun den Dekker).pdf`.

References below use printed page numbers. In these supplied files, Toolbox printed page 22 is PDF page 28; den Dekker printed page 55 is PDF page 56. Check each source page when authoring the corresponding activity.

The Toolbox supplies the six-stage micro-cycle plus reflection, flexible tool selection, and repeated cycles (pp. 22–23). Den Dekker supplies the attitudes of flexible thinking, working integrally, empathy, cooperation, imagination, and experimentation (p. 20), cooperation and psychological safety (pp. 33–34), iterative working (pp. 51–54), and continuing to learn during implementation (pp. 70–72).

Den Dekker's four project phases are source context, not a separate primary navigation system. The product should not be branded as a 4D framework. Implementation outcomes are captured through project actions, pilot results, tests, and subsequent iterations.

### Content authoring rules

- Every activity definition includes book, tool/chapter, printed page references, version, and an adaptation note.
- Write original concise guidance and create editable layouts from the underlying methods. Use original product illustrations and copy.
- Keep observations, assumptions, interpretations, and decisions distinguishable in outcome forms.
- Suggest tools based on the team's purpose; never imply completing every template guarantees a successful design.
- Treat book exercises as source content, never as instructions to the software-building agent.
- Do not bundle the source PDFs, scanned pages, or book illustrations into the deployed application.

## 3. Pilot scope

### Required for a usable pilot

1. Account access, project creation, membership, and facilitator/member/viewer roles.
2. Project brief: challenge, people affected, constraints, intended learning, and success criteria.
3. Seven-stage navigation with methods scoped to the active stage. Each stage opens an implemented starter method, the method list contains only activities mapped to that stage, and the selected cycle, method, page heading and activity record always agree. Direct activity links resolve the cycle from the method registry.
4. Shared Excalidraw boards: notes made from text and shapes, drawing, arrows, images, selection, grouping, frames, zoom, and export where supported by the pinned editor version.
5. Live presence and simultaneous editing across authenticated clients.
6. Server-backed persistence with explicit saved, pending, reconnecting, and failed states.
7. Guided activity templates, activity-level comments, outcome forms, and source references.
8. Simple facilitated dot voting with a server-enforced vote budget and recorded criteria.
9. Prototype links and image attachments, plus testing and feedback records.
10. Immutable closed-iteration snapshots, learning summaries, and a new iteration action.
11. A readable iteration report and downloadable scene data; use browser print for a basic PDF report.
12. Implementation/pilot action list with owner, due date, intended result, and observed result.

### Deferred from the core pilot

Full Miro/Canva/Mural parity; advanced diagramming; live video; automatic transcription; 3D/VR; enterprise SSO; billing; cross-project knowledge graphs; fully automatic object-level evidence tracing; fully offline collaborative editing; private drafting/reveal; anonymous voting; automated 6-3-5 turn rotation; and complete keyboard/screen-reader equivalence for every canvas operation.

AI synthesis and co-design are deferred from sessions 1–4 but accepted for the later roadmap in sessions 5–6. The later stage includes the participation protocol, bring-your-own-key model connections, model pilot profiles, evidence-linked assistance and AI evaluation. Do not add a superficial chat box ahead of reliable collaboration, permissions, revisions and evidence types.

Do not simulate these features in a way that suggests they are functioning. Individual contributions before a meeting and activity comments remain supported within the shared project.

## 4. Initial tool library

Each tool is configuration plus a reusable board layout and outcome schema, rather than a separate custom editor. Timeboxes are adjustable suggestions.

| Stage | Tool | Initial interaction and retained result | Source: printed pages |
|---|---|---|---|
| Understand | Problem statement | Prompt frame; capture challenge, scope, assumptions | Toolbox 49 onward |
| Understand | Stakeholder map | Movable labelled nodes; roles and relationships | Toolbox 83 onward; den Dekker 212 onward |
| Observe | Interview for empathy / interviews | Interview guide and notes; separate quotes from interpretation | Toolbox 57 onward; den Dekker 164 onward |
| Observe | Empathy map | Four editable regions; observations and questions | Toolbox 93 onward; den Dekker 152 onward |
| Observe | Customer journey | Stages and rows for actions, feelings, pain points, opportunities | Toolbox 103 onward; den Dekker 138 onward |
| Define point of view | Insight cards | Finding, evidence reference, implication, uncertainty | den Dekker 162 onward |
| Define point of view | How might we | Question candidates and chosen framing with rationale | Toolbox 125 onward; den Dekker 160 onward |
| Ideate | Brainwriting | Shared worksheet, quiet contribution period, facilitator-led rounds | Toolbox 163–164; den Dekker 128 onward |
| Ideate | Dot voting | Select candidates, criteria and budget; count votes; record decision | Toolbox 159–160 |
| Prototype | Storyboard | Sequential frames with captions and sketches | den Dekker 216 onward |
| Prototype | Prototype to test | Attach a concept, image or link and state what it should teach us | Toolbox 199 onward |
| Test | Testing sheet | Question, criteria, roles, observations and conclusions | Toolbox 213–214 |
| Test | Feedback capture grid | Categorised feedback linked to a prototype version | Toolbox 217 onward |
| Reflect | I like / I wish / I wonder | Structured feedback and next-iteration learning | Toolbox 239–240 |

Implementation actions also draw on Toolbox's road map for implementation (p. 259 onward) and den Dekker's design project roadmap (pp. 146–148). They can initially be a form/list, without another complex canvas template.

A light template or outcome form can cover a stage in the pilot. Adding sophisticated tool automation must not delay a working full cycle.

## 5. FANOUT visual direction

### Inspection record

Inspected on 24 September 2026:

- [FANOUT homepage](https://fanout.sh/): rendered screenshot and computed styles for headings, buttons and course cards.
- [FANOUT AI overview](https://fanout.sh/ai/overview): rendered screenshot and navigation structure.

The reference combines an almost-white background, charcoal text, rounded paper-like surfaces, compact raised controls, monospace labels, generous spacing, and coloured directory cards. Its public overview uses a restrained header, breadcrumb/switcher controls, a navigation hierarchy, and numbered content rows. The homepage has a more expressive composition with floating paper objects and mixed sans-serif/pixel-style typography.

The browser viewport used for inspection was approximately 891 × 836. Full desktop and mobile parity have not been audited. The specification below distinguishes measured styles from proposed adaptations.

### Observed values

| Property | Observed FANOUT value |
|---|---|
| Page background | `#F7F7F8` |
| Main text | `#272727` |
| Secondary text sampled | `#6E6E6E` |
| Surfaces | White |
| Link/announcement blue | `#2E80D9` |
| Course card blue / text | `#2B6E9D` / `#FFF3D8` |
| Course card green / text | `#7FE59A` / `#183525` |
| Course card sand / text | `#F1E8D4` / `#403A2F` |
| Dark card / text | `#1F1F1D` / `#F7EEDC` |
| Main font family | Overused Grotesk, system sans-serif fallback |
| Label font sampled | Departure Mono, monospace fallback |
| Course-card radius | 18px |
| Buttons | Approximately 7–9px radius; subtle shadow and inset bottom edge |
| Hero heading at inspected width | 58px, weight 400 |

### Proposed application tokens

Use the measured neutral palette as the starting point. Set `--border: #E5E5E8`, `--focus: #245FA6`, `--danger: #B42318`, and `--success: #16764B` as proposed app values; these are not claimed as extracted reference values. Verify contrast in implementation.

Use a spacing scale of 4, 8, 12, 16, 24, 32, 48 and 64px. Buttons have 8px corners; content cards 16–18px; pills fully rounded. Main text is 14–16px with a 1.45–1.6 line height. Workspace titles use 28–36px; small metadata uses 11–12px monospace. Reserve 48–64px titles for a compact welcome surface, not the editor.

Obtain fonts from their official distributions and inspect their licences before bundling; do not pull font binaries from FANOUT. Use system sans-serif and monospace fallbacks until that is done. Pixel-style display type is optional decoration for a title, never the font for research notes or dense instructions.

### Applying the theme to our screens

- Project cards and tool-library cards carry the richer blue, green and sand treatments. Stage colours are proposed product tokens, not another design-thinking framework.
- The workshop canvas stays white or near-white with restrained surrounding chrome. Colour inside the board belongs primarily to the team's work.
- Primary actions use charcoal raised buttons. Secondary actions use white raised buttons. Pressed states reduce the shadow instead of introducing large motion.
- Numbered stages and compact monospace activity metadata provide the archive-like feel seen in the reference.
- A welcome screen may use original, lightly rotated workshop artefacts. Decorative movement does not appear in the active workshop.
- Use the product's own name, icons and illustrations. Do not carry over FANOUT's logo, testimonials, customer counts, marketing claims or content.
- Respect reduced-motion preferences, and keep focus indicators visible.

## 6. Screens and navigation

### Project directory

Project cards show title, challenge excerpt, current iteration, last activity, and real member avatars. Actions: create project and resume project. Empty state explains how to invite a team and start a challenge. Avoid fabricated activity or participation counts.

### Project overview

Header: project name and iteration selector. Main content: challenge brief, seven selectable stage tiles, current activities, open questions, and implementation actions. A small team strip exposes roles and membership. Stage states describe work as not started, active, or reviewed; they do not claim a percentage of design quality.

### Workshop

```text
+-----------------------------------------------------------------------+
| Project / Iteration 02        Members       Saving status      Actions |
+-------------------+---------------------------------+-----------------+
| 01 Understand     |                                 | Guide           |
| 02 Observe        |                                 | Outcome         |
| 03 Point of view  |      COLLABORATIVE CANVAS       | Comments        |
| 04 Ideate         |                                 | Sources         |
| 05 Prototype      |                                 |                 |
| 06 Test           |                                 | Activity notes  |
| 07 Reflect        |                                 |                 |
| Activities        |                                 |                 |
+-------------------+---------------------------------+-----------------+
| Selected activity / board title          Zoom / shortcuts / focus mode |
+-----------------------------------------------------------------------+
```

Proposed desktop dimensions: 56–64px header, 220–240px navigation, 300–340px inspector. Both side panels collapse. Tablet and phone participation follow the touch-first strategy below; essential guidance and contribution tools must remain reachable at every width. Breakpoints are layout hints, not permission or capability boundaries.

Preserve Excalidraw editing conventions. Do not override keyboard shortcuts blindly or restyle its internals with brittle selectors. Offer a focus mode that hides application panels.

**Fullscreen whiteboard.** Provide a one-click immersive board mode that gives the canvas at least 90% of the visible viewport, hides the project header, method rail, inspector and view switcher, and keeps Excalidraw's drawing/selection behavior available. A compact floating strip retains Fit board, note count, Add sticky note and a clearly labelled Exit fullscreen action. Exit fullscreen must restore the original workspace layout immediately; Escape is also supported when the user is not editing text. Use the viewport's dynamic height and safe-area insets on touch devices. Entering or leaving this mode changes presentation only; it must not recreate the editor, change the board viewport, selection, draft, data, or save state.

### Curated whiteboard toolbar and sticky-note contract

The application will use a curated toolbar rather than exposing every Excalidraw control at the same prominence. This is a product-level decision about the needs of design-thinking activities, not a claim that the underlying editor cannot support the other tools. The toolbar must retain a visible Select, Pan/hand, Sticky note, Text, Draw, Arrow/connector, Shape, Image/upload, Frame, Eraser, Undo/Redo, Zoom/Fit and Export path. Ellipse, diamond, line, laser/presentation mode, embeds and other less frequent tools can live in a labelled More tools menu or activity-specific overflow. The menu must provide an escape hatch to the full native tool set during the pilot, with usage reviewed before anything is permanently removed.

The embedded Excalidraw surface must not expose upstream promotional or community destinations inside the product shell. GitHub, Follow us/X and Discord links are hidden across the editor's menus and dialogs with a scoped integration style override; drawing tools, help content and the supported editor actions remain available.

Sticky note is an application command, not merely a yellow rectangle. Creating one must atomically create or update a semantic contribution and its Excalidraw representation. The contribution record remains the source of truth for stable ID, activity and iteration, author, region, content, evidence references, observation/interpretation type, tags, status, timestamps, revision, visibility and AI-processing policy. The board adapter must retain the complete raw Excalidraw element payload, group and bound-element IDs, geometry, styling, lock state, links and file references. Copy, move, edit, group, export, reset, restore and migration must preserve the relationship; if a note is detached or manually altered, flag it for reconciliation instead of silently dropping data. Deleted notes remain recoverable through the version/checkpoint history.

The initial Sticky note action should place a square paper card, focus text entry, offer the activity's permitted colours and show author/provenance metadata. It should support rapid repeated entry, keyboard shortcut `S` where it does not conflict with the pinned editor version, tap-to-place on touch devices, and a structured Participate alternative. Excalidraw's native rectangle-plus-text composition remains a valid fallback for freeform work, but only notes created through the application command are guaranteed to carry semantic contribution metadata. Use “Sticky note” in product copy; “Post-it” is a 3M trademark.

Toolbar presets may be method-aware: research methods foreground Sticky note, Text, Draw, Arrow, Image and Frame; mapping methods add Shape and connectors; prototyping foregrounds Image, Embed/link and Frame; testing and reflection foreground Sticky note, Text, Image and export. Presets change visibility and emphasis only; they do not change permissions or discard existing elements. Board, Participate and Review must expose the same underlying records so a participant can use the structured path even when a tool is hidden from the canvas toolbar.

### Source-informed method visual grammar

Do not reuse one two-column card grid as the visual template for every method. Use the supplied book's linked basic templates as references for information hierarchy and spatial logic, then create original editable layouts rather than copying their artwork. The Problem Statement board should support several separate question-led definitions followed by a visible convergence into one broad-but-solvable challenge. The Empathy Map should distinguish evidence perspectives and user pains/gains, while making observation and interpretation clear. How Might We should move from a grounded insight through alternative question lenses to a chosen frame. Brainwriting should show the silent, cumulative round sequence, then consolidation, clustering and evaluation as distinct activities. Dot Voting should separate criteria, appraisal, clustering/evaluation and next steps; vote totals remain governed by the application's vote round. Storyboards should read as sequential shots with room for sketches, captions and speech bubbles. Testing should distinguish the learning question, observable signals, what happened and the next decision. Reflection should give I Like, I Wish, I Wonder and What If distinct roles and retain next steps.

The current renderer uses method-specific board composition, varied proportions and shapes, numbered/process markers and reference-based prompts for HMW. These compositions are the canonical first board layout version (`v1`). The spacious-region update is `v2`: method areas should have enough room for multiple notes and remain freely extensible because a whiteboard is an open working surface, not a fixed form. Participants can use **Resize spaces** to unlock only method-region frames, drag a frame's lower-right handle to expand it, then choose **Done resizing** to lock the frames again. The mode is unavailable to observers and during review/completed activity. New or reconstructed sticky notes use the saved frame geometry. Legacy scenes are converted to the current version on load; conversion replaces only generated template geometry, preserves contribution records, existing note placement, freeform elements and files, and records the current layout version. A facilitator fallback action checkpoints the source before applying an update. The structured Participate/Review surfaces remain accessible alternatives to canvas manipulation.

The present Empathy Map is a four-region adaptation. The linked Toolbox template uses six perspectives (seeing, hearing, thinking/feeling, saying/doing, pains and gains). Treat a six-perspective version as a separately versioned blueprint change: keep prior region IDs and contributions readable, show an explicit mapping/review step for existing work, and never infer that an observation belongs in a new category without preserving its original classification.

### Touch-first participation: tablets and phones

Status: tablet and phone support is a confirmed requirement (24 September 2026). The following interaction and engineering details are proposed implementation choices. These adapt delivery of the book-based methods; they introduce no new design-thinking framework. Success means a phone participant can meaningfully contribute to, review and vote within the same design iteration as a desktop participant.

**One activity, two synchronized views.** Provide Board and Participate views over the same activity records. Board shows spatial relationships in Excalidraw. Participate shows readable contribution cards, the current prompt, region choices and method-specific actions. Neither view creates a separate mobile board. Users can switch at any time; preserve selection, unsent draft and board viewport. Device size never changes the user's role.

| Context | Default experience | Participation approach |
|---|---|---|
| Desktop or tablet with keyboard | Board with collapsible guidance | Spatial editing plus structured contribution controls |
| Tablet with touch or pen | Board with compact controls; guidance opens as a sheet | Tap to contribute, select a region, sketch when desired; landscape and portrait both work |
| Phone | Participate with current prompt and region cards | Compose, edit, classify, vote and review with large touch controls; open Board full-screen for context |
| Shared workshop display | Read-only board overview | Participants use their own devices once authenticated collaboration exists |

**Empathy-map journey.** A phone participant opens the current activity, reads the person/group and prompt, taps Say, Think, Do or Feel, then adds an observation. An optional evidence reference and observation/interpretation label preserve context. A preview shows where the card will appear. Submit creates one contribution and its bound board elements, with author and activity identity. Tapping an existing card opens a readable editor. “Move to…” changes region without requiring precise dragging. “Show on board” focuses the linked element. Draft contributions are personal until submitted; published work follows the shared visibility rules. Drafts are device-local in the first prototype, with no promise of cross-device recovery.

**Direct touch interaction.** Keep Excalidraw's native gestures within the board; verify the installed version on real devices before claiming gesture or pen support. Offer explicit Pan and Select/Draw modes so a navigation gesture does not accidentally move work. Provide Fit activity, Focus region and zoom buttons as alternatives to pinch gestures. Use tap-to-select then an action sheet for edit, move, group and delete; dragging remains optional for structured tasks. Use visible Undo and reversible deletion. Pen sketching is an enhancement; do not promise palm rejection, pressure handling or handwriting recognition before device testing. Do not require hover, long press, stylus, multi-finger gestures or precision handles for core participation.

**Readable, reachable screens.** Use approximately 44–48 CSS-pixel primary touch targets with separation as a product goal, not as a claim about WCAG's minimum. Keep controls labelled, not colour-only. On phones, use a small bottom navigation for Participate, Board and Review, with a contextual Add contribution action. Guidance opens from the current prompt; it must not disappear at a breakpoint. A contribution composer becomes a full-height sheet when the keyboard opens; its text and submit controls remain visible above the keyboard and safe-area inset. Preserve work through orientation changes, browser toolbar resizing and interruptions. Allow text resizing and normal page zoom in structured views. Avoid global scroll/zoom suppression; scope gesture handling to the board.

Workspace entry is consistent across device sizes: every activity URL opens on the Board tab first. Mobile users can switch to Participate from the same navigation, but the initial surface remains the shared spatial context for the team.

**Method-specific participation.** The adapter for each core method declares its regions, contribution types, prompts, permitted actions, facilitator controls and review outputs. Empathy mapping uses region cards; brainwriting uses a prompt and timed contribution rounds; dot voting uses readable candidate cards and remaining vote budget; prioritisation uses explicit category choices plus spatial placement; prototype/storyboard activities offer a focused frame with text, sketch or image contribution; testing and reflection use evidence and feedback cards. Exact rules must follow each method's book references and selected variant. Votes are application records with board badges, not loose dots that can be duplicated to increase a tally. Arbitrary drawings remain viewable on Board but are not automatically interpreted as structured notes.

**Roles and facilitation across devices.** Participants can edit contributions but cannot change the blueprint. Observers, including guests and stakeholders, remain read-only in both views. Facilitators can also participate and occupy one additional seat beyond the 3–8 participant default (manually extendable to 12). On a phone, facilitation uses a separate Controls sheet for method-specific round state, timer, review and voting; participants should not see an administrative toolbar. Blueprint editing is deliberately entered, preferably at method start/end, and always versions the framework while preserving prior participant work. Larger screens can be recommended for complex layout changes without blocking mobile review or essential facilitation. A facilitator may optionally save a modified blueprint as a reusable template. In later live sessions, Follow facilitator changes focus only when the participant opts in and never interrupts active composition.

**Shared model and Excalidraw adapter.** Introduce stable project, designIteration, activity, blueprintVersion, contribution and actor identifiers. Each contribution maps to its rectangle/text/connector IDs, with matching metadata on supported Excalidraw elements. Application records hold contribution content, region, evidence, author and revision; the scene holds geometry and freeform work. Board edits reconcile back to these records, and card edits update the associated scene through supported Excalidraw APIs. Use a single command/reducer path with origin identifiers to avoid echo loops or duplicate events. Preserve supported metadata on copy, reset, export and restore; copied contributions receive new IDs. Detached/deleted or unsupported freeform elements must not silently corrupt contribution records. Verify against the installed package, not unreleased GitHub APIs.

**Meaningful events and saving.** Both views emit the same semantic commands: contribution created, content edited, region changed, group changed, vote cast or withdrawn, blueprint version published, and checkpoint created. Coalesce text edits at completion and a drag at release; ignore small geometry-only jitter using a tested screen-space threshold, but always record an intentional region change. Pan, zoom, viewport focus and keyboard opening are not contribution events. Include actor, activity, design iteration, blueprint version, timestamp, changed IDs and revision context. User activity review filters by actor within a design iteration. Multiple checkpoints within a method do not create new design iterations.

The local Excalidraw adapter now derives the corresponding freeform scene events from successive board snapshots. It records meaningful element creation/deletion, content, style, grouping, connections and movement, uses the eight-pixel movement threshold, and feeds events through the existing coalescing policy so pointer jitter and intermediate drag updates do not become a misleading action history.

Use one versioned persistence service for scene, contribution records, fields, image assets, events and named checkpoints. For the local phase, move growing records/assets to IndexedDB with migration from existing localStorage. Show saving, saved on this device and failed states accurately; do not signal success before a write completes. Save drafts incrementally because mobile browsers may suspend or terminate the page without an unload callback. Storage remains subject to browser deletion/eviction; offer portable export. Restore creates a new version and updates both views while retaining history. Do not silently prune checkpoints after eight saves. Later authenticated collaboration requires a server, authorized writes, deduplication and revision/conflict handling; local storage and simulated presence cannot synchronize phones and desktops. Local role switching is demonstration, not secure authorization.

**Delivery sequence and acceptance gates.**

1. Repair empathy-map persistence: preserve fields on board edits, save current scene state, retain image files, update the live scene on reset/restore, and distinguish activity checkpoints from design iterations. Current source inspection found these gaps; previous build success did not prove persistence correctness.
2. Implement Participate and Board using one empathy-map model. Add regional note creation, editing, tap-based movement, readable guidance and observer behavior. Remove the fixed 1040px body minimum and replace the hidden inspector with accessible sheets. Load the drawing editor only when needed on a phone; participation must remain available while it loads.
3. Add method-specific voting and facilitator controls, semantic activity history and versioned checkpoints. Generalize the adapter to the next core methods only after the empathy-map touch journey passes.
4. Test representative 360–430px phones and 768–1024px tablets in portrait/landscape, desktop keyboard use, browser zoom, large text and screen readers. Real iOS Safari and Android Chrome checks are required for keyboard, gestures, browser suspension and pen behavior; desktop device emulation alone is insufficient.
5. Demonstrate create/edit/move/vote/review without dragging; card-to-board and board-to-card consistency; survival of reload/orientation changes; correct failed-save feedback; preserved image assets; immutable prior versions; and read-only observers. Verify repeated switching causes no duplicate events or blank editor. Run performance checks on a representative 12-participant activity dataset, keeping typing responsive and lists readable.
6. When the backend is introduced, run a mixed-device workshop with desktop facilitator, tablet participant and phone participant (then 12 participants plus facilitator). Test two users editing the same contribution, reconnect during a round transition, expired access and simultaneous votes. Never report this multi-device gate as passed during the local-only phase.

References: [Excalidraw developer documentation](https://docs.excalidraw.com/), [W3C dragging alternatives](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements), and [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum). The touch strategy is product design proposed here; real-device feasibility remains to be verified.

### Tool chooser

Filter by stage, purpose and approximate time. Each card states when to use it, required inputs, team format and retained output. Choosing a tool creates a new activity with a pinned template version; repeated use creates another instance.

### Iteration history and review

Show dated entries with objective, participants, completed activities, learning summary, unresolved questions and next steps. Open an entry to view frozen board snapshots and outcomes. Compare two iterations through their written summaries and thumbnails first; automatic semantic board diffs are deferred.

### Iteration, workshop session and sharing model

The local prototype currently has one fixed iteration (`design-iteration-01`) and one local activity record per method. Opening a URL such as `?activity=reflection` selects a method; it is not a workspace or collaboration link. Checkpoints are named revisions within an activity, and simulated presence is display-only. A second browser or device does not join the same workspace.

The hosted team model must separate three concepts:

- **Design iteration:** the durable container for the challenge, activities, blueprint versions, checkpoints, outcomes, learning summary and next step. A facilitator starts it with an objective and participant roster, closes it into an immutable snapshot, then explicitly creates a successor linked to the predecessor.
- **Workshop session:** a live or asynchronous working window inside an iteration. It has active method, facilitator state, presence and reconnect state, but it does not create a new iteration when a team pauses or saves a checkpoint.
- **Share/join link:** an opaque, revocable invitation scoped to a workspace and iteration. The server resolves the link to an authenticated membership and role; the URL never grants permission by itself. Separate facilitator/member/viewer invitations are preferable to trusting a role query parameter.

For the few-session build, implement this in two steps. First add a local “Start iteration” shell with a generated workspace/iteration identifier, a copyable demo join URL, participant display-name entry and explicit local-only status. Then replace that adapter with authenticated HTTP/WebSocket rooms, server-side membership checks, durable revisions, presence, reconnect handling, invite expiry/revocation and immutable closure manifests. Mobile participants should land in Participate, where adding and reviewing cards does not require precise canvas manipulation; desktop/tablet users can use Board for spatial work and everyone can return to Review.

## 7. Team behaviour and permissions

| Capability | Facilitator/owner | Member | Viewer |
|---|---|---|---|
| Read authorised project and closed iterations | Yes | Yes | Yes |
| Edit open activity boards and outcomes | Yes | Yes | No |
| Add comments and participate in voting | Yes | Yes | No |
| Create activities and add research | Yes | Yes | No |
| Start/close voting and set timer | Yes | No | No |
| Close an iteration or create its successor | Yes | No | No |
| Manage members and roles | Owner | No | No |

Permission checks happen on the server for HTTP and socket messages. A room identifier is not authorisation. Invite links expire and can be revoked; accepting one binds membership to the signed-in user. Do not auto-send invitations without the user's action.

Participants can prepare notes before a meeting and add comments afterward. Facilitation instructions should encourage quiet contribution before discussion. For the first pilot, shared notes and attributed votes are visible; no privacy or anonymity promise is made.

Dot voting has configured candidates, criteria, vote budget and open/closed states. Enforce totals transactionally. Record the team's decision separately from the tally, including objections and the reason for any departure from the highest score.

Accessible forms cover briefs, outcomes, test records, comments and voting. Label controls; provide keyboard navigation, visible focus and text status. Do not rely solely on colour or pointer movement. Full accessible equivalence for freeform drawing remains a known gap to test with participants.

## 8. Technical architecture

These are proposed defaults, not an already installed stack. Pin compatible versions and record the exact dependency/licence inventory during session 1.

| Layer | Proposed choice | Purpose |
|---|---|---|
| Client | React + TypeScript + Vite | Fast web UI development; client-rendered canvas |
| Board | `@excalidraw/excalidraw` | Reuse editing interactions and scene format |
| API and realtime | Node.js service with Socket.IO | Authenticated project APIs and board rooms |
| Durable records | PostgreSQL | Projects, membership, outcomes, revisions and iteration manifests |
| Files | Private object storage; local adapter in development | Images, scene exports and immutable snapshots |
| Authentication | Established maintained authentication library/provider | Secure identity and sessions without bespoke password handling |
| AI gateway, later stage | Server-side provider adapters and job runner | Authorise and route structured AI tasks without exposing provider credentials to the browser |
| Secret storage, later stage | Managed secret/KMS service or envelope-encrypted application vault | Store user-supplied API keys encrypted, audit access and support immediate revocation |
| Verification | Unit/integration checks and two-browser end-to-end tests | Verify persistence, permissions, collaboration and iteration closure |

Hosting and authentication provider are deliberately unresolved until existing infrastructure is known. Prefer a deployment with a long-running WebSocket service and persistent database. Static hosting alone is insufficient. No purchase or deployment is included in this documentation task.

### Current preview deployment

The Vite client is deployed to Vercel as project `dt-teachmeai` with the custom domain `https://dt.teachmeai.in`. This deployment serves the current client build and is useful for visual and usability review. It does not change the collaboration boundary: boards, presence and role preview remain browser-local until the authenticated realtime room and durable server persistence milestone is implemented.

### Integration boundaries

Create a `BoardAdapter` that exposes load, subscribe to local changes, apply remote changes, create template content, export scene, and capture thumbnail. Keep project and activity logic outside the editor. Preserve element IDs within a board. On copy into a new board, remap element IDs and all bindings consistently, or use the editor's supported duplication facilities.

Excalidraw's embeddable package supplies the editor, not our complete collaboration/persistence product. Study the upstream app's reconciliation and collaboration implementation and the room server, then isolate reused code with attribution. Do not assume installing `excalidraw-room` supplies durable storage, membership, or reconnect correctness.

### Collaboration and persistence contract

1. Authenticate the room join, verify membership, and load the server's durable board revision before enabling edits.
2. Separate transient presence/cursors from durable scene content. Do not store other users' selections and viewports in shared document state.
3. Use version-aware element reconciliation, including deletion tombstones, rather than whole-board last-writer-wins replacement. Validate compatibility with the pinned editor version in the spike.
4. Assign server acknowledgement/revision identifiers to accepted durable changes. Mark saved only after durable acknowledgement, not after a socket send.
5. Queue unacknowledged local changes during short interruptions. On reconnect, fetch current state and reconcile; do not overwrite the server with a stale browser snapshot.
6. Store asset bytes durably before confirming a referenced image is saved. Closed snapshots retain immutable asset references.
7. For structured forms, use optimistic revision checks and a conflict message/recovery draft instead of silent overwrites. Collaborative rich-text editing is unnecessary for the pilot.
8. If reliable offline merge is not validated, make the board read-only on disconnect and preserve a recoverable local draft. Display the actual limitation clearly.

The first implementation gate is two independent clients editing different and identical objects, deleting, undoing, reconnecting and reloading against durable state. If this fails, reduce feature scope and resolve it before adding template breadth.

### Later-stage AI and BYOK boundary

The browser sends a newly entered provider key once over TLS to an authenticated server endpoint. The server validates it with a metadata-only connection test, encrypts it immediately and returns an opaque connection ID. The application never writes the raw key to local storage, IndexedDB, analytics, error reports, activity logs or project exports. After submission, the UI displays provider, owner, masked fingerprint, status and last validation time; it cannot reveal the secret.

Personal connections may fund only their owner's requests. A user may deliberately create a team connection if organisational policy allows it; this requires an owner, permitted projects/roles, budgets and revocation controls. Collaborators can see that a connection is available but cannot retrieve its key. Removing or revoking a connection stops new runs and background jobs without deleting the provenance of completed runs.

All inference goes through a provider-neutral gateway that enforces project/activity permissions, the current AI participation mode, contribution exclusions, context limits, rate limits and budgets. The gateway redacts credentials from provider errors and operational logs. Provider-specific adapters translate the application's structured task contract; model output never receives direct database, file-system or arbitrary-network access.

An **LLM pilot profile** is a versioned configuration used to evaluate a model before general availability. It contains provider connection, model identifier, supported capabilities, reasoning/effort setting, context/output limits, approved method actions, data-destination and retention notes, budget, evaluation-set version and release status (`draft`, `evaluation`, `approved`, `paused`, `retired`). Provider-reported capability names are treated as metadata until the project evaluation passes. Custom base URLs are disabled initially; a future self-hosted/OpenAI-compatible option requires an administrator allowlist and network protections against server-side request forgery.

## 9. Data model and API outline

| Entity | Essential fields |
|---|---|
| Project | id, title, challenge, constraints, success criteria, owner, timestamps |
| Membership | projectId, userId, role, status |
| Invitation | projectId, tokenHash, role, expiry, revokedAt |
| Iteration | id, projectId, number, objective, status, parentId, summary, closedAt |
| Activity | id, iterationId, stage, toolId, templateVersion, title, status, outcome, revision |
| Board | id, activityId, sceneSchemaVersion, durableRevision, scene reference |
| Asset | id, projectId, storageKey, mediaType, size, version/hash |
| Comment | id, activityId, authorId, body, createdAt |
| Prototype | id, activityId, versionLabel, URL/asset references, questionToTest |
| Test record | id, prototypeId, criteria, observations, conclusion, limitations |
| Voting round | id, activityId, criteria, candidates, budget, state |
| Vote | roundId, userId, candidateId, count |
| Action | id, projectId, iterationId, ownerId, dueAt, intendedOutcome, actualOutcome |
| Iteration snapshot | iterationId, activity versions, board revisions, assets, outcomes, schema version |
| AI provider connection | id, ownerId, provider, encryptedSecretRef, maskedFingerprint, scope, allowedProjects, status, validatedAt, revokedAt |
| LLM pilot profile | id, connectionId, modelId, capabilities, methodActions, limits, budget, evaluationVersion, releaseStatus, version |
| Project AI policy | projectId, maximumMode, allowedPilotIds, retention, backgroundTriggers, budget, revision |
| Activity AI participation | activityId, mode, purpose, timing, permittedInputs, initiativeRules, acknowledgements, revision |
| Contribution AI policy | contributionId, processingAllowed, setBy, setAt, deletionStatus |
| AI run and suggestion | requester, authorised scope, source revisions, pilot/prompt versions, usage, status, evidence references, limitations, acceptance state |

Every child reference must remain inside its authorised project. Validate ownership of referenced board and asset IDs, not just the outer project URL.

Proposed API groups: projects and membership; invitations; iterations; activities and outcomes; board bootstrap and realtime rooms; assets; comments; voting; prototypes/tests; actions; exports. Later-stage groups add provider connections, LLM pilot profiles, project/activity AI policy, authorised AI runs, suggestion review and usage/budget reporting. Mutation requests carry idempotency keys where retries can create duplicates. Outcome and AI-policy updates carry an expected revision. Return permission, conflict and validation errors distinctly.

## 10. Closing and continuing an iteration

States: `open → closing → closed`. Only a facilitator can initiate closure.

1. Notify connected clients that closure is beginning; flush pending changes and establish a server write barrier.
2. Reject later edits to that iteration with an actionable response; preserve unsent local work for recovery rather than discarding it.
3. Capture the latest durable revisions of all included boards, outcomes, prototype versions, test records, votes, comments and referenced assets.
4. Store a versioned immutable manifest and summary; publish closed status only when the snapshot is complete.
5. If closure fails, report it and return to open safely. A partial snapshot must never appear as a complete iteration.
6. Create the successor with a new ID and selected copied activities. Link copied items to their origin for context. Never mutate the predecessor's snapshot.

The closing summary asks: what did we investigate, what did we learn, what changed, and what do we try next? Record participants and unresolved disagreement. This learning history is distinct from editor undo and autosave recovery.

## 11. Session plan and deliverables

| Session | Implementation work | Exit evidence |
|---|---|---|
| 1 — Visual shell and technical proof | FANOUT-style tokens; project/workshop shell; curated Excalidraw toolbar; semantic sticky-note adapter; one empathy-map template; two-client room and persistence spike | Actual shared edits, reload persistence, sticky-note round trip (create/edit/move/export/restore without metadata loss) and basic reference-style comparison. A local-only demo is labelled as such |
| 2 — Team workspace | Authentication, membership, invitations, authorised room joins, durable assets, activity outcomes and comments, error states | Two distinct users cooperate; unauthorised user cannot read/edit room or files; restart preserves saved content |
| 3 — Complete cycle | Remaining templates, voting, prototype/test records, reflection, implementation actions, iteration closure and continuation | A seeded challenge completes all seven stages and starts iteration 2; iteration 1 stays unchanged |
| 4 — Pilot and refinement | Real team walkthrough, responsive/keyboard checks, collaboration fault cases, toolbar discoverability and accessibility review, report export, visual refinement and fixes | Acceptance checklist passes; sticky-note and freeform-element reconciliation is demonstrated; remaining limits documented honestly |
| 5 — AI governance and model pilots | Participation preflight and four modes; contribution exclusion; evidence/interpretation/hypothesis types; server AI gateway; encrypted BYOK connection lifecycle; pilot profiles; budgets; audit/provenance | AI-free path is complete; a key can be added, used and revoked without client/log exposure; excluded material is absent from model context; pilot evaluation can approve or pause a model |
| 6 — Method-aware assistance | Empathy-map coach, assumption review, evidence-linked themes and follow-up questions; shared suggestion review; checkpoint synthesis; later framing continuity | Users compare AI-free and facilitated runs; every shared suggestion resolves to authorised source revisions; stale/contradictory evidence is visible; no AI action can vote, decide or bypass review |

Historical snapshot (24 September 2026; superseded by the current status above): the local single-client portion of session 1 was implemented and the reusable method surface had begun. The FANOUT-inspired shell, live Excalidraw boards, synchronized local Participate/Board/Review views, semantic local persistence, checkpoint history, role preview, facilitator controls, actor-filtered activity history and touch-responsive styles were present. At that point, two-client rooms and server saving were not implemented.

The product identity is **FieldNotes - Digital DT Workspace**. The shell uses a minimalist folded-note mark, and the same SVG is registered as the browser favicon and installable web-app icon. Every device size retains the compact FieldNotes wordmark while the full descriptor remains available to assistive technology and page metadata.

Implementation update (30 September 2026): the local collaboration proof now includes a room/session panel with explicit local-only boundaries, participant identity, role/status preview, simulated presence and context-bearing invite links. Iteration records now use schema v2 append-only versions, named checkpoints, immutable local closure and successor-based reopening. Stakeholder Map, Customer Journey and Insight Cards use structured contribution forms while retaining the shared contribution/board persistence contract. These additions improve the local team walkthrough; they do not replace the authenticated realtime room milestone.

Implementation update (30 September 2026): Iteration now supports a validated portable JSON bundle for board/activity history, local iteration records, and room context. Import/export is a deliberate file-transfer path for the local pilot and remains separate from authentication or realtime synchronization. The local collaboration controls also received a touch and keyboard accessibility pass with stable labels, required semantics, visible focus, and 44px interaction targets.

Implementation update (30 September 2026): added the provider-neutral realtime room contract and browser WebSocket transport in `src/domain/collaboration-protocol.ts` and `src/domain/collaboration-client.ts`. The contract separates authenticated membership, ephemeral presence, durable revision acknowledgement, conflict responses and reconnect behavior. The transport is intentionally not presented as active collaboration until the server adapter and deployment access exist. Recommended cost-zero pilot path: Cloudflare Workers Durable Objects with SQLite, one object per room, WebSockets for presence and revisions, expiring signed invite links, and Vercel continuing to serve the client. Supabase Auth + Postgres/RLS + Realtime remains the alternative when conventional account authentication is the priority.
- Implementation update (30 September 2026): added `worker/index.ts` and `wrangler.toml` for the cost-zero room pilot. The worker persists room metadata, hashed facilitator/participant/observer capabilities and protocol revisions in a SQLite-backed Durable Object. It is deployed at `fieldnotes-room.dtworker.workers.dev`.
- Implementation update (30 September 2026): verified Worker health, room bootstrap/state persistence and WebSocket join, and wired the Iteration panel to the service through facilitator bootstrap, scoped invite tokens, WebSocket presence and local fallback. The panel was verified with a disposable hosted room. **Board document revision reconciliation is still outstanding:** the app UI does not yet send its activity/board edits to the Worker. Client deployment `dpl_GCcEEZ1rSEzhHDN1VNomhCX8CZX9` was READY and aliased to `https://dt.teachmeai.in` at that time; the current source changes require a separate release.

Implementation update (24 September 2026): the local method surface now also includes Storyboard / Prototype, Testing Sheet and Reflection, each with a book-grounded blueprint, region prompts, structured participation, board seed, facilitator controls, review and checkpoint persistence. Dot Voting completion is gated by a closed round, candidates, recorded votes, decision/rationale, explicit objections acknowledgement and facilitator tie resolution when needed. Review includes a facilitator-only carry-forward panel. Selected contributions are copied into another implemented method as new records with source activity, revision and blueprint provenance; the source remains untouched and the target can reconstruct its board notes on load. This remains local single-browser persistence; it is a workflow proof, not cross-device collaboration.

Implementation update (24 September 2026): the local app now exposes a stage-filtered method chooser, searchable by cycle, purpose and time, with source-grounded usage details and clear unavailable states for unimplemented methods. Six additional book-grounded methods are represented in the catalog: Stakeholder Map, Interview for Empathy, Customer Journey, Insight Cards, Feedback Capture Grid and Implementation Actions. Together, 14 methods are launchable across the seven stages. The local iteration shell can name, start and switch between separate browser-local iterations; each new iteration gets its own activity storage partition while the existing `design-iteration-01` workspace remains readable. A print-ready iteration report provides a PDF path. These are local workflow capabilities only: iteration closure is not yet immutable, data is not shared across browsers, and the report is not a server-backed audit artifact. The generic scaffold for the six added methods still needs richer semantic interactions (for example, draggable stakeholder nodes and a dedicated journey grid).

Historical note: the local workflow has since broadened to all 14 launchable methods, local iteration/report/export, and a room-presence pilot. The original server-backed shared-board, durable application data, access-lifecycle, and real-device verification gates remain open. The refreshed shell is not merely visual polish: its collapse behavior and responsive drawers are part of keeping the board usable across screen sizes; validate it before release.

Sessions 5–6 begin only after the core acceptance gates for permissions, durable revisions, iteration closure and the non-AI workflow pass. BYOK enables model access; it does not relax the participation agreement or provider/data-policy review.

## 12. Verification and acceptance

### Behaviour

- Two independent signed-in browser contexts can join the same board and see each other's edits and cursors.
- Concurrent edits to different objects survive; same-object edits converge according to the chosen reconciliation rule.
- Deletion, local undo and reconnect do not resurrect stale content or erase another member's unrelated work.
- A saved board and its images survive reload and service restart.
- Network loss shows pending/reconnecting status; a failed write never appears saved.
- Viewer and nonmember API/socket/asset access is enforced on the server.
- Vote budgets cannot be exceeded with concurrent requests; closed rounds cannot change.
- Closing while another member edits yields a consistent immutable snapshot or a clear recoverable failure.
- Copying into iteration 2 keeps image and connector references intact and cannot change iteration 1.
- Report export contains the challenge, activities, findings, decisions, tests, next steps and snapshot references.

### Usability and visual quality

- Compare the rendered app with the inspected FANOUT characteristics: neutral palette, tactile controls, monospace metadata, coloured tool cards, spacing and hierarchy.
- Check desktop at 1440 and 1280px, compact/tablet at 1024 and 768px, and mobile reading/forms at 390px. These are proposed test sizes.
- No clipped actions, overlapping panels or missing focus indicators. Board editing shortcuts work without page shortcuts intercepting them.
- A keyboard user can enter an outcome, comment, vote and read an iteration report.
- Text contrast, zoom at 200%, reduced motion and long-content wrapping are checked.
- Test 4–12 participants and a representative board before claiming that capacity. Proposed load case: 300 mixed elements and 10 moderate images; revise from measured performance.

### Product validation

Run one real challenge through two iterations. Ask whether participants can explain the chosen framing, identify evidence behind a decision, find the latest prototype/test results, and recover what changed between iterations. Record facilitator setup effort and participant friction; do not substitute note counts for learning quality.

### Later-stage AI and BYOK acceptance

- AI-free projects and activities make no provider calls and retain the complete workflow.
- Raising an activity's AI mode requires the recorded acknowledgement defined by the participation protocol; lowering it takes effect immediately.
- A contribution marked Do not use with AI is absent from prompts, embeddings, caches and derived summaries; incomplete source coverage is disclosed.
- Raw API keys never appear in browser persistence, application responses after creation, logs, telemetry, reports or collaborator-visible records.
- Connection tests send no project content. Revocation prevents new foreground and background runs.
- Personal and shared connections obey ownership, project, role, rate and budget boundaries. Provider billing remains the authoritative cost record.
- Each released model/action combination passes the pinned evaluation set; changing model, prompt contract or material configuration creates a new pilot version and triggers appropriate re-evaluation.
- Suggestions cite authorised source revisions, display contradictions and limitations, become stale when sources change, and require human acceptance before shared writes.
- Provider timeout, refusal, malformed output, quota exhaustion and revocation leave board editing and saving unaffected.
- Prompt-injection tests confirm that research notes and attachments cannot expand tool access or override application policy.
- Whiteboard tooling is curated around design-thinking work. Sticky notes are semantic application objects backed by complete contribution and Excalidraw element data; hiding a native tool from the primary toolbar must never delete, flatten or orphan existing board data. The full-tool overflow remains available during the pilot until usage and accessibility evidence supports further reduction.

## 13. Risks and responses

| Risk | Response / scope control |
|---|---|
| Multiplayer integration consumes the session budget | Prove it first; reuse upstream mechanisms through a narrow adapter; avoid simultaneous investment in advanced tools |
| Attractive interface hides unreliable saving | Durable acknowledgement and failure states are required before pilot use |
| Canvas feels unfamiliar | Preserve editor conventions; offer short onboarding and prearranged templates |
| Documentation interrupts creative work | Keep capture at activity/iteration level; allow quick notes and later synthesis |
| Exclusive reliance on visual input excludes members | Provide accessible forms, comments, voting and reports; explicitly test remaining canvas limitations |
| Scope expands toward full collaboration-suite parity | Preserve the pilot exclusions and evaluate new requests against the two-iteration acceptance test |
| Templates become rigid or disconnected from research | Keep stages revisitable; source guidance; distinguish evidence from assumptions |
| Reference styling overwhelms the workshop | Expressive project/tool cards, restrained editor chrome and optional focus mode |
| Library/version drift breaks saved scenes | Pin versions; store scene schema versions; test migrations against saved fixtures |
| BYOK secrets leak through browser state or logs | Accept keys only through the authenticated server; encrypt immediately; return opaque IDs; redact logs/errors; test creation, use, rotation and revocation |
| A user-provided key creates unexpected cost | Show the selected pilot and scope before use; enforce app budgets/rate limits; provide usage records; state that provider billing is authoritative |
| Different providers behave inconsistently | Use structured method contracts and versioned pilot profiles; evaluate each model/action combination before approval |
| AI participation pressures dissenting users | Preserve the full AI-free workflow and per-contribution exclusion; require visible mode acknowledgement and never let a facilitator override exclusion |
| AI-generated material is mistaken for research | Maintain separate evidence, interpretation, hypothesis and generated-artifact types; prohibit synthetic users from entering the evidence store |

## 14. Licensing and earlier corrections

Excalidraw's core is MIT-licensed. Retain required notices and inspect bundled dependencies, fonts and assets. This avoids an editor production licence key; hosting and implementation still have costs.

tldraw is source-available under its own production restrictions, so it is not the default for this licence-minimising build. Quickdraw remains an exploratory option; the earlier research found gaps in frames and first-party multiplayer. Unity is not required for this product.

The earlier statement that AGPL is categorically unsuitable for a closed application was too broad. Suitability depends on integration and source-sharing obligations. We prefer the permissive Excalidraw route for simplicity; no AGPL component is selected in this plan.

## 15. Open choices and next action

### Generative AI strategy — accepted later-stage direction, 24 September 2026

See [AI_STRATEGY.md](./AI_STRATEGY.md) for the accepted method-aware AI strategy: model capability routing, bounded assistant roles, individual/team behavior, evidence provenance, background jobs, desktop/mobile placement, evaluation and phased delivery. It starts with empathy-map assistance and reviewed evidence-linked synthesis, then connects insights, framings and iteration learning. It is scheduled after the core team application; no AI service is implemented yet.

The recent-practice review in [AI_CO_DESIGN_PRACTICE_REVIEW.md](./AI_CO_DESIGN_PRACTICE_REVIEW.md) is the accepted participation protocol for future AI implementation: AI-free, on-demand, facilitated-assist and active-co-design modes; a complete non-AI path; contributor-level exclusion from model processing; visible provenance; human-first divergence by default; and no AI vote, participant seat or decision authority. These are adopted product rules informed by 2024–2026 research and recognised AI governance standards, not a claim of universal design-practice consensus or certification.

BYOK is also accepted for the later stage. Users can connect supported providers through encrypted server-side credentials and create versioned LLM pilot profiles. Open choices before session 5 are the initial provider allowlist, secret-management service, default retention policy, organisational sharing rules and deployment jurisdiction. These choices do not block sessions 1–4.

Non-blocking choices: final product name, exact stage accents, and whether the welcome surface needs a separate public landing page. Use neutral working defaults.

Choices needed before a hosted team pilot: deployment target, authentication provider, storage/database credentials and access policy for real research data. These do not prevent a local technical proof.

Next implementation action: complete an end-to-end local walkthrough that creates two iterations, verifies the first remains unchanged, exercises method selection and carry-forward, and prints the report. Then validate `v2` migration/restore and resize persistence against both clean and legacy browser data, followed by 390px/768px checks and keyboard/accessibility review. Real-device iOS/Android gestures, keyboard and rotation remain pilot checks. The next product milestone after that is authenticated realtime rooms and durable server persistence; it requires deployment, authentication and storage choices. AI sessions 5–6 remain later-stage work after the non-AI collaboration and iteration gates pass.

## 16. Technical and visual references

- [FANOUT homepage](https://fanout.sh/) and [public interior overview](https://fanout.sh/ai/overview): visual reference only, inspected in the browser on 24 September 2026.
- [Excalidraw repository](https://github.com/excalidraw/excalidraw) and [MIT licence](https://github.com/excalidraw/excalidraw/blob/master/LICENSE).
- [Excalidraw integration documentation](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/integration).
- [Excalidraw collaboration room server](https://github.com/excalidraw/excalidraw-room).
- [tldraw licence](https://github.com/tldraw/tldraw/blob/main/LICENSE.md).
- The Design Thinking Toolbox linked basic templates used to inform original visual structures: [Problem Statement](https://en.dt-toolbook.com/_files/ugd/fc35c6_5e922b0634be47578e3b285ecb40e2d4.pdf), [Empathy Map](https://en.dt-toolbook.com/_files/ugd/fc35c6_e2a567aa2fa24c35afbc182177a1e476.pdf), [Brainwriting / 6-3-5](https://en.dt-toolbook.com/_files/ugd/fc35c6_5be08a769e2944d88d9455aa797946db.pdf), [Dot Voting](https://en.dt-toolbook.com/_files/ugd/fc35c6_afde7faf07644b109dad6c81849a3b7f.pdf), and [I Like, I Wish, I Wonder](https://en.dt-toolbook.com/_files/ugd/fc35c6_7052b262c2ba4deca05604bc1ac1ee32.pdf). These public basic templates inform structure; their illustrations are not copied.

This plan records inspected reference styling, source-grounded product requirements, implemented proof work and proposed engineering choices. The shared-room MVP is now deployed; production real-user invite testing, real-device testing and accessibility validation remain incomplete.

Implementation update (1 October 2026): closed and deployed the end-to-end shared-board gap. Workspace snapshots flow from the local save path through authenticated Worker revisions and back into connected clients. Local two-client testing confirmed a participant's note reaches the facilitator board and remains visible in the participant activity view. Fixed an invalid 204 CORS preflight response that blocked browser room creation. Worker version `3d882719-307f-4419-9b17-b565f25b1ae0` and Vercel deployment `dpl_J2SoY7EuGt8PHPBLdSQm7WcTJ8Z6` are live; the site and Worker health return HTTP 200, and production preflight returns 204. Remaining limits are snapshot conflict handling (no CRDT/live cursor interpolation), local-preview role labels, no binary asset sync or invite lifecycle controls, and production two-client testing with a real invite.
