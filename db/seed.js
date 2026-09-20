import crypto from 'crypto';
import dbHelper, { run, query, get, logAudit, persistDb, hashPassword } from './database.js';

console.log('--- Seeding MGM University Convocation Database ---');

// 1. Seed Roles & Users with PBKDF2 Salted Hashes
run('DROP TABLE IF EXISTS user_sessions');
run('DROP TABLE IF EXISTS users');

run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT CHECK(role IN ('ADMIN', 'REPORTING', 'HELPDESK', 'PRESTAGE', 'STAGECONTROL')) NOT NULL,
    full_name TEXT NOT NULL,
    desk_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  )
`);

run(`
  CREATE TABLE IF NOT EXISTS user_sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);
const users = [
  { username: 'admin', role: 'ADMIN', full_name: 'Prof. Dr. V.M. Patil (Dean & Convocation Convener)', desk_id: null },
  { username: 'desk1', role: 'REPORTING', full_name: 'Ananya Verma (Desk 1 Operator - JNEC Counter)', desk_id: 'DESK-01' },
  { username: 'desk2', role: 'REPORTING', full_name: 'Karthik Rao (Desk 2 Operator - CS & IT Counter)', desk_id: 'DESK-02' },
  { username: 'desk3', role: 'REPORTING', full_name: 'Pooja Iyer (Desk 3 Operator - Management Counter)', desk_id: 'DESK-03' },
  { username: 'helpdesk', role: 'HELPDESK', full_name: 'Suresh Menon (Help Desk Controller & Verification)', desk_id: 'HELP-DESK' },
  { username: 'prestage', role: 'PRESTAGE', full_name: 'Vikram Joshi (Pre-Stage Lineup Marshal)', desk_id: 'PRE-STAGE' },
  { username: 'stage', role: 'STAGECONTROL', full_name: 'Meera Nambiar (Stage Director & Master Controller)', desk_id: 'STAGE-CTRL' }
];

