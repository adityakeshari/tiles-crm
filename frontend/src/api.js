const API_BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "/api");
const DEFAULT_TIMEOUT_MS = 15000;
const AUTH_EXPIRED_STORAGE_KEY = "tiles-crm-auth-expired-message";

function getHeaders(includeAuth = true) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (includeAuth) {
    const token = localStorage.getItem("tiles-crm-token");

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
}

function withQuery(path, query = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    params.set(key, String(value));
  });

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

async function request(path, options = {}) {
  const {
    includeAuth,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    headers,
    ...fetchOptions
  } = options;
  const timeoutController = new AbortController();
  const timeout = window.setTimeout(() => timeoutController.abort("timeout"), timeoutMs);

  let combinedSignal = timeoutController.signal;

  if (signal) {
    if (signal.aborted) {
      window.clearTimeout(timeout);
      throw signal.reason instanceof Error ? signal.reason : new DOMException("Request aborted", "AbortError");
    }

    const combinedController = new AbortController();
    const abortFrom = (sourceSignal) => {
      if (!combinedController.signal.aborted) {
        combinedController.abort(sourceSignal.reason);
      }
    };

    signal.addEventListener("abort", () => abortFrom(signal), { once: true });
    timeoutController.signal.addEventListener("abort", () => abortFrom(timeoutController.signal), { once: true });
    combinedSignal = combinedController.signal;
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      signal: combinedSignal,
      headers: {
        ...getHeaders(includeAuth !== false),
        ...(headers || {}),
      },
    });
  } catch (error) {
    window.clearTimeout(timeout);

    if (error?.name === "AbortError" || error === "timeout" || error?.message === "timeout") {
      const requestError = new Error(timeoutController.signal.aborted ? "Request timed out. Please try again." : "Request was cancelled.");
      requestError.name = "AbortError";
      requestError.isTimeout = timeoutController.signal.aborted;
      throw requestError;
    }

    throw error;
  }

  window.clearTimeout(timeout);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    if (response.status === 401 && typeof window !== "undefined") {
      const expiredMessage =
        error?.code === "SESSION_REPLACED"
          ? "You have been logged out because your account was used on another device."
          : "Your session has expired. Please sign in again.";
      localStorage.removeItem("tiles-crm-token");
      localStorage.removeItem("tiles-crm-user");
      sessionStorage.setItem(AUTH_EXPIRED_STORAGE_KEY, expiredMessage);
      window.location.reload();
    }
    const requestError = new Error(error.message || "Request failed");
    requestError.status = response.status;
    requestError.data = error;
    throw requestError;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function consumeAuthExpiredMessage() {
  if (typeof window === "undefined") {
    return "";
  }
  const message = sessionStorage.getItem(AUTH_EXPIRED_STORAGE_KEY) || "";
  if (message) {
    sessionStorage.removeItem(AUTH_EXPIRED_STORAGE_KEY);
  }
  return message;
}

export function getQuotationPdfUrl(leadId, quotationId) {
  const token = localStorage.getItem("tiles-crm-token");
  return `${API_BASE_URL}/leads/${leadId}/quotations/${quotationId}/pdf?token=${encodeURIComponent(token || "")}`;
}

export function getProjectInvoicePdfUrl(projectId) {
  const token = localStorage.getItem("tiles-crm-token");
  return `${API_BASE_URL}/projects/${projectId}/invoice/pdf?token=${encodeURIComponent(token || "")}`;
}

export function getBillingPdfUrl(invoiceId, type = "gst_invoice") {
  const token = localStorage.getItem("tiles-crm-token");
  const normalizedType = type === "estimate" ? "estimate" : "gst_invoice";
  return `${API_BASE_URL}/billing/${invoiceId}/pdf?type=${encodeURIComponent(normalizedType)}&token=${encodeURIComponent(token || "")}`;
}

