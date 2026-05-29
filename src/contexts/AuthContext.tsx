import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, Company } from '../types';
import { api } from '../lib/api';

interface AuthContextType {
  user: User | null;
  company: Company | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('hf_user');
    const storedCompany = localStorage.getItem('hf_company');
    if (stored) { try { setUser(JSON.parse(stored)); } catch {} }
    if (storedCompany) { try { setCompany(JSON.parse(storedCompany)); } catch {} }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('hf_token', data.token);
    localStorage.setItem('hf_user', JSON.stringify(data.user));
    localStorage.setItem('hf_company', JSON.stringify(data.company));
    setUser(data.user);
    setCompany(data.company);
  };

  const logout = () => {
    localStorage.removeItem('hf_token');
    localStorage.removeItem('hf_demo_expires_at');
    localStorage.removeItem('hf_user');
    localStorage.removeItem('hf_company');
    setUser(null);
    setCompany(null);
  };

  return (
    <AuthContext.Provider value={{ user, company, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
