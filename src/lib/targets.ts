import { formatKobo } from "./format";
import type { TargetLine } from "./types";

/** "12 of 30 crates" for a product target, "₦1,200,000 of ₦2,000,000" for an all-products target. */
export function progressText(t: TargetLine): string {
  return t.all_products
    ? `${formatKobo(t.achieved_base)} of ${formatKobo(t.target_base)}`
    : `${t.achieved.toLocaleString("en-NG")} of ${t.quantity.toLocaleString("en-NG")} ${t.unit}`;
}

/** How the reward is worked out, in words. */
export function rewardText(t: TargetLine): string {
  if (t.reward_type === "salary_percent") return `${t.reward_percent}% of salary (${formatKobo(t.reward_full)})`;
  if (t.reward_type === "fixed_percent") return `${t.reward_percent}% of ${formatKobo(t.reward_base)}`;
  return `${formatKobo(t.reward_full)} flat`;
}
