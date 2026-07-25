/// explorador Bridge — on-chain home-equity collateral on Sui.
///
/// A Portuguese property is tokenized as `HOUSE` equity coins (1 unit = €1 of
/// VPT), held inside a shared `CollateralVault`. Documents are anchored by hash
/// (audit trail), a fraction of the equity is locked as collateral, and the
/// treasury records the USDC draw. SDK-friendly: every state change emits an
/// event so the app can render Suiscan-verifiable proofs.
///
/// Liquidity is priced like our own money market: a shared `Pool` tracks how
/// much of the treasury is drawn, and the borrow rate floats with utilization.
/// Interest accrues by the time held (Sui `Clock`) and is settled on repay, so
/// the yield on the treasury funds the protocol.
module bridge::house {
    use std::string::{Self, String};
    use sui::coin::{Self, TreasuryCap, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::event;
    use bridge::eusd::EUSD;

    /// Repayment coin is worth less than principal + accrued interest.
    const EInsufficientRepayment: u64 = 1;
    /// Caller is not the pool admin (treasury).
    const EUnauthorized: u64 = 2;
    /// Partial payment doesn't even cover interest accrued so far. Accepting it
    /// would silently forgive interest, because the clock restarts on repay.
    const EBelowAccruedInterest: u64 = 3;

    // ── Interest-rate model (utilization curve, à la Aave/Suilend) ──────
    /// Annual percentage rates, in basis points (10000 = 100%).
    const BASE_RATE_BPS: u64 = 200;     // 2% APR at 0% utilization
    const KINK_BPS: u64 = 8000;         // utilization "kink" at 80%
    const RATE_AT_KINK_BPS: u64 = 800;  // 8% APR at the kink
    const MAX_RATE_BPS: u64 = 5000;     // 50% APR at 100% utilization
    /// Milliseconds in a 365-day year (Clock is in ms).
    const MS_PER_YEAR: u64 = 31_536_000_000;
    /// Default lendable capacity opened at publish, in whole EUR/USD.
    const DEFAULT_CAPACITY: u64 = 1_000_000;

    /// One-time witness for the HOUSE equity currency.
    public struct HOUSE has drop {}

    /// The protocol treasury as a money market: a shared object whose
    /// utilization (`total_drawn / capacity`) sets the borrow rate. Also tallies
    /// lifetime interest earned, so the dashboard can show yield funding the protocol.
    public struct Pool has key {
        id: UID,
        admin: address,        // treasury; only it can retune capacity
        capacity: u64,         // total lendable liquidity, whole EUR/USD
        total_drawn: u64,      // outstanding principal across all vaults, whole EUR/USD
        total_interest: u64,   // lifetime interest settled to treasury, eUSD base units (6dp)
    }

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
        drawn_usdc: u64,      // liquidity drawn (whole EUR/USD)
        drawn_at_ms: u64,     // Clock timestamp at draw (interest accrues from here)
        rate_bps: u64,        // APR locked in at draw, from pool utilization
        repaid: bool,
    }

    // ── Events (audit trail) ────────────────────────────────────────────
    public struct HouseTokenized has copy, drop { vault: address, owner: address, article: String, vpt: u64 }
    public struct DocumentAnchored has copy, drop { sha256: vector<u8>, article: String }
    public struct CollateralLocked has copy, drop { vault: address, locked: u64, drawn_usdc: u64, rate_bps: u64, utilization_bps: u64 }
    public struct LoanRepaid has copy, drop { vault: address, owner: address, principal_eusd: u64, interest_eusd: u64, repaid_eusd: u64, released_house: u64 }
    public struct LoanRepaidPartial has copy, drop {
        vault: address,
        owner: address,
        paid_eusd: u64,       // total eUSD taken from the payer
        interest_eusd: u64,   // interest settled (incl. the sub-euro dust)
        principal_eusd: u64,  // principal actually retired, in eUSD base units
        remaining_usdc: u64,  // principal still outstanding, whole EUR/USD
    }

    /// Publish-time: create the HOUSE currency, hand the treasury cap to the
    /// deployer (the protocol treasury), and open the shared lending Pool.
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

