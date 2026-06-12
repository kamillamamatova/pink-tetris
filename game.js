const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
};

const COLORS = {
  I: "#ff9dce",
  J: "#e873b5",
  L: "#ff6aad",
  O: "#ffc1df",
  S: "#d957a0",
  T: "#f28bc5",
  Z: "#b93f8f",
};

const boardCanvas = document.querySelector("#board");
const boardFrame = document.querySelector(".board-frame");
const boardContext = boardCanvas.getContext("2d");
const nextCanvas = document.querySelector("#next");
const nextContext = nextCanvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const linesElement = document.querySelector("#lines");
const levelElement = document.querySelector("#level");
const overlay = document.querySelector("#overlay");
const overlayEyebrow = document.querySelector("#overlayEyebrow");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");

let board = createBoard();
let currentPiece = null;
let nextPiece = null;
let bag = [];
let score = 0;
let lines = 0;
let level = 1;
let running = false;
let paused = false;
let gameOver = false;
let animatingDrop = false;
let landingEffect = null;
let lineClearEffect = null;
let lastTime = 0;
let dropCounter = 0;
let animationFrame = null;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function refillBag() {
  bag = Object.keys(SHAPES);
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }
}

function takeFromBag() {
  if (bag.length === 0) refillBag();
  const type = bag.pop();
  const matrix = SHAPES[type].map((row) => [...row]);
  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: type === "I" ? -1 : 0,
  };
}

function resetGame() {
  board = createBoard();
  bag = [];
  score = 0;
  lines = 0;
  level = 1;
  gameOver = false;
  paused = false;
  animatingDrop = false;
  landingEffect = null;
  lineClearEffect = null;
  currentPiece = takeFromBag();
  nextPiece = takeFromBag();
  dropCounter = 0;
  lastTime = performance.now();
  updateStats();
  draw();
}

function startGame() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  resetGame();
  running = true;
  overlay.classList.add("hidden");
  pauseButton.disabled = false;
  pauseButton.textContent = "Pause";
  animationFrame = requestAnimationFrame(update);
}

function update(time = 0) {
  if (!running || paused) return;

  const delta = time - lastTime;
  lastTime = time;

  if (animatingDrop || lineClearEffect) {
    draw();
    animationFrame = requestAnimationFrame(update);
    return;
  }

  dropCounter += delta;

  if (dropCounter >= getDropInterval()) {
    moveDown(false);
  }

  draw();
  animationFrame = requestAnimationFrame(update);
}

function getDropInterval() {
  return Math.max(90, 850 - (level - 1) * 70);
}

function collide(piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue;

      const boardX = piece.x + x + offsetX;
      const boardY = piece.y + y + offsetY;

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }
  return false;
}

function moveHorizontal(direction) {
  if (!canControl() || collide(currentPiece, direction, 0)) return;
  currentPiece.x += direction;
  draw();
}

function getPointerColumn(event) {
  const bounds = boardFrame.getBoundingClientRect();
  const relativeX = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
  const canvasX = (relativeX / bounds.width) * boardCanvas.width;
  const pieceWidth = currentPiece.matrix[0].length;
  return Math.max(
    0,
    Math.min(COLS - pieceWidth, Math.floor(canvasX / BLOCK - pieceWidth / 2)),
  );
}

function guidePieceToPointer(event) {
  if (!canControl() || event.pointerType === "touch") return;

  const targetX = getPointerColumn(event);
  if (targetX !== currentPiece.x && !collide(currentPiece, targetX - currentPiece.x, 0)) {
    currentPiece.x = targetX;
    draw();
  }
}

function placePieceAtPointer(event) {
  if (!canControl()) return;

  const targetX = getPointerColumn(event);
  if (!collide(currentPiece, targetX - currentPiece.x, 0)) {
    currentPiece.x = targetX;
  }
  flashDrop();
}

function moveDown(manual = true) {
  if (!canControl()) return;

  if (!collide(currentPiece, 0, 1)) {
    currentPiece.y += 1;
    if (manual) score += 1;
    dropCounter = 0;
    updateStats();
    draw();
    return;
  }

  lockPiece();
}

