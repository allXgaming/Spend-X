// script.js (ES module)
import {
  auth,
  database,
  signInAnonymously,
  createRoom,
  joinRoom,
  startGame,
  updateGameState,
  listenToRoomChanges,
  listenToGameChanges,
  sendChatMessage,
  listenToChatMessages,
  leaveRoom,
  endGame
} from './firebase.js';

// --- Game constants (same as before) ---
const COLORS = ['red','blue','green','yellow'];
const PLAYER_POSITIONS = {
  red: { path: Array.from({length:69}, (_,i)=>i) }, // simplified - matches earlier arrays
  blue: { path: [17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,8] },
  green: { path: [34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,76] },
  yellow: { path: [51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,42] }
};
const SAFE_CELLS = [0,8,13,21,26,34,39,47,52,60,65,73,78,86,91,99,104,112,117];
const START_CELLS = { red:[0,1,4,5], blue:[17,18,21,22], green:[34,35,38,39], yellow:[51,52,55,56] };
const HOME_CELLS = { red:[68,69,70,71], blue:[8,9,10,11], green:[76,77,78,79], yellow:[42,43,44,45] };

// --- State ---
let currentPlayer = null;
let currentRoom = null;
let gameState = null;
let playerColor = null;
let playerId = null;
let isHost = false;
let diceValue = 0;
let selectedPawn = null;
let roomRef = null;
let gameRef = null;
let chatRef = null;

