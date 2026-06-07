const leadStatuses = new Set([
  "new",
  "interested",
  "quotation_given",
  "negotiation",
  "converted",
  "lost",
]);
const customerTypes = new Set(["retail_customer", "contractor", "builder", "architect"]);
const requirementCategories = new Set(["flooring", "bathroom", "kitchen", "full_house", "plumbing"]);
const leadSources = new Set(["walk_in", "reference", "online", "dealer"]);
const leadTimelines = new Set(["urgent", "one_month", "three_months"]);
const followupTypes = new Set(["call", "whatsapp", "visit", "reminder"]);
const followupStatuses = new Set(["pending", "completed", "overdue"]);
const operationsTaskTypes = new Set(["delivery", "site_visit", "installation", "measurement"]);
const operationsTaskStatuses = new Set(["pending", "in_progress", "completed", "delayed"]);
const dailyTaskPriorities = new Set(["low", "medium", "high", "urgent"]);
const dailyTaskStatuses = new Set(["pending", "in_progress", "completed", "verified", "hold"]);
const dailyTaskSources = new Set(["manual", "chatgpt", "claude", "automation"]);
const plumbingWorkTypes = new Set([
  "bathroom",
  "kitchen",
  "pipeline",
  "fitting",
  "repair",
  "full_plumbing",
]);
const masonStatuses = new Set(["active", "inactive"]);
const plumbingJobStatuses = new Set(["pending", "ongoing", "completed", "on_hold"]);
const quotationStatuses = new Set(["draft", "shared", "approved"]);
const paymentTypes = new Set(["advance", "partial", "full", "balance"]);
const dealerCategories = new Set(["A", "B", "C"]);
const leadDepartments = new Set(["sales", "operations"]);
const businessUnits = new Set(["tiles", "plumbing", "both"]);
const productStatuses = new Set(["active", "fast_moving", "dead_stock"]);
const userRoles = new Set([
  "admin",
  "manager",
  "sales",
  "operations",
  "accounts",
  "operator",
  "inventory",
  "token",
  "reports",
]);
const expensePaymentModes = new Set(["cash", "bank", "upi", "cheque", "card", "other"]);
const purchaseBusinessUnits = new Set(["tiles", "plumbing", "both"]);
const purchasePaymentStatuses = new Set(["pending", "partial", "paid"]);
const billingInvoiceTypes = new Set(["gst_invoice", "estimate"]);
const billingItemTypes = new Set(["tiles", "plumbing", "adhesive", "granite_marble", "custom_item"]);
const billingApprovalStatuses = new Set(["draft", "pending_approval", "approved", "rejected", "cancelled"]);
const billingPaymentStatuses = new Set(["unpaid", "partial", "paid"]);
const billingPaymentModes = new Set(["cash", "upi", "bank_transfer", "cheque", "mixed"]);
const purchaseCostingStatuses = new Set(["draft", "cost_calculated", "approved", "cancelled"]);
const purchaseAllocationMethods = new Set([
  "weight_wise",
  "purchase_value_wise",
  "quantity_wise",
  "supplier_amount_wise",
  "manual",
  "by_value",
  "by_quantity",
]);
const overheadAllocationMethods = new Set(["per_box", "per_sqft", "sales_value_wise", "quantity_wise"]);
const adhesiveTokenStatuses = new Set(["pending", "paid", "rejected"]);
const adhesiveVerificationStatuses = new Set(["unverified", "matched", "mismatch", "approved", "rejected"]);
const projectStatuses = new Set(["draft", "active", "on_hold", "completed"]);
const dispatchStatuses = new Set(["pending", "dispatched", "delivered"]);
const expenseCategories = new Set([
  "rent",
  "salary",
  "transport",
  "marketing",
  "electricity",
  "miscellaneous",
]);
const complaintCategories = new Set([
  "leakage",
  "blockage",
  "pressure_issue",
  "fitting_issue",
  "installation_defect",
  "tile_breakage",
  "shade_mismatch",
  "delivery_damage",
  "service_delay",
  "other",
]);
const complaintStatuses = new Set([
  "open",
  "assigned",
  "in_progress",
  "waiting_customer",
  "resolved",
  "closed",
]);
const complaintPriorities = new Set(["low", "medium", "high", "urgent"]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPhoneValid(phone) {
  return /^[0-9+\-\s]{7,15}$/.test(phone);
}

function toInteger(value, fallback = 0) {
  if (value === "" || value === null || typeof value === "undefined") {
    return fallback;
  }

  return Number(value);
}

export function validateLeadPayload(payload) {
  const name = normalizeString(payload.name);
  const phone = normalizeString(payload.phone);
  const location = normalizeOptionalString(payload.location);
  const department = normalizeString(payload.department || "sales");
  const business_unit = normalizeString(payload.business_unit || "tiles");
  const customer_type = normalizeString(payload.customer_type || "retail_customer");
  const requirement_category = normalizeString(payload.requirement_category || "flooring");
  const requirement = normalizeOptionalString(payload.requirement);
  const budget = toInteger(payload.budget, 0);
  const timeline = normalizeString(payload.timeline || "urgent");
  const lead_source = normalizeString(payload.lead_source || "walk_in");
  const status = normalizeString(payload.status || "new");
  const lost_reason = normalizeOptionalString(payload.lost_reason);
  const assignedToValue = payload.assigned_to;
  const assigned_to =
    assignedToValue === "" || assignedToValue === null || typeof assignedToValue === "undefined"
      ? null
      : Number(assignedToValue);

  if (!name) {
    return { ok: false, message: "Lead name is required" };
  }

  if (!isPhoneValid(phone)) {
    return { ok: false, message: "Lead phone must be 7 to 15 characters" };
  }

  if (!customerTypes.has(customer_type)) {
    return { ok: false, message: "Customer type is invalid" };
  }

  if (!leadDepartments.has(department)) {
    return { ok: false, message: "Department is invalid" };
  }

  if (!businessUnits.has(business_unit)) {
    return { ok: false, message: "Business unit is invalid" };
  }

  if (!requirementCategories.has(requirement_category)) {
    return { ok: false, message: "Requirement category is invalid" };
  }

  if (!Number.isFinite(budget) || budget < 0) {
    return { ok: false, message: "Budget must be a non-negative number" };
  }

  if (!leadTimelines.has(timeline)) {
    return { ok: false, message: "Timeline is invalid" };
  }

  if (!leadSources.has(lead_source)) {
    return { ok: false, message: "Lead source is invalid" };
  }

  if (!leadStatuses.has(status)) {
    return { ok: false, message: "Lead status is invalid" };
  }

  if (assigned_to !== null && (!Number.isInteger(assigned_to) || assigned_to <= 0)) {
    return { ok: false, message: "Assigned user is invalid" };
  }

  return {
    ok: true,
    value: {
      name,
      phone,
      location,
      department,
      business_unit,
      customer_type,
      requirement_category,
      requirement,
      budget,
      timeline,
      lead_source,
      status,
      lost_reason,
      assigned_to,
    },
  };
}

export function validateFollowupPayload(payload) {
  const note = normalizeString(payload.note);
  const followup_date = normalizeOptionalString(payload.followup_date);
  const followup_type = normalizeString(payload.followup_type || "call");
  const status = normalizeString(payload.status || "pending");

  if (!note) {
    return { ok: false, message: "Follow-up note is required" };
  }

  if (followup_date && Number.isNaN(new Date(followup_date).getTime())) {
    return { ok: false, message: "Follow-up date is invalid" };
  }

  if (!followupTypes.has(followup_type)) {
    return { ok: false, message: "Follow-up type is invalid" };
  }

  if (!followupStatuses.has(status)) {
    return { ok: false, message: "Follow-up status is invalid" };
  }

  return {
    ok: true,
    value: {
      note,
      followup_date: followup_date || null,
      followup_type,
      status,
    },
  };
}

export function validatePaymentPayload(payload) {
  const amount = toInteger(payload.amount);
  const payment_type = normalizeString(payload.payment_type || "advance");
  const due_date = normalizeOptionalString(payload.due_date);
  const note = normalizeOptionalString(payload.note);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Payment amount must be greater than zero" };
  }

  if (!paymentTypes.has(payment_type)) {
    return { ok: false, message: "Payment type is invalid" };
  }

  if (due_date && Number.isNaN(new Date(due_date).getTime())) {
    return { ok: false, message: "Due date is invalid" };
  }

  return { ok: true, value: { amount, payment_type, due_date: due_date || null, note } };
}

