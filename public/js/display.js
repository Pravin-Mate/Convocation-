// 16:9 Live Public Stage LED Display Engine

class DisplayController {
  constructor() {
    this.container = null;
    this.currentState = { mode: 'HOLDING', currentStudent: null };
    this.branding = {};
    this.isFullscreen = false;
  }

  init() {
    this.container = document.getElementById('view-display');
    this.loadCurrentDisplay();

    if (window.app.socket) {
      window.app.socket.on('display:slide_update', (state) => {
        this.currentState = state;
        this.render();
      });
    }

    // Backup polling every 3s in case socket drops
    setInterval(() => {
      if (window.app.currentView === 'display') {
        this.loadCurrentDisplay();
      }
    }, 3000);

    // Double click or 'F' key toggles browser native fullscreen
    window.addEventListener('keydown', (e) => {
      if (window.app.currentView === 'display' && (e.key === 'f' || e.key === 'F')) {
        this.toggleFullscreen();
      }
    });
  }

  async loadCurrentDisplay() {
    try {
      const res = await fetch('/api/display/current');
      const data = await res.json();
      if (data.success) {
        this.currentState = data.stageState;
        this.branding = data.branding;
        this.render();
      }
    } catch (e) {
      console.error('Display sync failed:', e);
    }
  }

  enterDisplayMode() {
    this.loadCurrentDisplay();
  }

  exitDisplayMode() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err));
    } else {
      document.exitFullscreen().catch(err => console.warn(err));
    }
  }

  render() {
    if (!this.container) return;

    const univName = this.branding.university_name || 'APEX UNIVERSITY';
    const eventTitle = this.branding.event_title || '15th Annual Convocation 2026';
    const holdingTitle = this.branding.holding_title || 'APEX UNIVERSITY CONVOCATION 2026';
    const holdingSub = this.branding.holding_subtitle || 'Welcome Distinguished Guests, Faculty, and Graduating Students';

    let bodyHtml = '';

    if (this.currentState.mode === 'STUDENT' && this.currentState.currentStudent) {
      const s = this.currentState.currentStudent;
      bodyHtml = `
        <div class="led-student-body">
          <div class="led-student-photo-box">
            <img src="${s.photo_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(s.student_name)}" alt="">
          </div>
          <div class="led-student-info">
            <div class="led-student-name">${s.student_name}</div>
            <div class="led-student-degree">${s.programme_degree}</div>
            <div class="led-student-school">${s.school_institute}${s.specialization ? ' • ' + s.specialization : ''}</div>
            ${s.award_medal ? `<div class="led-student-award">${s.award_medal}</div>` : ''}
          </div>
        </div>
      `;
    } else {
      // University Neutral Holding Slide
      bodyHtml = `
        <div class="led-holding-body">
          <div class="led-crest-giant">
            <img src="/assets/images/LogoMGM.svg" alt="MGM University Logo">
          </div>
          <h1 class="led-holding-h1">${holdingTitle}</h1>
          <h2 class="led-holding-h2">${holdingSub}</h2>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="led-display-container" onclick="window.displayController.toggleFullscreen()">
        <div class="led-header">
          <div style="display: flex; align-items: center; gap: 1.5rem;">
            <div style="width: 120px; height: 72px; background: rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 12px; border: 1.5px solid rgba(212,175,55,0.6); box-shadow: 0 0 20px rgba(212,175,55,0.35);">
              <img src="/assets/images/LogoMGM.svg" alt="MGM Logo" style="width:100%; height:100%; object-fit:contain; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.6));">
            </div>
            <div>
              <div class="led-univ-title">${univName}</div>
              <div class="led-event-subtitle">${eventTitle}</div>
            </div>
          </div>
          <div style="font-family: 'Playfair Display', serif; font-size: 1.4rem; color: #d4af37; letter-spacing: 2px;">
            🎓 DEGREE CONFERRAL
          </div>
        </div>

        ${bodyHtml}

        <div class="led-footer">
          <div>MGM UNIVERSITY CONVOCATION CEREMONY</div>
          <div>CEREMONY LIVE BROADCAST</div>
        </div>
      </div>
    `;
  }
}

window.displayController = new DisplayController();
