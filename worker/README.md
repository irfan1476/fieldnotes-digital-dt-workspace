# FieldNotes room worker

This is the FieldNotes room service. Vercel serves the Vite client; this Worker owns per-room membership, SQLite revisions, room status and WebSocket presence. One Durable Object is selected per room ID. Each room admits at most 20 participant identities and 5 observer identities. Invite creation does not reserve a seat; admission is checked atomically when a 24-hour invite is redeemed.

## Deploy

```bash
npx wrangler deploy
```

The first deployment uses a `workers.dev` hostname. A custom `room.dt.teachmeai.in` hostname can be attached later without changing the room protocol.

## Pilot flow

1. Create a random room ID and generate a bootstrap token in the facilitator browser.
2. `POST /rooms/:roomId/bootstrap` with the room context and `x-fieldnotes-bootstrap-token`.
3. Use the returned facilitator token to `POST /rooms/:roomId/invites` for a participant or observer invite. Put the returned `inviteToken` in the URL fragment (for example, `#invite=...`), not its query string.
4. The joining browser generates a separate random member capability and calls `POST /rooms/:roomId/invites/redeem` with `{ inviteToken, accessToken }`. The invite is single-use and expires after 24 hours. Retrying redemption with the same member capability returns that same member; a different capability is rejected. The browser must persist the member capability before opening `wss://.../rooms/:roomId/ws` and sending `room.join`.
5. The first WebSocket message authenticates the member capability; the server never treats a socket connection itself as authorization. WebSocket member identity is attached to the connection so it can be restored after Durable Object hibernation.

Room status changes require a facilitator capability. Participants may update their current activity board/contributions and own open-round votes; protected facilitation fields, other member votes, authored identity, prior revisions and existing history are guarded by the Worker. The browser retains rejected changes locally. The latest invite, capacity and revocation implementation is deployed to a separate staging Worker; these controls have not yet been load tested.

The worker is deliberately provider-specific behind the provider-neutral client protocol.

`POST /rooms/:roomId/members/:memberId/revoke` revokes a participant/observer token, closes its sockets and releases the allocated seat. `POST /rooms/:roomId/status` accepts `open`, `paused` or `closed` from a facilitator. `POST /rooms/:roomId/invites/redeem` atomically validates expiry, single-use state and current role capacity before creating the member identity. Paused rooms can admit members but reject board writes; closed rooms reject redemption and participant joins. Revisions accept a unique `requestId`; accepted revision rows keep that key so retrying the same request returns the original acknowledgement. Participant vote ledgers are redacted until the server stores the round as `closed`.

The invite fragment is removed from the browser URL after successful redemption. The room member capability is still a bearer credential stored in browser local storage; revocation is the current way to invalidate it. Account-backed identity, rate limits, origin restrictions and binary asset synchronization remain out of scope for this pilot implementation.
