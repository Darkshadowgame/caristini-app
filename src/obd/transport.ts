// A link to an ELM327-type adapter. send() writes one command and resolves
// with the raw text the adapter returns, up to (not including) the '>' prompt.
export interface Transport {
  readonly kind: 'simulated' | 'bluetooth';
  readonly label: string;
  send(command: string, timeoutMs: number): Promise<string>;
  // Sends a command that streams (ATMA monitor), passes text through as it
  // arrives, and stops the adapter when until settles. Resolves 'ended' if
  // the adapter stopped on its own (for example BUFFER FULL).
  stream?(command: string, onText: (text: string) => void, until: Promise<void>): Promise<'stopped' | 'ended'>;
  close(): Promise<void>;
  // Called once if the link drops on its own (adapter unplugged, out of range).
  onLost?: (reason: string) => void;
}

export class AdapterTimeout extends Error {
  constructor(command: string) {
    super(`The adapter did not answer "${command}" in time.`);
  }
}

export class LinkLost extends Error {
  constructor(reason = 'The Bluetooth link to the adapter dropped.') {
    super(reason);
  }
}