function hardDrop() {
  if (!canControl()) return;

  let distance = 0;
  while (!collide(currentPiece, 0, 1)) {
    currentPiece.y += 1;
    distance += 1;
  }
  score += distance * 2;
  updateStats();
  lockPiece();
}

function flashDrop() {
  if (!canControl()) return;

  let landingY = currentPiece.y;
  while (!collide(currentPiece, 0, landingY - currentPiece.y + 1)) {
    landingY += 1;
  }

  const distance = landingY - currentPiece.y;
  if (distance === 0) {
    lockPiece();
    return;
  }

  animatingDrop = true;
  landingEffect = {
    landingY,
    startedAt: performance.now(),
    duration: 280,
    particles: createLandingParticles(currentPiece, landingY),
  };

  window.setTimeout(() => {
    if (!running || paused || gameOver) {
      animatingDrop = false;
      landingEffect = null;
      return;
    }

    currentPiece.y = landingY;
    score += distance * 2;
    updateStats();
    landingEffect = null;
    animatingDrop = false;
    dropCounter = 0;
    lockPiece();
  }, landingEffect.duration);
}

function createLandingParticles(piece, landingY) {
  const particles = [];

  for (let y = 0; y < piece.matrix.length; y += 1) {
    for (let x = 0; x < piece.matrix[y].length; x += 1) {
      if (!piece.matrix[y][x]) continue;
      const centerX = (piece.x + x + 0.5) * BLOCK;
      const centerY = (landingY + y + 0.5) * BLOCK;

      for (let index = 0; index < 4; index += 1) {
        const angle = (Math.PI * 2 * index) / 4 + Math.random() * 0.5;
        particles.push({
          x: centerX,
          y: centerY,
          dx: Math.cos(angle) * (8 + Math.random() * 12),
          dy: Math.sin(angle) * (8 + Math.random() * 12),
          size: 1.5 + Math.random() * 2.5,
        });
      }
    }
  }

  return particles;
}

function rotatePiece() {
  if (!canControl() || currentPiece.type === "O") return;

  const rotated = currentPiece.matrix[0].map((_, index) =>
    currentPiece.matrix.map((row) => row[index]).reverse(),
  );

  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(currentPiece, kick, 0, rotated)) {
      currentPiece.matrix = rotated;
      currentPiece.x += kick;
      draw();
      return;
    }
  }
}

function lockPiece() {
  for (let y = 0; y < currentPiece.matrix.length; y += 1) {
    for (let x = 0; x < currentPiece.matrix[y].length; x += 1) {
      if (!currentPiece.matrix[y][x]) continue;
      const boardY = currentPiece.y + y;
      const boardX = currentPiece.x + x;

      if (boardY < 0) {
        endGame();
        return;
      }
      board[boardY][boardX] = currentPiece.type;
    }
  }

  const completedRows = getCompletedRows();
  if (completedRows.length > 0) {
    currentPiece = null;
    startLineClearEffect(completedRows);
    return;
  }

  spawnNextPiece();
}

function spawnNextPiece() {
  currentPiece = nextPiece;
  nextPiece = takeFromBag();
  dropCounter = 0;

  if (collide(currentPiece)) {
    endGame();
    return;
  }

  draw();
}

function getCompletedRows() {
  const completedRows = [];
  for (let y = 0; y < ROWS; y += 1) {
    if (board[y].every(Boolean)) completedRows.push(y);
  }
  return completedRows;
}

