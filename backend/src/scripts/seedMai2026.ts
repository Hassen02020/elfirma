/**
 * SEED MAI 2026 — EL FIRMA Caisse Management
 * Initialise la base NeonDB avec :
 *  - Schéma complet (postes, agents, chauffeurs, camions, secteurs, clients, produits)
 *  - 31 jours de livraisons (mai 2026) pour 3 camions
 *  - Départs + retours avec poids, caisses, écarts aléatoires réalistes
 *  - Rapport final affiché en console
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function rndF(min: number, max: number) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}
function dateMAI(day: number, hour = 8, min = 0) {
  return new Date(2026, 4, day, hour, min, 0); // mois 4 = mai
}

async function run() {
  const client = await pool.connect();
  console.log('✅ Connecté à NeonDB\n');

  try {
    // ─── 1. SCHEMA ─────────────────────────────────────────────
    console.log('📄 Application du schéma de base...');
    try { await client.query(`
      CREATE TABLE IF NOT EXISTS postes (
        id SERIAL PRIMARY KEY, nom VARCHAR(100), type VARCHAR(10),
        heure_debut VARCHAR(5) DEFAULT '06:00', heure_fin VARCHAR(5) DEFAULT '18:00',
        actif BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY, nom VARCHAR(100), prenom VARCHAR(100),
        code_agent VARCHAR(20) UNIQUE NOT NULL, poste_id INTEGER REFERENCES postes(id),
        role VARCHAR(30) NOT NULL, actif BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS chauffeurs (
        id SERIAL PRIMARY KEY, nom VARCHAR(100), prenom VARCHAR(100),
        code_employe VARCHAR(50) UNIQUE, telephone VARCHAR(20),
        statut VARCHAR(20) DEFAULT 'ACTIF', stock_caisses_actuel INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS camions (
        id SERIAL PRIMARY KEY, serie VARCHAR(50) UNIQUE, matricule VARCHAR(50) UNIQUE NOT NULL,
        modele VARCHAR(100), chauffeur_id INTEGER REFERENCES chauffeurs(id),
        capacite_max INTEGER DEFAULT 100, statut VARCHAR(20) DEFAULT 'ACTIF',
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS secteurs (
        id SERIAL PRIMARY KEY, nom VARCHAR(100), description TEXT, zone VARCHAR(50),
        actif BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY, nom VARCHAR(100), telephone VARCHAR(20),
        adresse TEXT, secteur_id INTEGER REFERENCES secteurs(id),
        actif BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS produits (
        id SERIAL PRIMARY KEY, nom VARCHAR(100), code VARCHAR(50) UNIQUE,
        unite VARCHAR(20) DEFAULT 'caisses', actif BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS deliveries (
        id SERIAL PRIMARY KEY,
        camion_id INTEGER REFERENCES camions(id),
        chauffeur_id INTEGER REFERENCES chauffeurs(id),
        agent_id INTEGER REFERENCES agents(id),
        type VARCHAR(10) CHECK (type IN ('depart','retour')),
        nb_caisses_chargees INTEGER DEFAULT 0,
        nb_caisses_retournees INTEGER DEFAULT 0,
        poids_vide NUMERIC(10,2) DEFAULT 0,
        poids_charge NUMERIC(10,2) DEFAULT 0,
        poids_produit NUMERIC(10,2) DEFAULT 0,
        poids_caisses NUMERIC(10,2) DEFAULT 0,
        statut VARCHAR(30) DEFAULT 'en_attente',
        validee BOOLEAN DEFAULT false,
        date TIMESTAMP DEFAULT NOW(),
        heure VARCHAR(10),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `); } catch { console.log('ℹ️  Tables déjà existantes, on continue...'); }
    console.log('✅ Tables vérifiées\n');

    // ─── 2. DONNÉES DE BASE ─────────────────────────────────────
    // Postes
    await client.query(`
      INSERT INTO postes (nom, type, heure_debut, heure_fin) VALUES
        ('Poste Jour','JOUR','06:00','18:00'),
        ('Poste Nuit','NUIT','18:00','06:00')
      ON CONFLICT DO NOTHING
    `);

    // Agents
    await client.query(`
      INSERT INTO agents (nom, prenom, code_agent, poste_id, role) VALUES
        ('Hamdi',    'Ali',        '1111', 1, 'agent'),
        ('Maaloul',  'Sonia',      '1122', 1, 'agent'),
        ('Lounissi', 'Said',       '1133', 1, 'controleur'),
        ('Ferchichi','Nizar',      '2211', 2, 'agent'),
        ('Belhadj',  'Rim',        '2222', 2, 'agent'),
        ('Lounissi', 'Said',       '2233', 2, 'controleur'),
        ('Admin',    'Comptable',  '3333', 1, 'comptable'),
        ('Brahmi',   'Logistique', '4444', 1, 'logistique')
      ON CONFLICT (code_agent) DO UPDATE SET nom=EXCLUDED.nom, prenom=EXCLUDED.prenom
    `);

    // Secteurs
    await client.query(`
      INSERT INTO secteurs (nom, description, zone) VALUES
        ('Secteur Nord','Zone nord','Nord'),('Secteur Sud','Zone sud','Sud'),
        ('Secteur Est','Zone est','Est'),('Secteur Ouest','Zone ouest','Ouest'),
        ('Secteur Centre','Zone centre','Centre')
      ON CONFLICT DO NOTHING
    `);

    // Produits
    await client.query(`
      INSERT INTO produits (nom, code, unite) VALUES
        ('Poulet Entier Frais','VOL-001','caisses'),
        ('Poulet Entier Congelé','VOL-002','caisses'),
        ('Découpe Cuisse/Pilon','VOL-003','caisses')
      ON CONFLICT (code) DO NOTHING
    `);

    // Chauffeurs
    const chauffeursData = [
      { nom: 'Ben Ali',  prenom: 'Ahmed',   code: 'CHF-001', tel: '216 20 123 456' },
      { nom: 'Trabelsi', prenom: 'Mohamed', code: 'CHF-002', tel: '216 20 234 567' },
      { nom: 'Bouazizi', prenom: 'Sami',    code: 'CHF-003', tel: '216 20 345 678' },
    ];
    const chauffeurIds: number[] = [];
    for (const c of chauffeursData) {
      const r = await client.query(`
        INSERT INTO chauffeurs (nom, prenom, code_employe, telephone, statut)
        VALUES ($1,$2,$3,$4,'ACTIF')
        ON CONFLICT (code_employe) DO UPDATE SET nom=EXCLUDED.nom
        RETURNING id
      `, [c.nom, c.prenom, c.code, c.tel]);
      chauffeurIds.push(r.rows[0].id);
    }

    // Camions
    const camionsData = [
      { serie: 'CAM-001', matricule: '190 TN 1234', modele: 'Mercedes Actros' },
      { serie: 'CAM-002', matricule: '190 TN 5678', modele: 'Renault Trucks'  },
      { serie: 'CAM-003', matricule: '190 TN 9012', modele: 'MAN TGX'         },
    ];
    const camionIds: number[] = [];
    for (let i = 0; i < camionsData.length; i++) {
      const c = camionsData[i];
      const r = await client.query(`
        INSERT INTO camions (serie, matricule, modele, chauffeur_id, capacite_max, statut)
        VALUES ($1,$2,$3,$4,150,'ACTIF')
        ON CONFLICT (matricule) DO UPDATE SET modele=EXCLUDED.modele
        RETURNING id
      `, [c.serie, c.matricule, c.modele, chauffeurIds[i]]);
      camionIds.push(r.rows[0].id);
    }

    // Agents (IDs)
    const agentRes = await client.query(`SELECT id, role FROM agents ORDER BY id`);
    const agentJour = agentRes.rows.find((a: any) => a.role === 'agent' && a.id % 2 === 1)?.id || 1;

    console.log('✅ Données de base insérées\n');

    // ─── 3. LIVRAISONS MAI 2026 ──────────────────────────────────
    console.log('📦 Génération des livraisons — Mai 2026 (31 jours × 3 camions)...\n');

    await client.query(`DELETE FROM deliveries WHERE date >= '2026-05-01' AND date < '2026-06-01'`);

    let totalDeparts = 0, totalRetours = 0;
    let totalCaissesChargees = 0, totalCaissesRetournees = 0;
    let totalPoidsNet = 0;
    let totalEcartCaisses = 0;
    const statsParCamion: Record<string, any> = {};

    for (let day = 1; day <= 31; day++) {
      // Camion 1 fait 1 tournée/jour, Camion 2 fait 1, Camion 3 fait 1 sauf weekend
      const isWeekend = [0, 6].includes(dateMAI(day).getDay());

      for (let ci = 0; ci < camionIds.length; ci++) {
        if (ci === 2 && isWeekend) continue; // Camion 3 repos weekend

        const camionId   = camionIds[ci];
        const chauffeurId = chauffeurIds[ci];
        const matricule  = camionsData[ci].matricule;
        const chauffeur  = `${chauffeursData[ci].nom} ${chauffeursData[ci].prenom}`;

        if (!statsParCamion[matricule]) {
          statsParCamion[matricule] = { chauffeur, departs: 0, retours: 0, caisses_ch: 0, caisses_ret: 0, poids_net: 0, ecarts: 0 };
        }

        const nbCaisses = rnd(80, 130);
        const poidsVide  = rndF(8000, 9000);
        const poidsCaisse = 0.7;
        const poidsProduit = rndF(10, 14);
        const poidsCharge = poidsVide + nbCaisses * poidsCaisse + nbCaisses * poidsProduit;
        const poidsNet   = parseFloat((poidsCharge - poidsVide - nbCaisses * poidsCaisse).toFixed(2));

        // Départ
        const heureDepart = `${String(rnd(6,9)).padStart(2,'0')}:${String(rnd(0,59)).padStart(2,'0')}`;
        await client.query(`
          INSERT INTO deliveries
            (camion_id, chauffeur_id, agent_id, type, nb_caisses_chargees,
             poids_vide, poids_charge, poids_produit, poids_caisses,
             statut, validee, date, heure)
          VALUES ($1,$2,$3,'depart',$4,$5,$6,$7,$8,'termine',true,$9,$10)
        `, [
          camionId, chauffeurId, agentJour, nbCaisses,
          poidsVide, poidsCharge, poidsNet, poidsCaisse * nbCaisses,
          dateMAI(day, 7, rnd(0, 59)), heureDepart
        ]);
        totalDeparts++;
        totalCaissesChargees += nbCaisses;
        totalPoidsNet += poidsNet;
        statsParCamion[matricule].departs++;
        statsParCamion[matricule].caisses_ch += nbCaisses;
        statsParCamion[matricule].poids_net  += poidsNet;

        // Retour (avec possible écart de caisses)
        const ecart = Math.random() < 0.15 ? rnd(1, 5) : 0; // 15% chance d'écart
        const nbRetournees = nbCaisses - ecart;
        const heureRetour = `${String(rnd(15,19)).padStart(2,'0')}:${String(rnd(0,59)).padStart(2,'0')}`;

        await client.query(`
          INSERT INTO deliveries
            (camion_id, chauffeur_id, agent_id, type, nb_caisses_chargees, nb_caisses_retournees,
             poids_vide, poids_charge, statut, validee, date, heure, notes)
          VALUES ($1,$2,$3,'retour',$4,$5,$6,$7,'termine',true,$8,$9,$10)
        `, [
          camionId, chauffeurId, agentJour, nbCaisses, nbRetournees,
          poidsVide, poidsVide + rndF(50, 200),
          dateMAI(day, 16, rnd(0, 59)), heureRetour,
          ecart > 0 ? `Écart de ${ecart} caisses non retournées` : null
        ]);
        totalRetours++;
        totalCaissesRetournees += nbRetournees;
        totalEcartCaisses += ecart;
        statsParCamion[matricule].retours++;
        statsParCamion[matricule].caisses_ret += nbRetournees;
        statsParCamion[matricule].ecarts += ecart;
      }
    }

    // ─── 4. RAPPORT CONSOLE ──────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════════');
    console.log('         RAPPORT MAI 2026 — EL FIRMA CAISSE MANAGEMENT     ');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📊 SYNTHÈSE GLOBALE');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`  Total départs          : ${totalDeparts}`);
    console.log(`  Total retours          : ${totalRetours}`);
    console.log(`  Total caisses chargées : ${totalCaissesChargees}`);
    console.log(`  Total caisses retournées: ${totalCaissesRetournees}`);
    console.log(`  Écart total caisses    : ${totalEcartCaisses}`);
    console.log(`  Poids net total        : ${totalPoidsNet.toFixed(0)} kg`);
    console.log(`  Poids net moyen/tour   : ${(totalPoidsNet / totalDeparts).toFixed(1)} kg\n`);

    console.log('🚚 PERFORMANCE PAR CAMION');
    console.log('───────────────────────────────────────────────────────────');
    for (const [mat, s] of Object.entries(statsParCamion) as any) {
      const tauxRetour = s.caisses_ch > 0 ? ((s.caisses_ret / s.caisses_ch) * 100).toFixed(1) : '0';
      console.log(`  ${mat} — ${s.chauffeur}`);
      console.log(`    Départs: ${s.departs} | Retours: ${s.retours}`);
      console.log(`    Caisses chargées: ${s.caisses_ch} | Retournées: ${s.caisses_ret} | Écarts: ${s.ecarts}`);
      console.log(`    Taux retour: ${tauxRetour}% | Poids net: ${s.poids_net.toFixed(0)} kg`);
      console.log();
    }

    // Vérification depuis DB
    const dbCheck = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE type='depart') as nb_departs,
        COUNT(*) FILTER (WHERE type='retour') as nb_retours,
        SUM(nb_caisses_chargees) FILTER (WHERE type='depart') as total_ch,
        SUM(nb_caisses_retournees) FILTER (WHERE type='retour') as total_ret,
        ROUND(AVG(poids_produit) FILTER (WHERE type='depart'),2) as poids_moy
      FROM deliveries
      WHERE date >= '2026-05-01' AND date < '2026-06-01'
    `);
    const db = dbCheck.rows[0];
    console.log('✅ VÉRIFICATION EN BASE (NeonDB)');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`  Départs en DB          : ${db.nb_departs}`);
    console.log(`  Retours en DB          : ${db.nb_retours}`);
    console.log(`  Caisses chargées en DB : ${db.total_ch}`);
    console.log(`  Caisses retournées DB  : ${db.total_ret}`);
    console.log(`  Poids net moyen (DB)   : ${db.poids_moy} kg`);
    console.log('\n✅ Seed Mai 2026 terminé avec succès !');

  } catch (err: any) {
    console.error('❌ Erreur :', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
