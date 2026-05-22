export function computePortfolioSummary(trades, stockSeedData, currentSimDate, initialCash) {
  const stocks = stockSeedData || [];
  const refStock = stocks[0];
  const ohlcvDates = refStock?.ohlcv_data?.map(d => d.date) || [];
  const simIdx = ohlcvDates.indexOf(currentSimDate || '');
  const effectiveIdx = simIdx >= 0 ? simIdx : Math.max(0, ohlcvDates.length - 1);

  const priceLookup = {};
  stocks.forEach(s => { if (s.ohlcv_data) priceLookup[s.symbol] = s.ohlcv_data.map(d => d.close); });

  const validTrades = (trades || []).filter(t => (t.sim_date || t.trade_date) <= (currentSimDate || ''));

  const holdingsMap = {};
  validTrades.forEach(t => {
    if (!holdingsMap[t.stock_symbol]) holdingsMap[t.stock_symbol] = { qty: 0, totalCost: 0, sector: t.sector, name: t.stock_name };
    if (t.trade_type === 'BUY') { holdingsMap[t.stock_symbol].qty += t.quantity; holdingsMap[t.stock_symbol].totalCost += t.total_value; }
    else { holdingsMap[t.stock_symbol].qty -= t.quantity; holdingsMap[t.stock_symbol].totalCost -= t.price * t.quantity; }
  });

  const holdings = Object.entries(holdingsMap).filter(([, h]) => h.qty > 0).map(([symbol, h]) => {
    const prices = priceLookup[symbol] || [];
    const currentPrice = effectiveIdx < prices.length ? prices[effectiveIdx] : (prices[prices.length - 1] || 0);
    const avgCost = h.totalCost / h.qty;
    const currentValue = currentPrice * h.qty;
    return { symbol, ...h, avgCost, currentPrice, currentValue, pnl: currentValue - h.totalCost, pnlPct: h.totalCost > 0 ? ((currentValue - h.totalCost) / h.totalCost) * 100 : 0 };
  });

  const totalInvestedValue = holdings.reduce((s, h) => s + h.totalCost, 0);
  const currentMarketValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  let cashSpent = 0, cashReceived = 0;
  validTrades.forEach(t => { if (t.trade_type === 'BUY') cashSpent += t.total_value; else cashReceived += t.total_value; });
  const currentCash = initialCash - cashSpent + cashReceived;
  const totalPortfolioValue = currentCash + currentMarketValue;
  const totalPnL = totalPortfolioValue - initialCash;

  const sortedTrades = [...validTrades].sort((a, b) => ohlcvDates.indexOf(a.sim_date || a.trade_date || '') - ohlcvDates.indexOf(b.sim_date || b.trade_date || ''));
  const equityCurveData = [];
  let tradePtr = 0, cashBalance = initialCash;
  for (let day = 0; day <= effectiveIdx; day++) {
    const date = ohlcvDates[day];
    while (tradePtr < sortedTrades.length) {
      const t = sortedTrades[tradePtr];
      if ((t.sim_date || t.trade_date || '') <= date) {
        if (t.trade_type === 'BUY') cashBalance -= t.total_value; else cashBalance += t.total_value;
        tradePtr++;
      } else break;
    }
    let marketValue = 0;
    Object.entries(holdingsMap).forEach(([symbol, h]) => {
      if (h.qty > 0) {
        const prices = priceLookup[symbol] || [];
        marketValue += (prices[day] || 0) * h.qty;
      }
    });
    equityCurveData.push({ date: date || '', value: +(cashBalance + marketValue).toFixed(2) });
  }

  const holdingsValueMap = {};
  holdings.forEach(h => { holdingsValueMap[h.symbol] = { qty: h.qty, currentValue: h.currentValue, pnlPct: h.pnlPct, name: h.name, sector: h.sector }; });
  const sectorMap = {};
  holdings.forEach(h => { const s = h.sector || 'Other'; sectorMap[s] = (sectorMap[s] || 0) + h.currentValue; });
  const sectorAllocation = Object.entries(sectorMap).map(([n, v]) => ({ name: n, value: +v.toFixed(0) })).sort((a, b) => b.value - a.value);

  const sortedByPnl = [...holdings].sort((a, b) => b.pnlPct - a.pnlPct);
  const topGainers = sortedByPnl.filter(h => h.pnlPct > 0).slice(0, 3);
  const topLosers = sortedByPnl.filter(h => h.pnlPct < 0).reverse().slice(0, 3);

  return {
    totalPortfolioValue: +totalPortfolioValue.toFixed(2),
    totalInvestedValue: +totalInvestedValue.toFixed(2),
    currentCash: +currentCash.toFixed(2), currentMarketValue: +currentMarketValue.toFixed(2),
    totalReturn: +totalPnL.toFixed(2),
    totalReturnPct: initialCash > 0 ? +((totalPnL / initialCash) * 100).toFixed(2) : 0,
    holdings, equityCurveData, sectorAllocation, topGainers, topLosers, holdingsCount: holdings.length, holdingsValueMap,
  };
}
