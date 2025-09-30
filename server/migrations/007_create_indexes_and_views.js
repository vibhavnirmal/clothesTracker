// Migration: Create essential indexes for performance
module.exports = {
  up: (db) => {
    // Create indexes for existing tables if they don't exist
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_wear_records_date ON wear_records(date)',
      'CREATE INDEX IF NOT EXISTS idx_wear_records_clothes_id ON wear_records(clothes_id)',
      'CREATE INDEX IF NOT EXISTS idx_wash_records_date ON wash_records(date)',
      'CREATE INDEX IF NOT EXISTS idx_wash_records_clothes_id ON wash_records(clothes_id)',
      'CREATE INDEX IF NOT EXISTS idx_clothes_type ON clothes(type)',
      'CREATE INDEX IF NOT EXISTS idx_clothes_status ON clothes(status)',
      'CREATE INDEX IF NOT EXISTS idx_clothes_season ON clothes(season)',
      'CREATE INDEX IF NOT EXISTS idx_wear_records_occasion ON wear_records(occasion)'
    ];

    indexes.forEach(sql => db.exec(sql));

    // Create useful views for analytics
    db.exec(`
      CREATE VIEW IF NOT EXISTS cost_per_wear AS
      SELECT 
        c.id,
        c.name,
        c.purchase_price,
        COUNT(wr.id) as total_wears,
        CASE 
          WHEN COUNT(wr.id) > 0 AND c.purchase_price IS NOT NULL 
          THEN ROUND(c.purchase_price / COUNT(wr.id), 2)
          ELSE NULL 
        END as cost_per_wear
      FROM clothes c
      LEFT JOIN wear_records wr ON c.id = wr.clothes_id
      WHERE c.status = 'active'
      GROUP BY c.id, c.name, c.purchase_price;
    `);

    db.exec(`
      CREATE VIEW IF NOT EXISTS items_needing_wash AS
      SELECT 
        c.*,
        c.wears_since_wash,
        CASE c.type
          WHEN 'Underwear' THEN 1
          WHEN 'Socks' THEN 1
          WHEN 'T-Shirt - Short Sleeve' THEN 2
          WHEN 'T-Shirt - Long Sleeve' THEN 2
          WHEN 'Shirt - Full Sleeve' THEN 3
          WHEN 'Shirt - Half Sleeve' THEN 3
          WHEN 'Jeans' THEN 5
          WHEN 'Pants' THEN 4
          ELSE 3
        END as recommended_wears_before_wash
      FROM clothes c
      WHERE c.status = 'active' 
        AND c.wears_since_wash >= CASE c.type
          WHEN 'Underwear' THEN 1
          WHEN 'Socks' THEN 1
          WHEN 'T-Shirt - Short Sleeve' THEN 2
          WHEN 'T-Shirt - Long Sleeve' THEN 2
          WHEN 'Shirt - Full Sleeve' THEN 3
          WHEN 'Shirt - Half Sleeve' THEN 3
          WHEN 'Jeans' THEN 5
          WHEN 'Pants' THEN 4
          ELSE 3
        END;
    `);

    console.log('Created performance indexes and analytical views');
  }
};