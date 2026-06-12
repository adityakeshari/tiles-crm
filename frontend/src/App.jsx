import { Fragment, Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, consumeAuthExpiredMessage, getBillingPdfUrl, getCsvExportUrl, getProjectInvoicePdfUrl, getQuotationPdfUrl } from "./api.js";
import AppHeader from "./components/AppHeader.jsx";
import Sidebar from "./components/Sidebar.jsx";
import PageHeader from "./components/PageHeader.jsx";
import WorkspaceTabs from "./components/WorkspaceTabs.jsx";

const BillingSection = lazy(() => import("./sections/BillingSection.jsx"));
const PurchaseCostingSection = lazy(() => import("./sections/PurchaseCostingSection.jsx"));
const AdhesiveTokensSection = lazy(() => import("./sections/AdhesiveTokensSection.jsx"));
const RegisteredMasonsSection = lazy(() => import("./sections/RegisteredMasonsSection.jsx"));
const ProjectsSection = lazy(() => import("./sections/ProjectsSection.jsx"));
const LeadWorkspaceSection = lazy(() => import("./sections/LeadWorkspaceSection.jsx"));
const DailyTasksSection = lazy(() => import("./sections/DailyTasksSection.jsx"));

// Enterprise sidebar hierarchy. Sub-item IDs map to existing currentView IDs -
// no business logic / API / route changes; only the navigation surface is restructured.
const navGroups = [
  {
    id: "dashboard",
    label: "Dashboard",
    items: [{ id: "overview", label: "Overview" }],
  },
  {
    id: "customers",
    label: "Customers",
    items: [
      { id: "pipeline", label: "Leads" },
      { id: "followups", label: "Follow-ups" },
      { id: "quotations", label: "Quotations" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      { id: "projects", label: "Projects" },
      { id: "plumbing", label: "Plumbing" },
      { id: "dealers", label: "Dealers" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { id: "complaints", label: "Complaints" },
      { id: "operations", label: "Daily Tasks" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    items: [
      { id: "inventory", label: "Stock" },
      { id: "purchases", label: "Purchase Center" },
    ],
  },
  {
    id: "masonsTokens",
    label: "Mason & Tokens",
    items: [
      { id: "masons", label: "Registered Masons" },
      { id: "schemes", label: "Adhesive Tokens" },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    items: [
      { id: "billing", label: "Billing" },
      { id: "expenses", label: "Expenses" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [{ id: "reports", label: "Reports" }],
  },
  {
    id: "team",
    label: "Team",
    items: [{ id: "team", label: "Staff Access" }],
  },
];

const compactSidebarIcons = {
  overview: "OV",
  pipeline: "LD",
  followups: "FU",
  quotations: "QT",
  projects: "PR",
  plumbing: "PL",
  dealers: "DL",
  complaints: "CP",
  operations: "TK",
  inventory: "ST",
  purchases: "PC",
  masons: "MS",
  schemes: "AT",
  billing: "BL",
  expenses: "EX",
  reports: "RP",
  team: "SA",
};

const views = [
  { id: "overview", label: "Overview" },
  { id: "pipeline", label: "Pipeline" },
  { id: "followups", label: "Follow-ups" },
  { id: "operations", label: "Daily Tasks" },
  { id: "projects", label: "Projects" },
  { id: "plumbing", label: "Plumbing" },
  { id: "complaints", label: "Complaints" },
  { id: "quotations", label: "Quotations" },
  { id: "schemes", label: "Adhesive Tokens" },
  { id: "masons", label: "Registered Masons" },
  { id: "inventory", label: "Inventory" },
  { id: "dealers", label: "Dealers" },
  { id: "purchases", label: "Purchase Center" },
  { id: "purchase_costing", label: "Purchase Center" },
  { id: "billing", label: "Billing" },
  { id: "expenses", label: "Expenses" },
  { id: "reports", label: "Reports" },
  { id: "team", label: "Team" },
];

const viewMeta = {
  overview: {
    title: "Dashboard",
    description: "Today's summary at a glance - sales, collection, pending, follow-ups and stock alerts.",
    audience: "Owner & Manager view",
  },
  pipeline: {
    title: "Leads",
    description: "Add new walk-ins, search customers, and move enquiries through the pipeline.",
    audience: "Sales & Operator entry",
  },
  followups: {
    title: "Follow-ups",
    description: "Daily callbacks, visit reminders and pending customer commitments.",
    audience: "Sales & Manager",
  },
  operations: {
    title: "Daily Tasks",
    description: "Assign daily work, track progress, and verify completion without leaving CRM.",
    audience: "Admin / Manager / Staff",
  },
  projects: {
    title: "Projects",
    description: "Won leads under execution - dispatches, payments, plumbing and net profit.",
    audience: "Manager control",
  },
  plumbing: {
    title: "Plumbing Services",
    description: "Plumber list, on-going jobs and materials used.",
    audience: "Manager & Operations",
  },
  complaints: {
    title: "Complaints",
    description: "Customer complaints with priority, status and assigned staff.",
    audience: "Manager & Operations",
  },
  quotations: {
    title: "Quotations",
    description: "Prepare price quotations and share with the customer.",
    audience: "Sales",
  },
  schemes: {
    title: "Adhesive Tokens",
    description: "Token claim entry, verification and payout for masons against tile sales.",
    audience: "Manager & Accounts control",
  },
  masons: {
    title: "Registered Masons",
    description: "Add a new mason, update profile and mark active/inactive - only active masons can claim tokens.",
    audience: "Manager entry",
  },
  inventory: {
    title: "Stock",
    description: "Product list, design code, size, finish and stock-on-hand.",
    audience: "Manager & Operator",
  },
  dealers: {
    title: "Dealers",
    description: "Dealer network - category, purchase value, outstanding and commission.",
    audience: "Manager control",
  },
  purchases: {
    title: "Purchase Center",
    description: "Supplier bills, truck costing, and purchase history in one workflow.",
    audience: "Operator / Manager / Inventory",
  },
  purchase_costing: {
    title: "Purchase Center",
    description: "Truck-wise landed cost, allocation, and stock approval workflow.",
    audience: "Manager / Inventory / Accounts",
  },
  billing: {
    title: "Billing",
    description: "Create independent showroom invoices, take payments, print, and share customer bills.",
    audience: "Operator / Manager / Accounts",
  },
  expenses: {
    title: "Expenses",
    description: "Daily showroom expenses with category and payment mode.",
    audience: "Accounts & Operator",
  },
  reports: {
    title: "Reports",
    description: "Daily report sheet plus owner control - sales, collection, profit and payouts.",
    audience: "Owner / Manager",
  },
  team: {
    title: "Staff Access",
    description: "Add and manage user accounts and role permissions.",
    audience: "Admin only",
  },
};

const workspaceOptions = [
  { value: "all", label: "All Work" },
  { value: "sales", label: "Sales" },
  { value: "operations", label: "Operations" },
];

const businessUnits = [
  { value: "all", label: "All Units" },
  { value: "tiles", label: "Tiles" },
  { value: "plumbing", label: "Plumbing" },
  { value: "both", label: "Tiles + Plumbing" },
];

const leadStatuses = [
  { value: "new", label: "New" },
  { value: "interested", label: "Interested" },
  { value: "quotation_given", label: "Quotation Given" },
  { value: "negotiation", label: "Negotiation" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
];

const customerTypes = [
  { value: "retail_customer", label: "Retail Customer" },
  { value: "contractor", label: "Contractor" },
  { value: "builder", label: "Builder" },
  { value: "architect", label: "Architect" },
];

const requirementCategories = [
  { value: "flooring", label: "Flooring" },
  { value: "bathroom", label: "Bathroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "full_house", label: "Full House" },
  { value: "plumbing", label: "Plumbing" },
];

const timelines = [
  { value: "urgent", label: "Urgent" },
  { value: "one_month", label: "1 Month" },
  { value: "three_months", label: "3 Months" },
];

const leadSources = [
  { value: "walk_in", label: "Walk-in" },
  { value: "reference", label: "Reference" },
  { value: "online", label: "Online" },
  { value: "dealer", label: "Dealer" },
];

const followupTypes = [
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "visit", label: "Visit" },
  { value: "reminder", label: "Reminder" },
];

const paymentTypes = [
  { value: "advance", label: "Advance" },
  { value: "partial", label: "Partial" },
  { value: "full", label: "Full" },
  { value: "balance", label: "Balance" },
];

const plumbingWorkTypes = [
  { value: "bathroom", label: "Bathroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "pipeline", label: "Pipeline" },
  { value: "fitting", label: "Fitting" },
  { value: "repair", label: "Repair" },
  { value: "full_plumbing", label: "Full Plumbing" },
];

const plumbingJobStatuses = [
  { value: "pending", label: "Pending" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
];

const projectStatuses = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

const dispatchStatuses = [
  { value: "pending", label: "Pending" },
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
];

const expenseCategories = [
  { value: "rent", label: "Rent" },
  { value: "salary", label: "Salary" },
  { value: "transport", label: "Transport" },
  { value: "marketing", label: "Marketing" },
  { value: "electricity", label: "Electricity" },
  { value: "miscellaneous", label: "Miscellaneous" },
];

const complaintCategories = [
  { value: "leakage", label: "Leakage" },
  { value: "blockage", label: "Blockage" },
  { value: "pressure_issue", label: "Pressure Issue" },
  { value: "fitting_issue", label: "Fitting Issue" },
  { value: "installation_defect", label: "Installation Defect" },
  { value: "tile_breakage", label: "Tile Breakage" },
  { value: "shade_mismatch", label: "Shade Mismatch" },
  { value: "delivery_damage", label: "Delivery Damage" },
  { value: "service_delay", label: "Service Delay" },
  { value: "other", label: "Other" },
];

const complaintPriorities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const complaintStatuses = [
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_customer", label: "Waiting Customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const adhesiveTokenStatuses = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
];

const masonStatuses = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const availableUserRoles = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "sales", label: "Sales" },
  { value: "operations", label: "Operations" },
  { value: "accounts", label: "Accounts" },
  { value: "inventory", label: "Inventory" },
  { value: "token", label: "Token" },
  { value: "reports", label: "Reports" },
];

const adhesiveVerificationStatuses = [
  { value: "unverified", label: "Unverified" },
  { value: "matched", label: "Matched" },
  { value: "mismatch", label: "Mismatch" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const adhesiveTokenValues = [
  { value: 20, label: "20" },
  { value: 40, label: "40" },
  { value: 50, label: "50" },
];
const leadDrivenViews = new Set(["overview", "pipeline", "followups", "quotations"]);
const DEFAULT_API_TIMEOUT_MS = 15000;
const WARNING_AFTER_MS = 25 * 60 * 1000;
const LOGOUT_AFTER_MS = 30 * 60 * 1000;
const MOBILE_BACKGROUND_LOGOUT_MS = 60 * 60 * 1000;
const SESSION_LAST_ACTIVE_STORAGE_KEY = "tiles-crm-last-active-at";
const DEFAULT_LIST_LIMITS = {
  leads: 40,
  projects: 40,
  complaints: 40,
  products: 40,
  dealers: 40,
  claims: 40,
  masons: 40,
  purchases: 50,
  purchaseLots: 40,
  invoices: 50,
};
const MAX_LIST_LIMIT = 300;
const emptyOwnerOverviewData = {
  complaints: null,
  projects: null,
  purchases: null,
  plumbing: null,
  schemes: null,
  expenses: null,
  dailyReport: null,
  dailyTasks: null,
};

const emptyInventorySummary = {
  summary_ok: false,
  total_products: 0,
  active_products: 0,
  fast_moving_count: 0,
  dead_stock_count: 0,
  low_stock_count: 0,
  out_of_stock_count: 0,
  total_stock_sqft: 0,
  total_stock_boxes: 0,
  missing_company_count: 0,
  missing_size_count: 0,
  missing_design_count: 0,
  missing_finish_count: 0,
  missing_weight_count: 0,
  missing_pricing_count: 0,
  missing_packaging_count: 0,
};

const dealerCategories = ["A", "B", "C"];

const emptyLead = {
  name: "",
  phone: "",
  location: "",
  department: "sales",
  business_unit: "tiles",
  customer_type: "retail_customer",
  requirement_category: "flooring",
  requirement: "",
  budget: "",
  timeline: "urgent",
  lead_source: "walk_in",
  status: "new",
  lost_reason: "",
  assigned_to: "",
};

const emptyFollowup = {
  note: "",
  followup_date: "",
  followup_type: "call",
  status: "pending",
};

const emptyPayment = {
  amount: "",
  payment_type: "advance",
  due_date: "",
  note: "",
};

const emptyOperationsTask = {
  task_type: "delivery",
  title: "",
  note: "",
  scheduled_for: "",
  status: "pending",
  assigned_to: "",
};

function createEmptyDailyTask() {
  return {
    title: "",
    description: "",
    assigned_to: "",
    priority: "medium",
    due_date: getLocalDateInputValue(),
    due_time: "",
    status: "pending",
    remarks: "",
  };
}

const emptyDailyTaskFilters = {
  search: "",
  status: "all",
  assigned_to: "all",
  priority: "all",
  due_date: "",
};

const emptyUser = {
  name: "",
  phone: "",
  role: "sales",
  roles: ["sales"],
  password: "",
};

const emptyDealer = {
  name: "",
  area: "",
  phone: "",
  monthly_purchase: "",
  credit_limit: "",
  outstanding_payment: "",
  commission_percent: "",
  category: "C",
};

const emptyQuotation = {
  discount: "",
  transport_cost: "",
  status: "draft",
  items: [{ product_id: null, product_name: "", tile_size: "", quantity_sqft: "", unit_price: "" }],
};

const emptyProduct = {
  name: "",
  company_name: "",
  design_code: "",
  business_unit: "tiles",
  category: "Floor Tiles",
  unit: "box",
  tile_size: "",
  product_size: "",
  finish: "",
  pieces_per_box: "",
  sqft_per_box: "",
  weight_per_box: "",
  weight_per_unit: "",
  stock_sqft: "",
  low_stock_threshold: "10",
  purchase_rate: "",
  price_per_sqft: "",
  predefined_rate: "",
  today_selling_rate: "",
  daily_up_limit_percent: "2",
  daily_down_limit_percent: "1",
  last_purchase_rate: "",
  landed_cost_per_unit: "",
  minimum_allowed_rate: "",
  suggested_selling_rate: "",
  operator_discount_cap: "",
  manager_discount_cap: "",
  owner_discount_cap: "",
  safety_margin_percent: "",
  growth_margin_percent: "",
  quotation_validity_days: "0",
  pricing_lock: false,
  status: "active",
};

const defaultProductCategories = [
  "Floor Tiles",
  "Wall Tiles",
  "Parking Tiles",
  "Granite",
  "Marble",
  "Adhesive",
  "Sanitary",
  "Plumbing",
  "Other",
];

const defaultProductFinishes = [
  "Glossy",
  "Matte",
  "High Gloss",
  "Satin",
  "Rustic",
  "Carving",
  "Sugar",
  "Other",
];

const defaultCompanyOptions = [];

const emptySchemeToken = {
  site_name: "",
  invoice_number: "",
  mason_id: "",
  mason_area: "",
  mason_mobile: "",
  mason_current_address_city: "",
  mason_permanent_address_city: "",
  mason_working_areas: [],
  mason_working_distance_upto_km: "",
  adhesive_company: "",
  adhesive_type: "",
  sold_bag_quantity: "",
  items: [{ token_value: 20, quantity: 1 }],
  project_id: "",
  sale_date: "",
  customer_name: "",
  verification_status: "unverified",
  status: "pending",
  payment_date: "",
  remarks: "",
  token_photo_url: "",
};

const emptyMason = {
  name: "",
  mobile: "",
  alt_mobile: "",
  current_address: "",
  current_address_city: "",
  permanent_address: "",
  permanent_address_city: "",
  working_areas: [],
  working_distance_upto_km: "",
  status: "active",
  remarks: "",
};

// Purchase row dropdown options (Unit + GST percent) and quick-add product form shape
const purchaseUnitOptions = ["box", "pcs", "sqft", "kg", "bag", "set", "meter", "feet", "nos"];
const purchaseGstPercentOptions = [0, 5, 12, 18, 28];
const emptyQuickProduct = {
  name: "",
  category: "Floor Tiles",
  unit: "pcs",
  stock_sqft: "",
  design_code: "",
  finish: "",
  company_name: "",
  product_size: "",
  pieces_per_box: "",
  sqft_per_box: "",
  weight_per_box: "",
};

const emptyPurchase = {
  supplier_id: "",
  supplier_name: "",
  supplier_phone: "",
  invoice_number: "",
  purchase_date: "",
  truck_number: "",
  delivery_date: "",
  business_unit: "tiles",
  payment_status: "pending",
  remarks: "",
};

const emptyPurchaseItem = {
  product_id: "",
  item_name: "",
  category: "tiles",
  quantity: "",
  unit: "pcs",
  batch_no: "",
  amount: "",
  gst_amount: "",
  total_amount: "",
  rate_per_unit: "",
};

const emptyInvoiceItem = {
  item_type: "tiles",
  product_id: "",
  product_name: "",
  quantity: "",
  unit: "pcs",
  suggested_rate: "",
  minimum_allowed_rate: "",
  rate: "",
  discount: "",
  gst_percent: "0",
};

const emptyInvoice = {
  customer_name: "",
  customer_mobile: "",
  customer_address: "",
  lead_id: "",
  quotation_id: "",
  project_id: "",
  site_reference: "",
  invoice_type: "gst_invoice",
  invoice_date: new Date().toISOString().slice(0, 10),
  notes: "",
  transport_charge: "",
  additional_charge: "",
  approval_note: "",
  system_discount_meta: null,
  status: "draft",
  items: [{ ...emptyInvoiceItem }],
};

const emptyBillingPayment = {
  amount: "",
  payment_mode: "cash",
  note: "",
};

const emptyPurchaseLotItem = {
  product_id: "",
  item_name: "",
  company_name: "",
  product_size: "",
  category: "tiles",
  quantity: "",
  unit: "box",
  boxes: "",
  pieces_per_box: "",
  sqft_per_box: "",
  weight_per_box: "",
  weight_per_unit: "",
  basic_purchase_rate: "",
  damage_quantity: "",
  manual_allocation_value: "",
};

const emptyPurchaseLotSupplier = {
  supplier_name: "",
  supplier_invoice_number: "",
  supplier_invoice_date: "",
  supplier_amount: "",
  supplier_notes: "",
  items: [{ ...emptyPurchaseLotItem }],
};

const emptyPurchaseLot = {
  lot_number: "",
  arrival_date: new Date().toISOString().slice(0, 10),
  vehicle_number: "",
  transporter_name: "",
  driver_name: "",
  driver_mobile: "",
  allocation_method: "weight_wise",
  total_freight_cost: "",
  total_unloading_cost: "",
  other_charges: "",
  financed_amount: "",
  interest_rate_percent: "",
  holding_days: "",
  stock_received_date: new Date().toISOString().slice(0, 10),
  interest_cost_override: "",
  showroom_overhead_amount: "",
  monthly_overhead_amount: "",
  monthly_overhead_allocation_method: "per_box",
  monthly_sales_boxes: "",
  monthly_sales_sqft: "",
  monthly_sales_quantity: "",
  monthly_sales_value: "",
  monthly_overhead_rate: "",
  time_decay_percent: "",
  marketing_cost_amount: "",
  marketing_cost_allocation_method: "manual",
  overhead_period: "",
  overhead_notes: "",
  minimum_margin_percent: "5",
  target_margin_percent: "12",
  remarks: "",
  suppliers: [{ ...emptyPurchaseLotSupplier }],
};

const purchasePaymentStatuses = [
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
];

const billingInvoiceTypes = [
  { value: "gst_invoice", label: "GST Invoice" },
  { value: "estimate", label: "Estimate" },
];

const billingPaymentStatuses = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
];

const billingPaymentModes = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "mixed", label: "Mixed" },
];

const billingStatuses = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const billingItemTypes = [
  { value: "tiles", label: "Tiles" },
  { value: "plumbing", label: "Plumbing" },
  { value: "adhesive", label: "Adhesive" },
  { value: "granite_marble", label: "Granite / Marble" },
  { value: "custom_item", label: "Custom Item" },
];

const purchaseBusinessUnitOptions = [
  { value: "tiles", label: "Tiles" },
  { value: "plumbing", label: "Plumbing" },
  { value: "both", label: "Tiles + Plumbing" },
];

const expensePaymentModes = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

const emptyComplaint = {
  lead_id: "",
  customer_name: "",
  phone: "",
  location: "",
  business_unit: "plumbing",
  category: "leakage",
  priority: "medium",
  status: "open",
  title: "",
  description: "",
  resolution_note: "",
  due_date: "",
  assigned_to: "",
};

const emptyPlumber = {
  name: "",
  phone: "",
  area: "",
};

const emptyPlumbingJob = {
  lead_id: "",
  plumber_id: "",
  work_type: "bathroom",
  status: "pending",
  service_charge: "",
  scheduled_for: "",
  note: "",
};

const emptyPlumbingMaterial = {
  item_name: "",
  quantity: 1,
  unit: "pcs",
  price: "",
};

const emptyProject = {
  lead_id: "",
  project_name: "",
  status: "active",
  start_date: "",
  expected_delivery_date: "",
  completion_date: "",
  owner_note: "",
};

const emptyDispatch = {
  item_name: "",
  quantity: 1,
  vehicle_number: "",
  driver_name: "",
  dispatch_date: "",
  status: "pending",
  note: "",
};

const emptyExpense = {
  category: "rent",
  expense_date: "",
  amount: "",
  note: "",
  paid_by: "cash",
};

function normalizeText(value) {
  return String(value || "").trim();
}

function isPhoneLike(value) {
  return /^[0-9+\-\s]{7,15}$/.test(normalizeText(value));
}

function isValidDateInput(value) {
  return !value || !Number.isNaN(new Date(value).getTime());
}

function isNonNegativeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0;
}

function isInteractiveElementActive() {
  if (typeof document === "undefined") {
    return false;
  }

  const activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }

  const tagName = String(activeElement.tagName || "").toUpperCase();
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || activeElement.isContentEditable;
}

function hasDraftValue(value) {
  if (Array.isArray(value)) {
    return value.some((entry) => hasDraftValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((entry) => hasDraftValue(entry));
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }

  return normalizeText(value) !== "";
}

function serializeComparable(value) {
  return JSON.stringify(value);
}

function buildNormalizedProductSignature(product) {
  return {
    name: normalizeText(product?.name).toLowerCase(),
    company_name: getProductCompany(product).toLowerCase(),
    product_size: getProductSize(product).toLowerCase(),
    finish: getProductFinish(product).toLowerCase(),
  };
}

function isPositiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function validateLoginForm(form) {
  if (!isPhoneLike(form.phone)) {
    return "Phone must be 7 to 15 characters.";
  }

  if (!normalizeText(form.password)) {
    return "Password is required.";
  }

  return "";
}

function validateLeadForm(form) {
  if (!normalizeText(form.name)) {
    return "Lead name is required.";
  }

  if (!isPhoneLike(form.phone)) {
    return "Lead phone must be 7 to 15 characters.";
  }

  if (!normalizeText(form.requirement)) {
    return "Requirement details are required.";
  }

  if (!isNonNegativeNumber(form.budget)) {
    return "Lead budget must be 0 or more.";
  }

  if (form.status === "lost" && !normalizeText(form.lost_reason)) {
    return "Lost reason is required when the lead is marked lost.";
  }

  return "";
}

function validateFollowupForm(form) {
  if (!normalizeText(form.note)) {
    return "Follow-up note is required.";
  }

  if (!isValidDateInput(form.followup_date)) {
    return "Follow-up date is invalid.";
  }

  return "";
}

function validatePaymentForm(form) {
  if (!isPositiveNumber(form.amount)) {
    return "Payment amount must be greater than zero.";
  }

  if (!isValidDateInput(form.due_date)) {
    return "Payment due date is invalid.";
  }

  return "";
}

function validateOperationsTaskForm(form) {
  if (!normalizeText(form.title)) {
    return "Operations task title is required.";
  }

  if (!isValidDateInput(form.scheduled_for)) {
    return "Operations schedule is invalid.";
  }

  return "";
}

function validateDailyTaskForm(form, { canManageAllTasks = false, canVerifyDailyTasks = false } = {}) {
  if (canManageAllTasks && !normalizeText(form.title)) {
    return "Task title is required.";
  }

  if (canManageAllTasks && !normalizeText(form.assigned_to)) {
    return "Assigned staff is required.";
  }

  if (!isValidDateInput(form.due_date)) {
    return "Due date is invalid.";
  }

  if (!["pending", "in_progress", "completed", "verified", "hold"].includes(normalizeText(form.status))) {
    return "Task status is invalid.";
  }

  if (normalizeText(form.status) === "verified" && !canVerifyDailyTasks) {
    return "Only admin can verify tasks.";
  }

  return "";
}

function validateQuotationForm(form) {
  if (!Array.isArray(form.items) || form.items.length === 0) {
    return "At least one quotation item is required.";
  }

  const invalidItem = form.items.find(
    (item) =>
      !normalizeText(item.product_name) ||
      !isPositiveNumber(item.quantity_sqft) ||
      !isNonNegativeNumber(item.unit_price)
  );

  if (invalidItem) {
    return "Each quotation item needs a product name, quantity, and valid unit price.";
  }

  if (!isNonNegativeNumber(form.discount || 0) || !isNonNegativeNumber(form.transport_cost || 0)) {
    return "Quotation discount and transport values must be 0 or more.";
  }

  return "";
}

function validateDealerForm(form) {
  if (!normalizeText(form.name)) {
    return "Dealer name is required.";
  }

  if (normalizeText(form.phone) && !isPhoneLike(form.phone)) {
    return "Dealer phone must be 7 to 15 characters.";
  }

  const numericValues = [
    form.monthly_purchase || 0,
    form.credit_limit || 0,
    form.outstanding_payment || 0,
    form.commission_percent || 0,
  ];

  if (numericValues.some((value) => !isNonNegativeNumber(value))) {
    return "Dealer numeric values must be non-negative.";
  }

  return "";
}

function validateProductForm(form, options = {}) {
  const { requireDesignCode = true } = options;

  if (!normalizeText(form.name)) {
    return "Product name is required.";
  }

  if (!normalizeText(form.company_name)) {
    return "Company is required.";
  }

  if (!normalizeText(form.product_size || form.tile_size)) {
    return "Product size is required.";
  }

  if (!normalizeText(form.business_unit)) {
    return "Business unit is required.";
  }

  if (!normalizeText(form.unit)) {
    return "Unit is required.";
  }

  if (!normalizeText(form.category)) {
    return "Category is required.";
  }

  if (requireDesignCode && !normalizeText(form.design_code)) {
    return "Design code is required.";
  }

  const numericFields = [
    ["stock_sqft", "Stock sqft"],
    ["price_per_sqft", "Price per sqft"],
    ["purchase_rate", "Purchase rate"],
    ["last_purchase_rate", "Last purchase rate"],
    ["landed_cost_per_unit", "Landed cost per unit"],
    ["minimum_allowed_rate", "Minimum allowed rate"],
    ["predefined_rate", "Predefined rate"],
    ["today_selling_rate", "Today rate"],
    ["suggested_selling_rate", "Suggested selling rate"],
    ["pieces_per_box", "Pieces per box"],
    ["sqft_per_box", "Sqft per box"],
    ["weight_per_box", "Weight per box"],
    ["weight_per_unit", "Weight per unit"],
    ["daily_up_limit_percent", "Daily up limit percent"],
    ["daily_down_limit_percent", "Daily down limit percent"],
    ["operator_discount_cap", "Operator discount cap"],
    ["manager_discount_cap", "Manager discount cap"],
    ["owner_discount_cap", "Owner discount cap"],
    ["safety_margin_percent", "Safety margin percent"],
    ["growth_margin_percent", "Growth margin percent"],
    ["quotation_validity_days", "Quotation validity days"],
  ];

  for (const [field, label] of numericFields) {
    if (normalizeText(form[field]) === "") {
      continue;
    }
    if (!isNonNegativeNumber(form[field])) {
      return `${label} must be 0 or more.`;
    }
  }

  return "";
}

function validateProjectForm(form) {
  if (!Number.isInteger(Number(form.lead_id)) || Number(form.lead_id) <= 0) {
    return "Project lead is required.";
  }

  if (!normalizeText(form.project_name)) {
    return "Project name is required.";
  }

  if (!isValidDateInput(form.start_date) || !isValidDateInput(form.expected_delivery_date) || !isValidDateInput(form.completion_date)) {
    return "One of the project dates is invalid.";
  }

  return "";
}

function validateDispatchForm(form) {
  if (!normalizeText(form.item_name)) {
    return "Dispatch item name is required.";
  }

  if (!isPositiveNumber(form.quantity)) {
    return "Dispatch quantity must be greater than zero.";
  }

  if (!isValidDateInput(form.dispatch_date)) {
    return "Dispatch date is invalid.";
  }

  return "";
}

function validateExpenseForm(form) {
  if (!isPositiveNumber(form.amount)) {
    return "Expense amount must be greater than zero.";
  }

  if (!isValidDateInput(form.expense_date)) {
    return "Expense date is invalid.";
  }

  return "";
}

function validatePurchaseForm(form) {
  if (!normalizeText(form.supplier_name)) {
    return "Supplier name is required.";
  }

  if (form.supplier_phone && !isPhoneLike(form.supplier_phone)) {
    return "Supplier phone must be 7 to 15 digits.";
  }

  if (!isValidDateInput(form.purchase_date)) {
    return "Purchase date is invalid.";
  }

  const qty = Number(form.quantity || 0);
  if (!Number.isFinite(qty) || qty < 0) {
    return "Quantity must be a non-negative number.";
  }

  const amt = Number(form.amount || 0);
  if (!Number.isFinite(amt) || amt < 0) {
    return "Amount must be a non-negative number.";
  }

  const gst = Number(form.gst_amount || 0);
  if (!Number.isFinite(gst) || gst < 0) {
    return "GST amount must be a non-negative number.";
  }

  return "";
}

function getPurchaseEntryCurrentRate(form) {
  const quantity = Number(form?.quantity || 0);
  const amount = Number(form?.amount || 0);

  if (!(quantity > 0) || !(amount > 0)) {
    return 0;
  }

  return Number((amount / quantity).toFixed(2));
}

function getPurchaseRateInsight(intelligence, currentRate) {
  const averageRate = Number(intelligence?.avg_30_day_rate || 0);
  const current = Number(currentRate || 0);

  if (!(averageRate > 0) || !(current > 0)) {
    return {
      differenceAmount: 0,
      differencePercentage: 0,
      status: "normal",
      approvalRequired: false,
    };
  }

  const differenceAmount = Number((current - averageRate).toFixed(2));
  const differencePercentage = Number(((differenceAmount / averageRate) * 100).toFixed(2));

  if (differencePercentage > 8) {
    return {
      differenceAmount,
      differencePercentage,
      status: "approval_required",
      approvalRequired: true,
    };
  }

  if (differencePercentage > 3) {
    return {
      differenceAmount,
      differencePercentage,
      status: "review",
      approvalRequired: false,
    };
  }

  return {
    differenceAmount,
    differencePercentage,
    status: "normal",
    approvalRequired: false,
  };
}

function computeBillingItemTotal(item) {
  const quantity = Number(item.quantity || 0);
  const rate = Number(item.rate || 0);
  const discount = Number(item.discount || 0);
  const gstPercent = Number(item.gst_percent || 0);
  const taxable = Math.max(quantity * rate - discount, 0);
  return Number((taxable + taxable * (gstPercent / 100)).toFixed(2));
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getProductPredefinedRate(product) {
  return Number(
    product?.predefined_rate || product?.suggested_selling_rate || product?.price_per_sqft || product?.real_cost_per_unit || product?.landed_cost_per_unit || 0
  );
}

function getProductTodaySellingRate(product) {
  const predefinedRate = getProductPredefinedRate(product);

  if (predefinedRate > 0) {
    const upLimitPercent = Math.max(Number(product?.daily_up_limit_percent || 2), 0);
    const downLimitPercent = Math.max(Number(product?.daily_down_limit_percent || 1), 0);
    const minRate = predefinedRate * (1 - downLimitPercent / 100);
    const maxRate = predefinedRate * (1 + upLimitPercent / 100);
    const rawTodayRate = Number(product?.today_selling_rate || predefinedRate);
    return Number(clampNumber(rawTodayRate > 0 ? rawTodayRate : predefinedRate, minRate, maxRate).toFixed(2));
  }

  return Number(
    product?.today_selling_rate || product?.suggested_selling_rate || product?.price_per_sqft || product?.real_cost_per_unit || product?.landed_cost_per_unit || 0
  );
}

function getBillingTotals(form) {
  const items = Array.isArray(form.items) ? form.items : [];
  const subtotal = items.reduce(
    (sum, item) => sum + Math.max(Number(item.quantity || 0) * Number(item.rate || 0) - Number(item.discount || 0), 0),
    0
  );
  const totalDiscount = items.reduce((sum, item) => sum + Number(item.discount || 0), 0);
  const gstAmount = items.reduce((sum, item) => {
    const taxable = Math.max(Number(item.quantity || 0) * Number(item.rate || 0) - Number(item.discount || 0), 0);
    return sum + taxable * (Number(item.gst_percent || 0) / 100);
  }, 0);
  const transportCharge = Number(form.transport_charge || 0);
  const additionalCharge = Number(form.additional_charge || 0);
  const grandTotal = subtotal + gstAmount + transportCharge + additionalCharge;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    total_discount: Number(totalDiscount.toFixed(2)),
    gst_amount: Number(gstAmount.toFixed(2)),
    grand_total: Number(grandTotal.toFixed(2)),
  };
}

function clearSystemDiscountFromInvoice(form) {
  if (!form?.system_discount_meta) {
    return form;
  }

  return {
    ...form,
    system_discount_meta: null,
    approval_note: "",
    items: (form.items || []).map((item) => ({
      ...item,
      discount: "",
    })),
  };
}

function validateBillingForm(form) {
  if (!normalizeText(form.customer_name)) {
    return "Customer name is required.";
  }

  if (form.customer_mobile && !isPhoneLike(form.customer_mobile)) {
    return "Customer mobile must be 7 to 15 characters.";
  }

  if (!isValidDateInput(form.invoice_date)) {
    return "Invoice date is invalid.";
  }

  if (!Array.isArray(form.items) || !form.items.length) {
    return "At least one invoice item is required.";
  }

  for (const item of form.items) {
    if (!normalizeText(item.product_name)) {
      return "Invoice item name is required.";
    }

    if (!isPositiveNumber(item.quantity)) {
      return "Invoice item quantity must be greater than zero.";
    }

    if (!normalizeText(item.unit)) {
      return "Invoice item unit is required.";
    }

    if (!isNonNegativeNumber(item.rate) || !isNonNegativeNumber(item.discount) || !isNonNegativeNumber(item.gst_percent)) {
      return "Invoice item values must be non-negative.";
    }
  }

  if (!isNonNegativeNumber(form.transport_charge || 0) || !isNonNegativeNumber(form.additional_charge || 0)) {
    return "Transport and additional charges must be non-negative.";
  }

  return "";
}

function getBillingInvoiceRequiredErrors(form) {
  const errors = validateRequiredFields(form, {
    customer_name: "Customer name is required.",
    invoice_date: {
      message: "Invoice date is required.",
      validate: (value) => Boolean(value),
    },
  });

  if (!Array.isArray(form.items) || !form.items.length) {
    errors.items = "At least one invoice item is required.";
    return errors;
  }

  form.items.forEach((item, index) => {
    if (!item.product_id) {
      errors[`items.${index}.product_id`] = "Product is required";
    }
    if (normalizeText(item.quantity) === "") {
      errors[`items.${index}.quantity`] = "Quantity is required";
    }
    if (normalizeText(item.rate) === "") {
      errors[`items.${index}.rate`] = "Rate is required";
    }
  });

  return errors;
}

function validateSchemeTokenForm(form) {
  if (!normalizeText(form.site_name)) {
    return "Site name is required.";
  }

  if (form.project_id && (!Number.isInteger(Number(form.project_id)) || Number(form.project_id) <= 0)) {
    return "Project selection is invalid.";
  }

  if (!normalizeText(form.invoice_number)) {
    return "Invoice number is required.";
  }

  if (!isValidDateInput(form.sale_date)) {
    return "Sale date is invalid.";
  }

  if (!Number.isInteger(Number(form.mason_id)) || Number(form.mason_id) <= 0) {
    return "Registered mason selection is required.";
  }

  if (!normalizeText(form.adhesive_company)) {
    return "Adhesive company is required.";
  }

  if (!normalizeText(form.adhesive_type)) {
    return "Adhesive type is required.";
  }

  if (!isPositiveNumber(form.sold_bag_quantity)) {
    return "Sold bag quantity must be greater than zero.";
  }

  if (!isValidDateInput(form.payment_date)) {
    return "Payment date is invalid.";
  }

  if (!Array.isArray(form.items) || form.items.length === 0) {
    return "At least one token line item is required.";
  }

  for (const item of form.items) {
    if (!isNonNegativeNumber(item.token_value)) {
      return "Token value must be 0 or more.";
    }

    if (!isPositiveNumber(item.quantity)) {
      return "Token quantity must be greater than zero.";
    }
  }

  if (getAdhesiveClaimTotals(form).claimed_bag_quantity > Number(form.sold_bag_quantity || 0)) {
    return "Claimed bag quantity cannot be greater than sold bag quantity.";
  }

  return "";
}

function validateMasonForm(form) {
  if (!normalizeText(form.name)) {
    return "Mason name is required.";
  }

  if (!isPhoneLike(form.mobile)) {
    return "Mason mobile must be 7 to 15 characters.";
  }

  if (!normalizeText(form.current_address)) {
    return "Current address is required.";
  }

  if (!normalizeText(form.current_address_city)) {
    return "Current address city is required.";
  }

  if (!Array.isArray(form.working_areas) || form.working_areas.filter((item) => normalizeText(item)).length === 0) {
    return "At least one working area is required.";
  }

  if (!isPositiveNumber(form.working_distance_upto_km)) {
    return "Working distance must be greater than zero.";
  }

  if (!normalizeText(form.status) || !masonStatuses.some((item) => item.value === form.status)) {
    return "Mason status is invalid.";
  }

  return "";
}

function getAdhesiveClaimTotals(form) {
  const items = Array.isArray(form.items) ? form.items : [];
  return items.reduce(
    (summary, item) => {
      const quantity = Number(item.quantity || 0);
      const tokenValue = Number(item.token_value || 0);
      return {
        claimed_bag_quantity: summary.claimed_bag_quantity + quantity,
        total_token_amount: summary.total_token_amount + quantity * tokenValue,
      };
    },
    { claimed_bag_quantity: 0, total_token_amount: 0 }
  );
}

function getAdhesiveClaimPreviewStatus(form, linkedProject) {
  const { claimed_bag_quantity } = getAdhesiveClaimTotals(form);

  if (!normalizeText(form.invoice_number)) {
    return "unverified";
  }

  if (claimed_bag_quantity > Number(form.sold_bag_quantity || 0)) {
    return "mismatch";
  }

  if (!Number.isInteger(Number(form.project_id)) || !linkedProject?.lead_name) {
    return "unverified";
  }

  if (!normalizeText(form.customer_name)) {
    return "unverified";
  }

  if (
    normalizeText(form.customer_name).toLowerCase() !==
    normalizeText(linkedProject.lead_name).toLowerCase()
  ) {
    return "mismatch";
  }

  return "matched";
}

function sanitizePositiveIntegerInput(value, fallback = "") {
  if (value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(parsed));
}

function validateRequiredFields(formState, requiredFields) {
  const errors = {};

  for (const [field, config] of Object.entries(requiredFields || {})) {
    const rule = typeof config === "string" ? { message: config } : config || {};
    const value = typeof rule.value === "function" ? rule.value(formState) : formState?.[field];
    const isValid =
      typeof rule.validate === "function" ? rule.validate(value, formState) : Boolean(normalizeText(value));

    if (!isValid) {
      errors[field] = rule.message || "Required";
    }
  }

  return errors;
}

function clearFieldErrorState(setter, field) {
  setter((current) => {
    if (!current?.[field]) {
      return current;
    }

    const next = { ...current };
    delete next[field];
    return next;
  });
}

function clearFieldErrorFromEvent(event, setter) {
  const field = event.target?.getAttribute("data-field");
  if (!field) {
    return;
  }
  clearFieldErrorState(setter, field);
}

function focusFirstInvalidField(formElement, errors) {
  if (!formElement || !errors) {
    return;
  }

  const firstField = Object.keys(errors)[0];
  if (!firstField) {
    return;
  }

  const target = formElement.querySelector(`[data-field="${firstField}"]`);
  if (!target) {
    return;
  }

  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: "smooth", block: "center" });
}

function getFieldErrorClass(errors, field) {
  return errors?.[field] ? "field-error" : "";
}

function getQuotationRequiredErrors(form) {
  const errors = {};

  if (!Array.isArray(form.items) || form.items.length === 0) {
    errors.items = "At least one quotation item is required.";
    return errors;
  }

  form.items.forEach((item, index) => {
    if (!normalizeText(item.product_name)) {
      errors[`items.${index}.product_name`] = "Product name is required.";
    }
    if (!normalizeText(item.tile_size)) {
      errors[`items.${index}.tile_size`] = "Size is required.";
    }
    if (!isPositiveNumber(item.quantity_sqft)) {
      errors[`items.${index}.quantity_sqft`] = "Quantity is required.";
    }
    if (!isNonNegativeNumber(item.unit_price) && item.unit_price !== 0 && item.unit_price !== "0") {
      errors[`items.${index}.unit_price`] = "Unit price is required.";
    }
  });

  return errors;
}

function getSchemeTokenRequiredErrors(form) {
  const errors = validateRequiredFields(form, {
    site_name: "Site name is required.",
    invoice_number: "Invoice number is required.",
    mason_id: {
      message: "Registered mason is required.",
      validate: (value) => Number.isInteger(Number(value)) && Number(value) > 0,
    },
    adhesive_company: "Adhesive company is required.",
    adhesive_type: "Adhesive type is required.",
    sold_bag_quantity: {
      message: "Sold bag quantity is required.",
      validate: (value) => isPositiveNumber(value),
    },
  });

  if (!Array.isArray(form.items) || form.items.length === 0) {
    errors.items = "At least one token line item is required.";
    return errors;
  }

  form.items.forEach((item, index) => {
    if (!isNonNegativeNumber(item.token_value) && item.token_value !== 0 && item.token_value !== "0") {
      errors[`items.${index}.token_value`] = "Token value is required.";
    }
    if (!isPositiveNumber(item.quantity)) {
      errors[`items.${index}.quantity`] = "Quantity is required.";
    }
  });

  return errors;
}

function sanitizeNonNegativeIntegerInput(value, fallback = "") {
  if (value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(parsed));
}

function validateComplaintForm(form) {
  if (!normalizeText(form.customer_name)) {
    return "Customer name is required.";
  }

  if (!isPhoneLike(form.phone)) {
    return "Customer phone must be 7 to 15 characters.";
  }

  if (!normalizeText(form.title)) {
    return "Complaint title is required.";
  }

  if (!normalizeText(form.description)) {
    return "Complaint description is required.";
  }

  if (!isValidDateInput(form.due_date)) {
    return "Complaint due date is invalid.";
  }

  return "";
}

function validatePlumberForm(form) {
  if (!normalizeText(form.name)) {
    return "Plumber name is required.";
  }

  if (!isPhoneLike(form.phone)) {
    return "Plumber phone must be 7 to 15 characters.";
  }

  return "";
}

function validatePlumbingJobForm(form, leadId) {
  if (!Number.isInteger(Number(leadId || form.lead_id)) || Number(leadId || form.lead_id) <= 0) {
    return "Linked lead is required for plumbing job.";
  }

  if (!isNonNegativeNumber(form.service_charge || 0)) {
    return "Plumbing service charge must be 0 or more.";
  }

  if (!isValidDateInput(form.scheduled_for)) {
    return "Plumbing schedule is invalid.";
  }

  return "";
}

function validatePlumbingMaterialForm(form) {
  if (!normalizeText(form.item_name)) {
    return "Material item name is required.";
  }

  if (!isPositiveNumber(form.quantity)) {
    return "Material quantity must be greater than zero.";
  }

  if (!isNonNegativeNumber(form.price)) {
    return "Material price must be 0 or more.";
  }

  return "";
}

function validateUserForm(form, isEditing) {
  if (!normalizeText(form.name)) {
    return "User name is required.";
  }

  if (!isPhoneLike(form.phone)) {
    return "User phone must be 7 to 15 characters.";
  }

  if (!isEditing && String(form.password || "").length < 6) {
    return "Password must be at least 6 characters.";
  }

  if (isEditing && normalizeText(form.password) && String(form.password).length < 6) {
    return "New password must be at least 6 characters.";
  }

  if (!Array.isArray(form.roles) || form.roles.length === 0) {
    return "Select at least one user role.";
  }

  return "";
}

function normalizeUserRoles(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    return [...new Set(user.roles.filter(Boolean))];
  }

  if (typeof user?.role === "string" && user.role.trim()) {
    return [user.role.trim()];
  }

  return [];
}

function hasRole(user, role) {
  return normalizeUserRoles(user).includes(role) || user?.role === role;
}

function hasAnyRole(user, roles) {
  if (hasRole(user, "admin")) {
    return true;
  }

  return roles.some((role) => hasRole(user, role));
}

function isAdmin(user) {
  return hasRole(user, "admin");
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("tiles-crm-token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("tiles-crm-user");
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return { ...parsed, roles: normalizeUserRoles(parsed) };
  });
  const [currentView, setCurrentView] = useState("overview");
  const [workspaceFilter, setWorkspaceFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [loginForm, setLoginForm] = useState({ phone: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [leadFormErrors, setLeadFormErrors] = useState({});
  const [leadSearch, setLeadSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [followupBoard, setFollowupBoard] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [createLeadMode, setCreateLeadMode] = useState(false);
  const [editingLead, setEditingLead] = useState(emptyLead);
  const [followups, setFollowups] = useState([]);
  const [payments, setPayments] = useState([]);
  const [operationsBoard, setOperationsBoard] = useState([]);
  const [operationsTasks, setOperationsTasks] = useState([]);
  const [dailyTasks, setDailyTasks] = useState([]);
  const [dailyTaskSummary, setDailyTaskSummary] = useState(null);
  const [dailyTaskStaffSummary, setDailyTaskStaffSummary] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [schemeTokens, setSchemeTokens] = useState([]);
  const [schemeSummary, setSchemeSummary] = useState(null);
  const [adhesiveTokenReports, setAdhesiveTokenReports] = useState({});
  const [adhesiveTokenActivities, setAdhesiveTokenActivities] = useState([]);
  const [masonActivities, setMasonActivities] = useState([]);
  const [masons, setMasons] = useState([]);
  const [selectedAdhesiveToken, setSelectedAdhesiveToken] = useState(null);
  const [editingAdhesiveTokenId, setEditingAdhesiveTokenId] = useState(null);
  const [adhesiveTokenStatusFilter, setAdhesiveTokenStatusFilter] = useState("all");
  const [adhesiveTokenMasonFilter, setAdhesiveTokenMasonFilter] = useState("");
  const [adhesiveTokenInvoiceFilter, setAdhesiveTokenInvoiceFilter] = useState("");
  const [adhesiveTokenSiteFilter, setAdhesiveTokenSiteFilter] = useState("");
  const [adhesiveTokenCreatedByFilter, setAdhesiveTokenCreatedByFilter] = useState("");
  const [adhesiveTokenVerifiedByFilter, setAdhesiveTokenVerifiedByFilter] = useState("");
  const [adhesiveTokenDateFromFilter, setAdhesiveTokenDateFromFilter] = useState("");
  const [adhesiveTokenDateToFilter, setAdhesiveTokenDateToFilter] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [complaintSummary, setComplaintSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectSummary, setProjectSummary] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [plumbers, setPlumbers] = useState([]);
  const [plumbingBoard, setPlumbingBoard] = useState([]);
  const [leadPlumbingJobs, setLeadPlumbingJobs] = useState([]);
  const [plumbingSummary, setPlumbingSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [dailyTaskViewTab, setDailyTaskViewTab] = useState("today");
  const [dailyTaskFilters, setDailyTaskFilters] = useState(emptyDailyTaskFilters);
  // Debounced copy of the daily-task search input. The dashboard load effect
  // keys on this instead of the raw value, so typing in the search box does not
  // fire an API request (and a loading banner flash) on every keystroke.
  const [debouncedDailyTaskSearch, setDebouncedDailyTaskSearch] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedDailyTaskSearch(dailyTaskFilters.search || "");
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [dailyTaskFilters.search]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [followupForm, setFollowupForm] = useState(emptyFollowup);
  const [followupFormErrors, setFollowupFormErrors] = useState({});
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [operationsTaskForm, setOperationsTaskForm] = useState(emptyOperationsTask);
  const [dailyTaskForm, setDailyTaskForm] = useState(createEmptyDailyTask);
  const [dailyTaskFormErrors, setDailyTaskFormErrors] = useState({});
  const [editingDailyTaskId, setEditingDailyTaskId] = useState(null);
  const [quotationForm, setQuotationForm] = useState(emptyQuotation);
  const [quotationFormErrors, setQuotationFormErrors] = useState({});
  const [schemeTokenForm, setSchemeTokenForm] = useState(emptySchemeToken);
  const [schemeTokenFormErrors, setSchemeTokenFormErrors] = useState({});
  const [complaintForm, setComplaintForm] = useState(emptyComplaint);
  const [editingComplaintId, setEditingComplaintId] = useState(null);
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState(emptyUser);
  const [editingUserId, setEditingUserId] = useState(null);
  const [dealers, setDealers] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventorySummary, setInventorySummary] = useState(null);
  const [inventoryOptions, setInventoryOptions] = useState({ companies: [], sizes: [], finishes: [] });
  const [dealerForm, setDealerForm] = useState(emptyDealer);
  const [editingDealerId, setEditingDealerId] = useState(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [productFormErrors, setProductFormErrors] = useState({});
  const [editingProductId, setEditingProductId] = useState(null);
  const [customProductCategories, setCustomProductCategories] = useState([]);
  const [isAddingCustomProductCategory, setIsAddingCustomProductCategory] = useState(false);
  const [customCompanyOptions, setCustomCompanyOptions] = useState([]);
  const [customProductSizeOptions, setCustomProductSizeOptions] = useState([]);
  const [customFinishOptions, setCustomFinishOptions] = useState([]);
  const [isAddingCustomCompany, setIsAddingCustomCompany] = useState(false);
  const [isAddingCustomProductSize, setIsAddingCustomProductSize] = useState(false);
  const [isAddingCustomFinish, setIsAddingCustomFinish] = useState(false);
  const [productDuplicateOverride, setProductDuplicateOverride] = useState(false);
  const [masonForm, setMasonForm] = useState(emptyMason);
  const [masonFormErrors, setMasonFormErrors] = useState({});
  const [editingMasonId, setEditingMasonId] = useState(null);
  const [masonWorkingAreaInput, setMasonWorkingAreaInput] = useState("");
  const [masonCurrentCityFilter, setMasonCurrentCityFilter] = useState("");
  const [masonPermanentCityFilter, setMasonPermanentCityFilter] = useState("");
  const [masonWorkingAreaFilter, setMasonWorkingAreaFilter] = useState("");
  const [masonWorkingDistanceFilter, setMasonWorkingDistanceFilter] = useState("");
  const [plumberForm, setPlumberForm] = useState(emptyPlumber);
  const [editingPlumberId, setEditingPlumberId] = useState(null);
  const [plumbingJobForm, setPlumbingJobForm] = useState(emptyPlumbingJob);
  const [plumbingMaterialDrafts, setPlumbingMaterialDrafts] = useState({});
  const [projectForm, setProjectForm] = useState(emptyProject);
  const [projectFormErrors, setProjectFormErrors] = useState({});
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [dispatchDrafts, setDispatchDrafts] = useState({});
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [expenseFormErrors, setExpenseFormErrors] = useState({});
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);
  const [purchaseSummary, setPurchaseSummary] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchase);
  const [purchaseItems, setPurchaseItems] = useState([{ ...emptyPurchaseItem }]);
  const [purchaseFormErrors, setPurchaseFormErrors] = useState({});
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseFromFilter, setPurchaseFromFilter] = useState("");
  const [purchaseToFilter, setPurchaseToFilter] = useState("");
  const [purchasePaymentFilter, setPurchasePaymentFilter] = useState("all");
  const [purchaseIntelligenceCache, setPurchaseIntelligenceCache] = useState({});
  const [purchaseIntelligenceLoading, setPurchaseIntelligenceLoading] = useState({});
  const [purchaseSupplierFilter, setPurchaseSupplierFilter] = useState("all");
  const [purchaseInvoiceFilter, setPurchaseInvoiceFilter] = useState("");
  const [purchaseProductFilter, setPurchaseProductFilter] = useState("all");
  const [expandedPurchaseInvoiceGroups, setExpandedPurchaseInvoiceGroups] = useState({});
  const [purchaseSupplierHistory, setPurchaseSupplierHistory] = useState(null);
  const [quickProductRowIndex, setQuickProductRowIndex] = useState(null);
  const [quickProductForm, setQuickProductForm] = useState(emptyQuickProduct);
  const [quickProductSaving, setQuickProductSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierQuickAddOpen, setSupplierQuickAddOpen] = useState(false);
  const [supplierQuickForm, setSupplierQuickForm] = useState({
    name: "",
    mobile: "",
    city: "",
    gstin: "",
    category: "general",
  });
  const [supplierQuickSaving, setSupplierQuickSaving] = useState(false);
  const [purchaseLots, setPurchaseLots] = useState([]);
  const [purchaseCostingSummary, setPurchaseCostingSummary] = useState(null);
  const [purchaseCostingReports, setPurchaseCostingReports] = useState({});
  const [purchaseCostingReferences, setPurchaseCostingReferences] = useState({ products: [] });
  const [purchaseCostingForm, setPurchaseCostingForm] = useState(emptyPurchaseLot);
  const [purchaseCostingFormErrors, setPurchaseCostingFormErrors] = useState({});
  const [editingPurchaseLotId, setEditingPurchaseLotId] = useState(null);
  const [selectedPurchaseLot, setSelectedPurchaseLot] = useState(null);
  const [linkedPurchaseBills, setLinkedPurchaseBills] = useState([]);
  const [linkedPurchaseBillsLoading, setLinkedPurchaseBillsLoading] = useState(false);
  const [purchaseLotSearch, setPurchaseLotSearch] = useState("");
  const [purchaseLotStatusFilter, setPurchaseLotStatusFilter] = useState("all");
  const [invoices, setInvoices] = useState([]);
  const [billingSummary, setBillingSummary] = useState(null);
  const [billingReports, setBillingReports] = useState({});
  const [billingReferences, setBillingReferences] = useState({ leads: [], quotations: [], projects: [], products: [] });
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoice);
  const [invoiceFormErrors, setInvoiceFormErrors] = useState({});
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [billingPaymentForm, setBillingPaymentForm] = useState(emptyBillingPayment);
  const [billingSearch, setBillingSearch] = useState("");
  const [billingStatusFilter, setBillingStatusFilter] = useState("all");
  const [billingPaymentFilter, setBillingPaymentFilter] = useState("all");
  const [billingFromFilter, setBillingFromFilter] = useState("");
  const [billingToFilter, setBillingToFilter] = useState("");
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [ownerOverviewData, setOwnerOverviewData] = useState(emptyOwnerOverviewData);
  const [ownerOverviewLoading, setOwnerOverviewLoading] = useState(false);
  const [ownerOverviewError, setOwnerOverviewError] = useState("");
  const [dailyReport, setDailyReport] = useState(null);
  const [dailyReportDate, setDailyReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportsView, setReportsView] = useState("overview");
  const [inventoryWorkspaceTab, setInventoryWorkspaceTab] = useState("new");
  const [productReportGapFilter, setProductReportGapFilter] = useState("all");
  const [productHighlightedFields, setProductHighlightedFields] = useState([]);
  const [inventoryLedgerSearch, setInventoryLedgerSearch] = useState("");
  const [inventoryLedgerView, setInventoryLedgerView] = useState("list");
  const [inventoryLedgerCategoryFilter, setInventoryLedgerCategoryFilter] = useState("all");
  const [inventoryLedgerStatusFilter, setInventoryLedgerStatusFilter] = useState("all");
  const [inventoryLedgerStockFilter, setInventoryLedgerStockFilter] = useState("all");
  const [inventoryLedgerSort, setInventoryLedgerSort] = useState("name_asc");
  const [purchaseWorkspaceTab, setPurchaseWorkspaceTab] = useState("new_bill");
  const [expenseWorkspaceTab, setExpenseWorkspaceTab] = useState("new");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [isMobileSidebar, setIsMobileSidebar] = useState(
    typeof window === "undefined" ? false : window.innerWidth <= 1080
  );
  const [error, setError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible"
  );
  const [autoRefreshState, setAutoRefreshState] = useState({ view: "", at: 0 });
  const [isSavingComplaint, setIsSavingComplaint] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [showSessionTimeoutWarning, setShowSessionTimeoutWarning] = useState(false);
  const [sessionWarningCountdown, setSessionWarningCountdown] = useState(Math.ceil((LOGOUT_AFTER_MS - WARNING_AFTER_MS) / 1000));
  const [toasts, setToasts] = useState([]);
  const [listLimits, setListLimits] = useState(DEFAULT_LIST_LIMITS);
  const dashboardLoadRef = useRef(0);
  const purchasePostSaveActionRef = useRef("draft");
  const sessionWarningTimerRef = useRef(null);
  const sessionLogoutTimerRef = useRef(null);
  const sessionCountdownIntervalRef = useRef(null);
  const lastActivityAtRef = useRef(Date.now());
  const backgroundedAtRef = useRef(null);

  const visibleViews = useMemo(() => {
    if (!user || isAdmin(user) || hasRole(user, "owner") || hasRole(user, "manager")) {
      return hasRole(user, "manager") && !isAdmin(user) && !hasRole(user, "owner")
        ? views.filter((item) => item.id !== "team")
        : views;
    }

    const allowedViews = new Set();

    if (hasRole(user, "sales")) {
      ["overview", "pipeline", "followups", "quotations", "billing"].forEach((item) => allowedViews.add(item));
    }

    if (hasRole(user, "operations")) {
      ["operations", "projects", "plumbing", "complaints", "purchases"].forEach((item) =>
        allowedViews.add(item)
      );
    }

    if (hasRole(user, "token")) {
      ["schemes", "masons"].forEach((item) => allowedViews.add(item));
    }

    if (hasRole(user, "inventory")) {
      ["inventory", "purchase_costing"].forEach((item) => allowedViews.add(item));
    }

    if (hasRole(user, "accounts")) {
      ["projects", "expenses", "purchases", "purchase_costing", "billing"].forEach((item) => allowedViews.add(item));
    }

    if (hasRole(user, "operator")) {
      ["overview", "purchases", "expenses", "masons", "billing"].forEach((item) => allowedViews.add(item));
    }

    if (hasRole(user, "reports")) {
      ["reports", "purchases", "purchase_costing", "expenses"].forEach((item) => allowedViews.add(item));
    }

    allowedViews.add("operations");

    return views.filter((item) => allowedViews.has(item.id));
  }, [user]);
  const canViewOwnerDashboard = Boolean(user) && isAdmin(user);
  const canManageDailyTasks = Boolean(user) && (isAdmin(user) || hasRole(user, "owner") || hasRole(user, "manager"));
  const canVerifyDailyTasks = Boolean(user) && (isAdmin(user) || hasRole(user, "owner"));
  const canDeleteDailyTasks = Boolean(user) && (isAdmin(user) || hasRole(user, "owner"));

  useEffect(() => {
    if (!user) {
      return;
    }

    if (workspaceFilter === "all" && hasRole(user, "sales") && !hasRole(user, "operations")) {
      setWorkspaceFilter("sales");
    }

    if (workspaceFilter === "all" && hasRole(user, "operations") && !hasRole(user, "sales")) {
      setWorkspaceFilter("operations");
    }

    if (currentView === "overview" && hasRole(user, "operations") && !hasRole(user, "sales")) {
      setCurrentView("operations");
    }

    if (currentView === "overview" && hasRole(user, "accounts") && !hasRole(user, "sales") && !hasRole(user, "operations")) {
      setCurrentView("reports");
    }
  }, [user, workspaceFilter, currentView]);

  useEffect(() => {
    if (visibleViews.length && !visibleViews.some((item) => item.id === currentView)) {
      setCurrentView(visibleViews[0].id);
    }
  }, [visibleViews, currentView]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem("tiles-crm-sidebar-collapsed");
    if (stored === "true") {
      setIsSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("tiles-crm-sidebar-collapsed", isSidebarCollapsed ? "true" : "false");
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncSidebarMode = () => {
      const mobile = window.innerWidth <= 1080;
      setIsMobileSidebar(mobile);
      if (!mobile) {
        setIsSidebarMobileOpen(false);
      }
    };

    syncSidebarMode();
    window.addEventListener("resize", syncSidebarMode);
    return () => window.removeEventListener("resize", syncSidebarMode);
  }, []);

  useEffect(() => {
    if (isMobileSidebar) {
      setIsSidebarMobileOpen(false);
    }
  }, [currentView, isMobileSidebar]);

  useEffect(() => {
    if (currentView === "purchase_costing") {
      setCurrentView("purchases");
      setPurchaseWorkspaceTab("costing");
    }
  }, [currentView]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone: "error", message: error }]);
    setError("");
  }, [error]);

  useEffect(() => {
    if (token) {
      return;
    }

    const expiredMessage = consumeAuthExpiredMessage();
    if (expiredMessage) {
      setAuthNotice(expiredMessage);
      setError(expiredMessage);
    }
  }, [token]);

  useEffect(() => {
    if (!toasts.length) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 3400);

    return () => window.clearTimeout(timer);
  }, [toasts]);

  function pushToast(message, tone = "success") {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, message }]);
  }

  function isAbortLikeError(error) {
    return error?.name === "AbortError" || error?.message === "Request was cancelled.";
  }

  function createRequestOptions(signal, timeoutMs = DEFAULT_API_TIMEOUT_MS) {
    return { signal, timeoutMs };
  }

  function increaseListLimit(key, step = 100) {
    setListLimits((current) => ({
      ...current,
      [key]: Math.min((current[key] || step) + step, MAX_LIST_LIMIT),
    }));
  }

  async function runBusyAction(actionKey, task, successMessage = "") {
    if (busyAction === actionKey) {
      return false;
    }

    setBusyAction(actionKey);

    try {
      await task();

      if (successMessage) {
        pushToast(successMessage);
      }

      return true;
    } catch (requestError) {
      if (isAbortLikeError(requestError)) {
        return false;
      }

      setError(requestError.message);
      return false;
    } finally {
      setBusyAction("");
    }
  }

  function openActionConfirmation({ title, message, confirmLabel, tone = "secondary", onConfirm, subtext = "" }) {
    setPendingAction({
      title,
      message,
      confirmLabel,
      tone,
      onConfirm,
      subtext,
    });
  }

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const haystack = [
          lead.name,
          lead.phone,
          lead.location,
          lead.requirement,
          lead.requirement_category,
          lead.customer_type,
          lead.lead_source,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch = haystack.includes(leadSearch.toLowerCase());
        const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
        const matchesWorkspace =
          workspaceFilter === "all" || lead.department === workspaceFilter;
        const matchesUnit = matchesBusinessUnitFilter(lead.business_unit, unitFilter);
        return matchesSearch && matchesStatus && matchesWorkspace && matchesUnit;
      }),
    [leads, leadSearch, statusFilter, workspaceFilter, unitFilter]
  );

  const pipelineColumns = useMemo(
    () =>
      leadStatuses.map((status) => ({
        ...status,
        leads: filteredLeads.filter((lead) => lead.status === status.value),
      })),
    [filteredLeads]
  );

  const filteredProducts = useMemo(
    () => products.filter((product) => matchesBusinessUnitFilter(product.business_unit, unitFilter)),
    [products, unitFilter]
  );
  const filteredInventoryLedgerProducts = useMemo(() => {
    const normalizedSearch = normalizeText(inventoryLedgerSearch).toLowerCase();

    return [...filteredProducts]
      .filter((product) => {
        const stockState = getProductStockState(product);
        const matchesSearch =
          !normalizedSearch ||
          [
            product.name,
            getProductCompany(product),
            product.category,
            getProductSize(product),
            getProductDesignCode(product),
            getProductFinish(product),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch);
        const matchesCategory =
          inventoryLedgerCategoryFilter === "all" ||
          normalizeText(product.category) === inventoryLedgerCategoryFilter;
        const matchesStatus =
          inventoryLedgerStatusFilter === "all" ||
          String(product.status || "") === inventoryLedgerStatusFilter;
        const matchesStock =
          inventoryLedgerStockFilter === "all" ||
          (inventoryLedgerStockFilter === "in" && stockState === "in") ||
          (inventoryLedgerStockFilter === "low" && stockState === "low") ||
          (inventoryLedgerStockFilter === "out" && stockState === "out");

        return matchesSearch && matchesCategory && matchesStatus && matchesStock;
      })
      .sort((left, right) => {
        const leftStateRank = { out: 0, low: 1, in: 2 }[getProductStockState(left)] ?? 3;
        const rightStateRank = { out: 0, low: 1, in: 2 }[getProductStockState(right)] ?? 3;

        if (inventoryLedgerSort === "stock_low_high") {
          return getProductStockBoxes(left) - getProductStockBoxes(right);
        }

        if (inventoryLedgerSort === "stock_high_low") {
          return getProductStockBoxes(right) - getProductStockBoxes(left);
        }

        if (leftStateRank !== rightStateRank) {
          return leftStateRank - rightStateRank;
        }

        return String(left.name || "").localeCompare(String(right.name || ""), "en", { sensitivity: "base" });
      });
  }, [
    filteredProducts,
    inventoryLedgerCategoryFilter,
    inventoryLedgerSearch,
    inventoryLedgerSort,
    inventoryLedgerStatusFilter,
    inventoryLedgerStockFilter,
  ]);
  const productHealthSummary = useMemo(() => {
    const allProducts = products || [];
    const summary = {
      averageCompleteness: 0,
      missingCompanyCount: 0,
      missingSizeCount: 0,
      missingDesignCount: 0,
      missingFinishCount: 0,
      missingWeightCount: 0,
      missingPricingCount: 0,
      missingPackagingCount: 0,
      lowMarginCount: 0,
      highStockCount: 0,
    };

    if (!allProducts.length) {
      return summary;
    }

    let completenessTotal = 0;

    allProducts.forEach((product) => {
      const gaps = getProductDataGaps(product);
      completenessTotal += getProductCompletenessPercent(product);

      if (gaps.includes("company")) summary.missingCompanyCount += 1;
      if (gaps.includes("size")) summary.missingSizeCount += 1;
      if (gaps.includes("design")) summary.missingDesignCount += 1;
      if (gaps.includes("finish")) summary.missingFinishCount += 1;
      if (gaps.includes("weight")) summary.missingWeightCount += 1;
      if (gaps.includes("pricing")) summary.missingPricingCount += 1;
      if (gaps.includes("packaging")) summary.missingPackagingCount += 1;

      const liveSellingRate = Number(product.suggested_selling_rate || product.price_per_sqft || 0);
      const minimumRate = Number(product.minimum_allowed_rate || product.landed_cost_per_unit || 0);
      if (minimumRate > 0 && liveSellingRate > 0 && liveSellingRate <= minimumRate) {
        summary.lowMarginCount += 1;
      }

      if (Number(product.stock_sqft || 0) >= 1000) {
        summary.highStockCount += 1;
      }
    });

    summary.averageCompleteness = Math.round(completenessTotal / allProducts.length);
    return summary;
  }, [products]);
  const pendingInvoiceApprovalCount = useMemo(
    () => (invoices || []).filter((invoice) => invoice.status === "pending_approval").length,
    [invoices]
  );
  const draftInvoiceCount = useMemo(
    () => (invoices || []).filter((invoice) => invoice.status === "draft").length,
    [invoices]
  );
  const customerMissingMobileCount = useMemo(
    () => (leads || []).filter((lead) => !normalizeText(lead.phone)).length,
    [leads]
  );
  const hasInventorySummaryMetrics = Boolean(inventorySummary) && inventorySummary.summary_ok !== false;
  const getInventorySummaryMetric = useCallback(
    (key, fallback = 0) =>
      hasInventorySummaryMetrics ? normalizeSummaryNumber(inventorySummary?.[key], fallback) : fallback,
    [hasInventorySummaryMetrics, inventorySummary]
  );
  const dataQualityMonitor = useMemo(() => {
    const productMasterCounts = {
      company: getInventorySummaryMetric("missing_company_count", productHealthSummary.missingCompanyCount),
      size: getInventorySummaryMetric("missing_size_count", productHealthSummary.missingSizeCount),
      design: getInventorySummaryMetric("missing_design_count", productHealthSummary.missingDesignCount),
      finish: getInventorySummaryMetric("missing_finish_count", productHealthSummary.missingFinishCount),
      weight: getInventorySummaryMetric("missing_weight_count", productHealthSummary.missingWeightCount),
      packaging: getInventorySummaryMetric("missing_packaging_count", productHealthSummary.missingPackagingCount),
      pricing: getInventorySummaryMetric("missing_pricing_count", productHealthSummary.missingPricingCount),
    };

    const groups = [
      {
        key: "product_master",
        icon: "📦",
        title: "Product Master",
        issues: [
          { label: "Missing company", count: productMasterCounts.company },
          { label: "Missing size", count: productMasterCounts.size },
          { label: "Missing design code", count: productMasterCounts.design },
          { label: "Missing finish", count: productMasterCounts.finish },
          { label: "Missing weight", count: productMasterCounts.weight },
          { label: "Missing packaging", count: productMasterCounts.packaging },
          { label: "Missing pricing", count: productMasterCounts.pricing },
        ],
      },
      {
        key: "customer_data",
        icon: "👤",
        title: "Customer Data",
        issues: [{ label: "Missing mobile", count: customerMissingMobileCount }],
      },
      {
        key: "approvals",
        icon: "🧾",
        title: "Approvals",
        issues: [{ label: "Pending approvals", count: pendingInvoiceApprovalCount }],
      },
      {
        key: "profitability",
        icon: "💰",
        title: "Profitability",
        issues: [{ label: "Low margin items", count: productHealthSummary.lowMarginCount }],
      },
    ].map((group) => {
      const issueCount = group.issues.reduce((sum, item) => sum + Number(item.count || 0), 0);
      const tone = issueCount === 0 ? "healthy" : issueCount <= 5 ? "warning" : "critical";
      return {
        ...group,
        issueCount,
        tone,
        statusLabel: issueCount === 0 ? "Healthy" : issueCount <= 5 ? "Needs Attention" : "Critical",
      };
    });

    const priorityAlerts = groups
      .flatMap((group) =>
        group.issues
          .filter((item) => Number(item.count || 0) > 0)
          .map((item) => ({
            ...item,
            groupTitle: group.title,
            tone: Number(item.count || 0) > 5 ? "critical" : "warning",
          }))
      )
      .sort((left, right) => Number(right.count || 0) - Number(left.count || 0));

    const totalIssues = groups.reduce((sum, group) => sum + group.issueCount, 0);
    const totalProductsForQuality = Math.max(
      getInventorySummaryMetric("total_products", 0),
      Array.isArray(products) ? products.length : 0
    );
    const totalLeadRecords = Array.isArray(leads) ? leads.length : 0;
    const totalInvoiceRecords = Array.isArray(invoices) ? invoices.length : 0;
    const totalPossibleIssues =
      totalProductsForQuality * 7 +
      totalProductsForQuality +
      totalLeadRecords +
      totalInvoiceRecords;
    const score =
      totalPossibleIssues <= 0 ? 100 : Math.max(0, Math.round((1 - totalIssues / totalPossibleIssues) * 100));
    const scoreTone = score >= 95 ? "healthy" : score >= 80 ? "warning" : "critical";
    const scoreStatusLabel = score >= 95 ? "Excellent" : score >= 80 ? "Needs Attention" : "Critical";

    return {
      groups,
      priorityAlerts,
      totalIssues,
      score,
      scoreTone,
      scoreStatusLabel,
      allHealthy: totalIssues === 0,
    };
  }, [
    customerMissingMobileCount,
    getInventorySummaryMetric,
    invoices,
    leads,
    products,
    pendingInvoiceApprovalCount,
    productHealthSummary.missingDesignCount,
    productHealthSummary.missingFinishCount,
    productHealthSummary.lowMarginCount,
    productHealthSummary.missingCompanyCount,
    productHealthSummary.missingPackagingCount,
    productHealthSummary.missingPricingCount,
    productHealthSummary.missingSizeCount,
    productHealthSummary.missingWeightCount,
  ]);
  const expenseCategorySummary = useMemo(() => {
    const totals = new Map();
    (expenses || []).forEach((expense) => {
      const key = expense.category || "miscellaneous";
      totals.set(key, (totals.get(key) || 0) + Number(expense.amount || 0));
    });
    return [...totals.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [expenses]);
  const safePurchases = useMemo(() => (Array.isArray(purchases) ? purchases : []), [purchases]);
  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);
  const safeSuppliers = useMemo(() => (Array.isArray(suppliers) ? suppliers : []), [suppliers]);
  const safePurchaseItems = useMemo(
    () => (Array.isArray(purchaseItems) && purchaseItems.length ? purchaseItems : [{ ...emptyPurchaseItem }]),
    [purchaseItems]
  );
  const isLeadWorkspaceDirty = useMemo(() => {
    const leadDraftDirty = hasDraftValue(leadForm);
    const editingLeadDirty = selectedLead
      ? serializeComparable({
          name: editingLead.name || "",
          phone: editingLead.phone || "",
          location: editingLead.location || "",
          department: editingLead.department || "sales",
          business_unit: editingLead.business_unit || "tiles",
          customer_type: editingLead.customer_type || "retail_customer",
          requirement_category: editingLead.requirement_category || "flooring",
          requirement: editingLead.requirement || "",
          budget: String(editingLead.budget || ""),
          timeline: editingLead.timeline || "urgent",
          lead_source: editingLead.lead_source || "walk_in",
          status: editingLead.status || "new",
          lost_reason: editingLead.lost_reason || "",
          assigned_to: String(editingLead.assigned_to || ""),
        }) !==
        serializeComparable({
          name: selectedLead.name || "",
          phone: selectedLead.phone || "",
          location: selectedLead.location || "",
          department: selectedLead.department || "sales",
          business_unit: selectedLead.business_unit || "tiles",
          customer_type: selectedLead.customer_type || "retail_customer",
          requirement_category: selectedLead.requirement_category || "flooring",
          requirement: selectedLead.requirement || "",
          budget: String(selectedLead.budget || ""),
          timeline: selectedLead.timeline || "urgent",
          lead_source: selectedLead.lead_source || "walk_in",
          status: selectedLead.status || "new",
          lost_reason: selectedLead.lost_reason || "",
          assigned_to: String(selectedLead.assigned_to || ""),
        })
      : false;
    const followupDirty = hasDraftValue(followupForm.note) || hasDraftValue(followupForm.followup_date);
    const paymentDirty = hasDraftValue(paymentForm.amount) || hasDraftValue(paymentForm.due_date) || hasDraftValue(paymentForm.note);
    const operationsDirty =
      hasDraftValue(operationsTaskForm.title) ||
      hasDraftValue(operationsTaskForm.note) ||
      hasDraftValue(operationsTaskForm.scheduled_for) ||
      hasDraftValue(operationsTaskForm.assigned_to);
    const quotationDirty =
      hasDraftValue(quotationForm.discount) ||
      hasDraftValue(quotationForm.transport_cost) ||
      (quotationForm.items || []).some((item) =>
        hasDraftValue(item.product_id) ||
        hasDraftValue(item.product_name) ||
        hasDraftValue(item.tile_size) ||
        hasDraftValue(item.quantity_sqft) ||
        hasDraftValue(item.unit_price)
      );

    return leadDraftDirty || editingLeadDirty || followupDirty || paymentDirty || operationsDirty || quotationDirty;
  }, [editingLead, leadForm, followupForm, paymentForm, operationsTaskForm, quotationForm, selectedLead]);
  const isDailyTaskDraftDirty = useMemo(() => {
    if (!canManageDailyTasks && !editingDailyTaskId) {
      return false;
    }

    return (
      Boolean(editingDailyTaskId) ||
      hasDraftValue(dailyTaskForm.title) ||
      hasDraftValue(dailyTaskForm.description) ||
      hasDraftValue(dailyTaskForm.assigned_to) ||
      hasDraftValue(dailyTaskForm.remarks) ||
      hasDraftValue(dailyTaskForm.due_time) ||
      (dailyTaskForm.due_date && dailyTaskForm.due_date !== getLocalDateInputValue()) ||
      normalizeText(dailyTaskForm.priority) !== "medium" ||
      normalizeText(dailyTaskForm.status) !== "pending"
    );
  }, [canManageDailyTasks, dailyTaskForm, editingDailyTaskId]);
  const isBillingDraftDirty = useMemo(() => {
    const invoiceDirty =
      Boolean(editingInvoiceId) ||
      hasDraftValue(invoiceForm.customer_name) ||
      hasDraftValue(invoiceForm.customer_mobile) ||
      hasDraftValue(invoiceForm.customer_address) ||
      hasDraftValue(invoiceForm.lead_id) ||
      hasDraftValue(invoiceForm.quotation_id) ||
      hasDraftValue(invoiceForm.project_id) ||
      hasDraftValue(invoiceForm.site_reference) ||
      hasDraftValue(invoiceForm.transport_charge) ||
      hasDraftValue(invoiceForm.additional_charge) ||
      hasDraftValue(invoiceForm.notes) ||
      (invoiceForm.items || []).some((item) =>
        hasDraftValue(item.product_id) || hasDraftValue(item.product_name) || hasDraftValue(item.quantity) || hasDraftValue(item.rate)
      );
    const paymentDirty = hasDraftValue(billingPaymentForm.amount) || hasDraftValue(billingPaymentForm.note);
    return invoiceDirty || paymentDirty;
  }, [billingPaymentForm, editingInvoiceId, invoiceForm]);
  const isPurchaseEntryDraftDirty = useMemo(() => {
    const purchaseHeaderDirty =
      Boolean(editingPurchaseId) ||
      hasDraftValue(purchaseForm.supplier_id) ||
      hasDraftValue(purchaseForm.invoice_number) ||
      hasDraftValue(purchaseForm.purchase_date) ||
      hasDraftValue(purchaseForm.truck_number) ||
      hasDraftValue(purchaseForm.delivery_date) ||
      hasDraftValue(purchaseForm.remarks) ||
      purchaseForm.payment_status !== emptyPurchase.payment_status;
    const purchaseRowsDirty = safePurchaseItems.some((item) =>
      hasDraftValue(item.product_id) ||
      hasDraftValue(item.quantity) ||
      hasDraftValue(item.rate_per_unit) ||
      hasDraftValue(item.amount) ||
      hasDraftValue(item.gst_amount) ||
      hasDraftValue(item.total_amount)
    );
    return purchaseHeaderDirty || purchaseRowsDirty || supplierQuickAddOpen || supplierQuickSaving;
  }, [editingPurchaseId, purchaseForm, safePurchaseItems, supplierQuickAddOpen, supplierQuickSaving]);
  const isPurchaseCostingDraftDirty = useMemo(() => {
    const formDirty =
      Boolean(editingPurchaseLotId) ||
      serializeComparable(purchaseCostingForm) !== serializeComparable(emptyPurchaseLot);
    return formDirty || linkedPurchaseBillsLoading;
  }, [editingPurchaseLotId, linkedPurchaseBillsLoading, purchaseCostingForm]);
  const isInventoryDraftDirty = useMemo(
    () => Boolean(editingProductId) || serializeComparable(productForm) !== serializeComparable(emptyProduct),
    [editingProductId, productForm]
  );
  const isComplaintDraftDirty = useMemo(
    () => Boolean(editingComplaintId) || serializeComparable(complaintForm) !== serializeComparable(emptyComplaint),
    [editingComplaintId, complaintForm]
  );
  const autoRefreshIntervalMs = useMemo(() => {
    if (currentView === "overview" || currentView === "billing" || currentView === "complaints" || currentView === "operations") {
      return 10000;
    }

    if (currentView === "purchases" || currentView === "inventory") {
      return 15000;
    }

    return 0;
  }, [currentView]);
  const autoRefreshBlocked = useMemo(() => {
    if (!isDocumentVisible || loading || Boolean(busyAction)) {
      return true;
    }

    if (currentView === "overview") {
      return isLeadWorkspaceDirty;
    }

    if (currentView === "operations") {
      return isDailyTaskDraftDirty;
    }

    if (currentView === "billing") {
      return isBillingDraftDirty;
    }

    if (currentView === "purchases") {
      return purchaseWorkspaceTab === "costing" ? isPurchaseCostingDraftDirty : isPurchaseEntryDraftDirty;
    }

    if (currentView === "inventory") {
      return inventoryWorkspaceTab === "new" ? isInventoryDraftDirty : false;
    }

    if (currentView === "complaints") {
      return isComplaintDraftDirty || isSavingComplaint;
    }

    return false;
  }, [
    autoRefreshIntervalMs,
    busyAction,
    currentView,
    dailyTaskForm,
    editingDailyTaskId,
    inventoryWorkspaceTab,
    isBillingDraftDirty,
    isComplaintDraftDirty,
    isDailyTaskDraftDirty,
    isDocumentVisible,
    isInventoryDraftDirty,
    isLeadWorkspaceDirty,
    isPurchaseCostingDraftDirty,
    isPurchaseEntryDraftDirty,
    isSavingComplaint,
    loading,
    purchaseWorkspaceTab,
  ]);
  const autoRefreshStatusText = useMemo(() => {
    if (autoRefreshState.view !== currentView || !autoRefreshState.at) {
      return "";
    }

    const secondsAgo = Math.max(Math.round((Date.now() - autoRefreshState.at) / 1000), 0);
    if (secondsAgo <= 10) {
      return "Updated just now";
    }

    return `Updated ${secondsAgo}s ago`;
  }, [autoRefreshState, currentView]);
  const selectedPurchaseSupplier = useMemo(
    () => safeSuppliers.find((supplier) => String(supplier.id) === String(purchaseForm.supplier_id || "")) || null,
    [safeSuppliers, purchaseForm.supplier_id]
  );
  const filteredPurchaseLedger = useMemo(() => {
    return safePurchases.filter((purchase) => {
      const matchesSearch =
        !purchaseSearch ||
        [purchase.supplier_name, purchase.invoice_number, purchase.item_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(String(purchaseSearch).toLowerCase());
      const matchesSupplier =
        purchaseSupplierFilter === "all" || String(purchase.supplier_id || "") === String(purchaseSupplierFilter);
      const matchesInvoice =
        !purchaseInvoiceFilter ||
        String(purchase.invoice_number || "").toLowerCase().includes(String(purchaseInvoiceFilter).toLowerCase());
      const matchesProduct =
        purchaseProductFilter === "all" || String(purchase.product_id || "") === String(purchaseProductFilter);
      const matchesFrom = !purchaseFromFilter || String(purchase.purchase_date || "").slice(0, 10) >= purchaseFromFilter;
      const matchesTo = !purchaseToFilter || String(purchase.purchase_date || "").slice(0, 10) <= purchaseToFilter;
      return matchesSearch && matchesSupplier && matchesInvoice && matchesProduct && matchesFrom && matchesTo;
    });
  }, [
    purchaseFromFilter,
    purchaseInvoiceFilter,
    purchaseProductFilter,
    purchaseSearch,
    purchaseSupplierFilter,
    purchaseToFilter,
    safePurchases,
  ]);
  const safePurchaseInvoices = useMemo(
    () => (Array.isArray(purchaseInvoices) ? purchaseInvoices : []),
    [purchaseInvoices]
  );
  const filteredPurchaseLedgerInvoices = useMemo(() => {
    return safePurchaseInvoices.filter((invoice) => {
      const itemSearchText = (invoice.items || [])
        .flatMap((item) => [item.item_name, item.batch_no])
        .filter(Boolean)
        .join(" ");
      const matchesSearch =
        !purchaseSearch ||
        [invoice.supplier_name, invoice.invoice_number, itemSearchText]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(String(purchaseSearch).toLowerCase());
      const matchesSupplier =
        purchaseSupplierFilter === "all" || String(invoice.supplier_id || "") === String(purchaseSupplierFilter);
      const matchesInvoice =
        !purchaseInvoiceFilter ||
        String(invoice.invoice_number || "").toLowerCase().includes(String(purchaseInvoiceFilter).toLowerCase());
      const matchesProduct =
        purchaseProductFilter === "all" ||
        (invoice.items || []).some((item) => String(item.product_id || "") === String(purchaseProductFilter));
      const matchesFrom = !purchaseFromFilter || String(invoice.purchase_date || "").slice(0, 10) >= purchaseFromFilter;
      const matchesTo = !purchaseToFilter || String(invoice.purchase_date || "").slice(0, 10) <= purchaseToFilter;
      const matchesPayment =
        purchasePaymentFilter === "all" || String(invoice.payment_status || "") === String(purchasePaymentFilter);
      return matchesSearch && matchesSupplier && matchesInvoice && matchesProduct && matchesFrom && matchesTo && matchesPayment;
    });
  }, [
    purchaseFromFilter,
    purchaseInvoiceFilter,
    purchasePaymentFilter,
    purchaseProductFilter,
    purchaseSearch,
    purchaseSupplierFilter,
    purchaseToFilter,
    safePurchaseInvoices,
  ]);
  const purchaseSupplierSummary = useMemo(() => {
    const totals = new Map();
    filteredPurchaseLedgerInvoices.forEach((purchase) => {
      const key = `${purchase.supplier_id || "unknown"}::${purchase.supplier_name || "Unknown Supplier"}`;
      const current = totals.get(key) || {
        supplier_id: purchase.supplier_id || "",
        supplier_name: purchase.supplier_name || "Unknown Supplier",
        amount: 0,
        entries: 0,
      };
      current.amount += Number(purchase.grand_total || purchase.total_amount || 0);
      current.entries += 1;
      totals.set(key, current);
    });
    return [...totals.values()].sort((a, b) => b.amount - a.amount).slice(0, 8);
  }, [filteredPurchaseLedgerInvoices]);
  const purchaseCategorySummary = useMemo(() => {
    const totals = new Map();
    safePurchases.forEach((purchase) => {
      const key = purchase.category || "uncategorized";
      totals.set(key, (totals.get(key) || 0) + Number(purchase.total_amount || 0));
    });
    return [...totals.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [safePurchases]);
  const productWarningList = useMemo(
    () => (filteredProducts || []).filter((product) => getProductDataGaps(product).length),
    [filteredProducts]
  );
  const productCategoryOptions = useMemo(
    () =>
      [...new Set([...defaultProductCategories, ...products.map((product) => normalizeText(product.category)).filter(Boolean), ...customProductCategories])]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [products, customProductCategories]
  );
  const productCompanyOptions = useMemo(
    () =>
      [
        ...new Set(
          [
            ...defaultCompanyOptions,
            ...(inventoryOptions.companies || []).map((value) => normalizeText(value)).filter(Boolean),
            normalizeText(productForm.company_name),
            ...customCompanyOptions,
          ]
        ),
      ]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [inventoryOptions.companies, customCompanyOptions, productForm.company_name]
  );
  const productSizeOptions = useMemo(
    () =>
      [
        ...new Set(
          [
            ...(inventoryOptions.sizes || []).map((value) => normalizeText(value)).filter(Boolean),
            ...customProductSizeOptions,
            normalizeText(productForm.product_size || productForm.tile_size),
          ]
        ),
      ]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [inventoryOptions.sizes, customProductSizeOptions, productForm.product_size, productForm.tile_size]
  );
  const productFinishOptions = useMemo(
    () =>
      [...new Set([...defaultProductFinishes, ...(inventoryOptions.finishes || []).map((value) => normalizeText(value)).filter(Boolean), ...customFinishOptions, normalizeText(productForm.finish)])]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [inventoryOptions.finishes, customFinishOptions, productForm.finish]
  );
  const similarProductMatch = useMemo(() => {
    const signature = buildNormalizedProductSignature(productForm);

    if (!signature.name || !signature.company_name || !signature.product_size || !signature.finish) {
      return null;
    }

    return (
      products.find((product) => {
        if (editingProductId && Number(product.id) === Number(editingProductId)) {
          return false;
        }

        const currentSignature = buildNormalizedProductSignature(product);
        return (
          currentSignature.name === signature.name &&
          currentSignature.company_name === signature.company_name &&
          currentSignature.product_size === signature.product_size &&
          currentSignature.finish === signature.finish
        );
      }) || null
    );
  }, [editingProductId, productForm, products]);
  const derivedWeightPerUnit = useMemo(() => {
    const piecesPerBox = Number(productForm.pieces_per_box || 0);
    const weightPerBox = Number(productForm.weight_per_box || 0);

    if (piecesPerBox > 0 && weightPerBox > 0) {
      return Number((weightPerBox / piecesPerBox).toFixed(4));
    }

    return null;
  }, [productForm.pieces_per_box, productForm.weight_per_box]);
  const derivedSqftPerUnit = useMemo(() => {
    const piecesPerBox = Number(productForm.pieces_per_box || 0);
    const sqftPerBox = Number(productForm.sqft_per_box || 0);

    if (piecesPerBox > 0 && sqftPerBox > 0) {
      return Number((sqftPerBox / piecesPerBox).toFixed(4));
    }

    return null;
  }, [productForm.pieces_per_box, productForm.sqft_per_box]);

  useEffect(() => {
    const nextWeightValue = derivedWeightPerUnit != null ? String(derivedWeightPerUnit) : "";

    if ((productForm.weight_per_unit || "") === nextWeightValue) {
      return;
    }

    setProductForm((current) => ({
      ...current,
      weight_per_unit: nextWeightValue,
    }));
  }, [derivedWeightPerUnit, productForm.weight_per_unit]);

  useEffect(() => {
    setProductDuplicateOverride(false);
  }, [productForm.name, productForm.company_name, productForm.product_size, productForm.tile_size, productForm.finish, editingProductId]);

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const matchesUnit = matchesBusinessUnitFilter(project.business_unit || "tiles", unitFilter);
        const matchesWorkspace =
          workspaceFilter === "all" ||
          workspaceFilter === "operations" ||
          workspaceFilter === "sales" ||
          workspaceFilter === "accounts";
        return matchesUnit && matchesWorkspace;
      }),
    [projects, unitFilter, workspaceFilter]
  );

  const filteredInvoices = useMemo(() => {
    return (invoices || []).filter((invoice) => {
      const haystack = [
        invoice.customer_name,
        invoice.customer_mobile,
        invoice.invoice_number,
        invoice.site_reference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !billingSearch || haystack.includes(String(billingSearch).toLowerCase());
      const matchesStatus = billingStatusFilter === "all" || invoice.status === billingStatusFilter;
      const matchesPayment = billingPaymentFilter === "all" || invoice.payment_status === billingPaymentFilter;
      const matchesFrom = !billingFromFilter || String(invoice.invoice_date || "").slice(0, 10) >= billingFromFilter;
      const matchesTo = !billingToFilter || String(invoice.invoice_date || "").slice(0, 10) <= billingToFilter;
      return matchesSearch && matchesStatus && matchesPayment && matchesFrom && matchesTo;
    });
  }, [billingFromFilter, billingPaymentFilter, billingSearch, billingStatusFilter, billingToFilter, invoices]);

  const billingReferenceOptions = useMemo(() => {
    return {
      leads: billingReferences.leads || [],
      quotations: billingReferences.quotations || [],
      projects: billingReferences.projects || [],
      products: billingReferences.products || [],
    };
  }, [billingReferences]);
  const purchaseCostingProductOptions = useMemo(
    () => purchaseCostingReferences.products || [],
    [purchaseCostingReferences]
  );
  const purchaseEntryProductOptions = useMemo(
    () =>
      safeProducts.filter((product) =>
        purchaseForm.business_unit === "both"
          ? true
          : matchesBusinessUnitFilter(product.business_unit, purchaseForm.business_unit)
      ),
    [safeProducts, purchaseForm.business_unit]
  );
  const purchaseEntryProductMap = useMemo(
    () => new Map(purchaseEntryProductOptions.map((product) => [product.id, product])),
    [purchaseEntryProductOptions]
  );
  const filteredPurchaseLots = useMemo(() => {
    return (purchaseLots || []).filter((lot) => {
      const haystack = [lot.lot_number, lot.vehicle_number, lot.transporter_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !purchaseLotSearch || haystack.includes(String(purchaseLotSearch).toLowerCase());
      const matchesStatus = purchaseLotStatusFilter === "all" || lot.status === purchaseLotStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [purchaseLots, purchaseLotSearch, purchaseLotStatusFilter]);

  const convertedLeadOptions = useMemo(
    () =>
      leads.filter(
        (lead) =>
          lead.status === "converted" &&
          (!projects.some((project) => project.lead_id === lead.id) || lead.id === Number(projectForm.lead_id || 0))
      ),
    [leads, projects, projectForm.lead_id]
  );

  const focusedLeadIds = useMemo(
    () => new Set(filteredLeads.map((lead) => lead.id)),
    [filteredLeads]
  );

  const focusedFollowupBoard = useMemo(
    () => followupBoard.filter((item) => focusedLeadIds.has(item.lead_id)),
    [followupBoard, focusedLeadIds]
  );

  const focusedOperationsBoard = useMemo(
    () => operationsBoard.filter((item) => focusedLeadIds.has(item.lead_id)),
    [operationsBoard, focusedLeadIds]
  );

  const filteredSchemeTokens = useMemo(
    () =>
      schemeTokens.filter((token) => {
        const matchesStatus =
          adhesiveTokenStatusFilter === "all" || token.status === adhesiveTokenStatusFilter;
        const matchesMason =
          !adhesiveTokenMasonFilter ||
          String(token.mason_name || "").toLowerCase().includes(adhesiveTokenMasonFilter.toLowerCase()) ||
          String(token.mason_mobile || "").toLowerCase().includes(adhesiveTokenMasonFilter.toLowerCase());
        const matchesInvoice =
          !adhesiveTokenInvoiceFilter ||
          String(token.invoice_number || "")
            .toLowerCase()
            .includes(adhesiveTokenInvoiceFilter.toLowerCase());
        const matchesSite =
          !adhesiveTokenSiteFilter ||
          String(token.site_name || "").toLowerCase().includes(adhesiveTokenSiteFilter.toLowerCase());
        const matchesCreatedBy =
          !adhesiveTokenCreatedByFilter ||
          String(token.created_by_user_name || "")
            .toLowerCase()
            .includes(adhesiveTokenCreatedByFilter.toLowerCase());
        const matchesVerifiedBy =
          !adhesiveTokenVerifiedByFilter ||
          String(token.verified_by_user_name || "")
            .toLowerCase()
            .includes(adhesiveTokenVerifiedByFilter.toLowerCase());
        const createdDate = String(token.created_at || "").slice(0, 10);
        const matchesDateFrom = !adhesiveTokenDateFromFilter || (createdDate && createdDate >= adhesiveTokenDateFromFilter);
        const matchesDateTo = !adhesiveTokenDateToFilter || (createdDate && createdDate <= adhesiveTokenDateToFilter);

        return (
          matchesStatus &&
          matchesMason &&
          matchesInvoice &&
          matchesSite &&
          matchesCreatedBy &&
          matchesVerifiedBy &&
          matchesDateFrom &&
          matchesDateTo
        );
      }),
    [
      adhesiveTokenCreatedByFilter,
      adhesiveTokenDateFromFilter,
      adhesiveTokenDateToFilter,
      adhesiveTokenInvoiceFilter,
      adhesiveTokenMasonFilter,
      adhesiveTokenSiteFilter,
      adhesiveTokenStatusFilter,
      adhesiveTokenVerifiedByFilter,
      schemeTokens,
    ]
  );

  const selectedAdhesiveProject = useMemo(
    () => projects.find((project) => project.id === Number(schemeTokenForm.project_id || 0)) || null,
    [projects, schemeTokenForm.project_id]
  );

  const activeMasons = useMemo(
    () => masons.filter((mason) => String(mason.status || "").toLowerCase() === "active"),
    [masons]
  );

  const filteredMasons = useMemo(
    () =>
      masons.filter((mason) => {
        const workingAreas = Array.isArray(mason.working_areas) ? mason.working_areas : [];
        const matchesCurrentCity =
          !masonCurrentCityFilter ||
          String(mason.current_address_city || "").toLowerCase().includes(masonCurrentCityFilter.toLowerCase());
        const matchesPermanentCity =
          !masonPermanentCityFilter ||
          String(mason.permanent_address_city || "").toLowerCase().includes(masonPermanentCityFilter.toLowerCase());
        const matchesWorkingArea =
          !masonWorkingAreaFilter ||
          workingAreas.some((area) => String(area || "").toLowerCase().includes(masonWorkingAreaFilter.toLowerCase()));
        const matchesDistance =
          !masonWorkingDistanceFilter ||
          Number(mason.working_distance_upto_km || 0) >= Number(masonWorkingDistanceFilter || 0);

        return matchesCurrentCity && matchesPermanentCity && matchesWorkingArea && matchesDistance;
      }),
    [masons, masonCurrentCityFilter, masonPermanentCityFilter, masonWorkingAreaFilter, masonWorkingDistanceFilter]
  );

  const selectedRegisteredMason = useMemo(
    () => masons.find((mason) => mason.id === Number(schemeTokenForm.mason_id || 0)) || null,
    [masons, schemeTokenForm.mason_id]
  );

  const adhesiveClaimTotals = useMemo(
    () => getAdhesiveClaimTotals(schemeTokenForm),
    [schemeTokenForm]
  );

  const filteredComplaints = useMemo(
    () =>
      complaints.filter((complaint) => {
        const matchesUnit = matchesBusinessUnitFilter(complaint.business_unit, unitFilter);
        const matchesWorkspace =
          workspaceFilter === "all" ||
          complaint.business_unit === "plumbing" ||
          complaint.business_unit === "both" ||
          workspaceFilter === "sales";

        return matchesUnit && matchesWorkspace;
      }),
    [complaints, unitFilter, workspaceFilter]
  );

  const filteredPlumbingJobs = useMemo(
    () =>
      plumbingBoard.filter(() => {
        const matchesUnit = matchesBusinessUnitFilter("plumbing", unitFilter);
        const matchesWorkspace = workspaceFilter === "all" || workspaceFilter === "operations";
        return matchesUnit && matchesWorkspace;
      }),
    [plumbingBoard, unitFilter, workspaceFilter]
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.is_read),
    [notifications]
  );

  const todaysFollowups = useMemo(
    () =>
      focusedFollowupBoard.filter(
        (item) =>
          item.followup_date &&
          new Date(item.followup_date).toDateString() === new Date().toDateString() &&
          item.computed_status !== "completed"
      ),
    [focusedFollowupBoard]
  );

  const overdueFollowups = useMemo(
    () => focusedFollowupBoard.filter((item) => item.computed_status === "overdue"),
    [focusedFollowupBoard]
  );

  const focusStats = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const convertedLeads = filteredLeads.filter((lead) => lead.status === "converted").length;
    const openLeads = filteredLeads.filter(
      (lead) => lead.status !== "converted" && lead.status !== "lost"
    ).length;
    const todayWalkins = filteredLeads.filter(
      (lead) => new Date(lead.created_at).toDateString() === new Date().toDateString()
    ).length;
    const pendingFollowups = focusedFollowupBoard.filter(
      (item) => item.computed_status === "pending"
    ).length;
    const dueToday = focusedFollowupBoard.filter(
      (item) =>
        item.followup_date &&
        new Date(item.followup_date).toDateString() === new Date().toDateString() &&
        item.computed_status !== "completed"
    ).length;
    const delayedOpsTasks = focusedOperationsBoard.filter((task) => task.status === "delayed").length;
    const openOpsTasks = focusedOperationsBoard.filter((task) =>
      ["pending", "in_progress", "delayed"].includes(task.status)
    ).length;
    const completedOpsTasks = focusedOperationsBoard.filter(
      (task) => task.status === "completed"
    ).length;
    const salesLeads = filteredLeads.filter((lead) => lead.department === "sales").length;
    const operationsLeads = filteredLeads.filter((lead) => lead.department === "operations").length;
    const collectedValue = filteredLeads.reduce(
      (sum, lead) => sum + Number(lead.total_paid || 0),
      0
    );
    const quotedValue = filteredLeads.reduce(
      (sum, lead) => sum + Number(lead.latest_quote_amount || 0),
      0
    );
    const plumbingValue = filteredLeads.reduce(
      (sum, lead) => sum + Number(lead.total_plumbing_cost || 0),
      0
    );
    const conversionRate =
      totalLeads === 0 ? 0 : ((convertedLeads * 100) / totalLeads).toFixed(1);
    const fastMovingSkuCount = filteredProducts.filter(
      (product) => product.status === "fast_moving"
    ).length;

    return {
      totalLeads,
      convertedLeads,
      openLeads,
      todayWalkins,
      pendingFollowups,
      overdueFollowups: overdueFollowups.length,
      dueToday,
      delayedOpsTasks,
      openOpsTasks,
      completedOpsTasks,
      salesLeads,
      operationsLeads,
      collectedValue,
      quotedValue,
      plumbingValue,
      conversionRate,
      fastMovingSkuCount,
    };
  }, [filteredLeads, focusedFollowupBoard, focusedOperationsBoard, overdueFollowups.length, filteredProducts]);
  const ownerOverviewHasData = useMemo(
    () =>
      Boolean(
        dashboardSummary ||
          ownerOverviewData.complaints ||
          ownerOverviewData.projects ||
          ownerOverviewData.purchases ||
          ownerOverviewData.plumbing ||
          ownerOverviewData.schemes ||
          ownerOverviewData.expenses ||
          ownerOverviewData.dailyReport ||
          ownerOverviewData.dailyTasks
      ),
    [dashboardSummary, ownerOverviewData]
  );

  const summaryCards = useMemo(() => {
    // Dashboard de-clutter: keep the shared tail short. Plumbing value and
    // fast-moving SKU counts live inside their own modules (Plumbing, Inventory)
    // where they have context and actions; they added noise here.
    const baseCards = [
      { label: "Today Walk-ins", value: focusStats.todayWalkins },
      { label: "Open Leads", value: focusStats.openLeads },
      { label: "Conversion %", value: `${focusStats.conversionRate}%` },
      { label: "Collected Value", value: `Rs ${focusStats.collectedValue}` },
    ];

    if (workspaceFilter === "operations") {
      return [
        { label: "Operations Leads", value: focusStats.operationsLeads },
        { label: "Open Ops Tasks", value: focusStats.openOpsTasks },
        { label: "Delayed Ops Tasks", value: focusStats.delayedOpsTasks },
        { label: "Completed Ops Tasks", value: focusStats.completedOpsTasks },
        { label: "Due Today", value: focusStats.dueToday },
        ...baseCards,
      ];
    }

    if (workspaceFilter === "sales") {
      return [
        { label: "Sales Leads", value: focusStats.salesLeads },
        { label: "Pending Follow-ups", value: focusStats.pendingFollowups },
        { label: "Overdue Follow-ups", value: focusStats.overdueFollowups },
        { label: "Quoted Value", value: `Rs ${focusStats.quotedValue}` },
        { label: "Due Today", value: focusStats.dueToday },
        ...baseCards,
      ];
    }

    // Priority KPI order for the showroom owner / manager view:
    // 1. Today Sales  2. Today Collection  3. Pending Payments
    // 4. New Leads    5. Hot Leads          6. Open Follow-ups
    // 7. Token Pending  8. Stock Alert
    const priorityCards = [
      dashboardSummary && {
        label: "Today Sales",
        value: `Rs ${Number(dashboardSummary.sales_today?.amount || 0).toLocaleString("en-IN")}`,
        tone: "accent",
      },
      dashboardSummary && {
        label: "Today Collection",
        value: `Rs ${Number(dashboardSummary.collection_today?.amount || 0).toLocaleString("en-IN")}`,
        tone: "accent",
      },
      dashboardSummary && {
        label: "Pending Payments",
        value: `Rs ${Number(dashboardSummary.pending_payments?.amount || 0).toLocaleString("en-IN")}`,
        tone: "danger",
      },
      { label: "New Leads", value: focusStats.todayWalkins },
      { label: "Hot Leads", value: focusStats.openLeads, tone: "accent" },
      { label: "Open Follow-ups", value: focusStats.pendingFollowups },
      dashboardSummary && {
        label: "Token Pending",
        value: dashboardSummary.token_pending?.count ?? 0,
        tone: "danger",
      },
      dashboardSummary && {
        label: "Stock Alert",
        value: dashboardSummary.low_stock_items?.count ?? 0,
        tone: "danger",
      },
    ].filter(Boolean);

    // Owner view keeps only the 8 decision KPIs plus two trend numbers.
    // Dropped duplicates: "New Leads" already equals "Today Walk-ins" and
    // "Hot Leads" equals "Open Leads" from baseCards, so baseCards is omitted.
    // Module-level counts (Sales/Operations Leads, Open Ops Tasks) moved to
    // their own modules where they are actionable.
    return [
      ...priorityCards,
      { label: "Overdue Follow-ups", value: focusStats.overdueFollowups },
      { label: "Monthly Revenue", value: `Rs ${stats?.monthly_revenue ?? 0}` },
      { label: "Conversion %", value: `${focusStats.conversionRate}%` },
    ];
  }, [focusStats, workspaceFilter, stats?.monthly_revenue, dashboardSummary]);

  const overviewTitle =
    workspaceFilter === "operations" ? "Operations handoff board" : "Lead funnel snapshot";
  const overviewSubtitle =
    workspaceFilter === "operations"
      ? `${focusStats.operationsLeads} operations leads in focus`
      : `${filteredLeads.length} leads in focus`;
  const activeViewMeta = viewMeta[currentView] || viewMeta.overview;
  const isOverview = currentView === "overview";
  const pageAction = useMemo(() => {
    const actionMap = {
      overview: { id: "new_lead", label: "+ New Lead" },
      pipeline: { id: "new_lead", label: "+ New Lead" },
      projects: { id: "projects", label: "+ New Project" },
      purchases: { id: "purchases", label: "+ New Bill" },
      billing: { id: "billing", label: "+ New Invoice" },
      masons: { id: "masons", label: "+ Registered Mason" },
      expenses: { id: "expenses", label: "+ Expense" },
    };

    const action = actionMap[currentView];
    if (!action) return null;
    if (action.id !== "new_lead" && !visibleViews.some((view) => view.id === action.id)) return null;
    return action;
  }, [currentView, visibleViews]);
  const headerRoleLabel = useMemo(() => {
    const roles = normalizeUserRoles(user);
    if (roles.length) {
      return roles.slice(0, 2).map(labelize).join(" / ");
    }

    return labelize(user?.role || "User");
  }, [user]);
  const headerWorkspaceLabel =
    workspaceFilter === "all" ? "All Work" : labelize(workspaceFilter);
  function syncSelectedLeadState(nextLeads) {
    if (!Array.isArray(nextLeads) || nextLeads.length === 0) {
      setSelectedLead(null);
      return;
    }

    setSelectedLead((current) => {
      if (current) {
        return nextLeads.find((lead) => lead.id === current.id) || null;
      }

      return null;
    });
  }

  function openNewLeadFlow() {
    setSelectedLead(null);
    setCreateLeadMode(true);
    setEditingLead(emptyLead);
    setLeadForm(emptyLead);
    setLeadFormErrors({});
    setCurrentView("pipeline");
  }

  function closeNewLeadFlow() {
    setCreateLeadMode(false);
    setSelectedLead(null);
    setEditingLead(emptyLead);
    setLeadForm(emptyLead);
    setLeadFormErrors({});
  }

  function handleSelectLead(lead) {
    setCreateLeadMode(false);
    setSelectedLead(lead);
  }

  function handleSelectView(viewId) {
    if (viewId === "pipeline" || viewId === "followups") {
      setCreateLeadMode(false);
      setSelectedLead(null);
      setEditingLead(emptyLead);
    }

    setCurrentView(viewId);
  }

  function syncSelectedProjectState(nextProjects) {
    if (!Array.isArray(nextProjects) || nextProjects.length === 0) {
      setSelectedProject(null);
      return;
    }

    setSelectedProject((current) => {
      if (current) {
        return nextProjects.find((project) => project.id === current.id) || nextProjects[0];
      }

      return nextProjects[0];
    });
  }

  async function loadNotifications(signal) {
    try {
      const notificationsData = await api.getNotifications(createRequestOptions(signal, 12000));
      setNotifications(notificationsData || []);
    } catch (requestError) {
      if (!isAbortLikeError(requestError)) {
        setError(requestError.message);
      }
    }
  }

  async function loadUsersForView(view, signal) {
    if (!hasAnyRole(user, ["admin", "owner", "manager", "operations"])) {
      return null;
    }

    if (!["overview", "operations", "complaints", "team"].includes(view)) {
      return null;
    }

    const usersData = await api.getUsers(createRequestOptions(signal, 12000));
    setUsers(usersData || []);
    return usersData || [];
  }

  async function loadPurchaseCostingData(requestOptions) {
    const costingData = await api
      .getPurchaseCostingDashboard({
        ...requestOptions,
        limit: listLimits.purchaseLots,
        search: purchaseLotSearch,
        status: purchaseLotStatusFilter === "all" ? "" : purchaseLotStatusFilter,
      })
      .catch(() => ({ lots: [], summary: null, reports: {}, references: { products: [] } }));
    setPurchaseLots(costingData.lots || []);
    setPurchaseCostingSummary(costingData.summary || null);
    setPurchaseCostingReports(costingData.reports || {});
    setPurchaseCostingReferences(costingData.references || { products: [] });
    setSelectedPurchaseLot((current) => {
      if (!costingData.lots?.length) {
        return null;
      }

      if (current) {
        const matchingLot = costingData.lots.find((lot) => lot.id === current.id);
        return matchingLot ? { ...current, ...matchingLot } : costingData.lots[0];
      }

      return costingData.lots[0];
    });
  }

  async function loadDashboard(options = {}) {
    const { signal, forceView, silent = false } = options;
    const view = forceView || currentView;
    const requestId = dashboardLoadRef.current + 1;
    dashboardLoadRef.current = requestId;
    let didLoad = false;

    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const requestOptions = createRequestOptions(signal);

      if (view === "overview") {
        if (!canViewOwnerDashboard) {
          setOwnerOverviewData(emptyOwnerOverviewData);
          setOwnerOverviewError("");
          setOwnerOverviewLoading(false);
        } else {
          setOwnerOverviewLoading(true);
          setOwnerOverviewError("");
        }

        const [statsData, leadsData, summaryData, _usersData, inventoryData, billingData] = await Promise.all([
          api.getStats(requestOptions),
          api.getLeads({ ...requestOptions, limit: listLimits.leads }),
          api.getDashboardSummary(requestOptions).catch(() => null),
          loadUsersForView(view, signal),
          api
            .getInventory({ ...requestOptions, limit: listLimits.products })
            .catch(() => ({ products: [], summary: null })),
          api
            .getBillingDashboard({ ...requestOptions, limit: listLimits.invoices })
            .catch(() => ({ invoices: [], summary: null, reports: {}, references: {} })),
        ]);

        setStats(statsData);
        setLeads(leadsData);
        setDashboardSummary(summaryData);
        setProducts(inventoryData.products || []);
        setInventorySummary(createSafeInventorySummary(inventoryData.summary));
        setInvoices(billingData.invoices || []);
        setBillingSummary(billingData.summary || null);
        setBillingReports(billingData.reports || {});
        syncSelectedLeadState(leadsData);

        if (canViewOwnerDashboard) {
          const ownerOverviewReportDate = getLocalDateInputValue();
          const ownerResults = await Promise.allSettled([
            api.getComplaintsDashboard({ ...requestOptions, limit: listLimits.complaints }),
            api.getProjectsDashboard({ ...requestOptions, limit: listLimits.projects }),
            api.getPurchases({
              ...requestOptions,
              limit: listLimits.purchases,
            }),
            api.getPlumbingDashboard(requestOptions),
            api.getSchemesDashboard({ ...requestOptions, limit: listLimits.claims, mason_limit: listLimits.masons }),
            api.getExpensesDashboard(requestOptions),
            api.getDailyReport({ date: ownerOverviewReportDate }, requestOptions),
            api.getDailyTaskSummary(requestOptions),
          ]);

          if (dashboardLoadRef.current !== requestId || signal?.aborted) {
            return false;
          }

          const [
            complaintsResult,
            projectsResult,
            purchasesResult,
            plumbingResult,
            schemesResult,
            expensesResult,
            dailyReportResult,
            dailyTasksResult,
          ] = ownerResults;

          const nextOwnerOverviewData = {
            complaints: complaintsResult.status === "fulfilled" ? complaintsResult.value?.summary || null : null,
            projects: projectsResult.status === "fulfilled" ? projectsResult.value?.summary || null : null,
            purchases: purchasesResult.status === "fulfilled" ? purchasesResult.value?.summary || null : null,
            plumbing: plumbingResult.status === "fulfilled" ? plumbingResult.value?.summary || null : null,
            schemes: schemesResult.status === "fulfilled" ? schemesResult.value?.summary || null : null,
            expenses: expensesResult.status === "fulfilled" ? expensesResult.value?.summary || null : null,
            dailyReport: dailyReportResult.status === "fulfilled" ? dailyReportResult.value || null : null,
            dailyTasks: dailyTasksResult.status === "fulfilled" ? dailyTasksResult.value || null : null,
          };

          const failedLabels = ownerResults
            .map((result, index) => {
              if (result.status === "fulfilled") {
                return "";
              }

              return ["complaints", "projects", "purchases", "plumbing", "tokens", "expenses", "daily report", "daily tasks"][index];
            })
            .filter(Boolean);

          setOwnerOverviewData(nextOwnerOverviewData);
          setOwnerOverviewError(
            failedLabels.length ? `Some owner widgets could not refresh: ${failedLabels.join(", ")}.` : ""
          );
          setOwnerOverviewLoading(false);
        }
      } else if (view === "pipeline") {
        const leadsData = await api.getLeads({ ...requestOptions, limit: listLimits.leads });
        setLeads(leadsData);
        syncSelectedLeadState(leadsData);
      } else if (view === "followups") {
        const [followupData, leadsData] = await Promise.all([
          api.getFollowupBoard(requestOptions),
          api.getLeads({ ...requestOptions, limit: listLimits.leads }),
        ]);

        setFollowupBoard(followupData || []);
        setLeads(leadsData);
        syncSelectedLeadState(leadsData);
      } else if (view === "operations") {
        const assignedTaskFilter =
          canManageDailyTasks && dailyTaskFilters.assigned_to !== "all" ? dailyTaskFilters.assigned_to : "";
        const [dailyTasksData] = await Promise.all([
          api.getDailyTasks(
            {
              limit: listLimits.leads,
              view: dailyTaskViewTab === "summary" ? "" : dailyTaskViewTab,
              search: debouncedDailyTaskSearch,
              status: dailyTaskFilters.status === "all" ? "" : dailyTaskFilters.status,
              assigned_to: assignedTaskFilter,
              priority: dailyTaskFilters.priority === "all" ? "" : dailyTaskFilters.priority,
              due_date: dailyTaskFilters.due_date,
            },
            requestOptions
          ),
          loadUsersForView(view, signal),
        ]);
        setDailyTasks(dailyTasksData?.tasks || []);
        setDailyTaskSummary(dailyTasksData?.summary || null);
        setDailyTaskStaffSummary(dailyTasksData?.staffSummary || []);
      } else if (view === "quotations") {
        const [leadsData, inventoryData] = await Promise.all([
          api.getLeads({ ...requestOptions, limit: listLimits.leads }),
          api.getInventory({ ...requestOptions, limit: listLimits.products }),
        ]);

        setLeads(leadsData);
        syncSelectedLeadState(leadsData);
        setProducts(inventoryData.products || []);
        setInventorySummary(createSafeInventorySummary(inventoryData.summary));
      } else if (view === "schemes") {
        const [schemesData, projectsData] = await Promise.all([
          api.getSchemesDashboard({ ...requestOptions, limit: listLimits.claims, mason_limit: listLimits.masons }),
          api.getProjectsDashboard({ ...requestOptions, limit: listLimits.projects }).catch(() => ({ projects: [], summary: null })),
        ]);

        setSchemeTokens(schemesData.tokens || []);
        setSchemeSummary(schemesData.summary || null);
        setAdhesiveTokenReports(schemesData.reports || {});
        setAdhesiveTokenActivities(schemesData.activities || []);
        setMasons(schemesData.masons || []);
        setMasonActivities(schemesData.masonActivities || []);
        setProjects(projectsData.projects || []);
        setProjectSummary(projectsData.summary || null);
        syncSelectedProjectState(projectsData.projects || []);
      } else if (view === "masons") {
        const schemesData = await api.getSchemesDashboard({ ...requestOptions, limit: listLimits.claims, mason_limit: listLimits.masons });

        setMasons(schemesData.masons || []);
        setMasonActivities(schemesData.masonActivities || []);
      } else if (view === "inventory") {
        const inventorySearch = String(inventoryLedgerSearch || "").trim();
        const [inventoryData, inventoryOptionsData] = await Promise.all([
          api.getInventory({
            ...requestOptions,
            // If the operator typed a search term, ask the server for it
            // and widen the page so products outside the first 40 surface.
            limit: inventorySearch ? 100 : listLimits.products,
            search: inventorySearch || undefined,
          }),
          api.getInventoryOptions(requestOptions).catch(() => ({ companies: [], sizes: [], finishes: [] })),
        ]);
        setProducts(inventoryData.products || []);
        setInventorySummary(createSafeInventorySummary(inventoryData.summary));
        setInventoryOptions({
          companies: Array.isArray(inventoryOptionsData?.companies) ? inventoryOptionsData.companies : [],
          sizes: Array.isArray(inventoryOptionsData?.sizes) ? inventoryOptionsData.sizes : [],
          finishes: Array.isArray(inventoryOptionsData?.finishes) ? inventoryOptionsData.finishes : [],
        });
      } else if (view === "dealers") {
        const dealersData = await api.getDealers({ ...requestOptions, limit: listLimits.dealers });
        setDealers(dealersData || []);
      } else if (view === "plumbing") {
        const plumbingData = await api.getPlumbingDashboard(requestOptions);
        setPlumbers(plumbingData.plumbers || []);
        setPlumbingBoard(plumbingData.jobs || []);
        setPlumbingSummary(plumbingData.summary || null);
      } else if (view === "complaints") {
        const complaintsData = await api.getComplaintsDashboard({ ...requestOptions, limit: listLimits.complaints });
        await loadUsersForView(view, signal);
        setComplaints(complaintsData.complaints || []);
        setComplaintSummary(complaintsData.summary || null);
      } else if (view === "projects") {
        const [projectsData, leadsData] = await Promise.all([
          api.getProjectsDashboard({ ...requestOptions, limit: listLimits.projects }).catch(() => ({ projects: [], summary: null })),
          api.getLeads({ ...requestOptions, limit: listLimits.leads }),
        ]);

        setProjects(projectsData.projects || []);
        setProjectSummary(projectsData.summary || null);
        setLeads(leadsData);
        syncSelectedLeadState(leadsData);
        syncSelectedProjectState(projectsData.projects || []);
      } else if (view === "expenses") {
        const expensesData = await api.getExpensesDashboard(requestOptions).catch(() => ({ expenses: [], summary: null }));
        setExpenses(expensesData.expenses || []);
        setExpenseSummary(expensesData.summary || null);
      } else if (view === "purchases") {
        const [purchasesData, inventoryData, suppliersData] = await Promise.all([
          api
            .getPurchases({
              ...requestOptions,
              limit: listLimits.purchases,
              search: purchaseSearch,
              from: purchaseFromFilter,
              to: purchaseToFilter,
              payment_status: purchasePaymentFilter === "all" ? "" : purchasePaymentFilter,
            })
            .catch(() => ({ purchases: [], summary: null })),
          api.getInventory({ ...requestOptions, limit: listLimits.products }).catch(() => ({ products: [] })),
          api.getSuppliers({ ...requestOptions, status: "active", limit: 500 }).catch(() => []),
        ]);
        setPurchases(purchasesData.purchases || []);
        setPurchaseInvoices(purchasesData.invoices || []);
        setPurchaseSummary(purchasesData.summary || null);
        setProducts(inventoryData.products || []);
        setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);

        // The "costing" tab lives inside the Purchase Center view but has its
        // own dataset. Without this, the tab opened empty until the user
        // performed a costing action (which force-reloaded it).
        if (purchaseWorkspaceTab === "costing") {
          await loadPurchaseCostingData(requestOptions);
        }
      } else if (view === "purchase_costing") {
        await loadPurchaseCostingData(requestOptions);
      } else if (view === "billing") {
        const billingData = await api
          .getBillingDashboard({
            ...requestOptions,
            limit: listLimits.invoices,
            search: billingSearch,
            status: billingStatusFilter === "all" ? "" : billingStatusFilter,
            payment_status: billingPaymentFilter === "all" ? "" : billingPaymentFilter,
            from: billingFromFilter,
            to: billingToFilter,
          })
          .catch(() => ({ invoices: [], summary: null, reports: {}, references: { leads: [], quotations: [], projects: [], products: [] } }));
        setInvoices(billingData.invoices || []);
        setBillingSummary(billingData.summary || null);
        setBillingReports(billingData.reports || {});
        setBillingReferences(
          billingData.references || { leads: [], quotations: [], projects: [], products: [] }
        );
        setSelectedInvoice((current) => {
          if (!billingData.invoices?.length) {
            return null;
          }

          if (current) {
            return billingData.invoices.find((invoice) => invoice.id === current.id) || billingData.invoices[0];
          }

          return billingData.invoices[0];
        });
      } else if (view === "reports") {
        const [statsData, projectsData, expensesData, summaryData, dailyData] = await Promise.all([
          api.getStats(requestOptions),
          api.getProjectsDashboard({ ...requestOptions, limit: listLimits.projects }).catch(() => ({ projects: [], summary: null })),
          api.getExpensesDashboard(requestOptions).catch(() => ({ expenses: [], summary: null })),
          api.getDashboardSummary(requestOptions).catch(() => null),
          api.getDailyReport({ date: dailyReportDate }, requestOptions).catch(() => null),
        ]);

        setStats(statsData);
        setProjects(projectsData.projects || []);
        setProjectSummary(projectsData.summary || null);
        setExpenses(expensesData.expenses || []);
        setExpenseSummary(expensesData.summary || null);
        setDashboardSummary(summaryData);
        setDailyReport(dailyData);
      } else if (view === "team") {
        await loadUsersForView(view, signal);
      }
      didLoad = true;
    } catch (requestError) {
      if (!silent && !isAbortLikeError(requestError)) {
        setError(requestError.message);
      }
    } finally {
      if (view === "overview" && canViewOwnerDashboard && dashboardLoadRef.current === requestId) {
        setOwnerOverviewLoading(false);
      }
      if (!silent && dashboardLoadRef.current === requestId) {
        setLoading(false);
      }
    }

    return didLoad;
  }

  useEffect(() => {
    if (!token || !user) {
      return undefined;
    }

    const controller = new AbortController();
    loadNotifications(controller.signal);
    return () => controller.abort();
  }, [token, user?.id]);

  useEffect(() => {
    if (!token || !user) {
      return undefined;
    }

    const controller = new AbortController();
    loadDashboard({ signal: controller.signal });
    return () => controller.abort();
  }, [
    token,
    user?.id,
    currentView,
    listLimits,
    purchaseSearch,
    purchaseFromFilter,
    purchaseToFilter,
    purchasePaymentFilter,
    purchaseLotSearch,
    purchaseLotStatusFilter,
    purchaseWorkspaceTab,
    billingSearch,
    billingStatusFilter,
    billingPaymentFilter,
    billingFromFilter,
    billingToFilter,
    dailyTaskViewTab,
    dailyTaskFilters.status,
    dailyTaskFilters.priority,
    dailyTaskFilters.assigned_to,
    dailyTaskFilters.due_date,
    debouncedDailyTaskSearch,
    dailyReportDate,
    inventoryLedgerSearch,
  ]);

  useEffect(() => {
    if (!token || !selectedLead?.id || !leadDrivenViews.has(currentView)) {
      return undefined;
    }

    const controller = new AbortController();
    loadLeadDetails(selectedLead.id, { signal: controller.signal });
    return () => controller.abort();
  }, [token, currentView, selectedLead?.id]);

  useEffect(() => {
    if (!token || !user || !autoRefreshIntervalMs) {
      return undefined;
    }

    let cancelled = false;

    const intervalId = window.setInterval(async () => {
      if (cancelled || document.visibilityState !== "visible" || isInteractiveElementActive() || autoRefreshBlocked) {
        return;
      }

      const controller = new AbortController();
      const loaded = await loadDashboard({ signal: controller.signal, forceView: currentView, silent: true });

      if (loaded && leadDrivenViews.has(currentView) && selectedLead?.id && !isLeadWorkspaceDirty) {
        await loadLeadDetails(selectedLead.id, { signal: controller.signal });
      }

      if (!cancelled && loaded) {
        setAutoRefreshState({ view: currentView, at: Date.now() });
      }
    }, autoRefreshIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    autoRefreshBlocked,
    autoRefreshIntervalMs,
    currentView,
    isLeadWorkspaceDirty,
    listLimits,
    purchaseSearch,
    purchaseFromFilter,
    purchaseToFilter,
    purchasePaymentFilter,
    purchaseLotSearch,
    purchaseLotStatusFilter,
    purchaseWorkspaceTab,
    billingSearch,
    billingStatusFilter,
    billingPaymentFilter,
    billingFromFilter,
    billingToFilter,
    dailyReportDate,
    selectedLead?.id,
    token,
    user?.id,
  ]);

  useEffect(() => {
    if (currentView !== "pipeline") {
      setCreateLeadMode(false);
    }
  }, [currentView]);

  useEffect(() => {
    if (selectedLead) {
      setEditingLead({
        name: selectedLead.name || "",
        phone: selectedLead.phone || "",
        location: selectedLead.location || "",
        department: selectedLead.department || "sales",
        business_unit: selectedLead.business_unit || "tiles",
        customer_type: selectedLead.customer_type || "retail_customer",
        requirement_category: selectedLead.requirement_category || "flooring",
        requirement: selectedLead.requirement || "",
        budget: selectedLead.budget || "",
        timeline: selectedLead.timeline || "urgent",
        lead_source: selectedLead.lead_source || "walk_in",
        status: selectedLead.status || "new",
        lost_reason: selectedLead.lost_reason || "",
        assigned_to: selectedLead.assigned_to || "",
      });
      setPlumbingJobForm((current) => ({
        ...current,
        lead_id: selectedLead.id,
      }));
    } else {
      setEditingLead(emptyLead);
      setLeadPlumbingJobs([]);
      setPlumbingJobForm(emptyPlumbingJob);
    }
  }, [selectedLead]);

  useEffect(() => {
    if (!filteredLeads.length) {
      if (selectedLead) {
        setSelectedLead(null);
      }
      return;
    }

    if (selectedLead && !filteredLeads.some((lead) => lead.id === selectedLead.id)) {
      setSelectedLead(null);
    }
  }, [filteredLeads, selectedLead]);

  useEffect(() => {
    if (!filteredProjects.length) {
      if (selectedProject) {
        setSelectedProject(null);
      }
      return;
    }

    if (!selectedProject || !filteredProjects.some((project) => project.id === selectedProject.id)) {
      setSelectedProject(filteredProjects[0]);
    }
  }, [filteredProjects, selectedProject]);

  async function loadLeadDetails(leadId, options = {}) {
    const { signal } = options;

    try {
      const requestOptions = createRequestOptions(signal, 12000);
      const [followupData, paymentData, quotationData, operationsTaskData, plumbingJobData] = await Promise.all([
        api.getFollowups(leadId, requestOptions),
        api.getPayments(leadId, requestOptions),
        api.getQuotations(leadId, requestOptions),
        api.getOperationsTasks(leadId, requestOptions),
        api.getLeadPlumbingJobs(leadId, requestOptions),
      ]);
      setFollowups(followupData);
      setPayments(paymentData);
      setQuotations(quotationData);
      setOperationsTasks(operationsTaskData);
      setLeadPlumbingJobs(plumbingJobData);
    } catch (requestError) {
      if (!isAbortLikeError(requestError)) {
        setError(requestError.message);
      }
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setAuthNotice("");
    const validationError = validateLoginForm(loginForm);
    if (validationError) {
      setError(validationError);
      return;
    }

      await runBusyAction("login", async () => {
        const data = await api.login(loginForm);
        const normalizedUser = { ...data.user, roles: normalizeUserRoles(data.user) };
        localStorage.setItem("tiles-crm-token", data.token);
        localStorage.setItem("tiles-crm-user", JSON.stringify(normalizedUser));
        setToken(data.token);
        setUser(normalizedUser);
        pushToast(`Welcome back, ${normalizedUser.name}.`);
      });
  }

  async function handleCreateLead(event) {
    event.preventDefault();
    const requiredErrors = validateRequiredFields(leadForm, {
      name: "Customer name is required.",
      phone: "Mobile number is required.",
      requirement: "Requirement is required.",
      budget: {
        message: "Budget is required.",
        validate: (value) => normalizeText(value) !== "",
      },
    });
    setLeadFormErrors(requiredErrors);
    if (Object.keys(requiredErrors).length) {
      setError("");
      focusFirstInvalidField(event.currentTarget, requiredErrors);
      return;
    }

    const validationError = validateLeadForm(leadForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-lead", async () => {
      await api.createLead(normalizeLeadPayload(leadForm));
      setLeadForm(emptyLead);
      setLeadFormErrors({});
      setCreateLeadMode(false);
      setSelectedLead(null);
      await loadDashboard();
    }, "Lead saved.");
  }

  async function handleUpdateLead(event) {
    event.preventDefault();
    if (!selectedLead) {
      return;
    }

    const validationError = validateLeadForm(editingLead);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("update-lead", async () => {
      await api.updateLead(selectedLead.id, normalizeLeadPayload(editingLead));
      await loadDashboard();
    }, "Lead updated.");
  }

  async function handleDeleteLead(leadId) {
    await runBusyAction("delete-lead", async () => {
      await api.deleteLead(leadId);
      if (selectedLead?.id === leadId) {
        setSelectedLead(null);
        setFollowups([]);
        setPayments([]);
        setQuotations([]);
        setLeadPlumbingJobs([]);
      }
      await loadDashboard();
    }, "Lead deleted.");
  }

  async function handleCreateFollowup(event) {
    event.preventDefault();
    if (!selectedLead) {
      return;
    }

    const requiredErrors = validateRequiredFields(followupForm, {
      note: "Follow-up note is required.",
      followup_date: {
        message: "Follow-up date is required.",
        validate: (value) => Boolean(value),
      },
    });
    setFollowupFormErrors(requiredErrors);
    if (Object.keys(requiredErrors).length) {
      setError("");
      focusFirstInvalidField(event.currentTarget, requiredErrors);
      return;
    }

    const validationError = validateFollowupForm(followupForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-followup", async () => {
      await api.createFollowup(selectedLead.id, followupForm);
      setFollowupForm(emptyFollowup);
      setFollowupFormErrors({});
      await loadLeadDetails(selectedLead.id);
      await loadDashboard();
    }, "Follow-up saved.");
  }

  async function markFollowupDone(followup) {
    await runBusyAction("complete-followup", async () => {
      await api.updateFollowup(followup.lead_id, followup.id, {
        note: followup.note,
        followup_date: followup.followup_date,
        followup_type: followup.followup_type,
        status: "completed",
      });
      if (selectedLead?.id === followup.lead_id) {
        await loadLeadDetails(followup.lead_id);
      }
      await loadDashboard();
    }, "Follow-up marked done.");
  }

  async function handleCreatePayment(event) {
    event.preventDefault();
    if (!selectedLead) {
      return;
    }

    const validationError = validatePaymentForm(paymentForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-payment", async () => {
      await api.createPayment(selectedLead.id, {
        amount: Number(paymentForm.amount || 0),
        payment_type: paymentForm.payment_type,
        due_date: paymentForm.due_date || null,
        note: paymentForm.note,
      });
      setPaymentForm(emptyPayment);
      await loadLeadDetails(selectedLead.id);
      await loadDashboard();
    }, "Payment recorded.");
  }

  async function handleCreateOperationsTask(event) {
    event.preventDefault();
    if (!selectedLead) {
      return;
    }

    const validationError = validateOperationsTaskForm(operationsTaskForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-operations-task", async () => {
      await api.createOperationsTask(selectedLead.id, {
        ...operationsTaskForm,
        assigned_to: operationsTaskForm.assigned_to || null,
      });
      setOperationsTaskForm(emptyOperationsTask);
      await loadLeadDetails(selectedLead.id);
      await loadDashboard();
    }, "Operations task saved.");
  }

  async function markOperationsTaskDone(task) {
    await runBusyAction("complete-operations-task", async () => {
      await api.updateOperationsTask(task.lead_id, task.id, {
        task_type: task.task_type,
        title: task.title,
        note: task.note,
        scheduled_for: task.scheduled_for,
        status: "completed",
        assigned_to: task.assigned_to,
      });
      if (selectedLead?.id === task.lead_id) {
        await loadLeadDetails(task.lead_id);
      }
      await loadDashboard();
    }, "Operations task marked done.");
  }

  function resetDailyTaskForm() {
    setDailyTaskForm(createEmptyDailyTask());
    setDailyTaskFormErrors({});
    setEditingDailyTaskId(null);
  }

  function startEditingDailyTask(task) {
    setEditingDailyTaskId(task.id);
    setDailyTaskFormErrors({});
    setDailyTaskForm({
      title: task.title || "",
      description: task.description || "",
      assigned_to: String(task.assigned_to || ""),
      priority: task.priority || "medium",
      due_date: formatDateInput(task.due_date),
      due_time: String(task.due_time || "").slice(0, 5),
      status: task.status || "pending",
      remarks: task.remarks || "",
    });
  }

  async function handleSaveDailyTask(event) {
    event.preventDefault();

    const validationErrors = canManageDailyTasks
      ? validateRequiredFields(dailyTaskForm, {
          title: "Task title is required.",
          assigned_to: "Assigned staff is required.",
          due_date: "Due date is required.",
        })
      : {};
    setDailyTaskFormErrors(validationErrors);

    if (Object.keys(validationErrors).length) {
      setError("");
      focusFirstInvalidField(event.currentTarget, validationErrors);
      return;
    }

    const validationError = validateDailyTaskForm(dailyTaskForm, {
      canManageAllTasks: canManageDailyTasks,
      canVerifyDailyTasks,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      ...dailyTaskForm,
      assigned_to: dailyTaskForm.assigned_to || null,
      due_time: dailyTaskForm.due_time || null,
    };

    await runBusyAction("save-daily-task", async () => {
      if (editingDailyTaskId) {
        await api.updateDailyTask(editingDailyTaskId, payload);
      } else {
        await api.createDailyTask(payload);
      }

      resetDailyTaskForm();
      await loadDashboard({ forceView: "operations" });
    }, editingDailyTaskId ? "Daily task updated." : "Daily task created.");
  }

  async function handleQuickDailyTaskStatusUpdate(task, status) {
    await runBusyAction(`daily-task-status-${task.id}`, async () => {
      await api.updateDailyTask(task.id, {
        status,
        remarks: task.remarks || "",
      });
      if (editingDailyTaskId === task.id) {
        setDailyTaskForm((current) => ({ ...current, status }));
      }
      await loadDashboard({ forceView: "operations", silent: true });
    }, "Task status updated.");
  }

  async function handleDeleteDailyTask(taskId) {
    await runBusyAction("delete-daily-task", async () => {
      await api.deleteDailyTask(taskId);
      if (editingDailyTaskId === taskId) {
        resetDailyTaskForm();
      }
      await loadDashboard({ forceView: "operations" });
    }, "Daily task deleted.");
  }

  function requestDeleteDailyTask(task) {
    setPendingDelete({
      type: "daily-task",
      id: task.id,
      entityLabel: "Daily Task",
      message: `This will permanently remove the task "${task.title}".`,
      subtext: `${task.assigned_to_name || "Unassigned"} | ${formatDate(task.due_date)}`,
    });
  }

  function requestVerifyDailyTask(task) {
    openActionConfirmation({
      title: "Verify task completion?",
      message: `Mark "${task.title}" as verified?`,
      confirmLabel: "Verify Task",
      tone: "accent",
      subtext: task.assigned_to_name || "Assigned staff not available",
      onConfirm: async () => {
        await runBusyAction(`verify-daily-task-${task.id}`, async () => {
          await api.verifyDailyTask(task.id);
          if (editingDailyTaskId === task.id) {
            setDailyTaskForm((current) => ({ ...current, status: "verified" }));
          }
          await loadDashboard({ forceView: "operations", silent: true });
        }, "Daily task verified.");
      },
    });
  }

  async function handleCreateQuotation(event) {
    event.preventDefault();
    if (!selectedLead) {
      return;
    }

    const requiredErrors = getQuotationRequiredErrors(quotationForm);
    setQuotationFormErrors(requiredErrors);
    if (Object.keys(requiredErrors).length) {
      setError("");
      focusFirstInvalidField(event.currentTarget, requiredErrors);
      return;
    }

    const validationError = validateQuotationForm(quotationForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-quotation", async () => {
      await api.createQuotation(selectedLead.id, {
        discount: Number(quotationForm.discount || 0),
        transport_cost: Number(quotationForm.transport_cost || 0),
        status: quotationForm.status,
        items: quotationForm.items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          tile_size: item.tile_size,
          quantity_sqft: Number(item.quantity_sqft || 0),
          unit_price: Number(item.unit_price || 0),
        })),
      });
      setQuotationForm(emptyQuotation);
      setQuotationFormErrors({});
      await loadLeadDetails(selectedLead.id);
      await loadDashboard();
    }, "Quotation saved.");
  }

  async function handleSaveDealer(event) {
    event.preventDefault();
    const validationError = validateDealerForm(dealerForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-dealer", async () => {
      if (editingDealerId) {
        await api.updateDealer(editingDealerId, normalizeDealerPayload(dealerForm));
      } else {
        await api.createDealer(normalizeDealerPayload(dealerForm));
      }
      setDealerForm(emptyDealer);
      setEditingDealerId(null);
      await loadDashboard();
    }, editingDealerId ? "Dealer updated." : "Dealer saved.");
  }

  async function handleSaveProduct(event) {
    event.preventDefault();
    if (isAddingCustomProductCategory && normalizeText(productForm.category)) {
      setCustomProductCategories((current) =>
        current.includes(normalizeText(productForm.category))
          ? current
          : [...current, normalizeText(productForm.category)]
      );
    }
    if (isAddingCustomCompany && normalizeText(productForm.company_name)) {
      setCustomCompanyOptions((current) =>
        current.includes(normalizeText(productForm.company_name))
          ? current
          : [...current, normalizeText(productForm.company_name)]
      );
    }
    if (isAddingCustomProductSize && normalizeText(productForm.product_size || productForm.tile_size)) {
      setCustomProductSizeOptions((current) =>
        current.includes(normalizeText(productForm.product_size || productForm.tile_size))
          ? current
          : [...current, normalizeText(productForm.product_size || productForm.tile_size)]
      );
    }
    if (isAddingCustomFinish && normalizeText(productForm.finish)) {
      setCustomFinishOptions((current) =>
        current.includes(normalizeText(productForm.finish))
          ? current
          : [...current, normalizeText(productForm.finish)]
      );
    }
    // Current Stock is required. Blank/null/undefined invalid; 0 is allowed
    // when explicitly entered. Negative invalid.
    const stockRaw = productForm.stock_sqft;
    const stockTrim = typeof stockRaw === "string" ? stockRaw.trim() : stockRaw;
    const stockNum = Number(stockTrim);
    if (stockTrim === "" || stockTrim === null || stockTrim === undefined || Number.isNaN(stockNum)) {
      setProductFormErrors((prev) => ({ ...prev, stock_sqft: "Current stock is required" }));
      setError("Current stock is required");
      return;
    }
    if (stockNum < 0) {
      setProductFormErrors((prev) => ({ ...prev, stock_sqft: "Current stock cannot be negative" }));
      setError("Current stock cannot be negative");
      return;
    }
    setProductFormErrors((prev) => {
      if (!prev?.stock_sqft) return prev;
      const next = { ...prev };
      delete next.stock_sqft;
      return next;
    });

    const validationError = validateProductForm(productForm, {
      requireDesignCode: !editingProductId,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    if (similarProductMatch && !productDuplicateOverride) {
      setError("Similar product already exists. Review the existing record or continue anyway.");
      return;
    }

    await runBusyAction("save-product", async () => {
      try {
        if (editingProductId) {
          await api.updateProduct(editingProductId, normalizeProductPayload(productForm));
        } else {
          await api.createProduct(normalizeProductPayload(productForm));
        }
      } catch (saveError) {
        if (saveError?.status === 409 && saveError?.data?.existing_product) {
          // Surface the existing product via the existing "Open Existing"
          // banner: this puts the same product card with [Open Existing]
          // button in front of the operator instead of a dead-end error.
          const existing = saveError.data.existing_product;
          try {
            setProducts((current) => {
              if (!Array.isArray(current)) return current;
              if (current.some((p) => Number(p.id) === Number(existing.id))) return current;
              return [existing, ...current];
            });
          } catch (_e) { /* defensive */ }
          setError(
            (saveError.data.message || "Similar product already exists.") +
            " Open the existing record below."
          );
          throw saveError;
        }
        throw saveError;
      }
      setProductForm(emptyProduct);
      setProductFormErrors({});
      setEditingProductId(null);
      setIsAddingCustomProductCategory(false);
      setIsAddingCustomCompany(false);
      setIsAddingCustomProductSize(false);
      setIsAddingCustomFinish(false);
      setProductDuplicateOverride(false);
      await loadDashboard();
    }, editingProductId ? "Inventory item updated." : "Inventory item saved.");
  }

  async function handleSaveProject(event) {
    event.preventDefault();
    const requiredErrors = validateRequiredFields(projectForm, {
      lead_id: {
        message: "Converted lead is required.",
        validate: (value) => Number.isInteger(Number(value)) && Number(value) > 0,
      },
      project_name: "Project name is required.",
      start_date: {
        message: "Start date is required.",
        validate: (value) => Boolean(value),
      },
      expected_delivery_date: {
        message: "Expected delivery date is required.",
        validate: (value) => Boolean(value),
      },
      completion_date: {
        message: "Completion date is required.",
        validate: (value) => Boolean(value),
      },
    });
    setProjectFormErrors(requiredErrors);
    if (Object.keys(requiredErrors).length) {
      setError("");
      focusFirstInvalidField(event.currentTarget, requiredErrors);
      return;
    }

    const validationError = validateProjectForm(projectForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-project", async () => {
      const payload = {
        ...projectForm,
        lead_id: Number(projectForm.lead_id),
      };

      if (editingProjectId) {
        await api.updateProject(editingProjectId, payload);
      } else {
        await api.createProject(payload);
      }

      setProjectForm(emptyProject);
      setProjectFormErrors({});
      setEditingProjectId(null);
      await loadDashboard();
      setCurrentView("projects");
    }, editingProjectId ? "Project updated." : "Project created.");
  }

  async function handleSaveDispatch(projectId) {
    const draft = dispatchDrafts[projectId] || emptyDispatch;
    const validationError = validateDispatchForm(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-dispatch", async () => {
      await api.createDispatch(projectId, {
        ...draft,
        quantity: Number(draft.quantity || 0),
      });

      setDispatchDrafts((current) => ({
        ...current,
        [projectId]: emptyDispatch,
      }));

      await loadDashboard();
    }, "Dispatch saved.");
  }

  async function handleUpdateDispatchStatus(projectId, dispatch) {
    const nextStatus =
      dispatch.status === "pending"
        ? "dispatched"
        : dispatch.status === "dispatched"
          ? "delivered"
          : "delivered";

    await runBusyAction("update-dispatch-status", async () => {
      await api.updateDispatch(projectId, dispatch.id, {
        item_name: dispatch.item_name,
        quantity: Number(dispatch.quantity || 0),
        vehicle_number: dispatch.vehicle_number || "",
        driver_name: dispatch.driver_name || "",
        dispatch_date: dispatch.dispatch_date ? formatDateTimeLocalInput(dispatch.dispatch_date) : "",
        status: nextStatus,
        note: dispatch.note || "",
      });
      await loadDashboard();
    }, nextStatus === "delivered" ? "Dispatch marked delivered." : "Dispatch marked dispatched.");
  }

  function requestMarkFollowupDone(followup) {
    openActionConfirmation({
      title: "Mark follow-up done?",
      message: `This will complete the ${labelize(followup.followup_type)} follow-up for ${followup.lead_name}.`,
      confirmLabel: "Mark Done",
      onConfirm: () => markFollowupDone(followup),
      subtext: followup.note,
    });
  }

  function requestMarkOperationsTaskDone(task) {
    openActionConfirmation({
      title: "Mark task done?",
      message: `This will complete the operations task "${task.title}".`,
      confirmLabel: "Mark Done",
      onConfirm: () => markOperationsTaskDone(task),
      subtext: `${labelize(task.task_type)} | ${task.lead_name}`,
    });
  }

  function requestResolveComplaint(complaint) {
    openActionConfirmation({
      title: "Resolve complaint?",
      message: `This will mark "${complaint.title}" as resolved.`,
      confirmLabel: "Mark Resolved",
      onConfirm: () => markComplaintResolved(complaint),
      subtext: `${complaint.customer_name} | ${labelize(complaint.business_unit)}`,
    });
  }

  function requestMarkAdhesiveTokenPaid(token) {
    openActionConfirmation({
      title: "Mark claim as paid?",
      message: `This will mark the adhesive token claim payout for ${token.mason_name} as paid.`,
      confirmLabel: "Mark Paid",
      onConfirm: () => handleMarkAdhesiveTokenPaid(token),
      subtext: `${token.site_name} | Rs ${token.total_token_amount}`,
    });
  }

  function requestApproveAdhesiveToken(token) {
    openActionConfirmation({
      title: "Approve token claim?",
      message: `This will approve the adhesive token claim for invoice ${token.invoice_number}.`,
      confirmLabel: "Approve Claim",
      onConfirm: () => handleApproveAdhesiveToken(token),
      subtext: `${token.site_name} | ${token.mason_name}`,
    });
  }

  function requestVerifyAdhesiveToken(token) {
    openActionConfirmation({
      title: "Verify invoice now?",
      message: `This will verify the adhesive token claim for invoice ${token.invoice_number}.`,
      confirmLabel: "Verify Invoice",
      onConfirm: () => handleVerifyAdhesiveTokenClaim(token),
      subtext: `${token.site_name} | ${token.mason_name}`,
    });
  }

  function requestRejectAdhesiveToken(token) {
    openActionConfirmation({
      title: "Reject claim?",
      message: `This will reject the adhesive token claim for ${token.mason_name}.`,
      confirmLabel: "Reject Claim",
      tone: "danger",
      onConfirm: () => handleRejectAdhesiveToken(token),
      subtext: `${token.site_name} | ${token.invoice_number}`,
    });
  }

  function requestPlumbingJobComplete(job) {
    openActionConfirmation({
      title: "Mark plumbing job complete?",
      message: `This will complete the ${labelize(job.work_type)} job for ${job.lead_name || "the selected lead"}.`,
      confirmLabel: "Mark Complete",
      onConfirm: () => handleUpdatePlumbingJobStatus(job, "completed"),
      subtext: job.note || "",
    });
  }

  function requestDispatchStatusUpdate(projectId, dispatch) {
    const nextLabel = dispatch.status === "pending" ? "Mark Dispatched" : "Mark Delivered";
    openActionConfirmation({
      title: `${nextLabel}?`,
      message: `This will move dispatch item "${dispatch.item_name}" to the next delivery stage.`,
      confirmLabel: nextLabel,
      onConfirm: () => handleUpdateDispatchStatus(projectId, dispatch),
      subtext: `${dispatch.quantity} qty | ${dispatch.driver_name || "No driver"}`,
    });
  }

  async function handleSaveExpense(event) {
    event.preventDefault();
    const requiredErrors = validateRequiredFields(expenseForm, {
      expense_date: {
        message: "Expense date is required.",
        validate: (value) => Boolean(value),
      },
      amount: {
        message: "Amount is required.",
        validate: (value) => normalizeText(value) !== "",
      },
    });
    setExpenseFormErrors(requiredErrors);
    if (Object.keys(requiredErrors).length) {
      setError("");
      focusFirstInvalidField(event.currentTarget, requiredErrors);
      return;
    }

    const validationError = validateExpenseForm(expenseForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-expense", async () => {
      const payload = {
        ...expenseForm,
        amount: Number(expenseForm.amount || 0),
      };

      if (editingExpenseId) {
        await api.updateExpense(editingExpenseId, payload);
      } else {
        await api.createExpense(payload);
      }

      setExpenseForm(emptyExpense);
      setExpenseFormErrors({});
      setEditingExpenseId(null);
      await loadDashboard();
    }, editingExpenseId ? "Expense updated." : "Expense saved.");
  }

  const fetchPurchaseProductIntelligence = useCallback(
    async (productId) => {
      const normalizedProductId = Number(productId || 0);

      if (!normalizedProductId) {
        return null;
      }

      if (purchaseIntelligenceCache[normalizedProductId]) {
        return purchaseIntelligenceCache[normalizedProductId];
      }

      if (purchaseIntelligenceLoading[normalizedProductId]) {
        return null;
      }

      setPurchaseIntelligenceLoading((current) => ({ ...current, [normalizedProductId]: true }));

      try {
        const data = await api.getPurchaseProductIntelligence(normalizedProductId);
        setPurchaseIntelligenceCache((current) => ({ ...current, [normalizedProductId]: data }));
        return data;
      } catch (error) {
        return null;
      } finally {
        setPurchaseIntelligenceLoading((current) => ({ ...current, [normalizedProductId]: false }));
      }
    },
    [purchaseIntelligenceCache, purchaseIntelligenceLoading]
  );

  const fetchLinkedPurchaseBills = useCallback(
    async (truckNumber, deliveryDate) => {
      const normalizedTruck = String(truckNumber || "").trim();
      const normalizedDate = String(deliveryDate || "").trim();

      if (!normalizedTruck || !normalizedDate) {
        setLinkedPurchaseBills([]);
        return [];
      }

      setLinkedPurchaseBillsLoading(true);
      try {
        const data = await api.getPurchasesByTruck({
          truck_number: normalizedTruck,
          delivery_date: normalizedDate,
        });
        const bills = Array.isArray(data?.bills) ? data.bills : [];
        setLinkedPurchaseBills(bills);
        return bills;
      } catch (error) {
        setLinkedPurchaseBills([]);
        return [];
      } finally {
        setLinkedPurchaseBillsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (editingPurchaseLotId) {
      return;
    }

    const truckNumber = String(purchaseCostingForm.lot_number || "").trim();
    const deliveryDate = String(purchaseCostingForm.arrival_date || "").trim();

    if (!truckNumber || !deliveryDate) {
      setLinkedPurchaseBills([]);
      return;
    }

    let cancelled = false;
    fetchLinkedPurchaseBills(truckNumber, deliveryDate).then((bills) => {
      if (cancelled) {
        return;
      }

      const nextSuppliers = (bills || []).map((bill) => ({
        ...emptyPurchaseLotSupplier,
        supplier_name: bill.supplier_name || "",
        supplier_invoice_number: bill.invoice_number || "",
        supplier_invoice_date: bill.purchase_date ? String(bill.purchase_date).slice(0, 10) : deliveryDate,
        supplier_amount: String(Number(bill.total_amount || 0)),
        items: (bill.items || []).map((item) => ({
          ...emptyPurchaseLotItem,
          product_id: item.product_id ? String(item.product_id) : "",
          item_name: item.item_name || "",
          company_name: item.company_name || "",
          product_size: item.product_size || "",
          category: item.category || "tiles",
          quantity: item.quantity != null ? String(item.quantity) : "",
          unit: item.unit || "pcs",
          boxes: item.unit && String(item.unit).toLowerCase().includes("box") ? String(item.quantity || "") : "",
          pieces_per_box: item.pieces_per_box != null && item.pieces_per_box !== "" ? String(item.pieces_per_box) : "",
          sqft_per_box: item.sqft_per_box != null && item.sqft_per_box !== "" ? String(item.sqft_per_box) : "",
          weight_per_box: item.weight_per_box != null && item.weight_per_box !== "" ? String(item.weight_per_box) : "",
          weight_per_unit: item.weight_per_unit != null && item.weight_per_unit !== "" ? String(item.weight_per_unit) : "",
          basic_purchase_rate: Number(item.quantity || 0) > 0 ? String(Number(item.amount || 0) / Number(item.quantity || 1)) : String(item.last_purchase_rate || ""),
          damage_quantity: "",
          manual_allocation_value: "",
        })) || [{ ...emptyPurchaseLotItem }],
      }));

      setPurchaseCostingForm((current) => ({
        ...current,
        suppliers: nextSuppliers.length ? nextSuppliers : [{ ...emptyPurchaseLotSupplier, items: [{ ...emptyPurchaseLotItem }] }],
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [editingPurchaseLotId, fetchLinkedPurchaseBills, purchaseCostingForm.arrival_date, purchaseCostingForm.lot_number]);

  function updatePurchaseItem(index, patch) {
    setPurchaseItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }

  function addPurchaseItemRow() {
    setPurchaseItems((current) => [...current, { ...emptyPurchaseItem, unit: purchaseForm.business_unit === "tiles" ? "box" : "pcs" }]);
  }

  function removePurchaseItemRow(index) {
    setPurchaseItems((current) => (current.length <= 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
    clearFieldErrorState(setPurchaseFormErrors, `items.${index}.product_id`);
    clearFieldErrorState(setPurchaseFormErrors, `items.${index}.quantity`);
    clearFieldErrorState(setPurchaseFormErrors, `items.${index}.amount`);
  }

  function handlePurchaseProductSelect(index, productIdValue) {
    const product = purchaseEntryProductOptions.find((item) => item.id === Number(productIdValue || 0)) || null;
    const nextRate = product?.last_purchase_rate ? String(product.last_purchase_rate) : "";
    const currentRow = purchaseItems[index] || emptyPurchaseItem;
    const quantity = Number(currentRow.quantity || 0);
    const autoAmount = recalcPurchaseNetFromRate(quantity, nextRate);
    const nextBatchNo =
      normalizeText(currentRow.batch_no) ||
      (product ? buildPurchaseBatchSuggestion(product, purchaseForm.purchase_date, index) : "");

    updatePurchaseItem(index, {
      product_id: productIdValue,
      item_name: product?.name || currentRow.item_name,
      category: product?.category || currentRow.category,
      unit: product?.unit || currentRow.unit,
      batch_no: nextBatchNo,
      rate_per_unit: nextRate,
      amount: autoAmount != null ? String(autoAmount) : currentRow.amount,
    });

    if (product?.business_unit) {
      setPurchaseForm((current) => ({
        ...current,
        business_unit: product.business_unit || current.business_unit || "tiles",
      }));
    }

    if (productIdValue) {
      fetchPurchaseProductIntelligence(productIdValue);
    }
  }

  async function handleQuickAddProduct(event, rowIndex) {
    event.preventDefault();
    if (quickProductSaving) return;
    const name = String(quickProductForm.name || "").trim();
    const category = String(quickProductForm.category || "").trim();
    const unit = String(quickProductForm.unit || "").trim();
    const designCode = String(quickProductForm.design_code || "").trim();
    const finish = String(quickProductForm.finish || "").trim();
    const stockRaw = quickProductForm.stock_sqft;
    const stockTrim = typeof stockRaw === "string" ? stockRaw.trim() : stockRaw;
    const stockNum = Number(stockTrim);
    if (!name) { setError("Product name is required"); return; }
    if (!category) { setError("Category is required"); return; }
    if (!unit) { setError("Unit is required"); return; }
    if (!designCode) { setError("Design code is required"); return; }
    if (!finish) { setError("Finish is required"); return; }
    if (stockTrim === "" || stockTrim === null || stockTrim === undefined || Number.isNaN(stockNum) || stockNum < 0) {
      setError("Current stock is required (0 allowed if entered)");
      return;
    }
    setQuickProductSaving(true);
    try {
      const created = await api.createProduct({
        name,
        category,
        unit,
        business_unit: "tiles",
        stock_sqft: stockNum,
        design_code: designCode,
        company_name: quickProductForm.company_name || "",
        product_size: quickProductForm.product_size || "",
        finish,
        pieces_per_box: Number(quickProductForm.pieces_per_box || 0),
        sqft_per_box: Number(quickProductForm.sqft_per_box || 0),
        weight_per_box: Number(quickProductForm.weight_per_box || 0),
        status: "active",
      });
      const inventoryData = await api.getInventory({ limit: 500 }).catch(() => ({ products: [] }));
      if (Array.isArray(inventoryData?.products)) setProducts(inventoryData.products);
      if (typeof rowIndex === "number" && created?.id != null) {
        handlePurchaseProductSelect(rowIndex, String(created.id));
      }
      setQuickProductRowIndex(null);
      setQuickProductForm(emptyQuickProduct);
      pushToast("Product added.");
    } catch (err) {
      setError(err?.message || "Unable to create product");
    } finally {
      setQuickProductSaving(false);
    }
  }

  async function handlePurchaseSupplierLookup() {
    const supplier = String(purchaseForm.supplier_name || "").trim();
    if (!supplier || supplier.length < 3) {
      setPurchaseSupplierHistory(null);
      return;
    }
    try {
      const data = await api.getPurchases({ search: supplier, limit: 5 });
      const matches = Array.isArray(data?.purchases) ? data.purchases : [];
      const exact = matches.find(
        (row) => String(row.supplier_name || "").trim().toLowerCase() === supplier.toLowerCase()
      );
      const last = exact || matches[0] || null;
      if (last) {
        setPurchaseSupplierHistory({
          supplier_name: last.supplier_name,
          supplier_phone: last.supplier_phone || "",
          last_invoice: last.invoice_number || "",
          last_date: last.purchase_date,
          last_item: last.item_name || "",
          last_amount: last.amount,
          count: matches.length,
        });
        // Auto-fill phone if empty
        if (!purchaseForm.supplier_phone && last.supplier_phone) {
          setPurchaseForm((current) =>
            current.supplier_phone ? current : { ...current, supplier_phone: last.supplier_phone }
          );
        }
      } else {
        setPurchaseSupplierHistory({ supplier_name: supplier, isNew: true });
      }
    } catch (_err) {
      // Best-effort helper - do not block save flow if lookup fails.
      setPurchaseSupplierHistory(null);
    }
  }

  function recalcPurchaseNetFromRate(qty, rate) {
    const q = Number(qty || 0);
    const r = Number(rate || 0);
    if (!Number.isFinite(q) || !Number.isFinite(r) || q <= 0 || r <= 0) return null;
    return Number((q * r).toFixed(2));
  }

  async function loadSuppliers() {
    try {
      const list = await api.getSuppliers({ status: "active", limit: 500 });
      setSuppliers(Array.isArray(list) ? list : []);
    } catch (_err) {
      // soft-fail: empty list still allows quick-add
    }
  }

  function handleSupplierSelect(supplierIdValue) {
    const id = Number(supplierIdValue || 0);
    const supplier = safeSuppliers.find((s) => s.id === id) || null;
    setPurchaseForm((current) => ({
      ...current,
      supplier_id: supplierIdValue,
      supplier_name: supplier?.name || "",
      supplier_phone: supplier?.mobile || "",
    }));
  }

  async function handleQuickAddSupplier(event) {
    event.preventDefault();
    if (supplierQuickSaving) return;
    const name = String(supplierQuickForm.name || "").trim();
    const mobile = String(supplierQuickForm.mobile || "").trim();
    if (!name || !mobile) {
      setError("Supplier name and mobile are required");
      return;
    }
    setSupplierQuickSaving(true);
    try {
      const created = await api.createSupplier({
        name,
        mobile,
        city: supplierQuickForm.city,
        gstin: supplierQuickForm.gstin,
        category: supplierQuickForm.category || "general",
        status: "active",
      });
      setSuppliers((prev) => [created, ...prev]);
      // Auto-select the freshly created supplier
      setPurchaseForm((current) => ({
        ...current,
        supplier_id: String(created.id),
        supplier_name: created.name,
        supplier_phone: created.mobile || "",
      }));
      setSupplierQuickAddOpen(false);
      setSupplierQuickForm({ name: "", mobile: "", city: "", gstin: "", category: "general" });
      pushToast("Supplier registered.");
    } catch (err) {
      setError(err?.message || "Unable to create supplier");
    } finally {
      setSupplierQuickSaving(false);
    }
  }

  function handleEditPurchase(record) {
    setEditingPurchaseId(record.id);
    setPurchaseFormErrors({});
    const matchedProduct =
      safeProducts.find(
        (product) =>
          String(product.name || "").trim().toLowerCase() ===
          String(record.item_name || "").trim().toLowerCase()
      ) || null;
    setPurchaseForm({
      supplier_id: record.supplier_id ? String(record.supplier_id) : "",
      supplier_name: record.supplier_name || "",
      supplier_phone: record.supplier_phone || "",
      invoice_number: record.invoice_number || "",
      purchase_date: record.purchase_date ? String(record.purchase_date).slice(0, 10) : "",
      truck_number: record.truck_number || "",
      delivery_date: record.delivery_date ? String(record.delivery_date).slice(0, 10) : "",
      business_unit: record.business_unit || "tiles",
      payment_status: record.payment_status || "pending",
      remarks: record.remarks || "",
    });
    setPurchaseItems([
      {
        ...emptyPurchaseItem,
        product_id: matchedProduct ? String(matchedProduct.id) : "",
        item_name: record.item_name || "",
        category: record.category || "tiles",
        quantity: record.quantity != null ? String(record.quantity) : "",
        unit: record.unit || "pcs",
        batch_no: record.batch_no || "",
        amount: record.amount != null ? String(record.amount) : "",
        gst_amount: record.gst_amount != null ? String(record.gst_amount) : "",
        total_amount: record.total_amount != null ? String(record.total_amount) : "",
        rate_per_unit:
          record.quantity && Number(record.quantity) > 0
            ? String(Number((Number(record.amount || 0) / Number(record.quantity)).toFixed(2)))
            : matchedProduct?.last_purchase_rate
              ? String(matchedProduct.last_purchase_rate)
              : "",
      },
    ]);

    if (matchedProduct) {
      fetchPurchaseProductIntelligence(matchedProduct.id);
    }
  }

  function handleCancelEditPurchase() {
    setEditingPurchaseId(null);
    setPurchaseForm({ ...emptyPurchase, purchase_date: new Date().toISOString().slice(0, 10) });
    setPurchaseItems([{ ...emptyPurchaseItem }]);
    setPurchaseFormErrors({});
    setPurchaseSupplierHistory(null);
    setLinkedPurchaseBills([]);
  }

  function togglePurchaseInvoiceGroup(groupKey) {
    setExpandedPurchaseInvoiceGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }

  async function handleSavePurchase(event) {
    event.preventDefault();
    const requiredErrors = validateRequiredFields(purchaseForm, {
      supplier_id: {
        message: "Registered supplier is required.",
        validate: (value) => Boolean(value),
      },
      invoice_number: {
        message: "Invoice number is required.",
        validate: (value) => Boolean(normalizeText(value)),
      },
      purchase_date: {
        message: "Purchase date is required.",
        validate: (value) => Boolean(value),
      },
      truck_number: {
        message: "Truck number is required.",
        validate: (value) => Boolean(normalizeText(value)),
      },
      delivery_date: {
        message: "Delivery date is required.",
        validate: (value) => Boolean(value),
      },
    });
    if (!Array.isArray(purchaseItems) || purchaseItems.length === 0) {
      requiredErrors.items = "At least one product row is required.";
    } else {
      purchaseItems.forEach((item, index) => {
        if (!item.product_id) {
          requiredErrors[`items.${index}.product_id`] = "Inventory product is required.";
        }
        if (normalizeText(item.quantity) === "") {
          requiredErrors[`items.${index}.quantity`] = "Quantity is required.";
        }
        if (!normalizeText(item.unit)) {
          requiredErrors[`items.${index}.unit`] = "Unit is required.";
        }
        if (!editingPurchaseId && item.product_id && !normalizeText(item.batch_no)) {
          requiredErrors[`items.${index}.batch_no`] = "Batch / lot is required for new purchase rows.";
        }
        if (normalizeText(item.amount) === "" && normalizeText(item.rate_per_unit) === "") {
          requiredErrors[`items.${index}.amount`] = "Rate or net amount is required.";
        }
      });
    }
    setPurchaseFormErrors(requiredErrors);
    if (Object.keys(requiredErrors).length) {
      setError("");
      focusFirstInvalidField(event.currentTarget, requiredErrors);
      return;
    }

    const firstItem = purchaseItems[0] || emptyPurchaseItem;
    const validationError = validatePurchaseForm({
      ...purchaseForm,
      item_name: firstItem.item_name,
      quantity: firstItem.quantity,
      amount: firstItem.amount,
      gst_amount: firstItem.gst_amount,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-purchase", async () => {
      const postSaveAction = purchasePostSaveActionRef.current || "draft";
      const selectedSupplier = safeSuppliers.find((supplier) => String(supplier.id) === String(purchaseForm.supplier_id || "")) || null;
      const firstProductRow = purchaseItems[0] || emptyPurchaseItem;
      const firstSelectedProduct =
        firstProductRow.product_id
          ? purchaseEntryProductMap.get(Number(firstProductRow.product_id)) || null
          : null;
      try {
        if (editingPurchaseId) {
          const row = purchaseItems[0] || emptyPurchaseItem;
          const amount = Number(row.amount || 0);
          const gst = Number(row.gst_amount || 0);
          const computedTotal = amount + gst;
          const payload = {
            ...purchaseForm,
            supplier_id: Number(purchaseForm.supplier_id || 0),
            product_id: Number(row.product_id || 0),
            item_name: row.item_name,
            category: row.category,
            purchase_date: purchaseForm.purchase_date || new Date().toISOString().slice(0, 10),
            truck_number: purchaseForm.truck_number || "",
            delivery_date: purchaseForm.delivery_date || null,
            quantity: Number(row.quantity || 0),
            unit: row.unit || "pcs",
            batch_no: normalizeText(row.batch_no),
            amount,
            gst_amount: gst,
            total_amount: row.total_amount === "" ? computedTotal : Number(row.total_amount),
          };
          await api.updatePurchase(editingPurchaseId, payload);
        } else {
          for (const row of purchaseItems) {
            const amount = Number(row.amount || 0);
            const gst = Number(row.gst_amount || 0);
            const computedTotal = amount + gst;
            const payload = {
              ...purchaseForm,
              supplier_id: Number(purchaseForm.supplier_id || 0),
              product_id: Number(row.product_id || 0),
              item_name: row.item_name,
              category: row.category,
              purchase_date: purchaseForm.purchase_date || new Date().toISOString().slice(0, 10),
              truck_number: purchaseForm.truck_number || "",
              delivery_date: purchaseForm.delivery_date || null,
              quantity: Number(row.quantity || 0),
              unit: row.unit || "pcs",
              batch_no: normalizeText(row.batch_no),
              amount,
              gst_amount: gst,
              total_amount: row.total_amount === "" ? computedTotal : Number(row.total_amount),
            };
            await api.createPurchase(payload);
          }
        }
      } catch (err) {
        if (err && err.status === 409) {
          setError(err.message || "Duplicate purchase entry");
          return;
        }
        throw err;
      }

      if (postSaveAction === "approval") {
        setPurchaseCostingForm((current) => {
          const currentSupplier = (current.suppliers || [])[0] || { ...emptyPurchaseLotSupplier, items: [{ ...emptyPurchaseLotItem }] };
          const currentItem = (currentSupplier.items || [])[0] || { ...emptyPurchaseLotItem };
          return {
            ...current,
            lot_number: purchaseForm.truck_number || current.lot_number,
            arrival_date: purchaseForm.delivery_date || purchaseForm.purchase_date || current.arrival_date,
            vehicle_number: current.vehicle_number || purchaseForm.truck_number || "",
            total_freight_cost: current.total_freight_cost || "",
            total_unloading_cost: current.total_unloading_cost || "",
            interest_cost_override: current.interest_cost_override || "",
            showroom_overhead_amount: current.showroom_overhead_amount || "",
            suppliers: [
              {
                ...currentSupplier,
                supplier_name: currentSupplier.supplier_name || selectedSupplier?.name || purchaseForm.supplier_name || "",
                supplier_invoice_number: currentSupplier.supplier_invoice_number || purchaseForm.invoice_number || "",
                supplier_invoice_date: currentSupplier.supplier_invoice_date || purchaseForm.purchase_date || current.arrival_date,
                items: [
                  {
                    ...currentItem,
                    product_id: currentItem.product_id || firstProductRow.product_id || "",
                    item_name: currentItem.item_name || firstSelectedProduct?.name || firstProductRow.item_name || "",
                    company_name: currentItem.company_name || firstSelectedProduct?.company_name || "",
                    product_size: currentItem.product_size || firstSelectedProduct?.product_size || "",
                    category: currentItem.category || firstSelectedProduct?.category || firstProductRow.category || "tiles",
                    quantity: currentItem.quantity || firstProductRow.quantity || "",
                    unit: currentItem.unit || firstSelectedProduct?.unit || firstProductRow.unit || "box",
                    basic_purchase_rate: currentItem.basic_purchase_rate || firstProductRow.rate_per_unit || "",
                    pieces_per_box: currentItem.pieces_per_box || firstSelectedProduct?.pieces_per_box || "",
                    sqft_per_box: currentItem.sqft_per_box || firstSelectedProduct?.sqft_per_box || "",
                    weight_per_box: currentItem.weight_per_box || firstSelectedProduct?.weight_per_box || "",
                    weight_per_unit: currentItem.weight_per_unit || firstSelectedProduct?.weight_per_unit || "",
                  },
                ],
              },
            ],
          };
        });
        setPurchaseWorkspaceTab("costing");
      }

      const shouldClearInvoiceHeader = editingPurchaseId || postSaveAction === "new";
      setPurchaseForm((current) => ({
        ...emptyPurchase,
        supplier_id: shouldClearInvoiceHeader ? "" : current.supplier_id,
        supplier_name: shouldClearInvoiceHeader ? "" : current.supplier_name,
        supplier_phone: shouldClearInvoiceHeader ? "" : current.supplier_phone,
        invoice_number: shouldClearInvoiceHeader ? "" : current.invoice_number,
        truck_number: shouldClearInvoiceHeader ? "" : current.truck_number || "",
        delivery_date: shouldClearInvoiceHeader ? "" : current.delivery_date || current.purchase_date || "",
        purchase_date: shouldClearInvoiceHeader
          ? new Date().toISOString().slice(0, 10)
          : current.purchase_date || new Date().toISOString().slice(0, 10),
        business_unit: shouldClearInvoiceHeader ? "tiles" : current.business_unit || "tiles",
        payment_status: shouldClearInvoiceHeader ? "pending" : current.payment_status || "pending",
        remarks: shouldClearInvoiceHeader ? "" : current.remarks || "",
      }));
      setPurchaseItems([{ ...emptyPurchaseItem }]);
      setPurchaseFormErrors({});
      setEditingPurchaseId(null);
      purchasePostSaveActionRef.current = "draft";
      await loadDashboard();
    }, editingPurchaseId ? "Purchase updated." : "Purchase saved.");
  }

  async function handleDeletePurchase(id) {
    if (!id) return;
    await runBusyAction(`delete-purchase-${id}`, async () => {
      await api.deletePurchase(id);
      if (editingPurchaseId === id) {
        setEditingPurchaseId(null);
        setPurchaseForm({ ...emptyPurchase, purchase_date: new Date().toISOString().slice(0, 10) });
        setPurchaseItems([{ ...emptyPurchaseItem }]);
        setLinkedPurchaseBills([]);
      }
      await loadDashboard();
    }, "Purchase deleted.");
  }

  function updatePurchaseCostingField(field, value) {
    setPurchaseCostingForm((current) => ({
      ...current,
      [field]: value,
    }));
    clearFieldErrorState(setPurchaseCostingFormErrors, field);
  }

  function updatePurchaseCostingSupplier(index, field, value) {
    setPurchaseCostingForm((current) => ({
      ...current,
      suppliers: (current.suppliers || []).map((supplier, supplierIndex) =>
        supplierIndex === index ? { ...supplier, [field]: value } : supplier
      ),
    }));
    clearFieldErrorState(setPurchaseCostingFormErrors, `suppliers.${index}.${field}`);
  }

  function updatePurchaseCostingItem(supplierIndex, itemIndex, field, value) {
    setPurchaseCostingForm((current) => ({
      ...current,
      suppliers: (current.suppliers || []).map((supplier, currentSupplierIndex) =>
        currentSupplierIndex === supplierIndex
          ? {
              ...supplier,
              items: (supplier.items || []).map((item, currentItemIndex) =>
                currentItemIndex === itemIndex ? { ...item, [field]: value } : item
              ),
            }
          : supplier
      ),
    }));
    clearFieldErrorState(setPurchaseCostingFormErrors, `suppliers.${supplierIndex}.items.${itemIndex}.${field}`);
  }

  function handlePurchaseCostingProductChange(supplierIndex, itemIndex, productIdValue) {
    const product =
      purchaseCostingProductOptions.find((item) => item.id === Number(productIdValue || 0)) || null;
    setPurchaseCostingForm((current) => ({
      ...current,
      suppliers: (current.suppliers || []).map((supplier, currentSupplierIndex) =>
        currentSupplierIndex === supplierIndex
          ? {
              ...supplier,
              items: (supplier.items || []).map((item, currentItemIndex) =>
                currentItemIndex === itemIndex
                  ? {
                      ...item,
                      product_id: productIdValue,
                      item_name: product?.name || item.item_name,
                      company_name: product?.company_name || item.company_name,
                      product_size: product?.product_size || product?.tile_size || item.product_size,
                      category: product?.category || item.category,
                      unit: product?.unit || item.unit,
                      pieces_per_box:
                        product?.pieces_per_box != null && product.pieces_per_box !== ""
                          ? String(product.pieces_per_box)
                          : item.pieces_per_box,
                      sqft_per_box:
                        product?.sqft_per_box != null && product.sqft_per_box !== ""
                          ? String(product.sqft_per_box)
                          : item.sqft_per_box,
                      weight_per_box:
                        product?.weight_per_box != null && product.weight_per_box !== ""
                          ? String(product.weight_per_box)
                          : item.weight_per_box,
                      weight_per_unit:
                        product?.weight_per_unit != null && product.weight_per_unit !== ""
                          ? String(product.weight_per_unit)
                          : item.weight_per_unit,
                      basic_purchase_rate:
                        product?.last_purchase_rate != null && product.last_purchase_rate !== ""
                          ? String(product.last_purchase_rate)
                          : item.basic_purchase_rate,
                    }
                  : item
              ),
            }
          : supplier
      ),
    }));
    clearFieldErrorState(setPurchaseCostingFormErrors, `suppliers.${supplierIndex}.items.${itemIndex}.item_name`);
  }

  function addPurchaseCostingSupplier() {
    setPurchaseCostingForm((current) => ({
      ...current,
      suppliers: [...(current.suppliers || []), { ...emptyPurchaseLotSupplier, items: [{ ...emptyPurchaseLotItem }] }],
    }));
  }

  function removePurchaseCostingSupplier(index) {
    setPurchaseCostingForm((current) => {
      const nextSuppliers = (current.suppliers || []).filter((_, supplierIndex) => supplierIndex !== index);
      return {
        ...current,
        suppliers: nextSuppliers.length
          ? nextSuppliers
          : [{ ...emptyPurchaseLotSupplier, items: [{ ...emptyPurchaseLotItem }] }],
      };
    });
  }

  function addPurchaseCostingItem(supplierIndex) {
    setPurchaseCostingForm((current) => ({
      ...current,
      suppliers: (current.suppliers || []).map((supplier, currentSupplierIndex) =>
        currentSupplierIndex === supplierIndex
          ? {
              ...supplier,
              items: [...(supplier.items || []), { ...emptyPurchaseLotItem }],
            }
          : supplier
      ),
    }));
  }

  function removePurchaseCostingItem(supplierIndex, itemIndex) {
    setPurchaseCostingForm((current) => ({
      ...current,
      suppliers: (current.suppliers || []).map((supplier, currentSupplierIndex) => {
        if (currentSupplierIndex !== supplierIndex) {
          return supplier;
        }

        const nextItems = (supplier.items || []).filter((_, currentItemIndex) => currentItemIndex !== itemIndex);
        return {
          ...supplier,
          items: nextItems.length ? nextItems : [{ ...emptyPurchaseLotItem }],
        };
      }),
    }));
  }

  async function handleOpenPurchaseLotDetail(lotId) {
    if (!lotId) {
      return;
    }

    await runBusyAction("load-purchase-lot-detail", async () => {
      const detail = await api.getPurchaseCostingLotDetail(lotId);
      setSelectedPurchaseLot(detail || null);
    });
  }

  async function startEditingPurchaseCostingLot(lot) {
    if (!lot?.id) {
      return;
    }

    await runBusyAction("edit-purchase-lot", async () => {
      const detail = await api.getPurchaseCostingLotDetail(lot.id);
      setEditingPurchaseLotId(lot.id);
      setPurchaseCostingForm(mapPurchaseLotToForm(detail || lot));
      setPurchaseCostingFormErrors({});
      setSelectedPurchaseLot(detail || lot);
    });
  }

  function handleCancelPurchaseCostingEdit() {
    setEditingPurchaseLotId(null);
    setPurchaseCostingForm(emptyPurchaseLot);
    setPurchaseCostingFormErrors({});
  }

  async function handleSavePurchaseCostingLot(event) {
    event.preventDefault();

    const requiredErrors = {
      ...validateRequiredFields(purchaseCostingForm, {
        lot_number: "Lot / truck number is required.",
        arrival_date: "Arrival date is required.",
      }),
    };

    (purchaseCostingForm.suppliers || []).forEach((supplier, supplierIndex) => {
      if (!normalizeText(supplier.supplier_name)) {
        requiredErrors[`suppliers.${supplierIndex}.supplier_name`] = "Supplier name is required.";
      }

      (supplier.items || []).forEach((item, itemIndex) => {
        if (!normalizeText(item.item_name) && !item.product_id) {
          requiredErrors[`suppliers.${supplierIndex}.items.${itemIndex}.item_name`] = "Product / item is required.";
        }
      });
    });

    setPurchaseCostingFormErrors(requiredErrors);
    if (Object.keys(requiredErrors).length) {
      setError("");
      focusFirstInvalidField(event.currentTarget, requiredErrors);
      return;
    }

    await runBusyAction("save-purchase-costing", async () => {
      const payload = normalizePurchaseCostingPayload(purchaseCostingForm);
      const detail = editingPurchaseLotId
        ? await api.updatePurchaseCostingLot(editingPurchaseLotId, payload)
        : await api.createPurchaseCostingLot(payload);

      setPurchaseCostingForm(emptyPurchaseLot);
      setPurchaseCostingFormErrors({});
      setEditingPurchaseLotId(null);
      setSelectedPurchaseLot(detail || null);
      await loadDashboard({ forceView: "purchase_costing" });
    }, editingPurchaseLotId ? "Purchase lot updated." : "Purchase lot saved.");
  }

  async function handleApprovePurchaseLot(lot) {
    if (!lot?.id) {
      return;
    }

    await runBusyAction("approve-purchase-costing", async () => {
      const detail = await api.approvePurchaseCostingLot(lot.id, { approval_note: "Approved from CRM" });
      setSelectedPurchaseLot(detail || null);
      await loadDashboard({ forceView: "purchase_costing" });
    }, "Purchase lot approved and stock updated.");
  }

  async function handleCancelPurchaseLot(lot) {
    if (!lot?.id) {
      return;
    }

    await runBusyAction("cancel-purchase-costing", async () => {
      const detail = await api.cancelPurchaseCostingLot(lot.id, { cancel_note: "Cancelled from CRM" });
      setSelectedPurchaseLot(detail || null);
      await loadDashboard({ forceView: "purchase_costing" });
    }, "Purchase lot cancelled.");
  }

  function handleBillingLeadReferenceChange(leadIdValue) {
    const lead = billingReferenceOptions.leads.find((item) => item.id === Number(leadIdValue || 0)) || null;
    setInvoiceForm((current) => ({
      ...clearSystemDiscountFromInvoice(current),
      lead_id: leadIdValue,
      customer_name: lead?.name || current.customer_name,
      customer_mobile: lead?.phone || current.customer_mobile,
      customer_address: lead?.location || current.customer_address,
      site_reference: current.site_reference || lead?.location || "",
    }));
  }

  function handleBillingQuotationReferenceChange(quotationIdValue) {
    const quotation = billingReferenceOptions.quotations.find((item) => item.id === Number(quotationIdValue || 0)) || null;
    setInvoiceForm((current) => ({
      ...clearSystemDiscountFromInvoice(current),
      quotation_id: quotationIdValue,
      lead_id: quotation?.lead_id ? String(quotation.lead_id) : current.lead_id,
      customer_name: quotation?.lead_name || current.customer_name,
      customer_mobile: quotation?.lead_phone || current.customer_mobile,
    }));
  }

  function handleBillingProjectReferenceChange(projectIdValue) {
    const project = billingReferenceOptions.projects.find((item) => item.id === Number(projectIdValue || 0)) || null;
    setInvoiceForm((current) => ({
      ...clearSystemDiscountFromInvoice(current),
      project_id: projectIdValue,
      lead_id: project?.lead_id ? String(project.lead_id) : current.lead_id,
      site_reference: project?.project_name || current.site_reference,
    }));
  }

  function handleBillingInvoiceItemChange(index, field, value) {
    setInvoiceForm((current) => {
      const normalized = clearSystemDiscountFromInvoice(current);
      return {
        ...normalized,
        items: (normalized.items || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
        ),
      };
    });
    clearFieldErrorState(setInvoiceFormErrors, `items.${index}.${field}`);
  }

  function handleBillingInventoryProductChange(index, productIdValue) {
    const product = billingReferenceOptions.products.find((item) => item.id === Number(productIdValue || 0)) || null;
    const effectiveTodayRate = product ? getProductTodaySellingRate(product) : 0;
    setInvoiceForm((current) => {
      const normalized = clearSystemDiscountFromInvoice(current);
      return {
      ...normalized,
      items: (normalized.items || []).map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              product_id: productIdValue,
              product_name: product?.name || item.product_name,
              item_type:
                product?.category === "adhesive"
                  ? "adhesive"
                  : product?.category === "plumbing"
                    ? "plumbing"
                    : product?.category === "sanitary"
                      ? "sanitary"
                      : "tiles",
              unit: product?.unit || item.unit || "pcs",
              suggested_rate:
                effectiveTodayRate > 0
                  ? String(effectiveTodayRate)
                  : product?.suggested_selling_rate != null && product.suggested_selling_rate !== ""
                    ? String(product.suggested_selling_rate)
                  : item.suggested_rate,
              minimum_allowed_rate:
                product?.minimum_allowed_rate != null && product.minimum_allowed_rate !== ""
                  ? String(product.minimum_allowed_rate)
                  : item.minimum_allowed_rate,
              rate:
                effectiveTodayRate > 0
                  ? String(effectiveTodayRate)
                  : product?.suggested_selling_rate != null && product.suggested_selling_rate !== ""
                    ? String(product.suggested_selling_rate)
                  : product?.price_per_sqft != null && product.price_per_sqft !== ""
                    ? String(product.price_per_sqft)
                  : item.rate,
            }
          : item
      ),
    };
    });
    clearFieldErrorState(setInvoiceFormErrors, `items.${index}.product_id`);
  }

  function addBillingInvoiceItem() {
    setInvoiceForm((current) => {
      const normalized = clearSystemDiscountFromInvoice(current);
      return {
        ...normalized,
        items: [...(normalized.items || []), { ...emptyInvoiceItem }],
      };
    });
  }

  function removeBillingInvoiceItem(index) {
    setInvoiceForm((current) => {
      const normalized = clearSystemDiscountFromInvoice(current);
      const nextItems = (normalized.items || []).filter((_, itemIndex) => itemIndex !== index);
      return {
        ...normalized,
        items: nextItems.length ? nextItems : [{ ...emptyInvoiceItem }],
      };
    });
  }

  async function handleOpenBillingInvoiceDetail(invoiceId) {
    if (!invoiceId) {
      return;
    }

    await runBusyAction("load-billing-detail", async () => {
      const detail = await api.getBillingInvoiceDetail(invoiceId);
      setSelectedInvoice(detail || null);
    });
  }

  async function startEditingBillingInvoice(invoice) {
    if (!invoice?.id) {
      return;
    }

    await runBusyAction("edit-billing-invoice", async () => {
      const detail = invoice.items ? invoice : await api.getBillingInvoiceDetail(invoice.id);
      setEditingInvoiceId(detail.id);
      setInvoiceFormErrors({});
      setInvoiceForm(mapInvoiceToForm(detail));
      setSelectedInvoice(detail);
    });
  }

  function handleCancelBillingEdit() {
    setEditingInvoiceId(null);
    setInvoiceForm(emptyInvoice);
    setInvoiceFormErrors({});
  }

  async function handleSaveBillingInvoice(event) {
    event.preventDefault();
    const requiredErrors = getBillingInvoiceRequiredErrors(invoiceForm);
    setInvoiceFormErrors(requiredErrors);
    if (Object.keys(requiredErrors).length) {
      setError("");
      focusFirstInvalidField(event.currentTarget, requiredErrors);
      return;
    }

    const validationError = validateBillingForm(invoiceForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    let savedDetail = null;
    const didSave = await runBusyAction("save-billing-invoice", async () => {
      const payload = normalizeBillingInvoicePayload(invoiceForm);
      const detail = editingInvoiceId
        ? await api.updateBillingInvoice(editingInvoiceId, payload)
        : await api.createBillingInvoice(payload);
      savedDetail = detail || null;

      setInvoiceForm(emptyInvoice);
      setInvoiceFormErrors({});
      setEditingInvoiceId(null);
      setSelectedInvoice(detail || null);
      await loadDashboard({ forceView: "billing" });
    }, editingInvoiceId ? "Invoice updated." : "Invoice saved.");

    return didSave ? savedDetail : null;
  }

  function requestSubmitBillingInvoiceApproval(invoice) {
    openActionConfirmation({
      title: "Submit invoice for approval?",
      message: `This will submit invoice ${invoice.invoice_number} for manager approval.`,
      confirmLabel: "Submit Approval",
      onConfirm: () => handleSubmitBillingInvoiceApproval(invoice),
      subtext: `${invoice.customer_name || "Walk-in customer"} | Rs ${invoice.grand_total || 0}`,
    });
  }

  async function handleSubmitBillingInvoiceApproval(invoice) {
    await runBusyAction("submit-billing-approval", async () => {
      const detail = await api.submitBillingInvoiceApproval(invoice.id, { note: "Submitted from billing module." });
      setSelectedInvoice(detail || null);
      await loadDashboard({ forceView: "billing" });
    }, "Invoice submitted for approval.");
  }

  function requestReviewBillingInvoice(invoice, action) {
    const isApprove = action === "approved";
    openActionConfirmation({
      title: isApprove ? "Approve invoice?" : "Reject invoice?",
      message: isApprove
        ? `This will approve invoice ${invoice.invoice_number}.`
        : `This will reject invoice ${invoice.invoice_number}.`,
      confirmLabel: isApprove ? "Approve Invoice" : "Reject Invoice",
      tone: isApprove ? "secondary" : "danger",
      onConfirm: () => handleReviewBillingInvoice(invoice, action),
      subtext: `${invoice.customer_name || "Walk-in customer"} | ${labelize(invoice.status)}`,
    });
  }

  async function handleReviewBillingInvoice(invoice, action) {
    await runBusyAction(`review-billing-${action}`, async () => {
      const detail = await api.reviewBillingInvoiceApproval(invoice.id, {
        action,
        note: action === "approved" ? "Approved from billing control." : "Rejected from billing control.",
      });
      setSelectedInvoice(detail || null);
      await loadDashboard({ forceView: "billing" });
    }, action === "approved" ? "Invoice approved." : "Invoice rejected.");
  }

  function requestCancelBillingInvoice(invoice) {
    openActionConfirmation({
      title: "Cancel invoice?",
      message: `This will cancel invoice ${invoice.invoice_number} or send it for cancellation approval based on your access.`,
      confirmLabel: "Cancel Invoice",
      tone: "danger",
      onConfirm: () => handleCancelBillingInvoice(invoice),
      subtext: `${invoice.customer_name || "Walk-in customer"} | Rs ${invoice.grand_total || 0}`,
    });
  }

  async function handleCancelBillingInvoice(invoice) {
    await runBusyAction("cancel-billing-invoice", async () => {
      const detail = await api.cancelBillingInvoice(invoice.id, { note: "Cancellation requested from billing module." });
      setSelectedInvoice(detail || null);
      await loadDashboard({ forceView: "billing" });
    }, "Invoice cancellation updated.");
  }

  function requestDeleteBillingInvoice(invoice) {
    openActionConfirmation({
      title: "Delete invoice permanently?",
      message: `This will permanently delete invoice ${invoice.invoice_number} and restore stock if it was applied.`,
      confirmLabel: "Delete Invoice",
      tone: "danger",
      onConfirm: () => handleDeleteBillingInvoice(invoice.id),
      subtext: `${invoice.customer_name || "Walk-in customer"} | ${invoice.invoice_number}`,
    });
  }

  async function handleDeleteBillingInvoice(invoiceId) {
    await runBusyAction("delete-billing-invoice", async () => {
      await api.deleteBillingInvoice(invoiceId);
      setSelectedInvoice((current) => (current?.id === invoiceId ? null : current));
      if (editingInvoiceId === invoiceId) {
        setEditingInvoiceId(null);
        setInvoiceForm(emptyInvoice);
        setInvoiceFormErrors({});
      }
      await loadDashboard({ forceView: "billing" });
    }, "Invoice deleted.");
  }

  async function handleSaveBillingPayment(event, invoiceOverride = null) {
    event.preventDefault();
    const targetInvoice = invoiceOverride || selectedInvoice;
    if (!targetInvoice?.id) {
      return;
    }

    const requiredErrors = validateRequiredFields(billingPaymentForm, {
      amount: {
        message: "Payment amount is required.",
        validate: (value) => normalizeText(value) !== "",
      },
    });
    if (Object.keys(requiredErrors).length) {
      setError(requiredErrors.amount || "Payment amount is required.");
      focusFirstInvalidField(event.currentTarget, requiredErrors);
      return;
    }

    let paymentDetail = null;
    const didSave = await runBusyAction("save-billing-payment", async () => {
      const detail = await api.addBillingPayment(targetInvoice.id, {
        amount: Number(billingPaymentForm.amount || 0),
        payment_mode: billingPaymentForm.payment_mode || "cash",
        note: normalizeText(billingPaymentForm.note),
      });
      paymentDetail = detail || null;
      setBillingPaymentForm(emptyBillingPayment);
      setSelectedInvoice(detail || null);
      await loadDashboard({ forceView: "billing" });
    }, "Payment recorded.");

    return didSave ? paymentDetail : null;
  }

  async function handleIssueSchemeToken(event) {
    event.preventDefault();
    const requiredErrors = getSchemeTokenRequiredErrors(schemeTokenForm);
    setSchemeTokenFormErrors(requiredErrors);
    if (Object.keys(requiredErrors).length) {
      setError("");
      focusFirstInvalidField(event.currentTarget, requiredErrors);
      return;
    }

    const validationError = validateSchemeTokenForm(schemeTokenForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!selectedRegisteredMason || String(selectedRegisteredMason.status || "").toLowerCase() !== "active") {
      setError("Mason is not active for token redemption.");
      return;
    }

    await runBusyAction("issue-token", async () => {
      const payload = normalizeSchemeTokenPayload(schemeTokenForm);
      const detail = editingAdhesiveTokenId
        ? await api.updateAdhesiveToken(editingAdhesiveTokenId, payload)
        : await api.createAdhesiveToken(payload);
      setSchemeTokenForm(emptySchemeToken);
      setSchemeTokenFormErrors({});
      setEditingAdhesiveTokenId(null);
      setSelectedAdhesiveToken(detail || null);
      await loadDashboard();
    }, editingAdhesiveTokenId ? "Adhesive token claim updated." : "Adhesive token claim saved.");
  }

  function handleAdhesiveProjectChange(projectIdValue) {
    const linkedProject = projects.find((project) => project.id === Number(projectIdValue || 0));
    setSchemeTokenForm((current) => ({
      ...current,
      project_id: projectIdValue,
      site_name:
        linkedProject?.project_name && !normalizeText(current.site_name)
          ? linkedProject.project_name
          : current.site_name,
      customer_name: linkedProject?.lead_name || current.customer_name,
    }));
  }

  function handleRegisteredMasonChange(masonIdValue) {
    const mason = masons.find((item) => item.id === Number(masonIdValue || 0)) || null;
    setSchemeTokenForm((current) => ({
      ...current,
      mason_id: masonIdValue,
      mason_mobile: mason?.mobile || "",
      mason_area: mason?.area || "",
      mason_current_address_city: mason?.current_address_city || "",
      mason_permanent_address_city: mason?.permanent_address_city || "",
      mason_working_areas: Array.isArray(mason?.working_areas) ? mason.working_areas : [],
      mason_working_distance_upto_km: mason?.working_distance_upto_km || "",
    }));
  }

  function addMasonWorkingArea() {
    const nextArea = normalizeText(masonWorkingAreaInput);
    if (!nextArea) {
      return;
    }

    setMasonForm((current) => ({
      ...current,
      working_areas: [...new Set([...(current.working_areas || []), nextArea])],
    }));
    setMasonWorkingAreaInput("");
    clearFieldErrorState(setMasonFormErrors, "working_areas");
  }

  function removeMasonWorkingArea(areaToRemove) {
    setMasonForm((current) => ({
      ...current,
      working_areas: (current.working_areas || []).filter((area) => area !== areaToRemove),
    }));
  }

  function handleAdhesiveTokenItemChange(index, field, value) {
    setSchemeTokenForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      ),
    }));
    clearFieldErrorState(setSchemeTokenFormErrors, `items.${index}.${field}`);
  }

  function addAdhesiveTokenItemRow() {
    setSchemeTokenForm((current) => ({
      ...current,
      items: [...(current.items || []), { token_value: 20, quantity: 1 }],
    }));
  }

  function removeAdhesiveTokenItemRow(index) {
    setSchemeTokenForm((current) => ({
      ...current,
      items:
        (current.items || []).length > 1
          ? current.items.filter((_, itemIndex) => itemIndex !== index)
          : current.items,
    }));
  }

  function handleVerifyAdhesiveInvoice() {
    const verification_status = getAdhesiveClaimPreviewStatus(schemeTokenForm, selectedAdhesiveProject);

    if (verification_status === "matched") {
      pushToast("Invoice and quantity preview matched.");
      return;
    }

    if (verification_status === "mismatch") {
      setError("Claimed bag quantity or optional customer match does not fit the linked project.");
      return;
    }

    pushToast(
      "Token claim can be created with Site + Mason + Invoice. Link a project and customer only when you want a matched verification preview."
    );
  }

  async function handleOpenAdhesiveTokenDetail(tokenId) {
    await runBusyAction("load-token-detail", async () => {
      const detail = await api.getAdhesiveTokenDetail(tokenId);
      setSelectedAdhesiveToken({
        ...(detail.token || {}),
        activities: detail.activities || [],
      });
    });
  }

  async function startEditingAdhesiveToken(token) {
    if (!canEditAdhesiveClaim(token)) {
      setError("Only non-approved pending claims can be edited.");
      return;
    }

    await runBusyAction("edit-token-claim", async () => {
      const detailResponse = await api.getAdhesiveTokenDetail(token.id);
      const detail = {
        ...(detailResponse.token || {}),
        activities: detailResponse.activities || [],
      };
      setSelectedAdhesiveToken(detail);
      setEditingAdhesiveTokenId(token.id);
      setSchemeTokenFormErrors({});
      setSchemeTokenForm(mapAdhesiveClaimToForm(detail));
      setCurrentView("schemes");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function requestDeleteAdhesiveToken(token) {
    openActionConfirmation({
      title: "Delete adhesive token claim?",
      message: `This will permanently delete the adhesive token claim for invoice ${token.invoice_number}.`,
      confirmLabel: "Delete Claim",
      tone: "danger",
      onConfirm: () => handleDeleteAdhesiveToken(token),
      subtext: `${token.site_name} | ${token.mason_name}`,
    });
  }

  function requestReopenAdhesiveToken(token) {
    openActionConfirmation({
      title: "Reopen approved claim?",
      message: `This will move the approved adhesive token claim for invoice ${token.invoice_number} back to correction mode.`,
      confirmLabel: "Reopen Claim",
      onConfirm: () => handleReopenAdhesiveToken(token),
      subtext: `${token.site_name} | ${token.mason_name}`,
    });
  }

  async function handleSaveComplaint(event) {
    event.preventDefault();
    if (isSavingComplaint) {
      return;
    }

    const validationError = validateComplaintForm(complaintForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSavingComplaint(true);

    try {
      const payload = normalizeComplaintPayload(complaintForm);

      if (editingComplaintId) {
        await api.updateComplaint(editingComplaintId, payload);
      } else {
        await api.createComplaint(payload);
      }

      setComplaintForm(emptyComplaint);
      setEditingComplaintId(null);
      await loadDashboard();
      pushToast(editingComplaintId ? "Complaint updated." : "Complaint saved.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSavingComplaint(false);
    }
  }

  async function markComplaintResolved(complaint) {
    await runBusyAction("resolve-complaint", async () => {
      await api.updateComplaint(complaint.id, {
        ...complaint,
        status: "resolved",
        resolution_note: complaint.resolution_note || "Resolved from CRM",
      });
      await loadDashboard();
    }, "Complaint resolved.");
  }

  async function handleDeleteComplaint(complaintId) {
    await runBusyAction("delete-complaint", async () => {
      await api.deleteComplaint(complaintId);
      if (editingComplaintId === complaintId) {
        setEditingComplaintId(null);
        setComplaintForm(emptyComplaint);
      }
      await loadDashboard();
    }, "Complaint deleted.");
  }

  async function confirmPendingDelete() {
    if (!pendingDelete) {
      return;
    }

    if (pendingDelete.type === "complaint") {
      await handleDeleteComplaint(pendingDelete.id);
    }

    if (pendingDelete.type === "lead") {
      await handleDeleteLead(pendingDelete.id);
    }

    if (pendingDelete.type === "product") {
      await handleDeleteProduct(pendingDelete.id);
    }

    if (pendingDelete.type === "dealer") {
      await handleDeleteDealer(pendingDelete.id);
    }

    if (pendingDelete.type === "expense") {
      await handleDeleteExpense(pendingDelete.id);
    }

    if (pendingDelete.type === "purchase") {
      await handleDeletePurchase(pendingDelete.id);
    }

    if (pendingDelete.type === "user") {
      await handleDeleteUser(pendingDelete.id);
    }

    if (pendingDelete.type === "daily-task") {
      await handleDeleteDailyTask(pendingDelete.id);
    }

    setPendingDelete(null);
  }

  async function confirmPendingAction() {
    if (!pendingAction?.onConfirm) {
      return;
    }

    try {
      await pendingAction.onConfirm();
    } finally {
      setPendingAction(null);
    }
  }

  async function createComplaintOperationsTask(complaint) {
    await runBusyAction("create-complaint-ops-task", async () => {
      await api.createComplaintOperationsTask(complaint.id);
      setCurrentView("operations");
    }, "Operations task created from complaint.");
  }

  async function handleMarkNotificationRead(notification) {
    await runBusyAction("mark-notification-read", async () => {
      await api.markNotificationRead(notification.id);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                read_at: item.read_at || new Date().toISOString(),
              }
            : item
        )
      );

      if (notification.link_type === "complaint") {
        setCurrentView("complaints");
      }

      if (notification.link_type === "operations_task") {
        setCurrentView("operations");
      }
    });
  }

  async function handleApproveAdhesiveToken(token) {
    await runBusyAction("approve-token-claim", async () => {
      const detail = await api.approveAdhesiveTokenClaim(token.id, {
        verification_status: "approved",
        remarks: "Approved from CRM",
      });
      if (selectedAdhesiveToken?.id === token.id) {
        setSelectedAdhesiveToken(detail);
      }
      await loadDashboard();
    }, "Adhesive token claim approved.");
  }

  async function handleVerifyAdhesiveTokenClaim(token) {
    await runBusyAction("verify-token-claim", async () => {
      const detail = await api.verifyAdhesiveTokenClaim(token.id);
      if (selectedAdhesiveToken?.id === token.id) {
        setSelectedAdhesiveToken(detail);
      }
      await loadDashboard();
    }, "Adhesive token claim verified.");
  }

  async function handleReopenAdhesiveToken(token) {
    await runBusyAction("reopen-token-claim", async () => {
      const detail = await api.reopenAdhesiveTokenClaim(token.id, {
        remarks: "Reopened for correction from CRM",
      });
      if (selectedAdhesiveToken?.id === token.id) {
        setSelectedAdhesiveToken(detail);
      }
      setEditingAdhesiveTokenId(token.id);
      setSchemeTokenForm(mapAdhesiveClaimToForm(detail));
      await loadDashboard();
    }, "Adhesive token claim reopened for correction.");
  }

  async function handleMarkAdhesiveTokenPaid(token) {
    await runBusyAction("redeem-token", async () => {
      const detail = await api.markAdhesiveTokenClaimPaid(token.id, {
        status: "paid",
        payment_date: new Date().toISOString().slice(0, 10),
        remarks: "Marked paid from CRM",
      });
      if (selectedAdhesiveToken?.id === token.id) {
        setSelectedAdhesiveToken(detail);
      }
      await loadDashboard();
    }, "Adhesive token claim marked paid.");
  }

  async function handleRejectAdhesiveToken(token) {
    await runBusyAction("cancel-token", async () => {
      const detail = await api.approveAdhesiveTokenClaim(token.id, {
        verification_status: "rejected",
        remarks: "Rejected from CRM",
      });
      if (selectedAdhesiveToken?.id === token.id) {
        setSelectedAdhesiveToken(detail);
      }
      await loadDashboard();
    }, "Adhesive token claim rejected.");
  }

  async function handleDeleteAdhesiveToken(token) {
    await runBusyAction("delete-adhesive-token", async () => {
      await api.deleteAdhesiveTokenClaim(token.id);
      if (selectedAdhesiveToken?.id === token.id) {
        setSelectedAdhesiveToken(null);
      }
      if (editingAdhesiveTokenId === token.id) {
        setEditingAdhesiveTokenId(null);
        setSchemeTokenForm(emptySchemeToken);
      }
      await loadDashboard();
    }, "Adhesive token claim deleted.");
  }

  async function handleSaveMason(event) {
    event.preventDefault();
    const requiredErrors = validateRequiredFields(masonForm, {
      name: "Mason name is required.",
      mobile: "Mobile number is required.",
      current_address: "Current address is required.",
      current_address_city: "Current address city is required.",
      working_areas: {
        message: "At least one working area is required.",
        validate: (value) => Array.isArray(value) && value.filter((item) => normalizeText(item)).length > 0,
      },
      working_distance_upto_km: {
        message: "Working distance is required.",
        validate: (value) => normalizeText(value) !== "",
      },
    });
    setMasonFormErrors(requiredErrors);
    if (Object.keys(requiredErrors).length) {
      setError("");
      focusFirstInvalidField(event.currentTarget, requiredErrors);
      return;
    }

    const validationError = validateMasonForm(masonForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (busyAction === "save-mason") {
      return;
    }

    setBusyAction("save-mason");
    setError("");

    try {
      if (editingMasonId) {
        await api.updateMason(editingMasonId, masonForm);
      } else {
        await api.createMason(masonForm);
      }

      setMasonForm(emptyMason);
      setMasonFormErrors({});
      setMasonWorkingAreaInput("");
      setEditingMasonId(null);

      const refreshedMasons = await api.getMasons();
      setMasons(refreshedMasons || []);

      try {
        await loadDashboard();
      } catch (_dashboardError) {
        // Mason save should still succeed even if another dashboard segment fails.
      }

      pushToast(editingMasonId ? "Registered mason updated." : "Registered mason saved.");
    } catch (requestError) {
      if (requestError.status === 409 && requestError.data?.mason) {
        setMasons(await api.getMasons().catch(() => masons));
        startEditingMason(requestError.data.mason);
        setError("Mason already registered. Existing mason opened for edit.");
      } else {
        setError(requestError.message || "Unable to save mason.");
      }
    } finally {
      setBusyAction("");
    }
  }

  async function handleDeleteProduct(productId) {
    await runBusyAction("delete-product", async () => {
      await api.deleteProduct(productId);
      if (editingProductId === productId) {
        setEditingProductId(null);
        setProductForm(emptyProduct);
        setIsAddingCustomProductCategory(false);
        setIsAddingCustomCompany(false);
        setIsAddingCustomProductSize(false);
        setIsAddingCustomFinish(false);
        setProductDuplicateOverride(false);
      }
      await loadDashboard();
    }, "Inventory item deleted.");
  }

  async function handleDeleteDealer(dealerId) {
    await runBusyAction("delete-dealer", async () => {
      await api.deleteDealer(dealerId);
      if (editingDealerId === dealerId) {
        setEditingDealerId(null);
        setDealerForm(emptyDealer);
      }
      await loadDashboard();
    }, "Dealer deleted.");
  }

  async function handleDeleteExpense(expenseId) {
    await runBusyAction("delete-expense", async () => {
      await api.deleteExpense(expenseId);
      if (editingExpenseId === expenseId) {
        setEditingExpenseId(null);
        setExpenseForm(emptyExpense);
      }
      await loadDashboard();
    }, "Expense deleted.");
  }

  async function handleSavePlumber(event) {
    event.preventDefault();
    const validationError = validatePlumberForm(plumberForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-plumber", async () => {
      if (editingPlumberId) {
        await api.updatePlumber(editingPlumberId, plumberForm);
      } else {
        await api.createPlumber(plumberForm);
      }

      setPlumberForm(emptyPlumber);
      setEditingPlumberId(null);
      await loadDashboard();
    }, editingPlumberId ? "Plumber updated." : "Plumber saved.");
  }

  async function handleCreatePlumbingJob(event) {
    event.preventDefault();
    const leadId = selectedLead?.id || plumbingJobForm.lead_id;
    const validationError = validatePlumbingJobForm(plumbingJobForm, leadId);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-plumbing-job", async () => {
      await api.createPlumbingJob({
        ...plumbingJobForm,
        lead_id: leadId,
        plumber_id: plumbingJobForm.plumber_id || null,
        service_charge: Number(plumbingJobForm.service_charge || 0),
      });
      setPlumbingJobForm((current) => ({ ...emptyPlumbingJob, lead_id: current.lead_id }));

      if (leadId) {
        await loadLeadDetails(leadId);
      }
      await loadDashboard();
    }, "Plumbing job saved.");
  }

  async function handleUpdatePlumbingJobStatus(job, status) {
    await runBusyAction("complete-plumbing-job", async () => {
      await api.updatePlumbingJob(job.id, {
        lead_id: job.lead_id,
        plumber_id: job.plumber_id,
        work_type: job.work_type,
        status,
        service_charge: Number(job.service_charge || 0),
        scheduled_for: job.scheduled_for ? formatDateTimeLocalInput(job.scheduled_for) : "",
        note: job.note || "",
      });

      if (selectedLead?.id === job.lead_id) {
        await loadLeadDetails(job.lead_id);
      }
      await loadDashboard();
    }, status === "completed" ? "Plumbing job marked complete." : "Plumbing job updated.");
  }

  async function handleAddPlumbingMaterial(jobId, leadId) {
    const draft = plumbingMaterialDrafts[jobId] || emptyPlumbingMaterial;
    const validationError = validatePlumbingMaterialForm(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-plumbing-material", async () => {
      await api.addPlumbingMaterial(jobId, {
        item_name: draft.item_name,
        quantity: Number(draft.quantity || 0),
        unit: draft.unit,
        price: Number(draft.price || 0),
      });

      setPlumbingMaterialDrafts((current) => ({
        ...current,
        [jobId]: emptyPlumbingMaterial,
      }));

      if (selectedLead?.id === leadId) {
        await loadLeadDetails(leadId);
      }
      await loadDashboard();
    }, "Plumbing material saved.");
  }

  async function handleSaveUser(event) {
    event.preventDefault();
    const validationError = validateUserForm(userForm, Boolean(editingUserId));
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-user", async () => {
      const normalizedRoles = [...new Set((userForm.roles || []).filter(Boolean))];
      const payload = {
        ...userForm,
        roles: normalizedRoles,
        role: normalizedRoles[0] || userForm.role || "sales",
      };

      if (editingUserId) {
        await api.updateUser(editingUserId, payload);
      } else {
        await api.createUser(payload);
      }

      setUserForm(emptyUser);
      setEditingUserId(null);
      await loadDashboard();
    }, editingUserId ? "User updated." : "User created.");
  }

  async function handleDeleteUser(userId) {
    await runBusyAction("delete-user", async () => {
      await api.deleteUser(userId);
      if (editingUserId === userId) {
        setEditingUserId(null);
        setUserForm(emptyUser);
      }
      await loadDashboard();
    }, "User deleted.");
  }

  function startEditingUser(selectedUser) {
    setEditingUserId(selectedUser.id);
    setUserForm({
      name: selectedUser.name,
      phone: selectedUser.phone,
      role: selectedUser.role,
      roles: normalizeUserRoles(selectedUser),
      password: "",
    });
  }

  function startEditingDealer(dealer) {
    setEditingDealerId(dealer.id);
    setDealerForm({
      name: dealer.name,
      area: dealer.area || "",
      phone: dealer.phone || "",
      monthly_purchase: dealer.monthly_purchase || "",
      credit_limit: dealer.credit_limit || "",
      outstanding_payment: dealer.outstanding_payment || "",
      commission_percent: dealer.commission_percent || "",
      category: dealer.category || "C",
    });
    setCurrentView("dealers");
  }

  function startEditingMason(mason) {
    setEditingMasonId(mason.id);
    setMasonFormErrors({});
    setMasonForm({
      name: mason.name || "",
      mobile: mason.mobile || "",
      alt_mobile: mason.alt_mobile || "",
      current_address: mason.current_address || "",
      current_address_city: mason.current_address_city || "",
      permanent_address: mason.permanent_address || "",
      permanent_address_city: mason.permanent_address_city || "",
      working_areas: Array.isArray(mason.working_areas) ? mason.working_areas : [],
      working_distance_upto_km: mason.working_distance_upto_km || "",
      status: mason.status || "active",
      remarks: mason.remarks || "",
    });
    setMasonWorkingAreaInput("");
    setCurrentView("masons");
  }

  function startEditingPlumber(plumber) {
    setEditingPlumberId(plumber.id);
    setPlumberForm({
      name: plumber.name || "",
      phone: plumber.phone || "",
      area: plumber.area || "",
    });
    setCurrentView("plumbing");
  }

  function startEditingProject(project) {
    setEditingProjectId(project.id);
    setProjectFormErrors({});
    setProjectForm({
      lead_id: project.lead_id,
      project_name: project.project_name || "",
      status: project.status || "active",
      start_date: project.start_date ? formatDateInput(project.start_date) : "",
      expected_delivery_date: project.expected_delivery_date ? formatDateInput(project.expected_delivery_date) : "",
      completion_date: project.completion_date ? formatDateInput(project.completion_date) : "",
      owner_note: project.owner_note || "",
    });
    setCurrentView("projects");
  }

  function startEditingProduct(product, highlightFields = []) {
    const companyValue = getProductCompany(product);
    const productSizeValue = getProductSize(product);
    const tileSizeValue = product.tile_size || productSizeValue;
    const finishValue = getProductFinish(product);
    const designCodeValue = getProductDesignCode(product);

    setEditingProductId(product.id);
    setInventoryWorkspaceTab("new");
    setProductHighlightedFields(Array.isArray(highlightFields) ? highlightFields : []);
    setProductFormErrors({});
    setIsAddingCustomProductCategory(false);
    setIsAddingCustomCompany(false);
    setIsAddingCustomProductSize(false);
    setIsAddingCustomFinish(false);
    setProductDuplicateOverride(false);
    setProductForm({
      name: product.name,
      company_name: companyValue,
      design_code: designCodeValue,
      business_unit: product.business_unit || "tiles",
      category: product.category || "Floor Tiles",
      unit: product.unit || "box",
      tile_size: tileSizeValue,
      product_size: productSizeValue,
      finish: finishValue,
      pieces_per_box: product.pieces_per_box || "",
      sqft_per_box: product.sqft_per_box || "",
      weight_per_box: product.weight_per_box || "",
      weight_per_unit: product.weight_per_unit || "",
      stock_sqft:
        product.stock_sqft === null || product.stock_sqft === undefined || product.stock_sqft === ""
          ? ""
          : String(product.stock_sqft),
      low_stock_threshold:
        product.low_stock_threshold === null ||
        product.low_stock_threshold === undefined ||
        product.low_stock_threshold === ""
          ? "10"
          : String(product.low_stock_threshold),
      purchase_rate: product.purchase_rate || "",
      price_per_sqft: product.price_per_sqft || "",
      predefined_rate: product.predefined_rate || "",
      today_selling_rate: product.today_selling_rate || "",
      daily_up_limit_percent: product.daily_up_limit_percent || "2",
      daily_down_limit_percent: product.daily_down_limit_percent || "1",
      last_purchase_rate: product.last_purchase_rate || "",
      landed_cost_per_unit: product.landed_cost_per_unit || "",
      minimum_allowed_rate: product.minimum_allowed_rate || "",
      suggested_selling_rate: product.suggested_selling_rate || "",
      operator_discount_cap: product.operator_discount_cap || "",
      manager_discount_cap: product.manager_discount_cap || "",
      owner_discount_cap: product.owner_discount_cap || "",
      safety_margin_percent: product.safety_margin_percent || "",
      growth_margin_percent: product.growth_margin_percent || "",
      quotation_validity_days: product.quotation_validity_days || "0",
      pricing_lock: Boolean(product.pricing_lock),
      status: product.status || "active",
    });
    if (product.category && !defaultProductCategories.includes(product.category)) {
      setCustomProductCategories((current) => (current.includes(product.category) ? current : [...current, product.category]));
    }
    if (companyValue) {
      setCustomCompanyOptions((current) =>
        current.includes(companyValue) ? current : [...current, companyValue]
      );
    }
    if (productSizeValue || tileSizeValue) {
      const sizeValue = productSizeValue || tileSizeValue;
      setCustomProductSizeOptions((current) =>
        current.includes(sizeValue) ? current : [...current, sizeValue]
      );
    }
    if (finishValue && !defaultProductFinishes.includes(finishValue)) {
      setCustomFinishOptions((current) =>
        current.includes(finishValue) ? current : [...current, finishValue]
      );
    }
    setCurrentView("inventory");
  }

  function openLowStockInventoryView() {
    setCurrentView("inventory");
    setInventoryWorkspaceTab("ledger");
    setInventoryLedgerView("list");
    setInventoryLedgerSearch("");
    setInventoryLedgerStockFilter("low");
    setInventoryLedgerSort("stock_low_high");
  }

  function startEditingComplaint(complaint) {
    setEditingComplaintId(complaint.id);
    setComplaintForm({
      lead_id: complaint.lead_id || "",
      customer_name: complaint.customer_name || "",
      phone: complaint.phone || "",
      location: complaint.location || "",
      business_unit: complaint.business_unit || "plumbing",
      category: complaint.category || "other",
      priority: complaint.priority || "medium",
      status: complaint.status || "open",
      title: complaint.title || "",
      description: complaint.description || "",
      resolution_note: complaint.resolution_note || "",
      due_date: complaint.due_date ? formatDateTimeLocalInput(complaint.due_date) : "",
      assigned_to: complaint.assigned_to || "",
    });
    setCurrentView("complaints");
  }

  function startEditingExpense(expense) {
    setEditingExpenseId(expense.id);
    setExpenseFormErrors({});
    setExpenseForm({
      category: expense.category || "miscellaneous",
      expense_date: expense.expense_date ? formatDateInput(expense.expense_date) : "",
      amount: expense.amount || "",
      note: expense.note || "",
      paid_by: expense.paid_by || "cash",
    });
    setCurrentView("expenses");
  }

  function updateQuotationItem(index, field, value) {
    setQuotationForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
    clearFieldErrorState(setQuotationFormErrors, `items.${index}.${field}`);
  }

  function addQuotationItem() {
    setQuotationForm((current) => ({
      ...current,
      items: [
        ...current.items,
        { product_id: null, product_name: "", tile_size: "", quantity_sqft: "", unit_price: "" },
      ],
    }));
  }

  function addInventoryProductToQuote(product) {
    const quotationRate = getProductTodaySellingRate(product);
    setQuotationForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          product_id: product.id,
          product_name: product.name,
          tile_size: product.tile_size || "",
          quantity_sqft: "",
          unit_price: quotationRate || product.price_per_sqft || "",
        },
      ],
    }));
  }

  function updatePlumbingMaterialDraft(jobId, field, value) {
    setPlumbingMaterialDrafts((current) => ({
      ...current,
      [jobId]: {
        ...(current[jobId] || emptyPlumbingMaterial),
        [field]: value,
      },
    }));
  }

  function updateDispatchDraft(projectId, field, value) {
    setDispatchDrafts((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] || emptyDispatch),
        [field]: value,
      },
    }));
  }

  function clearSessionTimeoutTimers() {
    if (sessionWarningTimerRef.current) {
      window.clearTimeout(sessionWarningTimerRef.current);
      sessionWarningTimerRef.current = null;
    }
    if (sessionLogoutTimerRef.current) {
      window.clearTimeout(sessionLogoutTimerRef.current);
      sessionLogoutTimerRef.current = null;
    }
    if (sessionCountdownIntervalRef.current) {
      window.clearInterval(sessionCountdownIntervalRef.current);
      sessionCountdownIntervalRef.current = null;
    }
  }

  function resetSessionWarningState() {
    setShowSessionTimeoutWarning(false);
    setSessionWarningCountdown(Math.ceil((LOGOUT_AFTER_MS - WARNING_AFTER_MS) / 1000));
    if (sessionCountdownIntervalRef.current) {
      window.clearInterval(sessionCountdownIntervalRef.current);
      sessionCountdownIntervalRef.current = null;
    }
  }

  function clearSessionAuthData() {
    clearSessionTimeoutTimers();
    localStorage.removeItem("tiles-crm-token");
    localStorage.removeItem("tiles-crm-user");
    localStorage.removeItem(SESSION_LAST_ACTIVE_STORAGE_KEY);
    resetSessionWarningState();
    backgroundedAtRef.current = null;
    lastActivityAtRef.current = Date.now();
  }

  function handleLogout() {
    clearSessionAuthData();
    setToken(null);
    setUser(null);
    setSelectedLead(null);
    setLeads([]);
    setStats(null);
    setFollowups([]);
    setPayments([]);
    setOperationsBoard([]);
    setOperationsTasks([]);
    setDailyTasks([]);
    setDailyTaskSummary(null);
    setDailyTaskStaffSummary([]);
    setQuotations([]);
    setSchemeTokens([]);
    setSchemeSummary(null);
    setAdhesiveTokenReports({});
    setAdhesiveTokenActivities([]);
    setMasons([]);
    setMasonActivities([]);
    setSelectedAdhesiveToken(null);
    setEditingAdhesiveTokenId(null);
      setAdhesiveTokenStatusFilter("all");
      setAdhesiveTokenMasonFilter("");
      setAdhesiveTokenInvoiceFilter("");
      setAdhesiveTokenSiteFilter("");
      setAdhesiveTokenCreatedByFilter("");
      setAdhesiveTokenVerifiedByFilter("");
      setAdhesiveTokenDateFromFilter("");
      setAdhesiveTokenDateToFilter("");
    setComplaints([]);
    setComplaintSummary(null);
    setProjects([]);
    setProjectSummary(null);
    setSelectedProject(null);
    setPlumbers([]);
    setPlumbingBoard([]);
    setLeadPlumbingJobs([]);
    setPlumbingSummary(null);
    setExpenses([]);
    setExpenseSummary(null);
    setNotifications([]);
    setShowNotifications(false);
    setDailyTaskViewTab("today");
    setDailyTaskFilters(emptyDailyTaskFilters);
    setUsers([]);
    setDealers([]);
    setProducts([]);
    setInventorySummary(null);
    setInventoryOptions({ companies: [], sizes: [], finishes: [] });
    setPurchases([]);
    setPurchaseInvoices([]);
    setPurchaseSummary(null);
    setPurchaseForm({ ...emptyPurchase, purchase_date: new Date().toISOString().slice(0, 10) });
    setPurchaseItems([{ ...emptyPurchaseItem }]);
    setPurchaseFormErrors({});
    setEditingPurchaseId(null);
    setPurchaseSearch("");
    setPurchaseFromFilter("");
    setPurchaseToFilter("");
    setPurchasePaymentFilter("all");
    setPurchaseLots([]);
    setPurchaseCostingSummary(null);
    setPurchaseCostingReports({});
    setPurchaseCostingReferences({ products: [] });
    setPurchaseCostingForm(emptyPurchaseLot);
    setPurchaseCostingFormErrors({});
    setEditingPurchaseLotId(null);
    setSelectedPurchaseLot(null);
    setLinkedPurchaseBills([]);
    setPurchaseLotSearch("");
    setPurchaseLotStatusFilter("all");
    setInvoices([]);
    setBillingSummary(null);
    setBillingReports({});
    setBillingReferences({ leads: [], quotations: [], projects: [], products: [] });
    setInvoiceForm(emptyInvoice);
    setInvoiceFormErrors({});
    setEditingInvoiceId(null);
    setSelectedInvoice(null);
    setBillingPaymentForm(emptyBillingPayment);
    setBillingSearch("");
    setBillingStatusFilter("all");
    setBillingPaymentFilter("all");
    setBillingFromFilter("");
    setBillingToFilter("");
    setDealerForm(emptyDealer);
    setEditingDealerId(null);
    setProductForm(emptyProduct);
    setProductFormErrors({});
    setEditingProductId(null);
    setIsAddingCustomProductCategory(false);
    setIsAddingCustomCompany(false);
    setIsAddingCustomProductSize(false);
    setIsAddingCustomFinish(false);
    setProductDuplicateOverride(false);
    setPlumberForm(emptyPlumber);
    setEditingPlumberId(null);
    setPlumbingJobForm(emptyPlumbingJob);
    setPlumbingMaterialDrafts({});
    setProjectForm(emptyProject);
    setEditingProjectId(null);
    setDispatchDrafts({});
    setExpenseForm(emptyExpense);
    setEditingExpenseId(null);
    setPendingDelete(null);
    setSchemeTokenForm(emptySchemeToken);
    setDailyTaskForm(createEmptyDailyTask());
    setDailyTaskFormErrors({});
    setEditingDailyTaskId(null);
    setComplaintForm(emptyComplaint);
    setEditingComplaintId(null);
    setUserForm(emptyUser);
    setEditingUserId(null);
    setMasonForm(emptyMason);
    setMasonWorkingAreaInput("");
    setEditingMasonId(null);
  }

  const performAutomaticLogout = useCallback(() => {
    clearSessionAuthData();
    setToken(null);
    setUser(null);
    pushToast("You were logged out due to inactivity.", "error");
  }, []);

  const scheduleSessionTimeouts = useCallback(() => {
    if (!token) {
      clearSessionTimeoutTimers();
      return;
    }

    clearSessionTimeoutTimers();
    resetSessionWarningState();

    sessionWarningTimerRef.current = window.setTimeout(() => {
      setShowSessionTimeoutWarning(true);
      setSessionWarningCountdown(Math.ceil((LOGOUT_AFTER_MS - WARNING_AFTER_MS) / 1000));

      sessionCountdownIntervalRef.current = window.setInterval(() => {
        setSessionWarningCountdown((current) => {
          if (current <= 1) {
            window.clearInterval(sessionCountdownIntervalRef.current);
            sessionCountdownIntervalRef.current = null;
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    }, WARNING_AFTER_MS);

    sessionLogoutTimerRef.current = window.setTimeout(() => {
      performAutomaticLogout();
    }, LOGOUT_AFTER_MS);
  }, [performAutomaticLogout, token]);

  const markUserActivity = useCallback(() => {
    if (!token) {
      return;
    }

    const now = Date.now();
    lastActivityAtRef.current = now;
    backgroundedAtRef.current = null;
    localStorage.setItem(SESSION_LAST_ACTIVE_STORAGE_KEY, String(now));
    scheduleSessionTimeouts();
  }, [scheduleSessionTimeouts, token]);

  const continueWorkingSession = useCallback(() => {
    markUserActivity();
  }, [markUserActivity]);

  useEffect(() => {
    if (!token || typeof document === "undefined" || typeof window === "undefined") {
      clearSessionTimeoutTimers();
      resetSessionWarningState();
      return undefined;
    }

    const activityEvents = ["mousemove", "click", "keydown", "scroll", "touchstart", "touchmove"];

    const handleBackgroundStart = () => {
      const now = Date.now();
      backgroundedAtRef.current = now;
      localStorage.setItem(SESSION_LAST_ACTIVE_STORAGE_KEY, String(now));
    };

    const handleForegroundReturn = () => {
      const stored = Number(localStorage.getItem(SESSION_LAST_ACTIVE_STORAGE_KEY) || 0);
      const backgroundAt = backgroundedAtRef.current || stored || lastActivityAtRef.current;
      const elapsed = backgroundAt ? Date.now() - backgroundAt : 0;

      if (elapsed >= MOBILE_BACKGROUND_LOGOUT_MS) {
        performAutomaticLogout();
        return;
      }

      markUserActivity();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleBackgroundStart();
      } else {
        handleForegroundReturn();
      }
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markUserActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleBackgroundStart);
    window.addEventListener("pageshow", handleForegroundReturn);
    window.addEventListener("focus", handleForegroundReturn);
    window.addEventListener("blur", handleBackgroundStart);

    markUserActivity();

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markUserActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleBackgroundStart);
      window.removeEventListener("pageshow", handleForegroundReturn);
      window.removeEventListener("focus", handleForegroundReturn);
      window.removeEventListener("blur", handleBackgroundStart);
      clearSessionTimeoutTimers();
    };
  }, [markUserActivity, performAutomaticLogout, token]);

  if (!token) {
    return (
      <div className="auth-shell">
        <section className="auth-card auth-premium-shell">
          <aside className="auth-hero-panel">
            <div className="auth-hero-overlay" />
            <div className="auth-hero-content">
              <div className="auth-brand">
                <div className="auth-brand-mark" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="auth-brand-copy">
                  <strong>AIBA</strong>
                  <span>Tiles CRM</span>
                </div>
              </div>

              <div className="auth-hero-copy-block">
                <p className="eyebrow">Premium showroom CRM</p>
                <h1>
                  Manage your showroom.
                  <br />
                  <span>Grow</span> your business.
                </h1>
                <p className="auth-hero-copy">
                  A complete CRM system to manage leads, projects, inventory, billing and your
                  entire showroom operations in one place.
                </p>
                <p className="auth-hero-owner-line">
                  Manage Sales.
                  <br />
                  Track Collections.
                  <br />
                  Control Inventory.
                  <br />
                  Grow Profit.
                </p>
              </div>

              <div className="auth-feature-list" aria-label="CRM features">
                <article className="auth-feature-item">
                  <div className="auth-feature-icon" aria-hidden="true">✓</div>
                  <div>
                    <strong>Lead Management</strong>
                    <p>Track every walk-in and convert more leads.</p>
                  </div>
                </article>
                <article className="auth-feature-item">
                  <div className="auth-feature-icon" aria-hidden="true">✓</div>
                  <div>
                    <strong>Inventory Control</strong>
                    <p>Monitor stock, batches, pricing and showroom movement.</p>
                  </div>
                </article>
                <article className="auth-feature-item">
                  <div className="auth-feature-icon" aria-hidden="true">✓</div>
                  <div>
                    <strong>Billing &amp; Invoicing</strong>
                    <p>Create customer bills quickly with approval-safe pricing.</p>
                  </div>
                </article>
                <article className="auth-feature-item">
                  <div className="auth-feature-icon" aria-hidden="true">✓</div>
                  <div>
                    <strong>Mason &amp; Project Tracking</strong>
                    <p>Monitor execution, tokens, dispatch flow and on-site coordination.</p>
                  </div>
                </article>
                <article className="auth-feature-item">
                  <div className="auth-feature-icon" aria-hidden="true">✓</div>
                  <div>
                    <strong>Insights &amp; Reports</strong>
                    <p>Use live dashboards to run a disciplined monthly showroom business.</p>
                  </div>
                </article>
              </div>

              <div className="auth-hero-footer">Trusted by showroom teams. Secure - Fast - Reliable</div>
            </div>
          </aside>

          <div className="auth-form-panel">
            <div className="auth-glass-card panel">
              <div className="auth-logo-stack">
                <div className="auth-logo-badge" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div>
                  <h2>Welcome Back!</h2>
                  <p>Sign in to continue to AIBA Tiles CRM</p>
                </div>
              </div>

              {error || authNotice ? (
                <div className="auth-error-banner" role="alert">
                  {authNotice || error}
                </div>
              ) : null}

              <form className="auth-login-form" onSubmit={handleLogin}>
                <label className="auth-input-group">
                  <span className="auth-input-icon" aria-hidden="true">☎</span>
                  <input
                    placeholder="Phone"
                    autoComplete="tel"
                    value={loginForm.phone}
                    onChange={(event) => setLoginForm({ ...loginForm, phone: event.target.value })}
                  />
                </label>
                <label className="auth-input-group">
                  <span className="auth-input-icon" aria-hidden="true">◍</span>
                  <input
                    type="password"
                    placeholder="Password"
                    autoComplete="current-password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                  />
                </label>

                <div className="auth-login-meta">
                  <label className="checkbox-row auth-checkbox-row">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                    />
                    <span>Remember Me</span>
                  </label>
                </div>

                <button type="submit" className="auth-login-button" disabled={busyAction === "login"}>
                  <span className="auth-login-button-icon" aria-hidden="true">
                    {busyAction === "login" ? "◌" : "→"}
                  </span>
                  {busyAction === "login" ? "Signing In..." : "Sign In"}
                </button>
              </form>

              <p className="auth-trust-note">Your data is secure and your showroom workflow stays private.</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {toasts.length ? (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.tone}`}>
              <span>{toast.message}</span>
              <button type="button" className="toast-close secondary" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
                Close
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <AppHeader
        userName={user?.name}
        roleLabel={headerRoleLabel}
        workspaceLabel={headerWorkspaceLabel}
        unreadCount={unreadNotifications.length}
        onToggleNotifications={() => setShowNotifications((current) => !current)}
        onOpenDashboard={() => setCurrentView("overview")}
        onLogout={handleLogout}
      />

      {showNotifications ? (
        <section className="panel notification-panel">
          <div className="section-head">
            <h2>Assigned alerts</h2>
            <span>{unreadNotifications.length} unread</span>
          </div>
          <div className="list">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={`lead-card ${notification.is_read ? "" : "active"} ${notification.is_read ? "notification-read" : "notification-unread"}`}
              >
                <div className="section-head">
                  <div>
                    <h3>{notification.title}</h3>
                    <p className="muted">{notification.message}</p>
                  </div>
                  <span className={`status-chip ${notification.is_read ? "" : "status-pending"}`}>
                    {notification.is_read ? "Read" : "Unread"}
                  </span>
                </div>
                <p className="muted">{formatDateTime(notification.created_at)}</p>
                {!notification.is_read ? (
                  <button type="button" onClick={() => handleMarkNotificationRead(notification)}>
                    Open and Mark Read
                  </button>
                ) : null}
              </article>
            ))}
            {notifications.length === 0 ? (
              <EmptyState title="No notifications yet" message="Assigned alerts and handoffs will appear here." compact />
            ) : null}
          </div>
        </section>
      ) : null}

      {pendingDelete ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="panel modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
          >
            <div className="section-head">
              <h2 id="delete-confirm-title">Delete {pendingDelete.entityLabel}?</h2>
              <span className="status-chip status-urgent">Admin Only</span>
            </div>
            <p>{pendingDelete.message}</p>
            {pendingDelete.subtext ? <p className="muted">{pendingDelete.subtext}</p> : null}
            <div className="lead-actions">
              <button type="button" className="secondary" onClick={() => setPendingDelete(null)} disabled={Boolean(busyAction)}>
                Cancel
              </button>
              <button type="button" className="danger" onClick={confirmPendingDelete} disabled={Boolean(busyAction)}>
                Delete {pendingDelete.entityLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {pendingAction ? (
        <div className="modal-backdrop" role="presentation">
          <section className="panel modal-card" role="dialog" aria-modal="true" aria-labelledby="action-confirm-title">
            <div className="section-head">
              <h2 id="action-confirm-title">{pendingAction.title}</h2>
              <span className={`status-chip ${pendingAction.tone === "danger" ? "status-urgent" : "status-pending"}`}>
                Confirmation
              </span>
            </div>
            <p>{pendingAction.message}</p>
            {pendingAction.subtext ? <p className="muted">{pendingAction.subtext}</p> : null}
            <div className="lead-actions">
              <button type="button" className="secondary" onClick={() => setPendingAction(null)} disabled={Boolean(busyAction)}>
                Cancel
              </button>
              <button type="button" className={pendingAction.tone === "danger" ? "danger" : ""} onClick={confirmPendingAction} disabled={Boolean(busyAction)}>
                {pendingAction.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showSessionTimeoutWarning ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="panel modal-card session-timeout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-timeout-title"
          >
            <div className="section-head">
              <h2 id="session-timeout-title">Session timeout warning</h2>
              <span className="status-chip status-pending">Auto logout protection</span>
            </div>
            <p>Your session will expire in 5 minutes due to inactivity.</p>
            <p className="muted">
              Continue working to keep your CRM session active. Automatic logout in{" "}
              <strong>{Math.max(0, sessionWarningCountdown)}</strong> seconds.
            </p>
            <div className="lead-actions">
              <button type="button" className="secondary" onClick={continueWorkingSession}>
                Continue Working
              </button>
              <button type="button" className="danger" onClick={handleLogout}>
                Logout Now
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className={`app-layout ${isSidebarCollapsed && !isMobileSidebar ? "app-layout-collapsed" : ""} ${isMobileSidebar ? "app-layout-mobile" : ""}`}>
        <Sidebar
          navGroups={navGroups}
          visibleViews={visibleViews}
          isAdminUser={isAdmin(user)}
          currentView={currentView}
          onSelectView={handleSelectView}
          isMobileSidebar={isMobileSidebar}
          isSidebarMobileOpen={isSidebarMobileOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => {
            if (isMobileSidebar) {
              setIsSidebarMobileOpen((current) => !current);
              return;
            }
            setIsSidebarCollapsed((current) => !current);
          }}
          onCloseMobile={() => setIsSidebarMobileOpen(false)}
          compactSidebarIcons={compactSidebarIcons}
        />

        <div className="app-main">
          {isMobileSidebar ? (
            <div className="mobile-sidebar-bar">
              <button
                type="button"
                className="secondary sidebar-toggle"
                onClick={() => setIsSidebarMobileOpen(true)}
                aria-label="Open sidebar"
              >
                Menu
              </button>
            </div>
          ) : null}
          {["followups", "operations", "complaints"].includes(currentView) ? (
            <section className="filters-bar panel">
              <div className="control-group">
                <span className="control-label">Workspace</span>
                <select value={workspaceFilter} onChange={(event) => setWorkspaceFilter(event.target.value)}>
                  {workspaceOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="control-group">
                <span className="control-label">Business Unit</span>
                <select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>
                  {businessUnits.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          ) : null}

      {isOverview ? (
        <section className="legend-bar panel">
          <div className="legend-group">
            <span className="control-label">Business Unit</span>
            <div className="legend-items">
              <span className="legend-chip legend-tiles">Tiles</span>
              <span className="legend-chip legend-plumbing">Plumbing</span>
              <span className="legend-chip legend-both">Tiles + Plumbing</span>
            </div>
          </div>
          <div className="legend-group">
            <span className="control-label">Priority</span>
            <div className="legend-items">
              <span className="legend-chip legend-low">Low</span>
              <span className="legend-chip legend-medium">Medium</span>
              <span className="legend-chip legend-high">High</span>
              <span className="legend-chip legend-urgent">Urgent</span>
            </div>
          </div>
        </section>
      ) : null}

      <PageHeader
        isOverview={isOverview}
        title={activeViewMeta.title}
        description={activeViewMeta.description}
        autoRefreshStatusText={autoRefreshStatusText}
        audience={activeViewMeta.audience}
        pageAction={pageAction}
        onPageAction={
          pageAction
            ? () => {
                if (pageAction.id === "new_lead") {
                  openNewLeadFlow();
                  return;
                }
                setCurrentView(pageAction.id);
              }
            : undefined
        }
        workspaceLabel={workspaceFilter === "all" ? "All Work" : labelize(workspaceFilter)}
        unitLabel={unitFilter === "all" ? "All Units" : labelize(unitFilter)}
        viewLabel={views.find((item) => item.id === currentView)?.label || "Overview"}
      />

      {loading ? <p className="loading-banner">Syncing latest CRM data...</p> : null}

      {isOverview ? (
        <>
          <section className="stats-grid">
            {summaryCards.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} tone={card.tone || "default"} />
            ))}
          </section>

          {canViewOwnerDashboard ? (
            <section className="panel">
              <div className="section-head">
                <h2>Owner dashboard</h2>
                <span>Phase 1 owner-only control view using existing CRM summary APIs</span>
              </div>
              {ownerOverviewLoading ? <p className="loading-banner">Refreshing owner dashboard...</p> : null}
              {ownerOverviewError ? <p className="field-error-message">{ownerOverviewError}</p> : null}
              {!ownerOverviewLoading && !ownerOverviewHasData ? (
                <EmptyState
                  title="Owner dashboard is waiting for live data"
                  message="Once overview summaries load, owner cards will appear here without changing your current CRM workflow."
                  compact
                />
              ) : (
                <>
                  {/* Dashboard de-clutter: Today's Sales / Collection / Outstanding
                      were removed from this panel because the same three numbers
                      already lead the KPI cards at the top of the page. */}
                  <div className="report-grid">
                    <article className="detail-card">
                      <span className="audience-tag">Row 1</span>
                      <h3>Open Complaints</h3>
                      <p>{Number(ownerOverviewData.complaints?.open_complaints || 0).toLocaleString("en-IN")}</p>
                      <div className="chip-row">
                        <span className="legend-chip">Urgent {Number(ownerOverviewData.complaints?.urgent_complaints || 0).toLocaleString("en-IN")}</span>
                        <span className="legend-chip">Closed {Number(ownerOverviewData.complaints?.closed_complaints || 0).toLocaleString("en-IN")}</span>
                      </div>
                    </article>
                    <article className="detail-card">
                      <span className="audience-tag">Row 1</span>
                      <h3>Low Stock Items</h3>
                      <p>{Number(dashboardSummary?.low_stock_items?.count || 0).toLocaleString("en-IN")}</p>
                      <div className="chip-row">
                        <span className="legend-chip">Threshold-driven alert</span>
                      </div>
                      <div className="lead-actions">
                        <button type="button" className="secondary" onClick={openLowStockInventoryView}>
                          View low stock
                        </button>
                      </div>
                    </article>
                  </div>
                  <div className="report-grid">
                    <article className="detail-card">
                      <span className="audience-tag">Row 2</span>
                      <h3>Lead Pipeline Summary</h3>
                      <p>{Number(focusStats.totalLeads || 0).toLocaleString("en-IN")} leads</p>
                      <div className="chip-row">
                        <span className="legend-chip">Open {Number(focusStats.openLeads || 0).toLocaleString("en-IN")}</span>
                        <span className="legend-chip">Converted {Number(focusStats.convertedLeads || 0).toLocaleString("en-IN")}</span>
                        <span className="legend-chip">Conversion {focusStats.conversionRate}%</span>
                      </div>
                    </article>
                    <article className="detail-card">
                      <span className="audience-tag">Row 2</span>
                      <h3>Follow-up Summary</h3>
                      <p>{Number(focusStats.pendingFollowups || 0).toLocaleString("en-IN")} pending</p>
                      <div className="chip-row">
                        <span className="legend-chip">Due today {Number(focusStats.dueToday || 0).toLocaleString("en-IN")}</span>
                        <span className="legend-chip">Overdue {Number(focusStats.overdueFollowups || 0).toLocaleString("en-IN")}</span>
                      </div>
                    </article>
                    <article className="detail-card">
                      <span className="audience-tag">Row 2</span>
                      <h3>Daily Report Summary</h3>
                      <p>{formatCurrency(ownerOverviewData.dailyReport?.net_cash || 0)} net cash</p>
                      <div className="chip-row">
                        <span className="legend-chip">Sales {formatCurrency(ownerOverviewData.dailyReport?.sales?.amount || 0)}</span>
                        <span className="legend-chip">Expense {formatCurrency(ownerOverviewData.dailyReport?.expense?.amount || 0)}</span>
                      </div>
                    </article>
                    <article className="detail-card">
                      <span className="audience-tag">Row 2</span>
                      <h3>Projects Summary</h3>
                      <p>{Number(ownerOverviewData.projects?.active_projects || 0).toLocaleString("en-IN")} active</p>
                      <div className="chip-row">
                        <span className="legend-chip">Total {Number(ownerOverviewData.projects?.total_projects || 0).toLocaleString("en-IN")}</span>
                        <span className="legend-chip">Pending {formatCurrency(ownerOverviewData.projects?.pending_payment || 0)}</span>
                      </div>
                    </article>
                  </div>
                  <div className="report-grid">
                    <article className="detail-card">
                      <span className="audience-tag">Row 3</span>
                      <h3>Purchase Summary</h3>
                      <p>{formatCurrency(ownerOverviewData.purchases?.total_amount || 0)}</p>
                      <div className="chip-row">
                        <span className="legend-chip">Pending {formatCurrency(ownerOverviewData.purchases?.pending_amount || 0)}</span>
                        <span className="legend-chip">Paid {formatCurrency(ownerOverviewData.purchases?.paid_amount || 0)}</span>
                      </div>
                    </article>
                    <article className="detail-card">
                      <span className="audience-tag">Row 3</span>
                      <h3>Plumbing Summary</h3>
                      <p>{Number(ownerOverviewData.plumbing?.ongoing_jobs || 0).toLocaleString("en-IN")} ongoing</p>
                      <div className="chip-row">
                        <span className="legend-chip">Total jobs {Number(ownerOverviewData.plumbing?.total_jobs || 0).toLocaleString("en-IN")}</span>
                        <span className="legend-chip">Value {formatCurrency(ownerOverviewData.plumbing?.total_plumbing_value || 0)}</span>
                      </div>
                    </article>
                    <article className="detail-card">
                      <span className="audience-tag">Row 3</span>
                      <h3>Adhesive Token Summary</h3>
                      <p>{Number(ownerOverviewData.schemes?.pending_claims || 0).toLocaleString("en-IN")} pending claims</p>
                      <div className="chip-row">
                        <span className="legend-chip">Pending payout {formatCurrency(ownerOverviewData.schemes?.pending_token_payout || 0)}</span>
                        <span className="legend-chip">Paid payout {formatCurrency(ownerOverviewData.schemes?.paid_token_payout || 0)}</span>
                      </div>
                    </article>
                    <article className="detail-card">
                      <span className="audience-tag">Row 3</span>
                      <h3>Expense Summary</h3>
                      <p>{formatCurrency(ownerOverviewData.expenses?.monthly_expenses || 0)}</p>
                      <div className="chip-row">
                        <span className="legend-chip">Gross profit {formatCurrency(ownerOverviewData.expenses?.gross_project_profit || 0)}</span>
                        <span className="legend-chip">Net profit {formatCurrency(ownerOverviewData.expenses?.monthly_net_profit_after_expenses || 0)}</span>
                      </div>
                    </article>
                  </div>
                  <div className="report-grid">
                    <article className="detail-card">
                      <span className="audience-tag">Daily Tasks</span>
                      <h3>Task Summary</h3>
                      <p>{Number(ownerOverviewData.dailyTasks?.today_total_tasks || 0).toLocaleString("en-IN")} today</p>
                      <div className="chip-row">
                        <span className="legend-chip">Completed {Number(ownerOverviewData.dailyTasks?.today_completed_tasks || 0).toLocaleString("en-IN")}</span>
                        <span className="legend-chip">Pending {Number(ownerOverviewData.dailyTasks?.today_pending_tasks || 0).toLocaleString("en-IN")}</span>
                        <span className="legend-chip">Overdue {Number(ownerOverviewData.dailyTasks?.overdue_tasks || 0).toLocaleString("en-IN")}</span>
                      </div>
                    </article>
                  </div>
                </>
              )}
            </section>
          ) : null}

          <section className="content-grid">
            <section className="panel full-span data-quality-monitor-panel">
              <div className="section-head">
                <h2>Data quality monitor</h2>
                <span>Instant trust signal for master data, approvals, and margin discipline</span>
              </div>

              <div className="data-quality-hero-grid">
                <article className={`data-quality-score-card tone-${dataQualityMonitor.scoreTone}`}>
                  <span className="audience-tag">Data Quality Score</span>
                  <div className="data-quality-score-row">
                    <div>
                      <h3>Data Quality Score</h3>
                      <strong>{dataQualityMonitor.score}%</strong>
                    </div>
                    <span className={`status-chip data-quality-status-badge tone-${dataQualityMonitor.scoreTone}`}>
                      {dataQualityMonitor.scoreTone === "healthy"
                        ? "Excellent"
                        : dataQualityMonitor.scoreTone === "warning"
                          ? "Needs Attention"
                          : "Critical"}
                    </span>
                  </div>
                  <div className="data-quality-progress-track" aria-hidden="true">
                    <span
                      className={`data-quality-progress-fill tone-${dataQualityMonitor.scoreTone}`}
                      style={{ width: `${dataQualityMonitor.score}%` }}
                    />
                  </div>
                  <p className="muted">
                    {dataQualityMonitor.allHealthy
                      ? "All monitoring metrics are healthy right now."
                      : `${dataQualityMonitor.totalIssues.toLocaleString("en-IN")} live issues are reducing master-data confidence.`}
                  </p>
                </article>

                {dataQualityMonitor.allHealthy ? (
                  <article className="data-quality-success-card">
                    <strong>Data Quality Healthy</strong>
                    <p>All required master data is complete.</p>
                    <span>Costing, billing and approvals can be trusted.</span>
                  </article>
                ) : (
                  <article className="data-quality-alerts-card">
                    <div className="section-head">
                      <h3>Priority alerts</h3>
                      <span>Highest impact first</span>
                    </div>
                    <div className="stack">
                      {dataQualityMonitor.priorityAlerts.slice(0, 6).map((alert) => (
                        <div key={`${alert.groupTitle}-${alert.label}`} className={`data-quality-alert-row tone-${alert.tone}`}>
                          <div>
                            <strong>{alert.label}</strong>
                            <span>{alert.groupTitle}</span>
                          </div>
                          <span className="legend-chip">{Number(alert.count || 0).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                )}
              </div>

              <div className="data-quality-category-grid">
                {dataQualityMonitor.groups.map((group) => (
                  <article key={group.key} className={`data-quality-category-card tone-${group.tone}`}>
                    <div className="data-quality-category-head">
                      <span className="data-quality-category-icon" aria-hidden="true">{group.icon}</span>
                      <div>
                        <h3>{group.title}</h3>
                        <p>{group.statusLabel}</p>
                      </div>
                      <span className={`status-chip data-quality-issue-badge tone-${group.tone}`}>
                        {group.issueCount === 0
                          ? "0 Issues"
                          : `${group.issueCount.toLocaleString("en-IN")} Issue${group.issueCount > 1 ? "s" : ""}`}
                      </span>
                    </div>
                    <div className="data-quality-category-list">
                      {group.issues.map((item) => (
                        <div key={item.label} className="data-quality-category-item">
                          <span>{item.label}</span>
                          <strong>{Number(item.count || 0).toLocaleString("en-IN")}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <div className="data-quality-action-grid">
                <button type="button" className="data-quality-action-card" onClick={() => setCurrentView("inventory")}>
                  <span className="data-quality-action-icon" aria-hidden="true">📦</span>
                  <div>
                    <strong>Product Master</strong>
                    <span>Open -&gt;</span>
                  </div>
                </button>
                {visibleViews.some((view) => view.id === "billing") ? (
                  <button type="button" className="data-quality-action-card" onClick={() => setCurrentView("billing")}>
                    <span className="data-quality-action-icon" aria-hidden="true">💳</span>
                    <div>
                      <strong>Billing &amp; Approval</strong>
                      <span>Open -&gt;</span>
                    </div>
                  </button>
                ) : null}
                <button type="button" className="data-quality-action-card" onClick={() => handleSelectView("pipeline")}>
                  <span className="data-quality-action-icon" aria-hidden="true">👥</span>
                  <div>
                    <strong>Leads</strong>
                    <span>Open -&gt;</span>
                  </div>
                </button>
              </div>
            </section>
          </section>

          <main className="feature-grid">
                <section className="panel adhesive-ledger-panel">
              <div className="section-head">
                <h2>
                  {workspaceFilter === "operations" ? "Operations watchlist" : "Follow-up discipline"}
                </h2>
                <span>
                  {workspaceFilter === "operations"
                    ? `${focusStats.openOpsTasks} open tasks`
                    : `${todaysFollowups.length} today`}
                </span>
              </div>
              {/* Dashboard de-clutter: the pending/overdue/due-today highlight rows
                  duplicated the KPI cards above; this panel now goes straight to
                  the actionable item list. */}
              <div className="mini-list">
                {workspaceFilter === "operations"
                  ? focusedOperationsBoard.slice(0, 4).map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className="mini-card"
                        onClick={() => {
                          const target = leads.find((lead) => lead.id === task.lead_id);
                          if (target) {
                            handleSelectLead(target);
                            setCurrentView("pipeline");
                          }
                        }}
                      >
                        <strong>{task.title}</strong>
                        <span>{labelize(task.task_type)}</span>
                        <small>{formatDateTime(task.scheduled_for)}</small>
                      </button>
                    ))
                  : focusedFollowupBoard.slice(0, 4).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="mini-card"
                        onClick={() => {
                          const target = leads.find((lead) => lead.id === item.lead_id);
                          if (target) {
                            handleSelectLead(target);
                            setCurrentView("followups");
                          }
                        }}
                      >
                        <strong>{item.lead_name}</strong>
                        <span>{labelize(item.followup_type)}</span>
                        <small>{formatDateTime(item.followup_date)}</small>
                      </button>
                    ))}
                {workspaceFilter === "operations" && focusedOperationsBoard.length === 0 ? (
                  <EmptyState title="No open ops focus" message="Operations watch items will show here once tasks are assigned." compact />
                ) : null}
                {workspaceFilter !== "operations" && focusedFollowupBoard.length === 0 ? (
                  <EmptyState title="No follow-up focus" message="Today and overdue follow-ups will surface here automatically." compact />
                ) : null}
              </div>
            </section>
          </main>
        </>
      ) : null}

      {["pipeline", "followups"].includes(currentView) ? (
        <Suspense fallback={<LazySectionFallback label="lead workspace" />}>
          <LeadWorkspaceSection
            currentView={currentView}
            overviewTitle={overviewTitle}
            overviewSubtitle={overviewSubtitle}
            leadSearch={leadSearch}
            setLeadSearch={setLeadSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            leadStatuses={leadStatuses}
            ListLoadControls={ListLoadControls}
            leads={leads}
            listLimits={listLimits}
            increaseListLimit={increaseListLimit}
            loading={loading}
            filteredLeads={filteredLeads}
            selectedLead={selectedLead}
            setSelectedLead={setSelectedLead}
            onSelectLead={handleSelectLead}
            setCurrentView={setCurrentView}
            isAdmin={isAdmin}
            user={user}
            setPendingDelete={setPendingDelete}
            EmptyState={EmptyState}
            normalizeUserRoles={normalizeUserRoles}
            editingLead={editingLead}
            setEditingLead={setEditingLead}
            createLeadMode={createLeadMode}
            leadForm={leadForm}
            setLeadForm={setLeadForm}
            leadFormErrors={leadFormErrors}
            setLeadFormErrors={setLeadFormErrors}
            handleCreateLead={handleCreateLead}
            closeNewLeadFlow={closeNewLeadFlow}
            users={users}
            followupForm={followupForm}
            setFollowupForm={setFollowupForm}
            followupFormErrors={followupFormErrors}
            setFollowupFormErrors={setFollowupFormErrors}
            paymentForm={paymentForm}
            setPaymentForm={setPaymentForm}
            quotationForm={quotationForm}
            setQuotationForm={setQuotationForm}
            quotationFormErrors={quotationFormErrors}
            setQuotationFormErrors={setQuotationFormErrors}
            followups={followups}
            payments={payments}
            quotations={quotations}
            operationsTasks={operationsTasks}
            leadPlumbingJobs={leadPlumbingJobs}
            plumbers={plumbers}
            plumbingJobForm={plumbingJobForm}
            setPlumbingJobForm={setPlumbingJobForm}
            plumbingMaterialDrafts={plumbingMaterialDrafts}
            updatePlumbingMaterialDraft={updatePlumbingMaterialDraft}
            products={products}
            handleUpdateLead={handleUpdateLead}
            handleCreateFollowup={handleCreateFollowup}
            handleCreatePayment={handleCreatePayment}
            handleCreateOperationsTask={handleCreateOperationsTask}
            handleCreateQuotation={handleCreateQuotation}
            handleCreatePlumbingJob={handleCreatePlumbingJob}
            requestPlumbingJobComplete={requestPlumbingJobComplete}
            handleAddPlumbingMaterial={handleAddPlumbingMaterial}
            operationsTaskForm={operationsTaskForm}
            setOperationsTaskForm={setOperationsTaskForm}
            updateQuotationItem={updateQuotationItem}
            addQuotationItem={addQuotationItem}
            addInventoryProductToQuote={addInventoryProductToQuote}
            busyAction={busyAction}
            focusedFollowupBoard={focusedFollowupBoard}
            overdueFollowups={overdueFollowups}
            todaysFollowups={todaysFollowups}
            BadgeCard={BadgeCard}
            formatDateTime={formatDateTime}
            labelize={labelize}
            requestMarkFollowupDone={requestMarkFollowupDone}
            focusedOperationsBoard={focusedOperationsBoard}
            focusStats={focusStats}
            requestMarkOperationsTaskDone={requestMarkOperationsTaskDone}
            pipelineColumns={pipelineColumns}
            shareOnWhatsApp={shareOnWhatsApp}
            buildFollowupWhatsAppMessage={buildFollowupWhatsAppMessage}
            buildVisitReminderMessage={buildVisitReminderMessage}
            buildQuotationWhatsAppMessage={buildQuotationWhatsAppMessage}
            getQuotationPdfUrl={getQuotationPdfUrl}
            followupTypes={followupTypes}
            paymentTypes={paymentTypes}
            customerTypes={customerTypes}
            requirementCategories={requirementCategories}
            timelines={timelines}
            leadSources={leadSources}
            plumbingWorkTypes={plumbingWorkTypes}
            plumbingJobStatuses={plumbingJobStatuses}
            clearFieldErrorFromEvent={clearFieldErrorFromEvent}
            getFieldErrorClass={getFieldErrorClass}
          />
        </Suspense>
      ) : null}

      {currentView === "operations" ? (
        <Suspense fallback={<LazySectionFallback label="daily tasks" />}>
          <DailyTasksSection
            user={user}
            users={users}
            tasks={dailyTasks}
            summary={dailyTaskSummary}
            staffSummary={dailyTaskStaffSummary}
            tab={dailyTaskViewTab}
            setTab={setDailyTaskViewTab}
            filters={dailyTaskFilters}
            setFilters={setDailyTaskFilters}
            form={dailyTaskForm}
            setForm={setDailyTaskForm}
            formErrors={dailyTaskFormErrors}
            editingTaskId={editingDailyTaskId}
            handleSaveTask={handleSaveDailyTask}
            startEditingTask={startEditingDailyTask}
            resetDailyTaskForm={resetDailyTaskForm}
            requestDeleteDailyTask={requestDeleteDailyTask}
            requestVerifyDailyTask={requestVerifyDailyTask}
            handleQuickDailyTaskStatusUpdate={handleQuickDailyTaskStatusUpdate}
            busyAction={busyAction}
            loading={loading}
            error={error}
            canManageAllTasks={canManageDailyTasks}
            canVerifyDailyTasks={canVerifyDailyTasks}
            canDeleteDailyTasks={canDeleteDailyTasks}
            EmptyState={EmptyState}
            StatCard={StatCard}
            labelize={labelize}
            formatDate={formatDate}
            formatDateTime={formatDateTime}
          />
        </Suspense>
      ) : null}

      {currentView === "projects" ? (
        <Suspense fallback={<LazySectionFallback label="projects" />}>
          <ProjectsSection
            projectSummary={projectSummary}
            BadgeCard={BadgeCard}
            user={user}
            hasAnyRole={hasAnyRole}
            projectForm={projectForm}
            setProjectForm={setProjectForm}
            projectFormErrors={projectFormErrors}
            setProjectFormErrors={setProjectFormErrors}
            handleSaveProject={handleSaveProject}
            editingProjectId={editingProjectId}
            setEditingProjectId={setEditingProjectId}
            emptyProject={emptyProject}
            projectStatuses={projectStatuses}
            convertedLeadOptions={convertedLeadOptions}
            ListLoadControls={ListLoadControls}
            projects={projects}
            listLimits={listLimits}
            increaseListLimit={increaseListLimit}
            loading={loading}
            filteredProjects={filteredProjects}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            startEditingProject={startEditingProject}
            EmptyState={EmptyState}
            dispatchDrafts={dispatchDrafts}
            emptyDispatch={emptyDispatch}
            updateDispatchDraft={updateDispatchDraft}
            handleSaveDispatch={handleSaveDispatch}
            requestDispatchStatusUpdate={requestDispatchStatusUpdate}
            busyAction={busyAction}
            labelize={labelize}
            HighlightRow={HighlightRow}
            formatDateTime={formatDateTime}
            getProjectInvoicePdfUrl={getProjectInvoicePdfUrl}
            dispatchStatuses={dispatchStatuses}
            clearFieldErrorFromEvent={clearFieldErrorFromEvent}
            getFieldErrorClass={getFieldErrorClass}
          />
        </Suspense>
      ) : null}

      {currentView === "plumbing" ? (
        <section className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>Plumbing jobs</h2>
              <span>{plumbingSummary?.total_jobs ?? 0} tracked jobs</span>
            </div>
            <div className="tabs-row">
              <BadgeCard title="Ongoing" count={plumbingSummary?.ongoing_jobs ?? 0} tone="accent" />
              <BadgeCard title="Completed" count={plumbingSummary?.completed_jobs ?? 0} />
              <BadgeCard title="Plumbers" count={plumbingSummary?.total_plumbers ?? 0} />
              <BadgeCard title="Service Value" count={`Rs ${plumbingSummary?.total_plumbing_value ?? 0}`} tone="accent" />
            </div>
            <form className="form-grid" onSubmit={handleCreatePlumbingJob}>
              <select
                value={selectedLead?.id || plumbingJobForm.lead_id}
                onChange={(event) =>
                  setPlumbingJobForm({ ...plumbingJobForm, lead_id: event.target.value })
                }
                disabled={Boolean(selectedLead)}
              >
                <option value="">Select linked lead</option>
                {leads
                  .filter((lead) => lead.business_unit === "plumbing" || lead.business_unit === "both")
                  .map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name} | {lead.phone}
                    </option>
                  ))}
              </select>
              <select
                value={plumbingJobForm.plumber_id}
                onChange={(event) =>
                  setPlumbingJobForm({ ...plumbingJobForm, plumber_id: event.target.value })
                }
              >
                <option value="">Assign plumber later</option>
                {plumbers.map((plumber) => (
                  <option key={plumber.id} value={plumber.id}>
                    {plumber.name} | {plumber.area || "No area"}
                  </option>
                ))}
              </select>
              <select
                value={plumbingJobForm.work_type}
                onChange={(event) =>
                  setPlumbingJobForm({ ...plumbingJobForm, work_type: event.target.value })
                }
              >
                {plumbingWorkTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                value={plumbingJobForm.status}
                onChange={(event) =>
                  setPlumbingJobForm({ ...plumbingJobForm, status: event.target.value })
                }
              >
                {plumbingJobStatuses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Service charge"
                value={plumbingJobForm.service_charge}
                onChange={(event) =>
                  setPlumbingJobForm({ ...plumbingJobForm, service_charge: event.target.value })
                }
              />
              <input
                type="datetime-local"
                value={plumbingJobForm.scheduled_for}
                onChange={(event) =>
                  setPlumbingJobForm({ ...plumbingJobForm, scheduled_for: event.target.value })
                }
              />
              <textarea
                className="full-span"
                placeholder="Work note"
                value={plumbingJobForm.note}
                onChange={(event) =>
                  setPlumbingJobForm({ ...plumbingJobForm, note: event.target.value })
                }
              />
              <button className="full-span" type="submit" disabled={busyAction === "save-plumbing-job"}>
                {busyAction === "save-plumbing-job" ? "Saving Job..." : "Create Plumbing Job"}
              </button>
            </form>

            <div className="list">
              {filteredPlumbingJobs.map((job) => (
                <PlumbingJobCard
                  key={job.id}
                  job={job}
                  draft={plumbingMaterialDrafts[job.id] || emptyPlumbingMaterial}
                  onDraftChange={updatePlumbingMaterialDraft}
                  onAddMaterial={handleAddPlumbingMaterial}
                  onComplete={requestPlumbingJobComplete}
                  busyAction={busyAction}
                  onOpenLead={() => {
                    const target = leads.find((lead) => lead.id === job.lead_id);
                    if (target) {
                      // Open the lead inside the lead workspace (pipeline view),
                      // not the dashboard, which has no lead details panel.
                      handleSelectLead(target);
                      setCurrentView("pipeline");
                    }
                  }}
                  showLeadLink
                />
              ))}
              {filteredPlumbingJobs.length === 0 ? (
                <EmptyState title="No plumbing jobs yet" message="Create a plumbing job to start tracking service, material, and plumber cost." />
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>Plumber directory</h2>
              <span>{plumbers.length} active contacts</span>
            </div>
            <form className="form-grid" onSubmit={handleSavePlumber}>
              <input
                placeholder="Plumber name"
                value={plumberForm.name}
                onChange={(event) => setPlumberForm({ ...plumberForm, name: event.target.value })}
              />
              <input
                placeholder="Phone"
                value={plumberForm.phone}
                onChange={(event) => setPlumberForm({ ...plumberForm, phone: event.target.value })}
              />
              <input
                placeholder="Area"
                value={plumberForm.area}
                onChange={(event) => setPlumberForm({ ...plumberForm, area: event.target.value })}
              />
              <div className="lead-actions full-span">
                <button type="submit" disabled={busyAction === "save-plumber"}>
                  {busyAction === "save-plumber"
                    ? editingPlumberId
                      ? "Updating Plumber..."
                      : "Saving Plumber..."
                    : editingPlumberId
                      ? "Update Plumber"
                      : "Add Plumber"}
                </button>
                {editingPlumberId ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setEditingPlumberId(null);
                      setPlumberForm(emptyPlumber);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
            <div className="list">
              {plumbers.map((plumber) => (
                <article key={plumber.id} className="lead-card">
                  <div className="section-head">
                    <div>
                      <h3>{plumber.name}</h3>
                      <p className="muted">{plumber.phone}</p>
                    </div>
                    <span className="status-chip unit-chip unit-plumbing">Plumber</span>
                  </div>
                  <p>{plumber.area || "No area mapped yet."}</p>
                  <div className="lead-actions">
                    <button type="button" className="secondary" onClick={() => startEditingPlumber(plumber)}>
                      Edit
                    </button>
                  </div>
                </article>
              ))}
              {plumbers.length === 0 ? (
                <EmptyState title="No plumbers added" message="Save your plumber contacts here so jobs can be assigned quickly." />
              ) : null}
            </div>
          </section>
        </section>
      ) : null}

      {currentView === "billing" ? (
        <Suspense fallback={<LazySectionFallback label="billing" />}>
          <BillingSection
            billingSummary={billingSummary}
            billingReports={billingReports}
            billingReferenceOptions={billingReferenceOptions}
            billingInvoiceTypes={billingInvoiceTypes}
            billingItemTypes={billingItemTypes}
            billingStatuses={billingStatuses}
            billingPaymentStatuses={billingPaymentStatuses}
            billingPaymentModes={billingPaymentModes}
            invoiceForm={invoiceForm}
            setInvoiceForm={setInvoiceForm}
            invoiceFormErrors={invoiceFormErrors}
            setInvoiceFormErrors={setInvoiceFormErrors}
            editingInvoiceId={editingInvoiceId}
            handleSaveBillingInvoice={handleSaveBillingInvoice}
            handleCancelBillingEdit={handleCancelBillingEdit}
            addBillingInvoiceItem={addBillingInvoiceItem}
            removeBillingInvoiceItem={removeBillingInvoiceItem}
            handleBillingInvoiceItemChange={handleBillingInvoiceItemChange}
            handleBillingInventoryProductChange={handleBillingInventoryProductChange}
            handleBillingLeadReferenceChange={handleBillingLeadReferenceChange}
            handleBillingQuotationReferenceChange={handleBillingQuotationReferenceChange}
            handleBillingProjectReferenceChange={handleBillingProjectReferenceChange}
            getBillingTotals={getBillingTotals}
            computeBillingItemTotal={computeBillingItemTotal}
            busyAction={busyAction}
            filteredInvoices={filteredInvoices}
            invoices={invoices}
            ListLoadControls={ListLoadControls}
            listLimits={listLimits}
            increaseListLimit={increaseListLimit}
            loading={loading}
            billingSearch={billingSearch}
            setBillingSearch={setBillingSearch}
            billingStatusFilter={billingStatusFilter}
            setBillingStatusFilter={setBillingStatusFilter}
            billingPaymentFilter={billingPaymentFilter}
            setBillingPaymentFilter={setBillingPaymentFilter}
            billingFromFilter={billingFromFilter}
            setBillingFromFilter={setBillingFromFilter}
            billingToFilter={billingToFilter}
            setBillingToFilter={setBillingToFilter}
            selectedInvoice={selectedInvoice}
            handleOpenBillingInvoiceDetail={handleOpenBillingInvoiceDetail}
            startEditingBillingInvoice={startEditingBillingInvoice}
            requestSubmitBillingInvoiceApproval={requestSubmitBillingInvoiceApproval}
            requestReviewBillingInvoice={requestReviewBillingInvoice}
            requestCancelBillingInvoice={requestCancelBillingInvoice}
            requestDeleteBillingInvoice={requestDeleteBillingInvoice}
            billingPaymentForm={billingPaymentForm}
            setBillingPaymentForm={setBillingPaymentForm}
            handleSaveBillingPayment={handleSaveBillingPayment}
            formatDate={formatDate}
            formatDateTime={formatDateTime}
            labelize={labelize}
            getBillingPdfUrl={getBillingPdfUrl}
            getCsvExportUrl={getCsvExportUrl}
            shareOnWhatsApp={shareOnWhatsApp}
            user={user}
            hasAnyRole={hasAnyRole}
            EmptyState={EmptyState}
            HighlightRow={HighlightRow}
            BadgeCard={BadgeCard}
            StatCard={StatCard}
            clearFieldErrorFromEvent={clearFieldErrorFromEvent}
            getFieldErrorClass={getFieldErrorClass}
          />
        </Suspense>
      ) : null}

      {currentView === "expenses" ? (
        <section className="stack workspace-stack">
          <WorkspaceTabs
            value={expenseWorkspaceTab}
            onChange={setExpenseWorkspaceTab}
            tabs={[
              { value: "new", label: "New Entry" },
              { value: "ledger", label: "Ledger" },
              { value: "reports", label: "Reports" },
            ]}
          />

          {expenseWorkspaceTab === "new" ? (
            <section className="panel">
              <div className="section-head">
                <h2>Expense management</h2>
                <span>Operator and accounts entry</span>
              </div>
              <form
                className="form-grid"
                onSubmit={handleSaveExpense}
                onInputCapture={(event) => clearFieldErrorFromEvent(event, setExpenseFormErrors)}
                onChangeCapture={(event) => clearFieldErrorFromEvent(event, setExpenseFormErrors)}
              >
                <select
                  value={expenseForm.category}
                  onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })}
                >
                  {expenseCategories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <div className="form-field">
                  <input
                    data-field="expense_date"
                    className={getFieldErrorClass(expenseFormErrors, "expense_date")}
                    type="date"
                    value={expenseForm.expense_date}
                    onChange={(event) => setExpenseForm({ ...expenseForm, expense_date: event.target.value })}
                  />
                  {expenseFormErrors.expense_date ? <span className="field-error-message">{expenseFormErrors.expense_date}</span> : null}
                </div>
                <div className="form-field">
                  <input
                    data-field="amount"
                    className={getFieldErrorClass(expenseFormErrors, "amount")}
                    type="number"
                    placeholder="Amount"
                    value={expenseForm.amount}
                    onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
                  />
                  {expenseFormErrors.amount ? <span className="field-error-message">{expenseFormErrors.amount}</span> : null}
                </div>
                <select
                  value={expenseForm.paid_by}
                  onChange={(event) => setExpenseForm({ ...expenseForm, paid_by: event.target.value })}
                >
                  {expensePaymentModes.map((item) => (
                    <option key={item.value} value={item.value}>
                      Paid by: {item.label}
                    </option>
                  ))}
                </select>
                <textarea
                  className="full-span"
                  placeholder="Expense note"
                  value={expenseForm.note}
                  onChange={(event) => setExpenseForm({ ...expenseForm, note: event.target.value })}
                />
                <div className="lead-actions full-span">
                  <button type="submit" disabled={busyAction === "save-expense"}>
                    {busyAction === "save-expense"
                      ? editingExpenseId
                        ? "Updating Expense..."
                        : "Saving Expense..."
                      : editingExpenseId
                        ? "Update Expense"
                        : "Add Expense"}
                  </button>
                  {editingExpenseId ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setEditingExpenseId(null);
                        setExpenseForm(emptyExpense);
                        setExpenseFormErrors({});
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </section>
          ) : null}

          {expenseWorkspaceTab === "ledger" ? (
            <section className="panel">
              <div className="section-head">
                <h2>Expense ledger</h2>
                <span>{expenses.length} entries</span>
              </div>
              <div className="list">
                {expenses.map((expense) => (
                  <article key={expense.id} className="lead-card">
                    <div className="section-head">
                      <div>
                        <h3>{labelize(expense.category)}</h3>
                        <p className="muted">{formatDate(expense.expense_date)}</p>
                      </div>
                      <span className="status-chip">Rs {expense.amount}</span>
                    </div>
                    <p>{expense.note || "No note added."}</p>
                    <div className="lead-actions">
                      <button type="button" className="secondary" onClick={() => startEditingExpense(expense)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          setPendingDelete({
                            type: "expense",
                            id: expense.id,
                            entityLabel: "Expense",
                            message: `This will permanently remove the ${labelize(expense.category)} expense entry.`,
                            subtext: `${formatDate(expense.expense_date)} | Rs ${expense.amount}`,
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
                {expenses.length === 0 ? (
                  <EmptyState title="No expenses logged yet" message="Monthly costs like rent, salary, and transport will appear here." />
                ) : null}
              </div>
            </section>
          ) : null}

          {expenseWorkspaceTab === "reports" ? (
            <section className="panel">
              <div className="section-head">
                <h2>Expense reports</h2>
                <span>Profit impact and category watch</span>
              </div>
              <div className="tabs-row">
                <BadgeCard title="Gross Profit" count={`Rs ${expenseSummary?.gross_project_profit ?? 0}`} tone="accent" />
                <BadgeCard title="Monthly Expenses" count={`Rs ${expenseSummary?.monthly_expenses ?? 0}`} />
                <BadgeCard title="Net After Expenses" count={`Rs ${expenseSummary?.monthly_net_profit_after_expenses ?? 0}`} tone="accent" />
              </div>
              <div className="mini-list">
                {expenseCategorySummary.map((item) => (
                  <div key={item.category} className="timeline-item">
                    <strong>{labelize(item.category)}</strong>
                    <p className="muted">Expense category total</p>
                    <p>Rs {Number(item.amount || 0).toLocaleString("en-IN")}</p>
                  </div>
                ))}
                {!expenseCategorySummary.length ? <p className="muted">No expense analytics yet.</p> : null}
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {currentView === "purchases" ? (
        <section className="stack workspace-stack">
          <WorkspaceTabs
            value={purchaseWorkspaceTab}
            onChange={setPurchaseWorkspaceTab}
            tabs={[
              { value: "new_bill", label: "New Bill" },
              { value: "costing", label: "Costing / Lot" },
              { value: "ledger_reports", label: "Ledger & Reports" },
            ]}
          />

          {purchaseWorkspaceTab === "new_bill" ? (
          <section className="panel">
            <div className="section-head">
              <h2>Purchase Center - New Bill</h2>
              <span>Supplier invoice entry with multiple product rows.</span>
            </div>
            <form
              className="form-grid"
              onSubmit={handleSavePurchase}
              onInputCapture={(event) => clearFieldErrorFromEvent(event, setPurchaseFormErrors)}
              onChangeCapture={(event) => clearFieldErrorFromEvent(event, setPurchaseFormErrors)}
            >
              <div className="form-field full-span">
                <select
                  data-field="supplier_id"
                  className={getFieldErrorClass(purchaseFormErrors, "supplier_id")}
                  value={purchaseForm.supplier_id || ""}
                  onChange={(event) => handleSupplierSelect(event.target.value)}
                >
                  <option value="">Select Registered Supplier *</option>
                  {safeSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.city ? ` - ${s.city}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="secondary"
                  style={{ marginTop: "0.35rem", alignSelf: "flex-start", fontSize: "0.78rem", padding: "0.3rem 0.7rem" }}
                  onClick={() => setSupplierQuickAddOpen((prev) => !prev)}
                >
                  {supplierQuickAddOpen ? "Cancel new supplier" : "+ Add Supplier"}
                </button>
                {supplierQuickAddOpen ? (
                  <div className="purchase-intelligence-panel inline compact full-span" style={{ display: "grid", gap: "0.4rem" }}>
                    <strong style={{ fontSize: "0.85rem" }}>Register a new supplier</strong>
                    <input
                      placeholder="Supplier name *"
                      value={supplierQuickForm.name}
                      onChange={(e) => setSupplierQuickForm({ ...supplierQuickForm, name: e.target.value })}
                    />
                    <input
                      placeholder="Mobile *"
                      value={supplierQuickForm.mobile}
                      onChange={(e) => setSupplierQuickForm({ ...supplierQuickForm, mobile: e.target.value })}
                    />
                    <input
                      placeholder="City"
                      value={supplierQuickForm.city}
                      onChange={(e) => setSupplierQuickForm({ ...supplierQuickForm, city: e.target.value })}
                    />
                    <input
                      placeholder="GSTIN (optional)"
                      value={supplierQuickForm.gstin}
                      onChange={(e) => setSupplierQuickForm({ ...supplierQuickForm, gstin: e.target.value })}
                    />
                    <button type="button" onClick={handleQuickAddSupplier} disabled={supplierQuickSaving}>
                      {supplierQuickSaving ? "Saving..." : "Save & Use"}
                    </button>
                  </div>
                ) : null}
                {purchaseFormErrors.supplier_id ? (
                  <span className="field-error-message">{purchaseFormErrors.supplier_id}</span>
                ) : null}
              </div>
              <div className="purchase-supplier-meta-grid full-span">
                <div className="purchase-supplier-meta-item">
                  <span className="purchase-supplier-meta-label">Supplier Mobile</span>
                  <strong className="purchase-supplier-meta-value">{selectedPurchaseSupplier?.mobile || purchaseForm.supplier_phone || "-"}</strong>
                </div>
                <div className="purchase-supplier-meta-item">
                  <span className="purchase-supplier-meta-label">City</span>
                  <strong className="purchase-supplier-meta-value">{selectedPurchaseSupplier?.city || "-"}</strong>
                </div>
                <div className="purchase-supplier-meta-item">
                  <span className="purchase-supplier-meta-label">GSTIN</span>
                  <strong className="purchase-supplier-meta-value">{selectedPurchaseSupplier?.gstin || "-"}</strong>
                </div>
              </div>
              <input
                placeholder="Invoice No *"
                value={purchaseForm.invoice_number}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, invoice_number: event.target.value })
                }
              />
              <div className="form-field">
                <input
                  data-field="purchase_date"
                  className={getFieldErrorClass(purchaseFormErrors, "purchase_date")}
                  type="date"
                  value={purchaseForm.purchase_date || new Date().toISOString().slice(0, 10)}
                  onChange={(event) =>
                    setPurchaseForm({ ...purchaseForm, purchase_date: event.target.value })
                  }
                />
                {purchaseFormErrors.purchase_date ? <span className="field-error-message">{purchaseFormErrors.purchase_date}</span> : null}
              </div>
              <div className="form-field">
                <input
                  data-field="truck_number"
                  className={getFieldErrorClass(purchaseFormErrors, "truck_number")}
                  placeholder="Truck Number *"
                  value={purchaseForm.truck_number}
                  onChange={(event) => setPurchaseForm({ ...purchaseForm, truck_number: event.target.value })}
                />
                {purchaseFormErrors.truck_number ? <span className="field-error-message">{purchaseFormErrors.truck_number}</span> : null}
              </div>
              <div className="form-field">
                <input
                  data-field="delivery_date"
                  className={getFieldErrorClass(purchaseFormErrors, "delivery_date")}
                  type="date"
                  value={purchaseForm.delivery_date || purchaseForm.purchase_date || new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setPurchaseForm({ ...purchaseForm, delivery_date: event.target.value })}
                />
                {purchaseFormErrors.delivery_date ? <span className="field-error-message">{purchaseFormErrors.delivery_date}</span> : null}
              </div>
              <select
                value={purchaseForm.payment_status}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, payment_status: event.target.value })
                }
              >
                {purchasePaymentStatuses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <textarea
                className="full-span"
                placeholder="Remarks (optional)"
                value={purchaseForm.remarks}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, remarks: event.target.value })
                }
              />
              <section className="panel panel-nested full-span">
                <div className="section-head">
                  <div>
                    <h3>Purchase Items</h3>
                    <p className="muted">One supplier invoice can contain multiple products.</p>
                  </div>
                  {!editingPurchaseId ? (
                    <button type="button" className="secondary" onClick={addPurchaseItemRow}>
                      + Add Product Row
                    </button>
                  ) : null}
                </div>
                <div className="stack">
                  {safePurchaseItems.map((item, index) => {
                    const selectedProduct = item.product_id ? purchaseEntryProductMap.get(Number(item.product_id)) || null : null;

                    return (
                      <div key={`purchase-item-${index}`} className="purchase-item-shell">
                        <div className="purchase-item-scroll">
                          <div className="purchase-item-line">
                            <div className="form-field purchase-item-product-field">
                              <div className="purchase-product-pickrow">
                                <select
                                  data-field={`items.${index}.product_id`}
                                  className={getFieldErrorClass(purchaseFormErrors, `items.${index}.product_id`)}
                                  value={item.product_id}
                                  onChange={(event) => handlePurchaseProductSelect(index, event.target.value)}
                                  style={{ flex: 1 }}
                                >
                                  <option value="">Select Inventory Product *</option>
                                  {purchaseEntryProductOptions.map((product) => (
                                    <option key={product.id} value={product.id}>
                                      {product.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {selectedProduct ? (
                                <p className="muted purchase-item-product-meta">
                                  {labelize(selectedProduct.category || "tiles")} | {selectedProduct.company_name || "No company"} | {selectedProduct.product_size || "No size"} | {(selectedProduct.unit || item.unit || "pcs").toUpperCase()} | Last rate Rs {Number(selectedProduct.last_purchase_rate || 0).toLocaleString("en-IN")}
                                </p>
                              ) : null}
                              {purchaseFormErrors[`items.${index}.product_id`] ? (
                                <span className="field-error-message">{purchaseFormErrors[`items.${index}.product_id`]}</span>
                              ) : null}
                            </div>
                            <div className="purchase-item-add-cell">
                              <button
                                type="button"
                                className="secondary purchase-inline-btn"
                                onClick={() => {
                                  if (quickProductRowIndex === index) {
                                    setQuickProductRowIndex(null);
                                  } else {
                                    setQuickProductRowIndex(index);
                                    setQuickProductForm(emptyQuickProduct);
                                  }
                                }}
                              >
                                {quickProductRowIndex === index ? "Cancel" : "+ Add"}
                              </button>
                            </div>
                            <input
                              data-field={`items.${index}.quantity`}
                              className={getFieldErrorClass(purchaseFormErrors, `items.${index}.quantity`)}
                              type="number"
                              step="0.01"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(event) => {
                                const newQty = event.target.value;
                                const auto = recalcPurchaseNetFromRate(newQty, item.rate_per_unit);
                                updatePurchaseItem(index, {
                                  quantity: newQty,
                                  amount: auto != null ? String(auto) : item.amount,
                                  total_amount:
                                    auto != null
                                      ? String(Number((auto + Number(item.gst_amount || 0)).toFixed(2)))
                                      : item.total_amount,
                                });
                              }}
                            />
                            <select
                              data-field={`items.${index}.unit`}
                              className={getFieldErrorClass(purchaseFormErrors, `items.${index}.unit`)}
                              value={(selectedProduct?.unit || item.unit || "pcs").toLowerCase()}
                              onChange={(event) => updatePurchaseItem(index, { unit: event.target.value })}
                              disabled={Boolean(selectedProduct?.unit)}
                              title={selectedProduct?.unit ? "Unit inherits from selected product" : ""}
                            >
                              {purchaseUnitOptions.map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                            <div className="form-field">
                              <input
                                data-field={`items.${index}.batch_no`}
                                className={getFieldErrorClass(purchaseFormErrors, `items.${index}.batch_no`)}
                                placeholder={selectedProduct ? buildPurchaseBatchSuggestion(selectedProduct, purchaseForm.purchase_date, index) : "Batch / Lot"}
                                value={item.batch_no || ""}
                                onChange={(event) => updatePurchaseItem(index, { batch_no: event.target.value })}
                              />
                              {purchaseFormErrors[`items.${index}.batch_no`] ? (
                                <span className="field-error-message">{purchaseFormErrors[`items.${index}.batch_no`]}</span>
                              ) : null}
                            </div>
                            <input
                              data-field={`items.${index}.rate_per_unit`}
                              type="number"
                              step="0.01"
                              placeholder="Rate"
                              value={item.rate_per_unit}
                              onChange={(event) => {
                                const newRate = event.target.value;
                                const auto = recalcPurchaseNetFromRate(item.quantity, newRate);
                                updatePurchaseItem(index, {
                                  rate_per_unit: newRate,
                                  amount: auto != null ? String(auto) : item.amount,
                                  total_amount:
                                    auto != null
                                      ? String(Number((auto + Number(item.gst_amount || 0)).toFixed(2)))
                                      : item.total_amount,
                                });
                              }}
                            />
                            <div className="form-field">
                              <input
                                data-field={`items.${index}.amount`}
                                className={getFieldErrorClass(purchaseFormErrors, `items.${index}.amount`)}
                                type="number"
                                step="0.01"
                                placeholder="Net"
                                value={item.amount}
                                onChange={(event) =>
                                  updatePurchaseItem(index, {
                                    amount: event.target.value,
                                    total_amount: String(
                                      Number((Number(event.target.value || 0) + Number(item.gst_amount || 0)).toFixed(2))
                                    ),
                                  })
                                }
                              />
                              {purchaseFormErrors[`items.${index}.amount`] ? (
                                <span className="field-error-message">{purchaseFormErrors[`items.${index}.amount`]}</span>
                              ) : null}
                            </div>
                            <select
                              value={item.gst_percent != null && item.gst_percent !== "" ? String(item.gst_percent) : ""}
                              onChange={(event) => {
                                const pct = event.target.value;
                                const net = Number(item.amount || 0);
                                const gstAmt = pct === "" ? 0 : Number(((net * Number(pct)) / 100).toFixed(2));
                                updatePurchaseItem(index, {
                                  gst_percent: pct,
                                  gst_amount: pct === "" ? "" : String(gstAmt),
                                  total_amount: String(Number((net + gstAmt).toFixed(2))),
                                });
                              }}
                              title="GST percentage"
                            >
                              <option value="">GST %</option>
                              {purchaseGstPercentOptions.map((p) => (
                                <option key={p} value={p}>{p}%</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Total"
                              value={item.total_amount}
                              onChange={(event) => updatePurchaseItem(index, { total_amount: event.target.value })}
                            />
                            <div className="purchase-item-remove-cell">
                              {!editingPurchaseId && safePurchaseItems.length > 1 ? (
                                <button type="button" className="secondary danger-soft purchase-inline-btn" onClick={() => removePurchaseItemRow(index)}>
                                  Remove
                                </button>
                              ) : (
                                <span className="purchase-row-index">#{index + 1}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {quickProductRowIndex === index ? (
                          <div className="purchase-quick-add-panel">
                            <strong>Quick add new product</strong>
                            <div className="form-grid quick-add-grid">
                              <input placeholder="Product name *" value={quickProductForm.name} onChange={(e) => setQuickProductForm({ ...quickProductForm, name: e.target.value })} />
                              <select value={quickProductForm.category} onChange={(e) => setQuickProductForm({ ...quickProductForm, category: e.target.value })}>
                                {defaultProductCategories.map((categoryOption) => (
                                  <option key={categoryOption} value={categoryOption}>{categoryOption}</option>
                                ))}
                              </select>
                              <select value={quickProductForm.unit} onChange={(e) => setQuickProductForm({ ...quickProductForm, unit: e.target.value })}>
                                {purchaseUnitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                              </select>
                              <input type="number" step="0.01" min="0" placeholder="Current Stock *" value={quickProductForm.stock_sqft} onChange={(e) => setQuickProductForm({ ...quickProductForm, stock_sqft: e.target.value })} />
                              <input placeholder="Design Code *" value={quickProductForm.design_code} onChange={(e) => setQuickProductForm({ ...quickProductForm, design_code: e.target.value })} />
                              <select value={quickProductForm.finish} onChange={(e) => setQuickProductForm({ ...quickProductForm, finish: e.target.value })}>
                                <option value="">Select Finish *</option>
                                {defaultProductFinishes.map((finishOption) => (
                                  <option key={finishOption} value={finishOption}>{finishOption}</option>
                                ))}
                              </select>
                              <input placeholder="Company (optional)" value={quickProductForm.company_name} onChange={(e) => setQuickProductForm({ ...quickProductForm, company_name: e.target.value })} />
                              <input placeholder="Size (optional)" value={quickProductForm.product_size} onChange={(e) => setQuickProductForm({ ...quickProductForm, product_size: e.target.value })} />
                              <input type="number" step="0.01" min="0" placeholder="Pieces / Box" value={quickProductForm.pieces_per_box} onChange={(e) => setQuickProductForm({ ...quickProductForm, pieces_per_box: e.target.value })} />
                              <input type="number" step="0.01" min="0" placeholder="Sqft / Box" value={quickProductForm.sqft_per_box} onChange={(e) => setQuickProductForm({ ...quickProductForm, sqft_per_box: e.target.value })} />
                              <input type="number" step="0.01" min="0" placeholder="Weight / Box" value={quickProductForm.weight_per_box} onChange={(e) => setQuickProductForm({ ...quickProductForm, weight_per_box: e.target.value })} />
                            </div>
                            <div className="quick-add-actions">
                              <button type="button" onClick={(ev) => handleQuickAddProduct(ev, index)} disabled={quickProductSaving}>
                                {quickProductSaving ? "Saving..." : "Save & Use"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {purchaseFormErrors.items ? <span className="field-error-message">{purchaseFormErrors.items}</span> : null}
                </div>
              </section>
              <section className="panel panel-nested full-span">
                <div className="section-head">
                  <div>
                    <h3>Truck Strip</h3>
                    <p className="muted">Freight and handling values can flow directly into Costing / Lot.</p>
                  </div>
                  {Number(purchaseCostingForm.total_freight_cost || 0) > 0 ? (
                    <span className="status-chip status-pending">Freight entered - costing lot ready</span>
                  ) : null}
                </div>
                <div className="form-grid">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Freight"
                    value={purchaseCostingForm.total_freight_cost}
                    onChange={(event) => updatePurchaseCostingField("total_freight_cost", event.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Unloading"
                    value={purchaseCostingForm.total_unloading_cost}
                    onChange={(event) => updatePurchaseCostingField("total_unloading_cost", event.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Interest"
                    value={purchaseCostingForm.interest_cost_override}
                    onChange={(event) => updatePurchaseCostingField("interest_cost_override", event.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Overhead"
                    value={purchaseCostingForm.showroom_overhead_amount}
                    onChange={(event) => updatePurchaseCostingField("showroom_overhead_amount", event.target.value)}
                  />
                </div>
              </section>
              <div className="lead-actions full-span">
                <button
                  type="submit"
                  disabled={busyAction === "save-purchase"}
                  onClick={() => {
                    purchasePostSaveActionRef.current = editingPurchaseId ? "draft" : "draft";
                  }}
                >
                  {busyAction === "save-purchase"
                    ? editingPurchaseId
                      ? "Updating Purchase..."
                      : "Saving Draft..."
                    : editingPurchaseId
                      ? "Update Purchase"
                      : "Save Draft"}
                </button>
                {!editingPurchaseId ? (
                  <>
                    <button
                      type="submit"
                      className="secondary"
                      disabled={busyAction === "save-purchase"}
                      onClick={() => {
                        purchasePostSaveActionRef.current = "new";
                      }}
                    >
                      Save & New
                    </button>
                    <button
                      type="submit"
                      className="secondary"
                      disabled={busyAction === "save-purchase"}
                      onClick={() => {
                        purchasePostSaveActionRef.current = "approval";
                      }}
                    >
                      Send for Approval
                    </button>
                  </>
                ) : null}
                {editingPurchaseId ? (
                  <button type="button" className="secondary" onClick={handleCancelEditPurchase}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>
          ) : null}

          {purchaseWorkspaceTab === "ledger_reports" ? (
          <section className="stack">
          <section className="panel">
            <div className="section-head">
              <h2>Ledger & Reports</h2>
              <span>{filteredPurchaseLedgerInvoices.length} invoices shown</span>
            </div>
            <div className="filter-row">
              <select value={purchaseSupplierFilter} onChange={(event) => setPurchaseSupplierFilter(event.target.value)}>
                <option value="all">All suppliers</option>
                {safeSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Invoice filter"
                value={purchaseInvoiceFilter}
                onChange={(event) => setPurchaseInvoiceFilter(event.target.value)}
              />
              <select value={purchaseProductFilter} onChange={(event) => setPurchaseProductFilter(event.target.value)}>
                <option value="all">All products</option>
                {purchaseEntryProductOptions.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={purchaseFromFilter}
                onChange={(event) => setPurchaseFromFilter(event.target.value)}
              />
              <input
                type="date"
                value={purchaseToFilter}
                onChange={(event) => setPurchaseToFilter(event.target.value)}
              />
            </div>
            <div className="filter-row">
              <input
                placeholder="Search supplier, invoice, item"
                value={purchaseSearch}
                onChange={(event) => setPurchaseSearch(event.target.value)}
              />
              <select
                value={purchasePaymentFilter}
                onChange={(event) => setPurchasePaymentFilter(event.target.value)}
              >
                <option value="all">All payment statuses</option>
                {purchasePaymentStatuses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Invoice</th>
                    <th>Items</th>
                    <th>Qty</th>
                    <th>Taxable</th>
                    <th>GST</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchaseLedgerInvoices.map((record) => {
                    const isExpanded = Boolean(expandedPurchaseInvoiceGroups[record.group_key]);
                    const itemNames = Array.isArray(record.item_names) ? record.item_names : [];
                    return (
                      <Fragment key={record.group_key}>
                        <tr>
                          <td>{formatDate(record.purchase_date)}</td>
                          <td>
                            <strong>{record.supplier_name}</strong>
                            <div className="muted">{record.supplier_phone || ""}</div>
                          </td>
                          <td>{record.invoice_number || "-"}</td>
                          <td>
                            <strong>{record.item_count || 0} items</strong>
                            <div className="muted">
                              {itemNames.length ? itemNames.slice(0, 2).join(", ") : "No items"}
                            </div>
                          </td>
                          <td>{Number(record.total_quantity || 0).toLocaleString("en-IN")}</td>
                          <td>Rs {Number(record.total_taxable_amount || 0).toLocaleString("en-IN")}</td>
                          <td>Rs {Number(record.gst_total || 0).toLocaleString("en-IN")}</td>
                          <td>
                            <strong>Rs {Number(record.grand_total || 0).toLocaleString("en-IN")}</strong>
                          </td>
                          <td>
                            <span className={`status-chip status-${record.payment_status}`}>
                              {labelize(record.payment_status)}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => togglePurchaseInvoiceGroup(record.group_key)}
                            >
                              {isExpanded ? "Hide Items" : "View Items"}
                            </button>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr className="purchase-ledger-detail-row">
                            <td colSpan={10}>
                              <div className="purchase-ledger-detail-list">
                                {(record.items || []).map((item) => (
                                  <div key={item.id} className="purchase-ledger-detail-item">
                                    <div>
                                      <strong>{item.item_name || "-"}</strong>
                                      <div className="muted">
                                        {[item.category || "", item.batch_no ? `Batch ${item.batch_no}` : "", `${item.quantity} ${item.unit}`]
                                          .filter(Boolean)
                                          .join(" | ")}
                                      </div>
                                    </div>
                                    <div className="purchase-ledger-detail-amounts muted">
                                      <span>Taxable Rs {Number(item.amount || 0).toLocaleString("en-IN")}</span>
                                      <span>GST Rs {Number(item.gst_amount || 0).toLocaleString("en-IN")}</span>
                                      <span>Total Rs {Number(item.total_amount || 0).toLocaleString("en-IN")}</span>
                                    </div>
                                    <div className="table-actions">
                                      <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => handleEditPurchase(item)}
                                      >
                                        Edit
                                      </button>
                                      {isAdmin(user) ? (
                                        <button
                                          type="button"
                                          className="danger"
                                          onClick={() =>
                                            setPendingDelete({
                                              type: "purchase",
                                              id: item.id,
                                              entityLabel: "Purchase",
                                              message: `Remove purchase entry for supplier ${item.supplier_name}?`,
                                              subtext: `${formatDate(item.purchase_date)} | Rs ${item.total_amount}`,
                                            })
                                          }
                                        >
                                          Delete
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                  {filteredPurchaseLedgerInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <EmptyState
                          title="No purchase entries yet"
                          message="Add a supplier invoice to start tracking purchases for the showroom."
                        />
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            </section>
            <section className="panel">
              <div className="section-head">
                <h2>Supplier ledger</h2>
                <span>Top supplier spend from current filters</span>
              </div>
              <div className="mini-list">
                {purchaseSupplierSummary.map((item) => (
                  <div key={`${item.supplier_id}-${item.supplier_name}`} className="timeline-item">
                    <strong>{item.supplier_name}</strong>
                    <p className="muted">{item.entries} invoice rows</p>
                    <p>Rs {Number(item.amount || 0).toLocaleString("en-IN")}</p>
                  </div>
                ))}
                {!purchaseSupplierSummary.length ? <p className="muted">No supplier summary for the current filters.</p> : null}
              </div>
            </section>
            <section className="panel">
              <div className="section-head">
                <h2>Purchase reports</h2>
                <span>Supplier spend and payment mix</span>
              </div>
              <div className="tabs-row">
                <BadgeCard title="Total Value" count={`Rs ${Number(purchaseSummary?.total_amount || 0).toLocaleString("en-IN")}`} tone="accent" />
                <BadgeCard title="Pending Payment" count={`Rs ${Number(purchaseSummary?.pending_amount || 0).toLocaleString("en-IN")}`} />
                <BadgeCard title="Paid" count={`Rs ${Number(purchaseSummary?.paid_amount || 0).toLocaleString("en-IN")}`} tone="accent" />
                <BadgeCard title="GST" count={`Rs ${Number(purchaseSummary?.gst_amount || 0).toLocaleString("en-IN")}`} />
              </div>
              <div className="mini-list">
                {purchaseCategorySummary.map((item) => (
                  <div key={item.category} className="timeline-item">
                    <strong>{labelize(item.category)}</strong>
                    <p className="muted">Purchase category total</p>
                    <p>Rs {Number(item.amount || 0).toLocaleString("en-IN")}</p>
                  </div>
                ))}
                {!purchaseCategorySummary.length ? <p className="muted">No purchase analytics yet.</p> : null}
              </div>
            </section>
          </section>
          ) : null}

          {purchaseWorkspaceTab === "costing" ? (
          <Suspense fallback={<LazySectionFallback label="purchase costing" />}>
            <PurchaseCostingSection
              purchaseCostingSummary={purchaseCostingSummary}
              purchaseCostingReports={purchaseCostingReports}
              purchaseCostingProductOptions={purchaseCostingProductOptions}
              purchaseIntelligenceCache={purchaseIntelligenceCache}
              purchaseIntelligenceLoading={purchaseIntelligenceLoading}
              purchaseCostingForm={purchaseCostingForm}
              purchaseCostingFormErrors={purchaseCostingFormErrors}
              editingPurchaseLotId={editingPurchaseLotId}
              selectedPurchaseLot={selectedPurchaseLot}
              setSelectedPurchaseLot={setSelectedPurchaseLot}
              updatePurchaseCostingField={updatePurchaseCostingField}
              updatePurchaseCostingSupplier={updatePurchaseCostingSupplier}
              updatePurchaseCostingItem={updatePurchaseCostingItem}
              handlePurchaseCostingProductChange={handlePurchaseCostingProductChange}
              fetchPurchaseProductIntelligence={fetchPurchaseProductIntelligence}
              addPurchaseCostingSupplier={addPurchaseCostingSupplier}
              removePurchaseCostingSupplier={removePurchaseCostingSupplier}
              addPurchaseCostingItem={addPurchaseCostingItem}
              removePurchaseCostingItem={removePurchaseCostingItem}
              handleSavePurchaseCostingLot={handleSavePurchaseCostingLot}
              handleCancelPurchaseCostingEdit={handleCancelPurchaseCostingEdit}
              handleOpenPurchaseLotDetail={handleOpenPurchaseLotDetail}
              startEditingPurchaseCostingLot={startEditingPurchaseCostingLot}
              handleApprovePurchaseLot={handleApprovePurchaseLot}
              handleCancelPurchaseLot={handleCancelPurchaseLot}
              filteredPurchaseLots={filteredPurchaseLots}
              purchaseLotSearch={purchaseLotSearch}
              setPurchaseLotSearch={setPurchaseLotSearch}
              purchaseLotStatusFilter={purchaseLotStatusFilter}
              setPurchaseLotStatusFilter={setPurchaseLotStatusFilter}
              linkedPurchaseBills={linkedPurchaseBills}
              linkedPurchaseBillsLoading={linkedPurchaseBillsLoading}
              listLimits={listLimits}
              increaseListLimit={increaseListLimit}
              ListLoadControls={ListLoadControls}
              busyAction={busyAction}
              loading={loading}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
              EmptyState={EmptyState}
              HighlightRow={HighlightRow}
              StatCard={StatCard}
              clearFieldErrorFromEvent={clearFieldErrorFromEvent}
              getFieldErrorClass={getFieldErrorClass}
              user={user}
              hasAnyRole={hasAnyRole}
            />
          </Suspense>
          ) : null}
        </section>
      ) : null}

      {currentView === "complaints" ? (
        <section className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>Complaint management</h2>
              <span>
                {complaintSummary?.plumbing_complaints ?? 0} plumbing | {complaintSummary?.tiles_complaints ?? 0} tiles
              </span>
            </div>
            <ListLoadControls
              label="Complaints"
              count={complaints.length}
              limit={listLimits.complaints}
              onLoadMore={() => increaseListLimit("complaints")}
              disabled={loading}
            />
            <div className="tabs-row">
              <BadgeCard title="Open" count={complaintSummary?.open_complaints ?? 0} tone="accent" />
              <BadgeCard title="Urgent" count={complaintSummary?.urgent_complaints ?? 0} tone="danger" />
              <BadgeCard title="Closed" count={complaintSummary?.closed_complaints ?? 0} />
              <BadgeCard title="Plumbing" count={complaintSummary?.plumbing_complaints ?? 0} tone="accent" />
            </div>
            <div className="chip-row form-preview-row">
              <span className={`status-chip unit-chip unit-${complaintForm.business_unit}`}>
                {labelize(complaintForm.business_unit)}
              </span>
              <span className={`status-chip priority-chip priority-${complaintForm.priority}`}>
                {labelize(complaintForm.priority)}
              </span>
              <span className={`status-chip status-${complaintForm.status}`}>
                {labelize(complaintForm.status)}
              </span>
            </div>
            <form className="form-grid" onSubmit={handleSaveComplaint}>
              <select
                value={complaintForm.lead_id}
                onChange={(event) => setComplaintForm({ ...complaintForm, lead_id: event.target.value })}
              >
                <option value="">No linked lead</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} | {lead.phone}
                  </option>
                ))}
              </select>
              <input
                placeholder="Customer name"
                value={complaintForm.customer_name}
                onChange={(event) =>
                  setComplaintForm({ ...complaintForm, customer_name: event.target.value })
                }
              />
              <input
                placeholder="Phone"
                value={complaintForm.phone}
                onChange={(event) => setComplaintForm({ ...complaintForm, phone: event.target.value })}
              />
              <input
                placeholder="Location"
                value={complaintForm.location}
                onChange={(event) => setComplaintForm({ ...complaintForm, location: event.target.value })}
              />
              <select
                className={`unit-input unit-${complaintForm.business_unit}`}
                value={complaintForm.business_unit}
                onChange={(event) =>
                  setComplaintForm({ ...complaintForm, business_unit: event.target.value })
                }
              >
                <option value="plumbing">Plumbing</option>
                <option value="tiles">Tiles</option>
                <option value="both">Tiles + Plumbing</option>
              </select>
              <select
                value={complaintForm.category}
                onChange={(event) =>
                  setComplaintForm({ ...complaintForm, category: event.target.value })
                }
              >
                {complaintCategories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className={`priority-input priority-${complaintForm.priority}`}
                value={complaintForm.priority}
                onChange={(event) =>
                  setComplaintForm({ ...complaintForm, priority: event.target.value })
                }
              >
                {complaintPriorities.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                value={complaintForm.status}
                onChange={(event) => setComplaintForm({ ...complaintForm, status: event.target.value })}
              >
                {complaintStatuses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                placeholder="Complaint title"
                value={complaintForm.title}
                onChange={(event) => setComplaintForm({ ...complaintForm, title: event.target.value })}
              />
              <input
                type="datetime-local"
                value={complaintForm.due_date}
                onChange={(event) => setComplaintForm({ ...complaintForm, due_date: event.target.value })}
              />
              <select
                value={complaintForm.assigned_to}
                onChange={(event) =>
                  setComplaintForm({ ...complaintForm, assigned_to: event.target.value })
                }
              >
                <option value="">Unassigned</option>
                {users.map((teamMember) => (
                  <option key={teamMember.id} value={teamMember.id}>
                    {teamMember.name}
                  </option>
                ))}
              </select>
              <textarea
                className="full-span"
                placeholder="Complaint description"
                value={complaintForm.description}
                onChange={(event) =>
                  setComplaintForm({ ...complaintForm, description: event.target.value })
                }
              />
              <textarea
                className="full-span"
                placeholder="Resolution note"
                value={complaintForm.resolution_note}
                onChange={(event) =>
                  setComplaintForm({ ...complaintForm, resolution_note: event.target.value })
                }
              />
              <div className="lead-actions full-span">
                <button type="submit" disabled={isSavingComplaint}>
                  {isSavingComplaint
                    ? "Saving..."
                    : editingComplaintId
                      ? "Update Complaint"
                      : "Save Complaint"}
                </button>
                {editingComplaintId ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={isSavingComplaint}
                    onClick={() => {
                      setEditingComplaintId(null);
                      setComplaintForm(emptyComplaint);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>Complaint board</h2>
              <span>{filteredComplaints.length} complaints in current view</span>
            </div>
            <div className="list">
              {filteredComplaints.map((complaint) => (
                <article
                  key={complaint.id}
                  className={`lead-card unit-${complaint.business_unit} priority-${complaint.priority}`}
                >
                  <div className="section-head">
                    <div>
                      <h3>{complaint.title}</h3>
                      <p className="muted">
                        {complaint.customer_name} | {complaint.phone}
                      </p>
                    </div>
                    <span className={`status-chip status-${complaint.status}`}>{labelize(complaint.status)}</span>
                  </div>
                  <div className="chip-row">
                    <span className={`status-chip unit-chip unit-${complaint.business_unit}`}>
                      {labelize(complaint.business_unit)}
                    </span>
                    <span className={`status-chip priority-chip priority-${complaint.priority}`}>
                      {labelize(complaint.priority)}
                    </span>
                    <span className="status-chip">{labelize(complaint.category)}</span>
                  </div>
                  <p>{complaint.description}</p>
                  <p className="muted">
                    {complaint.location || "No location"} | {complaint.assigned_to_name || "Unassigned"} | Due{" "}
                    {formatDateTime(complaint.due_date)}
                  </p>
                  {complaint.operation_task_title ? (
                    <p className="muted">
                      Linked ops task: {complaint.operation_task_title} |{" "}
                      {labelize(complaint.operation_task_status)}
                    </p>
                  ) : null}
                  {complaint.resolution_note ? <p className="muted">Resolution: {complaint.resolution_note}</p> : null}
                  <div className="lead-actions">
                    <button type="button" className="secondary" onClick={() => startEditingComplaint(complaint)}>
                      Edit
                    </button>
                    {!complaint.operation_task_id &&
                    complaint.lead_id &&
                    complaint.status !== "resolved" &&
                    complaint.status !== "closed" &&
                    (complaint.business_unit === "plumbing" || complaint.business_unit === "both") ? (
                      <button type="button" onClick={() => createComplaintOperationsTask(complaint)}>
                        Create Ops Task
                      </button>
                    ) : null}
                    {complaint.status !== "resolved" && complaint.status !== "closed" ? (
                      <button type="button" onClick={() => requestResolveComplaint(complaint)}>
                        Mark Resolved
                      </button>
                    ) : null}
                    {isAdmin(user) ? (
                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          setPendingDelete({
                            type: "complaint",
                            id: complaint.id,
                            entityLabel: "Complaint",
                            message: `This will permanently remove the complaint for ${complaint.customer_name}.`,
                            subtext: complaint.title,
                          })
                        }
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {filteredComplaints.length === 0 ? (
                <p className="muted">No complaints logged for the current filters.</p>
              ) : null}
            </div>
          </section>
        </section>
      ) : null}

      {currentView === "quotations" ? (
        <section className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>Quotation tracker</h2>
              <span>{selectedLead ? `Customer: ${selectedLead.name}` : "Choose a lead first"}</span>
            </div>
            {selectedLead ? (
              <div className="list">
                {quotations.map((quotation) => (
                <article
                  key={quotation.id}
                  className={`lead-card unit-${selectedLead?.business_unit || "tiles"}`}
                >
                    <div className="section-head">
                      <h3>Quote #{quotation.id}</h3>
                      <span className={`status-chip status-${quotation.status}`}>
                        {labelize(quotation.status)}
                      </span>
                    </div>
                    <p className="muted">
                      Subtotal Rs {quotation.subtotal} | Discount Rs {quotation.discount} |
                      Transport Rs {quotation.transport_cost}
                    </p>
                    <strong>Final Rs {quotation.final_amount}</strong>
                    <div className="lead-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => window.open(getQuotationPdfUrl(selectedLead.id, quotation.id), "_blank")}
                      >
                        Open PDF
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          shareOnWhatsApp(
                            selectedLead.phone,
                            buildQuotationWhatsAppMessage(selectedLead, quotation)
                          )
                        }
                      >
                        Share Quote
                      </button>
                    </div>
                    <div className="quote-items">
                      {quotation.items.map((item) => (
                        <div key={item.id} className="timeline-item">
                          <strong>{item.product_name}</strong>
                          <p className="muted">
                            {item.tile_size || "Standard"} | {item.quantity_sqft} sqft | Rs{" "}
                            {item.unit_price}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">Choose a lead from Dashboard to generate and review quotations.</p>
            )}
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>Dealer partners</h2>
              <span>{dealers.length} tracked</span>
            </div>
            <div className="dealer-grid">
              {dealers.map((dealer) => (
                <article key={dealer.id} className="lead-card">
                  <div className="section-head">
                    <h3>{dealer.name}</h3>
                    <span className="status-chip">{dealer.category}</span>
                  </div>
                  <p className="muted">{dealer.area}</p>
                  <p>Monthly Rs {dealer.monthly_purchase}</p>
                  <p>Outstanding Rs {dealer.outstanding_payment}</p>
                  <button type="button" className="secondary" onClick={() => startEditingDealer(dealer)}>
                    Edit Dealer
                  </button>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      {currentView === "schemes" ? (
        <Suspense fallback={<LazySectionFallback label="adhesive tokens" />}>
          <AdhesiveTokensSection
            schemeSummary={schemeSummary}
            BadgeCard={BadgeCard}
            handleIssueSchemeToken={handleIssueSchemeToken}
            schemeTokenForm={schemeTokenForm}
            setSchemeTokenForm={setSchemeTokenForm}
            schemeTokenFormErrors={schemeTokenFormErrors}
            setSchemeTokenFormErrors={setSchemeTokenFormErrors}
            activeMasons={activeMasons}
            handleRegisteredMasonChange={handleRegisteredMasonChange}
            handleVerifyAdhesiveInvoice={handleVerifyAdhesiveInvoice}
            projects={projects}
            handleAdhesiveProjectChange={handleAdhesiveProjectChange}
            sanitizePositiveIntegerInput={sanitizePositiveIntegerInput}
            sanitizeNonNegativeIntegerInput={sanitizeNonNegativeIntegerInput}
            addAdhesiveTokenItemRow={addAdhesiveTokenItemRow}
            adhesiveTokenValues={adhesiveTokenValues}
            handleAdhesiveTokenItemChange={handleAdhesiveTokenItemChange}
            removeAdhesiveTokenItemRow={removeAdhesiveTokenItemRow}
            selectedRegisteredMason={selectedRegisteredMason}
            HighlightRow={HighlightRow}
            adhesiveClaimTotals={adhesiveClaimTotals}
            selectedAdhesiveProject={selectedAdhesiveProject}
            getAdhesiveClaimPreviewStatus={getAdhesiveClaimPreviewStatus}
            labelize={labelize}
            busyAction={busyAction}
            editingAdhesiveTokenId={editingAdhesiveTokenId}
            setEditingAdhesiveTokenId={setEditingAdhesiveTokenId}
            emptySchemeToken={emptySchemeToken}
            ListLoadControls={ListLoadControls}
            schemeTokens={schemeTokens}
            listLimits={listLimits}
            increaseListLimit={increaseListLimit}
            loading={loading}
            adhesiveTokenStatusFilter={adhesiveTokenStatusFilter}
            setAdhesiveTokenStatusFilter={setAdhesiveTokenStatusFilter}
            adhesiveTokenStatuses={adhesiveTokenStatuses}
            adhesiveTokenMasonFilter={adhesiveTokenMasonFilter}
            setAdhesiveTokenMasonFilter={setAdhesiveTokenMasonFilter}
            adhesiveTokenInvoiceFilter={adhesiveTokenInvoiceFilter}
            setAdhesiveTokenInvoiceFilter={setAdhesiveTokenInvoiceFilter}
            adhesiveTokenSiteFilter={adhesiveTokenSiteFilter}
            setAdhesiveTokenSiteFilter={setAdhesiveTokenSiteFilter}
            adhesiveTokenCreatedByFilter={adhesiveTokenCreatedByFilter}
            setAdhesiveTokenCreatedByFilter={setAdhesiveTokenCreatedByFilter}
            adhesiveTokenVerifiedByFilter={adhesiveTokenVerifiedByFilter}
            setAdhesiveTokenVerifiedByFilter={setAdhesiveTokenVerifiedByFilter}
            adhesiveTokenDateFromFilter={adhesiveTokenDateFromFilter}
            setAdhesiveTokenDateFromFilter={setAdhesiveTokenDateFromFilter}
            adhesiveTokenDateToFilter={adhesiveTokenDateToFilter}
            setAdhesiveTokenDateToFilter={setAdhesiveTokenDateToFilter}
            adhesiveTokenReports={adhesiveTokenReports}
            StatCard={StatCard}
            filteredSchemeTokens={filteredSchemeTokens}
            user={user}
            getAdhesiveClaimActionState={getAdhesiveClaimActionState}
            handleOpenAdhesiveTokenDetail={handleOpenAdhesiveTokenDetail}
            startEditingAdhesiveToken={startEditingAdhesiveToken}
            requestVerifyAdhesiveToken={requestVerifyAdhesiveToken}
            requestApproveAdhesiveToken={requestApproveAdhesiveToken}
            requestMarkAdhesiveTokenPaid={requestMarkAdhesiveTokenPaid}
            requestRejectAdhesiveToken={requestRejectAdhesiveToken}
            requestReopenAdhesiveToken={requestReopenAdhesiveToken}
            requestDeleteAdhesiveToken={requestDeleteAdhesiveToken}
            formatDateTime={formatDateTime}
            selectedAdhesiveToken={selectedAdhesiveToken}
            adhesiveTokenActivities={adhesiveTokenActivities}
            EmptyState={EmptyState}
            clearFieldErrorFromEvent={clearFieldErrorFromEvent}
            getFieldErrorClass={getFieldErrorClass}
          />
        </Suspense>
      ) : null}

      {currentView === "masons" ? (
        <Suspense fallback={<LazySectionFallback label="registered masons" />}>
          <RegisteredMasonsSection
            masons={masons}
            activeMasons={activeMasons}
            user={user}
            hasAnyRole={hasAnyRole}
            masonForm={masonForm}
            setMasonForm={setMasonForm}
            masonFormErrors={masonFormErrors}
            setMasonFormErrors={setMasonFormErrors}
            masonStatuses={masonStatuses}
            sanitizePositiveIntegerInput={sanitizePositiveIntegerInput}
            masonWorkingAreaInput={masonWorkingAreaInput}
            setMasonWorkingAreaInput={setMasonWorkingAreaInput}
            addMasonWorkingArea={addMasonWorkingArea}
            removeMasonWorkingArea={removeMasonWorkingArea}
            handleSaveMason={handleSaveMason}
            busyAction={busyAction}
            editingMasonId={editingMasonId}
            setEditingMasonId={setEditingMasonId}
            emptyMason={emptyMason}
            ListLoadControls={ListLoadControls}
            listLimits={listLimits}
            increaseListLimit={increaseListLimit}
            loading={loading}
            masonCurrentCityFilter={masonCurrentCityFilter}
            setMasonCurrentCityFilter={setMasonCurrentCityFilter}
            masonPermanentCityFilter={masonPermanentCityFilter}
            setMasonPermanentCityFilter={setMasonPermanentCityFilter}
            masonWorkingAreaFilter={masonWorkingAreaFilter}
            setMasonWorkingAreaFilter={setMasonWorkingAreaFilter}
            masonWorkingDistanceFilter={masonWorkingDistanceFilter}
            setMasonWorkingDistanceFilter={setMasonWorkingDistanceFilter}
            filteredMasons={filteredMasons}
            labelize={labelize}
            formatDateTime={formatDateTime}
            startEditingMason={startEditingMason}
            EmptyState={EmptyState}
            masonActivities={masonActivities}
            clearFieldErrorFromEvent={clearFieldErrorFromEvent}
            getFieldErrorClass={getFieldErrorClass}
          />
        </Suspense>
      ) : null}

      {currentView === "inventory" ? (
        <section className="stack workspace-stack">
          <WorkspaceTabs
            value={inventoryWorkspaceTab}
            onChange={setInventoryWorkspaceTab}
            tabs={[
              { value: "new", label: "New Entry" },
              { value: "ledger", label: "Ledger" },
              { value: "reports", label: "Reports" },
            ]}
          />

          {inventoryWorkspaceTab === "new" ? (
          <section className="panel product-master-panel">
            <div className="section-head">
              <h2>Product master</h2>
              <span>Create and maintain product foundation fields</span>
            </div>
            <form className="product-master-form" onSubmit={handleSaveProduct}>
              <div
                className={
                  "form-section full-span product-master-section" +
                  (productHighlightedFields.includes("company") || productHighlightedFields.includes("size")
                    ? " product-highlight-section"
                    : "")
                }
              >
                <span className="form-section-title">
                  Basic product information
                  {productHighlightedFields.includes("company") || productHighlightedFields.includes("size") ? (
                    <span className="missing-field-note"> - Please fill the highlighted fields</span>
                  ) : null}
                </span>
                <div className="product-master-table">
                  <div className="product-master-row">
                    <div className="form-field">
                      <label>
                        Product name <span className="required-marker">*</span>
                      </label>
                      <input
                        placeholder="Product name"
                        value={productForm.name}
                        onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>
                        Company <span className="required-marker">*</span>
                      </label>
                      <div className="inline-add-row">
                        <select
                          value={isAddingCustomCompany ? "__custom__" : normalizeText(productForm.company_name)}
                          onChange={(event) => {
                            if (event.target.value === "__custom__") {
                              setIsAddingCustomCompany(true);
                              setProductForm({ ...productForm, company_name: "" });
                              return;
                            }
                            setIsAddingCustomCompany(false);
                            setProductForm({ ...productForm, company_name: event.target.value });
                          }}
                        >
                          <option value="">Select company</option>
                          {productCompanyOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                          <option value="__custom__">+ Add</option>
                        </select>
                        <button
                          type="button"
                          className="secondary inline-add-button"
                          onClick={() => {
                            setIsAddingCustomCompany(true);
                            setProductForm({ ...productForm, company_name: "" });
                          }}
                        >
                          + Add
                        </button>
                      </div>
                      {isAddingCustomCompany ? (
                        <>
                          <input
                            placeholder="New company name"
                            value={productForm.company_name}
                            onChange={(event) => setProductForm({ ...productForm, company_name: event.target.value })}
                            onBlur={(event) => {
                              const value = normalizeText(event.target.value);
                              if (!value) {
                                return;
                              }
                              setCustomCompanyOptions((current) => (current.includes(value) ? current : [...current, value]));
                            }}
                          />
                          <span className="input-helper">Quick add for this session.</span>
                        </>
                      ) : null}
                    </div>
                    <div className="form-field">
                      <label>
                        Product size <span className="required-marker">*</span>
                      </label>
                      <div className="inline-add-row">
                        <select
                          value={isAddingCustomProductSize ? "__custom__" : normalizeText(productForm.product_size || productForm.tile_size)}
                          onChange={(event) => {
                            if (event.target.value === "__custom__") {
                              setIsAddingCustomProductSize(true);
                              setProductForm({ ...productForm, product_size: "", tile_size: "" });
                              return;
                            }
                            setIsAddingCustomProductSize(false);
                            setProductForm({ ...productForm, product_size: event.target.value, tile_size: event.target.value });
                          }}
                        >
                          <option value="">Select size</option>
                          {productSizeOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                          <option value="__custom__">+ Add</option>
                        </select>
                        <button
                          type="button"
                          className="secondary inline-add-button"
                          onClick={() => {
                            setIsAddingCustomProductSize(true);
                            setProductForm({ ...productForm, product_size: "", tile_size: "" });
                          }}
                        >
                          + Add
                        </button>
                      </div>
                      {isAddingCustomProductSize ? (
                        <>
                          <input
                            placeholder="New size"
                            value={productForm.product_size}
                            onChange={(event) =>
                              setProductForm({
                                ...productForm,
                                product_size: event.target.value,
                                tile_size: event.target.value,
                              })
                            }
                            onBlur={(event) => {
                              const value = normalizeText(event.target.value);
                              if (!value) {
                                return;
                              }
                              setCustomProductSizeOptions((current) => (current.includes(value) ? current : [...current, value]));
                            }}
                          />
                          <span className="input-helper">Quick add for this session.</span>
                        </>
                      ) : null}
                    </div>
                    <div className="form-field">
                      <label>Finish</label>
                      <div className="inline-add-row">
                        <select
                          value={isAddingCustomFinish ? "__custom__" : normalizeText(productForm.finish)}
                          onChange={(event) => {
                            if (event.target.value === "__custom__") {
                              setIsAddingCustomFinish(true);
                              setProductForm({ ...productForm, finish: "" });
                              return;
                            }
                            setIsAddingCustomFinish(false);
                            setProductForm({ ...productForm, finish: event.target.value });
                          }}
                        >
                          <option value="">Select finish</option>
                          {productFinishOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                          <option value="__custom__">+ Add</option>
                        </select>
                        <button
                          type="button"
                          className="secondary inline-add-button"
                          onClick={() => {
                            setIsAddingCustomFinish(true);
                            setProductForm({ ...productForm, finish: "" });
                          }}
                        >
                          + Add
                        </button>
                      </div>
                      {isAddingCustomFinish ? (
                        <>
                          <input
                            placeholder="New finish"
                            value={productForm.finish}
                            onChange={(event) => setProductForm({ ...productForm, finish: event.target.value })}
                            onBlur={(event) => {
                              const value = normalizeText(event.target.value);
                              if (!value) {
                                return;
                              }
                              setCustomFinishOptions((current) => (current.includes(value) ? current : [...current, value]));
                            }}
                          />
                          <span className="input-helper">Quick add for this session.</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="product-master-row">
                    <div className="form-field">
                      <label>
                        Category <span className="required-marker">*</span>
                      </label>
                      <div className="inline-add-row">
                        <select
                          value={isAddingCustomProductCategory ? "__custom__" : productForm.category}
                          onChange={(event) => {
                            if (event.target.value === "__custom__") {
                              setIsAddingCustomProductCategory(true);
                              setProductForm({ ...productForm, category: "" });
                              return;
                            }

                            setIsAddingCustomProductCategory(false);
                            setProductForm({ ...productForm, category: event.target.value });
                          }}
                        >
                          {productCategoryOptions.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                          <option value="__custom__">+ Add Category</option>
                        </select>
                      </div>
                      {isAddingCustomProductCategory ? (
                        <>
                          <input
                            placeholder="New category name"
                            value={productForm.category}
                            onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}
                            onBlur={(event) => {
                              const value = normalizeText(event.target.value);
                              if (!value) {
                                return;
                              }
                              setCustomProductCategories((current) => (current.includes(value) ? current : [...current, value]));
                            }}
                          />
                          <span className="input-helper">Quick custom category for this session.</span>
                        </>
                      ) : null}
                    </div>
                    <div className="form-field">
                      <label>
                        Business unit <span className="required-marker">*</span>
                      </label>
                      <select
                        value={productForm.business_unit}
                        onChange={(event) =>
                          setProductForm({ ...productForm, business_unit: event.target.value })
                        }
                      >
                        <option value="tiles">Tiles</option>
                        <option value="plumbing">Plumbing</option>
                        <option value="both">Tiles + Plumbing</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>
                        Unit <span className="required-marker">*</span>
                      </label>
                      <select
                        value={productForm.unit}
                        onChange={(event) => setProductForm({ ...productForm, unit: event.target.value })}
                      >
                        <option value="box">Box</option>
                        <option value="sqft">Sqft</option>
                        <option value="pcs">Pieces</option>
                        <option value="kg">Kg</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Design code</label>
                      <input
                        placeholder="Design code"
                        value={productForm.design_code}
                        onChange={(event) =>
                          setProductForm({ ...productForm, design_code: event.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {similarProductMatch && !productDuplicateOverride ? (
                <div className="product-duplicate-warning full-span">
                  <strong>Similar product already exists:</strong>
                  <span>
                    {similarProductMatch.name} | {getProductCompany(similarProductMatch) || "Company missing"} | {getProductSize(similarProductMatch) || "Size missing"} | {getProductFinish(similarProductMatch) || "Finish missing"}
                  </span>
                  <div className="lead-actions">
                    <button type="button" className="secondary" onClick={() => startEditingProduct(similarProductMatch)}>
                      View Existing
                    </button>
                    <button type="button" className="secondary" onClick={() => setProductDuplicateOverride(true)}>
                      Continue Anyway
                    </button>
                  </div>
                </div>
              ) : null}

              <div
                className={
                  "form-section full-span product-master-section" +
                  (productHighlightedFields.includes("packaging") || productHighlightedFields.includes("weight")
                    ? " product-highlight-section"
                    : "")
                }
              >
                <span className="form-section-title">
                  Packaging information
                  {productHighlightedFields.includes("packaging") || productHighlightedFields.includes("weight") ? (
                    <span className="missing-field-note"> - Please fill the highlighted fields</span>
                  ) : null}
                </span>
                <div className="product-master-table">
                  <div className="product-master-row">
                    <div className="form-field">
                      <label>Pieces/Box</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Pieces per box"
                        value={productForm.pieces_per_box}
                        onChange={(event) => setProductForm({ ...productForm, pieces_per_box: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Sqft/Box</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Sqft per box"
                        value={productForm.sqft_per_box}
                        onChange={(event) => setProductForm({ ...productForm, sqft_per_box: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Weight/Box</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Weight per box"
                        value={productForm.weight_per_box}
                        onChange={(event) => setProductForm({ ...productForm, weight_per_box: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Weight/Unit (auto)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        placeholder="Auto after pieces/box and weight/box"
                        value={productForm.weight_per_unit}
                        readOnly
                      />
                      <span className="input-helper">
                        {derivedWeightPerUnit != null
                          ? `Auto from ${productForm.weight_per_box || 0} / ${productForm.pieces_per_box || 0}`
                          : "Auto after pieces/box and weight/box"}
                      </span>
                    </div>
                  </div>
                  <div className="product-master-row product-master-row-helper">
                    <div className="form-field product-master-wide-field">
                      <label>Sqft/Unit (auto helper)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        placeholder="Auto after sqft/box and pieces/box"
                        value={derivedSqftPerUnit != null ? String(derivedSqftPerUnit) : ""}
                        readOnly
                      />
                      <span className="input-helper">
                        {derivedSqftPerUnit != null
                          ? `Auto from ${productForm.sqft_per_box || 0} / ${productForm.pieces_per_box || 0}`
                          : "Auto after sqft/box and pieces/box"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={
                  "form-section full-span product-master-section" +
                  (productHighlightedFields.includes("pricing") ? " product-highlight-section" : "")
                }
              >
                <span className="form-section-title">
                  Owner Pricing Optional
                  {productHighlightedFields.includes("pricing") ? (
                    <span className="missing-field-note"> - Missing pricing - please review</span>
                  ) : null}
                </span>
                <p className="muted product-form-note">
                  Pricing can be completed later by Owner/Admin after purchase costing.
                </p>
                {!(isAdmin(user) || hasRole(user, "owner")) ? (
                  <p className="pricing-lock-hint">Pricing controlled by Owner/Admin</p>
                ) : null}
                <fieldset
                  className={`pricing-fieldset ${
                    isAdmin(user) || hasRole(user, "owner") ? "" : "pricing-fieldset-locked"
                  }`}
                  disabled={!(isAdmin(user) || hasRole(user, "owner"))}
                  style={{ border: "none", padding: 0, margin: 0 }}
                >
                <div className="product-master-table">
                  <div className="product-master-row">
                    <div className="form-field">
                      <label>Purchase</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Purchase rate"
                        value={productForm.purchase_rate}
                        onChange={(event) => setProductForm({ ...productForm, purchase_rate: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Last Purchase</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Last purchase rate"
                        value={productForm.last_purchase_rate}
                        onChange={(event) => setProductForm({ ...productForm, last_purchase_rate: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Landed Cost</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Landed cost / unit"
                        value={productForm.landed_cost_per_unit}
                        onChange={(event) => setProductForm({ ...productForm, landed_cost_per_unit: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Selling Rate</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Selling rate"
                        value={productForm.price_per_sqft}
                        onChange={(event) =>
                          setProductForm({ ...productForm, price_per_sqft: event.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="product-master-row">
                    <div className="form-field">
                      <label>Minimum Rate</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Minimum allowed rate"
                        value={productForm.minimum_allowed_rate}
                        onChange={(event) => setProductForm({ ...productForm, minimum_allowed_rate: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Predefined Rate</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Predefined rate"
                        value={productForm.predefined_rate}
                        onChange={(event) => setProductForm({ ...productForm, predefined_rate: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Today Rate</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Today selling rate"
                        value={productForm.today_selling_rate}
                        onChange={(event) => setProductForm({ ...productForm, today_selling_rate: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Safety Margin</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Safety margin %"
                        value={productForm.safety_margin_percent}
                        onChange={(event) => setProductForm({ ...productForm, safety_margin_percent: event.target.value })}
                      />
                    </div>
                  </div>
                  <div className="product-master-row">
                    <div className="form-field">
                      <label>Suggested Selling Rate</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Suggested selling rate"
                        value={productForm.suggested_selling_rate}
                        onChange={(event) => setProductForm({ ...productForm, suggested_selling_rate: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Daily Up Limit %</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Daily up limit %"
                        value={productForm.daily_up_limit_percent}
                        onChange={(event) => setProductForm({ ...productForm, daily_up_limit_percent: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Daily Down Limit %</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Daily down limit %"
                        value={productForm.daily_down_limit_percent}
                        onChange={(event) => setProductForm({ ...productForm, daily_down_limit_percent: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Quotation Validity Days</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Quotation validity days"
                        value={productForm.quotation_validity_days}
                        onChange={(event) => setProductForm({ ...productForm, quotation_validity_days: event.target.value })}
                      />
                    </div>
                  </div>
                </div>
                </fieldset>
              </div>

              <div className="form-section full-span product-master-section">
                <span className="form-section-title">Stock control</span>
                <div className="product-master-table">
                  <div className="product-master-row product-master-row-stock">
                    <div className="form-field">
                      <label>
                        Current Stock <span className="required-marker">*</span>
                      </label>
                      <input
                        data-field="stock_sqft"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Enter current stock"
                        className={getFieldErrorClass(productFormErrors, "stock_sqft")}
                        value={productForm.stock_sqft}
                        onChange={(event) => {
                          setProductForm({ ...productForm, stock_sqft: event.target.value });
                          setProductFormErrors((prev) => {
                            if (!prev?.stock_sqft) return prev || {};
                            const next = { ...prev };
                            delete next.stock_sqft;
                            return next;
                          });
                        }}
                      />
                      {productFormErrors?.stock_sqft ? (
                        <span className="field-error-message">{productFormErrors?.stock_sqft}</span>
                      ) : null}
                    </div>
                    <div className="form-field">
                      <label>Status</label>
                      <select
                        value={productForm.status}
                        onChange={(event) => setProductForm({ ...productForm, status: event.target.value })}
                      >
                        <option value="active">Active</option>
                        <option value="fast_moving">Fast Moving</option>
                        <option value="dead_stock">Dead Stock</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Low Stock Threshold (Boxes)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="10"
                        disabled={!(isAdmin(user) || hasRole(user, "owner") || hasRole(user, "manager"))}
                        value={productForm.low_stock_threshold}
                        onChange={(event) => setProductForm({ ...productForm, low_stock_threshold: event.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Pricing Lock</label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          disabled={!(isAdmin(user) || hasRole(user, "owner"))}
                          checked={Boolean(productForm.pricing_lock)}
                          onChange={(event) => setProductForm({ ...productForm, pricing_lock: event.target.checked })}
                        />
                        <span>Pricing lock enabled</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lead-actions full-span">
                <button type="submit" disabled={busyAction === "save-product"}>
                  {busyAction === "save-product"
                    ? editingProductId
                      ? "Updating Product..."
                      : "Saving Product..."
                    : editingProductId
                      ? "Update Product"
                      : "Save Product"}
                </button>
                {editingProductId ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setEditingProductId(null);
                      setProductForm(emptyProduct);
                      setProductFormErrors({});
                      setIsAddingCustomProductCategory(false);
                      setIsAddingCustomCompany(false);
                      setIsAddingCustomProductSize(false);
                      setIsAddingCustomFinish(false);
                      setProductDuplicateOverride(false);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>
          ) : null}

          {inventoryWorkspaceTab === "ledger" ? (
          <section className="panel">
            <div className="section-head">
              <h2>Product ledger</h2>
              <span>{filteredInventoryLedgerProducts.length} products</span>
            </div>
            <div className="filters-bar stock-ledger-toolbar">
              <div className="control-group stock-ledger-search">
                <label className="control-label">Search</label>
                <input
                  type="search"
                  placeholder="Search product, company, size, category..."
                  value={inventoryLedgerSearch}
                  onChange={(event) => setInventoryLedgerSearch(event.target.value)}
                />
              </div>
              <div className="control-group stock-ledger-view-group">
                <label className="control-label">View</label>
                <div className="workspace-tab-nav stock-ledger-toggle">
                  <button
                    type="button"
                    className={inventoryLedgerView === "grid" ? "active-nav" : "nav-btn"}
                    onClick={() => setInventoryLedgerView("grid")}
                  >
                    Grid View
                  </button>
                  <button
                    type="button"
                    className={inventoryLedgerView === "list" ? "active-nav" : "nav-btn"}
                    onClick={() => setInventoryLedgerView("list")}
                  >
                    List View
                  </button>
                </div>
              </div>
              <div className="control-group">
                <label className="control-label">Category</label>
                <select
                  value={inventoryLedgerCategoryFilter}
                  onChange={(event) => setInventoryLedgerCategoryFilter(event.target.value)}
                >
                  <option value="all">All</option>
                  {productCategoryOptions.map((category) => (
                    <option key={`inventory-category-${category}`} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="control-group">
                <label className="control-label">Status</label>
                <select
                  value={inventoryLedgerStatusFilter}
                  onChange={(event) => setInventoryLedgerStatusFilter(event.target.value)}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="fast_moving">Fast Moving</option>
                  <option value="dead_stock">Dead Stock</option>
                </select>
              </div>
              <div className="control-group">
                <label className="control-label">Stock Level</label>
                <select
                  value={inventoryLedgerStockFilter}
                  onChange={(event) => setInventoryLedgerStockFilter(event.target.value)}
                >
                  <option value="all">All</option>
                  <option value="in">In Stock</option>
                  <option value="low">Low Stock</option>
                  <option value="out">Out of Stock</option>
                </select>
              </div>
              <div className="control-group">
                <label className="control-label">Sort</label>
                <select
                  value={inventoryLedgerSort}
                  onChange={(event) => setInventoryLedgerSort(event.target.value)}
                >
                  <option value="name_asc">Product A-Z</option>
                  <option value="stock_low_high">Stock Low to High</option>
                  <option value="stock_high_low">Stock High to Low</option>
                </select>
              </div>
            </div>
            <ListLoadControls
              label="Products"
              count={products.length}
              limit={listLimits.products}
              onLoadMore={() => increaseListLimit("products")}
              disabled={loading}
            />
            {inventoryLedgerView === "grid" ? (
            <div className="list stock-ledger-grid">
              {filteredInventoryLedgerProducts.map((product) => {
                const stockState = getProductStockState(product);
                const stockBoxes = getProductStockBoxes(product);
                const stockSqft = getProductStockSqft(product);
                const stockLabel =
                  stockState === "out" ? "Out of Stock" : stockState === "low" ? "Low Stock" : "In Stock";
                const stockSummary = `${stockBoxes.toLocaleString("en-IN", { maximumFractionDigits: 2 })} boxes | ${stockSqft.toLocaleString("en-IN", { maximumFractionDigits: 2 })} sqft`;
                const stockCardClass =
                  stockState === "out" ? "stock-card-out" : stockState === "low" ? "stock-card-low" : "";
                const productGaps = getProductDataGaps(product);

                return (
                  <article key={product.id} className={`lead-card product-master-card ${stockCardClass}`.trim()}>
                    <div className="section-head">
                      <div>
                        <h3>{product.name}</h3>
                        <p className="muted">
                          {[getProductCompany(product) || "Company missing", getProductDesignCode(product) || product.category, getProductFinish(product) || "", product.latest_batch_no ? `Batch ${product.latest_batch_no}` : ""]
                            .filter(Boolean)
                            .join(" | ")}
                        </p>
                      </div>
                      <span className={`status-chip status-${product.status}`}>{labelize(product.status)}</span>
                    </div>
                    <div className="product-meta-grid">
                      <span>Company {getProductCompany(product) || "Missing"}</span>
                      <span>Category {product.category || "Missing"}</span>
                      <span>Size {getProductSize(product) || "Missing"}</span>
                      <span>Unit {product.unit || "Missing"}</span>
                      <span>Stock {stockSummary}</span>
                      <span>Selling Rs {Number(product.price_per_sqft || 0).toLocaleString("en-IN")}</span>
                      <span>Min Rs {Number(product.minimum_allowed_rate || 0).toLocaleString("en-IN")}</span>
                      <span>Threshold {getProductLowStockThreshold(product)} boxes</span>
                    </div>
                    <div className="chip-row">
                      <span className={`stock-badge ${stockState === "out" ? "stock-out" : stockState === "low" ? "stock-low" : "stock-in"}`}>
                        {stockLabel}
                      </span>
                      <span className="legend-chip">{stockSummary}</span>
                      <span className="legend-chip product-completeness-chip">
                        Product Completeness: {getProductCompletenessPercent(product)}%
                      </span>
                      {Boolean(product.pricing_lock) ? <span className="status-chip status-approved">Pricing locked</span> : null}
                    </div>
                    {productGaps.length ? (
                      <p className="muted product-gap-text">
                        Missing: {productGaps.map(formatProductDataGapLabel).join(", ")}
                      </p>
                    ) : (
                      <p className="muted product-gap-text">Product master ready for costing and approval workflows.</p>
                    )}
                    <div className="lead-actions">
                      <button type="button" className="secondary" onClick={() => startEditingProduct(product)}>
                        Edit
                      </button>
                      {isAdmin(user) ? (
                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            setPendingDelete({
                              type: "product",
                              id: product.id,
                              entityLabel: "Product",
                              message: `This will permanently remove ${product.name} from inventory.`,
                              subtext: getProductDesignCode(product) || product.category,
                            })
                          }
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
              {filteredInventoryLedgerProducts.length === 0 ? (
                <EmptyState title="No products available" message="Save stock items here to power quotation and inventory visibility." />
              ) : null}
            </div>
            ) : (
            <div className="table-shell">
              <table className="data-table stock-ledger-table">
                <colgroup>
                  <col style={{ width: "220px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "70px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "60px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "110px" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="col-product">Product</th>
                    <th className="col-company">Company</th>
                    <th className="col-category">Category</th>
                    <th className="col-size">Size</th>
                    <th className="col-stock">Stock</th>
                    <th className="col-unit">Unit</th>
                    <th className="col-selling">Selling</th>
                    <th className="col-min">Min</th>
                    <th className="col-status">Status</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventoryLedgerProducts.map((product) => {
                    const stockValue = getProductStockSqft(product);
                    const stockBoxes = getProductStockBoxes(product);
                    const stockState = getProductStockState(product);
                    const stockClass = stockState === "out" ? "stock-out" : stockState === "low" ? "stock-low" : "stock-in";
                    const productGaps = getProductDataGaps(product);
                    const productMetaLine = [getProductDesignCode(product) || "", getProductFinish(product) || "", product.latest_batch_no ? `Batch ${product.latest_batch_no}` : ""]
                      .filter(Boolean)
                      .join(" | ");
                    const compactGapText =
                      productGaps.length === 0
                        ? ""
                        : productGaps.length <= 2
                          ? `(${productGaps.map(formatProductDataGapLabel).join(", ").toLowerCase()} missing)`
                          : `(${formatProductDataGapLabel(productGaps[0]).toLowerCase()} +${productGaps.length - 1} more)`;
                    return (
                      <tr
                        key={`inventory-row-${product.id}`}
                        className={
                          stockState === "out"
                            ? "stock-ledger-row-out"
                            : stockState === "low"
                              ? "stock-ledger-row-low"
                              : undefined
                        }
                      >
                        <td className="col-product">
                          <strong className="stock-product-name">{product.name}</strong>
                          {productMetaLine ? <div className="muted stock-warning-inline">{productMetaLine}</div> : null}
                          {compactGapText ? (
                            <div className="muted stock-warning-inline">
                              {compactGapText}
                            </div>
                          ) : null}
                        </td>
                        <td className="col-company">{getProductCompany(product) || "Missing"}</td>
                        <td className="col-category">{product.category || "Missing"}</td>
                        <td className="col-size">{getProductSize(product) || "Missing"}</td>
                        <td className="col-stock">
                          <span className={`stock-badge ${stockClass}`}>
                            {stockState === "out" ? "Out" : stockState === "low" ? "Low" : "In"}
                          </span>
                          <div className="muted stock-warning-inline">
                            {stockBoxes.toLocaleString("en-IN", { maximumFractionDigits: 2 })} box | {stockValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })} sqft
                          </div>
                        </td>
                        <td className="col-unit">{product.unit || "Missing"}</td>
                        <td className="col-selling">Rs {Number(product.price_per_sqft || 0).toLocaleString("en-IN")}</td>
                        <td className="col-min">Rs {Number(product.minimum_allowed_rate || 0).toLocaleString("en-IN")}</td>
                        <td className="col-status">
                          <span className={`status-chip status-${product.status}`}>{labelize(product.status)}</span>
                        </td>
                        <td className="col-actions">
                          <div className="table-actions">
                            <button type="button" className="secondary" onClick={() => startEditingProduct(product)}>
                              Edit
                            </button>
                            {isAdmin(user) ? (
                              <button
                                type="button"
                                className="danger"
                                onClick={() =>
                                  setPendingDelete({
                                    type: "product",
                                    id: product.id,
                                    entityLabel: "Product",
                                    message: `This will permanently remove ${product.name} from inventory.`,
                                    subtext: getProductDesignCode(product) || product.category,
                                  })
                                }
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredInventoryLedgerProducts.length === 0 ? (
                    <tr>
                      <td colSpan="10">
                        <EmptyState title="No products available" message="Save stock items here to power quotation and inventory visibility." />
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            )}
          </section>
          ) : null}

          {inventoryWorkspaceTab === "reports" ? (
          <section className="panel">
            <div className="section-head">
              <h2>Product master reports</h2>
              <span>
                {getInventorySummaryMetric("total_products", Array.isArray(products) ? products.length : 0)} products | {productHealthSummary.averageCompleteness}% complete
              </span>
            </div>
            <div className="report-grid product-report-cards">
              <button
                type="button"
                className={`stat-card product-report-filter ${productReportGapFilter === "all" ? "product-report-filter-active" : ""}`}
                onClick={() => setProductReportGapFilter("all")}
              >
                <span>All missing data</span>
                <strong>{productWarningList.length}</strong>
              </button>
              <button
                type="button"
                className={`stat-card product-report-filter ${productReportGapFilter === "company" ? "product-report-filter-active" : ""}`}
                onClick={() => setProductReportGapFilter("company")}
              >
                <span>Missing company</span>
                <strong>{getInventorySummaryMetric("missing_company_count", productHealthSummary.missingCompanyCount)}</strong>
              </button>
              <button
                type="button"
                className={`stat-card product-report-filter ${productReportGapFilter === "size" ? "product-report-filter-active" : ""}`}
                onClick={() => setProductReportGapFilter("size")}
              >
                <span>Missing size</span>
                <strong>{getInventorySummaryMetric("missing_size_count", productHealthSummary.missingSizeCount)}</strong>
              </button>
              <button
                type="button"
                className={`stat-card tone-danger product-report-filter ${productReportGapFilter === "weight" ? "product-report-filter-active" : ""}`}
                onClick={() => setProductReportGapFilter("weight")}
              >
                <span>Missing weight</span>
                <strong>{getInventorySummaryMetric("missing_weight_count", productHealthSummary.missingWeightCount)}</strong>
              </button>
              <button
                type="button"
                className={`stat-card tone-danger product-report-filter ${productReportGapFilter === "pricing" ? "product-report-filter-active" : ""}`}
                onClick={() => setProductReportGapFilter("pricing")}
              >
                <span>Missing pricing</span>
                <strong>{getInventorySummaryMetric("missing_pricing_count", productHealthSummary.missingPricingCount)}</strong>
              </button>
              <button
                type="button"
                className={`stat-card product-report-filter ${productReportGapFilter === "packaging" ? "product-report-filter-active" : ""}`}
                onClick={() => setProductReportGapFilter("packaging")}
              >
                <span>Missing packaging</span>
                <strong>{getInventorySummaryMetric("missing_packaging_count", productHealthSummary.missingPackagingCount)}</strong>
              </button>
            </div>
            <div className="table-shell product-report-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Company</th>
                    <th>Size</th>
                    <th>Missing fields</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = (productWarningList || []).filter((product) => {
                      if (productReportGapFilter === "all") return true;
                      const gaps = getProductDataGaps(product);
                      return gaps.includes(productReportGapFilter);
                    });
                    const sorted = [...filtered].sort((a, b) => {
                      const ga = getProductDataGaps(a).length;
                      const gb = getProductDataGaps(b).length;
                      if (gb !== ga) return gb - ga;
                      return String(a.name || "").localeCompare(String(b.name || ""));
                    });
                    if (!sorted.length) {
                      return (
                        <tr>
                          <td colSpan={5}>
                            <EmptyState
                              title="No product master warnings"
                              message="Every loaded product has the required master data filled."
                              compact
                            />
                          </td>
                        </tr>
                      );
                    }
                    return sorted.map((product) => {
                      const gaps = getProductDataGaps(product);
                      return (
                        <tr
                          key={`warning-${product.id}`}
                          className="product-report-row"
                          onClick={() => startEditingProduct(product, gaps)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <strong>{product.name}</strong>
                          <div className="muted">{getProductDesignCode(product) || product.category || ""}</div>
                        </td>
                          <td>{getProductCompany(product) || <span className="muted">- missing</span>}</td>
                          <td>{getProductSize(product) || <span className="muted">- missing</span>}</td>
                          <td>
                            <div className="chip-row">
                              {gaps.map((code) => (
                                <span key={code} className={`status-chip status-${code === "pricing" || code === "weight" ? "urgent" : "pending"}`}>
                                  {formatProductDataGapLabel(code)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="secondary"
                              onClick={(event) => {
                                event.stopPropagation();
                                startEditingProduct(product, gaps);
                              }}
                            >
                              Fix Missing Data
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginTop: "0.6rem", fontSize: "0.8rem" }}>
              Click any row or use Fix Missing Data to jump to New Entry with the empty fields highlighted.
            </p>
          </section>
          ) : null}
        </section>
      ) : null}

      {currentView === "dealers" ? (
        <section className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>Dealer / contractor management</h2>
              <span>Focus on A-category growth</span>
            </div>
            <form className="form-grid" onSubmit={handleSaveDealer}>
              <input
                placeholder="Dealer name"
                value={dealerForm.name}
                onChange={(event) => setDealerForm({ ...dealerForm, name: event.target.value })}
              />
              <input
                placeholder="Area"
                value={dealerForm.area}
                onChange={(event) => setDealerForm({ ...dealerForm, area: event.target.value })}
              />
              <input
                placeholder="Phone"
                value={dealerForm.phone}
                onChange={(event) => setDealerForm({ ...dealerForm, phone: event.target.value })}
              />
              <select
                value={dealerForm.category}
                onChange={(event) => setDealerForm({ ...dealerForm, category: event.target.value })}
              >
                {dealerCategories.map((category) => (
                  <option key={category} value={category}>
                    Category {category}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Monthly purchase"
                value={dealerForm.monthly_purchase}
                onChange={(event) =>
                  setDealerForm({ ...dealerForm, monthly_purchase: event.target.value })
                }
              />
              <input
                type="number"
                placeholder="Credit limit"
                value={dealerForm.credit_limit}
                onChange={(event) =>
                  setDealerForm({ ...dealerForm, credit_limit: event.target.value })
                }
              />
              <input
                type="number"
                placeholder="Outstanding payment"
                value={dealerForm.outstanding_payment}
                onChange={(event) =>
                  setDealerForm({ ...dealerForm, outstanding_payment: event.target.value })
                }
              />
              <input
                type="number"
                placeholder="Commission %"
                value={dealerForm.commission_percent}
                onChange={(event) =>
                  setDealerForm({ ...dealerForm, commission_percent: event.target.value })
                }
              />
              <div className="lead-actions full-span">
                <button type="submit" disabled={busyAction === "save-dealer"}>
                  {busyAction === "save-dealer"
                    ? editingDealerId
                      ? "Updating Dealer..."
                      : "Saving Dealer..."
                    : editingDealerId
                      ? "Update Dealer"
                      : "Save Dealer"}
                </button>
                {editingDealerId ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setEditingDealerId(null);
                      setDealerForm(emptyDealer);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>Dealer performance</h2>
              <span>{stats?.dealer_outstanding ?? 0} outstanding</span>
            </div>
            <ListLoadControls
              label="Dealers"
              count={dealers.length}
              limit={listLimits.dealers}
              onLoadMore={() => increaseListLimit("dealers")}
              disabled={loading}
            />
            <div className="list">
              {dealers.map((dealer) => (
                <article key={dealer.id} className="lead-card">
                  <div className="section-head">
                    <div>
                      <h3>{dealer.name}</h3>
                      <p className="muted">{dealer.area || "No area"}</p>
                    </div>
                    <span className="status-chip">{dealer.category}</span>
                  </div>
                  <p>Monthly purchase: Rs {dealer.monthly_purchase}</p>
                  <p>Outstanding: Rs {dealer.outstanding_payment}</p>
                  <p>Credit limit: Rs {dealer.credit_limit}</p>
                  <div className="lead-actions">
                    <button type="button" className="secondary" onClick={() => startEditingDealer(dealer)}>
                      Edit
                    </button>
                    {isAdmin(user) ? (
                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          setPendingDelete({
                            type: "dealer",
                            id: dealer.id,
                            entityLabel: "Dealer",
                            message: `This will permanently remove dealer ${dealer.name}.`,
                            subtext: dealer.area || "Dealer record",
                          })
                        }
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {dealers.length === 0 ? (
                <EmptyState title="No dealers saved" message="Add your dealer or contractor network to start tracking volume and outstanding value." />
              ) : null}
            </div>
          </section>
        </section>
      ) : null}

      {currentView === "reports" ? (
        <section className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>Owner control dashboard</h2>
              <span>Sales, collection, profit, dispatch, and execution control</span>
            </div>
            <div className="lead-actions">
              <button type="button" className="secondary" onClick={() => window.open(getCsvExportUrl("leads"), "_blank", "noopener,noreferrer")}>
                Export Leads CSV
              </button>
              <button type="button" className="secondary" onClick={() => window.open(getCsvExportUrl("payments"), "_blank", "noopener,noreferrer")}>
                Export Payments CSV
              </button>
              <button type="button" className="secondary" onClick={() => window.open(getCsvExportUrl("projects"), "_blank", "noopener,noreferrer")}>
                Export Projects CSV
              </button>
            </div>
            <div className="tabs-row">
              <BadgeCard title="Total Sales" count={`Rs ${(projectSummary?.total_tiles_revenue || 0) + (projectSummary?.total_plumbing_revenue || 0)}`} tone="accent" />
              <BadgeCard title="Received Payment" count={`Rs ${projectSummary?.total_received_payment ?? 0}`} />
              <BadgeCard title="Pending Payment" count={`Rs ${projectSummary?.pending_payment ?? 0}`} tone="danger" />
              <BadgeCard title="Net Profit" count={`Rs ${projectSummary?.total_net_profit ?? 0}`} tone="accent" />
            </div>
            <div className="report-grid">
              <StatCard label="Pending Approved Adhesive Payout" value={`Rs ${projectSummary?.total_pending_token_amount ?? 0}`} />
              <StatCard label="Plumbing Job Pending" value={projectSummary?.pending_plumbing_jobs ?? 0} />
              <StatCard label="Overdue Follow-ups" value={stats?.overdue_followups ?? 0} />
              <StatCard label="Pending Dispatch Items" value={projectSummary?.pending_dispatch_items ?? 0} />
            </div>
            <div className="stack">
              {(filteredProjects || []).slice(0, 6).map((project) => (
                <div key={project.id} className="timeline-item">
                  <strong>{project.project_name}</strong>
                  <p className="muted">
                    Profit Rs {project.net_profit} | Margin {project.profit_margin}% | Pending Rs {project.pending_payment}
                  </p>
                </div>
              ))}
              {!filteredProjects.length ? <p className="muted">No projects available for profit reporting yet.</p> : null}
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>Daily report sheet</h2>
              <span>
                Owner snapshot {dailyReport ? `- ${formatDate(dailyReportDate)}` : ""}
              </span>
            </div>
            <div className="filter-row">
              <label className="stack-tiny">
                <span className="control-label">Report date</span>
                <input
                  type="date"
                  value={dailyReportDate}
                  onChange={(event) => setDailyReportDate(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="secondary"
                onClick={() => setDailyReportDate(new Date().toISOString().slice(0, 10))}
              >
                Today
              </button>
            </div>
            {dailyReport ? (
              <>
                <div className="tabs-row">
                  <BadgeCard
                    title="Sales"
                    count={`Rs ${Number(dailyReport.sales?.amount || 0).toLocaleString("en-IN")}`}
                    tone="accent"
                  />
                  <BadgeCard
                    title="Collection"
                    count={`Rs ${Number(dailyReport.collection?.amount || 0).toLocaleString("en-IN")}`}
                    tone="accent"
                  />
                  <BadgeCard
                    title="Expenses"
                    count={`Rs ${Number(dailyReport.expense?.amount || 0).toLocaleString("en-IN")}`}
                  />
                  <BadgeCard
                    title="Purchases"
                    count={`Rs ${Number(dailyReport.purchase?.amount || 0).toLocaleString("en-IN")}`}
                  />
                </div>
                <div className="report-grid">
                  <StatCard
                    label="Cash In"
                    value={`Rs ${Number(dailyReport.cash_in || 0).toLocaleString("en-IN")}`}
                  />
                  <StatCard
                    label="Cash Out"
                    value={`Rs ${Number(dailyReport.cash_out || 0).toLocaleString("en-IN")}`}
                    tone="danger"
                  />
                  <StatCard
                    label="Net Cash"
                    value={`Rs ${Number(dailyReport.net_cash || 0).toLocaleString("en-IN")}`}
                    tone="accent"
                  />
                  <StatCard
                    label="Tokens Created"
                    value={`${dailyReport.tokens?.count || 0} - Rs ${Number(
                      dailyReport.tokens?.amount || 0
                    ).toLocaleString("en-IN")}`}
                  />
                  <StatCard
                    label="Pending Follow-ups"
                    value={dailyReport.followups?.count || 0}
                  />
                </div>
                <div className="table-shell">
                  <table className="data-table compact">
                    <thead>
                      <tr>
                        <th>Section</th>
                        <th>Count</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Sales (quotations)</td>
                        <td>{dailyReport.sales?.count || 0}</td>
                        <td>Rs {Number(dailyReport.sales?.amount || 0).toLocaleString("en-IN")}</td>
                      </tr>
                      <tr>
                        <td>Collection (payments)</td>
                        <td>{dailyReport.collection?.count || 0}</td>
                        <td>Rs {Number(dailyReport.collection?.amount || 0).toLocaleString("en-IN")}</td>
                      </tr>
                      <tr>
                        <td>Expenses</td>
                        <td>{dailyReport.expense?.count || 0}</td>
                        <td>Rs {Number(dailyReport.expense?.amount || 0).toLocaleString("en-IN")}</td>
                      </tr>
                      <tr>
                        <td>Purchases</td>
                        <td>{dailyReport.purchase?.count || 0}</td>
                        <td>Rs {Number(dailyReport.purchase?.amount || 0).toLocaleString("en-IN")}</td>
                      </tr>
                      <tr>
                        <td>Token claims created</td>
                        <td>{dailyReport.tokens?.count || 0}</td>
                        <td>Rs {Number(dailyReport.tokens?.amount || 0).toLocaleString("en-IN")}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <EmptyState
                title="No data for this date yet"
                message="Pick a date to load the daily showroom snapshot. Once entries are made for that day, totals will appear here."
              />
            )}
          </section>

          {dashboardSummary ? (
            <section className="panel">
              <div className="section-head">
                <h2>Live business pulse</h2>
                <span>
                  Live snapshot - cached 30s - {formatBusinessDateLabel(dashboardSummary.as_of_date)}
                </span>
              </div>
              <div className="tabs-row">
                <BadgeCard
                  title="Today Sales"
                  count={`Rs ${Number(dashboardSummary.sales_today?.amount || 0).toLocaleString("en-IN")}`}
                  tone="accent"
                />
                <BadgeCard
                  title="Today Collection"
                  count={`Rs ${Number(dashboardSummary.collection_today?.amount || 0).toLocaleString("en-IN")}`}
                  tone="accent"
                />
                <BadgeCard
                  title="Pending Payments"
                  count={`Rs ${Number(dashboardSummary.pending_payments?.amount || 0).toLocaleString("en-IN")}`}
                  tone="danger"
                />
                <BadgeCard
                  title="Monthly Sales"
                  count={`Rs ${Number(dashboardSummary.sales_month?.amount || 0).toLocaleString("en-IN")}`}
                />
              </div>
              <div className="report-grid">
                <StatCard
                  label="Token Claims Pending"
                  value={`${dashboardSummary.token_pending?.count ?? 0} - Rs ${Number(
                    dashboardSummary.token_pending?.amount || 0
                  ).toLocaleString("en-IN")}`}
                  tone="danger"
                />
                <StatCard
                  label="Token Paid (Month)"
                  value={`${dashboardSummary.token_paid_month?.count ?? 0} - Rs ${Number(
                    dashboardSummary.token_paid_month?.amount || 0
                  ).toLocaleString("en-IN")}`}
                  tone="accent"
                />
                <StatCard
                  label="Purchases (Month)"
                  value={`Rs ${Number(dashboardSummary.purchases_month?.amount || 0).toLocaleString("en-IN")}`}
                />
                <StatCard
                  label="Followups Pending"
                  value={dashboardSummary.followups_pending?.count ?? 0}
                />
                <StatCard
                  label="Active Customers"
                  value={dashboardSummary.active_customers?.count ?? 0}
                />
                <StatCard
                  label="Active Projects"
                  value={dashboardSummary.active_projects?.count ?? 0}
                />
                <StatCard
                  label="Low Stock Items"
                  value={dashboardSummary.low_stock_items?.count ?? 0}
                  tone="danger"
                />
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="section-head">
              <h2>Salesperson scoreboard</h2>
              <span>Manager + owner view</span>
            </div>
            <div className="list">
              {(stats?.staff_performance || []).map((member) => (
                <article key={member.salesperson} className="lead-card">
                  <div className="section-head">
                    <h3>{member.salesperson}</h3>
                    <span>{member.converted_leads} converted</span>
                  </div>
                  <p className="muted">{member.total_leads} total assigned leads</p>
                </article>
              ))}
              {!(stats?.staff_performance || []).length ? <p className="muted">No salesperson performance data yet.</p> : null}
            </div>
          </section>
        </section>
      ) : null}

      {currentView === "team" && isAdmin(user) ? (
        <section className="panel admin-panel">
          <div className="section-head">
            <h2>Staff access system</h2>
            <span>{users.length} team members</span>
          </div>

          <div className="content-grid">
              <form className="panel stack" onSubmit={handleSaveUser}>
                <h3>{editingUserId ? "Edit user" : "Add user"}</h3>
                <input
                  placeholder="Full name"
                  value={userForm.name}
                onChange={(event) => setUserForm({ ...userForm, name: event.target.value })}
              />
                <input
                  placeholder="Phone"
                  value={userForm.phone}
                  onChange={(event) => setUserForm({ ...userForm, phone: event.target.value })}
                />
                <div className="stack">
                  <strong>Access Roles</strong>
                  <div className="chip-row">
                    {availableUserRoles.map((item) => {
                      const checked = (userForm.roles || []).includes(item.value);
                      return (
                        <label key={item.value} className="status-chip" style={{ gap: "0.4rem", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const nextRoles = event.target.checked
                                ? [...new Set([...(userForm.roles || []), item.value])]
                                : (userForm.roles || []).filter((role) => role !== item.value);
                              setUserForm({
                                ...userForm,
                                roles: nextRoles,
                                role: nextRoles[0] || "sales",
                              });
                            }}
                          />
                          {item.label}
                        </label>
                      );
                    })}
                  </div>
                  <p className="muted">Primary compatibility role: {labelize((userForm.roles || [userForm.role])[0] || "sales")}</p>
                </div>
                <input
                  type="password"
                  placeholder={editingUserId ? "New password (optional)" : "Password"}
                  value={userForm.password}
                  onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
              />
              <div className="lead-actions">
                <button type="submit" disabled={busyAction === "save-user"}>
                  {busyAction === "save-user"
                    ? editingUserId
                      ? "Updating User..."
                      : "Creating User..."
                    : editingUserId
                      ? "Update User"
                      : "Create User"}
                </button>
                {editingUserId ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setEditingUserId(null);
                      setUserForm(emptyUser);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>

            <div className="panel list">
                {users.map((teamMember) => (
                  <article key={teamMember.id} className="lead-card">
                  <div className="section-head">
                    <div>
                      <h3>{teamMember.name}</h3>
                      <p className="muted">{teamMember.phone}</p>
                    </div>
                      <span className={`status-chip status-${teamMember.role}`}>{normalizeUserRoles(teamMember).map(labelize).join(", ")}</span>
                  </div>
                  <div className="lead-actions">
                    <button type="button" className="secondary" onClick={() => startEditingUser(teamMember)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        setPendingDelete({
                            type: "user",
                            id: teamMember.id,
                            entityLabel: "User",
                            message: `This will permanently remove ${teamMember.name} from the CRM team list.`,
                            subtext: `${teamMember.phone} | ${normalizeUserRoles(teamMember).map(labelize).join(", ")}`,
                          })
                        }
                      disabled={teamMember.id === user?.id}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
              {users.length === 0 ? (
                <EmptyState title="No team users yet" message="Create role-based users for sales, operations, accounts, and managers." />
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
        </div>
      </div>
    </div>
  );
}

  function ListLoadControlsImpl({ count, limit, onLoadMore, disabled = false }) {
    return (
      <div className="list-load-actions">
        <button type="button" className="secondary" onClick={onLoadMore} disabled={disabled || limit >= MAX_LIST_LIMIT}>
          {limit >= MAX_LIST_LIMIT ? "Max Loaded" : `Load 100 More`}
        </button>
      </div>
    );
}
const ListLoadControls = memo(ListLoadControlsImpl);

function PurchaseIntelligencePanelImpl({
  intelligence,
  currentRate,
  loading = false,
  formatCurrency,
}) {
  if (loading) {
    return (
      <section className="panel panel-nested purchase-intelligence-panel compact">
        <div className="section-head">
          <div>
            <h3>Purchase Intelligence</h3>
            <p className="muted">Loading recent product purchase history...</p>
          </div>
        </div>
      </section>
    );
  }

  if (!intelligence) {
    return (
      <section className="panel panel-nested purchase-intelligence-panel compact">
        <div className="section-head">
          <div>
            <h3>Purchase Intelligence</h3>
            <p className="muted">Select an inventory product to compare against recent purchase history.</p>
          </div>
        </div>
      </section>
    );
  }

  const insight = getPurchaseRateInsight(intelligence, currentRate);
  const statusLabel =
    insight.status === "approval_required"
      ? "Approval Required"
      : insight.status === "review"
        ? "Review"
        : "Normal";

  return (
    <section className="panel panel-nested purchase-intelligence-panel compact">
      <div className="section-head">
        <div>
          <h3>Purchase Intelligence</h3>
          <p className="muted">Compare entered purchase rate with recent buying history before finalizing.</p>
        </div>
        <span className={`status-chip status-${insight.status === "approval_required" ? "urgent" : insight.status === "review" ? "pending" : "active"}`}>
          {statusLabel}
        </span>
      </div>
      <div className="purchase-intelligence-grid">
        <div className="mini-card">
          <strong>Current Rate</strong>
          <p>{currentRate > 0 ? formatCurrency(currentRate) : "Enter qty + net amount"}</p>
        </div>
        <div className="mini-card">
          <strong>Last Rate</strong>
          <p>{formatCurrency(intelligence.last_purchase_rate || 0)}</p>
        </div>
        <div className="mini-card">
          <strong>30-day Avg</strong>
          <p>{formatCurrency(intelligence.avg_30_day_rate || 0)}</p>
        </div>
        <div className="mini-card">
          <strong>Difference</strong>
          <p>
            {currentRate > 0 && intelligence.avg_30_day_rate > 0
              ? `${insight.differenceAmount >= 0 ? "+" : ""}${formatCurrency(Math.abs(insight.differenceAmount))} / ${insight.differencePercentage >= 0 ? "+" : ""}${insight.differencePercentage}%`
              : "Waiting for rate"}
          </p>
        </div>
        <div className="mini-card">
          <strong>Supplier Suggestion</strong>
          <p>
            {intelligence.recommended_supplier
              ? `${intelligence.recommended_supplier} - ${formatCurrency(intelligence.best_supplier_rate || 0)}`
              : "Not available"}
          </p>
        </div>
        <div className="mini-card">
          <strong>Trend</strong>
          <p>{labelize(intelligence.trend || "stable")}</p>
        </div>
      </div>
      <div className="purchase-intelligence-meta">
        <span>Lowest {formatCurrency(intelligence.min_rate || 0)}</span>
        <span>Highest {formatCurrency(intelligence.max_rate || 0)}</span>
        <span>Last Supplier {intelligence.last_supplier || "Not available"}</span>
      </div>
      {(intelligence.last_5_rates || []).length ? (
        <div className="purchase-intelligence-history">
          <strong>Last 5 purchase rates</strong>
          <div className="purchase-history-list">
            {(intelligence.last_5_rates || []).map((entry, index) => (
              <span key={`${entry.purchase_date || "rate"}-${index}`} className="hero-pill">
                {formatCurrency(entry.rate)} - {entry.supplier_name || "Supplier"}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {(intelligence.supplier_comparison || []).length ? (
        <div className="purchase-intelligence-suppliers">
          <strong>Supplier comparison</strong>
          <div className="mini-list compact">
            {intelligence.supplier_comparison.slice(0, 4).map((supplier) => (
              <div key={`${supplier.supplier_name}-${supplier.last_purchase_date}`} className="timeline-item compact">
                <strong>{supplier.supplier_name}</strong>
                <p className="muted">
                  {formatCurrency(supplier.last_rate)} | Qty {supplier.quantity || 0} | {formatDate(supplier.last_purchase_date)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {insight.approvalRequired ? (
        <p className="field-error-message">
          Current purchase rate is more than 8% above the 30-day average. Draft save is allowed, but manager/admin approval is recommended before final approval.
        </p>
      ) : null}
    </section>
  );
}
const PurchaseIntelligencePanel = memo(PurchaseIntelligencePanelImpl);

function LeadDetailsPanelImpl({
    selectedLead,
  userRoles,
  editingLead,
  setEditingLead,
  users,
  followupForm,
  setFollowupForm,
  paymentForm,
  setPaymentForm,
  quotationForm,
  setQuotationForm,
  followups,
  payments,
  operationsTasks,
  quotations,
  plumbingJobs,
  plumbers,
  plumbingJobForm,
  setPlumbingJobForm,
  plumbingMaterialDrafts,
  updatePlumbingMaterialDraft,
  products,
  handleUpdateLead,
  handleCreateFollowup,
  handleCreatePayment,
  handleCreateOperationsTask,
  handleCreateQuotation,
  handleCreatePlumbingJob,
  handleUpdatePlumbingJobStatus,
  handleAddPlumbingMaterial,
  operationsTaskForm,
  setOperationsTaskForm,
  updateQuotationItem,
  addQuotationItem,
  addInventoryProductToQuote,
  busyAction,
  }) {
    const [openSection, setOpenSection] = useState("followups");
    const effectiveRoles = Array.isArray(userRoles) ? userRoles : [];
    const canManagePayments = effectiveRoles.includes("admin") || effectiveRoles.includes("manager") || effectiveRoles.includes("accounts");
    const canManageOperations = effectiveRoles.includes("admin") || effectiveRoles.includes("manager") || effectiveRoles.includes("operations");
    const canManagePlumbing = effectiveRoles.includes("admin") || effectiveRoles.includes("manager") || effectiveRoles.includes("operations");
    const canManageQuotations = effectiveRoles.includes("admin") || effectiveRoles.includes("manager") || effectiveRoles.includes("sales");

  useEffect(() => {
    setOpenSection("followups");
  }, [selectedLead?.id]);

  if (!selectedLead) {
    return (
      <section className="panel">
        <h2>Lead details</h2>
        <p className="muted">Select a lead to update status, quotations, follow-ups, and payments.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-head">
        <h2>{selectedLead.name}</h2>
        <span className={`status-chip status-${selectedLead.status}`}>{labelize(selectedLead.status)}</span>
      </div>
      <div className="detail-card stack">
        <p className="muted">
          {selectedLead.phone} | {selectedLead.location || "No location"} |{" "}
          {labelize(selectedLead.customer_type)}
        </p>
        <div className="chip-row">
          <span className={`status-chip unit-chip unit-${selectedLead.business_unit}`}>
            {labelize(selectedLead.business_unit)}
          </span>
          <span className="status-chip">{labelize(selectedLead.department)}</span>
          <span className="status-chip">{labelize(selectedLead.requirement_category)}</span>
        </div>
        <p>
          Budget Rs {selectedLead.budget || 0} | Timeline {labelize(selectedLead.timeline)}
        </p>
        <p>
          Plumbing jobs {selectedLead.plumbing_jobs_count || 0} | Plumbing value Rs {selectedLead.total_plumbing_cost || 0}
        </p>
        <p className="muted">
          Source {labelize(selectedLead.lead_source)} | Assigned to{" "}
          {selectedLead.assigned_to_name || "Unassigned"}
        </p>
        <p>{selectedLead.requirement || "Requirement details not added yet."}</p>
        <div className="lead-actions">
          <button
            type="button"
            className="secondary"
            onClick={() =>
              shareOnWhatsApp(selectedLead.phone, buildFollowupWhatsAppMessage(selectedLead))
            }
          >
            WhatsApp Follow-up
          </button>
          <button
            type="button"
            onClick={() =>
              shareOnWhatsApp(selectedLead.phone, buildVisitReminderMessage(selectedLead))
            }
          >
            Visit Reminder
          </button>
        </div>
      </div>

      <div className="accordion-stack">
        <AccordionSection
          title="Follow-ups"
          badge={`${followups.length} entries`}
          isOpen={openSection === "followups"}
          onToggle={() => setOpenSection(openSection === "followups" ? "" : "followups")}
          summary="Track calls, WhatsApp reminders, and visit commitments in one place."
        >
          <form className="stack" onSubmit={handleCreateFollowup}>
            <select
              value={followupForm.followup_type}
              onChange={(event) =>
                setFollowupForm({ ...followupForm, followup_type: event.target.value })
              }
            >
              {followupTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <textarea
              placeholder="Conversation note"
              value={followupForm.note}
              onChange={(event) => setFollowupForm({ ...followupForm, note: event.target.value })}
            />
            <input
              type="datetime-local"
              value={followupForm.followup_date}
              onChange={(event) =>
                setFollowupForm({ ...followupForm, followup_date: event.target.value })
              }
            />
            <button type="submit" disabled={busyAction === "save-followup"}>
              {busyAction === "save-followup" ? "Saving Follow-up..." : "Save Follow-up"}
            </button>
            <div className="mini-list">
              {followups.map((item) => (
                <div key={item.id} className="timeline-item">
                  <strong>{labelize(item.followup_type)}</strong>
                  <p>{item.note}</p>
                  <small>{formatDateTime(item.followup_date)}</small>
                </div>
              ))}
              {followups.length === 0 ? <p className="muted">No follow-ups logged yet.</p> : null}
            </div>
          </form>
        </AccordionSection>

        {canManagePayments ? (
        <AccordionSection
          title="Payment tracking"
          badge={`${payments.length} payments`}
          isOpen={openSection === "payments"}
          onToggle={() => setOpenSection(openSection === "payments" ? "" : "payments")}
          summary="Capture advances, balances, and due reminders without leaving the lead."
        >
          <form className="stack" onSubmit={handleCreatePayment}>
            <input
              type="number"
              placeholder="Amount"
              value={paymentForm.amount}
              onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
            />
            <select
              value={paymentForm.payment_type}
              onChange={(event) =>
                setPaymentForm({ ...paymentForm, payment_type: event.target.value })
              }
            >
              {paymentTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={paymentForm.due_date}
              onChange={(event) => setPaymentForm({ ...paymentForm, due_date: event.target.value })}
            />
            <textarea
              placeholder="Payment note"
              value={paymentForm.note}
              onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })}
            />
            <button type="submit" disabled={busyAction === "save-payment"}>
              {busyAction === "save-payment" ? "Recording Payment..." : "Record Payment"}
            </button>
            <div className="mini-list">
              {payments.map((item) => (
                <div key={item.id} className="timeline-item">
                  <strong>Rs {item.amount}</strong>
                  <p>{labelize(item.payment_type)}</p>
                  <small>{formatDateTime(item.created_at)}</small>
                </div>
              ))}
              {payments.length === 0 ? <p className="muted">No payments recorded yet.</p> : null}
            </div>
          </form>
        </AccordionSection>
        ) : null}

        {canManageOperations ? (
        <AccordionSection
          title="Operations tasks"
          badge={`${operationsTasks.length} tasks`}
          isOpen={openSection === "operations"}
          onToggle={() => setOpenSection(openSection === "operations" ? "" : "operations")}
          summary="Push site visits, delivery, installation, and measurement work into operations."
        >
          <section className="detail-columns">
            <form className="stack" onSubmit={handleCreateOperationsTask}>
              <select
                value={operationsTaskForm.task_type}
                onChange={(event) =>
                  setOperationsTaskForm({ ...operationsTaskForm, task_type: event.target.value })
                }
              >
                <option value="delivery">Delivery</option>
                <option value="site_visit">Site Visit</option>
                <option value="installation">Installation</option>
                <option value="measurement">Measurement</option>
              </select>
              <input
                placeholder="Task title"
                value={operationsTaskForm.title}
                onChange={(event) =>
                  setOperationsTaskForm({ ...operationsTaskForm, title: event.target.value })
                }
              />
              <textarea
                placeholder="Task note"
                value={operationsTaskForm.note}
                onChange={(event) =>
                  setOperationsTaskForm({ ...operationsTaskForm, note: event.target.value })
                }
              />
              <input
                type="datetime-local"
                value={operationsTaskForm.scheduled_for}
                onChange={(event) =>
                  setOperationsTaskForm({ ...operationsTaskForm, scheduled_for: event.target.value })
                }
              />
              <select
                value={operationsTaskForm.status}
                onChange={(event) =>
                  setOperationsTaskForm({ ...operationsTaskForm, status: event.target.value })
                }
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="delayed">Delayed</option>
              </select>
              <select
                value={operationsTaskForm.assigned_to}
                onChange={(event) =>
                  setOperationsTaskForm({ ...operationsTaskForm, assigned_to: event.target.value })
                }
              >
                <option value="">Unassigned</option>
                {users.map((teamMember) => (
                  <option key={teamMember.id} value={teamMember.id}>
                    {teamMember.name}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={busyAction === "save-operations-task"}>
                {busyAction === "save-operations-task" ? "Saving Task..." : "Save Ops Task"}
              </button>
            </form>

            <div className="stack">
              <h3>Operations timeline</h3>
              <div className="mini-list">
                {operationsTasks.map((task) => (
                  <div key={task.id} className="timeline-item">
                    <strong>{task.title}</strong>
                    <p>
                      {labelize(task.task_type)} | {labelize(task.status)}
                    </p>
                    <small>{formatDateTime(task.scheduled_for)}</small>
                  </div>
                ))}
                {operationsTasks.length === 0 ? (
                  <p className="muted">No operations tasks yet.</p>
                ) : null}
              </div>
            </div>
          </section>
        </AccordionSection>
        ) : null}

        {canManagePlumbing ? (
        <AccordionSection
          title="Plumbing services"
          badge={`${plumbingJobs.length} jobs`}
          isOpen={openSection === "plumbing"}
          onToggle={() => setOpenSection(openSection === "plumbing" ? "" : "plumbing")}
          summary="Track plumber assignment, material usage, and plumbing cost inside the same lead."
        >
          <section className="detail-columns">
            <form className="stack" onSubmit={handleCreatePlumbingJob}>
              <select
                value={plumbingJobForm.plumber_id}
                onChange={(event) =>
                  setPlumbingJobForm({ ...plumbingJobForm, plumber_id: event.target.value })
                }
              >
                <option value="">Assign plumber later</option>
                {plumbers.map((plumber) => (
                  <option key={plumber.id} value={plumber.id}>
                    {plumber.name} | {plumber.area || "No area"}
                  </option>
                ))}
              </select>
              <select
                value={plumbingJobForm.work_type}
                onChange={(event) =>
                  setPlumbingJobForm({ ...plumbingJobForm, work_type: event.target.value })
                }
              >
                {plumbingWorkTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                value={plumbingJobForm.status}
                onChange={(event) =>
                  setPlumbingJobForm({ ...plumbingJobForm, status: event.target.value })
                }
              >
                {plumbingJobStatuses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Service charge"
                value={plumbingJobForm.service_charge}
                onChange={(event) =>
                  setPlumbingJobForm({ ...plumbingJobForm, service_charge: event.target.value })
                }
              />
              <input
                type="datetime-local"
                value={plumbingJobForm.scheduled_for}
                onChange={(event) =>
                  setPlumbingJobForm({ ...plumbingJobForm, scheduled_for: event.target.value })
                }
              />
              <textarea
                placeholder="Job note"
                value={plumbingJobForm.note}
                onChange={(event) =>
                  setPlumbingJobForm({ ...plumbingJobForm, note: event.target.value })
                }
              />
              <button type="submit" disabled={busyAction === "save-plumbing-job"}>
                {busyAction === "save-plumbing-job" ? "Saving Job..." : "Create Plumbing Job"}
              </button>
            </form>

            <div className="stack">
              <h3>Service timeline</h3>
              <div className="mini-list">
                {plumbingJobs.map((job) => (
                <PlumbingJobCard
                  key={job.id}
                  job={job}
                  draft={plumbingMaterialDrafts[job.id] || emptyPlumbingMaterial}
                  onDraftChange={updatePlumbingMaterialDraft}
                  onAddMaterial={handleAddPlumbingMaterial}
                  onComplete={handleUpdatePlumbingJobStatus}
                  busyAction={busyAction}
                  />
                ))}
                {plumbingJobs.length === 0 ? <p className="muted">No plumbing jobs yet.</p> : null}
              </div>
            </div>
          </section>
        </AccordionSection>
        ) : null}

        {canManageQuotations ? (
        <AccordionSection
          title="Quotation builder"
          badge={`${quotations.length} saved`}
          isOpen={openSection === "quotations"}
          onToggle={() => setOpenSection(openSection === "quotations" ? "" : "quotations")}
          summary="Build quotations, pull in inventory items, and keep pricing attached to the lead."
        >
          <form className="stack quotation-form" onSubmit={handleCreateQuotation}>
            {quotationForm.items.map((item, index) => (
              <div key={`${index}-${item.product_name}`} className="quote-row">
                <input
                  placeholder="Tile design / product"
                  value={item.product_name}
                  onChange={(event) =>
                    updateQuotationItem(index, "product_name", event.target.value)
                  }
                />
                <input
                  placeholder="Size"
                  value={item.tile_size}
                  onChange={(event) => updateQuotationItem(index, "tile_size", event.target.value)}
                />
                <input
                  type="number"
                  placeholder="Sq ft"
                  value={item.quantity_sqft}
                  onChange={(event) =>
                    updateQuotationItem(index, "quantity_sqft", event.target.value)
                  }
                />
                <input
                  type="number"
                  placeholder="Unit price"
                  value={item.unit_price}
                  onChange={(event) => updateQuotationItem(index, "unit_price", event.target.value)}
                />
              </div>
            ))}
            <div className="lead-actions">
              <button type="button" className="secondary" onClick={addQuotationItem} disabled={busyAction === "save-quotation"}>
                Add Item
              </button>
              <span className="muted">Approved quotations deduct linked stock automatically.</span>
            </div>
            <div className="mini-list">
              {products.slice(0, 5).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="mini-card"
                  onClick={() => addInventoryProductToQuote(product)}
                >
                  <strong>{product.name}</strong>
                  <span>{product.tile_size || "Standard"}</span>
                  <small>
                    Rs {getProductTodaySellingRate(product) || product.price_per_sqft}/sqft | Stock {product.stock_sqft} sqft
                  </small>
                </button>
              ))}
            </div>
            <div className="quote-row">
              <input
                type="number"
                placeholder="Discount"
                value={quotationForm.discount}
                onChange={(event) =>
                  setQuotationForm({ ...quotationForm, discount: event.target.value })
                }
              />
              <input
                type="number"
                placeholder="Transport"
                value={quotationForm.transport_cost}
                onChange={(event) =>
                  setQuotationForm({ ...quotationForm, transport_cost: event.target.value })
                }
              />
              <select
                value={quotationForm.status}
                onChange={(event) =>
                  setQuotationForm({ ...quotationForm, status: event.target.value })
                }
              >
                <option value="draft">Draft</option>
                <option value="shared">Shared</option>
                <option value="approved">Approved</option>
              </select>
              <button type="submit" disabled={busyAction === "save-quotation"}>
                {busyAction === "save-quotation" ? "Saving Quotation..." : "Save Quotation"}
              </button>
            </div>
          </form>
        </AccordionSection>
        ) : null}

        <AccordionSection
          title="Edit lead"
          badge={labelize(editingLead.status)}
          isOpen={openSection === "lead"}
          onToggle={() => setOpenSection(openSection === "lead" ? "" : "lead")}
          summary="Update assignment, source, requirement, stage, and lost reason from one controlled form."
        >
          <form className="stack form-grid" onSubmit={handleUpdateLead}>
            <input
              placeholder="Customer name"
              value={editingLead.name}
              onChange={(event) => setEditingLead({ ...editingLead, name: event.target.value })}
            />
            <input
              placeholder="Phone"
              value={editingLead.phone}
              onChange={(event) => setEditingLead({ ...editingLead, phone: event.target.value })}
            />
            <input
              placeholder="Location"
              value={editingLead.location}
              onChange={(event) => setEditingLead({ ...editingLead, location: event.target.value })}
            />
            <select
              value={editingLead.department}
              onChange={(event) => setEditingLead({ ...editingLead, department: event.target.value })}
            >
              <option value="sales">Sales</option>
              <option value="operations">Operations</option>
            </select>
            <select
              value={editingLead.business_unit}
              onChange={(event) =>
                setEditingLead({ ...editingLead, business_unit: event.target.value })
              }
            >
              <option value="tiles">Tiles</option>
              <option value="plumbing">Plumbing</option>
              <option value="both">Tiles + Plumbing</option>
            </select>
            <select
              value={editingLead.customer_type}
              onChange={(event) =>
                setEditingLead({ ...editingLead, customer_type: event.target.value })
              }
            >
              {customerTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={editingLead.requirement_category}
              onChange={(event) =>
                setEditingLead({ ...editingLead, requirement_category: event.target.value })
              }
            >
              {requirementCategories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Budget"
              value={editingLead.budget}
              onChange={(event) => setEditingLead({ ...editingLead, budget: event.target.value })}
            />
            <select
              value={editingLead.timeline}
              onChange={(event) => setEditingLead({ ...editingLead, timeline: event.target.value })}
            >
              {timelines.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={editingLead.lead_source}
              onChange={(event) => setEditingLead({ ...editingLead, lead_source: event.target.value })}
            >
              {leadSources.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={editingLead.status}
              onChange={(event) => setEditingLead({ ...editingLead, status: event.target.value })}
            >
              {leadStatuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={editingLead.assigned_to}
              onChange={(event) => setEditingLead({ ...editingLead, assigned_to: event.target.value })}
            >
              <option value="">Unassigned</option>
              {users.map((teamMember) => (
                <option key={teamMember.id} value={teamMember.id}>
                  {teamMember.name}
                </option>
              ))}
            </select>
            <textarea
              className="full-span"
              placeholder="Requirement details"
              value={editingLead.requirement}
              onChange={(event) =>
                setEditingLead({ ...editingLead, requirement: event.target.value })
              }
            />
            {editingLead.status === "lost" ? (
              <textarea
                className="full-span"
                placeholder="Lost reason"
                value={editingLead.lost_reason}
                onChange={(event) =>
                  setEditingLead({ ...editingLead, lost_reason: event.target.value })
                }
              />
            ) : null}
            <button className="full-span" type="submit" disabled={busyAction === "update-lead"}>
              {busyAction === "update-lead" ? "Updating Lead..." : "Update Lead"}
            </button>
          </form>
        </AccordionSection>
      </div>
    </section>
  );
}
const LeadDetailsPanel = memo(LeadDetailsPanelImpl);

function AccordionSectionImpl({ title, badge, summary, isOpen, onToggle, children }) {
  return (
    <section className={`accordion-item ${isOpen ? "open" : ""}`}>
      <button type="button" className="accordion-trigger" onClick={onToggle} aria-expanded={isOpen}>
        <div>
          <strong>{title}</strong>
          <p className="muted">{summary}</p>
        </div>
        <div className="accordion-meta">
          <span className="status-chip">{badge}</span>
          <span className="accordion-caret">{isOpen ? "-" : "+"}</span>
        </div>
      </button>
      {isOpen ? <div className="accordion-content">{children}</div> : null}
    </section>
  );
}
const AccordionSection = memo(AccordionSectionImpl);

function ProjectCardImpl({ project, selected, onSelect, onEdit, canEdit }) {
  return (
    <article className={`lead-card ${selected ? "active" : ""}`} onClick={onSelect}>
      <div className="section-head">
        <div>
          <h3>{project.project_name}</h3>
          <p className="muted">{project.project_code} | {project.lead_name}</p>
        </div>
        <span className={`status-chip status-${project.status}`}>{labelize(project.status)}</span>
      </div>
      <p className="muted">
        Tiles Rs {project.tiles_sales_revenue} | Plumbing Rs {project.plumbing_revenue}
      </p>
      <p className="muted">
        Profit Rs {project.net_profit} | Margin {project.profit_margin}% | Pending Rs {project.pending_payment}
      </p>
      <div className="lead-actions">
        <small>Dispatch pending {project.pending_dispatch_items}</small>
        {canEdit ? (
          <button
            type="button"
            className="secondary"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
          >
            Edit
          </button>
        ) : null}
      </div>
    </article>
  );
}
const ProjectCard = memo(ProjectCardImpl);

function ProjectDetailPanelImpl({
  project,
  dispatchDraft,
  updateDispatchDraft,
  handleSaveDispatch,
  handleUpdateDispatchStatus,
  canManageDispatch,
  busyAction,
}) {
  if (!project) {
    return (
      <section className="panel">
        <h2>Project detail</h2>
        <p className="muted">Select a project to review profit, dispatch, and execution details.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>{project.project_name}</h2>
          <p className="muted">{project.project_code} | {project.lead_name} | {project.lead_location || "No area"}</p>
        </div>
        <span className={`status-chip status-${project.status}`}>{labelize(project.status)}</span>
      </div>
      <div className="tabs-row">
        <BadgeCard title="Tiles Revenue" count={`Rs ${project.tiles_sales_revenue}`} />
        <BadgeCard title="Plumbing Revenue" count={`Rs ${project.plumbing_revenue}`} />
        <BadgeCard title="Net Profit" count={`Rs ${project.net_profit}`} tone="accent" />
        <BadgeCard title="Margin" count={`${project.profit_margin}%`} tone="accent" />
      </div>
      <div className="stack">
        <HighlightRow label="Adhesive Token Liability" value={`Rs ${project.labour_token_cost}`} />
        <HighlightRow label="Pending Adhesive Tokens" value={`Rs ${project.pending_token_amount}`} tone="danger" />
        <HighlightRow label="Paid Adhesive Tokens" value={`Rs ${project.paid_token_amount}`} />
        <HighlightRow label="Plumbing Material Cost" value={`Rs ${project.plumbing_material_cost}`} />
        <HighlightRow label="Received Payment" value={`Rs ${project.received_payment}`} />
        <HighlightRow label="Pending Payment" value={`Rs ${project.pending_payment}`} tone="danger" />
        <HighlightRow label="Pending Dispatch Items" value={project.pending_dispatch_items} />
      </div>
      <div className="stack">
        <h3>Adhesive token entries</h3>
        <div className="mini-list">
          {(project.adhesive_tokens || []).map((token) => (
            <div key={token.id} className="timeline-item">
              <strong>{token.mason_name}</strong>
              <p className="muted">
                {token.site_name} | {token.invoice_number} | {token.adhesive_company}
              </p>
              <p>
                {token.claimed_bag_quantity} claimed / {token.sold_bag_quantity} sold | Rs {token.total_token_amount}
              </p>
              <p className="muted">
                {labelize(token.verification_status)} | {labelize(token.status)}
              </p>
              <div className="mini-list">
                {(token.items || []).map((item) => (
                  <div key={item.id} className="timeline-item compact-line">
                    Rs {item.token_value} x {item.quantity} = Rs {item.line_total}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!project.adhesive_tokens?.length ? (
            <p className="muted">No adhesive token entries linked to this project yet.</p>
          ) : null}
        </div>
      </div>
      <div className="stack">
        <h3>Dispatch tracking</h3>
        <div className="lead-actions">
          <button type="button" className="secondary" onClick={() => window.open(getProjectInvoicePdfUrl(project.id), "_blank", "noopener,noreferrer")}>
            Open Invoice PDF
          </button>
        </div>
        {canManageDispatch ? (
          <div className="form-grid">
            <input
              placeholder="Product / material"
              value={dispatchDraft.item_name}
              onChange={(event) => updateDispatchDraft(project.id, "item_name", event.target.value)}
            />
            <input
              type="number"
              placeholder="Quantity"
              value={dispatchDraft.quantity}
              onChange={(event) => updateDispatchDraft(project.id, "quantity", event.target.value)}
            />
            <input
              placeholder="Vehicle number"
              value={dispatchDraft.vehicle_number}
              onChange={(event) => updateDispatchDraft(project.id, "vehicle_number", event.target.value)}
            />
            <input
              placeholder="Driver name"
              value={dispatchDraft.driver_name}
              onChange={(event) => updateDispatchDraft(project.id, "driver_name", event.target.value)}
            />
            <input
              type="datetime-local"
              value={dispatchDraft.dispatch_date}
              onChange={(event) => updateDispatchDraft(project.id, "dispatch_date", event.target.value)}
            />
            <select
              value={dispatchDraft.status}
              onChange={(event) => updateDispatchDraft(project.id, "status", event.target.value)}
            >
              {dispatchStatuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <textarea
              className="full-span"
              placeholder="Dispatch note"
              value={dispatchDraft.note}
              onChange={(event) => updateDispatchDraft(project.id, "note", event.target.value)}
            />
            <button className="full-span" type="button" onClick={() => handleSaveDispatch(project.id)} disabled={busyAction === "save-dispatch"}>
              {busyAction === "save-dispatch" ? "Saving Dispatch..." : "Add Dispatch"}
            </button>
          </div>
        ) : null}
        <div className="mini-list">
          {(project.dispatches || []).map((dispatch) => (
            <div key={dispatch.id} className="timeline-item">
              <strong>{dispatch.item_name}</strong>
              <p>{dispatch.quantity} qty | {dispatch.vehicle_number || "No vehicle"} | {dispatch.driver_name || "No driver"}</p>
              <small>{labelize(dispatch.status)} | {formatDateTime(dispatch.dispatch_date)}</small>
              {canManageDispatch && dispatch.status !== "delivered" ? (
                <div className="lead-actions">
                  <button type="button" className="secondary" onClick={() => handleUpdateDispatchStatus(project.id, dispatch)} disabled={busyAction === "update-dispatch-status"}>
                    {dispatch.status === "pending" ? "Mark Dispatched" : "Mark Delivered"}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {!project.dispatches?.length ? <p className="muted">No dispatches recorded yet.</p> : null}
        </div>
      </div>
      <div className="stack">
        <h3>Owner note</h3>
        <p>{project.owner_note || "No owner note added yet."}</p>
      </div>
    </section>
  );
}
const ProjectDetailPanel = memo(ProjectDetailPanelImpl);

function PlumbingJobCardImpl({
  job,
  draft,
  onDraftChange,
  onAddMaterial,
  onComplete,
  onOpenLead,
  showLeadLink = false,
  busyAction = "",
}) {
  return (
    <article className="lead-card unit-plumbing plumbing-card">
      <div className="section-head">
        <div>
          <h3>{labelize(job.work_type)}</h3>
          <p className="muted">
            {job.plumber_name || "Unassigned plumber"} | Service Rs {job.service_charge || 0}
          </p>
        </div>
        <span className={`status-chip status-${job.status}`}>{labelize(job.status)}</span>
      </div>
      {showLeadLink ? <p className="muted">{job.lead_name} | {job.lead_location || "No area"}</p> : null}
      <p>{job.note || "No plumbing job note added yet."}</p>
      <p className="muted">
        Scheduled {formatDateTime(job.scheduled_for)} | Materials Rs {job.material_cost || 0} | Total Rs {job.total_cost || 0}
      </p>
      <div className="mini-list">
        {(job.materials || []).map((material) => (
          <div key={material.id} className="timeline-item compact-line">
            <strong>{material.item_name}</strong>
            <small>
              {material.quantity} {material.unit} | Rs {material.price}
            </small>
          </div>
        ))}
        {job.material_count && !job.materials?.length ? (
          <p className="muted">{job.material_count} materials recorded on this job.</p>
        ) : null}
      </div>
      <div className="quote-row">
        <input
          placeholder="Material item"
          value={draft.item_name}
          onChange={(event) => onDraftChange(job.id, "item_name", event.target.value)}
        />
        <input
          type="number"
          placeholder="Qty"
          value={draft.quantity}
          onChange={(event) => onDraftChange(job.id, "quantity", event.target.value)}
        />
        <input
          placeholder="Unit"
          value={draft.unit}
          onChange={(event) => onDraftChange(job.id, "unit", event.target.value)}
        />
        <input
          type="number"
          placeholder="Price"
          value={draft.price}
          onChange={(event) => onDraftChange(job.id, "price", event.target.value)}
        />
      </div>
      <div className="lead-actions">
        <button type="button" className="secondary" onClick={() => onAddMaterial(job.id, job.lead_id)} disabled={busyAction === "save-plumbing-material"}>
          {busyAction === "save-plumbing-material" ? "Saving Material..." : "Add Material"}
        </button>
        {job.status !== "completed" ? (
          <button type="button" onClick={() => onComplete(job)} disabled={busyAction === "complete-plumbing-job"}>
            {busyAction === "complete-plumbing-job" ? "Completing..." : "Mark Complete"}
          </button>
        ) : null}
        {showLeadLink ? (
          <button type="button" className="secondary" onClick={onOpenLead}>
            Open Lead
          </button>
        ) : null}
      </div>
    </article>
  );
}
const PlumbingJobCard = memo(PlumbingJobCardImpl);

function LeadCardImpl({ lead, selected, onSelect, onDelete, canDelete = false }) {
  return (
    <article
      className={`lead-card unit-${lead.business_unit} ${selected ? "active" : ""}`}
      onClick={onSelect}
    >
      <div className="section-head">
        <div>
          <h3>{lead.name}</h3>
          <p>{lead.phone}</p>
        </div>
        <span className={`status-chip status-${lead.status}`}>{labelize(lead.status)}</span>
      </div>
      <div className="chip-row">
        <span className={`status-chip unit-chip unit-${lead.business_unit}`}>
          {labelize(lead.business_unit)}
        </span>
        <span className="status-chip">{labelize(lead.department)}</span>
        <span className="status-chip">{labelize(lead.customer_type)}</span>
      </div>
      <p className="muted">{lead.location || "No area"}</p>
      <p>{lead.requirement || "No requirement captured yet."}</p>
      <div className="lead-actions">
        <small>Quote Rs {lead.latest_quote_amount || 0}</small>
        <small>Paid Rs {lead.total_paid || 0}</small>
        {canDelete ? (
          <button
            type="button"
            className="danger"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}
const LeadCard = memo(LeadCardImpl);

function StatCardImpl({ label, value, tone = "default" }) {
  return (
    <article className={tone === "default" ? "stat-card" : `stat-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
const StatCard = memo(StatCardImpl);

function HighlightRowImpl({ label, value, tone = "default" }) {
  return (
    <div className={`highlight-row tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
const HighlightRow = memo(HighlightRowImpl);

function BadgeCardImpl({ title, count, tone = "default" }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <span>{title}</span>
      <strong>{count}</strong>
    </article>
  );
}
const BadgeCard = memo(BadgeCardImpl);

function EmptyStateImpl({ title, message, compact = false }) {
  return (
    <div className={`empty-state ${compact ? "compact" : ""}`}>
      <strong>{title}</strong>
      <p className="muted">{message}</p>
    </div>
  );
}
const EmptyState = memo(EmptyStateImpl);

function LazySectionFallback({ label = "module" }) {
  return (
    <section className="panel">
      <p className="loading-banner">Loading {label}...</p>
    </section>
  );
}

function normalizeLeadPayload(lead) {
  return {
    ...lead,
    budget: Number(lead.budget || 0),
    assigned_to: lead.assigned_to || null,
  };
}

function normalizeDealerPayload(dealer) {
  return {
    ...dealer,
    monthly_purchase: Number(dealer.monthly_purchase || 0),
    credit_limit: Number(dealer.credit_limit || 0),
    outstanding_payment: Number(dealer.outstanding_payment || 0),
    commission_percent: Number(dealer.commission_percent || 0),
  };
}

function getProductCompany(product) {
  return normalizeText(
    product?.company_name ||
    product?.company ||
    product?.brand ||
    product?.manufacturer ||
    ""
  );
}

function getProductSize(product) {
  return normalizeText(
    product?.product_size ||
    product?.tile_size ||
    product?.size ||
    ""
  );
}

function getProductDesignCode(product) {
  return normalizeText(
    product?.design_code ||
    product?.code ||
    product?.design ||
    product?.item_code ||
    ""
  );
}

function getProductFinish(product) {
  return normalizeText(
    product?.finish ||
    product?.surface ||
    product?.type ||
    ""
  );
}

function getProductStockSqft(product) {
  const stockSqft = Number(product?.stock_sqft ?? 0);
  return Number.isFinite(stockSqft) ? stockSqft : 0;
}

function getProductStockBoxes(product) {
  const rawStockBoxes = Number(product?.stock_boxes);
  if (Number.isFinite(rawStockBoxes)) {
    return rawStockBoxes;
  }

  const sqftPerBox = Number(product?.sqft_per_box ?? 0);
  const stockSqft = getProductStockSqft(product);

  if (sqftPerBox > 0) {
    return Number((stockSqft / sqftPerBox).toFixed(2));
  }

  return stockSqft;
}

function getProductLowStockThreshold(product) {
  const threshold = Number(product?.low_stock_threshold ?? 10);
  return Number.isFinite(threshold) && threshold >= 0 ? threshold : 10;
}

function isProductLowStock(product) {
  if (typeof product?.is_low_stock === "boolean") {
    return product.is_low_stock;
  }

  return getProductStockBoxes(product) <= getProductLowStockThreshold(product);
}

function getProductStockState(product) {
  const stockSqft = getProductStockSqft(product);
  const stockBoxes = getProductStockBoxes(product);

  if (stockSqft <= 0 || stockBoxes <= 0) {
    return "out";
  }

  if (isProductLowStock(product)) {
    return "low";
  }

  return "in";
}

function normalizeProductPayload(product) {
  const normalizedCompanyName = getProductCompany(product);
  const normalizedProductSize = getProductSize(product);
  const normalizedTileSize = normalizeText(product.tile_size || normalizedProductSize);
  const normalizedDesignCode = getProductDesignCode(product);
  const normalizedFinish = getProductFinish(product);

  return {
    ...product,
    company_name: normalizedCompanyName,
    unit: normalizeText(product.unit) || "pcs",
    product_size: normalizedProductSize,
    tile_size: normalizedTileSize,
    design_code: normalizedDesignCode,
    finish: normalizedFinish,
    stock_sqft: Number(product.stock_sqft || 0),
    low_stock_threshold:
      product.low_stock_threshold === "" || product.low_stock_threshold == null
        ? 10
        : Number(product.low_stock_threshold),
    pieces_per_box: Number(product.pieces_per_box || 0),
    sqft_per_box: Number(product.sqft_per_box || 0),
    weight_per_box: Number(product.weight_per_box || 0),
    weight_per_unit: Number(product.weight_per_unit || 0),
    purchase_rate: Number(product.purchase_rate || 0),
    price_per_sqft: Number(product.price_per_sqft || 0),
    predefined_rate: Number(product.predefined_rate || 0),
    today_selling_rate: Number(product.today_selling_rate || 0),
    daily_up_limit_percent: Number(product.daily_up_limit_percent || 2),
    daily_down_limit_percent: Number(product.daily_down_limit_percent || 1),
    last_purchase_rate: Number(product.last_purchase_rate || 0),
    landed_cost_per_unit: Number(product.landed_cost_per_unit || 0),
    minimum_allowed_rate: Number(product.minimum_allowed_rate || 0),
    suggested_selling_rate: Number(product.suggested_selling_rate || 0),
    operator_discount_cap: Number(product.operator_discount_cap || 0),
    manager_discount_cap: Number(product.manager_discount_cap || 0),
    owner_discount_cap: Number(product.owner_discount_cap || 0),
    safety_margin_percent: Number(product.safety_margin_percent || 0),
    growth_margin_percent: Number(product.growth_margin_percent || 0),
    quotation_validity_days: Number(product.quotation_validity_days || 0),
    pricing_lock: Boolean(product.pricing_lock),
  };
}

function buildPurchaseBatchSuggestion(product, purchaseDate, rowIndex) {
  const dateValue = isValidDateInput(purchaseDate) ? purchaseDate : new Date().toISOString().slice(0, 10);
  const compactDate = String(dateValue).replaceAll("-", "").slice(2);
  const productCodeSource =
    normalizeText(product?.design_code) ||
    normalizeText(product?.product_size || product?.tile_size) ||
    normalizeText(product?.name) ||
    "BATCH";
  const productCode = productCodeSource
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "BATCH";
  const rowSuffix = String(Number(rowIndex || 0) + 1).padStart(2, "0");
  return `${productCode}-${compactDate}-${rowSuffix}`;
}

function getProductDataGaps(product) {
  const gaps = [];

  if (!getProductCompany(product)) {
    gaps.push("company");
  }

  if (!getProductDesignCode(product)) {
    gaps.push("design");
  }

  if (!getProductSize(product)) {
    gaps.push("size");
  }

  if (!getProductFinish(product)) {
    gaps.push("finish");
  }

  if (Number(product?.pieces_per_box || 0) <= 0 || Number(product?.sqft_per_box || 0) <= 0) {
    gaps.push("packaging");
  }

  if (Number(product?.weight_per_box || 0) <= 0 || Number(product?.weight_per_unit || 0) <= 0) {
    gaps.push("weight");
  }

  const pricingFields = [
    Number(product?.purchase_rate || 0),
    Number(product?.landed_cost_per_unit || 0),
    Number(product?.minimum_allowed_rate || 0),
    Number(product?.suggested_selling_rate || 0),
  ];
  if (pricingFields.some((value) => value <= 0)) {
    gaps.push("pricing");
  }

  return gaps;
}

function getProductCompletenessPercent(product) {
  const checks = [
    Boolean(getProductCompany(product)),
    Boolean(getProductDesignCode(product)),
    Boolean(getProductSize(product)),
    Boolean(getProductFinish(product)),
    Number(product?.pieces_per_box || 0) > 0 && Number(product?.sqft_per_box || 0) > 0,
    Number(product?.weight_per_box || 0) > 0 && Number(product?.weight_per_unit || 0) > 0,
    Number(product?.purchase_rate || 0) > 0,
    Number(product?.landed_cost_per_unit || 0) > 0,
    Number(product?.minimum_allowed_rate || 0) > 0,
    Number(product?.suggested_selling_rate || 0) > 0,
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

function formatProductDataGapLabel(code) {
  switch (code) {
    case "company":
      return "company";
    case "design":
      return "design code";
    case "size":
      return "size";
    case "finish":
      return "finish";
    case "packaging":
      return "packaging";
    case "weight":
      return "weight";
    case "pricing":
      return "pricing";
    default:
      return labelize(code);
  }
}

function normalizePurchaseCostingPayload(lot) {
  return {
    lot_number: normalizeText(lot.lot_number),
    arrival_date: lot.arrival_date || null,
    vehicle_number: normalizeText(lot.vehicle_number),
    transporter_name: normalizeText(lot.transporter_name),
    driver_name: normalizeText(lot.driver_name),
    driver_mobile: normalizeText(lot.driver_mobile),
    allocation_method: lot.allocation_method || "weight_wise",
    total_freight_cost: Number(lot.total_freight_cost || 0),
    total_unloading_cost: Number(lot.total_unloading_cost || 0),
    other_charges: Number(lot.other_charges || 0),
    financed_amount: Number(lot.financed_amount || 0),
    interest_rate_percent: Number(lot.interest_rate_percent || 0),
    holding_days: Number(lot.holding_days || 0),
    stock_received_date: lot.stock_received_date || lot.arrival_date || null,
    interest_cost_override:
      lot.interest_cost_override === "" || lot.interest_cost_override == null
        ? null
        : Number(lot.interest_cost_override || 0),
    showroom_overhead_amount: Number(lot.showroom_overhead_amount || 0),
    monthly_overhead_allocation_method:
      normalizeText(lot.monthly_overhead_allocation_method) || "per_box",
    time_decay_percent:
      lot.time_decay_percent === "" || lot.time_decay_percent == null ? null : Number(lot.time_decay_percent || 0),
    marketing_cost_amount: Number(lot.marketing_cost_amount || 0),
    marketing_cost_allocation_method: normalizeText(lot.marketing_cost_allocation_method) || "manual",
    overhead_period: normalizeText(lot.overhead_period),
    overhead_notes: normalizeText(lot.overhead_notes),
    minimum_margin_percent: Number(lot.minimum_margin_percent || 0),
    target_margin_percent: Number(lot.target_margin_percent || 0),
    remarks: normalizeText(lot.remarks),
    suppliers: (lot.suppliers || []).map((supplier) => ({
      supplier_name: normalizeText(supplier.supplier_name),
      supplier_invoice_number: normalizeText(supplier.supplier_invoice_number),
      supplier_invoice_date: supplier.supplier_invoice_date || null,
      supplier_amount:
        supplier.supplier_amount === "" || supplier.supplier_amount == null
          ? null
          : Number(supplier.supplier_amount || 0),
      supplier_notes: normalizeText(supplier.supplier_notes),
      items: (supplier.items || []).map((item) => ({
        product_id: item.product_id ? Number(item.product_id) : null,
        item_name: normalizeText(item.item_name),
        company_name: normalizeText(item.company_name),
        product_size: normalizeText(item.product_size),
        category: normalizeText(item.category) || "tiles",
        quantity: Number(item.quantity || 0),
        unit: normalizeText(item.unit) || "pcs",
        boxes: Number(item.boxes || 0),
        pieces_per_box: Number(item.pieces_per_box || 0),
        sqft_per_box: Number(item.sqft_per_box || 0),
        weight_per_box: Number(item.weight_per_box || 0),
        weight_per_unit: Number(item.weight_per_unit || 0),
        basic_purchase_rate: Number(item.basic_purchase_rate || 0),
        damage_quantity: Number(item.damage_quantity || 0),
        manual_allocation_value: Number(item.manual_allocation_value || 0),
      })),
    })),
  };
}

function mapPurchaseLotToForm(lot) {
  return {
    lot_number: lot.lot_number || "",
    arrival_date: lot.arrival_date ? String(lot.arrival_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    vehicle_number: lot.vehicle_number || "",
    transporter_name: lot.transporter_name || "",
    driver_name: lot.driver_name || "",
    driver_mobile: lot.driver_mobile || "",
    allocation_method: lot.allocation_method || "weight_wise",
    total_freight_cost:
      lot.total_freight_cost != null && lot.total_freight_cost !== "" ? String(lot.total_freight_cost) : "",
    total_unloading_cost:
      lot.total_unloading_cost != null && lot.total_unloading_cost !== "" ? String(lot.total_unloading_cost) : "",
    other_charges: lot.other_charges != null && lot.other_charges !== "" ? String(lot.other_charges) : "",
    financed_amount:
      lot.financed_amount != null && lot.financed_amount !== "" ? String(lot.financed_amount) : "",
    interest_rate_percent:
      lot.interest_rate_percent != null && lot.interest_rate_percent !== ""
        ? String(lot.interest_rate_percent)
        : "",
    holding_days: lot.holding_days != null && lot.holding_days !== "" ? String(lot.holding_days) : "",
    stock_received_date: lot.stock_received_date ? String(lot.stock_received_date).slice(0, 10) : (lot.arrival_date ? String(lot.arrival_date).slice(0, 10) : new Date().toISOString().slice(0, 10)),
    interest_cost_override:
      lot.interest_cost_override != null && lot.interest_cost_override !== ""
        ? String(lot.interest_cost_override)
        : "",
    showroom_overhead_amount:
      lot.showroom_overhead_amount != null && lot.showroom_overhead_amount !== ""
        ? String(lot.showroom_overhead_amount)
        : "",
    monthly_overhead_amount:
      lot.monthly_overhead_amount != null && lot.monthly_overhead_amount !== ""
        ? String(lot.monthly_overhead_amount)
        : "",
    monthly_overhead_allocation_method: lot.monthly_overhead_allocation_method || "per_box",
    monthly_sales_boxes:
      lot.monthly_sales_boxes != null && lot.monthly_sales_boxes !== "" ? String(lot.monthly_sales_boxes) : "",
    monthly_sales_sqft:
      lot.monthly_sales_sqft != null && lot.monthly_sales_sqft !== "" ? String(lot.monthly_sales_sqft) : "",
    monthly_sales_quantity:
      lot.monthly_sales_quantity != null && lot.monthly_sales_quantity !== "" ? String(lot.monthly_sales_quantity) : "",
    monthly_sales_value:
      lot.monthly_sales_value != null && lot.monthly_sales_value !== "" ? String(lot.monthly_sales_value) : "",
    monthly_overhead_rate:
      lot.monthly_overhead_rate != null && lot.monthly_overhead_rate !== "" ? String(lot.monthly_overhead_rate) : "",
    time_decay_percent:
      lot.time_decay_percent != null && lot.time_decay_percent !== "" ? String(lot.time_decay_percent) : "",
    marketing_cost_amount:
      lot.marketing_cost_amount != null && lot.marketing_cost_amount !== "" ? String(lot.marketing_cost_amount) : "",
    marketing_cost_allocation_method: lot.marketing_cost_allocation_method || "manual",
    overhead_period: lot.overhead_period || "",
    overhead_notes: lot.overhead_notes || "",
    minimum_margin_percent:
      lot.minimum_margin_percent != null && lot.minimum_margin_percent !== ""
        ? String(lot.minimum_margin_percent)
        : "5",
    target_margin_percent:
      lot.target_margin_percent != null && lot.target_margin_percent !== ""
        ? String(lot.target_margin_percent)
        : "12",
    remarks: lot.remarks || "",
    suppliers:
      (lot.suppliers || []).map((supplier) => ({
        supplier_name: supplier.supplier_name || "",
        supplier_invoice_number: supplier.supplier_invoice_number || "",
        supplier_invoice_date: supplier.supplier_invoice_date ? String(supplier.supplier_invoice_date).slice(0, 10) : "",
        supplier_amount:
          supplier.supplier_amount != null && supplier.supplier_amount !== ""
            ? String(supplier.supplier_amount)
            : "",
        supplier_notes: supplier.supplier_notes || "",
        items:
          (supplier.items || []).map((item) => ({
            product_id: item.product_id ? String(item.product_id) : "",
            item_name: item.item_name || item.product_name_master || "",
            company_name: item.company_name || "",
            product_size: item.product_size || "",
            category: item.category || "tiles",
            quantity: item.quantity != null ? String(item.quantity) : "",
            unit: item.unit || "pcs",
            boxes: item.boxes != null ? String(item.boxes) : "",
            pieces_per_box: item.pieces_per_box != null ? String(item.pieces_per_box) : "",
            sqft_per_box: item.sqft_per_box != null ? String(item.sqft_per_box) : "",
            weight_per_box: item.weight_per_box != null ? String(item.weight_per_box) : "",
            weight_per_unit: item.weight_per_unit != null ? String(item.weight_per_unit) : "",
            basic_purchase_rate:
              item.basic_purchase_rate != null ? String(item.basic_purchase_rate) : "",
            damage_quantity: item.damage_quantity != null ? String(item.damage_quantity) : "",
            manual_allocation_value:
              item.manual_allocation_value != null ? String(item.manual_allocation_value) : "",
          })) || [{ ...emptyPurchaseLotItem }],
      })) || [{ ...emptyPurchaseLotSupplier, items: [{ ...emptyPurchaseLotItem }] }],
  };
}

function normalizeBillingInvoicePayload(invoice) {
  const totals = getBillingTotals(invoice);
  const systemDiscountMeta =
    invoice?.system_discount_meta && typeof invoice.system_discount_meta === "object"
      ? {
          original_total: Number(invoice.system_discount_meta.original_total || 0),
          system_benefit_amount: Number(invoice.system_discount_meta.system_benefit_amount || 0),
          final_total: Number(invoice.system_discount_meta.final_total || 0),
          approval_level: normalizeText(invoice.system_discount_meta.approval_level),
          reason: normalizeText(invoice.system_discount_meta.reason),
        }
      : null;
  return {
    customer_name: normalizeText(invoice.customer_name),
    customer_mobile: normalizeText(invoice.customer_mobile),
    customer_address: normalizeText(invoice.customer_address),
    lead_id: invoice.lead_id ? Number(invoice.lead_id) : null,
    quotation_id: invoice.quotation_id ? Number(invoice.quotation_id) : null,
    project_id: invoice.project_id ? Number(invoice.project_id) : null,
    site_reference: normalizeText(invoice.site_reference),
    invoice_type: invoice.invoice_type || "gst_invoice",
    invoice_date: invoice.invoice_date || null,
    notes: normalizeText(invoice.notes),
    transport_charge: Number(invoice.transport_charge || 0),
    additional_charge: Number(invoice.additional_charge || 0),
    approval_note: normalizeText(invoice.approval_note),
    status: invoice.status || "draft",
    subtotal: totals.subtotal,
    total_discount: totals.total_discount,
    gst_amount: totals.gst_amount,
    grand_total: totals.grand_total,
    system_discount_meta: systemDiscountMeta,
    items: (invoice.items || []).map((item) => ({
      product_id: item.product_id ? Number(item.product_id) : null,
      item_type: item.item_type || "tiles",
      product_name: normalizeText(item.product_name),
      quantity: Number(item.quantity || 0),
      unit: normalizeText(item.unit) || "pcs",
      rate: Number(item.rate || 0),
      discount: Number(item.discount || 0),
      gst_percent: Number(item.gst_percent || 0),
      total: computeBillingItemTotal(item),
    })),
  };
}

function mapInvoiceToForm(invoice) {
  return {
    customer_name: invoice.customer_name || "",
    customer_mobile: invoice.customer_mobile || "",
    customer_address: invoice.customer_address || "",
    lead_id: invoice.lead_id ? String(invoice.lead_id) : "",
    quotation_id: invoice.quotation_id ? String(invoice.quotation_id) : "",
    project_id: invoice.project_id ? String(invoice.project_id) : "",
    site_reference: invoice.site_reference || "",
    invoice_type: invoice.invoice_type || "gst_invoice",
    invoice_date: invoice.invoice_date ? String(invoice.invoice_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    notes: invoice.notes || "",
    transport_charge:
      invoice.transport_charge != null && invoice.transport_charge !== ""
        ? String(invoice.transport_charge)
        : "",
    additional_charge:
      invoice.additional_charge != null && invoice.additional_charge !== ""
        ? String(invoice.additional_charge)
        : "",
    approval_note: invoice.approval_note || "",
    system_discount_meta: invoice.system_discount_meta || null,
    status: invoice.status || "draft",
    items:
      (invoice.items || []).map((item) => ({
        item_type: item.item_type || "tiles",
        product_id: item.product_id ? String(item.product_id) : "",
        product_name: item.product_name || "",
        quantity: item.quantity != null ? String(item.quantity) : "",
        unit: item.unit || "pcs",
        suggested_rate: item.suggested_rate != null ? String(item.suggested_rate) : "",
        minimum_allowed_rate:
          item.minimum_allowed_rate != null ? String(item.minimum_allowed_rate) : "",
        rate: item.rate != null ? String(item.rate) : "",
        discount: item.discount != null ? String(item.discount) : "",
        gst_percent: item.gst_percent != null ? String(item.gst_percent) : "18",
      })) || [{ ...emptyInvoiceItem }],
  };
}

function normalizeSchemeTokenPayload(token) {
  const totals = getAdhesiveClaimTotals(token);
  return {
    ...token,
    project_id: token.project_id ? Number(token.project_id) : null,
    mason_id: token.mason_id ? Number(token.mason_id) : null,
    sold_bag_quantity: Number(token.sold_bag_quantity || 0),
    claimed_bag_quantity: totals.claimed_bag_quantity,
    total_token_amount: totals.total_token_amount,
    items: (token.items || []).map((item) => ({
      token_value: Number(item.token_value || 0),
      quantity: Number(item.quantity || 0),
      line_total: Number(item.token_value || 0) * Number(item.quantity || 0),
    })),
    payment_date: token.payment_date || null,
  };
}

function mapAdhesiveClaimToForm(token) {
  return {
    site_name: token.site_name || "",
    project_id: token.project_id ? String(token.project_id) : "",
    invoice_number: token.invoice_number || "",
    sale_date: token.sale_date ? String(token.sale_date).slice(0, 10) : "",
    customer_name: token.customer_name || "",
    mason_id: token.mason_id ? String(token.mason_id) : "",
    mason_mobile: token.mason_mobile || "",
    mason_area: token.mason_area || "",
    adhesive_company: token.adhesive_company || "",
    adhesive_type: token.adhesive_type || "",
    sold_bag_quantity: token.sold_bag_quantity ? String(token.sold_bag_quantity) : "",
    items:
      (token.items || []).map((item) => ({
        token_value: item.token_value ?? 20,
        quantity: item.quantity ?? 1,
      })) || [{ token_value: 20, quantity: 1 }],
    verification_status: token.verification_status || "unverified",
    status: token.status || "pending",
    payment_date: token.payment_date ? String(token.payment_date).slice(0, 10) : "",
    remarks: token.remarks || "",
    token_photo_url: token.token_photo_url || "",
  };
}

function canEditAdhesiveClaim(token) {
  return token?.status === "pending" && token?.verification_status !== "approved";
}

function getAdhesiveClaimActionState(token, userLike) {
  const effectiveRoles = normalizeUserRoles(userLike);
  const isAdmin = effectiveRoles.includes("admin");
  const isManager = effectiveRoles.includes("manager");
  const status = String(token?.status || "").toLowerCase();
  const verificationStatus = String(token?.verification_status || "").toLowerCase();
  const isPending = status === "pending";
  const isPaid = status === "paid";
  const isApproved = verificationStatus === "approved";

  return {
    canEdit: canEditAdhesiveClaim(token),
    canVerify: (isAdmin || isManager || effectiveRoles.includes("operations") || effectiveRoles.includes("sales")) && isPending,
    canApprove: (isAdmin || isManager) && isPending && !isApproved,
    canReject: (isAdmin || isManager) && isPending,
    canReopen: isAdmin && isPending && isApproved,
    canDelete: isAdmin && !isPaid,
    canMarkPaid: isPending && isApproved,
    editHint: isPaid ? "Paid claims are locked" : isApproved ? "Reopen approved claim before editing" : "Only pending claims can be edited",
    reopenHint: "Only admin can reopen approved pending claims",
    deleteHint: isPaid ? "Paid claims cannot be deleted" : "Only admin can delete claims",
    payHint: "Only approved pending claims can be marked paid",
    verifyHint: isPaid ? "Paid claims cannot be verified again" : "Only pending claims can be verified",
    approveHint: isPaid ? "Paid claims cannot be approved again" : isApproved ? "Claim is already approved" : "Only admin or manager can approve pending claims",
    rejectHint: isPaid ? "Paid claims cannot be rejected" : "Only admin or manager can reject pending claims",
  };
}

function normalizeComplaintPayload(complaint) {
  return {
    ...complaint,
    lead_id: complaint.lead_id ? Number(complaint.lead_id) : null,
    assigned_to: complaint.assigned_to ? Number(complaint.assigned_to) : null,
    due_date: complaint.due_date || null,
  };
}

function labelize(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `Rs ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeSummaryNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createSafeInventorySummary(summary) {
  if (!summary || typeof summary !== "object") {
    return null;
  }

  const normalized = { ...emptyInventorySummary };
  for (const key of Object.keys(normalized)) {
    if (key === "summary_ok") {
      continue;
    }
    normalized[key] = normalizeSummaryNumber(summary[key], normalized[key]);
  }
  normalized.summary_ok = summary.summary_ok !== false;
  return normalized;
}

function formatDate(value) {
  if (!value) {
    return "No date set";
  }

  return new Date(value).toLocaleDateString();
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateInput(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}

function formatBusinessDateLabel(value) {
  if (!value) {
    return "No date";
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map((part) => Number(part));
    const safeDate = new Date(year, month - 1, day);
    return safeDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTimeLocalInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function buildFollowupWhatsAppMessage(lead) {
  return `Namaste ${lead.name}, aapne showroom par ${describeBusinessFocus(lead)} ke options dekhe the. Abhi fresh designs aur better rates available hain. Aapko kab follow-up call ya visit convenient rahega?`;
}

function buildVisitReminderMessage(lead) {
  return `Namaste ${lead.name}, ${lead.location || "aapke project"} ke liye ${describeBusinessFocus(lead)} selection ko finalize karne ke liye aap showroom visit ya call schedule kar sakte hain. Hum aapke budget aur requirement ke hisaab se ready options rakh denge.`;
}

function buildQuotationWhatsAppMessage(lead, quotation) {
  return `Namaste ${lead.name}, aapki ${describeBusinessFocus(lead)} quotation ready hai. Final amount Rs ${quotation.final_amount}. Quotation valid only for today. Rates may change from next day. Agar aap confirm karna chahen to hum delivery aur payment planning bhi share kar denge.`;
}

function matchesBusinessUnitFilter(value, filter) {
  if (filter === "all") {
    return true;
  }

  if (value === filter) {
    return true;
  }

  return value === "both" && (filter === "tiles" || filter === "plumbing");
}

function describeBusinessFocus(lead) {
  if (lead?.business_unit === "both") {
    return "tiles aur plumbing";
  }

  if (lead?.business_unit === "plumbing" || lead?.requirement_category === "plumbing") {
    return "plumbing";
  }

  return "tiles";
}

function shareOnWhatsApp(phone, message) {
  const normalizedPhone = String(phone || "").replace(/\D/g, "");
  const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
