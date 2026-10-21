/** Killed subprocess acceptance fixture, not a registration command or server. */
import fs from 'node:fs';
import { SyntheticWbsStore } from '../lib/syntheticWbsTransaction.ts';
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
if (!['AFTER_BEGIN', 'AFTER_STATE', 'AFTER_RECEIPT', 'BEFORE_COMMIT', 'AFTER_COMMIT', 'NO_FAULT'].includes(input.point)) throw Error('Unknown synthetic fault');
const request = { ...input.request, beforeBytes: Buffer.from(input.request.beforeBytes, 'base64'), afterBytes: Buffer.from(input.request.afterBytes, 'base64'), receiptBytes: Buffer.from(input.request.receiptBytes, 'base64') };
const acquisition = { ...input.acquisition, envelopeBytes: Buffer.from(input.acquisition.envelopeBytes, 'base64') };
const store = SyntheticWbsStore.open(input.handle);
try {
  const result = store.commit(request, { kind: 'TESTONLY_PUBLIC_ROOTS', pinnedAnchorSha256: input.pin, acquire: () => acquisition }, point => { if (point === input.point) process.exit(86); });
  if (input.point !== 'NO_FAULT') throw Error('Expected fault point was not reached');
  console.log(result.status); store.close();
} catch (error) {
  if (input.point !== 'NO_FAULT') throw error;
  console.error(error instanceof Error ? error.message : 'SYNTHETIC_REJECTED'); store.close(); process.exitCode = 2;
}
