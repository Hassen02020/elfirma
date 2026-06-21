-- ============================================================
--  Migration v4 — Stock Volaille (Congelé / Surgelé)
--  Idempotente
-- ============================================================

-- ─── Table stock_volaille ────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_volaille (
  id              SERIAL PRIMARY KEY,
  date_production DATE          NOT NULL DEFAULT CURRENT_DATE,
  type_produit    VARCHAR(20)   NOT NULL CHECK (type_produit IN ('CONGELE','SURGELE')),
  designation     VARCHAR(100)  NOT NULL,          -- ex: Poulet entier, Découpes, Abats...
  quantite_kg     DECIMAL(10,2) NOT NULL DEFAULT 0,
  nb_caisses      INTEGER       NOT NULL DEFAULT 0,
  nb_caisses_en_circulation  INTEGER DEFAULT 0,
  nb_caisses_retournees      INTEGER DEFAULT 0,
  temperature_c   DECIMAL(5,1), -- température de stockage (°C)
  lot             VARCHAR(50),  -- numéro de lot traçabilité
  saisie_par      INTEGER REFERENCES agents(id),
  note            TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_volaille_date ON stock_volaille(date_production);
CREATE INDEX IF NOT EXISTS idx_stock_volaille_type ON stock_volaille(type_produit);

-- ─── Table mouvements_caisses (départ/retour frigos) ─────────
CREATE TABLE IF NOT EXISTS mouvements_caisses (
  id              SERIAL PRIMARY KEY,
  stock_id        INTEGER       REFERENCES stock_volaille(id) ON DELETE CASCADE,
  type_mvt        VARCHAR(20)   NOT NULL CHECK (type_mvt IN ('DEPART_FRIGO','RETOUR_FRIGO','CORRECTION')),
  nb_caisses      INTEGER       NOT NULL,
  chauffeur_id    INTEGER       REFERENCES chauffeurs(id),
  camion_id       INTEGER       REFERENCES camions(id),
  agent_id        INTEGER       REFERENCES agents(id),
  motif           TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mvt_caisses_stock  ON mouvements_caisses(stock_id);
CREATE INDEX IF NOT EXISTS idx_mvt_caisses_date   ON mouvements_caisses(created_at);

-- ─── Colonne correction sur stock_volaille ────────────────────
ALTER TABLE stock_volaille ADD COLUMN IF NOT EXISTS correction_super_admin DECIMAL(10,2) DEFAULT 0;
ALTER TABLE stock_volaille ADD COLUMN IF NOT EXISTS correction_motif       TEXT;
ALTER TABLE stock_volaille ADD COLUMN IF NOT EXISTS corrige_par            INTEGER REFERENCES agents(id);
ALTER TABLE stock_volaille ADD COLUMN IF NOT EXISTS corrige_at             TIMESTAMP;

-- ─── Vue consolidée stock du jour ─────────────────────────────
CREATE OR REPLACE VIEW v_stock_volaille_jour AS
SELECT
  sv.date_production,
  sv.type_produit,
  sv.designation,
  SUM(sv.quantite_kg)   AS total_kg,
  SUM(sv.nb_caisses)    AS total_caisses,
  SUM(sv.nb_caisses_en_circulation) AS caisses_en_circulation,
  SUM(sv.nb_caisses_retournees)     AS caisses_retournees,
  SUM(sv.nb_caisses) - SUM(sv.nb_caisses_en_circulation) AS caisses_disponibles
FROM stock_volaille sv
GROUP BY sv.date_production, sv.type_produit, sv.designation;

-- ─── Données initiales (exemple) ─────────────────────────────
INSERT INTO stock_volaille (date_production, type_produit, designation, quantite_kg, nb_caisses, lot)
SELECT CURRENT_DATE, 'CONGELE', 'Poulet entier congelé', 2400.00, 80, 'LOT-2026-001'
WHERE NOT EXISTS (SELECT 1 FROM stock_volaille WHERE date_production = CURRENT_DATE AND type_produit = 'CONGELE' LIMIT 1);

INSERT INTO stock_volaille (date_production, type_produit, designation, quantite_kg, nb_caisses, lot)
SELECT CURRENT_DATE, 'SURGELE', 'Découpes surgelées', 1800.00, 60, 'LOT-2026-002'
WHERE NOT EXISTS (SELECT 1 FROM stock_volaille WHERE date_production = CURRENT_DATE AND type_produit = 'SURGELE' LIMIT 1);