        let pool = Pool {
            id: object::new(ctx),
            admin: ctx.sender(),
            capacity: DEFAULT_CAPACITY,
            total_drawn: 0,
            total_interest: 0,
        };
        transfer::share_object(pool);
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
            drawn_at_ms: 0,
            rate_bps: 0,
            repaid: false,
        };
        event::emit(HouseTokenized { vault: vault.id.to_address(), owner, article: vault.article, vpt });
        transfer::share_object(vault);
    }

    /// Anyone: anchor a document hash on-chain (immutable audit event).
    public entry fun anchor(article: vector<u8>, doc_hash: vector<u8>, _ctx: &mut TxContext) {
        event::emit(DocumentAnchored { sha256: doc_hash, article: string::utf8(article) });
    }

    /// Treasury-only: retune the pool's lendable capacity (moves the utilization curve).
    public entry fun set_capacity(pool: &mut Pool, capacity: u64, ctx: &mut TxContext) {
        assert!(ctx.sender() == pool.admin, EUnauthorized);
        pool.capacity = capacity;
    }

    /// Lock a fraction (basis points) of the vault's equity, record the draw, and
    /// price it: the borrow rate is read from current pool utilization and the
    /// clock starts on the interest meter.
    public entry fun lock_and_draw(
        vault: &mut CollateralVault,
        pool: &mut Pool,
        clock: &Clock,
        pct_bps: u64,
        draw_usdc: u64,
        _ctx: &mut TxContext,
    ) {
        let lock_amt = (vault.vpt * pct_bps) / 10000;
        vault.locked = lock_amt;
        vault.drawn_usdc = draw_usdc;
        vault.drawn_at_ms = clock::timestamp_ms(clock);

        pool.total_drawn = pool.total_drawn + draw_usdc;
        let util = utilization_bps(pool);
        vault.rate_bps = rate_from_util(util);

        event::emit(CollateralLocked {
            vault: vault.id.to_address(),
            locked: lock_amt,
            drawn_usdc: draw_usdc,
            rate_bps: vault.rate_bps,
            utilization_bps: util,
        });
    }

    /// Repay principal + time-accrued interest with eUSD. Settles owed to the
    /// treasury, refunds any overpayment to the payer, releases the locked HOUSE
    /// equity to the owner, and books the interest as protocol yield.
    public entry fun repay(
        vault: &mut CollateralVault,
        pool: &mut Pool,
        mut payment: Coin<EUSD>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let now = clock::timestamp_ms(clock);
        let principal = vault.drawn_usdc * 1_000_000; // eUSD has 6 decimals
        let interest = interest_owed(vault, now);
        let owed = principal + interest;
        assert!(coin::value(&payment) >= owed, EInsufficientRepayment);

        // Take exactly what's owed to the treasury; refund the rest to the payer.
        let owed_coin = coin::split(&mut payment, owed, ctx);
        transfer::public_transfer(owed_coin, vault.treasury);
        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, ctx.sender());
        } else {
            coin::destroy_zero(payment);
        };

        // Release all HOUSE equity back to the owner.
        let released_bal = balance::withdraw_all(&mut vault.equity);
        let released_amt = balance::value(&released_bal);
        transfer::public_transfer(coin::from_balance(released_bal, ctx), vault.owner);

        // Pool bookkeeping: free the capacity, tally the yield.
        if (pool.total_drawn >= vault.drawn_usdc) {
            pool.total_drawn = pool.total_drawn - vault.drawn_usdc;
        } else {
            pool.total_drawn = 0;
        };
        pool.total_interest = pool.total_interest + interest;

        vault.locked = 0;
        vault.drawn_usdc = 0;
        vault.repaid = true;
        event::emit(LoanRepaid {
            vault: vault.id.to_address(),
            owner: vault.owner,
            principal_eusd: principal,
            interest_eusd: interest,
            repaid_eusd: owed,
            released_house: released_amt,
        });
    }

    /// Repay *part* of the loan. Accrued interest is settled first, whatever is
    /// left retires whole euros of principal, and the interest clock restarts on
    /// the reduced principal. Collateral stays locked and `repaid` stays false —
    /// only a full `repay` releases the equity.
    ///
    /// If `payment` already covers principal + interest this just delegates to
    /// `repay` (on Sui an entry function is callable from Move code, cf.
    /// `sui::pay::split_vec` calling `sui::pay::split`), so a borrower who pays
    /// the whole thing through this path still gets settled and refunded.
    public entry fun repay_partial(
        vault: &mut CollateralVault,
        pool: &mut Pool,
        payment: Coin<EUSD>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let now = clock::timestamp_ms(clock);
        let paid = coin::value(&payment);
        let interest = interest_owed(vault, now);
        let owed = vault.drawn_usdc * 1_000_000 + interest; // == total_owed(vault, now)

        if (paid >= owed) {
            repay(vault, pool, payment, clock, ctx);
            return
        };

        // Interest first. Below it, the clock reset below would forgive the shortfall.
        assert!(paid > 0 && paid >= interest, EBelowAccruedInterest);

        // The rest retires whole euros of principal (`drawn_usdc` is u64 EUR);
        // the sub-euro remainder is booked as protocol interest, not lost.
        let to_principal = paid - interest;
        let principal_units = to_principal / 1_000_000;
        let interest_booked = interest + (to_principal % 1_000_000);

        // The borrower chose this amount, so the treasury takes the whole coin —
        // no split, no refund, nothing left dangling.
        transfer::public_transfer(payment, vault.treasury);

        // paid < owed  =>  to_principal < drawn_usdc * 1_000_000  =>  principal_units < drawn_usdc,
        // so this never underflows and never zeroes the loan (that's `repay`'s job).
        vault.drawn_usdc = vault.drawn_usdc - principal_units;
        vault.drawn_at_ms = now; // clock restarts on the reduced principal

        if (pool.total_drawn >= principal_units) {
            pool.total_drawn = pool.total_drawn - principal_units;
        } else {
            pool.total_drawn = 0;
        };
        pool.total_interest = pool.total_interest + interest_booked;

        event::emit(LoanRepaidPartial {
            vault: vault.id.to_address(),
            owner: vault.owner,
            paid_eusd: paid,
            interest_eusd: interest_booked,
            principal_eusd: principal_units * 1_000_000,
            remaining_usdc: vault.drawn_usdc,
        });
    }

    // ── Interest-rate math (pure, callable off-chain via devInspect) ────

    /// Pool utilization in basis points, capped at 100%.
    public fun utilization_bps(pool: &Pool): u64 {
        if (pool.capacity == 0) return 0;
        let u = pool.total_drawn * 10000 / pool.capacity;
        if (u > 10000) 10000 else u
    }

    /// Borrow APR (bps) for a given utilization (bps): a two-slope kinked curve.
    public fun rate_from_util(util_bps: u64): u64 {
        let u = if (util_bps > 10000) 10000 else util_bps;
        if (u <= KINK_BPS) {
            BASE_RATE_BPS + (RATE_AT_KINK_BPS - BASE_RATE_BPS) * u / KINK_BPS
        } else {
            let over = u - KINK_BPS;
            RATE_AT_KINK_BPS + (MAX_RATE_BPS - RATE_AT_KINK_BPS) * over / (10000 - KINK_BPS)
        }
    }

    /// Interest accrued on a vault by `now_ms`, in eUSD base units (6dp).
    /// principal * rate_bps * elapsed_ms / (10000 * MS_PER_YEAR), in u128 to avoid overflow.
    public fun interest_owed(vault: &CollateralVault, now_ms: u64): u64 {
        if (vault.drawn_usdc == 0 || now_ms <= vault.drawn_at_ms) return 0;
        let principal = (vault.drawn_usdc as u128) * 1_000_000;
        let elapsed = (now_ms - vault.drawn_at_ms) as u128;
        let num = principal * (vault.rate_bps as u128) * elapsed;
        let den = 10000u128 * (MS_PER_YEAR as u128);
        (num / den) as u64
    }

    /// Principal + accrued interest owed by `now_ms`, in eUSD base units (6dp).
    public fun total_owed(vault: &CollateralVault, now_ms: u64): u64 {
        vault.drawn_usdc * 1_000_000 + interest_owed(vault, now_ms)
    }

    // ── Read-only accessors ─────────────────────────────────────────────
    public fun vpt(v: &CollateralVault): u64 { v.vpt }
    public fun locked(v: &CollateralVault): u64 { v.locked }
    public fun drawn_usdc(v: &CollateralVault): u64 { v.drawn_usdc }
    public fun drawn_at_ms(v: &CollateralVault): u64 { v.drawn_at_ms }
    public fun rate_bps(v: &CollateralVault): u64 { v.rate_bps }
    public fun equity_value(v: &CollateralVault): u64 { balance::value(&v.equity) }
    public fun owner(v: &CollateralVault): address { v.owner }
    public fun is_repaid(v: &CollateralVault): bool { v.repaid }

    public fun pool_capacity(p: &Pool): u64 { p.capacity }
    public fun pool_total_drawn(p: &Pool): u64 { p.total_drawn }
    public fun pool_total_interest(p: &Pool): u64 { p.total_interest }

    // ── Tests ───────────────────────────────────────────────────────────
    #[test_only]
    fun mk_vault(vpt: u64, drawn: u64, rate_bps: u64, drawn_at: u64, ctx: &mut TxContext): CollateralVault {
        CollateralVault {
            id: object::new(ctx),
            owner: @0xB,
            treasury: @0xA,
            article: string::utf8(b"1234"),
            doc_hash: b"hash",
            vpt,
            equity: balance::create_for_testing<HOUSE>(vpt),
            locked: 0,
            drawn_usdc: drawn,
            drawn_at_ms: drawn_at,
            rate_bps,
            repaid: false,
        }
    }

    #[test_only]
    fun mk_pool(capacity: u64, total_drawn: u64, ctx: &mut TxContext): Pool {
        Pool { id: object::new(ctx), admin: @0xA, capacity, total_drawn, total_interest: 0 }
    }

    #[test]
    fun test_rate_curve() {
        // Endpoints and the kink.
        assert!(rate_from_util(0) == BASE_RATE_BPS, 0);          // 2%
        assert!(rate_from_util(KINK_BPS) == RATE_AT_KINK_BPS, 1); // 8% at 80%
        assert!(rate_from_util(10000) == MAX_RATE_BPS, 2);        // 50% at 100%
        assert!(rate_from_util(20000) == MAX_RATE_BPS, 3);        // clamped
        // Below the kink: 40% util -> 200 + (800-200)*4000/8000 = 500 bps.
        assert!(rate_from_util(4000) == 500, 4);
        // Above the kink: 90% util -> 800 + (5000-800)*1000/2000 = 2900 bps.
        assert!(rate_from_util(9000) == 2900, 5);
    }

    #[test]
    fun test_utilization() {
        let mut ctx = tx_context::dummy();
        let p = mk_pool(1_000_000, 250_000, &mut ctx);
        assert!(utilization_bps(&p) == 2500, 0); // 25%
        let p2 = mk_pool(0, 0, &mut ctx);
        assert!(utilization_bps(&p2) == 0, 1);    // no div-by-zero
        let p3 = mk_pool(100, 500, &mut ctx);
        assert!(utilization_bps(&p3) == 10000, 2); // clamped at 100%
        std::unit_test::destroy(p);
        std::unit_test::destroy(p2);
        std::unit_test::destroy(p3);
    }

    #[test]
    fun test_interest_accrual() {
        let mut ctx = tx_context::dummy();
        // €200k drawn at 7.25% APR (725 bps).
        let v = mk_vault(200_000, 200_000, 725, 0, &mut ctx);
        // One full year -> principal(200000e6) * 725 / 10000 = 14,500 eUSD.
        assert!(interest_owed(&v, MS_PER_YEAR) == 14_500 * 1_000_000, 0);
        // Half a year -> 7,250 eUSD.
        assert!(interest_owed(&v, MS_PER_YEAR / 2) == 7_250 * 1_000_000, 1);
        // No time elapsed -> no interest.
        assert!(interest_owed(&v, 0) == 0, 2);
        // total_owed = principal + interest.
        assert!(total_owed(&v, MS_PER_YEAR) == (200_000 + 14_500) * 1_000_000, 3);
        std::unit_test::destroy(v);
    }

    #[test]
    fun test_repay_settles_principal_and_interest() {
        let mut sc = sui::test_scenario::begin(@0xA);
        let ctx = sui::test_scenario::ctx(&mut sc);
        let mut clock = clock::create_for_testing(ctx);
        let mut pool = mk_pool(1_000_000, 200_000, ctx);
        let mut vault = mk_vault(200_000, 200_000, 725, 0, ctx);

        // Hold for half a year, then repay with an overpayment.
        clock::set_for_testing(&mut clock, MS_PER_YEAR / 2);
        let owed = total_owed(&vault, MS_PER_YEAR / 2);
        let payment = coin::mint_for_testing<EUSD>(owed + 5_000_000, ctx); // +5 eUSD
        repay(&mut vault, &mut pool, payment, &clock, ctx);

        assert!(vault.repaid, 0);
        assert!(vault.drawn_usdc == 0, 1);
        assert!(vault.locked == 0, 2);
        assert!(balance::value(&vault.equity) == 0, 3);     // equity released
        assert!(pool.total_drawn == 0, 4);                  // capacity freed
        assert!(pool.total_interest == 7_250 * 1_000_000, 5); // yield booked

        std::unit_test::destroy(vault);
        std::unit_test::destroy(pool);
        clock::destroy_for_testing(clock);
        sui::test_scenario::end(sc);
    }

    #[test]
    #[expected_failure(abort_code = EInsufficientRepayment)]
    fun test_repay_rejects_underpayment() {
        let mut sc = sui::test_scenario::begin(@0xA);
        let ctx = sui::test_scenario::ctx(&mut sc);
        let mut clock = clock::create_for_testing(ctx);
        let mut pool = mk_pool(1_000_000, 200_000, ctx);
        let mut vault = mk_vault(200_000, 200_000, 725, 0, ctx);

        clock::set_for_testing(&mut clock, MS_PER_YEAR / 2);
        // Pay only principal, missing the accrued interest -> must abort.
        let payment = coin::mint_for_testing<EUSD>(200_000 * 1_000_000, ctx);
        repay(&mut vault, &mut pool, payment, &clock, ctx);

        std::unit_test::destroy(vault);
        std::unit_test::destroy(pool);
        clock::destroy_for_testing(clock);
        sui::test_scenario::end(sc);
    }

    #[test]
    fun test_repay_partial_reduces_principal_and_resets_clock() {
        let mut sc = sui::test_scenario::begin(@0xA);
        let ctx = sui::test_scenario::ctx(&mut sc);
        let mut clock = clock::create_for_testing(ctx);
        let mut pool = mk_pool(1_000_000, 200_000, ctx);
        let mut vault = mk_vault(200_000, 200_000, 725, 0, ctx);
        vault.locked = 60_000; // collateral pledged at draw

        // Half a year at 7.25% on €200k -> 7,250 eUSD interest.
        clock::set_for_testing(&mut clock, MS_PER_YEAR / 2);
        // Pay interest + €20,000 of principal.
        let payment = coin::mint_for_testing<EUSD>(7_250 * 1_000_000 + 20_000 * 1_000_000, ctx);
        repay_partial(&mut vault, &mut pool, payment, &clock, ctx);

        assert!(vault.drawn_usdc == 180_000, 0);                  // principal reduced
        assert!(vault.drawn_at_ms == MS_PER_YEAR / 2, 1);         // clock restarted
        assert!(!vault.repaid, 2);                                // loan still open
        assert!(vault.locked == 60_000, 3);                       // collateral still locked
        assert!(balance::value(&vault.equity) == 200_000, 4);     // equity NOT released
        assert!(pool.total_drawn == 180_000, 5);                  // capacity partly freed
        assert!(pool.total_interest == 7_250 * 1_000_000, 6);     // yield booked

        // Interest on the reduced principal, from the new clock: 0 elapsed -> 0.
        assert!(interest_owed(&vault, MS_PER_YEAR / 2) == 0, 7);

        std::unit_test::destroy(vault);
        std::unit_test::destroy(pool);
        clock::destroy_for_testing(clock);
        sui::test_scenario::end(sc);
    }

    #[test]
    fun test_repay_partial_books_sub_euro_dust_as_interest() {
        let mut sc = sui::test_scenario::begin(@0xA);
        let ctx = sui::test_scenario::ctx(&mut sc);
        let mut clock = clock::create_for_testing(ctx);
        let mut pool = mk_pool(1_000_000, 200_000, ctx);
        let mut vault = mk_vault(200_000, 200_000, 725, 0, ctx);

        clock::set_for_testing(&mut clock, MS_PER_YEAR / 2);
        // Interest + 1.75 eUSD: €1 of principal, €0.75 of dust.
        let payment = coin::mint_for_testing<EUSD>(7_250 * 1_000_000 + 1_750_000, ctx);
        repay_partial(&mut vault, &mut pool, payment, &clock, ctx);

        assert!(vault.drawn_usdc == 199_999, 0);
        assert!(pool.total_drawn == 199_999, 1);
        assert!(pool.total_interest == 7_250 * 1_000_000 + 750_000, 2); // dust -> interest

        std::unit_test::destroy(vault);
        std::unit_test::destroy(pool);
        clock::destroy_for_testing(clock);
        sui::test_scenario::end(sc);
    }

    #[test]
    #[expected_failure(abort_code = EBelowAccruedInterest)]
    fun test_repay_partial_rejects_below_accrued_interest() {
        let mut sc = sui::test_scenario::begin(@0xA);
        let ctx = sui::test_scenario::ctx(&mut sc);
        let mut clock = clock::create_for_testing(ctx);
        let mut pool = mk_pool(1_000_000, 200_000, ctx);
        let mut vault = mk_vault(200_000, 200_000, 725, 0, ctx);

        clock::set_for_testing(&mut clock, MS_PER_YEAR / 2);
        // One base unit short of the accrued interest -> must abort.
        let payment = coin::mint_for_testing<EUSD>(7_250 * 1_000_000 - 1, ctx);
        repay_partial(&mut vault, &mut pool, payment, &clock, ctx);

        std::unit_test::destroy(vault);
        std::unit_test::destroy(pool);
        clock::destroy_for_testing(clock);
        sui::test_scenario::end(sc);
    }

    #[test]
    fun test_repay_partial_then_full_payoff_releases_equity() {
        let mut sc = sui::test_scenario::begin(@0xA);
        let ctx = sui::test_scenario::ctx(&mut sc);
        let mut clock = clock::create_for_testing(ctx);
        let mut pool = mk_pool(1_000_000, 200_000, ctx);
        let mut vault = mk_vault(200_000, 200_000, 725, 0, ctx);
        vault.locked = 60_000;

        // Leg 1: half a year, pay interest + €20k.
        clock::set_for_testing(&mut clock, MS_PER_YEAR / 2);
        let p1 = coin::mint_for_testing<EUSD>(7_250 * 1_000_000 + 20_000 * 1_000_000, ctx);
        repay_partial(&mut vault, &mut pool, p1, &clock, ctx);
        assert!(vault.drawn_usdc == 180_000, 0);

        // Leg 2: another half year on €180k -> 6,525 eUSD. Pay it all through
        // repay_partial: it must notice paid >= owed and delegate to repay.
        clock::set_for_testing(&mut clock, MS_PER_YEAR);
        let owed = total_owed(&vault, MS_PER_YEAR);
        assert!(owed == (180_000 + 6_525) * 1_000_000, 1);
        let p2 = coin::mint_for_testing<EUSD>(owed, ctx);
        repay_partial(&mut vault, &mut pool, p2, &clock, ctx);

        assert!(vault.repaid, 2);
        assert!(vault.drawn_usdc == 0, 3);
        assert!(vault.locked == 0, 4);
        assert!(balance::value(&vault.equity) == 0, 5);            // equity released
        assert!(pool.total_drawn == 0, 6);
        assert!(pool.total_interest == (7_250 + 6_525) * 1_000_000, 7);

        std::unit_test::destroy(vault);
        std::unit_test::destroy(pool);
        clock::destroy_for_testing(clock);
        sui::test_scenario::end(sc);
    }
}
