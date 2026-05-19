import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, getCsvExportUrl, getProjectInvoicePdfUrl, getQuotationPdfUrl } from "./api.js";

const AdhesiveTokensSection = lazy(() => import("./sections/AdhesiveTokensSection.jsx"));
const RegisteredMasonsSection = lazy(() => import("./sections/RegisteredMasonsSection.jsx"));
const ProjectsSection = lazy(() => import("./sections/ProjectsSection.jsx"));
const LeadWorkspaceSection = lazy(() => import("./sections/LeadWorkspaceSection.jsx"));

// Enterprise sidebar hierarchy. Sub-item IDs map to existing currentView IDs —
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
      { id: "operations", label: "Tasks" },
      { id: "reports", label: "Daily Report" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    items: [
      { id: "inventory", label: "Stock" },
      { id: "purchases", label: "Purchase Entry" },
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

const views = [
  { id: "overview", label: "Overview" },
  { id: "pipeline", label: "Pipeline" },
  { id: "followups", label: "Follow-ups" },
  { id: "operations", label: "Operations" },
  { id: "projects", label: "Projects" },
  { id: "plumbing", label: "Plumbing" },
  { id: "complaints", label: "Complaints" },
  { id: "quotations", label: "Quotations" },
  { id: "schemes", label: "Adhesive Tokens" },
  { id: "masons", label: "Registered Masons" },
  { id: "inventory", label: "Inventory" },
  { id: "dealers", label: "Dealers" },
  { id: "purchases", label: "Purchase Entry" },
  { id: "expenses", label: "Expenses" },
  { id: "reports", label: "Reports" },
  { id: "team", label: "Team" },
];

const viewMeta = {
  overview: {
    title: "Dashboard",
    description: "Today's summary at a glance — sales, collection, pending, follow-ups and stock alerts.",
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
    title: "Operation Tasks",
    description: "Delivery, installation, site visits and service handoffs.",
    audience: "Manager & Operations",
  },
  projects: {
    title: "Projects",
    description: "Won leads under execution — dispatches, payments, plumbing and net profit.",
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
    description: "Add a new mason, update profile and mark active/inactive — only active masons can claim tokens.",
    audience: "Manager entry",
  },
  inventory: {
    title: "Stock",
    description: "Product list, design code, size, finish and stock-on-hand.",
    audience: "Manager & Operator",
  },
  dealers: {
    title: "Dealers",
    description: "Dealer network — category, purchase value, outstanding and commission.",
    audience: "Manager control",
  },
  purchases: {
    title: "Purchase Entry",
    description: "Daily purchase log — supplier, invoice, amount, GST and remarks.",
    audience: "Operator daily entry",
  },
  expenses: {
    title: "Expenses",
    description: "Daily showroom expenses with category and payment mode.",
    audience: "Accounts & Operator",
  },
  reports: {
    title: "Reports",
    description: "Daily report sheet plus owner control — sales, collection, profit and payouts.",
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
const leadDrivenViews = new Set(["overview", "pipeline", "followups", "operations", "quotations"]);
const DEFAULT_API_TIMEOUT_MS = 15000;
const DEFAULT_LIST_LIMITS = {
  leads: 40,
  projects: 40,
  complaints: 40,
  products: 40,
  dealers: 40,
  claims: 40,
  masons: 40,
  purchases: 50,
};
const MAX_LIST_LIMIT = 300;

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

const emptyAdmin = {
  name: "",
  phone: "",
  password: "",
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
  design_code: "",
  business_unit: "tiles",
  category: "flooring",
  tile_size: "",
  finish: "",
  stock_sqft: "",
  price_per_sqft: "",
  status: "active",
};

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

const emptyPurchase = {
  supplier_name: "",
  supplier_phone: "",
  invoice_number: "",
  purchase_date: "",
  business_unit: "tiles",
  category: "tiles",
  item_name: "",
  quantity: "",
  unit: "pcs",
  amount: "",
  gst_amount: "",
  total_amount: "",
  payment_status: "pending",
  remarks: "",
};

const purchasePaymentStatuses = [
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
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

function validateAdminForm(form) {
  if (!normalizeText(form.name)) {
    return "Admin name is required.";
  }

  if (!isPhoneLike(form.phone)) {
    return "Admin phone must be 7 to 15 characters.";
  }

  if (String(form.password || "").length < 6) {
    return "Admin password must be at least 6 characters.";
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

function validateProductForm(form) {
  if (!normalizeText(form.name)) {
    return "Product name is required.";
  }

  if (!isNonNegativeNumber(form.stock_sqft)) {
    return "Stock sqft must be 0 or more.";
  }

  if (!isNonNegativeNumber(form.price_per_sqft)) {
    return "Price per sqft must be 0 or more.";
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
  const [adminForm, setAdminForm] = useState(emptyAdmin);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [leadSearch, setLeadSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [followupBoard, setFollowupBoard] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editingLead, setEditingLead] = useState(emptyLead);
  const [followups, setFollowups] = useState([]);
  const [payments, setPayments] = useState([]);
  const [operationsBoard, setOperationsBoard] = useState([]);
  const [operationsTasks, setOperationsTasks] = useState([]);
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
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [followupForm, setFollowupForm] = useState(emptyFollowup);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [operationsTaskForm, setOperationsTaskForm] = useState(emptyOperationsTask);
  const [quotationForm, setQuotationForm] = useState(emptyQuotation);
  const [schemeTokenForm, setSchemeTokenForm] = useState(emptySchemeToken);
  const [complaintForm, setComplaintForm] = useState(emptyComplaint);
  const [editingComplaintId, setEditingComplaintId] = useState(null);
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState(emptyUser);
  const [editingUserId, setEditingUserId] = useState(null);
  const [dealers, setDealers] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventorySummary, setInventorySummary] = useState(null);
  const [dealerForm, setDealerForm] = useState(emptyDealer);
  const [editingDealerId, setEditingDealerId] = useState(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState(null);
  const [masonForm, setMasonForm] = useState(emptyMason);
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
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [dispatchDrafts, setDispatchDrafts] = useState({});
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [purchaseSummary, setPurchaseSummary] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchase);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseFromFilter, setPurchaseFromFilter] = useState("");
  const [purchaseToFilter, setPurchaseToFilter] = useState("");
  const [purchasePaymentFilter, setPurchasePaymentFilter] = useState("all");
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [dailyReport, setDailyReport] = useState(null);
  const [dailyReportDate, setDailyReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportsView, setReportsView] = useState("overview");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSavingComplaint, setIsSavingComplaint] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [listLimits, setListLimits] = useState(DEFAULT_LIST_LIMITS);
  const dashboardLoadRef = useRef(0);

  const visibleViews = useMemo(() => {
    if (!user || isAdmin(user) || hasRole(user, "manager")) {
      return hasRole(user, "manager") && !isAdmin(user)
        ? views.filter((item) => item.id !== "team")
        : views;
    }

    const allowedViews = new Set();

    if (hasRole(user, "sales")) {
      ["overview", "pipeline", "followups", "quotations"].forEach((item) => allowedViews.add(item));
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
      allowedViews.add("inventory");
    }

    if (hasRole(user, "accounts")) {
      ["projects", "expenses", "purchases"].forEach((item) => allowedViews.add(item));
    }

    if (hasRole(user, "operator")) {
      ["overview", "purchases", "expenses", "masons"].forEach((item) => allowedViews.add(item));
    }

    if (hasRole(user, "reports")) {
      ["reports", "purchases", "expenses"].forEach((item) => allowedViews.add(item));
    }

    return views.filter((item) => allowedViews.has(item.id));
  }, [user]);

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
    if (!error) {
      return;
    }

    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone: "error", message: error }]);
    setError("");
  }, [error]);

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

  const summaryCards = useMemo(() => {
    const baseCards = [
      { label: "Today Walk-ins", value: focusStats.todayWalkins },
      { label: "Open Leads", value: focusStats.openLeads },
      { label: "Conversion %", value: `${focusStats.conversionRate}%` },
      { label: "Collected Value", value: `Rs ${focusStats.collectedValue}` },
      { label: "Plumbing Value", value: `Rs ${focusStats.plumbingValue}` },
      { label: "Fast-moving SKUs", value: focusStats.fastMovingSkuCount },
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
      { label: "Stock Alert", value: focusStats.fastMovingSkuCount },
    ].filter(Boolean);

    return [
      ...priorityCards,
      { label: "Overdue Follow-ups", value: focusStats.overdueFollowups },
      { label: "Monthly Revenue", value: `Rs ${stats?.monthly_revenue ?? 0}` },
      { label: "Sales Leads", value: focusStats.salesLeads },
      { label: "Operations Leads", value: focusStats.operationsLeads },
      { label: "Open Ops Tasks", value: focusStats.openOpsTasks },
      ...baseCards,
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
  const showQuickLeadEntry =
    isOverview &&
    hasAnyRole(user, ["admin", "manager", "sales"]) &&
    workspaceFilter !== "operations";

  function syncSelectedLeadState(nextLeads) {
    if (!Array.isArray(nextLeads) || nextLeads.length === 0) {
      setSelectedLead(null);
      return;
    }

    setSelectedLead((current) => {
      if (current) {
        return nextLeads.find((lead) => lead.id === current.id) || nextLeads[0];
      }

      return nextLeads[0];
    });
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
    if (!hasAnyRole(user, ["admin", "manager", "operations"])) {
      return null;
    }

    if (!["overview", "operations", "complaints", "team"].includes(view)) {
      return null;
    }

    const usersData = await api.getUsers(createRequestOptions(signal, 12000));
    setUsers(usersData || []);
    return usersData || [];
  }

  async function loadDashboard(options = {}) {
    const { signal, forceView } = options;
    const view = forceView || currentView;
    const requestId = dashboardLoadRef.current + 1;
    dashboardLoadRef.current = requestId;

    setLoading(true);
    setError("");

    try {
      const requestOptions = createRequestOptions(signal);

      if (view === "overview") {
        const [statsData, leadsData, summaryData] = await Promise.all([
          api.getStats(requestOptions),
          api.getLeads({ ...requestOptions, limit: listLimits.leads }),
          api.getDashboardSummary(requestOptions).catch(() => null),
          loadUsersForView(view, signal),
        ]);

        setStats(statsData);
        setLeads(leadsData);
        setDashboardSummary(summaryData);
        syncSelectedLeadState(leadsData);
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
        const [operationsData, leadsData] = await Promise.all([
          api.getOperationsBoard(requestOptions),
          api.getLeads({ ...requestOptions, limit: listLimits.leads }),
          loadUsersForView(view, signal),
        ]);

        setOperationsBoard(operationsData || []);
        setLeads(leadsData);
        syncSelectedLeadState(leadsData);
      } else if (view === "quotations") {
        const [leadsData, inventoryData] = await Promise.all([
          api.getLeads({ ...requestOptions, limit: listLimits.leads }),
          api.getInventory({ ...requestOptions, limit: listLimits.products }),
        ]);

        setLeads(leadsData);
        syncSelectedLeadState(leadsData);
        setProducts(inventoryData.products || []);
        setInventorySummary(inventoryData.summary || null);
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
        const inventoryData = await api.getInventory({ ...requestOptions, limit: listLimits.products });
        setProducts(inventoryData.products || []);
        setInventorySummary(inventoryData.summary || null);
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
        const purchasesData = await api
          .getPurchases({
            ...requestOptions,
            limit: listLimits.purchases,
            search: purchaseSearch,
            from: purchaseFromFilter,
            to: purchaseToFilter,
            payment_status: purchasePaymentFilter === "all" ? "" : purchasePaymentFilter,
          })
          .catch(() => ({ purchases: [], summary: null }));
        setPurchases(purchasesData.purchases || []);
        setPurchaseSummary(purchasesData.summary || null);
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
    } catch (requestError) {
      if (!isAbortLikeError(requestError)) {
        setError(requestError.message);
      }
    } finally {
      if (dashboardLoadRef.current === requestId) {
        setLoading(false);
      }
    }
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
    dailyReportDate,
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

    if (!selectedLead || !filteredLeads.some((lead) => lead.id === selectedLead.id)) {
      setSelectedLead(filteredLeads[0]);
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

  async function handleSeedAdmin(event) {
    event.preventDefault();
    const validationError = validateAdminForm(adminForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("seed-admin", async () => {
      await api.seedAdmin(adminForm);
      setAdminForm(emptyAdmin);
    }, "Bootstrap admin created.");
  }

  async function handleCreateLead(event) {
    event.preventDefault();
    const validationError = validateLeadForm(leadForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-lead", async () => {
      await api.createLead(normalizeLeadPayload(leadForm));
      setLeadForm(emptyLead);
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

    const validationError = validateFollowupForm(followupForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-followup", async () => {
      await api.createFollowup(selectedLead.id, followupForm);
      setFollowupForm(emptyFollowup);
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

  async function handleCreateQuotation(event) {
    event.preventDefault();
    if (!selectedLead) {
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
    const validationError = validateProductForm(productForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-product", async () => {
      if (editingProductId) {
        await api.updateProduct(editingProductId, normalizeProductPayload(productForm));
      } else {
        await api.createProduct(normalizeProductPayload(productForm));
      }
      setProductForm(emptyProduct);
      setEditingProductId(null);
      await loadDashboard();
    }, editingProductId ? "Inventory item updated." : "Inventory item saved.");
  }

  async function handleSaveProject(event) {
    event.preventDefault();
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
      setEditingExpenseId(null);
      await loadDashboard();
    }, editingExpenseId ? "Expense updated." : "Expense saved.");
  }

  function handleEditPurchase(record) {
    setEditingPurchaseId(record.id);
    setPurchaseForm({
      supplier_name: record.supplier_name || "",
      supplier_phone: record.supplier_phone || "",
      invoice_number: record.invoice_number || "",
      purchase_date: record.purchase_date ? String(record.purchase_date).slice(0, 10) : "",
      business_unit: record.business_unit || "tiles",
      category: record.category || "tiles",
      item_name: record.item_name || "",
      quantity: record.quantity != null ? String(record.quantity) : "",
      unit: record.unit || "pcs",
      amount: record.amount != null ? String(record.amount) : "",
      gst_amount: record.gst_amount != null ? String(record.gst_amount) : "",
      total_amount: record.total_amount != null ? String(record.total_amount) : "",
      payment_status: record.payment_status || "pending",
      remarks: record.remarks || "",
    });
  }

  function handleCancelEditPurchase() {
    setEditingPurchaseId(null);
    setPurchaseForm(emptyPurchase);
  }

  async function handleSavePurchase(event) {
    event.preventDefault();
    const validationError = validatePurchaseForm(purchaseForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    await runBusyAction("save-purchase", async () => {
      const amount = Number(purchaseForm.amount || 0);
      const gst = Number(purchaseForm.gst_amount || 0);
      const computedTotal = amount + gst;
      const payload = {
        ...purchaseForm,
        quantity: Number(purchaseForm.quantity || 0),
        amount,
        gst_amount: gst,
        total_amount: purchaseForm.total_amount === "" ? computedTotal : Number(purchaseForm.total_amount),
      };

      try {
        if (editingPurchaseId) {
          await api.updatePurchase(editingPurchaseId, payload);
        } else {
          await api.createPurchase(payload);
        }
      } catch (err) {
        if (err && err.status === 409) {
          setError(err.message || "Duplicate purchase entry");
          return;
        }
        throw err;
      }

      setPurchaseForm(emptyPurchase);
      setEditingPurchaseId(null);
      await loadDashboard();
    }, editingPurchaseId ? "Purchase updated." : "Purchase saved.");
  }

  async function handleDeletePurchase(id) {
    if (!id) return;
    await runBusyAction(`delete-purchase-${id}`, async () => {
      await api.deletePurchase(id);
      if (editingPurchaseId === id) {
        setEditingPurchaseId(null);
        setPurchaseForm(emptyPurchase);
      }
      await loadDashboard();
    }, "Purchase deleted.");
  }

  async function handleIssueSchemeToken(event) {
    event.preventDefault();
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

  function startEditingProduct(product) {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      design_code: product.design_code || "",
      business_unit: product.business_unit || "tiles",
      category: product.category || "flooring",
      tile_size: product.tile_size || "",
      finish: product.finish || "",
      stock_sqft: product.stock_sqft || "",
      price_per_sqft: product.price_per_sqft || "",
      status: product.status || "active",
    });
    setCurrentView("inventory");
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
    setQuotationForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          product_id: product.id,
          product_name: product.name,
          tile_size: product.tile_size || "",
          quantity_sqft: "",
          unit_price: product.price_per_sqft || "",
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

  function handleLogout() {
    localStorage.removeItem("tiles-crm-token");
    localStorage.removeItem("tiles-crm-user");
    setToken(null);
    setUser(null);
    setSelectedLead(null);
    setLeads([]);
    setStats(null);
    setFollowups([]);
    setPayments([]);
    setOperationsBoard([]);
    setOperationsTasks([]);
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
    setUsers([]);
    setDealers([]);
    setProducts([]);
    setInventorySummary(null);
    setDealerForm(emptyDealer);
    setEditingDealerId(null);
    setProductForm(emptyProduct);
    setEditingProductId(null);
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
    setComplaintForm(emptyComplaint);
    setEditingComplaintId(null);
    setUserForm(emptyUser);
    setEditingUserId(null);
    setMasonForm(emptyMason);
    setMasonWorkingAreaInput("");
    setEditingMasonId(null);
  }

  if (!token) {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <div>
            <p className="eyebrow">Tiles CRM System</p>
            <h1>Track every walk-in, convert more leads, and manage showroom sales with discipline.</h1>
            <p className="muted">
              Use the bootstrap form once to create the first admin, then sign in and start
              running the tiles showroom process from one place.
            </p>
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div className="auth-grid">
            <form className="panel" onSubmit={handleSeedAdmin}>
              <h2>Bootstrap admin</h2>
              <input
                placeholder="Full name"
                value={adminForm.name}
                onChange={(event) => setAdminForm({ ...adminForm, name: event.target.value })}
              />
              <input
                placeholder="Phone"
                value={adminForm.phone}
                onChange={(event) => setAdminForm({ ...adminForm, phone: event.target.value })}
              />
              <input
                type="password"
                placeholder="Password"
                value={adminForm.password}
                onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })}
              />
              <button type="submit" disabled={busyAction === "seed-admin"}>
                {busyAction === "seed-admin" ? "Creating Admin..." : "Create Admin"}
              </button>
            </form>

            <form className="panel" onSubmit={handleLogin}>
              <h2>Login</h2>
              <input
                placeholder="Phone"
                value={loginForm.phone}
                onChange={(event) => setLoginForm({ ...loginForm, phone: event.target.value })}
              />
              <input
                type="password"
                placeholder="Password"
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
              />
              <button type="submit" disabled={busyAction === "login"}>
                {busyAction === "login" ? "Signing In..." : "Sign In"}
              </button>
            </form>
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

      <header className="topbar panel">
        <div className="hero-copy">
          <p className="eyebrow">Tiles Showroom CRM</p>
          <h1>{user?.name}, your funnel, follow-ups, quotations, and dealer network are all live.</h1>
          <div className="hero-pills">
            <span className="hero-pill">{normalizeUserRoles(user).map(labelize).join(", ") || labelize(user?.role)}</span>
            <span className="hero-pill">{workspaceFilter === "all" ? "All Work" : labelize(workspaceFilter)}</span>
            <span className="hero-pill">{unitFilter === "all" ? "All Units" : labelize(unitFilter)}</span>
            <span className="hero-pill">Unread {unreadNotifications.length}</span>
          </div>
        </div>
        <div className="toolbar">
          <button className="secondary" onClick={() => setShowNotifications((current) => !current)}>
            Notifications {unreadNotifications.length ? `(${unreadNotifications.length})` : ""}
          </button>
          <button className="secondary" onClick={() => setCurrentView("overview")}>
            Dashboard
          </button>
          <button className="secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

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

      <div className="app-layout">
        <aside className="sidebar panel">
          <div className="sidebar-brand">
            <p className="eyebrow">AIBA Tiles</p>
            <strong>Showroom CRM</strong>
          </div>
          <nav className="sidebar-nav" aria-label="Primary navigation">
            {navGroups.map((group) => {
              const allowed = group.items.filter(
                (item) =>
                  visibleViews.some((view) => view.id === item.id) &&
                  (item.id !== "team" || isAdmin(user))
              );
              if (!allowed.length) return null;
              return (
                <div className="sidebar-group" key={group.id}>
                  <p className="sidebar-group-label">{group.label}</p>
                  <div className="sidebar-items">
                    {allowed.map((item) => (
                      <button
                        key={`${group.id}-${item.id}`}
                        type="button"
                        className={
                          currentView === item.id
                            ? "sidebar-item sidebar-item-active"
                            : "sidebar-item"
                        }
                        onClick={() => setCurrentView(item.id)}
                      >
                        <span className="sidebar-dot" aria-hidden="true" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="app-main">
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
            <div className="quick-actions-wrap">
              <span className="control-label">Quick actions</span>
                <div className="quick-actions">
                  {[
                  { id: "pipeline", label: "+ New Lead", tone: "secondary" },
                    { id: "projects", label: "+ New Project", tone: "secondary" },
                    { id: "purchases", label: "+ Purchase Entry", tone: "secondary" },
                    { id: "masons", label: "+ Registered Mason", tone: "secondary" },
                    { id: "expenses", label: "+ Expense", tone: "secondary" },
                ]
                  .filter((action) => visibleViews.some((view) => view.id === action.id))
                  .map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className={
                          currentView === action.id
                            ? "quick-action-btn quick-action-btn-active"
                            : action.tone === "secondary"
                              ? "quick-action-btn secondary"
                              : "quick-action-btn"
                        }
                        onClick={() => setCurrentView(action.id)}
                      >
                        {action.label}
                      </button>
                    ))}
              </div>
            </div>
          </section>

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

      {isOverview ? (
        <section className="page-intro panel">
          <div>
            <p className="eyebrow">Active Module</p>
            <h2>{activeViewMeta.title}</h2>
            <p className="muted">{activeViewMeta.description}</p>
            {activeViewMeta.audience ? (
              <span className="audience-tag">{activeViewMeta.audience}</span>
            ) : null}
          </div>
          <div className="hero-pills">
            <span className="hero-pill hero-pill-strong">
              Workspace: {workspaceFilter === "all" ? "All Work" : labelize(workspaceFilter)}
            </span>
            <span className="hero-pill hero-pill-strong">
              Unit: {unitFilter === "all" ? "All Units" : labelize(unitFilter)}
            </span>
            <span className="hero-pill hero-pill-strong">
              View: {views.find((item) => item.id === currentView)?.label || "Overview"}
            </span>
          </div>
        </section>
      ) : (
        <section className="module-header">
          <div>
            <h2>{activeViewMeta.title}</h2>
            <p className="muted">{activeViewMeta.description}</p>
          </div>
          {activeViewMeta.audience ? (
            <span className="audience-tag">{activeViewMeta.audience}</span>
          ) : null}
        </section>
      )}

      {loading ? <p className="loading-banner">Syncing latest CRM data...</p> : null}

      {isOverview ? (
        <>
          <section className="stats-grid">
            {summaryCards.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} tone={card.tone || "default"} />
            ))}
          </section>

          <main className="feature-grid">
            {showQuickLeadEntry ? (
            <section className="panel span-two">
              <div className="section-head">
                <h2>Quick lead entry</h2>
                <span>{loading ? "Syncing..." : "Under 10 seconds for sales team use"}</span>
              </div>
              <form className="form-grid" onSubmit={handleCreateLead}>
                <input
                  placeholder="Customer name"
                  value={leadForm.name}
                  onChange={(event) => setLeadForm({ ...leadForm, name: event.target.value })}
                />
                <input
                  placeholder="Phone"
                  value={leadForm.phone}
                  onChange={(event) => setLeadForm({ ...leadForm, phone: event.target.value })}
                />
                <input
                  placeholder="Location"
                  value={leadForm.location}
                  onChange={(event) => setLeadForm({ ...leadForm, location: event.target.value })}
                />
                <select
                  value={leadForm.department}
                  onChange={(event) => setLeadForm({ ...leadForm, department: event.target.value })}
                >
                  <option value="sales">Sales</option>
                  <option value="operations">Operations</option>
                </select>
                <select
                  value={leadForm.business_unit}
                  onChange={(event) => setLeadForm({ ...leadForm, business_unit: event.target.value })}
                >
                  <option value="tiles">Tiles</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="both">Tiles + Plumbing</option>
                </select>
                <select
                  value={leadForm.customer_type}
                  onChange={(event) => setLeadForm({ ...leadForm, customer_type: event.target.value })}
                >
                  {customerTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select
                  value={leadForm.requirement_category}
                  onChange={(event) =>
                    setLeadForm({ ...leadForm, requirement_category: event.target.value })
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
                  value={leadForm.budget}
                  onChange={(event) => setLeadForm({ ...leadForm, budget: event.target.value })}
                />
                <select
                  value={leadForm.timeline}
                  onChange={(event) => setLeadForm({ ...leadForm, timeline: event.target.value })}
                >
                  {timelines.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select
                  value={leadForm.lead_source}
                  onChange={(event) => setLeadForm({ ...leadForm, lead_source: event.target.value })}
                >
                  {leadSources.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select
                  value={leadForm.status}
                  onChange={(event) => setLeadForm({ ...leadForm, status: event.target.value })}
                >
                  {leadStatuses.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select
                  value={leadForm.assigned_to}
                  onChange={(event) => setLeadForm({ ...leadForm, assigned_to: event.target.value })}
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
                  value={leadForm.requirement}
                  onChange={(event) => setLeadForm({ ...leadForm, requirement: event.target.value })}
                />
                <button className="full-span accent" type="submit" disabled={busyAction === "save-lead"}>
                  {busyAction === "save-lead" ? "Saving Lead..." : "Save Lead"}
                </button>
              </form>
            </section>
            ) : null}

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
              <div className="stack">
                {workspaceFilter === "operations" ? (
                  <>
                    <HighlightRow label="Open tasks" value={focusStats.openOpsTasks} />
                    <HighlightRow label="Delayed" value={focusStats.delayedOpsTasks} tone="danger" />
                    <HighlightRow label="Completed" value={focusStats.completedOpsTasks} tone="accent" />
                  </>
                ) : (
                  <>
                    <HighlightRow label="Pending" value={focusStats.pendingFollowups} />
                    <HighlightRow label="Overdue" value={focusStats.overdueFollowups} tone="danger" />
                    <HighlightRow label="Due today" value={focusStats.dueToday} tone="accent" />
                  </>
                )}
              </div>
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
                            setSelectedLead(target);
                            setCurrentView("operations");
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
                            setSelectedLead(target);
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
              <div className="mini-list">
                {filteredProducts.slice(0, 3).map((product) => (
                  <div key={product.id} className="timeline-item">
                    <strong>{product.name}</strong>
                    <p className="muted">
                      {product.tile_size || "Standard"} | Rs {product.price_per_sqft}/sqft
                    </p>
                  </div>
                ))}
                {filteredProducts.length === 0 ? (
                  <EmptyState title="No inventory highlights" message="Saved products will appear here for quick quoting and stock checks." compact />
                ) : null}
              </div>
            </section>
          </main>
        </>
      ) : null}

      {["overview", "pipeline", "followups", "operations"].includes(currentView) ? (
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
            setCurrentView={setCurrentView}
            isAdmin={isAdmin}
            user={user}
            setPendingDelete={setPendingDelete}
            EmptyState={EmptyState}
            normalizeUserRoles={normalizeUserRoles}
            editingLead={editingLead}
            setEditingLead={setEditingLead}
            users={users}
            followupForm={followupForm}
            setFollowupForm={setFollowupForm}
            paymentForm={paymentForm}
            setPaymentForm={setPaymentForm}
            quotationForm={quotationForm}
            setQuotationForm={setQuotationForm}
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
            plumbingWorkTypes={plumbingWorkTypes}
            plumbingJobStatuses={plumbingJobStatuses}
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
                      setSelectedLead(target);
                      setCurrentView("overview");
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

      {currentView === "expenses" ? (
        <section className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>Expense management</h2>
              <span>Monthly net profit after expenses Rs {expenseSummary?.monthly_net_profit_after_expenses ?? 0}</span>
            </div>
            <div className="tabs-row">
              <BadgeCard title="Gross Profit" count={`Rs ${expenseSummary?.gross_project_profit ?? 0}`} tone="accent" />
              <BadgeCard title="Monthly Expenses" count={`Rs ${expenseSummary?.monthly_expenses ?? 0}`} />
              <BadgeCard title="Net After Expenses" count={`Rs ${expenseSummary?.monthly_net_profit_after_expenses ?? 0}`} tone="accent" />
            </div>
            <form className="form-grid" onSubmit={handleSaveExpense}>
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
              <input
                type="date"
                value={expenseForm.expense_date}
                onChange={(event) => setExpenseForm({ ...expenseForm, expense_date: event.target.value })}
              />
              <input
                type="number"
                placeholder="Amount"
                value={expenseForm.amount}
                onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
              />
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
        </section>
      ) : null}

      {currentView === "purchases" ? (
        <section className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>Purchase entry</h2>
              <span>
                {purchaseSummary
                  ? `${purchaseSummary.total_count || 0} entries | Total Rs ${Number(purchaseSummary.total_amount || 0).toLocaleString("en-IN")}`
                  : "Daily showroom purchase log"}
              </span>
            </div>
            <div className="tabs-row">
              <BadgeCard
                title="Total Value"
                count={`Rs ${Number(purchaseSummary?.total_amount || 0).toLocaleString("en-IN")}`}
                tone="accent"
              />
              <BadgeCard
                title="Pending Payment"
                count={`Rs ${Number(purchaseSummary?.pending_amount || 0).toLocaleString("en-IN")}`}
              />
              <BadgeCard
                title="Paid"
                count={`Rs ${Number(purchaseSummary?.paid_amount || 0).toLocaleString("en-IN")}`}
                tone="accent"
              />
              <BadgeCard
                title="GST"
                count={`Rs ${Number(purchaseSummary?.gst_amount || 0).toLocaleString("en-IN")}`}
              />
            </div>

            <form className="form-grid" onSubmit={handleSavePurchase}>
              <input
                placeholder="Supplier name"
                value={purchaseForm.supplier_name}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, supplier_name: event.target.value })
                }
              />
              <input
                placeholder="Supplier phone"
                value={purchaseForm.supplier_phone}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, supplier_phone: event.target.value })
                }
              />
              <input
                placeholder="Invoice number"
                value={purchaseForm.invoice_number}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, invoice_number: event.target.value })
                }
              />
              <input
                type="date"
                value={purchaseForm.purchase_date}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, purchase_date: event.target.value })
                }
              />
              <select
                value={purchaseForm.business_unit}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, business_unit: event.target.value })
                }
              >
                {purchaseBusinessUnitOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                placeholder="Category (e.g. tiles, adhesive, plumbing)"
                value={purchaseForm.category}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, category: event.target.value })
                }
              />
              <input
                placeholder="Item / product name"
                value={purchaseForm.item_name}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, item_name: event.target.value })
                }
              />
              <input
                type="number"
                step="0.01"
                placeholder="Quantity"
                value={purchaseForm.quantity}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, quantity: event.target.value })
                }
              />
              <input
                placeholder="Unit (pcs / box / sqft)"
                value={purchaseForm.unit}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, unit: event.target.value })
                }
              />
              <input
                type="number"
                step="0.01"
                placeholder="Net amount"
                value={purchaseForm.amount}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, amount: event.target.value })
                }
              />
              <input
                type="number"
                step="0.01"
                placeholder="GST amount"
                value={purchaseForm.gst_amount}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, gst_amount: event.target.value })
                }
              />
              <input
                type="number"
                step="0.01"
                placeholder="Total amount (auto = net + GST if blank)"
                value={purchaseForm.total_amount}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, total_amount: event.target.value })
                }
              />
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
              <div className="lead-actions full-span">
                <button type="submit" disabled={busyAction === "save-purchase"}>
                  {busyAction === "save-purchase"
                    ? editingPurchaseId
                      ? "Updating Purchase..."
                      : "Saving Purchase..."
                    : editingPurchaseId
                      ? "Update Purchase"
                      : "Add Purchase"}
                </button>
                {editingPurchaseId ? (
                  <button type="button" className="secondary" onClick={handleCancelEditPurchase}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>Purchase ledger</h2>
              <span>{purchases.length} entries shown</span>
            </div>
            <div className="filter-row">
              <input
                placeholder="Search supplier, invoice, item"
                value={purchaseSearch}
                onChange={(event) => setPurchaseSearch(event.target.value)}
              />
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
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Amount</th>
                    <th>GST</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.purchase_date)}</td>
                      <td>
                        <strong>{record.supplier_name}</strong>
                        <div className="muted">{record.supplier_phone || ""}</div>
                      </td>
                      <td>{record.invoice_number || "-"}</td>
                      <td>
                        {record.item_name || "-"}
                        <div className="muted">{record.category || ""}</div>
                      </td>
                      <td>
                        {record.quantity} {record.unit}
                      </td>
                      <td>Rs {Number(record.amount || 0).toLocaleString("en-IN")}</td>
                      <td>Rs {Number(record.gst_amount || 0).toLocaleString("en-IN")}</td>
                      <td>
                        <strong>Rs {Number(record.total_amount || 0).toLocaleString("en-IN")}</strong>
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
                          onClick={() => handleEditPurchase(record)}
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
                                id: record.id,
                                entityLabel: "Purchase",
                                message: `Remove purchase entry for supplier ${record.supplier_name}?`,
                                subtext: `${formatDate(record.purchase_date)} | Rs ${record.total_amount}`,
                              })
                            }
                          >
                            Delete
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {purchases.length === 0 ? (
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
          />
        </Suspense>
      ) : null}

        {currentView === "inventory" ? (
        <section className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>Inventory link</h2>
              <span>
                {inventorySummary?.total_products ?? 0} products | {inventorySummary?.total_stock_sqft ?? 0} sqft
              </span>
            </div>
            <form className="form-grid" onSubmit={handleSaveProduct}>
              <input
                placeholder="Product name"
                value={productForm.name}
                onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
              />
              <input
                placeholder="Design code"
                value={productForm.design_code}
                onChange={(event) =>
                  setProductForm({ ...productForm, design_code: event.target.value })
                }
              />
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
              <input
                placeholder="Category"
                value={productForm.category}
                onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}
              />
              <input
                placeholder="Tile size"
                value={productForm.tile_size}
                onChange={(event) => setProductForm({ ...productForm, tile_size: event.target.value })}
              />
              <input
                placeholder="Finish"
                value={productForm.finish}
                onChange={(event) => setProductForm({ ...productForm, finish: event.target.value })}
              />
              <input
                type="number"
                placeholder="Stock sqft"
                value={productForm.stock_sqft}
                onChange={(event) => setProductForm({ ...productForm, stock_sqft: event.target.value })}
              />
              <input
                type="number"
                placeholder="Price per sqft"
                value={productForm.price_per_sqft}
                onChange={(event) =>
                  setProductForm({ ...productForm, price_per_sqft: event.target.value })
                }
              />
              <select
                value={productForm.status}
                onChange={(event) => setProductForm({ ...productForm, status: event.target.value })}
              >
                <option value="active">Active</option>
                <option value="fast_moving">Fast Moving</option>
                <option value="dead_stock">Dead Stock</option>
              </select>
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
              <h2>Stock visibility</h2>
              <span>{inventorySummary?.fast_moving_count ?? 0} fast moving</span>
            </div>
            <ListLoadControls
              label="Products"
              count={products.length}
              limit={listLimits.products}
              onLoadMore={() => increaseListLimit("products")}
              disabled={loading}
            />
            <div className="list">
              {filteredProducts.map((product) => (
                <article key={product.id} className="lead-card">
                  <div className="section-head">
                    <div>
                      <h3>{product.name}</h3>
                      <p className="muted">{product.design_code || product.category}</p>
                    </div>
                    <span className={`status-chip status-${product.status}`}>{labelize(product.status)}</span>
                  </div>
                  <p>
                    {product.tile_size || "Standard"} | {product.finish || "Default finish"}
                  </p>
                  <p>
                    Stock {product.stock_sqft} sqft | Rs {product.price_per_sqft}/sqft
                  </p>
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
                            subtext: product.design_code || product.category,
                          })
                        }
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {filteredProducts.length === 0 ? (
                <EmptyState title="No products available" message="Save stock items here to power quotation and inventory visibility." />
              ) : null}
            </div>
          </section>
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
                Owner snapshot {dailyReport ? `· ${formatDate(dailyReportDate)}` : ""}
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
                    value={`${dailyReport.tokens?.count || 0} · Rs ${Number(
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
                  Live snapshot · cached 30s · {dashboardSummary.as_of_date}
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
                  value={`${dashboardSummary.token_pending?.count ?? 0} · Rs ${Number(
                    dashboardSummary.token_pending?.amount || 0
                  ).toLocaleString("en-IN")}`}
                  tone="danger"
                />
                <StatCard
                  label="Token Paid (Month)"
                  value={`${dashboardSummary.token_paid_month?.count ?? 0} · Rs ${Number(
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
    <div className="lead-actions">
      <span className="muted">{count} loaded</span>
      <span className="muted">Showing first {limit}</span>
      <button type="button" className="secondary" onClick={onLoadMore} disabled={disabled || limit >= MAX_LIST_LIMIT}>
        {limit >= MAX_LIST_LIMIT ? "Max Loaded" : `Load 100 More`}
      </button>
    </div>
  );
}
const ListLoadControls = memo(ListLoadControlsImpl);

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
                    Rs {product.price_per_sqft}/sqft | Stock {product.stock_sqft} sqft
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
          <span className="accordion-caret">{isOpen ? "−" : "+"}</span>
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

function normalizeProductPayload(product) {
  return {
    ...product,
    stock_sqft: Number(product.stock_sqft || 0),
    price_per_sqft: Number(product.price_per_sqft || 0),
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

function formatDate(value) {
  if (!value) {
    return "No date set";
  }

  return new Date(value).toLocaleDateString();
}

function formatDateInput(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
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
  return `Namaste ${lead.name}, aapki ${describeBusinessFocus(lead)} quotation ready hai. Final amount Rs ${quotation.final_amount}. Agar aap confirm karna chahen to hum delivery aur payment planning bhi share kar denge.`;
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