export function validateOperationsTaskPayload(payload) {
  const title = normalizeString(payload.title);
  const note = normalizeOptionalString(payload.note);
  const task_type = normalizeString(payload.task_type || "delivery");
  const status = normalizeString(payload.status || "pending");
  const scheduled_for = normalizeOptionalString(payload.scheduled_for);
  const assignedToValue = payload.assigned_to;
  const assigned_to =
    assignedToValue === "" || assignedToValue === null || typeof assignedToValue === "undefined"
      ? null
      : Number(assignedToValue);

  if (!title) {
    return { ok: false, message: "Operations task title is required" };
  }

  if (!operationsTaskTypes.has(task_type)) {
    return { ok: false, message: "Operations task type is invalid" };
  }

  if (!operationsTaskStatuses.has(status)) {
    return { ok: false, message: "Operations task status is invalid" };
  }

  if (scheduled_for && Number.isNaN(new Date(scheduled_for).getTime())) {
    return { ok: false, message: "Operations schedule is invalid" };
  }

  if (assigned_to !== null && (!Number.isInteger(assigned_to) || assigned_to <= 0)) {
    return { ok: false, message: "Assigned operations user is invalid" };
  }

  return {
    ok: true,
    value: {
      title,
      note,
      task_type,
      status,
      scheduled_for: scheduled_for || null,
      assigned_to,
    },
  };
}

export function validateDailyTaskPayload(payload) {
  const title = normalizeString(payload.title);
  const description = normalizeOptionalString(payload.description);
  const priority = normalizeString(payload.priority || "medium");
  const due_date = normalizeOptionalString(payload.due_date);
  const due_time = normalizeOptionalString(payload.due_time);
  const status = normalizeString(payload.status || "pending");
  const remarks = normalizeOptionalString(payload.remarks);
  const assignedToValue = payload.assigned_to;
  const assigned_to =
    assignedToValue === "" || assignedToValue === null || typeof assignedToValue === "undefined"
      ? null
      : Number(assignedToValue);

  if (!title) {
    return { ok: false, message: "Task title is required" };
  }

  if (!assigned_to || !Number.isInteger(assigned_to) || assigned_to <= 0) {
    return { ok: false, message: "Assigned user is required" };
  }

  if (!dailyTaskPriorities.has(priority)) {
    return { ok: false, message: "Task priority is invalid" };
  }

  if (!dailyTaskStatuses.has(status)) {
    return { ok: false, message: "Task status is invalid" };
  }

  if (!due_date || Number.isNaN(new Date(due_date).getTime())) {
    return { ok: false, message: "Due date is required" };
  }

  if (due_time && !/^\d{2}:\d{2}(:\d{2})?$/.test(due_time)) {
    return { ok: false, message: "Due time is invalid" };
  }

  return {
    ok: true,
    value: {
      title,
      description,
      assigned_to,
      priority,
      due_date: due_date.slice(0, 10),
      due_time: due_time ? due_time.slice(0, 5) : null,
      status,
      remarks,
    },
  };
}

export function validateExternalDailyTaskPayload(payload) {
  const baseValidation = validateDailyTaskPayload({
    ...payload,
    priority: normalizeString(payload.priority || "medium").toLowerCase(),
    status: normalizeString(payload.status || "pending").toLowerCase(),
  });

  if (!baseValidation.ok) {
    return baseValidation;
  }

  const source = normalizeString(payload.source || "automation").toLowerCase();
  const force = Boolean(payload.force);

  if (!dailyTaskSources.has(source) || source === "manual") {
    return {
      ok: false,
      message: "Task source is invalid",
    };
  }

  if (baseValidation.value.status === "verified") {
    return {
      ok: false,
      message: "External API cannot create verified tasks",
    };
  }

  return {
    ok: true,
    value: {
      ...baseValidation.value,
      source,
      force,
    },
  };
}

export function validateQuotationPayload(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const discount = toInteger(payload.discount, 0);
  const transport_cost = toInteger(payload.transport_cost, 0);
  const status = normalizeString(payload.status || "draft");

  if (!items.length) {
    return { ok: false, message: "At least one quotation item is required" };
  }

  if (!quotationStatuses.has(status)) {
    return { ok: false, message: "Quotation status is invalid" };
  }

  if (!Number.isFinite(discount) || discount < 0) {
    return { ok: false, message: "Discount must be a non-negative number" };
  }

  if (!Number.isFinite(transport_cost) || transport_cost < 0) {
    return { ok: false, message: "Transport cost must be a non-negative number" };
  }

  const normalizedItems = [];

  for (const item of items) {
    const product_name = normalizeString(item.product_name);
    const productIdValue = item.product_id;
    const product_id =
      productIdValue === "" || productIdValue === null || typeof productIdValue === "undefined"
        ? null
        : Number(productIdValue);
    const tile_size = normalizeOptionalString(item.tile_size);
    const quantity_sqft = toInteger(item.quantity_sqft, 0);
    const unit_price = toInteger(item.unit_price, 0);

    if (!product_name) {
      return { ok: false, message: "Quotation product name is required" };
    }

    if (!Number.isFinite(quantity_sqft) || quantity_sqft <= 0) {
      return { ok: false, message: "Quotation quantity must be greater than zero" };
    }

    if (!Number.isFinite(unit_price) || unit_price < 0) {
      return { ok: false, message: "Quotation unit price must be valid" };
    }

    if (product_id !== null && (!Number.isInteger(product_id) || product_id <= 0)) {
      return { ok: false, message: "Inventory-linked product is invalid" };
    }

    normalizedItems.push({
      product_id,
      product_name,
      tile_size,
      quantity_sqft,
      unit_price,
      amount: quantity_sqft * unit_price,
    });
  }

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
  const final_amount = Math.max(subtotal - discount + transport_cost, 0);

  return {
    ok: true,
    value: {
      items: normalizedItems,
      discount,
      transport_cost,
      subtotal,
      final_amount,
      status,
    },
  };
}

export function validatePlumberPayload(payload) {
  const name = normalizeString(payload.name);
  const phone = normalizeString(payload.phone);
  const area = normalizeOptionalString(payload.area);

  if (!name) {
    return { ok: false, message: "Plumber name is required" };
  }

  if (!isPhoneValid(phone)) {
    return { ok: false, message: "Plumber phone must be 7 to 15 characters" };
  }

  return {
    ok: true,
    value: {
      name,
      phone,
      area,
    },
  };
}

