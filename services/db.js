import * as SQLite from 'expo-sqlite';

let _db;
async function getDb() {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('abc_security.db');
  }
  return _db;
}

/** Create tables */
export async function initDB() {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      type TEXT,
      status TEXT,
      reporterName TEXT,
      rank TEXT,
      dateStr TEXT,
      timeStr TEXT,
      station TEXT,
      locationMore TEXT,
      incidentType TEXT,
      injuryType TEXT,
      details TEXT,
      offenderDesc TEXT,
      lastSeen TEXT,
      policeCalled INTEGER,     -- 0/1
      policeNumber TEXT,
      createdAt INTEGER,
      lat REAL,
      lng REAL,
      address TEXT,
      synced INTEGER DEFAULT 0  -- 0 = local/changed, 1 = pushed
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      reportId TEXT,
      localUri TEXT,
      cloudUrl TEXT,            -- set after upload
      createdAt INTEGER,
      FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_media_report ON media(reportId);
  `);

  try { await db.runAsync(`ALTER TABLE reports ADD COLUMN lat REAL`); } catch {}
  try { await db.runAsync(`ALTER TABLE reports ADD COLUMN lng REAL`); } catch {}
  try { await db.runAsync(`ALTER TABLE reports ADD COLUMN address TEXT`); } catch {}
}

/* Reports (CRUD) */

export async function insertReport(r) {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO reports
      (id, type, status, reporterName, rank, dateStr, timeStr, station, locationMore,
      incidentType, injuryType, details, offenderDesc, lastSeen,
      policeCalled, policeNumber, createdAt, lat, lng, address, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      r.id, r.type || 'Report', r.status || 'Open', r.reporterName || '', r.rank || '',
      r.dateStr || '', r.timeStr || '', r.station || '', r.locationMore || '',
      r.incidentType || '', r.injuryType || '', r.details || '', r.offenderDesc || '',
      r.lastSeen || '', r.policeCalled ? 1 : 0, r.policeNumber || '', r.createdAt || Date.now(),
      r.lat ?? null, r.lng ?? null, r.address || '',
    ]
  );
}

export async function getAllReports() {
  const db = await getDb();
  const rows = await db.getAllAsync(`SELECT * FROM reports ORDER BY createdAt DESC`);
  return rows;
}

export async function getReportById(id) {
  const db = await getDb();
  const rows = await db.getAllAsync(`SELECT * FROM reports WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

export async function updateReportStatus(id, status) {
  const db = await getDb();
  await db.runAsync(`UPDATE reports SET status = ?, synced = 0 WHERE id = ?`, [status, id]);
}

export async function updateReportBasic(id, data = {}) {
  const db = await getDb();
  const fields = [
    'incidentType', 'injuryType', 'details',
    'locationMore', 'address', 'policeCalled', 'policeNumber',
  ];

  const sets = [];
  const args = [];
  fields.forEach((k) => {
    if (data[k] !== undefined) {
      if (k === 'policeCalled') {
        sets.push(`${k} = ?`);
        args.push(data[k] ? 1 : 0);
      } else {
        sets.push(`${k} = ?`);
        args.push(data[k]);
      }
    }
  });

  if (sets.length === 0) return;
  sets.push('synced = 0');

  const sql = `UPDATE reports SET ${sets.join(', ')} WHERE id = ?`;
  args.push(id);
  await db.runAsync(sql, args);
}

export async function markReportDirty(id) {
  const db = await getDb();
  await db.runAsync(`UPDATE reports SET synced = 0 WHERE id = ?`, [id]);
}

export async function deleteReport(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM media WHERE reportId = ?`, [id]);
  await db.runAsync(`DELETE FROM reports WHERE id = ?`, [id]);
}

/* Media (CRUD) */

export async function insertMedia(m) {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO media
      (id, reportId, localUri, cloudUrl, createdAt)
      VALUES (?, ?, ?, NULL, ?)`,
    [m.id, m.reportId, m.localUri, m.createdAt || Date.now()]
  );
}

export async function getMediaForReport(reportId) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM media WHERE reportId = ? ORDER BY createdAt ASC`,
    [reportId]
  );
  return rows;
}

export async function getPendingMedia() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM media WHERE cloudUrl IS NULL ORDER BY createdAt ASC`
  );
  return rows;
}

export async function markMediaUploaded(mediaId, cloudUrl) {
  const db = await getDb();
  await db.runAsync(`UPDATE media SET cloudUrl = ? WHERE id = ?`, [cloudUrl, mediaId]);
}

/* Sync helpers */

export async function getUnsyncedReports() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM reports WHERE synced = 0 ORDER BY createdAt ASC`
  );
  return rows;
}

export async function markReportSynced(id) {
  const db = await getDb();
  await db.runAsync(`UPDATE reports SET synced = 1 WHERE id = ?`, [id]);
}

export { getDb };

