# FieldNotes — concurrent facilitator sessions implementation handoff

Date: 1 October 2026. Status: **implementation in progress; isolation/admission foundations in the working tree, not yet validated**.

Read this first for the next collaboration milestone, then `IMPLEMENTATION_STATUS.md` for the current implementation and `IMPLEMENTATION_PLAN.md` for the wider product. This document supersedes older participant limits and single-room assumptions for this milestone. Preserve existing design-thinking content, methods, visual design, accessibility work and user data.

## 1. Confirmed requirements and proposed defaults

**User-confirmed:** multiple facilitators must run their own independent online design-team sessions simultaneously through the same Vercel-hosted app. Cap each room at **20 participants**. A separate Vercel project/deployment per facilitator is unnecessary. The user has since asked to start implementation and continue it; implementation is authorized, but no deployment was requested.

**Proposed implementation defaults, not separately confirmed:**

- One facilitator in addition to the 20 participant seats, matching the existing extra-facilitator convention. A facilitator contributing to the board retains one facilitator identity, not a second participant seat.
- First measured capacity target: **10 concurrent rooms, 200 participants + 10 facilitators = 210 distinct members**. This is a test target, not a provider guarantee, measured capacity, or user-requested hard global limit.
- Participant cap counts non-revoked admitted participant memberships, not WebSockets or invitations. Temporary disconnects preserve the seat; facilitator removal releases it. Rejoining the same identity consumes no additional seat. Pending invitations consume no seat. Enforce admission atomically.
- Observers are read-only and use a separately configured finite cap (proposed initial cap: 5 per room). They are excluded from the baseline 210-member test; test them separately before enabling the additional load. Co-facilitators are deferred.
- Controlled pilot facilitator provisioning before public self-service accounts. A browser-local recent-room list is sufficient for the first pilot; it must not be described as an account-backed dashboard.

## 2. Current implementation: evidence and gaps

Inspected local source on 1 October; deployment IDs and previous validation below are recorded evidence from `IMPLEMENTATION_STATUS.md`, not freshly verified production behavior. The working tree contains extensive pre-existing modified/untracked files; preserve them and do not reset or overwrite unrelated work.

| Area | Existing source / behavior | Required work |
| --- | --- | --- |
| Frontend | React 18, TypeScript, Vite 5, Excalidraw 0.18; `package.json`, `src/main.tsx` | Extend this app; do not rebuild it as Next.js or replace the canvas solely for room support. |
| Hosting | Recorded Vercel client: `https://dt.teachmeai.in` | One deployment serves all room routes. |
| Room backend | `worker/index.ts`, `wrangler.toml`; Cloudflare Durable Objects + SQLite; `idFromName(roomId)` selects one object per room | Retain this partitioning; harden and test it. Vercel is not the current realtime backend. |
| Backend URL | `src/domain/remote-room-service.ts`; `VITE_ROOM_SERVICE_URL`, default `https://fieldnotes-room.dtworker.workers.dev` | Explicit staging/production configuration; no production fallback in isolated tests. |
| Protocol | `src/domain/collaboration-protocol.ts`, `collaboration-client.ts` | Add validated lifecycle, capacity, admission, idempotency and document scope. |
| Sync | `src/main.tsx` publishes workspace snapshots and merges conflicts; Worker stores revisions | Existing two-client local test is recorded. No 20-person or multi-room test exists in this handoff. |
| Local cache | `WORKSPACE_STORAGE_KEY` in `src/main.tsx` is based on default key/iteration, not room; room IDs can fall back to workspace-derived names | Scope all shared-room caches and pending work; prohibit accidental cross-room seeding. |
| Membership at initial inspection | Bootstrap created facilitator; invite creation immediately created a member/token | This gap has since been addressed in the working-tree implementation below: invites redeem into member capabilities. |
| Permissions | Worker blocks observer writes but broadly accepts participant snapshot replacements | Enforce permissions for facilitator-only state, votes, closure and provenance on the server. |
| Room lifecycle | Worker snapshot reports `status: "open"` unconditionally | Persist and enforce pause/resume/close. Local preview controls are not authorization. |
| Recovery | Worker calls `acceptWebSocket`, but authenticated sessions live only in an in-memory Map | Restore authenticated socket metadata across hibernation/restart; test revocation on resumed sockets. |
| History | Every accepted full payload is inserted in `revisions`; latest revision is room-wide | Bound history, separate document identity, and prevent method/iteration overwrites. |

