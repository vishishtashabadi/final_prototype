import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Calendar, IndianRupee, Info, Sliders } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { formatCurrency } from '@/lib/stockData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export default function PortfolioBacktestModal({ stock, isOpen, onClose }) {
  const [investmentAmount, setInvestmentAmount] = useState(10000);
  const [buyDay, setBuyDay] = useState(0);

  const ohlcv = useMemo(() => stock?.ohlcv_data || [], [stock]);
  const totalDays = ohlcv.length;
  const latestIdx = totalDays - 1;

  // buyDay is the index in ohlcv where the user "buys"
  // It ranges from 0 (buy at the start) to latestIdx-1 (buy one day before the end)
  const startIndex = Math.min(buyDay, Math.max(0, latestIdx - 1));
  const startPrice = ohlcv[startIndex]?.close || 0;
  const endIndex = latestIdx;
  const endPrice = ohlcv[endIndex]?.close || 0;
  const sharesBought = startPrice > 0 ? investmentAmount / startPrice : 0;
  const currentValue = sharesBought * endPrice;
  const pnl = currentValue - investmentAmount;
  const pnlPct = investmentAmount > 0 ? (pnl / investmentAmount) * 100 : 0;

  // Daily P&L data from buy day to today
  const chartData = useMemo(() => {
    const sliced = ohlcv.slice(startIndex);
    return sliced.map((pt, i) => {
      const val = (investmentAmount / startPrice) * pt.close;
      const dayLabel = i === 0 ? 'Buy Day' : `Day ${i}`;
      return {
        day: dayLabel,
        date: pt.date,
        price: pt.close,
        value: val,
        invested: investmentAmount,
        pnl: val - investmentAmount,
        pnlPct: ((val - investmentAmount) / investmentAmount * 100).toFixed(1),
      };
    });
  }, [ohlcv, startIndex, investmentAmount, startPrice]);

  // Ensure buyDay stays valid when stock changes
  useEffect(() => {
    setBuyDay(0);
  }, [stock?.symbol]);

  const totalReturn = totalDays > 0 ? ((ohlcv[latestIdx]?.close - ohlcv[0]?.close) / ohlcv[0]?.close * 100).toFixed(1) : 0;
  const stockIsUp = totalReturn >= 0;

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

              {/* Buy Day Slider */}
              {totalDays > 1 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" /> Pick a Day to Buy
                  </label>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {ohlcv[0]?.date ? new Date(ohlcv[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Start'}
                    </span>
                    <div className="flex-1">
                      <Slider
                        min={0}
                        max={Math.max(0, latestIdx - 1)}
                        step={1}
                        value={[buyDay]}
                        onValueChange={([v]) => setBuyDay(v)}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {ohlcv[latestIdx]?.date ? new Date(ohlcv[latestIdx].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Today'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Buy at: {ohlcv[startIndex]?.date ? new Date(ohlcv[startIndex].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                      {' — '}Price: {formatCurrency(startPrice)}
                    </span>
                    <span className="text-muted-foreground">
                      Days held: <strong>{Math.max(0, latestIdx - startIndex)}</strong>
                    </span>
                  </div>
                  {/* Quick buy buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'First Day', day: 0 },
                      { label: `Day ${Math.floor(totalDays * 0.25)}`, day: Math.floor(totalDays * 0.25) },
                      { label: `Mid`, day: Math.floor(totalDays * 0.5) },
                      { label: `Day ${Math.floor(totalDays * 0.75)}`, day: Math.floor(totalDays * 0.75) },
                      { label: 'Yesterday', day: Math.max(0, latestIdx - 1) },
                    ].map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => setBuyDay(opt.day)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${buyDay === opt.day ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/30'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Invested', value: formatCurrency(investmentAmount), color: 'text-foreground' },
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

              {/* P&L Per Day Bar Chart */}
              {chartData.length > 1 && (
                <div className="bg-popover border border-border rounded-xl p-4">
                  <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-primary" /> Daily Portfolio Value
                  </h4>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}K`} domain={[dataMin => Math.floor(dataMin * 0.97), dataMax => Math.ceil(dataMax * 1.03)]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(val) => formatCurrency(val)}
                        />
                        <Legend />
                        <Bar dataKey="value" name="Portfolio Value" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Price Chart */}
              <div className="bg-popover border border-border rounded-xl p-4">
                <h4 className="text-sm font-semibold mb-4">Stock Price History</h4>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                      <defs>
                        <linearGradient id="colorValue2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}K`} domain={[dataMin => Math.floor(dataMin * 0.97), dataMax => Math.ceil(dataMax * 1.03)]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(val) => formatCurrency(val)}
                        labelFormatter={(label) => `Day ${label}`}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="price" stroke="#10b981" fill="url(#colorValue2)" strokeWidth={2} name="Stock Price" dot={false} />
                      <ReferenceLine y={startPrice} label="Buy Price" stroke="#3b82f6" strokeDasharray="3 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Summary */}
              <div className="flex items-start gap-3 text-xs text-muted-foreground bg-muted/50 p-4 rounded-xl">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground mb-1">What this shows</p>
                  <p>You invested <strong>{formatCurrency(investmentAmount)}</strong> in <strong>{stock?.symbol}</strong> at <strong>{formatCurrency(startPrice)}</strong> per share on <strong>{ohlcv[startIndex]?.date || 'the start date'}</strong>.</p>
                  <p className="mt-1">You would have bought <strong>{sharesBought.toFixed(2)} shares</strong>. Today, those shares are worth <strong>{formatCurrency(currentValue)}</strong> — a <strong className={pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}>{pnl >= 0 ? 'profit' : 'loss'}</strong> of <strong>{formatCurrency(Math.abs(pnl))}</strong> ({pnlPct.toFixed(2)}%).</p>
                  <p className="mt-1">Over this period, {stock?.symbol} moved <strong className={stockIsUp ? 'text-emerald-600' : 'text-red-500'}>{stockIsUp ? '+' : ''}{totalReturn}%</strong> in total. Your result depends on <strong>when</strong> you bought — that is why timing matters!</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}