export function validatePlumbingJobPayload(payload) {
  const leadValue = payload.lead_id;
  const plumberValue = payload.plumber_id;
  const lead_id =
    leadValue === "" || leadValue === null || typeof leadValue === "undefined" ? null : Number(leadValue);
  const plumber_id =
    plumberValue === "" || plumberValue === null || typeof plumberValue === "undefined"
      ? null
      : Number(plumberValue);
  const work_type = normalizeString(payload.work_type || "bathroom");
  const status = normalizeString(payload.status || "pending");
  const service_charge = toInteger(payload.service_charge, 0);
  const scheduled_for = normalizeOptionalString(payload.scheduled_for);
  const note = normalizeOptionalString(payload.note);

  if (!Number.isInteger(lead_id) || lead_id <= 0) {
    return { ok: false, message: "Linked lead is required for plumbing job" };
  }

  if (plumber_id !== null && (!Number.isInteger(plumber_id) || plumber_id <= 0)) {
    return { ok: false, message: "Assigned plumber is invalid" };
  }

  if (!plumbingWorkTypes.has(work_type)) {
    return { ok: false, message: "Plumbing work type is invalid" };
  }

  if (!plumbingJobStatuses.has(status)) {
    return { ok: false, message: "Plumbing job status is invalid" };
  }

  if (!Number.isFinite(service_charge) || service_charge < 0) {
    return { ok: false, message: "Service charge must be a non-negative number" };
  }

  if (scheduled_for && Number.isNaN(new Date(scheduled_for).getTime())) {
    return { ok: false, message: "Plumbing schedule is invalid" };
  }

  return {
    ok: true,
    value: {
      lead_id,
      plumber_id,
      work_type,
      status,
      service_charge,
      scheduled_for: scheduled_for || null,
      note,
    },
  };
}

export function validateMasonPayload(payload) {
  const name = normalizeString(payload.name);
  const mobile = normalizeString(payload.mobile);
  const alt_mobile = normalizeOptionalString(payload.alt_mobile);
  const current_address = normalizeString(payload.current_address);
  const current_address_city = normalizeString(payload.current_address_city);
  const permanent_address = normalizeOptionalString(payload.permanent_address);
  const permanent_address_city = normalizeOptionalString(payload.permanent_address_city);
  const working_areas = [...new Set((Array.isArray(payload.working_areas) ? payload.working_areas : [])
    .map((item) => normalizeString(item))
    .filter(Boolean))];
  const working_distance_upto_km = toInteger(payload.working_distance_upto_km, 0);
  const status = normalizeString(payload.status || "active");
  const remarks = normalizeOptionalString(payload.remarks);

  if (!name) {
    return { ok: false, message: "Mason name is required" };
  }

  if (!isPhoneValid(mobile)) {
    return { ok: false, message: "Mason mobile must be 7 to 15 characters" };
  }

  if (alt_mobile && !isPhoneValid(alt_mobile)) {
    return { ok: false, message: "Alternate mobile must be 7 to 15 characters" };
  }

  if (!current_address) {
    return { ok: false, message: "Current address is required" };
  }

  if (!current_address_city) {
    return { ok: false, message: "Current address city is required" };
  }

  if (!working_areas.length) {
    return { ok: false, message: "At least one working area is required" };
  }

  if (!Number.isFinite(working_distance_upto_km) || working_distance_upto_km <= 0) {
    return { ok: false, message: "Working distance must be greater than zero" };
  }

  if (!masonStatuses.has(status)) {
    return { ok: false, message: "Mason status is invalid" };
  }

  return {
    ok: true,
    value: {
      name,
      mobile,
      alt_mobile,
      area: working_areas[0] || current_address_city || "",
      current_address,
      current_address_city,
      permanent_address,
      permanent_address_city,
      working_areas,
      working_distance_upto_km,
      status,
      remarks,
    },
  };
}

export function validatePlumbingMaterialPayload(payload) {
  const item_name = normalizeString(payload.item_name);
  const quantity = toInteger(payload.quantity, 1);
  const unit = normalizeString(payload.unit || "pcs");
  const price = toInteger(payload.price, 0);

  if (!item_name) {
    return { ok: false, message: "Material name is required" };
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, message: "Material quantity must be greater than zero" };
  }

  if (!unit) {
    return { ok: false, message: "Material unit is required" };
  }

  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, message: "Material price must be a non-negative number" };
  }

  return {
    ok: true,
    value: {
      item_name,
      quantity,
      unit,
      price,
    },
  };
}

export function validateProjectPayload(payload) {
  const leadIdValue = payload.lead_id;
  const lead_id = Number(leadIdValue);
  const project_name = normalizeString(payload.project_name);
  const status = normalizeString(payload.status || "active");
  const start_date = normalizeOptionalString(payload.start_date);
  const expected_delivery_date = normalizeOptionalString(payload.expected_delivery_date);
  const completion_date = normalizeOptionalString(payload.completion_date);
  const owner_note = normalizeOptionalString(payload.owner_note);

  if (!Number.isInteger(lead_id) || lead_id <= 0) {
    return { ok: false, message: "Project lead is invalid" };
  }

  if (!project_name) {
    return { ok: false, message: "Project name is required" };
  }

  if (!projectStatuses.has(status)) {
    return { ok: false, message: "Project status is invalid" };
  }

  for (const [label, value] of [
    ["Project start date", start_date],
    ["Expected delivery date", expected_delivery_date],
    ["Completion date", completion_date],
  ]) {
    if (value && Number.isNaN(new Date(value).getTime())) {
      return { ok: false, message: `${label} is invalid` };
    }
  }

  return {
    ok: true,
    value: {
      lead_id,
      project_name,
      status,
      start_date: start_date || null,
      expected_delivery_date: expected_delivery_date || null,
      completion_date: completion_date || null,
      owner_note,
    },
  };
}

export function validateDispatchPayload(payload) {
  const item_name = normalizeString(payload.item_name);
  const quantity = toInteger(payload.quantity, 1);
  const vehicle_number = normalizeOptionalString(payload.vehicle_number);
  const driver_name = normalizeOptionalString(payload.driver_name);
  const dispatch_date = normalizeOptionalString(payload.dispatch_date);
  const status = normalizeString(payload.status || "pending");
  const note = normalizeOptionalString(payload.note);

  if (!item_name) {
    return { ok: false, message: "Dispatch item name is required" };
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, message: "Dispatch quantity must be greater than zero" };
  }

  if (!dispatchStatuses.has(status)) {
    return { ok: false, message: "Dispatch status is invalid" };
  }

  if (dispatch_date && Number.isNaN(new Date(dispatch_date).getTime())) {
    return { ok: false, message: "Dispatch date is invalid" };
  }

  return {
    ok: true,
    value: {
      item_name,
      quantity,
      vehicle_number,
      driver_name,
      dispatch_date: dispatch_date || null,
      status,
      note,
    },
  };
}

export function validateExpensePayload(payload) {
  const category = normalizeString(payload.category || "miscellaneous");
  const expense_date = normalizeOptionalString(payload.expense_date) || new Date().toISOString().slice(0, 10);
  const amount = toInteger(payload.amount);
  const note = normalizeOptionalString(payload.note);
  const paid_by = normalizeString(payload.paid_by || "cash");

  if (!expenseCategories.has(category)) {
    return { ok: false, message: "Expense category is invalid" };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Expense amount must be greater than zero" };
  }

  if (expense_date && Number.isNaN(new Date(expense_date).getTime())) {
    return { ok: false, message: "Expense date is invalid" };
  }

  if (!expensePaymentModes.has(paid_by)) {
    return { ok: false, message: "Payment mode is invalid" };
  }

  return {
    ok: true,
    value: {
      category,
      expense_date,
      amount,
      note,
      paid_by,
    },
  };
}

