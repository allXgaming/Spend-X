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
  endGame
} from './firebase.js';

// --- Game constants ---
const COLORS = ['red', 'blue', 'green', 'yellow'];
const PLAYER_PATHS = {
    red: [22, 23, 24, 25, 39, 53, 67, 81, 95, 109, 123, 124, 125, 126, 127, 128, 114, 100, 86, 72, 58, 59, 60, 61, 62, 76, 90, 91, 92, 93, 94, 108, 122, 136, 150, 164, 178, 177, 176, 175, 161, 147, 133, 119, 105, 104, 103, 102, 101, 87, 73, 74, 75, 76, 77, 89],
    blue: [128, 114, 100, 86, 72, 58, 59, 60, 61, 62, 76, 90, 91, 92, 93, 94, 108, 122, 136, 150, 164, 178, 177, 176, 175, 161, 147, 133, 119, 105, 104, 103, 102, 101, 87, 73, 59, 45, 31, 17, 3, 4, 5, 6, 20, 34, 48, 47, 46, 45, 44, 30, 16, 15, 16, 17, 18, 19, 33, 47, 61, 75],
    green: [176, 162, 148, 134, 120, 106, 105, 104, 103, 102, 88, 74, 60, 46, 32, 18, 4, 5, 6, 7, 21, 35, 49, 48, 47, 46, 45, 31, 17, 3, 16, 2, 22, 23, 24, 25, 39, 53, 67, 81, 95, 109, 123, 124, 125, 126, 127, 141, 155, 169, 170, 171, 172, 173, 159, 145, 131, 117],
    yellow: [60, 74, 88, 102, 116, 130, 144, 158, 172, 186, 200, 199, 198, 197, 196, 182, 168, 154, 140, 126, 125, 124, 123, 122, 108, 94, 80, 79, 78, 77, 76, 62, 48, 34, 20, 6, 7, 8, 9, 23, 37, 51, 65, 64, 63, 62, 61, 75, 89, 103, 117, 118, 119, 120, 121, 107, 93, 79]
};
const START_POSITIONS = { red: [36, 37, 50, 51], blue: [8, 9, 22, 23], green: [156, 157, 170, 171], yellow: [65, 66, 79, 80] };
const HOME_ENTRANCE = { red: 73, blue: 115, green: 131, yellow: 89 };
const HOME_CELLS = { red: [89, 88, 87, 86, 85, 84], blue: [75, 61, 47, 33, 19, 5], green: [117, 118, 119, 120, 121, 122], yellow: [131, 145, 159, 173, 187, 201] };
const SAFE_CELLS = [22, 128, 176, 60, 39, 114, 161, 74];

// --- State ---
let currentPlayer = null;
let currentRoom = null;
let gameState = null;
let playerColor = null;
let playerId = null;
let isHost = false;
let diceValue = 0;
let selectedPawn = null;
let roomUnsubscribe = null;
let gameUnsubscribe = null;
let chatUnsubscribe = null;

// --- DOM Elements ---
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

// --- Event Listeners ---
loginBtn.addEventListener('click', handleLogin);
playerNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
createRoomBtn.addEventListener('click', handleCreateRoom);
joinRoomBtn.addEventListener('click', handleJoinRoom);
roomCodeInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleJoinRoom(); });
copyRoomCode.addEventListener('click', copyRoomCodeToClipboard);
startGameBtn.addEventListener('click', startGameHandler);
rollDiceBtn.addEventListener('click', rollDice);
sendChatBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
playAgainBtn.addEventListener('click', playAgain);

// --- Initialization ---
auth.onAuthStateChanged(user => {
  if (user) {
    playerId = user.uid;
    database.ref(`users/${playerId}/name`).once('value').then(snapshot => {
      currentPlayer = snapshot.val() || `Player-${playerId.slice(0, 5)}`;
      showScreen('lobby');
    });
  } else {
    showScreen('login');
  }
});

// --- Screen Management ---
function showScreen(screenName) {
    [loginScreen, lobbyScreen, gameScreen, winnerScreen].forEach(s => s.classList.add('hidden'));
    document.getElementById(`${screenName}-screen`).classList.remove('hidden');
}


// --- Handlers ---
function handleLogin() {
    const name = playerNameInput.value.trim();
    if (!name) { alert('Please enter your name.'); return; }
    loginBtn.disabled = true;
    signInAnonymously(name).catch(err => {
        console.error('Login Error:', err);
        alert('Could not log in. Please check your connection and Firebase setup.');
        loginBtn.disabled = false;
    });
}

function handleCreateRoom() {
    createRoomBtn.disabled = true;
    createRoom(currentPlayer, playerId).then(roomCode => {
        setupRoom(roomCode, true);
    }).catch(err => {
        alert('Could not create a room. Please try again.');
        createRoomBtn.disabled = false;
    });
}

