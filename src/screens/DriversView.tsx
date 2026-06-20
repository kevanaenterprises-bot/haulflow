import React, { useEffect, useState } from 'react';
import { Plus, User, Phone, Mail, Edit2, Trash2, Upload, FileText, ShieldCheck, CheckCircle, AlertCircle, X, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import type { Driver } from '../types';
import { cn } from '../lib/utils';

// Strip time component from ISO date strings for display and form inputs
const toDateStr = (val?: string) => val ? val.split('T')[0] : '';

export default function DriversView() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [dqDriver, setDqDriver] = useState<Driver | null>(null);

  const fetch = async () => {
    const d = await api.get('/api/drivers').catch(() => []);
    setDrivers(d);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this driver?')) return;
    await api.delete(`/api/drivers/${id}`).catch(e => alert(e.message));
    fetch();
  };

  const statusColor: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    on_route: 'bg-blue-100 text-blue-700',
    off_duty: 'bg-gray-100 text-gray-500',
  };

  const isExpiringSoon = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff < 60;
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Drivers</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Add Driver
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {drivers.map(d => (
          <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-full"><User className="w-5 h-5 text-gray-500" /></div>
                <div>
                  <div className="font-semibold text-gray-900">{d.name}</div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor[d.status] || statusColor.off_duty)}>
                    {d.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(d); setShowForm(true); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4 text-gray-400" /></button>
                <button onClick={() => handleDelete(d.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
              </div>
            </div>
            {d.phone && <div className="flex items-center gap-2 text-sm text-gray-500"><Phone className="w-3.5 h-3.5" />{d.phone}</div>}
            {d.email && <div className="flex items-center gap-2 text-sm text-gray-500 mt-1"><Mail className="w-3.5 h-3.5" />{d.email}</div>}
            <div className="mt-2 space-y-1">
              {d.license_expiry && (
                <div className={cn('text-xs', isExpiringSoon(d.license_expiry) ? 'text-red-600 font-semibold' : 'text-gray-400')}>
                  CDL expires: {toDateStr(d.license_expiry)}{isExpiringSoon(d.license_expiry) ? ' ⚠️' : ''}
                </div>
              )}
              {d.medical_card_expiry && (
                <div className={cn('text-xs', isExpiringSoon(d.medical_card_expiry) ? 'text-red-600 font-semibold' : 'text-gray-400')}>
                  Medical expires: {toDateStr(d.medical_card_expiry)}{isExpiringSoon(d.medical_card_expiry) ? ' ⚠️' : ''}
                </div>
              )}
              {d.hire_date && <div className="text-xs text-gray-400">Hired: {toDateStr(d.hire_date)}</div>}
              {d.termination_date && <div className="text-xs text-red-400">Terminated: {toDateStr(d.termination_date)}</div>}
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button
                onClick={async () => {
                  try {
                    const data = await api.post(`/api/drivers/${d.id}/impersonate`, {});
                    const driverUrl = `${window.location.origin}/driver?token=${data.token}&driver=${encodeURIComponent(JSON.stringify(data.driver))}`;
                    window.open(driverUrl, '_blank');
                  } catch (e: any) { alert(e.message); }
                }}
                className="flex items-center gap-1 text-xs text-cyan-600 hover:underline font-medium"
              >
                <ExternalLink className="w-3 h-3" /> View as Driver
              </button>
              {d.cdl_file_url && (
                <a href={d.cdl_file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                  <FileText className="w-3 h-3" /> CDL
                </a>
              )}
              {d.medical_card_file_url && (
                <a href={d.medical_card_file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                  <FileText className="w-3 h-3" /> Medical Card
                </a>
              )}
              <button onClick={() => setDqDriver(d)}
                className="flex items-center gap-1 text-xs text-purple-600 hover:underline font-medium">
                <ShieldCheck className="w-3 h-3" /> DQ File
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && <DriverForm driver={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetch(); }} />}
      {dqDriver && <DQFileModal driver={dqDriver} onClose={() => setDqDriver(null)} />}
    </div>
  );
}

// ── DQ File Modal ─────────────────────────────────────────────────────────────
interface DQApp {
  id: string;
  full_name: string;
  dob: string;
  submitted_at: string;
  certified_accurate: boolean;
  cdl_number: string;
  cdl_class: string;
  cdl_expiry: string;
  endorsements: string;
  cdl_ever_denied: boolean;
  cdl_ever_suspended: boolean;
  employment_history: any[];
  accident_history: any[];
  violation_history: any[];
  drug_alcohol_violation: boolean;
  dot_drug_test_consent: boolean;
  mvr_url: string;
  mvr_date: string;
  psp_url: string;
  road_test_url: string;
  pre_employment_drug_url: string;
  previous_employer_verification_url: string;
}

function DQFileModal({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const [dq, setDq] = useState<DQApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'application' | 'documents'>('application');
  const [docs, setDocs] = useState({ mvr_url: '', mvr_date: '', psp_url: '', road_test_url: '', pre_employment_drug_url: '', previous_employer_verification_url: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/api/drivers/${driver.id}/dq`)
      .then(data => {
        setDq(data);
        if (data) setDocs({ mvr_url: data.mvr_url || '', mvr_date: data.mvr_date || '', psp_url: data.psp_url || '', road_test_url: data.road_test_url || '', pre_employment_drug_url: data.pre_employment_drug_url || '', previous_employer_verification_url: data.previous_employer_verification_url || '' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [driver.id]);

  const handleSaveDocs = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/drivers/${driver.id}/dq/docs`, docs);
      alert('Documents saved.');
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  const DocRow = ({ label, urlKey, dateKey }: { label: string; urlKey: keyof typeof docs; dateKey?: keyof typeof docs }) => (
    <div className="border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {docs[urlKey] ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-gray-300" />}
          <span className="font-medium text-sm text-gray-800">{label}</span>
        </div>
        {docs[urlKey] && <a href={docs[urlKey]} target="_blank" rel="noreferrer" className="text-xs text-brand-500 flex items-center gap-1 hover:underline"><ExternalLink className="w-3 h-3" /> View</a>}
      </div>
      <input value={docs[urlKey]} onChange={e => setDocs(p => ({ ...p, [urlKey]: e.target.value }))}
        placeholder="Paste document URL..." className="w-full border rounded-lg px-3 py-1.5 text-xs text-gray-700 mb-1" />
      {dateKey && <input type="date" value={docs[dateKey]} onChange={e => setDocs(p => ({ ...p, [dateKey]: e.target.value }))}
        className="w-full border rounded-lg px-3 py-1.5 text-xs text-gray-700" />}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{driver.name} — DQ File</h2>
            <p className="text-xs text-gray-400">Driver Qualification File (FMCSA Part 391)</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {(['application', 'documents'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition capitalize ${tab === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {t === 'application' ? '📋 Digital Application' : '📁 Documents'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-400 py-12">Loading...</div>
          ) : tab === 'application' ? (
            !dq || !dq.submitted_at ? (
              <div className="text-center py-12">
                <ShieldCheck className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-700 mb-1">No application on file</h3>
                <p className="text-sm text-gray-400 max-w-sm mx-auto">
                  The driver hasn't submitted their digital application yet. Share the HaulFlow Driver app with them — they'll find the application under their profile.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">Application submitted & certified</p>
                    <p className="text-xs text-green-600">{new Date(dq.submitted_at).toLocaleString()} · IP: {(dq as any).ip_address}</p>
                  </div>
                </div>

                <Section title="Personal Information">
                  <Row label="Full Name" value={dq.full_name} />
                  <Row label="Date of Birth" value={dq.dob} />
                </Section>

                <Section title="CDL Information">
                  <Row label="CDL Number" value={dq.cdl_number} />
                  <Row label="Class" value={dq.cdl_class} />
                  <Row label="Expiry" value={dq.cdl_expiry} />
                  <Row label="Endorsements" value={dq.endorsements} />
                  <Row label="Ever denied/suspended" value={dq.cdl_ever_denied || dq.cdl_ever_suspended ? 'Yes — see explanation' : 'No'} warn={dq.cdl_ever_denied || dq.cdl_ever_suspended} />
                </Section>

                <Section title={`Employment History (${(dq.employment_history || []).length} entries)`}>
                  {(dq.employment_history || []).length === 0 ? <p className="text-sm text-gray-400">None listed</p> :
                    (dq.employment_history || []).map((e: any, i: number) => (
                      <div key={i} className="text-sm text-gray-700 border-l-2 border-gray-200 pl-3 mb-2">
                        <div className="font-medium">{e.employer}</div>
                        <div className="text-gray-500">{e.position} · {e.from} – {e.to}</div>
                        <div className="text-gray-400">{e.reason_for_leaving}</div>
                      </div>
                    ))}
                </Section>

                <Section title={`Accident History (${(dq.accident_history || []).length} entries)`}>
                  {(dq.accident_history || []).length === 0 ? <p className="text-sm text-green-600 font-medium">✓ None reported</p> :
                    (dq.accident_history || []).map((a: any, i: number) => (
                      <div key={i} className="text-sm text-gray-700 border-l-2 border-red-200 pl-3 mb-2">
                        <div>{a.date} · {a.location}</div>
                        <div className="text-gray-500">{a.description}</div>
                      </div>
                    ))}
                </Section>

                <Section title={`Traffic Violations (${(dq.violation_history || []).length} entries)`}>
                  {(dq.violation_history || []).length === 0 ? <p className="text-sm text-green-600 font-medium">✓ None reported</p> :
                    (dq.violation_history || []).map((v: any, i: number) => (
                      <div key={i} className="text-sm text-gray-700 border-l-2 border-yellow-200 pl-3 mb-2">
                        <div>{v.date} · {v.offense}</div>
                        <div className="text-gray-500">{v.location} · Penalty: {v.penalty}</div>
                      </div>
                    ))}
                </Section>

                <Section title="Drug & Alcohol">
                  <Row label="DOT drug/alcohol violation history" value={dq.drug_alcohol_violation ? 'Yes — see explanation' : 'No'} warn={dq.drug_alcohol_violation} />
                  <Row label="Consent to DOT drug test" value={dq.dot_drug_test_consent ? 'Yes — consented' : 'Not yet'} />
                </Section>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-4">Paste document URLs below. These are stored in the driver's permanent DQ file. Upload files to Supabase Storage or any URL and paste the link.</p>
              <DocRow label="Motor Vehicle Record (MVR)" urlKey="mvr_url" dateKey="mvr_date" />
              <DocRow label="CDL Copy" urlKey="psp_url" />
              <DocRow label="Road Test Certificate" urlKey="road_test_url" />
              <DocRow label="Pre-Employment Drug Test" urlKey="pre_employment_drug_url" />
              <DocRow label="Previous Employer Verification" urlKey="previous_employer_verification_url" />
              <button onClick={handleSaveDocs} disabled={saving}
                className="w-full bg-brand-500 text-white py-3 rounded-xl font-semibold hover:bg-brand-600 disabled:opacity-50 mt-2">
                {saving ? 'Saving...' : 'Save Document Links'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: any; warn?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${warn ? 'text-red-600' : 'text-gray-900'}`}>{value || '—'}</span>
    </div>
  );
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

async function uploadFile(file: File, path: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/driver-docs/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'x-upsert': 'true' },
    body: file,
  });
  if (!res.ok) throw new Error('File upload failed');
  return `${SUPABASE_URL}/storage/v1/object/public/driver-docs/${path}`;
}

function DriverForm({ driver, onClose, onSaved }: { driver: Driver | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: driver?.name || '',
    phone: driver?.phone || '',
    email: driver?.email || '',
    license_number: driver?.license_number || '',
    license_expiry: toDateStr(driver?.license_expiry) || '',
    medical_card_expiry: toDateStr(driver?.medical_card_expiry) || '',
    hire_date: toDateStr(driver?.hire_date) || '',
    termination_date: toDateStr(driver?.termination_date) || '',
    cdl_file_url: driver?.cdl_file_url || '',
    medical_card_file_url: driver?.medical_card_file_url || '',
    portal_password: '',
  });
  const [cdlFile, setCdlFile] = useState<File | null>(null);
  const [medFile, setMedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data: any = { ...form };
      if (!data.portal_password) delete data.portal_password;
      if (cdlFile && SUPABASE_URL) {
        data.cdl_file_url = await uploadFile(cdlFile, `${Date.now()}-${cdlFile.name}`);
      }
      if (medFile && SUPABASE_URL) {
        data.medical_card_file_url = await uploadFile(medFile, `${Date.now()}-${medFile.name}`);
      }
      if (driver) await api.patch(`/api/drivers/${driver.id}`, data);
      else await api.post('/api/drivers', data);
      onSaved();
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  const dateFields: [string, string][] = [
    ['license_expiry', 'CDL Expiry'],
    ['medical_card_expiry', 'Medical Card Expiry'],
    ['hire_date', 'Hire Date'],
    ['termination_date', 'Termination Date'],
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">{driver ? 'Edit Driver' : 'Add Driver'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[['name','Name *'],['phone','Phone (used to log into driver portal)'],['email','Email'],['license_number','CDL Number']].map(([f, l]) => (
            <div key={f}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
              <input type="text" value={(form as any)[f]} onChange={e => set(f, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            {dateFields.map(([f, l]) => (
              <div key={f}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                <input type="date" value={(form as any)[f]} onChange={e => set(f, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            ))}
          </div>

          {/* Driver portal password */}
          <div className="border-t pt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Driver Portal Password {driver ? '(leave blank to keep current)' : ''}
            </label>
            <input
              type="password"
              value={form.portal_password}
              onChange={e => set('portal_password', e.target.value)}
              placeholder={driver ? '••••••••' : 'Set a password for driver app login'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1">Driver logs in at haulflow.vercel.app/driver using their phone number + this password.</p>
          </div>

          {/* File uploads */}
          <div className="border-t pt-3 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Document Uploads</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CDL File (PDF/Image)</label>
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 text-sm text-gray-500">
                <Upload className="w-4 h-4" />
                {cdlFile ? cdlFile.name : (form.cdl_file_url ? 'Replace CDL file' : 'Upload CDL file')}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => setCdlFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical Card (PDF/Image)</label>
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 text-sm text-gray-500">
                <Upload className="w-4 h-4" />
                {medFile ? medFile.name : (form.medical_card_file_url ? 'Replace medical card' : 'Upload medical card')}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => setMedFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-brand-500 text-white py-2 rounded-lg text-sm disabled:opacity-50">{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
