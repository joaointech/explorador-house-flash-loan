/// eUSD — "explorador USD", a USD-pegged testnet stablecoin minted by the
/// protocol treasury for bridge-liquidity disbursements. 6 decimals (USDC-like).
///
/// On testnet we can't source thousands of real USDC, so the treasury mints eUSD
/// on demand — every disbursement is a real, full-value stablecoin transfer
/// verifiable on Suiscan (not a symbolic amount).
module bridge::eusd {
    use sui::coin::{Self, TreasuryCap, Coin};

    /// One-time witness for the eUSD currency.
    public struct EUSD has drop {}

    fun init(witness: EUSD, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            6, // decimals — USDC-like
            b"eUSD",
            b"explorador USD",
            b"USD-pegged testnet stablecoin for explorador Bridge disbursements.",
            option::none(),
            ctx,
        );
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury, ctx.sender());
    }

    /// Treasury-only: mint `amount` (base units, 6 dp) eUSD to `recipient`.
    public entry fun mint(cap: &mut TreasuryCap<EUSD>, amount: u64, recipient: address, ctx: &mut TxContext) {
        let c = coin::mint(cap, amount, ctx);
        transfer::public_transfer(c, recipient);
    }

    /// Treasury-only: mint and return a Coin (for composing inside a PTB, e.g. repay).
    public fun mint_coin(cap: &mut TreasuryCap<EUSD>, amount: u64, ctx: &mut TxContext): Coin<EUSD> {
        coin::mint(cap, amount, ctx)
    }
}
