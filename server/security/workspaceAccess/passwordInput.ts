import type { Readable } from 'node:stream';
import { TextDecoder } from 'node:util';

type PasswordInput = Readable & {
  isTTY?: boolean;
  isRaw?: boolean;
  setRawMode?: (enabled: boolean) => unknown;
};
type PasswordOutput = { write(value: string): unknown };
const invalid = () => Error('PASSWORD_INPUT_INVALID');

/** Read one bounded password without echoing or normalizing its Unicode text. */
export function readWorkspacePassword(
  input: PasswordInput = process.stdin,
  output: PasswordOutput = process.stdout,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const tty = input.isTTY === true;
    const priorRaw = input.isRaw === true;
    // Candidate admission bound: 8 KiB cumulative terminal bytes allows editing
    // while bounding repeated erase/input work. It does not increase the existing
    // 1024-byte password or 1026-byte piped-input limits, and needs human acceptance.
    const wireLimit = tty ? 8192 : 1026;
    // ignoreBOM=true means retain U+FEFF as actual password data, not strip it.
    const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    let text = '';
    let wireBytes = 0;
    let settled = false;
    let prompted = false;

    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      input.off('data', data);
      input.off('end', end);
      input.off('error', failed);
      input.off('close', failed);
      let cleanupFailed = false;
      try { if (tty) input.setRawMode?.(priorRaw); } catch { cleanupFailed = true; }
      try { input.pause(); } catch { cleanupFailed = true; }
      try { if (prompted) output.write('\n'); } catch { cleanupFailed = true; }
      const result = text;
      text = '';
      if (cleanupFailed || error) reject(cleanupFailed ? invalid() : error);
      else resolve(result);
    }
    function accept() {
      try {
        text += decoder.decode(); // Fatal on an unfinished UTF-8 sequence.
        if (!tty) text = text.replace(/\r?\n$/, '');
        if (text.includes('\n') || text.includes('\r') || text.length < 12 || Buffer.byteLength(text, 'utf8') > 1024) {
          finish(invalid()); return;
        }
        finish();
      } catch { finish(invalid()); }
    }
    function failed() { finish(invalid()); }
    function end() { if (tty) finish(invalid()); else accept(); }
    function data(chunk: unknown) {
      if (settled) return;
      // A caller's prior text decoding could already have silently replaced invalid
      // bytes. Accept byte streams only; this function owns fatal UTF-8 decoding.
      if (!(chunk instanceof Uint8Array)) { finish(invalid()); return; }
      if (!tty) {
        wireBytes += chunk.byteLength;
        if (wireBytes > wireLimit) { finish(invalid()); return; }
        try { text += decoder.decode(chunk, { stream: true }); } catch { finish(invalid()); }
        return;
      }
      try {
        for (let index = 0; index < chunk.byteLength; index++) {
          if (++wireBytes > wireLimit) { finish(invalid()); return; }
          const char = decoder.decode(chunk.subarray(index, index + 1), { stream: true });
          if (!char) continue;
          if (char === '\u0003') { finish(Error('PASSWORD_INPUT_CANCELLED')); return; }
          if (char === '\r' || char === '\n') { accept(); return; }
          if (char === '\u007f' || char === '\b') { text = Array.from(text).slice(0, -1).join(''); continue; }
          if (/[\u0000-\u001f\u0080-\u009f]/.test(char) || Buffer.byteLength(text + char, 'utf8') > 1024) {
            finish(invalid()); return;
          }
          text += char;
        }
      } catch { finish(invalid()); }
    }

    if (input.readableEnded || input.destroyed) { finish(invalid()); return; }
    input.on('data', data);
    input.on('end', end);
    input.on('error', failed);
    input.on('close', failed);
    try {
      if (tty) {
        if (typeof input.setRawMode !== 'function') { finish(invalid()); return; }
        output.write('Password (input hidden): ');
        prompted = true;
        input.setRawMode(true);
      }
      input.resume();
    } catch { finish(invalid()); }
  });
}