Remaining concrete issues: unused invite revocation/rotation and account recovery are absent; CORS remains wildcard; image-file synchronization is not established. Bootstrap now safely recognizes the existing facilitator only when the presented token matches; another token gets a clear conflict. Check current source before acting: implementation has added revision request-ID deduplication, byte limits and invitation redemption. Treat “cost-zero” descriptions as historical aspirations, not a billing promise.

### Implemented slice (working tree only; 1 October)

- Facilitators can create a new room from Iteration. It gets a random room ID, drops any old room token from the URL, and opens the fresh room route. Starting the shared room then bootstraps that ID on the Worker.
- `src/main.tsx` scopes the activity workspace cache by explicit room ID as well as iteration. Existing no-room local workspace keys remain unchanged.
- Explicit room IDs also namespace the local workspace identity used by iteration metadata and room context, preventing separate facilitator rooms in one browser from sharing a local iteration index.
- Worker bootstrap validates that body room ID matches the Durable Object route; joins validate workspace and server-issued role; revisions must name the connected room; generic invite creation cannot issue facilitator credentials.
- Worker membership caps are 20 participants and 5 observers. Current invites do not allocate seats until redemption, and each redeemed invite yields a distinct member capability. Pending-invite revocation/rotation and account-backed real-person identity remain open.
- The connected room roster labels allocated participant seats separately from active online members to avoid presenting invite allocations as currently online attendance.
- Added facilitator-only server room status changes and member revocation; revoking closes active sockets and releases that allocated seat. Closed rooms reject participant joins, writes and new invites; paused rooms reject writes.
- WebSocket attachments restore member IDs across Durable Object hibernation; the constructor rehydrates non-revoked sessions from SQLite. Open vote ledgers are redacted per participant on snapshots and broadcasts; participant votes are keyed by server member ID, validated against budget/candidates and merged without deleting other members' ballots.
- Participant snapshots are runtime-checked and limited to the selected activity. Protected facilitation fields, blueprints, checkpoints, prior revisions, event history and contribution authorship are checked server-side. New contributions/events receive server-authenticated actor identity. Permanent server rejections remain local and no longer retry indefinitely; policy-closed sockets stop reconnecting.
- SQLite revisions now store a unique request ID and member ID, and replay returns the original accepted revision. Existing revision tables receive additive columns/index on Durable Object startup.
- Repeating room bootstrap with the same facilitator token now returns the existing facilitator identity; a different token cannot silently impersonate that identity or leave the client believing an invalid token is valid.
- Client checkpoint/restore/reset handlers now return early for connected non-facilitators, complementing server rejection; a malformed array-shaped vote allocation is rejected.
- Invites are no longer members when issued. A 24-hour invitation is redeemed through `POST /rooms/:roomId/invites/redeem`, which checks capacity and atomically creates a separate member capability. Retry with the same client-generated member capability returns the same identity; a different capability cannot reuse the consumed invite. Invite tokens are carried in the URL fragment, then removed from browser history after redemption. Ordinary room-context links no longer include a member capability.
- Verification on 1 October: `npm run build` passes (first run caught and fixed an undefined UI reference); strict standalone Worker TypeScript check passes using temporary ambient Cloudflare runtime declarations; Node's type-stripping import check passes; `git diff --check` passes. An ephemeral Node `node:sqlite` Durable Object shim exercised invite creation without seat allocation, one-time redemption, same-token retry, rejection of a second token, expiry, 20/21 seat behavior, revocation seat release, the concurrent last-seat race and concurrent idempotent retry. This checks Worker logic against SQLite but is not the Cloudflare Durable Objects runtime. The repo has no committed test or load-test harness and no Wrangler executable/configured local Worker test environment. No deployment or live-service verification was performed.
- Next: add a reproducible Durable Object integration test harness and load harness; test schema migration, single-use/idempotent redemption, full-room race, expiry, revocation and all allowed participant edits; finish credential recovery/rotation, shared workspace policy and cross-method iteration behavior; measure simultaneous room capacity. Do not claim 10 ×20 as validated.

