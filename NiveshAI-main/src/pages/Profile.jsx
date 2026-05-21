import { db } from '@/lib/dbClient';

import React, { useState, useEffect } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency } from '@/lib/stockData';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Save, IndianRupee, Target, ShieldCheck, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_FORM = {
  monthly_income: '',
  monthly_expenses: '',
  total_savings: '',
  investment_goal: 'medium_term',
  risk_appetite: 'moderate',
  investment_experience: 'beginner',
  age: '',
};

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['financial-profile', user?.email],
    queryFn: () => db.entities.FinancialProfile.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const profile = profiles?.[0];
  const [form, setForm] = useState(null);
  const [isNewProfile, setIsNewProfile] = useState(false);

  // Initialize form from existing profile or with defaults
  useEffect(() => {
    if (profile && !form) {
      setForm({
        monthly_income: String(profile.monthly_income ?? ''),
        monthly_expenses: String(profile.monthly_expenses ?? ''),
        total_savings: String(profile.total_savings ?? ''),
        investment_goal: profile.investment_goal || 'medium_term',
        risk_appetite: profile.risk_appetite || 'moderate',
        investment_experience: profile.investment_experience || 'beginner',
        age: String(profile.age ?? ''),
      });
      setIsNewProfile(false);
    } else if (!isLoading && !profile && !form) {
      // No profile exists — start with defaults so user can create one
      setForm({ ...DEFAULT_FORM });
      setIsNewProfile(true);
    }
  }, [profile, isLoading, form]);

  const investable = Math.max(0, (Number(form?.monthly_income) - Number(form?.monthly_expenses)) * 0.5);
  const surplus = Math.max(0, (Number(form?.monthly_income) - Number(form?.monthly_expenses)));
  const savingsAlloc = Number(form?.total_savings || 0) * (form?.risk_appetite === 'conservative' ? 0.1 : form?.risk_appetite === 'moderate' ? 0.2 : 0.3);
  const totalCapacity = investable + savingsAlloc;

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        monthly_income: Number(data.monthly_income),
        monthly_expenses: Number(data.monthly_expenses),
        total_savings: Number(data.total_savings),
        age: Number(data.age),
        investable_amount: investable + savingsAlloc,
        created_by: user?.email || 'anonymous',
        onboarding_complete: true,
      };
      if (isNewProfile) {
        return db.entities.FinancialProfile.create(payload);
      } else {
        return db.entities.FinancialProfile.update(profile.id, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-profile', user?.email] });
      setIsNewProfile(false);
      toast.success('Profile saved successfully!');
    },
    onError: (err) => {
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    },
  });

  const handleSave = () => {
    if (!form.monthly_income || !form.age) {
      toast.error('Please fill in all required fields');
      return;
    }
    saveMutation.mutate(form);
  };

  if (isLoading && !form) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
        Loading your profile...
      </div>
    );
  }

  if (!form) return null;

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-dm font-bold flex items-center gap-2">
          <User className="w-7 h-7 text-primary" /> Financial Profile
        </h1>
        <p className="text-muted-foreground mt-1">
          {isNewProfile
            ? 'Set up your financial profile to get personalized recommendations'
            : 'Update your profile to get better recommendations'}
        </p>
      </div>

      {/* Investable Limit Summary Card */}
      {surplus > 0 && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Your Investable Capacity</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/50 dark:bg-white/5 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground">Monthly Surplus</p>
                <p className="text-lg font-bold text-foreground font-dm">{formatCurrency(surplus)}</p>
              </div>
              <div className="bg-white/50 dark:bg-white/5 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground">20% Investable</p>
                <p className="text-lg font-bold text-primary font-dm">{formatCurrency(investable)}</p>
              </div>
              <div className="bg-white/50 dark:bg-white/5 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground">Total Capacity</p>
                <p className="text-lg font-bold text-emerald-600 font-dm">{formatCurrency(totalCapacity)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Income & Expenses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-dm flex items-center gap-2">
            <IndianRupee className="w-4 h-4" /> Income & Expenses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="monthly_income">Monthly Income (₹) <span className="text-destructive">*</span></Label>
              <Input
                id="monthly_income"
                type="number"
                min="0"
                placeholder="e.g. 80000"
                value={form.monthly_income}
                onChange={(e) => updateForm('monthly_income', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="monthly_expenses">Monthly Expenses (₹)</Label>
              <Input
                id="monthly_expenses"
                type="number"
                min="0"
                placeholder="e.g. 45000"
                value={form.monthly_expenses}
                onChange={(e) => updateForm('monthly_expenses', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="total_savings">Total Savings (₹)</Label>
              <Input
                id="total_savings"
                type="number"
                min="0"
                placeholder="e.g. 500000"
                value={form.total_savings}
                onChange={(e) => updateForm('total_savings', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="age">Age <span className="text-destructive">*</span></Label>
              <Input
                id="age"
                type="number"
                min="1"
                max="120"
                placeholder="e.g. 28"
                value={form.age}
                onChange={(e) => updateForm('age', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Live 50/30/20 Progress Bar */}
          {surplus > 0 && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border mt-2">
              <p className="text-xs text-muted-foreground mb-2">50/30/20 Budget Rule Applied:</p>
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex text-[8px] font-medium">
                <div
                  className="h-full bg-blue-400 flex items-center justify-center text-white"
                  style={{ width: `${Math.min(100, ((Number(form.monthly_expenses) || 0) / (Number(form.monthly_income) || 1)) * 100)}%` }}
                >
                  {Number(form.monthly_expenses) > 0 ? 'Needs' : ''}
                </div>
                <div
                  className="h-full bg-emerald-400 flex items-center justify-center text-white"
                  style={{ width: `${(surplus * 0.3 / (Number(form.monthly_income) || 1)) * 100}%` }}
                >
                  Wants
                </div>
                <div
                  className="h-full bg-violet-500 flex items-center justify-center text-white"
                  style={{ width: `${(surplus * 0.2 / (Number(form.monthly_income) || 1)) * 100}%` }}
                >
                  Invest
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>Needs: {formatCurrency(Number(form.monthly_expenses) || 0)}</span>
                <span>Invest: {formatCurrency(investable)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Investment Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-dm flex items-center gap-2">
            <Target className="w-4 h-4" /> Investment Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="goal">Investment Goal</Label>
              <Select value={form.investment_goal} onValueChange={(v) => updateForm('investment_goal', v)}>
                <SelectTrigger id="goal" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short_term">Short Term (1-3 yrs)</SelectItem>
                  <SelectItem value="medium_term">Medium Term (3-7 yrs)</SelectItem>
                  <SelectItem value="long_term">Long Term (7+ yrs)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="risk">Risk Appetite</Label>
              <Select value={form.risk_appetite} onValueChange={(v) => updateForm('risk_appetite', v)}>
                <SelectTrigger id="risk" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">🛡️ Conservative</SelectItem>
                  <SelectItem value="moderate">⚖️ Moderate</SelectItem>
                  <SelectItem value="aggressive">🚀 Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="experience">Experience Level</Label>
              <Select value={form.investment_experience} onValueChange={(v) => updateForm('investment_experience', v)}>
                <SelectTrigger id="experience" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="experienced">Experienced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full sm:w-auto">
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : isNewProfile ? 'Create Profile' : 'Save Changes'}
        </Button>
        {saveMutation.isPending && (
          <p className="text-xs text-muted-foreground self-center ml-2">Please wait...</p>
        )}
      </div>
    </div>
  );
}