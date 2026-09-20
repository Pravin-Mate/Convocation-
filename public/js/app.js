// Main Application Controller & Role-Gated Session Router

class App {
  constructor() {
    this.currentUser = JSON.parse(localStorage.getItem('convocation_user')) || {
      id: 1,
      username: 'admin',
      role: 'ADMIN',
      full_name: 'Prof. Dr. V.M. Patil (Dean & Convocation Convener)',
      desk_id: null,
      token: null
    };
    this.socket = null;
    this.currentView = 'dashboard';
    this.settings = {};
  }

  init() {
    this.initSocket();
    this.loadSettings();
    this.setupNavigation();
    this.updateUserBadge();
    this.filterNavByRole();

    const hash = window.location.hash.replace('#', '');
    if (hash && ['display', 'reporting', 'helpdesk', 'prestage', 'stagecontrol', 'dashboard', 'admin', 'passes'].includes(hash)) {
      this.switchView(hash);
    } else {
      this.switchView(this.getDefaultViewForRole(this.currentUser.role));
    }

    window.addEventListener('keydown', (e) => this.handleGlobalKeybindings(e));
  }

  initSocket() {
    if (typeof io !== 'undefined') {
      this.socket = io();
      this.socket.on('connect', () => {
        document.getElementById('connection-status')?.classList.remove('offline');
        console.log('✓ Connected to MGM Convocation Real-Time Server');
      });
      this.socket.on('disconnect', () => {
        document.getElementById('connection-status')?.classList.add('offline');
        console.warn('⚠️ Disconnected from MGM Convocation Server');
      });
      this.socket.on('settings:update', (newSettings) => {
        this.settings = { ...this.settings, ...newSettings };
        this.applyBranding();
      });
    }
  }

  async loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        this.settings = data.settings;
        this.applyBranding();
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }

  applyBranding() {
    const univName = this.settings.university_name || 'MGM UNIVERSITY';
    const eventTitle = this.settings.event_title || 'Convocation Ceremony 2026';
    
    document.querySelectorAll('.brand-univ-name').forEach(el => el.textContent = univName);
    document.querySelectorAll('.brand-event-title').forEach(el => el.textContent = eventTitle);
    document.title = `${univName} - ${eventTitle}`;
  }

  getDefaultViewForRole(role) {
    switch (role) {
      case 'REPORTING': return 'reporting';
      case 'HELPDESK': return 'helpdesk';
      case 'PRESTAGE': return 'prestage';
      case 'STAGECONTROL': return 'stagecontrol';
      case 'ADMIN': return 'dashboard';
      default: return 'dashboard';
    }
  }

  filterNavByRole() {
    const role = this.currentUser.role;
    document.querySelectorAll('#main-nav-links .nav-btn').forEach(btn => {
      const allowedRoles = btn.dataset.roles ? btn.dataset.roles.split(',') : [];
      if (allowedRoles.length > 0) {
        if (allowedRoles.includes(role) || role === 'ADMIN') {
          btn.style.display = 'flex';
        } else {
          btn.style.display = 'none';
        }
      }
    });
  }

  setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view) {
          this.switchView(view);
        }
      });
    });

    // Station Switcher
    document.querySelectorAll('.role-switch-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const role = btn.dataset.role;
        const username = btn.dataset.username;
        const deskId = btn.dataset.desk || null;
        const fullName = btn.dataset.fullname;

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password: 'mgm2026' })
          });
          const data = await res.json();
          if (data.success) {
            this.currentUser = {
              id: data.user.id,
              username: data.user.username,
              role: data.user.role,
              full_name: data.user.full_name,
              desk_id: data.user.desk_id,
              token: data.token
            };
            localStorage.setItem('convocation_user', JSON.stringify(this.currentUser));
            this.updateUserBadge();
            this.filterNavByRole();
            this.switchView(this.getDefaultViewForRole(role));
            this.showToast(`Switched operator station to ${role} (${fullName})`, 'success');
          }
        } catch (err) {
          console.warn('Switch failed:', err);
        }
      });
    });
  }

  updateUserBadge() {
    const roleBadge = document.getElementById('current-user-role');
    const nameBadge = document.getElementById('current-user-name');
    if (roleBadge) roleBadge.textContent = this.currentUser.role + (this.currentUser.desk_id ? ` [${this.currentUser.desk_id}]` : '');
    if (nameBadge) nameBadge.textContent = this.currentUser.full_name;
  }

  switchView(viewName) {
    this.currentView = viewName;
    window.location.hash = viewName;

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.add('active');
    }

    const navbar = document.querySelector('.app-navbar');
    if (viewName === 'display') {
      if (navbar) navbar.style.display = 'none';
      window.displayController?.enterDisplayMode();
    } else {
      if (navbar) navbar.style.display = 'flex';
      window.displayController?.exitDisplayMode();
    }

    if (viewName === 'reporting') window.reportingController?.init();
    if (viewName === 'helpdesk') window.helpdeskController?.init();
    if (viewName === 'prestage') window.prestageController?.init();
    if (viewName === 'stagecontrol') window.stageController?.init();
    if (viewName === 'dashboard') window.dashboardController?.init();
    if (viewName === 'admin') window.adminController?.init();
    if (viewName === 'passes') window.adminController?.loadPasses();
  }

  handleGlobalKeybindings(e) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    if (e.key === 'd' || e.key === 'D') {
      if (e.ctrlKey || e.altKey) {
        e.preventDefault();
        this.switchView('display');
      }
    }
  }

  logout() {
    if (this.currentUser.token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.currentUser.token })
      }).catch(() => {});
    }
    document.getElementById('role-switcher-modal').style.display = 'flex';
    this.showToast('Logged out of station', 'info');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || this.createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  createToastContainer() {
    const c = document.createElement('div');
    c.id = 'toast-container';
    c.style.position = 'fixed';
    c.style.bottom = '20px';
    c.style.right = '20px';
    c.style.zIndex = '99999';
    c.style.display = 'flex';
    c.style.flexDirection = 'column';
    c.style.gap = '10px';
    document.body.appendChild(c);
    return c;
  }
}

window.app = new App();
document.addEventListener('DOMContentLoaded', () => window.app.init());