Recorded current verification: local two-client note synchronization, client build, Worker dry run and production health/CORS checks passed in earlier work. Production two-client invite validation remains open. Latest manual Save & sync changes are recorded as local/undeployed. Recheck the actual tree and deployments before implementation; do not overwrite newer changes with historical artifacts.

## 3. Architecture and identity boundaries

Keep the existing topology: browser → Vercel for app assets; browser → Cloudflare Worker/Durable Object over HTTPS/WSS for authenticated collaboration; each room object owns its room state and SQLite persistence. Add external binary storage only when implementing authenticated assets. No new provider, CRDT library or hosted subscription is required merely to add multiple rooms.

Use distinct IDs for workspace/project, durable design iteration, live session/room, method activity, member, invitation and request. A method change must not create a new room or lose room membership. For the pilot, one room owns its workspace/iteration data scope; concurrent rooms editing the same workspace are deferred. A future shared project backend will need explicit permissions and synchronization across sessions.

- Generate high-entropy room IDs server-side. Room names may repeat; IDs must not. Resolve path ID and stored room identity consistently on every operation.
- Room ID locates a resource; it never grants access. Bind tokens, document IDs, activity IDs and iteration IDs to the authenticated room.
- Proposed document key: `(roomId, workspaceId, iterationId, activityId)`. Keep a room-wide event sequence plus per-document revision numbers. Define explicit snapshot schema versions and migration rules.
- Scope browser cache, tokens, membership, drafts, outbox, iteration metadata and exports by room/workspace/iteration. Namespace personal UI preferences separately. Two rooms with the same method/iteration name must never share content.
- Do not upload existing local documents automatically when joining. The server snapshot is the baseline; only replay mutations created for that exact authenticated scope. Explicit facilitator import creates a new revision after a preview/confirmation.
- On room switching, cancel old listeners/timers, close or detach old transports, and guard late responses with a connection generation ID. Audit root board and room-panel subscriptions to avoid duplicate sockets/state owners.

## 4. User journeys and permissions

**Facilitator:** open the app → create named session → choose/create design iteration → receive room link/QR → monitor admitted members and 20-seat counter → facilitate methods, voting and review → pause/resume → close → reopen read-only/export, or start a successor iteration. Show room name and server-confirmed role throughout. Room closure and immutable iteration closure are different actions and must be labeled accordingly.

**Participant:** open invite → enter display name → redeem invitation for a unique member credential → receive current room snapshot → open Board first → contribute/vote → reconnect as the same member. Display specific states for full room, expired/revoked invite, closed room, network interruption and pending local edits.

**Observer:** redeem an observer invite; can read permitted data but cannot write through REST, WebSocket, imports or direct protocol calls. Local role-preview controls must not offer authority in a live room.

Proposed pilot permissions: facilitator controls invitations/removal, room lifecycle, method controls, voting rounds, checkpoint restore, template reset/change, imports and iteration closure. Participants edit the collaborative board/contributions while open and submit only their own votes within the server budget. All actor IDs/roles for durable events come from authenticated membership. Define contribution edit attribution without trusting client timestamps or actor fields. Enforce existing hidden-vote behavior server-side: hiding totals in the UI is insufficient if raw votes are broadcast before reveal.

## 5. Invitation, admission and ownership design

