export class AmbientAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  
  private time = 0;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.ctx.destination);

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    // Normal Wind
    const windSource = this.ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 400;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.1;
    windSource.connect(this.windFilter).connect(this.windGain).connect(this.masterGain);
    windSource.start();
  }

  update(delta: number, windIntensity: number) {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    this.time += delta;

    // Wind gusts
    const gust = (Math.sin(this.time * 0.5) * Math.sin(this.time * 0.1) * 0.5 + 0.5); 
    const targetWindGain = 0.1 + (windIntensity * 0.2) + (gust * 0.2);
    this.windGain.gain.setTargetAtTime(targetWindGain, this.ctx.currentTime, 0.5);
    this.windFilter.frequency.setTargetAtTime(300 + windIntensity * 500 + gust * 300, this.ctx.currentTime, 0.5);
  }

  stop() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
