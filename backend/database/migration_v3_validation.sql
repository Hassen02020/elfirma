-- =============================================================
--  Migration v3 — Validation chargement & retour caisses
--  Idempotente : peut être exécutée plusieurs fois sans erreur
-- =============================================================

-- ─── Colonnes Étape 1 : validation chargement (poids net) ────
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS poids_commande      DECIMAL(10,2) DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS ecart_poids         DECIMAL(10,2) DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS ecart_poids_pct     DECIMAL(6,3)  DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS statut_chargement   VARCHAR(30)   DEFAULT 'EN_ATTENTE'
  CHECK (statut_chargement IN ('EN_ATTENTE','VALIDE_AUTO','ECART_BLOQUE','DEBLOQUE_CTRL'));
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS deblocage_agent_id  INTEGER REFERENCES agents(id);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS deblocage_at        TIMESTAMP;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS deblocage_motif     TEXT;

-- ─── Colonnes Étape 2 : validation retour caisses ─────────────
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS ecart_caisses_retour INTEGER      DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS ecart_caisses_pct    DECIMAL(6,3) DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS statut_litige        VARCHAR(30)   DEFAULT 'AUCUN'
  CHECK (statut_litige IN ('AUCUN','LITIGE_RETOUR','LITIGE_RESOLU','PERTES_ACCEPTEES'));
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS litige_agent_id      INTEGER REFERENCES agents(id);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS litige_at            TIMESTAMP;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS litige_motif         TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS ajustement_caisses   INTEGER      DEFAULT 0;

-- ─── Table des alertes actives ────────────────────────────────
CREATE TABLE IF NOT EXISTS alertes_actives (
  id            SERIAL PRIMARY KEY,
  livraison_id  INTEGER      REFERENCES deliveries(id) ON DELETE CASCADE,
  type          VARCHAR(30)  NOT NULL
    CHECK (type IN ('ECART_POIDS_CHARGEMENT','ECART_CAISSES_RETOUR')),
  niveau        VARCHAR(20)  DEFAULT 'CRITIQUE'
    CHECK (niveau IN ('INFO','ATTENTION','CRITIQUE')),
  message       TEXT         NOT NULL,
  detail        JSONB        DEFAULT '{}',
  resolue       BOOLEAN      DEFAULT false,
  resolue_at    TIMESTAMP,
  resolue_par   INTEGER      REFERENCES agents(id),
  created_at    TIMESTAMP    DEFAULT NOW(),
  updated_at    TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertes_resolue     ON alertes_actives(resolue);
CREATE INDEX IF NOT EXISTS idx_alertes_livraison   ON alertes_actives(livraison_id);
CREATE INDEX IF NOT EXISTS idx_alertes_type        ON alertes_actives(type);

-- ─── Seuils de tolérance (stockés avec le barème) ────────────
-- Les seuils par défaut sont gérés en mémoire dans validation.ts :
--   seuil_ecart_poids_pct     = 2   (%)  -> déclenchement alerte
--   seuil_alerte_caisses      = 3   (nb) -> litige retour
--   seuil_alerte_caisses_pct  = 5   (%)  -> litige retour %
ALTER TABLE bareme_sanctions ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
-- (La colonne config existe déjà depuis migration v2, clause IF NOT EXISTS couvre les deux cas)