- Preserve capability-based access for the controlled pilot, with a protected facilitator provisioning path and per-room ownership. Protect room creation against unbounded anonymous creation. Full account login, cross-device facilitator recovery and organization management are a subsequent extension unless already required elsewhere in the repository.
- Proposed endpoints: `POST /rooms` (authorized creation), `POST /rooms/:id/invites`, `POST /rooms/:id/join` (redemption), `POST /rooms/:id/invites/:inviteId/revoke`, `POST /rooms/:id/members/:memberId/revoke`, `POST /rooms/:id/status`, authenticated room snapshot/document reads, existing room WebSocket route. These are proposed contracts; retain compatibility with deployed clients during migration.
- A reusable participant link is an expiring invitation, not a shared member credential. Each redemption creates a unique member and consumes a seat atomically; make retrying a redemption idempotent. Proposed invite lifetime: 24 hours, facilitator can rotate it. Separate observer links. Never mint facilitator invites through the generic participant route.
- Reconnection uses the issued member credential. Multiple tabs share member identity and one seat, with a small per-member connection limit. Prevent duplicate presence and votes. A lost identity on another device requires a new admission or facilitator-assisted recovery; do not silently equate matching display names.
- Store token hashes; do not store secrets in document payloads, reports or logs. Prefer invitation secrets in URL fragments, redeem them and remove them from the visible URL. Exclude credentials from analytics/referrers and export bundles. Member credential storage requires a documented browser threat model; no claim of full account security.
- Revoke active sessions as well as future joins; revalidate persisted membership on hibernation recovery. Persist invite expiry and room status; add facilitator revocation/rotation for unused invitations. Closed rooms reject writes and new participant admissions; existing authorized members can read/export according to role.
- Persist room metadata, members, invitations, document snapshots, revisions and processed request IDs. Admission checks and mutation acceptance must be atomic, including parallel join requests and retries. State transitions must be auditable.

## 6. Synchronization and persistence work

Start by fixing isolation and correctness in the existing protocol. Do not claim the current snapshot merge is a CRDT. A wholesale CRDT migration is deferred unless a focused proof shows the existing approach cannot meet the test gate.

1. Version and validate every message at runtime. Check raw byte limits before parsing; bound collection sizes, nesting, strings and binary payloads. Match room/document context against server-owned records.
2. Move facilitator controls and voting to typed server-validated commands. Broad participant document replacement must not modify protected state. Validate canvas/contribution mutations separately from room, role, vote and iteration metadata.
3. Deduplicate durable changes by authenticated actor + request ID. Persist accepted result and return the same acknowledgement after retries; retries must not duplicate votes, checkpoints or events. Document dedupe retention relative to outbox age.
4. Load an authoritative snapshot, then apply ordered revisions. Handle gaps with resync; do not treat opening a socket as authorization or an acknowledgement. Show “Synced” only when the latest pending change has a durable acknowledgement.
5. Persist a room-scoped outbox and bound retries with backoff/jitter. A disconnected participant may retain drafts, but must not overwrite a newer server snapshot on reconnect. Expired credentials, closure and rejected changes require visible recovery/export paths.
6. Specify conflict behavior for independent element edits, same-element edits, deletions/tombstones, structured fields, contributions and method changes. Server sequence numbers determine durable ordering; preserve recoverable conflicts instead of silently claiming lossless merging. Never merge a full stale workspace over unrelated activities.
7. Store room-level active activity/timebox state separately from activity documents. Distinguish shared content from per-user camera/zoom/selection. Synchronize iteration metadata, checkpoints, closure, carry-forward and reports from server data, not local-only shells.
8. Restore socket session state through Durable Object hibernation attachments/reconstruction using current platform APIs; recheck revoked/expired membership. Test abrupt backend restart and missing acknowledgements.
9. Coalesce drag/typing updates and bound queues. Use deltas/commands where feasible; full snapshots for initial load, periodic checkpoint and recovery. Add revision compaction and backup/restore; preserve named checkpoints and immutable closed iterations. Never delete the only recoverable revision.
10. For the first capacity gate, use notes/shapes/text. Clearly indicate images are not shared until authenticated asset upload/download, room ownership, size limits and reference cleanup are implemented. Do not embed image blobs in every revision.

## 7. Implementation sequence and completion gates

