/// explorador Bridge — on-chain home-equity collateral on Sui.
///
/// A Portuguese property is tokenized as `HOUSE` equity coins (1 unit = €1 of
/// VPT), held inside a shared `CollateralVault`. Documents are anchored by hash
/// (audit trail), a fraction of the equity is locked as collateral, and the
/// treasury records the USDC draw. SDK-friendly: every state change emits an
/// event so the app can render Suiscan-verifiable proofs.
module bridge::house {
    use std::string::{Self, String};
    use sui::coin::{Self, TreasuryCap, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use bridge::eusd::EUSD;

    /// Repayment coin is worth less than the outstanding draw.
    const EInsufficientRepayment: u64 = 1;

    /// One-time witness for the HOUSE equity currency.
    public struct HOUSE has drop {}

    /// A tokenized property held as collateral for a liquidity draw.
    public struct CollateralVault has key {
        id: UID,
        owner: address,
        treasury: address,    // receives repayment
        article: String,      // artigo matricial (tax article)
        doc_hash: vector<u8>, // sha256 of the caderneta/KYC documents
        vpt: u64,             // Valor Patrimonial Tributário, in whole EUR
        equity: Balance<HOUSE>,
        locked: u64,          // HOUSE units locked as collateral
        drawn_usdc: u64,      // USDC liquidity drawn (whole USD)
        repaid: bool,
    }

    // ── Events (audit trail) ────────────────────────────────────────────
    public struct HouseTokenized has copy, drop { vault: address, owner: address, article: String, vpt: u64 }
    public struct DocumentAnchored has copy, drop { sha256: vector<u8>, article: String }
    public struct CollateralLocked has copy, drop { vault: address, locked: u64, drawn_usdc: u64 }
    public struct LoanRepaid has copy, drop { vault: address, owner: address, repaid_eusd: u64, released_house: u64 }

    /// Publish-time: create the HOUSE currency and hand the treasury cap to the
    /// deployer (the protocol treasury) so only it can mint equity.
    fun init(witness: HOUSE, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            0, // decimals — 1 HOUSE = €1 of VPT
            b"HOUSE",
            b"explorador House Equity",
            b"Tokenized Portuguese home equity. 1 HOUSE = EUR 1 of VPT.",
            option::none(),
            ctx,
        );
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury, ctx.sender());
    }

    /// Treasury-only: mint `vpt` HOUSE and open a shared vault for `owner`.
    public entry fun tokenize(
        cap: &mut TreasuryCap<HOUSE>,
        owner: address,
        article: vector<u8>,
        doc_hash: vector<u8>,
        vpt: u64,
        ctx: &mut TxContext,
    ) {
        let minted = coin::mint(cap, vpt, ctx);
        let vault = CollateralVault {
            id: object::new(ctx),
            owner,
            treasury: ctx.sender(),
            article: string::utf8(article),
            doc_hash,
            vpt,
            equity: coin::into_balance(minted),
            locked: 0,
            drawn_usdc: 0,
            repaid: false,
        };
        event::emit(HouseTokenized { vault: vault.id.to_address(), owner, article: vault.article, vpt });
        transfer::share_object(vault);
    }

    /// Anyone: anchor a document hash on-chain (immutable audit event).
    public entry fun anchor(article: vector<u8>, doc_hash: vector<u8>, _ctx: &mut TxContext) {
        event::emit(DocumentAnchored { sha256: doc_hash, article: string::utf8(article) });
    }

    /// Lock a fraction (basis points) of the vault's equity and record the draw.
    public entry fun lock_and_draw(vault: &mut CollateralVault, pct_bps: u64, draw_usdc: u64, _ctx: &mut TxContext) {
        let lock_amt = (vault.vpt * pct_bps) / 10000;
        vault.locked = lock_amt;
        vault.drawn_usdc = draw_usdc;
        event::emit(CollateralLocked { vault: vault.id.to_address(), locked: lock_amt, drawn_usdc: draw_usdc });
    }

    /// Repay the outstanding draw with eUSD. Settles the payment to the treasury,
    /// clears the debt, and releases the locked HOUSE equity back to the owner.
    public entry fun repay(vault: &mut CollateralVault, payment: Coin<EUSD>, ctx: &mut TxContext) {
        let owed = vault.drawn_usdc * 1_000_000; // eUSD has 6 decimals
        assert!(coin::value(&payment) >= owed, EInsufficientRepayment);
        transfer::public_transfer(payment, vault.treasury);

        // Release all HOUSE equity back to the owner.
        let released_bal = balance::withdraw_all(&mut vault.equity);
        let released_amt = balance::value(&released_bal);
        transfer::public_transfer(coin::from_balance(released_bal, ctx), vault.owner);

        vault.locked = 0;
        vault.drawn_usdc = 0;
        vault.repaid = true;
        event::emit(LoanRepaid {
            vault: vault.id.to_address(),
            owner: vault.owner,
            repaid_eusd: owed,
            released_house: released_amt,
        });
    }

    // ── Read-only accessors ─────────────────────────────────────────────
    public fun vpt(v: &CollateralVault): u64 { v.vpt }
    public fun locked(v: &CollateralVault): u64 { v.locked }
    public fun drawn_usdc(v: &CollateralVault): u64 { v.drawn_usdc }
    public fun equity_value(v: &CollateralVault): u64 { balance::value(&v.equity) }
    public fun owner(v: &CollateralVault): address { v.owner }
    public fun is_repaid(v: &CollateralVault): bool { v.repaid }
}
