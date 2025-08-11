import {
    auth, database, signInAnonymously, createRoom, joinRoom, startGame,
    updateGameState, listenToRoomChanges, listenToGameChanges,
    sendChatMessage, listenToChatMessages, endGame
} from './firebase.js';

// --- UI Elements ---
const screens = {
    login: document.getElementById('login-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    winner: document.getElementById('winner-screen'),
};
// Login
const playerNameInput = document.getElementById('player-name');
const loginBtn = document.getElementById('login-btn');
// Lobby
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const roomInfo = document.getElementById('room-info');
const displayRoomCode = document.getElementById('display-room-code');
const copyRoomCodeBtn = document.getElementById('copy-room-code');
const playersList = document.getElementById('players-list');
const startGameBtn = document.getElementById('start-game-btn');
// Game
const boardElement = document.getElementById('ludo-board');
const diceElement = document.getElementById('dice');
const playerInfoElement = document.getElementById('player-info');
const messageElement = document.getElementById('message');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
// Winner
const winnerMessage = document.getElementById('winner-message');
const playAgainBtn = document.getElementById('play-again-btn');


// --- Game Constants for Traditional Board ---
const PLAYERS = ['green', 'yellow', 'blue', 'red'];
const START_INDICES = { green: 1, yellow: 14, blue: 27, red: 40 };
const HOME_ENTRY_INDICES = { green: 51, yellow: 12, blue: 25, red: 38 };
const HOME_COLUMN_LENGTH = 6;
const TOTAL_PATH_CELLS = 52;
const SAFE_ZONE_INDICES = [1, 9, 14, 22, 27, 35, 40, 48];
const pathCoords = [ { row: 7, col: 2 }, { row: 7, col: 3 }, { row: 7, col: 4 }, { row: 7, col: 5 }, { row: 7, col: 6 }, { row: 6, col: 7 }, { row: 5, col: 7 }, { row: 4, col: 7 }, { row: 3, col: 7 }, { row: 2, col: 7 }, { row: 1, col: 7 }, { row: 1, col: 8 }, { row: 1, col: 9 }, { row: 2, col: 9 }, { row: 3, col: 9 }, { row: 4, col: 9 }, { row: 5, col: 9 }, { row: 6, col: 9 }, { row: 7, col: 10 }, { row: 7, col: 11 }, { row: 7, col: 12 }, { row: 7, col: 13 }, { row: 7, col: 14 }, { row: 7, col: 15 }, { row: 8, col: 15 }, { row: 9, col: 15 }, { row: 9, col: 14 }, { row: 9, col: 13 }, { row: 9, col: 12 }, { row: 9, col: 11 }, { row: 9, col: 10 }, { row: 10, col: 9 }, { row: 11, col: 9 }, { row: 12, col: 9 }, { row: 13, col: 9 }, { row: 14, col: 9 }, { row: 15, col: 9 }, { row: 15, col: 8 }, { row: 15, col: 7 }, { row: 14, col: 7 }, { row: 13, col: 7 }, { row: 12, col: 7 }, { row: 11, col: 7 }, { row: 10, col: 7 }, { row: 9, col: 6 }, { row: 9, col: 5 }, { row: 9, col: 4 }, { row: 9, col: 3 }, { row: 9, col: 2 }, { row: 9, col: 1 }, { row: 8, col: 1 }, { row: 7, col: 1 } ];
const finalHomePathCoords = { green:  [{ row: 2, col: 8 }, { row: 3, col: 8 }, { row: 4, col: 8 }, { row: 5, col: 8 }, { row: 6, col: 8 }, { row: 7, col: 8 }], yellow: [{ row: 8, col: 2 }, { row: 8, col: 3 }, { row: 8, col: 4 }, { row: 8, col: 5 }, { row: 8, col: 6 }, { row: 8, col: 7 }], blue:   [{ row: 14, col: 8 }, { row: 13, col: 8 }, { row: 12, col: 8 }, { row: 11, col: 8 }, { row: 10, col: 8 }, { row: 9, col: 8 }], red:    [{ row: 8, col: 14 }, { row: 8, col: 13 }, { row: 8, col: 12 }, { row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 }] };


// --- Local State ---
let localPlayerId = null;
let localPlayerName = null;
let currentRoomId = null;
let isHost = false;
let gameState = null;
let roomListener = null;
let gameListener = null;
let chatListener = null;

// --- Functions ---
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

function handleLogin() {
    const name = playerNameInput.value.trim();
    if (!name) return alert("Please enter a name.");
    signInAnonymously(name).catch(err => alert(err.message));
}

auth.onAuthStateChanged(user => {
    if (user) {
        localPlayerId = user.uid;
        database.ref(`/users/${localPlayerId}/name`).once('value', snap => {
            localPlayerName = snap.val();
            showScreen('lobby');
        });
    } else {
        showScreen('login');
    }
});

// Lobby Logic
createRoomBtn.addEventListener('click', () => {
    createRoom(localPlayerName, localPlayerId).then(roomCode => {
        joinAndSetupRoom(roomCode, true);
    });
});

joinRoomBtn.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!roomCode) return alert("Please enter a room code.");
    joinRoom(roomCode, localPlayerName, localPlayerId)
        .then(roomCode => joinAndSetupRoom(roomCode, false))
        .catch(err => alert(err.message));
});

