const board = document.getElementById("board");
const currentPlayerSpan = document.getElementById("current-player");
const blackCount = document.getElementById("black-count");
const whiteCount = document.getElementById("white-count");
const restartBtn = document.getElementById("restart");
const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");

const SIZE = 8;
let boardState = [];
let currentPlayer = "black";
let myColor = "black";
let pc, dc;
let isHost = false;

function createBoard() {
  board.innerHTML = "";
  boardState = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  boardState[3][3] = "white";
  boardState[3][4] = "black";
  boardState[4][3] = "black";
  boardState[4][4] = "white";

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.addEventListener("click", handleCellClick);
      board.appendChild(cell);
    }
  }

  updateBoard();
}

function updateBoard() {
  const cells = document.querySelectorAll(".cell");
  cells.forEach(cell => {
    const x = +cell.dataset.x;
    const y = +cell.dataset.y;
    cell.innerHTML = "";
    if (boardState[y][x]) {
      const disc = document.createElement("div");
      disc.className = `disc ${boardState[y][x]}`;
      cell.appendChild(disc);
    }
  });
  updateScore();
}

function updateScore() {
  let black = 0, white = 0;
  for (let row of boardState) {
    for (let cell of row) {
      if (cell === "black") black++;
      if (cell === "white") white++;
    }
  }
  blackCount.textContent = black;
  whiteCount.textContent = white;
  currentPlayerSpan.textContent = currentPlayer === "black" ? "黒" : "白";

  if (black + white === SIZE * SIZE || black === 0 || white === 0 ||
      (!hasAnyValidMove("black") && !hasAnyValidMove("white"))) {
    const result = black > white ? "黒の勝ち！" :
                   white > black ? "白の勝ち！" : "引き分け！";
    alert(result);
  }
}

function handleCellClick(e) {
  if (currentPlayer !== myColor) return;
  const x = +e.currentTarget.dataset.x;
  const y = +e.currentTarget.dataset.y;
  if (!canPlace(x, y, currentPlayer)) return;
  placeDisc(x, y, currentPlayer);
  sendMove(x, y);
  nextTurn();
  updateBoard();
}

function nextTurn() {
  currentPlayer = currentPlayer === "black" ? "white" : "black";
  if (!hasAnyValidMove(currentPlayer)) {
    alert((currentPlayer === "black" ? "黒" : "白") + "は置けないのでスキップします。");
    currentPlayer = currentPlayer === "black" ? "white" : "black";
    if (!hasAnyValidMove(currentPlayer)) updateScore();
  }
}

function hasAnyValidMove(player) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (canPlace(x, y, player)) return true;
    }
  }
  return false;
}

function canPlace(x, y, player) {
  if (boardState[y][x]) return false;
  return getFlippable(x, y, player).length > 0;
}

function placeDisc(x, y, player) {
  boardState[y][x] = player;
  const toFlip = getFlippable(x, y, player);
  for (const [fx, fy] of toFlip) {
    boardState[fy][fx] = player;
  }
}

function getFlippable(x, y, player) {
  const directions = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, -1], [1, -1], [-1, 1]
  ];
  const opponent = player === "black" ? "white" : "black";
  let flips = [];

  for (let [dx, dy] of directions) {
    let nx = x + dx, ny = y + dy;
    let line = [];
    while (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) {
      if (boardState[ny][nx] === opponent) {
        line.push([nx, ny]);
      } else if (boardState[ny][nx] === player) {
        flips = flips.concat(line);
        break;
      } else break;
      nx += dx;
      ny += dy;
    }
  }
  return flips;
}

function sendMove(x, y) {
  if (dc && dc.readyState === "open") {
    dc.send(JSON.stringify({ type: "move", x, y }));
  }
}

function receiveMove(x, y) {
  if (!canPlace(x, y, currentPlayer)) return;
  placeDisc(x, y, currentPlayer);
  nextTurn();
  updateBoard();
}

function setupP2P(offerMode) {
  pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  pc.onicecandidate = e => {
    if (!e.candidate) {
      document.getElementById("sdpOut").value = JSON.stringify(pc.localDescription);
    }
  };
  if (offerMode) {
    isHost = true;
    dc = pc.createDataChannel("game");
    bindChannel();
    pc.createOffer().then(d => pc.setLocalDescription(d));
  } else {
    pc.ondatachannel = e => {
      dc = e.channel;
      bindChannel();
    };
  }
}

function bindChannel() {
  dc.onopen = () => {
    console.log("DataChannel opened");
    if (isHost) {
      const starter = Math.random() < 0.5 ? "black" : "white";
      myColor = starter;
      dc.send(JSON.stringify({ type: "init", color: starter === "black" ? "white" : "black" }));
    }
  };
  dc.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.type === "move") receiveMove(msg.x, msg.y);
    if (msg.type === "init") myColor = msg.color;
    if (msg.type === "chat") addChat("相手: " + msg.text);
  };
}

chatSend.onclick = () => {
  const text = chatInput.value.trim();
  if (!text) return;
  addChat("あなた: " + text);
  if (dc && dc.readyState === "open") {
    dc.send(JSON.stringify({ type: "chat", text }));
  }
  chatInput.value = "";
};

function addChat(message) {
  const p = document.createElement("p");
  p.textContent = message;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

restartBtn.addEventListener("click", () => {
  currentPlayer = "black";
  createBoard();
});

document.getElementById("createOffer").onclick = () => setupP2P(true);
document.getElementById("createAnswer").onclick = async () => {
  setupP2P(false);
  const remoteSDP = JSON.parse(document.getElementById("sdpIn").value);
  await pc.setRemoteDescription(remoteSDP);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  document.getElementById("sdpOut").value = JSON.stringify(pc.localDescription);
};
document.getElementById("setRemote").onclick = async () => {
  const remoteSDP = JSON.parse(document.getElementById("sdpIn").value);
  await pc.setRemoteDescription(remoteSDP);
};

// 初期化
createBoard();
