// Migration: Add enhanced fields to clothes table
module.exports = {
  up: (db) => {
    // Add new columns to clothes table
    const addColumns = [
      'ALTER TABLE clothes ADD COLUMN purchase_price DECIMAL(10,2)',
      'ALTER TABLE clothes ADD COLUMN brand TEXT',
      'ALTER TABLE clothes ADD COLUMN size TEXT',
      'ALTER TABLE clothes ADD COLUMN material TEXT',
      'ALTER TABLE clothes ADD COLUMN season TEXT',
      'ALTER TABLE clothes ADD COLUMN care_instructions TEXT',
      'ALTER TABLE clothes ADD COLUMN status TEXT DEFAULT "active"',
      'ALTER TABLE clothes ADD COLUMN notes TEXT',
      'ALTER TABLE clothes ADD COLUMN created_at TEXT',
      'ALTER TABLE clothes ADD COLUMN updated_at TEXT'
    ];

    addColumns.forEach(sql => {
      try {
        db.exec(sql);
      } catch (error) {
        // Column might already exist, which is fine
        if (!error.message.includes('duplicate column name')) {
          throw error;
        }
      }
    });

    // Set default timestamps for existing records
    const currentTime = new Date().toISOString();
    try {
      db.exec(`
        UPDATE clothes 
        SET created_at = '${currentTime}', updated_at = '${currentTime}' 
        WHERE created_at IS NULL OR updated_at IS NULL
      `);
    } catch (error) {
      // Ignore if columns don't exist yet
      console.log('Could not set default timestamps:', error.message);
    }

    console.log('Added enhanced fields to clothes table');
  }
};