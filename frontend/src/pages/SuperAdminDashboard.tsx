import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Settings, Calculator, CheckCircle, AlertTriangle,
  TrendingUp, TrendingDown, BarChart3, RefreshCw, Save,
  Shield, Users, Truck, Package, ChevronDown, ChevronUp, Printer,
  Thermometer, Box, Bell, Edit3
} from 'lucide-react';
import { useStockVolaille } from '../hooks/useStockVolaille';
import { useAlertes } from '../hooks/useAlertes';
import AlerteBanner from '../components/AlerteBanner';

import API_BASE from '../config/api';
const API = `${API_BASE}/api`;
const MOIS_NOMS = ['','Janvier','Février','Mars','Avril','Mai','Juin',
                   'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

interface Bareme {
  cout_par_caisse_perdue:     number;
  seuil_tolerance_caisses:    number;
  prime_taux_retour_100:      number;
  prime_taux_retour_95:       number;
  prime_taux_retour_90:       number;
  seuil_prime_min_livraisons: number;
  seuil_alerte_caisses:       number;
  remarque_visible_par:       'controller' | 'comptable' | 'all' | 'admin_only';
}

interface LigneCalcul {
  chauffeur_id: number;
  chauffeur_nom: string;
  matricule: string;
  nb_departs: number;
  nb_retours: number;
  total_chargees: number;
  total_retournees: number;
  caisses_ecart: number;
  caisses_sanctionnables: number;
  taux_retour: number;
  alerte: boolean;
  montant_penalty: number;
  remarque_penalty: string | null;
  montant_prime: number;
  motif_prime: string | null;
  net: number;
  statut: string;
}

interface ResultatCalcul {
  periode: { year: number; month: number };
  bareme_utilise: Bareme;
  valide: boolean;
  resultats: LigneCalcul[];
  totaux: { total_penalty: number; total_prime: number; net_global: number; chauffeurs_en_alerte: number };
}

const BAREME_INIT: Bareme = {
  cout_par_caisse_perdue:     15,
  seuil_tolerance_caisses:     2,
  prime_taux_retour_100:      50,
  prime_taux_retour_95:       30,
  prime_taux_retour_90:       15,
  seuil_prime_min_livraisons: 10,
  seuil_alerte_caisses:        5,
  remarque_visible_par:       'all',
};

export default function SuperAdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [onglet, setOnglet] = useState<'bareme' | 'calcul' | 'validation' | 'stock-admin' | 'anomalies'>('bareme');
  const [bareme, setBareme] = useState<Bareme>(BAREME_INIT);
  const [baremeModifie, setBaremeModifie] = useState(false);
  const [baremeEnregistre, setBaremeEnregistre] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });
  const [calcul, setCalcul] = useState<ResultatCalcul | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [confirmerValidation, setConfirmerValidation] = useState(false);

  // Dashboard KPIs
  const [kpis, setKpis] = useState({ nb_agents: 0, nb_camions: 0, livraisons_jour: 0, stock_usine: 0 });

  // Stock Volaille & Alertes
  const { stockJour: stockAdmin, compteurs: compteursAdmin, historique: historiqueAdmin, loading: stockAdminLoading, refetch: refetchStockAdmin, corrigerStock } = useStockVolaille();
  const { alertes, nbAlertes, refetch: refetchAlertes } = useAlertes();

  // Anomalies historique
  const [anomalies, setAnomalies] = useState<{ alertes: any[]; corrections: any[] }>({ alertes: [], corrections: [] });
  const [anomaliesLoading, setAnomaliesLoading] = useState(false);

  // Correction inventaire
  const [correctionId, setCorrectionId] = useState<number | null>(null);
  const [corrForm, setCorrForm] = useState({ quantite_kg: '', nb_caisses: '', motif: '' });
  const [corrSaving, setCorrSaving] = useState(false);

  const fetchAnomalies = useCallback(async () => {
    setAnomaliesLoading(true);
    try {
      const r = await fetch(`${API}/stock-volaille/anomalies`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await r.json();
      setAnomalies(data);
    } catch { setAnomalies({ alertes: [], corrections: [] }); }
    setAnomaliesLoading(false);
  }, []);

  const handleCorrection = async () => {
    if (!correctionId || !corrForm.motif.trim()) return;
    setCorrSaving(true);
    try {
      await corrigerStock(correctionId, {
        quantite_kg: corrForm.quantite_kg ? parseFloat(corrForm.quantite_kg) : undefined,
        nb_caisses:  corrForm.nb_caisses  ? parseInt(corrForm.nb_caisses)  : undefined,
        motif: corrForm.motif,
      });
      setCorrectionId(null);
      setCorrForm({ quantite_kg: '', nb_caisses: '', motif: '' });
    } catch { /* hors-ligne */ }
    setCorrSaving(false);
  };

  const fetchBareme = useCallback(async () => {
    try {
      const r = await fetch(`${API}/fin-de-mois/bareme`);
      setBareme(await r.json());
    } catch { /* utiliser defaut */ }
  }, []);

  const fetchKpis = useCallback(async () => {
    try {
      const [stock, agents] = await Promise.all([
        fetch(`${API}/report/stock`).then(r => r.json()),
        fetch(`${API}/agent`).then(r => r.json()),
      ]);
      setKpis({
        nb_agents:      Array.isArray(agents) ? agents.length : 0,
        nb_camions:     stock.stock_par_chauffeur?.length ?? 3,
        livraisons_jour: 0,
        stock_usine:    stock.stock_usine ?? 0,
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchBareme();
    fetchKpis();
  }, [fetchBareme, fetchKpis]);

  useEffect(() => {
    if (onglet === 'anomalies') fetchAnomalies();
  }, [onglet, fetchAnomalies]);

  const sauvegarderBareme = async () => {
    try {
      await fetch(`${API}/fin-de-mois/bareme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bareme),
      });
      setBaremeModifie(false);
      setBaremeEnregistre(true);
      setTimeout(() => setBaremeEnregistre(false), 2500);
    } catch { alert('Erreur lors de la sauvegarde'); }
  };

  const lancerCalcul = async (valider = false) => {
    setLoading(true);
    setCalcul(null);
    try {
      const r = await fetch(`${API}/fin-de-mois/calcul`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedMonth.year, month: selectedMonth.month, valider }),
      });
      setCalcul(await r.json());
    } catch { alert('Erreur calcul fin de mois'); }
    setLoading(false);
    setConfirmerValidation(false);
  };

  const handleBaremeChange = (key: keyof Bareme, val: string | number) => {
    setBareme(prev => ({ ...prev, [key]: val }));
    setBaremeModifie(true);
  };

  const imprimerRapport = () => {
    if (!calcul) return;
    const lignes = calcul.resultats.map(r => `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px">${r.chauffeur_nom}</td>
        <td style="padding:8px;text-align:center">${r.matricule}</td>
        <td style="padding:8px;text-align:center">${r.nb_departs}</td>
        <td style="padding:8px;text-align:center">${r.taux_retour}%</td>
        <td style="padding:8px;text-align:center">${r.caisses_ecart}</td>
        <td style="padding:8px;text-align:center;color:${r.montant_penalty>0?'#dc2626':'#16a34a'}">${r.montant_penalty > 0 ? `-${r.montant_penalty} DT` : '—'}</td>
        <td style="padding:8px;text-align:center;color:#16a34a">${r.montant_prime > 0 ? `+${r.montant_prime} DT` : '—'}</td>
        <td style="padding:8px;text-align:center;font-weight:bold;color:${r.net>=0?'#16a34a':'#dc2626'}">${r.net >= 0 ? '+' : ''}${r.net} DT</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>Rapport Fin de Mois</title>
    <style>body{font-family:Arial,sans-serif;padding:24px}h1{color:#166534}table{width:100%;border-collapse:collapse}th{background:#166534;color:white;padding:8px}td{padding:8px}</style>
    </head><body>
    <h1>EL FIRMA — Rapport Fin de Mois</h1>
    <p><strong>Période :</strong> ${MOIS_NOMS[calcul.periode.month]} ${calcul.periode.year}</p>
    <p><strong>Barème :</strong> ${calcul.bareme_utilise.cout_par_caisse_perdue} DT/caisse perdue · Tolérance ${calcul.bareme_utilise.seuil_tolerance_caisses} caisses</p>
    <table>
      <thead><tr><th>Chauffeur</th><th>Matricule</th><th>Départs</th><th>Taux retour</th><th>Écart caisses</th><th>Pénalité</th><th>Prime</th><th>Net</th></tr></thead>
      <tbody>${lignes}</tbody>
    </table>
    <hr/><p><strong>Total pénalités :</strong> ${calcul.totaux.total_penalty} DT &nbsp;|&nbsp;
    <strong>Total primes :</strong> ${calcul.totaux.total_prime} DT &nbsp;|&nbsp;
    <strong>Net global :</strong> ${calcul.totaux.net_global} DT</p>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 to-gray-700 text-white px-6 py-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl"><Shield className="w-6 h-6" /></div>
            <div>
              <h1 className="font-bold text-lg">Super Admin — EL FIRMA</h1>
              <p className="text-xs text-gray-300">Configuration & Supervision Globale</p>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-sm">
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: <Users className="w-5 h-5 text-blue-600"/>, label: 'Agents actifs',    val: kpis.nb_agents,      bg: 'bg-blue-50' },
            { icon: <Truck className="w-5 h-5 text-green-600"/>,label: 'Camions actifs',   val: kpis.nb_camions,     bg: 'bg-green-50' },
            { icon: <Package className="w-5 h-5 text-amber-600"/>,label:'Stock usine',      val: kpis.stock_usine,    bg: 'bg-amber-50' },
            { icon: <BarChart3 className="w-5 h-5 text-purple-600"/>,label:'Livr. du jour', val: kpis.livraisons_jour,bg: 'bg-purple-50' },
          ].map((k, i) => (
            <div key={i} className={`${k.bg} rounded-2xl p-4 flex items-center gap-3 shadow-sm`}>
              <div className="shrink-0">{k.icon}</div>
              <div>
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className="text-2xl font-bold text-gray-800">{k.val}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation onglets */}
        <div className="flex flex-wrap gap-2 mb-6">
          {([
            { key: 'bareme',      label: 'Barème & Sanctions',   icon: <Settings className="w-4 h-4" /> },
            { key: 'calcul',      label: 'Calcul Fin de Mois',   icon: <Calculator className="w-4 h-4" /> },
            { key: 'validation',  label: 'Validation & Export',  icon: <CheckCircle className="w-4 h-4" /> },
            { key: 'stock-admin', label: 'Stock Volaille',        icon: <Thermometer className="w-4 h-4" /> },
            { key: 'anomalies',   label: nbAlertes > 0 ? `Anomalies (${nbAlertes})` : 'Anomalies', icon: <Bell className={`w-4 h-4 ${nbAlertes > 0 ? 'text-red-500 animate-pulse' : ''}`} /> },
          ] as { key: 'bareme'|'calcul'|'validation'|'stock-admin'|'anomalies'; label: string; icon: React.ReactNode }[]).map(o => (
            <button key={o.key} onClick={() => setOnglet(o.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                onglet === o.key ? 'bg-gray-900 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
              {o.icon}{o.label}
            </button>
          ))}
        </div>

        {/* ── ONGLET BARÈME ─────────────────────────────────────── */}
        {onglet === 'bareme' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-600" /> Configuration du Barème
              </h2>
              {baremeEnregistre && (
                <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                  <CheckCircle className="w-4 h-4" /> Barème enregistré
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Sanctions */}
              <div>
                <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" /> Sanctions — Caisses non retournées
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Coût par caisse perdue (DT)
                    </label>
                    <input type="number" min={0} step={0.5}
                      value={bareme.cout_par_caisse_perdue}
                      onChange={e => handleBaremeChange('cout_par_caisse_perdue', parseFloat(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800"/>
                    <p className="text-xs text-gray-400 mt-1">Montant déduit par caisse non retournée au-delà du seuil de tolérance</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Seuil de tolérance (caisses)
                    </label>
                    <input type="number" min={0}
                      value={bareme.seuil_tolerance_caisses}
                      onChange={e => handleBaremeChange('seuil_tolerance_caisses', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800"/>
                    <p className="text-xs text-gray-400 mt-1">Nombre de caisses acceptées sans sanction</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Seuil d'alerte automatique (caisses)
                    </label>
                    <input type="number" min={0}
                      value={bareme.seuil_alerte_caisses}
                      onChange={e => handleBaremeChange('seuil_alerte_caisses', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-400"/>
                    <p className="text-xs text-gray-400 mt-1">Au-delà : chauffeur signalé automatiquement en rouge</p>
                  </div>
                </div>
              </div>

              {/* Primes */}
              <div>
                <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Primes — Performance taux de retour
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prime taux retour 100% (DT)
                    </label>
                    <input type="number" min={0}
                      value={bareme.prime_taux_retour_100}
                      onChange={e => handleBaremeChange('prime_taux_retour_100', parseFloat(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600"/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prime taux retour ≥ 95% (DT)
                    </label>
                    <input type="number" min={0}
                      value={bareme.prime_taux_retour_95}
                      onChange={e => handleBaremeChange('prime_taux_retour_95', parseFloat(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600"/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prime taux retour ≥ 90% (DT)
                    </label>
                    <input type="number" min={0}
                      value={bareme.prime_taux_retour_90}
                      onChange={e => handleBaremeChange('prime_taux_retour_90', parseFloat(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600"/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nb min. de départs pour être éligible à la prime
                    </label>
                    <input type="number" min={1}
                      value={bareme.seuil_prime_min_livraisons}
                      onChange={e => handleBaremeChange('seuil_prime_min_livraisons', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600"/>
                  </div>
                </div>
              </div>
            </div>

            {/* Visibilité remarques */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Visibilité des remarques</h3>
              <div className="flex gap-3 flex-wrap">
                {([
                  { val: 'all',          label: 'Tous les rôles' },
                  { val: 'comptable',    label: 'Comptable seulement' },
                  { val: 'controller',   label: 'Contrôleur seulement' },
                  { val: 'admin_only',   label: 'Admin seulement' },
                ] as const).map(o => (
                  <button key={o.val}
                    onClick={() => handleBaremeChange('remarque_visible_par', o.val)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      bareme.remarque_visible_par === o.val
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={sauvegarderBareme}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
                  baremeModifie
                    ? 'bg-gray-900 text-white hover:bg-gray-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                disabled={!baremeModifie}>
                <Save className="w-4 h-4" /> Enregistrer le barème
              </button>
            </div>
          </div>
        )}

        {/* ── ONGLET CALCUL ─────────────────────────────────────── */}
        {onglet === 'calcul' && (
          <div className="space-y-5">
            {/* Sélecteur période */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Mois</label>
                <select value={selectedMonth.month}
                  onChange={e => setSelectedMonth(p => ({ ...p, month: parseInt(e.target.value) }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                  {MOIS_NOMS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Année</label>
                <select value={selectedMonth.year}
                  onChange={e => setSelectedMonth(p => ({ ...p, year: parseInt(e.target.value) }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                  {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={() => lancerCalcul(false)} disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Calcul…' : 'Simuler'}
              </button>
            </div>

            {/* Résultats */}
            {calcul && (
              <>
                {/* Totaux */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total pénalités', val: `${calcul.totaux.total_penalty} DT`, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Total primes',    val: `${calcul.totaux.total_prime} DT`,   color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Net global',      val: `${calcul.totaux.net_global > 0 ? '+' : ''}${calcul.totaux.net_global} DT`,
                      color: calcul.totaux.net_global >= 0 ? 'text-green-700' : 'text-red-700', bg: 'bg-gray-50' },
                    { label: 'Chauffeurs en alerte', val: calcul.totaux.chauffeurs_en_alerte, color: 'text-orange-600', bg: 'bg-orange-50' },
                  ].map((k, i) => (
                    <div key={i} className={`${k.bg} rounded-2xl p-4`}>
                      <p className="text-xs text-gray-500 mb-1">{k.label}</p>
                      <p className={`text-2xl font-bold ${k.color}`}>{k.val}</p>
                    </div>
                  ))}
                </div>

                {/* Tableau détaillé */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-700">
                      Détail par chauffeur — {MOIS_NOMS[calcul.periode.month]} {calcul.periode.year}
                    </h3>
                    <span className="text-xs text-gray-400">{calcul.valide ? '✅ Validé' : '🔵 Simulation'}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-3 text-left">Chauffeur</th>
                          <th className="px-4 py-3 text-center">Matricule</th>
                          <th className="px-4 py-3 text-center">Départs</th>
                          <th className="px-4 py-3 text-center">Taux retour</th>
                          <th className="px-4 py-3 text-center">Écart caisses</th>
                          <th className="px-4 py-3 text-center">Pénalité</th>
                          <th className="px-4 py-3 text-center">Prime</th>
                          <th className="px-4 py-3 text-center font-bold">Net</th>
                          <th className="px-4 py-3 text-center">Détail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calcul.resultats.map(r => (
                          <>
                            <tr key={r.chauffeur_id}
                              className={`border-t border-gray-100 ${r.alerte ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                              <td className="px-4 py-3 font-medium text-gray-800 flex items-center gap-2">
                                {r.alerte && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0"/>}
                                {r.chauffeur_nom}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-600">{r.matricule}</td>
                              <td className="px-4 py-3 text-center">{r.nb_departs}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-semibold ${r.taux_retour >= 95 ? 'text-green-600' : r.taux_retour >= 90 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {r.taux_retour}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={r.caisses_ecart > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                                  {r.caisses_ecart}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-red-600 font-semibold">
                                {r.montant_penalty > 0 ? `−${r.montant_penalty} DT` : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-center text-green-600 font-semibold">
                                {r.montant_prime > 0 ? `+${r.montant_prime} DT` : <span className="text-gray-300">—</span>}
                              </td>
                              <td className={`px-4 py-3 text-center font-bold text-base ${r.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {r.net >= 0 ? '+' : ''}{r.net} DT
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => setExpandedRow(expandedRow === r.chauffeur_id ? null : r.chauffeur_id)}
                                  className="text-gray-400 hover:text-gray-700">
                                  {expandedRow === r.chauffeur_id ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                                </button>
                              </td>
                            </tr>
                            {expandedRow === r.chauffeur_id && (
                              <tr key={`detail-${r.chauffeur_id}`} className="bg-gray-50">
                                <td colSpan={9} className="px-6 py-3">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                    <div><p className="text-gray-400">Caisses chargées</p><p className="font-bold">{r.total_chargees}</p></div>
                                    <div><p className="text-gray-400">Caisses retournées</p><p className="font-bold">{r.total_retournees}</p></div>
                                    <div><p className="text-gray-400">Caisses sanctionnables</p><p className="font-bold text-red-600">{r.caisses_sanctionnables}</p></div>
                                    <div><p className="text-gray-400">Nb retours</p><p className="font-bold">{r.nb_retours}</p></div>
                                    {r.remarque_penalty && <div className="col-span-2"><p className="text-gray-400">Motif pénalité</p><p className="font-medium text-red-700">{r.remarque_penalty}</p></div>}
                                    {r.motif_prime     && <div className="col-span-2"><p className="text-gray-400">Motif prime</p><p className="font-medium text-green-700">{r.motif_prime}</p></div>}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ONGLET VALIDATION ─────────────────────────────────── */}
        {onglet === 'validation' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" /> Validation & Export du traitement fin de mois
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Après simulation dans l'onglet <strong>Calcul</strong>, validez ici pour persister les pénalités et primes
                en base de données. Cette action est <strong>irréversible</strong> et notifie Comptable + Contrôleur.
              </p>

              <div className="flex flex-wrap items-end gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Mois</label>
                  <select value={selectedMonth.month}
                    onChange={e => setSelectedMonth(p => ({ ...p, month: parseInt(e.target.value) }))}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                    {MOIS_NOMS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Année</label>
                  <select value={selectedMonth.year}
                    onChange={e => setSelectedMonth(p => ({ ...p, year: parseInt(e.target.value) }))}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                    {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {!confirmerValidation ? (
                <div className="flex gap-3 flex-wrap">
                  <button onClick={() => { setOnglet('calcul'); lancerCalcul(false); }}
                    className="flex items-center gap-2 px-5 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-medium hover:bg-blue-100">
                    <BarChart3 className="w-4 h-4" /> Voir la simulation d'abord
                  </button>
                  <button onClick={() => setConfirmerValidation(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">
                    <CheckCircle className="w-4 h-4" /> Valider et persister le calcul
                  </button>
                  {calcul && (
                    <button onClick={imprimerRapport}
                      className="flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200">
                      <Printer className="w-4 h-4" /> Imprimer le rapport
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                  <p className="text-amber-800 font-semibold mb-3">
                    ⚠️ Confirmez-vous la validation du calcul de <strong>{MOIS_NOMS[selectedMonth.month]} {selectedMonth.year}</strong> ?
                    Les pénalités et primes seront enregistrées et visibles par le Comptable et le Contrôleur.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => lancerCalcul(true)} disabled={loading}
                      className="flex items-center gap-2 px-5 py-2 bg-green-700 text-white rounded-xl text-sm font-bold hover:bg-green-800 disabled:opacity-50">
                      <CheckCircle className="w-4 h-4" /> {loading ? 'Validation…' : 'Oui, valider'}
                    </button>
                    <button onClick={() => setConfirmerValidation(false)}
                      className="px-5 py-2 bg-white border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {calcul?.valide && (
                <div className="mt-5 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-green-800">Calcul validé et enregistré</p>
                    <p className="text-sm text-green-600">
                      Total pénalités : {calcul.totaux.total_penalty} DT · Total primes : {calcul.totaux.total_prime} DT · Net : {calcul.totaux.net_global} DT
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ ONGLET STOCK ADMIN ═══ */}
        {onglet === 'stock-admin' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-blue-600"/>
                Supervision Stock Volaille
                {nbAlertes > 0 && <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">{nbAlertes} alertes</span>}
              </h3>
              <button onClick={() => { refetchStockAdmin(); refetchAlertes(); }} disabled={stockAdminLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50">
                <RefreshCw className={`w-3 h-3 ${stockAdminLoading ? 'animate-spin' : ''}`}/> Actualiser
              </button>
            </div>

            {/* Alertes temps réel */}
            {alertes.length > 0 && (
              <div className="space-y-2">
                <AlerteBanner
                  alertes={alertes}
                  role="super_admin"
                  onDebloquer={async (_alerteId, livraisonId, type, motif, ajustement) => {
                    try {
                      const endpoint = type === 'ECART_POIDS_CHARGEMENT'
                        ? `/validation/debloquer-chargement/${livraisonId}`
                        : `/validation/clore-litige/${livraisonId}`;
                      await fetch(`${API}${endpoint}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                        body: JSON.stringify({ agent_id: 0, motif, ajustement_caisses: ajustement ?? 0 }),
                      });
                      refetchAlertes();
                    } catch { refetchAlertes(); }
                  }}
                />
              </div>
            )}

            {/* KPIs stock global */}
            {compteursAdmin && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Stock total</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{compteursAdmin.total_stock}</p>
                  <p className="text-xs text-gray-400">caisses</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-500">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">En circulation</p>
                  <p className="text-3xl font-bold text-orange-600 mt-1">{compteursAdmin.en_circulation}</p>
                  <p className="text-xs text-gray-400">frigos</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Retournées</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{compteursAdmin.retournees_frigo}</p>
                  <p className="text-xs text-gray-400">caisses</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-elfirma-green">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Disponibles</p>
                  <p className="text-3xl font-bold text-elfirma-green mt-1">{compteursAdmin.disponibles}</p>
                  <p className="text-xs text-gray-400">caisses</p>
                </div>
              </div>
            )}

            {/* Balance Congelé / Surgelé */}
            {compteursAdmin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3"><Box className="w-5 h-5 text-blue-700"/><span className="font-bold text-blue-800">Congelé (−18°C)</span></div>
                  <div className="flex gap-6">
                    <div><p className="text-xs text-blue-600">Quantité</p><p className="text-2xl font-bold text-blue-700">{Number(compteursAdmin.congele_kg).toFixed(0)} kg</p></div>
                    <div><p className="text-xs text-blue-600">Caisses</p><p className="text-2xl font-bold text-blue-700">{compteursAdmin.congele_caisses}</p></div>
                  </div>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3"><Thermometer className="w-5 h-5 text-indigo-700"/><span className="font-bold text-indigo-800">Surgelé (−24°C)</span></div>
                  <div className="flex gap-6">
                    <div><p className="text-xs text-indigo-600">Quantité</p><p className="text-2xl font-bold text-indigo-700">{Number(compteursAdmin.surgele_kg).toFixed(0)} kg</p></div>
                    <div><p className="text-xs text-indigo-600">Caisses</p><p className="text-2xl font-bold text-indigo-700">{compteursAdmin.surgele_caisses}</p></div>
                  </div>
                </div>
              </div>
            )}

            {/* Tableau stock + boutons correction */}
            {stockAdmin.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h4 className="font-bold text-gray-700">Stock du jour — Droits de correction Super Admin</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Désignation</th>
                        <th className="px-4 py-3 text-center">Quantité</th>
                        <th className="px-4 py-3 text-center">Caisses</th>
                        <th className="px-4 py-3 text-center">Circulation</th>
                        <th className="px-4 py-3 text-center">Retournées</th>
                        <th className="px-4 py-3 text-center">Correction</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockAdmin.map(s => (
                        <>
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
                            <td className="px-4 py-3 text-center">
                              {s.correction_super_admin !== undefined && s.correction_super_admin !== 0 && s.correction_super_admin !== null ? (
                                <span className={`text-xs font-bold ${
                                  Number(s.correction_super_admin) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {Number(s.correction_super_admin) > 0 ? '+' : ''}{Number(s.correction_super_admin).toFixed(0)} kg
                                </span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => { setCorrectionId(s.id); setCorrForm({ quantite_kg: '', nb_caisses: '', motif: '' }); }}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">
                                <Edit3 className="w-3 h-3"/>Corriger
                              </button>
                            </td>
                          </tr>
                          {correctionId === s.id && (
                            <tr className="border-t border-amber-100 bg-amber-50">
                              <td colSpan={8} className="px-4 py-4">
                                <div className="flex flex-wrap gap-3 items-end">
                                  <div>
                                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Δ Quantité kg (+ ou -)</label>
                                    <input type="number" step="0.1" placeholder="ex: -5.5"
                                      value={corrForm.quantite_kg} onChange={e => setCorrForm({...corrForm, quantite_kg: e.target.value})}
                                      className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"/>
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Δ Nb caisses (+ ou -)</label>
                                    <input type="number" placeholder="ex: -2"
                                      value={corrForm.nb_caisses} onChange={e => setCorrForm({...corrForm, nb_caisses: e.target.value})}
                                      className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"/>
                                  </div>
                                  <div className="flex-1 min-w-48">
                                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Motif de correction *</label>
                                    <input type="text" placeholder="Ex: caisses endommagées, erreur de saisie..."
                                      value={corrForm.motif} onChange={e => setCorrForm({...corrForm, motif: e.target.value})}
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"/>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={handleCorrection} disabled={corrSaving || !corrForm.motif.trim()}
                                      className="px-4 py-1.5 bg-elfirma-green text-white rounded-lg text-sm font-bold disabled:opacity-40">
                                      {corrSaving ? 'Enreg...' : 'Appliquer'}
                                    </button>
                                    <button onClick={() => setCorrectionId(null)}
                                      className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm">
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Historique 7 jours */}
            {historiqueAdmin.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h4 className="font-bold text-gray-700">Historique 30 jours</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-center">Type</th>
                        <th className="px-4 py-3 text-center">Total kg</th>
                        <th className="px-4 py-3 text-center">Caisses</th>
                        <th className="px-4 py-3 text-center">Circulation</th>
                        <th className="px-4 py-3 text-center">Retournées</th>
                        <th className="px-4 py-3 text-center">Disponibles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historiqueAdmin.slice(0, 28).map((h, i) => (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600 text-xs">{h.date_production}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              h.type_produit === 'CONGELE' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'}`}>
                              {h.type_produit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-orange-600">{Number(h.total_kg).toFixed(0)}</td>
                          <td className="px-4 py-3 text-center font-bold text-blue-600">{h.total_caisses}</td>
                          <td className="px-4 py-3 text-center text-orange-500">{h.caisses_en_circulation}</td>
                          <td className="px-4 py-3 text-center text-green-600">{h.caisses_retournees}</td>
                          <td className="px-4 py-3 text-center font-semibold text-elfirma-green">{h.caisses_disponibles}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ ONGLET ANOMALIES ═══ */}
        {onglet === 'anomalies' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Bell className="w-5 h-5 text-red-500"/> Historique anomalies &amp; validations
              </h3>
              <button onClick={fetchAnomalies} disabled={anomaliesLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50">
                <RefreshCw className={`w-3 h-3 ${anomaliesLoading ? 'animate-spin' : ''}`}/> Rafraîchir
              </button>
            </div>

            {/* Alertes actives */}
            {anomalies.alertes.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500"/>
                  <h4 className="font-bold text-gray-700">Alertes ({anomalies.alertes.length})</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Message</th>
                        <th className="px-4 py-3 text-center">Niveau</th>
                        <th className="px-4 py-3 text-center">Statut</th>
                        <th className="px-4 py-3 text-center">Date</th>
                        <th className="px-4 py-3 text-left">Chauffeur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anomalies.alertes.map((a: any) => (
                        <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                              {a.type === 'ECART_POIDS_CHARGEMENT' ? '⚖️ Poids' : '📦 Caisses'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 text-xs max-w-xs">{a.message}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              a.niveau === 'CRITIQUE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {a.niveau}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {a.resolue
                              ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto"/>
                              : <AlertTriangle className="w-4 h-4 text-red-500 mx-auto animate-pulse"/>}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString('fr-TN')}</td>
                          <td className="px-4 py-3 text-xs">{a.chauffeur_nom ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Corrections inventaire */}
            {anomalies.corrections.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-500"/>
                  <h4 className="font-bold text-gray-700">Corrections inventaire ({anomalies.corrections.length})</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Désignation</th>
                        <th className="px-4 py-3 text-center">Correction</th>
                        <th className="px-4 py-3 text-left">Motif</th>
                        <th className="px-4 py-3 text-left">Corrigé par</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anomalies.corrections.map((c: any) => (
                        <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-500">{c.date_production}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              c.type_produit === 'CONGELE' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'}`}>
                              {c.type_produit}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">{c.designation}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold ${
                              Number(c.correction_super_admin) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {Number(c.correction_super_admin) > 0 ? '+' : ''}{Number(c.correction_super_admin).toFixed(1)} kg
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">{c.correction_motif}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{c.corrige_par_nom ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {anomalies.alertes.length === 0 && anomalies.corrections.length === 0 && !anomaliesLoading && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2"/>
                <p className="text-green-700 font-semibold">Aucune anomalie enregistrée</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
