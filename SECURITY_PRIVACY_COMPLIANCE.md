# MGM UNIVERSITY CONVOCATION SYSTEM
## Security, Privacy & Data Protection Compliance Report

This document outlines the security architecture, role-based access controls (RBAC), privacy safeguards (Digital Personal Data Protection / GDPR), and disaster recovery specifications built into the platform.

---

### 1. Role-Based Access Control (RBAC) Matrix

| Portal / API Endpoint | ADMIN | REPORTING | HELPDESK | PRESTAGE | STAGECONTROL | PUBLIC LED |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Live Metrics Dashboard** | ✅ Read | ✅ Read | ✅ Read | ✅ Read | ✅ Read | ❌ No |
| **Reporting Scan Action** | ✅ Full | ✅ Scan | ❌ No | ❌ No | ❌ No | ❌ No |
| **Help Desk Manual Override** | ✅ Full | ❌ No | ✅ Override | ❌ No | ❌ No | ❌ No |
| **Pre-Stage Queue Scan** | ✅ Full | ❌ No | ❌ No | ✅ Queue | ❌ No | ❌ No |
| **Stage Advance / Hold / Skip** | ✅ Full | ❌ No | ❌ No | ❌ No | ✅ Control | ❌ No |
| **16:9 Public LED Stream** | ✅ View | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Sanitized |
| **Printable QR Passes Studio** | ✅ Full | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **User Account & Password Mgmt** | ✅ Full | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **Database Backup & Restore** | ✅ Full | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **Full PII View (Unmasked)** | ✅ Yes | ❌ Masked | ❌ Masked | ❌ Masked | ❌ Masked | ❌ Masked |

---

### 2. Privacy & Data Protection (DPDP Act & GDPR Safeguards)

1. **Opaque Security QR Tokens**:
   * QR passes contain solely random cryptographic tokens (e.g., `PASS_7A829E1B4C93`).
   * **Zero Personally Identifiable Information (PII)** is encoded within QR images. If a student loses their pass in the auditorium, unauthorized persons scanning it cannot retrieve personal contact data.
2. **PII Masking on Non-Privileged Portals**:
   * Student phone numbers and personal emails are masked for operational desk queries (e.g., `+91 98****8719` and `a***@mgm.edu`).
   * Only authenticated administrators have access to full unmasked student records.
3. **Public LED Output Sanitization**:
   * The dedicated `/api/display/current` public presentation feed transmits only approved ceremonial attributes: **Photo, Full Name, Institute, Degree, and Approved Honours/Medals**.
   * Internal database keys, student mobile numbers, emails, addresses, and fees records are strictly excluded from the public display payload.

---

### 3. Cryptography & Authentication

1. **PBKDF2-SHA512 Salted Hashes**:
   * Operator credentials are protected with unique 16-byte random cryptographic salts and 10,000 PBKDF2 iterations using SHA-512.
   * Plain-text passwords are never stored in the database.
2. **Cryptographic Bearer Sessions**:
   * Authenticated sessions use 256-bit random tokens (`crypto.randomBytes(32)`) with a 12-hour expiration window.
3. **Security HTTP Headers**:
   * Enforced `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1`, and `Referrer-Policy`.

---

### 4. Audit Logging & Non-Repudiation

* Every critical ceremony transaction is recorded in the immutable `audit_logs` table:
  * `REPORTED_SUCCESS`
  * `SCAN_DUPLICATE`
  * `SCAN_UNKNOWN_QR`
  * `MANUAL_OVERRIDE` (with mandatory reason)
  * `PRESTAGE_QUEUED`
  * `STAGE_DISPLAY_NEXT`
  * `STAGE_EMERGENCY_HOLD`
  * `STAGE_SKIP_STUDENT`
  * `CREATE_USER` / `CHANGE_USER_PASSWORD`
  * `RESTORE_DATABASE`
* Each log entry captures the timestamp, operator user ID, student ID, IP address, and transaction details.

---

### 5. Disaster Recovery & Emergency Protocols

1. **Zero-Lock Database Snapshots**:
   * Automated snapshots are saved to `backups/` periodically throughout the ceremony.
   * One-click download and restore capabilities in the Admin Console.
2. **Dual-Laptop Master Stage Redundancy**:
   * If the primary stage controller laptop fails, a backup laptop logged into `http://<SERVER-IP>:3000/#stagecontrol` immediately takes over the live queue within 5 seconds without restarting the server.
3. **Emergency Paper Fallback Generator**:
   * One-click printable **Master Stage Sequence Register** and **Emergency Physical Attendance Sheets** are generated in advance for offline compliance.
