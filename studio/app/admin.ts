export function mountAdmin(host: HTMLElement, _args: string[]): () => void { host.textContent = 'admin'; return () => {}; }
