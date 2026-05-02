import React, { useState } from 'react';
import { Truck, LayoutDashboard, Users, Building2, FileText, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

type Tab = 'loads' | 'drivers' | 'customers' | 'invoices';

interface AppLayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: React.ReactNode;
}

const nav = [
  { id: 'loads' as Tab, label: 'Loads', icon: LayoutDashboard },
  { id: 'drivers' as Tab, label: 'Drivers', icon: Users },
  { id: 'customers' as Tab, label: 'Customers', icon: Building2 },
  { id: 'invoices' as Tab, label: 'Invoices', icon: FileText },
];

export default function AppLayout({ activeTab, onTabChange, children }: AppLayoutProps) {
  const { user, company, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-56 bg-brand-900 text-white flex flex-col transition-transform lg:translate-x-0 lg:static lg:z-auto',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center gap-2 px-4 py-5 border-b border-brand-700">
          <div className="bg-brand-500 p-1.5 rounded-lg">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">HaulFlow</div>
            <div className="text-xs text-brand-300 truncate max-w-[120px]">{company?.name}</div>
          </div>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { onTabChange(id); setMobileOpen(false); }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
                activeTab === id ? 'bg-brand-500 text-white' : 'text-brand-200 hover:bg-brand-800'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-brand-700">
          <div className="text-xs text-brand-300 px-2 mb-2 truncate">{user?.email}</div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-brand-200 hover:bg-brand-800 transition">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="p-1 rounded-lg hover:bg-gray-100">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-gray-800">{nav.find(n => n.id === activeTab)?.label}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
