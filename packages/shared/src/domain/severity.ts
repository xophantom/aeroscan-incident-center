import { MAX_SEVERITY } from './occurrence.js'

export function bumpSeverity(severity: number): number {
  return Math.min(severity + 1, MAX_SEVERITY)
}
