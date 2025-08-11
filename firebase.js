const firebaseConfig = {
  apiKey: "AIzaSyDIMVAo1NLjU9qAyzKIk9cBuC-8_rQiPAs",
  authDomain: "multiplayer-game-testing-b7f9c.firebaseapp.com",
  databaseURL: "https://multiplayer-game-testing-b7f9c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "multiplayer-game-testing-b7f9c",
  storageBucket: "multiplayer-game-testing-b7f9c.firebasestorage.app",
  messagingSenderId: "381763945907",
  appId: "1:381763945907:web:c608c6b357f06a581a37c6"
};
// Initialize Firebase app (safe to call multiple times)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Exports
export const auth = firebase.auth();
export const database = firebase.database();

/**
 * Sign in anonymously and record the chosen playerName under /users/{uid}
 * Returns: firebase.User
 */
export async function signInAnonymously(playerName) {
  if (!playerName) throw new Error('Player name required');

  // If already signed in, simply ensure name is stored
  if (auth.currentUser) {
    const u = auth.currentUser;
    await database.ref(`users/${u.uid}`).set({
      name: playerName,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
    return u;
  }

  // Sign in anonymously
  const result = await auth.signInAnonymously();
  const user = auth.currentUser;
  // Store player info in database
  await database.ref(`users/${user.uid}`).set({
    name: playerName,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    lastSeen: firebase.database.ServerValue.TIMESTAMP
  });
  return user;
}

// Rooms
export async function createRoom(playerName, playerId) {
  const roomCode = generateRoomCode();
  const roomRef = database.ref(`rooms/${roomCode}`);
  const roomData = {
    host: playerId,
    players: {
      [playerId]: {
        name: playerName,
        color: null,
        ready: true
      }
    },
    status: 'waiting',
    createdAt: firebase.database.ServerValue.TIMESTAMP
  };
  await roomRef.set(roomData);
  return roomCode;
}

export async function joinRoom(roomCode, playerName, playerId) {
  const roomRef = database.ref(`rooms/${roomCode}`);
  const snapshot = await roomRef.once('value');
  if (!snapshot.exists()) throw new Error('Room does not exist');
  const room = snapshot.val();
  if (room.status !== 'waiting') throw new Error('Game already started');
  const count = room.players ? Object.keys(room.players).length : 0;
  if (count >= 4) throw new Error('Room is full');

  await roomRef.child('players').child(playerId).set({
    name: playerName,
    color: null,
    ready: true
  });
  return roomCode;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

// Game state functions
export async function startGame(roomCode, gameState) {
  const roomRef = database.ref(`rooms/${roomCode}`);
  const gameRef = database.ref(`games/${roomCode}`);
  await roomRef.update({ status: 'playing' });
  await gameRef.set(gameState);
}

export function updateGameState(roomCode, updates) {
  return database.ref(`games/${roomCode}`).update(updates);
}

export function listenToRoomChanges(roomCode, callback) {
  const roomRef = database.ref(`rooms/${roomCode}`);
  roomRef.on('value', snap => callback(snap.val()));
  return roomRef;
}

export function listenToGameChanges(roomCode, callback) {
  const gameRef = database.ref(`games/${roomCode}`);
  gameRef.on('value', snap => callback(snap.val()));
  return gameRef;
}

// Chat helpers
export function sendChatMessage(roomCode, playerId, playerName, message) {
  const chatRef = database.ref(`chats/${roomCode}`).push();
  return chatRef.set({
    playerId,
    playerName,
    message,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
}

export function listenToChatMessages(roomCode, callback) {
  const chatRef = database.ref(`chats/${roomCode}`);
  chatRef.on('child_added', snap => callback(snap.val()));
  return chatRef;
}

// Cleanup
export async function leaveRoom(roomCode, playerId) {
  await database.ref(`rooms/${roomCode}/players/${playerId}`).remove();
  const playersSnap = await database.ref(`rooms/${roomCode}/players`).once('value');
  if (!playersSnap.exists() || playersSnap.numChildren() === 0) {
    await database.ref(`rooms/${roomCode}`).remove();
  }
}

export async function endGame(roomCode) {
  const updates = {};
  updates[`games/${roomCode}`] = null;
  updates[`chats/${roomCode}`] = null;
  updates[`rooms/${roomCode}/status`] = 'ended';
  await database.ref().update(updates);
}