import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, Truck, User, Scale } from 'lucide-react';
import { useAlertesPesee } from '../hooks/useAlertesPesee';
import { useAuth } from '../contexts/AuthContext';

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

export default function AlertesPeseePanel() {
  const { alertes, loading, error, validerAlerte } = useAlertesPesee(10000);
  const { agent, role } = useAuth();
  const [commentaire, setCommentaire] = useState<{ [key: number]: string }>({});
  const [traitementEnCours, setTraitementEnCours] = useState<{ [key: number]: boolean }>({});

  // Vérifier si l'utilisateur est contrôleur ou super admin
  const peutValider = role === 'controleur' || role === 'super_admin';

  const handleValidation = async (alerte: AlertePesee, statut: 'VALIDE' | 'REJETE') => {
    if (!peutValider || !agent?.id) return;

    setTraitementEnCours(prev => ({ ...prev, [alerte.id]: true }));

    try {
      await validerAlerte(alerte.id, agent.id, statut, commentaire[alerte.id]);
      // Supprimer le commentaire après validation
      setCommentaire(prev => {
        const newCommentaires = { ...prev };
        delete newCommentaires[alerte.id];
        return newCommentaires;
      });
    } catch (err) {
      console.error('Erreur validation:', err);
      alert('Erreur lors de la validation');
    } finally {
      setTraitementEnCours(prev => ({ ...prev, [alerte.id]: false }));
    }
  };

  if (!peutValider) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-orange-200 p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        <h3 className="font-bold text-gray-800 text-lg">Alertes de pesée en attente</h3>
        {alertes.length > 0 && (
          <span className="ml-auto bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full">
            {alertes.length} en attente
          </span>
        )}
      </div>

      {loading && (
        <div className="text-center py-4 text-gray-500">
          <Clock className="w-5 h-5 animate-spin mx-auto mb-2" />
          Chargement des alertes...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          Erreur: {error}
        </div>
      )}

      {!loading && !error && alertes.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
          <p>Aucune alerte en attente</p>
        </div>
      )}

      {!loading && !error && alertes.length > 0 && (
        <div className="space-y-4">
          {alertes.map((alerte) => (
            <div key={alerte.id} className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-orange-600" />
                  <span className="font-bold text-gray-800">{alerte.matricule}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(alerte.created_at).toLocaleString('fr-TN')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">Chauffeur: <strong>{alerte.chauffeur_nom}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">Agent: <strong>{alerte.agent_nom}</strong></span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 mb-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Poids vide</p>
                    <p className="font-bold text-gray-800">{alerte.poids_vide} kg</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Poids charge</p>
                    <p className="font-bold text-gray-800">{alerte.poids_charge} kg</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Poids factures</p>
                    <p className="font-bold text-gray-800">{alerte.poids_factures} kg</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Écart calculé</span>
                    <span className="font-bold text-red-600 text-lg">{alerte.ecart.toFixed(2)} kg</span>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Commentaire du contrôleur
                </label>
                <textarea
                  value={commentaire[alerte.id] || ''}
                  onChange={(e) => setCommentaire(prev => ({ ...prev, [alerte.id]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  rows={2}
                  placeholder="Ajouter un commentaire..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleValidation(alerte, 'VALIDE')}
                  disabled={traitementEnCours[alerte.id]}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Valider
                </button>
                <button
                  onClick={() => handleValidation(alerte, 'REJETE')}
                  disabled={traitementEnCours[alerte.id]}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