export function validatePurchasePayload(payload, { requireMaster = true } = {}) {
  const supplier_name = normalizeString(payload.supplier_name);
  const supplier_phone = normalizeOptionalString(payload.supplier_phone);
  const supplier_id_raw = payload.supplier_id;
  const supplier_id =
    supplier_id_raw === "" || supplier_id_raw === null || typeof supplier_id_raw === "undefined"
      ? null
      : Number(supplier_id_raw);
  const product_id_raw = payload.product_id;
  const product_id =
    product_id_raw === "" || product_id_raw === null || typeof product_id_raw === "undefined"
      ? null
      : Number(product_id_raw);
  const invoice_number = normalizeOptionalString(payload.invoice_number);
  const purchase_date =
    normalizeOptionalString(payload.purchase_date) || new Date().toISOString().slice(0, 10);
  const truck_number = normalizeOptionalString(payload.truck_number);
  const delivery_date = normalizeOptionalString(payload.delivery_date);
  const batch_no = normalizeOptionalString(payload.batch_no);
  const business_unit = normalizeString(payload.business_unit || "tiles");
  const category = normalizeOptionalString(payload.category) || "tiles";
  const item_name = normalizeOptionalString(payload.item_name);
  const quantity = Number(payload.quantity ?? 0);
  const unit = normalizeOptionalString(payload.unit) || "pcs";
  const amount = Number(payload.amount ?? 0);
  const gst_amount = Number(payload.gst_amount ?? 0);
  const total_amount = Number(
    payload.total_amount === "" || payload.total_amount === null || typeof payload.total_amount === "undefined"
      ? amount + gst_amount
      : payload.total_amount
  );
  const payment_status = normalizeString(payload.payment_status || "pending");
  const remarks = normalizeOptionalString(payload.remarks);

  if (requireMaster) {
    if (!Number.isInteger(supplier_id) || supplier_id <= 0) {
      return { ok: false, message: "Registered supplier is required" };
    }
    if (!Number.isInteger(product_id) || product_id <= 0) {
      return { ok: false, message: "Inventory product is required" };
    }
  } else if (!supplier_name) {
    return { ok: false, message: "Supplier name is required" };
  }

  if (supplier_phone && !isPhoneValid(supplier_phone)) {
    return { ok: false, message: "Supplier phone must be 7 to 15 characters" };
  }

  if (purchase_date && Number.isNaN(new Date(purchase_date).getTime())) {
    return { ok: false, message: "Purchase date is invalid" };
  }

  if (delivery_date && Number.isNaN(new Date(delivery_date).getTime())) {
    return { ok: false, message: "Delivery date is invalid" };
  }

  if (!purchaseBusinessUnits.has(business_unit)) {
    return { ok: false, message: "Purchase business unit is invalid" };
  }

  if (!Number.isFinite(quantity) || quantity < 0) {
    return { ok: false, message: "Purchase quantity must be a non-negative number" };
  }

  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, message: "Purchase amount must be a non-negative number" };
  }

  if (!Number.isFinite(gst_amount) || gst_amount < 0) {
    return { ok: false, message: "GST amount must be a non-negative number" };
  }

  if (!Number.isFinite(total_amount) || total_amount < 0) {
    return { ok: false, message: "Total amount must be a non-negative number" };
  }

  if (!purchasePaymentStatuses.has(payment_status)) {
    return { ok: false, message: "Payment status is invalid" };
  }

  return {
    ok: true,
    value: {
      supplier_id,
      product_id,
      supplier_name,
      supplier_phone,
      invoice_number,
      purchase_date,
      truck_number,
      delivery_date: delivery_date || null,
      batch_no,
      business_unit,
      category,
      item_name,
      quantity,
      unit,
      amount,
      gst_amount,
      total_amount,
      payment_status,
      remarks,
    },
  };
}

export function validateDailyReportQuery(query) {
  const dateValue = normalizeOptionalString(query.date);
  const date = dateValue || new Date().toISOString().slice(0, 10);

  if (Number.isNaN(new Date(date).getTime())) {
    return { ok: false, message: "Report date is invalid" };
  }

  return { ok: true, value: { date } };
}

export function validateBillingInvoicePayload(payload) {
  const customer_name = normalizeString(payload.customer_name);
  const customer_mobile = normalizeOptionalString(payload.customer_mobile);
  const customer_address = normalizeOptionalString(payload.customer_address);
  const leadIdValue = payload.lead_id;
  const quotationIdValue = payload.quotation_id;
  const projectIdValue = payload.project_id;
  const lead_id =
    leadIdValue === "" || leadIdValue === null || typeof leadIdValue === "undefined"
      ? null
      : Number(leadIdValue);
  const quotation_id =
    quotationIdValue === "" || quotationIdValue === null || typeof quotationIdValue === "undefined"
      ? null
      : Number(quotationIdValue);
  const project_id =
    projectIdValue === "" || projectIdValue === null || typeof projectIdValue === "undefined"
      ? null
      : Number(projectIdValue);
  const site_reference = normalizeOptionalString(payload.site_reference);
  const invoice_type = normalizeString(payload.invoice_type || "gst_invoice");
  const invoice_date =
    normalizeOptionalString(payload.invoice_date) || new Date().toISOString().slice(0, 10);
  const notes = normalizeOptionalString(payload.notes);
  const transport_charge = Number(payload.transport_charge ?? 0);
  const additional_charge = Number(payload.additional_charge ?? 0);
  const status = normalizeString(payload.status || "draft");
  const approval_note = normalizeOptionalString(payload.approval_note);
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!customer_name) {
    return { ok: false, message: "Customer name is required" };
  }

  if (customer_mobile && !isPhoneValid(customer_mobile)) {
    return { ok: false, message: "Customer mobile must be 7 to 15 characters" };
  }

  if (lead_id !== null && (!Number.isInteger(lead_id) || lead_id <= 0)) {
    return { ok: false, message: "Lead reference is invalid" };
  }

  if (quotation_id !== null && (!Number.isInteger(quotation_id) || quotation_id <= 0)) {
    return { ok: false, message: "Quotation reference is invalid" };
  }

  if (project_id !== null && (!Number.isInteger(project_id) || project_id <= 0)) {
    return { ok: false, message: "Project reference is invalid" };
  }

  if (!billingInvoiceTypes.has(invoice_type)) {
    return { ok: false, message: "Invoice type is invalid" };
  }

  if (!billingApprovalStatuses.has(status)) {
    return { ok: false, message: "Invoice status is invalid" };
  }

  if (invoice_date && Number.isNaN(new Date(invoice_date).getTime())) {
    return { ok: false, message: "Invoice date is invalid" };
  }

  if (!Number.isFinite(transport_charge) || transport_charge < 0) {
    return { ok: false, message: "Transport charge must be a non-negative number" };
  }

  if (!Number.isFinite(additional_charge) || additional_charge < 0) {
    return { ok: false, message: "Additional charge must be a non-negative number" };
  }

  if (!items.length) {
    return { ok: false, message: "At least one invoice item is required" };
  }

  const normalizedItems = [];

  for (const item of items) {
    const item_type = normalizeString(item.item_type || "tiles");
    const productIdValue = item.product_id;
    const product_id =
      productIdValue === "" || productIdValue === null || typeof productIdValue === "undefined"
        ? null
        : Number(productIdValue);
    const product_name = normalizeString(item.product_name);
    const quantity = Number(item.quantity ?? 0);
    const unit = normalizeString(item.unit || "pcs");
    const rate = Number(item.rate ?? 0);
    const discount = Number(item.discount ?? 0);
    const gst_percent = Number(item.gst_percent ?? item.gst ?? 0);

    if (!billingItemTypes.has(item_type)) {
      return { ok: false, message: "Invoice item type is invalid" };
    }

    if (product_id !== null && (!Number.isInteger(product_id) || product_id <= 0)) {
      return { ok: false, message: "Invoice item product reference is invalid" };
    }

    if (!product_name) {
      return { ok: false, message: "Invoice item product name is required" };
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, message: "Invoice item quantity must be greater than zero" };
    }

    if (!unit) {
      return { ok: false, message: "Invoice item unit is required" };
    }

    if (!Number.isFinite(rate) || rate < 0) {
      return { ok: false, message: "Invoice item rate must be a non-negative number" };
    }

    if (!Number.isFinite(discount) || discount < 0) {
      return { ok: false, message: "Invoice item discount must be a non-negative number" };
    }

    if (!Number.isFinite(gst_percent) || gst_percent < 0) {
      return { ok: false, message: "Invoice item GST must be a non-negative number" };
    }

    const taxable = Math.max(quantity * rate - discount, 0);
    const total = Number((taxable + taxable * (gst_percent / 100)).toFixed(2));

    normalizedItems.push({
      item_type,
      product_id,
      product_name,
      quantity,
      unit,
      rate,
      discount,
      gst_percent,
      total,
    });
  }

  const subtotal = Number(
    normalizedItems.reduce((sum, item) => sum + Math.max(item.quantity * item.rate - item.discount, 0), 0).toFixed(2)
  );
  const gst_amount = Number(
    normalizedItems.reduce((sum, item) => {
      const taxable = Math.max(item.quantity * item.rate - item.discount, 0);
      return sum + taxable * (item.gst_percent / 100);
    }, 0).toFixed(2)
  );
  const total_discount = Number(normalizedItems.reduce((sum, item) => sum + item.discount, 0).toFixed(2));
  const grand_total = Number((subtotal + gst_amount + transport_charge + additional_charge).toFixed(2));

  return {
    ok: true,
    value: {
      customer_name,
      customer_mobile,
      customer_address,
      lead_id,
      quotation_id,
      project_id,
      site_reference,
      invoice_type,
      invoice_date,
      notes,
      transport_charge,
      additional_charge,
      total_discount,
      subtotal,
      gst_amount,
      grand_total,
      status,
      approval_note,
      items: normalizedItems,
    },
  };
}

