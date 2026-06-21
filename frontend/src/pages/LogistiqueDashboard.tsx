import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Plus, Truck, Users, Package, MapPin, Scale,
  CheckCircle, Trash2, Printer, ClipboardList, Sun, Moon, AlertTriangle,
  Thermometer, RefreshCw, ArrowUpCircle, ArrowDownCircle, Box
} from 'lucide-react';
import { useStockVolaille } from '../hooks/useStockVolaille';
import type { StockLine } from '../hooks/useStockVolaille';

import API_BASE from '../config/api';
const API = `${API_BASE}/api`;

type Secteur  = { id: number; nom: string; zone: string };
type Client   = { id: number; nom: string; telephone: string; adresse: string; secteur_id: number };
type Produit  = { id: number; nom: string; code: string; unite: string };
type Chauffeur= { id: number; nom: string; prenom: string; telephone: string };
type Camion   = { id: number; matricule: string; capacite_kg: number };
type LigneTournee = {
  client_id: number; client_nom: string; telephone: string; adresse: string;
  produit_id: number; produit_nom: string; nb_caisses: number; poids_kg: number; note: string;
};
type Tournee  = {
  id: number; chauffeur_id: number; chauffeur_nom?: string; camion_id: number;
  camion_matricule?: string; secteur_id: number; secteur_nom?: string;
  produit_id: number; date_tournee: string; poids_cible: number;
  nb_caisses_total: number; statut: string; lignes: LigneTournee[];
};

