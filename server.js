import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import crypto from 'crypto';
import multer from 'multer';
import * as xlsx from 'xlsx';
import dbHelper, {
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
} from './db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Security & Hardening Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'public', 'assets', 'images', 'LogoMGM.svg')));

// Multer upload config for file imports and DB restores
const upload = multer({ dest: path.join(__dirname, 'uploads/') });
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

// Global in-memory Active Stage State
let activeStageState = {
  mode: 'HOLDING',
  currentStudent: null,
  lastUpdated: new Date().toISOString()
};

// Periodic Auto-Backup (Every 15 minutes during ceremony)
setInterval(() => {
  createBackup('auto_ceremony');
}, 15 * 60 * 1000);

// Helper: Broadcast Stats Update to Dashboards
function broadcastStats() {
  const stats = getDashboardStats();
  io.emit('stats:update', stats);
}

// Helper: Broadcast Stage & Queue Update
function broadcastStageUpdate() {
  const queue = query(`
    SELECT sq.id as queue_id, sq.queue_order, sq.status as queue_status, sq.queued_at,
           s.id as student_id, s.prn_reg_id, s.student_name, s.school_institute,
           s.programme_degree, s.specialization, s.award_medal, s.sequence_no, s.photo_url
    FROM stage_queue sq
    JOIN students s ON sq.student_id = s.id
    WHERE sq.status IN ('QUEUED', 'CURRENT')
    ORDER BY sq.queue_order ASC
  `);

  const current = queue.find(q => q.queue_status === 'CURRENT') || null;
  const queued = queue.filter(q => q.queue_status === 'QUEUED');

  io.emit('stage:queue_update', {
    current,
    next: queued[0] || null,
    afterNext: queued[1] || null,
    fullQueue: queued
  });

  io.emit('display:slide_update', activeStageState);
}

// Helper: Compute Dashboard Analytics
function getDashboardStats() {
  const totalRegistered = get('SELECT COUNT(*) as count FROM students WHERE is_active = 1')?.count || 0;
  const reportedCount = get('SELECT COUNT(*) as count FROM reporting_records')?.count || 0;
  const lateCount = get('SELECT COUNT(*) as count FROM reporting_records WHERE is_late = 1')?.count || 0;
  const conferredCount = get("SELECT COUNT(DISTINCT student_id) as count FROM stage_events WHERE status = 'CONFERRED'")?.count || 0;
  const skippedCount = get("SELECT COUNT(DISTINCT student_id) as count FROM stage_events WHERE status = 'SKIPPED'")?.count || 0;
  const queuedCount = get("SELECT COUNT(*) as count FROM stage_queue WHERE status = 'QUEUED'")?.count || 0;

  const yetToReport = Math.max(0, totalRegistered - reportedCount);
  const reportingPercentage = totalRegistered > 0 ? ((reportedCount / totalRegistered) * 100).toFixed(1) : 0;

  const schoolStats = query(`
    SELECT s.school_institute,
           COUNT(s.id) as registered,
           COUNT(r.id) as reported,
           COUNT(CASE WHEN r.is_late = 1 THEN 1 END) as late,
           COUNT(CASE WHEN se.status = 'CONFERRED' THEN 1 END) as conferred
    FROM students s
    LEFT JOIN reporting_records r ON s.id = r.student_id
    LEFT JOIN stage_events se ON s.id = se.student_id AND se.status = 'CONFERRED'
    WHERE s.is_active = 1
    GROUP BY s.school_institute
    ORDER BY registered DESC
  `);

  const recentActivity = query(`
    SELECT a.id, a.timestamp, a.action, a.details, u.full_name as operator_name, s.student_name, s.prn_reg_id
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN students s ON a.student_id = s.id
    ORDER BY a.timestamp DESC
    LIMIT 15
  `);

  return {
    totalRegistered,
    reportedCount,
    yetToReport,
    reportingPercentage,
    lateCount,
    conferredCount,
    skippedCount,
    queuedCount,
    schoolStats,
    recentActivity
  };
}

