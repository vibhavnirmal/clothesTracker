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
`);

const ALLOWED_CLOTHING_TYPES = new Set([
  'Shirt',
  'T-Shirt',
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
]);

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

const insertClothes = db.prepare(`
  INSERT INTO clothes (id, name, type, color, image, wears_since_wash, last_wash_date)
  VALUES (@id, @name, @type, @color, @image, 0, NULL)
`);

const insertWearRecord = db.prepare(`
  INSERT INTO wear_records (id, clothes_id, date)
  VALUES (@id, @clothesId, @date)
`);

const insertWashRecord = db.prepare(`
  INSERT INTO wash_records (id, clothes_id, date)
  VALUES (@id, @clothesId, @date)
`);

const selectClothesById = db.prepare('SELECT id FROM clothes WHERE id = ?');
const selectClothesRowById = db.prepare('SELECT * FROM clothes WHERE id = ?');
const updateClothesById = db.prepare(`
  UPDATE clothes
  SET name = @name,
      type = @type,
      color = @color,
      image = @image
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
    wearsSinceWash: row.wears_since_wash,
    lastWashDate: row.last_wash_date || undefined,
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

function isNonEmptyString(value, maxLength) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength;
}

function isValidClothingType(value) {
  if (typeof value !== 'string') return false;
  return ALLOWED_CLOTHING_TYPES.has(value.trim());
}

function isValidHexColor(value) {
  if (typeof value !== 'string') return false;
  if (value.length === 0) return true;
  if (value.length > MAX_COLOR_LENGTH) return false;
  return /^#[0-9a-fA-F]{3,8}$/.test(value);
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

  const errors = [];

  if (!isNonEmptyString(name, MAX_NAME_LENGTH)) {
    errors.push('Name must be a non-empty string up to 80 characters.');
  }

  if (!isNonEmptyString(type, MAX_TYPE_LENGTH) || !isValidClothingType(type)) {
    errors.push('Type must be one of the supported clothing categories.');
  }

  if (!isValidHexColor(color)) {
    errors.push('Color must be a valid hex value such as #RRGGBB.');
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
    data: { name, type, color, image: normalizedImage },
    hasImageField,
  };
}

app.get('/api/state', (_req, res) => {
  res.json(getSnapshot());
});

app.post('/api/clothes', (req, res) => {
  const { errors, data, hasImageField } = normalizeClothesPayload(req.body, { allowOmittingImage: true });

  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Invalid clothes payload',
      errors,
    });
  }

  const id = randomUUID();
  insertClothes.run({ id, ...data });
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

  const { errors, data, hasImageField } = normalizeClothesPayload(req.body, { allowOmittingImage: true });

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

  const today = new Date().toISOString().split('T')[0];

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

  const today = new Date().toISOString().split('T')[0];

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
