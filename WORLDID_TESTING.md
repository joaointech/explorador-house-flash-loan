# World ID beta testing — Identity Check & Selfie Check

Testing documentation for the **Identity Check Beta** and **Selfie Check Beta** tracks.
Integration lives in `lib/worldid.ts`, `lib/kyc-store.ts`, `app/api/worldid/*`,
`components/bridge/steps/StepKyc.tsx`. General non-World feedback is in [FEEDBACK.md](./FEEDBACK.md).

SDK under test: `@worldcoin/idkit@4.2.1` (`idkit-core@4.2.2`), Next.js 15 App Router.

---

## 1. What we built and why these credentials

explorador Bridge lets a Portuguese homeowner tokenize the equity in their home
(from the `caderneta predial`, the tax registry document) and draw stablecoin against a
fraction of it. An AI treasury agent underwrites the draw and executes it on Sui.

That means a lending decision, so the identity questions are underwriting questions,
not login questions:

| Question the protocol must answer | Credential | Why it's necessary |
|---|---|---|
| Is this borrower legally able to pledge Portuguese property? | **Identity Check** — `minimum_age: 18`, `issuing_country: PRT` | You cannot pledge a caderneta predial as collateral as a minor, and PT jurisdiction determines which legal regime the lien falls under. Getting this wrong makes the loan unenforceable. |
| Is the document holder actually here, right now? | **Selfie Check** (`require_user_presence`) | Documents get shared and stolen. A live selfie at the moment of pledging is what separates "someone has this credential" from "this person is signing". |
| Has this human already borrowed against another property? | **Selfie Check nullifier** | The core sybil risk: one person taking simultaneous loans across many properties, each underwritten as if it were their only exposure. The RP-scoped nullifier links loans **without identifying anyone**. |
| Months later, is the human repaying or re-drawing the same one who pledged? | **Selfie Check — continuity** | See §1.1. |

Neither credential is used for login. The app has no accounts — the wallet is the
session. Both are risk inputs, and both reach `lib/agent.ts` as underwriting facts.

### 1.1 Continuity: the credential outlives the signup

The selfie nullifier is persisted on the loan at origination (`lib/loans.ts`), and every
later action on that loan re-checks it. One shared guard,
`checkContinuity()` in `lib/kyc-store.ts`, is called by both routes that can move money
on an existing position:

| Action | Guard | Before |
|---|---|---|
| **Repay** (`/api/sui/repay`) | fresh Selfie Check, nullifier must match origination | **a vault id alone triggered it** — anyone who read a Suiscan link could make the treasury settle the eUSD and release someone else's collateral |
| **Re-draw** (`/api/agent/disburse` against an existing vault) | same | a different human could draw against a vault someone else had pledged |

Continuity re-auth is **Selfie Check only** — deliberately not a full re-KYC. The document
attributes were established at origination and a passport doesn't change; what we need to
know months later is *"is this the same person?"*, which is a liveness question. Making
someone re-scan a passport to repay a loan would be a hostile way to ask it.

This is the answer to "not generic login": the same credential is checked three times
against three different questions — eligibility at origination, sybil resistance across
properties, and continuity of person over the life of the loan.

## 2. Data minimization (Identity Check requirement)

**We request predicates, and receive a boolean.**

```ts
// lib/types.ts
export const IDENTITY_ATTRIBUTES = [
  { type: "minimum_age", value: 18 },
  { type: "issuing_country", value: "PRT" },
] as const;
```

Identity Check answers *"do these hold?"* — it returns `identity_attested: true`, not
the date of birth and not the country. We deliberately did **not** request
`full_name`, `document_number`, or `nationality`, even though a lender would
conventionally demand all three, because none of them changes the credit decision.

What the app persists, in full (`lib/kyc-store.ts`, `lib/loans.ts`):

| Stored | Not stored |
|---|---|
| `identityNullifier` (RP-scoped, opaque) | Name |
| `selfieNullifier` (RP-scoped, opaque) | Date of birth |
| `identityAttested: boolean` | Document number / type |
| session timestamps (30 min TTL) | Selfie image, face template |
| | Issuing country as a value |

The treasury agent's prompt in `lib/agent.ts` receives exactly two booleans plus the
sybil result. The prompt states explicitly that it never sees personal data and must
not ask for it — so even the LLM layer can't leak what it was never given.

Sessions expire after **30 minutes**. A liveness proof from last week is not evidence
about who is at the keyboard now.

---

## 3. Developer feedback (SDK / API / docs)

Recorded while integrating, roughly in the order we hit them.

