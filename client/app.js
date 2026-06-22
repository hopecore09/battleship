document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const $ = id => document.getElementById(id);
  
  const DOM = {
    username: $('username-input'),
    joinBtn: $('join-btn'),
    playerName: $('player-name'),
    gamesList: $('games-list'),
    createBtn: $('create-game-btn'),
    gridSize: $('grid-size'),
    shipsConfig: $('ships-config'),
    createConfirm: $('create-game-confirm'),
    myBoard: $('my-board'),
    enemyBoard: $('enemy-board'),
    gameStatus: $('game-status'),
    gamePlayers: $('game-players'),
    autoBtn: $('auto-place-btn'),
    readyBtn: $('ready-btn'),
    rotateBtn: $('rotate-btn'),
    resetBtn: $('reset-ships-btn'),
    exitBtn: $('exit-game-btn'),
    enemyInfo: $('enemy-info'),
    controls: $('game-controls'),
    shipSelection: $('ship-selection'),
    statsGames: $('stats-games'),
    statsWins: $('stats-wins'),
    statsLosses: $('stats-losses')
  };

  const state = {
    user: null, game: null, gameId: null, isMyTurn: false,
    selectedShip: null, orientation: 'horizontal', isReady: false,
    myBoard: [], enemyBoard: [], remaining: [], gameOver: false
  };

  const updateStatsDisplay = (stats) => {
    if (!stats) return;
    DOM.statsGames.textContent = stats.games || 0;
    DOM.statsWins.textContent = stats.wins || 0;
    DOM.statsLosses.textContent = stats.losses || 0;
  };

  const fetchStats = () => {
    if (state.user) {
      socket.emit('stats:get', { username: state.user });
    }
  };

  const showToast = (msg, type = 'info') => {
    const t = $('toast');
    t.textContent = msg;
    t.className = `toast ${type}`;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 3000);
  };

  const showScreen = id => {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    $(id).classList.remove('hidden');
    if (id === 'lobby-screen' && state.user) {
      fetchStats();
    }
  };

  const updateTurnStatus = () => {
    const text = state.isMyTurn ? 'Your turn' : 'Opponent\'s turn';
    DOM.gameStatus.textContent = text;
    DOM.gameStatus.className = state.isMyTurn ? 'tag is-medium is-success' : 'tag is-medium is-warning';
  };

  const emptyBoard = size => Array.from({ length: size }, () => Array(size).fill(''));

const renderGames = games => {
  DOM.gamesList.innerHTML = '';
  const available = Object.values(games).filter(g => g.status === 'waiting');
  if (!available.length) {
    DOM.gamesList.innerHTML = '<p class="has-text-centered has-text-grey-light">No games</p>';
    return;
  }
  available.forEach(game => {
    const card = document.createElement('div');
    card.className = 'column is-one-third';
    const room = game.id.split('_')[0];
    const shipsText = [...game.fleet].sort((a,b) => b - a).join(' ');
    
    card.innerHTML = `
      <div class="card">
        <div class="card-content has-text-centered">
          <p class="title is-6">${room}'s game</p>
          <p class="subtitle is-7">${game.size}x${game.size}</p>
          <p class="is-size-7 has-text-grey-light" style="font-size:0.7rem;">${shipsText}</p>
          <button class="button is-primary is-small">Join</button>
        </div>
      </div>
    `;
    card.querySelector('button').onclick = () => {
      socket.emit('game:join', { gameId: game.id, playerName: state.user });
    };
    DOM.gamesList.appendChild(card);
  });
};

  const createCell = (row, col, value, isEnemy = false) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    if (isEnemy) cell.classList.add('enemy-cell');
    cell.dataset.row = row;
    cell.dataset.col = col;
    const map = { ship: 'ship-placed', hit: 'hit', miss: 'miss', 'adjacent-miss': 'adjacent-miss' };
    if (map[value]) cell.classList.add(map[value]);
    return cell;
  };

    const renderBoard = (board, container, isEnemy = false) => {
    const size = board.length;
    container.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    container.innerHTML = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = createCell(r, c, board[r][c], isEnemy);
        if (isEnemy && state.isMyTurn && state.game?.status === 'playing' && !board[r][c]) {
          cell.classList.add('can-shoot');
          cell.style.cursor = 'pointer';
          cell.onclick = () => makeMove(r, c);
        }
        if (!isEnemy && !state.isReady && state.game?.status === 'waiting') {
          cell.onclick = () => handleCellClick(r, c);
          cell.onmouseenter = () => previewShip(r, c);
          cell.onmouseleave = clearPreview;
        }
        container.appendChild(cell);
      }
    }
    if (!isEnemy && state.game?.status === 'waiting') {
      updateShipSelection();
    }
  };

