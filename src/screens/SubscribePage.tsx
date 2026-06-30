import { useState, useEffect } from 'react';
import { Truck, ArrowRight, Sparkles, CreditCard, Lock } from 'lucide-react';
import { api } from '../lib/api';
import InteractiveAvatar from '../components/avatar/InteractiveAvatar';

interface PricingTier {
  id: string;
  label: string;
  amount: number;
  trialDays: number;
  description: string;
  requiresAndroid: boolean;
  slotsRemaining: number | null;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString()}`;
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

export default function SubscribePage() {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeSuccess, setCodeSuccess] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const onAndroid = isAndroid();

  useEffect(() => {
    api.get('/api/pricing'
      <InteractiveAvatar context="subscribe" />
    </div>
