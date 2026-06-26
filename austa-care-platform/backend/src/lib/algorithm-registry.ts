/**
 * lib/algorithm-registry.ts — Centralized Healthcare Algorithm Version Registry
 *
 * AUSTA Care Platform — healthcare brasileira (ANVISA RDC 657/2022 compliance).
 *
 * Every clinical scoring algorithm MUST be registered here with a semantic
 * version.  Any change to clinical logic (thresholds, weights, rules) requires
 * a version bump and a corresponding entry in the audit trail.
 *
 * INVARIANT #3: Versionamento de Algoritmos
 *   "Todo score clínico salvo deve registrar algorithm_version."
 *
 * Usage:
 *   import { ALGORITHM_VERSIONS } from '../lib/algorithm-registry';
 *   const version = ALGORITHM_VERSIONS['risk-assessment'];
 */

export const ALGORITHM_VERSIONS = {
  /** Risk stratification engine — compound cardiovascular, diabetes, mental-health, respiratory */
  'risk-assessment': '1.0.0',

  /** Emergency detection — real-time critical condition identification */
  'emergency-detection': '1.0.0',

  /** Symptom analysis — NLP-based symptom extraction and classification */
  'symptom-analysis': '1.0.0',

  /** Population stratification — demographic and epidemiological risk grouping */
  'population-stratification': '1.0.0',
} as const;

export type AlgorithmId = keyof typeof ALGORITHM_VERSIONS;

/**
 * Resolve the full version tag for a given algorithm.
 * Converts e.g. 'risk-assessment' → 'risk-v1.0.0'
 */
export function getAlgorithmVersion(id: AlgorithmId): string {
  const short = id.split('-')[0] ?? id;
  return `${short}-v${ALGORITHM_VERSIONS[id]}`;
}

/**
 * Validate that a recorded algorithm_version matches the current registry.
 * Returns true if the version is still current; false if it has been superseded.
 */
export function isCurrentVersion(
  id: AlgorithmId,
  recordedVersion: string
): boolean {
  return getAlgorithmVersion(id) === recordedVersion;
}
