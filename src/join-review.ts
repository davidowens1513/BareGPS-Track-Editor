import { distance, reverse, uid, type Track } from "./model";

// Avoid interrupting normal short joins or suggesting a barely better direction.
const REVIEW_GAP_METRES = 500;
const CLEAR_SAVING_METRES = 250;
const LONG_GAP_METRES = 5000;

export interface JoinReview {
  index: number;
  gap: number;
  suggestion: { reverseIndexes: number[]; gap: number; saving: number } | null;
}

export function findJoinReview(
  plan: Track[],
  reviewed: Set<number> = new Set(),
): JoinReview | null {
  for (let index = 0; index < plan.length - 1; index++) {
    if (reviewed.has(index)) continue;
    const first = plan[index],
      next = plan[index + 1];
    const gap = distance(first.points.at(-1)!, next.points[0]);
    if (gap < REVIEW_GAP_METRES) continue;
    // Include neighbouring joins: fixing this connection must not make the
    // surrounding plan worse. Geometry within each track is unchanged.
    const joins = [index - 1, index, index + 1].filter(
      (i) => i >= 0 && i < plan.length - 1,
    );
    const gapAt = (i: number, reversed: number[]) => {
      const a = plan[i].points,
        b = plan[i + 1].points;
      return distance(
        reversed.includes(i) ? a[0] : a.at(-1)!,
        reversed.includes(i + 1) ? b.at(-1)! : b[0],
      );
    };
    const oldTotal = joins.reduce((sum, i) => sum + gapAt(i, []), 0);
    const options = [[index], [index + 1], [index, index + 1]]
      .map((reverseIndexes) => {
        const newGap = gapAt(index, reverseIndexes);
        const saving =
          oldTotal -
          joins.reduce((sum, i) => sum + gapAt(i, reverseIndexes), 0);
        return { reverseIndexes, gap: newGap, saving };
      })
      .filter(
        (option) =>
          option.gap <= gap / 3 &&
          gap - option.gap >= CLEAR_SAVING_METRES &&
          option.saving >= CLEAR_SAVING_METRES,
      )
      .sort(
        (a, b) =>
          b.saving - a.saving ||
          a.reverseIndexes.length - b.reverseIndexes.length,
      );
    if (options.length || gap >= LONG_GAP_METRES)
      return { index, gap, suggestion: options[0] ?? null };
  }
  return null;
}

export function reversePlanCopies(plan: Track[], indexes: number[]): Track[] {
  if (
    !indexes.length ||
    indexes.some((i) => !Number.isInteger(i) || i < 0 || i >= plan.length)
  )
    throw new Error("The Route Plan changed. Check its sections again.");
  return plan.map((track, index) =>
    indexes.includes(index)
      ? { ...reverse(track), id: uid(), planReversed: !track.planReversed }
      : track,
  );
}
