import { UserPlus, Trash2, Users } from 'lucide-react';
import type { TeamMember } from './OnboardingWizard';

interface Props {
  members: TeamMember[];
  onChange: (members: TeamMember[]) => void;
}

export default function StepTeamInvites({ members, onChange }: Props) {
  const addMember = () => {
    onChange([
      ...members,
      { id: crypto.randomUUID(), name: '', role: 'dispatcher', email: '', phone: '' },
    ]);
  };

  const removeMember = (id: string) => {
    onChange(members.filter(m => m.id !== id));
  };

  const updateMember = (id: string, field: keyof TeamMember, value: string) => {
    onChange(members.map(m => (m.id === id ? { ...m, [field]: value } : m)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Invite Your Team</h2>
        <p className="text-sm text-slate-400">
          Add dispatchers and drivers to your HaulFlow account. They'll receive an email invitation to set up their credentials.
        </p>
      </div>

      <div className="space-y-4">
        {members.map((member, idx) => (
          <div
            key={member.id}
            className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-medium text-slate-300">
                  Team Member {idx + 1}
                </span>
              </div>
              {members.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMember(member.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={member.name}
                  onChange={e => updateMember(member.id, 'name', e.target.value)}
                  placeholder="John Smith"
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                <select
                  value={member.role}
                  onChange={e => updateMember(member.id, 'role', e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition appearance-none"
                >
                  <option value="dispatcher">Dispatcher</option>
                  <option value="driver">Driver</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  value={member.email}
                  onChange={e => updateMember(member.id, 'email', e.target.value)}
                  placeholder="john@company.com"
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={member.phone}
                  onChange={e => updateMember(member.id, 'phone', e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addMember}
        className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-slate-600 rounded-lg text-sm font-medium text-slate-400 hover:text-brand-300 hover:border-brand-500/50 hover:bg-brand-500/5 transition w-full justify-center"
      >
        <UserPlus className="w-4 h-4" />
        Add Another Team Member
      </button>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-brand-500" />
          {members.filter(m => m.role === 'dispatcher').length} Dispatchers
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {members.filter(m => m.role === 'driver').length} Drivers
        </span>
      </div>
    </div>
  );
}
