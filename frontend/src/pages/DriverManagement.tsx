import React, { useState, useEffect } from 'react';
import API_BASE from '../config/api';
import DataTable from '../components/DataTable';
import { Phone, CheckCircle, XCircle, Clock, AlertCircle, X } from 'lucide-react';
import { driverSchema, validateDriverCodeUnique, validateSchema, type DriverFormData } from '../lib/validations';

interface Driver {
  id: number;
  nom: string;
  prenom?: string;
  codeEmploye: string;
  telephone?: string;
  statut: 'ACTIF' | 'INACTIF' | 'EN_CONGE';
  stockCaissesActuel: number;
  createdAt: string;
  updatedAt: string;
}

const DriverManagement: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState<DriverFormData>({
    nom: '',
    prenom: '',
    codeEmploye: '',
    telephone: '',
    statut: 'ACTIF'
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch data from API
  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/chauffeur`);
      const data = await response.json();
      setDrivers(data);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      // Fallback to mock data if API fails
      setDrivers([
        {
          id: 1,
          nom: 'Ben Ali',
          prenom: 'Ahmed',
          codeEmploye: 'EMP001',
          telephone: '216 20 123 456',
          statut: 'ACTIF',
          stockCaissesActuel: 45,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z'
        },
        {
          id: 2,
          nom: 'Trabelsi',
          prenom: 'Mohamed',
          codeEmploye: 'EMP002',
          telephone: '216 20 234 567',
          statut: 'ACTIF',
          stockCaissesActuel: 32,
          createdAt: '2024-01-16T10:00:00Z',
          updatedAt: '2024-01-16T10:00:00Z'
        },
        {
          id: 3,
          nom: 'Bouazizi',
          prenom: 'Sami',
          codeEmploye: 'EMP003',
          telephone: '216 20 345 678',
          statut: 'EN_CONGE',
          stockCaissesActuel: 0,
          createdAt: '2024-01-17T10:00:00Z',
          updatedAt: '2024-01-17T10:00:00Z'
        }
      ]);
    }
  };

  const columns = [
    {
      key: 'codeEmploye' as keyof Driver,
      label: 'Code Employé',
      render: (value: string) => <span className="font-mono font-medium">{value}</span>
    },
    {
      key: 'nom' as keyof Driver,
      label: 'Nom',
      render: (value: string, row: Driver) => (
        <div>
          <div className="font-medium">{row.prenom} {value}</div>
        </div>
      )
    },
    {
      key: 'telephone' as keyof Driver,
      label: 'Téléphone',
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <Phone size={16} />
          <span>{value || 'Non renseigné'}</span>
        </div>
      )
    },
    {
      key: 'stockCaissesActuel' as keyof Driver,
      label: 'Stock Caisses',
      render: (value: number) => (
        <span className="font-medium">{value} caisses</span>
      )
    },
    {
      key: 'statut' as keyof Driver,
      label: 'Statut',
      render: (value: string) => {
        const statusConfig = {
          ACTIF: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
          INACTIF: { color: 'bg-gray-100 text-gray-800', icon: XCircle },
          EN_CONGE: { color: 'bg-yellow-100 text-yellow-800', icon: Clock }
        };
        const config = statusConfig[value as keyof typeof statusConfig];
        const Icon = config.icon;
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
            <Icon size={14} />
            {value}
          </span>
        );
      }
    }
  ];

  const handleAdd = () => {
    setEditingDriver(null);
    setFormData({
      nom: '',
      prenom: '',
      codeEmploye: '',
      telephone: '',
      statut: 'ACTIF'
    });
    setValidationErrors({});
    setShowModal(true);
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      nom: driver.nom,
      prenom: driver.prenom || '',
      codeEmploye: driver.codeEmploye,
      telephone: driver.telephone || '',
      statut: driver.statut
    });
    setValidationErrors({});
    setShowModal(true);
  };

  const handleDelete = (driver: Driver) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le chauffeur ${driver.prenom} ${driver.nom}?`)) {
      setDrivers(drivers.filter(d => d.id !== driver.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validation = validateSchema(formData, driverSchema);
    
    if (!validation.success) {
      setValidationErrors(validation.errors);
      return;
    }

    // Validate code employe uniqueness
    if (!validateDriverCodeUnique(formData.codeEmploye, drivers, editingDriver?.id)) {
      setValidationErrors({ codeEmploye: 'Ce code employé existe déjà' });
      return;
    }

    setValidationErrors({});

    if (editingDriver) {
      // Update existing driver
      setDrivers(drivers.map(d => 
        d.id === editingDriver.id 
          ? { 
              ...d, 
              ...formData, 
              updatedAt: new Date().toISOString()
            }
          : d
      ));
    } else {
      // Add new driver
      const newDriver: Driver = {
        id: Math.max(...drivers.map(d => d.id)) + 1,
        ...formData,
        stockCaissesActuel: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setDrivers([...drivers, newDriver]);
    }

    setShowModal(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestion des Chauffeurs</h1>
        <p className="text-gray-600 mt-2">Gérez votre équipe de chauffeurs</p>
      </div>

      <DataTable
        data={drivers}
        columns={columns}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchable={true}
        searchPlaceholder="Rechercher par nom, prénom ou code employé..."
        searchFields={['nom', 'prenom', 'codeEmploye']}
        title="Liste des Chauffeurs"
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingDriver ? 'Modifier le Chauffeur' : 'Ajouter un Chauffeur'}
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
                  Nom *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent ${
                    validationErrors.nom ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ex: Ben Ali"
                />
                {validationErrors.nom && (
                  <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {validationErrors.nom}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prénom
                </label>
                <input
                  type="text"
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent ${
                    validationErrors.prenom ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ex: Ahmed"
                />
                {validationErrors.prenom && (
                  <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {validationErrors.prenom}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code Employé *
                </label>
                <input
                  type="text"
                  required
                  value={formData.codeEmploye}
                  onChange={(e) => setFormData({ ...formData, codeEmploye: e.target.value.toUpperCase() })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent ${
                    validationErrors.codeEmploye ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ex: EMP001"
                />
                {validationErrors.codeEmploye && (
                  <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {validationErrors.codeEmploye}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-elfirma-green focus:border-transparent ${
                    validationErrors.telephone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ex: 216 20 123 456"
                />
                {validationErrors.telephone && (
                  <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {validationErrors.telephone}
                  </p>
                )}
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
                  <option value="EN_CONGE">En Congé</option>
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
                  {editingDriver ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverManagement;