export function validateBillingApprovalPayload(payload) {
  const action = normalizeString(payload.action);
  const note = normalizeOptionalString(payload.note);

  if (!["approved", "rejected"].includes(action)) {
    return { ok: false, message: "Approval action must be approved or rejected" };
  }

  return {
    ok: true,
    value: {
      action,
      note,
    },
  };
}

export function validateBillingPaymentPayload(payload) {
  const amount = Number(payload.amount ?? 0);
  const payment_mode = normalizeString(payload.payment_mode || "cash");
  const note = normalizeOptionalString(payload.note);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Payment amount must be greater than zero" };
  }

  if (!billingPaymentModes.has(payment_mode)) {
    return { ok: false, message: "Payment mode is invalid" };
  }

  return {
    ok: true,
    value: {
      amount: Number(amount.toFixed(2)),
      payment_mode,
      note,
    },
  };
}

export function validatePurchaseCostingPayload(payload) {
  const lot_number = normalizeString(payload.lot_number);
  const arrival_date = normalizeOptionalString(payload.arrival_date) || new Date().toISOString().slice(0, 10);
  const vehicle_number = normalizeOptionalString(payload.vehicle_number);
  const transporter_name = normalizeOptionalString(payload.transporter_name);
  const driver_name = normalizeOptionalString(payload.driver_name);
  const driver_mobile = normalizeOptionalString(payload.driver_mobile);
  const allocation_method = normalizeString(payload.allocation_method || "weight_wise");
  const total_freight_cost = Number(payload.total_freight_cost ?? 0);
  const total_unloading_cost = Number(payload.total_unloading_cost ?? 0);
  const other_charges = Number(payload.other_charges ?? 0);
  const financed_amount = Number(payload.financed_amount ?? 0);
  const interest_rate_percent = Number(payload.interest_rate_percent ?? 0);
  const holding_days = Number(payload.holding_days ?? 0);
  const interest_cost_override =
    payload.interest_cost_override === "" || payload.interest_cost_override === null || typeof payload.interest_cost_override === "undefined"
      ? null
      : Number(payload.interest_cost_override);
  const showroom_overhead_amount = Number(payload.showroom_overhead_amount ?? 0);
  const stock_received_date = normalizeOptionalString(payload.stock_received_date) || arrival_date;
  const time_decay_percent =
    payload.time_decay_percent === "" || payload.time_decay_percent === null || typeof payload.time_decay_percent === "undefined"
      ? null
      : Number(payload.time_decay_percent);
  const marketing_cost_amount = Number(payload.marketing_cost_amount ?? 0);
  const marketing_cost_allocation_method = normalizeOptionalString(payload.marketing_cost_allocation_method) || "manual";
  const monthly_overhead_allocation_method =
    normalizeOptionalString(payload.monthly_overhead_allocation_method) || "per_box";
  const overhead_period = normalizeOptionalString(payload.overhead_period);
  const overhead_notes = normalizeOptionalString(payload.overhead_notes);
  const minimum_margin_percent = Number(payload.minimum_margin_percent ?? 0);
  const target_margin_percent = Number(payload.target_margin_percent ?? 0);
  const remarks = normalizeOptionalString(payload.remarks);
  const status = normalizeString(payload.status || "draft");
  const suppliers = Array.isArray(payload.suppliers) ? payload.suppliers : [];

  if (!lot_number) {
    return { ok: false, message: "Lot / truck number is required" };
  }

  if (arrival_date && Number.isNaN(new Date(arrival_date).getTime())) {
    return { ok: false, message: "Arrival date is invalid" };
  }

  if (driver_mobile && !isPhoneValid(driver_mobile)) {
    return { ok: false, message: "Driver mobile must be 7 to 15 characters" };
  }

  if (!purchaseAllocationMethods.has(allocation_method)) {
    return { ok: false, message: "Allocation method is invalid" };
  }

  if (!purchaseCostingStatuses.has(status)) {
    return { ok: false, message: "Purchase costing status is invalid" };
  }

  if (!overheadAllocationMethods.has(monthly_overhead_allocation_method)) {
    return { ok: false, message: "Monthly overhead allocation method is invalid" };
  }

  const numericChecks = [
    ["Total freight cost", total_freight_cost],
    ["Total unloading cost", total_unloading_cost],
    ["Other charges", other_charges],
    ["Financed amount", financed_amount],
    ["Interest rate", interest_rate_percent],
    ["Holding days", holding_days],
    ["Showroom overhead amount", showroom_overhead_amount],
    ["Marketing cost amount", marketing_cost_amount],
    ["Minimum margin", minimum_margin_percent],
    ["Target margin", target_margin_percent],
  ];

  for (const [label, value] of numericChecks) {
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, message: `${label} must be a non-negative number` };
    }
  }

  if (interest_cost_override !== null && (!Number.isFinite(interest_cost_override) || interest_cost_override < 0)) {
    return { ok: false, message: "Interest cost override must be a non-negative number" };
  }

  if (stock_received_date && Number.isNaN(new Date(stock_received_date).getTime())) {
    return { ok: false, message: "Stock received date is invalid" };
  }

  if (time_decay_percent !== null && (!Number.isFinite(time_decay_percent) || time_decay_percent < 0)) {
    return { ok: false, message: "Time decay percent must be a non-negative number" };
  }

  if (!suppliers.length) {
    return { ok: false, message: "At least one supplier is required" };
  }

  const normalizedSuppliers = [];

  for (const supplier of suppliers) {
    const supplier_name = normalizeString(supplier.supplier_name);
    const supplier_invoice_number = normalizeOptionalString(supplier.supplier_invoice_number);
    const supplier_invoice_date = normalizeOptionalString(supplier.supplier_invoice_date);
    const supplier_amount =
      supplier.supplier_amount === "" || supplier.supplier_amount === null || typeof supplier.supplier_amount === "undefined"
        ? null
        : Number(supplier.supplier_amount);
    const supplier_notes = normalizeOptionalString(supplier.supplier_notes);
    const items = Array.isArray(supplier.items) ? supplier.items : [];

    if (!supplier_name) {
      return { ok: false, message: "Supplier name is required" };
    }

    if (supplier_invoice_date && Number.isNaN(new Date(supplier_invoice_date).getTime())) {
      return { ok: false, message: "Supplier invoice date is invalid" };
    }

    if (supplier_amount !== null && (!Number.isFinite(supplier_amount) || supplier_amount < 0)) {
      return { ok: false, message: "Supplier amount must be a non-negative number" };
    }

    if (!items.length) {
      return { ok: false, message: `Supplier ${supplier_name} must have at least one product line` };
    }

    const normalizedItems = [];

    for (const item of items) {
      const productIdValue = item.product_id;
      const product_id =
        productIdValue === "" || productIdValue === null || typeof productIdValue === "undefined"
          ? null
          : Number(productIdValue);
      const item_name = normalizeString(item.item_name);
      const company_name = normalizeOptionalString(item.company_name);
      const product_size = normalizeOptionalString(item.product_size);
      const category = normalizeString(item.category || "tiles");
      const quantity = Number(item.quantity ?? 0);
      const unit = normalizeString(item.unit || "pcs");
      const basic_purchase_rate = Number(item.basic_purchase_rate ?? 0);
      const boxes =
        item.boxes === "" || item.boxes === null || typeof item.boxes === "undefined" ? 0 : Number(item.boxes);
      const pieces_per_box =
        item.pieces_per_box === "" || item.pieces_per_box === null || typeof item.pieces_per_box === "undefined"
          ? 0
          : Number(item.pieces_per_box);
      const sqft_per_box =
        item.sqft_per_box === "" || item.sqft_per_box === null || typeof item.sqft_per_box === "undefined"
          ? 0
          : Number(item.sqft_per_box);
      const weight_per_box =
        item.weight_per_box === "" || item.weight_per_box === null || typeof item.weight_per_box === "undefined"
          ? 0
          : Number(item.weight_per_box);
      const weight_per_unit =
        item.weight_per_unit === "" || item.weight_per_unit === null || typeof item.weight_per_unit === "undefined"
          ? 0
          : Number(item.weight_per_unit);
      const damage_quantity = Number(item.damage_quantity ?? 0);
      const manual_allocation_value =
        item.manual_allocation_value === "" || item.manual_allocation_value === null || typeof item.manual_allocation_value === "undefined"
          ? 0
          : Number(item.manual_allocation_value);

      if (product_id !== null && (!Number.isInteger(product_id) || product_id <= 0)) {
        return { ok: false, message: "Purchase lot product reference is invalid" };
      }

      if (!item_name) {
        return { ok: false, message: "Product / item name is required" };
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { ok: false, message: "Purchase lot quantity must be greater than zero" };
      }

      if (!unit) {
        return { ok: false, message: "Purchase lot unit is required" };
      }

      if (!Number.isFinite(basic_purchase_rate) || basic_purchase_rate < 0) {
        return { ok: false, message: "Basic purchase rate must be a non-negative number" };
      }

      const itemNumericChecks = [
        ["Boxes", boxes],
        ["Pieces per box", pieces_per_box],
        ["Sqft per box", sqft_per_box],
        ["Weight per box", weight_per_box],
        ["Weight per unit", weight_per_unit],
      ];

      for (const [label, value] of itemNumericChecks) {
        if (!Number.isFinite(value) || value < 0) {
          return { ok: false, message: `${label} must be a non-negative number` };
        }
      }

      if (!Number.isFinite(damage_quantity) || damage_quantity < 0 || damage_quantity > quantity) {
        return { ok: false, message: "Damage / decay quantity is invalid" };
      }

      if (!Number.isFinite(manual_allocation_value) || manual_allocation_value < 0) {
        return { ok: false, message: "Manual allocation value must be a non-negative number" };
      }

      normalizedItems.push({
        product_id,
        item_name,
        company_name,
        product_size,
        category,
        quantity,
        unit,
        basic_purchase_rate,
        boxes,
        pieces_per_box,
        sqft_per_box,
        weight_per_box,
        weight_per_unit,
        damage_quantity,
        manual_allocation_value,
      });
    }

    normalizedSuppliers.push({
      supplier_name,
      supplier_invoice_number,
      supplier_invoice_date: supplier_invoice_date || null,
      supplier_amount,
      supplier_notes,
      items: normalizedItems,
    });
  }

  return {
    ok: true,
    value: {
      lot_number,
      arrival_date,
      vehicle_number,
      transporter_name,
      driver_name,
      driver_mobile,
      allocation_method,
      total_freight_cost,
      total_unloading_cost,
      other_charges,
      financed_amount,
      interest_rate_percent,
      holding_days,
      interest_cost_override,
      showroom_overhead_amount,
      stock_received_date,
      time_decay_percent,
      marketing_cost_amount,
      marketing_cost_allocation_method,
      monthly_overhead_allocation_method,
      overhead_period,
      overhead_notes,
      minimum_margin_percent,
      target_margin_percent,
      remarks,
      status,
      suppliers: normalizedSuppliers,
    },
  };
}

