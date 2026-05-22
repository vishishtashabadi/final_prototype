/**
 * Synchronous portfolio math engine.
 * All inputs: trades array, stockSeedData (with ohlcv_data), currentSimDate string, initialCash number.
 * Returns aggregate dashboard data for immediate consumption.
 */

export function computePortfolioSummary(trades, stockSeedData, currentSimDate, initialCash) {
  const simDate = currentSimDate || '';
  const stocks = stockSeedData || [];

  // ── 1. Generate the date index map from the first stock's OHLCV ──
  const refStock = stocks[0];
  const ohlcvDates = refStock?.ohlcv_data?.map(d => d.date) || [];
  const simIdx = ohlcvDates.indexOf(simDate);
  const effectiveIdx = simIdx >= 0 ? simIdx : ohlcvDates.length - 1;

  // Build a fast price lookup: symbol => array of close prices indexed by day
  const priceLookup = {};
  stocks.forEach(s => {
    if (s.ohlcv_data) {
      priceLookup[s.symbol] = s.ohlcv_data.map(d => d.close);
    }
  });

  // ── 2. Filter trades up to currentSimDate ──
  const validTrades = (trades || []).filter(t => {
    // Support both sim_date and trade_date, fallback to created_date
    const tDate = t.sim_date || t.trade_date;
    return tDate <= simDate;
  });

  // ── 3. Compute current holdings (shares + weighted avg cost) ──
  const holdingsMap = {};
  validTrades.forEach(t => {
    const sym = t.stock_symbol;
    if (!holdingsMap[sym]) holdingsMap[sym] = { qty: 0, totalCost: 0, sector: t.sector, name: t.stock_name };
    if (t.trade_type === 'BUY') {
      holdingsMap[sym].qty += t.quantity;
      holdingsMap[sym].totalCost += t.total_value;
    } else {
      holdingsMap[sym].qty -= t.quantity;
      holdingsMap[sym].totalCost -= t.price * t.quantity;
    }
  });

  const holdings = Object.entries(holdingsMap)
    .filter(([, h]) => h.qty > 0)
    .map(([symbol, h]) => {
      const prices = priceLookup[symbol] || [];
      const currentPrice = simIdx >= 0 && prices[simIdx] ? prices[simIdx] : (prices[prices.length - 1] || 0);
      const avgCost = h.totalCost / h.qty;
      const currentValue = currentPrice * h.qty;
      const pnl = currentValue - h.totalCost;
      const pnlPct = h.totalCost > 0 ? (pnl / h.totalCost) * 100 : 0;
      return { symbol, ...h, avgCost, currentPrice, currentValue, pnl, pnlPct };
    });

  const totalInvestedValue = holdings.reduce((s, h) => s + h.totalCost, 0);
  const currentMarketValue = holdings.reduce((s, h) => s + h.currentValue, 0);

  // ── 4. Cash balance at currentSimDate ──
  let cashSpent = 0, cashReceived = 0;
  validTrades.forEach(t => {
    if (t.trade_type === 'BUY') cashSpent += t.total_value;
    else cashReceived += t.total_value;
  });
  const currentCash = initialCash - cashSpent + cashReceived;

  const totalPortfolioValue = currentCash + currentMarketValue;
  const totalPnL = totalPortfolioValue - initialCash;

  // ── 5. Historical equity curve ──
  // Walk day-by-day from 0 to effectiveIdx
  const equityCurveData = [];
  const runningBalances = []; // cash balance at each point

  // Pre-sort trades by sim_date index for sequential walk
  const sortedTrades = [...validTrades].sort((a, b) => {
    const da = a.sim_date || a.trade_date || '';
    const db = b.sim_date || b.trade_date || '';
    return ohlcvDates.indexOf(da) - ohlcvDates.indexOf(db);
  });
  let tradePtr = 0;
  let cashBalance = initialCash;

  for (let day = 0; day <= effectiveIdx; day++) {
    const date = ohlcvDates[day];
    // Process trades that occur on this date
    while (tradePtr < sortedTrades.length) {
      const t = sortedTrades[tradePtr];
      const tDate = t.sim_date || t.trade_date || '';
      if (tDate <= date) {
        if (t.trade_type === 'BUY') cashBalance -= t.total_value;
        else cashBalance += t.total_value;
        tradePtr++;
      } else break;
    }

    // Compute market value of holdings at this day's close prices
    let marketValue = 0;
    Object.entries(holdingsMap).forEach(([symbol, h]) => {
      if (h.qty > 0) {
        const prices = priceLookup[symbol] || [];
        const price = prices[day] || 0;
        marketValue += price * h.qty;
      }
    });
    const totalValue = cashBalance + marketValue;
    equityCurveData.push({
      date: date || '',
      value: +totalValue.toFixed(2),
      cash: +cashBalance.toFixed(2),
      invested: +marketValue.toFixed(2),
    });
  }

  // ── 6. Sector allocation ──
  const sectorMap = {};
  holdings.forEach(h => {
    const sector = h.sector || 'Other';
    sectorMap[sector] = (sectorMap[sector] || 0) + h.currentValue;
  });
  const sectorAllocation = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value: +value.toFixed(0) }))
    .sort((a, b) => b.value - a.value);

  // ── 7. Top gainers / losers ──
  const sortedByPnl = [...holdings].sort((a, b) => b.pnlPct - a.pnlPct);
  const topGainers = sortedByPnl.filter(h => h.pnlPct > 0).slice(0, 3);
  const topLosers = sortedByPnl.filter(h => h.pnlPct < 0).reverse().slice(0, 3);

  return {
    totalPortfolioValue: +totalPortfolioValue.toFixed(2),
    totalInvestedValue: +totalInvestedValue.toFixed(2),
    currentCash: +currentCash.toFixed(2),
    currentMarketValue: +currentMarketValue.toFixed(2),
    totalPnL: +totalPnL.toFixed(2),
    totalPnLPct: initialCash > 0 ? +((totalPnL / initialCash) * 100).toFixed(2) : 0,
    holdings,
    equityCurveData,
    sectorAllocation,
    topGainers,
    topLosers,
    holdingsCount: holdings.length,
  };
}
