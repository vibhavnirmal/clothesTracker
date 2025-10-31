const express = require('express');
const cors = require('cors');
const path = require('path');
const { randomUUID } = require('crypto');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'clothes.sqlite');
const CLIENT_BUILD_PATH = path.join(__dirname, '..', 'build');
const PORT = process.env.PORT || 4000;

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS clothes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    color TEXT,
    image TEXT,
    date_of_purchase TEXT,
    wears_since_wash INTEGER NOT NULL DEFAULT 0,
    last_wash_date TEXT,
    size TEXT,
    materials TEXT
  );

  CREATE TABLE IF NOT EXISTS wear_records (
    id TEXT PRIMARY KEY,
    clothes_id TEXT NOT NULL,
    date TEXT NOT NULL,
    FOREIGN KEY (clothes_id) REFERENCES clothes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wash_records (
    id TEXT PRIMARY KEY,
    clothes_id TEXT NOT NULL,
    date TEXT NOT NULL,
    FOREIGN KEY (clothes_id) REFERENCES clothes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS clothing_types (
    name TEXT PRIMARY KEY COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
  );

  CREATE TABLE IF NOT EXISTS material_types (
    name TEXT PRIMARY KEY COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
  );
`);

const DEFAULT_CLOTHING_TYPES = [
  'Shirt - Full Sleeve',
  'Shirt - Half Sleeve',
  'T-Shirt - Short Sleeve',
  'T-Shirt - Long Sleeve',
  'Pants',
  'Jeans',
  'Shorts',
  'Sweater',
  'Hoodie',
  'Jacket',
  'Blazer',
  'Underwear',
  'Socks',
  'Handkerchief',
  'Towel',
  'Shoes',
  'Boots',
  'Sandals',
  'Slippers',
];

const insertDefaultClothingType = db.prepare('INSERT OR IGNORE INTO clothing_types (name) VALUES (?)');
DEFAULT_CLOTHING_TYPES.forEach(type => {
  insertDefaultClothingType.run(type);
});

const DEFAULT_MATERIAL_TYPES = [
  'Cotton',
  'Polyester',
  'Wool',
  'Silk',
  'Linen',
  'Nylon',
  'Rayon',
  'Spandex',
  'Elastane',
  'Denim',
  'Leather',
  'Acrylic',
  'Viscose',
  'Modal',
];

const insertDefaultMaterialType = db.prepare('INSERT OR IGNORE INTO material_types (name) VALUES (?)');
DEFAULT_MATERIAL_TYPES.forEach(material => {
  insertDefaultMaterialType.run(material);
});

const MAX_NAME_LENGTH = 80;
const MAX_TYPE_LENGTH = 40;
const MAX_COLOR_LENGTH = 9; // e.g. #RRGGBB or #RRGGBBAA
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_BATCH_SIZE = 32;

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

const clothesSelect = db.prepare('SELECT * FROM clothes ORDER BY name');
const wearSelect = db.prepare('SELECT * FROM wear_records ORDER BY date DESC, id DESC');
const washSelect = db.prepare('SELECT * FROM wash_records ORDER BY date DESC, id DESC');

const clothesTableColumns = db.prepare('PRAGMA table_info(clothes)').all();
const hasDateOfPurchaseColumn = clothesTableColumns.some(column => column.name === 'date_of_purchase');
if (!hasDateOfPurchaseColumn) {
  db.exec('ALTER TABLE clothes ADD COLUMN date_of_purchase TEXT');
}
const hasSizeColumn = clothesTableColumns.some(column => column.name === 'size');
if (!hasSizeColumn) {
  db.exec('ALTER TABLE clothes ADD COLUMN size TEXT');
}
const hasMaterialsColumn = clothesTableColumns.some(column => column.name === 'materials');
if (!hasMaterialsColumn) {
  db.exec('ALTER TABLE clothes ADD COLUMN materials TEXT');
}
const hasMadeInColumn = clothesTableColumns.some(column => column.name === 'made_in');
if (!hasMadeInColumn) {
  db.exec('ALTER TABLE clothes ADD COLUMN made_in TEXT');
}
const hasCreatedAtColumn = clothesTableColumns.some(column => column.name === 'created_at');
if (!hasCreatedAtColumn) {
  db.exec('ALTER TABLE clothes ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
}

const insertClothes = db.prepare(`
  INSERT INTO clothes (id, name, type, color, image, date_of_purchase, wears_since_wash, last_wash_date, size, materials, made_in, created_at)
  VALUES (@id, @name, @type, @color, @image, @dateOfPurchase, 0, NULL, @size, @materials, @madeIn, @createdAt)
`);

const insertWearRecord = db.prepare(`
  INSERT INTO wear_records (id, clothes_id, date)
  VALUES (@id, @clothesId, @date)
`);

const insertWashRecord = db.prepare(`
  INSERT INTO wash_records (id, clothes_id, date)
  VALUES (@id, @clothesId, @date)
`);

const selectAllClothingTypes = db.prepare('SELECT name FROM clothing_types ORDER BY name COLLATE NOCASE');
const selectClothingTypeExists = db.prepare('SELECT 1 FROM clothing_types WHERE name = ? COLLATE NOCASE');
const selectClothesCountByType = db.prepare('SELECT COUNT(*) AS count FROM clothes WHERE type = ? COLLATE NOCASE');
const insertClothingType = db.prepare('INSERT INTO clothing_types (name) VALUES (?)');
const updateClothingTypeName = db.prepare('UPDATE clothing_types SET name = ? WHERE name = ? COLLATE NOCASE');
const updateClothesTypeName = db.prepare('UPDATE clothes SET type = ? WHERE type = ? COLLATE NOCASE');
const deleteClothingTypeByName = db.prepare('DELETE FROM clothing_types WHERE name = ? COLLATE NOCASE');

const selectAllMaterialTypes = db.prepare('SELECT name FROM material_types ORDER BY name COLLATE NOCASE');
const selectMaterialTypeExists = db.prepare('SELECT 1 FROM material_types WHERE name = ? COLLATE NOCASE');
const insertMaterialType = db.prepare('INSERT INTO material_types (name) VALUES (?)');
const updateMaterialTypeName = db.prepare('UPDATE material_types SET name = ? WHERE name = ? COLLATE NOCASE');
const deleteMaterialTypeByName = db.prepare('DELETE FROM material_types WHERE name = ? COLLATE NOCASE');

const selectClothesById = db.prepare('SELECT id FROM clothes WHERE id = ?');
const selectClothesRowById = db.prepare('SELECT * FROM clothes WHERE id = ?');
const updateClothesById = db.prepare(`
  UPDATE clothes
  SET name = @name,
      type = @type,
      color = @color,
      image = @image,
      date_of_purchase = @dateOfPurchase,
      size = @size,
      materials = @materials,
      made_in = @madeIn
  WHERE id = @id
`);

const incrementWearCount = db.prepare(`
  UPDATE clothes
  SET wears_since_wash = wears_since_wash + 1
  WHERE id = ?
`);

const resetWearCount = db.prepare(`
  UPDATE clothes
  SET wears_since_wash = 0,
      last_wash_date = @date
  WHERE id = @clothesId
`);

const decrementWearCount = db.prepare(`
  UPDATE clothes
  SET wears_since_wash = CASE WHEN wears_since_wash > 0 THEN wears_since_wash - 1 ELSE 0 END
  WHERE id = ?
`);

const selectWearRecordForDate = db.prepare(`
  SELECT id
  FROM wear_records
  WHERE clothes_id = ? AND date = ?
  LIMIT 1
`);

const deleteWearRecordById = db.prepare('DELETE FROM wear_records WHERE id = ?');

const deleteClothesById = db.prepare('DELETE FROM clothes WHERE id = ?');

function serializeClothes(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    color: row.color || '',
    image: row.image || undefined,
    dateOfPurchase: row.date_of_purchase || undefined,
    wearsSinceWash: row.wears_since_wash,
    lastWashDate: row.last_wash_date || undefined,
    size: row.size || undefined,
    materials: row.materials ? JSON.parse(row.materials) : undefined,
    madeIn: row.made_in || undefined,
    createdAt: row.created_at || undefined,
  };
}

function serializeWear(row) {
  return {
    id: row.id,
    clothesId: row.clothes_id,
    date: row.date,
  };
}

function serializeWash(row) {
  return {
    id: row.id,
    clothesId: row.clothes_id,
    date: row.date,
  };
}

function getSnapshot() {
  return {
    clothes: clothesSelect.all().map(serializeClothes),
    wearRecords: wearSelect.all().map(serializeWear),
    washRecords: washSelect.all().map(serializeWash),
  };
}

function getClothingTypes() {
  const types = selectAllClothingTypes.all().map(row => row.name);
  // Sort by usage count (most used first), then alphabetically
  const typesWithCount = types.map(name => ({
    name,
    usageCount: selectClothesCountByType.get(name).count
  }));
  
//   console.log('Clothing types with usage count:', typesWithCount);
  
  const sorted = typesWithCount.sort((a, b) => {
    if (b.usageCount !== a.usageCount) {
      return b.usageCount - a.usageCount; // Most used first
    }
    return a.name.localeCompare(b.name); // Alphabetically if same count
  });
  
//   console.log('Sorted clothing types:', sorted);
  
  return sorted.map(item => item.name);
}

function getMaterialTypes() {
  return selectAllMaterialTypes.all().map(row => row.name);
}

function isNonEmptyString(value, maxLength) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength;
}

function isValidClothingType(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_TYPE_LENGTH) {
    return false;
  }
  return Boolean(selectClothingTypeExists.get(trimmed));
}

function isValidHexColor(value) {
  if (typeof value !== 'string') return false;
  if (value.length === 0) return true;
  if (value.length > MAX_COLOR_LENGTH) return false;
  return /^#[0-9a-fA-F]{3,8}$/.test(value);
}

function isValidIsoDate(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(component => Number.parseInt(component, 10));
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

/**
 * Get today's date in YYYY-MM-DD format using local timezone
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getTodayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDataUrlImage(value) {
  if (typeof value !== 'string') return false;
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

function estimateDataUrlSize(dataUrl) {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return 0;
  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = (base64.match(/=+$/) || [''])[0].length;
  return Math.floor(base64.length * 0.75) - padding;
}

function normalizeClothesPayload(payload, options = {}) {
  const { allowOmittingImage = false } = options;
  const raw = payload || {};
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const type = typeof raw.type === 'string' ? raw.type.trim() : '';
  const color = typeof raw.color === 'string' ? raw.color.trim() : '';
  const hasDateField = Object.prototype.hasOwnProperty.call(raw, 'dateOfPurchase');
  const dateOfPurchaseInput = hasDateField && typeof raw.dateOfPurchase === 'string'
    ? raw.dateOfPurchase.trim()
    : '';
  
  const hasSizeField = Object.prototype.hasOwnProperty.call(raw, 'size');
  const sizeInput = hasSizeField && typeof raw.size === 'string' ? raw.size.trim() : '';
  
  const hasMadeInField = Object.prototype.hasOwnProperty.call(raw, 'madeIn');
  const madeInInput = hasMadeInField && typeof raw.madeIn === 'string' ? raw.madeIn.trim() : '';
  
  const hasMaterialsField = Object.prototype.hasOwnProperty.call(raw, 'materials');
  const materialsInput = raw.materials || null;

  const errors = [];

  if (!isNonEmptyString(name, MAX_NAME_LENGTH)) {
    errors.push('Name must be a non-empty string up to 80 characters.');
  }

  if (!isNonEmptyString(type, MAX_TYPE_LENGTH) || !isValidClothingType(type)) {
    errors.push('Type must match one of your saved clothing categories.');
  }

  if (!isValidHexColor(color)) {
    errors.push('Color must be a valid hex value such as #RRGGBB.');
  }

  if (dateOfPurchaseInput.length > 0) {
    if (!isValidIsoDate(dateOfPurchaseInput)) {
      errors.push('Date of purchase must be a valid date in YYYY-MM-DD format.');
    } else {
      const today = getTodayLocalDate();
      if (dateOfPurchaseInput > today) {
        errors.push('Date of purchase cannot be in the future.');
      }
    }
  }

  // Validate size (optional, max 20 characters)
  if (hasSizeField && sizeInput.length > 0) {
    if (sizeInput.length > 20) {
      errors.push('Size must be at most 20 characters.');
    }
  }

  // Validate madeIn (optional, max 100 characters)
  if (hasMadeInField && madeInInput.length > 0) {
    if (madeInInput.length > 100) {
      errors.push('Made In location must be at most 100 characters.');
    }
  }

  // Validate materials (optional, must be object with numeric values 0-100 that sum to 100)
  let normalizedMaterials = null;
  if (hasMaterialsField && materialsInput !== null && materialsInput !== undefined) {
    if (typeof materialsInput !== 'object' || Array.isArray(materialsInput)) {
      errors.push('Materials must be an object mapping material names to percentages.');
    } else {
      const materialEntries = Object.entries(materialsInput);
      if (materialEntries.length > 0) {
        let sum = 0;
        let allValid = true;
        
        for (const [materialName, percentage] of materialEntries) {
          if (typeof materialName !== 'string' || materialName.trim().length === 0) {
            errors.push('Material names must be non-empty strings.');
            allValid = false;
            break;
          }
          if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
            errors.push('Material percentages must be numbers between 0 and 100.');
            allValid = false;
            break;
          }
          sum += percentage;
        }
        
        if (allValid) {
          // Allow a small tolerance for floating point errors
          if (Math.abs(sum - 100) > 0.01) {
            errors.push('Material percentages must sum to exactly 100%.');
          } else {
            normalizedMaterials = materialsInput;
          }
        }
      }
    }
  }

  const hasImageField = Object.prototype.hasOwnProperty.call(raw, 'image');
  let normalizedImage;

  if (hasImageField) {
    if (typeof raw.image !== 'string') {
      errors.push('Image must be a base64-encoded data URL.');
    } else {
      const imageInput = raw.image.trim();

      if (imageInput.length === 0) {
        normalizedImage = '';
      } else if (!isDataUrlImage(imageInput)) {
        errors.push('Image must be a base64-encoded data URL.');
      } else {
        const estimatedSize = estimateDataUrlSize(imageInput);
        if (estimatedSize > MAX_IMAGE_BYTES) {
          errors.push('Image exceeds the 2MB size limit.');
        } else {
          normalizedImage = imageInput;
        }
      }
    }
  } else if (!allowOmittingImage) {
    normalizedImage = '';
  }

  return {
    errors,
    data: { 
      name, 
      type, 
      color, 
      image: normalizedImage, 
      dateOfPurchase: dateOfPurchaseInput,
      size: sizeInput.length > 0 ? sizeInput : undefined,
      materials: normalizedMaterials || undefined,
      madeIn: madeInInput.length > 0 ? madeInInput : undefined
    },
    hasImageField,
    hasDateField,
    hasSizeField,
    hasMaterialsField,
    hasMadeInField,
  };
}

app.get('/api/state', (_req, res) => {
  res.json(getSnapshot());
});

app.get('/api/types', (_req, res) => {
  console.log('GET /api/types called at', new Date().toISOString());
  res.json({ types: getClothingTypes() });
});

app.post('/api/types', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

  if (!isNonEmptyString(name, MAX_TYPE_LENGTH)) {
    return res.status(400).json({
      message: 'Type name must be a non-empty string up to 40 characters.',
    });
  }

  if (selectClothingTypeExists.get(name)) {
    return res.status(409).json({
      message: 'A clothing type with this name already exists.',
    });
  }

  try {
    insertClothingType.run(name);
  } catch (error) {
    console.error('Failed to insert clothing type', error);
    return res.status(500).json({ message: 'Failed to add clothing type' });
  }

  res.status(201).json({ types: getClothingTypes() });
});

app.put('/api/types/:name', (req, res) => {
  const oldName = typeof req.params?.name === 'string' ? req.params.name.trim() : '';
  const newName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

  if (!isNonEmptyString(oldName, MAX_TYPE_LENGTH)) {
    return res.status(400).json({
      message: 'Old type name must be a non-empty string up to 40 characters.',
    });
  }

  if (!isNonEmptyString(newName, MAX_TYPE_LENGTH)) {
    return res.status(400).json({
      message: 'New type name must be a non-empty string up to 40 characters.',
    });
  }

  if (!selectClothingTypeExists.get(oldName)) {
    return res.status(404).json({
      message: 'Clothing type not found.',
    });
  }

  if (oldName.toLowerCase() !== newName.toLowerCase() && selectClothingTypeExists.get(newName)) {
    return res.status(409).json({
      message: 'A clothing type with this name already exists.',
    });
  }

  try {
    db.transaction(() => {
      updateClothingTypeName.run(newName, oldName);
      updateClothesTypeName.run(newName, oldName);
    })();
  } catch (error) {
    console.error('Failed to update clothing type', error);
    return res.status(500).json({ message: 'Failed to update clothing type' });
  }

  res.json({ types: getClothingTypes() });
});

app.delete('/api/types/:name', (req, res) => {
  const rawName = typeof req.params?.name === 'string' ? req.params.name : '';
  const name = rawName.trim();

  if (!isNonEmptyString(name, MAX_TYPE_LENGTH)) {
    return res.status(400).json({
      message: 'Type name must be a non-empty string up to 40 characters.',
    });
  }

  if (!selectClothingTypeExists.get(name)) {
    return res.status(404).json({
      message: 'Clothing type not found.',
    });
  }

  const usage = selectClothesCountByType.get(name);
  if ((usage?.count ?? 0) > 0) {
    return res.status(409).json({
      message: 'Cannot delete a clothing type that is used by existing items.',
    });
  }

  try {
    deleteClothingTypeByName.run(name);
  } catch (error) {
    console.error('Failed to delete clothing type', error);
    return res.status(500).json({ message: 'Failed to delete clothing type' });
  }

  res.json({ types: getClothingTypes() });
});

app.get('/api/materials', (_req, res) => {
  res.json({ materials: getMaterialTypes() });
});

app.post('/api/materials', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

  if (!isNonEmptyString(name, MAX_TYPE_LENGTH)) {
    return res.status(400).json({
      message: 'Material name must be a non-empty string up to 40 characters.',
    });
  }

  if (selectMaterialTypeExists.get(name)) {
    return res.status(409).json({
      message: 'A material type with this name already exists.',
    });
  }

  try {
    insertMaterialType.run(name);
  } catch (error) {
    console.error('Failed to insert material type', error);
    return res.status(500).json({ message: 'Failed to add material type' });
  }

  res.status(201).json({ materials: getMaterialTypes() });
});

app.put('/api/materials/:name', (req, res) => {
  const oldName = typeof req.params?.name === 'string' ? req.params.name.trim() : '';
  const newName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

  if (!isNonEmptyString(oldName, MAX_TYPE_LENGTH)) {
    return res.status(400).json({
      message: 'Old material name must be a non-empty string up to 40 characters.',
    });
  }

  if (!isNonEmptyString(newName, MAX_TYPE_LENGTH)) {
    return res.status(400).json({
      message: 'New material name must be a non-empty string up to 40 characters.',
    });
  }

  if (!selectMaterialTypeExists.get(oldName)) {
    return res.status(404).json({
      message: 'Material type not found.',
    });
  }

  if (oldName.toLowerCase() !== newName.toLowerCase() && selectMaterialTypeExists.get(newName)) {
    return res.status(409).json({
      message: 'A material type with this name already exists.',
    });
  }

  try {
    updateMaterialTypeName.run(newName, oldName);
  } catch (error) {
    console.error('Failed to update material type', error);
    return res.status(500).json({ message: 'Failed to update material type' });
  }

  res.json({ materials: getMaterialTypes() });
});

app.delete('/api/materials/:name', (req, res) => {
  const rawName = typeof req.params?.name === 'string' ? req.params.name : '';
  const name = rawName.trim();

  if (!isNonEmptyString(name, MAX_TYPE_LENGTH)) {
    return res.status(400).json({
      message: 'Material name must be a non-empty string up to 40 characters.',
    });
  }

  if (!selectMaterialTypeExists.get(name)) {
    return res.status(404).json({
      message: 'Material type not found.',
    });
  }

  try {
    deleteMaterialTypeByName.run(name);
  } catch (error) {
    console.error('Failed to delete material type', error);
    return res.status(500).json({ message: 'Failed to delete material type' });
  }

  res.json({ materials: getMaterialTypes() });
});

app.post('/api/clothes', (req, res) => {
  const { errors, data } = normalizeClothesPayload(req.body, { allowOmittingImage: true });

  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Invalid clothes payload',
      errors,
    });
  }

  const id = randomUUID();
  insertClothes.run({
    id,
    name: data.name,
    type: data.type,
    color: data.color,
    image: typeof data.image === 'string' ? data.image : '',
    dateOfPurchase: data.dateOfPurchase.length > 0 ? data.dateOfPurchase : null,
    size: data.size || null,
    materials: data.materials ? JSON.stringify(data.materials) : null,
    madeIn: data.madeIn || null,
    createdAt: new Date().toISOString(),
  });
  const row = selectClothesRowById.get(id);
  res.status(201).json(serializeClothes(row));
});

app.put('/api/clothes/:id', (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({ message: 'Invalid clothing identifier' });
  }

  const existing = selectClothesRowById.get(id);
  if (!existing) {
    return res.status(404).json({ message: 'Clothing item not found' });
  }

  const { errors, data, hasImageField, hasDateField, hasSizeField, hasMaterialsField, hasMadeInField } = normalizeClothesPayload(req.body, { allowOmittingImage: true });

  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Invalid clothes payload',
      errors,
    });
  }

  const updatePayload = {
    id,
    name: data.name,
    type: data.type,
    color: data.color,
    image: hasImageField ? (data.image ?? '') : existing.image,
    dateOfPurchase: hasDateField
      ? (data.dateOfPurchase.length > 0 ? data.dateOfPurchase : null)
      : existing.date_of_purchase,
    size: hasSizeField ? (data.size || null) : existing.size,
    materials: hasMaterialsField 
      ? (data.materials ? JSON.stringify(data.materials) : null)
      : existing.materials,
    madeIn: hasMadeInField ? (data.madeIn || null) : existing.made_in,
  };

  updateClothesById.run(updatePayload);
  const row = selectClothesRowById.get(id);
  res.json(serializeClothes(row));
});

app.post('/api/wears', (req, res) => {
  const payloadIds = Array.isArray(req.body?.clothesIds) ? req.body.clothesIds : [];
  const sanitizedIds = Array.from(
    new Set(
      payloadIds
        .filter(id => typeof id === 'string')
        .map(id => id.trim())
        .filter(id => id.length > 0)
    )
  );

  if (sanitizedIds.length === 0) {
    return res.status(400).json({ message: 'clothesIds must be a non-empty array' });
  }

  if (sanitizedIds.length > MAX_BATCH_SIZE) {
    return res.status(400).json({ message: `You can only record up to ${MAX_BATCH_SIZE} items at once.` });
  }

  if (!sanitizedIds.every(isUuid)) {
    return res.status(400).json({ message: 'clothesIds must contain valid UUID values.' });
  }

  const missingId = sanitizedIds.find(id => !selectClothesById.get(id));
  if (missingId) {
    return res.status(404).json({ message: `Clothing item ${missingId} was not found.` });
  }

  // Allow custom date or default to today
  const customDate = req.body?.date;
  const dateToUse = (typeof customDate === 'string' && customDate.match(/^\d{4}-\d{2}-\d{2}$/))
    ? customDate
    : getTodayLocalDate();

  const run = db.transaction(ids => {
    ids.forEach(clothesId => {
      insertWearRecord.run({ id: randomUUID(), clothesId, date: dateToUse });
      incrementWearCount.run(clothesId);
    });
  });

  try {
    run(sanitizedIds);
    res.json({
      clothes: clothesSelect.all().map(serializeClothes),
      wearRecords: wearSelect.all().map(serializeWear),
    });
  } catch (error) {
    console.error('Failed to record wear event', error);
    res.status(500).json({ message: 'Failed to record wear event' });
  }
});

app.delete('/api/wears/:id', (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({ message: 'Invalid clothing identifier' });
  }

  const requestedDate = typeof req.query.date === 'string' ? req.query.date : undefined;
  const targetDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : new Date().toISOString().split('T')[0];

  const record = selectWearRecordForDate.get(id, targetDate);
  if (!record) {
    return res.status(404).json({ message: 'No wear record found for the specified date.' });
  }

  const run = db.transaction(() => {
    deleteWearRecordById.run(record.id);
    decrementWearCount.run(id);
  });

  try {
    run();
  } catch (error) {
    console.error('Failed to undo wear event', error);
    return res.status(500).json({ message: 'Failed to undo wear event.' });
  }

  res.json({
    clothes: clothesSelect.all().map(serializeClothes),
    wearRecords: wearSelect.all().map(serializeWear),
  });
});

app.post('/api/washes', (req, res) => {
  const payloadIds = Array.isArray(req.body?.clothesIds) ? req.body.clothesIds : [];
  const sanitizedIds = Array.from(
    new Set(
      payloadIds
        .filter(id => typeof id === 'string')
        .map(id => id.trim())
        .filter(id => id.length > 0)
    )
  );

  if (sanitizedIds.length === 0) {
    return res.status(400).json({ message: 'clothesIds must be a non-empty array' });
  }

  if (sanitizedIds.length > MAX_BATCH_SIZE) {
    return res.status(400).json({ message: `You can only record up to ${MAX_BATCH_SIZE} items at once.` });
  }

  if (!sanitizedIds.every(isUuid)) {
    return res.status(400).json({ message: 'clothesIds must contain valid UUID values.' });
  }

  const missingId = sanitizedIds.find(id => !selectClothesById.get(id));
  if (missingId) {
    return res.status(404).json({ message: `Clothing item ${missingId} was not found.` });
  }

  const today = getTodayLocalDate();

  const run = db.transaction(ids => {
    ids.forEach(clothesId => {
      insertWashRecord.run({ id: randomUUID(), clothesId, date: today });
      resetWearCount.run({ clothesId, date: today });
    });
  });

  try {
    run(sanitizedIds);
    res.json({
      clothes: clothesSelect.all().map(serializeClothes),
      washRecords: washSelect.all().map(serializeWash),
    });
  } catch (error) {
    console.error('Failed to record wash event', error);
    res.status(500).json({ message: 'Failed to record wash event' });
  }
});

app.post('/api/purge', (req, res) => {
  try {
    // Delete all wear and wash records
    db.prepare('DELETE FROM wear_records').run();
    db.prepare('DELETE FROM wash_records').run();
    
    // Reset all clothes data (wears_since_wash and last_wash_date)
    db.prepare(`
      UPDATE clothes 
      SET wears_since_wash = 0, 
          last_wash_date = NULL
    `).run();
    
    console.log('Database purged: all wear/wash records deleted, clothes data reset');
    
    // Return the updated state
    const clothes = db.prepare(`
      SELECT 
        id,
        name,
        type,
        color,
        image,
        date_of_purchase as dateOfPurchase,
        wears_since_wash as wearsSinceWash,
        last_wash_date as lastWashDate,
        size,
        materials
      FROM clothes
      ORDER BY name COLLATE NOCASE
    `).all();

    const parsedClothes = clothes.map(item => ({
      ...item,
      materials: item.materials ? JSON.parse(item.materials) : undefined,
    }));

    res.json({
      clothes: parsedClothes,
      wearRecords: [],
      washRecords: [],
    });
  } catch (error) {
    console.error('Failed to purge database', error);
    res.status(500).json({ message: 'Failed to purge database' });
  }
});

app.delete('/api/clothes/:id', (req, res) => {
  const { id } = req.params;
  const info = deleteClothesById.run(id);
  if (info.changes === 0) {
    return res.status(404).json({ message: 'Clothing item not found' });
  }
  res.status(204).end();
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(CLIENT_BUILD_PATH));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }

    res.sendFile(path.join(CLIENT_BUILD_PATH, 'index.html'), err => {
      if (err) {
        next(err);
      }
    });
  });
}

app.use((err, _req, res, _next) => {
  console.error('Unexpected error', err);
  res.status(500).json({ message: 'Unexpected server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Clothes tracker API server listening on port ${PORT}`);
});

let isShuttingDown = false;

function closeGracefully(reason, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`Received ${reason}. Closing HTTP server and database connection...`);

  server.close(serverErr => {
    let finalExitCode = exitCode;

    if (serverErr) {
      console.error('Error while shutting down HTTP server', serverErr);
      finalExitCode = 1;
    }

    try {
      db.close();
    } catch (dbErr) {
      console.error('Failed to close SQLite connection cleanly', dbErr);
      finalExitCode = 1;
    }

    process.exit(finalExitCode);
  });
}

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => closeGracefully(signal));
});

process.on('uncaughtException', err => {
  console.error('Uncaught exception', err);
  closeGracefully('uncaughtException', 1);
});

process.on('unhandledRejection', reason => {
  console.error('Unhandled promise rejection', reason);
  closeGracefully('unhandledRejection', 1);
});
