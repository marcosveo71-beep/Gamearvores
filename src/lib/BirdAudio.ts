export class BirdAudio {
  ctx: AudioContext | null = null;
  isPlaying = false;

  init() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    this.ctx = new AudioContextClass();
    this.isPlaying = true;
    this.scheduleNextChirp();
  }

  stop() {
    this.isPlaying = false;
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  scheduleNextChirp() {
    if (!this.isPlaying || !this.ctx) return;
    
    const delay = Math.random() * 4000 + 2000; // 2 to 6 seconds
    setTimeout(() => {
      this.playChirp();
      this.scheduleNextChirp();
    }, delay);
  }

  playChirp() {
    if (!this.ctx) return;
    
    const numChirps = Math.floor(Math.random() * 3) + 1;
    let startTime = this.ctx.currentTime;
    
    for (let i = 0; i < numChirps; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.type = 'sine';
      
      const freq = 3000 + Math.random() * 1500;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, startTime + 0.1);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.1, startTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, startTime + 0.1);
      
      osc.start(startTime);
      osc.stop(startTime + 0.1);
      
      startTime += 0.15 + Math.random() * 0.1;
    }
  }
}
