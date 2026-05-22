import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function PortfolioChart({ equityData, sectorAllocation, holdingsMap }) {
  const chartData = useMemo(() => (equityData || []).map(d => ({ date: d.date?.slice(5) || '', value: d.value })), [equityData]);

  const { stockWarning, sectorWarning } = useMemo(() => {
    let sWarn = '', secWarn = '';
    if (holdingsMap) {
      const total = Object.values(holdingsMap).reduce((s, h) => s + h.currentValue, 0);
      Object.entries(holdingsMap).forEach(([sym, h]) => {
        if (total > 0 && (h.currentValue / total) * 100 > 40) sWarn = sym;
      });
    }
    if (sectorAllocation) {
      const total = sectorAllocation.reduce((s, d) => s + d.value, 0);
      sectorAllocation.forEach(d => {
        if (total > 0 && (d.value / total) * 100 > 60) secWarn = d.name;
      });
    }
    return { stockWarning: sWarn, sectorWarning: secWarn };
  }, [holdingsMap, sectorAllocation]);

  if (!equityData || equityData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-dm">Portfolio Value</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs><linearGradient id="pfGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(148, 58%, 28%)" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(148, 58%, 28%)" stopOpacity={0.02} /></linearGradient></defs>
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
            Consider diversifying to reduce risk.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
