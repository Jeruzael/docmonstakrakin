import type {AuditEvent} from '../../src/types.js';
import {defaultRedactor, type SecretRedactor} from '../secrets/redactionFilter.js';
import {computeAuditEventHash} from './auditImmutability.js';

/** The only hashed representation is the sanitized representation we persist. */
export function sanitizeAndHashAudit(event:AuditEvent, redactor:SecretRedactor=defaultRedactor):AuditEvent {
  const safe=redactor.sanitizeAuditEvent(event);
  safe.actor=redactor.redactString(safe.actor);
  safe.action=redactor.redactString(safe.action);
  safe.stateHash=computeAuditEventHash(safe);
  return safe;
}
