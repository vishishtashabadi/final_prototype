import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Calendar, IndianRupee, Info } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Legend
} from 'recharts';
import { formatCurrency } from '@/lib/stockData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

function generateProjections(ohlcv, days = 90, volatilityFactor = 1.0) {
  if (!ohlcv || ohlcv.length < 2) return [];
  const lastPrice = ohlcv[ohlcv.length - 1].close;
  const priceChanges = ohlcv.slice(1).map((d, i) => (d.close - ohlcv[i].close) / ohlcv[i].close);
  const avgChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
  const stdDev = Math.sqrt(priceChanges.reduce((sum, p) => sum + Math.pow(p - avgChange, 2), 0) / priceChanges.length);

  const projections = [];
  let price = lastPrice;
  const lastDate = new Date(ohlcv[ohlcv.length - 1].date);

  for (let i = 1; i <= days; i++) {
    const date = new Date(lastDate);
    date.setDate(date.getDate() + i);

    const random = (Math.random() - 0.5) * 2;
    const dailyChange = (avgChange + (stdDev * random * volatilityFactor));
    price = price * (1 + dailyChange);

    projections.push({
      date: date.toISOString().split('T')[0],
      projected: price,
      upper: price * 1.15,
      lower: price * 0.85,
      day: i
    });
  }
  return projections;
}

export default function PortfolioBacktestModal({ stock, isOpen, onClose }) {
  const [investmentAmount, setInvestmentAmount] = useState(10000);
  const [scenario, setScenario] = useState('3M');
  const [customDays, setCustomDays] = useState(90);

  const ohlcv = useMemo(() => stock?.ohlcv_data || [], [stock]);
  const latestIdx = ohlcv.length - 1;

  const getStartIndex = (s) => {
    if (!ohlcv.length) return 0;
    switch (s) {
      case '1M': return Math.max(0, latestIdx - 30);
      case '3M': return Math.max(0, latestIdx - 90);
      case '6M': return Math.max(0, latestIdx - 180);
      case '1Y': return Math.max(0, latestIdx - 365);
      case 'ALL': return 0;
      case 'CUSTOM': return Math.max(0, latestIdx - customDays);
      default: return Math.max(0, latestIdx - 90);
    }
  };

  const startIndex = useMemo(() => getStartIndex(scenario), [scenario, customDays, ohlcv.length]);
  const startPrice = ohlcv[startIndex]?.close || 0;
  const endPrice = ohlcv[latestIdx]?.close || 0;
  const sharesBought = startPrice > 0 ? investmentAmount / startPrice : 0;
  const currentValue = sharesBought * endPrice;
  const pnl = currentValue - investmentAmount;
  const pnlPct = investmentAmount > 0 ? (pnl / investmentAmount) * 100 : 0;

  const chartData = useMemo(() => {
    const start = startIndex;
    const sliced = ohlcv.slice(start);
    return sliced.map((pt, i) => {
      const projectedValue = (investmentAmount / startPrice) * pt.close;
      return {
        date: pt.date,
        price: pt.close,
        value: projectedValue,
        invested: investmentAmount,
      };
    });
  }, [ohlcv, startIndex, investmentAmount, startPrice]);

  const projections = useMemo(() => {
    return generateProjections(ohlcv, 90, 0.5);
  }, [ohlcv]);

  const projectionChartData = useMemo(() => {
    if (!projections.length || chartData.length === 0) return [];
    const lastRow = chartData[chartData.length - 1];
    return projections.map(p => ({
      ...p,
      actual: null,
      projectedValue: p.projected * (investmentAmount / startPrice),
      upperValue: p.upper * (investmentAmount / startPrice),
      lowerValue: p.lower * (investmentAmount / startPrice),
      date: p.date,
    }));
  }, [projections, investmentAmount, startPrice, chartData]);

  const points = [...chartData.map(d => ({ ...d, type: 'historical' })), ...projectionChartData.map(d => ({ ...d, type: 'projected' }))];

  const scenarios = [
    { key: '1M', label: '1 Month', days: 30 },
    { key: '3M', label: '3 Months', days: 90 },
    { key: '6M', label: '6 Months', days: 180 },
    { key: '1Y', label: '1 Year', days: 365 },
    { key: 'ALL', label: 'All Time', days: ohlcv.length },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Portfolio Backtest</h3>
                  <p className="text-sm text-muted-foreground">{stock?.name} ({stock?.symbol})</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* Scenario Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" /> Select Scenario
                </label>
                <div className="flex flex-wrap gap-2">
                  {scenarios.map((s) => (
                    <Button
                      key={s.key}
                      variant={scenario === s.key ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setScenario(s.key)}
                      className="rounded-full"
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Investment Amount */}
              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-muted-foreground" /> Investment Amount
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      type="number"
                      value={investmentAmount}
                      onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                      className="text-lg font-bold"
                    />
                  </div>
                  <div className="w-48">
                    <Slider
                      value={[investmentAmount]}
                      onValueChange={([v]) => setInvestmentAmount(v)}
                      min={5000}
                      max={1000000}
                      step={5000}
                    />
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Invested', value: formatCurrency(investmentAmount), color: 'text-blue-600' },
                  { label: 'Current Value', value: formatCurrency(currentValue), color: pnl >= 0 ? 'text-emerald-600' : 'text-red-500' },
                  { label: 'P&L', value: `${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}`, color: pnl >= 0 ? 'text-emerald-600' : 'text-red-500' },
                  { label: 'Return', value: `${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`, color: pnl >= 0 ? 'text-emerald-600' : 'text-red-500' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-popover border border-border rounded-xl p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="bg-popover border border-border rounded-xl p-4">
                <h4 className="text-sm font-semibold mb-4">Backtest Chart</h4>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={points} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}K`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(val) => formatCurrency(val)}
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#colorValue)" strokeWidth={2} name="Portfolio Value" dot={false} />
                      <ReferenceLine y={investmentAmount} label="Invested" stroke="#3b82f6" strokeDasharray="3 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Projection Section */}
              <div className="bg-popover border border-border rounded-xl p-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> 90-Day Projection
                </h4>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projectionChartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                      <defs>
                        <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorUpper" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}K`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(val) => formatCurrency(val)}
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="upperValue" stroke="#ef4444" fill="url(#colorUpper)" strokeWidth={1} strokeDasharray="5 5" name="Upper Range" dot={false} />
                      <Area type="monotone" dataKey="projectedValue" stroke="#f59e0b" fill="url(#colorProj)" strokeWidth={2} name="Projected" dot={false} />
                      <ReferenceLine y={investmentAmount} label="Invested" stroke="#3b82f6" strokeDasharray="3 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>Projections use historical volatility and average daily returns. The upper range represents 15% above the projected value, lower range is 15% below. Past performance does not guarantee future results.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