### 3.1 The v3 → v4 migration is the single biggest cliff
`verifyCloudProof` is gone. Our earlier scaffold called
`POST /api/v2/verify/{app_id}` with remapped `{nullifier_hash, merkle_root, proof}` fields.
The v4 answer is `POST https://developer.world.org/api/v4/verify/{rp_id}` with the
`IDKitResult` forwarded **verbatim**. Two changes at once — endpoint *and* payload
discipline *and* `app_id` → `rp_id` — with no migration table we could find.
**Ask:** a "v3 → v4 for existing integrations" page mapping old call → new call.

### 3.2 The verify endpoint is absent from the pages you land on
`/world-id/credentials` and `/world-id/credentials/11` describe what each credential
*is* and how to request it, but neither says how to verify the result. We found the
endpoint via search, not navigation. The credential page is where a developer starts,
so a one-line "verify with:" footer on each would close this.

### 3.3 `allow_legacy_proofs` silently forces two widgets
Selfie Check returns **v3** proofs (`selfieCheckLegacy`); Identity Check is **v4-only**.
So `allow_legacy_proofs` must be `true` for one and `false` for the other, and since
it lives on `IDKitRequestConfig`, the two credentials **cannot share a widget** —
they need two sequential mounts with two separately-signed `rp_context` objects.
This is an architectural consequence and it is nowhere in the docs; we derived it from
the TypeScript types. If you intend apps to combine credentials — and the `all()` /
`any()` constraint combinators suggest you do — this deserves a named section.
**Ask:** state whether a single request can ever mix a legacy and a v4 credential.

### 3.4 Country codes: alpha-2 vs alpha-3 is a silent runtime failure
`issuing_country` wants **ISO 3166-1 alpha-3** (`PRT`). Our existing code used `PT`
throughout, and every Portuguese-facing convention (phone locale, `pt-PT`, TLD) says
`PT`. The type is `string`, so `PT` compiles, ships, and fails at proof time as an
attribute mismatch — indistinguishable from a genuinely ineligible user.
**Ask:** either type it as a country-code union, or reject unknown codes at request
build time with a distinct error.

### 3.5 `identityCheck()` parameters aren't on the credentials index
The `IdentityAttribute` union (`document_type`, `document_number`, `issuing_country`,
`full_name`, `minimum_age`, `nationality`) came from reading
`node_modules/@worldcoin/idkit-core/dist/index.d.ts`. The types are genuinely
excellent — better than the prose — but that shouldn't be the discovery path.

