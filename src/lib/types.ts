export type Level = "platform" | "store" | "branch";

export type Session = {
  user: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    is_super_admin: boolean;
    store_id: number | null;
    branch_id: number | null;
  };
  store: { id: number; name: string; slug: string; currency: string; timezone: string; logo_url?: string | null; address?: string | null; phone?: string | null; email?: string | null; disabled_menus?: string[] } | null;
  branch: { id: number; name: string; code: string } | null;
  subscription?: SubscriptionState | null;
  level: Level;
  /** Set for van salesmen: the van they sell from. */
  van?: { id: number; name: string } | null;
  roles: string[];
  permissions: string[];
};

export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
};

export type Store = {
  id: number;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  settings?: { disabled_menus?: string[] } | null;
  branches_count?: number;
  users_count?: number;
};

export type Branch = {
  id: number;
  name: string;
  code: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  is_head_office: boolean;
  is_active: boolean;
  store?: { id: number; name: string };
  warehouses_count?: number;
  users_count?: number;
};

export type Warehouse = {
  id: number;
  name: string;
  code: string;
  is_default: boolean;
  is_active: boolean;
  branch_id: number;
  branch?: { id: number; name: string };
};

export type AppUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  branch_id: number | null;
  branch?: { id: number; name: string } | null;
  store?: { id: number; name: string } | null;
  role?: { id: number; name: string } | null;
  last_login_at: string | null;
};

export type Role = { id: number; name: string; is_template: boolean; is_owner?: boolean; permissions: string[] };

export type AuditEntry = {
  id: number;
  event: string;
  auditable_type: string | null;
  auditable_id: number | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user?: { id: number; name: string } | null;
};

export type ProductCategory = {
  id: number;
  name: string;
  parent_id: number | null;
  parent?: { id: number; name: string } | null;
  sort_order: number;
  is_active: boolean;
  products_count?: number;
};

export type RebateCategory = {
  id: number;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  products_count?: number;
};

export type Unit = { id: number; name: string; abbreviation: string };

export type ProductUnit = {
  id: number;
  unit_id: number;
  factor: number;
  barcode: string | null;
  is_base: boolean;
  is_active: boolean;
  unit?: Unit;
};

export type Product = {
  id: number;
  stock_units?: number;
  sku: string;
  name: string;
  brand: string | null;
  size_label: string | null;
  packaging: "rgb" | "pet" | "can" | "other";
  is_returnable: boolean;
  tracks_expiry?: boolean;
  expiry_alert_days?: number | null;
  image_url?: string | null;
  bottle_container_id?: number | null;
  crate_container_id?: number | null;
  category_id: number;
  rebate_category_id: number | null;
  base_unit_id: number;
  units_per_case: number | null;
  is_active: boolean;
  category?: { id: number; name: string };
  rebate_category?: { id: number; name: string } | null;
  base_unit?: Unit;
  units: ProductUnit[];
};

export type PriceList = {
  id: number;
  name: string;
  type: "standard" | "promo";
  starts_on: string | null;
  ends_on: string | null;
  priority: number;
  is_default: boolean;
  is_active: boolean;
  prices_count?: number;
};

export type PriceRow = {
  product_unit_id: number;
  product_name: string;
  sku: string;
  size_label: string | null;
  unit_name: string;
  factor: number;
  is_base: boolean;
  price: string | null;
  standard_price: string | null;
};

// ---- stock ----
export type StockStatus = "saleable" | "damaged" | "expired";
export type Pack = { name: string; factor: number };

export type OnHandRow = {
  warehouse: { id: number; name: string };
  product: { id: number; name: string; sku: string; size_label: string | null; category: string | null; base_unit: string | null; pack: Pack | null; packs?: Pack[] };
  saleable: number;
  damaged: number;
  expired: number;
  total: number;
  reorder_level: number | null;
  is_low: boolean;
};

export type LowStockRow = {
  warehouse: { id: number; name: string };
  product: { id: number; name: string; sku: string };
  saleable: number;
  min_quantity: number;
  shortfall: number;
};

