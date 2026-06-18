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
const holdCanvas = document.querySelector("#hold");
const holdContext = holdCanvas.getContext("2d");
const holdSlot = document.querySelector("#holdSlot");
const holdStatus = document.querySelector("#holdStatus");
const scoreElement = document.querySelector("#score");
const linesElement = document.querySelector("#lines");
const levelElement = document.querySelector("#level");
const overlay = document.querySelector("#overlay");
const overlayEyebrow = document.querySelector("#overlayEyebrow");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const overlayMessage = document.querySelector("#overlayMessage");
const pauseMenu = document.querySelector("#pauseMenu");
const optionsMenu = document.querySelector("#optionsMenu");
const howToPlayMenu = document.querySelector("#howToPlayMenu");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const resumeButton = document.querySelector("#resumeButton");
const optionsButton = document.querySelector("#optionsButton");
const howToPlayButton = document.querySelector("#howToPlayButton");
const quitButton = document.querySelector("#quitButton");
const mouseToggle = document.querySelector("#mouseToggle");
const ghostToggle = document.querySelector("#ghostToggle");
const effectsToggle = document.querySelector("#effectsToggle");
const resetScoresButton = document.querySelector("#resetScoresButton");
const resetOptionsButton = document.querySelector("#resetOptionsButton");
const highScoresList = document.querySelector("#highScoresList");
const highScoresEmpty = document.querySelector("#highScoresEmpty");
const menuLevel = document.querySelector("#menuLevel");
const levelButton = document.querySelector("#levelButton");
const startOptionsButton = document.querySelector("#startOptionsButton");
const startHelpButton = document.querySelector("#startHelpButton");

const HIGH_SCORE_STORAGE_KEY = "pinkTetrisHighScores";
const HIGH_SCORE_LIMIT = 5;
const THEME_STORAGE_KEY = "pinkTetrisTheme";

// Replace these methods with API calls when the leaderboard has a backend.
const highScoreRepository = {
  load() {
    try {
      const savedScores = JSON.parse(localStorage.getItem(HIGH_SCORE_STORAGE_KEY) || "[]");
      return Array.isArray(savedScores) ? savedScores : [];
    } catch {
      return [];
    }
  },
  save(scores) {
    localStorage.setItem(HIGH_SCORE_STORAGE_KEY, JSON.stringify(scores));
  },
  reset() {
    localStorage.removeItem(HIGH_SCORE_STORAGE_KEY);
    localStorage.removeItem("pinkTetrisHighScore");
  },
};

let board = createBoard();
let currentPiece = null;
let nextPiece = null;
let heldPieceType = null;
let holdUsed = false;
let bag = [];
let score = 0;
let lines = 0;
let level = 1;
let startingLevel = 1;
let running = false;
let paused = false;
let gameOver = false;
let animatingDrop = false;
let landingEffect = null;
let lineClearEffect = null;
let aimedLandingY = null;
let visualPieceX = null;
let pointerGhostFit = null;
let lastMouseOrientationKey = null;
let lastMouseRotationColumn = null;
let lastTime = 0;
let dropCounter = 0;
let animationFrame = null;
let placementClickTimer = null;
let mouseEnabled = true;
let ghostEnabled = true;
let effectsEnabled = true;
let menuReturnView = overlayMessage;
let colorTheme = localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
const optionValues = {
  repeatDelay: 170,
  repeatSpeed: 50,
  soundVolume: 10,
  musicVolume: 0,
  musicType: 1,
};

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

function createPiece(type) {
  const matrix = SHAPES[type].map((row) => [...row]);
  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: type === "I" ? -1 : 0,
  };
}

function takeFromBag() {
  if (bag.length === 0) refillBag();
  return createPiece(bag.pop());
}

