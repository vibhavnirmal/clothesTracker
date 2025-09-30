// Migration: Add enhanced fields to wear_records table
module.exports = {
  up: (db) => {
    // Add new columns to wear_records table
    const addColumns = [
      'ALTER TABLE wear_records ADD COLUMN weather_temp INTEGER',
      'ALTER TABLE wear_records ADD COLUMN weather_condition TEXT',
      'ALTER TABLE wear_records ADD COLUMN occasion TEXT',
      'ALTER TABLE wear_records ADD COLUMN rating INTEGER CHECK(rating >= 1 AND rating <= 5)',
      'ALTER TABLE wear_records ADD COLUMN notes TEXT',
      'ALTER TABLE wear_records ADD COLUMN created_at TEXT'
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
        UPDATE wear_records 
        SET created_at = '${currentTime}' 
        WHERE created_at IS NULL
      `);
    } catch (error) {
      // Ignore if column doesn't exist yet
      console.log('Could not set default timestamps:', error.message);
    }

    console.log('Added enhanced fields to wear_records table');
  }
};