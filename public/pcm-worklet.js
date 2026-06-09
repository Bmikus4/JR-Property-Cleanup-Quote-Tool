// PCM capture worklet. Buffers mono Float32 frames and posts ~2048-sample
// chunks back to the main thread. Replaces the deprecated ScriptProcessorNode
// for reliable microphone capture on iOS Safari and modern browsers.
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._chunks = [];
    this._count = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length) {
      this._chunks.push(channel.slice(0));
      this._count += channel.length;
      if (this._count >= 2048) {
        const merged = new Float32Array(this._count);
        let offset = 0;
        for (const c of this._chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        this.port.postMessage(merged);
        this._chunks = [];
        this._count = 0;
      }
    }
    return true; // keep the processor alive
  }
}

registerProcessor("pcm-processor", PCMProcessor);
