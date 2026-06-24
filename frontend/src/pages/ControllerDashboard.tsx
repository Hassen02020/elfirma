import { useState, useEffect } from 'react';
import API_BASE from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, LogOut, Package, AlertTriangle, Calendar, TrendingUp, TrendingDown, Truck, Sun, Moon, Scale, MapPin, ClipboardList, Users, BarChart3, RefreshCw, Bell, Thermometer, Box, Download, Printer } from 'lucide-react';
import AlerteBanner from '../components/AlerteBanner';
import AlertesPeseePanel from '../components/AlertesPeseePanel';
import { useAlertes } from '../hooks/useAlertes';
import { useStockVolaille } from '../hooks/useStockVolaille';

interface Delivery {
  id: number;
  camion_id: number;
  chauffeur_id: number;
  poids_vide: number;
  poids_charge: number;
  nb_caisses_chargees: number;
  nb_caisses_retournees: number;
  statut: string;
  date: string;
  matricule: string;
  chauffeur_nom: string;
  validee: boolean;
  type: 'depart' | 'retour';
}

interface StockStats {
  stock_usine: number;
  stock_exterieur: number;
  stock_par_chauffeur: Array<{
    id: number;
    nom: string;
    nb_caisses: number;
  }>;
}

interface HistoPerf {
  annee: number;
  mois: number;
  nb_departs: number;
  total_chargees: number;
  total_retournees: number;
  taux_retour: number;
  caisses_ecart: number;
}

interface StockAudit {
  stock_initial: number;
  stock_reel: number;
  stock_fictif: number;
  caisses_cassees: number;
  caisses_perimees: number;
  date_audit: string;
  ecart: number;
}

interface LigneTournee {
  client_nom: string; telephone: string; adresse: string;
  nb_caisses: number; poids_kg: number; note: string; livre: boolean;
}
interface Tournee {
  id: number; date_tournee: string; statut: string;
  chauffeur_nom: string; camion_matricule: string; secteur_nom: string;
  produit_nom: string; agent_nom: string; agent_prenom: string;
  poids_cible: number; nb_caisses_total: number;
  lignes?: LigneTournee[];
}


