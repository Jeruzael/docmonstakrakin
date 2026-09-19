import { SecretRedactor, DEFAULT_REDACTION_RULES } from './redactionFilter.ts';
import { AuditEvent } from '../../src/types.ts';

async function runRedactionTests(): Promise<void> {
  console.log('=== Running DMK-157.5 Secret Redaction Filter Verification Suite ===');

  const redactor = new SecretRedactor();

  // Test 1: Static Pattern Matching (Google Gemini API Key)
  console.log('[Test 1] Testing static Google API Key pattern redaction...');
  const geminiLog = 'Connecting to Gemini with key AIzaSyD9876543210abcdefABCDEF123456789 from instance';
  const sanitizedGemini = redactor.redactString(geminiLog);
  if (sanitizedGemini.includes('AIzaSyD9876543210abcdefABCDEF123456789')) {
    throw new Error(`Google API key not redacted: ${sanitizedGemini}`);
  }
  if (!sanitizedGemini.includes('[REDACTED_SECRET]')) {
    throw new Error(`Mask string missing: ${sanitizedGemini}`);
  }
  console.log(`✓ Google API Key redacted: "${sanitizedGemini}"`);

  // Test 2: Static Pattern Matching (OpenAI, GitHub PAT, Bearer)
  console.log('[Test 2] Testing OpenAI, GitHub PAT, and Bearer token redaction...');
  const multiSecretLog = 'Tokens: ghp_1234567890abcdefghijklmnopqrstuvwx and sk-abcdef12345678901234 and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisToken';
  const sanitizedMulti = redactor.redactString(multiSecretLog);
  if (
    sanitizedMulti.includes('ghp_1234567890') ||
    sanitizedMulti.includes('sk-abcdef12345678901234') ||
    sanitizedMulti.includes('doNotLeakThisToken')
  ) {
    throw new Error(`Token leak detected: ${sanitizedMulti}`);
  }
  console.log(`✓ Multi-pattern tokens redacted successfully`);

  // Test 3: Dynamic Secret Registration & Masking
  console.log('[Test 3] Testing dynamic secret registration and masking...');
  const proprietarySecret = 'CustomSuperSecretEnterpriseToken_xyz987!';
  redactor.registerSecret(proprietarySecret);

  const customLog = `Failed request with authorization credential: ${proprietarySecret}`;
  const sanitizedCustom = redactor.redactString(customLog);
  if (sanitizedCustom.includes(proprietarySecret)) {
    throw new Error(`Dynamic secret not redacted: ${sanitizedCustom}`);
  }
  if (!sanitizedCustom.includes('[REDACTED_SECRET]')) {
    throw new Error(`Dynamic secret mask missing: ${sanitizedCustom}`);
  }
  console.log(`✓ Dynamic secret successfully redacted`);

  // Test 4: Dynamic Secret Unregistration
  console.log('[Test 4] Testing dynamic secret unregistration...');
  redactor.unregisterSecret(proprietarySecret);
  const unregLog = redactor.redactString(customLog);
  if (!unregLog.includes(proprietarySecret)) {
    throw new Error(`Unregistered secret should not have been redacted: ${unregLog}`);
  }
  console.log(`✓ Dynamic secret unregistration verified`);

  // Test 5: Deep Object Redaction with Key-name and Value Sanitization
  console.log('[Test 5] Testing deep object traversal and sensitive key masking...');
  redactor.registerSecret('dynamic_in_nested_array_val');
  const complexPayload = {
    user: 'security-lead',
    apiKey: 'explicit_sensitive_key_value_12345',
    metadata: {
      headers: {
        authorization: 'Bearer eyJhbGciOi.secret_claims_here.sig',
      },
      envArray: [
        'debug=true',
        'runtime_key=AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6',
        'dynamic_in_nested_array_val',
      ],
    },
  };

  const sanitizedPayload = redactor.redactObject(complexPayload);
  if (sanitizedPayload.apiKey !== '[REDACTED_SECRET]') {
    throw new Error(`Sensitive key apiKey was not masked: ${sanitizedPayload.apiKey}`);
  }
  if (sanitizedPayload.metadata.headers.authorization.includes('secret_claims_here')) {
    throw new Error(`Nested bearer token was not redacted: ${sanitizedPayload.metadata.headers.authorization}`);
  }
  if (sanitizedPayload.metadata.envArray[1].includes('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6')) {
    throw new Error(`Array item with Google key was not redacted`);
  }
  if (sanitizedPayload.metadata.envArray[2].includes('dynamic_in_nested_array_val')) {
    throw new Error(`Dynamic secret in array was not redacted`);
  }
  console.log(`✓ Deep object redaction verified with nested array and object traversal`);

  // Test 6: Cyclic Object Handling
  console.log('[Test 6] Testing cyclic object handling...');
  const cyclicObj: any = { name: 'cyclic-node' };
  cyclicObj.self = cyclicObj;
  const sanitizedCyclic = redactor.redactObject(cyclicObj);
  if (sanitizedCyclic.self !== '[Circular]') {
    throw new Error(`Circular reference was not handled properly: ${sanitizedCyclic.self}`);
  }
  console.log(`✓ Cyclic object structure handled safely without stack overflow`);

  // Test 7: Audit Event Sanitization
  console.log('[Test 7] Testing AuditEvent record sanitization...');
  const rawAuditEvent: AuditEvent = {
    id: 'AUD-TEST-01',
    actor: 'admin@docmonstakrakin.local',
    timestamp: new Date().toISOString(),
    action: 'ROTATE_KEY',
    target: 'API Key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6',
    reason: 'Emergency rotation of sk-abcdef12345678901234',
    stateHash: 'abc123state',
    details: {
      service: 'gemini',
      tokenValue: 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6',
      nested: {
        password: 'PlainTextPassword123!',
      },
    },
  };

  const sanitizedEvent = redactor.sanitizeAuditEvent(rawAuditEvent);
  if (sanitizedEvent.target.includes('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6')) {
    throw new Error(`AuditEvent target leaked API key`);
  }
  if (sanitizedEvent.reason?.includes('sk-abcdef12345678901234')) {
    throw new Error(`AuditEvent reason leaked OpenAI key`);
  }
  if (sanitizedEvent.details?.tokenValue.includes('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6')) {
    throw new Error(`AuditEvent details leaked tokenValue`);
  }
  if (sanitizedEvent.details?.nested?.password !== '[REDACTED_SECRET]') {
    throw new Error(`AuditEvent password key not masked`);
  }
  console.log(`✓ AuditEvent fields safely sanitized`);

  // Test 8: Console Interceptor Output Sanitization
  console.log('[Test 8] Testing console interceptor output filtering...');
  const capturedLogs: string[] = [];
  const fakeConsoleLog = (...args: any[]) => {
    capturedLogs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };

  // Temporarily replace real console with interceptor
  const origLog = console.log;
  console.log = fakeConsoleLog;

  try {
    redactor.installConsoleInterceptor();
    console.log('Runtime config: key=AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6');
    redactor.restoreConsoleInterceptor();
  } finally {
    console.log = origLog;
  }

  const interceptedLog = capturedLogs[capturedLogs.length - 1];
  if (!interceptedLog || interceptedLog.includes('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6')) {
    throw new Error(`Console interceptor failed to redact log: ${interceptedLog}`);
  }
  if (!interceptedLog.includes('[REDACTED_SECRET]')) {
    throw new Error(`Console interceptor did not apply mask: ${interceptedLog}`);
  }
  console.log(`✓ Console interceptor safely redacted console.log output: "${interceptedLog}"`);

  // Test 9: Normal Error Preservation
  console.log('[Test 9] Testing normal Error object redaction...');
  const normalErr = new Error('Database connection failed on port 5432');
  const redactedNormalErr = redactor.redactObject(normalErr);
  if (!(redactedNormalErr instanceof Error) && typeof redactedNormalErr !== 'object') {
    throw new Error('Redacted normal error is not an Error or object');
  }
  if (redactedNormalErr.message !== 'Database connection failed on port 5432') {
    throw new Error(`Normal error message altered unexpectedly: ${redactedNormalErr.message}`);
  }
  console.log('✓ Normal Error preserved and legible');

  // Test 10: Secret-bearing Error Redaction
  console.log('[Test 10] Testing secret-bearing Error object redaction...');
  const secretKeyVal = 'AIzaSySecretBearingErrorToken98765';
  redactor.registerSecret(secretKeyVal);
  const secretErr = new Error(`Authentication failed using key: ${secretKeyVal}`);
  const redactedSecretErr = redactor.redactObject(secretErr);
  if (redactedSecretErr.message.includes(secretKeyVal)) {
    throw new Error(`Secret leaked in Error message: ${redactedSecretErr.message}`);
  }
  if (!redactedSecretErr.message.includes('[REDACTED_SECRET]')) {
    throw new Error(`Secret mask missing in Error message: ${redactedSecretErr.message}`);
  }
  console.log('✓ Secret in Error message properly redacted');

  // Test 11: Error with cause Redaction
  console.log('[Test 11] Testing Error with cause property...');
  const nestedSecret = 'ghp_NestedCauseToken1234567890abcdefgh';
  const causeErr = new Error(`Underlying network timeout with token ${nestedSecret}`);
  const topErr = new Error('Service call failed', { cause: causeErr });
  const redactedTopErr = redactor.redactObject(topErr);
  if (!redactedTopErr.cause || typeof redactedTopErr.cause !== 'object') {
    throw new Error('Nested cause not preserved on redacted error');
  }
  const causeObj = redactedTopErr.cause as { message: string };
  if (causeObj.message.includes(nestedSecret)) {
    throw new Error(`Secret leaked in nested cause: ${causeObj.message}`);
  }
  if (!causeObj.message.includes('[REDACTED_SECRET]')) {
    throw new Error('Mask missing in nested cause message');
  }
  console.log('✓ Error with nested cause safely sanitized');

  // Test 12: Cyclic Error Handling
  console.log('[Test 12] Testing cyclic Error object handling...');
  const cyclicErr: any = new Error('Cyclic error condition');
  cyclicErr.self = cyclicErr;
  const otherObj: any = { note: 'reference' };
  otherObj.backToErr = cyclicErr;
  cyclicErr.linked = otherObj;

  const redactedCyclicErr = redactor.redactObject(cyclicErr);
  if (redactedCyclicErr.self !== '[Circular]') {
    throw new Error(`Cyclic Error self reference not converted to [Circular]: ${redactedCyclicErr.self}`);
  }
  if (redactedCyclicErr.linked?.backToErr !== '[Circular]') {
    throw new Error(`Indirect cyclic Error reference not converted to [Circular]: ${redactedCyclicErr.linked?.backToErr}`);
  }
  console.log('✓ Cyclic Error handled without recursion or stack overflow');

  console.log('\n=== ALL DMK-157.5 REDACTION TESTS PASSED (12/12) ===');
}

runRedactionTests().catch((err) => {
  console.error('Redaction test failed:', err);
  process.exit(1);
});
