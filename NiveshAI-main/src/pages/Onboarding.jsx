import { db } from '@/lib/dbClient';
import { queryClientInstance } from '@/lib/query-client';

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { 
  TrendingUp, ArrowRight, ArrowLeft, IndianRupee, 
  Target, ShieldCheck, Wallet, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/stockData';

const steps = [
  { title: "Welcome", subtitle: "Let's build your investor profile", icon: TrendingUp },
  { title: "Income & Expenses", subtitle: "Help us understand your finances", icon: Wallet },
  { title: "Savings & Goals", subtitle: "What are you investing for?", icon: Target },
  { title: "Risk Profile", subtitle: "How much risk can you handle?", icon: ShieldCheck },
  { title: "Your Plan", subtitle: "Here's your personalized plan", icon: CheckCircle2 },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    monthly_income: '',
    monthly_expenses: '',
    total_savings: '',
    investment_goal: 'medium_term',
    risk_appetite: 'moderate',
    investment_experience: 'beginner',
    age: '',
  });

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const investable = Math.max(0, (Number(form.monthly_income) - Number(form.monthly_expenses)) * 0.5);
  const savingsAllocation = Number(form.total_savings) * (form.risk_appetite === 'conservative' ? 0.1 : form.risk_appetite === 'moderate' ? 0.2 : 0.3);

  const handleFinish = async () => {
    setSaving(true);
    try {
      const savedProfile = {
        ...form,
        monthly_income: Number(form.monthly_income),
        monthly_expenses: Number(form.monthly_expenses),
        total_savings: Number(form.total_savings),
        age: Number(form.age),
        investable_amount: investable + savingsAllocation,
        onboarding_complete: true,
        created_by: user?.email || 'anonymous',
      };
      await db.entities.FinancialProfile.create(savedProfile);
      queryClientInstance.setQueryData(['financial-profile', user?.email], [savedProfile]);
      navigate('/');
    } catch (err) {
      setSaving(false);
      console.error('Failed to save onboarding profile:', err);
      toast.error('Failed to save profile. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 px-4">
          {steps.map((s, i) => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-primary' : 'bg-border'}`} />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-xl border-0 bg-card">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-2">
                  {React.createElement(steps[step].icon, { className: "w-6 h-6 text-primary" })}
                  <h2 className="text-2xl font-dm font-bold">{steps[step].title}</h2>
                </div>
                <p className="text-muted-foreground mb-8">{steps[step].subtitle}</p>

                {step === 0 && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
                      <h3 className="font-semibold mb-2">Welcome to NIVESH AI</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        We'll ask a few questions about your financial situation, investment goals, and 
                        risk tolerance. This takes about 2 minutes and helps us give you personalized, 
                        AI-driven stock recommendations.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Your Age</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 28"
                          value={form.age}
                          onChange={(e) => updateForm('age', e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Experience Level</Label>
                        <RadioGroup
                          value={form.investment_experience}
                          onValueChange={(v) => updateForm('investment_experience', v)}
                          className="mt-2 grid grid-cols-3 gap-3"
                        >
                          {[
                            { value: 'beginner', label: 'Beginner' },
                            { value: 'intermediate', label: 'Intermediate' },
                            { value: 'experienced', label: 'Experienced' },
                          ].map(opt => (
                            <label key={opt.value} className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.investment_experience === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                              <RadioGroupItem value={opt.value} className="sr-only" />
                              <span className="text-sm font-medium">{opt.label}</span>
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5">
                    <div>
                      <Label className="text-sm font-medium">Monthly Income (₹)</Label>
                      <div className="relative mt-1.5">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="e.g. 80000"
                          value={form.monthly_income}
                          onChange={(e) => updateForm('monthly_income', e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Monthly Expenses (₹)</Label>
                      <div className="relative mt-1.5">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="e.g. 45000"
                          value={form.monthly_expenses}
                          onChange={(e) => updateForm('monthly_expenses', e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    {form.monthly_income && form.monthly_expenses && (
                      <div className="p-4 rounded-xl bg-accent border border-primary/10">
                        <p className="text-sm text-muted-foreground">Monthly Surplus</p>
                        <p className="text-2xl font-bold text-primary font-dm">
                          {formatCurrency(Math.max(0, Number(form.monthly_income) - Number(form.monthly_expenses)))}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div>
                      <Label className="text-sm font-medium">Total Savings (₹)</Label>
                      <div className="relative mt-1.5">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="e.g. 500000"
                          value={form.total_savings}
                          onChange={(e) => updateForm('total_savings', e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Investment Goal</Label>
                      <RadioGroup
                        value={form.investment_goal}
                        onValueChange={(v) => updateForm('investment_goal', v)}
                        className="mt-2 space-y-3"
                      >
                        {[
                          { value: 'short_term', label: 'Short Term', desc: '1-3 years — Emergency fund, vacation, gadget' },
                          { value: 'medium_term', label: 'Medium Term', desc: '3-7 years — Car, home down payment, education' },
                          { value: 'long_term', label: 'Long Term', desc: "7+ years — Retirement, wealth creation, child's future" },
                        ].map(opt => (
                          <label key={opt.value} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${form.investment_goal === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                            <RadioGroupItem value={opt.value} className="mt-0.5" />
                            <div>
                              <p className="font-medium text-sm">{opt.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                            </div>
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <Label className="text-sm font-medium">Risk Appetite</Label>
                    <RadioGroup
                      value={form.risk_appetite}
                      onValueChange={(v) => updateForm('risk_appetite', v)}
                      className="space-y-3"
                    >
                      {[
                        { value: 'conservative', label: '🛡️ Conservative', desc: 'Prefer stable returns, minimal risk. Focus on blue-chip, dividend stocks.', color: 'border-emerald-200 bg-emerald-50/50' },
                        { value: 'moderate', label: '⚖️ Moderate', desc: 'Balance of growth and safety. Mix of large-cap and select mid-caps.', color: 'border-amber-200 bg-amber-50/50' },
                        { value: 'aggressive', label: '🚀 Aggressive', desc: 'High growth potential, comfortable with volatility. Mid/small-caps, sectoral bets.', color: 'border-red-200 bg-red-50/50' },
                      ].map(opt => (
                        <label key={opt.value} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${form.risk_appetite === opt.value ? `${opt.color} border-primary` : 'border-border hover:border-primary/30'}`}>
                          <RadioGroupItem value={opt.value} className="mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">{opt.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-5">
                    {/* 50/30/20 Rule Breakdown Card */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-purple-50 border border-blue-100">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">How We Calculated Your Limit</p>
                          <p className="text-[10px] text-muted-foreground">50/30/20 Budget Rule Applied</p>
                        </div>
                      </div>

                      {/* Income bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Monthly Income</span>
                          <span className="font-semibold">{formatCurrency(Number(form.monthly_income) || 0)}</span>
                        </div>
                        <div className="h-10 w-full bg-muted rounded-xl overflow-hidden flex text-[10px] font-medium">
                          <div
                            className="h-full bg-blue-400 flex items-center justify-center text-white transition-all duration-500"
                            style={{ width: `${Math.min(100, ((Number(form.monthly_expenses) || 0) / (Number(form.monthly_income) || 1)) * 100)}%` }}
                          >
                            50% Needs
                          </div>
                          <div
                            className="h-full bg-emerald-400 flex items-center justify-center text-white transition-all duration-500"
                            style={{ width: `${Math.min(100, ((Math.max(0, (Number(form.monthly_income) || 0) - (Number(form.monthly_expenses) || 0)) * 0.3) / (Number(form.monthly_income) || 1)) * 100)}%` }}
                          >
                            30% Wants
                          </div>
                          <div
                            className="h-full bg-violet-500 flex items-center justify-center text-white transition-all duration-500"
                            style={{ width: `${Math.min(100, ((Math.max(0, (Number(form.monthly_income) || 0) - (Number(form.monthly_expenses) || 0)) * 0.2) / (Number(form.monthly_income) || 1)) * 100)}%` }}
                          >
                            20% Invest
                          </div>
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>Needs (Expenses)</span>
                          <span>Wants (Discretionary)</span>
                          <span>Savings & Investing</span>
                        </div>
                      </div>

                      {/* Detailed breakdown */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/70 border border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400" />
                            <span className="text-muted-foreground">Step 1: Needs (50% of income)</span>
                          </div>
                          <span className="font-medium text-blue-600">{formatCurrency(Number(form.monthly_expenses) || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/70 border border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="text-muted-foreground">Step 2: Wants (30% of surplus)</span>
                          </div>
                          <span className="font-medium text-emerald-600">{formatCurrency(Math.max(0, (Number(form.monthly_income) || 0) - (Number(form.monthly_expenses) || 0)) * 0.3)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/70 border border-primary/20 bg-primary/5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-violet-500" />
                            <span className="font-semibold text-foreground">Step 3: Your Investable Limit (20% of surplus)</span>
                          </div>
                          <span className="font-bold text-lg text-violet-600 font-dm">{formatCurrency(investable)}</span>
                        </div>
                      </div>

                      <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-[10px] text-amber-700">
                          💡 <strong>How it works:</strong> We apply the 50/30/20 rule to your surplus. 
                          50% of your income covers needs (expenses), 30% is for wants, and 20% goes toward 
                          investments. This ensures you never over-invest and always maintain financial safety.
                        </p>
                      </div>
                    </div>

                    {/* Lump sum + Total */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                        <p className="text-[10px] text-muted-foreground">Lump Sum Available</p>
                        <p className="text-lg font-bold text-primary font-dm mt-1">{formatCurrency(savingsAllocation)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{form.risk_appetite === 'conservative' ? '10%' : form.risk_appetite === 'moderate' ? '20%' : '30%'} of savings</p>
                      </div>
                      <div className="p-3 rounded-xl bg-accent">
                        <p className="text-[10px] text-muted-foreground">Total Monthly Capacity</p>
                        <p className="text-lg font-bold text-foreground font-dm mt-1">{formatCurrency(investable + savingsAllocation)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Investable + Lump Sum</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/50 border border-border">
                      <p className="text-[10px] text-muted-foreground mb-2">Your Profile Summary</p>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">Age</span><span className="font-medium">{form.age} years</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Experience</span><span className="font-medium capitalize">{form.investment_experience}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Goal</span><span className="font-medium capitalize">{form.investment_goal?.replace('_', ' ')}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Risk</span><span className="font-medium capitalize">{form.risk_appetite}</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between mt-8">
                  {step > 0 ? (
                    <Button variant="outline" onClick={() => setStep(step - 1)}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                  ) : <div />}
                  
                  {step < 4 ? (
                    <Button onClick={() => setStep(step + 1)} className="bg-primary hover:bg-primary/90">
                      Continue <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button onClick={handleFinish} disabled={saving} className="bg-primary hover:bg-primary/90">
                      {saving ? 'Setting up...' : 'Start Investing'} <CheckCircle2 className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