function startLineClearEffect(rows) {
  lineClearEffect = {
    rows,
    startedAt: performance.now(),
    duration: 460,
    particles: createLineClearParticles(rows),
  };

  window.setTimeout(() => {
    if (!lineClearEffect) return;

    const cleared = lineClearEffect.rows.length;
    for (const row of [...lineClearEffect.rows].sort((a, b) => b - a)) {
      board.splice(row, 1);
    }
    for (let index = 0; index < cleared; index += 1) {
      board.unshift(Array(COLS).fill(null));
    }

    const points = [0, 100, 300, 500, 800];
    score += points[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    updateStats();
    lineClearEffect = null;
    spawnNextPiece();
  }, lineClearEffect.duration);
}

function createLineClearParticles(rows) {
  const particles = [];
  for (const row of rows) {
    for (let x = 0; x < COLS; x += 1) {
      const direction = x < COLS / 2 ? -1 : 1;
      particles.push({
        x: (x + 0.5) * BLOCK,
        y: (row + 0.5) * BLOCK,
        dx: direction * (20 + Math.random() * 35),
        dy: (Math.random() - 0.5) * 24,
        size: 2 + Math.random() * 3,
      });
    }
  }
  return particles;
}

function endGame() {
  running = false;
  gameOver = true;
  pauseButton.disabled = true;
  showOverlay("Game over", "Nice stack", `You scored ${score.toLocaleString()} points.`, "Play again");
}

function togglePause() {
  if (!running || gameOver) return;
  paused = !paused;
  pauseButton.textContent = paused ? "Resume" : "Pause";

  if (paused) {
    cancelAnimationFrame(animationFrame);
    showOverlay("Paused", "Take a breath", "Your game is waiting for you.", "Resume");
  } else {
    overlay.classList.add("hidden");
    lastTime = performance.now();
    animationFrame = requestAnimationFrame(update);
  }
}

function showOverlay(eyebrow, title, text, buttonText) {
  overlayEyebrow.textContent = eyebrow;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function canControl() {
  return running && !paused && !gameOver && !animatingDrop && !lineClearEffect && currentPiece;
}

function getGhostY() {
  let offset = 0;
  while (!collide(currentPiece, 0, offset + 1)) offset += 1;
  return currentPiece.y + offset;
}

function draw() {
  boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid();

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (board[y][x]) drawBlock(boardContext, x, y, COLORS[board[y][x]], BLOCK);
    }
  }

  if (currentPiece) {
    boardCanvas.dataset.pieceX = currentPiece.x;
    boardCanvas.dataset.pieceY = currentPiece.y;
    drawPiece(currentPiece, getGhostY(), true);
    drawPiece(currentPiece, currentPiece.y, false);
  }

  if (landingEffect) drawLandingEffect();
  if (lineClearEffect) drawLineClearEffect();
  drawNext();
}

function drawLandingEffect() {
  const progress = Math.min(
    1,
    (performance.now() - landingEffect.startedAt) / landingEffect.duration,
  );
  const pulse = 0.55 + Math.sin(progress * Math.PI * 4) * 0.35;

  boardContext.save();
  boardContext.globalAlpha = Math.max(0, 1 - progress) * pulse;
  boardContext.shadowColor = "#ffb8df";
  boardContext.shadowBlur = 24;
  drawPiece(currentPiece, landingEffect.landingY, false);

  boardContext.shadowBlur = 0;
  boardContext.fillStyle = "#fff5fb";
  for (const particle of landingEffect.particles) {
    const x = particle.x + particle.dx * progress;
    const y = particle.y + particle.dy * progress;
    const size = particle.size * (1 - progress);
    boardContext.fillRect(x - size / 2, y - size / 2, size, size);
  }
  boardContext.restore();
}

function drawLineClearEffect() {
  const progress = Math.min(
    1,
    (performance.now() - lineClearEffect.startedAt) / lineClearEffect.duration,
  );
  const flash = 0.45 + Math.sin(progress * Math.PI * 6) * 0.4;

  boardContext.save();
  boardContext.globalCompositeOperation = "screen";
  boardContext.shadowColor = "#ff8fca";
  boardContext.shadowBlur = 22;

  for (const row of lineClearEffect.rows) {
    const inset = progress * (boardCanvas.width / 2);
    const width = Math.max(0, boardCanvas.width - inset * 2);
    boardContext.globalAlpha = Math.max(0, 1 - progress) * flash;
    boardContext.fillStyle = "#fff2fa";
    boardContext.fillRect(inset, row * BLOCK + 2, width, BLOCK - 4);
  }

  boardContext.shadowBlur = 0;
  boardContext.fillStyle = "#ffd4ec";
  boardContext.globalAlpha = 1 - progress;
  for (const particle of lineClearEffect.particles) {
    const x = particle.x + particle.dx * progress;
    const y = particle.y + particle.dy * progress;
    const size = particle.size * (1 - progress);
    boardContext.fillRect(x - size / 2, y - size / 2, size, size);
  }
  boardContext.restore();
}

