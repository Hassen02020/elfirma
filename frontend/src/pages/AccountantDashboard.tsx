import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Printer, LogOut, FileText, TrendingUp, TrendingDown, Sun, Moon, Calculator, BarChart3 } from 'lucide-react';

import API_BASE from '../config/api';
const API = `${API_BASE}/api`;
const MOIS_NOMS = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

interface ChauffeurStats {
  chauffeur_id: number;
  chauffeur_nom: string;
  matricule: string;
  nb_livraisons: number;
  total_caisses_chargees: number;
  total_caisses_retournees: number;
  caisses_en_exterieur: number;
}

interface DailyStats {
  date: string;
  livraisons: number;
  caisses: number;
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

export default function AccountantDashboard() {
  const { logout, agent } = useAuth();
  const navigate = useNavigate();
  const [selectedChauffeur, setSelectedChauffeur] = useState<number | null>(null);
  const [type, setType] = useState<'depart' | 'retour'>('depart');
  const [chauffeurs, setChauffeurs] = useState<ChauffeurStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [selectedMonth, setSelectedMonth] = useState({ year: 2026, month: 6 });
  const [filters, setFilters] = useState({
    camion: '',
    chauffeur: '',
    sortBy: 'chauffeur',
    sortOrder: 'asc'
  });
  const [stockData, setStockData] = useState({
    stock_usine: 0,
    stock_exterieur: 0,
    caisses_en_attente: 0
  });
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [showPenaltyForm, setShowPenaltyForm] = useState(false);
  const [newPenalty, setNewPenalty] = useState<Partial<Penalty>>({
    chauffeur_id: 0,
    chauffeur_nom: '',
    caisses_non_retournees: 0,
    cout_par_caisse: 0,
    penalite_totale: 0,
    remarque: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [showRewards, setShowRewards] = useState(true);
  const [onglet, setOnglet] = useState<'livrables'|'affectations'|'rapport'|'findemois'>('livrables');
  const [rapportFull, setRapportFull] = useState<any>(null);
  const [affectations, setAffectations] = useState<any[]>([]);
  const [rapportFinDeMois, setRapportFinDeMois] = useState<any>(null);
  const [fdmLoading, setFdmLoading] = useState(false);

  useEffect(() => {
    fetchChauffeursStats();
    fetchStockData();
    fetchRewards();
    fetchRapportFull();
    fetchAffectations();
  }, [selectedMonth]);

  const fetchRapportFinDeMois = async () => {
    setFdmLoading(true);
    try {
      const r = await fetch(`${API}/fin-de-mois/rapport/${selectedMonth.year}/${selectedMonth.month}`);
      setRapportFinDeMois(await r.json());
    } catch { setRapportFinDeMois(null); }
    setFdmLoading(false);
  };

  const fetchRapportFull = async () => {
    try {
      const r = await fetch(`${API}/report/monthly-full/${selectedMonth.year}/${selectedMonth.month}`);
      setRapportFull(await r.json());
    } catch { setRapportFull(null); }
  };

  const fetchAffectations = async () => {
    try {
      const r = await fetch(`${API}/report/affectations/${selectedMonth.year}/${selectedMonth.month}`);
      const data = await r.json();
      setAffectations(Array.isArray(data) ? data : []);
    } catch { setAffectations([]); }
  };

  const fetchRewards = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/reward/all`);
      const data = await response.json();
      setRewards(data);
    } catch (error) {
      console.error('Error fetching rewards:', error);
    }
  };

  const fetchChauffeursStats = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/report/monthly/${selectedMonth.year}/${selectedMonth.month}`
      );
      const data = await response.json();
      // Filtrer pour ne montrer que les livraisons complètes (départ + retour validé)
      const filteredData = data.filter((chauffeur: any) => {
        // Vérifier que chaque départ a un retour correspondant validé
        const departures = chauffeur.livraisons?.filter((l: any) => l.type === 'depart') || [];
        const returns = chauffeur.livraisons?.filter((l: any) => l.type === 'retour') || [];
        
        return departures.every((depart: any) => {
          const matchingReturn = returns.find((ret: any) => 
            ret.camion_id === depart.camion_id && ret.validee
          );
          return matchingReturn;
        });
      });
      setChauffeurs(filteredData);
    } catch (error) {
      console.error('Error fetching chauffeurs stats:', error);
    }
  };