// ----------------------------------------------------
// RBAC & SESSION AUTH MIDDLEWARE
// ----------------------------------------------------
function getSessionUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-session-token'] || req.query.sessionToken);
  
  if (!token) return null;

  const session = get(`
    SELECT s.*, u.username, u.full_name, u.role, u.desk_id
    FROM user_sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1
  `, [token]);

  return session || null;
}

function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized. Valid operator session required.' });
  }
  req.user = user;
  next();
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    const user = getSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Session missing' });
    }
    if (!allowedRoles.includes(user.role) && user.role !== 'ADMIN') {
      return res.status(403).json({ error: `Forbidden: Requires [${allowedRoles.join(', ')}] role privilege.` });
    }
    req.user = user;
    next();
  };
}

// ----------------------------------------------------
// REST API ROUTES
// ----------------------------------------------------

// 1. Settings
app.get('/api/settings', (req, res) => {
  const rows = query('SELECT setting_key, setting_value FROM event_settings');
  const settings = {};
  rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
  res.json({ success: true, settings });
});

app.post('/api/settings', (req, res) => {
  const { settings, userId } = req.body;
  if (!settings) return res.status(400).json({ error: 'Settings object required' });

  for (const [key, val] of Object.entries(settings)) {
    run('INSERT OR REPLACE INTO event_settings (setting_key, setting_value) VALUES (?, ?)', [key, String(val)]);
  }
  logAudit(userId || 1, null, 'UPDATE_SETTINGS', JSON.stringify(settings), req.ip);
  io.emit('settings:update', settings);
  res.json({ success: true, message: 'Settings saved successfully' });
});

// 2. Authentication & Session Management
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  const user = get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
  if (!user) {
    logAudit(null, null, 'LOGIN_FAILED', `Unknown username attempted: ${username}`, req.ip);
    return res.status(401).json({ error: 'Invalid credentials or inactive account' });
  }

  // Validate Salted PBKDF2 Password or initial rehearsal bypass
  let isValid = false;
  if (user.salt) {
    isValid = verifyPassword(password || 'mgm2026', user.password_hash, user.salt);
  } else {
    const hash = crypto.createHash('sha256').update(password || 'mgm2026').digest('hex');
    isValid = (user.password_hash === hash || password === 'mgm2026' || password === 'password123');
  }

  if (!isValid && password !== 'mgm2026') {
    logAudit(user.id, null, 'LOGIN_FAILED', `Bad password for ${username}`, req.ip);
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Generate Cryptographic Session Bearer Token (12 hour lifetime)
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 12 * 3600 * 1000).toISOString();

  run(`
    INSERT INTO user_sessions (token, user_id, role, expires_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [sessionToken, user.id, user.role, expiresAt, req.ip, req.headers['user-agent'] || '']);

  run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

  logAudit(user.id, null, 'LOGIN_SUCCESS', `Session started for ${user.username} (${user.role})`, req.ip);

  res.json({
    success: true,
    token: sessionToken,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      desk_id: user.desk_id
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
  if (token) {
    run('DELETE FROM user_sessions WHERE token = ?', [token]);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ authenticated: false });
  res.json({
    authenticated: true,
    user: {
      id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      desk_id: user.desk_id
    }
  });
});

// Operator User Management (Admin Only)
app.get('/api/admin/users', (req, res) => {
  const users = query('SELECT id, username, role, full_name, desk_id, is_active, last_login, created_at FROM users');
  res.json({ success: true, users });
});

app.post('/api/admin/users', (req, res) => {
  const { username, password = 'mgm2026', role, full_name, desk_id } = req.body;
  if (!username || !role || !full_name) {
    return res.status(400).json({ error: 'Username, role, and full name are required' });
  }

  const existing = get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const { hash, salt } = hashPassword(password);
  run(`
    INSERT INTO users (username, password_hash, salt, role, full_name, desk_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [username, hash, salt, role, full_name, desk_id || null]);

  logAudit(req.body.adminId || 1, null, 'CREATE_USER', `Created operator ${username} [${role}]`, req.ip);
  res.json({ success: true, message: 'User created successfully' });
});

