const CHART_DAYS = { '1M': 22, '3M': 66, '6M': 132, '1Y': 264, ALL: Infinity };

export function computePortfolioSummary(trades, stockSeedData, currentSimDate, initialCash, cashFlows, timeframe = 'ALL') {
  const stocks = stockSeedData || [];
  const refStock = stocks[0];
  const ohlcvDates = refStock?.ohlcv_data?.map(d => d.date) || [];
  const simDate = currentSimDate || '';
  const effectiveIdx = ohlcvDates.indexOf(simDate);
  const boundIdx = effectiveIdx >= 0 ? effectiveIdx : Math.max(0, ohlcvDates.length - 1);

  const priceLookup = {};
  stocks.forEach(s => { if (s.ohlcv_data) priceLookup[s.symbol] = s.ohlcv_data.map(d => d.close); });

  const validTrades = (trades || []).filter(t => {
    const td = t.sim_date || t.trade_date || '';
    return td <= simDate;
  });

  const holdingsMap = {};
  validTrades.forEach(t => {
    if (!holdingsMap[t.stock_symbol]) holdingsMap[t.stock_symbol] = { qty: 0, totalCost: 0, sector: t.sector, name: t.stock_name };
    if (t.trade_type === 'BUY') { holdingsMap[t.stock_symbol].qty += t.quantity; holdingsMap[t.stock_symbol].totalCost += t.total_value; }
    else { holdingsMap[t.stock_symbol].qty -= t.quantity; holdingsMap[t.stock_symbol].totalCost -= t.price * t.quantity; }
  });

  const holdings = Object.entries(holdingsMap).filter(([, h]) => h.qty > 0).map(([symbol, h]) => {
    const prices = priceLookup[symbol] || [];
    const currentPrice = boundIdx < prices.length ? prices[boundIdx] : (prices[prices.length - 1] || 0);
    const avgCost = h.totalCost / h.qty;
    const currentValue = currentPrice * h.qty;
    return { symbol, ...h, avgCost, currentPrice, currentValue, pnl: currentValue - h.totalCost, pnlPct: h.totalCost > 0 ? ((currentValue - h.totalCost) / h.totalCost) * 100 : 0 };
  });

  const totalInvestedValue = holdings.reduce((s, h) => s + h.totalCost, 0);
  const currentMarketValue = holdings.reduce((s, h) => s + h.currentValue, 0);

  // Cash computation using Date objects for alignment
  const sortedTrades = [...validTrades].sort((a, b) => {
    const da = new Date(a.sim_date || a.trade_date || '1970-01-01');
    const db = new Date(b.sim_date || b.trade_date || '1970-01-01');
    return da - db;
  });
  const sortedFlows = (cashFlows || []).sort((a, b) => new Date(a.date) - new Date(b.date));

  const equityCurveData = [];
  let tradePtr = 0, flowPtr = 0, cashBalance = initialCash;
  let totalNetFlows = 0;
  let weightedFlowSum = 0;

  for (let day = 0; day <= boundIdx; day++) {
    const date = ohlcvDates[day];
    const dateObj = new Date(date);

    // Process trades
    while (tradePtr < sortedTrades.length) {
      const t = sortedTrades[tradePtr];
      const tDate = new Date(t.sim_date || t.trade_date || '1970-01-01');
      if (tDate <= dateObj) {
        if (t.trade_type === 'BUY') { cashBalance -= t.total_value; totalNetFlows -= t.total_value; }
        else { cashBalance += t.total_value; totalNetFlows += t.total_value; }
        if (t.fees_paid) { cashBalance -= t.fees_paid; totalNetFlows -= t.fees_paid; }
        tradePtr++;
      } else break;
    }

    // Process cash flows (SIPs etc.)
    while (flowPtr < sortedFlows.length) {
      const f = sortedFlows[flowPtr];
      if (new Date(f.date) <= dateObj) {
        cashBalance += f.amount;
        totalNetFlows += f.amount;
        weightedFlowSum += f.amount * ((boundIdx - ohlcvDates.indexOf(f.date)) / Math.max(boundIdx, 1));
        flowPtr++;
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

  const endValue = equityCurveData.length > 0 ? equityCurveData[equityCurveData.length - 1].value : initialCash;
  const beginningValue = initialCash;
  const netCashFlows = totalNetFlows;

  // Modified Dietz return
  const denominator = beginningValue + weightedFlowSum;
  const totalReturnPct = denominator > 0 ? +((endValue - beginningValue - netCashFlows) / denominator * 100).toFixed(2) : 0;
  const totalReturn = +(endValue - beginningValue - netCashFlows).toFixed(2);

  const holdingsValueMap = {};
  holdings.forEach(h => { holdingsValueMap[h.symbol] = { qty: h.qty, currentValue: h.currentValue, pnlPct: h.pnlPct, name: h.name, sector: h.sector }; });
  const sectorMap = {};
  holdings.forEach(h => { const s = h.sector || 'Other'; sectorMap[s] = (sectorMap[s] || 0) + h.currentValue; });
  const sectorAllocation = Object.entries(sectorMap).map(([n, v]) => ({ name: n, value: +v.toFixed(0) })).sort((a, b) => b.value - a.value);

  const sortedByPnl = [...holdings].sort((a, b) => b.pnlPct - a.pnlPct);
  const topGainers = sortedByPnl.filter(h => h.pnlPct > 0).slice(0, 3);
  const topLosers = sortedByPnl.filter(h => h.pnlPct < 0).reverse().slice(0, 3);

  const maxDays = CHART_DAYS[timeframe] ?? Infinity;
  const slicedEquity = maxDays < equityCurveData.length
    ? equityCurveData.slice(equityCurveData.length - maxDays)
    : equityCurveData;

  return {
    totalPortfolioValue: +endValue.toFixed(2),
    totalInvestedValue: +totalInvestedValue.toFixed(2),
    currentCash: +cashBalance.toFixed(2),
    currentMarketValue: +currentMarketValue.toFixed(2),
    totalReturn: +totalReturn.toFixed(2),
    totalReturnPct,
    holdings, equityCurveData: slicedEquity, sectorAllocation, topGainers, topLosers,
    holdingsCount: holdings.length, holdingsValueMap,
  };
}
