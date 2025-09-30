// Migration: Create tags and tagging system
module.exports = {
  up: (db) => {
    // Create tags table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
      );
    `);

    // Create clothes_tags table (many-to-many relationship)
    db.exec(`
      CREATE TABLE IF NOT EXISTS clothes_tags (
        clothes_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        PRIMARY KEY (clothes_id, tag_id),
        FOREIGN KEY (clothes_id) REFERENCES clothes(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_clothes_tags_clothes_id ON clothes_tags(clothes_id);
      CREATE INDEX IF NOT EXISTS idx_clothes_tags_tag_id ON clothes_tags(tag_id);
    `);

    // Insert some default tags
    const defaultTags = [
      { id: '1', name: 'Work', color: '#3B82F6' },
      { id: '2', name: 'Casual', color: '#10B981' },
      { id: '3', name: 'Formal', color: '#8B5CF6' },
      { id: '4', name: 'Sport', color: '#F59E0B' },
      { id: '5', name: 'Weekend', color: '#EF4444' },
      { id: '6', name: 'Special', color: '#EC4899' }
    ];

    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (id, name, color) VALUES (?, ?, ?)');
    defaultTags.forEach(tag => {
      insertTag.run(tag.id, tag.name, tag.color);
    });

    console.log('Created tags and tagging system');
  }
};