export type Movement = {
  id: number;
  warehouse_id: number;
  status: StockStatus;
  quantity: number;
  movement_type: string;
  reference: string | null;
  note: string | null;
  occurred_at: string;
  product?: { id: number; name: string; sku: string };
  warehouse?: { id: number; name: string };
  user?: { id: number; name: string } | null;
};

type DocLine = { id: number; product?: { id: number; name: string; sku: string } };

export type Adjustment = {
  id: number;
  number: string;
  kind: "adjustment" | "reclassify";
  reason: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  warehouse?: { id: number; name: string };
  creator?: { id: number; name: string };
  approver?: { id: number; name: string } | null;
  lines_count?: number;
  lines?: (DocLine & { status: StockStatus; to_status: StockStatus | null; quantity: number })[];
};

export type Transfer = {
  id: number;
  number: string;
  note: string | null;
  posted_at: string;
  from_warehouse?: { id: number; name: string };
  to_warehouse?: { id: number; name: string };
  creator?: { id: number; name: string };
  lines_count?: number;
  lines?: (DocLine & { quantity: number })[];
};

export type CountLine = {
  id: number;
  product_id: number;
  status: StockStatus;
  expected_quantity: number;
  counted_quantity: number | null;
  posted_variance: number | null;
  current_quantity: number | null;
  drifted: boolean;
  product: { id: number; name: string; sku: string; size_label: string | null; units: ProductUnit[] };
};

export type StockCountDoc = {
  id: number;
  number: string;
  status: "counting" | "submitted" | "approved" | "cancelled";
  note: string | null;
  created_at: string;
  warehouse?: { id: number; name: string };
  creator?: { id: number; name: string };
  lines_count?: number;
  lines?: CountLine[];
};

// ---- purchasing ----
export type Supplier = {
  id: number;
  name: string;
  code: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  payment_terms_days: number;
  is_manufacturer: boolean;
  is_active: boolean;
};

type DocProduct = { id: number; name: string; sku: string; tracks_expiry?: boolean; base_unit?: { id: number; name: string }; units?: ProductUnit[] };

export type PurchaseOrderLine = {
  id: number;
  product?: DocProduct;
  unit?: { id: number; name: string };
  unit_id: number;
  factor: number;
  quantity: number;
  unit_cost: string;
  quantity_base?: number;
  received_base?: number;
  outstanding_base?: number;
};

export type PurchaseOrder = {
  id: number;
  number: string;
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  order_date: string;
  expected_date: string | null;
  note: string | null;
  supplier_id: number;
  warehouse_id: number;
  supplier?: { id: number; name: string };
  warehouse?: { id: number; name: string };
  creator?: { id: number; name: string };
  lines_count?: number;
  lines?: PurchaseOrderLine[];
  total_value?: string;
};

export type ReceiptLine = {
  id: number;
  purchase_order_line_id: number | null;
  product_id: number;
  unit_id: number;
  factor: number;
  delivered: number;
  accepted: number;
  damaged: number;
  rejected: number;
  unit_cost: string;
  reason: string | null;
  batch_no?: string | null;
  expiry_date?: string | null;
  product?: DocProduct;
  unit?: { id: number; name: string };
};

export type ReceiptFile = { id: number; original_name: string; mime: string; size: number; created_at: string };

export type GoodsReceipt = {
  files?: ReceiptFile[];
  id: number;
  number: string;
  status: "draft" | "posted" | "reversed";
  supplier_reference: string | null;
  received_on: string;
  vehicle_no: string | null;
  note: string | null;
  supplier_id: number;
  warehouse_id: number;
  purchase_order_id: number | null;
  posted_at: string | null;
  reversal_reason: string | null;
  supplier?: { id: number; name: string; is_manufacturer: boolean };
  warehouse?: { id: number; name: string };
  purchase_order?: { id: number; number: string } | null;
  creator?: { id: number; name: string };
  poster?: { id: number; name: string } | null;
  lines_count?: number;
  lines?: ReceiptLine[];
};

export type Discrepancy = ReceiptLine & {
  receipt: { id: number; number: string; received_on: string; supplier_reference: string | null; supplier?: { id: number; name: string } };
};