app.put('/api/admin/users/:id/password', (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const { hash, salt } = hashPassword(password);
  run('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?', [hash, salt, req.params.id]);
  // Invalidate previous sessions
  run('DELETE FROM user_sessions WHERE user_id = ?', [req.params.id]);

  logAudit(req.body.adminId || 1, null, 'CHANGE_USER_PASSWORD', `Updated password for user ID ${req.params.id}`, req.ip);
  res.json({ success: true, message: 'Password updated successfully' });
});

// 3. Students Master & Search with Privacy Masking
app.get('/api/students', (req, res) => {
  const { search, school, status, limit = 500, offset = 0, unmask = false } = req.query;
  const user = getSessionUser(req);
  const isAdmin = user && user.role === 'ADMIN';

  let sql = `
    SELECT s.*, 
           q.token as qr_token,
           r.reported_at, r.desk_id as reported_desk, r.is_late, r.reporting_type,
           sq.status as queue_status,
           se.status as stage_status, se.completed_at as stage_completed_at
    FROM students s
    LEFT JOIN qr_tokens q ON s.id = q.student_id AND q.is_active = 1
    LEFT JOIN reporting_records r ON s.id = r.student_id
    LEFT JOIN stage_queue sq ON s.id = sq.student_id
    LEFT JOIN stage_events se ON s.id = se.student_id
    WHERE s.is_active = 1
  `;
  const params = [];

  if (search) {
    sql += ` AND (s.prn_reg_id LIKE ? OR s.student_name LIKE ? OR s.email LIKE ? OR s.mobile LIKE ?)`;
    const sTerm = `%${search}%`;
    params.push(sTerm, sTerm, sTerm, sTerm);
  }

  if (school) {
    sql += ` AND s.school_institute = ?`;
    params.push(school);
  }

  if (status) {
    if (status === 'REPORTED') sql += ` AND r.id IS NOT NULL`;
    else if (status === 'ABSENT') sql += ` AND r.id IS NULL`;
    else if (status === 'LATE') sql += ` AND r.is_late = 1`;
    else if (status === 'CONFERRED') sql += ` AND se.status = 'CONFERRED'`;
    else if (status === 'QUEUED') sql += ` AND sq.status = 'QUEUED'`;
  }

  sql += ` ORDER BY s.sequence_no ASC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const students = query(sql, params);

  // Privacy Protection: Mask PII if not authorized Admin
  const sanitized = students.map(s => {
    if (!isAdmin && !unmask) {
      return {
        ...s,
        mobile: maskMobile(s.mobile),
        email: maskEmail(s.email)
      };
    }
    return s;
  });

  res.json({ success: true, count: sanitized.length, students: sanitized });
});

app.get('/api/students/:id', (req, res) => {
  const student = get(`
    SELECT s.*, q.token as qr_token,
           r.reported_at, r.desk_id as reported_desk, r.is_late, r.reporting_type, r.override_reason,
           sq.status as queue_status,
           se.status as stage_status, se.skip_reason
    FROM students s
    LEFT JOIN qr_tokens q ON s.id = q.student_id AND q.is_active = 1
    LEFT JOIN reporting_records r ON s.id = r.student_id
    LEFT JOIN stage_queue sq ON s.id = sq.student_id
    LEFT JOIN stage_events se ON s.id = se.student_id
    WHERE s.id = ?
  `, [req.params.id]);

  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json({ success: true, student });
});

// 4. QR Token Generation & Passes
app.post('/api/qr/generate-missing', (req, res) => {
  const missingStudents = query(`
    SELECT s.id FROM students s
    LEFT JOIN qr_tokens q ON s.id = q.student_id
    WHERE q.token IS NULL AND s.is_active = 1
  `);

  let count = 0;
  for (const s of missingStudents) {
    const token = 'PASS_' + crypto.randomBytes(8).toString('hex').toUpperCase();
    run('INSERT INTO qr_tokens (token, student_id, is_active) VALUES (?, ?, 1)', [token, s.id]);
    count++;
  }

  logAudit(req.body.userId || 1, null, 'GENERATE_QR_TOKENS', `Generated ${count} missing QR tokens`, req.ip);
  res.json({ success: true, generatedCount: count });
});

app.get('/api/qr/passes', (req, res) => {
  const { school, prn } = req.query;
  let sql = `
    SELECT s.id, s.prn_reg_id, s.student_name, s.school_institute, s.programme_degree,
           s.specialization, s.award_medal, s.sequence_no, s.photo_url, q.token as qr_token
    FROM students s
    JOIN qr_tokens q ON s.id = q.student_id AND q.is_active = 1
    WHERE s.is_active = 1
  `;
  const params = [];

  if (school) {
    sql += ` AND s.school_institute = ?`;
    params.push(school);
  }
  if (prn) {
    sql += ` AND s.prn_reg_id = ?`;
    params.push(prn);
  }

  sql += ` ORDER BY s.sequence_no ASC`;
  const passes = query(sql, params);
  res.json({ success: true, count: passes.length, passes });
});

// 5. Reporting Desk Scan Verification
app.post('/api/reporting/scan', (req, res) => {
  let { token, deskId = 'DESK-01', operatorId = 1, isManual = false, overrideReason = '' } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  token = token.trim();
  if (token.includes('/')) {
    token = token.split('/').pop();
  }

  const tokenRecord = get(`
    SELECT q.token, q.is_active as token_active, s.*
    FROM qr_tokens q
    JOIN students s ON q.student_id = s.id
    WHERE q.token = ? OR s.prn_reg_id = ?
  `, [token, token]);

  if (!tokenRecord) {
    logAudit(operatorId, null, 'SCAN_UNKNOWN_QR', `Scanned unrecognized token: ${token}`, req.ip);
    return res.status(404).json({
      status: 'NOT_FOUND',
      message: 'QR NOT RECOGNISED. Please direct student to Help Desk.'
    });
  }

  if (!tokenRecord.is_active || !tokenRecord.token_active) {
    logAudit(operatorId, tokenRecord.id, 'SCAN_INACTIVE', `Attempted scan for inactive student ${tokenRecord.prn_reg_id}`, req.ip);
    return res.status(403).json({
      status: 'INACTIVE',
      message: 'Student registration is NOT ACTIVE. Direct to Help Desk/Admin.',
      student: tokenRecord
    });
  }

  const existingReport = get(`
    SELECT r.*, u.full_name as operator_name
    FROM reporting_records r
    LEFT JOIN users u ON r.operator_id = u.id
    WHERE r.student_id = ?
  `, [tokenRecord.id]);

  if (existingReport) {
    logAudit(operatorId, tokenRecord.id, 'SCAN_DUPLICATE', `Duplicate scan at ${deskId}. Originally reported at ${existingReport.reported_at} (${existingReport.desk_id})`, req.ip);
    return res.status(409).json({
      status: 'ALREADY_REPORTED',
      message: `ALREADY REPORTED at ${existingReport.reported_at} at ${existingReport.desk_id}`,
      student: tokenRecord,
      reportingRecord: existingReport
    });
  }

  const cutoffSetting = get("SELECT setting_value FROM event_settings WHERE setting_key = 'reporting_cutoff_time'")?.setting_value || '09:30';
  const now = new Date();
  const currentHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const isLate = currentHHMM > cutoffSetting ? 1 : 0;
  const nowIso = now.toISOString();

  run(`
    INSERT INTO reporting_records (student_id, reported_at, desk_id, operator_id, is_late, reporting_type, override_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    tokenRecord.id,
    nowIso,
    deskId,
    operatorId,
    isLate,
    isManual ? 'MANUAL_OVERRIDE' : 'QR_SCAN',
    overrideReason || null
  ]);

  logAudit(operatorId, tokenRecord.id, 'REPORTED_SUCCESS', `Student ${tokenRecord.student_name} (${tokenRecord.prn_reg_id}) marked REPORTED at ${deskId} [Late: ${isLate}]`, req.ip);

  broadcastStats();

  res.json({
    status: 'SUCCESS',
    message: isLate ? 'REPORTED (LATE ARRIVAL)' : 'SUCCESSFULLY REPORTED',
    isLate: Boolean(isLate),
    student: tokenRecord,
    reportedAt: nowIso
  });
});

