// Bộ phát sự kiện tối giản (typed)
export type Handler<T> = (payload: T) => void;

export class Emitter<Events extends object> {
  private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};

  on<K extends keyof Events>(event: K, fn: Handler<Events[K]>): () => void {
    (this.handlers[event] ??= new Set()).add(fn);
    return () => this.off(event, fn);
  }

  off<K extends keyof Events>(event: K, fn: Handler<Events[K]>): void {
    this.handlers[event]?.delete(fn);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.handlers[event]?.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error('handler error', event, e);
      }
    });
  }
}