const renderMyBoard = () => renderBoard(state.myBoard, DOM.myBoard);
const renderEnemyBoard = () => renderBoard(state.enemyBoard, DOM.enemyBoard, true);

  const canPlaceShip = (row, col, size, horiz) => {
    const n = state.myBoard.length;
    for (let i = 0; i < size; i++) {
      const r = horiz ? row : row + i;
      const c = horiz ? col + i : col;
      if (r >= n || c >= n || state.myBoard[r][c]) return false;
    }
    return true;
  };

  const hasAdjacentShip = (row, col, size, horiz) => {
    const n = state.myBoard.length;
    for (let i = 0; i < size; i++) {
      const r = horiz ? row : row + i;
      const c = horiz ? col + i : col;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && state.myBoard[nr][nc] === 'ship') {
            return true;
          }
        }
      }
    }
    return false;
  };

  const placeShip = (row, col, size, horiz) => {
    for (let i = 0; i < size; i++) {
      const r = horiz ? row : row + i;
      const c = horiz ? col + i : col;
      state.myBoard[r][c] = 'ship';
    }
    const idx = state.remaining.indexOf(size);
    if (idx > -1) state.remaining.splice(idx, 1);
    renderMyBoard();
    DOM.readyBtn.disabled = state.remaining.length > 0;
  };

  const handleCellClick = (row, col) => {
    if (state.isReady || state.game?.status !== 'waiting') return;
    if (!state.remaining.length) {
      state.selectedShip = null;
      clearShipSelection();
      return;
    }
    if (!state.selectedShip) { showToast('Select a ship', 'error'); return; }
    if (!state.remaining.includes(state.selectedShip)) {
      state.selectedShip = null;
      clearShipSelection();
      return;
    }
    const horiz = state.orientation === 'horizontal';
    const size = state.selectedShip;
    if (!canPlaceShip(row, col, size, horiz)) {
      showToast('Cannot place here', 'error');
      return;
    }
    if (hasAdjacentShip(row, col, size, horiz)) {
      showToast('Ships cannot touch', 'error');
      return;
    }
    placeShip(row, col, size, horiz);
  };

  const clearShipSelection = () => {
    document.querySelectorAll('.ship-select-btn').forEach(b => b.classList.remove('active'));
  };

  const previewShip = (row, col) => {
    if (!state.selectedShip || state.isReady || !state.remaining.length) return;
    const size = state.selectedShip;
    const horiz = state.orientation === 'horizontal';
    if (!state.remaining.includes(size)) return;
    if (!canPlaceShip(row, col, size, horiz)) return;
    if (hasAdjacentShip(row, col, size, horiz)) return;
    clearPreview();
    for (let i = 0; i < size; i++) {
      const r = horiz ? row : row + i;
      const c = horiz ? col + i : col;
      const cell = DOM.myBoard.querySelector(`[data-row="${r}"][data-col="${c}"]`);
      if (cell && !cell.classList.contains('ship-placed')) cell.classList.add('ship-preview');
    }
  };

  const clearPreview = () => {
    DOM.myBoard.querySelectorAll('.ship-preview').forEach(el => el.classList.remove('ship-preview'));
  };

  const updateShipSelection = () => {
    const counts = {};
    state.remaining.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    DOM.shipSelection.innerHTML = '';
    if (!Object.keys(counts).length) {
      DOM.shipSelection.innerHTML = '<span class="has-text-success">All placed</span>';
      state.selectedShip = null;
      return;
    }
    Object.entries(counts).sort((a, b) => b[0] - a[0]).forEach(([size, count]) => {
      const btn = document.createElement('button');
      btn.className = 'ship-select-btn button is-small is-light';
      btn.dataset.size = size;
      btn.textContent = `${size}-cell (${count})`;
      btn.onclick = () => {
        if (state.remaining.includes(Number(size))) {
          state.selectedShip = Number(size);
          document.querySelectorAll('.ship-select-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      };
      DOM.shipSelection.appendChild(btn);
    });
  };

  const makeMove = (row, col) => {
    if (!state.isMyTurn || state.game?.status !== 'playing') return;
    if (state.enemyBoard[row][col]) return;
    socket.emit('game:move', {
      gameId: state.gameId,
      playerId: state.user,
      position: [row, col]
    });
    renderEnemyBoard();
  };

  const getShipCells = (board, row, col) => {
    const size = board.length;
    const visited = new Set();
    const queue = [[row, col]];
    const result = [];
    while (queue.length) {
      const [r, c] = queue.shift();
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      if (board[r][c] !== 'hit') continue;
      visited.add(key);
      result.push([r, c]);
      queue.push([r-1, c], [r+1, c], [r, c-1], [r, c+1]);
    }
    return result;
  };

  const markAdjacent = (board, row, col) => {
    const size = board.length;
    const cells = getShipCells(board, row, col);
    for (const [r, c] of cells) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
            if (board[nr][nc] === '' || board[nr][nc] === 'ship') {
              board[nr][nc] = 'adjacent-miss';
            }
          }
        }
      }
    }
  };

  const updatePlayers = game => {
    const players = game?.players || [];
    const names = players.map(p => {
      const isMe = p.name === state.user;
      const ready = p.ready ? ' ✓' : ' …';
      return `${isMe ? '• ' : ''}${p.name}${ready}`;
    });
    DOM.gamePlayers.innerHTML = names.length ? names.join(' &nbsp;|&nbsp; ') : 'Waiting...';
  };

  const showControls = show => {
    DOM.controls.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('hidden-btn', !show);
    });
  };

  const initGame = game => {
    const size = game.size;
    state.myBoard = emptyBoard(size);
    state.enemyBoard = emptyBoard(size);
    state.isReady = false;
    state.gameOver = false;
    state.remaining = [...game.fleet];
    state.selectedShip = null;
    state.game = game;
    state.gameId = game.id;
    const player = game.players.find(p => p.name === state.user);
    if (player?.board) {
      state.myBoard = player.board;
      state.isReady = player.ready;
    }
    updatePlayers(game);
    renderMyBoard();
    renderEnemyBoard();
    updateGame(game);
  };

  const updateGame = game => {
    state.game = game;
    const player = game.players.find(p => p.name === state.user);
    if (player?.board) {
      state.myBoard = player.board;
      state.isReady = player.ready;
      renderMyBoard();
    }
    updatePlayers(game);
    const enemy = game.players.find(p => p.name !== state.user);
    DOM.enemyInfo.textContent = enemy?.ready ? 'Ready' : 'Setting up...';
    if (game.status === 'waiting') updateWaiting(game);
    if (game.status === 'playing') updatePlaying(game);
  };

  const updateWaiting = game => {
    const ready = game.players.filter(p => p.ready).length;
    DOM.gameStatus.textContent = `Waiting (${ready}/${game.players.length})`;
    DOM.gameStatus.className = 'tag is-medium is-warning';
    DOM.readyBtn.textContent = state.isReady ? 'Waiting...' : 'Ready';
    DOM.readyBtn.disabled = state.isReady || state.remaining.length > 0;
    showControls(true);
  };

  const updatePlaying = game => {
    state.isMyTurn = game.turn === state.user;
    DOM.enemyInfo.textContent = '';
    renderEnemyBoard();
    showControls(false);
    updateTurnStatus();
  };

  const getShipCounts = () => {
    const ships = [];
    document.querySelectorAll('.ship-count').forEach(span => {
      const count = Number(span.textContent);
      for (let i = 0; i < count; i++) ships.push(Number(span.dataset.size));
    });
    return ships;
  };

  const initShipConfig = () => {
    const size = Number(DOM.gridSize.value);
    const maxSize = Math.min(size - 1, 5);
    const defaults = [5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
    const available = defaults.filter(s => s <= maxSize);
    const counts = {};
    available.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    const names = { 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two', 1: 'One' };
    DOM.shipsConfig.innerHTML = '';
    Object.entries(counts).sort((a, b) => b[0] - a[0]).forEach(([size, count]) => {
      const div = document.createElement('div');
      div.className = 'field is-grouped is-grouped-multiline';
      div.style.cssText = 'margin-bottom:0.25rem;align-items:center;';
      div.innerHTML = `
        <div class="control" style="min-width:70px;">
          <span class="tag is-dark" style="font-weight:600;font-size:0.9rem;">${names[size]}</span>
        </div>
        <div class="control" style="margin-left:0.5rem;">
          <div class="tags has-addons">
            <button class="tag is-light ship-dec" data-size="${size}" style="border:none;cursor:pointer;font-size:1rem;font-weight:700;padding:0 8px;">−</button>
            <span class="tag is-info ship-count" data-size="${size}" style="font-size:0.9rem;font-weight:700;min-width:30px;justify-content:center;">${count}</span>
            <button class="tag is-light ship-inc" data-size="${size}" style="border:none;cursor:pointer;font-size:1rem;font-weight:700;padding:0 8px;">+</button>
          </div>
        </div>
      `;
      DOM.shipsConfig.appendChild(div);
    });
    bindShipButtons();
  };

  const bindShipButtons = () => {
    document.querySelectorAll('.ship-dec').forEach(btn => {
      btn.onclick = () => {
        const span = document.querySelector(`.ship-count[data-size="${btn.dataset.size}"]`);
        let val = Number(span.textContent);
        if (val > 0) span.textContent = --val;
      };
    });
    document.querySelectorAll('.ship-inc').forEach(btn => {
      btn.onclick = () => {
        const span = document.querySelector(`.ship-count[data-size="${btn.dataset.size}"]`);
        let val = Number(span.textContent);
        if (val < 5) span.textContent = ++val;
      };
    });
  };

  socket.on('user:joined', ({ username, stats }) => {
    state.user = username;
    DOM.playerName.textContent = username;
    updateStatsDisplay(stats);
    showScreen('lobby-screen');
    socket.emit('games:list');
  });

  socket.on('stats:update', ({ username, stats }) => {
    if (username === state.user) {
      updateStatsDisplay(stats);
    }
  });

  socket.on('games:list', renderGames);
  socket.on('games:update', renderGames);
  socket.on('game:createError', showToast);
  socket.on('game:joinError', showToast);
  socket.on('game:created', game => { showScreen('game-screen'); initGame(game); });
  socket.on('game:joined', game => { showScreen('game-screen'); initGame(game); });
  socket.on('game:update', updateGame);

  socket.on('game:start', () => {
    state.isMyTurn = state.game.turn === state.user;
    DOM.enemyInfo.textContent = '';
    DOM.shipSelection.innerHTML = '';
    renderEnemyBoard();
    showControls(false);
    updateTurnStatus();
  });

  socket.on('game:move', result => {
    const [row, col] = result.position;
    const isMyShot = result.playerName === state.user;
    
    if (result.winner) {
      if (isMyShot && result.isHit) state.enemyBoard[row][col] = 'hit';
      else if (!isMyShot && result.isHit) state.myBoard[row][col] = 'hit';
      renderMyBoard();
      renderEnemyBoard();
      DOM.gameStatus.textContent = `${result.winner} wins!`;
      DOM.gameStatus.className = 'tag is-medium is-danger';
      state.gameOver = true;
      showControls(false);
      showToast(`${result.winner} wins!`, 'success');
      return;
    }
    
    if (isMyShot) {
      state.enemyBoard[row][col] = result.isHit ? 'hit' : 'miss';
      if (result.isHit && result.shipSunk) {
        markAdjacent(state.enemyBoard, row, col);
      }
      renderEnemyBoard();
    } else {
      state.myBoard[row][col] = result.isHit ? 'hit' : 'miss';
      if (result.isHit && result.shipSunk) {
        markAdjacent(state.myBoard, row, col);
      }
      renderMyBoard();
    }
    
    if (result.turn) state.game.turn = result.turn;
    state.isMyTurn = state.game.turn === state.user;
    DOM.gameStatus.textContent = state.isMyTurn ? 'Your turn' : 'Opponent\'s turn';
    DOM.gameStatus.className = state.isMyTurn ? 'tag is-medium is-success' : 'tag is-medium is-warning';
    if (state.game.status === 'playing') renderEnemyBoard();
  });

  socket.on('game:over', result => {
    DOM.gameStatus.textContent = `${result.winner} wins!`;
    DOM.gameStatus.className = 'tag is-medium is-danger';
    state.gameOver = true;
    showControls(false);
    showToast(`${result.winner} wins!`, 'success');
  });

  socket.on('game:opponentLeft', message => {
    if (!message.includes(state.user)) showToast('Opponent left — you win!', 'success');
    DOM.gameStatus.textContent = 'You win!';
    DOM.gameStatus.className = 'tag is-medium is-success';
    state.gameOver = true;
    showControls(false);
    renderEnemyBoard();
    setTimeout(() => {
      showScreen('lobby-screen');
      socket.emit('games:list');
      state.game = null;
      state.gameId = null;
    }, 3000);
  });

  socket.on('game:autoplaced', ({ playerId, board }) => {
    if (playerId === state.user) {
      state.myBoard = board;
      state.remaining = [];
      renderMyBoard();
      DOM.readyBtn.disabled = false;
    }
  });

  DOM.username.oninput = () => {
    DOM.joinBtn.disabled = DOM.username.value.trim().length < 2;
  };

  DOM.joinBtn.onclick = () => {
    const name = DOM.username.value.trim();
    if (name.length >= 2) socket.emit('user:join', { username: name });
  };

  DOM.username.onkeypress = e => {
    if (e.key === 'Enter') DOM.joinBtn.click();
  };

  DOM.createBtn.onclick = () => {
    showScreen('setup-screen');
    initShipConfig();
  };

  DOM.gridSize.onchange = initShipConfig;

  DOM.createConfirm.onclick = () => {
    const gridSize = Number(DOM.gridSize.value);
    const ships = getShipCounts();
    if (!ships.length) { showToast('Add ships', 'error'); return; }
    const total = ships.reduce((a, b) => a + b, 0);
    const max = Math.floor(gridSize * gridSize * 0.4);
    if (total > max) { showToast(`Max ${max} cells`, 'error'); return; }
    socket.emit('game:create', { playerName: state.user, gridSize, ships });
  };

  DOM.rotateBtn.onclick = () => {
    state.orientation = state.orientation === 'horizontal' ? 'vertical' : 'horizontal';
  };

  DOM.exitBtn.onclick = () => {
    socket.emit('game:exit', { gameId: state.gameId, playerName: state.user });
    showScreen('lobby-screen');
    socket.emit('games:list');
    if (state.gameId) socket.leave(state.gameId);
    state.game = null;
    state.gameId = null;
  };

  DOM.autoBtn.onclick = () => {
    if (!state.isReady && state.game?.status === 'waiting') {
      socket.emit('game:autoplace', { gameId: state.gameId, playerId: state.user });
    }
  };

  DOM.resetBtn.onclick = () => {
    if (state.isReady || state.game?.status !== 'waiting') {
      showToast('Cannot reset now', 'error');
      return;
    }
    const size = state.myBoard.length;
    state.myBoard = emptyBoard(size);
    state.remaining = [...state.game.fleet];
    state.selectedShip = null;
    renderMyBoard();
    DOM.readyBtn.disabled = true;
    DOM.readyBtn.textContent = 'Ready';
  };

  DOM.readyBtn.onclick = () => {
    if (state.isReady) return;
    const hasShips = state.myBoard.some(row => row.some(cell => cell === 'ship'));
    if (!hasShips) { showToast('Place ships first', 'error'); return; }
    socket.emit('game:ready', {
      gameId: state.gameId,
      playerId: state.user,
      board: state.myBoard
    });
    DOM.readyBtn.disabled = true;
    DOM.readyBtn.textContent = 'Waiting...';
  };

  DOM.joinBtn.disabled = true;
  initShipConfig();
});
