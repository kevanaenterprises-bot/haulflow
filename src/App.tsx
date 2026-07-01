import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './screens/LoginPage';
import OnboardingPage from './screens/OnboardingPage';
import SetupWizardPage from './screens/SetupWizardPage';
import DemoRequestPage from './screens/DemoRequestPage';
import SubscribePage from './screens/SubscribePage';
import ResumePage from './screens/ResumePage';
import ResumePage from './screens/ResumePage';
import LoadsView from './screens/LoadsView';
import DriversView from './screens/DriversView';
import CustomersView from './screens/CustomersView';
import InvoicesView from './screens/InvoicesView';
import PaidInvoicesView from './screens/PaidInvoicesView';
import ShippersView from './screens/ShippersView';
import EmployeesView from './screens/EmployeesView';
import SettingsView from './screens/SettingsView';
import FleetMapView from './screens/FleetMapView';
import IFTAReportView from './screens/IFTAReportView';
import TrucksView from './screens/TrucksView';
import InspectionsView from './screens/InspectionsView';
import DriverLoginPage from './screens/driver/DriverLoginPage';
import DriverDashboard from './screens/driver/DriverDashboard';
import PrivacyPolicyPage from './screens/PrivacyPolicyPage';
import AdminDashboard from './screens/AdminDashboard';
import WhatIsHaulFlowPage from './screens/WhatIsHaulFlowPage';
import ComparePage from './screens/ComparePage';
import ForgotPasswordPage from './screens/ForgotPasswordPage';
import ResetPasswordPage from './screens/ResetPasswordPage';
import SupportPage from './screens/SupportPage';

type Tab = 'loads' | 'drivers' | 'customers' | 'invoices' | 'paid' | 'shippers' | 'employees' | 'fleet' | 'ifta' | 'trucks' | 'inspections' | 'settings';

function DriverPortal() {
      // Check for impersonation token in URL params first
      const urlParams = new URLSearchParams(window.location.search);
      const impToken = urlParams.get('token');
      const impDriver = urlParams.get('driver');

      const stored = localStorage.getItem('hf_driver');
      const [driver, setDriver] = useState(() => {
        if (impToken && impDriver) {
          try {
            const d = JSON.parse(decodeURIComponent(impDriver));
            localStorage.setItem('hf_driver_token', impToken);
            localStorage.setItem('hf_driver', JSON.stringify(d));
            // Clean URL params
            window.history.replaceState({}, '', '/driver');
            return d;
          } catch { /* fall through to stored/null */ }
        }
        return stored ? JSON.parse(stored) : null;
      });

  if (!driver) {
          return <DriverLoginPage onLogin={(_token, d) => setDriver(d)} />;
  }
      return (
              <DriverDashboard
                        driver={driver}
                        onLogout={() => {
                                    localStorage.removeItem('hf_driver_token');
                                    localStorage.removeItem('hf_driver');
                                    setDriver(null);
                        }}
                      />
            );
}

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
                  {tab === 'loads' && <LoadsView onNavigate={(t) => setTab(t as Tab)} />}
                  {tab === 'drivers' && <DriversView />}
                  {tab === 'customers' && <CustomersView />}
                  {tab === 'invoices' && <InvoicesView />}
                  {tab === 'paid' && <PaidInvoicesView />}
                  {tab === 'shippers' && <ShippersView />}
                  {tab === 'employees' && <EmployeesView />}
                  {tab === 'trucks' && <TrucksView />}
                  {tab === 'fleet' && <FleetMapView />}
                  {tab === 'ifta' && <IFTAReportView />}
                  {tab === 'inspections' && <InspectionsView />}
                  {tab === 'settings' && <SettingsView />}
              </AppLayout>
            );
}

export default function App() {
      const path = window.location.pathname;
    
      if (path === '/resume' || path === '/resume/') {
    return <ResumePage />;
  }

  if (path === '/privacy') {
              return <PrivacyPolicyPage />;
      }
    
      if (path === '/demo' || path === '/demo/') {
              return <DemoRequestPage />;
      }
    
      if (path === '/subscribe' || path === '/subscribe/') {
              return <SubscribePage />;
      }

      if (path === '/what-is-haulflow' || path === '/what-is-haulflow/') {
              return <WhatIsHaulFlowPage />;
      }

      if (path === '/compare' || path === '/compare/') {
              return <ComparePage />;
      }

      if (path === '/forgot-password' || path === '/forgot-password/') {
              return <ForgotPasswordPage />;
      }

      if (path === '/reset-password' || path === '/reset-password/') {
              return <ResetPasswordPage />;
      }

        if (path === '/support' || path === '/support/') {
                  return <SupportPage />;
        }

      if (path === '/admin' || path === '/admin/') {
              return <AdminDashboard />;
      }
    
      if (path === '/setup' || path === '/setup/') {
              return <SetupWizardPage />;
      }
    
      if (path.startsWith('/driver')) {
              return <DriverPortal />;
      }
    
      return (
              <AuthProvider>
                    <Inner />
              </AuthProvider>
            );
}
