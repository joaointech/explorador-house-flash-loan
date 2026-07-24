# Developer & user feedback — explorador Bridge

Feedback for the sponsor tracks we built on, from actually integrating each SDK during
ETHGlobal Lisbon 2026.

## Hedera (HTS · HCS · Scheduled Transactions · Agent Kit)

**Developer experience**
- `@hashgraph/sdk` (v2.81) was the smoothest of the four integrations — HTS `TokenCreateTransaction`,
  HCS `TopicMessageSubmitTransaction`, and `ScheduleCreateTransaction` are consistent and well-typed.
- Being able to hit **≥2 native services (HTS + HCS + Scheduled) with SDK only, no Solidity** is a
  genuine differentiator — our whole collateral+audit+payout path is contract-free.
- Agentic payments: the pattern of "LLM reasons over state → executes a Scheduled Transaction"
  fit our treasury agent perfectly. A first-class `hedera-agent-kit` example for *conditional*
  disbursement (only after an off-chain verification passes) would have saved time.

**User feedback**
- Scheduled Transactions are a great UX primitive for "release funds once conditions are met" —
  users understand "the payment is scheduled and will settle" better than a raw transfer.

## World (World ID · Identity Check · AgentKit)

**Developer experience**
- IDKit v4 is a big shift from v3 (`proofOfHuman`, `identityCheck`, `IDKitRequestWidget`,
  `useIDKitRequest`). The credential-builder model is powerful but the migration docs for
  v3→v4 verification (`verifyCloudProof` is gone) were the hardest thing to find.
- **Identity Check** (jurisdiction + age attributes) is exactly right for real-estate KYC —
  proving "unique human, resident in PT, 18+" without exposing the ID is the whole pitch.
- **AgentKit angle**: our treasury agent only acts on behalf of a World-ID-verified human. A
  documented recipe for "service verifies a human-backed agent before granting a right/fund"
  would make this track much more approachable.

**User feedback**
- Users loved that KYC reveals *nothing* about their identity beyond the attested claims.

## Sui (Walrus · Seal)

**Developer experience**
- `@mysten/sui` **v2** moved `SuiClient`/`getFullnodeUrl` — the Walrus/Seal peer-dep chain
  (`@mysten/walrus@1.2.9` peers `@mysten/sui@^2.22.1`) now needs `SuiJsonRpcClient` +
  `getJsonRpcFullnodeUrl` from `@mysten/sui/jsonRpc`. This cost us the most debugging time;
  a pinned "Walrus + Sui v2 quickstart" would help a lot.
- Walrus `writeBlob` is clean once the client is constructed. **Seal** is the steeper part —
  the threshold flow needs a deployed access-control Move package (`seal_approve*`), which is a
  lot for a hackathon; we ship AES-GCM as the honest fallback and wire Seal behind config.

**User feedback**
- "My documents are encrypted before they leave my device and I control access" resonates
  strongly for sensitive property/KYC paperwork.

## What we'd build next
- Real Move access-control package so **Seal** gates decryption on the loan being active.
- **The Graph** subgraph indexing the HTS token + HCS audit events to feed the agent's risk model.
- **ENS** name for the treasury agent so counterparties can discover/verify it.
