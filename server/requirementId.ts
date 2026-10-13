import { randomUUID } from 'node:crypto';

export interface RequirementIdValidationResult {
  valid: boolean;
  id?: string;
  status?: 400 | 409;
  error?: string;
}

/**
 * Validates a caller-supplied requirement ID against format rules and uniqueness in the project.
 */
export function validateRequirementId(
  id: unknown,
  existingRequirements: Array<{ id: string }>
): RequirementIdValidationResult {
  if (typeof id !== 'string' || id.trim().length === 0) {
    return {
      valid: false,
      status: 400,
      error: 'Requirement ID must be a non-empty string',
    };
  }

  const cleanId = id.trim();
  const exists = existingRequirements.some((r) => r.id === cleanId);
  if (exists) {
    return {
      valid: false,
      status: 409,
      error: `Requirement with ID ${cleanId} already exists in project`,
    };
  }

  return {
    valid: true,
    id: cleanId,
  };
}

/**
 * Generates a collision-resistant unique requirement ID within the project collection
 * using Node.js randomUUID() with bounded retries and fail-closed behavior.
 */
export function generateUniqueRequirementId(
  existingRequirements: Array<{ id: string }>,
  generator: () => string = () => `REQ-GEN-${randomUUID()}`,
  maxRetries = 10
): string {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = generator();
    if (!existingRequirements.some((r) => r.id === candidate)) {
      return candidate;
    }
  }
  throw new Error('Failed to generate unique requirement ID within retry limit');
}
