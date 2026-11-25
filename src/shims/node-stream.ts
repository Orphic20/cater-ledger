type Listener = (...args: unknown[]) => void;

/** Enough of Node's Readable for word-extractor to pull OLE streams in the browser. */
export class Readable {
  private listeners = new Map<string, Listener[]>();
  private flowing = false;
  private scheduled = false;
  private ended = false;

  on(event: string, listener: Listener) {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
    if (event === "data" && !this.ended) this.schedule();
    return this;
  }

  emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
    return true;
  }

  push(chunk: Uint8Array | null) {
    if (this.ended) return false;
    if (chunk == null) {
      this.ended = true;
      this.flowing = false;
      this.emit("end");
      return false;
    }
    this.emit("data", chunk);
    if (this.flowing) this.schedule();
    return true;
  }

  private schedule() {
    if (this.scheduled || this.ended) return;
    this.scheduled = true;
    this.flowing = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (!this.flowing || this.ended) return;
      const read = (this as { _read?: () => void })._read;
      read?.call(this);
    });
  }
}

export const Writable = Readable;
export const Duplex = Readable;
export const Transform = Readable;
export const PassThrough = Readable;

export default { Readable, Writable, Duplex, Transform, PassThrough };
