import { useState, useRef, useCallback } from 'react';
import { FileText, Phone, Mail, Upload, Image, X } from 'lucide-react';
import type { InvoiceConfigData } from './OnboardingWizard';

interface Props {
  data: InvoiceConfigData;
  onChange: (data: InvoiceConfigData) => void;
}

export default function StepInvoiceConfig({ data, onChange }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof InvoiceConfigData, value: string) =>
    onChange({ ...data, [field]: value });

  const handleLogoDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file);
        onChange({ ...data, logoFile: file, logoPreview: preview });
      }
    },
    [data, onChange]
  );

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const preview = URL.createObjectURL(file);
      onChange({ ...data, logoFile: file, logoPreview: preview });
    }
  };

  const removeLogo = () => {
    if (data.logoPreview) URL.revokeObjectURL(data.logoPreview);
    onChange({ ...data, logoFile: null, logoPreview: '' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Invoice Configuration</h2>
        <p className="text-sm text-slate-400">
          Set up your invoice defaults. These will be used whenever HaulFlow generates an invoice for a delivered load.
        </p>
      </div>

      <div className="space-y-4">
        {/* Starting Invoice Number */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
            <FileText className="w-4 h-4 text-brand-400" />
            Starting Invoice Number <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={data.startingInvoiceNumber}
            onChange={e => set('startingInvoiceNumber', e.target.value)}
            placeholder="1001"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Invoices will be numbered sequentially starting from this number (e.g., INV-1001, INV-1002, ...).
          </p>
        </div>

        {/* Billing Phone + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
              <Phone className="w-4 h-4 text-brand-400" />
              Billing Phone
            </label>
            <input
              type="tel"
              value={data.billingPhone}
              onChange={e => set('billingPhone', e.target.value)}
              placeholder="(555) 000-0000"
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
              <Mail className="w-4 h-4 text-brand-400" />
              Billing Email
            </label>
            <input
              type="email"
              value={data.billingEmail}
              onChange={e => set('billingEmail', e.target.value)}
              placeholder="billing@company.com"
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Logo Upload */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
            <Image className="w-4 h-4 text-brand-400" />
            Company Logo
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Upload your company logo to display on invoices. Recommended: 400×120px, PNG or SVG.
          </p>

          {data.logoPreview ? (
            <div className="relative inline-block bg-slate-700/30 border border-slate-600/50 rounded-xl p-4">
              <img
                src={data.logoPreview}
                alt="Company logo preview"
                className="max-h-24 max-w-[280px] object-contain rounded"
              />
              <button
                type="button"
                onClick={removeLogo}
                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full shadow-lg transition"
              >
                <X className="w-3 h-3" />
              </button>
              <p className="text-xs text-slate-400 mt-2">
                {data.logoFile?.name} ({((data.logoFile?.size || 0) / 1024).toFixed(1)} KB)
              </p>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleLogoDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-brand-400 bg-brand-500/10'
                  : 'border-slate-600 hover:border-slate-500 bg-slate-700/20 hover:bg-slate-700/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                className="hidden"
              />
              <Upload
                className={`w-7 h-7 mx-auto mb-2 ${isDragging ? 'text-brand-400' : 'text-slate-500'}`}
              />
              <p className="text-sm font-medium text-slate-300">
                {isDragging ? 'Drop your logo here...' : 'Drag & drop your logo'}
              </p>
              <p className="text-xs text-slate-500 mt-1">PNG, JPG, or SVG • Max 5 MB</p>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Preview Hint */}
      <div className="bg-slate-700/20 border border-slate-700 rounded-xl p-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
          Invoice Preview
        </h4>
        <div className="bg-white rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              {data.logoPreview ? (
                <img src={data.logoPreview} alt="Logo" className="h-8 object-contain" />
              ) : (
                <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-800">
                INV-{data.startingInvoiceNumber || '1001'}
              </p>
              <p className="text-[10px] text-gray-400">Preview</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-2 flex items-center justify-between text-[10px] text-gray-400">
            <span>{data.billingEmail || 'billing@company.com'}</span>
            <span>{data.billingPhone || '(555) 000-0000'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