export type ReceiptTemplate = {
  purchase_order: { id: number; number: string; supplier_id: number; warehouse_id: number };
  lines: {
    purchase_order_line_id: number;
    product: { id: number; name: string; sku: string };
    unit: { id: number; name: string };
    unit_id: number;
    factor: number;
    outstanding: number;
    unit_cost: string;
  }[];
};

// ---- Accounting ----

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "other_income" | "cogs" | "expense";

export type Account = {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  role: string | null;
  is_system: boolean;
  is_active: boolean;
  balance?: number; // kobo, on the account's natural side
};

export type FiscalPeriod = {
  id: number;
  starts_on: string;
  ends_on: string;
  status: "open" | "closed";
  closed_at: string | null;
};

export type JournalLine = {
  id: number;
  account_id: number;
  branch_id: number | null;
  debit: number; // kobo
  credit: number; // kobo
  memo: string | null;
  account?: { id: number; code: string; name: string };
};

export type JournalEntry = {
  id: number;
  number: string;
  status: "draft" | "posted";
  entry_date: string;
  memo: string;
  total: number; // kobo
  branch_id: number | null;
  branch?: { id: number; name: string } | null;
  source_type: string | null;
  source_id: number | null;
  reversal_of_id: number | null;
  reversed_at: string | null;
  posted_at: string | null;
  created_at: string;
  creator?: { id: number; name: string };
  poster?: { id: number; name: string } | null;
  lines?: JournalLine[];
};

// ---- Rebates ----

export type RebateTier = { id?: number; rebate_category_id: number; from_cases: number; rate: number };

export type RebateCluster = { id?: number; name: string; volume_above: number | null; tiers: RebateTier[] };

export type RebateAgreement = {
  id: number;
  name: string;
  effective_from: string;
  effective_to: string | null;
  method: "all_units" | "marginal";
  accounting_treatment: "income" | "cogs_reduction";
  is_active: boolean;
  note: string | null;
  clusters_count?: number;
  clusters?: RebateCluster[];
};

export type RebateLine = {
  id?: number;
  rebate_category_id: number;
  category_name: string;
  cases: number;
  eligible_value: number; // kobo
  tier_from: number | null;
  tier_rate: number;
  effective_rate: number;
  rebate: number; // kobo
  no_tier: boolean;
  next_tier_from?: number | null;
  next_tier_rate?: number | null;
  cases_to_next_tier?: number | null;
};

export type RebateCalculation = {
  id: number;
  number: string;
  status: "draft" | "approved" | "settled" | "void";
  period_start: string;
  period_end: string;
  method: "all_units" | "marginal";
  accounting_treatment: "income" | "cogs_reduction";
  cluster_name: string;
  cluster_volume: number;
  cluster_from: string;
  cluster_to: string;
  cluster_overridden: boolean;
  override_reason: string | null;
  total_eligible_value: number; // kobo
  total_rebate: number; // kobo
  warnings: { type: string; products: string[] }[] | null;
  approved_at: string | null;
  settlement_method: "bank" | "credit_note" | null;
  settled_on: string | null;
  settlement_reference: string | null;
  void_reason: string | null;
  created_at: string;
  sources_count?: number;
  agreement?: { id: number; name: string };
  creator?: { id: number; name: string };
  approver?: { id: number; name: string } | null;
  lines?: RebateLine[];
};

export type RebateProgress = {
  month: string;
  agreement: { id: number; name: string; method: "all_units" | "marginal" };
  cluster: string;
  cluster_volume: number;
  cluster_from: string;
  cluster_to: string;
  lines: RebateLine[];
  total_eligible_value: number;
  total_rebate: number;
  warnings: { type: string; products: string[] }[];
};

// ---- Sales ----

export type Customer = {
  id: number;
  name: string;
  type: "retail" | "wholesale";
  empties_mode?: EmptiesMode;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number; // kobo; 0 = cash only
  notes: string | null;
  is_active: boolean;
  outstanding?: number; // kobo
  orders_count?: number;
  last_sale_at?: string | null;
};

export type SaleLine = {
  id: number;
  product_id: number;
  unit_id: number;
  factor: number;
  quantity: number;
  list_price: number;
  unit_price: number;
  line_total: number;
  mix_group?: string | null;
  mix_label?: string | null;
  product?: { id: number; name: string; sku: string; size_label: string | null };
  unit?: { id: number; name: string };
};

