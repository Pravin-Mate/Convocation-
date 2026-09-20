# MGM UNIVERSITY — CONVOCATION QR REPORTING, ATTENDANCE & LIVE STAGE DISPLAY SYSTEM
### Production-Ready Enterprise Edition

An end-to-end, high-reliability, local-network-first web platform for convocation reporting, multi-counter attendance tracking, pre-stage lineup verification, operator-controlled 16:9 LED live display, and certified administrative reconciliation reporting.

---

## 🚀 Quick Start (Local Deployment)

### Prerequisites
* [Node.js v18+](https://nodejs.org/) installed.
* Standard local Wi-Fi or wired LAN router (No internet required on event day).

### 1-Click Launch (Windows)
Double-click `start.bat` in the project folder.

### Command Line Launch (All Platforms)
```bash
# 1. Install dependencies
npm install --production

# 2. Seed default MGM University master database & operator accounts
npm run seed

# 3. Start production server
npm start
```

---

## 🌐 Counter & Station Access Points

| Station | URL | Purpose & Privileges |
| :--- | :--- | :--- |
| **Main Portal** | `http://localhost:3000` | Navigation hub & quick operator station switcher |
| **📊 Live Dashboard** | `http://localhost:3000/#dashboard` | Real-time counts by institute + 1-click CSV/XLSX export |
| **📷 Reporting Desk** | `http://localhost:3000/#reporting` | High-speed USB scan gun & camera QR scan + audio chime |
| **🔍 Help Desk** | `http://localhost:3000/#helpdesk` | Search by PRN/Name + manual verified reporting with audit reason |
| **🚶 Pre-Stage Lineup** | `http://localhost:3000/#prestage` | Ramp queue scanner with sequence gap / out-of-order alerts |
| **🎬 Stage Controller** | `http://localhost:3000/#stagecontrol` | Backstage Master: `Current / Next / After Next` + Hotkeys |
| **🖨️ QR Pass Studio** | `http://localhost:3000/#passes` | Batch printable student passes with opaque QR codes |
| **⚙️ Admin & Security** | `http://localhost:3000/#admin` | Excel Import, User Mgmt, Live Backup & Restore, Fallback sheets |
| **🖥️ 16:9 Public Stage LED** | `http://localhost:3000/#display` | 1080p full-screen dual-mode stage display (Holding & Student Slide) |

---

## 👥 Default Operator Credentials

| Role | Username | Initial Password | Counter / Station |
| :--- | :--- | :--- | :--- |
| **Admin (Convener)** | `admin` | `mgm2026` | Dean / Convocation Convener Portal |
| **Reporting Desk 1** | `desk1` | `mgm2026` | JNEC Counter (Desk 1) |
| **Reporting Desk 2** | `desk2` | `mgm2026` | CS & IT Counter (Desk 2) |
| **Reporting Desk 3** | `desk3` | `mgm2026` | Management Counter (Desk 3) |
| **Help Desk** | `helpdesk` | `mgm2026` | Help Desk & Manual Resolution Counter |
| **Pre-Stage Marshal** | `prestage` | `mgm2026` | Backstage Lineup Ramp (3–5 in line) |
| **Stage Controller** | `stage` | `mgm2026` | Stage Master Tech Desk |

*(Passwords can be customized or changed in **Admin > Operator Accounts**).*

---

## ⌨️ Stage Controller Keyboard Shortcuts

* `[SPACEBAR]` : **DISPLAY NEXT** — Moves next student in line to live Stage LED and marks previous as Conferred.
* `[H]` : **EMERGENCY HOLD** — Immediately switches Public LED to MGM University neutral holding screen.
* `[S]` : **SKIP STUDENT** — Skips student with recorded reason.
* `[F]` (on Stage LED screen) : **TOGGLE FULLSCREEN** — Enters 1080p kiosk projection mode.

---

## 📁 Key Project Files

```
d:/convocation/
├── start.bat                     # Windows 1-click batch launcher
├── start.sh                      # Linux/Mac launcher
├── server.js                     # Express server + WebSocket hub + RBAC middleware
├── db/
│   ├── schema.sql                # SQLite schema with foreign keys & sessions
│   ├── database.js               # Database engine, WAL mode, backups, PBKDF2 cryptography
│   └── seed.js                   # Seed script (MGM University colleges, 100 students)
├── public/
│   ├── index.html                # Master responsive web portal
│   ├── css/styles.css            # Luxury dark & gold design system + 16:9 LED styles
│   ├── js/
│   │   ├── app.js                # Session management & role-based routing
│   │   ├── audio.js              # Synthesized Web Audio chimes (Zero file dependencies)
│   │   ├── reporting.js          # Auto-focused USB / camera scanner controller
│   │   ├── helpdesk.js           # Manual search & override with mandatory reason
│   │   ├── prestage.js           # Ramp lineup scanner & sequence validator
│   │   ├── stagecontrol.js       # Backstage operator master controller
│   │   ├── display.js            # 16:9 Public Stage LED display engine
│   │   ├── dashboard.js          # Live metrics & CSV/XLSX export engine
│   │   └── admin.js              # User management, backups & emergency fallbacks
│   └── assets/images/LogoMGM.svg # Official MGM University SVG logo
├── backups/                      # Automated & manual database snapshots
├── OPERATOR_SOP.md               # Standard Operating Procedures for event-day operators
└── SECURITY_PRIVACY_COMPLIANCE.md# DPDP compliance, RBAC, PII data protection
```

---

## 🛡️ Privacy & Compliance Guarantees

1. **Opaque Security QR Codes**: QR codes contain solely random cryptographic tokens (`PASS_XXXXXXXX`). No student phone number, email, or PII is encoded in the QR.
2. **PII Data Masking**: Non-admin operators see masked mobile numbers and emails (`+91 98****8719`).
3. **Public Presentation Sanitization**: The live 16:9 stage LED feed receives only approved ceremonial display fields (Photo, Name, Institute, Degree, Distinction).
4. **Emergency Paper Fallback Generator**: Printable master sequence and physical sign-in sheets generated with 1 click in Admin.
