// HENORDLE / RETRO WORDLE ENGINE
    // -----------------------------------------------------------------
    const HENORDLE_SECRET = 'CYBER';
    let henordleGuesses = [];
    let henordleCurrentGuess = '';
    let henordleGameOver = false;
    let henordleWon = false;

    const KEYBOARD_ROWS = [
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
      ['RET', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
    ];

    function initHenordle() {
      renderHenordleBoard();
      renderHenordleKeyboard();
    }

    function renderHenordleBoard() {
      const board = document.getElementById('wordle-board');
      if (!board) return;
      board.innerHTML = '';

      for (let r = 0; r < 6; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'wordle-row';
        rowDiv.id = 'wordle-row-' + r;

        const isCompleted = r < henordleGuesses.length;
        const isActive = r === henordleGuesses.length && !henordleGameOver;

        for (let c = 0; c < 5; c++) {
          const tile = document.createElement('div');
          tile.className = 'wordle-tile';

          if (isCompleted) {
            const guess = henordleGuesses[r];
            const letter = guess[c];
            tile.textContent = letter;

            if (letter === HENORDLE_SECRET[c]) {
              tile.classList.add('correct');
            } else if (HENORDLE_SECRET.includes(letter)) {
              tile.classList.add('present');
            } else {
              tile.classList.add('absent');
            }
          } else if (isActive) {
            const letter = henordleCurrentGuess[c] || '';
            tile.textContent = letter;
            if (letter) tile.classList.add('filled');
          }

          rowDiv.appendChild(tile);
        }
        board.appendChild(rowDiv);
      }
    }

    function renderHenordleKeyboard() {
      const keyboard = document.getElementById('wordle-keyboard');
      if (!keyboard) return;
      keyboard.innerHTML = '';

      const letterStatus = {};
      henordleGuesses.forEach(guess => {
        for (let i = 0; i < 5; i++) {
          const char = guess[i];
          if (HENORDLE_SECRET[i] === char) {
            letterStatus[char] = 'correct';
          } else if (HENORDLE_SECRET.includes(char)) {
            if (letterStatus[char] !== 'correct') {
              letterStatus[char] = 'present';
            }
          } else {
            if (!letterStatus[char]) {
              letterStatus[char] = 'absent';
            }
          }
        }
      });

      KEYBOARD_ROWS.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'wordle-key-row';

        row.forEach(key => {
          const btn = document.createElement('div');
          btn.className = 'wordle-key';
          if (key === 'RET' || key === 'DEL') btn.classList.add('wide');
          btn.textContent = key;

          if (letterStatus[key]) {
            btn.classList.add(letterStatus[key]);
          }

          btn.onmousedown = (e) => {
            e.preventDefault();
            onHenordleKeyInput(key);
          };

          rowDiv.appendChild(btn);
        });
        keyboard.appendChild(rowDiv);
      });
    }

    function onHenordleKeyInput(key) {
      if (henordleGameOver) return;

      if (key === 'RET') {
        if (henordleCurrentGuess.length === 5) {
          const lower = henordleCurrentGuess.toLowerCase();
          const valid = (window.WORDLE_WORDS && window.WORDLE_WORDS.has(lower)) || lower === 'Deepak' || lower === 'deepa';
          if (!valid) {
            shakeHenordleRow(henordleGuesses.length);
            return;
          }

          henordleGuesses.push(henordleCurrentGuess);
          if (henordleCurrentGuess === HENORDLE_SECRET) {
            henordleWon = true;
            henordleGameOver = true;
          } else if (henordleGuesses.length >= 6) {
            henordleGameOver = true;
          }

          henordleCurrentGuess = '';
          renderHenordleBoard();
          renderHenordleKeyboard();

          if (henordleGameOver) {
            showHenordleModal();
          }
        } else {
          shakeHenordleRow(henordleGuesses.length);
        }
      } else if (key === 'DEL') {
        if (henordleCurrentGuess.length > 0) {
          henordleCurrentGuess = henordleCurrentGuess.slice(0, -1);
          renderHenordleBoard();
        }
      } else {
        if (henordleCurrentGuess.length < 5) {
          henordleCurrentGuess += key.toUpperCase();
          renderHenordleBoard();
        }
      }
    }

    function shakeHenordleRow(rowIndex) {
      const row = document.getElementById('wordle-row-' + rowIndex);
      if (row) {
        row.classList.remove('wordle-shake');
        void row.offsetWidth;
        row.classList.add('wordle-shake');
        setTimeout(() => row.classList.remove('wordle-shake'), 400);
      }
    }

    function showHenordleModal() {
      const modal = document.getElementById('wordle-modal');
      const title = document.getElementById('wordle-modal-title');
      const msg = document.getElementById('wordle-modal-message');
      const winRow = document.getElementById('wordle-winning-row');
      if (!modal) return;

      title.textContent = henordleWon ? 'You win!' : 'Game Over';
      msg.textContent = 'Thanks for playing! Remember: the word is always "Deepak"!';

      if (winRow) {
        winRow.innerHTML = '';
        for (let i = 0; i < 5; i++) {
          const tile = document.createElement('div');
          tile.className = 'wordle-tile correct';
          tile.textContent = HENORDLE_SECRET[i];
          winRow.appendChild(tile);
        }
      }

      modal.style.display = 'flex';
    }

    function restartHenordle() {
      henordleGuesses = [];
      henordleCurrentGuess = '';
      henordleGameOver = false;
      henordleWon = false;
      const modal = document.getElementById('wordle-modal');
      if (modal) modal.style.display = 'none';
      renderHenordleBoard();
      renderHenordleKeyboard();
    }

    window.addEventListener('keydown', (e) => {
      const henWin = document.getElementById('win-henordle');
      if (!henWin || henWin.style.display === 'none' || henWin.classList.contains('minimized')) return;
      if (!henWin.classList.contains('active')) return;

      if (e.key === 'Backspace') {
        onHenordleKeyInput('DEL');
      } else if (e.key === 'Enter') {
        onHenordleKeyInput('RET');
      } else if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        onHenordleKeyInput(e.key.toUpperCase());
      }
    });

    // -----------------------------------------------------------------
