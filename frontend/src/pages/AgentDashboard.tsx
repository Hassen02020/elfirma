import { useState, useEffect } from 'react';
import API_BASE from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Scale, Package, ArrowRight, LogOut, CheckCircle, Printer, AlertTriangle, MapPin, TrendingDown, TrendingUp, History, Bell, Plus, Trash2, Sun, Moon } from 'lucide-react';
import AlerteBanner from '../components/AlerteBanner';
import { useAlertes } from '../hooks/useAlertes';

export default function AgentDashboard() {
  const { logout, agent } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'depart' | 'retour'>('depart');
  const [formData, setFormData] = useState({
    camionId: '',
    chauffeurId: '',
    nbCaissesChargees: '',
    nbCaissesRetournees: '',
    poidsFacture: '',
    poidsPese: '',
    poidsVide: '',
    poidsCharge: '',
    poidsCaisses: '',
    poidsProduit: '',
    date: new Date().toISOString().split('T')[0],
    heure: new Date().toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }),
  });
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'pending' | 'success'>('idle');
  const [departEnAttente, setDepartEnAttente] = useState<{[key: string]: {nbCaisses: string, date: string, camionId: string, chauffeurId: string, poidsFacture: string, poidsVide: string, poidsCharge: string, poidsProduit: string} | null}>({});
  const [historiqueLivraisons, setHistoriqueLivraisons] = useState<{[key: string]: {depart: any, retour: any, ecart: number, validee: boolean}}>({});
  const [blockageMessage, setBlockageMessage] = useState('');

  type EcartRecord = {
    chauffeurNom: string;
    camionMatricule: string;
    nbCaissesChargees: number;
    nbCaissesRetournees: number;
    ecart: number;
    date: string;
    heure: string;
    localisation: string;
  };

  const [ecartsCaisses, setEcartsCaisses] = useState<EcartRecord[]>([]);

  // Validation chargement / retour
  const { alertes } = useAlertes();
  const [_livraisonIdCourant, setLivraisonIdCourant] = useState<number | null>(null);

  // Types
  type CaisseLaissee = { secteur_id: number; secteur_nom: string; client_id: number; client_nom: string; telephone: string; adresse: string; nb_caisses: number; autre: boolean };

  const [caissesLaissees, setCaissesLaissees] = useState<CaisseLaissee[]>([]);

  // Tournée du jour chargée automatiquement selon le camion
  type TourneeDuJour = {
    id: number; chauffeur_nom: string; camion_matricule: string;
    secteur_nom: string; produit_nom: string; agent_nom: string; agent_prenom: string;
    poids_cible: number; nb_caisses_total: number;
    lignes: { client_nom: string; telephone: string; adresse: string; nb_caisses: number; poids_kg: number; note: string }[];
  };
  const [tourneeDuJour, setTourneeDuJour] = useState<TourneeDuJour | null>(null);
  const [camionsList, setCamionsList] = useState<{id:number;matricule:string;chauffeur_nom?:string;chauffeur_prenom?:string}[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/camion`)
      .then(r => r.json()).then((data: any[]) => setCamionsList(data)).catch(() => {});
  }, []);

  // Charger la tournée du jour quand le camion change
  const chargerTourneeCamion = (camionId: string) => {
    if (!camionId) { setTourneeDuJour(null); return; }
    const today = new Date().toISOString().split('T')[0];
    fetch(`${API_BASE}/api/tournee?date=${today}`)
      .then(r => r.json())
      .then((tournees: any[]) => {
        const t = tournees.find((t: any) => String(t.camion_id) === String(camionId));
        if (t) {
          fetch(`${API_BASE}/api/tournee/${t.id}`)
            .then(r => r.json())
            .then(detail => setTourneeDuJour(detail))
            .catch(() => setTourneeDuJour(t));
        } else {
          setTourneeDuJour(null);
        }
      }).catch(() => setTourneeDuJour(null));
  };

  const getCamionInfo = (id: string) => {
    const c = camionsList.find(x => String(x.id) === String(id));
    if (c) return {
      matricule: c.matricule,
      chauffeur: [c.chauffeur_nom, c.chauffeur_prenom].filter(Boolean).join(' ') || `Chauffeur ${id}`
    };
    return { matricule: `Camion ${id}`, chauffeur: `Chauffeur ${id}` };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    

    // Bloquer la soumission si le camion a un départ en attente
    if (mode === 'depart' && formData.camionId && departEnAttente[formData.camionId]) {
      setBlockageMessage(`⚠️ Ce camion a un départ en attente depuis le ${departEnAttente[formData.camionId]!.date}. Il doit d'abord retourner ${departEnAttente[formData.camionId]!.nbCaisses} caisses avant de pouvoir repartir.`);
      return;
    }
    
    // Bloquer le nouveau départ si le retour précédent n'est pas validé
    if (mode === 'depart' && formData.camionId) {
      const livraisonNonValidee = Object.values(historiqueLivraisons).find(
        livraison => livraison.depart.camionId === formData.camionId && !livraison.validee
      );
      if (livraisonNonValidee) {
        setBlockageMessage(`⚠️ Ce camion a un retour en attente de validation depuis le ${livraisonNonValidee.retour.date}. Le contrôleur doit valider ce retour avant un nouveau départ.`);
        return;
      }
    }
    
    setSubmissionStatus('pending');
    
    // Enregistrer le départ en attente si mode départ
    if (mode === 'depart' && formData.camionId) {
      setDepartEnAttente(prev => ({
        ...prev,
        [formData.camionId]: {
          nbCaisses: formData.nbCaissesChargees,
          date: formData.date,
          camionId: formData.camionId,
          chauffeurId: formData.chauffeurId,
          poidsFacture: formData.poidsFacture,
          poidsVide: formData.poidsVide,
          poidsCharge: formData.poidsCharge,
          poidsProduit: formData.poidsProduit
        }
      }));
    }
    
    // Pour le mode retour: l'historique et la libération du départ
    // sont gérés par validerRetour() appelée après impression (onafterprint)
    // On ne touche pas à departEnAttente ici pour éviter le double traitement

    // Utiliser le nouvel endpoint de validation de pesée pour le mode depart
    const endpoint = mode === 'depart' ? '/api/pesee/valider-sortie' : '/api/delivery';
    
    // Payload adapté selon l'endpoint
    const payload = mode === 'depart' 
      ? {
          camion_id: parseInt(formData.camionId),
          chauffeur_id: parseInt(formData.chauffeurId) || null,
          agent_id: agent?.id || null,
          poste_id: agent?.poste_id || null,
          poids_vide: 0, // À saisir dans une phase précédente
          poids_charge: parseFloat(formData.poidsPese) || 0,
          poids_factures: parseFloat(formData.poidsFacture) || 0,
          nb_caisses_chargees: parseInt(formData.nbCaissesChargees) || 0,
          type: mode,
        }
      : {
          camion_id: parseInt(formData.camionId),
          chauffeur_id: parseInt(formData.chauffeurId) || null,
          poids_facture: parseFloat(formData.poidsFacture) || 0,
          poids_pese: parseFloat(formData.poidsPese) || 0,
          nb_caisses_chargees: parseInt(formData.nbCaissesChargees) || 0,
          nb_caisses_retournees: parseInt(formData.nbCaissesRetournees) || 0,
          type: mode,
          agent_id: agent?.id || null,
          poste_id: agent?.poste_id || null,
        };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload),
      });
      const response = await res.json();

      // Gérer les erreurs de blocage
      if (!res.ok && response.error && response.error.includes('BLOCAGE')) {
        setBlockageMessage(response.error);
        setSubmissionStatus('idle');
        return;
      }

      const livraison = response.livraison || response;
      const livId = livraison?.id ?? null;
      setLivraisonIdCourant(livId);

      // Si alerte générée, afficher un message
      if (response.alerte) {
        setBlockageMessage(`⚠️ ${response.alerte.message}. En attente de validation par le contrôleur.`);
      }

      setSubmissionStatus('success');
    } catch {
      setSubmissionStatus('success'); // continuer même si API indispo
    }

    setTimeout(() => {
      setSubmissionStatus('idle');
    }, 3000);
  };


  const handleModeChange = (newMode: 'depart' | 'retour') => {
    setMode(newMode);
    setBlockageMessage('');
    setCaissesLaissees([]);

    if (newMode === 'retour' && formData.camionId && departEnAttente[formData.camionId]) {
      const departData = departEnAttente[formData.camionId]!;
      setFormData(prev => ({
        ...prev,
        nbCaissesChargees: departData.nbCaisses,
        camionId: prev.camionId,
        chauffeurId: prev.chauffeurId,
        nbCaissesRetournees: '',
        poidsFacture: departData.poidsFacture,
        poidsPese: '',
        date: new Date().toISOString().split('T')[0],
        heure: new Date().toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }),
      }));
    } else {
      setFormData({
        camionId: '',
        chauffeurId: '',
        nbCaissesChargees: '',
        nbCaissesRetournees: '',
        poidsFacture: '',
        poidsPese: '',
        poidsVide: '',
        poidsCharge: '',
        poidsCaisses: '',
        poidsProduit: '',
        date: new Date().toISOString().split('T')[0],
        heure: new Date().toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }),
      });
    }
  };

  const handleCamionChange = (camionId: string) => {
    setFormData({ ...formData, camionId });
    chargerTourneeCamion(camionId);
    
    // Vérifier si le camion a un départ en attente
    if (mode === 'depart' && departEnAttente[camionId]) {
      const departData = departEnAttente[camionId];
      setBlockageMessage(`⚠️ Ce camion a un départ en attente depuis le ${departData.date}. Il doit d'abord retourner ${departData.nbCaisses} caisses avant de pouvoir repartir.`);
    } 
    // Vérifier si le camion a un retour non validé
    else if (mode === 'depart') {
      const livraisonNonValidee = Object.values(historiqueLivraisons).find(
        livraison => livraison.depart.camionId === camionId && !livraison.validee
      );
      if (livraisonNonValidee) {
        setBlockageMessage(`⚠️ Ce camion a un retour en attente de validation depuis le ${livraisonNonValidee.retour.date}. Le contrôleur doit valider ce retour avant un nouveau départ.`);
      } else {
        setBlockageMessage('');
      }
    } else {
      setBlockageMessage('');
    }
    
    // Si mode retour et camion a un départ en attente, charger les données
    if (mode === 'retour' && departEnAttente[camionId]) {
      const departData = departEnAttente[camionId];
      setFormData(prev => ({
        ...prev,
        camionId,
        nbCaissesChargees: departData.nbCaisses,
      }));
    }
  };

  const calculerEcartCaisses = () => {
    const chargees = parseInt(formData.nbCaissesChargees) || 0;
    const retournees = parseInt(formData.nbCaissesRetournees) || 0;
    return chargees - retournees;
  };

  const calculerEcartPoids = () => {
    const facture = parseFloat(formData.poidsFacture) || 0;
    const pese = parseFloat(formData.poidsPese) || 0;
    return facture - pese;
  };

  const imprimerLivrableDepart = () => {
    const camionInfo  = getCamionInfo(formData.camionId);
    const agentPoste  = agent ? `${agent.nom} ${agent.prenom || ''} — ${agent.poste_nom || 'Agent pesée'}` : 'Agent pesée';

    // Tableau clients départ : chaque client avec case caisses livrées + signature
    const nbTotalCharge = parseInt(formData.nbCaissesChargees) || 0;
    const affectationHtml = `
      <div class="section-green">📋 DÉTAIL CLIENTS — À REMPLIR À LA LIVRAISON</div>
      <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:12px">
        <thead>
          <tr style="background:#1b5e20;color:#fff">
            <th style="border:1px solid #2e7d32;padding:6px 8px;text-align:left">Client</th>
            <th style="border:1px solid #2e7d32;padding:6px 8px;text-align:left">📞 Téléphone</th>
            <th style="border:1px solid #2e7d32;padding:6px 8px;text-align:center">Caisses<br/>livrées</th>
            <th style="border:1px solid #2e7d32;padding:6px 8px;text-align:center">Caisses<br/>retour ✓</th>
            <th style="border:1px solid #2e7d32;padding:6px 8px;text-align:center">Signature<br/>client</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="border:1px solid #ccc;padding:6px 8px;height:26px"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td></tr>
          <tr><td style="border:1px solid #ccc;padding:6px 8px;height:26px"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td></tr>
          <tr><td style="border:1px solid #ccc;padding:6px 8px;height:26px"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td></tr>
          <tr><td style="border:1px solid #ccc;padding:6px 8px;height:26px"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td></tr>
          <tr><td style="border:1px solid #ccc;padding:6px 8px;height:26px"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td></tr>
          <tr style="background:#e8f5e9;font-weight:bold">
            <td colspan="2" style="border:1px solid #ccc;padding:6px 8px;color:#1b5e20">TOTAL CHARGÉ AU DÉPART</td>
            <td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:15px;color:#1b5e20">${nbTotalCharge}</td>
            <td colspan="2" style="border:1px solid #ccc"></td>
          </tr>
        </tbody>
      </table>`;

    const printContent = `
      <html>
        <head>
          <title>BON DE DÉPART - EL FIRMA</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size:13px; }
            .header { text-align: center; border-bottom: 3px solid #1b5e20; padding-bottom: 15px; margin-bottom: 15px; }
            .logo { font-size: 22px; font-weight: bold; color: #1b5e20; letter-spacing:1px; }
            .section { font-weight:bold; color:#1b5e20; border-bottom:1px solid #a5d6a7; margin:14px 0 6px; padding-bottom:3px; font-size:13px; }
            .section-green { font-weight:bold; color:#1b5e20; border-bottom:2px solid #1b5e20; margin:14px 0 6px; padding-bottom:3px; font-size:14px; }
            .info { margin: 5px 0; }
            .info-label { font-weight: bold; min-width:150px;display:inline-block; }
            .badge { background:#e8f5e9; color:#1b5e20; padding:2px 10px; border-radius:10px; font-size:12px; font-weight:bold; border:1px solid #a5d6a7; }
            .signature { margin-top: 28px; border-top: 1px solid #555; padding-top: 8px; display:inline-block; min-width:200px; margin-right:40px; }
            .poids-box { background:#e8f5e9; border:1px solid #a5d6a7; border-radius:6px; padding:10px 14px; margin:8px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">🐓 EL FIRMA — Abattoir de Volaille</div>
            <div style="font-size:16px;font-weight:bold;margin:6px 0;color:#333">BON DE DÉPART</div>
            <div style="color:#555">Date: <b>${formData.date}</b> &nbsp;|&nbsp; Heure: <b>${formData.heure}</b></div>
            <div style="font-size:11px;color:#777;margin-top:4px">Agent pesée: <b>${agentPoste}</b></div>
          </div>

          <div class="section">� Camion &amp; Chauffeur</div>
          <div class="info"><span class="info-label">Matricule:</span> <span class="badge">${camionInfo.matricule}</span></div>
          <div class="info"><span class="info-label">Chauffeur:</span> ${camionInfo.chauffeur}</div>

          <div class="section">⚖️ Pesées à la bascule</div>
          <div class="poids-box">
            <div class="info"><span class="info-label">Poids à vide:</span> <b>${formData.poidsVide} kg</b></div>
            <div class="info"><span class="info-label">Poids après chargement:</span> <b>${formData.poidsCharge} kg</b></div>
            <div class="info"><span class="info-label">Poids unitaire caisse:</span> ${formData.poidsCaisses || '0'} kg × ${formData.nbCaissesChargees || '0'} = <b>${((parseFloat(formData.poidsCaisses)||0)*(parseInt(formData.nbCaissesChargees)||0)).toFixed(2)} kg</b></div>
            <div class="info"><span class="info-label">Caisses chargées:</span> <b style="font-size:15px;color:#1b5e20">${formData.nbCaissesChargees}</b></div>
            <div class="info" style="color:#1b5e20;font-weight:bold"><span class="info-label">Poids net produit:</span> <b style="font-size:15px">${((parseFloat(formData.poidsCharge)||0) - (parseFloat(formData.poidsVide)||0) - ((parseFloat(formData.poidsCaisses)||0)*(parseInt(formData.nbCaissesChargees)||0))).toFixed(2)} kg</b></div>
          </div>

          ${affectationHtml}

          <div style="margin-top:30px">
            <div class="signature">Signature agent pesée:<div style="height:45px"></div></div>
            <div class="signature">Signature chauffeur:<div style="height:45px"></div></div>
            <div class="signature">Signature contrôleur:<div style="height:45px"></div></div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();

      // Valider automatiquement après impression
      printWindow.onafterprint = () => {
        validerDepart();
      };
    }
  };

  const validerDepart = () => {
    // Enregistrer le départ comme validé
    setDepartEnAttente(prev => ({
      ...prev,
      [formData.camionId]: {
        nbCaisses: formData.nbCaissesChargees,
        date: formData.date,
        camionId: formData.camionId,
        chauffeurId: formData.chauffeurId,
        poidsFacture: formData.poidsFacture,
        poidsVide: formData.poidsVide,
        poidsCharge: formData.poidsCharge,
        poidsProduit: formData.poidsProduit
      }
    }));

    // Réinitialiser le formulaire
    setFormData({
      camionId: '',
      chauffeurId: '',
      nbCaissesChargees: '',
      nbCaissesRetournees: '',
      poidsFacture: '',
      poidsPese: '',
      poidsVide: '',
      poidsCharge: '',
      poidsCaisses: '',
      poidsProduit: '',
      date: new Date().toISOString().split('T')[0],
      heure: new Date().toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }),
    });
    setBlockageMessage('');
  };

  const imprimerLivrableRetour = () => {
    const camionInfo = getCamionInfo(formData.camionId);
    const agentPoste = agent ? `${agent.nom} ${agent.prenom || ''} — ${agent.poste_nom || 'Agent pesée'}` : 'Agent pesée';
    const nbCharge   = parseInt(formData.nbCaissesChargees || '0');
    const nbRetourne = parseInt(formData.nbCaissesRetournees || '0');
    const ecart      = nbCharge - nbRetourne;

    // Tableau clients retour : rempli manuellement par l'agent à l'arrivée
    const clientsRetourHtml = caissesLaissees.length > 0
      ? `<table style="width:100%;border-collapse:collapse;font-size:11.5px;margin-top:6px">
          <thead>
            <tr style="background:#1565c0;color:#fff">
              <th style="border:1px solid #1565c0;padding:6px 8px;text-align:left">Client</th>
              <th style="border:1px solid #1565c0;padding:6px 8px;text-align:center">Caisses<br/>au départ</th>
              <th style="border:1px solid #1565c0;padding:6px 8px;text-align:center">Caisses<br/>retour</th>
              <th style="border:1px solid #1565c0;padding:6px 8px;text-align:center">Écart</th>
              <th style="border:1px solid #1565c0;padding:6px 8px;text-align:center">Signature<br/>client</th>
            </tr>
          </thead>
          <tbody>
            ${caissesLaissees.map(l => {
              const ecartClient = l.nb_caisses;
              return `<tr>
                <td style="border:1px solid #ccc;padding:6px 8px;font-weight:bold">${l.client_nom||'—'}</td>
                <td style="border:1px solid #ccc;padding:6px 8px;text-align:center"></td>
                <td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-weight:bold;color:#1b5e20">${ecartClient > 0 ? ecartClient : '<span style="color:#aaa">—</span>'}</td>
                <td style="border:1px solid #ccc;padding:6px 8px;text-align:center;color:#c62828;font-weight:bold"></td>
                <td style="border:1px solid #ccc;padding:6px 8px;height:28px;background:#f9fff9"></td>
              </tr>`;
            }).join('')}
            <tr style="background:#e3f2fd;font-weight:bold">
              <td style="border:1px solid #ccc;padding:6px 8px;color:#1565c0">TOTAL</td>
              <td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:14px;color:#1b5e20">${nbCharge}</td>
              <td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:14px;color:#1b5e20">${nbRetourne}</td>
              <td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:14px;color:${ecart===0?'#1b5e20':'#c62828'}">${ecart===0?'0':'-'+ecart}</td>
              <td style="border:1px solid #ccc"></td>
            </tr>
          </tbody>
        </table>`
      : `<table style="width:100%;border-collapse:collapse;font-size:11.5px;margin-top:6px">
          <thead>
            <tr style="background:#1565c0;color:#fff">
              <th style="border:1px solid #1565c0;padding:6px 8px;text-align:left">Client</th>
              <th style="border:1px solid #1565c0;padding:6px 8px;text-align:center">Caisses au départ</th>
              <th style="border:1px solid #1565c0;padding:6px 8px;text-align:center">Caisses retour</th>
              <th style="border:1px solid #1565c0;padding:6px 8px;text-align:center">Écart</th>
              <th style="border:1px solid #1565c0;padding:6px 8px;text-align:center">Signature client</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border:1px solid #ccc;padding:6px 8px;height:26px"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td></tr>
            <tr><td style="border:1px solid #ccc;padding:6px 8px;height:26px"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td></tr>
            <tr><td style="border:1px solid #ccc;padding:6px 8px;height:26px"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td></tr>
            <tr><td style="border:1px solid #ccc;padding:6px 8px;height:26px"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td></tr>
            <tr style="background:#e3f2fd;font-weight:bold">
              <td style="border:1px solid #ccc;padding:6px 8px;color:#1565c0">TOTAL</td>
              <td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:14px;color:#1b5e20">${nbCharge}</td>
              <td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:14px;color:#1b5e20">${nbRetourne}</td>
              <td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:14px;color:${ecart===0?'#1b5e20':'#c62828'}">${ecart===0?'0':'-'+ecart}</td>
              <td style="border:1px solid #ccc"></td>
            </tr>
          </tbody>
        </table>`;

    const printContent = `
      <html>
        <head>
          <title>BON DE RETOUR - EL FIRMA</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size:13px; }
            .header { text-align: center; border-bottom: 3px solid #1b5e20; padding-bottom: 15px; margin-bottom: 15px; }
            .logo { font-size: 22px; font-weight: bold; color: #1b5e20; letter-spacing:1px; }
            .section { font-weight:bold; color:#1b5e20; border-bottom:1px solid #a5d6a7; margin:14px 0 6px; padding-bottom:3px; }
            .section-blue { font-weight:bold; color:#1565c0; border-bottom:2px solid #1565c0; margin:14px 0 6px; padding-bottom:3px; }
            .section-red { font-weight:bold; color:#c62828; border-bottom:1px solid #f44336; margin:10px 0 6px; padding-bottom:3px; }
            .info { margin: 5px 0; }
            .info-label { font-weight:bold; min-width:200px; display:inline-block; }
            .poids-box { background:#e8f5e9; border:1px solid #a5d6a7; border-radius:6px; padding:10px 14px; margin:8px 0; }
            .bilan-ok  { background:#e8f5e9; color:#1b5e20; padding:10px 14px; border-radius:6px; font-weight:bold; margin:10px 0; border:2px solid #a5d6a7; }
            .bilan-ok2 { background:#e3f2fd; color:#1565c0; padding:10px 14px; border-radius:6px; font-weight:bold; margin:10px 0; border:2px solid #90caf9; }
            .bilan-bad { background:#ffebee; color:#c62828; padding:10px 14px; border-radius:6px; font-weight:bold; margin:10px 0; border:2px solid #ef9a9a; }
            .signature { display:inline-block; min-width:180px; margin-top:28px; border-top:1px solid #555; padding-top:8px; margin-right:30px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">🐓 EL FIRMA — Abattoir de Volaille</div>
            <div style="font-size:16px;font-weight:bold;margin:6px 0;color:#333">BON DE RETOUR</div>
            <div style="color:#555">Date: <b>${formData.date}</b> &nbsp;|&nbsp; Heure: <b>${formData.heure}</b></div>
            <div style="font-size:11px;color:#777;margin-top:4px">Agent pesée: <b>${agentPoste}</b></div>
          </div>

          <div class="section">� Camion &amp; Chauffeur</div>
          <div class="info"><span class="info-label">Matricule:</span> <b>${camionInfo.matricule}</b></div>
          <div class="info"><span class="info-label">Chauffeur:</span> ${camionInfo.chauffeur}</div>

          <div class="section">⚖️ Bilan caisses</div>
          <div class="poids-box">
            <div class="info"><span class="info-label">Caisses chargées au départ :</span> <b style="font-size:15px">${nbCharge}</b></div>
            <div class="info"><span class="info-label">Caisses retournées à l'usine :</span> <b style="font-size:15px;color:#1b5e20">${nbRetourne}</b></div>
            <div class="info"><span class="info-label">Écart :</span> <b style="font-size:15px;color:${ecart===0?'#1b5e20':ecart>0?'#c62828':'#e65100'}">${ecart>0?`−${ecart}`:ecart<0?`+${Math.abs(ecart)}`:'0'}</b></div>
          </div>

          <div class="${ecart===0?'bilan-ok':'bilan-bad'}">
            ${ecart===0
              ? '✅ Retour complet — aucun écart de caisses'
              : `⚠️ Écart : ${ecart} caisse${ecart>1?'s':''} manquante${ecart>1?'s':''} — détail par client ci-dessous`}
          </div>

          <div class="section-blue">📋 DÉTAIL CAISSES PAR CLIENT</div>
          ${clientsRetourHtml}

          <div style="margin-top:30px">
            <div class="signature">Signature agent pesée:<div style="height:45px"></div></div>
            <div class="signature">Signature chauffeur:<div style="height:45px"></div></div>
            <div class="signature">Signature contrôleur:<div style="height:45px"></div></div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();

      // Valider automatiquement après impression
      printWindow.onafterprint = () => {
        validerRetour();
      };
    }
  };

  const validerRetour = () => {
    // Libérer le départ en attente et créer l'historique
    if (formData.camionId && departEnAttente[formData.camionId]) {
      const departData = departEnAttente[formData.camionId]!;
      const ecart = parseInt(departData.nbCaisses) - parseInt(formData.nbCaissesRetournees);

      // Enregistrer l'écart si non nul
      if (ecart !== 0) {
        const info = getCamionInfo(formData.camionId);
        setEcartsCaisses(prev => [{
          chauffeurNom: info.chauffeur,
          camionMatricule: info.matricule,
          nbCaissesChargees: parseInt(departData.nbCaisses),
          nbCaissesRetournees: parseInt(formData.nbCaissesRetournees),
          ecart,
          date: formData.date,
          heure: formData.heure,
          localisation: 'En route / Non précisé'
        }, ...prev]);
      }

      // Créer l'enregistrement complet dans l'historique
      const livraisonKey = `${formData.camionId}_${formData.date}_${formData.heure}`;
      setHistoriqueLivraisons(prev => ({
        ...prev,
        [livraisonKey]: {
          depart: {
            camionId: departData.camionId,
            chauffeurId: departData.chauffeurId,
            nbCaisses: departData.nbCaisses,
            poidsVide: departData.poidsVide,
            poidsCharge: departData.poidsCharge,
            poidsProduit: departData.poidsProduit,
            date: departData.date,
            heure: departData.date
          },
          retour: {
            camionId: formData.camionId,
            chauffeurId: formData.chauffeurId,
            nbCaissesRetournees: formData.nbCaissesRetournees,
            date: formData.date,
            heure: formData.heure
          },
          ecart: ecart,
          validee: true // Validé automatiquement après impression
        }
      }));

      // Libérer le départ en attente
      setDepartEnAttente(prev => {
        const newState = { ...prev };
        delete newState[formData.camionId];
        return newState;
      });
    }

    // Réinitialiser le formulaire
    setCaissesLaissees([]);
    setTourneeDuJour(null);
    setFormData({
      camionId: '',
      chauffeurId: '',
      nbCaissesChargees: '',
      nbCaissesRetournees: '',
      poidsFacture: '',
      poidsPese: '',
      poidsVide: '',
      poidsCharge: '',
      poidsCaisses: '',
      poidsProduit: '',
      date: new Date().toISOString().split('T')[0],
      heure: new Date().toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }),
    });
    setBlockageMessage('');
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-elfirma-green text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="EL FIRMA" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold">EL FIRMA</h1>
              <p className="text-sm opacity-90">Agent - Saisie des livraisons</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {agent && (
              <div className="flex items-center gap-2">
                {/* Badge Poste */}
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                  agent.poste_type === 'JOUR'
                    ? 'bg-amber-400 text-amber-900'
                    : agent.poste_type === 'NUIT'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white/20 text-white'
                }`}>
                  {agent.poste_type === 'JOUR' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  {agent.poste_nom || agent.poste_type}
                </span>
                {/* Nom agent */}
                <span className="hidden sm:block text-sm font-medium text-white/90 bg-white/10 px-3 py-1.5 rounded-full">
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

      <main className="max-w-4xl mx-auto px-4 py-8">



        {/* Panneau d'alertes écarts caisses */}
        {ecartsCaisses.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-5 h-5 text-red-500" />
              <h3 className="font-bold text-gray-800 text-lg">Suivi des écarts de caisses</h3>
              {(() => {
                const manquantes = ecartsCaisses.reduce((s,e)=>s+(e.ecart>0?e.ecart:0),0);
                const excedent   = ecartsCaisses.reduce((s,e)=>s+(e.ecart<0?Math.abs(e.ecart):0),0);
                return (
                  <span className="ml-auto flex gap-3">
                    {manquantes > 0 && (
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> {manquantes} manquantes
                      </span>
                    )}
                    {excedent > 0 && (
                      <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> {excedent} excédent
                      </span>
                    )}
                  </span>
                );
              })()}
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {ecartsCaisses.map((e, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                  e.ecart > 0 ? 'bg-red-50 border-red-200' : e.ecart < 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
                }`}>
                  <div className="mt-0.5">
                    {e.ecart > 0
                      ? <AlertTriangle className="w-5 h-5 text-red-500" />
                      : e.ecart < 0
                      ? <TrendingUp className="w-5 h-5 text-orange-500" />
                      : <CheckCircle className="w-5 h-5 text-green-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800">{e.chauffeurNom} — {e.camionMatricule}</p>
                    <p className="text-xs text-gray-600">
                      Chargées: <strong>{e.nbCaissesChargees}</strong> · Retournées: <strong>{e.nbCaissesRetournees}</strong>
                      {e.ecart > 0
                        ? <span className="text-red-600 font-bold"> → {e.ecart} MANQUANTE{e.ecart > 1 ? 'S' : ''}</span>
                        : <span className="text-orange-600 font-bold"> → {Math.abs(e.ecart)} EN EXCÉDENT</span>}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> {e.localisation} · {e.date} à {e.heure}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <History className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {mode === 'depart' && 'Départ du camion'}
                {mode === 'retour' && 'Retour du camion'}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleModeChange('depart')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    mode === 'depart' 
                      ? 'bg-elfirma-green text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Départ
                </button>
                <button
                  onClick={() => handleModeChange('retour')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    mode === 'retour' 
                      ? 'bg-elfirma-green text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Retour
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4">
              {mode === 'depart' && (
                <>
                  <div className="w-3 h-3 rounded-full bg-elfirma-green" />
                  <span className="text-sm text-gray-600">
                    Pesée de départ
                  </span>
                </>
              )}
              {mode === 'retour' && (
                <>
                  <div className="w-3 h-3 rounded-full bg-elfirma-green" />
                  <span className="text-sm text-gray-600">Saisie du retour</span>
                </>
              )}
            </div>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Date:</span> {formData.date} | 
                <span className="font-medium ml-2">Heure:</span> {formData.heure}
              </p>
            </div>
            {blockageMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 font-medium">{blockageMessage}</p>
              </div>
            )}
            {submissionStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-green-800 font-medium">
                    Livraison soumise avec succès - En attente de validation par le contrôleur
                  </p>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sélection camion */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🚛 Matricule camion
              </label>
              <select
                value={formData.camionId}
                onChange={(e) => handleCamionChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent text-base font-medium"
                required
              >
                <option value="">— Sélectionner un camion —</option>
                {camionsList.length > 0
                  ? camionsList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.matricule}{c.chauffeur_nom ? ` — ${c.chauffeur_nom}${c.chauffeur_prenom ? ' ' + c.chauffeur_prenom : ''}` : ''}
                      </option>
                    ))
                  : (
                      <>
                        <option value="1">190 TN 1234 — Ahmed Ben Ali</option>
                        <option value="2">190 TN 5678 — Mohamed Trabelsi</option>
                        <option value="3">190 TN 9012 — Sami Bouazizi</option>
                      </>
                    )
                }
              </select>
            </div>

            {/* Vue à 2 colonnes : Départ / Retour */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Colonne Départ */}
              <div className={`rounded-xl p-5 border-2 ${mode === 'depart' ? 'border-elfirma-green bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-elfirma-green" />
                  Départ
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Package className="w-4 h-4 inline mr-1" />
                      Caisses chargées
                    </label>
                    <input
                      type="number"
                      value={formData.nbCaissesChargees}
                      onChange={(e) => setFormData({ ...formData, nbCaissesChargees: e.target.value })}
                      disabled={mode === 'retour'}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent"
                      placeholder="Nombre de caisses"
                      required={mode === 'depart'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Scale className="w-4 h-4 inline mr-1" />
                      Poids selon facture (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.poidsFacture}
                      onChange={(e) => setFormData({ ...formData, poidsFacture: e.target.value })}
                      disabled={mode === 'retour'}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent"
                      placeholder="Poids facture"
                      required={mode === 'depart'}
                    />
                  </div>
                </div>
              </div>

              {/* Colonne Retour */}
              <div className={`rounded-xl p-5 border-2 ${mode === 'retour' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-blue-500 rotate-180" />
                  Retour
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Package className="w-4 h-4 inline mr-1" />
                      Caisses retournées
                    </label>
                    <input
                      type="number"
                      value={formData.nbCaissesRetournees}
                      onChange={(e) => setFormData({ ...formData, nbCaissesRetournees: e.target.value })}
                      disabled={mode === 'depart'}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Nombre de caisses"
                      required={mode === 'retour'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Scale className="w-4 h-4 inline mr-1" />
                      Poids pesé (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.poidsPese}
                      onChange={(e) => setFormData({ ...formData, poidsPese: e.target.value })}
                      disabled={mode === 'depart'}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Poids pesé"
                      required={mode === 'retour'}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Calculs écarts */}
            {mode === 'retour' && formData.nbCaissesChargees && formData.nbCaissesRetournees && (
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <h4 className="font-bold text-gray-700 mb-3">Écarts calculés</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded-lg ${calculerEcartCaisses() > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                    <p className="text-xs text-gray-500">Écart caisses</p>
                    <p className={`text-xl font-bold ${calculerEcartCaisses() > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {calculerEcartCaisses()} {calculerEcartCaisses() > 0 ? 'manquantes' : 'OK'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${Math.abs(calculerEcartPoids()) > 5 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
                    <p className="text-xs text-gray-500">Écart poids</p>
                    <p className={`text-xl font-bold ${Math.abs(calculerEcartPoids()) > 5 ? 'text-orange-600' : 'text-green-600'}`}>
                      {calculerEcartPoids().toFixed(2)} kg
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bouton de soumission */}
            <button
              type="submit"
              disabled={submissionStatus === 'pending'}
              className="w-full bg-elfirma-green text-white py-3 rounded-lg font-semibold hover:bg-elfirma-darkGreen transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submissionStatus === 'pending' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  {mode === 'depart' ? 'Enregistrer le départ' : 'Enregistrer le retour'}
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}