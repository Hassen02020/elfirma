import Database from 'better-sqlite3';
import path from 'path';

const NB_CAMIONS = 250;
const NB_JOURS = 30;
const LIVRAISONS_PAR_CAMION_PAR_JOUR_MIN = 1;
const LIVRAISONS_PAR_CAMION_PAR_JOUR_MAX = 3;
const POIDS_CAISSE = 0.7; // 700g
const TOLERANCE = 0.05; // 5%

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function formatMatricule(index: number): string {
  const num = String(index).padStart(4, '0');
  return `190 TN ${num}`;
}

function generateDate(day: number, hour: number, minute: number): Date {
  const date = new Date(2026, 5, day); // Juin 2026
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function stressTest() {
  console.log('🚀 Démarrage du stress test avec SQLite...');
  console.log(`📊 Configuration: ${NB_CAMIONS} camions, ${NB_JOURS} jours`);
  
  const startTime = Date.now();
  let totalLivraisons = 0;
  let totalCaissesChargees = 0;
  let totalCaissesRetournees = 0;

  try {
    // Créer la base de données SQLite
    const dbPath = path.join(__dirname, '../../stress_test.db');
    const db = new Database(dbPath);
    
    console.log('📦 Base de données SQLite créée');

    // Créer les tables
    console.log('🔨 Création des tables...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS chauffeurs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        telephone TEXT,
        stock_caisses_actuel INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS camions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matricule TEXT UNIQUE NOT NULL,
        chauffeur_id INTEGER,
        capacite_max INTEGER DEFAULT 100,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chauffeur_id) REFERENCES chauffeurs(id)
      );

      CREATE TABLE IF NOT EXISTS deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        camion_id INTEGER,
        chauffeur_id INTEGER,
        poids_vide REAL NOT NULL,
        poids_charge REAL NOT NULL,
        nb_caisses_chargees INTEGER NOT NULL,
        nb_caisses_retournees INTEGER DEFAULT 0,
        statut TEXT DEFAULT 'en_cours',
        date DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (camion_id) REFERENCES camions(id),
        FOREIGN KEY (chauffeur_id) REFERENCES chauffeurs(id)
      );

      CREATE TABLE IF NOT EXISTS caisses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_unique TEXT UNIQUE NOT NULL,
        statut TEXT DEFAULT 'en_usine',
        camion_id INTEGER,
        chauffeur_id INTEGER,
        livraison_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tables créées');

    // Créer les chauffeurs et camions
    console.log(`🚚 Création de ${NB_CAMIONS} camions et chauffeurs...`);
    const chauffeurs: any[] = [];
    const camions: any[] = [];

    const insertChauffeur = db.prepare('INSERT INTO chauffeurs (nom, telephone, stock_caisses_actuel) VALUES (?, ?, ?)');
    const insertCamion = db.prepare('INSERT INTO camions (matricule, chauffeur_id, capacite_max) VALUES (?, ?, ?)');

    for (let i = 1; i <= NB_CAMIONS; i++) {
      const chauffeurResult = insertChauffeur.run(`Chauffeur ${i}`, `216 20 ${String(i).padStart(8, '0')}`, 0);
      chauffeurs.push({ id: chauffeurResult.lastInsertRowid });

      const camionResult = insertCamion.run(formatMatricule(i), chauffeurs[i - 1].id, 100);
      camions.push({ id: camionResult.lastInsertRowid });

      if (i % 50 === 0) {
        console.log(`   ${i}/${NB_CAMIONS} camions créés...`);
      }
    }
    console.log('✅ Camions et chauffeurs créés');

    // Créer les caisses initiales (10000 caisses à l'usine)
    console.log('📦 Création des caisses initiales...');
    const NB_CAISSES_INITIALES = 10000;
    const insertCaisse = db.prepare('INSERT INTO caisses (numero_unique, statut) VALUES (?, ?)');
    
    for (let i = 1; i <= NB_CAISSES_INITIALES; i++) {
      insertCaisse.run(`Caisse ${String(i).padStart(5, '0')}`, 'en_usine');

      if (i % 1000 === 0) {
        console.log(`   ${i}/${NB_CAISSES_INITIALES} caisses créées...`);
      }
    }
    console.log('✅ Caisses initiales créées');

    // Simuler les livraisons sur un mois
    console.log(`📈 Simulation des livraisons sur ${NB_JOURS} jours...`);
    
    const insertDelivery = db.prepare(
      `INSERT INTO deliveries 
       (camion_id, chauffeur_id, poids_vide, poids_charge, nb_caisses_chargees, nb_caisses_retournees, statut, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    
    for (let jour = 1; jour <= NB_JOURS; jour++) {
      console.log(`\n📅 Jour ${jour}/${NB_JOURS}`);
      
      for (let camionIndex = 0; camionIndex < NB_CAMIONS; camionIndex++) {
        const camion = camions[camionIndex];
        const chauffeur = chauffeurs[camionIndex];
        
        const nbLivraisons = randomInt(LIVRAISONS_PAR_CAMION_PAR_JOUR_MIN, LIVRAISONS_PAR_CAMION_PAR_JOUR_MAX);
        
        for (let livraisonIndex = 0; livraisonIndex < nbLivraisons; livraisonIndex++) {
          const heure = randomInt(6, 18);
          const minute = randomInt(0, 59);
          const date = generateDate(jour, heure, minute);
          
          const poidsVide = randomFloat(2000, 3000);
          const nbCaisses = randomInt(50, 100);
          const poidsTheorique = nbCaisses * POIDS_CAISSE;
          const variation = randomFloat(-TOLERANCE, TOLERANCE);
          const poidsNet = poidsTheorique * (1 + variation);
          const poidsCharge = poidsVide + poidsNet;
          
          const nbCaissesRetournees = randomInt(Math.floor(nbCaisses * 0.9), nbCaisses);
          
          insertDelivery.run(
            camion.id, 
            chauffeur.id, 
            poidsVide, 
            poidsCharge, 
            nbCaisses, 
            nbCaissesRetournees, 
            'termine', 
            date.toISOString()
          );
          
          totalLivraisons++;
          totalCaissesChargees += nbCaisses;
          totalCaissesRetournees += nbCaissesRetournees;
        }
      }
      
      console.log(`   Livraisons du jour: ${totalLivraisons} totales`);
    }

    console.log('\n✅ Stress test terminé avec succès!');
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n📊 Résultats du stress test:');
    console.log(`⏱️  Durée: ${duration.toFixed(2)} secondes`);
    console.log(`🚚 Camions: ${NB_CAMIONS}`);
    console.log(`📅 Jours: ${NB_JOURS}`);
    console.log(`📦 Total livraisons: ${totalLivraisons}`);
    console.log(`📊 Total caisses chargées: ${totalCaissesChargees}`);
    console.log(`📊 Total caisses retournées: ${totalCaissesRetournees}`);
    console.log(`📊 Taux de retour: ${((totalCaissesRetournees / totalCaissesChargees) * 100).toFixed(2)}%`);
    console.log(`⚡ Livraisons/seconde: ${(totalLivraisons / duration).toFixed(2)}`);
    
    // Vérifier les statistiques finales
    const stockResult = db.prepare('SELECT COUNT(*) as count FROM caisses WHERE statut = ?').get('en_usine') as any;
    const stockUsine = stockResult.count;
    
    console.log(`\n📦 Stock final à l'usine: ${stockUsine} caisses`);
    
    // Statistiques de la base de données
    const dbSize = (db.pragma('page_count') as number) * (db.pragma('page_size') as number) / 1024 / 1024;
    console.log(`💾 Taille de la base de données: ${dbSize.toFixed(2)} MB`);
    
    db.close();
    console.log(`\n💾 Base de données sauvegardée dans: ${dbPath}`);
    
  } catch (error) {
    console.error('❌ Erreur lors du stress test:', error);
    throw error;
  }
}

stressTest()
  .then(() => {
    console.log('\n✨ Stress test complété!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur:', error);
    process.exit(1);
  });