export function validateDateRangeQuery(query) {
  const from = normalizeOptionalString(query.from);
  const to = normalizeOptionalString(query.to);

  if (from && Number.isNaN(new Date(from).getTime())) {
    return { ok: false, message: "Range start date is invalid" };
  }

  if (to && Number.isNaN(new Date(to).getTime())) {
    return { ok: false, message: "Range end date is invalid" };
  }

  return { ok: true, value: { from: from || null, to: to || null } };
}

export function validateDealerPayload(payload) {
  const name = normalizeString(payload.name);
  const area = normalizeOptionalString(payload.area);
  const phone = normalizeOptionalString(payload.phone);
  const monthly_purchase = toInteger(payload.monthly_purchase, 0);
  const credit_limit = toInteger(payload.credit_limit, 0);
  const outstanding_payment = toInteger(payload.outstanding_payment, 0);
  const commission_percent = toInteger(payload.commission_percent, 0);
  const category = normalizeString(payload.category || "C").toUpperCase();

  if (!name) {
    return { ok: false, message: "Dealer name is required" };
  }

  if (phone && !isPhoneValid(phone)) {
    return { ok: false, message: "Dealer phone must be 7 to 15 characters" };
  }

  if (
    !Number.isFinite(monthly_purchase) ||
    !Number.isFinite(credit_limit) ||
    !Number.isFinite(outstanding_payment) ||
    !Number.isFinite(commission_percent) ||
    monthly_purchase < 0 ||
    credit_limit < 0 ||
    outstanding_payment < 0 ||
    commission_percent < 0
  ) {
    return { ok: false, message: "Dealer numeric values must be non-negative" };
  }

  if (!dealerCategories.has(category)) {
    return { ok: false, message: "Dealer category is invalid" };
  }

  return {
    ok: true,
    value: {
      name,
      area,
      phone,
      monthly_purchase,
      credit_limit,
      outstanding_payment,
      commission_percent,
      category,
    },
  };
}

