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
    this.loadBackupsList();
  }

  switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-pane').forEach(el => el.style.display = 'none');
    document.querySelectorAll('[id^="tab-btn-"]').forEach(el => el.classList.remove('active', 'btn-primary'));

    const activePane = document.getElementById(`admin-tab-${tabName}`);
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);

    if (activePane) activePane.style.display = 'block';
    if (activeBtn) activeBtn.classList.add('active');

    if (tabName === 'users') this.loadUsers();
    if (tabName === 'backup') this.loadBackupsList();
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

  promptChangePassword(userId, username) {
    this.targetPasswordUserId = userId;
    this.targetPasswordUsername = username;
    const modal = document.getElementById('admin-password-modal');
    const label = document.getElementById('admin-password-user-label');
    const input = document.getElementById('admin-new-password-input');
    if (modal && label && input) {
      label.textContent = `Updating password for operator: ${username}`;
      input.value = 'mgm2026';
      modal.style.display = 'flex';
      input.focus();
    } else {
      const newPass = prompt(`Set new password for operator: ${username}\n(Minimum 6 characters):`, 'mgm2026');
      if (newPass && newPass.length >= 6) {
        this.executePasswordChange(userId, username, newPass);
      }
    }
  }

  async submitPasswordChange() {
    const input = document.getElementById('admin-new-password-input');
    const newPass = input?.value?.trim();
    if (!newPass || newPass.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    const modal = document.getElementById('admin-password-modal');
    if (modal) modal.style.display = 'none';

    await this.executePasswordChange(this.targetPasswordUserId, this.targetPasswordUsername, newPass);
  }

  async executePasswordChange(userId, username, newPass) {
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

  // Automated Historical Backups Archive
  async loadBackupsList() {
    const tbody = document.getElementById('admin-backups-tbody');
    if (!tbody) return;
    try {
      const res = await fetch('/api/admin/backups');
      const data = await res.json();
      if (data.success && data.backups) {
        if (data.backups.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:1rem;">No automated snapshots yet.</td></tr>';
          return;
        }
        tbody.innerHTML = data.backups.map(b => {
          const dateStr = new Date(b.createdAt).toLocaleString();
          return `
            <tr>
              <td style="color:#fef08a; font-weight:600;">${dateStr}</td>
              <td style="font-family:monospace; font-size:0.8rem; color:#cbd5e1;">${b.filename}</td>
              <td><span class="role-tag" style="background:rgba(255,255,255,0.08); color:#93c5fd;">${b.sizeKb} KB</span></td>
              <td style="text-align:right;">
                <a href="/api/admin/backup/file/${encodeURIComponent(b.filename)}" class="btn btn-secondary" style="padding:0.25rem 0.55rem; font-size:0.75rem; text-decoration:none; display:inline-block; margin-right:0.35rem;">
                  📥 Download
                </a>
                <button class="btn btn-warning" style="padding:0.25rem 0.55rem; font-size:0.75rem; font-weight:700;" onclick="window.adminController.restoreSnapshot('${b.filename}')">
                  🔄 Restore
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (e) {
      console.error('Failed to load backups list:', e);
    }
  }

  async restoreSnapshot(filename) {
    if (!confirm(`⚠️ Restore database from snapshot "${filename}"?\nA safety backup of current data will be generated before restoring.`)) {
      return;
    }
    window.app.showToast(`Restoring snapshot ${filename}...`, 'info');
    try {
      const res = await fetch('/api/admin/restore-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, userId: window.app.currentUser.id || 1 })
      });
      const data = await res.json();
      if (data.success) {
        window.soundFX?.playSuccess();
        window.app.showToast(data.message, 'success');
        this.loadStudentMaster();
        this.loadUsers();
        this.loadBackupsList();
        window.dashboardController?.loadStats();
        window.stageController?.loadStageState();
      } else {
        alert('Restore error: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Snapshot restore failed:', e);
      alert('Network error while restoring snapshot');
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

  async loadPasses(school = '', prn = '') {
    try {
      let url = '/api/qr/passes';
      const params = [];
      if (school) params.push(`school=${encodeURIComponent(school)}`);
      if (prn) params.push(`prn=${encodeURIComponent(prn)}`);
      if (params.length > 0) url += '?' + params.join('&');

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        this.allPasses = data.passes;
        this.renderPasses(data.passes);
      }
    } catch (e) {
      console.error('Failed to load passes:', e);
    }
  }

  async generateMissingTokens() {
    try {
      const res = await fetch('/api/qr/generate-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: window.app.currentUser.id || 1 })
      });
      const data = await res.json();
      if (data.success) {
        window.soundFX?.playSuccess();
        window.app.showToast(`Generated ${data.generatedCount} missing tokens safely!`, 'success');
        this.loadPasses();
        this.loadStudentMaster();
      }
    } catch (e) {
      console.error('Generate tokens error:', e);
    }
  }

  // Bulk QR Code Generator (ZIP Archive of individual images named by PRN)
  openBulkQrModal() {
    const modal = document.getElementById('bulk-qr-modal');
    if (!modal) return;
    this.updateBulkQrCountPreview();
    const statusBox = document.getElementById('bulk-qr-status-box');
    if (statusBox) statusBox.style.display = 'none';
    const submitBtn = document.getElementById('btn-submit-bulk-qr');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '📦 Generate & Download ZIP';
    }
    modal.style.display = 'flex';
  }

  updateBulkQrCountPreview() {
    const scopeSelect = document.getElementById('bulk-qr-scope');
    const preview = document.getElementById('bulk-qr-count-preview');
    if (!preview) return;

    const currentSchool = document.getElementById('pass-school-select')?.value || '';
    const currentPrn = document.getElementById('pass-search-input')?.value?.trim() || '';
    const filteredCount = this.allPasses?.length || 0;

    if (scopeSelect && scopeSelect.value === 'filtered' && (currentSchool || currentPrn)) {
      preview.textContent = `Target: ${filteredCount} filtered student(s) (${currentSchool || currentPrn})`;
      preview.style.color = '#38bdf8';
    } else {
      preview.textContent = `Target: All Active Students (Entire Convocation Batch)`;
      preview.style.color = '#34d399';
    }
  }

  async generateBulkQrZip() {
    const scopeSelect = document.getElementById('bulk-qr-scope');
    const namingSelect = document.getElementById('bulk-qr-naming');
    const resolutionSelect = document.getElementById('bulk-qr-resolution');
    const manifestCheck = document.getElementById('bulk-qr-manifest-check');
    const exportTypeSelect = document.getElementById('bulk-qr-export-type');
    const includeIdCardBackCheck = document.getElementById('bulk-include-id-card-back');
    const statusBox = document.getElementById('bulk-qr-status-box');
    const submitBtn = document.getElementById('btn-submit-bulk-qr');

    const useFiltered = scopeSelect?.value === 'filtered';
    const school = useFiltered ? (document.getElementById('pass-school-select')?.value || '') : '';
    const prn = useFiltered ? (document.getElementById('pass-search-input')?.value?.trim() || '') : '';
    const naming = namingSelect?.value || 'prn';
    const resolution = resolutionSelect?.value || '600';
    const includeManifest = manifestCheck?.checked ? 'true' : 'false';
    const exportType = exportTypeSelect?.value || 'all';
    const includeIdCardBacks = includeIdCardBackCheck?.checked ? 'true' : 'false';

    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.style.background = 'rgba(245, 158, 11, 0.15)';
      statusBox.style.border = '1px solid #f59e0b';
      statusBox.style.color = '#fbbf24';
      statusBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.25rem;">⏳</span>
          <div>
            <strong>Generating QR codes & stamping onto ID Card backsides by PRN...</strong>
            <div style="font-size: 0.78rem; color: #fde68a; margin-top: 2px;">
              Embedding scannable QRs onto graduate ID cards according to PRN No. Compressing into ZIP archive...
            </div>
          </div>
        </div>
      `;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Packaging ZIP Archive...';
    }

    window.app.showToast('Generating bulk QR & ID card archive...', 'info');

    try {
      const params = new URLSearchParams({
        naming,
        resolution,
        includeManifest,
        exportType,
        includeIdCardBacks,
        userId: window.app.currentUser?.id || 1
      });
      if (school) params.append('school', school);
      if (prn) params.append('prn', prn);

      const response = await fetch(`/api/qr/bulk-zip?${params.toString()}`);

      if (!response.ok) {
        let errData = {};
        try { errData = await response.json(); } catch(e) {}
        throw new Error(errData.error || `Server responded with status ${response.status}`);
      }

      // Read filename from Content-Disposition header if present
      let filename = 'MGM_Convocation_QR_ID_Cards.zip';
      const disposition = response.headers.get('Content-Disposition');
      if (disposition && disposition.includes('filename=')) {
        const matches = disposition.match(/filename="?([^";]+)"?/);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      window.soundFX?.playSuccess();
      window.app.showToast(`✓ Downloaded ${filename}!`, 'success');

      if (statusBox) {
        statusBox.style.background = 'rgba(16, 185, 129, 0.15)';
        statusBox.style.border = '1px solid #10b981';
        statusBox.style.color = '#34d399';
        statusBox.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.25rem;">✓</span>
            <div>
              <strong>ZIP Archive Successfully Created!</strong>
              <div style="font-size: 0.78rem; color: #a7f3d0; margin-top: 2px;">
                File "${filename}" downloaded. QR codes have been automatically added to the backside of student ID cards according to their PRN No.
              </div>
            </div>
          </div>
        `;
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '📦 Generate Again';
      }
    } catch (err) {
      console.error('Bulk QR generation failed:', err);
      window.app.showToast('Failed to generate bulk QR ZIP: ' + err.message, 'danger');
      if (statusBox) {
        statusBox.style.background = 'rgba(239, 68, 68, 0.15)';
        statusBox.style.border = '1px solid #ef4444';
        statusBox.style.color = '#f87171';
        statusBox.innerHTML = `<strong>Error:</strong> ${err.message}`;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '📦 Generate & Download ZIP';
      }
    }
  }

  setPassViewMode(mode) {
    this.passViewMode = mode;
    ['btn-mode-dual', 'btn-mode-back', 'btn-mode-standard'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
      }
    });

    const activeId = mode === 'two_sided' ? 'btn-mode-dual' : mode === 'backside' ? 'btn-mode-back' : 'btn-mode-standard';
    const activeBtn = document.getElementById(activeId);
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.style.background = '#d97706';
    }

    this.renderPasses(this.allPasses || []);
  }

  printCurrentPassView() {
    window.print();
  }

  printAllPasses() {
    window.print();
  }

  printBacksidesOnly() {
    const passes = this.allPasses || [];
    if (!passes || passes.length === 0) {
      window.app.showToast('No student passes loaded to print.', 'warning');
      return;
    }

    const univName = window.app.settings.university_name || 'MGM UNIVERSITY';
    const eventTitle = window.app.settings.event_title || 'Convocation Ceremony 2026';

    const win = window.open('', '_blank');
    let cardsHtml = '';

    for (const p of passes) {
      cardsHtml += `
        <div class="id-card-face face-back" style="width: 280px; height: 440px; margin: 10px; border: 1.5px solid #d4af37; border-radius: 12px; padding: 14px; display: inline-flex; flex-direction: column; justify-content: space-between; background: #fff; color: #0f172a; page-break-inside: avoid; vertical-align: top; box-sizing: border-box;">
          <div>
            <div style="background: #0f172a; color: #fff; text-align: center; padding: 6px; border-radius: 6px; margin-bottom: 8px;">
              <h5 style="margin: 0; font-size: 0.82rem; font-weight: 800; color: #fff;">${univName}</h5>
              <p style="margin: 2px 0 0 0; font-size: 0.65rem; color: #fbbf24; font-weight: 700;">${eventTitle}</p>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 5px; text-align: center; font-family: monospace; font-size: 0.85rem; font-weight: 800; color: #92400e; margin-bottom: 8px;">
              STUDENT PRN: ${p.prn_reg_id}
            </div>

            <div style="text-align: center; margin: 6px 0;">
              <canvas id="qr-${p.id}" style="width: 140px; height: 140px;"></canvas>
            </div>

            <div style="font-size: 0.8rem; font-weight: 800; color: #0f172a; text-align: center; margin-bottom: 2px;">
              ${p.student_name}
            </div>
            <div style="font-size: 0.7rem; color: #475569; text-align: center; margin-bottom: 6px;">
              ${p.programme_degree} • Seq #${p.sequence_no}
            </div>

            <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; font-size: 0.65rem; color: #334155; line-height: 1.35;">
              <strong>Counter & Stage Instructions:</strong><br>
              1. Scan at Reporting Desk for automated check-in.<br>
              2. Pre-stage marshal verifies physical sequence order.
            </div>
          </div>

          <div style="background: #0f172a; border-radius: 6px; padding: 5px; text-align: center; font-size: 0.62rem; color: #fbbf24; font-weight: 700;">
            OFFICIAL MGM CONVOCATION ID PASS • REGISTRAR SEALED
          </div>
        </div>
      `;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>MGM Convocation - ID Card Backsides (QR Batch)</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 15px; background: #fff; }
          .no-print { text-align: center; margin-bottom: 20px; padding: 10px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
          .no-print button { padding: 8px 20px; font-size: 15px; font-weight: bold; background: #d97706; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
          @media print { .no-print { display: none; } body { padding: 0; } }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()">🖨️ Print All Backsides (Ready for ID Card Reverse / Sticker Printing)</button>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b;">
            Total: ${passes.length} student backside cards with QR automatically positioned according to PRN.
          </p>
        </div>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
          ${cardsHtml}
        </div>
        <script>
          const passesData = ${JSON.stringify(passes.map(p => ({ id: p.id, token: p.qr_token })))};
          passesData.forEach(item => {
            const canvas = document.getElementById('qr-' + item.id);
            if (canvas && window.QRCode) {
              QRCode.toCanvas(canvas, item.token, { width: 140, margin: 1 });
            }
          });
        </script>
      </body>
      </html>
    `);
    win.document.close();
  }

  printSingleIdCard(studentId, side = 'both') {
    const pass = (this.allPasses || []).find(p => p.id === studentId);
    if (!pass) return;

    const univName = window.app.settings.university_name || 'MGM UNIVERSITY';
    const eventTitle = window.app.settings.event_title || 'Convocation Ceremony 2026';

    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ID Card - ${pass.student_name} (${pass.prn_reg_id})</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f1f5f9; padding: 20px; }
          .card-container { display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; }
          .id-card { width: 280px; height: 440px; background: #fff; color: #0f172a; border-radius: 14px; padding: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); display: flex; flex-direction: column; justify-content: space-between; position: relative; border: 1px solid #cbd5e1; box-sizing: border-box; }
          .id-card.back { border: 1.5px solid #d4af37; background: linear-gradient(180deg, #fff 0%, #f8fafc 100%); }
          .header-bar { background: #0f172a; color: #fff; text-align: center; padding: 6px; border-radius: 8px; }
          .prn-banner { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 5px; text-align: center; font-family: monospace; font-size: 0.85rem; font-weight: 800; color: #92400e; }
          .seq-badge { background: #0f172a; color: #fbbf24; font-weight: 800; font-size: 0.8rem; padding: 4px 10px; border-radius: 6px; display: inline-block; }
          @media print { .no-print { display: none; } body { background: #fff; padding: 0; } }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 24px; font-size: 15px; font-weight: bold; background: #d97706; color: #fff; border: none; border-radius: 8px; cursor: pointer;">
            🖨️ Print Student ID Card (${side === 'back' ? 'Backside Only' : 'Dual-Sided'})
          </button>
        </div>

        <div class="card-container">
          ${side === 'both' ? `
          <!-- SIDE A: FRONT -->
          <div class="id-card">
            <div>
              <div class="header-bar">
                <h4 style="margin: 0; font-size: 0.88rem; font-weight: 800;">${univName}</h4>
                <p style="margin: 2px 0 0 0; font-size: 0.65rem; color: #fbbf24; font-weight: 700;">${eventTitle}</p>
              </div>

              <div style="display: flex; justify-content: center; margin: 14px 0 10px 0;">
                <div style="width: 80px; height: 80px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; border: 2px solid #cbd5e1;">
                  🎓
                </div>
              </div>

              <div style="text-align: center;">
                <h3 style="margin: 0 0 4px 0; font-size: 1.1rem; font-weight: 800; color: #0f172a;">${pass.student_name}</h3>
                <div class="prn-banner" style="margin: 6px auto; width: 85%;">
                  PRN: ${pass.prn_reg_id}
                </div>
                <div style="font-size: 0.78rem; font-weight: 600; color: #334155; margin-top: 4px;">${pass.programme_degree}</div>
                <div style="font-size: 0.72rem; color: #64748b;">${pass.school_institute}</div>
                ${pass.award_medal ? `<div style="font-size: 0.75rem; color: #b45309; font-weight: 800; margin-top: 4px;">${pass.award_medal}</div>` : ''}
              </div>
            </div>

            <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px;">
              <div class="seq-badge">STAGE SEQUENCE #${pass.sequence_no}</div>
              <div style="font-size: 0.62rem; color: #94a3b8; margin-top: 4px;">OFFICIAL GRADUATE CREDENTIAL</div>
            </div>
          </div>
          ` : ''}

          <!-- SIDE B: BACK WITH EMBEDDED QR -->
          <div class="id-card back">
            <div>
              <div class="header-bar">
                <h4 style="margin: 0; font-size: 0.88rem; font-weight: 800;">${univName}</h4>
                <p style="margin: 2px 0 0 0; font-size: 0.65rem; color: #fbbf24; font-weight: 700;">CONVOCATION IDENTITY CARD</p>
              </div>

              <div class="prn-banner" style="margin: 10px 0 8px 0;">
                STUDENT PRN: ${pass.prn_reg_id}
              </div>

              <div style="text-align: center; margin: 8px 0;">
                <canvas id="qr-canvas" style="width: 145px; height: 145px;"></canvas>
              </div>

              <div style="text-align: center; font-size: 0.82rem; font-weight: 800; margin-bottom: 4px;">
                ${pass.student_name}
              </div>

              <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; font-size: 0.65rem; color: #334155; line-height: 1.35;">
                <strong>Ceremony Check-In:</strong><br>
                • Scan at Counter for live attendance.<br>
                • Show to Marshal before stage order #${pass.sequence_no}.
              </div>
            </div>

            <div style="background: #0f172a; border-radius: 6px; padding: 5px; text-align: center; font-size: 0.62rem; color: #fbbf24; font-weight: 700;">
              REGISTRAR SECURITY SEALED • TOKEN: ${pass.qr_token}
            </div>
          </div>
        </div>

        <script>
          QRCode.toCanvas(document.getElementById('qr-canvas'), '${pass.qr_token}', { width: 145, margin: 1 });
        </script>
      </body>
      </html>
    `);
    win.document.close();
  }

  async renderPasses(passes) {
    const container = document.getElementById('printable-passes-grid');
    if (!container) return;

    const univName = window.app.settings.university_name || 'MGM UNIVERSITY';
    const eventTitle = window.app.settings.event_title || 'Convocation Ceremony 2026';
    const mode = this.passViewMode || 'two_sided';

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

      if (mode === 'two_sided') {
        // Dual-Sided ID Card: Front side and Back side with automatic QR placed by PRN
        html += `
          <div class="id-card-item">
            <div class="id-card-dual-preview">
              <!-- FRONT FACE -->
              <div class="id-card-face face-front">
                <span class="id-card-side-tag side-front-tag">Front</span>
                <div>
                  <div class="id-card-header-bar">
                    <h5>${univName}</h5>
                    <p>${eventTitle}</p>
                  </div>

                  <div style="display: flex; justify-content: center; margin: 10px 0 8px 0;">
                    <div style="width: 68px; height: 68px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; border: 2px solid #cbd5e1;">
                      🎓
                    </div>
                  </div>

                  <div style="text-align: center;">
                    <div style="font-size: 0.98rem; font-weight: 800; color: #0f172a; line-height: 1.2;">${p.student_name}</div>
                    <div class="id-card-prn-banner" style="margin: 6px auto; width: 90%;">
                      PRN: ${p.prn_reg_id}
                    </div>
                    <div style="font-size: 0.72rem; font-weight: 600; color: #334155; margin-top: 3px;">${p.programme_degree}</div>
                    <div style="font-size: 0.65rem; color: #64748b;">${p.school_institute}</div>
                    ${p.award_medal ? `<div style="font-size: 0.68rem; color: #b45309; font-weight: 800; margin-top: 3px;">${p.award_medal}</div>` : ''}
                  </div>
                </div>

                <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6px;">
                  <div style="display: inline-block; background: #0f172a; color: #fbbf24; font-weight: 800; font-size: 0.75rem; padding: 3px 8px; border-radius: 5px;">
                    STAGE SEQ #${p.sequence_no}
                  </div>
                </div>
              </div>

              <!-- BACK FACE WITH AUTOMATIC PRN QR CODE -->
              <div class="id-card-face face-back">
                <span class="id-card-side-tag side-back-tag">Back (QR)</span>
                <div>
                  <div class="id-card-header-bar">
                    <h5>${univName}</h5>
                    <p>CONVOCATION IDENTITY CARD</p>
                  </div>

                  <div class="id-card-prn-banner">
                    PRN: ${p.prn_reg_id}
                  </div>

                  <div class="id-card-back-qr-zone">
                    ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR for PRN ${p.prn_reg_id}">` : `<div style="font-size:0.7rem; font-family:monospace; text-align:center;">${p.qr_token}</div>`}
                    <div style="font-size: 0.65rem; color: #64748b; font-family: monospace; margin-top: 2px;">
                      ${p.prn_reg_id}
                    </div>
                  </div>

                  <div class="id-card-back-rules">
                    <strong>Check-In Verification:</strong><br>
                    • Scan at reporting desk for attendance check-in.<br>
                    • Stage lineup marshals verify order sequence #${p.sequence_no}.
                  </div>
                </div>

                <div class="id-card-back-footer">
                  OFFICIAL MGM CONVOCATION ID PASS • REGISTRAR SEALED
                </div>
              </div>
            </div>

            <!-- Action controls for this student ID card -->
            <div class="no-print" style="display: flex; gap: 0.4rem; justify-content: center; flex-wrap: wrap; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 0.75rem;">
              <button class="btn btn-sm btn-primary" onclick="window.adminController.printSingleIdCard(${p.id}, 'both')">
                🖨️ Print ID Card (Front & Back)
              </button>
              <button class="btn btn-sm btn-outline-warning" onclick="window.adminController.printSingleIdCard(${p.id}, 'back')">
                📄 Print Backside Only
              </button>
              <a href="/api/qr/id-card-back/${encodeURIComponent(p.prn_reg_id)}" target="_blank" download="${p.prn_reg_id}_backside.png" class="btn btn-sm btn-secondary" style="text-decoration: none;">
                ⬇️ Backside PNG
              </a>
            </div>
          </div>
        `;
      } else if (mode === 'backside') {
        // ID Card Backside only view
        html += `
          <div class="id-card-item" style="max-width: 330px; margin: 0 auto;">
            <div class="id-card-face face-back" style="width: 100%;">
              <span class="id-card-side-tag side-back-tag">Back (QR by PRN)</span>
              <div>
                <div class="id-card-header-bar">
                  <h5>${univName}</h5>
                  <p>CONVOCATION IDENTITY CARD</p>
                </div>

                <div class="id-card-prn-banner">
                  PRN: ${p.prn_reg_id}
                </div>

                <div class="id-card-back-qr-zone">
                  ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR for PRN ${p.prn_reg_id}">` : `<div style="font-size:0.7rem; font-family:monospace; text-align:center;">${p.qr_token}</div>`}
                  <div style="font-size: 0.65rem; color: #64748b; font-family: monospace; margin-top: 2px;">
                    PRN: ${p.prn_reg_id}
                  </div>
                </div>

                <div style="font-size: 0.85rem; font-weight: 800; color: #0f172a; text-align: center; margin-bottom: 2px;">
                  ${p.student_name}
                </div>
                <div style="font-size: 0.72rem; color: #475569; text-align: center; margin-bottom: 6px;">
                  ${p.programme_degree} • Stage #${p.sequence_no}
                </div>

                <div class="id-card-back-rules">
                  <strong>Counter & Stage Instructions:</strong><br>
                  • Scan at Reporting Desk for automated check-in.<br>
                  • Pre-stage marshal verifies physical sequence order #${p.sequence_no}.
                </div>
              </div>

              <div class="id-card-back-footer">
                OFFICIAL MGM CONVOCATION ID PASS • REGISTRAR SEALED
              </div>
            </div>

            <div class="no-print" style="display: flex; gap: 0.4rem; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-sm btn-primary" onclick="window.adminController.printSingleIdCard(${p.id}, 'back')">
                🖨️ Print Backside Card
              </button>
              <a href="/api/qr/id-card-back/${encodeURIComponent(p.prn_reg_id)}" target="_blank" download="${p.prn_reg_id}_backside.png" class="btn btn-sm btn-secondary" style="text-decoration: none;">
                ⬇️ Download PNG
              </a>
            </div>
          </div>
        `;
      } else {
        // Standard pass view
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

            <div class="pass-footer" style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 0.72rem; color: #94a3b8;">
                Token: <code>${p.qr_token}</code>
              </div>
              <div class="no-print" style="display: flex; gap: 0.35rem;">
                <button class="btn btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;" onclick="window.adminController.printSingleIdCard(${p.id}, 'both')">
                  🪪 ID Card
                </button>
                <a href="/api/qr/id-card-back/${encodeURIComponent(p.prn_reg_id)}" target="_blank" download="${p.prn_reg_id}_backside.png" class="btn btn-outline-warning" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; text-decoration: none;">
                  ⬇️ Back PNG
                </a>
              </div>
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = html;
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
    try {
      const res = await fetch('/api/admin/import-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: this.stagedRows,
          userId: window.app.currentUser?.id || 1
        })
      });
      const data = await res.json();
      if (data.success) {
        window.soundFX?.playSuccess();
        window.app.showToast(data.message, 'success');
        this.loadStudentMaster();
        this.loadPasses();
        window.dashboardController?.loadStats();
        document.getElementById('admin-import-preview').innerHTML = `
          <div class="card" style="margin-top: 1rem; background: #064e3b; border: 1px solid #10b981; padding: 1rem;">
            <p style="color: #6ee7b7; font-weight: 700; margin: 0;">✓ ${data.message}</p>
          </div>
        `;
      } else {
        window.app.showToast(data.error || 'Import failed', 'danger');
      }
    } catch (err) {
      console.error('Import commit error:', err);
      window.app.showToast('Network error during import', 'danger');
    }
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

  openResetModal() {
    const modal = document.getElementById('admin-reset-modal');
    const input = document.getElementById('admin-reset-input');
    if (modal && input) {
      input.value = '';
      modal.style.display = 'flex';
      input.focus();
    } else {
      this.resetCeremony();
    }
  }

  async confirmResetCeremony() {
    const input = document.getElementById('admin-reset-input');
    const val = input?.value?.trim();
    if (val !== 'RESET_LIVE_CEREMONY') {
      alert("Please type exactly 'RESET_LIVE_CEREMONY' to confirm reset.");
      return;
    }
    const modal = document.getElementById('admin-reset-modal');
    if (modal) modal.style.display = 'none';

    await this.executeCeremonyReset('RESET_LIVE_CEREMONY');
  }

  async resetCeremony() {
    const confirm = prompt("⚠️ WARNING: This will clear all Reporting Scans, Pre-Stage Queues, and Stage Events for a fresh ceremony / rehearsal.\n\nType 'RESET_LIVE_CEREMONY' to confirm:");
    if (confirm === 'RESET_LIVE_CEREMONY') {
      await this.executeCeremonyReset(confirm);
    } else if (confirm !== null) {
      alert('Reset cancelled. Incorrect confirmation keyword.');
    }
  }

  async executeCeremonyReset(confirmation) {
    try {
      window.app.showToast('Resetting ceremony transactions...', 'info');
      const res = await fetch('/api/admin/reset-ceremony', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation, userId: window.app.currentUser.id })
      });
      const data = await res.json();
      if (data.success) {
        window.soundFX?.playSuccess();
        window.app.showToast('Ceremony transactions reset! System is ready for fresh rehearsal.', 'success');
        this.loadStudentMaster();
        this.loadBackupsList();
        window.dashboardController?.loadStats();
        window.stageController?.loadStageState();
      } else {
        alert(data.error || 'Reset failed');
      }
    } catch (e) {
      console.error('Reset failed:', e);
      alert('Network error during reset');
    }
  }
}

window.adminController = new AdminController();
