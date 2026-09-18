/** Errors cross API boundaries as structured 422 responses; no malformed text is committed. */
export class DerivationError extends Error {
  code = 'INVALID_GENERATED_ARTIFACT';
  constructor(public path: string, message: string) { super(`${path}: ${message}`); }
  toJSON() { return { code: this.code, path: this.path, message: this.message }; }
}
export function validateText(value: unknown, path = 'text'): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new DerivationError(path, 'Required text is missing');
  if (/\[object (Object|Array)\]|\{\{[^}]*\}\}|\$\{[^}]+\}|<%=[\s\S]*?%>|__PLACEHOLDER__/.test(value)) {
    const error=new DerivationError(path, 'Unresolved template or serialization artifact');error.code='INVALID_TEMPLATE_ARTIFACT';throw error;
  }
}
export function validateGenerated(value: unknown, path = 'artifact'): void {
  if (typeof value === 'string') { if (value.trim()) validateText(value, path); }
  else if (Array.isArray(value)) value.forEach((v, i) => validateGenerated(v, `${path}[${i}]`));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => validateGenerated(v, `${path}.${k}`));
  else if (typeof value === 'number' && !Number.isFinite(value)) throw new DerivationError(path, 'Non-finite number');
}
export function answerText(answer: unknown): string {
  if (answer == null) throw new DerivationError('answer', 'Required substitution missing');
  const text = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
  validateText(text, 'answer');
  return text;
}
export function substitute(template: string, answer: string): string {
  const text = template.replaceAll('{{ANSWER}}', answer);
  validateText(text);
  return text;
}
