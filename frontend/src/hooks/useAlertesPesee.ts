import { useState, useEffect } from 'react';
import API_BASE from '../config/api';

interface AlertePesee {
  id: number;
  camion_id: number;
  chauffeur_id: number;
  agent_id: number;
  poids_vide: number;
  poids_charge: number;
  poids_factures: number;
  ecart: number;
  nb_caisses_chargees: number;
  statut_validation: string;
  matricule: string;
  chauffeur_nom: string;
  agent_nom: string;
  agent_role: string;
  created_at: string;
}

export function useAlertesPesee(pollingInterval: number = 10000) {
  const [alertes, setAlertes] = useState<AlertePesee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlertes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/pesee/alertes`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Erreur lors de la récupération des alertes');
      }

      const data = await res.json();
      setAlertes(data.alertes || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertes();

    // Polling pour les alertes en temps réel
    const interval = setInterval(fetchAlertes, pollingInterval);

    return () => clearInterval(interval);
  }, [pollingInterval]);

  const validerAlerte = async (livraison_id: number, controleur_id: number, statut: 'VALIDE' | 'REJETE', commentaire?: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/pesee/valider-controleur`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          livraison_id,
          controleur_id,
          statut_validation: statut,
          commentaire: commentaire || '',
        }),
      });

      if (!res.ok) {
        throw new Error('Erreur lors de la validation');
      }

      const data = await res.json();
      
      // Rafraîchir les alertes après validation
      await fetchAlertes();
      
      return data;
    } catch (err) {
      throw err;
    }
  };

  return {
    alertes,
    loading,
    error,
    refetch: fetchAlertes,
    validerAlerte,
  };
}
