import InteractiveAvatar from '../components/avatar/InteractiveAvatar';
import React, { useState } from 'react';
import { Truck, CheckCircle, MapPin, FileText, CreditCard, MessageSquare, Gauge, Users, ChevronDown, ArrowRight, Volume2, BookOpen, Heart } from 'lucide-react';

const FEATURES = [
  { icon: FileText,      label: 'Load Management',   desc: 'Create, assign, and close loads end-to-end. Every status, every note, one screen.' },
  { icon: MapPin,        label: 'Live GPS Tracking',  desc: 'See every truck on an interactive map in real time. No extra hardware.' },
  { icon: CreditCard,    label: 'Invoicing & Pay',    desc: 'Auto-generate invoices on delivery. Track aging. Get paid faster.' },
  { icon: MessageSquare, label: 'SMS Dispatch',       desc: 'Push loads to drivers by text. No app download. No training needed.' },
  { icon: Users,         label: 'Driver Portal',      desc: 'Drivers upload BOLs and update load status themselves — less phone tag for you.' },
  { icon: Gauge,         label: 'IFTA Reporting',     desc: 'Mileage by state tracked automatically. Quarter-end prep in minutes.' },
];

interface FormState {
  name: string; email: string; company: string;
  phone: string; fleetSize: string; notes: string;
}

export default function DemoRequestPage() {
  const [form, setForm] = useState<FormState>({ name: '', email: '', company: '', phone: '', fleetSize: '', notes: '' });
  const [sending, setSending] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await fetch('/api/demo-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    } catch { /* non-blocking */ }
    window.location.href = '/demo/app';
  };