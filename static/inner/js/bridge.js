// 1. PostMessage Mouse & Keyboard Events to Parent 3D Scene
    window.onload = () => {
      window.addEventListener('mousemove', (event) => {
        window.parent.postMessage({ clientX: event.clientX, clientY: event.clientY, type: 'mousemove' }, '*');
      });
      window.addEventListener('mousedown', (event) => {
        window.parent.postMessage({ type: 'mousedown' }, '*');
      });
      window.addEventListener('mouseup', (event) => {
        window.parent.postMessage({ type: 'mouseup' }, '*');
      });
      window.addEventListener('keydown', (event) => {
        window.parent.postMessage({ type: 'keydown', key: event.key }, '*');
      });
      window.addEventListener('keyup', (event) => {
        window.parent.postMessage({ type: 'keyup', key: event.key }, '*');
      });
    };

    // 2. Real-time Clock
    function updateSystemTime() {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strMinutes = minutes < 10 ? '0' + minutes : minutes;
      const timeElem = document.getElementById('system-time');
      if (timeElem) {
        timeElem.innerText = hours + ':' + strMinutes + ' ' + ampm;
      }
    }
    setInterval(updateSystemTime, 2000);
    updateSystemTime();

    // 3. Desktop Shortcut Selection & Double-Click
    let lastClickedShortcut = null;
    let clickTimer = null;

    function handleShortcutClick(appKey, elem) {
      const wasSelected = elem.classList.contains('selected');

      document.querySelectorAll('.desktop-shortcut').forEach(sc => {
        sc.classList.remove('selected');
        const txt = sc.querySelector('.shortcut-text-container');
        if (txt) txt.classList.remove('selected-shortcut-border');
      });

      elem.classList.add('selected');
      const textCont = elem.querySelector('.shortcut-text-container');
      if (textCont) textCont.classList.add('selected-shortcut-border');

      if (lastClickedShortcut === appKey || wasSelected) {
        openWindow(appKey);
        lastClickedShortcut = null;
        if (clickTimer) clearTimeout(clickTimer);
      } else {
        lastClickedShortcut = appKey;
        clickTimer = setTimeout(() => {
          lastClickedShortcut = null;
        }, 500);
      }
    }

    // -----------------------------------------------------------------