export default function ControllerDashboard() {
  const { logout, agent } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const [type, setType] = useState<'depart' | 'retour'>('depart');
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [stock, setStock] = useState<StockStats>({ stock_usine: 0, stock_exterieur: 0, stock_par_chauffeur: [] });
  const [stockAudit, setStockAudit] = useState<StockAudit>({
    stock_initial: 0,
    stock_reel: 0,
    stock_fictif: 0,
    caisses_cassees: 0,
    caisses_perimees: 0,
    date_audit: new Date().toISOString().split('T')[0],
    ecart: 0
  });
  const [showStockAudit, setShowStockAudit] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [histoPerf, setHistoPerf] = useState<HistoPerf[]>([]);
  const [histoChauffeurId, setHistoChauffeurId] = useState<string>('');
  const [histoLoading, setHistoLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState({ year: 2026, month: 6 });
  const [onglet, setOnglet] = useState<'livraisons'|'tournees'|'stock'|'validation'|'agents'|'performances'|'alertes'|'stock-ctrl'|'rapport'>('livraisons');
  const [rapportMode, setRapportMode] = useState<'jour'|'mois'|'plage'>('jour');
  const [rapportDate, setRapportDate] = useState(new Date().toISOString().split('T')[0]);
  const [rapportMois, setRapportMois] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [rapportPlage, setRapportPlage] = useState({ debut: new Date().toISOString().split('T')[0], fin: new Date().toISOString().split('T')[0] });
  const [rapportData, setRapportData] = useState<Delivery[]>([]);
  const [rapportLoading, setRapportLoading] = useState(false);

  const { alertes, nbAlertes, refetch: refetchAlertes } = useAlertes();
  const { stockJour: stockCtrl, compteurs: compteursCtrl, loading: stockCtrlLoading, refetch: refetchStockCtrl } = useStockVolaille();
  const [tournees, setTournees] = useState<Tournee[]>([]);

  type AgentInfo = { id: number; nom: string; prenom: string; role: string; poste_nom?: string; poste_type?: string; code_agent?: string };
  const [agentsPesee, setAgentsPesee] = useState<AgentInfo[]>([]);
  const [agentsLogistique, setAgentsLogistique] = useState<AgentInfo[]>([]);
  const [filters, setFilters] = useState({
    date: '',
    camion: '',
    chauffeur: '',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  useEffect(() => {
    fetchDeliveries();
    fetchStock();
    fetchTournees();
    fetchAgents();
  }, [view, selectedDate, selectedMonth, type]);

  const fetchAgents = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/agent`);
      const data = await r.json();
      const list: AgentInfo[] = Array.isArray(data) ? data : [];
      setAgentsPesee(list.filter((a: AgentInfo) => a.role === 'agent' || a.role === 'pesee'));
      setAgentsLogistique(list.filter((a: AgentInfo) => a.role === 'logistique'));
    } catch {
      // Mock si backend indispo
      setAgentsPesee([
        { id: 1, nom: 'Ben Salem', prenom: 'Karim', role: 'agent', poste_nom: 'Bascule Matin', poste_type: 'JOUR', code_agent: '1111' },
        { id: 2, nom: 'Gharbi', prenom: 'Sonia', role: 'agent', poste_nom: 'Bascule Nuit', poste_type: 'NUIT', code_agent: '2222' },
      ]);
      setAgentsLogistique([
        { id: 3, nom: 'Rekik', prenom: 'Ali', role: 'logistique', poste_nom: 'Logistique', poste_type: 'JOUR', code_agent: '4444' },
      ]);
    }
  };

  const fetchTournees = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/tournee`);
      const data = await r.json();
      setTournees(Array.isArray(data) ? data : []);
    } catch { setTournees([]); }
  };

  const fetchDeliveries = async () => {
    try {
      if (view === 'daily') {
        const response = await fetch(`${API_BASE}/api/delivery/today`);
        const data = await response.json();
        // Ajouter un champ validee et type pour la simulation
        // Tous les livrables sont maintenant automatiquement validés après impression
        // Utiliser le champ type réel de l'API, pas un index arbitraire
        const filtered = data.filter((d: Delivery) => !type || d.type === type);
        setDeliveries(filtered);
      } else {
        const response = await fetch(
          `${API_BASE}/api/delivery/month/${selectedMonth.year}/${selectedMonth.month}`
        );
        const data = await response.json();
        const filtered = data.filter((d: Delivery) => !type || d.type === type);
        setDeliveries(filtered);
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
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

  const getFilteredAndSortedDeliveries = () => {
    let filtered = [...deliveries];
    
    // Filtrer par date
    if (filters.date) {
      filtered = filtered.filter((d: Delivery) => {
        const deliveryDate = new Date(d.date).toISOString().split('T')[0];
        return deliveryDate === filters.date;
      });
    }
    
    // Filtrer par camion
    if (filters.camion) {
      filtered = filtered.filter((d: Delivery) => d.matricule === filters.camion);
    }
    
    // Filtrer par chauffeur
    if (filters.chauffeur) {
      filtered = filtered.filter((d: Delivery) => d.chauffeur_nom === filters.chauffeur);
    }
    
    // Trier
    filtered.sort((a: Delivery, b: Delivery) => {
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

  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<'validate' | 'reject' | null>(null);
  const [pinCode, setPinCode] = useState('');
  const [pinError, setPinError] = useState('');

  const validerLivraison = async (deliveryId: number) => {
    setSelectedDeliveryId(deliveryId);
    setActionType('validate');
    setShowPinModal(true);
    setPinCode('');
    setPinError('');
  };

  const rejeterLivraison = async (deliveryId: number) => {
    setSelectedDeliveryId(deliveryId);
    setActionType('reject');
    setShowPinModal(true);
    setPinCode('');
    setPinError('');
  };

  const confirmAction = async () => {
    // Vérifier le code PIN via l'API (supporte tous les contrôleurs Jour et Nuit)
    try {
      const res = await fetch(`${API_BASE}/api/poste/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_agent: pinCode, role: 'controleur' }),
      });
      if (!res.ok) {
        const err = await res.json();
        setPinError(err.error || 'Code PIN incorrect');
        return;
      }
    } catch {
      // Fallback: vérifier localement avec codes connus
      const CODES_CONTROLEUR = ['1133', '2233'];
      if (!CODES_CONTROLEUR.includes(pinCode)) {
        setPinError('Code PIN contrôleur invalide');
        return;
      }
    }

    if (selectedDeliveryId === null) return;

    try {
      if (actionType === 'validate') {
        setDeliveries(deliveries.map(d => 
          d.id === selectedDeliveryId ? { ...d, validee: true, statut: 'validee' } : d
        ));
      } else if (actionType === 'reject') {
        setDeliveries(deliveries.map(d => 
          d.id === selectedDeliveryId ? { ...d, validee: false, statut: 'rejetee' } : d
        ));
      }
      setShowPinModal(false);
      setPinCode('');
      setPinError('');
    } catch (error) {
      console.error('Error processing action:', error);
      setPinError('Erreur lors du traitement');
    }
  };

  const cancelAction = () => {
    setShowPinModal(false);
    setPinCode('');
    setPinError('');
    setSelectedDeliveryId(null);
    setActionType(null);
  };

  const calculerStatistiques = () => {
    const totalLivraisons = deliveries.length;
    const livraisonsValidees = deliveries.filter(d => d.validee).length;
    const totalCaissesChargees = deliveries.reduce((sum, d) => sum + d.nb_caisses_chargees, 0);
    const totalCaissesRetournees = deliveries.reduce((sum, d) => sum + d.nb_caisses_retournees, 0);
    const ecartTotal = totalCaissesChargees - totalCaissesRetournees;

    return {
      totalLivraisons,
      livraisonsValidees,
      tauxValidation: totalLivraisons > 0 ? ((livraisonsValidees / totalLivraisons) * 100).toFixed(1) : '0',
      totalCaissesChargees,
      totalCaissesRetournees,
      ecartTotal
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

  const stats = calculerStatistiques();
  const MOIS = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  const chargerRapport = async () => {
    setRapportLoading(true);
    try {
      let data: Delivery[] = [];
      if (rapportMode === 'jour') {
        const r = await fetch(`${API_BASE}/api/delivery/today`);
        const all = await r.json();
        data = Array.isArray(all) ? all.filter((d: any) => (d.date||'').startsWith(rapportDate)) : [];
      } else if (rapportMode === 'mois') {
        const r = await fetch(`${API_BASE}/api/delivery/month/${rapportMois.year}/${rapportMois.month}`);
        data = await r.json();
      } else {
        const r = await fetch(`${API_BASE}/api/delivery/month/${rapportMois.year}/${rapportMois.month}`);
        const all = await r.json();
        data = Array.isArray(all) ? all.filter((d: any) => {
          const dd = (d.date||'').split('T')[0];
          return dd >= rapportPlage.debut && dd <= rapportPlage.fin;
        }) : [];
      }
      setRapportData(Array.isArray(data) ? data : []);
    } catch { setRapportData([]); }
    setRapportLoading(false);
  };

  const exportRapportExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const rows = rapportData.map(d => ({
      'Date': d.date ? new Date(d.date).toLocaleDateString('fr-TN') : '',
      'Heure': d.date ? new Date(d.date).toLocaleTimeString('fr-TN',{hour:'2-digit',minute:'2-digit'}) : '',
      'Matricule': d.matricule || '',
      'Chauffeur': d.chauffeur_nom || '',
      'Type': d.type === 'depart' ? 'Départ' : 'Retour',
      'Caisses chargées': d.nb_caisses_chargees ?? 0,
      'Caisses retournées': d.nb_caisses_retournees ?? 0,
      'Écart caisses': Math.max(0,(d.nb_caisses_chargees??0)-(d.nb_caisses_retournees??0)),
      'Poids vide (kg)': d.poids_vide ?? 0,
      'Poids chargé (kg)': d.poids_charge ?? 0,
      'Poids net (kg)': ((d.poids_charge??0)-(d.poids_vide??0)).toFixed(2),
      'Statut': d.validee ? 'Validée' : 'En attente',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [10,8,14,20,8,14,16,14,14,16,12,12].map(w=>({wch:w}));
    const periode = rapportMode==='jour' ? rapportDate
      : rapportMode==='mois' ? `${MOIS[rapportMois.month]}_${rapportMois.year}`
      : `${rapportPlage.debut}_au_${rapportPlage.fin}`;
    XLSX.utils.book_append_sheet(wb, ws, 'Livraisons');
    // Feuille synthèse
    const nbDep = rapportData.filter(d=>d.type==='depart').length;
    const nbRet = rapportData.filter(d=>d.type==='retour').length;
    const totCh = rapportData.reduce((s,d)=>s+(d.nb_caisses_chargees??0),0);
    const totRet= rapportData.reduce((s,d)=>s+(d.nb_caisses_retournees??0),0);
    const totPn = rapportData.reduce((s,d)=>s+((d.poids_charge??0)-(d.poids_vide??0)),0);
    const ws2 = XLSX.utils.json_to_sheet([
      {'Indicateur':'Période','Valeur':periode},
      {'Indicateur':'Total livraisons','Valeur':rapportData.length},
      {'Indicateur':'Départs','Valeur':nbDep},
      {'Indicateur':'Retours','Valeur':nbRet},
      {'Indicateur':'Caisses chargées','Valeur':totCh},
      {'Indicateur':'Caisses retournées','Valeur':totRet},
      {'Indicateur':'Écart caisses','Valeur':Math.max(0,totCh-totRet)},
      {'Indicateur':'Poids net total (kg)','Valeur':totPn.toFixed(2)},
    ]);
    ws2['!cols']=[{wch:26},{wch:20}];
    XLSX.utils.book_append_sheet(wb, ws2, 'Synthèse');
    XLSX.writeFile(wb, `rapport_controleur_${periode}.xlsx`);
  };

  const imprimerRapport = () => {
    const _nbDep  = rapportData.filter(d=>d.type==='depart').length;
    const _nbRet  = rapportData.filter(d=>d.type==='retour').length;
    const totCh  = rapportData.reduce((s,d)=>s+(d.nb_caisses_chargees??0),0);
    const totRet = rapportData.reduce((s,d)=>s+(d.nb_caisses_retournees??0),0);
    const totPn  = rapportData.reduce((s,d)=>s+((d.poids_charge??0)-(d.poids_vide??0)),0);
    const ecart  = Math.max(0,totCh-totRet);
    const periode = rapportMode==='jour' ? `Jour du ${rapportDate}`
      : rapportMode==='mois' ? `${MOIS[rapportMois.month]} ${rapportMois.year}`
      : `Du ${rapportPlage.debut} au ${rapportPlage.fin}`;
    const lignes = rapportData.map(d=>{
      const e=Math.max(0,(d.nb_caisses_chargees??0)-(d.nb_caisses_retournees??0));
      return `<tr>
        <td>${d.date?new Date(d.date).toLocaleDateString('fr-TN'):'—'}</td>
        <td>${d.matricule||'—'}</td>
        <td>${d.chauffeur_nom||'—'}</td>
        <td style="text-align:center">${d.type==='depart'?'Départ':'Retour'}</td>
        <td style="text-align:center">${d.nb_caisses_chargees??0}</td>
        <td style="text-align:center">${d.nb_caisses_retournees??0}</td>
        <td style="text-align:center;color:${e>0?'#c62828':'#1b5e20'}">${e>0?'-'+e:'✓'}</td>
        <td style="text-align:center">${((d.poids_charge??0)-(d.poids_vide??0)).toFixed(1)}</td>
        <td style="text-align:center">${d.validee?'Validée':'En attente'}</td>
      </tr>`;
    }).join('');
    const w=window.open('','_blank');
    if(!w)return;
    w.document.write(`<html><head><title>Rapport EL FIRMA</title><style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
      h1{color:#1b5e20;border-bottom:3px solid #1b5e20;padding-bottom:8px}
      .meta{color:#555;margin-bottom:12px;font-size:11px}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
      .kpi{border:1px solid #e0e0e0;border-radius:8px;padding:10px;text-align:center}
      .kpi-val{font-size:22px;font-weight:bold;color:#1b5e20}
      .kpi-lbl{font-size:10px;color:#888}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#1b5e20;color:#fff;padding:6px 8px;text-align:left}
      td{border-bottom:1px solid #eee;padding:5px 8px}
      tr:nth-child(even){background:#f9f9f9}
      .footer{margin-top:20px;font-size:10px;color:#aaa;text-align:center}
    </style></head><body>
      <h1>📊 Rapport de livraisons — EL FIRMA</h1>
      <div class="meta">Période : <b>${periode}</b> &nbsp;|&nbsp; Généré le ${new Date().toLocaleString('fr-TN')} &nbsp;|&nbsp; Contrôleur : ${agent?.nom||''} ${agent?.prenom||''}</div>
      <div class="kpis">
        <div class="kpi"><div class="kpi-val">${rapportData.length}</div><div class="kpi-lbl">Total livraisons</div></div>
        <div class="kpi"><div class="kpi-val">${totCh}</div><div class="kpi-lbl">Caisses chargées</div></div>
        <div class="kpi"><div class="kpi-val" style="color:${ecart>0?'#c62828':'#1b5e20'}">${ecart}</div><div class="kpi-lbl">Écart caisses</div></div>
        <div class="kpi"><div class="kpi-val">${totPn.toFixed(0)} kg</div><div class="kpi-lbl">Poids net total</div></div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Camion</th><th>Chauffeur</th><th>Type</th><th>Caisses Ch.</th><th>Caisses Ret.</th><th>Écart</th><th>Poids net</th><th>Statut</th></tr></thead>
        <tbody>${lignes}</tbody>
      </table>
      <div class="footer">EL FIRMA — Rapport généré automatiquement</div>
    </body></html>`);
    w.document.close();
    setTimeout(()=>w.print(),400);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-elfirma-green text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="EL FIRMA" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold">EL FIRMA</h1>
              <p className="text-sm opacity-90">Contrôleur - Validation des Livraisons</p>
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

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* Panneau alertes de pesée — visible pour les contrôleurs */}
        <AlertesPeseePanel />

        {/* Bannière alertes temps réel — visible sur tous les onglets */}
        {alertes.length > 0 && (
          <div className="mb-5">
            <AlerteBanner
              alertes={alertes}
              role="controleur"
              agentId={agent?.id}
              onDebloquer={async (_alerteId, livraisonId, type, motif, ajustement) => {
                try {
                  if (type === 'ECART_POIDS_CHARGEMENT') {
                    await fetch(`${API_BASE}/api/validation/debloquer-chargement/${livraisonId}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ agent_id: agent?.id ?? 0, motif }),
                    });
                  } else {
                    await fetch(`${API_BASE}/api/validation/clore-litige/${livraisonId}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ agent_id: agent?.id ?? 0, motif, ajustement_caisses: ajustement ?? 0, type_cloture: 'LITIGE_RESOLU' }),
                    });
                  }
                  refetchAlertes();
                } catch { refetchAlertes(); }
              }}
              onDismiss={() => { refetchAlertes(); }}
            />
          </div>
        )}

        {/* KPIs globaux */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Livraisons', val: stats.totalLivraisons, sub: `${stats.livraisonsValidees} validées`, icon: <Truck className="w-6 h-6 text-blue-500"/>, color: 'blue' },
            { label: 'Caisses chargées', val: stats.totalCaissesChargees, sub: 'total', icon: <Package className="w-6 h-6 text-green-500"/>, color: 'green' },
            { label: 'Caisses retournées', val: stats.totalCaissesRetournees, sub: 'total', icon: <Package className="w-6 h-6 text-purple-500"/>, color: 'purple' },
            { label: 'Écart caisses', val: stats.ecartTotal, sub: 'manquantes', icon: <AlertTriangle className="w-6 h-6 text-orange-500"/>, color: stats.ecartTotal > 0 ? 'red' : 'green' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-200">
              <div className="flex justify-between items-start mb-2">{k.icon}<span className="text-xs text-gray-400">{k.label}</span></div>
              <p className={`text-2xl font-bold ${k.color === 'red' ? 'text-red-600' : k.color === 'green' && k.label==='Écart caisses' ? 'text-green-600' : 'text-gray-800'}`}>{k.val}</p>
              <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Onglets navigation */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl shadow-sm p-1.5 w-fit flex-wrap">
          {[
            { id: 'livraisons', label: 'Livraisons', icon: <Truck className="w-4 h-4"/> },
            { id: 'tournees',   label: 'Tournées',   icon: <ClipboardList className="w-4 h-4"/> },
            { id: 'stock',      label: 'Stock & Audit', icon: <Scale className="w-4 h-4"/> },
            { id: 'validation', label: 'Validation', icon: <CheckCircle className="w-4 h-4"/> },
            { id: 'agents',      label: 'Agents',      icon: <Users className="w-4 h-4"/> },
            { id: 'performances', label: 'Performances', icon: <BarChart3 className="w-4 h-4"/> },
            { id: 'alertes',      label: nbAlertes > 0 ? `Alertes (${nbAlertes})` : 'Alertes', icon: <Bell className={`w-4 h-4 ${nbAlertes > 0 ? 'text-red-500 animate-pulse' : ''}`}/> },
            { id: 'stock-ctrl',   label: 'Stock Volaille', icon: <Thermometer className="w-4 h-4"/> },
            { id: 'rapport',      label: 'Rapport', icon: <Download className="w-4 h-4"/> },
          ].map(t => (
            <button key={t.id} onClick={() => setOnglet(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                onglet === t.id ? 'bg-elfirma-green text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ═══ ONGLET LIVRAISONS ═══ */}
        {onglet === 'livraisons' && (
          <div className="space-y-4">
            {/* Filtres */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Vue</p>
                  <div className="flex gap-1">
                    {(['daily','monthly'] as const).map(v => (
                      <button key={v} onClick={() => setView(v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view===v?'bg-elfirma-green text-white':'bg-gray-100 text-gray-600'}`}>
                        {v==='daily'?<><Calendar className="w-3 h-3 inline mr-1"/>Jour</>:<><TrendingUp className="w-3 h-3 inline mr-1"/>Mois</>}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Type</p>
                  <div className="flex gap-1">
                    {(['depart','retour'] as const).map(t => (
                      <button key={t} onClick={() => setType(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${type===t?'bg-amber-400 text-amber-900':'bg-gray-100 text-gray-600'}`}>
                        {t==='depart'?'🚛 Départ':'🔄 Retour'}
                      </button>
                    ))}
                  </div>
                </div>
                {view === 'daily' ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Date</p>
                    <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"/>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">Mois</p>
                      <select value={selectedMonth.month} onChange={e=>setSelectedMonth({...selectedMonth,month:parseInt(e.target.value)})}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                        {MOIS.slice(1).map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">Année</p>
                      <select value={selectedMonth.year} onChange={e=>setSelectedMonth({...selectedMonth,year:parseInt(e.target.value)})}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                        {[2025,2026,2027].map(y=><option key={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <input type="text" placeholder="Filtrer chauffeur..." value={filters.chauffeur}
                  onChange={e=>setFilters({...filters,chauffeur:e.target.value})}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"/>
                <button onClick={()=>setFilters({date:'',camion:'',chauffeur:'',sortBy:'date',sortOrder:'desc'})}
                  className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">
                  Réinitialiser
                </button>
              </div>
            </div>

            {/* Table livraisons enrichie */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Livraisons — {getFilteredAndSortedDeliveries().length} résultats</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      {['Date/Heure','Camion','Chauffeur','Secteur','Produit','Caisses ch/ret','Poids net kg','Écart','Statut','Action'].map(h=>(
                        <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredAndSortedDeliveries().length === 0 ? (
                      <tr><td colSpan={10} className="text-center py-10 text-gray-400">Aucune livraison</td></tr>
                    ) : getFilteredAndSortedDeliveries().map(d => {
                      const ecart = d.nb_caisses_chargees - d.nb_caisses_retournees;
                      const poidsNet = (d.poids_charge - d.poids_vide).toFixed(1);
                      return (
                        <tr key={d.id} className={`border-t border-gray-50 hover:bg-gray-50 ${
                          d.statut==='validee'?'bg-green-50':d.statut==='rejetee'?'bg-red-50':''}`}>
                          <td className="px-4 py-3 text-xs text-gray-500">{new Date(d.date).toLocaleString('fr-TN')}</td>
                          <td className="px-4 py-3 font-mono font-medium">{d.matricule}</td>
                          <td className="px-4 py-3 font-medium">{d.chauffeur_nom}</td>
                          <td className="px-4 py-3 text-gray-500">{(d as any).secteur_nom || '—'}</td>
                          <td className="px-4 py-3 text-gray-500">{(d as any).produit_nom || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-elfirma-green">{d.nb_caisses_chargees}</span>
                            <span className="text-gray-400 mx-1">/</span>
                            <span className="font-bold text-blue-600">{d.nb_caisses_retournees}</span>
                          </td>
                          <td className="px-4 py-3 font-medium">{poidsNet}</td>
                          <td className={`px-4 py-3 font-bold ${ecart>0?'text-red-600':'text-green-600'}`}>{ecart>0?`−${ecart}`:'✓'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              d.statut==='validee'?'bg-green-100 text-green-800':
                              d.statut==='rejetee'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800'}`}>
                              {d.statut==='validee'?'✓ Validée':d.statut==='rejetee'?'✗ Rejetée':'⏳ Attente'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {d.statut!=='validee'&&d.statut!=='rejetee'&&(
                              <div className="flex gap-1">
                                <button onClick={()=>validerLivraison(d.id)}
                                  className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600">
                                  <CheckCircle className="w-3 h-3"/>Valider
                                </button>
                                <button onClick={()=>rejeterLivraison(d.id)}
                                  className="flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600">
                                  <XCircle className="w-3 h-3"/>Rejeter
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ONGLET TOURNÉES ═══ */}
        {onglet === 'tournees' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-elfirma-green"/>
                Tournées planifiées par l'agent logistique — {tournees.length} aujourd'hui
              </h3>
              {tournees.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Aucune tournée planifiée aujourd'hui</p>
              ) : (
                <div className="space-y-3">
                  {tournees.map(t => (
                    <div key={t.id} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gradient-to-r from-elfirma-green/10 to-green-50 px-4 py-3 flex justify-between items-center">
                        <div className="flex gap-6">
                          <div>
                            <p className="text-xs text-gray-500">Chauffeur</p>
                            <p className="font-bold text-gray-800">{t.chauffeur_nom||'—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Camion</p>
                            <p className="font-medium text-gray-700">{t.camion_matricule||'—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Secteur</p>
                            <p className="font-medium text-gray-700 flex items-center gap-1"><MapPin className="w-3 h-3 text-red-400"/>{t.secteur_nom||'—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Produit</p>
                            <p className="font-medium text-gray-700">{t.produit_nom||'—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Agent logistique</p>
                            <p className="font-medium text-gray-700">{t.agent_nom||'—'} {t.agent_prenom||''}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-elfirma-green">{t.nb_caisses_total} <span className="text-sm font-normal">caisses</span></p>
                          <p className="text-sm text-orange-600 font-medium">{t.poids_cible?.toFixed(0)} kg cible</p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            t.statut==='planifiee'?'bg-amber-100 text-amber-800':
                            t.statut==='en_cours'?'bg-blue-100 text-blue-800':'bg-green-100 text-green-800'}`}>
                            {t.statut==='planifiee'?'⏳ Planifiée':t.statut==='en_cours'?'🔄 En cours':'✅ Terminée'}
                          </span>
                        </div>
                      </div>
                      {(t.lignes||[]).filter(l=>l.nb_caisses>0).length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                {['Client','📞 Téléphone','📍 Adresse','Caisses','Poids kg','Note'].map(h=>(
                                  <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(t.lignes||[]).filter(l=>l.nb_caisses>0).map((l,i)=>(
                                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                                  <td className="px-3 py-2 font-medium">{l.client_nom}</td>
                                  <td className="px-3 py-2 text-blue-600">{l.telephone||'—'}</td>
                                  <td className="px-3 py-2 text-gray-500">{l.adresse||'—'}</td>
                                  <td className="px-3 py-2 font-bold text-elfirma-green">{l.nb_caisses}</td>
                                  <td className="px-3 py-2">{l.poids_kg?.toFixed(1)} kg</td>
                                  <td className="px-3 py-2 text-gray-400">{l.note||'—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ ONGLET STOCK & AUDIT ═══ */}
        {onglet === 'stock' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
                <p className="text-sm text-gray-500 mb-1">Stock usine</p>
                <p className="text-4xl font-bold text-green-700">{stock.stock_usine}</p>
                <p className="text-sm text-gray-400 mt-1">caisses disponibles</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
                <p className="text-sm text-gray-500 mb-1">Stock extérieur</p>
                <p className="text-4xl font-bold text-blue-700">{stock.stock_exterieur}</p>
                <p className="text-sm text-gray-400 mt-1">caisses en circulation</p>
              </div>
            </div>

            {stock.stock_par_chauffeur.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-bold text-gray-800 mb-3">Stock par chauffeur</h3>
                <div className="grid grid-cols-3 gap-3">
                  {stock.stock_par_chauffeur.map(c=>(
                    <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-800">{c.nom}</p>
                      <p className="text-xl font-bold text-gray-700">{c.nb_caisses} caisses</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-amber-500"/> Audit du stock réel
                </h3>
                <button onClick={()=>setShowStockAudit(!showStockAudit)}
                  className="text-xs px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg font-medium hover:bg-amber-200">
                  {showStockAudit?'Masquer':'Ouvrir audit'}
                </button>
              </div>
              {showStockAudit && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      {label:'Stock compté (pointage)',key:'stock_initial'},
                      {label:'Stock fictif',key:'stock_fictif'},
                      {label:'Caisses cassées',key:'caisses_cassees'},
                      {label:'Caisses périmées',key:'caisses_perimees'},
                    ].map(f=>(
                      <div key={f.key}>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">{f.label}</label>
                        <input type="number" value={(stockAudit as any)[f.key]}
                          onChange={e=>setStockAudit({...stockAudit,[f.key]:parseInt(e.target.value)||0})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                      </div>
                    ))}
                  </div>
                  <input type="date" value={stockAudit.date_audit}
                    onChange={e=>setStockAudit({...stockAudit,date_audit:e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                  <button onClick={handleStockAuditSubmit}
                    className="w-full bg-elfirma-green text-white py-2.5 rounded-lg font-bold hover:bg-elfirma-darkGreen">
                    Calculer l'écart
                  </button>
                  {stockAudit.stock_reel > 0 && (
                    <div className="grid grid-cols-4 gap-3 mt-2">
                      {[
                        {label:'Théorique',val:stock.stock_usine+stock.stock_exterieur,color:'purple'},
                        {label:'Réel calculé',val:stockAudit.stock_reel,color:'orange'},
                        {label:'Fictif',val:stockAudit.stock_fictif,color:'indigo'},
                        {label:'Écart',val:stockAudit.ecart,color:stockAudit.ecart===0?'green':'red'},
                      ].map(b=>(
                        <div key={b.label} className={`bg-${b.color}-50 rounded-lg p-3 text-center`}>
                          <p className="text-xs text-gray-500 mb-1">{b.label}</p>
                          <p className={`text-xl font-bold text-${b.color}-700`}>{b.val}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ ONGLET VALIDATION ═══ */}
        {onglet === 'validation' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
              <h3 className="font-bold text-amber-800">⚡ Validation rapide — livraisons en attente</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    {['Date','Camion','Chauffeur','Caisses','Poids net','Écart','Action'].map(h=>(
                      <th key={h} className="px-4 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deliveries.filter(d=>d.statut!=='validee'&&d.statut!=='rejetee').length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400">
                      <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-2"/>
                      Toutes les livraisons sont validées !
                    </td></tr>
                  ) : deliveries.filter(d=>d.statut!=='validee'&&d.statut!=='rejetee').map(d=>{
                    const ecart = d.nb_caisses_chargees - d.nb_caisses_retournees;
                    return (
                      <tr key={d.id} className="border-t border-gray-100 bg-amber-50/50">
                        <td className="px-4 py-3 text-xs">{new Date(d.date).toLocaleString('fr-TN')}</td>
                        <td className="px-4 py-3 font-mono">{d.matricule}</td>
                        <td className="px-4 py-3 font-medium">{d.chauffeur_nom}</td>
                        <td className="px-4 py-3"><span className="font-bold">{d.nb_caisses_chargees}</span>/{d.nb_caisses_retournees}</td>
                        <td className="px-4 py-3">{(d.poids_charge-d.poids_vide).toFixed(1)} kg</td>
                        <td className={`px-4 py-3 font-bold ${ecart>0?'text-red-600':'text-green-600'}`}>{ecart>0?`−${ecart}`:'✓'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={()=>validerLivraison(d.id)}
                              className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-600">
                              <CheckCircle className="w-3.5 h-3.5"/>Valider
                            </button>
                            <button onClick={()=>rejeterLivraison(d.id)}
                              className="flex items-center gap-1 bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600">
                              <XCircle className="w-3.5 h-3.5"/>Rejeter
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ ONGLET AGENTS ═══ */}
        {onglet === 'agents' && (
          <div className="space-y-6">

            {/* En-tête récapitulatif */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-xl p-5 flex items-center gap-4">
                <div className="bg-amber-500 text-white rounded-full w-12 h-12 flex items-center justify-center">
                  <Scale className="w-6 h-6"/>
                </div>
                <div>
                  <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Agents Pesée (Bascule)</p>
                  <p className="text-3xl font-bold text-amber-900">{agentsPesee.length}</p>
                  <p className="text-xs text-amber-600">agent{agentsPesee.length>1?'s':''} enregistré{agentsPesee.length>1?'s':''}</p>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-5 flex items-center gap-4">
                <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6"/>
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Agents Logistique</p>
                  <p className="text-3xl font-bold text-blue-900">{agentsLogistique.length}</p>
                  <p className="text-xs text-blue-600">agent{agentsLogistique.length>1?'s':''} enregistré{agentsLogistique.length>1?'s':''}</p>
                </div>
              </div>
            </div>

            {/* Panneau Agents Pesée */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-amber-100">
              <div className="bg-amber-500 text-white px-5 py-3 flex items-center gap-2">
                <Scale className="w-5 h-5"/>
                <h3 className="font-bold">Agents Pesée — Bascule</h3>
              </div>
              {agentsPesee.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">Aucun agent pesée enregistré</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {agentsPesee.map(a => {
                    return (
                      <div key={a.id} className="px-5 py-4 flex items-start gap-4 hover:bg-amber-50/40 transition-colors">
                        <div className="bg-amber-100 text-amber-800 rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {a.nom.charAt(0)}{a.prenom?.charAt(0)||''}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-800">{a.nom} {a.prenom}</p>
                            {a.poste_type && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                a.poste_type === 'JOUR' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                              }`}>
                                {a.poste_type === 'JOUR' ? '☀️ Jour' : '🌙 Nuit'}
                              </span>
                            )}
                            {a.poste_nom && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.poste_nom}</span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                            {a.code_agent && <span>Code : <b className="text-gray-700">{a.code_agent}</b></span>}
                            <span>Rôle : <b className="text-amber-700">Pesée / Bascule</b></span>
                          </div>
                          {/* Livraisons du jour enregistrées par cet agent */}
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-500 mb-1">Livraisons enregistrées aujourd'hui</p>
                            {deliveries.filter(d => d.date?.startsWith(selectedDate)).length === 0 ? (
                              <p className="text-xs text-gray-400 italic">Aucune livraison ce jour</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {deliveries.filter(d => d.date?.startsWith(selectedDate)).slice(0, 5).map(d => (
                                  <span key={d.id} className="text-xs bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                                    {d.matricule} — {d.type === 'depart' ? '🚛 Départ' : '🔙 Retour'} — {d.nb_caisses_chargees} caisses
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Panneau Agents Logistique */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-blue-100">
              <div className="bg-blue-600 text-white px-5 py-3 flex items-center gap-2">
                <ClipboardList className="w-5 h-5"/>
                <h3 className="font-bold">Agents Logistique — Affectation tournées</h3>
              </div>
              {agentsLogistique.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">Aucun agent logistique enregistré</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {agentsLogistique.map(a => {
                    const tourneesAgent = tournees.filter(t =>
                      (t.agent_nom === a.nom || `${t.agent_nom} ${t.agent_prenom}`.trim() === `${a.nom} ${a.prenom}`.trim())
                      && t.date_tournee?.startsWith(selectedDate)
                    );
                    const totalCaisses = tourneesAgent.reduce((s,t)=>s+t.nb_caisses_total,0);
                    return (
                      <div key={a.id} className="px-5 py-4 hover:bg-blue-50/40 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="bg-blue-100 text-blue-800 rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {a.nom.charAt(0)}{a.prenom?.charAt(0)||''}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-gray-800">{a.nom} {a.prenom}</p>
                              {a.poste_type && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                  a.poste_type === 'JOUR' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                                }`}>
                                  {a.poste_type === 'JOUR' ? '☀️ Jour' : '🌙 Nuit'}
                                </span>
                              )}
                              {a.poste_nom && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.poste_nom}</span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                              {a.code_agent && <span>Code : <b className="text-gray-700">{a.code_agent}</b></span>}
                              <span>Rôle : <b className="text-blue-700">Logistique</b></span>
                            </div>
                            {/* Tournées du jour affectées par cet agent */}
                            <div className="mt-2">
                              <p className="text-xs font-semibold text-gray-500 mb-1">
                                Tournées du {selectedDate} — <span className="text-blue-700">{tourneesAgent.length} tournée{tourneesAgent.length>1?'s':''} / {totalCaisses} caisses affectées</span>
                              </p>
                              {tourneesAgent.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Aucune tournée ce jour pour cet agent</p>
                              ) : (
                                <div className="space-y-2 mt-1">
                                  {tourneesAgent.map(t => (
                                    <div key={t.id} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                                      <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                          <Truck className="w-3.5 h-3.5 text-blue-500"/>
                                          <span className="font-medium text-sm text-gray-800">{t.camion_matricule}</span>
                                          <span className="text-xs text-gray-500">{t.chauffeur_nom}</span>
                                          <span className="text-xs text-gray-500 flex items-center gap-0.5">
                                            <MapPin className="w-3 h-3 text-red-400"/>{t.secteur_nom}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-blue-800">{t.nb_caisses_total} caisses</span>
                                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                            t.statut==='planifiee'?'bg-amber-100 text-amber-800':
                                            t.statut==='en_cours'?'bg-blue-100 text-blue-800':'bg-green-100 text-green-800'}`}>
                                            {t.statut==='planifiee'?'⏳ Planifiée':t.statut==='en_cours'?'🔄 En cours':'✅ Terminée'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ═══ ONGLET ALERTES ═══ */}
        {onglet === 'alertes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Bell className="w-5 h-5 text-red-500" />
                Alertes actives
                {nbAlertes > 0 && (
                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                    {nbAlertes}
                  </span>
                )}
              </h3>
              <button onClick={refetchAlertes}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50">
                <RefreshCw className="w-3 h-3" /> Rafraîchir
              </button>
            </div>

            {alertes.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-green-700 font-semibold">Aucune alerte active</p>
                <p className="text-sm text-green-600">Tous les chargements et retours sont conformes.</p>
              </div>
            )}

            <AlerteBanner
              alertes={alertes}
              role="controleur"
              agentId={agent?.id}
              onDebloquer={async (_alerteId, livraisonId, type, motif, ajustement) => {
                try {
                  if (type === 'ECART_POIDS_CHARGEMENT') {
                    await fetch(`${API_BASE}/api/validation/debloquer-chargement/${livraisonId}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ agent_id: agent?.id ?? 0, motif }),
                    });
                  } else {
                    await fetch(`${API_BASE}/api/validation/clore-litige/${livraisonId}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ agent_id: agent?.id ?? 0, motif, ajustement_caisses: ajustement ?? 0, type_cloture: 'LITIGE_RESOLU' }),
                    });
                  }
                  refetchAlertes();
                } catch { refetchAlertes(); }
              }}
              onDismiss={(_id) => { /* local only */ }}
            />
          </div>
        )}

        {/* ═══ ONGLET STOCK VOLAILLE (lecture seule) ═══ */}
        {onglet === 'stock-ctrl' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-blue-600"/> Stock Volaille du Jour
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-normal">Lecture seule</span>
              </h3>
              <button onClick={refetchStockCtrl} disabled={stockCtrlLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50">
                <RefreshCw className={`w-3 h-3 ${stockCtrlLoading ? 'animate-spin' : ''}`}/> Actualiser
              </button>
            </div>

            {/* Compteurs caisses */}
            {compteursCtrl && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Stock total</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{compteursCtrl.total_stock}</p>
                  <p className="text-xs text-gray-400">caisses</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-500">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">En circulation</p>
                  <p className="text-3xl font-bold text-orange-600 mt-1">{compteursCtrl.en_circulation}</p>
                  <p className="text-xs text-gray-400">frigos en route</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Retournées frigo</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{compteursCtrl.retournees_frigo}</p>
                  <p className="text-xs text-gray-400">caisses rentrées</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-elfirma-green">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Disponibles</p>
                  <p className="text-3xl font-bold text-elfirma-green mt-1">{compteursCtrl.disponibles}</p>
                  <p className="text-xs text-gray-400">caisses libres</p>
                </div>
              </div>
            )}

            {/* Ventilation Congelé / Surgelé */}
            {compteursCtrl && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Box className="w-4 h-4 text-blue-700"/>
                    <span className="font-bold text-blue-800">Congelé (−18°C)</span>
                    <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{compteursCtrl.congele_caisses} caisses</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">{Number(compteursCtrl.congele_kg).toFixed(0)} kg</p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="w-4 h-4 text-indigo-700"/>
                    <span className="font-bold text-indigo-800">Surgelé (−24°C)</span>
                    <span className="ml-auto bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{compteursCtrl.surgele_caisses} caisses</span>
                  </div>
                  <p className="text-2xl font-bold text-indigo-700">{Number(compteursCtrl.surgele_kg).toFixed(0)} kg</p>
                </div>
              </div>
            )}

            {/* Tableau détaillé lecture seule */}
            {stockCtrl.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h4 className="font-bold text-gray-700">Détail stock du jour</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Désignation</th>
                        <th className="px-4 py-3 text-center">Quantité</th>
                        <th className="px-4 py-3 text-center">Stock</th>
                        <th className="px-4 py-3 text-center">Circulation</th>
                        <th className="px-4 py-3 text-center">Retournées</th>
                        <th className="px-4 py-3 text-center">Lot</th>
                        <th className="px-4 py-3 text-center">Saisi par</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockCtrl.map(s => (
                        <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              s.type_produit === 'CONGELE' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'}`}>
                              {s.type_produit === 'CONGELE' ? '❄️ Congelé' : '🧊 Surgelé'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">{s.designation}</td>
                          <td className="px-4 py-3 text-center font-bold text-orange-600">{Number(s.quantite_kg).toFixed(0)} kg</td>
                          <td className="px-4 py-3 text-center font-bold text-blue-600">{s.nb_caisses}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={s.nb_caisses_en_circulation > 0 ? 'text-orange-600 font-semibold' : 'text-gray-400'}>{s.nb_caisses_en_circulation}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={s.nb_caisses_retournees > 0 ? 'text-green-600 font-semibold' : 'text-gray-400'}>{s.nb_caisses_retournees}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-500 text-xs">{s.lot ?? '—'}</td>
                          <td className="px-4 py-3 text-center text-gray-500 text-xs">{s.agent_nom ?? '—'} {s.agent_prenom ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {stockCtrl.length === 0 && !stockCtrlLoading && (
              <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400">
                <Package className="w-8 h-8 mx-auto mb-2 text-gray-300"/>
                <p className="text-sm">Aucun stock saisi aujourd'hui.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ ONGLET PERFORMANCES ═══ */}
        {onglet === 'performances' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-elfirma-green"/> Historique performances par chauffeur
              </h3>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Chauffeur (ID)</p>
                  <select value={histoChauffeurId} onChange={e => setHistoChauffeurId(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">— Sélectionner —</option>
                    <option value="1">Ahmed Ben Ali</option>
                    <option value="2">Mohamed Trabelsi</option>
                    <option value="3">Sami Bouazizi</option>
                  </select>
                </div>
                <button
                  onClick={async () => {
                    if (!histoChauffeurId) return;
                    setHistoLoading(true);
                    try {
                      const r = await fetch(`${API_BASE}/api/fin-de-mois/historique/${histoChauffeurId}`);
                      const data = await r.json();
                      setHistoPerf(Array.isArray(data) ? data : []);
                    } catch { setHistoPerf([]); }
                    setHistoLoading(false);
                  }}
                  disabled={!histoChauffeurId || histoLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-elfirma-green text-white rounded-xl text-sm font-medium hover:bg-elfirma-darkGreen disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${histoLoading ? 'animate-spin' : ''}`}/>
                  {histoLoading ? 'Chargement…' : 'Charger'}
                </button>
              </div>
            </div>

            {histoPerf.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h4 className="font-bold text-gray-700">12 derniers mois</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Période</th>
                        <th className="px-4 py-3 text-center">Départs</th>
                        <th className="px-4 py-3 text-center">Chargées</th>
                        <th className="px-4 py-3 text-center">Retournées</th>
                        <th className="px-4 py-3 text-center">Taux retour</th>
                        <th className="px-4 py-3 text-center">Écart caisses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histoPerf.map((h, i) => {
                        const moisNoms = ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
                        const taux = parseFloat(String(h.taux_retour));
                        const ecart = parseInt(String(h.caisses_ecart));
                        return (
                          <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{moisNoms[h.mois]} {h.annee}</td>
                            <td className="px-4 py-3 text-center">{h.nb_departs}</td>
                            <td className="px-4 py-3 text-center">{h.total_chargees}</td>
                            <td className="px-4 py-3 text-center">{h.total_retournees}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-semibold flex items-center justify-center gap-1 ${
                                taux >= 95 ? 'text-green-600' : taux >= 90 ? 'text-amber-600' : 'text-red-600'}`}>
                                {taux >= 95 ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                                {taux}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-semibold ${ecart > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {ecart > 0 ? `+${ecart}` : ecart}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {histoPerf.length === 0 && !histoLoading && histoChauffeurId && (
              <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 text-sm">
                Aucune donnée disponible pour ce chauffeur.
              </div>
            )}
          </div>
        )}

        {/* ═══ ONGLET RAPPORT ═══ */}
        {onglet === 'rapport' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 text-xl">
                <Download className="w-6 h-6 text-elfirma-green"/> Rapport exportable
              </h3>
              <div className="flex gap-2">
                <button onClick={exportRapportExcel} disabled={rapportData.length===0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-40 shadow">
                  <Download className="w-4 h-4"/> Excel (.xlsx)
                </button>
                <button onClick={imprimerRapport} disabled={rapportData.length===0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 shadow">
                  <Printer className="w-4 h-4"/> Imprimer
                </button>
              </div>
            </div>

            {/* Sélecteur période */}
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
              <p className="text-sm font-semibold text-gray-600">Sélectionner la période</p>
              <div className="flex gap-2 flex-wrap">
                {(['jour','mois','plage'] as const).map(m=>(
                  <button key={m} onClick={()=>setRapportMode(m)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      rapportMode===m?'bg-elfirma-green text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {m==='jour'?'📅 Par jour':m==='mois'?'📆 Par mois':'📈 Plage de dates'}
                  </button>
                ))}
              </div>

              {rapportMode==='jour' && (
                <div className="flex items-end gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Date</p>
                    <input type="date" value={rapportDate} onChange={e=>setRapportDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                  </div>
                  <button onClick={chargerRapport} disabled={rapportLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-elfirma-green text-white rounded-lg text-sm font-medium hover:bg-elfirma-darkGreen disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${rapportLoading?'animate-spin':''}`}/> Charger
                  </button>
                </div>
              )}

              {rapportMode==='mois' && (
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Mois</p>
                    <select value={rapportMois.month} onChange={e=>setRapportMois({...rapportMois,month:parseInt(e.target.value)})}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {MOIS.slice(1).map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Année</p>
                    <select value={rapportMois.year} onChange={e=>setRapportMois({...rapportMois,year:parseInt(e.target.value)})}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {[2025,2026,2027].map(y=><option key={y}>{y}</option>)}
                    </select>
                  </div>
                  <button onClick={chargerRapport} disabled={rapportLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-elfirma-green text-white rounded-lg text-sm font-medium hover:bg-elfirma-darkGreen disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${rapportLoading?'animate-spin':''}`}/> Charger {MOIS[rapportMois.month]} {rapportMois.year}
                  </button>
                </div>
              )}

              {rapportMode==='plage' && (
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Du</p>
                    <input type="date" value={rapportPlage.debut} onChange={e=>setRapportPlage({...rapportPlage,debut:e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Au</p>
                    <input type="date" value={rapportPlage.fin} onChange={e=>setRapportPlage({...rapportPlage,fin:e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                  </div>
                  <button onClick={chargerRapport} disabled={rapportLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-elfirma-green text-white rounded-lg text-sm font-medium hover:bg-elfirma-darkGreen disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${rapportLoading?'animate-spin':''}`}/> Charger la plage
                  </button>
                </div>
              )}
            </div>

            {/* KPIs rapport */}
            {rapportData.length > 0 && (()=>{
              const nbDep=rapportData.filter(d=>d.type==='depart').length;
              const nbRet=rapportData.filter(d=>d.type==='retour').length;
              const totCh=rapportData.reduce((s,d)=>s+(d.nb_caisses_chargees??0),0);
              const totRet=rapportData.reduce((s,d)=>s+(d.nb_caisses_retournees??0),0);
              const totPn=rapportData.reduce((s,d)=>s+((d.poids_charge??0)-(d.poids_vide??0)),0);
              const ecart=Math.max(0,totCh-totRet);
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {label:'Départs',val:nbDep,c:'green'},
                    {label:'Retours',val:nbRet,c:'blue'},
                    {label:'Caisses chargées',val:totCh,c:'gray'},
                    {label:'Caisses retournées',val:totRet,c:'gray'},
                    {label:'Écart caisses',val:ecart,c:ecart>0?'red':'green'},
                    {label:'Poids net total',val:`${totPn.toFixed(0)} kg`,c:'purple'},
                    {label:'Total livraisons',val:rapportData.length,c:'gray'},
                    {label:'Livraisons validées',val:rapportData.filter(d=>d.validee).length,c:'green'},
                  ].map(k=>(
                    <div key={k.label} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-200">
                      <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                      <p className={`text-2xl font-bold ${
                        k.c==='red'?'text-red-600':k.c==='green'?'text-green-600':k.c==='blue'?'text-blue-600':k.c==='purple'?'text-purple-600':'text-gray-800'}` }>{k.val}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Tableau */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                <h4 className="font-bold text-gray-800">{rapportData.length} livraison{rapportData.length!==1?'s':''}</h4>
                {rapportData.length===0&&!rapportLoading&&<span className="text-xs text-gray-400">Sélectionnez une période et cliquez sur Charger</span>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      {['Date','Camion','Chauffeur','Type','Caisses Ch.','Caisses Ret.','Écart','Poids net','Statut'].map(h=>(
                        <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rapportLoading?(
                      <tr><td colSpan={9} className="text-center py-10 text-gray-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2"/>Chargement…
                      </td></tr>
                    ):rapportData.length===0?(
                      <tr><td colSpan={9} className="text-center py-10 text-gray-400">Aucune donnée</td></tr>
                    ):rapportData.map(d=>{
                      const e=Math.max(0,(d.nb_caisses_chargees??0)-(d.nb_caisses_retournees??0));
                      return (
                        <tr key={d.id} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-500">{new Date(d.date).toLocaleDateString('fr-TN')}</td>
                          <td className="px-4 py-3 font-mono font-bold">{d.matricule||'—'}</td>
                          <td className="px-4 py-3 font-medium">{d.chauffeur_nom||'—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              d.type==='depart'?'bg-green-100 text-green-800':'bg-blue-100 text-blue-800'}`}>
                              {d.type==='depart'?'Départ':'Retour'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-elfirma-green text-center">{d.nb_caisses_chargees??'—'}</td>
                          <td className="px-4 py-3 font-bold text-blue-600 text-center">{d.nb_caisses_retournees??'—'}</td>
                          <td className={`px-4 py-3 font-bold text-center ${e>0?'text-red-600':'text-green-600'}`}>
                            {e>0?`−${e}`:'✓'}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{((d.poids_charge??0)-(d.poids_vide??0)).toFixed(1)} kg</td>
                          <td className="px-4 py-3">
                            {d.validee
                              ?<span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle className="w-3.5 h-3.5"/>Validée</span>
                              :<span className="flex items-center gap-1 text-xs text-amber-700"><XCircle className="w-3.5 h-3.5"/>En attente</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>


      {/* Modal PIN */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              {actionType==='validate'?'✅ Valider':'❌ Rejeter'} la livraison
            </h3>
            <p className="text-xs text-gray-500 mb-4">Entrez votre code PIN contrôleur pour confirmer.</p>
            <input type="password" value={pinCode} onChange={e=>setPinCode(e.target.value)}
              maxLength={4} autoFocus
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-center text-2xl tracking-widest mb-3 focus:border-elfirma-green focus:ring-0"
              placeholder="••••"/>
            {pinError && <p className="text-red-600 text-xs mb-3 text-center">{pinError}</p>}
            <div className="flex gap-2">
              <button onClick={cancelAction}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-200">Annuler</button>
              <button onClick={confirmAction}
                className="flex-1 bg-elfirma-green text-white py-2.5 rounded-xl font-bold hover:bg-elfirma-darkGreen">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