| Phase | Deliverable | Gate before moving on |
| --- | --- | --- |
| 0. Baseline | Reproduce current two-browser sync on local/staging; inventory local versus deployed changes | Record build, Worker validation and fresh invite evidence; export fixtures before migration. |
| 1. Isolation | Unique room creation, scoped storage/routes/documents, safe migration, centralized transport ownership | Two facilitators use identical method names in different rooms; content, tokens, presence and late events never cross. |
| 2. Admission and permissions | Redeemable invites, 20-seat cap, unique members, server role enforcement, protected commands | Concurrent last-seat joins admit exactly one; participant/observer cannot forge facilitator actions. |
| 3. Durable collaboration | Ordered/idempotent updates, safe reconnect/outbox, hibernation recovery, conflict policy, all activities/iterations | Multi-client independent edits survive reload/restart; retries do not duplicate actions; no stale-room upload. |
| 4. Facilitator session UX | Create/join/recent rooms, roster, invitation controls, pause/close, timer/method state, exports | Two complete independent design sessions with role-appropriate UI and retained history. |
| 5. Capacity and operations | Load harness, measurements, budgets, bounded payload/history, diagnostics | Meet the proposed 10 × 20 target or publish measured lower capacity and bottleneck. |
| 6. Staged release | Compatible migrations, configured origins/env, recovery runbook, production smoke validation | Verify separate real invite sessions, rollback path and recorded deployment versions. |

Likely edit map: `worker/index.ts` and new Worker schema/auth/storage modules; `wrangler.toml`; protocol/transport/remote-room-service; `src/main.tsx` room state extraction; persistence/local-room-session/local-iteration-shell/local-workspace-bundle; room/session and facilitator components; method/vote rules and reports as needed. Search all callers and constants for the old 3–8/12-person rule. Update `worker/README.md`, `IMPLEMENTATION_STATUS.md`, the main plan and knowledge record after each completed gate.

## 8. Verification and capacity plan

Existing client command: `npm run build` (`tsc -b && vite build`). No test script or Worker development dependency is declared in the inspected root `package.json`; add reproducible, pinned tooling when implementing. Do not mistake the frontend build for Worker type checking or integration verification. Use an isolated local Worker/staging environment and synthetic data; load tests must not target production by default.

Required correctness tests:

- Room isolation across two tabs, browser profiles, devices, room switches, reused method IDs, imports, cache migrations and forged REST/WS contexts.
- 20 unique participant admissions; 21st rejected; parallel last-seat race; reconnect consumes no seat; multiple tabs do not multiply votes; revocation frees one seat and disconnects all that member's sockets.
- Participant cannot change room roles/status, reveal votes, reset template, restore checkpoint or close iteration by altering a payload; observer cannot write. Hidden votes do not leak through snapshots.
- Invite expiry/rotation, invalid tokens, closed-room join, invalid messages, oversized payload, rate limits, idle unauthenticated sockets, allowed/disallowed origins and invalid document scope.
- Simultaneous independent edits; same-element edit/delete conflicts; duplicate request replay; snapshot consistency across method/iteration changes; durable save acknowledgement; disconnect during send; reconnect after backend hibernation/restart; rejected pending edits remain recoverable.
- Complete design cycle, second iteration, carry-forward, immutable closure, exports and reports; existing local-only workspace survives migration. Mobile participant keyboard/touch and accessible errors/controls remain usable.

Proposed performance gate: ramp 1 → 5 → 10 rooms, each with 20 participants and one facilitator, over a 60-minute workshop simulation. Include staggered joins, a burst of simultaneous joins, mixed note edits/drags/votes, a reconnect storm and a 20% client network interruption. Use a representative fixture (initial proposal: 500 canvas elements and 100 contributions per room), record encoded sizes, and add a near-configured-limit case. Exercise both protocol clients and real browser samples; socket-only tests do not prove rendering performance.