// --- DOM ---
const loginScreen = document.getElementById('login-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const winnerScreen = document.getElementById('winner-screen');
const playerNameInput = document.getElementById('player-name');
const loginBtn = document.getElementById('login-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomCodeInput = document.getElementById('room-code');
const roomInfo = document.getElementById('room-info');
const displayRoomCode = document.getElementById('display-room-code');
const copyRoomCode = document.getElementById('copy-room-code');
const playersList = document.getElementById('players');
const playerCount = document.getElementById('player-count');
const startGameBtn = document.getElementById('start-game-btn');
const gameRoomCode = document.getElementById('game-room-code');
const currentPlayerDisplay = document.getElementById('current-player');
const gameBoard = document.querySelector('.game-board');
const rollDiceBtn = document.getElementById('roll-dice-btn');
const diceElement = document.getElementById('dice');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const winnerName = document.getElementById('winner-name');
const playAgainBtn = document.getElementById('play-again-btn');

// Sounds
const diceSound = document.getElementById('dice-sound');
const moveSound = document.getElementById('move-sound');
const winSound = document.getElementById('win-sound');
const killSound = document.getElementById('kill-sound');

// Events
loginBtn.addEventListener('click', handleLogin);
createRoomBtn.addEventListener('click', handleCreateRoom);
joinRoomBtn.addEventListener('click', handleJoinRoom);
copyRoomCode.addEventListener('click', copyRoomCodeToClipboard);
startGameBtn.addEventListener('click', startGameHandler);
rollDiceBtn.addEventListener('click', rollDice);
sendChatBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
playAgainBtn.addEventListener('click', playAgain);

// --- Init ---
auth.onAuthStateChanged(user => {
  if (user) {
    playerId = user.uid;
    // try to get stored name from DB (if exists)
    database.ref(`users/${playerId}/name`).once('value').then(snap => {
      currentPlayer = snap.val() || (`Player-${playerId.slice(0,6)}`);
      showLobbyScreen();
    }).catch(() => {
      currentPlayer = `Player-${playerId.slice(0,6)}`;
      showLobbyScreen();
    });
  } else {
    showLoginScreen();
  }
});

// --- Handlers ---
function showLoginScreen() {
  loginScreen.classList.remove('hidden');
  lobbyScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  winnerScreen.classList.add('hidden');
}

function showLobbyScreen() {
  loginScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  gameScreen.classList.add('hidden');
  winnerScreen.classList.add('hidden');
}

function handleLogin() {
  const name = playerNameInput.value.trim();
  if (!name) { alert('Please enter your name'); return; }

  signInAnonymously(name)
    .then(user => {
      playerId = user.uid;
      currentPlayer = name;
      showLobbyScreen();
    })
    .catch(err => {
      console.error('Login error:', err);
      alert('Login failed. Check Firebase settings (Anonymous sign-in enabled).');
    });
}

function handleCreateRoom() {
  if (!playerId) { alert('You must be logged in first'); return; }
  createRoom(currentPlayer, playerId)
    .then(roomCode => {
      currentRoom = roomCode;
      isHost = true;
      displayRoom(roomCode);
      setupRoomListeners(roomCode);
    })
    .catch(err => { console.error('create room err', err); alert('Could not create room'); });
}

function handleJoinRoom() {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (!roomCode || roomCode.length !== 6) { alert('Please enter valid 6-char room code'); return; }
  joinRoom(roomCode, currentPlayer, playerId)
    .then(rc => {
      currentRoom = rc;
      isHost = false;
      displayRoom(rc);
      setupRoomListeners(rc);
    })
    .catch(err => { console.error('join room err', err); alert(err.message || 'Could not join room'); });
}

function displayRoom(roomCode) {
  displayRoomCode.textContent = roomCode;
  roomInfo.classList.remove('hidden');
  startGameBtn.disabled = true;
}

function setupRoomListeners(roomCode) {
  if (roomRef) roomRef.off();
  roomRef = listenToRoomChanges(roomCode, room => {
    if (!room) { alert('Room closed'); window.location.reload(); return; }
    updatePlayersList(room.players);
    if (isHost && room.status === 'waiting') {
      const cnt = room.players ? Object.keys(room.players).length : 0;
      startGameBtn.disabled = cnt < 2;
    }
    if (room.status === 'playing') showGameScreen(roomCode);
  });
}

function updatePlayersList(players) {
  playersList.innerHTML = '';
  let cnt = 0;
  if (!players) players = {};
  for (const [id, p] of Object.entries(players)) {
    cnt++;
    const li = document.createElement('li');
    li.textContent = p.name + (id === playerId ? ' (You)' : '');
    if (p.color) li.style.color = p.color;
    playersList.appendChild(li);
  }
  playerCount.textContent = cnt;
}

function copyRoomCodeToClipboard() {
  navigator.clipboard.writeText(displayRoomCode.textContent).then(() => {
    const orig = copyRoomCode.textContent;
    copyRoomCode.textContent = 'Copied!';
    setTimeout(()=> copyRoomCode.textContent = orig, 2000);
  }).catch(()=>{});
}

// --- Start game ---
function startGameHandler() {
  if (!isHost || !currentRoom) return;
  const playersRef = database.ref(`rooms/${currentRoom}/players`);
  playersRef.once('value').then(snap => {
    const players = snap.val();
    const ids = Object.keys(players);
    const updates = {};
    const initialState = { players: {}, currentTurn: 0, diceValue: 0, pawns: {}, status: 'playing', winner: null };
    ids.forEach((id, idx) => {
      const color = COLORS[idx];
      updates[`${id}/color`] = color;
      initialState.players[id] = { name: players[id].name, color, finishedPawns: 0 };
      for (let i=0;i<4;i++){
        initialState.pawns[`${id}-${i}`] = { position:-1, color, index:i };
      }
    });
    return playersRef.update(updates).then(()=> startGame(currentRoom, initialState));
  }).then(()=> showGameScreen(currentRoom)).catch(err => { console.error(err); alert('Could not start game'); });
}

function showGameScreen(roomCode) {
  lobbyScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  gameRoomCode.textContent = roomCode;
  createBoard();
  setupGameListeners(roomCode);
  setupChat(roomCode);
}

function createBoard() {
  gameBoard.innerHTML = '';
  const board = document.createElement('div'); board.className='board';
  for (let i=0;i<225;i++){
    const cell = document.createElement('div');
    cell.className='cell'; cell.dataset.index = i;
    if (isPathCell(i)) cell.classList.add('path-cell');
    if (isHomeCell(i)) cell.classList.add('home-cell');
    if (isStartCell(i)) cell.classList.add('start-cell', `${getStartColor(i)}-start`);
    if (isSafeCell(i)) cell.classList.add('safe-cell');
    board.appendChild(cell);
  }
  gameBoard.appendChild(board);
}

function isPathCell(i){ return Object.values(PLAYER_POSITIONS).some(p=>p.path.includes(i)); }
function isHomeCell(i){ return Object.values(HOME_CELLS).some(a=>a.includes(i)); }
function isStartCell(i){ return Object.values(START_CELLS).some(a=>a.includes(i)); }
function getStartColor(i){ for(const [c,pos] of Object.entries(START_CELLS)) if(pos.includes(i)) return c; return null; }
function isSafeCell(i){ return SAFE_CELLS.includes(i); }

// --- Game listeners ---
function setupGameListeners(roomCode) {
  if (gameRef) gameRef.off();
  gameRef = listenToGameChanges(roomCode, game => {
    if (!game) return;
    gameState = game;
    updateGameUI();
    if (game.winner) showWinnerScreen(game.winner);
  });
}

function updateGameUI() {
  const keys = Object.keys(gameState.players || {});
  if (!keys.length) return;
  const currentPlayerId = keys[gameState.currentTurn % keys.length];
  const currentPlayerData = gameState.players[currentPlayerId];
  currentPlayerDisplay.textContent = currentPlayerData.name;
  currentPlayerDisplay.style.color = currentPlayerData.color;
  diceValue = gameState.diceValue || 0;
  diceElement.textContent = diceValue > 0 ? diceValue : '';
  rollDiceBtn.disabled = currentPlayerId !== playerId || gameState.diceValue > 0;
  renderPawns();
}

function renderPawns() {
  document.querySelectorAll('.pawn').forEach(p=>p.remove());
  for (const [pawnId, pawn] of Object.entries(gameState.pawns || {})) {
    const idx = pawn.position;
    if (idx === -1) continue;
    const cell = document.querySelector(`.cell[data-index="${idx}"]`);
    if (!cell) continue;
    const el = document.createElement('div');
    el.className = `pawn ${pawn.color}`;
    el.dataset.pawnId = pawnId;
    el.textContent = pawn.index + 1;
    if (pawnId.startsWith(playerId) && canMovePawn(pawnId)) {
      el.classList.add('selectable');
      el.addEventListener('click', ()=> selectPawn(pawnId));
    }
    cell.appendChild(el);
  }
}

function canMovePawn(pawnId) {
  if (!gameState || !diceValue) return false;
  const keys = Object.keys(gameState.players || {});
  const currentPlayerId = keys[gameState.currentTurn % keys.length];
  if (!pawnId.startsWith(currentPlayerId)) return false;
  const pawn = gameState.pawns[pawnId];
  const path = PLAYER_POSITIONS[pawn.color].path;
  if (pawn.position === -1) return diceValue === 6;
  const curIdx = path.indexOf(pawn.position);
  if (curIdx === -1) return false;
  return (curIdx + diceValue) < path.length;
}

function selectPawn(pawnId) {
  document.querySelectorAll('.pawn.selected').forEach(x=>x.classList.remove('selected'));
  selectedPawn = pawnId;
  document.querySelector(`.pawn[data-pawn-id="${pawnId}"]`)?.classList.add('selected');
  movePawn(pawnId);
}

function rollDice() {
  const keys = Object.keys(gameState.players || {});
  const currentPlayerId = keys[gameState.currentTurn % keys.length];
  if (currentPlayerId !== playerId) return;
  rollDiceBtn.disabled = true;
  diceElement.classList.add('rolling');
  diceSound.play();
  let rolls = 0;
  const maxRolls = 10;
  const interval = setInterval(()=> {
    diceElement.textContent = Math.floor(Math.random()*6)+1;
    rolls++;
    if (rolls >= maxRolls) {
      clearInterval(interval);
      diceElement.classList.remove('rolling');
      const value = Math.floor(Math.random()*6)+1;
      updateGameState(currentRoom, { diceValue: value }).catch(e=>console.error(e));
    }
  }, 100);
}

function movePawn(pawnId) {
  if (!selectedPawn || !gameState || !diceValue) return;
  const pawn = gameState.pawns[pawnId];
  const owner = pawnId.split('-')[0];
  const player = gameState.players[owner];
  const path = PLAYER_POSITIONS[pawn.color].path;
  let newPos;
  if (pawn.position === -1) newPos = path[0];
  else {
    const curIdx = path.indexOf(pawn.position);
    newPos = path[curIdx + diceValue];
  }
  let killed = null;
  for (const [otherId, other] of Object.entries(gameState.pawns || {})) {
    if (other.position === newPos && !otherId.startsWith(owner)) {
      if (!isSafeCell(newPos)) { killed = otherId; break; }
    }
  }
  const updates = { diceValue:0, [`pawns/${pawnId}/position`]: newPos };
  if (killed) updates[`pawns/${killed}/position`] = -1;
  if (HOME_CELLS[pawn.color].includes(newPos)) {
    updates[`players/${owner}/finishedPawns`] = (player.finishedPawns || 0) + 1;
    if ((player.finishedPawns || 0) + 1 === 4) updates.winner = owner;
  }
  if (diceValue !== 6 || (updates.winner && !killed)) {
    updates.currentTurn = (gameState.currentTurn + 1) % Object.keys(gameState.players).length;
  }
  if (killed) killSound.play(); else moveSound.play();
  updateGameState(currentRoom, updates).catch(e=>console.error(e));
  selectedPawn = null;
}

// --- Chat ---
function setupChat(roomCode) {
  chatMessages.innerHTML = '';
  if (chatRef) chatRef.off();
  chatRef = listenToChatMessages(roomCode, msg => addChatMessage(msg.playerName, msg.message, msg.playerId === playerId));
}

function sendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;
  sendChatMessage(currentRoom, playerId, currentPlayer, message).then(()=> chatInput.value = '').catch(e=>console.error(e));
}

function addChatMessage(sender, message, isCurrent) {
  const el = document.createElement('div'); el.className = `chat-message ${isCurrent ? 'current' : ''}`;
  el.innerHTML = `<span class="sender">${sender}:</span> ${message}`;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Winner / cleanup ---
function showWinnerScreen(winnerId) {
  const w = gameState.players[winnerId];
  winnerName.textContent = w.name;
  winnerName.style.color = w.color;
  gameScreen.classList.add('hidden');
  winnerScreen.classList.remove('hidden');
  winSound.play();
  endGame(currentRoom);
}

function playAgain() {
  winnerScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  gameState = null; currentRoom = null; playerColor = null; isHost = false; diceValue = 0; selectedPawn = null;
  if (roomRef) roomRef.off();
  if (gameRef) gameRef.off();
  if (chatRef) chatRef.off();
  roomInfo.classList.add('hidden');
  roomCodeInput.value = '';
}