export function validateProductPayload(payload) {
  const name = normalizeString(payload.name);
  const company_name = normalizeOptionalString(payload.company_name);
  const design_code = normalizeOptionalString(payload.design_code);
  const business_unit = normalizeString(payload.business_unit || "tiles");
  const category = normalizeOptionalString(payload.category || "Floor Tiles");
  const tile_size = normalizeOptionalString(payload.tile_size);
  const product_size = normalizeOptionalString(payload.product_size || tile_size);
  const unit = normalizeOptionalString(payload.unit || "pcs");
  const finish = normalizeOptionalString(payload.finish);
  const stock_sqft = toInteger(payload.stock_sqft, 0);
  const price_per_sqft = toInteger(payload.price_per_sqft, 0);
  const purchase_rate = Number(payload.purchase_rate ?? 0);
  const predefined_rate = Number(payload.predefined_rate ?? 0);
  const today_selling_rate = Number(payload.today_selling_rate ?? 0);
  const daily_up_limit_percent = Number(payload.daily_up_limit_percent ?? 2);
  const daily_down_limit_percent = Number(payload.daily_down_limit_percent ?? 1);
  const last_purchase_rate = Number(payload.last_purchase_rate ?? purchase_rate ?? 0);
  const landed_cost_per_unit = Number(payload.landed_cost_per_unit ?? 0);
  const minimum_allowed_rate = Number(payload.minimum_allowed_rate ?? 0);
  const suggested_selling_rate = Number(payload.suggested_selling_rate ?? 0);
  const operator_discount_cap = Number(payload.operator_discount_cap ?? 0);
  const manager_discount_cap = Number(payload.manager_discount_cap ?? 0);
  const owner_discount_cap = Number(payload.owner_discount_cap ?? 0);
  const pieces_per_box = Number(payload.pieces_per_box ?? 0);
  const sqft_per_box = Number(payload.sqft_per_box ?? 0);
  const weight_per_box = Number(payload.weight_per_box ?? 0);
  const weight_per_unit = Number(payload.weight_per_unit ?? 0);
  const safety_margin_percent = Number(payload.safety_margin_percent ?? 0);
  const growth_margin_percent = Number(payload.growth_margin_percent ?? 0);
  const quotation_validity_days = Number(payload.quotation_validity_days ?? 0);
  const pricing_lock = Boolean(payload.pricing_lock);
  const status = normalizeString(payload.status || "active");

  if (!name) {
    return { ok: false, message: "Product name is required" };
  }

  if (
    !Number.isFinite(stock_sqft) ||
    !Number.isFinite(price_per_sqft) ||
    !Number.isFinite(purchase_rate) ||
    !Number.isFinite(predefined_rate) ||
    !Number.isFinite(today_selling_rate) ||
    !Number.isFinite(daily_up_limit_percent) ||
    !Number.isFinite(daily_down_limit_percent) ||
    !Number.isFinite(last_purchase_rate) ||
    !Number.isFinite(landed_cost_per_unit) ||
    !Number.isFinite(minimum_allowed_rate) ||
    !Number.isFinite(suggested_selling_rate) ||
    !Number.isFinite(operator_discount_cap) ||
    !Number.isFinite(manager_discount_cap) ||
    !Number.isFinite(owner_discount_cap) ||
    !Number.isFinite(pieces_per_box) ||
    !Number.isFinite(sqft_per_box) ||
    !Number.isFinite(weight_per_box) ||
    !Number.isFinite(weight_per_unit) ||
    !Number.isFinite(safety_margin_percent) ||
    !Number.isFinite(growth_margin_percent) ||
    !Number.isFinite(quotation_validity_days) ||
    stock_sqft < 0 ||
    price_per_sqft < 0 ||
    purchase_rate < 0 ||
    predefined_rate < 0 ||
    today_selling_rate < 0 ||
    daily_up_limit_percent < 0 ||
    daily_down_limit_percent < 0 ||
    last_purchase_rate < 0 ||
    landed_cost_per_unit < 0 ||
    minimum_allowed_rate < 0 ||
    suggested_selling_rate < 0 ||
    operator_discount_cap < 0 ||
    manager_discount_cap < 0 ||
    owner_discount_cap < 0 ||
    pieces_per_box < 0 ||
    sqft_per_box < 0 ||
    weight_per_box < 0 ||
    weight_per_unit < 0 ||
    safety_margin_percent < 0 ||
    growth_margin_percent < 0 ||
    quotation_validity_days < 0
  ) {
    return { ok: false, message: "Inventory values must be non-negative" };
  }

  if (!productStatuses.has(status)) {
    return { ok: false, message: "Product status is invalid" };
  }

  if (!businessUnits.has(business_unit)) {
    return { ok: false, message: "Product business unit is invalid" };
  }

  return {
    ok: true,
    value: {
      name,
      company_name,
      design_code,
      business_unit,
      category,
      tile_size,
      product_size,
      unit,
      finish,
      pieces_per_box,
      sqft_per_box,
      weight_per_box,
      weight_per_unit,
      stock_sqft,
      purchase_rate,
      price_per_sqft,
      predefined_rate,
      today_selling_rate,
      daily_up_limit_percent,
      daily_down_limit_percent,
      last_purchase_rate,
      landed_cost_per_unit,
      minimum_allowed_rate,
      suggested_selling_rate,
      operator_discount_cap,
      manager_discount_cap,
      owner_discount_cap,
      safety_margin_percent,
      growth_margin_percent,
      quotation_validity_days,
      pricing_lock,
      status,
    },
  };
}

export function validateUserPayload(payload, { requirePassword = true } = {}) {
  const name = normalizeString(payload.name);
  const phone = normalizeString(payload.phone);
  const role = normalizeString(payload.role || "sales");
  const rawRoles = Array.isArray(payload.roles)
    ? payload.roles
    : typeof payload.roles === "string" && payload.roles.trim()
      ? [payload.roles]
      : [];
  const normalizedRoles = [...new Set(rawRoles.map((item) => normalizeString(item)).filter(Boolean))];
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!name) {
    return { ok: false, message: "Name is required" };
  }

  if (!isPhoneValid(phone)) {
    return { ok: false, message: "Phone must be 7 to 15 characters" };
  }

  if (!userRoles.has(role)) {
    return { ok: false, message: "User role is invalid" };
  }

  if (normalizedRoles.some((item) => !userRoles.has(item))) {
    return { ok: false, message: "One or more user roles are invalid" };
  }

  if (requirePassword && password.length < 6) {
    return { ok: false, message: "Password must be at least 6 characters" };
  }

  if (!requirePassword && password && password.length < 6) {
    return { ok: false, message: "New password must be at least 6 characters" };
  }

  return {
    ok: true,
    value: {
      name,
      phone,
      role,
      roles: normalizedRoles.length ? normalizedRoles : [role],
      password,
    },
  };
}

