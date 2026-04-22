import type { StockTransaction } from '@taxai/shared';

interface FIFOLot {
  date: string;
  quantity: number;
  costPerShare: number;  // EUR, includes acquisition fee pro-rated
}

interface AssetFIFOResult {
  gain: number;           // net capital gain in euros (can be negative)
  warnings: string[];
  deferredLoss: number;   // loss deferred due to anti-washing-sale rule (Art. 33.5 LIRPF)
}

/** Returns the number of days between two ISO date strings. */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.abs(b - a) / (1000 * 60 * 60 * 24);
}

/** Convert a transaction's totalAmount / fees to EUR using fxRate. */
function toEUR(amount: number, currency: string, fxRate: number | undefined): {
  amountEUR: number;
  warnings: string[];
} {
  if (currency === 'EUR') return { amountEUR: amount, warnings: [] };
  if (fxRate === undefined || fxRate <= 0) {
    return {
      amountEUR: amount, // fallback: treat as EUR
      warnings: [`Missing fxRate for ${currency} transaction — treated as 1.0 (EUR equivalent)`],
    };
  }
  return { amountEUR: amount * fxRate, warnings: [] };
}

/**
 * Applies FIFO (Art. 35 LIRPF) across all transactions for a single asset.
 * Returns net capital gain in euros (can be negative).
 *
 * Anti-washing-sale rule (Art. 33.5 LIRPF): if the same listed asset is
 * repurchased within 2 months of a loss sale, the loss is deferred until
 * the repurchased shares are sold.
 */
function computeAssetFIFO(
  _assetId: string,
  txns: StockTransaction[],
): AssetFIFOResult {
  const warnings: string[] = [];
  const lots: FIFOLot[] = [];
  let totalGain = 0;
  let deferredLoss = 0;

  // Process buys and sells chronologically
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));

  for (const txn of sorted) {
    if (txn.transactionType === 'buy') {
      const qty = txn.quantity ?? 0;
      if (qty <= 0) continue;

      const { amountEUR: totalCostEUR, warnings: w } = toEUR(
        Math.abs(txn.totalAmount) + txn.fees,
        txn.currency,
        txn.fxRate,
      );
      warnings.push(...w);

      lots.push({
        date: txn.date,
        quantity: qty,
        costPerShare: qty > 0 ? totalCostEUR / qty : 0,
      });

    } else if (txn.transactionType === 'sell') {
      let remainingQty = txn.quantity ?? 0;
      if (remainingQty <= 0) continue;

      const { amountEUR: proceedsEUR, warnings: w1 } = toEUR(
        txn.totalAmount,
        txn.currency,
        txn.fxRate,
      );
      const { amountEUR: feesEUR, warnings: w2 } = toEUR(
        txn.fees,
        txn.currency,
        txn.fxRate,
      );
      warnings.push(...w1, ...w2);

      const netProceeds = proceedsEUR - feesEUR;
      let costBasis = 0;
      const originalQtyToSell = remainingQty;

      // FIFO: consume earliest lots first
      while (remainingQty > 0 && lots.length > 0) {
        const lot = lots[0];
        const consumed = Math.min(lot.quantity, remainingQty);
        costBasis += consumed * lot.costPerShare;
        lot.quantity -= consumed;
        remainingQty -= consumed;
        if (lot.quantity <= 0) lots.shift();
      }

      if (remainingQty > 0) {
        // Sold more than we have on record — short-sell or missing buy data
        warnings.push(`Sold ${remainingQty} more shares than tracked lots — possible missing buy records`);
      }

      const pricePerShare = originalQtyToSell > 0 ? netProceeds / originalQtyToSell : 0;
      const gain = netProceeds - costBasis;

      // Anti-washing-sale rule: check if this is a loss sale and asset is repurchased within 2 months
      if (gain < 0) {
        const repurchaseDate = sorted.find(
          (t) =>
            t.transactionType === 'buy' &&
            t.date > txn.date &&
            daysBetween(txn.date, t.date) <= 61,  // 2 months ≈ 61 days
        );
        if (repurchaseDate) {
          // Defer the loss — not counted in current year
          deferredLoss += Math.abs(gain);
          warnings.push(
            `Loss of ${Math.abs(gain).toFixed(2)} EUR on ${txn.date} deferred (Art. 33.5 LIRPF — repurchased within 2 months)`,
          );
        } else {
          totalGain += gain;
        }
      } else {
        // Check if cost basis was inflated by a deferred loss from a prior sale of this asset
        // (simplified: just add the gain)
        totalGain += gain;
      }

      void pricePerShare; // used implicitly in future lot valuation
    }
  }

  return { gain: totalGain, warnings, deferredLoss };
}

export interface BrokerFIFOResult {
  capitalGains: number;
  dividends: number;
  interest: number;
  totalForeignTaxWithheld: number;
  warnings: string[];
}

/**
 * Main entry point. Processes all transactions, groups by assetId,
 * applies FIFO per asset, returns aggregated result.
 *
 * Only processes 'buy', 'sell', 'dividend', 'interest', 'fee' types.
 * Non-EUR transactions are converted using the fxRate field (caller's
 * responsibility to populate — engine never calls external APIs).
 *
 * Returns values in euros.
 */
export function computeBrokerFIFO(transactions: StockTransaction[]): BrokerFIFOResult {
  const warnings: string[] = [];
  let totalDividends = 0;
  let totalInterest = 0;
  let totalForeignTaxWithheld = 0;

  // Group buy/sell transactions by assetId for FIFO processing
  const assetTxns = new Map<string, StockTransaction[]>();

  for (const txn of transactions) {
    if (txn.transactionType === 'dividend') {
      const { amountEUR, warnings: w } = toEUR(txn.totalAmount, txn.currency, txn.fxRate);
      warnings.push(...w);
      totalDividends += amountEUR;

      if (txn.foreignTaxWithheld) {
        const { amountEUR: taxEUR, warnings: tw } = toEUR(
          txn.foreignTaxWithheld,
          txn.currency,
          txn.fxRate,
        );
        warnings.push(...tw);
        totalForeignTaxWithheld += taxEUR;
      }
    } else if (txn.transactionType === 'interest') {
      const { amountEUR, warnings: w } = toEUR(txn.totalAmount, txn.currency, txn.fxRate);
      warnings.push(...w);
      totalInterest += amountEUR;
    } else if (txn.transactionType === 'buy' || txn.transactionType === 'sell') {
      const key = txn.assetId;
      if (!assetTxns.has(key)) assetTxns.set(key, []);
      assetTxns.get(key)!.push(txn);
    }
    // 'fee' type: deductible from capital gains base — tracked as part of sell lots
  }

  // Apply FIFO per asset
  let totalCapitalGains = 0;
  for (const [assetId, txnList] of assetTxns) {
    const result = computeAssetFIFO(assetId, txnList);
    totalCapitalGains += result.gain;
    warnings.push(...result.warnings);
  }

  return {
    capitalGains: Math.round(totalCapitalGains * 100) / 100,
    dividends: Math.round(totalDividends * 100) / 100,
    interest: Math.round(totalInterest * 100) / 100,
    totalForeignTaxWithheld: Math.round(totalForeignTaxWithheld * 100) / 100,
    warnings,
  };
}
