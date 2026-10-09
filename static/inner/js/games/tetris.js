// TETRIS 95 ENGINE
    // -----------------------------------------------------------------
    const TETRIS_ROWS = 20;
    const TETRIS_COLS = 10;
    const TETRIS_BLOCK_SIZE = 20;

    const SHAPES = {
      I: [[1, 1, 1, 1]],
      J: [[1, 0, 0], [1, 1, 1]],
      L: [[0, 0, 1], [1, 1, 1]],
      O: [[1, 1], [1, 1]],
      S: [[0, 1, 1], [1, 1, 0]],
      T: [[0, 1, 0], [1, 1, 1]],
      Z: [[1, 1, 0], [0, 1, 1]]
    };

    const SHAPE_COLORS = {
      I: '#00ffff',
      J: '#0000ff',
      L: '#ffaa00',
      O: '#ffff00',
      S: '#00ff00',
      T: '#aa00ff',
      Z: '#ff0000'
    };

    let tetrisGrid = [];
    let tetrisPiece = null;
    let tetrisNextPiece = null;
    let tetrisPieceX = 0;
    let tetrisPieceY = 0;
    let tetrisScore = 0;
    let tetrisLines = 0;
    let tetrisLevel = 1;
    let tetrisGameOver = false;
    let tetrisPaused = false;
    let tetrisDropTimer = null;
    let tetrisDropInterval = 650;

    function initTetris() {
      restartTetris();
    }

    function createTetrisGrid() {
      const g = [];
      for (let r = 0; r < TETRIS_ROWS; r++) {
        g.push(new Array(TETRIS_COLS).fill(0));
      }
      return g;
    }

    function randomTetrisPiece() {
      const keys = Object.keys(SHAPES);
      const shapeType = keys[Math.floor(Math.random() * keys.length)];
      return {
        type: shapeType,
        matrix: SHAPES[shapeType].map(row => [...row]),
        color: SHAPE_COLORS[shapeType]
      };
    }

    function restartTetris() {
      if (tetrisDropTimer) clearInterval(tetrisDropTimer);
      tetrisGrid = createTetrisGrid();
      tetrisScore = 0;
      tetrisLines = 0;
      tetrisLevel = 1;
      tetrisGameOver = false;
      tetrisPaused = false;
      tetrisDropInterval = 650;

      updateTetrisPanels();
      tetrisNextPiece = randomTetrisPiece();
      spawnTetrisPiece();

      drawTetrisBoard();
      drawTetrisNext();

      tetrisDropTimer = setInterval(tickTetris, tetrisDropInterval);
    }

    function spawnTetrisPiece() {
      tetrisPiece = tetrisNextPiece || randomTetrisPiece();
      tetrisNextPiece = randomTetrisPiece();
      tetrisPieceY = 0;
      tetrisPieceX = Math.floor((TETRIS_COLS - tetrisPiece.matrix[0].length) / 2);

      if (checkTetrisCollision(tetrisPiece.matrix, tetrisPieceX, tetrisPieceY)) {
        tetrisGameOver = true;
        if (tetrisDropTimer) clearInterval(tetrisDropTimer);
        const status = document.getElementById('tetris-status-text');
        if (status) status.textContent = 'GAME OVER! Final Score: ' + tetrisScore + '. Click Restart!';
      }

      drawTetrisNext();
    }

    function checkTetrisCollision(matrix, offsetX, offsetY) {
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c]) {
            const x = offsetX + c;
            const y = offsetY + r;
            if (x < 0 || x >= TETRIS_COLS || y >= TETRIS_ROWS) return true;
            if (y >= 0 && tetrisGrid[y][x]) return true;
          }
        }
      }
      return false;
    }

    function lockTetrisPiece() {
      for (let r = 0; r < tetrisPiece.matrix.length; r++) {
        for (let c = 0; c < tetrisPiece.matrix[r].length; c++) {
          if (tetrisPiece.matrix[r][c]) {
            const x = tetrisPieceX + c;
            const y = tetrisPieceY + r;
            if (y >= 0 && y < TETRIS_ROWS && x >= 0 && x < TETRIS_COLS) {
              tetrisGrid[y][x] = tetrisPiece.color;
            }
          }
        }
      }

      let linesCleared = 0;
      for (let r = TETRIS_ROWS - 1; r >= 0; r--) {
        if (tetrisGrid[r].every(cell => cell !== 0)) {
          tetrisGrid.splice(r, 1);
          tetrisGrid.unshift(new Array(TETRIS_COLS).fill(0));
          linesCleared++;
          r++;
        }
      }

      if (linesCleared > 0) {
        tetrisLines += linesCleared;
        const lineScores = [0, 100, 300, 500, 800];
        tetrisScore += (lineScores[linesCleared] || 800) * tetrisLevel;
        tetrisLevel = Math.floor(tetrisLines / 10) + 1;
        tetrisDropInterval = Math.max(120, 650 - (tetrisLevel - 1) * 55);

        if (tetrisDropTimer) {
          clearInterval(tetrisDropTimer);
          tetrisDropTimer = setInterval(tickTetris, tetrisDropInterval);
        }
      }

      updateTetrisPanels();
      spawnTetrisPiece();
    }

    function tickTetris() {
      if (tetrisGameOver || tetrisPaused || !tetrisPiece) return;
      if (!checkTetrisCollision(tetrisPiece.matrix, tetrisPieceX, tetrisPieceY + 1)) {
        tetrisPieceY++;
      } else {
        lockTetrisPiece();
      }
      drawTetrisBoard();
    }

    function rotateTetrisMatrix(matrix) {
      const rows = matrix.length;
      const cols = matrix[0].length;
      const result = [];
      for (let c = 0; c < cols; c++) {
        const newRow = [];
        for (let r = rows - 1; r >= 0; r--) {
          newRow.push(matrix[r][c]);
        }
        result.push(newRow);
      }
      return result;
    }

    function tetrisInput(action) {
      if (tetrisGameOver || tetrisPaused || !tetrisPiece) return;

      if (action === 'left') {
        if (!checkTetrisCollision(tetrisPiece.matrix, tetrisPieceX - 1, tetrisPieceY)) {
          tetrisPieceX--;
        }
      } else if (action === 'right') {
        if (!checkTetrisCollision(tetrisPiece.matrix, tetrisPieceX + 1, tetrisPieceY)) {
          tetrisPieceX++;
        }
      } else if (action === 'rotate') {
        const rotated = rotateTetrisMatrix(tetrisPiece.matrix);
        if (!checkTetrisCollision(rotated, tetrisPieceX, tetrisPieceY)) {
          tetrisPiece.matrix = rotated;
        } else if (!checkTetrisCollision(rotated, tetrisPieceX - 1, tetrisPieceY)) {
          tetrisPieceX--;
          tetrisPiece.matrix = rotated;
        } else if (!checkTetrisCollision(rotated, tetrisPieceX + 1, tetrisPieceY)) {
          tetrisPieceX++;
          tetrisPiece.matrix = rotated;
        }
      } else if (action === 'down') {
        if (!checkTetrisCollision(tetrisPiece.matrix, tetrisPieceX, tetrisPieceY + 1)) {
          tetrisPieceY++;
          tetrisScore += 1;
          updateTetrisPanels();
        } else {
          lockTetrisPiece();
        }
      } else if (action === 'drop') {
        let dropCount = 0;
        while (!checkTetrisCollision(tetrisPiece.matrix, tetrisPieceX, tetrisPieceY + 1)) {
          tetrisPieceY++;
          dropCount++;
        }
        tetrisScore += dropCount * 2;
        updateTetrisPanels();
        lockTetrisPiece();
      }

      drawTetrisBoard();
    }

    function togglePauseTetris() {
      tetrisPaused = !tetrisPaused;
      const status = document.getElementById('tetris-status-text');
      if (status) {
        status.textContent = tetrisPaused ? 'GAME PAUSED' : 'Tetris 95 - Arrow keys to move, Up to rotate';
      }
    }

    function updateTetrisPanels() {
      const scoreEl = document.getElementById('tetris-score');
      const linesEl = document.getElementById('tetris-lines');
      const levelEl = document.getElementById('tetris-level');
      if (scoreEl) scoreEl.textContent = tetrisScore;
      if (linesEl) linesEl.textContent = tetrisLines;
      if (levelEl) levelEl.textContent = tetrisLevel;
    }

    function drawTetrisBlock(ctx, x, y, size, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, size, size);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(x, y, size, 2);
      ctx.fillRect(x, y, 2, size);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(x, y + size - 2, size, 2);
      ctx.fillRect(x + size - 2, y, 2, size);
    }

    function drawTetrisBoard() {
      const canvas = document.getElementById('tetris-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let r = 0; r < TETRIS_ROWS; r++) {
        for (let c = 0; c < TETRIS_COLS; c++) {
          if (tetrisGrid[r][c]) {
            drawTetrisBlock(ctx, c * TETRIS_BLOCK_SIZE, r * TETRIS_BLOCK_SIZE, TETRIS_BLOCK_SIZE, tetrisGrid[r][c]);
          }
        }
      }

      if (tetrisPiece) {
        for (let r = 0; r < tetrisPiece.matrix.length; r++) {
          for (let c = 0; c < tetrisPiece.matrix[r].length; c++) {
            if (tetrisPiece.matrix[r][c]) {
              const drawX = (tetrisPieceX + c) * TETRIS_BLOCK_SIZE;
              const drawY = (tetrisPieceY + r) * TETRIS_BLOCK_SIZE;
              drawTetrisBlock(ctx, drawX, drawY, TETRIS_BLOCK_SIZE, tetrisPiece.color);
            }
          }
        }
      }

      if (tetrisGameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 20px Millennium, Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillStyle = '#ffffff';
        ctx.font = '13px MSSerif, Arial';
        ctx.fillText('Press Restart', canvas.width / 2, canvas.height / 2 + 16);
      }
    }

    function drawTetrisNext() {
      const canvas = document.getElementById('tetris-next-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!tetrisNextPiece) return;
      const matrix = tetrisNextPiece.matrix;
      const bSize = 16;
      const totalW = matrix[0].length * bSize;
      const totalH = matrix.length * bSize;
      const startX = Math.round((canvas.width - totalW) / 2);
      const startY = Math.round((canvas.height - totalH) / 2);

      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c]) {
            drawTetrisBlock(ctx, startX + c * bSize, startY + r * bSize, bSize, tetrisNextPiece.color);
          }
        }
      }
    }

    window.addEventListener('keydown', (e) => {
      const tetWin = document.getElementById('win-tetris');
      if (!tetWin || tetWin.style.display === 'none' || tetWin.classList.contains('minimized')) return;
      if (!tetWin.classList.contains('active')) return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        tetrisInput('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        tetrisInput('right');
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        tetrisInput('rotate');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        tetrisInput('down');
      } else if (e.key === ' ') {
        e.preventDefault();
        tetrisInput('drop');
      } else if (e.key === 'p' || e.key === 'P') {
        togglePauseTetris();
      }
    });

    // -----------------------------------------------------------------
