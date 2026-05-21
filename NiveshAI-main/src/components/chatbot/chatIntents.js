// Portfolio Assistant Intent Engine
// Processes user messages and returns structured, context-aware responses

import { formatCurrency } from '@/lib/stockData';

function calculateHealthScore(holdings, profile) {
  const totalVal = holdings.reduce((sum, h) => sum + h.currentVal, 0);
  const totalInv = holdings.reduce((sum, h) => sum + h.invested, 0);
  const pnl = totalVal - totalInv;
  const pnlPct = totalInv > 0 ? (pnl / totalInv) * 100 : 0;

  const sectorCounts = {};
  holdings.forEach(h => { sectorCounts[h.sector] = (sectorCounts[h.sector] || 0) + h.currentVal; });
  const maxSectorPct = Math.max(...Object.values(sectorCounts).map(v => totalVal > 0 ? v / totalVal : 0));

  const riskTolerance = profile?.risk_tolerance || 'moderate';
  let health = 70;

  if (pnl >= 5) health += 10;
  if (pnl >= 15) health += 10;
  if (pnl < -5) health -= 10;
  if (pnl < -15) health -= 20;
  if (maxSectorPct > 0.5) health -= 15;
  if (holdings.length >= 5) health += 10;
  if (riskTolerance === 'conservative' && maxSectorPct > 0.4) health -= 10;
  if (riskTolerance === 'aggressive' && maxSectorPct > 0.6) health -= 5;

  return Math.min(100, Math.max(0, health));
}

function calculateMonthlyInvestable(profile) {
  if (!profile) return 0;
  const income = Number(profile.monthly_income || 0);
  const expenses = Number(profile.monthly_expenses || 0);
  const savings = Number(profile.total_savings || 0);
  const surplus = income - expenses;

  let allocation = 0.2;
  if (profile.risk_tolerance === 'conservative') allocation = 0.1;
  if (profile.risk_tolerance === 'aggressive') allocation = 0.3;

  const investableFromSavings = savings * allocation;
  const investableFromSurplus = surplus * allocation;
  return investableFromSurplus + (investableFromSavings / 12);
}

function calculateWhatIf(symbol, qty, context) {
  const stock = context.stocks?.find(s => s.symbol === symbol);
  if (!stock) return null;

  const numQty = Number(qty);
  const totalCost = numQty * stock.current_price;
  const currentHolding = context.holdings?.find(h => h.symbol === symbol);

  let newAvg = stock.current_price;
  let newTotalQty = numQty;
  if (currentHolding) {
    newTotalQty = currentHolding.qty + numQty;
    newAvg = (currentHolding.avgPrice * currentHolding.qty + totalCost) / newTotalQty;
  }

  const investable = calculateMonthlyInvestable(context.profile);
  const canAfford = investable >= totalCost;

  return {
    symbol,
    buyQty: numQty,
    buyPrice: stock.current_price,
    totalCost,
    newAvg,
    newTotalQty,
    investablePerMonth: investable,
    monthsToRecover: investable > 0 ? totalCost / investable : 0,
    canAfford,
    signal: stock.signal,
    reasoning: stock.signal_reasoning,
  };
}

function getDailyTip(context) {
  const profile = context.profile;
  const holdings = context.holdings || [];
  const watchlist = context.watchlist || [];
  const investable = calculateMonthlyInvestable(profile);

  // Find a stock from watchlist with interesting signal
  const watchStock = watchlist.find(ws => {
    const s = context.stocks?.find(st => st.symbol === ws.symbol);
    return s && (s.signal === 'STRONG_BUY' || s.signal === 'BUY');
  });

  const fallbackStock = context.stocks?.find(s => s.signal === 'STRONG_BUY');
  const recStock = watchStock ? context.stocks?.find(s => s.symbol === watchStock.symbol) : fallbackStock;

  const tips = [];

  if (investable > 0) {
    tips.push(`You have ~${formatCurrency(investable)} investable this month. Consider investing small amounts regularly.`);
  } else {
    tips.push(`Your expenses are close to your income. Focus on building savings before investing.`);
  }

  if (recStock) {
    const change = ((recStock.current_price - recStock.week_52_low) / recStock.week_52_low * 100).toFixed(1);
    tips.push(`${recStock.name} (${recStock.symbol}) is looking attractive with a STRONG BUY signal.`);
  }

  if (holdings.length > 0) {
    const totalVal = holdings.reduce((sum, h) => sum + h.currentVal, 0);
    const totalInv = holdings.reduce((sum, h) => sum + h.invested, 0);
    const pnl = totalVal - totalInv;
    if (pnl < -5000) tips.push(`Your portfolio is down ${formatCurrency(pnl)}. Consider reviewing your positions.`);
    if (pnl > 5000) tips.push(`Your portfolio is up ${formatCurrency(pnl)}! Great job, keep it up.`);
  }

  return tips.join(' ');
}

