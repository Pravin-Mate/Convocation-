# MGM UNIVERSITY CONVOCATION CEREMONY
## Event-Day Standard Operating Procedures (SOP)

This document contains step-by-step instructions for each counter operator on the day of the convocation.

---

### 1. 📷 Reporting Desk Operators (Counters 1, 2, 3...)
* **Station Setup**: Connect laptop to venue LAN/Wi-Fi router and plug in USB QR barcode scanner gun.
* **Open URL**: `http://<SERVER-IP>:3000/#reporting`
* **Operating Steps**:
  1. Click **⇄ Switch Station** and select your counter (e.g. `Reporting Desk 1`).
  2. Keep cursor placed inside the **Giant Scan Box** (or click anywhere on screen).
  3. Scan the student's printed or mobile QR pass.
  4. **Green Banner + Chime**: Student identity verified and marked as `REPORTED`.
  5. **Orange Banner + Buzzer (`ALREADY REPORTED`)**: Inform the student that they have already checked in. Do not duplicate scans.
  6. **Red Banner (`QR NOT RECOGNISED / INACTIVE`)**: Direct the student politely to the **Help Desk Counter**.
  7. *Do not edit master student data at the reporting desk.*

---

### 2. 🔍 Help Desk & Manual Resolution Operator
* **Station Setup**: Stationed next to the reporting counters.
* **Open URL**: `http://<SERVER-IP>:3000/#helpdesk`
* **Operating Steps**:
  1. For students with damaged passes, forgotten passes, or dead phone batteries:
  2. Search student by **PRN / Roll Number**, **Student Name**, or **Mobile**.
  3. Verify physical ID card (Student ID or Government Photo ID).
  4. Click **View & Resolve**.
  5. Select the mandatory resolution reason (e.g. *"Damaged QR Pass - ID Verified"*).
  6. Click **Authorize & Mark Reported**. An immutable audit log entry is recorded with your operator ID.

---

### 3. 🚶 Pre-Stage Lineup Marshal (Backstage Ramp)
* **Station Setup**: Positioned **3 to 5 students before the stage entry ramp**.
* **Open URL**: `http://<SERVER-IP>:3000/#prestage`
* **Operating Steps**:
  1. As students walk into the physical lineup order, scan their pass.
  2. The system checks two vital safety rules:
     * **Rule 1 (Attendance Check)**: If the student never checked in at the front desk, an **Unreported Student Alert** is raised.
     * **Rule 2 (Sequence Order Check)**: If student order deviates (e.g. Seq #55 walked before Seq #48), an **Out of Sequence Notice** is displayed with student names.
  3. The verified student is added to the active stage display queue.

---

### 4. 🎬 Stage Master Controller (Backstage Tech Desk)
* **Station Setup**: Dual display setup or dedicated laptop with clear visual line-of-sight to the stage ramp.
* **Open URL**: `http://<SERVER-IP>:3000/#stagecontrol`
* **Hotkeys & Controls**:
  * `[SPACEBAR]` / **DISPLAY NEXT**: Only press when the next student is physically stepping toward the Dean / Chancellor. Moves next student to the live 16:9 Stage LED.
  * `[H]` / **HOLD / HOME**: **EMERGENCY ACTION** — If an unrecognized person steps up or a speech is given, press `H` to immediately clear the slide and show the MGM University holding crest.
  * `[S]` / **SKIP**: If a student left the line or skipped their turn, skips the student and records the skip reason.

---

### 5. 🖥️ 16:9 Public Stage LED Display Screen
* **Setup**: Connect stage control / display laptop to the venue LED wall controller or projector via **HDMI cable (1080p Full HD)**.
* **Open URL**: `http://<SERVER-IP>:3000/#display`
* **Kiosk Mode**: Press `F` key or double-click to toggle browser Fullscreen.
* **Privacy Guarantee**: Public LED only renders approved fields (Photo, Full Name, Institute, Degree, Distinction/Medal). Zero phone numbers, emails, or internal database IDs are transmitted to this canvas.

---

### 6. 👑 Administrator & Convocation Convener
* **Open URL**: `http://<SERVER-IP>:3000/#dashboard`
* **Responsibilities**:
  1. Monitor real-time counts: **Total Registered = Reported + Absent**.
  2. Before ceremony starts: Ensure all test transactions are reset via **Admin > Rehearsal Reset**.
  3. After reporting cutoff: Review late arrivals.
  4. At conclusion: Download certified **Master**, **Present**, **Absent**, **Conferred**, and **Exception** reports in **CSV / XLSX**.
  5. Download final database backup (`convocation.db`).
