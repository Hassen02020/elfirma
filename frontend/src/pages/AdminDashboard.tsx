import { useState, useEffect } from 'react';
import API_BASE from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, TrendingUp, AlertTriangle, LogOut, Calendar, BarChart3, Download, Shield } from 'lucide-react';

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

export default function AdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
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
  const [deliveries, setDeliveries] = useState([]);
  const [filters, setFilters] = useState({
    date: '',
    camion: '',
    chauffeur: '',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  useEffect(() => {
    fetchStock();
    fetchAlerts();
    fetchDeliveries();
    fetchPenalties();
    fetchRewards();
    fetchEligibleDrivers();
  }, [view, type]);

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
      // Vérifier la limite de 2 pénalités par jour par chauffeur
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
      
      // Ajouter un champ type pour la simulation
      const deliveriesWithType = data.map((d: any, index: number) => ({
        ...d,
        type: index % 2 === 0 ? 'depart' : 'retour' as 'depart' | 'retour',
        validee: d.statut === 'termine'
      }));
      
      // Filtrer pour ne montrer que les départs avec retour validé
      const filteredDeliveries = deliveriesWithType.filter((d: any) => {
        if (d.type === 'depart') {
          // Pour les départs, vérifier qu'il y a un retour correspondant validé
          const matchingReturn = deliveriesWithType.find((r: any) => 
            r.type === 'retour' && r.camion_id === d.camion_id && r.validee
          );
          return matchingReturn;
        } else {
          // Pour les retours, ne montrer que ceux validés
          return d.validee;
        }
      });
      
      setDeliveries(filteredDeliveries);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    }
  };

  const getFilteredAndSortedDeliveries = () => {
    let filtered = [...deliveries];
    
    // Filtrer par date
    if (filters.date) {
      filtered = filtered.filter((d: any) => {
        const deliveryDate = new Date(d.date).toISOString().split('T')[0];
        return deliveryDate === filters.date;
      });
    }
    
    // Filtrer par camion
    if (filters.camion) {
      filtered = filtered.filter((d: any) => d.matricule === filters.camion);
    }
    
    // Filtrer par chauffeur
    if (filters.chauffeur) {
      filtered = filtered.filter((d: any) => d.chauffeur_nom === filters.chauffeur);
    }
    
    // Trier
    filtered.sort((a: any, b: any) => {
      let comparison = 0;
      
      if (filters.sortBy === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (filters.sortBy === 'camion') {
        comparison = a.matricule.localeCompare(b.matricule);
      } else if (filters.sortBy === 'chauffeur') {
        comparison = a.chauffeur_nom.localeCompare(b.chauffeur_nom);
      } else if (filters.sortBy === 'caisses') {
        comparison = a.nb_caisses_chargees - b.nb_caisses_chargees;
      } else if (filters.sortBy === 'rendement') {
        const rendementA = a.nb_caisses_retournees / a.nb_caisses_chargees;
        const rendementB = b.nb_caisses_retournees / b.nb_caisses_chargees;
        comparison = rendementA - rendementB;
      }
      
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  };

  const calculateDriverPerformance = (chauffeurNom: string) => {
    const driverDeliveries = deliveries.filter((d: any) => d.chauffeur_nom === chauffeurNom);
    if (driverDeliveries.length === 0) return { rendement: 0, tauxRetour: 0 };
    
    const totalCaisses = driverDeliveries.reduce((sum: number, d: any) => sum + d.nb_caisses_chargees, 0);
    const totalRetournees = driverDeliveries.reduce((sum: number, d: any) => sum + d.nb_caisses_retournees, 0);
    
    return {
      rendement: totalCaisses / driverDeliveries.length,
      tauxRetour: totalRetournees / totalCaisses
    };
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-elfirma-green text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="EL FIRMA" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold">EL FIRMA</h1>
              <p className="text-sm opacity-90">Super Admin - Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-yellow-400 text-yellow-900">
              <Shield className="w-3.5 h-3.5" />
              Super Admin
            </span>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
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

        {/* Configuration des Pénalités */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Configuration des Pénalités</h2>
            <button
              onClick={() => setShowPenaltyConfig(!showPenaltyConfig)}
              className="flex items-center gap-2 bg-elfirma-gold text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-yellow-500 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              {showPenaltyConfig ? 'Masquer Configuration' : 'Afficher Configuration'}
            </button>
          </div>

          {showPenaltyConfig && (
            <div className="border-t pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Coût par Caisse par Défaut (TND)</label>
                  <input
                    type="number"
                    value={penaltyConfig.cout_par_caisse_defaut}
                    onChange={(e) => setPenaltyConfig({ ...penaltyConfig, cout_par_caisse_defaut: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Coût unitaire par défaut"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Visibilité des Remarques</label>
                  <select
                    value={penaltyConfig.remarque_visible_par}
                    onChange={(e) => setPenaltyConfig({ ...penaltyConfig, remarque_visible_par: e.target.value as 'controller' | 'comptable' | 'all' | 'admin_only' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="controller">Contrôleur uniquement</option>
                    <option value="comptable">Comptable uniquement</option>
                    <option value="all">Tous les rôles</option>
                    <option value="admin_only">Super Admin uniquement</option>
                  </select>
                </div>
              </div>
              <button
                onClick={() => {
                  // Simuler la sauvegarde de la configuration
                  alert('Configuration des pénalités sauvegardée');
                }}
                className="w-full bg-elfirma-green text-white py-2 rounded-lg font-medium hover:bg-elfirma-darkGreen transition-colors"
              >
                Sauvegarder la Configuration
              </button>
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
                  placeholder={`Format de recommandation:
• Raison de la pénalité (ex: retard, caisses endommagées)
• Actions recommandées (ex: améliorer le suivi, formation)
• Délai de mise en œuvre
• Observations supplémentaires`}
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
              <p className="text-sm text-gray-600">
                Validez ou rejetez les pénalités soumises par le comptable. Les pénalités créées par l'admin sont automatiquement validées.
              </p>

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
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Créé par</th>
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
                              penalty.cree_par === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {penalty.cree_par === 'admin' ? 'Admin' : 'Comptable'}
                            </span>
                          </td>
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
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
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
                    <option value="">Sélectionner un chauffeur éligible</option>
                    {eligibleDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.chauffeur_nom} - {driver.mois_eligibles?.join(', ')} (0 écart)
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
                  placeholder={`Motif de la récompense:
• Performance exceptionnelle
• 0 écart pendant 3 mois consécutifs
• Polyvalence et fiabilité
• Autres raisons...`}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <button
                onClick={createReward}
                className="w-full bg-elfirma-green text-white py-2 rounded-lg font-medium hover:bg-elfirma-darkGreen transition-colors"
              >
                Créer et Valider la Récompense
              </button>
            </div>
          )}

          {showRewards && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Récompensez les chauffeurs polyvalents avec 0 écart pendant au moins 3 mois consécutifs.
              </p>

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
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Mois Éligibles</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rewards.map((reward) => (
                        <tr key={reward.id} className={`border-b border-gray-100 ${
                          reward.statut === 'validee' ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                          <td className="py-3 px-4 text-sm">{new Date(reward.date).toLocaleDateString('fr-TN')}</td>
                          <td className="py-3 px-4 text-sm font-medium">{reward.chauffeur_nom}</td>
                          <td className="py-3 px-4 text-sm font-bold text-green-600">{reward.montant} TND</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{reward.motif || '-'}</td>
                          <td className="py-3 px-4 text-sm">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {reward.mois_eligibles?.join(', ') || '-'}
                            </span>
                          </td>
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

        {/* Sélecteur de vue */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Rapports</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setView('daily')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  view === 'daily' 
                    ? 'bg-elfirma-green text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                Journalier
              </button>
              <button
                onClick={() => setView('monthly')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  view === 'monthly' 
                    ? 'bg-elfirma-green text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Mensuel
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Type d'opération</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setType('depart')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  type === 'depart' 
                    ? 'bg-elfirma-gold text-gray-800' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Départ
              </button>
              <button
                onClick={() => setType('retour')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  type === 'retour' 
                    ? 'bg-elfirma-gold text-gray-800' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Retour
              </button>
            </div>
          </div>

          {/* Filtres avancés */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Camion</label>
              <select
                value={filters.camion}
                onChange={(e) => setFilters({ ...filters, camion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Tous</option>
                <option value="190 TN 1234">190 TN 1234</option>
                <option value="190 TN 5678">190 TN 5678</option>
                <option value="190 TN 9012">190 TN 9012</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chauffeur</label>
              <select
                value={filters.chauffeur}
                onChange={(e) => setFilters({ ...filters, chauffeur: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Tous</option>
                <option value="Ahmed Ben Ali">Ahmed Ben Ali</option>
                <option value="Mohamed Trabelsi">Mohamed Trabelsi</option>
                <option value="Sami Bouazizi">Sami Bouazizi</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Trier par</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="date">Date</option>
                <option value="camion">Camion</option>
                <option value="chauffeur">Chauffeur</option>
                <option value="caisses">Caisses</option>
                <option value="rendement">Rendement</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setFilters({ ...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {filters.sortOrder === 'asc' ? '↑ Croissant' : '↓ Décroissant'}
            </button>
            <button
              onClick={() => setFilters({ date: '', camion: '', chauffeur: '', sortBy: 'date', sortOrder: 'desc' })}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>

          <button className="flex items-center gap-2 bg-elfirma-gold text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-yellow-500 transition-colors">
            <Download className="w-4 h-4" />
            Exporter le rapport
          </button>
        </div>

        {/* Liste des livraisons */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">
            Livraisons {view === 'daily' ? "du jour" : "du mois"} ({getFilteredAndSortedDeliveries().length} résultats)
          </h2>
          
          {getFilteredAndSortedDeliveries().length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune livraison correspondante aux filtres</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date/Heure Départ</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date/Heure Retour</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Camion</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Chauffeur</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Poids vide</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Poids chargé</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Caisses</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Retournées</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Poids Net (kg)</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Écart</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Fluidité</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredAndSortedDeliveries().map((delivery: any) => {
                    const ecart = delivery.nb_caisses_chargees - delivery.nb_caisses_retournees;
                    const tauxRetour = delivery.nb_caisses_chargees > 0 
                      ? ((delivery.nb_caisses_retournees / delivery.nb_caisses_chargees) * 100).toFixed(1)
                      : '0';
                    const poidsNet = (delivery.poids_charge - delivery.poids_vide).toFixed(2);
                    const fluidite = parseFloat(tauxRetour) >= 95 ? 'Excellent' : parseFloat(tauxRetour) >= 90 ? 'Bon' : 'Faible';
                    const fluiditeColor = parseFloat(tauxRetour) >= 95 ? 'text-green-600' : parseFloat(tauxRetour) >= 90 ? 'text-yellow-600' : 'text-red-600';
                    
                    return (
                      <tr key={delivery.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">
                          {delivery.type === 'depart' ? new Date(delivery.date).toLocaleString('fr-TN') : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {delivery.type === 'retour' ? new Date(delivery.date).toLocaleString('fr-TN') : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium">{delivery.matricule}</td>
                        <td className="py-3 px-4 text-sm">{delivery.chauffeur_nom}</td>
                        <td className="py-3 px-4 text-sm">{delivery.poids_vide} kg</td>
                        <td className="py-3 px-4 text-sm">{delivery.poids_charge} kg</td>
                        <td className="py-3 px-4 text-sm font-medium">{delivery.nb_caisses_chargees}</td>
                        <td className="py-3 px-4 text-sm">{delivery.nb_caisses_retournees}</td>
                        <td className="py-3 px-4 text-sm font-medium">{poidsNet}</td>
                        <td className={`py-3 px-4 text-sm font-medium ${ecart > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {ecart > 0 ? `-${ecart}` : `+${Math.abs(ecart)}`}
                        </td>
                        <td className={`py-3 px-4 text-sm font-medium ${fluiditeColor}`}>
                          {fluidite}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Performance des chauffeurs */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Performance des Chauffeurs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['Ahmed Ben Ali', 'Mohamed Trabelsi', 'Sami Bouazizi'].map(chauffeur => {
              const perf = calculateDriverPerformance(chauffeur);
              return (
                <div key={chauffeur} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">{chauffeur}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Moyenne caisses:</span>
                      <span className="font-medium">{perf.rendement.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Taux retour:</span>
                      <span className={`font-medium ${perf.tauxRetour >= 95 ? 'text-green-600' : perf.tauxRetour >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {perf.tauxRetour.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