export type SalePayment = {
  id: number;
  method: "cash" | "transfer" | "pos";
  pos_terminal_id?: number | null;
  terminal?: { id: number; name: string } | null;
  transfer_to?: "pos" | "account" | null;
  account?: { id: number; code: string; name: string } | null;
  amount: number;
  reference: string | null;
  paid_at: string;
  voided_at: string | null;
  receiver?: { id: number; name: string };
};

export type Sale = {
  id: number;
  number: string;
  channel: "counter" | "phone" | "delivery";
  status: "completed" | "void";
  payment_status: "paid" | "partial" | "unpaid";
  sold_at: string;
  subtotal: number;
  discount_total: number;
  total: number;
  deposit_total?: number;
  amount_paid: number;
  balance_due: number;
  note: string | null;
  void_reason: string | null;
  voided_at: string | null;
  customer: { id: number; name: string; phone: string | null } | null;
  warehouse?: { id: number; name: string };
  branch?: { id: number; name: string };
  creator?: { id: number; name: string };
  lines_count?: number;
  lines?: SaleLine[];
  payments?: SalePayment[];
  returned_total?: number;
  returns?: { id: number; number: string; returned_at: string; total: number; applied_to_balance: number; refunded: number; exchange_credit?: number; refund_method: "cash" | "transfer" | "exchange" | null }[];
};

export type SalesSummary = {
  orders: number;
  completed: number;
  voided: number;
  unpaid: number;
  sales: number;
  collected: number;
  outstanding: number;
  discounts: number;
};

export type PosUnit = {
  product_unit_id: number;
  unit_id: number;
  name: string;
  abbreviation: string;
  factor: number;
  barcode: string | null;
  price: number; // kobo
  original_price: number | null;
  is_promo: boolean;
};

export type PosProduct = {
  id: number;
  name: string;
  sku: string;
  brand: string | null;
  size_label: string | null;
  packaging: string;
  category_id: number;
  is_returnable: boolean;
  image_url?: string | null;
  bottle_container_id?: number | null;
  crate_container_id?: number | null;
  crate_size?: number;
  stock: number; // base units on the shelf
  units: PosUnit[];
};

export type PosCatalogue = {
  warehouse: { id: number; name: string; branch_id: number };
  categories: { id: number; name: string }[];
  products: PosProduct[];
  containers?: ContainerType[];
  terminals?: TerminalChoice[];
  transfer_accounts?: TransferAccount[];
  unpriced?: { id: number; name: string; why?: string }[];
  mix_layouts?: MixLayoutChoice[];
};

export type MixLayoutChoice = { id: number; name: string; row_count: number; row_size: number };

export type MixLayout = MixLayoutChoice & { units: number; is_active: boolean };

export type DashboardSummary = {
  stores: number | null;
  branches: number;
  warehouses: number;
  users: number;
  low_stock: number | null;
  on_road?: number | null;
  sync_issues?: number | null;
  sales: {
    today: { total: number; orders: number };
    month: { total: number; orders: number };
    outstanding: number;
    unpaid_orders: number;
    daily: { date: string; total: number; orders: number }[];
    top_products: { product_id: number; name: string; units: number; revenue: number }[];
  } | null;
};


// ---- Field sales ----

export type Rep = {
  id: number;
  routes?: { id: number; name: string }[];
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  branch: { id: number; name: string } | null;
  van: { id: number; name: string };
  branch_id?: number;
  terminal?: { id: number; name: string } | null;
  can_delete?: boolean;
  employee: { id: number; staff_no: string; status: string } | null;
  open_trip: { id: number; number: string; opened_at: string; device_pending: number; device_seen_at: string | null } | null;
  units_on_van: number;
  sold_today: number;
  orders_today: number;
};

export type TripRow = {
  id: number;
  number: string;
  status: "open" | "closed";
  rep: { id: number; name: string } | null;
  opened_at: string;
  closed_at: string | null;
  issued_units: number;
  sales_total: number;
  orders: number;
  cash_variance: number | null;
};

