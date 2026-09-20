// Reporting Desk Controller

class ReportingController {
  constructor() {
    this.scanInput = null;
    this.isProcessing = false;
    this.recentScans = [];
  }

  init() {
    this.scanInput = document.getElementById('reporting-scan-input');
    if (!this.scanInput) return;

    // Permanent auto-focus for USB scanner gun
    this.focusInput();
    document.addEventListener('click', (e) => {
      // Keep focused unless typing in another input
      if (window.app.currentView === 'reporting' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        this.focusInput();
      }
    });

    this.scanInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = this.scanInput.value.trim();
        if (code) {
          this.processScan(code);
        }
      }
    });

    this.html5QrCode = null;
    this.isCameraScanning = false;

    // Clear and reset preview on initial load
    this.renderInitialState();

    const deskSelect = document.getElementById('reporting-desk-select');
    if (deskSelect && window.app?.currentUser?.desk_id) {
      deskSelect.value = window.app.currentUser.desk_id;
    }
  }

  onDeskChange(newDesk) {
    if (window.app?.currentUser) {
      window.app.currentUser.desk_id = newDesk;
      window.app.updateUserBadge();
    }
    window.app.showToast(`Scanner counter set to ${newDesk}`, 'info');
    this.focusInput();
  }

  async toggleCameraScanner() {
    const box = document.getElementById('reporting-camera-box');
    if (!box) return;

    if (this.isCameraScanning) {
      if (this.html5QrCode) {
        await this.html5QrCode.stop().catch(() => {});
      }
      box.style.display = 'none';
      this.isCameraScanning = false;
      window.app.showToast('Camera scanner stopped', 'info');
      return;
    }

    box.style.display = 'block';
    this.isCameraScanning = true;

    if (!window.Html5Qrcode) {
      alert('Camera library loading. Please try again in 2 seconds.');
      return;
    }

    this.html5QrCode = new Html5Qrcode('reporting-camera-box');
    try {
      await this.html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        (decodedText) => {
          this.processScan(decodedText);
          // Auto-pause briefly after scan
        },
        () => {}
      );
      window.app.showToast('Camera active. Hold QR code in front of camera.', 'success');
    } catch (err) {
      console.warn('Camera start error:', err);
      box.style.display = 'none';
      this.isCameraScanning = false;
      alert('Camera permission denied or camera not found: ' + err.message);
    }
  }

  focusInput() {
    if (this.scanInput) {
      this.scanInput.focus();
    }
  }

  renderInitialState() {
    const card = document.getElementById('reporting-student-card');
    if (card) {
      card.className = 'student-preview-card';
      card.innerHTML = `
        <div style="font-size: 3.5rem; opacity: 0.3; margin-bottom: 1rem;">📷</div>
        <h3 style="font-size: 1.3rem; font-weight: 700; color: #94a3b8;">Ready to Scan QR Pass</h3>
        <p style="color: #64748b; font-size: 0.88rem; max-width: 300px; margin-top: 0.5rem;">
          Aim USB scanner at student's pass or enter PRN / Token manually.
        </p>
      `;
    }
  }

  async processScan(rawToken) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.scanInput.value = '';

    const deskId = window.app.currentUser.desk_id || 'DESK-01';
    const operatorId = window.app.currentUser.id || 1;

    try {
      const res = await fetch('/api/reporting/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken, deskId, operatorId })
      });

      const data = await res.json();

      if (res.status === 200 && data.status === 'SUCCESS') {
        // Valid First Scan!
        window.soundFX?.playSuccess();
        this.renderStudentCard(data.student, 'SUCCESS', data.isLate ? 'REPORTED (LATE ARRIVAL)' : 'SUCCESSFULLY REPORTED');
        this.addRecentScan(data.student, 'SUCCESS', deskId);
      } else if (res.status === 409 && data.status === 'ALREADY_REPORTED') {
        // Duplicate Scan Warning!
        window.soundFX?.playDuplicate();
        this.renderStudentCard(data.student, 'DUPLICATE', data.message);
        this.addRecentScan(data.student, 'DUPLICATE', deskId);
      } else if (res.status === 404) {
        // Unknown QR!
        window.soundFX?.playError();
        this.renderErrorCard('UNKNOWN QR CODE', data.message || 'Token not recognized. Direct to Help Desk.');
      } else if (res.status === 403) {
        // Inactive / Cancelled!
        window.soundFX?.playError();
        this.renderStudentCard(data.student, 'ERROR', data.message);
      } else {
        window.soundFX?.playError();
        this.renderErrorCard('SCAN ERROR', data.message || 'Error recording scan');
      }
    } catch (err) {
      console.error('Scan request failed:', err);
      window.soundFX?.playError();
      this.renderErrorCard('NETWORK ERROR', 'Could not reach server. Check LAN cable.');
    } finally {
      this.isProcessing = false;
      this.focusInput();
    }
  }

  renderStudentCard(student, statusType, bannerMessage) {
    const card = document.getElementById('reporting-student-card');
    if (!card) return;

    let cardClass = 'student-preview-card ';
    let bannerClass = 'status-banner ';

    if (statusType === 'SUCCESS') {
      cardClass += 'status-success';
      bannerClass += 'success';
    } else if (statusType === 'DUPLICATE') {
      cardClass += 'status-duplicate';
      bannerClass += 'warning';
    } else {
      cardClass += 'status-error';
      bannerClass += 'error';
    }

    card.className = cardClass;
    card.innerHTML = `
      <div class="student-photo-frame">
        <img src="${student.photo_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(student.student_name)}" alt="${student.student_name}">
      </div>
      <div class="pass-seq-tag" style="font-size: 0.85rem; margin-bottom: 0.5rem;">CONVOCATION SEQ #${student.sequence_no}</div>
      <h2 class="student-name-big">${student.student_name}</h2>
      <div class="student-degree-text">${student.programme_degree}</div>
      <div class="student-school-text">${student.school_institute}</div>
      <div style="font-family: monospace; font-size: 0.85rem; color: #94a3b8; margin-top: 0.25rem;">PRN: ${student.prn_reg_id}</div>

      ${student.award_medal ? `<div class="student-medal-badge">${student.award_medal}</div>` : ''}

      <div class="${bannerClass}">
        <span>${statusType === 'SUCCESS' ? '✓' : statusType === 'DUPLICATE' ? '⚠️' : '❌'}</span>
        <span>${bannerMessage}</span>
      </div>
    `;
  }

  renderErrorCard(title, message) {
    const card = document.getElementById('reporting-student-card');
    if (!card) return;

    card.className = 'student-preview-card status-error';
    card.innerHTML = `
      <div style="font-size: 3.5rem; color: #f43f5e; margin-bottom: 0.5rem;">⚠️</div>
      <h2 style="font-size: 1.5rem; font-weight: 800; color: #f43f5e;">${title}</h2>
      <p style="color: #cbd5e1; margin-top: 0.5rem; font-size: 0.95rem;">${message}</p>
      <div class="status-banner error" style="margin-top: 1.5rem;">
        ACTION: Direct student to Help Desk Counter
      </div>
    `;
  }

  addRecentScan(student, status, deskId) {
    const table = document.getElementById('reporting-recent-scans-tbody');
    if (!table) return;

    const row = document.createElement('tr');
    const time = new Date().toLocaleTimeString();
    row.innerHTML = `
      <td>${time}</td>
      <td style="font-weight: 700;">${student.student_name}</td>
      <td style="font-family: monospace;">${student.prn_reg_id}</td>
      <td>Seq #${student.sequence_no}</td>
      <td><span class="role-tag" style="background: ${status === 'SUCCESS' ? '#10b981' : '#f59e0b'}; color: #fff;">${status}</span></td>
    `;

    table.insertBefore(row, table.firstChild);
    if (table.children.length > 8) {
      table.removeChild(table.lastChild);
    }
  }
}

window.reportingController = new ReportingController();
