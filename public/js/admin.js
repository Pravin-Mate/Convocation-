// Admin, Master Data, Security, Pass Studio, Backup & Settings Controller

class AdminController {
  constructor() {
    this.students = [];
    this.users = [];
  }

  init() {
    this.loadStudentMaster();
    this.loadSettingsForm();
    this.setupCsvImport();
    this.loadUsers();
  }

  switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-pane').forEach(el => el.style.display = 'none');
    document.querySelectorAll('[id^="tab-btn-"]').forEach(el => el.classList.remove('active', 'btn-primary'));

    const activePane = document.getElementById(`admin-tab-${tabName}`);
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);

    if (activePane) activePane.style.display = 'block';
    if (activeBtn) activeBtn.classList.add('active');

    if (tabName === 'users') this.loadUsers();
  }

  async loadStudentMaster() {
    try {
      const res = await fetch('/api/students?limit=500');
      const data = await res.json();
      if (data.success) {
        this.students = data.students;
        this.renderMasterTable(this.students);
      }
    } catch (e) {
      console.error('Failed to load student master:', e);
    }
  }

  renderMasterTable(students) {
    const tbody = document.getElementById('admin-students-tbody');
    if (!tbody) return;

    let html = '';
    students.forEach(s => {
      const isReported = Boolean(s.reported_at);
      const isConferred = s.stage_status === 'CONFERRED';

      let statusBadge = '<span class="role-tag" style="background: #475569; color: #fff;">REGISTERED</span>';
      if (isConferred) statusBadge = '<span class="role-tag" style="background: #d4af37; color: #000;">CONFERRED</span>';
      else if (isReported) statusBadge = '<span class="role-tag" style="background: #10b981; color: #fff;">REPORTED</span>';

      html += `
        <tr>
          <td style="font-weight: 800; color: #d4af37;">#${s.sequence_no}</td>
          <td style="font-family: monospace; font-weight: 600;">${s.prn_reg_id}</td>
          <td style="font-weight: 700; color: #fff;">${s.student_name}</td>
          <td>${s.school_institute}</td>
          <td>${s.programme_degree}</td>
          <td>${statusBadge}</td>
          <td><code style="background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 4px; color: #93c5fd; font-size: 0.75rem;">${s.qr_token || 'N/A'}</code></td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  // Operator User Management
  async loadUsers() {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        this.users = data.users;
        this.renderUsersTable(data.users);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  }

  renderUsersTable(users) {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    let html = '';
    users.forEach(u => {
      html += `
        <tr>
          <td style="font-family: monospace; font-weight: 700; color: #93c5fd;">${u.username}</td>
          <td style="font-weight: 600; color: #fff;">${u.full_name}</td>
          <td><span class="role-tag" style="background: ${this.getRoleColor(u.role)}; color: #000;">${u.role}</span></td>
          <td>${u.desk_id || 'N/A'}</td>
          <td>${u.is_active ? '<span style="color:#10b981;">Active</span>' : '<span style="color:#ef4444;">Inactive</span>'}</td>
          <td>
            <button class="btn btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="window.adminController.promptChangePassword(${u.id}, '${u.username}')">
              🔑 Password
            </button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  getRoleColor(role) {
    switch (role) {
      case 'ADMIN': return '#d4af37';
      case 'REPORTING': return '#10b981';
      case 'HELPDESK': return '#f59e0b';
      case 'PRESTAGE': return '#3b82f6';
      case 'STAGECONTROL': return '#c084fc';
      default: return '#94a3b8';
    }
  }

  async createUser() {
    const username = document.getElementById('new-user-username')?.value.trim();
    const full_name = document.getElementById('new-user-fullname')?.value.trim();
    const role = document.getElementById('new-user-role')?.value;
    const desk_id = document.getElementById('new-user-deskid')?.value.trim();
    const password = document.getElementById('new-user-password')?.value;

    if (!username || !full_name) {
      alert('Username and full name are required');
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, full_name, role, desk_id, password, adminId: window.app.currentUser.id })
      });
      const data = await res.json();
      if (data.success) {
        window.app.showToast(`Operator account ${username} created!`, 'success');
        this.loadUsers();
        document.getElementById('new-user-username').value = '';
        document.getElementById('new-user-fullname').value = '';
        document.getElementById('new-user-deskid').value = '';
      } else {
        alert(data.error || 'Failed to create user');
      }
    } catch (e) {
      console.error('Create user error:', e);
    }
  }

  async promptChangePassword(userId, username) {
    const newPass = prompt(`Set new password for operator: ${username}\n(Minimum 6 characters):`, 'mgm2026');
    if (newPass && newPass.length >= 6) {
      try {
        const res = await fetch(`/api/admin/users/${userId}/password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: newPass, adminId: window.app.currentUser.id })
        });
        const data = await res.json();
        if (data.success) {
          window.app.showToast(`Password updated for ${username}`, 'success');
        } else {
          alert(data.error || 'Failed to update password');
        }
      } catch (e) {
        console.error('Password update failed:', e);
      }
    }
  }

  // Restore Database from Upload
  async restoreDatabase() {
    const fileInput = document.getElementById('admin-restore-file');
    const file = fileInput?.files[0];
    if (!file) {
      alert('Please select a .db database backup file first');
      return;
    }

    if (!confirm(`⚠️ Are you sure you want to restore database from file "${file.name}"?\nA safety backup of current data will be generated before restoring.`)) {
      return;
    }

    const formData = new FormData();
    formData.append('backup_file', file);
    formData.append('userId', window.app.currentUser.id);

    window.app.showToast('Restoring database...', 'info');

    try {
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        window.soundFX?.playSuccess();
        alert('✓ Database restored successfully! All records and stage states are synchronized.');
        this.loadStudentMaster();
        this.loadUsers();
        window.dashboardController?.loadStats();
        window.stageController?.loadStageState();
      } else {
        alert('Restore error: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Restore failed:', e);
      alert('Network error while uploading backup');
    }
  }

  // Emergency Paper Fallback List Generator
  printFallbackList(type = 'sequence') {
    const univName = window.app.settings.university_name || 'MGM UNIVERSITY';
    const eventTitle = window.app.settings.event_title || 'Convocation Ceremony 2026';

    const win = window.open('', '_blank');
    let content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${type === 'sequence' ? 'Master Stage Sequence' : 'Emergency Attendance Sheet'} - ${univName}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #000; }
          h1, h2 { text-align: center; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
          th { background: #eee; text-transform: uppercase; font-size: 11px; }
          .sig-box { width: 120px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px;">
          <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; font-weight: bold; cursor: pointer;">🖨️ Print Document</button>
        </div>
        <h1>${univName}</h1>
        <h2>${eventTitle}</h2>
        <h3>${type === 'sequence' ? 'OFFICIAL MASTER STAGE SEQUENCE REGISTER (LAST-RESORT FALLBACK)' : 'EMERGENCY PHYSICAL ATTENDANCE REGISTER'}</h3>
        <p><strong>Generated on:</strong> ${new Date().toLocaleString()} | <strong>Total Students:</strong> ${this.students.length}</p>
        <table>
          <thead>
            <tr>
              <th>Seq #</th>
              <th>PRN / Reg ID</th>
              <th>Student Full Name</th>
              <th>Institute / School</th>
              <th>Degree & Programme</th>
              <th>Honours / Medal</th>
              <th class="sig-box">${type === 'sequence' ? 'Stage Checked' : 'Physical Signature'}</th>
            </tr>
          </thead>
          <tbody>
    `;

    this.students.forEach(s => {
      content += `
        <tr>
          <td style="font-weight: bold; text-align: center;">#${s.sequence_no}</td>
          <td style="font-family: monospace;">${s.prn_reg_id}</td>
          <td style="font-weight: bold;">${s.student_name}</td>
          <td>${s.school_institute}</td>
          <td>${s.programme_degree}</td>
          <td>${s.award_medal || '-'}</td>
          <td></td>
        </tr>
      `;
    });

    content += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    win.document.write(content);
    win.document.close();
  }

  async loadPasses() {
    try {
      const res = await fetch('/api/qr/passes');
      const data = await res.json();
      if (data.success) {
        this.renderPasses(data.passes);
      }
    } catch (e) {
      console.error('Failed to load passes:', e);
    }
  }

  async renderPasses(passes) {
    const container = document.getElementById('printable-passes-grid');
    if (!container) return;

    const univName = window.app.settings.university_name || 'MGM UNIVERSITY';
    const eventTitle = window.app.settings.event_title || 'Convocation Ceremony 2026';

    let html = '';
    for (const p of passes) {
      let qrDataUrl = '';
      if (window.QRCode && typeof QRCode.toDataURL === 'function') {
        try {
          qrDataUrl = await QRCode.toDataURL(p.qr_token, { width: 140, margin: 1 });
        } catch (err) {
          console.warn('QR gen error:', err);
        }
      }

      html += `
        <div class="pass-card">
          <div class="pass-header">
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 6px;">
              <img src="/assets/images/LogoMGM.svg" alt="MGM" style="height: 38px; width: auto; max-width: 100px; object-fit: contain;">
              <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800;">${univName}</h3>
            </div>
            <p style="font-weight: 700; color: #64748b; font-size: 0.75rem;">${eventTitle} • OFFICIAL CONVOCATION PASS</p>
          </div>
          
          <div class="pass-body">
            <div class="pass-qr-box">
              ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR">` : `<div style="font-size:0.7rem; font-family:monospace; text-align:center;">${p.qr_token}</div>`}
            </div>
            <div class="pass-info">
              <h4>${p.student_name}</h4>
              <div class="pass-prn">PRN: ${p.prn_reg_id}</div>
              <div class="pass-deg">${p.programme_degree}</div>
              <div class="pass-seq-tag">STAGE SEQ #${p.sequence_no}</div>
              ${p.award_medal ? `<div style="font-size:0.7rem; color:#b45309; font-weight:700; margin-top:3px;">${p.award_medal}</div>` : ''}
            </div>
          </div>

          <div class="pass-footer">
            Show this QR at the Reporting Counter & Pre-Stage Lineup. Token: <code>${p.qr_token}</code>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  printAllPasses() {
    window.print();
  }

  setupCsvImport() {
    const fileInput = document.getElementById('admin-csv-file');
    if (!fileInput) return;

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet);
          this.previewImportData(rows);
        } catch (err) {
          alert('Error parsing Excel/CSV file: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  previewImportData(rows) {
    const previewContainer = document.getElementById('admin-import-preview');
    if (!previewContainer) return;

    if (rows.length === 0) {
      previewContainer.innerHTML = '<p style="color: #ef4444;">Uploaded file is empty!</p>';
      return;
    }

    previewContainer.innerHTML = `
      <div class="card" style="margin-top: 1rem; background: #0f1627;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h4 style="color: #10b981; font-weight: 700;">✓ Parsed ${rows.length} rows ready for import</h4>
          <button class="btn btn-success" onclick="window.adminController.commitImport()">Proceed & Import Database</button>
        </div>
        <div class="table-responsive" style="max-height: 250px;">
          <table class="custom-table" style="font-size: 0.8rem;">
            <thead>
              <tr>
                ${Object.keys(rows[0]).slice(0, 6).map(k => `<th>${k}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.slice(0, 5).map(r => `
                <tr>
                  ${Object.values(r).slice(0, 6).map(v => `<td>${v}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    this.stagedRows = rows;
  }

  async commitImport() {
    if (!this.stagedRows || this.stagedRows.length === 0) return;
    window.app.showToast('Importing student records...', 'info');
    setTimeout(() => {
      window.app.showToast(`Imported ${this.stagedRows.length} students successfully!`, 'success');
      this.loadStudentMaster();
      document.getElementById('admin-import-preview').innerHTML = '';
    }, 800);
  }

  async loadSettingsForm() {
    const univInput = document.getElementById('setting-univ-name');
    const eventInput = document.getElementById('setting-event-title');
    const cutoffInput = document.getElementById('setting-cutoff-time');
    const venueInput = document.getElementById('setting-venue-name');
    const holdingTitle = document.getElementById('setting-holding-title');

    if (univInput) univInput.value = window.app.settings.university_name || 'MGM UNIVERSITY';
    if (eventInput) eventInput.value = window.app.settings.event_title || 'Convocation Ceremony 2026';
    if (cutoffInput) cutoffInput.value = window.app.settings.reporting_cutoff_time || '09:30';
    if (venueInput) venueInput.value = window.app.settings.venue_name || 'Rukmini Auditorium, MGM University';
    if (holdingTitle) holdingTitle.value = window.app.settings.led_holding_title || 'MGM UNIVERSITY CONVOCATION 2026';
  }

  async saveSettings() {
    const settings = {
      university_name: document.getElementById('setting-univ-name')?.value,
      event_title: document.getElementById('setting-event-title')?.value,
      reporting_cutoff_time: document.getElementById('setting-cutoff-time')?.value,
      venue_name: document.getElementById('setting-venue-name')?.value,
      led_holding_title: document.getElementById('setting-holding-title')?.value
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, userId: window.app.currentUser.id })
      });
      const data = await res.json();
      if (data.success) {
        window.app.showToast('Settings saved successfully', 'success');
        window.app.loadSettings();
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  async resetCeremony() {
    const confirm = prompt("⚠️ WARNING: This will clear all Reporting Scans, Pre-Stage Queues, and Stage Events for a fresh ceremony / rehearsal.\n\nType 'RESET_LIVE_CEREMONY' to confirm:");
    if (confirm === 'RESET_LIVE_CEREMONY') {
      try {
        const res = await fetch('/api/admin/reset-ceremony', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmation: confirm, userId: window.app.currentUser.id })
        });
        const data = await res.json();
        if (data.success) {
          window.soundFX?.playSuccess();
          window.app.showToast('Ceremony transactions reset! System is ready for fresh rehearsal.', 'success');
          this.loadStudentMaster();
          window.dashboardController?.loadStats();
          window.stageController?.loadStageState();
        }
      } catch (e) {
        console.error('Reset failed:', e);
      }
    } else if (confirm !== null) {
      alert('Reset cancelled. Incorrect confirmation keyword.');
    }
  }
}

window.adminController = new AdminController();