function joinAndSetupRoom(roomCode, isHostPlayer) {
    currentRoomId = roomCode;
    isHost = isHostPlayer;
    roomInfo.classList.remove('hidden');
    displayRoomCode.textContent = roomCode;
    startGameBtn.style.display = isHost ? 'block' : 'none';

    if (roomListener) roomListener.off();
    roomListener = listenToRoomChanges(roomCode, roomData => {
        if (!roomData) return;
        updateLobbyUI(roomData);
        if (roomData.status === 'playing') {
            setupGameScreen();
        }
    });
}

function updateLobbyUI(roomData) {
    playersList.innerHTML = '';
    const players = roomData.players || {};
    Object.values(players).forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name;
        playersList.appendChild(li);
    });
    startGameBtn.disabled = Object.keys(players).length < 2;
}

copyRoomCodeBtn.addEventListener('click', () => navigator.clipboard.writeText(currentRoomId));

startGameBtn.addEventListener('click', () => {
    database.ref(`rooms/${currentRoomId}/players`).once('value', snapshot => {
        const players = snapshot.val();
        const playerIds = Object.keys(players);
        const initialState = {
            playerOrder: playerIds,
            players: {},
            pawns: {},
            currentTurnIndex: 0,
            diceValue: null,
            winner: null,
        };

        playerIds.forEach((id, index) => {
            const color = PLAYERS[index];
            initialState.players[id] = { name: players[id].name, color, finishedPawns: 0 };
            for (let i = 0; i < 4; i++) {
                initialState.pawns[`pawn_${id}_${i}`] = {
                    playerId: id,
                    color: color,
                    pawnIndex: i,
                    positionId: `${color}-start-${i}`, // e.g., 'green-start-0'
                    state: 'start'
                };
            }
        });
        startGame(currentRoomId, initialState);
    });
});

