const fs = require('fs');
const path = require('path');

class UserManager {
  constructor() {
    this.sessions = {};
    this.counters = {};
    this.stats = {};
    this.statsFile = path.join(__dirname, 'stats.json');
    this._loadStats();
  }

  _loadStats() {
    try {
      if (fs.existsSync(this.statsFile)) {
        this.stats = JSON.parse(fs.readFileSync(this.statsFile, 'utf8'));
      }
    } catch (e) { this.stats = {}; }
  }

  _saveStats() {
    try {
      fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
    } catch (e) {}
  }

  register(socketId, rawName) {
    this.counters[rawName] = (this.counters[rawName] || 0) + 1;
    const name = this.counters[rawName] > 1 ? `${rawName} ${this.counters[rawName]}` : rawName;
    this.sessions[socketId] = name;
    if (!this.stats[name]) this.stats[name] = { games: 0, wins: 0, losses: 0 };
    return name;
  }

  unregister(socketId) {
    const name = this.sessions[socketId];
    if (!name) return null;
    
    delete this.sessions[socketId];
    
    const rawName = name.split(' ')[0];
    const active = Object.values(this.sessions).filter(n => n.startsWith(rawName));
    if (active.length === 0) {
      this.counters[rawName] = 0;
    }
    
    return name;
  }

  getStats(name) {
    return this.stats[name] || { games: 0, wins: 0, losses: 0 };
  }

  recordWin(name) {
    if (this.stats[name]) {
      this.stats[name].wins++;
      this.stats[name].games++;
      this._saveStats();
    }
  }

  recordLoss(name) {
    if (this.stats[name]) {
      this.stats[name].losses++;
      this.stats[name].games++;
      this._saveStats();
    }
  }
}

module.exports = UserManager;
