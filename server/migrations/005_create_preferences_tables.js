// Migration: Create user preferences and settings tables
module.exports = {
  up: (db) => {
    // Create user_preferences table
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
      );
    `);

    // Create weather_data table for caching
    db.exec(`
      CREATE TABLE IF NOT EXISTS weather_data (
        date TEXT PRIMARY KEY,
        temperature_min INTEGER,
        temperature_max INTEGER,
        condition TEXT,
        humidity INTEGER,
        precipitation_chance INTEGER,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
      );
    `);

    // Insert default user preferences
    const defaultPreferences = [
      { key: 'temperature_unit', value: 'celsius' },
      { key: 'first_day_of_week', value: 'monday' },
      { key: 'default_wear_limit_underwear', value: '1' },
      { key: 'default_wear_limit_socks', value: '1' },
      { key: 'default_wear_limit_tshirt', value: '2' },
      { key: 'default_wear_limit_shirt', value: '3' },
      { key: 'default_wear_limit_jeans', value: '5' },
      { key: 'default_wear_limit_other', value: '3' },
      { key: 'enable_weather_integration', value: 'false' },
      { key: 'enable_notifications', value: 'true' }
    ];

    const insertPreference = db.prepare('INSERT OR IGNORE INTO user_preferences (key, value) VALUES (?, ?)');
    defaultPreferences.forEach(pref => {
      insertPreference.run(pref.key, pref.value);
    });

    console.log('Created user preferences and weather tables');
  }
};