function handleJoinRoom() {
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!roomCode || roomCode.length !== 6) { alert('Please enter a valid 6-character room code.'); return; }
    joinRoomBtn.disabled = true;
    joinRoom(roomCode, currentPlayer, playerId).then(rc => {
        setupRoom(rc, false);
    }).catch(err => {
        alert(err.message);
        joinRoomBtn.disabled = false;
    });
}

function setupRoom(roomCode, isHostPlayer) {
    currentRoom = roomCode;
    isHost = isHostPlayer;
    displayRoomCode.textContent = roomCode;
    roomInfo.classList.remove('hidden');
    startGameBtn.style.display = isHost ? 'block' : 'none';
    
    roomUnsubscribe = listenToRoomChanges(roomCode, (roomData) => {
        if (!roomData) {
            alert('The room has been closed.');
            resetLobby();
            return;
        }
        updatePlayersList(roomData.players);
        if(isHost) {
            const numPlayers = roomData.players ? Object.keys(roomData.players).length : 0;
            startGameBtn.disabled = numPlayers < 2;
        }
        if (roomData.status === 'playing') {
            showGameScreen();
        }
    });
}

function updatePlayersList(players) {
    playersList.innerHTML = '';
    const numPlayers = players ? Object.keys(players).length : 0;
    playerCount.textContent = numPlayers;
    for (const id in players) {
        const p = players[id];
        const li = document.createElement('li');
        li.textContent = `${p.name} ${id === playerId ? '(You)' : ''}`;
        if(p.color) {
            li.style.color = p.color;
            li.style.fontWeight = 'bold';
        }
        playersList.appendChild(li);
    }
}

function copyRoomCodeToClipboard() {
    navigator.clipboard.writeText(currentRoom).then(() => {
        copyRoomCode.textContent = 'Copied!';
        setTimeout(() => { copyRoomCode.textContent = 'Copy Code'; }, 2000);
    });
}


// --- Game Logic ---
function startGameHandler() {
    if (!isHost || !currentRoom) return;
    database.ref(`rooms/${currentRoom}/players`).once('value').then(snapshot => {
        const players = snapshot.val();
        const playerIds = Object.keys(players);
        const colorUpdates = {};
        const initialState = {
            players: {},
            pawns: {},
            currentTurnIndex: 0,
            diceValue: 0,
            winner: null,
            status: 'playing'
        };

        playerIds.forEach((id, index) => {
            const color = COLORS[index];
            colorUpdates[`/rooms/${currentRoom}/players/${id}/color`] = color;
            initialState.players[id] = { name: players[id].name, color, finishedPawns: 0 };
            for (let i = 0; i < 4; i++) {
                initialState.pawns[`${id}-${i}`] = {
                    position: -1, // -1 means in the yard
                    color: color,
                    pawnIndex: i,
                    ownerId: id
                };
            }
        });
        
        database.ref().update(colorUpdates).then(() => {
            startGame(currentRoom, initialState);
        });
    });
}

function showGameScreen() {
    showScreen('game');
    createBoard();
    gameRoomCode.textContent = currentRoom;

    gameUnsubscribe = listenToGameChanges(currentRoom, (game) => {
        if (!game) return;
        gameState = game;
        updateGameUI();
    });

    chatUnsubscribe = listenToChatMessages(currentRoom, (msg) => {
        addChatMessage(msg.playerName, msg.message, msg.playerId === playerId);
    });
}

function createBoard() {
    gameBoard.innerHTML = '';
    const board = document.createElement('div');
    board.className = 'board';
    // Simplified board creation - adjust grid size if needed
    for (let i = 0; i < 225; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = i;
        // Add styling for path, home, etc. based on constants
        board.appendChild(cell);
    }
    gameBoard.appendChild(board);
}


function updateGameUI() {
    if (!gameState || !gameState.players) return;

    if (gameState.winner) {
        showWinnerScreen(gameState.winner);
        return;
    }
    
    const playerIds = Object.keys(gameState.players);
    const currentPlayerId = playerIds[gameState.currentTurnIndex % playerIds.length];
    const CPlayer = gameState.players[currentPlayerId];
    
    currentPlayerDisplay.textContent = CPlayer.name;
    currentPlayerDisplay.style.color = CPlayer.color;
    
    diceValue = gameState.diceValue || 0;
    diceElement.textContent = diceValue > 0 ? diceValue : '';
    
    rollDiceBtn.disabled = (currentPlayerId !== playerId) || (diceValue > 0);
    
    renderPawns();
}

function renderPawns() {
    document.querySelectorAll('.pawn').forEach(p => p.remove());

    for (const pawnId in gameState.pawns) {
        const pawnData = gameState.pawns[pawnId];
        let cell;
        
        if (pawnData.position === -1) { // In yard
            const startYardCells = START_POSITIONS[pawnData.color];
            cell = document.querySelector(`.cell[data-index="${startYardCells[pawnData.pawnIndex]}"]`);
        } else { // On board
             cell = document.querySelector(`.cell[data-index="${pawnData.position}"]`);
        }

        if (cell) {
            const pawnEl = document.createElement('div');
            pawnEl.className = `pawn ${pawnData.color}`;
            pawnEl.dataset.pawnId = pawnId;

            if (pawnData.ownerId === playerId && isPawnMovable(pawnId)) {
                pawnEl.classList.add('movable');
                pawnEl.addEventListener('click', () => handlePawnClick(pawnId));
            }
            
            cell.appendChild(pawnEl);
        }
    }
}

