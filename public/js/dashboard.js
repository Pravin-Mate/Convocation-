// Live Operational Dashboard & Export Controller

class DashboardController {
  constructor() {
    this.stats = null;
    this.selectedSchool = 'ALL';
    this.selectedProgramme = 'ALL';
  }

  init() {
    this.loadStats();

    if (window.app.socket) {
      window.app.socket.on('stats:update', (newStats) => {
        // If we are filtered, reload with our filter query
        if (this.selectedSchool !== 'ALL' || this.selectedProgramme !== 'ALL') {
          this.loadStats();
        } else {
          this.stats = newStats;
          this.render();
        }
      });
    }

    // Auto-refresh every 10 seconds as backup
    setInterval(() => {
      if (window.app.currentView === 'dashboard') {
        this.loadStats();
      }
    }, 10000);
  }

  async loadStats() {
    try {
      let url = '/api/dashboard/stats';
      const params = [];
      if (this.selectedSchool && this.selectedSchool !== 'ALL') {
        params.push(`school=${encodeURIComponent(this.selectedSchool)}`);
      }
      if (this.selectedProgramme && this.selectedProgramme !== 'ALL') {
        params.push(`programme=${encodeURIComponent(this.selectedProgramme)}`);
      }
      if (params.length > 0) {
        url += '?' + params.join('&');
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        this.stats = data.stats;
        this.render();
      }
    } catch (e) {
      console.error('Failed to load dashboard stats:', e);
    }
  }

  onFilterChange(school, programme) {
    if (school !== undefined) this.selectedSchool = school;
    if (programme !== undefined) this.selectedProgramme = programme;
    this.loadStats();
  }

  populateFilterDropdowns() {
    const schoolSelect = document.getElementById('dash-filter-school');
    const programmeSelect = document.getElementById('dash-filter-programme');

    if (schoolSelect && this.stats?.distinctSchools) {
      const current = this.selectedSchool;
      let html = '<option value="ALL">All Schools / Institutes</option>';
      this.stats.distinctSchools.forEach(sch => {
        html += `<option value="${sch}" ${sch === current ? 'selected' : ''}>${sch}</option>`;
      });
      schoolSelect.innerHTML = html;
    }

    if (programmeSelect && this.stats?.distinctProgrammes) {
      const current = this.selectedProgramme;
      let html = '<option value="ALL">All Programmes / Degrees</option>';
      this.stats.distinctProgrammes.forEach(prg => {
        html += `<option value="${prg}" ${prg === current ? 'selected' : ''}>${prg}</option>`;
      });
      programmeSelect.innerHTML = html;
    }
  }

  render() {
    if (!this.stats) return;

    this.populateFilterDropdowns();

    // Metrics
    const totalReg = document.getElementById('dash-total-registered');
    const totalRep = document.getElementById('dash-total-reported');
    const repPct = document.getElementById('dash-reported-pct');
    const totalAbs = document.getElementById('dash-total-absent');
    const totalLate = document.getElementById('dash-total-late');
    const totalQue = document.getElementById('dash-total-queued');
    const totalConf = document.getElementById('dash-total-conferred');

    if (totalReg) totalReg.textContent = this.stats.totalRegistered;
    if (totalRep) totalRep.textContent = this.stats.reportedCount;
    if (repPct) repPct.textContent = `${this.stats.reportingPercentage}% Reported`;
    if (totalAbs) totalAbs.textContent = this.stats.yetToReport;
    if (totalLate) totalLate.textContent = this.stats.lateCount;
    if (totalQue) totalQue.textContent = this.stats.queuedCount;
    if (totalConf) totalConf.textContent = this.stats.conferredCount;

    // School Breakdown Table
    const schoolTbody = document.getElementById('dash-school-tbody');
    if (schoolTbody && this.stats.schoolStats) {
      let html = '';
      this.stats.schoolStats.forEach(s => {
        const pct = s.registered > 0 ? ((s.reported / s.registered) * 100).toFixed(1) : 0;
        html += `
          <tr>
            <td style="font-weight: 700; color: #fff;">${s.school_institute}</td>
            <td style="font-weight: 600;">${s.registered}</td>
            <td style="color: #10b981; font-weight: 700;">${s.reported}</td>
            <td style="color: #f59e0b;">${s.late}</td>
            <td style="color: #d4af37; font-weight: 700;">${s.conferred}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="flex: 1; background: #1e293b; height: 8px; border-radius: 4px; overflow: hidden;">
                  <div style="background: var(--emerald-accent); width: ${pct}%; height: 100%;"></div>
                </div>
                <span style="font-size: 0.75rem; font-weight: 700; min-width: 40px;">${pct}%</span>
              </div>
            </td>
          </tr>
        `;
      });
      schoolTbody.innerHTML = html;
    }

    // Recent Activity Feed
    const activityContainer = document.getElementById('dash-activity-feed');
    if (activityContainer && this.stats.recentActivity) {
      let html = '';
      this.stats.recentActivity.forEach(a => {
        const time = new Date(a.timestamp).toLocaleTimeString();
        let badgeColor = '#3b82f6';
        if (a.action.includes('SUCCESS') || a.action.includes('CONFER')) badgeColor = '#10b981';
        if (a.action.includes('DUPLICATE') || a.action.includes('LATE')) badgeColor = '#f59e0b';
        if (a.action.includes('SKIP') || a.action.includes('ERROR') || a.action.includes('UNKNOWN')) badgeColor = '#ef4444';

        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;">
            <div>
              <span class="role-tag" style="background: ${badgeColor}; color: #fff; font-size: 0.68rem;">${a.action}</span>
              <span style="color: #e2e8f0; margin-left: 0.5rem; font-weight: 600;">${a.student_name ? a.student_name + ' (' + a.prn_reg_id + ')' : ''}</span>
              <div style="color: #94a3b8; font-size: 0.78rem; margin-top: 0.2rem;">${a.details || ''}</div>
            </div>
            <div style="color: #64748b; font-size: 0.75rem; font-family: monospace;">${time}</div>
          </div>
        `;
      });
      activityContainer.innerHTML = html || '<div style="color: #64748b; text-align: center; padding: 1rem;">No recent activity</div>';
    }
  }

  downloadReport(type, format = 'csv') {
    window.location.href = `/api/reports/export?type=${type}&format=${format}`;
    window.app.showToast(`Downloading ${type.toUpperCase()} report (${format.toUpperCase()})`, 'info');
  }
}

window.dashboardController = new DashboardController();
