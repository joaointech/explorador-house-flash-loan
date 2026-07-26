/// USDC — a USD-pegged testnet stablecoin minted by the protocol treasury for
/// bridge-liquidity disbursements. 6 decimals (real-USDC-like).
///
/// On testnet we can't source thousands of real USDC, so the treasury mints its
/// own on demand — every disbursement is a real, full-value stablecoin transfer
/// verifiable on Suiscan (not a symbolic amount).
module bridge::usdc {
    use sui::coin::{Self, TreasuryCap, Coin};

    /// One-time witness for the USDC currency.
    public struct USDC has drop {}

    fun init(witness: USDC, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            6, // decimals — USDC-like
            b"USDC",
            b"USD Coin",
            b"USD-pegged testnet stablecoin for explorador Bridge disbursements.",
            option::none(),
            ctx,
        );
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury, ctx.sender());
    }

    /// Treasury-only: mint `amount` (base units, 6 dp) USDC to `recipient`.
    public entry fun mint(cap: &mut TreasuryCap<USDC>, amount: u64, recipient: address, ctx: &mut TxContext) {
        let c = coin::mint(cap, amount, ctx);
        transfer::public_transfer(c, recipient);
    }

    /// Treasury-only: mint and return a Coin (for composing inside a PTB, e.g. repay).
    public fun mint_coin(cap: &mut TreasuryCap<USDC>, amount: u64, ctx: &mut TxContext): Coin<USDC> {
        coin::mint(cap, amount, ctx)
    }
}