### 3.6 Signing ergonomics: good, with one sharp edge
`signRequest({ signingKeyHex, action })` from `@worldcoin/idkit/signing` is pure JS,
no WASM, and worked first try server-side — this was the smoothest part of the
integration. The sharp edge: **the action is hashed into the signed message**, so one
signature covers exactly one action. With two credentials that means two rp-context
round-trips before the user sees anything. Not wrong, but easy to get subtly wrong by
caching one context and reusing it. A doc note ("one signature per action, never
reuse") would have saved us a debugging cycle.

We also found no guidance on validating the action *server-side* before signing. We
gate it ourselves (`app/api/worldid/rp-context/route.ts` accepts a credential name, not
a caller-supplied action string) — otherwise your RP key signs whatever an attacker asks.
Worth stating as a security note in the docs.

### 3.7 Error codes are excellent; the mapping to user copy is on you
`IDKitErrorCodes` is granular and well-named. `identity_attributes_not_matched` in
particular is the one that matters — it means *ineligible*, not *broken*, and showing
"verification failed" there would be a real UX harm. Every code is mapped to bilingual
copy in `StepKyc.tsx`. **Ask:** ship a default copy table so integrators don't each
invent one, and flag which codes are user-actionable vs. terminal.

### 3.8 Selfie Check availability
Docs say Selfie Check is "currently available to select partners", and the type carries
`/** Preview: contact us if you need it enabled. */`. Fine for a beta, but the failure
mode when it isn't enabled (`credential_unavailable`) reads identically to "user
doesn't have the credential yet" — an integrator can't tell a config problem from a
user problem. **Ask:** distinguish "not enabled for this app" from "user lacks credential".

### 3.9 The widget doesn't speak the language of the market we're testing in
`SupportedLanguage` is `"en" | "es" | "th"`. Our app is fully bilingual PT/EN, and every
user in the target market is Portuguese — so at the exact moment we ask for a document
scan and a selfie, the widget switches to a language the user didn't choose. We pass
`"en"` rather than `"es"`, because serving Spanish to a Portuguese audience reads worse
than serving English.

This directly contaminates our own user testing: checkpoint 8's comprehension probe
measures whether users understood what they shared, and part of that explanation is
rendered in a foreign language. **Ask:** `pt` and `pt-BR`, or let integrators supply
their own copy. For a beta measuring comprehension and consent, the language of the
consent screen is not a cosmetic detail.

### 3.10 What we'd have wanted most
A copy-pasteable **Next.js App Router** example with: the rp-context route, the widget,
the verify route, and nullifier storage. Every piece exists in the docs; assembling the
four took the bulk of the integration time.

---

## 4. User feedback

### 4.1 Protocol

Task given to the tester, verbatim, with no other instruction:

> "You want to borrow €30,000 against your apartment. Start at the bridge page and get
> as far as you can. Say out loud what you think is happening and anything that
> confuses you."

Observer records, without prompting: time per checkpoint, hesitations, re-reads,
questions asked, and any moment the tester looks to the observer for help.

**Drop-off checkpoints** (each one recorded pass / hesitated / failed):

| # | Checkpoint | What we're watching for |
|---|---|---|
| 1 | Understands *why* ID is being asked before pressing the button | Do they read the two explainers, or click straight through? |
| 2 | QR scan → World App opens | Desktop-to-phone handoff, the classic drop point |
| 3 | Identity Check: document scan | NFC/document friction, retries |
| 4 | Returns to browser, notices step 2 of 2 starting | **Our highest-risk moment** — two checks in one step |
| 5 | Camera permission for the selfie | Denial rate, whether the prompt is understood |
| 6 | Selfie capture + liveness | Lighting, retries, glasses/mask |
| 7 | Sees the "Eligible" state and understands it's done | |
| 8 | Comprehension probe (below) | |
| 9 | **Continuity**: on the loans page, presses Repay and accepts a *second* selfie | Does re-auth read as reasonable protection, or as the app distrusting them? |

Checkpoint 9 runs in a separate session, ideally on a different day, so the tester
experiences the return-visit selfie the way a real borrower would.

**Comprehension probe**, asked after completion, before showing them the answer:

> "What did you just share with this app?"

This is the whole data-minimization thesis under test. A tester who answers *"my ID"*
or *"my face"* means our copy failed, even though the app technically received neither.
The target answer is some form of *"only that I'm over 18 and Portuguese — not who I am."*

### 4.2 Results

| Checkpoint | Tester 1 (self-test, iOS, desktop→phone) | Tester 2 | Tester 3 |
|---|---|---|---|
| 1 · Understands the ask | | | |
| 2 · QR → World App | | | |
| 3 · Identity Check | | | |
| 4 · Notices 2nd check | | | |
| 5 · Camera permission | | | |
| 6 · Selfie capture | | | |
| 7 · Understands completion | | | |
| 8 · Comprehension probe | | | |
| 9 · Continuity re-auth (repay) | | | |

> **Status:** the table above is filled from a live run against a real Developer Portal
> app on a phone with World App installed — see "How to run a session" below. Rows are
> left blank until that run happens; we do not report numbers we didn't observe.

### 4.3 Design decisions already made from anticipated friction

Recorded here because they're testable claims, not post-hoc rationalization:

- **Two explainer cards before the button, not after.** Consent for a document scan
  needs to be informed *before* the camera opens. The card for the active check
  highlights, so checkpoint 4 has a visual anchor.
- **"1 · Identity Check" / "2 · Selfie Check" labelling.** Directly targets the
  two-checks-in-one-step risk: without numbering, the second QR reads as a failure
  of the first.
- **`identity_attributes_not_matched` gets eligibility copy**, not error copy: *"Your
  World ID doesn't meet the eligibility requirements for this loan (18+ with a
  Portuguese-issued document)"*. Telling an ineligible user their verification
  "failed" invites them to retry forever.
- **The minimization sentence appears twice** — before verification (to inform consent)
  and after (to reinforce it, right where the comprehension probe lands).
- **Bilingual PT/EN throughout.** Every tester in the target market is Portuguese;
  testing consent copy only in English would measure the wrong thing.

### 4.4 How to run a session

1. Fill `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`, `NEXT_PUBLIC_WORLD_APP_ID` in `.env.local`.
2. `npm run dev`, expose it to the phone (`ngrok http 3000` — World App needs a public URL).
3. Run the wizard to step 3 on a laptop, with the tester's own phone.
4. Record against the checkpoint table. Do not help before checkpoint 8.
5. Ask the comprehension probe **before** explaining anything.

`WORLD_SANDBOX=1` bypasses real proofs for UI-only runs. It renders a loud amber
`SANDBOX — not a real proof` badge; any screenshot showing that badge is not test evidence.

---

## 5. Known limitations

- `.kyc.json` is a JSON file, matching the existing `.loans.json` pattern — a hackathon
  store, not a database. Sessions are process-local and not concurrency-safe.
- The sybil check covers loans in *this* deployment's registry only. Cross-protocol
  sybil resistance would need a shared nullifier registry, which is on-chain work we
  didn't attempt.
- Selfie Check credentials are valid 90 days. We re-verify at origination and at every
  repay / re-draw, but nothing forces a re-attestation on a loan that simply sits idle.
- Nullifiers are stored raw. Production should store them hashed with a per-deployment
  salt so a registry leak can't be correlated against another RP's.
