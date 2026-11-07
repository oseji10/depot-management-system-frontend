export const RUN_TONE = { draft: "neutral", approved: "warn", paid: "good", void: "bad" } as const;
export const RUN_LABEL = { draft: "Draft", approved: "Approved, unpaid", paid: "Paid", void: "Void" } as const;
export const monthLabel = (period: string) => new Date(`${period}-01T00:00:00`).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
