import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Application de la migration v6 (validation de pesée)...');
    
    // Lire le fichier de migration
    const migrationPath = path.join(__dirname, '../database/migration_v6_pesee_validation.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Exécuter la migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration v6 appliquée avec succès !');
    console.log('📋 Champs ajoutés :');
    console.log('   - poids_factures (DECIMAL)');
    console.log('   - ecart (DECIMAL)');
    console.log('   - statut_validation (VARCHAR)');
    console.log('   - controleur_id (INTEGER)');
    console.log('   - controleur_commentaire (TEXT)');
    console.log('   - alerte_envoyee (BOOLEAN)');
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