export type TripLineRow = {
  product_id: number;
  name: string;
  sku: string;
  size_label: string | null;
  base_unit: string | null;
  base_unit_id: number | null;
  pack: Pack | null;
  issued: number;
  sold: number;
  revenue: number;
  returned: number;
  damaged: number;
  shortage: number;
  with_rep: number;
};

export type TripReport = {
  trip: { id: number; number: string; status: "open" | "closed"; opened_at: string; closed_at: string | null; note: string | null; close_note: string | null; branch_id: number; van_warehouse_id: number };
  rep: { id: number; name: string; phone: string | null };
  van: { id: number; name: string };
  vehicle?: { id: number; reg_no: string; nickname: string | null; type: string } | null;
  terminal?: { id: number; name: string; provider: string | null } | null;
  lines: TripLineRow[];
  totals: { issued: number; sold: number; with_rep: number; returned: number; damaged: number; shortage: number };
  money: {
    orders: number; sales: number; collected: number; on_credit: number;
    cash: number; transfer: number; pos: number; cash_spent: number;
    cash_expected: number | null; cash_handed_in: number | null; cash_variance: number | null;
  };
  sales: { id: number; number: string; sold_at: string; status: "completed" | "void"; payment_status: "paid" | "partial" | "unpaid"; total: number; amount_paid: number; balance_due: number; customer: string | null }[];
  sync: { pending: number; seen_at: string | null; issues: number };
  imprest: ImprestBlock;
  expenses: { id: number; number: string; category: string | null; amount: number; method: "cash" | "bank" | "imprest"; paid_to: string | null; description: string | null; status: "posted" | "void"; date: string }[];
  loads: { id: number; kind: "issue" | "return"; at: string; by: string | null; warehouse: string | null; note: string | null; lines: { product: string | null; status: string; quantity: number }[] }[];
};

export type ImprestBlock = {
  issued: number; spent: number; balance: number;
  returned?: number; reimbursed?: number; unreturned?: number;
  items: { id: number; number: string; amount: number; method: "cash" | "bank"; status: "issued" | "void"; note: string | null; at: string; by: string | null }[];
};

export type FuelStationRow = { id: number; name: string; location: string | null; phone: string | null; is_active: boolean; price_per_litre: number | null; balance: number; litres: number; tracks_litres: boolean };

export type FuelVoucher = {
  id: number; number: string; code: string; amount: number; amount_used: number | null; litres: number | null; price_per_litre: number | null; vehicle: string | null;
  status: "issued" | "redeemed" | "cancelled"; note: string | null; created_at: string; redeemed_at: string | null; cancelled_at: string | null; void_reason: string | null;
  station?: { id: number; name: string; location?: string | null; phone?: string | null }; driver?: { id: number; name: string }; trip?: { id: number; number: string } | null;
  issuer?: { id: number; name: string } | null; voider?: { id: number; name: string } | null;
};

export type MyVan = { van: { id: number; name: string } | null; report: TripReport | null };

export type ExpenseCategory = { id: number; name: string; account_id: number; is_active: boolean; account?: { id: number; code: string; name: string } };

export type Expense = {
  id: number;
  number: string;
  expense_date: string;
  amount: number; // kobo
  method: "cash" | "bank";
  paid_to: string | null;
  description: string | null;
  status: "posted" | "void";
  offline: boolean;
  void_reason: string | null;
  category?: { id: number; name: string };
  branch?: { id: number; name: string };
  creator?: { id: number; name: string };
  trip?: { id: number; number: string } | null;
};

export type ExpenseList = Paginated<Expense> & { summary: { total: number; count: number; by_category: { name: string; total: number }[] } };

export type SyncIssue = {
  id: number;
  kind: "sale" | "expense" | "customer";
  client_ref: string;
  error: string;
  attempts: number;
  status: "open" | "resolved" | "dismissed";
  resolution: string | null;
  created_at: string;
  payload: Record<string, unknown>;
  rep?: { id: number; name: string };
  trip?: { id: number; number: string } | null;
};

export type EmptiesMode = "deposit" | "balance" | "none";

export type ContainerType = { id: number; name: string; kind: "bottle" | "crate"; deposit: number; is_active?: boolean };

