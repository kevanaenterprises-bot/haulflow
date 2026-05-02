import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './screens/LoginPage';
import OnboardingPage from './screens/OnboardingPage';
import LoadsView from './screens/LoadsView';
import DriversView from './screens/DriversView';
import CustomersView from './screens/CustomersView';
import InvoicesView from './screens/InvoicesView';

type Tab = 'loads' | 'drivers' | 'customers' | 'invoices';

function Inner() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('loads');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (window.location.pathname === '/onboard') {
    return <OnboardingPage />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AppLayout activeTab={tab} onTabChange={setTab}>
      {tab === 'loads' && <LoadsView />}
      {tab === 'drivers' && <DriversView />}
      {tab === 'customers' && <CustomersView />}
      {tab === 'invoices' && <InvoicesView />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
