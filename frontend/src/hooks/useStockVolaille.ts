/**
 * useStockVolaille — données stock volaille + SSE temps réel
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import API_BASE from '../config/api';

const API = `${API_BASE}/api/stock-volaille`;

export interface StockLine {
  id: number;
  date_production: string;
  type_produit: 'CONGELE' | 'SURGELE';
  designation: string;
  quantite_kg: number;
  nb_caisses: number;
  nb_caisses_en_circulation: number;
  nb_caisses_retournees: number;
  temperature_c?: number;
  lot?: string;
  note?: string;
  agent_nom?: string;
  agent_prenom?: string;
  correction_super_admin?: number;
  correction_motif?: string;
}

export interface Compteurs {
  total_stock: number;
  en_circulation: number;
  retournees_frigo: number;
  disponibles: number;
  congele_caisses: number;
  surgele_caisses: number;
  congele_kg: number;
  surgele_kg: number;
}

export interface HistoLine {
  date_production: string;
  type_produit: 'CONGELE' | 'SURGELE';
  total_kg: number;
  total_caisses: number;
  caisses_en_circulation: number;
  caisses_retournees: number;
  caisses_disponibles: number;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export function useStockVolaille() {
  const [stockJour,   setStockJour]   = useState<StockLine[]>([]);
  const [compteurs,   setCompteurs]   = useState<Compteurs | null>(null);
  const [historique,  setHistorique]  = useState<HistoLine[]>([]);
  const [loading,     setLoading]     = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sj, cp, hi] = await Promise.all([
        fetch(`${API}/today`,      { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API}/compteurs`,  { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API}/historique`, { headers: authHeaders() }).then(r => r.json()),
      ]);
      if (Array.isArray(sj)) setStockJour(sj);
      if (cp && typeof cp === 'object') setCompteurs(cp);
      if (Array.isArray(hi)) setHistorique(hi);
    } catch { /* hors-ligne : garder données précédentes */ }
    setLoading(false);
  }, []);

  // Connexion SSE
  useEffect(() => {
    fetchAll();
    const es = new EventSource(`${API}/stream`);
    esRef.current = es;

    es.addEventListener('STOCK_MISE_A_JOUR', () => fetchAll());
    es.addEventListener('MOUVEMENT_CAISSES', () => fetchAll());
    es.addEventListener('CORRECTION_STOCK',  () => fetchAll());

    return () => { es.close(); esRef.current = null; };
  }, [fetchAll]);

  // Saisir du stock
  const saisirStock = useCallback(async (payload: {
    type_produit: string; designation: string; quantite_kg: number;
    nb_caisses: number; temperature_c?: number; lot?: string; note?: string;
  }) => {
    const r = await fetch(API, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    await fetchAll();
    return data;
  }, [fetchAll]);

  // Enregistrer un mouvement (départ/retour frigo)
  const enregistrerMouvement = useCallback(async (stockId: number, payload: {
    type_mvt: 'DEPART_FRIGO' | 'RETOUR_FRIGO';
    nb_caisses: number;
    chauffeur_id?: number;
    camion_id?: number;
    motif?: string;
  }) => {
    const r = await fetch(`${API}/${stockId}/mouvement`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    await fetchAll();
    return data;
  }, [fetchAll]);

  // Correction inventaire (Super Admin)
  const corrigerStock = useCallback(async (stockId: number, payload: {
    quantite_kg?: number; nb_caisses?: number; motif: string;
  }) => {
    const r = await fetch(`${API}/${stockId}/correction`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    await fetchAll();
    return data;
  }, [fetchAll]);

  const congeleLignes   = stockJour.filter(s => s.type_produit === 'CONGELE');
  const surgeleLignes   = stockJour.filter(s => s.type_produit === 'SURGELE');

  return {
    stockJour, congeleLignes, surgeleLignes,
    compteurs, historique, loading,
    refetch: fetchAll, saisirStock, enregistrerMouvement, corrigerStock,
  };
}