function drawGrid() {
  boardContext.strokeStyle = "rgba(255, 205, 232, 0.055)";
  boardContext.lineWidth = 1;
  for (let x = 1; x < COLS; x += 1) {
    boardContext.beginPath();
    boardContext.moveTo(x * BLOCK + 0.5, 0);
    boardContext.lineTo(x * BLOCK + 0.5, ROWS * BLOCK);
    boardContext.stroke();
  }
  for (let y = 1; y < ROWS; y += 1) {
    boardContext.beginPath();
    boardContext.moveTo(0, y * BLOCK + 0.5);
    boardContext.lineTo(COLS * BLOCK, y * BLOCK + 0.5);
    boardContext.stroke();
  }
}

function drawPiece(piece, targetY, ghost) {
  for (let y = 0; y < piece.matrix.length; y += 1) {
    for (let x = 0; x < piece.matrix[y].length; x += 1) {
      if (!piece.matrix[y][x] || targetY + y < 0) continue;
      drawBlock(
        boardContext,
        piece.x + x,
        targetY + y,
        COLORS[piece.type],
        BLOCK,
        ghost,
      );
    }
  }
}

function drawBlock(context, x, y, color, size, ghost = false) {
  const inset = 1.5;
  const px = x * size + inset;
  const py = y * size + inset;
  const blockSize = size - inset * 2;

  if (ghost) {
    context.strokeStyle = `${color}80`;
    context.lineWidth = 2;
    context.strokeRect(px + 2, py + 2, blockSize - 4, blockSize - 4);
    return;
  }

  context.fillStyle = color;
  context.fillRect(px, py, blockSize, blockSize);

  const shine = context.createLinearGradient(px, py, px + blockSize, py + blockSize);
  shine.addColorStop(0, "rgba(255,255,255,0.42)");
  shine.addColorStop(0.42, "rgba(255,255,255,0.04)");
  shine.addColorStop(1, "rgba(59,0,36,0.35)");
  context.fillStyle = shine;
  context.fillRect(px, py, blockSize, blockSize);

  context.strokeStyle = "rgba(255,255,255,0.28)";
  context.lineWidth = 1;
  context.strokeRect(px + 0.5, py + 0.5, blockSize - 1, blockSize - 1);
}

function drawNext() {
  nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextPiece) return;

  const previewBlock = 22;
  const width = nextPiece.matrix[0].length * previewBlock;
  const height = nextPiece.matrix.length * previewBlock;
  const offsetX = (nextCanvas.width - width) / 2;
  const offsetY = (nextCanvas.height - height) / 2;

  nextContext.save();
  nextContext.translate(offsetX, offsetY);
  for (let y = 0; y < nextPiece.matrix.length; y += 1) {
    for (let x = 0; x < nextPiece.matrix[y].length; x += 1) {
      if (nextPiece.matrix[y][x]) {
        drawBlock(nextContext, x, y, COLORS[nextPiece.type], previewBlock);
      }
    }
  }
  nextContext.restore();
}

function updateStats() {
  scoreElement.textContent = score.toLocaleString();
  linesElement.textContent = lines;
  levelElement.textContent = level;
}

function handleAction(action) {
  const actions = {
    left: () => moveHorizontal(-1),
    right: () => moveHorizontal(1),
    down: () => moveDown(true),
    rotate: rotatePiece,
    drop: hardDrop,
  };
  actions[action]?.();
}

document.addEventListener("keydown", (event) => {
  const controls = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowDown: "down",
    ArrowUp: "rotate",
    " ": "drop",
  };

  if (event.key.toLowerCase() === "p") {
    event.preventDefault();
    togglePause();
    return;
  }

  const action = controls[event.key];
  if (action) {
    event.preventDefault();
    handleAction(action);
  }
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handleAction(button.dataset.action);
  });
});

document.addEventListener("pointermove", guidePieceToPointer);
document.addEventListener("mousemove", guidePieceToPointer);
boardCanvas.addEventListener("click", placePieceAtPointer);
boardCanvas.addEventListener("contextmenu", (event) => event.preventDefault());

startButton.addEventListener("click", () => {
  if (paused) {
    togglePause();
  } else {
    startGame();
  }
});
pauseButton.addEventListener("click", togglePause);

draw();
