import { useState, useEffect } from 'react';
import API_BASE from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import TruckManagement from './TruckManagement';
import DriverManagement from './DriverManagement';
import { Package, Truck, TrendingUp, AlertTriangle, Calendar, BarChart3, Download, Search, RefreshCw, CheckCircle, XCircle, ArrowUpCircle, ArrowDownCircle, Filter } from 'lucide-react';

interface StockAudit {
  stock_initial: number;
  stock_reel: number;
  caisses_cassees: number;
  caisses_perimees: number;
  date_audit: string;
  ecart: number;
}

interface PenaltyConfig {
  cout_par_caisse_defaut: number;
  remarque_visible_par: 'controller' | 'comptable' | 'all' | 'admin_only';
}

interface Penalty {
  id: number;
  chauffeur_id: number;
  chauffeur_nom: string;
  caisses_non_retournees: number;
  cout_par_caisse: number;
  penalite_totale: number;
  remarque: string;
  date: string;
  statut: 'en_attente' | 'validee' | 'rejetee';
  cree_par: 'comptable' | 'admin';
}

interface Reward {
  id: number;
  chauffeur_id: number;
  chauffeur_nom: string;
  montant: number;
  motif: string;
  date: string;
  statut: 'en_attente' | 'validee' | 'rejetee';
  cree_par: 'admin';
  mois_eligibles: string[];
}

