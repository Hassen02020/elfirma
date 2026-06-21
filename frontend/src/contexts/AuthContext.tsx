import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import API_BASE from '../config/api';

export interface AgentInfo {
  id?: number;
  nom: string;
  prenom?: string;
  poste_id?: number;
  poste_nom: string;
  poste_type: 'JOUR' | 'NUIT' | '';
}

interface AuthContextType {
  isAuthenticated: boolean;
  role: string | null;
  agent: AgentInfo | null;
  login: (pin: string, role: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentInfo | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedRole = localStorage.getItem('role');
    const savedAgent = localStorage.getItem('agent');
    if (token && savedRole) {
      setIsAuthenticated(true);
      setRole(savedRole);
      if (savedAgent) setAgent(JSON.parse(savedAgent));
    }
  }, []);

  const login = async (pin: string, selectedRole: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, role: selectedRole }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        if (data.agent) localStorage.setItem('agent', JSON.stringify(data.agent));
        setIsAuthenticated(true);
        setRole(data.role);
        setAgent(data.agent || null);
      } else {
        throw new Error(data.error || 'Erreur de connexion');
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('agent');
    setIsAuthenticated(false);
    setRole(null);
    setAgent(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, agent, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
