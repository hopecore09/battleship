const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameManager = require('./gameManager');
const UserManager = require('./userManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const games = new GameManager();
const users = new UserManager();

app.use(express.static(path.join(__dirname, '../client')));

const handleJoin = (socket, { username }) => {
  const name = users.register(socket.id, username);
  socket.emit('user:joined', { username: name, stats: users.getStats(name) });
  socket.emit('games:list', games.list());
  socket.broadcast.emit('games:update', games.list());
};

const handleCreate = (socket, { playerName, gridSize, ships }) => {
  const game = games.create(playerName, gridSize, ships);
  socket.join(game.id);
  socket.emit('game:created', game);
  io.emit('games:update', games.list());
};

const handleJoinGame = (socket, { gameId, playerName }) => {
  const game = games.join(gameId, playerName);
  if (!game) { socket.emit('game:joinError', 'Cannot join'); return; }
  socket.join(gameId);
  socket.emit('game:joined', game);
  io.to(gameId).emit('game:update', game);
  io.emit('games:update', games.list());
};

const handleReady = (socket, { gameId, playerId, board }) => {
  const game = games.ready(gameId, playerId, board);
  if (!game) return;
  io.to(gameId).emit('game:update', game);
  if (game.status === 'playing') io.to(gameId).emit('game:start');
};

const handleMove = (socket, { gameId, playerId, position }) => {
  const result = games.move(gameId, playerId, position);
  if (!result) { socket.emit('game:moveError', 'Invalid move'); return; }
  io.to(gameId).emit('game:move', result);
  if (result.winner) handleWin(gameId, result);
};

const handleWin = (gameId, result) => {
  const game = games.games?.[gameId];
  if (!game) return;
  const loser = Object.keys(game.players).find(p => p !== result.winner);
  users.recordWin(result.winner);
  if (loser) users.recordLoss(loser);
  io.to(gameId).emit('game:over', result);
  io.emit('games:update', games.list());
};

const handleAutoPlace = (socket, { gameId, playerId }) => {
  const board = games.autoPlace(gameId, playerId);
  if (board) socket.emit('game:autoplaced', { playerId, board });
};

const handleExit = (socket, { gameId, playerName }) => {
  const game = games.games?.[gameId];
  if (!game) return;
  const opponent = Object.keys(game.players).find(p => p !== playerName);
  if (opponent) {
    users.recordWin(opponent);
    users.recordLoss(playerName);
    io.to(gameId).emit('game:opponentLeft', `${playerName} left — you win!`);
    io.to(gameId).emit('game:over', { winner: opponent });
  }
  games.remove(gameId);
  io.emit('games:update', games.list());
  socket.leave(gameId);
};

const handleStatsGet = (socket, { username }) => {
  const stats = users.getStats(username);
  socket.emit('stats:update', { username, stats });
};

const handleDisconnect = (socket) => {
  const name = users.unregister(socket.id);
  if (!name) return;
  const toRemove = [];
  for (const [id, game] of Object.entries(games.games || {})) {
    if (game.players[name]) {
      const opponent = Object.keys(game.players).find(p => p !== name);
      if (opponent) {
        users.recordWin(opponent);
        users.recordLoss(name);
        io.to(id).emit('game:opponentLeft', `${name} disconnected — you win!`);
        io.to(id).emit('game:over', { winner: opponent });
      }
      toRemove.push(id);
    }
  }
  toRemove.forEach(id => games.remove(id));
  if (toRemove.length) io.emit('games:update', games.list());
};

io.on('connection', (socket) => {
  socket.on('user:join', data => handleJoin(socket, data));
  socket.on('game:create', data => handleCreate(socket, data));
  socket.on('game:join', data => handleJoinGame(socket, data));
  socket.on('game:ready', data => handleReady(socket, data));
  socket.on('game:move', data => handleMove(socket, data));
  socket.on('game:autoplace', data => handleAutoPlace(socket, data));
  socket.on('game:exit', data => handleExit(socket, data));
  socket.on('stats:get', data => handleStatsGet(socket, data));
  socket.on('disconnect', () => handleDisconnect(socket));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
