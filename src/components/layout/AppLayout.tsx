import React, { useState } from 'react';
import { Truck, LayoutDashboard, Users, Building2, FileText, LogOut, Menu, PackageOpen, ShieldCheck, Settings, Map, BarChart2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

type Tab = 'loads' | 'drivers' | 'customers' | 'invoices' | 'shippers' | 'employees' | 'fleet' | 'ifta' | 'settings';

interface AppLayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: React.ReactNode;
}

const nav = [
  { id: 'loads' as Tab, label: 'Loads', icon: LayoutDashboard },
  { id: 'drivers' as Tab, label: 'Drivers', icon: Users },
  { id: 'customers' as Tab, label: 'Customers', icon: Building2 },
  { id: 'shippers' as Tab, label: 'Shippers & Receivers', icon: PackageOpen },
  { id: 'invoices' as Tab, label: 'Invoices', icon: FileText },
  { id: 'fleet' as Tab, label: 'Live Fleet Map', icon: Map },
  { id: 'ifta' as Tab, label: 'IFTA Report', icon: BarChart2 },
  { id: 'employees' as Tab, label: 'Employees', icon: ShieldCheck },
  { id: 'settings' as Tab, label: 'Settings', icon: Settings },
];

export default function AppLayout({ activeTab, onTabChange, children }: AppLayoutProps) {
  const { user, company, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={cn(
          'fixed inset-y-0 left-0 z-50 bg-brand-900 text-white flex flex-col transition-all duration-200 lg:static lg:z-auto',
          // Mobile: slide in/out
          mobileOpen ? 'translate-x-0 w-56' : '-translate-x-full w-56 lg:translate-x-0',
          // Desktop: auto-hide — collapsed to 0 width rail, expands on hover
          'lg:translate-x-0',
          sidebarHovered ? 'lg:w-56' : 'lg:w-0 lg:overflow-hidden'
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

      {/* Desktop hover trigger strip — invisible 8px zone on far left */}
      <div
        className="hidden lg:block fixed inset-y-0 left-0 w-2 z-40"
        onMouseEnter={() => setSidebarHovered(true)}
      />

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
