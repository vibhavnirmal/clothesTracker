const express = require('express');
const cors = require('cors');
const path = require('path');
const { randomUUID } = require('crypto');
const Database = require('better-sqlite3');
const MigrationRunner = require('./migrations/migrationRunner');

const DB_PATH = path.join(__dirname, '..', 'data', 'clothes.sqlite');
const CLIENT_BUILD_PATH = path.join(__dirname, '..', 'build');
const PORT = process.env.PORT || 4000;

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Run database migrations
const migrationRunner = new MigrationRunner(db);
migrationRunner.runMigrations();

db.exec(`
  CREATE TABLE IF NOT EXISTS clothes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    color TEXT,
    image TEXT,
    date_of_purchase TEXT,
    wears_since_wash INTEGER NOT NULL DEFAULT 0,
    last_wash_date TEXT
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

const MAX_NAME_LENGTH = 80;
const MAX_TYPE_LENGTH = 40;
const MAX_COLOR_LENGTH = 9; // e.g. #RRGGBB or #RRGGBBAA
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_BATCH_SIZE = 32;

function getLocalIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

const clothesSelect = db.prepare('SELECT * FROM clothes ORDER BY name');
const wearSelect = db.prepare('SELECT * FROM wear_records ORDER BY date DESC, id DESC');
const washSelect = db.prepare('SELECT * FROM wash_records ORDER BY date DESC, id DESC');

function getClothesTableColumns() {
  return db.prepare('PRAGMA table_info(clothes)').all();
}

let clothesTableColumns = getClothesTableColumns();
if (!clothesTableColumns.some(column => column.name === 'date_of_purchase')) {
  db.exec('ALTER TABLE clothes ADD COLUMN date_of_purchase TEXT');
  clothesTableColumns = getClothesTableColumns();
}

const clothesColumnNames = new Set(clothesTableColumns.map(column => column.name));

// Dynamic insert statement that handles both old and new schema
function createInsertClothesStatement() {
  const columnNames = Array.from(clothesColumnNames);
  
  const baseFields = ['id', 'name', 'type', 'color', 'image', 'date_of_purchase', 'wears_since_wash', 'last_wash_date'];
  const optionalFields = ['purchase_price', 'brand', 'size', 'material', 'season', 'care_instructions', 'status', 'notes', 'created_at', 'updated_at'];
  
  const availableFields = baseFields.concat(optionalFields.filter(field => columnNames.includes(field)));
  const placeholders = availableFields.map(field => {
    const placeholder = field === 'date_of_purchase' ? '@dateOfPurchase' :
                       field === 'purchase_price' ? '@purchasePrice' :
                       field === 'care_instructions' ? '@careInstructions' :
                       field === 'created_at' ? '@createdAt' :
                       field === 'updated_at' ? '@updatedAt' :
                       '@' + field;
    return placeholder;
  });
  
  return db.prepare(`
    INSERT INTO clothes (${availableFields.join(', ')})
    VALUES (${placeholders.join(', ')})
  `);
}

const OPTIONAL_CLOTHES_COLUMNS = [
  { column: 'purchase_price', param: 'purchasePrice', defaultValue: null },
  { column: 'brand', param: 'brand', defaultValue: null },
  { column: 'size', param: 'size', defaultValue: null },
  { column: 'material', param: 'material', defaultValue: null },
  { column: 'season', param: 'season', defaultValue: null },
  { column: 'care_instructions', param: 'careInstructions', defaultValue: null },
  { column: 'status', param: 'status', defaultValue: 'active' },
  { column: 'notes', param: 'notes', defaultValue: null },
  { column: 'created_at', param: 'createdAt', defaultValue: () => new Date().toISOString() },
  { column: 'updated_at', param: 'updatedAt', defaultValue: () => new Date().toISOString() },
];

const insertClothes = createInsertClothesStatement();

// Dynamic insert statement for wear records
function createInsertWearRecordStatement() {
  const columns = db.prepare('PRAGMA table_info(wear_records)').all();
  const columnNames = columns.map(col => col.name);
  
  const baseFields = ['id', 'clothes_id', 'date'];
  const optionalFields = ['weather_temp', 'weather_condition', 'occasion', 'rating', 'notes', 'created_at'];
  
  const availableFields = baseFields.concat(optionalFields.filter(field => columnNames.includes(field)));
  const placeholders = availableFields.map(field => {
    const placeholder = field === 'clothes_id' ? '@clothesId' :
                       field === 'weather_temp' ? '@weatherTemp' :
                       field === 'weather_condition' ? '@weatherCondition' :
                       field === 'created_at' ? '@createdAt' :
                       '@' + field;
    return placeholder;
  });
  
  return db.prepare(`
    INSERT INTO wear_records (${availableFields.join(', ')})
    VALUES (${placeholders.join(', ')})
  `);
}

const insertWearRecord = createInsertWearRecordStatement();

const insertWashRecord = db.prepare(`
  INSERT INTO wash_records (id, clothes_id, date)
  VALUES (@id, @clothesId, @date)
`);

const selectAllClothingTypes = db.prepare('SELECT name FROM clothing_types ORDER BY name COLLATE NOCASE');
const selectClothingTypeExists = db.prepare('SELECT 1 FROM clothing_types WHERE name = ? COLLATE NOCASE');
const selectClothesCountByType = db.prepare('SELECT COUNT(*) AS count FROM clothes WHERE type = ? COLLATE NOCASE');
const insertClothingType = db.prepare('INSERT INTO clothing_types (name) VALUES (?)');
const deleteClothingTypeByName = db.prepare('DELETE FROM clothing_types WHERE name = ? COLLATE NOCASE');

const selectClothesById = db.prepare('SELECT id FROM clothes WHERE id = ?');
const selectClothesRowById = db.prepare('SELECT * FROM clothes WHERE id = ?');
// Dynamic update statement that handles both old and new schema
function createUpdateClothesStatement() {
  const columnNames = Array.from(clothesColumnNames);
  
  const baseFields = ['name', 'type', 'color', 'image', 'date_of_purchase'];
  const optionalFields = ['purchase_price', 'brand', 'size', 'material', 'season', 'care_instructions', 'status', 'notes', 'updated_at'];
  
  const availableFields = baseFields.concat(optionalFields.filter(field => columnNames.includes(field)));
  const setClause = availableFields.map(field => {
    const placeholder = field === 'date_of_purchase' ? '@dateOfPurchase' :
                       field === 'purchase_price' ? '@purchasePrice' :
                       field === 'care_instructions' ? '@careInstructions' :
                       field === 'updated_at' ? '@updatedAt' :
                       '@' + field;
    return `${field} = ${placeholder}`;
  }).join(', ');
  
  return db.prepare(`
    UPDATE clothes
    SET ${setClause}
    WHERE id = @id
  `);
}

const updateClothesById = createUpdateClothesStatement();

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
  const result = {
    id: row.id,
    name: row.name,
    type: row.type,
    color: row.color || '',
    image: row.image || undefined,
    dateOfPurchase: row.date_of_purchase || undefined,
    wearsSinceWash: row.wears_since_wash,
    lastWashDate: row.last_wash_date || undefined,
  };

  // Add new optional fields if they exist (backward compatibility)
  if (row.purchase_price !== undefined) result.purchasePrice = row.purchase_price;
  if (row.brand !== undefined) result.brand = row.brand;
  if (row.size !== undefined) result.size = row.size;
  if (row.material !== undefined) result.material = row.material;
  if (row.season !== undefined) result.season = row.season;
  if (row.care_instructions !== undefined) result.careInstructions = row.care_instructions;
  if (row.status !== undefined) result.status = row.status;
  if (row.notes !== undefined) result.notes = row.notes;
  if (row.created_at !== undefined) result.createdAt = row.created_at;
  if (row.updated_at !== undefined) result.updatedAt = row.updated_at;

  return result;
}

function serializeWear(row) {
  const result = {
    id: row.id,
    clothesId: row.clothes_id,
    date: row.date,
  };

  // Add new optional fields if they exist (backward compatibility)
  if (row.weather_temp !== undefined) result.weatherTemp = row.weather_temp;
  if (row.weather_condition !== undefined) result.weatherCondition = row.weather_condition;
  if (row.occasion !== undefined) result.occasion = row.occasion;
  if (row.rating !== undefined) result.rating = row.rating;
  if (row.notes !== undefined) result.notes = row.notes;
  if (row.created_at !== undefined) result.createdAt = row.created_at;

  return result;
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
  return selectAllClothingTypes.all().map(row => row.name);
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

  // Handle new optional fields
  const purchasePrice = typeof raw.purchasePrice === 'number' && raw.purchasePrice >= 0 ? raw.purchasePrice : undefined;
  const brand = typeof raw.brand === 'string' ? raw.brand.trim() : undefined;
  const size = typeof raw.size === 'string' ? raw.size.trim() : undefined;
  const material = typeof raw.material === 'string' ? raw.material.trim() : undefined;
  const season = typeof raw.season === 'string' && ['spring', 'summer', 'fall', 'winter', 'all'].includes(raw.season) ? raw.season : undefined;
  const careInstructions = typeof raw.careInstructions === 'string' ? raw.careInstructions.trim() : undefined;
  const status = typeof raw.status === 'string' && ['active', 'donated', 'sold', 'storage'].includes(raw.status) ? raw.status : 'active';
  const notes = typeof raw.notes === 'string' ? raw.notes.trim() : undefined;

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
      const today = getLocalIsoDate();
      if (dateOfPurchaseInput > today) {
        errors.push('Date of purchase cannot be in the future.');
      }
    }
  }

  // Validation for new fields
  if (purchasePrice !== undefined && (purchasePrice < 0 || purchasePrice > 999999.99)) {
    errors.push('Purchase price must be between 0 and 999999.99.');
  }

  if (brand !== undefined && brand.length > 100) {
    errors.push('Brand must be 100 characters or less.');
  }

  if (size !== undefined && size.length > 20) {
    errors.push('Size must be 20 characters or less.');
  }

  if (material !== undefined && material.length > 100) {
    errors.push('Material must be 100 characters or less.');
  }

  if (careInstructions !== undefined && careInstructions.length > 500) {
    errors.push('Care instructions must be 500 characters or less.');
  }

  if (notes !== undefined && notes.length > 1000) {
    errors.push('Notes must be 1000 characters or less.');
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

  const currentTime = new Date().toISOString();

  return {
    errors,
    data: { 
      name, 
      type, 
      color, 
      image: normalizedImage, 
      dateOfPurchase: dateOfPurchaseInput,
      purchasePrice,
      brand,
      size,
      material,
      season,
      careInstructions,
      status,
      notes,
      createdAt: currentTime,
      updatedAt: currentTime
    },
    hasImageField,
    hasDateField,
  };
}

app.get('/api/state', (_req, res) => {
  res.json(getSnapshot());
});

app.get('/api/types', (_req, res) => {
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

app.post('/api/clothes', (req, res) => {
  const { errors, data } = normalizeClothesPayload(req.body, { allowOmittingImage: true });

  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Invalid clothes payload',
      errors,
    });
  }

  const id = randomUUID();
  const insertData = {
    id,
    name: data.name,
    type: data.type,
    color: data.color,
    image: typeof data.image === 'string' ? data.image : '',
    dateOfPurchase: data.dateOfPurchase.length > 0 ? data.dateOfPurchase : null,
    wears_since_wash: 0,
    last_wash_date: null
  };

  // Add new optional fields if they exist
  if (data.purchasePrice !== undefined) insertData.purchasePrice = data.purchasePrice;
  if (data.brand !== undefined) insertData.brand = data.brand || null;
  if (data.size !== undefined) insertData.size = data.size || null;
  if (data.material !== undefined) insertData.material = data.material || null;
  if (data.season !== undefined) insertData.season = data.season || null;
  if (data.careInstructions !== undefined) insertData.careInstructions = data.careInstructions || null;
  if (data.status !== undefined) insertData.status = data.status;
  if (data.notes !== undefined) insertData.notes = data.notes || null;
  if (data.createdAt !== undefined) insertData.createdAt = data.createdAt;
  if (data.updatedAt !== undefined) insertData.updatedAt = data.updatedAt;

  OPTIONAL_CLOTHES_COLUMNS.forEach(({ column, param, defaultValue }) => {
    if (!clothesColumnNames.has(column)) return;
    if (insertData[param] === undefined) {
      insertData[param] = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
  });

  insertClothes.run(insertData);
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

  const { errors, data, hasImageField, hasDateField } = normalizeClothesPayload(req.body, { allowOmittingImage: true });

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
    updatedAt: new Date().toISOString()
  };

  // Add new optional fields, preserving existing values if not provided
  if (data.purchasePrice !== undefined) updatePayload.purchasePrice = data.purchasePrice;
  else if (existing.purchase_price !== undefined) updatePayload.purchasePrice = existing.purchase_price;

  if (data.brand !== undefined) updatePayload.brand = data.brand || null;
  else if (existing.brand !== undefined) updatePayload.brand = existing.brand;

  if (data.size !== undefined) updatePayload.size = data.size || null;
  else if (existing.size !== undefined) updatePayload.size = existing.size;

  if (data.material !== undefined) updatePayload.material = data.material || null;
  else if (existing.material !== undefined) updatePayload.material = existing.material;

  if (data.season !== undefined) updatePayload.season = data.season || null;
  else if (existing.season !== undefined) updatePayload.season = existing.season;

  if (data.careInstructions !== undefined) updatePayload.careInstructions = data.careInstructions || null;
  else if (existing.care_instructions !== undefined) updatePayload.careInstructions = existing.care_instructions;

  if (data.status !== undefined) updatePayload.status = data.status;
  else if (existing.status !== undefined) updatePayload.status = existing.status;

  if (data.notes !== undefined) updatePayload.notes = data.notes || null;
  else if (existing.notes !== undefined) updatePayload.notes = existing.notes;

  if (clothesColumnNames.has('created_at')) {
    updatePayload.createdAt = existing.created_at ?? null;
  }

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

  const today = getLocalIsoDate();

  const run = db.transaction(ids => {
    ids.forEach(clothesId => {
      insertWearRecord.run({ id: randomUUID(), clothesId, date: today });
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
    : getLocalIsoDate();

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

  const today = getLocalIsoDate();

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

// ===== NEW FEATURE ENDPOINTS =====

// Tags endpoints
app.get('/api/tags', (_req, res) => {
  try {
    const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
    res.json({ tags });
  } catch (error) {
    console.error('Failed to fetch tags', error);
    res.status(500).json({ message: 'Failed to fetch tags' });
  }
});

app.post('/api/tags', (req, res) => {
  const { name, color } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ message: 'Tag name is required' });
  }

  if (color && (typeof color !== 'string' || !isValidHexColor(color))) {
    return res.status(400).json({ message: 'Color must be a valid hex color' });
  }

  try {
    const id = randomUUID();
    db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(id, name.trim(), color || null);
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    res.status(201).json(tag);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ message: 'Tag name already exists' });
    }
    console.error('Failed to create tag', error);
    res.status(500).json({ message: 'Failed to create tag' });
  }
});

// Outfits endpoints
app.get('/api/outfits', (_req, res) => {
  try {
    const outfits = db.prepare(`
      SELECT o.*, 
             GROUP_CONCAT(c.name) as item_names,
             COUNT(oi.clothes_id) as item_count
      FROM outfits o
      LEFT JOIN outfit_items oi ON o.id = oi.outfit_id
      LEFT JOIN clothes c ON oi.clothes_id = c.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).all();
    res.json({ outfits });
  } catch (error) {
    console.error('Failed to fetch outfits', error);
    res.status(500).json({ message: 'Failed to fetch outfits' });
  }
});