for (const user of users) {
  const existing = get('SELECT id FROM users WHERE username = ?', [user.username]);
  const { hash, salt } = hashPassword('mgm2026'); // Standard initial password for production rehearsal
  if (!existing) {
    run(
      `INSERT INTO users (username, password_hash, salt, role, full_name, desk_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [user.username, hash, salt, user.role, user.full_name, user.desk_id]
    );
  } else {
    run(`UPDATE users SET password_hash = ?, salt = ? WHERE id = ?`, [hash, salt, existing.id]);
  }
}
console.log('✓ Seeded secure operator accounts with PBKDF2-SHA512 salted cryptography.');

// 2. Clear previous students and generate fresh 100 student master records
run('DELETE FROM stage_events');
run('DELETE FROM stage_queue');
run('DELETE FROM reporting_records');
run('DELETE FROM qr_tokens');
run('DELETE FROM students');

// Update Event Settings for MGM University
const mgmSettings = [
  ['university_name', 'MGM UNIVERSITY'],
  ['event_title', 'Convocation Ceremony 2026'],
  ['event_date', '2026-09-20'],
  ['reporting_cutoff_time', '09:30'],
  ['venue_name', 'Rukmini Auditorium, MGM University Campus'],
  ['theme_color', '#D4AF37'],
  ['logo_url', '/assets/images/LogoMGM.svg'],
  ['led_holding_title', 'MGM UNIVERSITY CONVOCATION 2026'],
  ['led_holding_subtitle', 'Welcome Distinguished Guests, Faculty, and Graduating Students']
];

for (const [k, v] of mgmSettings) {
  run('INSERT OR REPLACE INTO event_settings (setting_key, setting_value) VALUES (?, ?)', [k, v]);
}

const schoolsAndProgrammes = [
  {
    school: 'Jawaharlal Nehru Engineering College (JNEC)',
    programmes: ['B.Tech Computer Science & Engineering', 'B.Tech Artificial Intelligence & Robotics', 'M.Tech Software Engineering'],
    specs: ['Artificial Intelligence', 'Cybersecurity', 'Cloud Computing', 'Data Science', 'Embedded Systems']
  },
  {
    school: 'Dr. G.Y. Pathrikar College of CS & IT',
    programmes: ['B.Sc Information Technology', 'M.Sc Data Science', 'MCA Master of Computer Applications'],
    specs: ['Cloud Computing', 'Full Stack Development', 'AI & Machine Learning', 'Network Security']
  },
  {
    school: 'MGM Institute of Management & Research (IOMR)',
    programmes: ['Master of Business Administration (MBA)', 'BBA Honours in Global Business'],
    specs: ['Finance & Investment Banking', 'Marketing & Brand Strategy', 'Business Analytics', 'Operations & Supply Chain']
  },
  {
    school: 'MGM School of Film & Creative Arts',
    programmes: ['Bachelor of Design (B.Des)', 'B.A. Film Making & VFX', 'M.Des Interaction Design'],
    specs: ['UI/UX Interaction Design', 'Industrial Design', 'Animation & Visual Effects', 'Direction & Cinematography']
  },
  {
    school: 'MGM Institute of Bioscience & Technology (IBT)',
    programmes: ['B.Tech Biotechnology', 'B.Tech Biomedical Engineering', 'M.Sc Bioinformatics'],
    specs: ['Genetic Engineering', 'Medical Device Technologies', 'Computational Biology', 'Bio-Pharma']
  }
];

const firstNames = [
  'Aarav', 'Aditi', 'Advait', 'Akanksha', 'Amit', 'Ananya', 'Arjun', 'Bhavya', 'Chetan', 'Deepika',
  'Dev', 'Divya', 'Gaurav', 'Harini', 'Ishaan', 'Janani', 'Karan', 'Kavya', 'Krish', 'Lavanya',
  'Manish', 'Neha', 'Nikhil', 'Nisha', 'Pranav', 'Pooja', 'Rahul', 'Rhea', 'Rohan', 'Sakshi',
  'Samarth', 'Sanjana', 'Shreya', 'Siddharth', 'Sneha', 'Tanvi', 'Utkarsh', 'Varun', 'Vedika', 'Yash',
  'Abhishek', 'Aishwarya', 'Aniket', 'Anushka', 'Ashwin', 'Charulata', 'Dhruv', 'Gayatri', 'Hemant', 'Kritika'
];

const lastNames = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Iyer', 'Menon', 'Nair', 'Deshmukh', 'Kulkarni', 'Joshi',
  'Gupta', 'Mehta', 'Chopra', 'Malhotra', 'Bose', 'Chatterjee', 'Banerjee', 'Rao', 'Bhat', 'Shetty',
  'Singh', 'Kaur', 'Pandey', 'Mishra', 'Tripathi', 'Chauhan', 'Saxena', 'Agarwal', 'Kapoor', 'Das'
];

const distinctions = [
  '🥇 Chancellor\'s Gold Medal (Rank 1)',
  '🥈 Vice-Chancellor\'s Silver Medal (Rank 2)',
  '🥉 University Bronze Medal (Rank 3)',
  '🎖️ Dean\'s List of Academic Distinction',
  '⭐ Best Capstone Project Award',
  '🌟 Outstanding Leadership & Service Award',
  null, null, null, null, null, null // mostly null so distinctions feel rare & special
];

let sequenceCounter = 1;

for (let i = 1; i <= 100; i++) {
  const fName = firstNames[(i * 7 + 3) % firstNames.length];
  const lName = lastNames[(i * 11 + 5) % lastNames.length];
  const fullName = `${fName} ${lName}`;
  const prn = `2026${String(1000 + i).padStart(5, '0')}`;
  
  const schoolGroup = schoolsAndProgrammes[i % schoolsAndProgrammes.length];
  const programme = schoolGroup.programmes[i % schoolGroup.programmes.length];
  const specialization = schoolGroup.specs[i % schoolGroup.specs.length];
  const distinction = (i <= 5) ? distinctions[i - 1] : distinctions[i % distinctions.length];
  
  const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${i}@apexuniv.edu.in`;
  const mobile = `+91 98${String(10000000 + i * 83719).slice(0, 8)}`;
  
  // High quality realistic avatar image URL (using UI Avatars / Unsplash avatar style)
  const avatarBg = ['0D8ABC', '6366F1', '8B5CF6', 'EC4899', '10B981', 'F59E0B', '3B82F6', '14B8A6'][i % 8];
  const photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=${avatarBg}&color=fff&size=512&bold=true&font-size=0.45`;

  const studentInsert = run(
    `INSERT INTO students (
      prn_reg_id, student_name, school_institute, programme_degree, specialization,
      award_medal, sequence_no, email, mobile, photo_url, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      prn,
      fullName,
      schoolGroup.school,
      programme,
      specialization,
      distinction,
      sequenceCounter++,
      email,
      mobile,
      photoUrl,
      1
    ]
  );

  const studentId = studentInsert.lastInsertRowid;

  // Generate unique opaque 16-character cryptographic token
  const token = 'PASS_' + crypto.randomBytes(8).toString('hex').toUpperCase();
  run(
    `INSERT INTO qr_tokens (token, student_id, is_active) VALUES (?, ?, ?)`,
    [token, studentId, 1]
  );
}

persistDb();
console.log(`✓ Seeded 100 students with unique opaque tokens, sequence order #1 to #100, and academic metadata.`);
console.log('--- Database Seed Complete ---');
