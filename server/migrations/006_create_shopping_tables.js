// Migration: Create wishlist and shopping management tables
module.exports = {
  up: (db) => {
    // Create wishlist_items table
    db.exec(`
      CREATE TABLE IF NOT EXISTS wishlist_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        brand TEXT,
        estimated_price DECIMAL(10,2),
        priority INTEGER DEFAULT 1 CHECK(priority >= 1 AND priority <= 5),
        reason TEXT,
        status TEXT DEFAULT 'wanted' CHECK(status IN ('wanted', 'purchased', 'no_longer_needed')),
        purchased_clothes_id TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        FOREIGN KEY (purchased_clothes_id) REFERENCES clothes(id) ON DELETE SET NULL
      );
    `);

    // Create budgets table
    db.exec(`
      CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        period TEXT NOT NULL CHECK(period IN ('monthly', 'quarterly', 'yearly')),
        category TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
      );
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_wishlist_items_status ON wishlist_items(status);
      CREATE INDEX IF NOT EXISTS idx_wishlist_items_priority ON wishlist_items(priority);
      CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(start_date, end_date);
    `);

    console.log('Created shopping and budget management tables');
  }
};