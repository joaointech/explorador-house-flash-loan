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
3. **World ID KYC** — prove a unique human resident in Portugal (Identity Check jurisdiction + age).
4. **Encrypt & anchor** — documents are encrypted (Seal / AES) and stored on **Walrus**; the document hash is anchored on **Sui** (a `DocumentAnchored` event).
5. **Tokenize** — the house is minted as **HOUSE equity coins** by a published **Move package**, supply pegged 1:1 to VPT (€), held in a shared `CollateralVault` object.
6. **Collateralize & draw** — lock a fraction of the equity; an **AI treasury agent** verifies collateral + the World-ID human and, in **one Sui transaction**, records the draw on the vault (`lock_and_draw`) and transfers **USDC**.
7. **Withdraw** the liquidity for the new CPCV. Repaid when the old house sells.

---

## 100% Sui — Best App Built on Sui

| Sui primitive | Where it lives |
|---|---|
| **Move package** (published to testnet) | `sui/sources/bridge.move` — `HOUSE` coin, `CollateralVault`, `tokenize` / `anchor` / `lock_and_draw`, events |
| **Programmable transaction blocks** | `lib/sui.ts` — mint+vault, anchor event, `lock_and_draw`+coin transfer in one PTB |
| **Walrus** decentralized storage | `lib/walrus.ts` — encrypted caderneta/KYC blobs |
| **Seal** access-controlled encryption | `lib/walrus.ts` — threshold encrypt before upload (AES-GCM fallback) |
| **Privy** embedded Sui wallet (zkLogin-style abstraction) | `components/WalletProvider.tsx` — `createWallet({ chainType: 'sui' })` |

**Published on Sui testnet:**
- Package: `0x914afabdbf811f4f7120ca538b4cf1de336deb9c2fd441c1035e61fbeade5958`
- HOUSE coin: `…::house::HOUSE`
- Verified live txs (Suiscan testnet): tokenize, `anchor`, and agent disbursement all execute on-chain.

Plus chain-agnostic **World ID** (unique human + PT jurisdiction) and **Claude** (document parsing + the treasury agent's reasoning).

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
Copy the printed package id + TreasuryCap into `.env.local` (`BRIDGE_PACKAGE_ID`, `BRIDGE_TREASURY_CAP`, `HOUSE_COIN_TYPE`).

### Enabling each integration (all independent)

- **Sui settlement** (real mint / anchor / disburse): set `SUI_SECRET_KEY` (funded treasury) + `BRIDGE_PACKAGE_ID` + `BRIDGE_TREASURY_CAP`. Fund via https://faucet.sui.io.
- **USDC payout**: fund the treasury with Circle testnet USDC (https://faucet.circle.com) — otherwise disbursement falls back to a real **SUI** transfer (still on-chain).
- **Privy wallet**: `NEXT_PUBLIC_PRIVY_APP_ID` from dashboard.privy.io.
- **Walrus storage**: needs the treasury funded with **WAL** — otherwise a demo blob id is returned (the Sui anchor is still real).
- **AI**: `ANTHROPIC_API_KEY`. **World ID**: a real `NEXT_PUBLIC_WORLD_APP_ID`.

Without keys, each step returns a clearly-marked **demo** result so the flow is always demoable.

---

## Architecture

```
sui/                     Move package (bridge::house) + Move.toml
app/[lang]/              pt|en shell (landing, bridge wizard, dashboard)
app/api/
  parse-docs/            Claude vision → structured caderneta fields
  store-docs/            Seal-encrypt → Walrus upload → Sui anchor event
  worldid/verify/        World ID proof verification
  sui/tokenize/          Move `tokenize` → HOUSE coins + CollateralVault
  agent/disburse/        treasury AI agent → lock_and_draw + USDC transfer (1 PTB)
lib/
  sui.ts  walrus.ts  worldid.ts  agent.ts  ai-parse.ts
components/              Privy wallet + the 6-step wizard + dashboard
```

Secrets stay server-side (Route Handlers only). The wizard persists the position to
`sessionStorage` so the **dashboard** renders it with the full Suiscan-verifiable audit trail.

Built with [Claude Code](https://claude.com/claude-code).
