const Game = require('./gameLogic');

class GameManager {
  constructor() {
    this.games = {};
    this.counter = 1;
  }

  create(creator, size, fleet) {
    const id = `${creator}_${this.counter++}`;
    this.games[id] = new Game(id, creator, size, fleet);
    return this.games[id].toJSON();
  }

  join(id, name) {
    const game = this.games[id];
    if (!game || game.status !== 'waiting' || game.players[name]) return null;
    const player = game.addPlayer(name);
    return player ? game.toJSON() : null;
  }

  ready(id, name, board) {
    const game = this.games[id];
    if (!game || !game.players[name]) return null;
    game.setBoard(name, board);
    game.setReady(name);
    return game.toJSON();
  }

  move(id, name, pos) {
    const game = this.games[id];
    if (!game) return null;
    const result = game.makeMove(name, pos);
    if (result?.winner) {
      setTimeout(() => this.remove(id), 5000);
    }
    return result;
  }

  autoPlace(id, name) {
    const game = this.games[id];
    if (!game || !game.players[name]) return null;
    const board = this._generateBoard(game.size, game.fleet);
    game.setBoard(name, board);
    return board;
  }

  _generateBoard(size, fleet) {
    const board = Array.from({ length: size }, () => Array(size).fill(''));
    const canPlace = (r, c, s, h) => {
      for (let i = 0; i < s; i++) {
        const rr = h ? r : r + i, cc = h ? c + i : c;
        if (rr >= size || cc >= size || board[rr][cc]) return false;
      }
      for (let i = 0; i < s; i++) {
        const rr = h ? r : r + i, cc = h ? c + i : c;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = rr + dr, nc = cc + dc;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc]) return false;
          }
        }
      }
      return true;
    };
    const place = (r, c, s, h) => {
      for (let i = 0; i < s; i++) {
        const rr = h ? r : r + i, cc = h ? c + i : c;
        board[rr][cc] = 'ship';
      }
    };
    for (const s of fleet) {
      let placed = false;
      for (let attempts = 0; attempts < 1000 && !placed; attempts++) {
        const r = Math.floor(Math.random() * size);
        const c = Math.floor(Math.random() * size);
        const h = Math.random() < 0.5;
        if (canPlace(r, c, s, h)) { place(r, c, s, h); placed = true; }
      }
    }
    return board;
  }

  remove(id) { delete this.games[id]; }

  list() {
    const result = {};
    for (const [id, game] of Object.entries(this.games)) {
      if (game.status === 'waiting' && Object.keys(game.players).length < 2) {
        result[id] = game.toJSON();
      }
    }
    return result;
  }
}

module.exports = GameManager;