export type ContainerSummary = ContainerType & {
  on_shelf: number;
  with_customers: number;
  owed_to_supplier: number;
  deposits_held: number;
  by_warehouse: { warehouse_id: number; name: string; qty: number }[];
};

export type ContainerHolding = { customer_id: number | null; customer: string; container_type_id: number; container: string; quantity: number; deposit: number };

export type ContainerMovement = {
  id: number;
  container_type_id: number;
  kind: string;
  qty_party: number;
  qty_depot: number;
  deposit: number;
  note: string | null;
  created_at: string;
  party_name: string | null;
  type?: { id: number; name: string };
};

export type TerminalChoice = { id: number; name: string; provider: string | null; account_id?: number | null };

/** An account a customer's bank transfer can be paid into. */
export type TransferAccount = {
  id: number; code: string; name: string; bank_name?: string | null; account_number?: string | null; account_name?: string | null;
  is_main?: boolean; terminal_ids?: number[];
};

/** A bank account on the Bank accounts page. */
export type BankAccount = {
  id: number; code: string; name: string; bank_name: string | null; account_number: string | null; account_name: string | null;
  is_active: boolean; is_main: boolean; balance: number; terminals: { id: number; name: string }[];
};

export type PosTerminal = {
  id: number;
  name: string;
  provider: string | null;
  terminal_id: string | null;
  merchant_id: string | null;
  serial_number: string | null;
  branch_id: number | null;
  assigned_user_id: number | null;
  account_id: number | null;
  notes: string | null;
  is_active: boolean;
  branch?: { id: number; name: string } | null;
  account?: { id: number; code: string; name: string } | null;
  assignee?: { id: number; name: string } | null;
};

export type TerminalSummary = {
  from: string;
  to: string;
  total: number;
  untagged: { payments: number; total: number };
  data: { id: number; name: string; provider: string | null; terminal_id: string | null; branch: string | null; is_active: boolean; payments: number; total: number; last_at: string | null }[];
};

export type TerminalTransactions = {
  terminal: PosTerminal;
  from: string;
  to: string;
  total: number;
  days: { day: string; payments: number; total: number }[];
  payments: Paginated<{ id: number; amount: number; reference: string | null; paid_at: string; sale: { id: number; number: string; customer: { name: string } | null }; receiver: { name: string } | null }>;
};

export type ExpiryState = "expired" | "soon" | "ok";

export type ExpiryBatch = {
  id: number;
  batch_no: string;
  expiry_date: string;
  quantity: number;
  days_left: number;
  state: ExpiryState;
  product: { id: number; name: string; sku: string; size_label: string | null };
  warehouse: { id: number; name: string };
};

export type ExpiryReport = {
  summary: { expired_units: number; expired_batches: number; soon_units: number; soon_batches: number; untracked_products: number };
  data: ExpiryBatch[];
  untracked: { product: { id: number; name: string; sku: string }; warehouse: { id: number; name: string }; quantity: number }[];
};

export type Employee = {
  id: number; staff_no: string; name: string; phone: string | null; job_title: string | null; department: string | null;
  user_id: number | null; user?: { id: number; name: string; email: string } | null;
  branch_id: number; branch?: { id: number; name: string } | null; branches?: { id: number; name: string }[]; hired_on: string | null; left_on: string | null; status: "active" | "left" | "archived";
  basic_salary: number; bank_name: string | null; account_number: string | null; account_name: string | null; notes: string | null;
  pay_items?: { pay_item_id: number; value: number | null }[];
  charges?: { id: number; number: string; reason: string; description: string; amount: number; recovered: number; installments: number; status: string }[];
};

export type PayItem = {
  id: number; name: string; kind: "earning" | "deduction"; calc: "fixed" | "percent_of_basic"; value: number; apply_to_all: boolean; is_active: boolean;
};

export type PayslipLine = { id: number; kind: "earning" | "deduction"; source: "basic" | "pay_item" | "staff_charge" | "target" | "manual"; label: string; amount: number };

