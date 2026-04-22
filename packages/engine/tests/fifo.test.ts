import { describe, it, expect } from 'vitest';
import { computeBrokerFIFO } from '../src/fifo.js';
import type { StockTransaction } from '@taxai/shared';

function txn(overrides: Partial<StockTransaction> & Pick<StockTransaction, 'transactionType' | 'date' | 'totalAmount'>): StockTransaction {
  return {
    assetId: 'AAPL',
    fees: 0,
    currency: 'EUR',
    ...overrides,
  };
}

describe('computeBrokerFIFO', () => {
  it('simple buy then sell same asset: gain = (sell - buy) - fees', () => {
    const transactions: StockTransaction[] = [
      txn({ transactionType: 'buy',  date: '2025-01-10', totalAmount: -1000, quantity: 10, fees: 5 }),
      txn({ transactionType: 'sell', date: '2025-06-15', totalAmount: 1200, quantity: 10, fees: 5 }),
    ];
    const result = computeBrokerFIFO(transactions);
    // cost basis = 1000 + 5 = 1005, net proceeds = 1200 - 5 = 1195
    // gain = 1195 - 1005 = 190
    expect(result.capitalGains).toBeCloseTo(190, 2);
    expect(result.dividends).toBe(0);
    expect(result.interest).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('FIFO with 2 lots at different prices: verify correct lot consumption', () => {
    const transactions: StockTransaction[] = [
      txn({ transactionType: 'buy',  date: '2025-01-01', totalAmount: -500, quantity: 5, fees: 2 }),   // lot1: 5 @ 100.4 each
      txn({ transactionType: 'buy',  date: '2025-02-01', totalAmount: -600, quantity: 5, fees: 2 }),   // lot2: 5 @ 120.4 each
      txn({ transactionType: 'sell', date: '2025-09-01', totalAmount: 700,  quantity: 6, fees: 3 }),   // sell 6 shares
    ];
    const result = computeBrokerFIFO(transactions);
    // Lot 1 cost per share = (500 + 2) / 5 = 100.4
    // Lot 2 cost per share = (600 + 2) / 5 = 120.4
    // FIFO: consume all 5 of lot1 (cost 502) + 1 from lot2 (cost 120.4)
    // Total cost basis = 502 + 120.4 = 622.4
    // Net proceeds = 700 - 3 = 697
    // Gain = 697 - 622.4 = 74.6
    expect(result.capitalGains).toBeCloseTo(74.6, 1);
  });

  it('loss sale: negative capital gain returned correctly', () => {
    const transactions: StockTransaction[] = [
      txn({ transactionType: 'buy',  date: '2025-01-01', totalAmount: -1000, quantity: 10, fees: 5 }),
      txn({ transactionType: 'sell', date: '2025-12-01', totalAmount: 800,   quantity: 10, fees: 5 }),
    ];
    const result = computeBrokerFIFO(transactions);
    // cost = 1005, proceeds = 795, gain = -210
    expect(result.capitalGains).toBeCloseTo(-210, 2);
  });

  it('mixed assets: gains and losses summed correctly', () => {
    const transactions: StockTransaction[] = [
      { assetId: 'AAPL', transactionType: 'buy',  date: '2025-01-01', totalAmount: -1000, quantity: 10, fees: 0, currency: 'EUR' },
      { assetId: 'AAPL', transactionType: 'sell', date: '2025-06-01', totalAmount: 1200,  quantity: 10, fees: 0, currency: 'EUR' },  // +200
      { assetId: 'TSLA', transactionType: 'buy',  date: '2025-01-01', totalAmount: -500,  quantity: 5,  fees: 0, currency: 'EUR' },
      { assetId: 'TSLA', transactionType: 'sell', date: '2025-06-01', totalAmount: 400,   quantity: 5,  fees: 0, currency: 'EUR' },  // -100
    ];
    const result = computeBrokerFIFO(transactions);
    expect(result.capitalGains).toBeCloseTo(100, 2); // 200 - 100 = 100
  });

  it('dividend + interest: correctly separated from capital gains', () => {
    const transactions: StockTransaction[] = [
      txn({ transactionType: 'dividend', date: '2025-06-01', totalAmount: 150, fees: 0 }),
      txn({ transactionType: 'interest', date: '2025-12-01', totalAmount: 50, fees: 0 }),
    ];
    const result = computeBrokerFIFO(transactions);
    expect(result.capitalGains).toBe(0);
    expect(result.dividends).toBe(150);
    expect(result.interest).toBe(50);
  });

  it('non-EUR transaction without fxRate: warning added, fxRate defaults to 1.0', () => {
    const transactions: StockTransaction[] = [
      txn({ transactionType: 'buy',  date: '2025-01-01', totalAmount: -1000, quantity: 10, fees: 0, currency: 'USD', fxRate: undefined }),
      txn({ transactionType: 'sell', date: '2025-06-01', totalAmount: 1200,  quantity: 10, fees: 0, currency: 'USD', fxRate: undefined }),
    ];
    const result = computeBrokerFIFO(transactions);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('fxRate'))).toBe(true);
    // With fxRate=1.0 fallback: cost=1000, proceeds=1200, gain=200
    expect(result.capitalGains).toBeCloseTo(200, 2);
  });

  it('anti-washing-sale: loss deferred when same asset repurchased within 2 months', () => {
    const transactions: StockTransaction[] = [
      txn({ assetId: 'AAPL', transactionType: 'buy',  date: '2025-01-01', totalAmount: -1000, quantity: 10, fees: 0, currency: 'EUR' }),
      txn({ assetId: 'AAPL', transactionType: 'sell', date: '2025-06-01', totalAmount: 800,   quantity: 10, fees: 0, currency: 'EUR' }),  // loss: -200
      txn({ assetId: 'AAPL', transactionType: 'buy',  date: '2025-07-01', totalAmount: -900,  quantity: 10, fees: 0, currency: 'EUR' }),  // repurchase within 2 months → defer loss
    ];
    const result = computeBrokerFIFO(transactions);
    // Loss of -200 should be deferred (NOT included in capitalGains)
    // The gain should be 0 (loss deferred)
    expect(result.capitalGains).toBe(0);
    expect(result.warnings.some(w => w.toLowerCase().includes('defer'))).toBe(true);
  });

  it('foreignTaxWithheld summed across all dividend entries', () => {
    const transactions: StockTransaction[] = [
      txn({ transactionType: 'dividend', date: '2025-03-01', totalAmount: 100, fees: 0, foreignTaxWithheld: 15 }),
      txn({ transactionType: 'dividend', date: '2025-09-01', totalAmount: 100, fees: 0, foreignTaxWithheld: 15 }),
    ];
    const result = computeBrokerFIFO(transactions);
    expect(result.totalForeignTaxWithheld).toBeCloseTo(30, 2);
    expect(result.dividends).toBeCloseTo(200, 2);
  });
});
