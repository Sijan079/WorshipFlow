type ConnectionState = "connecting" | "live" | "reconnecting" | "error";

export function isFatalCaptionSocketClose(code: number) {
  return code === 1002 || code === 1003 || code === 1007 || code === 1008 || code === 1009;
}

type ConnectionOptions = {
  initialToken: string;
  getToken: () => Promise<string>;
  createSocket: (token: string) => WebSocket;
  createRecorder: () => MediaRecorder;
  onMessage: (data: unknown) => void;
  onState: (state: ConnectionState, attempts: number) => void;
  onDisconnect: () => void;
  isFatalTokenError?: (error: unknown) => boolean;
  setTimer?: (callback: () => void, delay: number) => number;
  clearTimer?: (id: number) => void;
  wait?: (delay: number) => Promise<void>;
};

export class CaptionStreamConnection {
  private socket: WebSocket | null = null;
  private recorder: MediaRecorder | null = null;
  private retryTimer: number | null = null;
  private connectTimer: number | null = null;
  private errorTimer: number | null = null;
  private attempts = 0;
  private started = false;
  private closed = false;
  private tokenPending = false;
  private readonly options: ConnectionOptions;

  constructor(options: ConnectionOptions) {
    this.options = options;
  }

  private setTimer(callback: () => void, delay: number) {
    return this.options.setTimer?.(callback, delay) ?? (globalThis.setTimeout(callback, delay) as unknown as number);
  }

  private clearTimer(id: number) {
    if (this.options.clearTimer) this.options.clearTimer(id);
    else globalThis.clearTimeout(id);
  }

  private clearTimers() {
    if (this.retryTimer !== null) this.clearTimer(this.retryTimer);
    if (this.connectTimer !== null) this.clearTimer(this.connectTimer);
    if (this.errorTimer !== null) this.clearTimer(this.errorTimer);
    this.retryTimer = null;
    this.connectTimer = null;
    this.errorTimer = null;
  }

  start() {
    if (this.started) return;
    this.started = true;
    void this.connect(this.options.initialToken);
  }

  retryNow() {
    if (this.closed || this.socket || this.tokenPending || this.retryTimer === null) return;
    this.clearTimer(this.retryTimer);
    this.retryTimer = null;
    void this.connect();
  }

  interrupt() {
    if (this.closed || !this.socket) return;
    const socket = this.socket;
    this.disconnect(socket);
    if (socket.readyState < 2) socket.close();
  }

  private async connect(initialToken?: string) {
    if (this.closed || this.socket || this.tokenPending) return;
    this.options.onState(this.attempts ? "reconnecting" : "connecting", this.attempts);
    this.tokenPending = true;
    let token: string;
    try {
      token = initialToken ?? await this.options.getToken();
    } catch (error) {
      this.tokenPending = false;
      if (this.options.isFatalTokenError?.(error)) { this.fail(); return; }
      this.scheduleReconnect();
      return;
    }
    this.tokenPending = false;
    if (this.closed) return;

    let socket: WebSocket;
    try {
      socket = this.options.createSocket(token);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    this.connectTimer = this.setTimer(() => {
      if (socket.readyState === 0) {
        this.disconnect(socket);
        socket.close();
      }
    }, 10_000);
    socket.onopen = () => {
      if (this.socket !== socket || this.closed) { socket.close(); return; }
      if (this.connectTimer !== null) this.clearTimer(this.connectTimer);
      this.connectTimer = null;
      try {
        const recorder = this.options.createRecorder();
        this.recorder = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size === 0 || this.socket !== socket || socket.readyState !== 1) return;
          try {
            if (socket.bufferedAmount > 512_000) { this.interrupt(); return; }
            socket.send(event.data);
          } catch { this.interrupt(); }
        };
        recorder.start(250);
      } catch {
        this.fail();
        return;
      }
      const priorAttempts = this.attempts;
      this.attempts = 0;
      this.options.onState("live", priorAttempts);
    };
    socket.onmessage = (event) => {
      if (this.socket === socket) this.options.onMessage(event.data);
    };
    socket.onerror = () => {
      if (this.socket !== socket) return;
      if (this.errorTimer !== null) return;
      this.errorTimer = this.setTimer(() => {
        this.errorTimer = null;
        this.disconnect(socket);
        if (socket.readyState < 2) socket.close();
      }, 2_000);
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      if (this.errorTimer !== null) this.clearTimer(this.errorTimer);
      this.errorTimer = null;
      if (isFatalCaptionSocketClose(event.code)) this.fail();
      else this.disconnect(socket);
    };
  }

  private fail() {
    if (this.closed) return;
    this.closed = true;
    this.clearTimers();
    this.stopRecorder();
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < 2) socket.close();
    this.options.onState("error", this.attempts);
  }

  private disconnect(socket: WebSocket) {
    if (this.socket !== socket) return;
    this.socket = null;
    if (this.connectTimer !== null) this.clearTimer(this.connectTimer);
    if (this.errorTimer !== null) this.clearTimer(this.errorTimer);
    this.connectTimer = null;
    this.errorTimer = null;
    this.stopRecorder();
    if (this.closed) return;
    this.options.onDisconnect();
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.closed || this.retryTimer !== null) return;
    this.attempts += 1;
    this.options.onState("reconnecting", this.attempts);
    const delay = Math.min(1000 * 2 ** Math.min(this.attempts - 1, 4), 15_000);
    this.retryTimer = this.setTimer(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }

  private stopRecorder() {
    if (this.recorder?.state !== "inactive") this.recorder?.stop();
    this.recorder = null;
  }

  stop() {
    if (this.closed) return;
    this.closed = true;
    this.clearTimers();
    this.stopRecorder();
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < 2) socket.close();
  }

  async finish() {
    if (this.closed) return;
    this.closed = true;
    this.clearTimers();
    this.stopRecorder();
    const socket = this.socket;
    if (!socket || socket.readyState !== 1) {
      this.socket = null;
      if (socket && socket.readyState < 2) socket.close();
      return;
    }
    const wait = this.options.wait ?? ((delay: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, delay)));
    await wait(400);
    if (this.socket === socket && socket.readyState === 1) socket.send(JSON.stringify({ type: "CloseStream" }));
    await wait(1200);
    this.socket = null;
    if (socket.readyState < 2) socket.close();
  }
}
