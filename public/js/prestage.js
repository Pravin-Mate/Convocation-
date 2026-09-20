// Pre-Stage Lineup & Sequence Verification Controller

class PreStageController {
  constructor() {
    this.scanInput = null;
    this.isProcessing = false;
  }

  init() {
    this.scanInput = document.getElementById('prestage-scan-input');
    if (!this.scanInput) return;

    this.focusInput();
    document.addEventListener('click', (e) => {
      if (window.app.currentView === 'prestage' && e.target.tagName !== 'INPUT') {
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

    this.loadQueue();

    if (window.app.socket) {
      window.app.socket.on('stage:queue_update', () => this.loadQueue());
    }
  }

  focusInput() {
    if (this.scanInput) this.scanInput.focus();
  }

  async loadQueue() {
    try {
      const res = await fetch('/api/stage/queue');
      const data = await res.json();
      if (data.success) {
        this.renderQueueList(data.queue);
      }
    } catch (e) {
      console.error('Failed to load queue:', e);
    }
  }

  async processScan(rawToken, forceQueue = false) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.scanInput.value = '';

    const operatorId = window.app.currentUser.id || 1;

    try {
      const res = await fetch('/api/prestage/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken, operatorId, forceQueue })
      });

      const data = await res.json();

      if (res.status === 200) {
        window.soundFX?.playSuccess();
        this.renderVerificationResult(data.student, data.sequenceWarning, 'QUEUED');
        this.loadQueue();
      } else if (res.status === 400 && data.status === 'NOT_REPORTED') {
        window.soundFX?.playError();
        this.renderUnreportedWarning(data.student, rawToken);
      } else if (res.status === 409) {
        window.soundFX?.playDuplicate();
        this.renderVerificationResult(data.student, data.message, 'ALREADY_QUEUED');
      } else {
        window.soundFX?.playError();
        this.renderError(data.message || 'Verification Error');
      }
    } catch (err) {
      console.error('Pre-stage scan error:', err);
      window.soundFX?.playError();
      this.renderError('Server Connection Error');
    } finally {
      this.isProcessing = false;
      this.focusInput();
    }
  }

  renderVerificationResult(student, sequenceWarning, status) {
    const banner = document.getElementById('prestage-result-banner');
    if (!banner) return;

    let warningHtml = '';
    if (sequenceWarning) {
      warningHtml = `
        <div class="status-banner warning" style="margin-top: 0.75rem;">
          ⚠️ <strong>Sequence Notice:</strong> ${sequenceWarning}
        </div>
      `;
    }

    banner.innerHTML = `
      <div class="card" style="background: #111b2e; border: 2px solid ${sequenceWarning ? '#f59e0b' : '#10b981'}; border-radius: 12px; padding: 1.25rem;">
        <div style="display: flex; gap: 1rem; align-items: center;">
          <div class="student-photo-frame" style="width: 70px; height: 70px; margin: 0;">
            <img src="${student.photo_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(student.student_name)}" alt="">
          </div>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="pass-seq-tag">SEQ #${student.sequence_no}</span>
              <span class="role-tag" style="background: #10b981; color: #fff;">READY FOR STAGE</span>
            </div>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: #fff; margin: 0.25rem 0;">${student.student_name}</h3>
            <div style="color: #d4af37; font-size: 0.85rem;">${student.programme_degree}</div>
          </div>
        </div>
        ${warningHtml}
      </div>
    `;
  }

  renderUnreportedWarning(student, rawToken) {
    const banner = document.getElementById('prestage-result-banner');
    if (!banner) return;

    banner.innerHTML = `
      <div class="card" style="background: #241117; border: 2px solid #f43f5e; border-radius: 12px; padding: 1.25rem;">
        <div style="display: flex; gap: 1rem; align-items: center;">
          <div style="font-size: 2.5rem; color: #f43f5e;">🚫</div>
          <div style="flex: 1;">
            <span class="role-tag" style="background: #f43f5e; color: #fff;">UNREPORTED STUDENT</span>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: #fff; margin: 0.25rem 0;">${student.student_name} (Seq #${student.sequence_no})</h3>
            <p style="color: #cbd5e1; font-size: 0.85rem;">This student has not marked attendance at the reporting desk!</p>
          </div>
        </div>
        <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
          <button class="btn btn-secondary" style="font-size: 0.8rem;" onclick="window.prestageController.focusInput()">
            Cancel / Send to Help Desk
          </button>
          <button class="btn btn-danger" style="font-size: 0.8rem;" onclick="window.prestageController.processScan('${rawToken}', true)">
            ⚠️ Force Queue (Emergency Override)
          </button>
        </div>
      </div>
    `;
  }

  renderError(msg) {
    const banner = document.getElementById('prestage-result-banner');
    if (!banner) return;
    banner.innerHTML = `
      <div class="status-banner error">
        ❌ ${msg}
      </div>
    `;
  }

  renderQueueList(queuedStudents) {
    const tbody = document.getElementById('prestage-queue-tbody');
    if (!tbody) return;

    if (!queuedStudents || queuedStudents.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #64748b; padding: 2rem;">
            Stage Queue is currently empty. Scan students 3–5 positions before stage entry.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    queuedStudents.forEach((s, idx) => {
      html += `
        <tr>
          <td style="font-weight: 800; color: #d4af37;">${idx + 1}</td>
          <td style="font-weight: 700; color: #fff;">#${s.sequence_no}</td>
          <td style="font-family: monospace;">${s.prn_reg_id}</td>
          <td style="font-weight: 600;">${s.student_name}</td>
          <td>${s.programme_degree}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }
}

window.prestageController = new PreStageController();
