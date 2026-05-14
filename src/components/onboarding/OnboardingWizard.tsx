import { useState } from 'react';
import { Truck, CheckCircle, Building2, FileSpreadsheet, Users, FileText, ArrowRight, ArrowLeft } from 'lucide-react';
import StepCompanyProfile from './StepCompanyProfile';
import StepDataImport from './StepDataImport';
import StepTeamInvites from './StepTeamInvites';
import StepInvoiceConfig from './StepInvoiceConfig';

const STEPS = [
  { id: 1, label: 'Company Profile', icon: Building2 },
  { id: 2, label: 'Data Import', icon: FileSpreadsheet },
  { id: 3, label: 'Team Invites', icon: Users },
  { id: 4, label: 'Invoice Config', icon: FileText },
];

export interface CompanyProfileData {
  legalName: string;
  dotNumber: string;
  mcNumber: string;
  primaryHubAddress: string;
  taxId: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: 'dispatcher' | 'driver';
  email: string;
  phone: string;
}

export interface InvoiceConfigData {
  startingInvoiceNumber: string;
  billingPhone: string;
  billingEmail: string;
  logoFile: File | null;
  logoPreview: string;
}

export default function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completed, setCompleted] = useState(false);

  // Step 1
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData>({
    legalName: '', dotNumber: '', mcNumber: '', primaryHubAddress: '', taxId: '',
  });

  // Step 2 – files tracked locally
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Step 3
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { id: crypto.randomUUID(), name: '', role: 'dispatcher', email: '', phone: '' },
  ]);

  // Step 4
  const [invoiceConfig, setInvoiceConfig] = useState<InvoiceConfigData>({
    startingInvoiceNumber: '1001', billingPhone: '', billingEmail: '', logoFile: null, logoPreview: '',
  });

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!companyProfile.legalName && !!companyProfile.dotNumber;
      case 2:
        return true; // optional
      case 3:
        return true; // optional
      case 4:
        return !!invoiceConfig.startingInvoiceNumber;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(s => s + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(s => s - 1);
  };

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-10 w-full max-w-md text-center">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">You're All Set! 🎉</h2>
          <p className="text-slate-400 mb-6">
            Your HaulFlow account has been configured. You can always update these settings later.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-xl font-semibold transition"
          >
            Go to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 flex items-center gap-3 border-b border-slate-700/50">
        <div className="bg-brand-500 p-2 rounded-lg">
          <Truck className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-lg font-bold text-white">HaulFlow</span>
          <span className="ml-2 text-sm text-slate-400">— Self-Service Setup</span>
        </div>
      </header>

      {/* Stepper */}
      <div className="px-6 py-6 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isDone = step.id < currentStep;
            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isActive
                        ? 'bg-brand-500 text-white ring-4 ring-brand-500/30'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {isDone ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium hidden sm:block ${
                      isActive ? 'text-brand-300' : isDone ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-3 rounded transition-colors duration-200 ${
                      step.id < currentStep ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 px-6 pb-8 max-w-3xl mx-auto w-full">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 sm:p-8">
            {currentStep === 1 && (
              <StepCompanyProfile data={companyProfile} onChange={setCompanyProfile} />
            )}
            {currentStep === 2 && (
              <StepDataImport files={uploadedFiles} onFilesChange={setUploadedFiles} />
            )}
            {currentStep === 3 && (
              <StepTeamInvites members={teamMembers} onChange={setTeamMembers} />
            )}
            {currentStep === 4 && (
              <StepInvoiceConfig data={invoiceConfig} onChange={setInvoiceConfig} />
            )}
          </div>

          {/* Navigation */}
          <div className="px-6 sm:px-8 py-5 bg-slate-800/50 border-t border-slate-700 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-3">
              {currentStep < 4 && (
                <button
                  onClick={handleNext}
                  className="text-sm text-slate-400 hover:text-slate-200 transition"
                >
                  Skip
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentStep === 4 ? 'Finish Setup' : 'Continue'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
