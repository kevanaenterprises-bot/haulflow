import { useEffect, useState } from 'react';
import { Plus, User, Mail, Shield, Edit2, Trash2, KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import type { Employee } from '../types';
import { cn } from '../lib/utils';

export default function EmployeesView() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);

  const fetch = async () => {
    const e = await api.get('/api/employees').catch(() => []);
    setEmployees(e);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this employee?')) return;
    await api.delete(`/api/employees/${id}`).catch(e => alert(e.message));
    fetch();
  };

  const handleToggleActive = async (emp: Employee) => {
    await api.patch(`/api/employees/${emp.id}`, { is_active: !emp.is_active }).catch(e => alert(e.message));
    fetch();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Employees</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No employees yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map(emp => (
            <div key={emp.id} className={cn('bg-white rounded-xl border p-4 shadow-sm', emp.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60')}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 p-2 rounded-full"><User className="w-5 h-5 text-gray-500" /></div>
                  <div>
                    <div className="font-semibold text-gray-900">{emp.name}</div>
                    {emp.job_title && <div className="text-xs text-gray-500">{emp.job_title}</div>}
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      emp.role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600')}>
                      {emp.role}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setResetTarget(emp)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Reset password"><KeyRound className="w-4 h-4 text-gray-400" /></button>
                  <button onClick={() => { setEditing(emp); setShowForm(true); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4 text-gray-400" /></button>
                  <button onClick={() => handleDelete(emp.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500"><Mail className="w-3.5 h-3.5" />{emp.email}</div>
              <div className="flex items-center justify-between mt-3">
                <span className={cn('text-xs font-medium', emp.is_active ? 'text-green-600' : 'text-gray-400')}>
                  {emp.is_active ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => handleToggleActive(emp)}
                  className="text-xs text-gray-400 hover:text-gray-600 underline">
                  {emp.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <EmployeeForm employee={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetch(); }} />}
      {resetTarget && <PasswordResetModal employee={resetTarget} onClose={() => setResetTarget(null)} onSaved={() => { setResetTarget(null); }} />}
    </div>
  );
}

function EmployeeForm({ employee, onClose, onSaved }: { employee: Employee | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: employee?.name || '',
    email: employee?.email || '',
    password: '',
    role: employee?.role || 'admin',
    job_title: employee?.job_title || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee && !form.password) { setError('Password is required for new employees'); return; }
    setLoading(true);
    try {
      const payload: any = { name: form.name, email: form.email, role: form.role, job_title: form.job_title };
      if (form.password) payload.password = form.password;
      if (employee) await api.patch(`/api/employees/${employee.id}`, payload);
      else await api.post('/api/employees', payload);
      onSaved();
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">{employee ? 'Edit Employee' : 'Add Employee'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[['name','Full Name *'],['email','Email *'],['job_title','Job Title']].map(([f, l]) => (
            <div key={f}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
              <input type={f === 'email' ? 'email' : 'text'} value={(form as any)[f]} onChange={e => set(f, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="admin">Admin</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="accountant">Accountant</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{employee ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
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

function PasswordResetModal({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await api.patch(`/api/employees/${employee.id}`, { password });
      onSaved();
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-brand-500" />
          <h2 className="text-lg font-bold">Reset Password</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">Setting new password for <strong>{employee.name}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-brand-500 text-white py-2 rounded-lg text-sm disabled:opacity-50">{loading ? 'Saving...' : 'Set Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
