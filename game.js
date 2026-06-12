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
let lastTime = 0;
let dropCounter = 0;
let animationFrame = null;
let clickTimer = null;

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

function guidePieceToPointer(event) {
  if (!canControl() || event.pointerType === "touch") return;

  const bounds = boardFrame.getBoundingClientRect();
  const relativeX = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
  const canvasX = (relativeX / bounds.width) * boardCanvas.width;
  const pieceWidth = currentPiece.matrix[0].length;
  const targetX = Math.max(
    0,
    Math.min(COLS - pieceWidth, Math.floor(canvasX / BLOCK - pieceWidth / 2)),
  );

  if (targetX !== currentPiece.x && !collide(currentPiece, targetX - currentPiece.x, 0)) {
    currentPiece.x = targetX;
    draw();
  }
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

  clearLines();
  currentPiece = nextPiece;
  nextPiece = takeFromBag();
  dropCounter = 0;

  if (collide(currentPiece)) {
    endGame();
    return;
  }

  draw();
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800];
    score += points[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    updateStats();
  }
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
  return running && !paused && !gameOver && currentPiece;
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

  drawNext();
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
boardCanvas.addEventListener("click", () => {
  if (!canControl()) return;
  clearTimeout(clickTimer);
  clickTimer = setTimeout(rotatePiece, 220);
});
boardCanvas.addEventListener("dblclick", (event) => {
  event.preventDefault();
  clearTimeout(clickTimer);
  hardDrop();
});
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
