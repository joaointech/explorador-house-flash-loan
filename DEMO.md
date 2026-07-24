# Demo script (≤3 min)

**Setup:** `npm run dev` → open `/pt` (or `/en`). Have a sample *caderneta predial* PDF ready
(any PDF works in demo mode).

### 0:00 — The problem (15s)
> "In Portugal, to sign the CPCV on a new house you pay the *sinal* now — but your money is
> stuck in the house you're still selling. We unlock that, on-chain."

Land on the homepage — scroll the 6-step "Como funciona" and the trust band (Walrus / HCS / agent).

### 0:20 — Connect (10s)
Click **Iniciar a ponte** → **Ligar carteira** → **Usar conta demo** (or real HashPack).

### 0:30 — Documents + AI (30s)
Upload the caderneta → **Extrair com IA**. Claude returns the article, VPT (€250k), address, owner.
> "That's Claude reading the tax register — no forms."

Click **Selar & guardar**: show the **Walrus blob id**, the **HCS audit** entry (topic · #seq),
and the SHA-256.
> "Documents encrypted, stored on Walrus, and the hash anchored on Hedera Consensus — tamper-proof."

### 1:00 — World ID KYC (20s)
**Verificar com World ID** → show **unique human**, **jurisdiction 🇵🇹 PT**, **age 18+**, nullifier.
> "Proof of a unique human resident in Portugal — nothing about their identity is revealed."

### 1:20 — Tokenize (20s)
**Emitir na Hedera** → the house becomes **HSE1234**, 250,000 tokens = €250k equity (HTS, no Solidity).
Link opens on HashScan.

### 1:40 — Collateralize & the AI agent (40s)
Set collateral **30%** (€75k locked) and draw **$37,500**.
Click **Bloquear & pedir liquidez**.
> "Now the treasury AI agent evaluates it."

Read the agent's rationale aloud:
> "Approved: World-ID-verified unique human in PT; €37,500 is 50% LTV against €75k locked equity,
> within the 70% policy." → and it **executes a Hedera Scheduled Transaction** to disburse USDC.

### 2:20 — Withdraw + dashboard (30s)
**Levantar USDC** → 🎉 ready for the CPCV.
Open **Painel / Dashboard**: the full position + **audit trail** (Walrus, HCS, World ID, HTS token,
Scheduled tx) with the agent's decision.
> "One position, every step verifiable on-chain. Repaid automatically when the old house sells."

### 2:50 — Close (10s)
> "explorador Bridge — Hedera for tokenization + agentic payments, World ID for the human,
> Walrus for the documents. Built on the explorador platform."
