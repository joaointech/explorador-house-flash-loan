# explorador Bridge — home-equity bridge liquidity

**ETHGlobal Lisbon 2026** · a continuation of [explorador](https://explorador.pt) (irrealista), Portugal's AI real-estate intelligence platform.

In Portugal, buying a new home before selling your current one creates a liquidity gap:
signing the new home's **CPCV** (promissory contract) needs the *sinal* — often 10–20% —
**now**, but your capital is locked in the property you're still selling. Bank bridge loans
are slow and paperwork-heavy.

**explorador Bridge** lets a homeowner collateralize the house they're selling and draw
stablecoin liquidity in minutes, fully on-chain and auditable:

1. **Connect** a Hedera wallet (HashPack).
2. **Documents + AI** — upload the *caderneta predial* + ID; **Claude** extracts the tax
   article, VPT value, address and owner.
3. **World ID KYC** — prove a unique human resident in Portugal (Identity Check jurisdiction + age).
4. **Encrypt & anchor** — documents are encrypted and stored on **Walrus**; the document
   hash is anchored on **Hedera HCS** (immutable audit trail).
5. **Tokenize** — the house is minted as an **HTS fungible equity token**, supply pegged 1:1 to VPT (€).
6. **Collateralize & draw** — lock a fraction of the tokens; an **AI treasury agent** verifies
   collateral + the World-ID human and **autonomously disburses USDC** via a **Hedera Scheduled Transaction**.
7. **Withdraw** the liquidity for the new CPCV. Repaid automatically when the old house sells.

---

## Sponsor track integrations

| Sponsor | Track | Where it lives |
|---|---|---|
| **Hedera** | Tokenization on Hedera | `lib/hedera.ts` → `createHouseToken` (HTS fungible, SDK only, no Solidity) |
| **Hedera** | "No Solidity Allowed" (≥2 native services) | HTS + **HCS** (`anchorDocumentHash`) + **Scheduled Transactions** (`scheduleUsdcDisbursement`) — SDK only |
| **Hedera** | AI & Agentic Payments | `lib/agent.ts` → treasury agent reasons (Claude) then executes the Scheduled USDC payment |
| **World** | Identity Check Beta | `lib/worldid.ts` → verify unique human + jurisdiction (PT) + age before collateralizing |
| **World** | AgentKit New Use Cases | the treasury agent only acts on behalf of a **World-ID-verified unique human** (bot-vs-human gate) |
| **Sui** | Best App Built on Sui | `lib/walrus.ts` → **Walrus** blob storage + **Seal** encryption of the caderneta/KYC docs |

Every sponsor call is real on testnet when the corresponding keys are set (see below); without
keys, each step returns a clearly-marked **demo** result so the flow is always demoable.

---

## Design system

The frontend reuses the **explorador** design system verbatim — Sora variable font, brand blue
`#2563eb` / navy `#0F172A`, class-based dark mode, `app/[lang]` pt/en i18n, and the compass logo.
Built on **Next.js 16 · React 19 · Tailwind v4**.

---

## Run it

```bash
npm install
cp .env.example .env.local     # fill in what you have; everything is optional for the demo
npm run dev                    # http://localhost:3000  (use -p 3007 if 3000 is taken)
```

Open `/pt` (or `/en`) → **Iniciar a ponte / Start the bridge**. Use **"Use demo account"** to walk
the full flow without any keys.

### Enabling real testnet integrations

Set these in `.env.local` (each is independent — configure only what you want live):

```
# Hedera (testnet) — enables real HTS mint, HCS anchor, Scheduled disbursement
HEDERA_OPERATOR_ID=0.0.xxxxxx
HEDERA_OPERATOR_KEY=302e...            # ED25519 or ECDSA DER private key
USDC_TOKEN_ID=0.0.xxxxxx               # HTS stablecoin for disbursement (mint your own if needed)
HCS_TOPIC_ID=0.0.xxxxxx                # optional; auto-created if omitted

# Anthropic — enables real caderneta parsing + agent reasoning
ANTHROPIC_API_KEY=sk-ant-...

# World ID — enables real ZK proof verification (Developer Portal)
NEXT_PUBLIC_WORLD_APP_ID=app_...       # a real staging/prod app id (not app_staging_demo)
NEXT_PUBLIC_WORLD_ACTION=collateralize-house

# Sui / Walrus / Seal (testnet) — enables real encrypted blob storage
SUI_SECRET_KEY=suiprivkey1...          # funded with testnet SUI + WAL
SUI_NETWORK=testnet
SEAL_PACKAGE_ID=0x...                  # optional; enables real Seal threshold encryption (else AES-GCM)
SEAL_KEY_SERVER_IDS=0x...,0x...        # comma-separated Seal key-server object ids
SEAL_MASTER_KEY=...                    # AES fallback key

# Wallet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=  # for real HashPack via WalletConnect
NEXT_PUBLIC_DEMO_ACCOUNT_ID=0.0.xxxxxx # a testnet account for the "demo account" button
```

Where a testnet id is produced, the UI links to **HashScan** so you can verify it live.

---

## Architecture

```
app/[lang]/            pt|en shell (landing, bridge wizard, dashboard)
app/api/
  parse-docs/          Claude vision → structured caderneta fields
  store-docs/          Seal-encrypt → Walrus upload → HCS anchor
  worldid/verify/      World ID proof verification
  hedera/tokenize/     HTS fungible mint + associate
  agent/disburse/      treasury AI agent → Scheduled USDC disbursement
lib/
  hedera.ts  walrus.ts  worldid.ts  agent.ts  ai-parse.ts
components/bridge/      the 6-step wizard + steps
```

Secrets stay server-side (Route Handlers only). The wizard holds the in-progress position and
persists it to `sessionStorage` so the **dashboard** can render the position + audit trail.

Built with [Claude Code](https://claude.com/claude-code).
