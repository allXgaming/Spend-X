// Firebase কনফিগারেশন - আপনার নিজের তথ্য এখানে বসান
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

// --- বাকি ফাংশনগুলি এখানে অপরিবর্তিত থাকবে ---

export async function signInAnonymously(playerName) {
  if (!playerName) throw new Error('Player name required');
  if (auth.currentUser) {
    await database.ref(`users/${auth.currentUser.uid}`).update({ name: playerName });
    return auth.currentUser;
  }
  const result = await auth.signInAnonymously();
  const user = result.user;
  await database.ref(`users/${user.uid}`).set({
    name: playerName,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
  });
  return user;
}

export async function createRoom(playerName, playerId) {
  const roomCode = generateRoomCode();
  const roomRef = database.ref(`rooms/${roomCode}`);
  const roomData = {
    host: playerId,
    players: {
      [playerId]: { name: playerName, color: null, ready: true }
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
  if (room.status !== 'waiting') throw new Error('Game has already started');
  const count = room.players ? Object.keys(room.players).length : 0;
  if (count >= 4) throw new Error('Room is full');
  await roomRef.child('players').child(playerId).set({ name: playerName, color: null, ready: true });
  return roomCode;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

export async function endGame(roomCode) {
  const updates = {};
  updates[`games/${roomCode}`] = null;
  updates[`chats/${roomCode}`] = null;
  updates[`rooms/${roomCode}/status`] = 'ended';
  await database.ref().update(updates);
}