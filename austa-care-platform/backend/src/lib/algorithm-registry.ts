/**
 * Algorithm Versioning Registry
 *
 * Centralised source of truth for all clinical algorithm versions.
 * Bump versions here when scoring logic, detection rules, or
 * evidence-based thresholds change.
 *
 * AUSTA Care Platform — Clinical Intelligence Layer
 */

export const ALGORITHM_VERSIONS = {
  'risk-assessment': '1.0.0',
  'emergency-detection': '1.0.0',
  'symptom-analysis': '1.0.0',
  'population-stratification': '1.0.0',
} as const;

/**
 * Resolve the current version for a named algorithm.
 * Compile-time safe — only accepts registered algorithm keys.
 */
export function getAlgorithmVersion(
  name: keyof typeof ALGORITHM_VERSIONS,
): string {
  return ALGORITHM_VERSIONS[name];
}