Initial proposed service objectives on a documented representative network: p95 remote committed-update visibility ≤ 1 second, p95 authenticated join-to-ready ≤ 5 seconds, no accepted-write loss after restart, no cross-room events, and no unbounded queue growth. Record p99, conflict/retry rate, bytes, SQLite reads/writes/storage, backend compute, browser memory and reconnect recovery time. Report device/network/test version and distinguish intentional rejection from unexpected failure. Revise targets explicitly if evidence warrants; do not label all simultaneous users as concurrent function invocations.

Cost model must include Vercel asset delivery and any functions, Cloudflare requests/compute/WebSockets and SQLite operations/storage, plus future assets. Full-snapshot fanout is a major risk: approximately `rooms × active editors × updates/sec × encoded update bytes × recipients` in delivered update bytes/sec before provider-specific accounting. History storage grows with accepted updates × payload size unless compacted. Benchmark the actual billing metrics and current plans; do not promise free operation or unlimited rooms. Verify applicable Vercel plan terms for the intended use. Provide budget alerts and a graceful admission policy before raising tested concurrency.

## 9. Release, migration and operational recovery

- Keep current data exportable. Use versioned schema migrations, additive server protocol support and an explicit minimum supported client version where necessary. Browser legacy records remain accessible; never infer their destination room from a default ID.
- Separate development, staging and production room namespaces/bindings and frontend service URLs. Restrict allowed origins while remembering origin checks supplement authentication.
- Log request IDs, room IDs, revision numbers, rejection classes and timings; redact tokens, board content and participant personal data. Document health checks, room diagnostics, backup/restore and credential loss handling.
- Track current snapshot size and revision growth; proposed pilot retention/compaction policy must preserve closed records and be documented before deletion jobs are enabled. Archive/delete semantics and account-backed ownership are open follow-up decisions.
- Before production release, identify exact existing deployments, verify migrations and capture a rollback plan for both client and backend. Avoid destructive rollback of persisted schema. Deploy only under the implementation user's authorization.
- Update documentation with actual tests, measured concurrency, known limitations and deployed versions. No “multi-room ready” claim solely because one Durable Object is named per room.

## 10. Offline and alternative approaches considered

Earlier exploration concerned internet-independent collaboration. The selected immediate milestone is **online multiple rooms**; participants need internet to reach Vercel and the room backend. Different teams need not share one physical hotspot.

Deferred offline design: Android hotspot supplies Wi-Fi; a laptop serves bundled app assets, collaboration backend and storage; invite via Wi-Fi credentials and a local app URL/QR. The existing Cloudflare backend does not automatically run as a LAN service: implement a local adapter/process and persistence, eliminate cloud/auth/font dependencies, plan browser HTTPS requirements, and verify client-to-client reachability. Twenty participants plus a laptop require at least 21 hotspot clients, possibly more for separate facilitator devices. Phone model capacity remains unknown; no guarantee was established. No separate router is allowed by the user's constraint.

Bluetooth, Wi-Fi Direct, fully peer-to-peer networking and a travel router are not required for the selected online plan. Yjs/Automerge/Loro remain possible synchronization alternatives; libp2p/Iroh concern transport rather than complete workshop behavior. Etherpad/Excalidraw standalone deployments are alternatives for narrower use cases, not replacements selected for FieldNotes. Do not implement these alternatives alongside the online milestone.

## 11. Sources and next-model instructions

Primary evidence: inspected repository files named above; user decisions in this conversation; existing status/knowledge records for prior deployment verification. External references from the discussion should be rechecked for current plan limits/API details during implementation:

- Vercel limits: https://vercel.com/docs/limits
- Vercel projects: https://vercel.com/docs/projects
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- Android local-only hotspot: https://developer.android.com/develop/connectivity/wifi/localonlyhotspot

Start with phases 0–1. Preserve the dirty working tree and existing user functionality. Implement and validate the selected online architecture rather than restarting tool selection. Record any material change to proposed defaults (seat accounting, identity, invite TTL, observer cap, initial capacity target) in the established project decision log. Do not treat this handoff as proof of scalability or as implementation/deployment authorization by itself; the next user's implementation request supplies that authority.
