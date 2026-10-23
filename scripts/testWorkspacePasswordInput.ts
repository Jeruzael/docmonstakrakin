import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { readWorkspacePassword } from '../server/security/workspaceAccess/passwordInput.ts';

// Real byte streams; only the unavailable terminal's raw-mode operations are synthetic.
class Input extends PassThrough {
  isTTY: boolean;
  isRaw = false;
  rawModes: boolean[] = [];
  constructor(tty: boolean, initiallyRaw = false) { super(); this.isTTY = tty; this.isRaw = initiallyRaw; }
  setRawMode(value: boolean) { this.rawModes.push(value); this.isRaw = value; return this; }
}
const syntheticPassword = 'synthetic-密碼-😀';
let passed = 0;
async function test(name: string, body: () => Promise<void>) {
  await body(); passed++; console.log(`PASS ${name}`);
}
function start(tty: boolean, initiallyRaw = false) {
  const input = new Input(tty, initiallyRaw);
  let output = '';
  const result = readWorkspacePassword(input, { write(value: string) { output += value; return true; } });
  // Install rejection handling before any synchronous synthetic data/error event.
  result.catch(() => {});
  return { input, result, output: () => output };
}
function clean(input: Input, priorRaw = false) {
  assert.equal(input.isRaw, priorRaw, 'restore prior terminal mode');
  assert.equal(input.isPaused(), true, 'stop reading after completion');
  for (const event of ['data', 'end', 'error', 'close']) assert.equal(input.listenerCount(event), 0, `detach ${event}`);
}
async function rejected(inputBytes: Buffer | string, tty = true, expected = 'PASSWORD_INPUT_INVALID') {
  const session = start(tty);
  session.input.end(inputBytes);
  await assert.rejects(session.result, { message: expected }); clean(session.input);
  assert.equal(session.output().includes(syntheticPassword), false, 'never echo input');
}

