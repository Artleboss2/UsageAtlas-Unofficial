import type { ReportPlan, ReportTarget } from "./report-plans";

/**
 * Picks where one unit of usage is reported.
 *
 * Weights are honoured over time, not in order: a 30/20/50 plan lands on the first
 * target for roughly three requests in ten, and can land on it several times in a
 * row, exactly like a wheel. The pick is a hash of the unit's own identity rather
 * than a random number, so the same request keeps its target when a save is
 * retried or interrupted — an observation's id is its content, and a changing
 * label would upload the same request again under a new identity.
 *
 * The hash is implemented here rather than with `node:crypto` so the Attribution
 * preview runs in the renderer and computes exactly the label the engine will
 * upload.
 */
export function wheelTarget(plan: ReportPlan | null, key: string): ReportTarget | null {
  if (!plan || plan.targets.length === 0) return null;
  const total = plan.targets.reduce((sum, target) => sum + target.weight, 0);
  if (total <= 0) return null;
  const bucket = wheelBucket(`${plan.source}\u0000${key}\u0000${plan.targets.map(target => `${target.reportAs}:${target.model}:${target.weight}`).join("|")}`);
  let cumulative = 0;
  for (const target of plan.targets) {
    cumulative += target.weight / total;
    if (bucket < cumulative) return target;
  }
  return plan.targets[plan.targets.length - 1];
}

/** 32 readable bits of FNV-1a with an avalanche step, as a fraction in [0, 1). */
export function wheelBucket(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x1_0000_0000;
}

export interface TargetPreview extends ReportTarget {
  /** Share the rule declares, as a fraction. */
  declared: number;
  /** Share measured over the sampled request identities. */
  sampled: number;
  requests: number;
}

export interface PlanPreview {
  source: string;
  targets: TargetPreview[];
  /** Request identities the sample used, so a test can follow one through. */
  sampleSize: number;
  /** Largest distance between a declared share and the sampled one, in points. */
  driftPoints: number;
}

/**
 * Runs the wheel over `sampleSize` request identities. The caller gets the same
 * answer as an upload of that many requests, because both use `wheelTarget`.
 */
export function previewPlan(plan: ReportPlan, sampleSize = 1_000): PlanPreview {
  const counts = new Map<ReportTarget, number>(plan.targets.map(target => [target, 0]));
  for (let index = 0; index < sampleSize; index += 1) {
    const target = wheelTarget(plan, `preview-${index}`);
    if (target) counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  const total = plan.targets.reduce((sum, target) => sum + target.weight, 0);
  const targets = plan.targets.map(target => {
    const declared = total > 0 ? target.weight / total : 0;
    const requests = counts.get(target) ?? 0;
    return {
      ...target,
      declared,
      requests,
      sampled: sampleSize > 0 ? requests / sampleSize : 0
    };
  });
  const driftPoints = Math.max(0, ...targets.map(target =>
    Math.abs(target.sampled * 100 - target.declared * 100)));
  return { source: plan.source, targets, sampleSize, driftPoints };
}