function getRiskAnalysis(context) {
  const profile = context.profile;
  const holdings = context.holdings || [];
  const totalVal = holdings.reduce((sum, h) => sum + h.currentVal, 0);

  let riskScore = 0;
  let factors = [];

  if (totalVal > 500000) {
    riskScore += 20;
    factors.push({ text: 'Large portfolio size', type: 'risk' });
  }

  const sectorCounts = {};
  holdings.forEach(h => { if (h.sector) sectorCounts[h.sector] = (sectorCounts[h.sector] || 0) + 1; });
  const maxSector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0];
  if (maxSector && maxSector[1] / holdings.length > 0.5) {
    riskScore += 25;
    factors.push({ text: `High exposure to ${maxSector[0]} sector`, type: 'risk' });
  }

  if (profile?.risk_tolerance === 'aggressive') {
    riskScore += 15;
    factors.push({ text: 'Aggressive risk profile', type: 'risk' });
  }

  if (profile?.risk_tolerance === 'conservative') {
    riskScore -= 10;
    factors.push({ text: 'Conservative risk profile', type: 'good' });
  }

  if (holdings.length < 5) {
    riskScore += 10;
    factors.push({ text: 'Portfolio under-diversified', type: 'risk' });
  } else {
    factors.push({ text: 'Good diversification', type: 'good' });
  }

  riskScore = Math.min(100, Math.max(0, riskScore));

  let level = 'Low';
  if (riskScore > 30) level = 'Moderate';
  if (riskScore > 60) level = 'High';

  return { score: Math.round(riskScore), level, factors };
}

function parseWhatIf(msg) {
  const matches = msg.match(/(\d+)\s+(?:shares?|qty|quantity)?\s*(?:of\s+)?(\w+)/i);
  if (matches) return { qty: parseInt(matches[1]), symbol: matches[2].toUpperCase() };

  const matches2 = msg.match(/buy\s+(\d+)\s+shares?\s+(?:of\s+)?(\w+)/i);
  if (matches2) return { qty: parseInt(matches2[1]), symbol: matches2[2].toUpperCase() };

  return null;
}

