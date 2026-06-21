import React, { useState, useEffect } from 'react';
import API_BASE from '../config/api';
import DataTable from '../components/DataTable';
import { Truck, X } from 'lucide-react';

interface Truck {
  id: number;
  serie: string;
  matricule: string;
  modele?: string;
  chauffeurId?: number;
  capaciteMax: number;
  statut: 'ACTIF' | 'INACTIF' | 'EN_MAINTENANCE';
  createdAt: string;
  updatedAt: string;
}

interface Chauffeur {
  id: number;
  nom: string;
  prenom?: string;
  codeEmploye: string;
}

const TruckManagement: React.FC = () => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [formData, setFormData] = useState<{
    serie: string;
    matricule: string;
    modele: string;
    chauffeurId: string;
    capaciteMax: string;
    statut: 'ACTIF' | 'INACTIF' | 'EN_MAINTENANCE';
  }>({
    serie: '',
    matricule: '',
    modele: '',
    chauffeurId: '',
    capaciteMax: '100',
    statut: 'ACTIF'
  });

  // Fetch data from API
  useEffect(() => {
    fetchTrucks();
    fetchChauffeurs();
  }, []);

  const fetchTrucks = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/camion`);
      const data = await response.json();
      setTrucks(data);
    } catch (error) {
      console.error('Error fetching trucks:', error);
      // Fallback to mock data if API fails
      setTrucks([
        {
          id: 1,
          serie: 'SER001',
          matricule: '190 TN 1234',
          modele: 'Renault Trucks T480',
          chauffeurId: 1,
          capaciteMax: 100,
          statut: 'ACTIF',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z'
        },
        {
          id: 2,
          serie: 'SER002',
          matricule: '190 TN 5678',
          modele: 'Volvo FH',
          chauffeurId: 2,
          capaciteMax: 100,
          statut: 'ACTIF',
          createdAt: '2024-01-16T10:00:00Z',
          updatedAt: '2024-01-16T10:00:00Z'
        },
        {
          id: 3,
          serie: 'SER003',
          matricule: '190 TN 9012',
          modele: 'Scania R450',
          chauffeurId: 3,
          capaciteMax: 100,
          statut: 'EN_MAINTENANCE',
          createdAt: '2024-01-17T10:00:00Z',
          updatedAt: '2024-01-17T10:00:00Z'
        }
      ]);
    }
  };

  const fetchChauffeurs = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/chauffeur`);
      const data = await response.json();
      setChauffeurs(data);
    } catch (error) {
      console.error('Error fetching chauffeurs:', error);
      // Fallback to mock data if API fails
      setChauffeurs([
        { id: 1, nom: 'Ben Ali', prenom: 'Ahmed', codeEmploye: 'EMP001' },
        { id: 2, nom: 'Trabelsi', prenom: 'Mohamed', codeEmploye: 'EMP002' },
        { id: 3, nom: 'Bouazizi', prenom: 'Sami', codeEmploye: 'EMP003' }
      ]);
    }
  };

  const columns = [
    {
      key: 'serie' as keyof Truck,
      label: 'Série',
      render: (value: string) => <span className="font-medium">{value}</span>
    },
    {
      key: 'matricule' as keyof Truck,
      label: 'Immatriculation'
    },
    {
      key: 'modele' as keyof Truck,
      label: 'Modèle'
    },
    {
      key: 'chauffeurId' as keyof Truck,
      label: 'Chauffeur',
      render: (value: number) => {
        const chauffeur = chauffeurs.find(c => c.id === value);
        return chauffeur ? `${chauffeur.prenom} ${chauffeur.nom}` : 'Non assigné';
      }
    },
    {
      key: 'capaciteMax' as keyof Truck,
      label: 'Capacité Max',
      render: (value: number) => `${value} caisses`
    },
    {
      key: 'statut' as keyof Truck,
      label: 'Statut',
      render: (value: string) => {
        const statusColors = {
          ACTIF: 'bg-green-100 text-green-800',
          INACTIF: 'bg-gray-100 text-gray-800',
          EN_MAINTENANCE: 'bg-yellow-100 text-yellow-800'
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[value as keyof typeof statusColors]}`}>
            {value}
          </span>
        );
      }
    }
  ];

  const handleAdd = () => {
    setEditingTruck(null);
    setFormData({
      serie: '',
      matricule: '',
      modele: '',
      chauffeurId: '',
      capaciteMax: '100',
      statut: 'ACTIF'
    });
    setShowModal(true);
  };

  const handleEdit = (truck: Truck) => {
    setEditingTruck(truck);
    setFormData({
      serie: truck.serie,
      matricule: truck.matricule,
      modele: truck.modele || '',
      chauffeurId: truck.chauffeurId?.toString() || '',
      capaciteMax: truck.capaciteMax.toString(),
      statut: truck.statut
    });
    setShowModal(true);
  };

  const handleDelete = (truck: Truck) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le camion ${truck.matricule}?`)) {
      setTrucks(trucks.filter(t => t.id !== truck.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingTruck) {
      // Update existing truck
      setTrucks(trucks.map(t => 
        t.id === editingTruck.id 
          ? { 
              ...t, 
              ...formData, 
              chauffeurId: formData.chauffeurId ? parseInt(formData.chauffeurId) : undefined,
              capaciteMax: parseInt(formData.capaciteMax),
              updatedAt: new Date().toISOString()
            }
          : t
      ));
    } else {
      // Add new truck
      const newTruck: Truck = {
        id: Math.max(...trucks.map(t => t.id)) + 1,
        ...formData,
        chauffeurId: formData.chauffeurId ? parseInt(formData.chauffeurId) : undefined,
        capaciteMax: parseInt(formData.capaciteMax),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setTrucks([...trucks, newTruck]);
    }

    setShowModal(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestion des Camions</h1>
        <p className="text-gray-600 mt-2">Gérez votre flotte de camions</p>
      </div>

      <DataTable
        data={trucks}
        columns={columns}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchable={true}
        searchPlaceholder="Rechercher par série, immatriculation ou modèle..."
        searchFields={['serie', 'matricule', 'modele']}
        title="Liste des Camions"
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingTruck ? 'Modifier le Camion' : 'Ajouter un Camion'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Série *
                </label>
                <input
                  type="text"
                  required
                  value={formData.serie}
                  onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent"
                  placeholder="Ex: SER001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Immatriculation *
                </label>
                <input
                  type="text"
                  required
                  value={formData.matricule}
                  onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent"
                  placeholder="Ex: 190 TN 1234"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modèle
                </label>
                <input
                  type="text"
                  value={formData.modele}
                  onChange={(e) => setFormData({ ...formData, modele: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent"
                  placeholder="Ex: Renault Trucks T480"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chauffeur
                </label>
                <select
                  value={formData.chauffeurId}
                  onChange={(e) => setFormData({ ...formData, chauffeurId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent"
                >
                  <option value="">Non assigné</option>
                  {chauffeurs.map(chauffeur => (
                    <option key={chauffeur.id} value={chauffeur.id}>
                      {chauffeur.prenom} {chauffeur.nom} ({chauffeur.codeEmploye})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacité Max (caisses) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.capaciteMax}
                  onChange={(e) => setFormData({ ...formData, capaciteMax: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut *
                </label>
                <select
                  value={formData.statut}
                  onChange={(e) => setFormData({ ...formData, statut: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent"
                >
                  <option value="ACTIF">Actif</option>
                  <option value="INACTIF">Inactif</option>
                  <option value="EN_MAINTENANCE">En Maintenance</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-elfirma-green text-white rounded-lg hover:bg-elfirma-green-dark transition-colors"
                >
                  {editingTruck ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TruckManagement;