  const fetchStockData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/report/stock`);
      const data = await response.json();
      setStockData({
        stock_usine: data.stock_usine,
        stock_exterieur: data.stock_exterieur,
        caisses_en_attente: data.stock_exterieur * 0.1 // Simuler 10% en attente
      });
    } catch (error) {
      console.error('Error fetching stock data:', error);
    }
  };

  const getFilteredAndSortedChauffeurs = () => {
    let filtered = [...chauffeurs];
    
    // Filtrer par camion (simulé via matricule dans les données)
    if (filters.camion) {
      filtered = filtered.filter((c: any) => c.matricule === filters.camion);
    }
    
    // Filtrer par chauffeur
    if (filters.chauffeur) {
      filtered = filtered.filter((c: any) => c.chauffeur_nom === filters.chauffeur);
    }
    
    // Trier
    filtered.sort((a: any, b: any) => {
      let comparison = 0;
      
      if (filters.sortBy === 'chauffeur') {
        comparison = a.chauffeur_nom.localeCompare(b.chauffeur_nom);
      } else if (filters.sortBy === 'camion') {
        comparison = a.matricule.localeCompare(b.matricule);
      } else if (filters.sortBy === 'livraisons') {
        comparison = a.nb_livraisons - b.nb_livraisons;
      } else if (filters.sortBy === 'caisses') {
        comparison = a.total_caisses_chargees - b.total_caisses_chargees;
      } else if (filters.sortBy === 'ecart') {
        const ecartA = a.total_caisses_chargees - a.total_caisses_retournees;
        const ecartB = b.total_caisses_chargees - b.total_caisses_retournees;
        comparison = ecartA - ecartB;
      }
      
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  };

  const calculerEcartJournalier = (_stat: DailyStats) => {
    const ecart = Math.floor(Math.random() * 5); // Écart simulé
    return ecart;
  };

  const fetchDailyStats = async () => {
    try {
      // Simuler des données journalières pour le chauffeur sélectionné
      const mockDailyStats: DailyStats[] = [];
      for (let day = 1; day <= 30; day++) {
        mockDailyStats.push({
          date: `2026-06-${String(day).padStart(2, '0')}`,
          livraisons: Math.floor(Math.random() * 3) + 1,
          caisses: Math.floor(Math.random() * 50) + 50
        });
      }
      setDailyStats(mockDailyStats);
    } catch (error) {
      console.error('Error fetching daily stats:', error);
    }
  };

  const calculerEcartMensuel = (chauffeur: ChauffeurStats) => {
    return chauffeur.total_caisses_chargees - chauffeur.total_caisses_retournees;
  };

  const handleAddPenalty = () => {
    if (!newPenalty.chauffeur_id || !newPenalty.cout_par_caisse || !newPenalty.caisses_non_retournees) {
      return;
    }

    // Vérifier la limite de 2 pénalités par jour par chauffeur
    const existingPenaltiesToday = penalties.filter(
      p => p.chauffeur_id === newPenalty.chauffeur_id && p.date === newPenalty.date
    );

    if (existingPenaltiesToday.length >= 2) {
      alert(`⚠️ Alerte: Le chauffeur ${newPenalty.chauffeur_nom} a déjà ${existingPenaltiesToday.length} pénalité(s) enregistrée(s) pour cette date. La limite maximale est de 2 pénalités par jour.`);
      return;
    }

    const penaliteTotale = newPenalty.caisses_non_retournees * newPenalty.cout_par_caisse;
    const penalty: Penalty = {
      id: Date.now(),
      chauffeur_id: newPenalty.chauffeur_id!,
      chauffeur_nom: newPenalty.chauffeur_nom!,
      caisses_non_retournees: newPenalty.caisses_non_retournees!,
      cout_par_caisse: newPenalty.cout_par_caisse!,
      penalite_totale: penaliteTotale,
      remarque: newPenalty.remarque || '',
      date: newPenalty.date!,
      statut: 'en_attente',
      cree_par: 'comptable'
    };

    setPenalties([...penalties, penalty]);
    setNewPenalty({
      chauffeur_id: 0,
      chauffeur_nom: '',
      caisses_non_retournees: 0,
      cout_par_caisse: 0,
      penalite_totale: 0,
      remarque: '',
      date: new Date().toISOString().split('T')[0]
    });
    setShowPenaltyForm(false);
  };

  const imprimerLivrableChauffeur = (chauffeur: ChauffeurStats) => {
    const ecartMensuel = calculerEcartMensuel(chauffeur);
    const printContent = `
      <html>
        <head>
          <title>Livrable Comptable - EL FIRMA</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; border-bottom: 2px solid #2E7D32; padding-bottom: 20px; margin-bottom: 20px; }
            .logo { font-size: 24px; font-weight: bold; color: #2E7D32; }
            .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
            .section-title { font-size: 18px; font-weight: bold; color: #2E7D32; margin-bottom: 10px; }
            .info { margin: 8px 0; }
            .info-label { font-weight: bold; display: inline-block; width: 200px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .table th { background-color: #2E7D32; color: white; }
            .ecart { color: ${ecartMensuel > 0 ? 'red' : 'green'}; font-weight: bold; }
            .signature { margin-top: 40px; border-top: 1px solid #000; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">EL FIRMA - Gestion des Caisses</div>
            <div>Livrable Comptable par Chauffeur</div>
            <div>Période: ${selectedMonth.month}/${selectedMonth.year}</div>
            <div>Date d'édition: ${new Date().toLocaleString('fr-TN')}</div>
          </div>

          <div class="section">
            <div class="section-title">Informations du Chauffeur</div>
            <div class="info"><span class="info-label">Nom:</span> ${chauffeur.chauffeur_nom}</div>
            <div class="info"><span class="info-label">Matricule camion:</span> ${chauffeur.matricule}</div>
            <div class="info"><span class="info-label">Nombre de livraisons:</span> ${chauffeur.nb_livraisons}</div>
          </div>

          <div class="section">
            <div class="section-title">Statistiques Mensuelles</div>
            <div class="info"><span class="info-label">Caisses chargées:</span> ${chauffeur.total_caisses_chargees}</div>
            <div class="info"><span class="info-label">Caisses retournées:</span> ${chauffeur.total_caisses_retournees}</div>
            <div class="info"><span class="info-label">Écart mensuel:</span> <span class="ecart">${ecartMensuel} caisses</span></div>
            <div class="info"><span class="info-label">Taux de retour:</span> ${((chauffeur.total_caisses_retournees / chauffeur.total_caisses_chargees) * 100).toFixed(2)}%</div>
          </div>

          <div class="section">
            <div class="section-title">Écarts Journaliers</div>
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Livraisons</th>
                  <th>Caisses</th>
                  <th>Écart</th>
                </tr>
              </thead>
              <tbody>
                ${dailyStats.map(stat => `
                  <tr>
                    <td>${stat.date}</td>
                    <td>${stat.livraisons}</td>
                    <td>${stat.caisses}</td>
                    <td class="ecart">${calculerEcartJournalier(stat)} caisses</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="signature">
            <div>Signature du comptable:</div>
            <div style="height: 50px;"></div>
          </div>
          <div class="signature">
            <div>Signature du responsable:</div>
            <div style="height: 50px;"></div>
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleChauffeurSelect = (chauffeurId: number) => {
    setSelectedChauffeur(chauffeurId);
    fetchDailyStats();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-elfirma-green text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="EL FIRMA" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold">EL FIRMA</h1>
              <p className="text-sm opacity-90">Comptable - Livrables par Chauffeur</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {agent && (
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                  agent.poste_type === 'JOUR' ? 'bg-amber-400 text-amber-900'
                  : agent.poste_type === 'NUIT' ? 'bg-indigo-500 text-white'
                  : 'bg-white/20 text-white'
                }`}>
                  {agent.poste_type === 'JOUR' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  {agent.poste_nom || agent.poste_type}
                </span>
                <span className="hidden sm:block text-sm text-white/90 bg-white/10 px-3 py-1.5 rounded-full">
                  {agent.nom} {agent.prenom || ''}
                </span>
              </div>
            )}
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
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Sélection de la période</h2>
            <div className="flex gap-2">
              <select
                value={selectedMonth.month}
                onChange={(e) => setSelectedMonth({ ...selectedMonth, month: parseInt(e.target.value) })}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value={1}>Janvier</option>
                <option value={2}>Février</option>
                <option value={3}>Mars</option>
                <option value={4}>Avril</option>
                <option value={5}>Mai</option>
                <option value={6}>Juin</option>
                <option value={7}>Juillet</option>
                <option value={8}>Août</option>
                <option value={9}>Septembre</option>
                <option value={10}>Octobre</option>
                <option value={11}>Novembre</option>
                <option value={12}>Décembre</option>
              </select>
              <select
                value={selectedMonth.year}
                onChange={(e) => setSelectedMonth({ ...selectedMonth, year: parseInt(e.target.value) })}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                <option value="chauffeur">Chauffeur</option>
                <option value="camion">Camion</option>
                <option value="livraisons">Livraisons</option>
                <option value="caisses">Caisses</option>
                <option value="ecart">Écart</option>
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
              onClick={() => setFilters({ camion: '', chauffeur: '', sortBy: 'chauffeur', sortOrder: 'asc' })}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        </div>

        {/* État du stock */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">État du Stock</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Stock à l'usine</p>
              <p className="text-2xl font-bold text-green-700">{stockData.stock_usine} caisses</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Stock en extérieur</p>
              <p className="text-2xl font-bold text-blue-700">{stockData.stock_exterieur} caisses</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">En attente de retour</p>
              <p className="text-2xl font-bold text-yellow-700">{stockData.caisses_en_attente.toFixed(0)} caisses</p>
            </div>
          </div>
        </div>

        {/* Gestion des Pénalités */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Pénalités et Remarques</h2>
            <button
              onClick={() => setShowPenaltyForm(!showPenaltyForm)}
              className="flex items-center gap-2 bg-elfirma-gold text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-yellow-500 transition-colors"
            >
              <FileText className="w-4 h-4" />
              {showPenaltyForm ? 'Masquer Formulaire' : 'Ajouter Pénalité'}
            </button>
          </div>

          {showPenaltyForm && (
            <div className="border-t pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Chauffeur</label>
                  <select
                    value={newPenalty.chauffeur_id}
                    onChange={(e) => {
                      const chauffeur = chauffeurs.find(c => c.chauffeur_id === parseInt(e.target.value));
                      setNewPenalty({ 
                        ...newPenalty, 
                        chauffeur_id: parseInt(e.target.value),
                        chauffeur_nom: chauffeur?.chauffeur_nom || ''
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Sélectionner un chauffeur</option>
                    {chauffeurs.map(c => (
                      <option key={c.chauffeur_id} value={c.chauffeur_id}>{c.chauffeur_nom}</option>
                    ))}
                  </select>
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
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Recommandation / Note</label>
                  <textarea
                    value={newPenalty.remarque}
                    onChange={(e) => setNewPenalty({ ...newPenalty, remarque: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={4}
                    placeholder="Format de recommandation:&#10;• Raison de la pénalité (ex: retard, caisses endommagées)&#10;• Actions recommandées (ex: améliorer le suivi, formation)&#10;• Délai de mise en œuvre&#10;• Observations supplémentaires"
                  />
                  <p className="text-xs text-gray-500 mt-1">Utilisez ce champ pour fournir des recommandations détaillées et constructives</p>
                </div>
              </div>
              <button
                onClick={handleAddPenalty}
                className="w-full bg-elfirma-green text-white py-2 rounded-lg font-medium hover:bg-elfirma-darkGreen transition-colors"
              >
                Enregistrer la Pénalité
              </button>
            </div>
          )}

          {penalties.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Pénalités Enregistrées</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Chauffeur</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Caisses Non Retournées</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Coût par Caisse</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Pénalité Totale</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Remarque</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Créé par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {penalties.map((penalty, index) => (
                      <tr key={index} className={`border-b border-gray-100 ${
                        penalty.statut === 'en_attente' ? 'bg-yellow-50' :
                        penalty.statut === 'validee' ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        <td className="py-3 px-4 text-sm">{new Date(penalty.date).toLocaleDateString('fr-TN')}</td>
                        <td className="py-3 px-4 text-sm font-medium">{penalty.chauffeur_nom}</td>
                        <td className="py-3 px-4 text-sm">{penalty.caisses_non_retournees}</td>
                        <td className="py-3 px-4 text-sm">{penalty.cout_par_caisse} TND</td>
                        <td className="py-3 px-4 text-sm font-bold text-red-600">{penalty.penalite_totale} TND</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{penalty.remarque || '-'}</td>
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
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            penalty.cree_par === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {penalty.cree_par === 'admin' ? 'Admin' : 'Comptable'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Récompenses */}
        {showRewards && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Récompenses</h2>
              <button
                onClick={() => setShowRewards(!showRewards)}
                className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                Masquer
              </button>
            </div>

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
                    {rewards.map((reward, index) => (
                      <tr key={index} className={`border-b border-gray-100 ${
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

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Livrables par Chauffeur ({getFilteredAndSortedChauffeurs().length} résultats)</h2>
          
          {getFilteredAndSortedChauffeurs().length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune donnée correspondante aux filtres</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Chauffeur</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Matricule</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Livraisons</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Chargées</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Retournées</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Poids Net (kg)</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Écart</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Fluidité</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredAndSortedChauffeurs().map((chauffeur) => {
                    const ecart = calculerEcartMensuel(chauffeur);
                    const tauxRetour = ((chauffeur.total_caisses_retournees / chauffeur.total_caisses_chargees) * 100).toFixed(2);
                    const poidsNet = (chauffeur.total_caisses_chargees * 0.7).toFixed(2);
                    const fluidite = parseFloat(tauxRetour) >= 95 ? 'Excellent' : parseFloat(tauxRetour) >= 90 ? 'Bon' : 'Faible';
                    const fluiditeColor = parseFloat(tauxRetour) >= 95 ? 'text-green-600' : parseFloat(tauxRetour) >= 90 ? 'text-yellow-600' : 'text-red-600';
                    
                    return (
                      <tr 
                        key={chauffeur.chauffeur_id}
                        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${selectedChauffeur === chauffeur.chauffeur_id ? 'bg-elfirma-lightGold' : ''}`}
                        onClick={() => handleChauffeurSelect(chauffeur.chauffeur_id)}
                      >
                        <td className="py-3 px-4 font-medium">{chauffeur.chauffeur_nom}</td>
                        <td className="py-3 px-4">{chauffeur.matricule}</td>
                        <td className="py-3 px-4">{chauffeur.nb_livraisons}</td>
                        <td className="py-3 px-4">{chauffeur.total_caisses_chargees}</td>
                        <td className="py-3 px-4">{chauffeur.total_caisses_retournees}</td>
                        <td className="py-3 px-4 font-medium">{poidsNet}</td>
                        <td className={`py-3 px-4 font-bold ${ecart > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {ecart} caisses
                        </td>
                        <td className={`py-3 px-4 font-medium ${fluiditeColor}`}>
                          {fluidite}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              imprimerLivrableChauffeur(chauffeur);
                            }}
                            className="flex items-center gap-2 bg-elfirma-gold text-gray-800 px-3 py-1 rounded-lg hover:bg-yellow-500 transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                            Imprimer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedChauffeur && dailyStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Écarts Journaliers - {chauffeurs.find(c => c.chauffeur_id === selectedChauffeur)?.chauffeur_nom}</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Livraisons</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Caisses</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyStats.map((stat, index) => {
                    const ecart = calculerEcartJournalier(stat);
                    return (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">{stat.date}</td>
                        <td className="py-3 px-4">{stat.livraisons}</td>
                        <td className="py-3 px-4">{stat.caisses}</td>
                        <td className={`py-3 px-4 font-bold ${ecart > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {ecart} caisses
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Comparaison avec livrables signés et écarts de stock */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Comparaison avec Livrables Signés et Écarts de Stock</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Écarts de Production</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Production théorique:</span>
                  <span className="font-medium">{(stockData.stock_usine + stockData.stock_exterieur).toFixed(0)} caisses</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Production réelle:</span>
                  <span className="font-medium">{(stockData.stock_usine * 0.95).toFixed(0)} caisses</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Écart production:</span>
                  <span className={`font-bold ${parseFloat((stockData.stock_usine * 0.05).toFixed(0)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    -{(stockData.stock_usine * 0.05).toFixed(0)} caisses
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Écarts de Stock</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Stock attendu:</span>
                  <span className="font-medium">{(stockData.stock_usine + stockData.stock_exterieur).toFixed(0)} caisses</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Stock réel:</span>
                  <span className="font-medium">{stockData.stock_usine.toFixed(0)} caisses</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Écart stock:</span>
                  <span className={`font-bold ${stockData.stock_exterieur > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    -{stockData.stock_exterieur.toFixed(0)} caisses
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-4">Réconciliation des Livrables Signés</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Chauffeur</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Livrables signés</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Caisses déclarées</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Écart</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredAndSortedChauffeurs().map((chauffeur) => {
                    const livrablesSignes = chauffeur.nb_livraisons; // Simulé
                    const ecart = Math.abs(chauffeur.total_caisses_chargees - (livrablesSignes * 50));
                    const statut = ecart <= 5 ? 'Conforme' : ecart <= 10 ? 'À vérifier' : 'Discrepant';
                    return (
                      <tr key={chauffeur.chauffeur_id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{chauffeur.chauffeur_nom}</td>
                        <td className="py-3 px-4">{livrablesSignes}</td>
                        <td className="py-3 px-4">{chauffeur.total_caisses_chargees}</td>
                        <td className={`py-3 px-4 font-bold ${ecart <= 5 ? 'text-green-600' : ecart <= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {ecart} caisses
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            statut === 'Conforme' ? 'bg-green-100 text-green-800' :
                            statut === 'À vérifier' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {statut}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {/* ─── ONGLET FIN DE MOIS ─── */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-green-700" />
              Rapport Fin de Mois — Primes &amp; Sanctions
            </h2>
            <button onClick={fetchRapportFinDeMois}
              disabled={fdmLoading}
              className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50">
              <BarChart3 className="w-4 h-4" />
              {fdmLoading ? 'Chargement…' : `Charger ${MOIS_NOMS[selectedMonth.month]} ${selectedMonth.year}`}
            </button>
          </div>

          {!rapportFinDeMois && !fdmLoading && (
            <p className="text-gray-400 text-sm text-center py-8">
              Cliquez sur «&nbsp;Charger&nbsp;» pour récupérer le rapport fin de mois validé par le Super Admin.
            </p>
          )}

          {fdmLoading && (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {rapportFinDeMois && (
            <>
              {/* Totaux globaux */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Total pénalités</p>
                  <p className="text-2xl font-bold text-red-700">{rapportFinDeMois.totaux.total_penalty} DT</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Total primes</p>
                  <p className="text-2xl font-bold text-green-700">{rapportFinDeMois.totaux.total_prime} DT</p>
                </div>
                <div className={`rounded-xl p-4 ${rapportFinDeMois.totaux.net_global >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-gray-500 mb-1">Net global</p>
                  <p className={`text-2xl font-bold ${rapportFinDeMois.totaux.net_global >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {rapportFinDeMois.totaux.net_global >= 0 ? '+' : ''}{rapportFinDeMois.totaux.net_global} DT
                  </p>
                </div>
              </div>

              {/* Tableau par chauffeur */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Chauffeur</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Matricule</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Départs</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Taux retour</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Pénalités DT</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Primes DT</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700 text-base">Net DT</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Détail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rapportFinDeMois.lignes.map((ligne: any) => (
                      <tr key={ligne.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {ligne.chauffeur_nom} {ligne.prenom}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">{ligne.matricule || '—'}</td>
                        <td className="px-4 py-3 text-center">{ligne.nb_departs || 0}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${
                            parseFloat(ligne.taux_retour) >= 95 ? 'text-green-600'
                            : parseFloat(ligne.taux_retour) >= 90 ? 'text-amber-600'
                            : 'text-red-600'}`}>
                            {ligne.taux_retour}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-red-600">
                          {ligne.total_penalty > 0 ? `−${ligne.total_penalty} DT` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-green-600">
                          {ligne.total_prime > 0 ? `+${ligne.total_prime} DT` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className={`px-4 py-3 text-center font-bold text-base ${ligne.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {ligne.net >= 0 ? '+' : ''}{ligne.net} DT
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {ligne.penalties?.map((p: any) => (
                              <span key={p.id} className="flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded">
                                <TrendingDown className="w-3 h-3" /> {p.remarque || `${p.caisses_non_retournees} caisses`}
                                <span className={`ml-1 px-1 rounded text-xs ${p.statut==='validee'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                                  {p.statut}
                                </span>
                              </span>
                            ))}
                            {ligne.rewards?.map((r: any) => (
                              <span key={r.id} className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                                <TrendingUp className="w-3 h-3" /> {r.motif}
                                <span className={`ml-1 px-1 rounded text-xs ${r.statut==='VALIDEE'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>
                                  {r.statut}
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Barème appliqué */}
              <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 flex flex-wrap gap-4">
                <span>📋 <strong>Barème appliqué :</strong></span>
                <span>Sanction : {rapportFinDeMois.bareme?.cout_par_caisse_perdue} DT/caisse perdue</span>
                <span>Tolérance : {rapportFinDeMois.bareme?.seuil_tolerance_caisses} caisses</span>
                <span>Prime 100% : {rapportFinDeMois.bareme?.prime_taux_retour_100} DT</span>
                <span>Prime ≥95% : {rapportFinDeMois.bareme?.prime_taux_retour_95} DT</span>
                <span>Prime ≥90% : {rapportFinDeMois.bareme?.prime_taux_retour_90} DT</span>
              </div>
            </>
          )}
        </div>

      </main>
    </div>
  );
}
