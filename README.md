# explorador Bridge — home-equity bridge liquidity on Sui

**ETHGlobal Lisbon 2026** · a continuation of [explorador](https://explorador.pt) (irrealista), Portugal's AI real-estate intelligence platform.

In Portugal, buying a new home before selling your current one creates a liquidity gap:
signing the new home's **CPCV** (promissory contract) needs the *sinal* — often 10–20% —
**now**, but your capital is locked in the property you're still selling. Bank bridge loans
are slow and paperwork-heavy.

**explorador Bridge** lets a homeowner collateralize the house they're selling and draw
stablecoin liquidity in minutes — 100% on Sui, auditable end to end:

1. **Sign in** — email / social login via **Privy** → a non-custodial **Sui** embedded wallet (no extension, no seed phrase).
2. **Documents + AI** — upload the *caderneta predial* + ID; **Claude** extracts the tax article, VPT value, address and owner.
3. **World ID eligibility** — **Identity Check** attests `18+` and a `PRT`-issued document (predicates only — the app never receives a name, birth date or document number), and **Selfie Check** proves the document holder is live and hasn't already borrowed against another property. See [WORLDID_TESTING.md](./WORLDID_TESTING.md).
4. **Encrypt & anchor** — documents are encrypted (Seal / AES) and stored on **Walrus**; the document hash is anchored on **Sui** (a `DocumentAnchored` event).
5. **Tokenize** — the house is minted as **HOUSE equity coins** by a published **Move package**, supply pegged 1:1 to VPT (€), held in a shared `CollateralVault` object.
6. **Collateralize & draw** — lock a fraction of the equity; an **AI treasury agent** underwrites the collateral, the World ID attestations and the sybil check, then in **one Sui transaction** prices the draw against a shared lending **`Pool`** (a **utilization-based borrow rate**, à la Aave/Suilend) and disburses **eUSD**.
7. **Withdraw** the liquidity for the new CPCV. Repaid when the old house sells — interest accrues by the **time held** (Sui `Clock`) at the rate locked in at draw, so you only pay for the days you use it (no bank, no paperwork, no origination fee). That interest is booked as protocol yield. Repaying or re-drawing needs a **fresh Selfie Check matching the nullifier bound at origination**, so only the human who pledged the house can settle it.

---

## 100% Sui — Best App Built on Sui

| Sui primitive | Where it lives |
|---|---|
| **Move package** (published to testnet) | `sui/sources/bridge.move` — `HOUSE` coin, `CollateralVault`, shared lending **`Pool`** (utilization → borrow APR), `tokenize` / `anchor` / `lock_and_draw` (prices the draw) / **`repay`** (principal + `Clock`-accrued interest, release collateral, book yield), events; `sui/sources/eusd.move` — **eUSD** mintable USD stablecoin |
| **Programmable transaction blocks** | `lib/sui.ts` — mint+vault, anchor event, `lock_and_draw`+coin transfer in one PTB; `repay` mints principal+interest and releases collateral in one PTB |
| **Shared-object money market** | `Pool` tracks `total_drawn / capacity`; a kinked rate curve (`rate_from_util`) sets the APR every draw reads — our own on-chain lending |
| **Walrus** decentralized storage | `lib/walrus.ts` — encrypted caderneta/KYC blobs |
| **Seal** access-controlled encryption | `lib/walrus.ts` — threshold encrypt before upload (AES-GCM fallback) |
| **Privy** embedded Sui wallet (zkLogin-style abstraction) | `components/WalletProvider.tsx` — `createWallet({ chainType: 'sui' })` |

**Published on Sui testnet:**
- Package: `0xcc680372aec8ef98bd4f1c6dfcc0baf6dbec432f616c917472b76169f94124a3`
- Lending **Pool** (shared): `0x74a9a501955db2a4ebcc00c2e6df34209df7d8bca9b99d4bc2eb0d799912d3cc`
- HOUSE equity coin: `…::house::HOUSE` · **eUSD stablecoin**: `…::eusd::EUSD`
- Verified live txs (Suiscan testnet): tokenize, `anchor`, the agent's disbursement (a real full-value eUSD transfer), and a full `lock_and_draw` → `repay` cycle that **prices the draw at the pool's utilization rate and settles principal + time-accrued interest** all execute on-chain.

Plus chain-agnostic **World ID** (Identity Check eligibility + Selfie Check liveness/sybil resistance) and **Claude** (document parsing + the treasury agent's reasoning).

---

## Design system

The frontend reuses the **explorador** design system verbatim — Sora variable font, brand blue
`#2563eb` / navy `#0F172A`, class-based dark mode, `app/[lang]` pt/en i18n, compass logo.
**Next.js 16 · React 19 · Tailwind v4.**

---

## Run it

```bash
npm install
cp .env.example .env.local     # fill in what you have; everything is optional for the demo
npm run dev                    # http://localhost:3000  (use -p 3007 if 3000 is taken)
```

Open `/pt` (or `/en`) → **Iniciar a ponte / Start the bridge**. Use **"Use demo wallet"** to walk
the full flow without any keys. Each real testnet id links to **Suiscan**.

### The Move package

```bash
cd sui && sui client publish --gas-budget 200000000   # or: npm run sui:publish
```
Copy the printed package id + TreasuryCap into `.env.local` (`BRIDGE_PACKAGE_ID`, `BRIDGE_TREASURY_CAP`, `HOUSE_COIN_TYPE`). Publishing also **shares a `Pool` object** — copy its object id into `BRIDGE_POOL_ID` (it's the created shared object of type `…::house::Pool`; the rate/interest features need it).

### Enabling each integration (all independent)

- **Sui settlement** (real mint / anchor / disburse): set `SUI_SECRET_KEY` (funded treasury) + `BRIDGE_PACKAGE_ID` + `BRIDGE_TREASURY_CAP`. Fund via https://faucet.sui.io.
- **Stablecoin payout**: the treasury mints our own **eUSD** (`EUSD_TREASURY_CAP`) so disbursements are real full-value transfers (thousands of USD). Falls back to Circle USDC (if held) or a symbolic SUI transfer when `EUSD_TREASURY_CAP` is unset.
- **Privy wallet**: `NEXT_PUBLIC_PRIVY_APP_ID` from dashboard.privy.io.
- **Walrus storage**: needs the treasury funded with **WAL** — otherwise a demo blob id is returned (the Sui anchor is still real).
- **AI**: `ANTHROPIC_API_KEY`.
- **World ID**: `NEXT_PUBLIC_WORLD_APP_ID` + `WORLD_RP_ID` + `WORLD_RP_SIGNING_KEY` from the Developer Portal, and one registered action per credential (`NEXT_PUBLIC_WORLD_ACTION_IDENTITY`, `NEXT_PUBLIC_WORLD_ACTION_SELFIE`). The signing key is **server-only** — the client only ever holds an opaque session token, and the disbursement route resolves World ID state itself. Testing on a phone with World App installed needs a public URL (`ngrok http 3000`).

Without keys, each step returns a clearly-marked **demo** result so the flow is always demoable.
World ID is the exception: `WORLD_SANDBOX=1` fakes proofs but paints a loud amber **SANDBOX** badge over the result, so a stubbed verification can never be mistaken for a real one.

---

## Architecture

```
sui/                     Move package (bridge::house) + Move.toml
app/[lang]/              pt|en shell (landing, bridge wizard, loans management, dashboard)
app/api/
  parse-docs/            Claude vision → structured caderneta fields
  store-docs/            Seal-encrypt → Walrus upload → Sui anchor event
  worldid/rp-context/    signs an rp_context per credential (RP key never leaves the server)
  worldid/verify/        verifies an IDKit proof with the Developer Portal → KYC session
  sui/tokenize/          Move `tokenize` → HOUSE coins + CollateralVault
  sui/loans/             list positions (live vault state) + treasury summary
  sui/repay/             Move `repay` → settle eUSD + release collateral (1 PTB), gated on Selfie Check continuity
  agent/disburse/        treasury AI agent → lock_and_draw + eUSD mint (1 PTB)
lib/
  sui.ts  walrus.ts  worldid.ts  kyc-store.ts  agent.ts  ai-parse.ts
components/              Privy wallet + the 6-step wizard + dashboard
```

Secrets stay server-side (Route Handlers only). The wizard persists the position to
`sessionStorage` so the **dashboard** renders it with the full Suiscan-verifiable audit trail.

Built with [Claude Code](https://claude.com/claude-code).
