-- ============================================================
-- Migration: Secteurs, Clients, Produits, Livraison détails
-- ============================================================

-- Table des secteurs géographiques
CREATE TABLE IF NOT EXISTS secteurs (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL,
  description TEXT,
  zone        VARCHAR(50),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Table des produits
CREATE TABLE IF NOT EXISTS produits (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL,
  code        VARCHAR(50) UNIQUE NOT NULL,
  unite       VARCHAR(20) DEFAULT 'kg',
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Table des clients (liés à un secteur)
CREATE TABLE IF NOT EXISTS clients (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(150) NOT NULL,
  telephone   VARCHAR(20),
  adresse     TEXT,
  secteur_id  INT REFERENCES secteurs(id) ON DELETE SET NULL,
  actif       BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Table de liaison livraison ↔ client ↔ produit (détail livraison par client)
CREATE TABLE IF NOT EXISTS livraison_clients (
  id              SERIAL PRIMARY KEY,
  livraison_id    INT NOT NULL,
  client_id       INT REFERENCES clients(id) ON DELETE CASCADE,
  produit_id      INT REFERENCES produits(id) ON DELETE SET NULL,
  nb_caisses      INT NOT NULL DEFAULT 0,
  nb_caisses_retournees INT DEFAULT 0,
  ecart           INT GENERATED ALWAYS AS (nb_caisses - nb_caisses_retournees) STORED,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Ajouter colonne secteur_id à la table deliveries si elle n'existe pas
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS secteur_id INT REFERENCES secteurs(id) ON DELETE SET NULL;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS produit_id INT REFERENCES produits(id) ON DELETE SET NULL;

-- Données initiales: secteurs
INSERT INTO secteurs (nom, description, zone) VALUES
  ('Secteur Nord',   'Zone Nord de la ville',    'Nord'),
  ('Secteur Sud',    'Zone Sud de la ville',     'Sud'),
  ('Secteur Est',    'Zone Est et banlieue',     'Est'),
  ('Secteur Ouest',  'Zone Ouest industrielle',  'Ouest'),
  ('Secteur Centre', 'Centre-ville et marché',   'Centre')
ON CONFLICT DO NOTHING;

-- Données initiales: produits abattoir volaille
-- Unité = caisses (variable clé du système)
INSERT INTO produits (nom, code, unite, description) VALUES
  ('Poulet Entier Frais',      'VOL-001', 'caisses', 'Poulet entier frais, livré en caisses isothermes'),
  ('Poulet Entier Congelé',    'VOL-002', 'caisses', 'Poulet entier congelé, livré en caisses frigorigènes'),
  ('Découpe Cuisse/Pilon',     'VOL-003', 'caisses', 'Cuisses et pilons de poulet, conditionnés en caisses'),
  ('Blanc de Poulet',          'VOL-004', 'caisses', 'Filets et blancs de poulet, conditionnés en caisses'),
  ('Ailes de Poulet',          'VOL-005', 'caisses', 'Ailes de poulet conditionnées en caisses'),
  ('Foie & Abats de Volaille', 'VOL-006', 'caisses', 'Foies, gésiers et abats de volaille en caisses'),
  ('Dinde Entière',            'VOL-007', 'caisses', 'Dinde entière fraîche ou congelée en caisses'),
  ('Découpe Dinde',            'VOL-008', 'caisses', 'Morceaux de dinde conditionnés en caisses')
ON CONFLICT (code) DO NOTHING;

-- Données initiales: clients boucheries, GMS, restauration
INSERT INTO clients (nom, telephone, adresse, secteur_id) VALUES
  ('Boucherie El Baraka Nord',      '70 111 001', 'Av. de la Liberté, Ben Arous',    1),
  ('Supérette Nour Nord',           '70 111 002', '12 rue Tahar Haddad, Ben Arous',  1),
  ('Restauration Scolaire Nord',    '70 111 003', 'Cité Ettahrir, Bloc A',           1),
  ('Boucherie Ennour Sud',          '70 222 001', 'Marché Municipal, Mégrine',       2),
  ('GMS Magasin Général Sud',       '70 222 002', 'Route Sfax km 5, Mégrine',        2),
  ('Hôtel Résidence Sud',           '70 222 003', 'Zone touristique, Borj Cédria',   2),
  ('Grossiste Imed & Fils',         '71 333 001', 'Zone industrielle Mghira',        3),
  ('Boucherie El Amel Est',         '71 333 002', 'Rue Ibn Sina, Fouchana',          3),
  ('Supermarché Monoprix Est',       '71 333 003', 'Centre commercial Fouchana',      3),
  ('Boucherie Rahma Ouest',         '71 444 001', 'Marché Hédi Chaker, Ariana',      4),
  ('Coopérative Consommation Ouest','71 444 002', 'Route de Bizerte km 8',           4),
  ('Restauration Collective Ouest', '71 444 003', 'Zone industrielle Ksar Saïd',     4),
  ('Boucherie du Centre Ville',     '70 555 001', 'Rue de la Kasbah, Tunis',         5),
  ('GMS Carrefour Market Centre',   '70 555 002', 'Av. Habib Bourguiba, Tunis',      5),
  ('Hôtel Africa Tunis',            '70 555 003', '50 av. Habib Bourguiba, Tunis',   5)
ON CONFLICT DO NOTHING;
