// HENORDLE / RETRO WORDLE ENGINE
// -----------------------------------------------------------------
const WORDLE_TARGET_WORDS = [
  'CYBER', 'ROBOT', 'PIXEL', 'AGENT', 'LOGIC', 'STACK', 'CLOUD', 'MODEL', 'SMART',
  'BRAIN', 'BUILD', 'GAMES', 'RETRO', 'POWER', 'FLASH', 'CHIPS', 'DRIVE', 'MOUSE',
  'NODES', 'BYTES', 'SPACE', 'SPEED', 'SOLVE', 'ALPHA', 'PRIME', 'SWIFT', 'TRACK',
  'SHARP', 'LIGHT', 'SUPER', 'DREAM', 'MAGIC', 'SOUND', 'WORLD', 'RADIO', 'VIDEO',
  'CLEAN', 'CRACK', 'SPARK', 'QUERY', 'PARSE', 'PATCH', 'SHIFT', 'INPUT', 'TOKEN',
  'GRAPH', 'BLOCK', 'CHAIN', 'ARRAY', 'REACT', 'LINUX', 'FRAME', 'SCOPE', 'EVENT',
  'CLICK', 'ROUTE', 'SERVE', 'PROXY', 'ASYNC', 'AWAIT', 'FETCH', 'INDEX', 'VALUE',
  'TIMER', 'MODAL', 'PANEL', 'BOARD', 'TILES', 'SCORE', 'LEVEL', 'QUEST', 'MATCH',
  'PIECE', 'SHAPE', 'FLOAT', 'POINT', 'SCALE', 'DEPTH', 'IMAGE', 'MUSIC', 'AUDIO',
  'VOICE', 'ALERT', 'POPUP', 'GLYPH', 'FONTS', 'THEME', 'STYLE', 'COLOR', 'WHITE',
  'BLACK', 'GREEN', 'BLUES', 'AMBER', 'NEONS', 'LASER', 'RADAR', 'ORBIT', 'SOLAR',
  'LUNAR', 'EARTH', 'STARS', 'COMET', 'NEXUS', 'TURBO', 'CRAFT', 'SKILL', 'LEARN',
  'CODED', 'CODER', 'DEEPA', 'HEART', 'SMILE', 'HAPPY', 'LUCKY', 'GREAT', 'GRAND',
  'BRAVE', 'SHINE', 'GLOWS', 'FLAME', 'RAPID', 'FORCE', 'FOCUS', 'PRIDE'
];

function pickRandomHenordleWord() {
  const idx = Math.floor(Math.random() * WORDLE_TARGET_WORDS.length);
  return WORDLE_TARGET_WORDS[idx].toUpperCase();
}

let henordleSecret = pickRandomHenordleWord();
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
  if (henordleGuesses.length === 0 && !henordleGameOver) {
    henordleSecret = pickRandomHenordleWord();
  }
  renderHenordleBoard();
  renderHenordleKeyboard();
  try {
    window.focus();
  } catch (err) {}
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

        if (letter === henordleSecret[c]) {
          tile.classList.add('correct');
        } else if (henordleSecret.includes(letter)) {
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
      if (henordleSecret[i] === char) {
        letterStatus[char] = 'correct';
      } else if (henordleSecret.includes(char)) {
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
      const secretLower = henordleSecret.toLowerCase();
      const isSecret = lower === secretLower;
      const isSpecialWord = lower === 'cyber' || lower === 'deepa' || lower === 'deepak';
      const isTargetWord = WORDLE_TARGET_WORDS.includes(henordleCurrentGuess);
      const inDict = Boolean(window.WORDLE_WORDS && window.WORDLE_WORDS.has(lower));
      const valid = isSecret || isSpecialWord || isTargetWord || inDict;

      if (!valid) {
        shakeHenordleRow(henordleGuesses.length);
        return;
      }

      henordleGuesses.push(henordleCurrentGuess);
      if (henordleCurrentGuess === henordleSecret) {
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

  const tries = henordleGuesses.length;

  if (henordleWon) {
    const praises = [
      '🏆 PURE GENIUS! Solved in 1 attempt! Are you psychic?!',
      '⚡ MAGNIFICENT! Cracked in just 2 attempts! Cyber prodigy!',
      '🎉 OUTSTANDING! Solved in 3 attempts! Elite logic!',
      '✨ GREAT JOB! Decoded in 4 attempts! Solid engineering!',
      '👍 WELL PLAYED! Cracked in 5 attempts! Good hustle!',
      '😅 NARROW ESCAPE! Solved on the 6th and final attempt!'
    ];
    title.textContent = `⭐ YOU WON! (${tries}/6)`;
    title.style.color = '#2e7d32';
    msg.innerHTML = `<strong>${praises[tries - 1] || 'Victory!'}</strong><br><span style="color:#555; font-size:14px; margin-top:6px; display:inline-block;">The secret word was indeed <strong>${henordleSecret}</strong>.</span>`;
  } else {
    title.textContent = '💀 SYSTEM OVERLOAD';
    title.style.color = '#c62828';
    msg.innerHTML = `<strong>Out of tries!</strong><br><span style="color:#444; font-size:14px; margin-top:6px; display:inline-block;">The correct word was <strong>${henordleSecret}</strong>.<br>Don't let the mainframe win—reboot and try again!</span>`;
  }

  if (winRow) {
    winRow.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const tile = document.createElement('div');
      tile.className = 'wordle-tile correct';
      tile.textContent = henordleSecret[i];
      winRow.appendChild(tile);
    }
  }

  modal.style.display = 'flex';
}

function restartHenordle() {
  henordleSecret = pickRandomHenordleWord();
  henordleGuesses = [];
  henordleCurrentGuess = '';
  henordleGameOver = false;
  henordleWon = false;
  const modal = document.getElementById('wordle-modal');
  if (modal) modal.style.display = 'none';
  renderHenordleBoard();
  renderHenordleKeyboard();
  try {
    window.focus();
  } catch (err) {}
}

let lastProcessedKey = '';
let lastProcessedKeyTime = 0;

function handleWordleKey(key, isRepeat = false) {
  if (isRepeat) return; // Prevent OS key hold repeat glitches

  const now = Date.now();
  // Deduplicate identical keystrokes arriving within 90ms (from double event triggers)
  if (key === lastProcessedKey && (now - lastProcessedKeyTime) < 90) {
    return;
  }
  lastProcessedKey = key;
  lastProcessedKeyTime = now;

  const henWin = document.getElementById('win-henordle');
  if (!henWin || henWin.style.display === 'none' || henWin.classList.contains('minimized')) return;

  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
    return;
  }

  if (key === 'Backspace' || key === 'DEL') {
    onHenordleKeyInput('DEL');
  } else if (key === 'Enter' || key === 'RET') {
    onHenordleKeyInput('RET');
  } else if (key && key.length === 1 && /^[a-zA-Z]$/.test(key)) {
    onHenordleKeyInput(key.toUpperCase());
  }
}

// Global key listener inside iframe
window.addEventListener('keydown', (e) => {
  handleWordleKey(e.key, e.repeat);
});

// Bridge listener in case keystroke was forwarded from parent window
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'PARENT_KEYDOWN' && e.data.key) {
    handleWordleKey(e.data.key, false);
  }
});
