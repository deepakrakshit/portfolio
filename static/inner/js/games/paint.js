// MS PAINT 95 ENGINE
    // -----------------------------------------------------------------
    const PAINT_PALETTE = [
      '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080',
      '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
      '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff',
      '#ffff80', '#00ff80', '#80ffff', '#7f7fff', '#ff0080', '#ff8040'
    ];

    let paintCurrentTool = 'pencil';
    let paintPrimaryColor = '#000000';
    let paintSecondaryColor = '#ffffff';
    let paintBrushSize = 1;
    let paintIsDrawing = false;
    let paintStartX = 0;
    let paintStartY = 0;
    let paintSnapshot = null;
    let paintCanvas = null;
    let paintCtx = null;

    function initPaint() {
      paintCanvas = document.getElementById('paint-canvas');
      if (!paintCanvas) return;
      paintCtx = paintCanvas.getContext('2d', { willReadFrequently: true });
      if (!paintCtx) return;

      paintCtx.fillStyle = '#ffffff';
      paintCtx.fillRect(0, 0, paintCanvas.width, paintCanvas.height);

      renderPaintPalette();
      updatePaintColorSwatches();

      paintCanvas.onmousedown = onPaintMouseDown;
      paintCanvas.onmousemove = onPaintMouseMove;
      paintCanvas.onmouseup = onPaintMouseUp;
      paintCanvas.onmouseleave = onPaintMouseUp;
      paintCanvas.oncontextmenu = (e) => e.preventDefault();
    }

    function renderPaintPalette() {
      const grid = document.getElementById('paint-palette-grid');
      if (!grid) return;
      grid.innerHTML = '';

      PAINT_PALETTE.forEach(color => {
        const box = document.createElement('div');
        box.className = 'paint-color-box';
        box.style.background = color;
        box.onclick = () => {
          paintPrimaryColor = color;
          updatePaintColorSwatches();
        };
        box.oncontextmenu = (e) => {
          e.preventDefault();
          paintSecondaryColor = color;
          updatePaintColorSwatches();
        };
        grid.appendChild(box);
      });
    }

    function updatePaintColorSwatches() {
      const fg = document.getElementById('paint-fg-swatch');
      const bg = document.getElementById('paint-bg-swatch');
      if (fg) fg.style.background = paintPrimaryColor;
      if (bg) bg.style.background = paintSecondaryColor;
    }

    function setPaintTool(toolName) {
      paintCurrentTool = toolName;
      document.querySelectorAll('.paint-tool-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById('ptool-' + toolName);
      if (activeBtn) activeBtn.classList.add('active');
    }

    function setBrushSize(size, elem) {
      paintBrushSize = size;
      document.querySelectorAll('.paint-size-opt').forEach(opt => opt.classList.remove('active'));
      if (elem) elem.classList.add('active');
    }

    function getPaintMousePos(e) {
      const rect = paintCanvas.getBoundingClientRect();
      const scaleX = paintCanvas.width / rect.width;
      const scaleY = paintCanvas.height / rect.height;
      return {
        x: Math.round((e.clientX - rect.left) * scaleX),
        y: Math.round((e.clientY - rect.top) * scaleY)
      };
    }

    function onPaintMouseDown(e) {
      if (!paintCtx) return;
      paintIsDrawing = true;
      const pos = getPaintMousePos(e);
      paintStartX = pos.x;
      paintStartY = pos.y;
      const drawColor = (e.button === 2) ? paintSecondaryColor : paintPrimaryColor;

      paintSnapshot = paintCtx.getImageData(0, 0, paintCanvas.width, paintCanvas.height);

      if (paintCurrentTool === 'bucket') {
        paintFloodFill(pos.x, pos.y, drawColor);
        paintIsDrawing = false;
        return;
      }

      paintCtx.strokeStyle = (paintCurrentTool === 'eraser') ? paintSecondaryColor : drawColor;
      paintCtx.fillStyle = (paintCurrentTool === 'eraser') ? paintSecondaryColor : drawColor;
      paintCtx.lineWidth = (paintCurrentTool === 'eraser') ? paintBrushSize * 4 : (paintCurrentTool === 'brush' ? paintBrushSize * 2 : paintBrushSize);
      paintCtx.lineCap = (paintCurrentTool === 'pencil') ? 'square' : 'round';
      paintCtx.lineJoin = 'round';

      if (['pencil', 'brush', 'eraser'].includes(paintCurrentTool)) {
        paintCtx.beginPath();
        paintCtx.moveTo(pos.x, pos.y);
        paintCtx.lineTo(pos.x, pos.y);
        paintCtx.stroke();
      }
    }

    function onPaintMouseMove(e) {
      if (!paintIsDrawing || !paintCtx) return;
      const pos = getPaintMousePos(e);
      const drawColor = (e.buttons === 2) ? paintSecondaryColor : paintPrimaryColor;

      if (['pencil', 'brush', 'eraser'].includes(paintCurrentTool)) {
        paintCtx.strokeStyle = (paintCurrentTool === 'eraser') ? paintSecondaryColor : drawColor;
        paintCtx.lineWidth = (paintCurrentTool === 'eraser') ? paintBrushSize * 4 : (paintCurrentTool === 'brush' ? paintBrushSize * 2 : paintBrushSize);
        paintCtx.lineTo(pos.x, pos.y);
        paintCtx.stroke();
      } else if (['line', 'rect', 'rect-fill', 'circle'].includes(paintCurrentTool)) {
        paintCtx.putImageData(paintSnapshot, 0, 0);
        paintCtx.strokeStyle = drawColor;
        paintCtx.fillStyle = drawColor;
        paintCtx.lineWidth = paintBrushSize;

        if (paintCurrentTool === 'line') {
          paintCtx.beginPath();
          paintCtx.moveTo(paintStartX, paintStartY);
          paintCtx.lineTo(pos.x, pos.y);
          paintCtx.stroke();
        } else if (paintCurrentTool === 'rect') {
          paintCtx.strokeRect(paintStartX, paintStartY, pos.x - paintStartX, pos.y - paintStartY);
        } else if (paintCurrentTool === 'rect-fill') {
          paintCtx.fillRect(paintStartX, paintStartY, pos.x - paintStartX, pos.y - paintStartY);
        } else if (paintCurrentTool === 'circle') {
          paintCtx.beginPath();
          const rx = Math.abs(pos.x - paintStartX) / 2;
          const ry = Math.abs(pos.y - paintStartY) / 2;
          const cx = Math.min(paintStartX, pos.x) + rx;
          const cy = Math.min(paintStartY, pos.y) + ry;
          paintCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          paintCtx.stroke();
        }
      }
    }

    function onPaintMouseUp() {
      if (!paintIsDrawing) return;
      paintIsDrawing = false;
      if (paintCtx) paintCtx.beginPath();
    }

    function clearPaintCanvas() {
      if (!paintCtx || !paintCanvas) return;
      paintCtx.fillStyle = '#ffffff';
      paintCtx.fillRect(0, 0, paintCanvas.width, paintCanvas.height);
    }

    function savePaintImage() {
      if (!paintCanvas) return;
      const link = document.createElement('a');
      link.download = 'deepak_paint_drawing.png';
      link.href = paintCanvas.toDataURL('image/png');
      link.click();
    }

    function paintFloodFill(startX, startY, fillColor) {
      if (!paintCtx || !paintCanvas) return;
      const imgData = paintCtx.getImageData(0, 0, paintCanvas.width, paintCanvas.height);
      const data = imgData.data;
      const width = paintCanvas.width;
      const height = paintCanvas.height;

      const dummy = document.createElement('div');
      dummy.style.color = fillColor;
      document.body.appendChild(dummy);
      const computed = window.getComputedStyle(dummy).color;
      document.body.removeChild(dummy);
      const rgb = computed.match(/\d+/g).map(Number);
      const fillR = rgb[0], fillG = rgb[1], fillB = rgb[2];

      const startIdx = (startY * width + startX) * 4;
      const targetR = data[startIdx];
      const targetG = data[startIdx + 1];
      const targetB = data[startIdx + 2];

      if (targetR === fillR && targetG === fillG && targetB === fillB) return;

      const queue = [[startX, startY]];
      const seen = new Uint8Array(width * height);

      while (queue.length > 0) {
        const [x, y] = queue.pop();
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const pIdx = y * width + x;
        if (seen[pIdx]) continue;
        seen[pIdx] = 1;

        const idx = pIdx * 4;
        if (Math.abs(data[idx] - targetR) < 15 && Math.abs(data[idx+1] - targetG) < 15 && Math.abs(data[idx+2] - targetB) < 15) {
          data[idx] = fillR;
          data[idx + 1] = fillG;
          data[idx + 2] = fillB;
          data[idx + 3] = 255;

          queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
      }

      paintCtx.putImageData(imgData, 0, 0);
    }

    // -----------------------------------------------------------------
