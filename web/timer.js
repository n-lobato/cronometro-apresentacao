(function (root) {
  class Timer {
    constructor(now = () => Date.now()) {
      this.now = now; this.total = 1200000; this.warn = 300000;
      this.acc = 0; this.started = null;
    }
    get running() { return this.started !== null; }
    elapsed() { return this.acc + (this.running ? Math.max(0, this.now() - this.started) : 0); }
    remaining() { return this.total - this.elapsed(); }
    toggle() {
      if (this.running) { this.acc = this.elapsed(); this.started = null; }
      else this.started = this.now();
    }
    reset() { this.acc = 0; this.started = null; }
    configure(minutes, warning) {
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600 ||
          !Number.isFinite(warning) || warning < 0 || warning > 120 || warning > minutes)
        throw new RangeError('Duração: 1 a 600 min. Alerta: 0 a 120 min, não superior à duração.');
      this.total = minutes * 60000; this.warn = warning * 60000;
    }
    adjust(minutes) {
      if (!Number.isFinite(minutes)) throw new RangeError('Ajuste inválido.');
      this.total = Math.min(36000000, Math.max(60000, this.total + minutes * 60000));
      this.warn = Math.min(this.warn, this.total);
    }
    state() {
      const r = this.remaining();
      return r < 0 ? 'over' : r <= 60000 ? 'critical' : r <= this.warn ? 'warning' : 'normal';
    }
    static format(ms) {
      const seconds = ms < 0 ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000);
      return (ms < 0 ? '+' : '') + String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = Timer;
  else root.PresentationTimer = Timer;
})(globalThis);
