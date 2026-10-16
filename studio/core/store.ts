/** Almacén reactivo mínimo: estado inmutable + suscriptores notificados una vez por microtarea. */
export type Listener<T> = (state: T, prev: T) => void;

export class Store<T extends object> {
  private listeners = new Set<Listener<T>>();
  private scheduled = false;
  private prevForNotify: T;

  constructor(private state: T) { this.prevForNotify = state; }

  get(): T { return this.state; }

  set(patch: Partial<T>): void {
    let changed = false;
    for (const k of Object.keys(patch) as (keyof T)[]) if (this.state[k] !== patch[k]) { changed = true; break; }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(() => {
        this.scheduled = false;
        const prev = this.prevForNotify;
        this.prevForNotify = this.state;
        for (const l of [...this.listeners]) l(this.state, prev);
      });
    }
  }

  subscribe(l: Listener<T>): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}