function resetGame() {
  board = createBoard();
  bag = [];
  score = 0;
  lines = 0;
  level = startingLevel;
  gameOver = false;
  paused = false;
  animatingDrop = false;
  landingEffect = null;
  lineClearEffect = null;
  aimedLandingY = null;
  visualPieceX = null;
  pointerGhostFit = null;
  lastMouseOrientationKey = null;
  lastMouseRotationColumn = null;
  heldPieceType = null;
  holdUsed = false;
  clearTimeout(placementClickTimer);
  placementClickTimer = null;
  updateHoldDisplay();
  currentPiece = takeFromBag();
  nextPiece = takeFromBag();
  visualPieceX = currentPiece.x;
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
  pauseButton.classList.remove("resume-label");
  pauseButton.setAttribute("aria-label", "Pause");
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
  visualPieceX = currentPiece.x;
  aimedLandingY = null;
  draw();
}

function getPointerCanvasX(event) {
  const bounds = boardFrame.getBoundingClientRect();
  const relativeX = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
  return (relativeX / bounds.width) * boardCanvas.width;
}

function getPointerColumn(event, matrix = currentPiece.matrix) {
  const canvasX = getPointerCanvasX(event);
  const pieceWidth = matrix[0].length;
  return Math.max(
    0,
    Math.min(COLS - pieceWidth, Math.floor(canvasX / BLOCK - pieceWidth / 2)),
  );
}

function guidePieceToPointer(event) {
  if (!mouseEnabled || !canControl() || event.pointerType === "touch") return;

  const bestFit = getBestPointerFit(event);
  if (!bestFit) return;

  const currentKey = getOrientationKey(currentPiece.matrix);
  const nextKey = getOrientationKey(bestFit.matrix);
  const cursorColumn = getPointerCanvasX(event) / BLOCK;
  const movedEnoughToRotate =
    lastMouseRotationColumn === null ||
    Math.abs(cursorColumn - lastMouseRotationColumn) >= 0.7;

  if (nextKey !== currentKey && nextKey !== lastMouseOrientationKey && !movedEnoughToRotate) {
    const sameOrientationFit = getBestPointerFit(event, {
      preferredOrientationKey: currentKey,
    });
    if (sameOrientationFit) {
      currentPiece.x = sameOrientationFit.x;
      aimedLandingY = sameOrientationFit.landingY;
      pointerGhostFit = {
        matrix: sameOrientationFit.matrix.map((row) => [...row]),
        x: sameOrientationFit.x,
        landingY: sameOrientationFit.landingY,
      };
      return;
    }
  }

  currentPiece.matrix = bestFit.matrix;
  currentPiece.x = bestFit.x;
  aimedLandingY = bestFit.landingY;
  pointerGhostFit = {
    matrix: bestFit.matrix.map((row) => [...row]),
    x: bestFit.x,
    landingY: bestFit.landingY,
  };
  if (nextKey !== currentKey) {
    visualPieceX = bestFit.x;
    lastMouseOrientationKey = nextKey;
    lastMouseRotationColumn = cursorColumn;
  }
}

function placePieceAtPointer(event) {
  if (!mouseEnabled || !canControl()) return;

  const lockedFit = pointerGhostFit;
  if (lockedFit) {
    currentPiece.matrix = lockedFit.matrix.map((row) => [...row]);
    currentPiece.x = lockedFit.x;
    visualPieceX = lockedFit.x;
    aimedLandingY = lockedFit.landingY;
    lastMouseOrientationKey = getOrientationKey(lockedFit.matrix);
    lastMouseRotationColumn = getPointerCanvasX(event) / BLOCK;
  } else {
    const bestFit = getBestPointerFit(event);
    if (bestFit) {
      currentPiece.matrix = bestFit.matrix;
      currentPiece.x = bestFit.x;
      visualPieceX = bestFit.x;
      aimedLandingY = bestFit.landingY;
      lastMouseOrientationKey = getOrientationKey(bestFit.matrix);
      lastMouseRotationColumn = getPointerCanvasX(event) / BLOCK;
    }
  }
  flashDrop(aimedLandingY);
}