export type Payslip = {
  id: number; basic: number; gross: number; charges_total: number; other_deductions: number; net: number;
  employee: { id: number; name: string; staff_no: string; job_title: string | null; phone?: string | null; bank_name: string | null; account_number: string | null; account_name: string | null };
  lines: PayslipLine[];
};

export type PayrollRun = {
  id: number; number: string; period: string; status: "draft" | "approved" | "paid" | "void"; branch_id: number | null;
  total_gross: number; total_deductions: number; total_net: number; note: string | null; pay_method: string | null; paid_at: string | null;
  approved_at: string | null; void_reason: string | null; payslips?: Payslip[];
};

export type StaffCharge = {
  id: number; number: string; reason: "damage" | "shortage" | "loss" | "other"; description: string; quantity: number | null; unit_amount: number | null;
  amount: number; recovered: number; installments: number; status: "pending" | "approved" | "cleared" | "rejected" | "waived"; incident_on: string | null;
  decision_note: string | null; employee?: { id: number; name: string; staff_no: string }; product?: { id: number; name: string } | null; creator?: { name: string };
};

export type VehicleRow = {
  id: number; reg_no: string; nickname: string | null; type: "truck" | "van" | "pickup" | "motorbike" | "other"; make: string | null; model: string | null;
  year: number | null; color: string | null; capacity_crates: number | null; chassis_no: string | null; engine_no: string | null;
  fuel_type: "petrol" | "diesel" | "gas" | "electric"; odometer: number; status: "active" | "in_workshop" | "retired";
  branch_id: number; branch?: { id: number; name: string } | null; default_driver_id: number | null; driver?: { id: number; name: string } | null; notes: string | null;
  open_trip?: { id: number; number: string; rep: string | null } | null; docs_expired?: number; docs_soon?: number;
};

export type VehicleDoc = { id: number; kind: string; reference: string | null; issued_on: string | null; expires_on: string | null; notes: string | null };
export type VehicleServiceRow = { id: number; serviced_on: string; kind: string; description: string; vendor: string | null; odometer: number | null; cost: number; expense_id: number | null };

export type VehicleDetail = VehicleRow & {
  documents: VehicleDoc[]; services: VehicleServiceRow[];
  trips: { id: number; number: string; status: string; opened_at: string; rep: string | null }[];
  fuel_vouchers: { id: number; number: string; status: string; amount: number; amount_used: number | null; litres: number | null; created_at: string; station: string | null }[];
  totals: { trips: number; fuel: number; litres: number; maintenance: number };
};

export type CustomerGroup = {
  id: number;
  name: string;
  kind: "route" | "location" | "segment" | "other";
  notes: string | null;
  is_active: boolean;
  customers?: number;
  lifetime?: number;
  lapsed?: number;
};

export type InsightBucket = "active" | "d31_90" | "d91_180" | "d181_365" | "d365_plus" | "never";

export type CustomerInsightRow = {
  id: number;
  name: string;
  type: "retail" | "wholesale";
  phone: string | null;
  address: string | null;
  network: string;
  last_purchase_at: string | null;
  days_since: number | null;
  bucket: InsightBucket;
  orders: number;
  lifetime: number; // kobo
  recent_90: number;
  average_order: number;
  owes: number;
  groups: { id: number; name: string }[];
};

export type CustomerInsights = {
  summary: {
    customers: number;
    buckets: Record<InsightBucket, number>;
    networks: { name: string; customers: number; lifetime: number; lapsed: number }[];
    lifetime: number;
    recent_90: number;
  };
  groups: CustomerGroup[];
  data: CustomerInsightRow[];
  total: number;
  current_page: number;
  last_page: number;
};

export type AgingRow = {
  customer_id: number; name: string; phone: string | null; credit_limit: number; invoices: number; total: number;
  current: number; d31_60: number; d61_90: number; d90_plus: number; oldest_days: number; oldest_at: string | null;
};
export type AgingReport = { summary: { customers: number; total: number; current: number; d31_60: number; d61_90: number; d90_plus: number }; data: AgingRow[] };

export type StatementRow = { at: string; type: "sale" | "payment" | "credit_note" | "refund"; ref: string | null; note: string; debit: number; credit: number; balance: number; sale_id: number };
export type Statement = {
  customer: { id: number; name: string; phone: string | null; address: string | null; credit_limit: number };
  from: string | null; to: string | null; opening: number; closing: number; total_debit: number; total_credit: number; rows: StatementRow[];
};

