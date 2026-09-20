// Help Desk & Manual Resolution Controller

class HelpDeskController {
  constructor() {
    this.selectedStudent = null;
  }

  init() {
    const searchInput = document.getElementById('helpdesk-search-input');
    const searchBtn = document.getElementById('helpdesk-search-btn');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        if (query.length >= 2) {
          this.searchStudents(query);
        } else if (query.length === 0) {
          this.renderResults([]);
        }
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.searchStudents(searchInput.value.trim());
        }
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        if (searchInput) this.searchStudents(searchInput.value.trim());
      });
    }
  }

  async searchStudents(searchTerm) {
    if (!searchTerm) return;
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(searchTerm)}&limit=10`);
      const data = await res.json();
      if (data.success) {
        this.renderResults(data.students);
      }
    } catch (e) {
      console.error('Help desk search error:', e);
    }
  }

  renderResults(students) {
    const container = document.getElementById('helpdesk-results-container');
    if (!container) return;

    if (students.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: #64748b;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
          <p>No matching student records found. Verify PRN or Name spelling.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Seq #</th>
              <th>PRN / Reg ID</th>
              <th>Student Name</th>
              <th>Programme & Degree</th>
              <th>Current Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
    `;

    students.forEach(s => {
      const isReported = Boolean(s.reported_at);
      const isLate = Boolean(s.is_late);
      const statusBadge = isReported 
        ? `<span class="role-tag" style="background: #10b981; color: #fff;">REPORTED ${isLate ? '(LATE)' : ''}</span>`
        : `<span class="role-tag" style="background: #ef4444; color: #fff;">NOT REPORTED</span>`;

      html += `
        <tr>
          <td style="font-weight: 800; color: #d4af37;">#${s.sequence_no}</td>
          <td style="font-family: monospace; font-weight: 600;">${s.prn_reg_id}</td>
          <td style="font-weight: 700;">${s.student_name}</td>
          <td>${s.programme_degree}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="window.helpdeskController.openStudentModal(${s.id})">
              View & Resolve
            </button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }

  async openStudentModal(studentId) {
    try {
      const res = await fetch(`/api/students/${studentId}`);
      const data = await res.json();
      if (data.success) {
        this.selectedStudent = data.student;
        this.renderModal(data.student);
      }
    } catch (e) {
      console.error('Failed to load student details:', e);
    }
  }

  renderModal(student) {
    const isReported = Boolean(student.reported_at);
    const modal = document.getElementById('helpdesk-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="card" style="max-width: 600px; width: 90%; background: #131b2e; border: 2px solid #2a3b5c; border-radius: 16px; padding: 2rem; position: relative;">
        <button style="position: absolute; top: 15px; right: 20px; background: transparent; border: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer;" onclick="document.getElementById('helpdesk-modal').style.display = 'none'">&times;</button>
        
        <div style="display: flex; gap: 1.5rem; align-items: center; margin-bottom: 1.5rem;">
          <div class="student-photo-frame" style="width: 90px; height: 90px; margin-bottom: 0;">
            <img src="${student.photo_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(student.student_name)}" alt="">
          </div>
          <div>
            <div class="pass-seq-tag" style="margin-bottom: 0.35rem;">CONVOCATION SEQ #${student.sequence_no}</div>
            <h2 style="font-size: 1.35rem; font-weight: 800; color: #fff;">${student.student_name}</h2>
            <div style="color: #d4af37; font-size: 0.9rem; font-weight: 600;">${student.programme_degree}</div>
            <div style="color: #94a3b8; font-size: 0.82rem; font-family: monospace;">PRN: ${student.prn_reg_id}</div>
          </div>
        </div>

        <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.88rem;">
          <div style="margin-bottom: 0.35rem;"><strong>School:</strong> ${student.school_institute}</div>
          <div style="margin-bottom: 0.35rem;"><strong>Email / Mobile:</strong> ${student.email || 'N/A'} | ${student.mobile || 'N/A'}</div>
          <div><strong>Reporting Status:</strong> ${isReported ? `Reported at ${student.reported_at} (${student.reported_desk || 'Desk'})` : '<span style="color: #ef4444; font-weight: 700;">NOT REPORTED</span>'}</div>
        </div>

        ${!isReported ? `
          <div style="border-top: 1px solid #232f48; padding-top: 1.25rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem; color: #d4af37;">Manual Reporting Authorization</h4>
            <div class="form-group">
              <label class="form-label">Mandatory Verification Reason *</label>
              <select id="helpdesk-override-reason" class="form-control" style="margin-bottom: 0.75rem;">
                <option value="Damaged / Unreadable QR code (Student ID Verified)">Damaged / Unreadable QR code (Student ID Verified)</option>
                <option value="Student forgot QR pass / Mobile battery dead (Govt ID Verified)">Student forgot QR pass / Mobile battery dead (Govt ID Verified)</option>
                <option value="Late registration addition (Admin Approved)">Late registration addition (Admin Approved)</option>
                <option value="Custom Reason">Custom Reason...</option>
              </select>
              <input type="text" id="helpdesk-custom-reason" class="form-control" placeholder="Enter custom reason if selected above..." style="display: none;">
            </div>
            
            <button class="btn btn-primary" style="width: 100%;" onclick="window.helpdeskController.submitManualReport(${student.id})">
              ✓ Authorize & Mark Reported
            </button>
          </div>
        ` : `
          <div class="status-banner success">
            ✓ Student is already verified and marked as reported.
          </div>
        `}
      </div>
    `;

    const reasonSelect = document.getElementById('helpdesk-override-reason');
    const customReasonInput = document.getElementById('helpdesk-custom-reason');
    if (reasonSelect && customReasonInput) {
      reasonSelect.addEventListener('change', () => {
        customReasonInput.style.display = reasonSelect.value === 'Custom Reason' ? 'block' : 'none';
      });
    }
  }

  async submitManualReport(studentId) {
    const reasonSelect = document.getElementById('helpdesk-override-reason');
    const customReason = document.getElementById('helpdesk-custom-reason');
    let reason = reasonSelect.value;
    if (reason === 'Custom Reason') {
      reason = customReason.value.trim() || 'Manual Help Desk verification';
    }

    const deskId = window.app.currentUser.desk_id || 'HELP-DESK';
    const operatorId = window.app.currentUser.id || 1;

    try {
      const res = await fetch('/api/reporting/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: this.selectedStudent.qr_token || this.selectedStudent.prn_reg_id,
          deskId,
          operatorId,
          isManual: true,
          overrideReason: reason
        })
      });

      const data = await res.json();
      if (res.status === 200) {
        window.soundFX?.playSuccess();
        window.app.showToast(`Student marked REPORTED manually`, 'success');
        document.getElementById('helpdesk-modal').style.display = 'none';
        this.searchStudents(this.selectedStudent.prn_reg_id);
      } else {
        alert(data.message || 'Failed to mark reported');
      }
    } catch (e) {
      console.error('Manual report failed:', e);
    }
  }
}

window.helpdeskController = new HelpDeskController();
