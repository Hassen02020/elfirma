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
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    camionId: '',
    chauffeurId: '',
    poidsVide: '',
    poidsCharge: '',
    nbCaissesChargees: '',
    nbCaissesRetournees: '',
    poidsCaisses: '',
    poidsProduit: '10',
    indicePoids: '0.7',
    date: new Date().toISOString().split('T')[0],
    heure: new Date().toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }),
  });
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'pending' | 'success'>('idle');
  const [departEnAttente, setDepartEnAttente] = useState<{[key: string]: {nbCaisses: string, date: string, camionId: string, chauffeurId: string, poidsVide: string, poidsCharge: string, poidsProduit: string} | null}>({});
  const [historiqueLivraisons, setHistoriqueLivraisons] = useState<{[key: string]: {depart: any, retour: any, ecart: number, validee: boolean}}>({});
  const [blockageMessage, setBlockageMessage] = useState('');
  const [erreurPoids, setErreurPoids] = useState<'inferieur' | 'egal' | null>(null);

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
    
    // Bloquer si poids incohérents
    const pv = parseFloat(formData.poidsVide) || 0;
    const pc = parseFloat(formData.poidsCharge) || 0;
    if (pv > 0 && pc > 0 && pc < pv) {
      setBlockageMessage(`⚠️ Le poids après chargement (${pc} kg) ne peut pas être inférieur au poids à vide (${pv} kg). Vérifiez les pesées.`);
      return;
    }

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
          poidsVide: formData.poidsVide,
          poidsCharge: formData.poidsCharge,
          poidsProduit: formData.poidsProduit
        }
      }));
    }
    
    // Pour le mode retour: l'historique et la libération du départ
    // sont gérés par validerRetour() appelée après impression (onafterprint)
    // On ne touche pas à departEnAttente ici pour éviter le double traitement
    
    // Soumettre au backend
    const payload = {
      camion_id: parseInt(formData.camionId),
      chauffeur_id: parseInt(formData.chauffeurId) || null,
      poids_vide: parseFloat(formData.poidsVide) || 0,
      poids_charge: parseFloat(formData.poidsCharge) || 0,
      poids_caisses: (parseFloat(formData.poidsCaisses) || 0) * (parseInt(formData.nbCaissesChargees) || 0),
      poids_produit: parseFloat(formData.poidsProduit) || 0,
      nb_caisses_chargees: parseInt(formData.nbCaissesChargees) || 0,
      nb_caisses_retournees: parseInt(formData.nbCaissesRetournees) || 0,
      type: mode,
      agent_id: agent?.id || null,
      poste_id: agent?.poste_id || null,
    };

    try {
      const res = await fetch(`${API_BASE}/api/delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload),
      });
      const livraison = await res.json();
      const livId = livraison?.id ?? null;
      setLivraisonIdCourant(livId);

      setSubmissionStatus('success');
    } catch {
      setSubmissionStatus('success'); // continuer même si API indispo
    }

    setTimeout(() => {
      setSubmissionStatus('idle');
    }, 3000);
  };

  const handleNext = () => {
    if (mode === 'depart' && step < 2) setStep(step + 1);
    if (mode === 'retour' && step < 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleModeChange = (newMode: 'depart' | 'retour') => {
    setMode(newMode);
    setStep(1);
    setBlockageMessage('');
    setErreurPoids(null);
    
    setCaissesLaissees([]);

    if (newMode === 'retour' && formData.camionId && departEnAttente[formData.camionId]) {
      const departData = departEnAttente[formData.camionId]!;
      setFormData(prev => ({
        ...prev,
        nbCaissesChargees: departData.nbCaisses,
        camionId: prev.camionId,
        chauffeurId: prev.chauffeurId,
        poidsVide: '',
        poidsCharge: '',
        nbCaissesRetournees: '',
        poidsCaisses: '',
        poidsProduit: '10',
        date: new Date().toISOString().split('T')[0],
        heure: new Date().toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }),
      }));
    } else {
      setFormData({
        camionId: '',
        chauffeurId: '',
        poidsVide: '',
        poidsCharge: '',
        nbCaissesChargees: '',
        nbCaissesRetournees: '',
        poidsCaisses: '',
        poidsProduit: '10',
        indicePoids: '0.7',
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

  const calculerPoidsNet = () => {
    const poidsCharge    = parseFloat(formData.poidsCharge) || 0;
    const poidsVide      = parseFloat(formData.poidsVide) || 0;
    const poidsUnitaire  = parseFloat(formData.poidsCaisses) || 0;
    const nbCaisses      = parseInt(formData.nbCaissesChargees) || 0;
    const poidsNet = poidsCharge - (poidsVide + poidsUnitaire * nbCaisses);
    return poidsNet.toFixed(2);
  };

  const handlePoidsChange = (field: 'poidsVide' | 'poidsCharge', value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      const pv = field === 'poidsVide' ? parseFloat(value) || 0 : parseFloat(prev.poidsVide) || 0;
      const pc = field === 'poidsCharge' ? parseFloat(value) || 0 : parseFloat(prev.poidsCharge) || 0;
      // Validation métier : poids chargé doit être >= poids vide
      if (pc > 0 && pv > 0) {
        if (pc < pv)        setErreurPoids('inferieur');
        else if (pc === pv) setErreurPoids('egal');
        else                setErreurPoids(null);
      } else {
        setErreurPoids(null);
      }
      if (mode === 'depart') {
        const pCaisses = parseFloat(prev.poidsCaisses) || 0;
        const poidsNet = pc - (pv + pCaisses);
        const indice = parseFloat(prev.indicePoids) || 0.7;
        const nbCaisses = poidsNet > 0 ? Math.floor(poidsNet / indice) : 0;
        updated.nbCaissesChargees = nbCaisses.toString();
      }
      return updated;
    });
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
            <div class="info" style="color:#1b5e20;font-weight:bold"><span class="info-label">Poids net produit:</span> <b style="font-size:15px">${calculerPoidsNet()} kg</b></div>
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
        poidsVide: formData.poidsVide,
        poidsCharge: formData.poidsCharge,
        poidsProduit: formData.poidsProduit
      }
    }));

    // Réinitialiser le formulaire
    setFormData({
      camionId: '',
      chauffeurId: '',
      poidsVide: '',
      poidsCharge: '',
      nbCaissesChargees: '',
      nbCaissesRetournees: '',
      poidsCaisses: '',
      poidsProduit: '10',
      indicePoids: '0.7',
      date: new Date().toISOString().split('T')[0],
      heure: new Date().toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }),
    });
    setBlockageMessage('');
    setErreurPoids(null);
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
      poidsVide: '',
      poidsCharge: '',
      nbCaissesChargees: '',
      nbCaissesRetournees: '',
      poidsCaisses: '',
      poidsProduit: '10',
      indicePoids: '0.7',
      date: new Date().toISOString().split('T')[0],
      heure: new Date().toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }),
    });
    setBlockageMessage('');
    setErreurPoids(null);
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

        {/* ── Alertes temps réel (écart poids / litige caisses) ── */}
        {alertes.length > 0 && (
          <div className="mb-5">
            <AlerteBanner
              alertes={alertes}
              role="agent"
              agentId={agent?.id}
            />
          </div>
        )}


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
                  <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-elfirma-green' : 'bg-gray-300'}`} />
                  <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-elfirma-green' : 'bg-gray-300'}`} />
                  <span className="text-sm text-gray-600">
                    {step === 1 ? 'Étape 1: Pesée à vide' : 'Étape 2: Chargement'}
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
            {mode === 'depart' && step === 1 && (
              <div className="space-y-4">
                {/* Sélection camion — matricule + chauffeur uniquement */}
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

                {/* Panneau affectation logistique automatique */}
                {formData.camionId && tourneeDuJour && (
                  <div className="border border-green-300 bg-green-50 rounded-xl px-4 py-2 text-xs text-green-800">
                    📋 Tournée #{tourneeDuJour.id} — {tourneeDuJour.secteur_nom} · {tourneeDuJour.nb_caisses_total} caisses affectées
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Scale className="w-4 h-4 inline mr-2" />
                    Poids à vide (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.poidsVide}
                    onChange={(e) => handlePoidsChange('poidsVide', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent"
                    placeholder="Ex: 2500.00"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Poids du camion vide avant chargement</p>
                </div>
              </div>
            )}

            {mode === 'depart' && step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Scale className="w-4 h-4 inline mr-2" />
                    Poids après chargement (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.poidsCharge}
                    onChange={(e) => handlePoidsChange('poidsCharge', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent ${
                      erreurPoids === 'inferieur'
                        ? 'border-red-500 bg-red-50 focus:ring-red-400'
                        : erreurPoids === 'egal'
                        ? 'border-amber-400 bg-amber-50 focus:ring-amber-400'
                        : 'border-gray-300 focus:ring-elfirma-green'
                    }`}
                    placeholder="Ex: 3200.00"
                    required
                  />
                  {/* Feedback validation poids */}
                  {erreurPoids === 'inferieur' && (
                    <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-red-700">Erreur de pesée — valeur impossible</p>
                        <p className="text-xs text-red-600">
                          Poids après chargement ({formData.poidsCharge} kg) &lt; Poids à vide ({formData.poidsVide} kg).<br/>
                          Un camion chargé ne peut pas peser moins qu'à vide.
                        </p>
                      </div>
                    </div>
                  )}
                  {erreurPoids === 'egal' && (
                    <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-700">Attention — Camion parti à vide</p>
                        <p className="text-xs text-amber-600">
                          Poids avant = Poids après ({formData.poidsCharge} kg). Aucun produit ni caisse chargé.
                          Confirmez si c'est intentionnel.
                        </p>
                      </div>
                    </div>
                  )}
                  {!erreurPoids && formData.poidsVide && formData.poidsCharge && parseFloat(formData.poidsCharge) > parseFloat(formData.poidsVide) && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Charge nette : {(parseFloat(formData.poidsCharge) - parseFloat(formData.poidsVide)).toFixed(2)} kg ✓
                    </p>
                  )}
                </div>


                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Scale className="w-4 h-4 inline mr-2" />
                    Poids unitaire d'une caisse vide (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.poidsCaisses}
                    onChange={(e) => setFormData({ ...formData, poidsCaisses: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent"
                    placeholder="Ex: 2.10"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Poids d'une seule caisse vide — sera multiplié par le nombre de caisses</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Package className="w-4 h-4 inline mr-2" />
                    Nombre de caisses chargées
                  </label>
                  <input
                    type="number"
                    value={formData.nbCaissesChargees}
                    onChange={(e) => setFormData({ ...formData, nbCaissesChargees: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent"
                    placeholder="Saisir le nombre de caisses"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Nombre total de caisses chargées selon factures fournies</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-xs text-blue-500 mb-1">Formule : Poids après chargement − (Poids à vide + Poids unitaire caisse × Nb caisses)</p>
                  <p className="text-sm text-gray-700">
                    {formData.poidsCharge || '?'} − ({formData.poidsVide || '?'} + <span className="text-green-700 font-medium">{formData.poidsCaisses || '?'}</span> × <span className="text-green-700 font-medium">{formData.nbCaissesChargees || '?'}</span>) =&nbsp;
                    <span className="font-bold text-blue-700 text-base">{calculerPoidsNet()} kg</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Poids net produit livré</p>
                </div>

                <button
                  type="button"
                  onClick={imprimerLivrableDepart}
                  className="w-full bg-elfirma-gold text-gray-800 py-3 rounded-lg font-semibold hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  Valider et Imprimer livrable de départ
                </button>
              </div>
            )}

            {mode === 'retour' && (
              <div className="space-y-4">
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
                    <option value="1">190 TN 1234 — Ahmed Ben Ali</option>
                    <option value="2">190 TN 5678 — Mohamed Trabelsi</option>
                    <option value="3">190 TN 9012 — Sami Bouazizi</option>
                  </select>
                </div>

                {/* Référence départ : nb caisses chargées (verrouillé) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Package className="w-4 h-4 inline mr-1" />
                    Caisses chargées au départ (référence agent pesée)
                  </label>
                  <input
                    type="number"
                    value={formData.nbCaissesChargees}
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-bold text-lg cursor-not-allowed"
                    placeholder="Aucun départ enregistré pour ce camion"
                  />
                  {formData.nbCaissesChargees
                    ? <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3"/>Chargé depuis le bon de départ signé</p>
                    : <p className="text-xs text-orange-500 mt-1">⚠ Sélectionner un camion avec un départ enregistré</p>
                  }
                </div>

                {/* Affectation logistique de la tournée (référence commande départ) */}
                {tourneeDuJour && (() => {
                  const lignes = tourneeDuJour.lignes || [];
                  const totalAffecte = lignes.reduce((s, l) => s + l.nb_caisses, 0);
                  return (
                    <div className="border-2 border-blue-300 rounded-xl overflow-hidden">
                      <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between">
                        <span className="font-bold text-sm">📋 Commande logistique — Référence tournée #{tourneeDuJour.id}</span>
                        <span className="text-xs opacity-90">{tourneeDuJour.secteur_nom}</span>
                      </div>
                      <div className="p-3 bg-blue-50">
                        <p className="text-xs text-blue-700 mb-2 font-medium">
                          Caisses affectées par l'agent logistique : <strong className="text-base text-blue-900">{totalAffecte}</strong> — ces caisses restent chez les clients et justifient l'écart.
                        </p>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-blue-100">
                              <th className="border border-blue-200 px-2 py-1.5 text-left text-blue-700">Client</th>
                              <th className="border border-blue-200 px-2 py-1.5 text-left text-blue-700">📞</th>
                              <th className="border border-blue-200 px-2 py-1.5 text-center text-blue-700">Caisses laissées</th>
                              <th className="border border-blue-200 px-2 py-1.5 text-center text-blue-700">Récupérées ✓</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lignes.map((l, i) => {
                              const cLaissee = caissesLaissees.find(cl => cl.client_nom === l.client_nom && !cl.autre);
                              return (
                                <tr key={i} className="bg-white">
                                  <td className="border border-blue-100 px-2 py-1.5 font-medium">{l.client_nom}</td>
                                  <td className="border border-blue-100 px-2 py-1.5 text-blue-600">{l.telephone || '—'}</td>
                                  <td className="border border-blue-100 px-2 py-1.5 text-center font-bold text-blue-800">{l.nb_caisses}</td>
                                  <td className="border border-blue-100 px-2 py-1.5 text-center">
                                    <input
                                      type="number" min="0" max={l.nb_caisses}
                                      value={cLaissee?.nb_caisses ?? ''}
                                      onChange={e => {
                                        const val = parseInt(e.target.value) || 0;
                                        setCaissesLaissees(prev => {
                                          const exists = prev.find(cl => cl.client_nom === l.client_nom && !cl.autre);
                                          if (exists) {
                                            return prev.map(cl => cl.client_nom === l.client_nom && !cl.autre ? {...cl, nb_caisses: val} : cl);
                                          }
                                          return [...prev, {
                                            secteur_id: 0, secteur_nom: tourneeDuJour.secteur_nom || '',
                                            client_id: i + 1, client_nom: l.client_nom,
                                            telephone: l.telephone || '', adresse: l.adresse || '',
                                            nb_caisses: val, autre: false
                                          }];
                                        });
                                      }}
                                      placeholder="0"
                                      className="w-16 px-1.5 py-1 text-center text-sm font-bold border-2 border-blue-300 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-blue-50 font-bold">
                              <td colSpan={2} className="border border-blue-200 px-2 py-1.5 text-blue-800">TOTAL LOGISTIQUE</td>
                              <td className="border border-blue-200 px-2 py-1.5 text-center text-blue-900">{totalAffecte}</td>
                              <td className="border border-blue-200 px-2 py-1.5 text-center text-green-700">
                                {caissesLaissees.filter(cl=>!cl.autre).reduce((s,cl)=>s+cl.nb_caisses,0)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Nb caisses retournées */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Package className="w-4 h-4 inline mr-1" />
                    Caisses retournées à l'usine (pesée retour)
                  </label>
                  <input
                    type="number"
                    value={formData.nbCaissesRetournees}
                    onChange={(e) => setFormData({ ...formData, nbCaissesRetournees: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent text-lg font-bold"
                    placeholder="Ex: 95"
                    required
                  />
                </div>

                {/* Bilan écart avec justification logistique */}
                {formData.nbCaissesChargees && formData.nbCaissesRetournees && (() => {
                  const nbCharge    = parseInt(formData.nbCaissesChargees) || 0;
                  const nbRetourne  = parseInt(formData.nbCaissesRetournees) || 0;
                  const ecart       = nbCharge - nbRetourne;
                  // Caisses justifiées par l'affectation logistique
                  const caissesLogistique = (tourneeDuJour?.lignes || []).reduce((s, l) => s + l.nb_caisses, 0);
                  // Caisses saisies manuellement comme laissées (hors logistique)
                  const totalSaisi  = caissesLaissees.reduce((s, c) => s + c.nb_caisses, 0);
                  // Bilan justification
                  const justifieLogistique = Math.min(ecart > 0 ? ecart : 0, caissesLogistique);
                  const nonJustifie = Math.max(0, ecart - totalSaisi);
                  return (
                    <>
                      {/* Bilan écart vs commande logistique */}
                      <div className={`rounded-xl border-2 p-4 space-y-3 ${
                        ecart === 0 ? 'bg-green-50 border-green-300' :
                        nonJustifie === 0 ? 'bg-blue-50 border-blue-300' :
                        'bg-red-50 border-red-300'
                      }`}>
                        <div className="flex items-start gap-2">
                          {ecart === 0
                            ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0"/>
                            : nonJustifie === 0
                            ? <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"/>
                            : <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"/>}
                          <div className="flex-1">
                            <p className={`font-bold text-sm ${ecart === 0 ? 'text-green-700' : nonJustifie === 0 ? 'text-blue-700' : 'text-red-700'}`}>
                              {ecart === 0
                                ? '✓ Retour complet — aucun écart'
                                : nonJustifie === 0
                                ? `✓ Écart de ${ecart} caisse${ecart>1?'s':''} — entièrement justifié par la commande logistique`
                                : `⚠ ${nonJustifie} caisse${nonJustifie>1?'s':''} non justifiée${nonJustifie>1?'s':''} — à expliquer`}
                            </p>
                            {ecart > 0 && (
                              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-center">
                                <div className="bg-white rounded-lg p-2 border">
                                  <div className="font-bold text-gray-800 text-base">{nbCharge}</div>
                                  <div className="text-gray-500">Chargées</div>
                                </div>
                                <div className="bg-white rounded-lg p-2 border">
                                  <div className="font-bold text-green-700 text-base">{nbRetourne}</div>
                                  <div className="text-gray-500">Retournées</div>
                                </div>
                                <div className={`rounded-lg p-2 border ${nonJustifie === 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
                                  <div className={`font-bold text-base ${nonJustifie === 0 ? 'text-blue-800' : 'text-red-700'}`}>{ecart}</div>
                                  <div className="text-gray-500">Écart</div>
                                </div>
                              </div>
                            )}
                            {ecart > 0 && caissesLogistique > 0 && (
                              <p className="text-xs mt-2 text-blue-700">
                                Commande logistique : <strong>{caissesLogistique}</strong> caisses affectées aux clients &nbsp;|&nbsp;
                                Justifié : <strong>{justifieLogistique}</strong> &nbsp;|&nbsp;
                                Non justifié : <strong className={nonJustifie > 0 ? 'text-red-700' : 'text-green-700'}>{nonJustifie}</strong>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Clients hors tournée (écart résiduel non couvert par la logistique) */}
                        {ecart > 0 && nonJustifie > 0 && (
                          <div className="border-t border-red-200 pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-red-700">
                                Caisses hors tournée — saisir le(s) client(s) concerné(s)
                              </p>
                              <button type="button"
                                onClick={() => setCaissesLaissees(prev => [...prev, {
                                  secteur_id: 0, secteur_nom: '', client_id: -Date.now(),
                                  client_nom: '', telephone: '', adresse: '', nb_caisses: 0, autre: true
                                }])}
                                className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg hover:bg-red-700 flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3"/> Ajouter
                              </button>
                            </div>
                            {caissesLaissees.filter(l => l.autre).map((ligne) => {
                              const idx = caissesLaissees.indexOf(ligne);
                              return (
                                <div key={ligne.client_id} className="bg-white border border-red-200 rounded-lg p-2.5 mb-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="Nom client *"
                                      value={ligne.client_nom}
                                      onChange={e => setCaissesLaissees(prev => prev.map((l,j) => j===idx ? {...l, client_nom: e.target.value} : l))}
                                      className="col-span-2 px-2 py-1.5 text-xs border border-red-200 rounded font-medium"/>
                                    <input type="tel" placeholder="📞 Téléphone"
                                      value={ligne.telephone}
                                      onChange={e => setCaissesLaissees(prev => prev.map((l,j) => j===idx ? {...l, telephone: e.target.value} : l))}
                                      className="px-2 py-1.5 text-xs border border-red-200 rounded"/>
                                    <input type="text" placeholder="📍 Adresse"
                                      value={ligne.adresse}
                                      onChange={e => setCaissesLaissees(prev => prev.map((l,j) => j===idx ? {...l, adresse: e.target.value} : l))}
                                      className="px-2 py-1.5 text-xs border border-red-200 rounded"/>
                                    <input type="number" min="1" placeholder="Nb caisses"
                                      value={ligne.nb_caisses || ''}
                                      onChange={e => setCaissesLaissees(prev => prev.map((l,j) => j===idx ? {...l, nb_caisses: parseInt(e.target.value)||0} : l))}
                                      className="px-2 py-1.5 text-xs font-bold border-2 border-red-300 rounded text-center"/>
                                    <button type="button"
                                      onClick={() => setCaissesLaissees(prev => prev.filter((_,j) => j!==idx))}
                                      className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 justify-center">
                                      <Trash2 className="w-3 h-3"/> Supprimer
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Signature
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-gray-500">
                    Zone de signature numérique
                  </div>
                </div>

                <button
                  type="button"
                  onClick={imprimerLivrableRetour}
                  className="w-full bg-elfirma-gold text-gray-800 py-3 rounded-lg font-semibold hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  Valider et Imprimer livrable de retour
                </button>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              {mode === 'depart' && step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Retour
                </button>
              )}
              {mode === 'depart' && step < 2 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 bg-elfirma-green text-white py-3 rounded-lg font-semibold hover:bg-elfirma-darkGreen transition-colors flex items-center justify-center gap-2"
                >
                  Suivant
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : mode === 'depart' ? (
                <button
                  type="submit"
                  className="flex-1 bg-elfirma-green text-white py-3 rounded-lg font-semibold hover:bg-elfirma-darkGreen transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Valider le départ
                </button>
              ) : (
                <button
                  type="submit"
                  className="flex-1 bg-elfirma-green text-white py-3 rounded-lg font-semibold hover:bg-elfirma-darkGreen transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Valider le retour
                </button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}