import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Sun, Moon, Clock } from 'lucide-react';

const getPosteActif = (): 'JOUR' | 'NUIT' => {
  const h = new Date().getHours();
  return h >= 6 && h < 18 ? 'JOUR' : 'NUIT';
};

export default function Login() {
  const [pin, setPin] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const posteActif = getPosteActif();
  const now = new Date().toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(pin, role);
      if (role === 'super_admin')  navigate('/admin');
      else if (role === 'comptable')   navigate('/accountant');
      else if (role === 'controleur')  navigate('/controller');
      else navigate('/agent');
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-elfirma-green to-elfirma-darkGreen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-3">
            <img src="/logo.jpg" alt="EL FIRMA" className="h-16 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">EL FIRMA</h1>
          <p className="text-gray-500 text-sm">Gestion des Caisses de Livraison</p>
        </div>

        {/* Bandeau poste actif */}
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl mb-6 ${
          posteActif === 'JOUR'
            ? 'bg-amber-50 border border-amber-200'
            : 'bg-indigo-50 border border-indigo-200'
        }`}>
          <div className="flex items-center gap-2">
            {posteActif === 'JOUR'
              ? <Sun className="w-5 h-5 text-amber-500" />
              : <Moon className="w-5 h-5 text-indigo-500" />}
            <div>
              <p className={`font-bold text-sm ${posteActif === 'JOUR' ? 'text-amber-700' : 'text-indigo-700'}`}>
                {posteActif === 'JOUR' ? 'Poste Jour (06h–18h)' : 'Poste Nuit (18h–06h)'}
              </p>
              <p className="text-xs text-gray-500">Poste actif automatiquement détecté</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <Clock className="w-3 h-3" />
            {now}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rôle</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent"
              required
            >
              <option value="">Sélectionner un rôle</option>
              <option value="agent">Agent (Pesée)</option>
              <option value="controleur">Contrôleur</option>
              <option value="comptable">Comptable</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Code Personnel (PIN)
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent tracking-widest text-lg text-center"
              placeholder="● ● ● ●"
              maxLength={6}
              required
            />
            {role && role !== 'super_admin' && (
              <p className="text-xs text-gray-400 mt-1">
                {role === 'comptable'  ? 'Comptable : 3333' :
                 posteActif === 'JOUR'
                   ? 'Poste Jour — Agent: 1111 / 1122 · Contrôleur: 1133'
                   : 'Poste Nuit — Agent: 2211 / 2222 · Contrôleur: 2233'}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-elfirma-green text-white py-3 rounded-lg font-semibold hover:bg-elfirma-darkGreen transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />Connexion...</>
            ) : (
              <><Shield className="w-5 h-5" />Se connecter</>
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-gray-400">
          Application de gestion des caisses EL FIRMA — v2.0
        </p>
      </div>
    </div>
  );
}
