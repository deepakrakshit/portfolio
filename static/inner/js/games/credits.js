// CREDITS SLIDESHOW ENGINE
    // -----------------------------------------------------------------
    const CREDITS_DATA = [
      {
        title: 'Engineering & Design',
        rows: [
          ['Deepak Rakshit', 'Full-Stack Architecture & AI Core'],
          ['Deepak Rakshit', 'Original Retro 3D Workstation Concept']
        ]
      },
      {
        title: 'Modeling & Texturing',
        rows: [
          ['Deepak Rakshit', 'Texturing, Composition, & UV'],
          ['Mickael Boitte', 'Computer Model'],
          ['Sean Nicolas', 'Environment Models']
        ]
      },
      {
        title: 'Sound Design & Ambiance',
        rows: [
          ['Deepak Rakshit', 'Mixing, Composition, & Foley'],
          ['Sound Cassette', 'Office Ambience'],
          ['Windows 95 Startup Sound', 'Microsoft Corporation']
        ]
      },
      {
        title: 'Core Technologies',
        rows: [
          ['Three.js & WebGL', 'Spatial 3D Canvas'],
          ['HTML5 Canvas & DOM', 'Zero-Lag Native Classics (60+ FPS)'],
          ['Vanilla TypeScript & CSS', 'Clean, Responsive Web UI']
        ]
      },
      {
        title: 'Special Thanks',
        rows: [
          ['Bruno Simon', 'Three.js Journey'],
          ['Google DeepMind', 'Antigravity AI Engine'],
          ['Deepak\'s Mentors & Peers', 'Continuous Support & Inspiration']
        ]
      }
    ];

    let creditSlideIndex = 0;
    let creditTimer = 0;
    let creditIntervalId = null;

    function initCredits() {
      creditSlideIndex = 0;
      creditTimer = 0;
      renderCreditSlide();
      if (creditIntervalId) clearInterval(creditIntervalId);
      creditIntervalId = setInterval(() => {
        creditTimer++;
        const dotsEl = document.getElementById('credit-timer-dots');
        if (dotsEl) {
          dotsEl.textContent = '.'.repeat((creditTimer % 6) + 1);
        }
        if (creditTimer >= 6) {
          creditTimer = 0;
          creditSlideIndex = (creditSlideIndex + 1) % CREDITS_DATA.length;
          renderCreditSlide();
        }
      }, 1000);
    }

    function nextCreditSlide() {
      creditTimer = 0;
      creditSlideIndex = (creditSlideIndex + 1) % CREDITS_DATA.length;
      renderCreditSlide();
    }

    function renderCreditSlide() {
      const slide = CREDITS_DATA[creditSlideIndex];
      const titleEl = document.getElementById('credit-slide-title');
      const rowsEl = document.getElementById('credit-slide-rows');
      if (!titleEl || !rowsEl) return;

      titleEl.textContent = slide.title;
      rowsEl.innerHTML = '';
      slide.rows.forEach(r => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'credit-row';
        rowDiv.innerHTML = `<span class="credit-name">${r[0]}</span><span class="credit-role">${r[1]}</span>`;
        rowsEl.appendChild(rowDiv);
      });
    }

    function stopCredits() {
      if (creditIntervalId) {
        clearInterval(creditIntervalId);
        creditIntervalId = null;
      }
    }

    // 4. Window Manager State & Focus
