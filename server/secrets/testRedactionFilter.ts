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

  console.log('\n=== ALL DMK-157.5 REDACTION TESTS PASSED (8/8) ===');
}

runRedactionTests().catch((err) => {
  console.error('Redaction test failed:', err);
  process.exit(1);
});