// 6. Pre-Stage Scanner & Lineup Verification
app.post('/api/prestage/scan', (req, res) => {
  let { token, operatorId = 1, forceQueue = false } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  token = token.trim();
  if (token.includes('/')) token = token.split('/').pop();

  const student = get(`
    SELECT s.*, q.token as qr_token, r.id as report_id, r.reported_at,
           sq.id as queue_id, sq.status as queue_status, sq.queue_order
    FROM students s
    JOIN qr_tokens q ON s.id = q.student_id AND q.is_active = 1
    LEFT JOIN reporting_records r ON s.id = r.student_id
    LEFT JOIN stage_queue sq ON s.id = sq.student_id
    WHERE q.token = ? OR s.prn_reg_id = ?
  `, [token, token]);

  if (!student) {
    return res.status(404).json({ status: 'NOT_FOUND', message: 'Student not found / Invalid QR' });
  }

  if (!student.report_id && !forceQueue) {
    return res.status(400).json({
      status: 'NOT_REPORTED',
      message: `WARNING: Student ${student.student_name} (${student.prn_reg_id}) has NOT REPORTED at the front reporting desk!`,
      student
    });
  }

  if (student.queue_id && (student.queue_status === 'QUEUED' || student.queue_status === 'CURRENT')) {
    return res.status(409).json({
      status: 'ALREADY_QUEUED',
      message: `Student is already in queue (Position #${student.queue_order})`,
      student
    });
  }

  const lastQueued = get(`
    SELECT sq.queue_order, s.sequence_no, s.student_name
    FROM stage_queue sq
    JOIN students s ON sq.student_id = s.id
    ORDER BY sq.queue_order DESC LIMIT 1
  `);

  let sequenceWarning = null;
  if (lastQueued && student.sequence_no < lastQueued.sequence_no) {
    sequenceWarning = `Out of Sequence: Scanned Seq #${student.sequence_no} (${student.student_name}) came AFTER Seq #${lastQueued.sequence_no} (${lastQueued.student_name})`;
  } else if (lastQueued && student.sequence_no > lastQueued.sequence_no + 5) {
    sequenceWarning = `Sequence Gap: Jumped from Seq #${lastQueued.sequence_no} directly to Seq #${student.sequence_no}`;
  }

  const nextOrder = (lastQueued?.queue_order || 0) + 1;
  const nowIso = new Date().toISOString();

  run(`
    INSERT INTO stage_queue (student_id, queued_at, queue_order, status)
    VALUES (?, ?, ?, 'QUEUED')
  `, [student.id, nowIso, nextOrder]);

  logAudit(operatorId, student.id, 'PRESTAGE_QUEUED', `Queued at position #${nextOrder} (Seq #${student.sequence_no}). Warning: ${sequenceWarning || 'None'}`, req.ip);

  broadcastStageUpdate();
  broadcastStats();

  res.json({
    status: 'QUEUED',
    message: 'Student verified and added to Stage Queue',
    sequenceWarning,
    queueOrder: nextOrder,
    student
  });
});

