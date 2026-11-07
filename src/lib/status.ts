export const PO_LABEL = {
  draft: "Draft", ordered: "Ordered", partially_received: "Partly received", received: "Received", cancelled: "Cancelled",
} as const;

export const PO_TONE = { draft: "neutral", ordered: "warn", partially_received: "warn", received: "good", cancelled: "bad" } as const;

export const GRN_LABEL = { draft: "Draft", posted: "Posted", reversed: "Reversed" } as const;

export const GRN_TONE = { draft: "warn", posted: "good", reversed: "bad" } as const;

export const ACCOUNT_TYPE_LABEL = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  other_income: "Other income",
  cogs: "Cost of sales",
  expense: "Expense",
} as const;

export const REBATE_LABEL = { draft: "Draft", approved: "Approved", settled: "Settled", void: "Void" } as const;

export const REBATE_TONE = { draft: "warn", approved: "good", settled: "neutral", void: "bad" } as const;

export const METHOD_LABEL = { all_units: "Whole volume at the tier reached", marginal: "Each slice at its own tier" } as const;

export const TREATMENT_LABEL = { income: "Rebate income", cogs_reduction: "Reduction of cost of sales" } as const;

export const SALE_LABEL = { completed: "Completed", void: "Void" } as const;

export const PAYMENT_LABEL = { paid: "Paid", partial: "Part paid", unpaid: "Unpaid" } as const;

export const PAYMENT_TONE = { paid: "good", partial: "warn", unpaid: "bad" } as const;

export const METHOD_PAY_LABEL = { cash: "Cash", transfer: "Bank transfer", pos: "POS card" } as const;

/** Field and counter tills also offer "On credit": nothing is paid now and the amount goes on the customer's account. */
export const CREDIT_LABEL = "On credit";

export const CHANNEL_LABEL = { counter: "Counter", phone: "Phone order", delivery: "Delivery" } as const;

export const PROFORMA_LABEL = { draft: "Draft", sent: "Sent", accepted: "Accepted", cancelled: "Cancelled", converted: "Became a sale" } as const;
export const PROFORMA_TONE = { draft: "neutral", sent: "warn", accepted: "good", cancelled: "bad", converted: "good" } as const;