export type SaleReturnLineRow = { id: number; quantity: number; unit_price: number; line_total: number; product?: { id: number; name: string; sku: string | null }; unit?: { id: number; name: string } };
export type SaleReturnDoc = {
  id: number; number: string; returned_at: string; reason: string; restock_status: "saleable" | "damaged"; total: number; applied_to_balance: number; refunded: number; exchange_credit?: number; refund_method: "cash" | "transfer" | "exchange" | null;
  sale?: { id: number; number: string; sold_at: string }; customer?: { id: number; name: string; phone: string | null } | null; creator?: { id: number; name: string }; lines?: SaleReturnLineRow[];
};
export type ReturnableLine = { sale_line_id: number; product: string | null; unit: string | null; factor: number; unit_price: number; sold: number; returned: number; left: number };

export type ReorderSuggestion = {
  product: { id: number; name: string; sku: string }; warehouse: { id: number; name: string };
  saleable: number; min_quantity: number; daily: number; days_left: number | null; below_level: boolean; suggested: number;
  pack: { name: string; factor: number } | null; suggested_packs: number | null;
};

export type SubscriptionState = {
  mode: "full" | "readonly" | "blocked"; kind: "trial" | "paid" | "none"; plan_id: number | null; ends_at: string | null; readonly_until: string | null; days_left: number | null;
  overridden: boolean; override_note: string | null; override_until?: string | null; readonly_days: number | null; plan?: string | null;
};
export type Plan = { id: number; name: string; description: string | null; price: number; months: number; max_businesses: number; is_active: boolean | number; sort: number };
export type SubscriptionPayment = { id: number; amount: number; months: number; method: "manual" | "paystack"; status: string; reference: string | null; paid_at: string | null; period_from: string | null; period_to: string | null; note: string | null };
export type MySubscription = { subscription: SubscriptionState; plans: Plan[]; payments: SubscriptionPayment[]; online: boolean };
export type PlatformSubscriptions = {
  settings: { trial_days: number; readonly_days: number; default_max_businesses: number }; plans: Plan[];
  data: { id: number; name: string; email: string | null; is_active: boolean | number; subscription: SubscriptionState }[];
};

export type MyBusinesses = { current: number; data: { id: number; name: string; is_owner: boolean }[]; owned: number; allowed: number; can_create: boolean };
export type WorkspaceOptions = { branches: { id: number; name: string }[]; warehouses: { id: number; name: string; branch_id: number }[] };

/** One product target for one van salesman in a month, and how far they have got. */
export type TargetLine = {
  id: number; product_id: number | null; all_products: boolean; product: string; unit: string; quantity: number; target_base: number; achieved_base: number; achieved: number;
  percent: number; payout_percent: number; reward_full: number; reward: number;
  reward_type: "flat" | "salary_percent" | "fixed_percent"; reward_percent: number; reward_base: number; salary: number;
};
export type TargetRep = { user_id: number; name: string; targets: TargetLine[]; reward_total: number; reward_full: number };
export type TargetRules = { tiers: { min: number; pays: number }[]; pay_lag: 0 | 1 };
export type TargetsResponse = { period: string; reps: TargetRep[]; rules: TargetRules };

export type ProformaStatus = "draft" | "sent" | "accepted" | "cancelled" | "converted";

export type ProformaLine = {
  id: number;
  product_id: number | null;
  unit_id: number;
  quantity: number;
  description: string;
  unit_price: number; // kobo
  list_price: number; // kobo
  line_total: number; // kobo
};

export type Proforma = {
  id: number;
  number: string;
  status: ProformaStatus;
  is_expired: boolean;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  issued_on: string;
  valid_until: string | null;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  notes: string | null;
  terms: string | null;
  converted_sale_id: number | null;
  lines_count?: number;
  lines?: ProformaLine[];
};

export type ProformaCatalogueProduct = {
  id: number;
  name: string;
  sku: string;
  size_label: string | null;
  units: { unit_id: number; name: string; factor: number; price: number }[];
};