function canUseClickForPlacement(event) {
  if (!mouseEnabled || !canControl() || event.button !== 0) return false;
  if (!overlay.classList.contains("hidden")) return false;
  return !event.target.closest("button, input, label, a, .game-controls");
}

function holdCurrentPiece() {
  if (!canControl() || holdUsed) return;

  const outgoingType = currentPiece.type;
  if (heldPieceType) {
    currentPiece = createPiece(heldPieceType);
  } else {
    currentPiece = nextPiece;
    nextPiece = takeFromBag();
  }

  heldPieceType = outgoingType;
  holdUsed = true;
  aimedLandingY = null;
  visualPieceX = currentPiece.x;
  pointerGhostFit = null;
  lastMouseOrientationKey = null;
  lastMouseRotationColumn = null;
  dropCounter = 0;
  updateHoldDisplay();

  if (collide(currentPiece)) {
    endGame();
    return;
  }
  draw();
}

function moveDown(manual = true) {
  if (!canControl()) return;

  if (!collide(currentPiece, 0, 1)) {
    currentPiece.y += 1;
    visualPieceX = currentPiece.x;
    aimedLandingY = null;
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

  aimedLandingY = null;
  let distance = 0;
  while (!collide(currentPiece, 0, 1)) {
    currentPiece.y += 1;
    visualPieceX = currentPiece.x;
    distance += 1;
  }
  score += distance * 2;
  updateStats();
  lockPiece();
}

function flashDrop(targetY = null) {
  if (!canControl()) return;

  const landingY = targetY ?? getLandingY(currentPiece);

  const distance = landingY - currentPiece.y;
  if (!effectsEnabled) {
    currentPiece.y = landingY;
    score += distance * 2;
    updateStats();
    aimedLandingY = null;
    lockPiece();
    return;
  }

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
    aimedLandingY = null;
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

function getRotatedMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function getLandingY(piece, matrix = piece.matrix, x = piece.x) {
  let landingY = piece.y;
  const probe = { ...piece, x, matrix };
  while (!collide(probe, 0, landingY - piece.y + 1, matrix)) landingY += 1;
  return landingY;
}

function canPlaceAt(matrix, x, y) {
  for (let matrixY = 0; matrixY < matrix.length; matrixY += 1) {
    for (let matrixX = 0; matrixX < matrix[matrixY].length; matrixX += 1) {
      if (!matrix[matrixY][matrixX]) continue;
      const boardX = x + matrixX;
      const boardY = y + matrixY;
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return false;
      if (boardY >= 0 && board[boardY][boardX]) return false;
    }
  }
  return true;
}

function getDeepestFitY(matrix, x) {
  for (let y = ROWS - matrix.length; y >= currentPiece.y; y -= 1) {
    if (canPlaceAt(matrix, x, y)) return y;
  }
  return null;
}

function getOrientationKey(matrix) {
  return matrix.map((row) => row.join("")).join("/");
}

function getOrientations(matrix) {
  const orientations = [];
  const seen = new Set();
  let candidate = matrix;

  for (let turns = 0; turns < 4; turns += 1) {
    const key = getOrientationKey(candidate);
    if (!seen.has(key)) {
      seen.add(key);
      orientations.push({ matrix: candidate, turns });
    }
    candidate = getRotatedMatrix(candidate);
  }
  return orientations;
}

function getLandingContact(matrix, x, landingY) {
  let contact = 0;

  for (let y = 0; y < matrix.length; y += 1) {
    for (let cellX = 0; cellX < matrix[y].length; cellX += 1) {
      if (!matrix[y][cellX]) continue;
      const boardX = x + cellX;
      const boardY = landingY + y;

      if (boardY === ROWS - 1 || board[boardY + 1]?.[boardX]) contact += 3;
      if (boardX === 0 || board[boardY]?.[boardX - 1]) contact += 1;
      if (boardX === COLS - 1 || board[boardY]?.[boardX + 1]) contact += 1;
    }
  }
  return contact;
}

function getBestPointerFit(event, options = {}) {
  const cursorColumn = getPointerCanvasX(event) / BLOCK;
  const candidates = [];
  const preferredOrientationKey = options.preferredOrientationKey ?? null;

  for (const orientation of getOrientations(currentPiece.matrix)) {
    if (preferredOrientationKey && getOrientationKey(orientation.matrix) !== preferredOrientationKey) {
      continue;
    }
    const preferredX = Math.round(cursorColumn - orientation.matrix[0].length / 2);

    for (let offset = 0; offset < COLS; offset += 1) {
      const positions =
        offset === 0 ? [preferredX] : [preferredX - offset, preferredX + offset];

      for (const x of positions) {
        if (x < 0 || x + orientation.matrix[0].length > COLS) continue;
        if (collide(currentPiece, x - currentPiece.x, 0, orientation.matrix)) continue;

        const landingY = getDeepestFitY(orientation.matrix, x);
        if (landingY === null) continue;
        candidates.push({
          matrix: orientation.matrix,
          turns: orientation.turns,
          x,
          cursorDistance: Math.abs(x + orientation.matrix[0].length / 2 - cursorColumn),
          contact: getLandingContact(orientation.matrix, x, landingY),
          landingY,
        });
      }

      if (candidates.some((candidate) => candidate.matrix === orientation.matrix)) break;
    }
  }

  candidates.sort(
    (a, b) =>
      a.cursorDistance - b.cursorDistance ||
      a.turns - b.turns ||
      b.contact - a.contact ||
      b.landingY - a.landingY,
  );
  return candidates[0] ?? null;
}

function rotatePiece(pointerEvent = null) {
  if (!canControl() || currentPiece.type === "O") return;

  const rotated = getRotatedMatrix(currentPiece.matrix);
  const preferredX = pointerEvent
    ? getPointerColumn(pointerEvent, rotated)
    : Math.max(0, Math.min(COLS - rotated[0].length, currentPiece.x));
  const candidates = [];

  for (let offset = 0; offset < COLS; offset += 1) {
    const positions = offset === 0 ? [preferredX] : [preferredX - offset, preferredX + offset];
    for (const x of positions) {
      if (x < 0 || x + rotated[0].length > COLS) continue;
      if (collide(currentPiece, x - currentPiece.x, 0, rotated)) continue;
      candidates.push({
        x,
        landingY: getLandingY(currentPiece, rotated, x),
        distance: Math.abs(x - preferredX),
      });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance || b.landingY - a.landingY);
  if (candidates.length === 0) return;

  currentPiece.matrix = rotated;
  currentPiece.x = candidates[0].x;
  aimedLandingY = null;
  draw();
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
  visualPieceX = currentPiece.x;
  pointerGhostFit = null;
  holdUsed = false;
  updateHoldDisplay();
  aimedLandingY = null;
  lastMouseOrientationKey = null;
  lastMouseRotationColumn = null;
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
  if (!effectsEnabled) {
    clearCompletedRows(rows);
    return;
  }

  lineClearEffect = {
    rows,
    startedAt: performance.now(),
    duration: 145,
    particles: createLineClearParticles(rows),
  };

  window.setTimeout(() => {
    if (!lineClearEffect) return;
    const rowsToClear = lineClearEffect.rows;
    lineClearEffect = null;
    clearCompletedRows(rowsToClear);
  }, lineClearEffect.duration);
}

function clearCompletedRows(rows) {
  const cleared = rows.length;
  for (const row of [...rows].sort((a, b) => b - a)) board.splice(row, 1);
  for (let index = 0; index < cleared; index += 1) {
    board.unshift(Array(COLS).fill(null));
  }

  const lineClearPoints = [0, 100, 300, 500, 800];
  const multiLineBonus = [0, 0, 150, 400, 750];
  score += (lineClearPoints[cleared] + multiLineBonus[cleared]) * level;
  lines += cleared;
  level = startingLevel + Math.floor(lines / 10);
  updateStats();
  spawnNextPiece();
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
  saveHighScore();
  showOverlay("Game over", "Nice stack", `You scored ${score.toLocaleString()} points.`, "Play again");
}

function saveHighScore() {
  if (score <= 0) return;

  const highScores = highScoreRepository.load();
  highScores.push({
    score,
    lines,
    level,
    playedAt: new Date().toISOString(),
  });
  highScores.sort((a, b) => b.score - a.score || b.lines - a.lines);
  highScoreRepository.save(highScores.slice(0, HIGH_SCORE_LIMIT));
  renderHighScores();
}

function renderHighScores() {
  const highScores = highScoreRepository.load()
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score || (b.lines || 0) - (a.lines || 0))
    .slice(0, HIGH_SCORE_LIMIT);

  highScoresList.replaceChildren();
  highScoresEmpty.hidden = highScores.length > 0;

  highScores.forEach((entry, index) => {
    const item = document.createElement("li");
    const rank = document.createElement("span");
    const result = document.createElement("strong");
    const details = document.createElement("small");
    const playedAt = new Date(entry.playedAt);
    const dateLabel = Number.isNaN(playedAt.getTime())
      ? ""
      : playedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    rank.textContent = `${index + 1}`;
    result.textContent = Number(entry.score).toLocaleString();
    details.textContent = `${entry.lines || 0} lines · Lv ${entry.level || 1}${dateLabel ? ` · ${dateLabel}` : ""}`;
    item.append(rank, result, details);
    highScoresList.append(item);
  });
}

function togglePause() {
  if (!running || gameOver) return;
  paused = !paused;
  pauseButton.classList.toggle("paused-icon", paused);
  pauseButton.setAttribute("aria-label", paused ? "Paused" : "Pause");

  if (paused) {
    cancelAnimationFrame(animationFrame);
    showPauseMenu();
  } else {
    overlay.classList.add("hidden");
    lastTime = performance.now();
    animationFrame = requestAnimationFrame(update);
  }
}

function showOverlay(eyebrow, title, text, buttonText) {
  showOverlayView(overlayMessage);
  overlayMessage.classList.toggle("start-screen", eyebrow === "Ready?");
  overlayEyebrow.textContent = eyebrow;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function showOverlayView(view) {
  [overlayMessage, pauseMenu, optionsMenu, howToPlayMenu].forEach((element) => {
    element.classList.toggle("hidden", element !== view);
  });
}

function showPauseMenu() {
  showOverlayView(pauseMenu);
  overlay.classList.remove("hidden");
}

function renderOptionValues() {
  document.querySelector("#repeatDelayValue").textContent = `${optionValues.repeatDelay} ms`;
  document.querySelector("#repeatSpeedValue").textContent = `${optionValues.repeatSpeed} ms`;
  document.querySelector("#soundVolumeValue").textContent = `${optionValues.soundVolume}%`;
  document.querySelector("#musicVolumeValue").textContent = `${optionValues.musicVolume}%`;
  document.querySelector("#musicTypeValue").textContent = `Type ${optionValues.musicType}`;
}

function applyTheme(theme, save = true) {
  colorTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = colorTheme;
  document.querySelector('meta[name="theme-color"]').content =
    colorTheme === "light" ? "#fff2f8" : "#160d1b";
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const selected = button.dataset.themeChoice === colorTheme;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (save) localStorage.setItem(THEME_STORAGE_KEY, colorTheme);
  draw();
}

function resetOptions() {
  mouseEnabled = true;
  ghostEnabled = true;
  effectsEnabled = true;
  Object.assign(optionValues, {
    repeatDelay: 170,
    repeatSpeed: 50,
    soundVolume: 10,
    musicVolume: 0,
    musicType: 1,
  });
  mouseToggle.checked = true;
  ghostToggle.checked = true;
  effectsToggle.checked = true;
  applyTheme("dark");
  renderOptionValues();
  draw();
}

function quitToTitle() {
  cancelAnimationFrame(animationFrame);
  clearTimeout(placementClickTimer);
  running = false;
  paused = false;
  gameOver = false;
  animatingDrop = false;
  landingEffect = null;
  lineClearEffect = null;
  board = createBoard();
  currentPiece = null;
  nextPiece = null;
  visualPieceX = null;
  pointerGhostFit = null;
  heldPieceType = null;
  holdUsed = false;
  score = 0;
  lines = 0;
  level = startingLevel;
  updateStats();
  updateHoldDisplay();
  pauseButton.disabled = true;
  pauseButton.classList.remove("paused-icon");
  pauseButton.setAttribute("aria-label", "Pause");
  draw();
  showOverlay("Ready?", "Pink Tetris", "Stack the pieces. Clear the lines.", "Start game");
}

function canControl() {
  return running && !paused && !gameOver && !animatingDrop && !lineClearEffect && currentPiece;
}

function updateVisualPieceX() {
  if (!currentPiece) {
    visualPieceX = null;
    return;
  }
  if (visualPieceX === null || Math.abs(visualPieceX - currentPiece.x) > 2.5) {
    visualPieceX = currentPiece.x;
    return;
  }
  visualPieceX += (currentPiece.x - visualPieceX) * 0.32;
  if (Math.abs(currentPiece.x - visualPieceX) < 0.02) visualPieceX = currentPiece.x;
}

function getGhostY() {
  let offset = 0;
  while (!collide(currentPiece, 0, offset + 1)) offset += 1;
  return currentPiece.y + offset;
}

function draw() {
  updateVisualPieceX();
  boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardContext.fillStyle = colorTheme === "light" ? "#ead0df" : "#160812";
  boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid();

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (board[y][x]) drawBlock(boardContext, x, y, COLORS[board[y][x]], BLOCK);
    }
  }

  if (currentPiece) {
    boardCanvas.dataset.pieceX = currentPiece.x;
    boardCanvas.dataset.pieceY = currentPiece.y;
    boardCanvas.dataset.pieceShape = getOrientationKey(currentPiece.matrix);
    if (ghostEnabled) drawPiece(currentPiece, aimedLandingY ?? getGhostY(), true);
    drawPiece(currentPiece, currentPiece.y, false, visualPieceX);
  }

  if (landingEffect) drawLandingEffect();
  if (lineClearEffect) drawLineClearEffect();
  drawNext();
  drawHold();
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
  boardContext.strokeStyle =
    colorTheme === "light" ? "rgba(88, 33, 63, 0.18)" : "rgba(255, 205, 232, 0.055)";
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

function drawPiece(piece, targetY, ghost, visualX = piece.x) {
  for (let y = 0; y < piece.matrix.length; y += 1) {
    for (let x = 0; x < piece.matrix[y].length; x += 1) {
      if (!piece.matrix[y][x] || targetY + y < 0) continue;
      drawBlock(
        boardContext,
        visualX + x,
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
    context.save();
    context.globalAlpha = colorTheme === "light" ? 0.16 : 0.24;
    context.fillStyle = color;
    context.fillRect(px + 3, py + 3, blockSize - 6, blockSize - 6);
    context.globalAlpha = 1;
    context.strokeStyle = colorTheme === "light" ? `${color}80` : "#fff2fa";
    context.lineWidth = colorTheme === "light" ? 1 : 2;
    context.strokeRect(px + 2, py + 2, blockSize - 4, blockSize - 4);
    context.strokeStyle = `${color}c0`;
    context.lineWidth = colorTheme === "light" ? 0.5 : 1;
    if (colorTheme !== "light") {
      context.strokeRect(px + 5, py + 5, blockSize - 10, blockSize - 10);
    }
    context.restore();
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

function drawPreview(context, canvas, pieceType) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!pieceType) return;

  const matrix = SHAPES[pieceType];
  const previewBlock = 20;
  const width = matrix[0].length * previewBlock;
  const height = matrix.length * previewBlock;
  const offsetX = (canvas.width - width) / 2;
  const offsetY = (canvas.height - height) / 2;

  context.save();
  context.translate(offsetX, offsetY);
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (matrix[y][x]) drawBlock(context, x, y, COLORS[pieceType], previewBlock);
    }
  }
  context.restore();
}

function drawHold() {
  drawPreview(holdContext, holdCanvas, heldPieceType);
}

function updateHoldDisplay() {
  holdSlot.classList.toggle("used", holdUsed);
  holdStatus.textContent = holdUsed ? "Used this turn" : "Double-click";
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

  if (event.key === "Escape" || event.key.toLowerCase() === "p") {
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
document.addEventListener("click", (event) => {
  if (!canUseClickForPlacement(event)) return;
  clearTimeout(placementClickTimer);
  placementClickTimer = window.setTimeout(() => placePieceAtPointer(event), 220);
});
boardCanvas.addEventListener("dblclick", (event) => {
  if (!mouseEnabled) return;
  event.preventDefault();
  clearTimeout(placementClickTimer);
  holdCurrentPiece();
});
boardCanvas.addEventListener("contextmenu", (event) => event.preventDefault());

startButton.addEventListener("click", () => {
  if (paused) {
    togglePause();
  } else {
    startGame();
  }
});
levelButton.addEventListener("click", () => {
  const selectableLevels = [1, 5, 10, 15, 20, 25];
  const currentIndex = selectableLevels.indexOf(startingLevel);
  startingLevel = selectableLevels[(currentIndex + 1) % selectableLevels.length];
  level = startingLevel;
  menuLevel.textContent = startingLevel;
  updateStats();
});
pauseButton.addEventListener("click", togglePause);
resumeButton.addEventListener("click", togglePause);
optionsButton.addEventListener("click", () => {
  menuReturnView = pauseMenu;
  showOverlayView(optionsMenu);
});
howToPlayButton.addEventListener("click", () => {
  menuReturnView = pauseMenu;
  showOverlayView(howToPlayMenu);
});
startOptionsButton.addEventListener("click", () => {
  menuReturnView = overlayMessage;
  showOverlayView(optionsMenu);
});
startHelpButton.addEventListener("click", () => {
  menuReturnView = overlayMessage;
  showOverlayView(howToPlayMenu);
});
quitButton.addEventListener("click", quitToTitle);
document.querySelectorAll("[data-menu-back]").forEach((button) => {
  button.addEventListener("click", () => showOverlayView(menuReturnView));
});
ghostToggle.addEventListener("change", () => {
  ghostEnabled = ghostToggle.checked;
  draw();
});
effectsToggle.addEventListener("change", () => {
  effectsEnabled = effectsToggle.checked;
});
mouseToggle.addEventListener("change", () => {
  mouseEnabled = mouseToggle.checked;
});
document.querySelectorAll("[data-step]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.step;
    const delta = Number(button.dataset.delta);
    const limits = {
      repeatDelay: [50, 500],
      repeatSpeed: [15, 150],
      soundVolume: [0, 100],
      musicVolume: [0, 100],
      musicType: [1, 3],
    };
    optionValues[key] = Math.max(
      limits[key][0],
      Math.min(limits[key][1], optionValues[key] + delta),
    );
    renderOptionValues();
  });
});
document.querySelectorAll("[data-theme-choice]").forEach((button) => {
  button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));
});
resetScoresButton.addEventListener("click", () => {
  highScoreRepository.reset();
  renderHighScores();
  resetScoresButton.textContent = "High scores reset";
  window.setTimeout(() => {
    resetScoresButton.textContent = "Reset high scores";
  }, 900);
});
resetOptionsButton.addEventListener("click", resetOptions);

applyTheme(colorTheme, false);
renderOptionValues();
renderHighScores();
draw();