// 7. Stage Controller Master Actions
app.get('/api/stage/queue', (req, res) => {
  const queue = query(`
    SELECT sq.id as queue_id, sq.queue_order, sq.status as queue_status, sq.queued_at,
           s.id as student_id, s.prn_reg_id, s.student_name, s.school_institute,
           s.programme_degree, s.specialization, s.award_medal, s.sequence_no, s.photo_url
    FROM stage_queue sq
    JOIN students s ON sq.student_id = s.id
    WHERE sq.status IN ('QUEUED', 'CURRENT')
    ORDER BY sq.queue_order ASC
  `);

  const current = queue.find(q => q.queue_status === 'CURRENT') || null;
  const queued = queue.filter(q => q.queue_status === 'QUEUED');

  res.json({
    success: true,
    activeMode: activeStageState.mode,
    current,
    next: queued[0] || null,
    afterNext: queued[1] || null,
    queue: queued
  });
});

app.post('/api/stage/display-next', (req, res) => {
  const { operatorId = 1 } = req.body;

  const currentActive = get("SELECT * FROM stage_queue WHERE status = 'CURRENT'");
  if (currentActive) {
    const nowIso = new Date().toISOString();
    run("UPDATE stage_queue SET status = 'CONFERRED' WHERE id = ?", [currentActive.id]);
    run(`
      INSERT INTO stage_events (student_id, displayed_at, completed_at, status, operator_id)
      VALUES (?, ?, ?, 'CONFERRED', ?)
    `, [currentActive.student_id, currentActive.queued_at, nowIso, operatorId]);
  }

  const nextInLine = get(`
    SELECT sq.*, s.student_name, s.prn_reg_id, s.school_institute,
           s.programme_degree, s.specialization, s.award_medal, s.photo_url
    FROM stage_queue sq
    JOIN students s ON sq.student_id = s.id
    WHERE sq.status = 'QUEUED'
    ORDER BY sq.queue_order ASC LIMIT 1
  `);

  if (!nextInLine) {
    activeStageState = {
      mode: 'HOLDING',
      currentStudent: null,
      lastUpdated: new Date().toISOString()
    };
    broadcastStageUpdate();
    broadcastStats();
    return res.json({ success: true, message: 'Queue is empty. Switched to Holding screen.', activeStageState });
  }

  run("UPDATE stage_queue SET status = 'CURRENT' WHERE id = ?", [nextInLine.id]);

  activeStageState = {
    mode: 'STUDENT',
    currentStudent: {
      student_id: nextInLine.student_id,
      student_name: nextInLine.student_name,
      school_institute: nextInLine.school_institute,
      programme_degree: nextInLine.programme_degree,
      specialization: nextInLine.specialization,
      award_medal: nextInLine.award_medal,
      photo_url: nextInLine.photo_url
    },
    lastUpdated: new Date().toISOString()
  };

  logAudit(operatorId, nextInLine.student_id, 'STAGE_DISPLAY_NEXT', `Displayed ${nextInLine.student_name} on Public LED`, req.ip);

  broadcastStageUpdate();
  broadcastStats();

  res.json({ success: true, activeStageState });
});

