class Game {
  constructor(id, creator, size, fleet) {
    this.id = id;
    this.size = size;
    this.fleet = fleet;
    this.players = { [creator]: { board: null, ready: false } };
    this.status = 'waiting';
    this.turn = null;
    this.winner = null;
  }

  addPlayer(name) {
    if (this.players[name]) return null;
    if (Object.keys(this.players).length >= 2) return null;
    if (this.status !== 'waiting') return null;
    this.players[name] = { board: null, ready: false };
    return this.players[name];
  }

  setBoard(name, board) {
    if (!this.players[name]) return false;
    this.players[name].board = board.map(row => [...row]);
    return true;
  }

  setReady(name) {
    const player = this.players[name];
    if (!player || !player.board) return false;
    player.ready = true;
    const allReady = Object.values(this.players).every(p => p.ready);
    if (allReady && Object.keys(this.players).length === 2) {
      this.status = 'playing';
      this.turn = Object.keys(this.players)[0];
    }
    return true;
  }

  makeMove(name, [row, col]) {
    if (this.status !== 'playing') return null;
    if (this.turn !== name) return null;
    
    const opponent = Object.keys(this.players).find(p => p !== name);
    if (!opponent) return null;
    
    const board = this.players[opponent].board;
    if (!board) return null;
    if (row < 0 || row >= this.size || col < 0 || col >= this.size) return null;
    if (board[row][col] === 'hit' || board[row][col] === 'miss') return null;

    const isHit = board[row][col] === 'ship';
    board[row][col] = isHit ? 'hit' : 'miss';
    
    const result = this._buildResult(name, opponent, board, row, col, isHit);
    if (!isHit) this.turn = opponent;
    if (this._allSunk(board)) {
      this.status = 'finished';
      this.winner = name;
      result.winner = name;
    }
    return result;
  }

  _buildResult(name, opponent, board, row, col, isHit) {
    const shipSunk = isHit ? this._isSunk(board, row, col) : false;
    const shipSize = shipSunk ? this._getShipSize(board, row, col) : 0;
    if (shipSunk) this._markAdjacent(board, row, col);
    return {
      position: [row, col],
      isHit,
      turn: this.turn,
      playerName: name,
      shipSunk,
      shipSize,
      boardState: board.map(row => [...row])
    };
  }

  _isSunk(board, row, col) {
    const cells = this._getShipCells(board, row, col);
    if (cells.length === 0) return false;
    return cells.every(([r, c]) => board[r][c] === 'hit');
  }

  _getShipSize(board, row, col) {
    return this._getShipCells(board, row, col).length;
  }

  _getShipCells(board, row, col) {
    const size = board.length;
    const visited = new Set();
    const queue = [[row, col]];
    const result = [];
    while (queue.length) {
      const [r, c] = queue.shift();
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      if (board[r][c] !== 'ship' && board[r][c] !== 'hit') continue;
      visited.add(key);
      result.push([r, c]);
      queue.push([r-1, c], [r+1, c], [r, c-1], [r, c+1]);
    }
    return result;
  }

  _markAdjacent(board, row, col) {
    const size = board.length;
    const cells = this._getShipCells(board, row, col);
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
  }

  _allSunk(board) {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (board[r][c] === 'ship') return false;
      }
    }
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      size: this.size,
      fleet: this.fleet,
      players: Object.entries(this.players).map(([name, data]) => ({
        name,
        ready: data.ready,
        board: data.board
      })),
      status: this.status,
      turn: this.turn,
      winner: this.winner
    };
  }
}

module.exports = Game;