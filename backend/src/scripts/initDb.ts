import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  const client = await pool.connect();
  try {
    console.log('✅ Connecté à NeonDB');
    const schemaPath = path.join(__dirname, '../../../database/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    console.log('📄 Exécution du schéma...');
    await client.query(sql);
    console.log('✅ Schéma appliqué avec succès');

    // Vérification
    const agents = await client.query('SELECT nom, prenom, code_agent, role FROM agents ORDER BY id');
    console.log('\n👥 Agents en base :');
    agents.rows.forEach(a => console.log(`  [${a.role}] ${a.nom} ${a.prenom} — PIN: ${a.code_agent}`));

    const postes = await client.query('SELECT * FROM postes');
    console.log('\n🏢 Postes en base :');
    postes.rows.forEach(p => console.log(`  ${p.nom} (${p.type})`));

    const chauffeurs = await client.query('SELECT nom, prenom, code_employe FROM chauffeurs');
    console.log('\n🚚 Chauffeurs en base :');
    chauffeurs.rows.forEach(c => console.log(`  ${c.nom} ${c.prenom} — ${c.code_employe}`));

  } catch (err) {
    console.error('❌ Erreur :', err);
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();
