import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const TIMEFRAMES = ['1M', '3M', '6M', '1Y', 'ALL'];
const CHARTS = { '1M': 22, '3M': 66, '6M': 132, '1Y': 264, ALL: 9999 };

function sliceData(data, timeframe) {
  const maxDays = CHARTS[timeframe] || 9999;
  return data.length > maxDays ? data.slice(data.length - maxDays) : data;
}

export default function PortfolioChart({ equityData, sectorAllocation, holdingsMap }) {
  const [timeframe, setTimeframe] = useState('1Y');
  const sliced = useMemo(() => sliceData(equityData || [], timeframe), [equityData, timeframe]);
  const chartData = useMemo(() => sliced.map(d => ({ date: d.date?.slice(5) || '', value: d.value })), [sliced]);

  const { stockWarning, sectorWarning } = useMemo(() => {
    let stockWarning = '', sectorWarning = '';
    if (holdingsMap) {
      const total = Object.values(holdingsMap).reduce((s, h) => s + h.currentValue, 0);
      Object.entries(holdingsMap).forEach(([sym, h]) => {
        if (total > 0 && (h.currentValue / total) * 100 > 40) stockWarning = sym;
      });
    }
    if (sectorAllocation) {
      const total = sectorAllocation.reduce((s, d) => s + d.value, 0);
      sectorAllocation.forEach(d => {
        if (total > 0 && (d.value / total) * 100 > 60) sectorWarning = d.name;
      });
    }
    return { stockWarning, sectorWarning };
  }, [holdingsMap, sectorAllocation]);

  if (!equityData || equityData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-dm">Portfolio Value</CardTitle>
          <ToggleGroup type="single" value={timeframe} onValueChange={v => v && setTimeframe(v)} size="sm">
            {TIMEFRAMES.map(t => (
              <ToggleGroupItem key={t} value={t} className="text-xs px-2.5">{t}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="pfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(148, 58%, 28%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(148, 58%, 28%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(140, 12%, 89%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(160, 8%, 46%)" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(160, 8%, 46%)" tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} domain={[dataMin => Math.floor(dataMin * 0.97), dataMax => Math.ceil(dataMax * 1.03)]} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(140, 12%, 89%)', fontSize: 12 }} formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Value']} />
              <Area type="monotone" dataKey="value" stroke="hsl(148, 58%, 28%)" fill="url(#pfGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {(stockWarning || sectorWarning) && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            💡 <strong>Tip:</strong> Don't put all your eggs in one basket.{' '}
            {stockWarning && `${stockWarning} makes up more than 40% of your portfolio. `}
            {sectorWarning && `The ${sectorWarning} sector is over 60% of your portfolio. `}
            Consider diversifying into other areas to reduce risk.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
