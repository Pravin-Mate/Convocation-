import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'convocation.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

const SQL = await initSqlJs();
let dbInstance = null;

// Load existing DB from disk or create fresh
if (fs.existsSync(DB_PATH)) {
  const fileBuffer = fs.readFileSync(DB_PATH);
  dbInstance = new SQL.Database(fileBuffer);
} else {
  dbInstance = new SQL.Database();
}

// Enable foreign keys
dbInstance.run("PRAGMA foreign_keys = ON;");

// Execute Schema
const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
dbInstance.exec(schemaSql);

// Save DB state to file
export function persistDb() {
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Error saving database to disk:', err);
  }
}

// Automatic Database Snapshot / Backup
export function createBackup(tag = 'manual') {
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_mgm_convocation_${tag}_${timestamp}.db`;
    const fullPath = path.join(BACKUPS_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    return { success: true, filename, fullPath, timestamp };
  } catch (err) {
    console.error('Backup creation error:', err);
    return { success: false, error: err.message };
  }
}

// Restore Database from Buffer or File
export function restoreDatabase(buffer) {
  try {
    // Create pre-restore safety backup first
    createBackup('pre_restore_safety');
    dbInstance = new SQL.Database(buffer);
    dbInstance.run("PRAGMA foreign_keys = ON;");
    persistDb();
    return { success: true };
  } catch (err) {
    console.error('Database restore error:', err);
    return { success: false, error: err.message };
  }
}

// Security: Salted Password Hashing & Verification
export function hashPassword(password, existingSalt = null) {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const check = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return check === hash;
}

// Privacy: PII Masking Utilities (DPDP / GDPR Compliance)
export function maskMobile(phone) {
  if (!phone) return 'N/A';
  const clean = String(phone).replace(/\s+/g, '');
  if (clean.length < 6) return '******';
  return clean.slice(0, 4) + '****' + clean.slice(-2);
}

export function maskEmail(email) {
  if (!email || !email.includes('@')) return 'N/A';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `*@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

// Helper to execute SELECT returning array of objects
export function query(sql, params = []) {
  try {
    const stmt = dbInstance.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err) {
    console.error(`Database query error [${sql}]:`, err);
    throw err;
  }
}

// Helper to execute SELECT returning single object
export function get(sql, params = []) {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

// Helper to execute INSERT, UPDATE, DELETE and persist
export function run(sql, params = []) {
  try {
    dbInstance.run(sql, params);
    const lastIdRes = dbInstance.exec("SELECT last_insert_rowid() as id");
    const changes = dbInstance.getRowsModified();
    const lastInsertRowid = lastIdRes[0]?.values[0]?.[0] || 0;
    persistDb();
    return {
      lastInsertRowid: lastInsertRowid,
      changes: changes
    };
  } catch (err) {
    console.error(`Database run error [${sql}]:`, err);
    throw err;
  }
}

// Audit Logger with Client IP and User Context
export function logAudit(userId, studentId, action, details = '', ipAddress = '') {
  try {
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
    dbInstance.run(
      `INSERT INTO audit_logs (user_id, student_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)`,
      [userId || null, studentId || null, action, detailsStr, ipAddress || '']
    );
    persistDb();
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

export const db = dbInstance;
export default {
  db: dbInstance,
  query,
  get,
  run,
  logAudit,
  persistDb,
  createBackup,
  restoreDatabase,
  hashPassword,
  verifyPassword,
  maskMobile,
  maskEmail
};
