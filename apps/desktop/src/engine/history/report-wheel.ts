import { createHash } from "node:crypto";
import type { ReportPlan, ReportTarget } from "../../shared/report-plans";

/**
 * Picks where one unit of usage is reported.
 *
 * Weights are honoured over time, not in order: a 30/20/50 plan lands on the first
 * target for roughly three requests in ten, and can land on it several times in a
 * row, exactly like a wheel. The pick is a hash of the unit's own identity rather
 * than a random number, so the same request keeps its target when a save is
 * retried or interrupted — an observation's id is its content, and a changing
 * label would upload the same request again under a new identity.
 */
export function spinTarget(plan: ReportPlan | null, key: string): ReportTarget | null {
  if (!plan || plan.targets.length === 0) return null;
  const total = plan.targets.reduce((sum, target) => sum + target.weight, 0);
  if (total <= 0) return null;
  const digest = createHash("sha256")
    .update(`${plan.source}\u0000${key}\u0000${plan.targets.map(target => `${target.reportAs}:${target.model}:${target.weight}`).join("|")}`)
    .digest();
  // 32 bits is plenty: the bucket is compared against a cumulative weight, and a
  // plan whose weights are small still lands proportionally.
  const bucket = digest.readUInt32BE(0) / 0x1_0000_0000;
  let cumulative = 0;
  for (const target of plan.targets) {
    cumulative += target.weight / total;
    if (bucket < cumulative) return target;
  }
  return plan.targets[plan.targets.length - 1];
}