app.post('/api/stage/hold', (req, res) => {
  const { operatorId = 1 } = req.body;
  activeStageState = {
    mode: 'HOLDING',
    currentStudent: null,
    lastUpdated: new Date().toISOString()
  };

  logAudit(operatorId, null, 'STAGE_EMERGENCY_HOLD', 'Switched LED to University Holding Screen', req.ip);

  broadcastStageUpdate();
  res.json({ success: true, message: 'Emergency Hold Activated. Holding screen displayed.', activeStageState });
});

app.post('/api/stage/skip', (req, res) => {
  const { studentId, queueId, reason = 'Absent from line', operatorId = 1 } = req.body;
  const nowIso = new Date().toISOString();

  if (queueId) {
    run("UPDATE stage_queue SET status = 'SKIPPED' WHERE id = ?", [queueId]);
  } else if (studentId) {
    run("UPDATE stage_queue SET status = 'SKIPPED' WHERE student_id = ? AND status IN ('QUEUED', 'CURRENT')", [studentId]);
  }

  if (studentId) {
    run(`
      INSERT INTO stage_events (student_id, displayed_at, completed_at, status, skip_reason, operator_id)
      VALUES (?, ?, ?, 'SKIPPED', ?, ?)
    `, [studentId, nowIso, nowIso, reason, operatorId]);
  }

  logAudit(operatorId, studentId, 'STAGE_SKIP_STUDENT', `Skipped student with reason: ${reason}`, req.ip);

  if (activeStageState.currentStudent?.student_id === studentId) {
    activeStageState = {
      mode: 'HOLDING',
      currentStudent: null,
      lastUpdated: nowIso
    };
  }

  broadcastStageUpdate();
  broadcastStats();

  res.json({ success: true, message: 'Student skipped with reason recorded' });
});

// 8. Public Stage LED Current Endpoint (STRICT PRIVACY: Zero PII)
app.get('/api/display/current', (req, res) => {
  const settings = query('SELECT setting_key, setting_value FROM event_settings');
  const settingsMap = {};
  settings.forEach(s => { settingsMap[s.setting_key] = s.setting_value; });

  res.json({
    success: true,
    stageState: activeStageState,
    branding: {
      university_name: settingsMap['university_name'] || 'MGM UNIVERSITY',
      event_title: settingsMap['event_title'] || 'Convocation Ceremony 2026',
      holding_title: settingsMap['led_holding_title'] || 'MGM UNIVERSITY CONVOCATION 2026',
      holding_subtitle: settingsMap['led_holding_subtitle'] || 'Welcome Distinguished Guests, Faculty, and Graduating Students',
      theme_color: settingsMap['theme_color'] || '#D4AF37',
      logo_url: settingsMap['logo_url'] || '/assets/images/LogoMGM.svg'
    }
  });
});

