const fs = require('fs');
const path = require('path');

class MigrationRunner {
  constructor(db) {
    this.db = db;
    this.initializeMigrationTable();
  }

  initializeMigrationTable() {
    // Create migrations table to track which migrations have been run
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
      );
    `);
  }

  getCurrentVersion() {
    const result = this.db.prepare('SELECT MAX(version) as version FROM schema_migrations').get();
    return result.version || 0;
  }

  getAvailableMigrations() {
    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.match(/^\d+_.*\.js$/) && file !== 'migrationRunner.js')
      .sort();
    
    return files.map(file => {
      const version = parseInt(file.split('_')[0]);
      const name = file.split('_').slice(1).join('_').replace('.js', '');
      return { version, name, file: path.join(migrationsDir, file) };
    });
  }

  hasBeenExecuted(version) {
    const result = this.db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version);
    return !!result;
  }

  executeMigration(migration) {
    console.log(`Executing migration ${migration.version}: ${migration.name}`);
    
    try {
      // Load and execute the migration
      const migrationModule = require(migration.file);
      
      // Execute in a transaction
      const transaction = this.db.transaction(() => {
        migrationModule.up(this.db);
        
        // Record that this migration was executed
        this.db.prepare(`
          INSERT INTO schema_migrations (version, name) 
          VALUES (?, ?)
        `).run(migration.version, migration.name);
      });
      
      transaction();
      console.log(`Migration ${migration.version} completed successfully`);
      
    } catch (error) {
      console.error(`Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  runMigrations() {
    const currentVersion = this.getCurrentVersion();
    const availableMigrations = this.getAvailableMigrations();
    
    const pendingMigrations = availableMigrations.filter(
      migration => migration.version > currentVersion && !this.hasBeenExecuted(migration.version)
    );

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      this.executeMigration(migration);
    }
    
    console.log('All migrations completed successfully');
  }
}

module.exports = MigrationRunner;