export function getCsvExportUrl(resource) {
  const token = localStorage.getItem("tiles-crm-token");
  return `${API_BASE_URL}/exports/${resource}.csv?token=${encodeURIComponent(token || "")}`;
}

export const api = {
  login: (payload, options) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
      includeAuth: false,
      ...(options || {}),
    }),
  seedAdmin: (payload, options) =>
    request("/auth/seed-admin", {
      method: "POST",
      body: JSON.stringify(payload),
      includeAuth: false,
      ...(options || {}),
    }),
  getStats: (options) => request("/leads/dashboard/stats", options),
  getFollowupBoard: (options) => request("/leads/dashboard/followups", options),
  getOperationsBoard: (options) => request("/leads/dashboard/operations", options),
  getDailyTasks: (params = {}, options = {}) =>
    request(
      withQuery("/daily-tasks", {
        limit: params.limit,
        view: params.view,
        search: params.search,
        status: params.status,
        assigned_to: params.assigned_to,
        priority: params.priority,
        due_date: params.due_date,
      }),
      options
    ),
  getDailyTaskSummary: (options = {}) => request("/daily-tasks/summary", options),
  generateOperatorRoutine: (payload) =>
    request("/daily-tasks/generate-operator-routine", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createDailyTask: (payload) =>
    request("/daily-tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateDailyTask: (id, payload) =>
    request(`/daily-tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  verifyDailyTask: (id) =>
    request(`/daily-tasks/${id}/verify`, {
      method: "PUT",
    }),
  deleteDailyTask: (id) =>
    request(`/daily-tasks/${id}`, {
      method: "DELETE",
    }),
  getDailyTaskTemplates: (options = {}) => request("/daily-tasks/templates", options),
  createDailyTaskTemplate: (payload) =>
    request("/daily-tasks/templates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateDailyTaskTemplate: (id, payload) =>
    request(`/daily-tasks/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteDailyTaskTemplate: (id) =>
    request(`/daily-tasks/templates/${id}`, {
      method: "DELETE",
    }),
  generateDailyTasksNow: () =>
    request("/daily-tasks/templates/generate-now", {
      method: "POST",
    }),
  getDashboardSummary: (options) => request("/dashboard/summary", options),
  getDailyReport: (params = {}, options) =>
    request(withQuery("/reports/daily", { date: params.date }), options),
  getSalesReport: (params = {}, options) =>
    request(withQuery("/reports/sales", { from: params.from, to: params.to }), options),
  getCollectionReport: (params = {}, options) =>
    request(withQuery("/reports/collection", { from: params.from, to: params.to }), options),
  getCustomerPendingReport: (options) => request("/reports/customer-pending", options),
  getTokenReport: (params = {}, options) =>
    request(withQuery("/reports/token", { status: params.status }), options),
  getMasonTokenSummary: (options) => request("/reports/mason-token-summary", options),
  getSchemesDashboard: (options = {}) => request(withQuery("/schemes", { limit: options.limit, mason_limit: options.mason_limit }), options),
  getMasons: (options = {}) =>
    request(
      withQuery("/schemes/masons", {
        limit: options.limit,
        status: options.status,
        search: options.search,
      }),
      options
    ),
  getActiveMasons: (options = {}) =>
    request(
      withQuery("/schemes/masons", { limit: options.limit || 300, status: "active" }),
      options
    ),
  createMason: (payload) =>
    request("/schemes/masons", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateMason: (id, payload) =>
    request(`/schemes/masons/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getComplaintsDashboard: (options = {}) => request(withQuery("/complaints", { limit: options.limit }), options),
  getNotifications: (options) => request("/notifications", options),
  getPlumbingDashboard: (options) => request("/plumbing", options),
  getProjectsDashboard: (options = {}) => request(withQuery("/projects", { limit: options.limit }), options),
  getBillingDashboard: (options = {}) =>
    request(
      withQuery("/billing", {
        limit: options.limit,
        search: options.search,
        status: options.status,
        payment_status: options.payment_status,
        from: options.from,
        to: options.to,
      }),
      options
    ),
  getBillingInvoiceDetail: (id, options) => request(`/billing/${id}`, options),
  createBillingInvoice: (payload) =>
    request("/billing", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateBillingInvoice: (id, payload) =>
    request(`/billing/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  submitBillingInvoiceApproval: (id, payload = {}) =>
    request(`/billing/${id}/submit-approval`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  reviewBillingInvoiceApproval: (id, payload) =>
    request(`/billing/${id}/approval`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  cancelBillingInvoice: (id, payload = {}) =>
    request(`/billing/${id}/cancel`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  addBillingPayment: (id, payload) =>
    request(`/billing/${id}/payments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteBillingInvoice: (id) =>
    request(`/billing/${id}`, {
      method: "DELETE",
    }),
  getPurchaseCostingDashboard: (options = {}) =>
    request(
      withQuery("/purchase-costing", {
        limit: options.limit,
        search: options.search,
        status: options.status,
      }),
      options
    ),
  getPurchaseCostingLotDetail: (id, options) => request(`/purchase-costing/${id}`, options),
  createPurchaseCostingLot: (payload) =>
    request("/purchase-costing", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePurchaseCostingLot: (id, payload) =>
    request(`/purchase-costing/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  approvePurchaseCostingLot: (id, payload = {}) =>
    request(`/purchase-costing/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  cancelPurchaseCostingLot: (id, payload = {}) =>
    request(`/purchase-costing/${id}/cancel`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getExpensesDashboard: (options) => request("/expenses", options),
  getLeads: (options = {}) =>
    request(
      withQuery("/leads", {
        limit: options.limit,
        search: options.search,
        status: options.status,
        department: options.department,
      }),
      options
    ),
  createLead: (payload) =>
    request("/leads", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateLead: (id, payload) =>
    request(`/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteLead: (id) =>
    request(`/leads/${id}`, {
      method: "DELETE",
    }),
  getFollowups: (leadId, options) => request(`/leads/${leadId}/followups`, options),
  createFollowup: (leadId, payload) =>
    request(`/leads/${leadId}/followups`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateFollowup: (leadId, followupId, payload) =>
    request(`/leads/${leadId}/followups/${followupId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getPayments: (leadId, options) => request(`/leads/${leadId}/payments`, options),
  createPayment: (leadId, payload) =>
    request(`/leads/${leadId}/payments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getOperationsTasks: (leadId, options) => request(`/leads/${leadId}/operations-tasks`, options),
  createOperationsTask: (leadId, payload) =>
    request(`/leads/${leadId}/operations-tasks`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateOperationsTask: (leadId, taskId, payload) =>
    request(`/leads/${leadId}/operations-tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getQuotations: (leadId, options) => request(`/leads/${leadId}/quotations`, options),
  createQuotation: (leadId, payload) =>
    request(`/leads/${leadId}/quotations`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getLeadPlumbingJobs: (leadId, options) => request(`/plumbing/lead/${leadId}`, options),
  createPlumber: (payload) =>
    request("/plumbing/plumbers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePlumber: (id, payload) =>
    request(`/plumbing/plumbers/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deletePlumber: (id) =>
    request(`/plumbing/plumbers/${id}`, {
      method: "DELETE",
    }),
  createPlumbingJob: (payload) =>
    request("/plumbing/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePlumbingJob: (id, payload) =>
    request(`/plumbing/jobs/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  addPlumbingMaterial: (jobId, payload) =>
    request(`/plumbing/jobs/${jobId}/materials`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createProject: (payload) =>
    request("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProject: (id, payload) =>
    request(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  createDispatch: (projectId, payload) =>
    request(`/projects/${projectId}/dispatches`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateDispatch: (projectId, dispatchId, payload) =>
    request(`/projects/${projectId}/dispatches/${dispatchId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  createExpense: (payload) =>
    request("/expenses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateExpense: (id, payload) =>
    request(`/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteExpense: (id) =>
    request(`/expenses/${id}`, {
      method: "DELETE",
    }),
  getInventory: (options = {}) =>
    request(
      withQuery("/inventory", { limit: options.limit, search: options.search }),
      options
    ),
  debugInventorySearch: (search, options) =>
    request(withQuery("/inventory/debug", { search }), options),
  getInventoryOptions: (options = {}) => request("/inventory/options", options),
  createProduct: (payload) =>
    request("/inventory", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProduct: (id, payload) =>
    request(`/inventory/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteProduct: (id) =>
    request(`/inventory/${id}`, {
      method: "DELETE",
    }),
  getSuppliers: (options = {}) =>
    request(
      withQuery("/suppliers", {
        limit: options.limit,
        status: options.status,
        search: options.search,
      }),
      options
    ),
  createSupplier: (payload) =>
    request("/suppliers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateSupplier: (id, payload) =>
    request(`/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getDealers: (options = {}) => request(withQuery("/dealers", { limit: options.limit }), options),
  createDealer: (payload) =>
    request("/dealers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateDealer: (id, payload) =>
    request(`/dealers/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteDealer: (id) =>
    request(`/dealers/${id}`, {
      method: "DELETE",
    }),
  createAdhesiveToken: (payload) =>
    request("/schemes/claims", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAdhesiveToken: (id, payload) =>
    request(`/schemes/claims/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getAdhesiveTokenDetail: (id) => request(`/schemes/claims/${id}`),
  verifyAdhesiveTokenClaim: (id) =>
    request(`/schemes/claims/${id}/verify`, {
      method: "PUT",
    }),
  approveAdhesiveTokenClaim: (id, payload) =>
    request(`/schemes/claims/${id}/approval`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  reopenAdhesiveTokenClaim: (id, payload) =>
    request(`/schemes/claims/${id}/reopen`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  markAdhesiveTokenClaimPaid: (id, payload) =>
    request(`/schemes/claims/${id}/payment`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteAdhesiveTokenClaim: (id) =>
    request(`/schemes/claims/${id}`, {
      method: "DELETE",
    }),
  createComplaint: (payload) =>
    request("/complaints", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateComplaint: (id, payload) =>
    request(`/complaints/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteComplaint: (id) =>
    request(`/complaints/${id}`, {
      method: "DELETE",
    }),
  createComplaintOperationsTask: (id) =>
    request(`/complaints/${id}/create-operations-task`, {
      method: "POST",
    }),
  markNotificationRead: (id) =>
    request(`/notifications/${id}/read`, {
      method: "PUT",
    }),
  getPurchases: (options = {}) =>
    request(
      withQuery("/purchases", {
        limit: options.limit,
        offset: options.offset,
        search: options.search,
        from: options.from,
        to: options.to,
        payment_status: options.payment_status,
      }),
      options
    ),
  getPurchaseProductIntelligence: (productId, options = {}) =>
    request(
      withQuery(`/purchases/product-intelligence/${productId}`, {
        current_rate: options.current_rate,
      }),
      options
    ),
  getPurchasesByTruck: (options = {}) =>
    request(
      withQuery("/purchases/by-truck", {
        truck_number: options.truck_number,
        delivery_date: options.delivery_date,
      }),
      options
    ),
  createPurchase: (payload) =>
    request("/purchases", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePurchase: (id, payload) =>
    request(`/purchases/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deletePurchase: (id) =>
    request(`/purchases/${id}`, {
      method: "DELETE",
    }),
  getUsers: (options) => request("/users", options),
  createUser: (payload) =>
    request("/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateUser: (id, payload) =>
    request(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteUser: (id) =>
    request(`/users/${id}`, {
      method: "DELETE",
    }),
};
