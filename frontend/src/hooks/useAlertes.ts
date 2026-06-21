/**
 * useAlertes — abonnement SSE aux alertes temps réel + snapshot REST
 * Utilisation :
 *   const { alertes, nbAlertes, clearAlerte } = useAlertes();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import API_BASE from '../config/api';

const API = `${API_BASE}/api`;

export interface Alerte {
  id: number;
  livraison_id: number;
  type: 'ECART_POIDS_CHARGEMENT' | 'ECART_CAISSES_RETOUR';
  niveau: 'INFO' | 'ATTENTION' | 'CRITIQUE';
  message: string;
  detail: Record<string, unknown>;
  resolue: boolean;
  created_at: string;
  chauffeur_nom?: string;
  matricule?: string;
  // temps réel
  _nouveau?: boolean;
}

export function useAlertes() {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const esRef = useRef<EventSource | null>(null);

  // Charger le snapshot initial
  const fetchSnapshot = useCallback(async () => {
    try {
      const r = await fetch(`${API}/validation/alertes/actives`);
      const data: Alerte[] = await r.json();
      setAlertes(Array.isArray(data) ? data.filter(a => !a.resolue) : []);
    } catch { /* hors-ligne : garder les alertes SSE */ }
  }, []);

  // Connexion SSE
  useEffect(() => {
    fetchSnapshot();

    const es = new EventSource(`${API}/validation/alertes/stream`);
    esRef.current = es;

    es.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);

        if (payload.type === 'ALERTE_RESOLUE' || payload.type === 'LITIGE_CLOS') {
          // Marquer comme résolue
          setAlertes(prev =>
            prev.filter(a => a.livraison_id !== payload.livraison_id
              || (payload.alerte_type && a.type !== payload.alerte_type)));
          return;
        }

        if (payload.type === 'ECART_POIDS_CHARGEMENT' || payload.type === 'ECART_CAISSES_RETOUR') {
          const nouvelle: Alerte = {
            id: Date.now(),
            livraison_id: payload.livraison_id,
            type: payload.type,
            niveau: payload.niveau ?? 'CRITIQUE',
            message: payload.message,
            detail: payload.detail ?? {},
            resolue: false,
            created_at: new Date().toISOString(),
            chauffeur_nom: payload.detail?.chauffeur_nom,
            matricule: payload.detail?.matricule,
            _nouveau: true,
          };
          setAlertes(prev => [nouvelle, ...prev.filter(a => a.livraison_id !== payload.livraison_id || a.type !== payload.type)]);
        }
      } catch { /* ignorer message malformé */ }
    };

    es.onerror = () => {
      // Reconnexion auto par le navigateur — pas besoin de gérer manuellement
    };

    return () => { es.close(); esRef.current = null; };
  }, [fetchSnapshot]);

  const clearAlerte = useCallback((alerteId: number) => {
    setAlertes(prev => prev.filter(a => a.id !== alerteId));
  }, []);

  const dismissNouveautes = useCallback(() => {
    setAlertes(prev => prev.map(a => ({ ...a, _nouveau: false })));
  }, []);

  return {
    alertes,
    nbAlertes: alertes.length,
    alertesCritiques: alertes.filter(a => a.niveau === 'CRITIQUE'),
    alertesPoids: alertes.filter(a => a.type === 'ECART_POIDS_CHARGEMENT'),
    alertesCaisses: alertes.filter(a => a.type === 'ECART_CAISSES_RETOUR'),
    hasNouvelles: alertes.some(a => a._nouveau),
    clearAlerte,
    dismissNouveautes,
    refetch: fetchSnapshot,
  };
}
