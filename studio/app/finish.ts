export function mountFinish(host: HTMLElement, _args: string[]): () => void { host.textContent = 'finish'; return () => {}; }