// Game Screen Logic
function setupGameScreen() {
    showScreen('game');
    createBoard();
    if (gameListener) gameListener.off();
    gameListener = listenToGameChanges(currentRoomId, gState => {
        gameState = gState;
        if (gameState) {
            updateGameUI();
        }
    });
    if (chatListener) chatListener.off();
    chatListener = listenToChatMessages(currentRoomId, msg => {
        const self = msg.playerId === localPlayerId;
        const el = document.createElement('div');
        el.innerHTML = `<strong>${msg.playerName}:</strong> ${msg.message}`;
        el.style.textAlign = self ? 'right' : 'left';
        chatMessages.appendChild(el);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

function createBoard() {
    boardElement.innerHTML = '';
    const staticHTML = ` <div class="start-area green" id="start-area-green"> <div class="inner-yard"> <div class="pawn-start-spot" id="green-start-0"></div> <div class="pawn-start-spot" id="green-start-1"></div> <div class="pawn-start-spot" id="green-start-2"></div> <div class="pawn-start-spot" id="green-start-3"></div> </div> </div> <div class="start-area yellow" id="start-area-yellow"> <div class="inner-yard"> <div class="pawn-start-spot" id="yellow-start-0"></div> <div class="pawn-start-spot" id="yellow-start-1"></div> <div class="pawn-start-spot" id="yellow-start-2"></div> <div class="pawn-start-spot" id="yellow-start-3"></div> </div> </div> <div class="home-area"> <div class="home-triangle green"></div> <div class="home-triangle yellow"></div> <div class="home-triangle blue"></div> <div class="home-triangle red"></div> </div> <div class="start-area red" id="start-area-red"> <div class="inner-yard"> <div class="pawn-start-spot" id="red-start-0"></div> <div class="pawn-start-spot" id="red-start-1"></div> <div class="pawn-start-spot" id="red-start-2"></div> <div class="pawn-start-spot" id="red-start-3"></div> </div> </div> <div class="start-area blue" id="start-area-blue"> <div class="inner-yard"> <div class="pawn-start-spot" id="blue-start-0"></div> <div class="pawn-start-spot" id="blue-start-1"></div> <div class="pawn-start-spot" id="blue-start-2"></div> <div class="pawn-start-spot" id="blue-start-3"></div> </div> </div> `;
    boardElement.insertAdjacentHTML('afterbegin', staticHTML);

    pathCoords.forEach((coord, index) => {
        const cellId = `path-${index}`;
        const classes = ['path'];
        if (SAFE_ZONE_INDICES.includes(index)) classes.push('safe-zone');
        createCellElement(coord.row, coord.col, cellId, classes);
    });

    Object.entries(finalHomePathCoords).forEach(([color, coords]) => {
        coords.forEach((coord, index) => {
            const cellId = `${color}-home-${index}`;
            createCellElement(coord.row, coord.col, cellId, [`${color}-path`]);
        });
    });
}

function createCellElement(row, col, cellId, classes = []) {
    const cell = document.createElement('div');
    cell.classList.add('cell', ...classes);
    cell.style.gridRowStart = row;
    cell.style.gridColumnStart = col;
    cell.dataset.cellId = cellId;
    boardElement.appendChild(cell);
}

function updateGameUI() {
    // Render pawns
    document.querySelectorAll('.pawn').forEach(p => p.remove());
    Object.entries(gameState.pawns).forEach(([pawnId, pawnData]) => {
        const pawnEl = document.createElement('div');
        pawnEl.id = pawnId;
        pawnEl.classList.add('pawn', pawnData.color);
        const targetCell = document.getElementById(pawnData.positionId) || document.querySelector(`[data-cell-id='${pawnData.positionId}']`);
        if(targetCell) targetCell.appendChild(pawnEl);
    });

    const currentPlayerId = gameState.playerOrder[gameState.currentTurnIndex];
    const player = gameState.players[currentPlayerId];
    playerInfoElement.textContent = player.name;
    playerInfoElement.className = player.color;

    diceElement.textContent = gameState.diceValue || '?';
    
    if(currentPlayerId === localPlayerId && !gameState.diceValue){
        diceElement.classList.add('active');
    } else {
        diceElement.classList.remove('active');
    }

    // Highlight movable pawns for the current player
    clearPawnHighlights();
    if(currentPlayerId === localPlayerId && gameState.diceValue){
        const movable = getMovablePawns(localPlayerId, gameState.diceValue);
        highlightMovablePawns(movable);
    }
}

diceElement.addEventListener('click', () => {
    const currentPlayerId = gameState.playerOrder[gameState.currentTurnIndex];
    if (diceElement.classList.contains('active') && currentPlayerId === localPlayerId) {
        const diceValue = Math.floor(Math.random() * 6) + 1;
        const updates = { diceValue };

        // Auto-pass turn if no moves possible
        const pawnsOutside = Object.values(gameState.pawns).some(p => p.playerId === localPlayerId && p.state !== 'start');
        if (!pawnsOutside && diceValue !== 6) {
            updates.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.playerOrder.length;
            updates.diceValue = null; // Reset dice for next player
        }
        updateGameState(currentRoomId, updates);
    }
});

function highlightMovablePawns(pawnIds) {
    pawnIds.forEach(pawnId => {
        const pawnEl = document.getElementById(pawnId);
        if (pawnEl) {
            pawnEl.classList.add('movable');
            pawnEl.onclick = () => handlePawnClick(pawnId);
        }
    });
}

function clearPawnHighlights() {
    document.querySelectorAll('.pawn.movable').forEach(p => {
        p.classList.remove('movable');
        p.onclick = null;
    });
}

function getMovablePawns(playerId, diceValue) {
    const movable = [];
    Object.entries(gameState.pawns).forEach(([pawnId, pawn]) => {
        if (pawn.playerId !== playerId) return;
        
        if (pawn.state === 'start' && diceValue === 6) {
            movable.push(pawnId);
        } else if (pawn.state !== 'start' && pawn.state !== 'finished') {
            const target = calculateTargetPosition(pawn, diceValue);
            if(target.isValid) movable.push(pawnId);
        }
    });
    return movable;
}

function handlePawnClick(pawnId) {
    const pawn = gameState.pawns[pawnId];
    const diceValue = gameState.diceValue;

    const target = calculateTargetPosition(pawn, diceValue);
    if(!target.isValid) return;

    const updates = {};
    // Move the selected pawn
    updates[`pawns/${pawnId}/positionId`] = target.positionId;
    updates[`pawns/${pawnId}/state`] = target.state;

    // Check for capture
    if(target.state === 'path'){
        const pawnsOnTarget = Object.entries(gameState.pawns).filter(([id, p]) => p.positionId === target.positionId);
        const opponentPawns = pawnsOnTarget.filter(([id, p]) => p.playerId !== localPlayerId);

        if(opponentPawns.length === 1 && !SAFE_ZONE_INDICES.includes(parseInt(target.positionId.split('-')[1]))){
            const killedPawnId = opponentPawns[0][0];
            const killedPawnData = opponentPawns[0][1];
            updates[`pawns/${killedPawnId}/positionId`] = `${killedPawnData.color}-start-${killedPawnData.pawnIndex}`;
            updates[`pawns/${killedPawnId}/state`] = 'start';
        }
    }

    // Set next turn
    if (diceValue !== 6) {
        updates.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.playerOrder.length;
    }
    updates.diceValue = null;

    updateGameState(currentRoomId, updates);
}

function calculateTargetPosition(pawn, diceValue) {
    if (pawn.state === 'start') {
        const startIdx = START_INDICES[pawn.color];
        return { positionId: `path-${startIdx}`, state: 'path', isValid: true };
    }
    
    if (pawn.state === 'path') {
        let currentIdx = parseInt(pawn.positionId.split('-')[1]);
        const homeEntry = HOME_ENTRY_INDICES[pawn.color];
        for (let i = 0; i < diceValue; i++) {
            if (currentIdx === homeEntry) {
                const homeSteps = diceValue - (i + 1);
                if (homeSteps < HOME_COLUMN_LENGTH) {
                    const finalState = (homeSteps === HOME_COLUMN_LENGTH - 1) ? 'finished' : 'home';
                    return { positionId: `${pawn.color}-home-${homeSteps}`, state: finalState, isValid: true };
                } else {
                    return { isValid: false }; // Overshot
                }
            }
            currentIdx = (currentIdx + 1) % TOTAL_PATH_CELLS;
        }
        return { positionId: `path-${currentIdx}`, state: 'path', isValid: true };
    }

    if (pawn.state === 'home') {
        let currentHomeIdx = parseInt(pawn.positionId.split('-')[2]);
        const newHomeIdx = currentHomeIdx + diceValue;
        if (newHomeIdx < HOME_COLUMN_LENGTH) {
            const finalState = (newHomeIdx === HOME_COLUMN_LENGTH - 1) ? 'finished' : 'home';
            return { positionId: `${pawn.color}-home-${newHomeIdx}`, state: finalState, isValid: true };
        } else {
            return { isValid: false }; // Overshot
        }
    }
    return {isValid: false};
}

// Chat
sendChatBtn.addEventListener('click', () => {
    const msg = chatInput.value.trim();
    if(msg) sendChatMessage(currentRoomId, localPlayerId, localPlayerName, msg);
    chatInput.value = '';
});