export function validateAdhesiveTokenPayload(payload) {
  const projectIdValue = payload.project_id;
  const project_id =
    projectIdValue === "" || projectIdValue === null || typeof projectIdValue === "undefined"
      ? null
      : Number(projectIdValue);
  const masonIdValue = payload.mason_id;
  const mason_id =
    masonIdValue === "" || masonIdValue === null || typeof masonIdValue === "undefined"
      ? null
      : Number(masonIdValue);
  const site_name = normalizeString(payload.site_name);
  const invoice_number = normalizeString(payload.invoice_number);
  const sale_date = normalizeOptionalString(payload.sale_date);
  const customer_name = normalizeOptionalString(payload.customer_name);
  const adhesive_company = normalizeString(payload.adhesive_company);
  const adhesive_type = normalizeString(payload.adhesive_type);
  const sold_bag_quantity = toInteger(payload.sold_bag_quantity, 0);
  const remarks = normalizeOptionalString(payload.remarks);
  const token_photo_url = normalizeOptionalString(payload.token_photo_url);
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!site_name) {
    return { ok: false, message: "Site name is required" };
  }

  if (project_id !== null && (!Number.isInteger(project_id) || project_id <= 0)) {
    return { ok: false, message: "Project selection is invalid" };
  }

  if (!invoice_number) {
    return { ok: false, message: "Invoice number is required" };
  }

  if (sale_date && Number.isNaN(new Date(sale_date).getTime())) {
    return { ok: false, message: "Sale date is invalid" };
  }

  if (!Number.isInteger(mason_id) || mason_id <= 0) {
    return { ok: false, message: "Registered mason selection is required" };
  }

  if (!adhesive_company) {
    return { ok: false, message: "Adhesive company is required" };
  }

  if (!adhesive_type) {
    return { ok: false, message: "Adhesive type is required" };
  }

  if (!Number.isFinite(sold_bag_quantity) || sold_bag_quantity <= 0) {
    return { ok: false, message: "Sold bag quantity must be greater than zero" };
  }

  if (!items.length) {
    return { ok: false, message: "At least one token line item is required" };
  }

  const normalizedItems = [];

  for (const item of items) {
    const token_value = toInteger(item.token_value, 0);
    const quantity = toInteger(item.quantity, 0);

    if (!Number.isFinite(token_value) || token_value < 0) {
      return { ok: false, message: "Token value must be 0 or more" };
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, message: "Token quantity must be greater than zero" };
    }

    normalizedItems.push({
      token_value,
      quantity,
      line_total: token_value * quantity,
    });
  }

  const claimed_bag_quantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  const total_token_amount = normalizedItems.reduce((sum, item) => sum + item.line_total, 0);

  if (claimed_bag_quantity > sold_bag_quantity) {
    return { ok: false, message: "Claimed bag quantity cannot be greater than sold bag quantity" };
  }

  return {
    ok: true,
    value: {
      site_name,
      project_id,
      mason_id,
      invoice_number,
      sale_date: sale_date || null,
      customer_name,
      adhesive_company,
      adhesive_type,
      sold_bag_quantity,
      claimed_bag_quantity,
      total_token_amount,
      remarks,
      token_photo_url,
      items: normalizedItems,
    },
  };
}

export function validateAdhesiveTokenApprovalPayload(payload) {
  const verification_status = normalizeString(payload.verification_status);
  const remarks = normalizeOptionalString(payload.remarks);

  if (!["approved", "rejected"].includes(verification_status)) {
    return { ok: false, message: "Approval action must be approved or rejected" };
  }

  return {
    ok: true,
    value: {
      verification_status,
      remarks,
    },
  };
}

export function validateAdhesiveTokenStatusPayload(payload) {
  const status = normalizeString(payload.status);
  const payment_date = normalizeOptionalString(payload.payment_date);
  const remarks = normalizeOptionalString(payload.remarks);

  if (status !== "paid") {
    return { ok: false, message: "Status update must be paid" };
  }

  if (payment_date && Number.isNaN(new Date(payment_date).getTime())) {
    return { ok: false, message: "Payment date is invalid" };
  }

  if (!payment_date) {
    return { ok: false, message: "Payment date is required when marking claim as paid" };
  }

  return {
    ok: true,
    value: {
      status,
      payment_date,
      remarks,
    },
  };
}

export function computeAdhesiveVerificationStatus({
  invoice_number,
  customer_name,
  expected_customer_name,
  sold_bag_quantity,
  claimed_bag_quantity,
}) {
  if (!invoice_number) {
    return "unverified";
  }

  if (!Number.isFinite(sold_bag_quantity) || sold_bag_quantity <= 0) {
    return "mismatch";
  }

  if (!Number.isFinite(claimed_bag_quantity) || claimed_bag_quantity <= 0) {
    return "mismatch";
  }

  if (claimed_bag_quantity > sold_bag_quantity) {
    return "mismatch";
  }

  if (!expected_customer_name) {
    return "unverified";
  }

  if (!normalizeString(customer_name)) {
    return "unverified";
  }

  if (
    normalizeString(customer_name).toLowerCase() !==
    normalizeString(expected_customer_name).toLowerCase()
  ) {
    return "mismatch";
  }

  return "matched";
}

export function isValidAdhesiveVerificationStatus(value) {
  return adhesiveVerificationStatuses.has(normalizeString(value));
}

export function validateAdhesiveVerificationPayload(payload) {
  const verification_status = normalizeString(payload.verification_status);
  const remarks = normalizeOptionalString(payload.remarks);

  if (!["matched", "mismatch"].includes(verification_status)) {
    return { ok: false, message: "Verification result must be matched or mismatch" };
  }

  return {
    ok: true,
    value: {
      verification_status,
      remarks,
    },
  };
}

export function validateAdhesiveVerificationStatusValue(value) {
  return adhesiveVerificationStatuses.has(normalizeString(value));
}

export function validateAdhesiveStatusValue(value) {
  return adhesiveTokenStatuses.has(normalizeString(value));
}

export function validateComplaintPayload(payload) {
  const leadIdValue = payload.lead_id;
  const assignedToValue = payload.assigned_to;
  const lead_id =
    leadIdValue === "" || leadIdValue === null || typeof leadIdValue === "undefined"
      ? null
      : Number(leadIdValue);
  const assigned_to =
    assignedToValue === "" || assignedToValue === null || typeof assignedToValue === "undefined"
      ? null
      : Number(assignedToValue);
  const customer_name = normalizeString(payload.customer_name);
  const phone = normalizeString(payload.phone);
  const location = normalizeOptionalString(payload.location);
  const business_unit = normalizeString(payload.business_unit || "plumbing");
  const category = normalizeString(payload.category || "other");
  const priority = normalizeString(payload.priority || "medium");
  const status = normalizeString(payload.status || "open");
  const title = normalizeString(payload.title);
  const description = normalizeString(payload.description);
  const resolution_note = normalizeOptionalString(payload.resolution_note);
  const due_date = normalizeOptionalString(payload.due_date);

  if (lead_id !== null && (!Number.isInteger(lead_id) || lead_id <= 0)) {
    return { ok: false, message: "Complaint lead is invalid" };
  }

  if (!customer_name) {
    return { ok: false, message: "Customer name is required" };
  }

  if (!isPhoneValid(phone)) {
    return { ok: false, message: "Customer phone must be 7 to 15 characters" };
  }

  if (!businessUnits.has(business_unit)) {
    return { ok: false, message: "Complaint business unit is invalid" };
  }

  if (!complaintCategories.has(category)) {
    return { ok: false, message: "Complaint category is invalid" };
  }

  if (!complaintPriorities.has(priority)) {
    return { ok: false, message: "Complaint priority is invalid" };
  }

  if (!complaintStatuses.has(status)) {
    return { ok: false, message: "Complaint status is invalid" };
  }

  if (!title) {
    return { ok: false, message: "Complaint title is required" };
  }

  if (!description) {
    return { ok: false, message: "Complaint description is required" };
  }

  if (due_date && Number.isNaN(new Date(due_date).getTime())) {
    return { ok: false, message: "Complaint due date is invalid" };
  }

  if (assigned_to !== null && (!Number.isInteger(assigned_to) || assigned_to <= 0)) {
    return { ok: false, message: "Assigned complaint user is invalid" };
  }

  return {
    ok: true,
    value: {
      lead_id,
      customer_name,
      phone,
      location,
      business_unit,
      category,
      priority,
      status,
      title,
      description,
      resolution_note,
      due_date: due_date || null,
      assigned_to,
    },
  };
}

export function validateLoginPayload(payload) {
  const phone = normalizeString(payload.phone);
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!isPhoneValid(phone)) {
    return { ok: false, message: "Phone must be 7 to 15 characters" };
  }

  if (!password) {
    return { ok: false, message: "Password is required" };
  }

  return { ok: true, value: { phone, password } };
}