app.post('/api/outfits', (req, res) => {
  const { name, description, season, occasion, clothesIds } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ message: 'Outfit name is required' });
  }

  if (!Array.isArray(clothesIds) || clothesIds.length === 0) {
    return res.status(400).json({ message: 'At least one clothing item is required' });
  }

  try {
    const outfitId = randomUUID();
    const transaction = db.transaction(() => {
      // Create outfit
      db.prepare(`
        INSERT INTO outfits (id, name, description, season, occasion, favorite) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(outfitId, name.trim(), description || null, season || null, occasion || null, false);
      
      // Add items to outfit
      const insertItem = db.prepare('INSERT INTO outfit_items (id, outfit_id, clothes_id) VALUES (?, ?, ?)');
      clothesIds.forEach(clothesId => {
        insertItem.run(randomUUID(), outfitId, clothesId);
      });
    });
    
    transaction();
    
    const outfit = db.prepare('SELECT * FROM outfits WHERE id = ?').get(outfitId);
    res.status(201).json(outfit);
  } catch (error) {
    console.error('Failed to create outfit', error);
    res.status(500).json({ message: 'Failed to create outfit' });
  }
});

// User preferences endpoints
app.get('/api/preferences', (_req, res) => {
  try {
    const preferences = db.prepare('SELECT * FROM user_preferences').all();
    const prefsObject = preferences.reduce((acc, pref) => {
      acc[pref.key] = pref.value;
      return acc;
    }, {});
    res.json({ preferences: prefsObject });
  } catch (error) {
    console.error('Failed to fetch preferences', error);
    res.status(500).json({ message: 'Failed to fetch preferences' });
  }
});

app.put('/api/preferences/:key', (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  
  if (!value || typeof value !== 'string') {
    return res.status(400).json({ message: 'Value is required and must be a string' });
  }

  try {
    db.prepare(`
      INSERT INTO user_preferences (key, value) 
      VALUES (?, ?) 
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now')
    `).run(key, value, value);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update preference', error);
    res.status(500).json({ message: 'Failed to update preference' });
  }
});

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
