let topZIndex = 200;
    const windowRegistry = {
      showcase: { id: 'win-showcase', tabId: 'tab-showcase', open: true, minimized: false },
      byte: { id: 'win-byte', tabId: 'tab-byte', open: false, minimized: false },
      credits: { id: 'win-credits', tabId: 'tab-credits', open: false, minimized: false },
      henordle: { id: 'win-henordle', tabId: 'tab-henordle', open: false, minimized: false },
      minesweeper: { id: 'win-minesweeper', tabId: 'tab-minesweeper', open: false, minimized: false },
      paint: { id: 'win-paint', tabId: 'tab-paint', open: false, minimized: false },
      tetris: { id: 'win-tetris', tabId: 'tab-tetris', open: false, minimized: false },
    };

    function focusWindow(appKey) {
      const winData = windowRegistry[appKey];
      if (!winData) return;
      const win = document.getElementById(winData.id);
      if (!win) return;

      topZIndex++;
      win.style.zIndex = topZIndex;

      document.querySelectorAll('.os-window').forEach(w => w.classList.remove('active'));
      win.classList.add('active');

      document.querySelectorAll('.toolbar-tab-outer').forEach(t => t.classList.remove('active'));
      const tab = document.getElementById(winData.tabId);
      if (tab) tab.classList.add('active');
    }

    function openWindow(appKey) {
      const winData = windowRegistry[appKey];
      if (!winData) return;

      const win = document.getElementById(winData.id);
      if (win) {
        if (win.style.display !== 'flex') {
          win.style.display = 'flex';
        }
        win.classList.remove('minimized');
      }

      const tab = document.getElementById(winData.tabId);
      if (tab) tab.style.display = 'flex';

      winData.open = true;
      winData.minimized = false;
      focusWindow(appKey);

      // Launch application runtimes
      if (appKey === 'byte') {
        initByteApp();
      } else if (appKey === 'minesweeper') {
        initMinesweeper();
      } else if (appKey === 'paint') {
        initPaint();
      } else if (appKey === 'tetris') {
        initTetris();
      } else if (appKey === 'henordle') {
        initHenordle();
      } else if (appKey === 'credits') {
        initCredits();
      }
    }

    function closeWindow(appKey) {
      const winData = windowRegistry[appKey];
      if (!winData) return;

      const win = document.getElementById(winData.id);
      if (win) win.style.display = 'none';

      const tab = document.getElementById(winData.tabId);
      if (tab) tab.style.display = 'none';

      winData.open = false;
      winData.minimized = false;

      // Clean up application runtimes
      if (appKey === 'tetris') {
        if (tetrisDropTimer) clearInterval(tetrisDropTimer);
      } else if (appKey === 'minesweeper') {
        if (msTimerInterval) clearInterval(msTimerInterval);
      } else if (appKey === 'credits') {
        stopCredits();
      }
    }

    function minimizeWindow(appKey) {
      const winData = windowRegistry[appKey];
      if (!winData) return;

      const win = document.getElementById(winData.id);
      if (win) {
        win.style.display = 'none';
        win.classList.add('minimized');
      }

      const tab = document.getElementById(winData.tabId);
      if (tab) tab.classList.remove('active');

      winData.minimized = true;
    }

    function toggleWindowMinimize(appKey) {
      const winData = windowRegistry[appKey];
      if (!winData) return;

      if (winData.minimized) {
        const win = document.getElementById(winData.id);
        if (win) {
          win.style.display = 'flex';
          win.classList.remove('minimized');
        }
        winData.minimized = false;
        focusWindow(appKey);
      } else {
        const win = document.getElementById(winData.id);
        if (win && win.classList.contains('active')) {
          minimizeWindow(appKey);
        } else {
          focusWindow(appKey);
        }
      }
    }

    function maximizeWindow(appKey) {
      const winData = windowRegistry[appKey];
      if (!winData) return;
      const win = document.getElementById(winData.id);
      if (!win) return;

      if (win.dataset.maximized === 'true') {
        win.style.top = win.dataset.prevTop || '24px';
        win.style.left = win.dataset.prevLeft || '140px';
        win.style.width = win.dataset.prevWidth || '800px';
        win.style.height = win.dataset.prevHeight || '575px';
        win.dataset.maximized = 'false';
      } else {
        win.dataset.prevTop = win.style.top;
        win.dataset.prevLeft = win.style.left;
        win.dataset.prevWidth = win.style.width;
        win.dataset.prevHeight = win.style.height;
        win.style.top = '0px';
        win.style.left = '0px';
        win.style.width = '100vw';
        win.style.height = 'calc(100vh - 32px)';
        win.dataset.maximized = 'true';
      }
      focusWindow(appKey);
    }

    // 5. Showcase Internal Navigation (Home vs Subpages with Vertical Navbar)
    function navToShowcasePage(pageKey) {
      const homeView = document.getElementById('showcase-home');
      const subpageView = document.getElementById('showcase-subpage');
      const scrollContainer = document.getElementById('subpage-scroll-container');

      if (pageKey === 'home') {
        if (homeView) homeView.style.display = 'flex';
        if (subpageView) subpageView.style.display = 'none';
        return;
      }

      if (homeView) homeView.style.display = 'none';
      if (subpageView) subpageView.style.display = 'flex';

      // Hide all subpages
      ['about', 'experience', 'projects', 'certificates', 'contact'].forEach(p => {
        const el = document.getElementById('page-' + p);
        if (el) el.style.display = 'none';

        const navItem = document.getElementById('nav-' + p);
        if (navItem) {
          navItem.classList.remove('active');
          const ind = navItem.querySelector('.here-indicator');
          if (ind) ind.style.display = 'none';
        }
      });

      // Show selected subpage
      const targetPage = document.getElementById('page-' + pageKey);
      if (targetPage) targetPage.style.display = 'block';

      const activeNav = document.getElementById('nav-' + pageKey);
      if (activeNav) {
        activeNav.classList.add('active');
        const ind = activeNav.querySelector('.here-indicator');
        if (ind) ind.style.display = 'block';
      }

      // Show / hide projects inset links
      const projInset = document.getElementById('projects-inset');
      if (projInset) {
        projInset.style.display = (pageKey === 'projects') ? 'flex' : 'none';
      }

      if (scrollContainer) scrollContainer.scrollTop = 0;
      focusWindow('showcase');
    }

    function scrollSection(sectionId) {
      const el = document.getElementById(sectionId);
      const container = document.getElementById('subpage-scroll-container');
      if (el && container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetScrollTop = container.scrollTop + (elRect.top - containerRect.top) - 16;
        container.scrollTop = Math.max(0, targetScrollTop);
      }
    }

    // 6. Start Menu Toggle
    function toggleStartMenu() {
      const sm = document.getElementById('start-menu');
      const startBtn = document.getElementById('start-container-outer');
      if (!sm) return;

      if (sm.style.display === 'flex') {
        sm.style.display = 'none';
        if (startBtn) startBtn.classList.remove('active');
      } else {
        sm.style.display = 'flex';
        if (startBtn) startBtn.classList.add('active');
      }
    }

    document.addEventListener('mousedown', (e) => {
      const sm = document.getElementById('start-menu');
      const startBtn = document.getElementById('start-container-outer');
      if (sm && sm.style.display === 'flex') {
        if (!sm.contains(e.target) && !startBtn.contains(e.target)) {
          sm.style.display = 'none';
          if (startBtn) startBtn.classList.remove('active');
        }
      }
    });

    // 7. Window Dragging Logic
    let draggingWin = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let winStartLeft = 0;
    let winStartTop = 0;

    function startWindowDrag(e, winId) {
      e.preventDefault();
      draggingWin = document.getElementById(winId);
      if (!draggingWin) return;

      const appKey = Object.keys(windowRegistry).find(k => windowRegistry[k].id === winId);
      if (appKey) focusWindow(appKey);

      dragStartX = e.clientX;
      dragStartY = e.clientY;
      winStartLeft = parseInt(draggingWin.style.left, 10) || 0;
      winStartTop = parseInt(draggingWin.style.top, 10) || 0;

      document.addEventListener('mousemove', onWindowDrag);
      document.addEventListener('mouseup', stopWindowDrag);
    }

    function onWindowDrag(e) {
      if (!draggingWin) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      draggingWin.style.left = (winStartLeft + dx) + 'px';
      draggingWin.style.top = (winStartTop + dy) + 'px';
    }

    function stopWindowDrag() {
      draggingWin = null;
      document.removeEventListener('mousemove', onWindowDrag);
      document.removeEventListener('mouseup', stopWindowDrag);
    }

    // 8. Contact Form Validation & Submission
    function validateContactForm() {
      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const msg = document.getElementById('contact-message').value.trim();
      const btn = document.getElementById('contact-submit-btn');
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (name.length > 0 && validEmail && msg.length > 0) {
        btn.disabled = false;
      } else {
        btn.disabled = true;
      }
    }

    function submitContactForm() {
      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const msg = document.getElementById('contact-message').value.trim();
      const status = document.getElementById('contact-status');

      status.style.color = '#0000a3';
      status.innerText = 'Transmitting message...';

      setTimeout(() => {
        status.style.color = 'green';
        status.innerText = `Message received! Thank you ${name}, I will respond shortly.`;
        document.getElementById('contact-name').value = '';
        document.getElementById('contact-email').value = '';
        document.getElementById('contact-company').value = '';
        document.getElementById('contact-message').value = '';
        document.getElementById('contact-submit-btn').disabled = true;
      }, 700);
    }

    let soundMuted = false;
    function toggleMuteSound() {
      soundMuted = !soundMuted;
      const volImg = document.querySelector('#tray-clock img');
      if (volImg) {
        volImg.src = soundMuted ? './assets/icons/volumeOff.png' : './assets/icons/volumeOn.png';
      }
    }

    // Attach click-to-focus to all windows
    function attachWindowFocusListeners() {
      document.querySelectorAll('.os-window').forEach(win => {
        win.addEventListener('mousedown', () => {
          const appKey = Object.keys(windowRegistry).find(k => windowRegistry[k].id === win.id);
          if (appKey) focusWindow(appKey);
        });
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachWindowFocusListeners);
    } else {
      attachWindowFocusListeners();
    }

    // -----------------------------------------------------------------

    // ══════════════════════════════════════════════════════════════
    // TACTILE WEB AUDIO MOUSE CLICK SOUND ENGINE
    // Provides tactile acoustic feedback on physical mouse switches
    // ══════════════════════════════════════════════════════════════
    let winAudioCtx = null;
    function getWinAudioContext() {
      if (!winAudioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          winAudioCtx = new AudioCtx();
        }
      }
      if (winAudioCtx && winAudioCtx.state === 'suspended') {
        winAudioCtx.resume().catch(() => {});
      }
      return winAudioCtx;
    }

    function playTactileClick(isDown) {
      if (typeof soundMuted !== 'undefined' && soundMuted) return;
      try {
        const ctx = getWinAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(isDown ? 2200 : 1600, now);
        filter.Q.setValueAtTime(3.0, now);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isDown ? 1900 : 1300, now);
        osc.frequency.exponentialRampToValueAtTime(isDown ? 200 : 250, now + (isDown ? 0.012 : 0.008));

        gain.gain.setValueAtTime(isDown ? 0.16 : 0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + (isDown ? 0.014 : 0.009));

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + (isDown ? 0.015 : 0.010));
      } catch (e) {}
    }

    window.addEventListener('mousedown', function() {
      playTactileClick(true);
    }, { passive: true });

    window.addEventListener('mouseup', function() {
      playTactileClick(false);
    }, { passive: true });
