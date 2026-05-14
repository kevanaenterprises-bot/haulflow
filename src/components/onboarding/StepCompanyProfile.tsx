import { Building2, Shield, MapPin, Hash } from 'lucide-react';
import type { CompanyProfileData } from './OnboardingWizard';

interface Props {
  data: CompanyProfileData;
  onChange: (data: CompanyProfileData) => void;
}

export default function StepCompanyProfile({ data, onChange }: Props) {
  const set = (field: keyof CompanyProfileData, value: string) =>
    onChange({ ...data, [field]: value });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Company Profile</h2>
        <p className="text-sm text-slate-400">
          Enter your carrier details. This information will appear on invoices and compliance reports.
        </p>
      </div>

      <div className="space-y-4">
        {/* Legal Name */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
            <Building2 className="w-4 h-4 text-brand-400" />
            Legal Company Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={data.legalName}
            onChange={e => set('legalName', e.target.value)}
            placeholder="ABC Trucking LLC"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
          />
        </div>

        {/* DOT + MC Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
              <Hash className="w-4 h-4 text-brand-400" />
              DOT Number <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={data.dotNumber}
              onChange={e => set('dotNumber', e.target.value)}
              placeholder="1234567"
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
              <Hash className="w-4 h-4 text-brand-400" />
              MC Number
            </label>
            <input
              type="text"
              value={data.mcNumber}
              onChange={e => set('mcNumber', e.target.value)}
              placeholder="MC-123456"
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Primary Hub Address */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
            <MapPin className="w-4 h-4 text-brand-400" />
            Primary Hub Address
          </label>
          <input
            type="text"
            value={data.primaryHubAddress}
            onChange={e => set('primaryHubAddress', e.target.value)}
            placeholder="123 Main St, Dallas, TX 75201"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
          />
        </div>

        {/* Tax ID */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
            <Shield className="w-4 h-4 text-brand-400" />
            Tax ID (EIN)
          </label>
          <input
            type="text"
            value={data.taxId}
            onChange={e => set('taxId', e.target.value)}
            placeholder="XX-XXXXXXX"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
          />
          <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
            <Shield className="w-3 h-3" /> Your Tax ID is encrypted and stored securely.
          </p>
        </div>
      </div>
    </div>
  );
}