export function processChatMessage(message, context) {
  const lower = message.toLowerCase().trim();

  // Greeting
  if (/^(hi|hello|hey|namaste|hola)\b/.test(lower)) {
    return {
      type: 'text',
      content: `Hello! I'm your NiveshAI Portfolio Assistant. I can help you with:\n\n` +
        `**Investment Advice** — "What should I buy?"\n` +
        `**Portfolio Analysis** — "How am I doing?"\n` +
        `**What-If Scenarios** — "What if I buy 10 shares of Reliance?"\n` +
        `**Risk Score** — "How risky is my portfolio?"\n` +
        `**Daily Tip** — "Give me a tip"\n\n` +
        `Type **help** to see all commands.`
    };
  }

  // Help
  if (/^(help|commands|what can you do)/.test(lower)) {
    return {
      type: 'commands'
    };
  }

  // Investment Advice
  if (lower.match(/(what should i (buy|invest)|investment advice|recommend|suggest)/)) {
    const buyStocks = (context.stocks || [])
      .filter(s => s.signal === 'STRONG_BUY' || s.signal === 'BUY')
      .slice(0, 3);

    if (!buyStocks.length) {
      return { type: 'text', content: 'No strong buy signals at the moment. Keep watching your watchlist!' };
    }

    return {
      type: 'recommendations',
      content: `Based on current signals, here are some stocks to consider:`,
      stocks: buyStocks.map(s => ({
        symbol: s.symbol,
        name: s.name,
        price: s.current_price,
        signal: s.signal,
        reasoning: s.signal_reasoning,
      }))
    };
  }

  // What If
  const whatIf = parseWhatIf(message);
  if (whatIf) {
    const result = calculateWhatIf(whatIf.symbol, whatIf.qty, context);
    if (!result) {
      return { type: 'text', content: `I couldn't find ${whatIf.symbol} in our database.` };
    }
    return {
      type: 'whatif',
      content: `Here's the impact of buying **${result.buyQty} shares** of **${result.symbol}** at ${formatCurrency(result.buyPrice)}:`,
      result
    };
  }

  // Risk Score
  if (lower.match(/(risk|how risky|risk score|how safe)/)) {
    const analysis = getRiskAnalysis(context);
    return {
      type: 'risk',
      content: `Your portfolio risk score is **${analysis.score}/100** — **${analysis.level} Risk**.`,
      analysis
    };
  }

  // Portfolio Summary
  if (lower.match(/(portfolio|what do i own|summary|how am i doing)/)) {
    const holdings = context.holdings || [];
    if (!holdings.length) {
      return { type: 'text', content: 'You don\'t have any holdings yet. Go to **Stocks** and place your first trade!' };
    }
    const totalVal = holdings.reduce((sum, h) => sum + h.currentVal, 0);
    const totalInv = holdings.reduce((sum, h) => sum + h.invested, 0);
    const pnl = totalVal - totalInv;
    const upStocks = holdings.filter(h => h.pnl > 0).length;
    const downStocks = holdings.filter(h => h.pnl < 0).length;

    return {
      type: 'summary',
      content: `**Portfolio Summary**\n\nYou have **${holdings.length}** holdings worth ${formatCurrency(totalVal)}.\n` +
        `Total invested: ${formatCurrency(totalInv)}\n` +
        `P&L: **${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}** (${pnl >= 0 ? '+' : ''}${((pnl / totalInv) * 100).toFixed(2)}%)\n\n` +
        `**${upStocks}** stocks are up, **${downStocks}** are down.`,
      totalVal,
      totalInv,
      pnl,
      upStocks,
      downStocks,
    };
  }

  // Daily Tip
  if (lower.match(/(tip|daily|advice|what should i do)/)) {
    const tip = getDailyTip(context);
    return { type: 'tip', content: tip };
  }

  // 50/30/20
  if (lower.match(/(50.30.20|50 30 20|fifty|rule|budget)/)) {
    const profile = context.profile;
    if (!profile) {
      return { type: 'text', content: 'Please complete your financial profile first to see your 50/30/20 breakdown.' };
    }
    const income = Number(profile.monthly_income || 0);
    const expenses = Number(profile.monthly_expenses || 0);
    const needs = expenses;
    const wants = income * 0.3;
    const invest = income * 0.2;
    return {
      type: 'fiftyThirtyTwenty',
      content: 'Here is your 50/30/20 Breakdown:',
      income,
      needs,
      wants,
      invest,
    };
  }

  // Watchlist Signals
  if (lower.match(/(watchlist|watch)/)) {
    const watchlist = context.watchlist || [];
    if (!watchlist.length) {
      return { type: 'text', content: 'Your watchlist is empty. Go to **Stocks** and add stocks to your watchlist.' };
    }

    const detailed = watchlist.map(w => {
      const s = context.stocks?.find(st => st.symbol === w.symbol);
      return { ...w, signal: s?.signal, reasoning: s?.signal_reasoning };
    });

    return {
      type: 'watchlist',
      content: `**Watchlist Signals**\n\n`,
      stocks: detailed
    };
  }

  // Health Score
  if (lower.match(/(health|score|how healthy)/)) {
    const score = calculateHealthScore(context.holdings || [], context.profile);
    return { type: 'health', content: `Your portfolio health score is **${score}/100**.` };
  }

  // Fallback
  return {
    type: 'text',
    content: `I'm not sure I understand. Try asking:\n\n` +
      `- "What should I buy?"\n` +
      `- "How risky is my portfolio?"\n` +
      `- "What if I buy 10 shares of Reliance?"\n` +
      `- "Give me a tip"\n` +
      `- "Explain my portfolio"`
  };
}