await test('TTY preserves UTF-8 characters split at every byte boundary', async () => {
  const encoded = Buffer.from(`${syntheticPassword}\r`);
  for (let split = 1; split < encoded.length; split++) {
    const session = start(true);
    session.input.write(encoded.subarray(0, split)); session.input.write(encoded.subarray(split));
    assert.equal(await session.result, syntheticPassword); clean(session.input);
    assert.equal(session.output(), 'Password (input hidden): \n');
  }
});
await test('TTY preserves a literal BOM rather than normalizing the password', async () => {
  const session = start(true); session.input.end(Buffer.from(`\ufeff${syntheticPassword}\n`));
  assert.equal(await session.result, `\ufeff${syntheticPassword}`); clean(session.input);
});
await test('TTY codepoint backspace removes an entire supplementary character', async () => {
  const session = start(true); session.input.end(Buffer.from('synthetic-pass😀\u007fX\n'));
  assert.equal(await session.result, 'synthetic-passX'); clean(session.input);
});
await test('TTY backspace at the empty boundary does not corrupt following text', async () => {
  const session = start(true); session.input.end(Buffer.from(`\b\u007f${syntheticPassword}\n`));
  assert.equal(await session.result, syntheticPassword); clean(session.input);
});
await test('TTY accepts exactly 1024 UTF-8 password bytes', async () => {
  const session = start(true); session.input.end(Buffer.from(`${'密'.repeat(340)}abcd\r`));
  assert.equal(await session.result, `${'密'.repeat(340)}abcd`); clean(session.input);
});
await test('TTY rejects a password exceeding 1024 UTF-8 bytes', async () => {
  await rejected(`${'密'.repeat(341)}ab\n`);
});
await test('TTY minimum retains the existing twelve UTF-16-unit contract', async () => {
  const session = start(true); session.input.end(Buffer.from(`${'😀'.repeat(6)}\n`));
  assert.equal(await session.result, '😀'.repeat(6)); clean(session.input);
  await rejected('abcdefghijk\n');
});
await test('TTY rejects malformed UTF-8 rather than storing replacement characters', async () => {
  for (const suffix of [Buffer.from([0xc0, 0xaf]), Buffer.from([0xff]), Buffer.from([0xed, 0xa0, 0x80])]) {
    await rejected(Buffer.concat([Buffer.from('synthetic-pass'), suffix, Buffer.from('\n')]));
  }
});
await test('TTY rejects incomplete UTF-8 at newline', async () => {
  await rejected(Buffer.concat([Buffer.from('synthetic-pass'), Buffer.from([0xf0, 0x9f]), Buffer.from('\n')]));
});
await test('TTY rejects EOF without accepting an unterminated password', async () => {
  await rejected(syntheticPassword);
});
await test('TTY rejects incomplete UTF-8 at EOF', async () => {
  await rejected(Buffer.concat([Buffer.from('synthetic-pass'), Buffer.from([0xe5])]));
});
await test('TTY Ctrl-C cancels and restores the terminal', async () => {
  await rejected(`${syntheticPassword}\u0003`, true, 'PASSWORD_INPUT_CANCELLED');
});
await test('TTY Ctrl-D is an EOF error', async () => {
  await rejected(`${syntheticPassword}\u0004`);
});
await test('TTY rejects other C0 and C1 controls', async () => {
  for (const control of ['\u0000', '\t', '\u001b', '\u0085']) await rejected(`${syntheticPassword}${control}\n`);
});
await test('TTY ignores trailing bytes after a completed first line', async () => {
  const session = start(true);
  session.input.write(Buffer.concat([Buffer.from(`${syntheticPassword}\r\n`), Buffer.from([0xff]), Buffer.alloc(10000)]));
  assert.equal(await session.result, syntheticPassword); clean(session.input);
});
await test('TTY restores an initially enabled raw mode on success', async () => {
  const session = start(true, true); session.input.end(Buffer.from(`${syntheticPassword}\n`));
  assert.equal(await session.result, syntheticPassword); clean(session.input, true);
});
await test('TTY restores an initially enabled raw mode on rejection', async () => {
  const session = start(true, true); session.input.end(Buffer.from('short\n'));
  await assert.rejects(session.result, { message: 'PASSWORD_INPUT_INVALID' }); clean(session.input, true);
});
await test('TTY editing accepts exactly 8192 cumulative input bytes', async () => {
  const session = start(true); session.input.end(Buffer.from(`synthetic-pwx${'x\b'.repeat(4089)}\n`));
  assert.equal(await session.result, 'synthetic-pwx'); clean(session.input);
});
await test('TTY cumulative editing budget rejects repeated erase floods', async () => {
  await rejected(`synthetic-pw${'x\b'.repeat(4091)}\n`);
});
await test('input error is generic and cleans up the terminal', async () => {
  const session = start(true); session.input.emit('error', Error(syntheticPassword));
  await assert.rejects(session.result, { message: 'PASSWORD_INPUT_INVALID' }); clean(session.input);
  assert.equal(session.output().includes(syntheticPassword), false);
});
await test('premature close cannot leave password input pending', async () => {
  const session = start(true); session.input.emit('close');
  await assert.rejects(session.result, { message: 'PASSWORD_INPUT_INVALID' }); clean(session.input);
});
await test('failed raw-mode setup rejects and still restores the prior mode', async () => {
  const input = new Input(true);
  input.setRawMode = (enabled: boolean) => {
    input.isRaw = enabled;
    if (enabled) throw Error(syntheticPassword);
    return input;
  };
  await assert.rejects(readWorkspacePassword(input, { write() { return true; } }), { message: 'PASSWORD_INPUT_INVALID' });
  clean(input);
});
await test('output failure cannot return a password or skip terminal cleanup', async () => {
  const input = new Input(true);
  const result = readWorkspacePassword(input, { write(value: string) { if (value === '\n') throw Error(syntheticPassword); return true; } });
  result.catch(() => {}); input.end(Buffer.from(`${syntheticPassword}\n`));
  await assert.rejects(result, { message: 'PASSWORD_INPUT_INVALID' }); clean(input);
});
await test('predecoded text streams cannot hide prior UTF-8 replacement', async () => {
  const session = start(false); session.input.setEncoding('utf8');
  session.input.end(Buffer.concat([Buffer.from('synthetic-pass'), Buffer.from([0xff])]));
  await assert.rejects(session.result, { message: 'PASSWORD_INPUT_INVALID' }); clean(session.input);
});
await test('piped input preserves byte-at-a-time UTF-8 and optional CRLF', async () => {
  for (const ending of ['', '\n', '\r\n']) {
    const session = start(false);
    for (const byte of Buffer.from(`${syntheticPassword}${ending}`)) session.input.write(Buffer.from([byte]));
    session.input.end(); assert.equal(await session.result, syntheticPassword); clean(session.input);
    assert.equal(session.output(), '');
  }
});
await test('piped input preserves a literal BOM', async () => {
  const session = start(false); session.input.end(Buffer.from(`\ufeff${syntheticPassword}`));
  assert.equal(await session.result, `\ufeff${syntheticPassword}`); clean(session.input);
});
await test('piped input accepts exactly 1026 wire bytes with CRLF', async () => {
  const session = start(false); session.input.end(Buffer.from(`${'a'.repeat(1024)}\r\n`));
  assert.equal(await session.result, 'a'.repeat(1024)); clean(session.input);
});
await test('piped input rejects oversized wire or password bytes', async () => {
  await rejected('a'.repeat(1027), false);
  await rejected(`${'a'.repeat(1025)}\n`, false);
});
await test('piped input rejects embedded and repeated line terminators', async () => {
  for (const value of [`${syntheticPassword}\nnext`, `${syntheticPassword}\n\n`, `${syntheticPassword}\r`]) await rejected(value, false);
});
await test('piped input rejects malformed and incomplete UTF-8', async () => {
  for (const suffix of [Buffer.from([0xff]), Buffer.from([0xe5])]) await rejected(Buffer.concat([Buffer.from('synthetic-pass'), suffix]), false);
});
await test('piped input rejects fewer than twelve UTF-16 units', async () => { await rejected('short\n', false); });
await test('already ended input rejects instead of hanging', async () => {
  const input = new Input(false); input.resume(); input.end();
  await new Promise<void>(resolve => input.on('end', resolve));
  await assert.rejects(readWorkspacePassword(input, { write() { return true; } }), { message: 'PASSWORD_INPUT_INVALID' });
});
console.log(`Workspace password input: ${passed} passed, 0 failed`);