export default function LogistiqueDashboard() {
  const { logout, agent } = useAuth();
  const navigate = useNavigate();

  const [secteurs,   setSecteurs]   = useState<Secteur[]>([]);
  const [_clients,   setClients]    = useState<Client[]>([]);
  const [produits,   setProduits]   = useState<Produit[]>([]);
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([]);
  const [camions,    setCamions]    = useState<Camion[]>([]);
  const [tournees,   setTournees]   = useState<Tournee[]>([]);

  const [form, setForm] = useState({
    chauffeur_id: '', camion_id: '', secteur_id: '', produit_id: '',
    date_tournee: new Date().toISOString().split('T')[0],
    poids_cible: '', nb_caisses_total: '',
  });
  const [lignes, setLignes] = useState<LigneTournee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');

  // Chargement initial
  useEffect(() => {
    Promise.all([
      fetch(`${API}/secteur`).then(r => r.json()),
      fetch(`${API}/produit`).then(r => r.json()),
      fetch(`${API}/chauffeur`).then(r => r.json()),
      fetch(`${API}/camion`).then(r => r.json()),
      fetch(`${API}/tournee`).then(r => r.json()),
    ]).then(([s, p, ch, cam, t]) => {
      setSecteurs(s);  setProduits(p);
      setChauffeurs(ch); setCamions(cam); setTournees(t);
    }).catch(() => {});
  }, []);

  // Charger clients quand secteur change
  useEffect(() => {
    if (!form.secteur_id) { setClients([]); setLignes([]); return; }
    fetch(`${API}/secteur/${form.secteur_id}/clients`)
      .then(r => r.json())
      .then((cls: Client[]) => {
        setClients(cls);
        // Pré-remplir les lignes avec tous les clients du secteur
        setLignes(cls.map(c => ({
          client_id: c.id, client_nom: c.nom, telephone: c.telephone, adresse: c.adresse,
          produit_id: parseInt(form.produit_id) || 0,
          produit_nom: produits.find(p => p.id === parseInt(form.produit_id))?.nom || '',
          nb_caisses: 0, poids_kg: 0, note: '',
        })));
      }).catch(() => {});
  }, [form.secteur_id]);

  // Recalculer totaux automatiquement
  const totalCaisses = lignes.reduce((s, l) => s + (l.nb_caisses || 0), 0);
  const totalPoids   = lignes.reduce((s, l) => s + (l.poids_kg  || 0), 0);

  const handleLigne = (i: number, field: keyof LigneTournee, val: string | number) => {
    setLignes(prev => {
      const copy = [...prev];
      (copy[i] as any)[field] = val;
      // Auto-calculer poids si nb_caisses change (poids moyen caisse = 18 kg)
      if (field === 'nb_caisses') {
        copy[i].poids_kg = parseFloat(((val as number) * 18).toFixed(2));
      }
      return copy;
    });
  };

  const handleSave = async () => {
    if (!form.chauffeur_id || !form.camion_id || !form.secteur_id || !form.produit_id) {
      setErreur('Veuillez remplir tous les champs obligatoires.'); return;
    }
    const lignesValides = lignes.filter(l => l.nb_caisses > 0);
    if (lignesValides.length === 0) {
      setErreur('Ajoutez au moins une ligne avec des caisses.'); return;
    }
    setSaving(true); setErreur('');
    try {
      const res = await fetch(`${API}/tournee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          chauffeur_id: parseInt(form.chauffeur_id),
          camion_id:    parseInt(form.camion_id),
          secteur_id:   parseInt(form.secteur_id),
          produit_id:   parseInt(form.produit_id),
          poids_cible:  totalPoids,
          nb_caisses_total: totalCaisses,
          agent_id: agent?.id,
          lignes: lignesValides,
        }),
      });
      const created = await res.json();
      const secteur = secteurs.find(s => s.id === parseInt(form.secteur_id));
      const chauffeur = chauffeurs.find(c => c.id === parseInt(form.chauffeur_id));
      const camion = camions.find(c => c.id === parseInt(form.camion_id));
      setTournees(prev => [{
        ...created,
        secteur_nom: secteur?.nom, chauffeur_nom: chauffeur ? `${chauffeur.nom} ${chauffeur.prenom}` : '',
        camion_matricule: camion?.matricule, lignes: lignesValides
      }, ...prev]);
      setShowForm(false);
      resetForm();
    } catch {
      setErreur('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({ chauffeur_id: '', camion_id: '', secteur_id: '', produit_id: '',
      date_tournee: new Date().toISOString().split('T')[0], poids_cible: '', nb_caisses_total: '' });
    setLignes([]); setClients([]); setErreur('');
  };

  const imprimerTournee = (t: Tournee) => {
    const lignesHtml = (t.lignes || []).filter(l => l.nb_caisses > 0).map(l => `
      <tr>
        <td style="border:1px solid #ccc;padding:6px 8px;font-weight:bold">${l.client_nom}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;color:#1565c0">${l.telephone || '—'}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;color:#555">${l.adresse || '—'}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-weight:bold;color:#2e7d32">${l.nb_caisses}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;text-align:center">${l.poids_kg.toFixed(1)} kg</td>
        <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px">${l.note || ''}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;height:35px"></td>
      </tr>`).join('');

    const html = `<html><head><title>Bon de Tournée — EL FIRMA</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px}
    .hdr{text-align:center;border-bottom:2px solid #2e7d32;padding-bottom:12px;margin-bottom:14px}
    .logo{font-size:20px;font-weight:bold;color:#2e7d32}.sec{font-weight:bold;color:#2e7d32;border-bottom:1px solid #ccc;margin:10px 0 5px;padding-bottom:2px}
    .row{display:flex;gap:20px;margin:4px 0}.lbl{font-weight:bold}.sig{margin-top:28px;border-top:1px solid #000;padding-top:8px}</style>
    </head><body>
    <div class="hdr"><div class="logo">EL FIRMA — Abattoir de Volaille</div>
    <div style="font-size:15px;font-weight:bold;margin:4px 0">BON DE TOURNÉE</div>
    <div>Date : ${t.date_tournee} &nbsp;|&nbsp; Créé par : ${agent ? agent.nom + ' ' + (agent.prenom || '') : '—'}</div></div>
    <div class="sec">🚛 Affectation</div>
    <div class="row"><span><span class="lbl">Chauffeur :</span> ${t.chauffeur_nom || '—'}</span>
    <span><span class="lbl">Camion :</span> ${t.camion_matricule || '—'}</span>
    <span><span class="lbl">Secteur :</span> ${t.secteur_nom || '—'}</span></div>
    <div class="sec">📦 Charge totale planifiée</div>
    <div class="row">
    <span><span class="lbl">Nb caisses total :</span> <b style="color:#2e7d32;font-size:15px">${t.nb_caisses_total}</b></span>
    <span><span class="lbl">Poids cible :</span> <b style="color:#2e7d32;font-size:15px">${t.poids_cible.toFixed(1)} kg</b></span></div>
    <div class="sec">👥 Répartition par client</div>
    <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:12px">
    <thead><tr style="background:#2e7d32;color:#fff">
    <th style="padding:6px 8px;text-align:left">Client</th>
    <th style="padding:6px 8px;text-align:left">📞 Tél</th>
    <th style="padding:6px 8px;text-align:left">📍 Adresse</th>
    <th style="padding:6px 8px;text-align:center">Caisses</th>
    <th style="padding:6px 8px;text-align:center">Poids</th>
    <th style="padding:6px 8px;text-align:left">Note</th>
    <th style="padding:6px 8px;text-align:center">✔ Livré</th>
    </tr></thead><tbody>${lignesHtml}
    <tr style="background:#e8f5e9;font-weight:bold">
    <td style="border:1px solid #ccc;padding:6px 8px" colspan="3">TOTAL</td>
    <td style="border:1px solid #ccc;padding:6px 8px;text-align:center;color:#2e7d32;font-size:14px">${t.nb_caisses_total}</td>
    <td style="border:1px solid #ccc;padding:6px 8px;text-align:center;color:#2e7d32">${t.poids_cible.toFixed(1)} kg</td>
    <td style="border:1px solid #ccc" colspan="2"></td>
    </tr></tbody></table>
    <div class="sig"><div>Signature du chauffeur :</div><div style="height:45px"></div></div>
    <div class="sig"><div>Signature de l'agent logistique :</div><div style="height:45px"></div></div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const deleteTournee = async (id: number) => {
    if (!confirm('Supprimer cette tournée ?')) return;
    await fetch(`${API}/tournee/${id}`, { method: 'DELETE' }).catch(() => {});
    setTournees(prev => prev.filter(t => t.id !== id));
  };

  const posteType = agent?.poste_type || 'JOUR';

  // ── Stock Volaille ──
  const { stockJour, congeleLignes, surgeleLignes, compteurs, loading: stockLoading, refetch: refetchStock, saisirStock, enregistrerMouvement } = useStockVolaille();
  const [onglet, setOnglet] = useState<'tournees'|'stock'>('tournees');

  // Formulaire saisie stock
  const STOCK_FORM_INIT = { type_produit: 'CONGELE', designation: '', quantite_kg: '', nb_caisses: '', temperature_c: '', lot: '', note: '' };
  const [stockForm, setStockForm] = useState({ ...STOCK_FORM_INIT });
  const [showStockForm, setShowStockForm] = useState(false);
  const [stockSaving, setStockSaving] = useState(false);
  const [stockErreur, setStockErreur] = useState('');

  // Formulaire mouvement caisses
  const [showMvtForm, setShowMvtForm] = useState<number | null>(null);
  const [mvtForm, setMvtForm] = useState({ type_mvt: 'DEPART_FRIGO', nb_caisses: '', motif: '' });
  const [mvtSaving, setMvtSaving] = useState(false);

  const handleStockSave = async () => {
    if (!stockForm.designation || !stockForm.quantite_kg || !stockForm.nb_caisses) {
      setStockErreur('Désignation, quantité kg et nb caisses sont requis.'); return;
    }
    setStockSaving(true); setStockErreur('');
    try {
      await saisirStock({
        type_produit: stockForm.type_produit,
        designation: stockForm.designation,
        quantite_kg: parseFloat(stockForm.quantite_kg),
        nb_caisses: parseInt(stockForm.nb_caisses),
        temperature_c: stockForm.temperature_c ? parseFloat(stockForm.temperature_c) : undefined,
        lot: stockForm.lot || undefined,
        note: stockForm.note || undefined,
      });
      setShowStockForm(false);
      setStockForm({ ...STOCK_FORM_INIT });
    } catch { setStockErreur('Erreur lors de la sauvegarde.'); }
    setStockSaving(false);
  };

  const handleMvtSave = async (stockId: number) => {
    if (!mvtForm.nb_caisses) return;
    setMvtSaving(true);
    try {
      await enregistrerMouvement(stockId, {
        type_mvt: mvtForm.type_mvt as 'DEPART_FRIGO' | 'RETOUR_FRIGO',
        nb_caisses: parseInt(mvtForm.nb_caisses),
        motif: mvtForm.motif || undefined,
      });
      setShowMvtForm(null);
      setMvtForm({ type_mvt: 'DEPART_FRIGO', nb_caisses: '', motif: '' });
    } catch { /* hors-ligne */ }
    setMvtSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-elfirma-green text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="EL FIRMA" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold">EL FIRMA — Logistique</h1>
              <p className="text-green-200 text-xs">Gestion des tournées & affectations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
              posteType === 'JOUR' ? 'bg-amber-400 text-amber-900' : 'bg-indigo-400 text-white'
            }`}>
              {posteType === 'JOUR' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {agent?.nom} {agent?.prenom} — {agent?.poste_nom}
            </span>
            <button onClick={() => { logout(); navigate('/'); }}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-sm">
              <LogOut className="w-4 h-4" /> Déconnexion
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Nav onglets */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1.5 w-fit">
          {[
            { id: 'tournees', label: 'Tournées', icon: <ClipboardList className="w-4 h-4"/> },
            { id: 'stock',    label: 'Stock Volaille', icon: <Thermometer className="w-4 h-4"/> },
          ].map(t => (
            <button key={t.id} onClick={() => setOnglet(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                onglet === t.id ? 'bg-elfirma-green text-white shadow' : 'text-gray-600 hover:bg-gray-100'}` }>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ═══ ONGLET STOCK VOLAILLE ═══ */}
        {onglet === 'stock' && (
          <div className="space-y-5">

            {/* Compteurs caisses temps réel */}
            {compteurs && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Stock total</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{compteurs.total_stock}</p>
                  <p className="text-xs text-gray-400">caisses</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-500">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">En circulation</p>
                  <p className="text-3xl font-bold text-orange-600 mt-1">{compteurs.en_circulation}</p>
                  <p className="text-xs text-gray-400">frigos en route</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Retournées</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{compteurs.retournees_frigo}</p>
                  <p className="text-xs text-gray-400">frigos rentrés</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-elfirma-green">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Disponibles</p>
                  <p className="text-3xl font-bold text-elfirma-green mt-1">{compteurs.disponibles}</p>
                  <p className="text-xs text-gray-400">caisses libres</p>
                </div>
              </div>
            )}

            {/* Ventilation Congelé / Surgelé */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-xl shadow-sm p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Box className="w-5 h-5 text-blue-700" />
                  <h3 className="font-bold text-blue-800">Congelé</h3>
                  <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{compteurs?.congele_caisses ?? 0} caisses</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">{Number(compteurs?.congele_kg ?? 0).toFixed(0)} kg</p>
                <p className="text-xs text-blue-600 mt-1">{congeleLignes.length} références</p>
              </div>
              <div className="bg-indigo-50 rounded-xl shadow-sm p-4 border border-indigo-200">
                <div className="flex items-center gap-2 mb-3">
                  <Thermometer className="w-5 h-5 text-indigo-700" />
                  <h3 className="font-bold text-indigo-800">Surgelé</h3>
                  <span className="ml-auto bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{compteurs?.surgele_caisses ?? 0} caisses</span>
                </div>
                <p className="text-2xl font-bold text-indigo-700">{Number(compteurs?.surgele_kg ?? 0).toFixed(0)} kg</p>
                <p className="text-xs text-indigo-600 mt-1">{surgeleLignes.length} références</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => { setShowStockForm(true); setStockForm({ ...STOCK_FORM_INIT }); }}
                className="flex items-center gap-2 bg-elfirma-green text-white px-4 py-2 rounded-xl font-semibold hover:bg-elfirma-darkGreen text-sm">
                <Plus className="w-4 h-4" /> Saisir production
              </button>
              <button onClick={refetchStock} disabled={stockLoading}
                className="flex items-center gap-2 bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${stockLoading ? 'animate-spin' : ''}`} /> Actualiser
              </button>
            </div>

            {/* Formulaire saisie production */}
            {showStockForm && (
              <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-6 space-y-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Box className="w-5 h-5 text-elfirma-green"/> Saisie production du jour</h3>
                {stockErreur && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>{stockErreur}</div>}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Type *</label>
                    <select value={stockForm.type_produit} onChange={e => setStockForm({...stockForm, type_produit: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="CONGELE">Congelé (−18°C)</option>
                      <option value="SURGELE">Surgelé (−24°C)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Désignation *</label>
                    <input type="text" placeholder="Ex: Poulet entier, Découpes..."
                      value={stockForm.designation} onChange={e => setStockForm({...stockForm, designation: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Quantité (kg) *</label>
                    <input type="number" min="0" step="0.1" placeholder="0"
                      value={stockForm.quantite_kg} onChange={e => setStockForm({...stockForm, quantite_kg: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Nb caisses *</label>
                    <input type="number" min="0" placeholder="0"
                      value={stockForm.nb_caisses} onChange={e => setStockForm({...stockForm, nb_caisses: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Température (°C)</label>
                    <input type="number" step="0.1" placeholder="-18"
                      value={stockForm.temperature_c} onChange={e => setStockForm({...stockForm, temperature_c: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">N° Lot</label>
                    <input type="text" placeholder="LOT-2026-XXX"
                      value={stockForm.lot} onChange={e => setStockForm({...stockForm, lot: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Note</label>
                  <input type="text" placeholder="Observations..."
                    value={stockForm.note} onChange={e => setStockForm({...stockForm, note: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={handleStockSave} disabled={stockSaving}
                    className="flex-1 bg-elfirma-green text-white py-2.5 rounded-xl font-bold hover:bg-elfirma-darkGreen disabled:opacity-50 flex items-center justify-center gap-2">
                    {stockSaving ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>Sauvegarde...</> : <><CheckCircle className="w-4 h-4"/>Enregistrer</>}
                  </button>
                  <button onClick={() => setShowStockForm(false)}
                    className="px-5 py-2.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50">
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Tableau stock du jour */}
            {stockJour.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-700">Stock du jour</h3>
                  <span className="text-xs text-gray-400">{new Date().toLocaleDateString('fr-TN')}</span>
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
                        <th className="px-4 py-3 text-center">Temp</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockJour.map((s: StockLine) => (
                        <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              s.type_produit === 'CONGELE' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'}`}>
                              {s.type_produit === 'CONGELE' ? '❄️ Congelé' : '🧊 Surgelé'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">{s.designation}</td>
                          <td className="px-4 py-3 text-center font-bold text-orange-600">{Number(s.quantite_kg).toFixed(0)} kg</td>
                          <td className="px-4 py-3 text-center font-bold text-blue-600">{s.nb_caisses}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-semibold ${s.nb_caisses_en_circulation > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                              {s.nb_caisses_en_circulation}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-semibold ${s.nb_caisses_retournees > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              {s.nb_caisses_retournees}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {s.temperature_c !== undefined && s.temperature_c !== null ? `${s.temperature_c}°C` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => { setShowMvtForm(s.id); setMvtForm({ type_mvt: 'DEPART_FRIGO', nb_caisses: '', motif: '' }); }}
                              className="flex items-center gap-1 text-xs px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200">
                              <ArrowUpCircle className="w-3 h-3"/>Départ/Retour
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal mouvement caisses */}
            {showMvtForm !== null && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
                  <h3 className="font-bold text-gray-800 mb-4">Mouvement de caisses</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Type de mouvement</label>
                      <div className="flex gap-2">
                        {(['DEPART_FRIGO','RETOUR_FRIGO'] as const).map(t => (
                          <button key={t} onClick={() => setMvtForm({...mvtForm, type_mvt: t})}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 ${
                              mvtForm.type_mvt === t ? (t === 'DEPART_FRIGO' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-green-500 bg-green-50 text-green-700') : 'border-gray-200 text-gray-500'}` }>
                            {t === 'DEPART_FRIGO' ? <><ArrowUpCircle className="w-4 h-4 inline mr-1"/>Départ</> : <><ArrowDownCircle className="w-4 h-4 inline mr-1"/>Retour</>}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Nb caisses *</label>
                      <input type="number" min="1" placeholder="0"
                        value={mvtForm.nb_caisses} onChange={e => setMvtForm({...mvtForm, nb_caisses: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Motif</label>
                      <input type="text" placeholder="Tournee #12, Frigo X..."
                        value={mvtForm.motif} onChange={e => setMvtForm({...mvtForm, motif: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button onClick={() => handleMvtSave(showMvtForm!)} disabled={mvtSaving || !mvtForm.nb_caisses}
                      className="flex-1 bg-elfirma-green text-white py-2.5 rounded-xl font-bold disabled:opacity-50">
                      {mvtSaving ? 'Enregistrement...' : 'Confirmer'}
                    </button>
                    <button onClick={() => setShowMvtForm(null)}
                      className="px-5 py-2.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50">
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ═══ ONGLET TOURNEES ═══ */}
        {onglet === 'tournees' && (
          <div className="space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-elfirma-green">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Tournées aujourd'hui</p>
            <p className="text-3xl font-bold text-elfirma-green mt-1">{tournees.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Caisses planifiées</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">
              {tournees.reduce((s, t) => s + (t.nb_caisses_total || 0), 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-500">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Poids total (kg)</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">
              {tournees.reduce((s, t) => s + (t.poids_cible || 0), 0).toFixed(0)}
            </p>
          </div>
        </div>

        {/* Bouton nouvelle tournée */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-elfirma-green" /> Tournées du jour
          </h2>
          <button onClick={() => { setShowForm(true); resetForm(); }}
            className="bg-elfirma-green text-white px-4 py-2 rounded-xl font-semibold hover:bg-elfirma-darkGreen flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvelle tournée
          </button>
        </div>

        {/* Formulaire nouvelle tournée */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-6 space-y-5">
            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
              <Truck className="w-5 h-5 text-elfirma-green" /> Planifier une tournée
            </h3>

            {erreur && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {erreur}
              </div>
            )}

            {/* Ligne 1 : Chauffeur + Camion + Date */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Chauffeur *
                </label>
                <select value={form.chauffeur_id} onChange={e => setForm({...form, chauffeur_id: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-elfirma-green" required>
                  <option value="">Sélectionner...</option>
                  {chauffeurs.map(c => <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" /> Camion *
                </label>
                <select value={form.camion_id} onChange={e => setForm({...form, camion_id: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-elfirma-green" required>
                  <option value="">Sélectionner...</option>
                  {camions.map(c => <option key={c.id} value={c.id}>{c.matricule} ({c.capacite_kg} kg)</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">📅 Date tournée</label>
                <input type="date" value={form.date_tournee} onChange={e => setForm({...form, date_tournee: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-elfirma-green" />
              </div>
            </div>

            {/* Ligne 2 : Secteur + Produit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Secteur de livraison *
                </label>
                <select value={form.secteur_id} onChange={e => setForm({...form, secteur_id: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-elfirma-green" required>
                  <option value="">Sélectionner...</option>
                  {secteurs.map(s => <option key={s.id} value={s.id}>{s.nom} — Zone {s.zone}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" /> Produit volaille *
                </label>
                <select value={form.produit_id} onChange={e => setForm({...form, produit_id: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-elfirma-green" required>
                  <option value="">Sélectionner...</option>
                  {produits.map(p => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
                </select>
              </div>
            </div>

            {/* Checklist clients du secteur */}
            {lignes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Répartition par client — {lignes.filter(l=>l.nb_caisses>0).length}/{lignes.length} clients affectés
                  </label>
                  <div className="flex gap-3 text-xs font-bold">
                    <span className="text-elfirma-green">🗂 {totalCaisses} caisses</span>
                    <span className="text-orange-600"><Scale className="w-3 h-3 inline" /> {totalPoids.toFixed(1)} kg</span>
                  </div>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {lignes.map((l, i) => (
                    <div key={l.client_id} className={`rounded-xl border p-3 transition-all ${
                      l.nb_caisses > 0 ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{l.client_nom}</p>
                          <p className="text-xs text-gray-500">
                            📞 {l.telephone} &nbsp;|&nbsp; 📍 {l.adresse}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div>
                            <p className="text-xs text-gray-500 text-center mb-0.5">Caisses</p>
                            <input type="number" min="0" value={l.nb_caisses || ''}
                              onChange={e => handleLigne(i, 'nb_caisses', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-16 px-2 py-1.5 text-center text-sm font-bold border-2 border-gray-300 rounded-lg focus:ring-1 focus:ring-elfirma-green focus:border-elfirma-green" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 text-center mb-0.5">Poids kg</p>
                            <input type="number" min="0" step="0.1" value={l.poids_kg || ''}
                              onChange={e => handleLigne(i, 'poids_kg', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="w-20 px-2 py-1.5 text-center text-sm border-2 border-gray-300 rounded-lg focus:ring-1 focus:ring-elfirma-green" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Note</p>
                            <input type="text" value={l.note}
                              onChange={e => handleLigne(i, 'note', e.target.value)}
                              placeholder="ex: urgent"
                              className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
                          </div>
                        </div>
                        {l.nb_caisses > 0 && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totaux récapitulatifs */}
                <div className="mt-3 bg-elfirma-green/10 border border-elfirma-green/30 rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-700">Total planifié</span>
                  <div className="flex gap-6">
                    <span className="text-base font-bold text-elfirma-green">{totalCaisses} caisses</span>
                    <span className="text-base font-bold text-orange-600">{totalPoids.toFixed(1)} kg</span>
                  </div>
                </div>
              </div>
            )}

            {/* Boutons */}
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-elfirma-green text-white py-3 rounded-xl font-bold hover:bg-elfirma-darkGreen disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Sauvegarde...</> : <><CheckCircle className="w-4 h-4" /> Valider la tournée</>}
              </button>
              <button onClick={() => { setShowForm(false); resetForm(); }}
                className="px-6 py-3 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 font-medium">
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Liste des tournées */}
        {tournees.length === 0 && !showForm ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Aucune tournée planifiée aujourd'hui</p>
            <p className="text-gray-300 text-sm mt-1">Cliquez sur « Nouvelle tournée » pour commencer</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tournees.map(t => (
              <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Header tournée */}
                <div className="bg-gradient-to-r from-elfirma-green to-elfirma-darkGreen px-5 py-3 flex justify-between items-center">
                  <div className="flex items-center gap-4 text-white">
                    <div>
                      <p className="font-bold text-sm">🚛 {t.chauffeur_nom || `Chauffeur #${t.chauffeur_id}`}</p>
                      <p className="text-green-200 text-xs">{t.camion_matricule || `Camion #${t.camion_id}`}</p>
                    </div>
                    <div className="border-l border-green-400 pl-4">
                      <p className="font-bold text-sm">📍 {t.secteur_nom || `Secteur #${t.secteur_id}`}</p>
                      <p className="text-green-200 text-xs">{t.date_tournee}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      t.statut === 'planifiee' ? 'bg-amber-400 text-amber-900' :
                      t.statut === 'en_cours'  ? 'bg-blue-400 text-white' :
                      'bg-green-300 text-green-900'
                    }`}>{t.statut === 'planifiee' ? '⏳ Planifiée' : t.statut === 'en_cours' ? '🔄 En cours' : '✅ Terminée'}</span>
                    <button onClick={() => imprimerTournee(t)}
                      className="bg-white/20 hover:bg-white/30 text-white p-1.5 rounded-lg">
                      <Printer className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteTournee(t.id)}
                      className="bg-red-500/60 hover:bg-red-500 text-white p-1.5 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Résumé + lignes clients */}
                <div className="p-4">
                  <div className="flex gap-6 mb-3 text-sm">
                    <span className="font-bold text-elfirma-green">🗂 {t.nb_caisses_total} caisses</span>
                    <span className="font-bold text-orange-600">⚖️ {t.poids_cible?.toFixed(1)} kg</span>
                    <span className="text-gray-500">{(t.lignes || []).filter(l => l.nb_caisses > 0).length} clients</span>
                  </div>
                  {(t.lignes || []).filter(l => l.nb_caisses > 0).length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left px-3 py-2 border border-gray-200 font-semibold">Client</th>
                            <th className="text-left px-3 py-2 border border-gray-200 font-semibold">📞 Tél</th>
                            <th className="text-center px-3 py-2 border border-gray-200 font-semibold">Caisses</th>
                            <th className="text-center px-3 py-2 border border-gray-200 font-semibold">Poids</th>
                            <th className="text-left px-3 py-2 border border-gray-200 font-semibold">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(t.lignes || []).filter(l => l.nb_caisses > 0).map((l, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 border border-gray-200 font-medium">{l.client_nom}</td>
                              <td className="px-3 py-2 border border-gray-200 text-blue-600">{l.telephone || '—'}</td>
                              <td className="px-3 py-2 border border-gray-200 text-center font-bold text-elfirma-green">{l.nb_caisses}</td>
                              <td className="px-3 py-2 border border-gray-200 text-center">{l.poids_kg?.toFixed(1)} kg</td>
                              <td className="px-3 py-2 border border-gray-200 text-gray-500">{l.note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

          </div>
        )}

      </div>
    </div>
  );
}