export default function AdminDashboardNew() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const [type, setType] = useState<'depart' | 'retour'>('depart');
  const [stock, setStock] = useState({ stock_usine: 0, stock_exterieur: 0 });
  const [alerts, setAlerts] = useState({ stock_usine: 0, alert_level: 'normal', message: '' });
  const [stockAudit, setStockAudit] = useState<StockAudit>({
    stock_initial: 0,
    stock_reel: 0,
    caisses_cassees: 0,
    caisses_perimees: 0,
    date_audit: new Date().toISOString().split('T')[0],
    ecart: 0
  });
  const [showStockAudit, setShowStockAudit] = useState(false);
  const [penaltyConfig, setPenaltyConfig] = useState<PenaltyConfig>({
    cout_par_caisse_defaut: 10,
    remarque_visible_par: 'controller'
  });
  const [showPenaltyConfig, setShowPenaltyConfig] = useState(false);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [showPenaltyValidation, setShowPenaltyValidation] = useState(true);
  const [showPenaltyForm, setShowPenaltyForm] = useState(false);
  const [newPenalty, setNewPenalty] = useState<Partial<Penalty>>({
    chauffeur_id: 0,
    chauffeur_nom: '',
    caisses_non_retournees: 0,
    cout_par_caisse: 10,
    penalite_totale: 0,
    remarque: '',
    date: new Date().toISOString().split('T')[0],
    statut: 'validee',
    cree_par: 'admin'
  });
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [showRewards, setShowRewards] = useState(true);
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [newReward, setNewReward] = useState<Partial<Reward>>({
    chauffeur_id: 0,
    chauffeur_nom: '',
    montant: 0,
    motif: '',
    date: new Date().toISOString().split('T')[0],
    statut: 'validee',
    cree_par: 'admin',
    mois_eligibles: []
  });
  const [eligibleDrivers, setEligibleDrivers] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [allDeliveries, setAllDeliveries] = useState<any[]>([]);
  const [deliveryFilters, setDeliveryFilters] = useState({ search: '', type: 'all', date: '', statut: 'all' });
  const [deliveryView, setDeliveryView] = useState<'daily'|'monthly'>('daily');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryMonth, setDeliveryMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [deliveryLoading, setDeliveryLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchStock();
      fetchAlerts();
      fetchDeliveries();
      fetchPenalties();
      fetchRewards();
      fetchEligibleDrivers();
    }
    if (activeTab === 'deliveries' || activeTab === 'reports') {
      fetchAllDeliveries();
    }
  }, [activeTab, view, type]);  // eslint-disable-line

  const fetchRewards = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/reward/all`);
      const data = await response.json();
      setRewards(data);
    } catch (error) {
      console.error('Error fetching rewards:', error);
    }
  };

  const fetchEligibleDrivers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/reward/eligible`);
      const data = await response.json();
      setEligibleDrivers(data);
    } catch (error) {
      console.error('Error fetching eligible drivers:', error);
    }
  };

  const createReward = async () => {
    try {
      await fetch(`${API_BASE}/api/reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newReward,
          statut: 'validee',
          cree_par: 'admin'
        })
      });
      setNewReward({
        chauffeur_id: 0,
        chauffeur_nom: '',
        montant: 0,
        motif: '',
        date: new Date().toISOString().split('T')[0],
        statut: 'validee',
        cree_par: 'admin',
        mois_eligibles: []
      });
      setShowRewardForm(false);
      fetchRewards();
    } catch (error) {
      console.error('Error creating reward:', error);
    }
  };

  const fetchPenalties = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/penalty/all`);
      const data = await response.json();
      setPenalties(data);
    } catch (error) {
      console.error('Error fetching penalties:', error);
    }
  };

  const validatePenalty = async (penaltyId: number, statut: 'validee' | 'rejetee') => {
    try {
      await fetch(`${API_BASE}/api/penalty/${penaltyId}/validate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut })
      });
      fetchPenalties();
    } catch (error) {
      console.error('Error validating penalty:', error);
    }
  };

  const createPenalty = async () => {
    try {
      const existingPenaltiesToday = penalties.filter(
        p => p.chauffeur_nom === newPenalty.chauffeur_nom && p.date === newPenalty.date
      );

      if (existingPenaltiesToday.length >= 2) {
        alert(`⚠️ Alerte: Le chauffeur ${newPenalty.chauffeur_nom} a déjà ${existingPenaltiesToday.length} pénalité(s) enregistrée(s) pour cette date. La limite maximale est de 2 pénalités par jour.`);
        return;
      }

      const penalite_totale = newPenalty.caisses_non_retournees! * newPenalty.cout_par_caisse!;
      await fetch(`${API_BASE}/api/penalty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPenalty,
          penalite_totale,
          statut: 'validee',
          cree_par: 'admin'
        })
      });
      setNewPenalty({
        chauffeur_id: 0,
        chauffeur_nom: '',
        caisses_non_retournees: 0,
        cout_par_caisse: 10,
        penalite_totale: 0,
        remarque: '',
        date: new Date().toISOString().split('T')[0],
        statut: 'validee',
        cree_par: 'admin'
      });
      setShowPenaltyForm(false);
      fetchPenalties();
    } catch (error) {
      console.error('Error creating penalty:', error);
    }
  };

  const fetchStock = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/report/stock`);
      const data = await response.json();
      setStock(data);
    } catch (error) {
      console.error('Error fetching stock:', error);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/report/alerts`);
      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const fetchDeliveries = async () => {
    try {
      const endpoint = view === 'daily' 
        ? `${API_BASE}/api/delivery/today`
        : `${API_BASE}/api/delivery/month/2026/6`;
      const response = await fetch(endpoint);
      const data = await response.json();
      const mapped = data.map((d: any, i: number) => ({
        ...d,
        type: d.type || (i % 2 === 0 ? 'depart' : 'retour'),
        validee: d.statut === 'termine' || d.validee
      }));
      setDeliveries(mapped);
    } catch { setDeliveries([]); }
  };

  const fetchAllDeliveries = async () => {
    setDeliveryLoading(true);
    try {
      const endpoint = deliveryView === 'daily'
        ? `${API_BASE}/api/delivery/today`
        : `${API_BASE}/api/delivery/month/${deliveryMonth.year}/${deliveryMonth.month}`;
      const r = await fetch(endpoint);
      const data = await r.json();
      setAllDeliveries(Array.isArray(data) ? data.map((d: any, i: number) => ({
        ...d,
        type: d.type || (i % 2 === 0 ? 'depart' : 'retour'),
        validee: d.statut === 'termine' || d.validee
      })) : []);
    } catch { setAllDeliveries([]); }
    setDeliveryLoading(false);
  };

  const getFilteredDeliveries = () => {
    return allDeliveries.filter(d => {
      const q = deliveryFilters.search.toLowerCase();
      const matchSearch = !q ||
        (d.matricule || '').toLowerCase().includes(q) ||
        (d.chauffeur_nom || '').toLowerCase().includes(q) ||
        (d.secteur_nom || '').toLowerCase().includes(q);
      const matchType = deliveryFilters.type === 'all' || d.type === deliveryFilters.type;
      const matchStatut = deliveryFilters.statut === 'all' ||
        (deliveryFilters.statut === 'validee' && d.validee) ||
        (deliveryFilters.statut === 'en_attente' && !d.validee);
      const matchDate = !deliveryFilters.date || (d.date || '').startsWith(deliveryFilters.date);
      return matchSearch && matchType && matchStatut && matchDate;
    });
  };

  const exportCSV = () => {
    const rows = getFilteredDeliveries();
    const header = 'Date,Camion,Chauffeur,Type,Caisses Ch.,Caisses Ret.,Écart,Poids vide,Poids chargé,Statut';
    const lines = rows.map(d => [
      new Date(d.date).toLocaleDateString('fr-TN'),
      d.matricule || '',
      d.chauffeur_nom || '',
      d.type === 'depart' ? 'Départ' : 'Retour',
      d.nb_caisses_chargees ?? 0,
      d.nb_caisses_retournees ?? 0,
      (d.nb_caisses_chargees ?? 0) - (d.nb_caisses_retournees ?? 0),
      d.poids_vide ?? 0,
      d.poids_charge ?? 0,
      d.validee ? 'Validée' : 'En attente'
    ].join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `livraisons_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleStockAuditSubmit = () => {
    const stockTheorique = stock.stock_usine + stock.stock_exterieur;
    const stockReelCalcule = stockAudit.stock_initial - stockAudit.caisses_cassees - stockAudit.caisses_perimees;
    const ecart = stockTheorique - stockReelCalcule;
    
    setStockAudit({
      ...stockAudit,
      stock_reel: stockReelCalcule,
      ecart: ecart
    });
  };

  const getAlertColor = () => {
    switch (alerts.alert_level) {
      case 'critique': return 'bg-red-500';
      case 'faible': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const renderOverview = () => (
    <div>
      {/* Alertes de stock */}
      {alerts.alert_level !== 'normal' && (
        <div className={`mb-6 p-4 rounded-lg ${getAlertColor()} text-white flex items-center gap-3`}>
          <AlertTriangle className="w-6 h-6" />
          <div>
            <p className="font-semibold">{alerts.message}</p>
            <p className="text-sm opacity-90">Stock actuel: {alerts.stock_usine} caisses</p>
          </div>
        </div>
      )}

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <Package className="w-8 h-8 text-elfirma-green" />
            <span className="text-sm text-gray-500">Stock à l'usine</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stock.stock_usine}</p>
          <p className="text-sm text-gray-500 mt-1">caisses disponibles</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <Truck className="w-8 h-8 text-blue-500" />
            <span className="text-sm text-gray-500">En extérieur</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stock.stock_exterieur}</p>
          <p className="text-sm text-gray-500 mt-1">caisses en transit</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-purple-500" />
            <span className="text-sm text-gray-500">Livraisons {view === 'daily' ? "aujourd'hui" : "ce mois"}</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">{deliveries.length}</p>
          <p className="text-sm text-gray-500 mt-1">livraisons effectuées</p>
        </div>
      </div>

      {/* Audit du Stock Réel */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Audit du Stock Réel</h2>
          <button
            onClick={() => setShowStockAudit(!showStockAudit)}
            className="flex items-center gap-2 bg-elfirma-gold text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-yellow-500 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            {showStockAudit ? 'Masquer Audit' : 'Afficher Audit'}
          </button>
        </div>

        {showStockAudit && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock Initial</label>
                <input
                  type="number"
                  value={stockAudit.stock_initial}
                  onChange={(e) => setStockAudit({ ...stockAudit, stock_initial: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Nombre de caisses initial"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Caisses Cassées</label>
                <input
                  type="number"
                  value={stockAudit.caisses_cassees}
                  onChange={(e) => setStockAudit({ ...stockAudit, caisses_cassees: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Nombre de caisses cassées"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Caisses Périmées</label>
                <input
                  type="number"
                  value={stockAudit.caisses_perimees}
                  onChange={(e) => setStockAudit({ ...stockAudit, caisses_perimees: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Nombre de caisses périmées"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de l'Audit</label>
                <input
                  type="date"
                  value={stockAudit.date_audit}
                  onChange={(e) => setStockAudit({ ...stockAudit, date_audit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <button
              onClick={handleStockAuditSubmit}
              className="w-full bg-elfirma-green text-white py-2 rounded-lg font-medium hover:bg-elfirma-darkGreen transition-colors"
            >
              Calculer l'Écart
            </button>
            
            {stockAudit.stock_reel > 0 && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Stock Théorique</p>
                  <p className="text-2xl font-bold text-purple-700">{stock.stock_usine + stock.stock_exterieur} caisses</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Stock Réel Calculé</p>
                  <p className="text-2xl font-bold text-orange-700">{stockAudit.stock_reel} caisses</p>
                </div>
                <div className={`p-4 rounded-lg ${stockAudit.ecart === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-sm text-gray-600 mb-2">Écart</p>
                  <p className={`text-2xl font-bold ${stockAudit.ecart === 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {stockAudit.ecart} caisses
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gestion des Pénalités */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Gestion des Pénalités</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPenaltyValidation(!showPenaltyValidation)}
              className="flex items-center gap-2 bg-elfirma-gold text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-yellow-500 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              {showPenaltyValidation ? 'Masquer' : 'Afficher'}
            </button>
            <button
              onClick={() => setShowPenaltyForm(!showPenaltyForm)}
              className="flex items-center gap-2 bg-elfirma-green text-white px-4 py-2 rounded-lg font-medium hover:bg-elfirma-darkGreen transition-colors"
            >
              <Package className="w-4 h-4" />
              {showPenaltyForm ? 'Fermer' : 'Nouvelle Pénalité'}
            </button>
          </div>
        </div>

        {showPenaltyForm && (
          <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-700">Créer une Pénalité (Admin)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Chauffeur</label>
                <input
                  type="text"
                  value={newPenalty.chauffeur_nom}
                  onChange={(e) => setNewPenalty({ ...newPenalty, chauffeur_nom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Nom du chauffeur"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Caisses Non Retournées</label>
                <input
                  type="number"
                  value={newPenalty.caisses_non_retournees}
                  onChange={(e) => setNewPenalty({ ...newPenalty, caisses_non_retournees: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Nombre de caisses"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Coût par Caisse (TND)</label>
                <input
                  type="number"
                  value={newPenalty.cout_par_caisse}
                  onChange={(e) => setNewPenalty({ ...newPenalty, cout_par_caisse: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Coût unitaire"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={newPenalty.date}
                  onChange={(e) => setNewPenalty({ ...newPenalty, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recommandation / Note</label>
              <textarea
                value={newPenalty.remarque}
                onChange={(e) => setNewPenalty({ ...newPenalty, remarque: e.target.value })}
                placeholder="Recommandation / Note"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <button
              onClick={createPenalty}
              className="w-full bg-elfirma-green text-white py-2 rounded-lg font-medium hover:bg-elfirma-darkGreen transition-colors"
            >
              Créer et Valider la Pénalité
            </button>
          </div>
        )}

        {showPenaltyValidation && (
          <div className="space-y-4">
            {penalties.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Aucune pénalité enregistrée</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Chauffeur</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Caisses Non Retournées</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Coût par Caisse</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Pénalité Totale</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {penalties.map((penalty) => (
                      <tr key={penalty.id} className={`border-b border-gray-100 ${
                        penalty.statut === 'en_attente' ? 'bg-yellow-50' :
                        penalty.statut === 'validee' ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        <td className="py-3 px-4 text-sm">{new Date(penalty.date).toLocaleDateString('fr-TN')}</td>
                        <td className="py-3 px-4 text-sm font-medium">{penalty.chauffeur_nom}</td>
                        <td className="py-3 px-4 text-sm font-bold text-red-600">{penalty.caisses_non_retournees}</td>
                        <td className="py-3 px-4 text-sm">{penalty.cout_par_caisse} TND</td>
                        <td className="py-3 px-4 text-sm font-bold text-red-600">{penalty.penalite_totale} TND</td>
                        <td className="py-3 px-4 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            penalty.statut === 'en_attente' ? 'bg-yellow-100 text-yellow-800' :
                            penalty.statut === 'validee' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {penalty.statut === 'en_attente' ? 'En attente' :
                             penalty.statut === 'validee' ? 'Validée' : 'Rejetée'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {penalty.statut === 'en_attente' && penalty.cree_par === 'comptable' ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => validatePenalty(penalty.id, 'validee')}
                                className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                              >
                                Valider
                              </button>
                              <button
                                onClick={() => validatePenalty(penalty.id, 'rejetee')}
                                className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                              >
                                Rejeter
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gestion des Récompenses */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Gestion des Récompenses</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRewards(!showRewards)}
              className="flex items-center gap-2 bg-elfirma-gold text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-yellow-500 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              {showRewards ? 'Masquer' : 'Afficher'}
            </button>
            <button
              onClick={() => setShowRewardForm(!showRewardForm)}
              className="flex items-center gap-2 bg-elfirma-green text-white px-4 py-2 rounded-lg font-medium hover:bg-elfirma-darkGreen transition-colors"
            >
              <Package className="w-4 h-4" />
              {showRewardForm ? 'Fermer' : 'Nouvelle Récompense'}
            </button>
          </div>
        </div>

        {showRewardForm && (
          <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-700">Créer une Récompense (Admin)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Chauffeur</label>
                <select
                  value={newReward.chauffeur_id}
                  onChange={(e) => {
                    const selected = eligibleDrivers.find(d => d.id === parseInt(e.target.value));
                    setNewReward({
                      ...newReward,
                      chauffeur_id: parseInt(e.target.value),
                      chauffeur_nom: selected?.chauffeur_nom || '',
                      mois_eligibles: selected?.mois_eligibles || []
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Sélectionner un chauffeur</option>
                  {eligibleDrivers.map(driver => (
                    <option key={driver.id} value={driver.id}>
                      {driver.chauffeur_nom} - {driver.mois_eligibles?.join(', ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Montant (TND)</label>
                <input
                  type="number"
                  value={newReward.montant}
                  onChange={(e) => setNewReward({ ...newReward, montant: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Montant de la récompense"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={newReward.date}
                  onChange={(e) => setNewReward({ ...newReward, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Motif</label>
              <textarea
                value={newReward.motif}
                onChange={(e) => setNewReward({ ...newReward, motif: e.target.value })}
                placeholder="Motif de la récompense"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <button
              onClick={createReward}
              className="w-full bg-elfirma-green text-white py-2 rounded-lg font-medium hover:bg-elfirma-darkGreen transition-colors"
            >
              Créer la Récompense
            </button>
          </div>
        )}

        {showRewards && (
          <div className="space-y-4">
            {rewards.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Aucune récompense enregistrée</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Chauffeur</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Montant</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Motif</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rewards.map((reward) => (
                      <tr key={reward.id} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-sm">{new Date(reward.date).toLocaleDateString('fr-TN')}</td>
                        <td className="py-3 px-4 text-sm font-medium">{reward.chauffeur_nom}</td>
                        <td className="py-3 px-4 text-sm font-bold text-green-600">{reward.montant} TND</td>
                        <td className="py-3 px-4 text-sm">{reward.motif || '-'}</td>
                        <td className="py-3 px-4 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            reward.statut === 'validee' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {reward.statut === 'validee' ? 'Validée' : 'Rejetée'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'trucks' && <TruckManagement />}
      {activeTab === 'drivers' && <DriverManagement />}
      {activeTab === 'deliveries' && (
        <DeliveriesModule
          allDeliveries={allDeliveries}
          deliveryLoading={deliveryLoading}
          deliveryView={deliveryView}
          setDeliveryView={setDeliveryView}
          deliveryMonth={deliveryMonth}
          setDeliveryMonth={setDeliveryMonth}
          deliveryFilters={deliveryFilters}
          setDeliveryFilters={setDeliveryFilters}
          getFilteredDeliveries={getFilteredDeliveries}
          fetchAllDeliveries={fetchAllDeliveries}
          exportCSV={exportCSV}
        />
      )}
      {activeTab === 'reports' && (
        <ReportsModule deliveries={allDeliveries} fetchAllDeliveries={fetchAllDeliveries} />
      )}
      {activeTab === 'penalties' && (
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Pénalités</h2>
          <p className="text-gray-600">Utilisez l'onglet Vue d'ensemble pour gérer les pénalités</p>
        </div>
      )}
      {activeTab === 'rewards' && (
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Récompenses</h2>
          <p className="text-gray-600">Utilisez l'onglet Vue d'ensemble pour gérer les récompenses</p>
        </div>
      )}
    </DashboardLayout>
  );
}

/* ══════════════════════════════════════════════════════
   MODULE LIVRAISONS
══════════════════════════════════════════════════════ */
function DeliveriesModule({ allDeliveries, deliveryLoading, deliveryView, setDeliveryView, deliveryMonth, setDeliveryMonth, deliveryFilters, setDeliveryFilters, getFilteredDeliveries, fetchAllDeliveries, exportCSV }: any) {
  const filtered = getFilteredDeliveries();
  const totalCaissesEcart = filtered.reduce((s: number, d: any) => s + Math.max(0, (d.nb_caisses_chargees ?? 0) - (d.nb_caisses_retournees ?? 0)), 0);
  const totalPoidsNet = filtered.reduce((s: number, d: any) => s + ((d.poids_charge ?? 0) - (d.poids_vide ?? 0)), 0);
  const nbDeparts = filtered.filter((d: any) => d.type === 'depart').length;
  const nbRetours = filtered.filter((d: any) => d.type === 'retour').length;

  const MOIS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Truck className="w-7 h-7 text-elfirma-green" /> Gestion des Livraisons
        </h2>
        <div className="flex gap-2">
          <button onClick={fetchAllDeliveries} disabled={deliveryLoading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${deliveryLoading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-elfirma-green text-white rounded-lg text-sm font-medium hover:bg-elfirma-darkGreen">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Départs', val: nbDeparts, icon: <ArrowUpCircle className="w-6 h-6 text-green-500"/>, color: 'green' },
          { label: 'Retours', val: nbRetours, icon: <ArrowDownCircle className="w-6 h-6 text-blue-500"/>, color: 'blue' },
          { label: 'Écart caisses', val: totalCaissesEcart, icon: <Package className="w-6 h-6 text-red-500"/>, color: totalCaissesEcart > 0 ? 'red' : 'green' },
          { label: 'Poids net total', val: `${totalPoidsNet.toFixed(0)} kg`, icon: <BarChart3 className="w-6 h-6 text-purple-500"/>, color: 'purple' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-200">
            <div className="flex justify-between items-start mb-1">{k.icon}<span className="text-xs text-gray-400">{k.label}</span></div>
            <p className={`text-2xl font-bold ${k.color === 'red' ? 'text-red-600' : k.color === 'green' ? 'text-green-600' : k.color === 'blue' ? 'text-blue-600' : 'text-purple-600'}`}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Vue */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Période</p>
            <div className="flex gap-1">
              {(['daily', 'monthly'] as const).map(v => (
                <button key={v} onClick={() => setDeliveryView(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${deliveryView === v ? 'bg-elfirma-green text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {v === 'daily' ? <><Calendar className="w-3 h-3 inline mr-1"/>Jour</> : <><TrendingUp className="w-3 h-3 inline mr-1"/>Mois</>}
                </button>
              ))}
            </div>
          </div>

          {/* Sélecteur mois */}
          {deliveryView === 'monthly' && (
            <div className="flex gap-2">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Mois</p>
                <select value={deliveryMonth.month} onChange={e => setDeliveryMonth({ ...deliveryMonth, month: parseInt(e.target.value) })}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  {MOIS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Année</p>
                <select value={deliveryMonth.year} onChange={e => setDeliveryMonth({ ...deliveryMonth, year: parseInt(e.target.value) })}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Recherche */}
          <div className="flex-1 min-w-48">
            <p className="text-xs font-semibold text-gray-500 mb-1">Recherche</p>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Camion, chauffeur, secteur…"
                value={deliveryFilters.search}
                onChange={e => setDeliveryFilters({ ...deliveryFilters, search: e.target.value })}
                className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-full" />
            </div>
          </div>

          {/* Type */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Type</p>
            <select value={deliveryFilters.type} onChange={e => setDeliveryFilters({ ...deliveryFilters, type: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              <option value="all">Tous</option>
              <option value="depart">🚛 Départ</option>
              <option value="retour">🔄 Retour</option>
            </select>
          </div>

          {/* Statut */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Statut</p>
            <select value={deliveryFilters.statut} onChange={e => setDeliveryFilters({ ...deliveryFilters, statut: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              <option value="all">Tous</option>
              <option value="validee">✅ Validée</option>
              <option value="en_attente">⏳ En attente</option>
            </select>
          </div>

          {/* Reset + Charger */}
          <button onClick={() => setDeliveryFilters({ search: '', type: 'all', date: '', statut: 'all' })}
            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">
            <Filter className="w-3 h-3 inline mr-1" />Reset
          </button>
          <button onClick={fetchAllDeliveries}
            className="px-4 py-1.5 bg-elfirma-green text-white rounded-lg text-sm font-medium hover:bg-elfirma-darkGreen">
            Charger
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">{filtered.length} livraison{filtered.length > 1 ? 's' : ''}</h3>
          {allDeliveries.length === 0 && !deliveryLoading && (
            <span className="text-xs text-gray-400">Cliquez sur "Charger" pour afficher les données</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                {['Date / Heure', 'Camion', 'Chauffeur', 'Type', 'Caisses Ch.', 'Caisses Ret.', 'Écart', 'Poids net', 'Statut'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deliveryLoading ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">Aucune livraison trouvée</td></tr>
              ) : filtered.map((d: any) => {
                const ecart = (d.nb_caisses_chargees ?? 0) - (d.nb_caisses_retournees ?? 0);
                const poidsNet = ((d.poids_charge ?? 0) - (d.poids_vide ?? 0)).toFixed(1);
                return (
                  <tr key={d.id} className={`border-t border-gray-50 hover:bg-gray-50 ${d.validee ? 'bg-green-50/30' : ''}`}>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(d.date).toLocaleString('fr-TN')}</td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-700">{d.matricule || '—'}</td>
                    <td className="px-4 py-3 font-medium">{d.chauffeur_nom || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                        d.type === 'depart' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                        {d.type === 'depart' ? <ArrowUpCircle className="w-3 h-3"/> : <ArrowDownCircle className="w-3 h-3"/>}
                        {d.type === 'depart' ? 'Départ' : 'Retour'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-elfirma-green">{d.nb_caisses_chargees ?? '—'}</td>
                    <td className="px-4 py-3 font-bold text-blue-600">{d.nb_caisses_retournees ?? '—'}</td>
                    <td className={`px-4 py-3 font-bold ${ecart > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {ecart > 0 ? `−${ecart}` : ecart < 0 ? `+${Math.abs(ecart)}` : '✓'}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-700">{poidsNet} kg</td>
                    <td className="px-4 py-3">
                      {d.validee
                        ? <span className="flex items-center gap-1 text-xs text-green-700 font-medium"><CheckCircle className="w-3.5 h-3.5"/>Validée</span>
                        : <span className="flex items-center gap-1 text-xs text-amber-700 font-medium"><XCircle className="w-3.5 h-3.5"/>En attente</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-6 text-xs text-gray-600">
            <span>🚛 <strong>{nbDeparts}</strong> départs</span>
            <span>🔄 <strong>{nbRetours}</strong> retours</span>
            <span className={totalCaissesEcart > 0 ? 'text-red-600' : 'text-green-600'}>📦 Écart total : <strong>{totalCaissesEcart}</strong> caisses</span>
            <span>⚖️ Poids net total : <strong>{totalPoidsNet.toFixed(1)} kg</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MODULE RAPPORTS
══════════════════════════════════════════════════════ */
function ReportsModule({ deliveries, fetchAllDeliveries }: { deliveries: any[], fetchAllDeliveries: () => void }) {
  const now = new Date();
  const [reportMonth, setReportMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);

  const MOIS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  const loadReport = async () => {
    setReportLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/delivery/month/${reportMonth.year}/${reportMonth.month}`);
      const data = await r.json();
      setReportData(Array.isArray(data) ? data.map((d: any, i: number) => ({
        ...d,
        type: d.type || (i % 2 === 0 ? 'depart' : 'retour'),
        validee: d.statut === 'termine' || d.validee
      })) : []);
    } catch { setReportData([]); }
    setReportLoading(false);
  };

  const src = reportData.length > 0 ? reportData : deliveries;

  const totalDeparts  = src.filter(d => d.type === 'depart').length;
  const totalRetours  = src.filter(d => d.type === 'retour').length;
  const totalCaissesCh = src.reduce((s, d) => s + (d.nb_caisses_chargees ?? 0), 0);
  const totalCaissesRet = src.reduce((s, d) => s + (d.nb_caisses_retournees ?? 0), 0);
  const totalEcart    = Math.max(0, totalCaissesCh - totalCaissesRet);
  const totalPoidsNet = src.reduce((s, d) => s + ((d.poids_charge ?? 0) - (d.poids_vide ?? 0)), 0);

  const parChauffeur: Record<string, { departs: number; retours: number; caissesChargees: number; caissesRetournees: number; ecart: number; poidsNet: number; jours: Set<string> }> = {};
  src.forEach(d => {
    const nom = d.chauffeur_nom || 'Inconnu';
    if (!parChauffeur[nom]) parChauffeur[nom] = { departs: 0, retours: 0, caissesChargees: 0, caissesRetournees: 0, ecart: 0, poidsNet: 0, jours: new Set() };
    if (d.type === 'depart') parChauffeur[nom].departs++;
    if (d.type === 'retour') parChauffeur[nom].retours++;
    parChauffeur[nom].caissesChargees  += d.nb_caisses_chargees ?? 0;
    parChauffeur[nom].caissesRetournees += d.nb_caisses_retournees ?? 0;
    parChauffeur[nom].ecart += Math.max(0, (d.nb_caisses_chargees ?? 0) - (d.nb_caisses_retournees ?? 0));
    parChauffeur[nom].poidsNet += (d.poids_charge ?? 0) - (d.poids_vide ?? 0);
    if (d.date) parChauffeur[nom].jours.add(d.date.split('T')[0]);
  });

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // ── Feuille 1 : Détail livraisons
    const detailRows = src.map(d => ({
      'Date': d.date ? new Date(d.date).toLocaleDateString('fr-TN') : '',
      'Heure': d.date ? new Date(d.date).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }) : '',
      'Matricule camion': d.matricule || '',
      'Chauffeur': d.chauffeur_nom || '',
      'Type': d.type === 'depart' ? 'Départ' : 'Retour',
      'Caisses chargées': d.nb_caisses_chargees ?? 0,
      'Caisses retournées': d.nb_caisses_retournees ?? 0,
      'Écart caisses': Math.max(0, (d.nb_caisses_chargees ?? 0) - (d.nb_caisses_retournees ?? 0)),
      'Poids à vide (kg)': d.poids_vide ?? 0,
      'Poids après chargement (kg)': d.poids_charge ?? 0,
      'Poids net (kg)': ((d.poids_charge ?? 0) - (d.poids_vide ?? 0)).toFixed(2),
      'Statut': d.validee ? 'Validée' : 'En attente',
    }));
    const ws1 = XLSX.utils.json_to_sheet(detailRows);
    ws1['!cols'] = [10,8,16,20,8,14,16,14,16,22,14,12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, 'Détail livraisons');

    // ── Feuille 2 : Récapitulatif par chauffeur
    const recapRows = Object.entries(parChauffeur).map(([nom, s]) => ({
      'Chauffeur': nom,
      'Jours travaillés': s.jours.size,
      'Nb départs': s.departs,
      'Nb retours': s.retours,
      'Caisses chargées': s.caissesChargees,
      'Caisses retournées': s.caissesRetournees,
      'Écart caisses': s.ecart,
      'Poids net total (kg)': s.poidsNet.toFixed(2),
      'Score': s.ecart === 0 ? 'Parfait' : s.ecart <= 2 ? 'Correct' : 'A surveiller',
    }));
    const ws2 = XLSX.utils.json_to_sheet(recapRows);
    ws2['!cols'] = [22,16,12,12,16,18,14,20,14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Recap chauffeurs');

    // ── Feuille 3 : Synthèse globale
    const synthRows = [
      { 'Indicateur': 'Mois', 'Valeur': `${MOIS[reportMonth.month]} ${reportMonth.year}` },
      { 'Indicateur': 'Total départs', 'Valeur': totalDeparts },
      { 'Indicateur': 'Total retours', 'Valeur': totalRetours },
      { 'Indicateur': 'Total caisses chargées', 'Valeur': totalCaissesCh },
      { 'Indicateur': 'Total caisses retournées', 'Valeur': totalCaissesRet },
      { 'Indicateur': 'Écart caisses', 'Valeur': totalEcart },
      { 'Indicateur': 'Poids net total (kg)', 'Valeur': totalPoidsNet.toFixed(2) },
      { 'Indicateur': 'Nombre de chauffeurs', 'Valeur': Object.keys(parChauffeur).length },
    ];
    const ws3 = XLSX.utils.json_to_sheet(synthRows);
    ws3['!cols'] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Synthèse globale');

    XLSX.writeFile(wb, `rapport_elfirma_${MOIS[reportMonth.month]}_${reportMonth.year}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-elfirma-green" /> Rapport Mensuel
        </h2>
        <button onClick={exportExcel} disabled={src.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed shadow">
          <Download className="w-5 h-5" /> Exporter Excel (.xlsx)
        </button>
      </div>

      {/* Sélecteur période */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-600 mb-3">Sélectionner le mois à analyser</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-gray-500 mb-1">Mois</p>
            <select value={reportMonth.month} onChange={e => setReportMonth({ ...reportMonth, month: parseInt(e.target.value) })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              {MOIS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Année</p>
            <select value={reportMonth.year} onChange={e => setReportMonth({ ...reportMonth, year: parseInt(e.target.value) })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={loadReport} disabled={reportLoading}
            className="flex items-center gap-2 px-4 py-2 bg-elfirma-green text-white rounded-lg text-sm font-medium hover:bg-elfirma-darkGreen disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${reportLoading ? 'animate-spin' : ''}`} />
            Charger {MOIS[reportMonth.month]} {reportMonth.year}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Départs', val: totalDeparts, color: 'green' },
          { label: 'Retours', val: totalRetours, color: 'blue' },
          { label: 'Caisses chargées', val: totalCaissesCh, color: 'gray' },
          { label: 'Caisses retournées', val: totalCaissesRet, color: 'gray' },
          { label: 'Écart caisses', val: totalEcart, color: totalEcart > 0 ? 'red' : 'green' },
          { label: 'Poids net (kg)', val: totalPoidsNet.toFixed(0), color: 'purple' },
          { label: 'Chauffeurs', val: Object.keys(parChauffeur).length, color: 'gray' },
          { label: 'Total livraisons', val: src.length, color: 'gray' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-200">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${
              k.color === 'red' ? 'text-red-600' :
              k.color === 'green' ? 'text-green-600' :
              k.color === 'blue' ? 'text-blue-600' :
              k.color === 'purple' ? 'text-purple-600' : 'text-gray-800'
            }`}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Tableau récap par chauffeur */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Performance par chauffeur — {MOIS[reportMonth.month]} {reportMonth.year}</h3>
          <span className="text-xs text-gray-400">{src.length} livraisons analysées</span>
        </div>
        {src.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Sélectionnez un mois et cliquez sur « Charger »</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {['Chauffeur', 'Jours trav.', 'Départs', 'Retours', 'Caisses Ch.', 'Caisses Ret.', 'Écart', 'Poids net (kg)', 'Score'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(parChauffeur)
                  .sort((a, b) => b[1].poidsNet - a[1].poidsNet)
                  .map(([nom, stats]) => {
                    const score = stats.ecart === 0 ? '⭐ Parfait' : stats.ecart <= 2 ? '🟡 Correct' : '🔴 À surveiller';
                    return (
                      <tr key={nom} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold">{nom}</td>
                        <td className="px-4 py-3 text-center">{stats.jours.size}</td>
                        <td className="px-4 py-3 text-green-600 font-bold text-center">{stats.departs}</td>
                        <td className="px-4 py-3 text-blue-600 font-bold text-center">{stats.retours}</td>
                        <td className="px-4 py-3 text-center">{stats.caissesChargees}</td>
                        <td className="px-4 py-3 text-center">{stats.caissesRetournees}</td>
                        <td className={`px-4 py-3 font-bold text-center ${stats.ecart > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {stats.ecart > 0 ? `−${stats.ecart}` : '✓'}
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-center">{stats.poidsNet.toFixed(1)}</td>
                        <td className="px-4 py-3">{score}</td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot className="bg-elfirma-green/10 font-bold text-sm">
                <tr>
                  <td className="px-4 py-3 text-elfirma-darkGreen">TOTAL</td>
                  <td className="px-4 py-3 text-center">—</td>
                  <td className="px-4 py-3 text-center text-green-700">{totalDeparts}</td>
                  <td className="px-4 py-3 text-center text-blue-700">{totalRetours}</td>
                  <td className="px-4 py-3 text-center">{totalCaissesCh}</td>
                  <td className="px-4 py-3 text-center">{totalCaissesRet}</td>
                  <td className={`px-4 py-3 text-center ${totalEcart > 0 ? 'text-red-600' : 'text-green-600'}`}>{totalEcart > 0 ? `−${totalEcart}` : '✓'}</td>
                  <td className="px-4 py-3 text-center">{totalPoidsNet.toFixed(1)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Détail complet livraisons */}
      {src.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Détail de toutes les livraisons</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 uppercase text-gray-400">
                <tr>
                  {['Date', 'Matricule', 'Chauffeur', 'Type', 'Caisses Ch.', 'Caisses Ret.', 'Écart', 'Poids net', 'Statut'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {src.map((d: any) => {
                  const ecart = Math.max(0, (d.nb_caisses_chargees ?? 0) - (d.nb_caisses_retournees ?? 0));
                  return (
                    <tr key={d.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500">{d.date ? new Date(d.date).toLocaleDateString('fr-TN') : '—'}</td>
                      <td className="px-3 py-2 font-mono font-bold">{d.matricule || '—'}</td>
                      <td className="px-3 py-2">{d.chauffeur_nom || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          d.type === 'depart' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                          {d.type === 'depart' ? 'Départ' : 'Retour'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-green-600">{d.nb_caisses_chargees ?? '—'}</td>
                      <td className="px-3 py-2 text-center font-bold text-blue-600">{d.nb_caisses_retournees ?? '—'}</td>
                      <td className={`px-3 py-2 text-center font-bold ${ecart > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {ecart > 0 ? `−${ecart}` : '✓'}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{((d.poids_charge ?? 0) - (d.poids_vide ?? 0)).toFixed(1)} kg</td>
                      <td className="px-3 py-2">{d.validee ? <CheckCircle className="w-3.5 h-3.5 text-green-600"/> : <XCircle className="w-3.5 h-3.5 text-amber-500"/>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
