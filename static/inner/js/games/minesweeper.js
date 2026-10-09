// MINESWEEPER 95 ENGINE
    // -----------------------------------------------------------------
    const MS_ROWS = 9;
    const MS_COLS = 9;
    const MS_TOTAL_MINES = 10;

    let msBoard = [];
    let msStarted = false;
    let msGameOver = false;
    let msTimerVal = 0;
    let msTimerInterval = null;
    let msFlagsLeft = MS_TOTAL_MINES;

    function initMinesweeper() {
      restartMinesweeper();
    }

    function restartMinesweeper() {
      if (msTimerInterval) clearInterval(msTimerInterval);
      msTimerInterval = null;
      msStarted = false;
      msGameOver = false;
      msTimerVal = 0;
      msFlagsLeft = MS_TOTAL_MINES;
      updateMsDisplays();
      setMsSmiley('🙂');

      msBoard = [];
      for (let r = 0; r < MS_ROWS; r++) {
        const row = [];
        for (let c = 0; c < MS_COLS; c++) {
          row.push({ mine: false, revealed: false, flagged: false, count: 0 });
        }
        msBoard.push(row);
      }
      renderMsGrid();
    }

    function updateMsDisplays() {
      const flagsEl = document.getElementById('ms-mines-count');
      const timerEl = document.getElementById('ms-timer');
      if (flagsEl) {
        const displayVal = Math.max(-99, Math.min(999, msFlagsLeft));
        flagsEl.textContent = displayVal < 0 
          ? '-' + String(Math.abs(displayVal)).padStart(2, '0')
          : String(displayVal).padStart(3, '0');
      }
      if (timerEl) {
        timerEl.textContent = String(Math.min(999, msTimerVal)).padStart(3, '0');
      }
    }

    function setMsSmiley(emoji) {
      const smiley = document.getElementById('ms-smiley');
      if (smiley) smiley.textContent = emoji;
    }

    function placeMsMines(safeRow, safeCol) {
      let placed = 0;
      while (placed < MS_TOTAL_MINES) {
        const r = Math.floor(Math.random() * MS_ROWS);
        const c = Math.floor(Math.random() * MS_COLS);
        if ((r === safeRow && c === safeCol) || msBoard[r][c].mine) continue;
        msBoard[r][c].mine = true;
        placed++;
      }

      for (let r = 0; r < MS_ROWS; r++) {
        for (let c = 0; c < MS_COLS; c++) {
          if (msBoard[r][c].mine) continue;
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < MS_ROWS && nc >= 0 && nc < MS_COLS && msBoard[nr][nc].mine) {
                count++;
              }
            }
          }
          msBoard[r][c].count = count;
        }
      }
    }

    function renderMsGrid() {
      const grid = document.getElementById('ms-grid');
      if (!grid) return;
      grid.innerHTML = '';

      for (let r = 0; r < MS_ROWS; r++) {
        for (let c = 0; c < MS_COLS; c++) {
          const cellData = msBoard[r][c];
          const cellEl = document.createElement('div');
          cellEl.className = 'ms-cell';
          cellEl.dataset.row = r;
          cellEl.dataset.col = c;

          if (cellData.revealed) {
            cellEl.classList.add('revealed');
            if (cellData.mine) {
              cellEl.classList.add('mine-hit');
              cellEl.textContent = '💣';
            } else if (cellData.count > 0) {
              cellEl.textContent = cellData.count;
              cellEl.dataset.val = cellData.count;
            }
          } else if (cellData.flagged) {
            cellEl.textContent = '🚩';
          }

          cellEl.onmousedown = (e) => {
            if (msGameOver) return;
            if (e.button === 0 && !cellData.revealed && !cellData.flagged) {
              setMsSmiley('😮');
            }
          };

          cellEl.onmouseup = (e) => {
            if (msGameOver) return;
            setMsSmiley('🙂');
            if (e.button === 0) {
              handleMsClick(r, c);
            } else if (e.button === 2) {
              handleMsRightClick(r, c);
            }
          };

          grid.appendChild(cellEl);
        }
      }
    }

    function handleMsClick(r, c) {
      if (msGameOver) return;
      const cell = msBoard[r][c];
      if (cell.revealed || cell.flagged) return;

      if (!msStarted) {
        msStarted = true;
        placeMsMines(r, c);
        msTimerInterval = setInterval(() => {
          msTimerVal++;
          updateMsDisplays();
          if (msTimerVal >= 999) clearInterval(msTimerInterval);
        }, 1000);
      }

      if (cell.mine) {
        msGameOver = true;
        if (msTimerInterval) clearInterval(msTimerInterval);
        setMsSmiley('😵');
        for (let row = 0; row < MS_ROWS; row++) {
          for (let col = 0; col < MS_COLS; col++) {
            if (msBoard[row][col].mine) {
              msBoard[row][col].revealed = true;
            }
          }
        }
        renderMsGrid();
        return;
      }

      revealMsCell(r, c);
      checkMsWin();
      renderMsGrid();
    }

    function revealMsCell(r, c) {
      if (r < 0 || r >= MS_ROWS || c < 0 || c >= MS_COLS) return;
      const cell = msBoard[r][c];
      if (cell.revealed || cell.flagged || cell.mine) return;

      cell.revealed = true;
      if (cell.count === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr !== 0 || dc !== 0) {
              revealMsCell(r + dr, c + dc);
            }
          }
        }
      }
    }

    function handleMsRightClick(r, c) {
      if (msGameOver) return;
      const cell = msBoard[r][c];
      if (cell.revealed) return;

      cell.flagged = !cell.flagged;
      msFlagsLeft += cell.flagged ? -1 : 1;
      updateMsDisplays();
      renderMsGrid();
    }

    function checkMsWin() {
      let unrevealedSafe = 0;
      for (let r = 0; r < MS_ROWS; r++) {
        for (let c = 0; c < MS_COLS; c++) {
          if (!msBoard[r][c].mine && !msBoard[r][c].revealed) {
            unrevealedSafe++;
          }
        }
      }
      if (unrevealedSafe === 0) {
        msGameOver = true;
        if (msTimerInterval) clearInterval(msTimerInterval);
        setMsSmiley('😎');
        msFlagsLeft = 0;
        updateMsDisplays();
      }
    }

    // -----------------------------------------------------------------