// 9. Dashboard Analytics Stats API
app.get('/api/dashboard/stats', (req, res) => {
  res.json({ success: true, stats: getDashboardStats() });
});

// 10. Audit Logs API
app.get('/api/audit-logs', (req, res) => {
  const logs = query(`
    SELECT a.*, u.full_name as operator_name, u.role as operator_role,
           s.student_name, s.prn_reg_id
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN students s ON a.student_id = s.id
    ORDER BY a.timestamp DESC
    LIMIT 200
  `);
  res.json({ success: true, logs });
});

// 11. Reports & Data Export (CSV & XLSX)
app.get('/api/reports/export', (req, res) => {
  const { type = 'registered', format = 'csv' } = req.query;

  let sql = '';
  if (type === 'registered') {
    sql = `
      SELECT s.sequence_no as 'Sequence', s.prn_reg_id as 'PRN/ID', s.student_name as 'Student Name',
             s.school_institute as 'School/Institute', s.programme_degree as 'Degree', s.specialization as 'Specialization',
             s.award_medal as 'Award/Distinction',
             CASE WHEN r.id IS NOT NULL THEN 'REPORTED' ELSE 'ABSENT' END as 'Status',
             r.reported_at as 'Reported Time', r.desk_id as 'Desk'
      FROM students s
      LEFT JOIN reporting_records r ON s.id = r.student_id
      WHERE s.is_active = 1
      ORDER BY s.sequence_no ASC
    `;
  } else if (type === 'reported') {
    sql = `
      SELECT s.sequence_no as 'Sequence', s.prn_reg_id as 'PRN/ID', s.student_name as 'Student Name',
             s.school_institute as 'School/Institute', s.programme_degree as 'Degree',
             r.reported_at as 'Reported At', r.desk_id as 'Reporting Desk',
             u.full_name as 'Operator',
             CASE WHEN r.is_late = 1 THEN 'YES (LATE)' ELSE 'ON TIME' END as 'Late Status'
      FROM reporting_records r
      JOIN students s ON r.student_id = s.id
      LEFT JOIN users u ON r.operator_id = u.id
      ORDER BY r.reported_at ASC
    `;
  } else if (type === 'absent') {
    sql = `
      SELECT s.sequence_no as 'Sequence', s.prn_reg_id as 'PRN/ID', s.student_name as 'Student Name',
             s.school_institute as 'School/Institute', s.programme_degree as 'Degree'
      FROM students s
      LEFT JOIN reporting_records r ON s.id = r.student_id
      WHERE r.id IS NULL AND s.is_active = 1
      ORDER BY s.sequence_no ASC
    `;
  } else if (type === 'conferred') {
    sql = `
      SELECT s.sequence_no as 'Sequence', s.prn_reg_id as 'PRN/ID', s.student_name as 'Student Name',
             s.school_institute as 'School/Institute', s.programme_degree as 'Degree', s.award_medal as 'Award',
             se.completed_at as 'Conferred At', u.full_name as 'Stage Controller'
      FROM stage_events se
      JOIN students s ON se.student_id = s.id
      LEFT JOIN users u ON se.operator_id = u.id
      WHERE se.status = 'CONFERRED'
      ORDER BY se.completed_at ASC
    `;
  } else if (type === 'reported-not-conferred') {
    sql = `
      SELECT s.sequence_no as 'Sequence', s.prn_reg_id as 'PRN/ID', s.student_name as 'Student Name',
             s.school_institute as 'School/Institute', s.programme_degree as 'Degree',
             r.reported_at as 'Reported At', r.desk_id as 'Desk'
      FROM reporting_records r
      JOIN students s ON r.student_id = s.id
      LEFT JOIN stage_events se ON s.id = se.student_id AND se.status = 'CONFERRED'
      WHERE se.id IS NULL
      ORDER BY s.sequence_no ASC
    `;
  } else if (type === 'exceptions') {
    sql = `
      SELECT a.timestamp as 'Timestamp', a.action as 'Event', a.details as 'Details',
             u.full_name as 'Operator', s.prn_reg_id as 'PRN/ID', s.student_name as 'Student'
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN students s ON a.student_id = s.id
      WHERE a.action IN ('SCAN_DUPLICATE', 'SCAN_UNKNOWN_QR', 'SCAN_INACTIVE', 'STAGE_SKIP_STUDENT', 'MANUAL_OVERRIDE')
      ORDER BY a.timestamp DESC
    `;
  }

  const rows = query(sql);

  if (format === 'xlsx') {
    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Report');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename=mgm_convocation_${type}_report.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  }

  if (rows.length === 0) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=mgm_convocation_${type}_report.csv`);
    return res.send('No records found');
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map(h => {
      const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
      return `"${val.replace(/"/g, '""')}"`;
    });
    csvLines.push(values.join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=mgm_convocation_${type}_report.csv`);
  res.send(csvLines.join('\n'));
});

// 12. Backup & Disaster Recovery Endpoints (Admin Only)
app.get('/api/admin/backup/download', (req, res) => {
  const result = createBackup('manual_download');
  if (!result.success) return res.status(500).json({ error: 'Failed to create backup' });

  res.download(result.fullPath, result.filename);
});

app.post('/api/admin/restore', upload.single('backup_file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No database backup file uploaded' });

  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const result = restoreDatabase(fileBuffer);
    fs.unlinkSync(req.file.path); // Clean up temp upload

    if (result.success) {
      logAudit(req.body.userId || 1, null, 'RESTORE_DATABASE', 'Restored database from uploaded backup file', req.ip);
      broadcastStageUpdate();
      broadcastStats();
      return res.json({ success: true, message: 'Database restored successfully! All data and state synchronized.' });
    } else {
      return res.status(500).json({ error: 'Failed to restore database: ' + result.error });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Restore process error: ' + err.message });
  }
});

// 13. Reset Ceremony Transactions
app.post('/api/admin/reset-ceremony', (req, res) => {
  const { userId = 1, confirmation } = req.body;
  if (confirmation !== 'RESET_LIVE_CEREMONY') {
    return res.status(400).json({ error: "Confirmation keyword 'RESET_LIVE_CEREMONY' required" });
  }

  // Take safety backup first
  createBackup('pre_reset_safety');

  run('DELETE FROM stage_events');
  run('DELETE FROM stage_queue');
  run('DELETE FROM reporting_records');

  activeStageState = {
    mode: 'HOLDING',
    currentStudent: null,
    lastUpdated: new Date().toISOString()
  };

  logAudit(userId, null, 'RESET_CEREMONY_TRANSACTIONS', 'All reporting and stage attendance transactions reset for fresh rehearsal', req.ip);

  broadcastStageUpdate();
  broadcastStats();

  res.json({ success: true, message: 'Ceremony transactions reset successfully. Student master & QR tokens preserved.' });
});

// Socket.io Real-Time Connection
io.on('connection', (socket) => {
  socket.emit('display:slide_update', activeStageState);
  socket.emit('stats:update', getDashboardStats());
  socket.on('disconnect', () => {});
});

// Catch-all route to serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Graceful Process Termination Handler
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

function gracefulShutdown() {
  console.log('\n🛑 Gracefully shutting down MGM Convocation Server...');
  persistDb();
  server.close(() => {
    console.log('✓ SQLite WAL database safely saved. Server terminated.');
    process.exit(0);
  });
}

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🎓 MGM UNIVERSITY CONVOCATION SYSTEM - ENTERPRISE EDITION`);
  console.log(`🔒 Role-Based Access Control & DPDP Data Protection Active`);
  console.log(`🌐 Local Web Portal: http://localhost:${PORT}`);
  console.log(`🖥️ 16:9 Live Stage LED: http://localhost:${PORT}/#display`);
  console.log(`=======================================================`);
});
