// আপনার নিজের Firebase প্রজেক্টের তথ্য এখানে বসান
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyALYouem_Vn174JpZG0iyzK2la_zfWLpII",
  authDomain: "testing-1-c9082.firebaseapp.com",
  databaseURL: "https://testing-1-c9082-default-rtdb.firebaseio.com",
  projectId: "testing-1-c9082",
  storageBucket: "testing-1-c9082.firebasestorage.app",
  messagingSenderId: "837056619287",
  appId: "1:837056619287:web:62a3fa0b91b73e7907cd52",
  measurementId: "G-8HRMFTF6RT"
};

// Firebase অ্যাপ শুরু করা
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// এক্সপোর্টস
export const auth = firebase.auth();
export const database = firebase.database();

// --- Helper Functions ---

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}


// --- Exported Functions ---

export async function signInAnonymously(playerName) {
  if (!playerName) throw new Error('Player name is required');
  const result = await auth.signInAnonymously();
  const user = result.user;
  await database.ref(`users/${user.uid}`).set({
    name: playerName,
    lastSeen: firebase.database.ServerValue.TIMESTAMP,
  });
  return user;
}

export async function createRoom(playerName, playerId) {
  const roomCode = generateRoomCode();
  const roomRef = database.ref(`rooms/${roomCode}`);
  await roomRef.set({
    host: playerId,
    players: {
      [playerId]: { name: playerName }
    },
    status: 'waiting',
    createdAt: firebase.database.ServerValue.TIMESTAMP,
  });
  return roomCode;
}

export async function joinRoom(roomCode, playerName, playerId) {
  const roomRef = database.ref(`rooms/${roomCode}`);
  const snapshot = await roomRef.once('value');
  if (!snapshot.exists()) throw new Error('Room does not exist.');
  const room = snapshot.val();
  if (room.status !== 'waiting') throw new Error('Game has already started.');
  if (Object.keys(room.players).length >= 4) throw new Error('Room is full.');
  await roomRef.child('players').child(playerId).set({ name: playerName });
  return roomCode;
}

export async function startGame(roomCode, gameState) {
  await database.ref(`rooms/${roomCode}`).update({ status: 'playing' });
  await database.ref(`games/${roomCode}`).set(gameState);
}

export function updateGameState(roomCode, updates) {
  return database.ref(`games/${roomCode}`).update(updates);
}

export function listenToRoomChanges(roomCode, callback) {
  const ref = database.ref(`rooms/${roomCode}`);
  ref.on('value', snap => callback(snap.val()));
  return ref;
}

export function listenToGameChanges(roomCode, callback) {
  const ref = database.ref(`games/${roomCode}`);
  ref.on('value', snap => callback(snap.val()));
  return ref;
}

export function sendChatMessage(roomCode, playerId, playerName, message) {
  const chatRef = database.ref(`chats/${roomCode}`).push();
  return chatRef.set({ playerId, playerName, message, timestamp: firebase.database.ServerValue.TIMESTAMP });
}

export function listenToChatMessages(roomCode, callback) {
  const ref = database.ref(`chats/${roomCode}`);
  ref.on('child_added', snap => callback(snap.val()));
  return ref;
}

export async function endGame(roomCode) {
    // We can simply remove the game state to clean up
  await database.ref(`games/${roomCode}`).remove();
  await database.ref(`rooms/${roomCode}`).update({ status: 'ended' });
}