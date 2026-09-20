// Stage Controller Master Backstage Portal

class StageController {
  constructor() {
    this.currentStudent = null;
    this.nextStudent = null;
    this.afterNextStudent = null;
    this.fullQueue = [];
    this.activeMode = 'HOLDING';
    this.hotkeysBound = false;
  }

  init() {
    this.loadStageState();
    this.bindHotkeys();

    if (window.app.socket) {
      window.app.socket.on('stage:queue_update', (data) => {
        this.currentStudent = data.current;
        this.nextStudent = data.next;
        this.afterNextStudent = data.afterNext;
        this.fullQueue = data.fullQueue || [];
        this.render();
      });

      window.app.socket.on('display:slide_update', (state) => {
        this.activeMode = state.mode;
        this.updateModeIndicator();
      });
    }
  }

  bindHotkeys() {
    if (this.hotkeysBound) return;
    this.hotkeysBound = true;

    window.addEventListener('keydown', (e) => {
      if (window.app.currentView !== 'stagecontrol') return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

      // Spacebar -> DISPLAY NEXT
      if (e.code === 'Space') {
        e.preventDefault();
        this.displayNext();
      }
      // 'H' -> EMERGENCY HOLD
      else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        this.emergencyHold();
      }
      // 'P' -> PREVIOUS
      else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        this.previous();
      }
      // 'C' -> COMPLETE / CONFER
      else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        this.complete();
      }
      // 'S' -> SKIP NEXT
      else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.openSkipModal();
      }
    });
  }

  async loadStageState() {
    try {
      const res = await fetch('/api/stage/queue');
      const data = await res.json();
      if (data.success) {
        this.currentStudent = data.current;
        this.nextStudent = data.next;
        this.afterNextStudent = data.afterNext;
        this.fullQueue = data.queue || [];
        this.activeMode = data.activeMode || 'HOLDING';
        this.render();
      }
    } catch (e) {
      console.error('Failed to load stage state:', e);
    }
  }

  async displayNext() {
    try {
      const operatorId = window.app.currentUser.id || 1;
      const res = await fetch('/api/stage/display-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId })
      });
      const data = await res.json();
      if (data.success) {
        window.soundFX?.playStageTone();
        window.app.showToast('Displayed Next Student on LED', 'info');
      }
    } catch (e) {
      console.error('Display next error:', e);
    }
  }

  async emergencyHold() {
    try {
      const operatorId = window.app.currentUser.id || 1;
      const res = await fetch('/api/stage/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId })
      });
      const data = await res.json();
      if (data.success) {
        window.soundFX?.playError();
        window.app.showToast('⚠️ Emergency Hold Activated - LED on Holding Screen', 'warning');
      }
    } catch (e) {
      console.error('Hold error:', e);
    }
  }

  async previous() {
    try {
      const operatorId = window.app.currentUser.id || 1;
      const res = await fetch('/api/stage/previous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId })
      });
      const data = await res.json();
      if (data.success) {
        window.soundFX?.playStageTone();
        window.app.showToast(data.message || 'Recalled previous student to stage', 'info');
      } else {
        window.app.showToast(data.error || 'Cannot recall previous', 'warning');
      }
    } catch (e) {
      console.error('Previous error:', e);
    }
  }

  async complete() {
    try {
      const operatorId = window.app.currentUser.id || 1;
      const res = await fetch('/api/stage/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId })
      });
      const data = await res.json();
      if (data.success) {
        window.soundFX?.playSuccess();
        window.app.showToast(data.message || 'Degree conferred! LED set to Holding Screen.', 'success');
      } else {
        window.app.showToast(data.error || 'No student active on stage', 'warning');
      }
    } catch (e) {
      console.error('Complete error:', e);
    }
  }

  openSkipModal() {
    if (!this.nextStudent && !this.currentStudent) {
      window.app.showToast('No student to skip in queue', 'warning');
      return;
    }

    const target = this.nextStudent || this.currentStudent;
    this.targetSkipStudent = target;

    const modal = document.getElementById('stage-skip-modal');
    const info = document.getElementById('stage-skip-target-info');
    if (modal && info) {
      info.innerHTML = `
        <div style="font-weight: 800; color: #fff; font-size: 1.1rem;">${target.student_name}</div>
        <div style="color: var(--gold); font-size: 0.85rem; margin-top: 2px;">Seq #${target.sequence_no} • PRN: ${target.prn_reg_id || 'N/A'}</div>
        <div style="color: #94a3b8; font-size: 0.8rem;">${target.programme_degree || ''}</div>
      `;
      const select = document.getElementById('stage-skip-reason-select');
      const custom = document.getElementById('stage-skip-custom-reason');
      if (select) select.value = 'Absent from stage line / Left queue';
      if (custom) {
        custom.style.display = 'none';
        custom.value = '';
      }
      modal.style.display = 'flex';
    } else {
      // Fallback
      const reason = prompt(`Skip Student #${target.sequence_no} (${target.student_name})?\nEnter Reason:`, 'Absent from stage queue / Left line');
      if (reason !== null) {
        this.executeSkip(target.student_id, reason);
      }
    }
  }

  confirmSkip() {
    if (!this.targetSkipStudent) return;
    const select = document.getElementById('stage-skip-reason-select');
    const custom = document.getElementById('stage-skip-custom-reason');
    let reason = select?.value || 'Absent from stage queue / Left line';
    if (reason === 'Custom') {
      reason = custom?.value.trim() || 'Manual skip without specified reason';
    }
    const modal = document.getElementById('stage-skip-modal');
    if (modal) modal.style.display = 'none';

    this.executeSkip(this.targetSkipStudent.student_id, reason);
  }

  async executeSkip(studentId, reason) {
    try {
      const operatorId = window.app.currentUser.id || 1;
      const res = await fetch('/api/stage/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, reason, operatorId })
      });
      const data = await res.json();
      if (data.success) {
        window.app.showToast('Student skipped and recorded', 'warning');
      }
    } catch (e) {
      console.error('Skip failed:', e);
    }
  }

  openSearchJumpModal() {
    const modal = document.getElementById('stage-search-modal');
    if (modal) {
      modal.style.display = 'flex';
      const input = document.getElementById('stage-search-input');
      if (input) {
        input.value = '';
        input.focus();
      }
      document.getElementById('stage-search-results').innerHTML = '<p style="text-align:center; color:#64748b; padding:1.5rem;">Enter sequence number, PRN, or student name to search.</p>';
    }
  }

  async searchBackstage(term) {
    if (!term || term.trim().length < 2) return;
    const resultsContainer = document.getElementById('stage-search-results');
    if (!resultsContainer) return;

    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(term.trim())}&limit=8`);
      const data = await res.json();
      if (data.success && data.students.length > 0) {
        let html = '<div style="display:flex; flex-direction:column; gap:0.6rem;">';
        data.students.forEach(s => {
          html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); padding:0.6rem 0.85rem; border-radius:8px; border:1px solid rgba(255,255,255,0.08);">
              <div>
                <span class="pass-seq-tag" style="font-size:0.7rem;">SEQ #${s.sequence_no}</span>
                <span style="font-weight:700; color:#fff; margin-left:0.4rem;">${s.student_name}</span>
                <div style="font-size:0.78rem; color:#94a3b8;">${s.prn_reg_id} • ${s.programme_degree}</div>
              </div>
              <div style="display:flex; gap:0.4rem;">
                <button class="btn btn-primary" style="padding:0.35rem 0.65rem; font-size:0.75rem;" onclick="window.stageController.applyJump(${s.id}, 'DISPLAY_NOW')">▶ Display Now</button>
                <button class="btn btn-secondary" style="padding:0.35rem 0.65rem; font-size:0.75rem;" onclick="window.stageController.applyJump(${s.id}, 'QUEUE_NEXT')">⏳ Queue Next</button>
              </div>
            </div>
          `;
        });
        html += '</div>';
        resultsContainer.innerHTML = html;
      } else {
        resultsContainer.innerHTML = '<p style="text-align:center; color:#ef4444; padding:1.5rem;">No matching student records found.</p>';
      }
    } catch (e) {
      console.error('Search error:', e);
    }
  }

  async applyJump(studentId, action) {
    try {
      const operatorId = window.app.currentUser.id || 1;
      const res = await fetch('/api/stage/search-jump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, action, operatorId })
      });
      const data = await res.json();
      if (data.success) {
        window.soundFX?.playSuccess();
        window.app.showToast(data.message, 'success');
        document.getElementById('stage-search-modal').style.display = 'none';
      }
    } catch (e) {
      console.error('Jump failed:', e);
    }
  }

  async removeFromQueue(queueId, studentId) {
    if (!confirm('Remove student from stage lineup?')) return;
    try {
      const operatorId = window.app.currentUser.id || 1;
      const res = await fetch('/api/stage/remove-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId, studentId, operatorId })
      });
      const data = await res.json();
      if (data.success) {
        window.app.showToast('Student removed from queue', 'info');
      }
    } catch (e) {
      console.error('Remove error:', e);
    }
  }

  updateModeIndicator() {
    const pill = document.getElementById('stage-led-status-pill');
    if (!pill) return;
    if (this.activeMode === 'STUDENT') {
      pill.style.background = 'rgba(16, 185, 129, 0.2)';
      pill.style.border = '1px solid #10b981';
      pill.style.color = '#34d399';
      pill.innerHTML = `● LIVE: STUDENT SLIDE`;
    } else {
      pill.style.background = 'rgba(212, 175, 55, 0.2)';
      pill.style.border = '1px solid #d4af37';
      pill.style.color = '#fef08a';
      pill.innerHTML = `● LIVE: UNIVERSITY HOLDING SCREEN`;
    }
  }

  render() {
    this.updateModeIndicator();

    // 1. Current Student Box
    const currentBox = document.getElementById('stage-current-box');
    if (currentBox) {
      if (this.currentStudent) {
        currentBox.innerHTML = `
          <div class="stage-box-tag">● CURRENT ON STAGE</div>
          <div style="display: flex; gap: 1.25rem; align-items: center; margin-top: 0.5rem;">
            <div class="student-photo-frame" style="width: 100px; height: 100px; border-color: #d4af37; margin: 0;">
              <img src="${this.currentStudent.photo_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.currentStudent.student_name)}" alt="">
            </div>
            <div>
              <div class="pass-seq-tag">SEQ #${this.currentStudent.sequence_no}</div>
              <h2 style="font-size: 1.4rem; font-weight: 800; color: #fff; margin: 0.2rem 0;">${this.currentStudent.student_name}</h2>
              <div style="color: #d4af37; font-weight: 600; font-size: 0.95rem;">${this.currentStudent.programme_degree}</div>
              <div style="color: #94a3b8; font-size: 0.8rem;">${this.currentStudent.school_institute}</div>
              ${this.currentStudent.award_medal ? `<div class="student-medal-badge" style="font-size: 0.78rem; padding: 0.2rem 0.6rem; margin-top: 0.4rem;">${this.currentStudent.award_medal}</div>` : ''}
            </div>
          </div>
        `;
      } else {
        currentBox.innerHTML = `
          <div class="stage-box-tag" style="background: #475569; color: #fff;">STAGE IDLE</div>
          <div style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🏛️</div>
            <p>No student currently displayed.<br>LED is showing the Holding Screen.</p>
          </div>
        `;
      }
    }

    // 2. Next Student Box
    const nextBox = document.getElementById('stage-next-box');
    if (nextBox) {
      if (this.nextStudent) {
        nextBox.innerHTML = `
          <div class="stage-box-tag" style="background: #3b82f6; color: #fff;">NEXT IN LINE</div>
          <div style="display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem;">
            <div class="student-photo-frame" style="width: 80px; height: 80px; border-color: #3b82f6; margin: 0;">
              <img src="${this.nextStudent.photo_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.nextStudent.student_name)}" alt="">
            </div>
            <div>
              <span class="pass-seq-tag" style="background: #1e3a8a; color: #93c5fd;">SEQ #${this.nextStudent.sequence_no}</span>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff; margin: 0.2rem 0;">${this.nextStudent.student_name}</h3>
              <div style="color: #93c5fd; font-size: 0.85rem;">${this.nextStudent.programme_degree}</div>
              ${this.nextStudent.award_medal ? `<div style="color: #fef08a; font-size: 0.75rem; margin-top: 0.25rem;">${this.nextStudent.award_medal}</div>` : ''}
            </div>
          </div>
        `;
      } else {
        nextBox.innerHTML = `
          <div class="stage-box-tag" style="background: #475569; color: #fff;">NEXT</div>
          <div style="text-align: center; padding: 2rem 1rem; color: #64748b;">
            <p>Queue empty. Waiting for pre-stage scan.</p>
          </div>
        `;
      }
    }

    // 3. After Next Box
    const afterNextBox = document.getElementById('stage-after-next-box');
    if (afterNextBox) {
      if (this.afterNextStudent) {
        afterNextBox.innerHTML = `
          <div class="stage-box-tag" style="background: #64748b; color: #fff;">AFTER NEXT</div>
          <div style="display: flex; gap: 0.75rem; align-items: center; margin-top: 0.5rem;">
            <div class="student-photo-frame" style="width: 60px; height: 60px; border-color: #64748b; margin: 0;">
              <img src="${this.afterNextStudent.photo_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.afterNextStudent.student_name)}" alt="">
            </div>
            <div>
              <span class="pass-seq-tag" style="font-size: 0.7rem;">SEQ #${this.afterNextStudent.sequence_no}</span>
              <h4 style="font-size: 1rem; font-weight: 700; color: #fff;">${this.afterNextStudent.student_name}</h4>
              <div style="color: #94a3b8; font-size: 0.8rem;">${this.afterNextStudent.programme_degree}</div>
            </div>
          </div>
        `;
      } else {
        afterNextBox.innerHTML = `
          <div class="stage-box-tag" style="background: #475569; color: #fff;">AFTER NEXT</div>
          <div style="text-align: center; padding: 2rem 1rem; color: #64748b;">
            <p>No further students queued.</p>
          </div>
        `;
      }
    }

    // 4. Full Queue Table
    const queueTable = document.getElementById('stage-full-queue-tbody');
    if (queueTable) {
      if (this.fullQueue.length === 0) {
        queueTable.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 1.5rem;">No students in waiting line</td></tr>`;
      } else {
        let html = '';
        this.fullQueue.forEach((s, idx) => {
          html += `
            <tr>
              <td style="font-weight: 800; color: #d4af37;">#${idx + 1}</td>
              <td style="font-weight: 700;">Seq #${s.sequence_no}</td>
              <td style="font-weight: 600;">${s.student_name}</td>
              <td>${s.programme_degree}</td>
              <td>
                <div style="display: flex; gap: 0.35rem;">
                  <button class="btn btn-primary" style="padding: 0.25rem 0.55rem; font-size: 0.72rem;" onclick="window.stageController.applyJump(${s.student_id}, 'DISPLAY_NOW')" title="Display Directly on Stage">
                    ▶ Show Now
                  </button>
                  <button class="btn btn-danger" style="padding: 0.25rem 0.55rem; font-size: 0.72rem;" onclick="window.stageController.removeFromQueue(${s.id}, ${s.student_id})" title="Remove from waiting lineup">
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          `;
        });
        queueTable.innerHTML = html;
      }
    }
  }
}

window.stageController = new StageController();
