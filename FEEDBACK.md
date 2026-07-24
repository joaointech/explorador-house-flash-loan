# Developer & user feedback — explorador Bridge (Sui)

Feedback from actually building on each stack during ETHGlobal Lisbon 2026.

## Sui (Move · PTBs · TypeScript SDK)

**What worked well**
- `sui move build` + `sui client publish` is a genuinely fast loop — we published a real package
  (`HOUSE` coin + shared `CollateralVault` + entry fns + events) to testnet in minutes.
- Move 2024 (`public struct`, `UID.to_address()`, `coin::create_currency`) is ergonomic. Shared
  objects + events map cleanly onto our "vault holds collateral, every step emits a proof" model.
- Programmable transaction blocks let the treasury agent do `lock_and_draw` **and** transfer the
  stablecoin in a single tx — one Suiscan digest proves the whole disbursement.

**Sharp edges (cost us the most time)**
- **`@mysten/sui` v2 is a big break.** `SuiClient` / `getFullnodeUrl` from `@mysten/sui/client`
  are gone; the JSON-RPC client is now `SuiJsonRpcClient` + `getJsonRpcFullnodeUrl` under
  `@mysten/sui/jsonRpc`, and it's already flagged **deprecated**. A clear "v1 → v2 client
  migration" page would have saved an hour.
- **The public testnet fullnode dropped JSON-RPC.** `https://fullnode.testnet.sui.io:443` returns
  **404** for JSON-RPC now (gRPC-only). Every SDK example still uses `getFullnodeUrl('testnet')`,
  which points there — so out-of-the-box code 404s. We had to hardcode a working third-party
  JSON-RPC endpoint (`rpc-testnet.suiscan.xyz`). Please update the SDK default, or ship the gRPC
  client as the documented default with runnable examples.
- **`create_currency` is deprecated** in favor of `coin_registry::new_currency_with_otw` but the
  new path isn't in the coin examples yet.

## Privy (embedded Sui wallet)

- Sui support exists but is **hard to discover** — it's under "Tier 2 / extended chains"
  (`@privy-io/react-auth/extended-chains` → `createWallet({ chainType: 'sui' })`), not in the main
  chains docs, and it didn't show up in general search. A top-level "Sui with Privy" quickstart
  would help a lot. Once found, the flow is clean and the email→Sui-wallet UX is exactly what we
  wanted (it removed the extension/testnet-account friction that blocked our first wallet attempt).
- The two-step reactive flow (`login()` opens a modal, then you `createWallet` after `authenticated`
  flips) needs an effect, not a linear await — worth documenting.

## Walrus + Seal

- `writeBlob` is clean once the Sui client is constructed, but requires the signer to hold **WAL**;
  a one-command testnet WAL faucet in the CLI (like `sui client faucet`) would smooth demos.
- **Seal** threshold encryption needs a deployed access-control Move package (`seal_approve*`), which
  is a lot for a hackathon — we ship AES-GCM as the honest fallback and wire Seal behind config.

## World ID
- IDKit v4's credential-builder model (`proofOfHuman`, `identityCheck`) is powerful; the v3→v4
  verification migration (`verifyCloudProof` is gone) was the hardest thing to find.

## What we'd build next
- Real Seal access policy so decryption is gated on the loan being active.
- Fund the treasury with Circle testnet USDC so the disbursement is USDC end-to-end (today it
  falls back to a real SUI transfer when the treasury holds no USDC).
- zkLogin alongside Privy; a Sui subgraph over the vault events for the agent's risk model.
