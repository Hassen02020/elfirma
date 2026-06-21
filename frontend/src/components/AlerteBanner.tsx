/**
 * AlerteBanner — bannière clignotante d'alertes temps réel
 * Affiche les alertes actives (écart poids / litige caisses)
 * avec clignotement CSS et bouton de déblocage selon le rôle.
 */

import { useState } from 'react';
import { AlertTriangle, X, CheckCircle, Shield } from 'lucide-react';
import type { Alerte } from '../hooks/useAlertes';

interface Props {
  alertes: Alerte[];
  role: 'super_admin' | 'agent' | 'controleur' | 'comptable';
  agentId?: number;
  onDebloquer?: (alerteId: number, livraisonId: number, type: Alerte['type'], motif: string, ajustement?: number) => void;
  onDismiss?: (alerteId: number) => void;
}

export default function AlerteBanner({ alertes, role, agentId, onDebloquer, onDismiss }: Props) {
  const [motifs, setMotifs] = useState<Record<number, string>>({});
  const [ajustements, setAjustements] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (alertes.length === 0) return null;

  const peutDebloquer = role === 'controleur' || role === 'super_admin';
  const peutCloreLitige = role === 'controleur' || role === 'comptable' || role === 'super_admin';

  const labelType = (type: Alerte['type']) =>
    type === 'ECART_POIDS_CHARGEMENT' ? '⚖️ Écart Poids Chargement' : '📦 Litige Retour Caisses';

  return (
    <div className="space-y-2">
      {alertes.map(alerte => (
        <div
          key={alerte.id}
          className={`rounded-xl border-2 shadow-lg overflow-hidden ${
            alerte._nouveau
              ? 'animate-pulse border-red-500 bg-red-50'
              : 'border-orange-400 bg-orange-50'
          }`}
        >
          {/* Header alerte */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-5 h-5 shrink-0 ${alerte._nouveau ? 'text-red-600 animate-bounce' : 'text-orange-500'}`} />
              <div>
                <p className="font-bold text-sm text-gray-800">
                  {labelType(alerte.type)}
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-bold ${
                    alerte.niveau === 'CRITIQUE' ? 'bg-red-600 text-white' : 'bg-orange-400 text-white'}`}>
                    {alerte.niveau}
                  </span>
                </p>
                <p className="text-xs text-gray-600 mt-0.5">{alerte.message}</p>
                {alerte.chauffeur_nom && (
                  <p className="text-xs text-gray-500">
                    Chauffeur : <strong>{alerte.chauffeur_nom}</strong>
                    {alerte.matricule && <> · {alerte.matricule}</>}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(peutDebloquer || peutCloreLitige) && (
                <button
                  onClick={() => setExpanded(e => ({ ...e, [alerte.id]: !e[alerte.id] }))}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50">
                  <Shield className="w-3 h-3" />
                  {expanded[alerte.id] ? 'Fermer' : 'Intervenir'}
                </button>
              )}
              {onDismiss && (
                <button onClick={() => onDismiss(alerte.id)}
                  className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Détails numériques */}
          {alerte.detail && Object.keys(alerte.detail).length > 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-3">
              {alerte.type === 'ECART_POIDS_CHARGEMENT' && (
                <>
                  <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">
                    Poids net : <strong>{Number(alerte.detail.poids_net ?? 0).toFixed(1)} kg</strong>
                  </span>
                  <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">
                    Commandé : <strong>{Number(alerte.detail.poids_commande ?? 0).toFixed(1)} kg</strong>
                  </span>
                  <span className="text-xs bg-red-100 border border-red-200 px-2 py-1 rounded text-red-700 font-semibold">
                    Écart : {Number(alerte.detail.ecart ?? 0).toFixed(1)} kg ({Number(alerte.detail.ecart_pct ?? 0).toFixed(1)}%)
                  </span>
                </>
              )}
              {alerte.type === 'ECART_CAISSES_RETOUR' && (
                <>
                  <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">
                    Chargées : <strong>{alerte.detail.chargees as number}</strong>
                  </span>
                  <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">
                    Retournées : <strong>{alerte.detail.retournees as number}</strong>
                  </span>
                  <span className="text-xs bg-red-100 border border-red-200 px-2 py-1 rounded text-red-700 font-semibold">
                    Manquantes : {alerte.detail.ecart as number} ({Number(alerte.detail.ecart_pct ?? 0).toFixed(1)}%)
                  </span>
                </>
              )}
            </div>
          )}

          {/* Zone d'intervention (Contrôleur / Comptable) */}
          {expanded[alerte.id] && onDebloquer && (
            <div className="px-4 pb-4 pt-2 bg-white border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                {alerte.type === 'ECART_POIDS_CHARGEMENT'
                  ? '✅ Débloquer le départ — motif obligatoire'
                  : '🔒 Clore le litige retour'}
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-48">
                  <label className="block text-xs text-gray-500 mb-1">Motif de l'intervention</label>
                  <input
                    type="text"
                    placeholder="Ex : vérification physique effectuée..."
                    value={motifs[alerte.id] ?? ''}
                    onChange={e => setMotifs(m => ({ ...m, [alerte.id]: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"/>
                </div>
                {alerte.type === 'ECART_CAISSES_RETOUR' && (
                  <div className="w-36">
                    <label className="block text-xs text-gray-500 mb-1">Ajustement caisses</label>
                    <input
                      type="number" min={0}
                      placeholder="0"
                      value={ajustements[alerte.id] ?? ''}
                      onChange={e => setAjustements(a => ({ ...a, [alerte.id]: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"/>
                  </div>
                )}
                <button
                  disabled={!(motifs[alerte.id]?.trim())}
                  onClick={() => {
                    if (!motifs[alerte.id]?.trim()) return;
                    onDebloquer(alerte.id, alerte.livraison_id, alerte.type, motifs[alerte.id], parseInt(ajustements[alerte.id] ?? '0') || 0);
                    setExpanded(e => ({ ...e, [alerte.id]: false }));
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed">
                  <CheckCircle className="w-4 h-4" />
                  Valider &amp; Débloquer
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
