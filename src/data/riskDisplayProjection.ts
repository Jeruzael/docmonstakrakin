const unavailable = 'Unavailable';
const storedText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;
const storedList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => storedText(item) !== undefined) : [];
const scale = (value: unknown, maximum: number): string =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= maximum
    ? `${value} / ${maximum}` : unavailable;
const level = (value: unknown): string =>
  typeof value === 'string' && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(value) ? value : unavailable;

/** Display admission only. Stored scores, levels and floor flags are not recomputed
 * or authenticated, and this projection supplies no aggregate risk decision. */
export function projectRiskDisplay(value: unknown) {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return {
    id: storedText(record.id) ?? unavailable,
    title: storedText(record.title) ?? unavailable,
    description: storedText(record.description) ?? unavailable,
    inherentScore: scale(record.inherentScore, 25),
    inherentLevel: level(record.inherentLevel),
    inherentLikelihood: scale(record.inherentLikelihood, 5),
    inherentImpact: scale(record.inherentImpact, 5),
    residualScore: scale(record.residualScore, 25),
    residualLevel: level(record.residualLevel),
    residualLikelihood: scale(record.residualLikelihood, 5),
    residualImpact: scale(record.residualImpact, 5),
    drivers: storedList(record.drivers),
    controls: storedList(record.controls),
    treatment: typeof record.treatment === 'string' && ['MITIGATE', 'ACCEPT', 'TRANSFER', 'AVOID'].includes(record.treatment)
      ? record.treatment : unavailable,
    floorFlag: record.mandatoryFloorApplied === true ? 'Applied'
      : record.mandatoryFloorApplied === false ? 'Not applied' : unavailable,
    floorReason: record.mandatoryFloorApplied === true ? storedText(record.floorReason) ?? unavailable : undefined,
  };
}
