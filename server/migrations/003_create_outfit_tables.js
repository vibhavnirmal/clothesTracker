// Migration: Create outfits and outfit-related tables
module.exports = {
  up: (db) => {
    // Create outfits table
    db.exec(`
      CREATE TABLE IF NOT EXISTS outfits (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        season TEXT,
        occasion TEXT,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        favorite BOOLEAN DEFAULT FALSE,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
      );
    `);

    // Create outfit_items table
    db.exec(`
      CREATE TABLE IF NOT EXISTS outfit_items (
        id TEXT PRIMARY KEY,
        outfit_id TEXT NOT NULL,
        clothes_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE,
        FOREIGN KEY (clothes_id) REFERENCES clothes(id) ON DELETE CASCADE,
        UNIQUE(outfit_id, clothes_id)
      );
    `);

    // Create outfit_wear_records table
    db.exec(`
      CREATE TABLE IF NOT EXISTS outfit_wear_records (
        id TEXT PRIMARY KEY,
        outfit_id TEXT NOT NULL,
        date TEXT NOT NULL,
        weather_temp INTEGER,
        weather_condition TEXT,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE
      );
    `);

    // Create indexes for better performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_outfit_items_outfit_id ON outfit_items(outfit_id);
      CREATE INDEX IF NOT EXISTS idx_outfit_items_clothes_id ON outfit_items(clothes_id);
      CREATE INDEX IF NOT EXISTS idx_outfit_wear_records_date ON outfit_wear_records(date);
      CREATE INDEX IF NOT EXISTS idx_outfit_wear_records_outfit_id ON outfit_wear_records(outfit_id);
    `);

    console.log('Created outfit management tables');
  }
};