function isPawnMovable(pawnId) {
    if (!diceValue) return false;
    const pawn = gameState.pawns[pawnId];
    // Rule: Move from yard only on 6
    if (pawn.position === -1) return diceValue === 6;
    // Rule: Don't move if it overshoots the home
    const path = PLAYER_PATHS[pawn.color];
    const currentIndex = path.indexOf(pawn.position);
    if (currentIndex + diceValue >= path.length) return false;
    
    return true;
}

function handlePawnClick(pawnId) {
    if (!isPawnMovable(pawnId)) return;
    
    const pawn = gameState.pawns[pawnId];
    const path = PLAYER_PATHS[pawn.color];
    let newPosition;

    if (pawn.position === -1) { // Move out from yard
        newPosition = path[0];
    } else { // Move on the board
        const currentIndex = path.indexOf(pawn.position);
        newPosition = path[currentIndex + diceValue];
    }

    const updates = {};
    updates[`games/${currentRoom}/pawns/${pawnId}/position`] = newPosition;

    // Check for captures
    let capturedPawnId = null;
    if (!SAFE_CELLS.includes(newPosition)) {
        for (const otherPawnId in gameState.pawns) {
            const otherPawn = gameState.pawns[otherPawnId];
            if (otherPawn.position === newPosition && otherPawn.ownerId !== pawn.ownerId) {
                capturedPawnId = otherPawnId;
                break;
            }
        }
    }

    if (capturedPawnId) {
        updates[`games/${currentRoom}/pawns/${capturedPawnId}/position`] = -1; // Send back to yard
    }

    // Check for win
    const playerInfo = gameState.players[pawn.ownerId];
    if (path.indexOf(newPosition) === path.length - 1) { // Reached final home cell
        playerInfo.finishedPawns = (playerInfo.finishedPawns || 0) + 1;
        updates[`games/${currentRoom}/players/${pawn.ownerId}/finishedPawns`] = playerInfo.finishedPawns;
        if (playerInfo.finishedPawns === 4) {
            updates[`games/${currentRoom}/winner`] = pawn.ownerId;
        }
    }

    // Advance turn or give another turn on 6 or capture
    if (diceValue !== 6 && !capturedPawnId) {
        const playerIds = Object.keys(gameState.players);
        updates[`games/${currentRoom}/currentTurnIndex`] = (gameState.currentTurnIndex + 1) % playerIds.length;
    }
    
    updates[`games/${currentRoom}/diceValue`] = 0; // Reset dice

    database.ref().update(updates);
}


function rollDice() {
    rollDiceBtn.disabled = true;
    const value = Math.floor(Math.random() * 6) + 1;
    
    const updates = { diceValue: value };
    
    // Check if any pawn can move. If not, pass turn.
    const movablePawns = Object.keys(gameState.pawns).filter(pId => 
        gameState.pawns[pId].ownerId === playerId && (
            (gameState.pawns[pId].position !== -1) || (value === 6)
        )
    );
    
    if (movablePawns.length === 0 && value !== 6) {
        const playerIds = Object.keys(gameState.players);
        updates.currentTurnIndex = (gameState.currentTurnIndex + 1) % playerIds.length;
        updates.diceValue = 0; // Reset dice immediately
    }
    
    updateGameState(currentRoom, updates);
}

// --- Chat ---
function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    sendChatMessage(currentRoom, playerId, currentPlayer, message).then(() => {
        chatInput.value = '';
    });
}

function addChatMessage(sender, message, isSelf) {
    const el = document.createElement('div');
    el.className = 'chat-message';
    el.innerHTML = `<span class="sender" style="color: ${isSelf ? '#1a73e8' : '#34a853'}">${sender}:</span> ${message}`;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// --- End Game / Reset ---
function showWinnerScreen(winnerId) {
    const winnerData = gameState.players[winnerId];
    winnerName.textContent = `${winnerData.name} wins!`;
    winnerName.style.color = winnerData.color;
    showScreen('winner');
    endGame(currentRoom); // Clean up game data in Firebase
    unsubscribeAll();
}

function playAgain() {
    showScreen('lobby');
    resetLobby();
}

function resetLobby() {
    roomInfo.classList.add('hidden');
    roomCodeInput.value = '';
    playersList.innerHTML = '';
    startGameBtn.disabled = true;
    unsubscribeAll();
    currentRoom = null;
    isHost = false;
}

function unsubscribeAll() {
    if (roomUnsubscribe) roomUnsubscribe();
    if (gameUnsubscribe) gameUnsubscribe();
    if (chatUnsubscribe) chatUnsubscribe();
}