# Demo script (≤3 min)

**Setup:** `npm run dev` → open `/pt` (or `/en`). Have a sample *caderneta predial* PDF ready.

### 0:00 — Problem (15s)
> "In Portugal, to sign the CPCV on a new house you pay the *sinal* now — but your money is stuck
> in the house you're still selling. We unlock that, entirely on Sui."

### 0:20 — Sign in (15s)
**Iniciar a ponte** → **Sign in with Privy** → email/Google. Privy provisions a **Sui wallet** on
the spot — no extension, no seed phrase. (Or **Use demo wallet** for a dry run.)

### 0:35 — Documents + AI (30s)
Upload the caderneta → **Extract with AI**: Claude returns article, VPT (€250k), address, owner.
**Seal & store** → show the **Walrus blob** and the **Sui anchor** (a real Suiscan tx link) + SHA-256.
> "Documents encrypted, stored on Walrus, hash anchored on Sui — tamper-proof."

### 1:05 — World ID KYC (20s)
**Verify with World ID** → unique human · **jurisdiction 🇵🇹 PT** · age 18+.
> "A unique human resident in Portugal — nothing about their identity revealed."

### 1:25 — Tokenize on Sui (25s)
**Mint on Sui** → 250,000 **HOUSE** coins from our published **Move package**, held in a
**CollateralVault** object. Open the coin type / vault / tx on **Suiscan**.
> "Real Move package, real objects — 1 HOUSE = €1 of VPT."

### 1:50 — Collateralize & the AI agent (45s)
Collateral **30%** (€75k locked), draw **$37,500** → **Lock & request liquidity**.
Read the agent's rationale:
> "Approved: World-ID-verified unique human in PT; €37,500 is 50% LTV against €75k locked equity,
> within the 70% policy."
It then executes **one Sui transaction** — `lock_and_draw` on the vault **+** the stablecoin
transfer. Open the digest on Suiscan.

### 2:35 — Withdraw + dashboard (20s)
**Withdraw USDC** → 🎉. Open **Dashboard**: the position + **audit trail** (Walrus, Sui anchor,
World ID, HOUSE coin, vault, disbursement) — every id a Suiscan link.

### 2:55 — Close (5s)
> "explorador Bridge — 100% Sui: Move + Walrus + Seal, Privy for the wallet, World ID for the human."
