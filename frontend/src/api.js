const API_BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "/api");
const DEFAULT_TIMEOUT_MS = 15000;

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

export function getQuotationPdfUrl(leadId, quotationId) {
  const token = localStorage.getItem("tiles-crm-token");
  return `${API_BASE_URL}/leads/${leadId}/quotations/${quotationId}/pdf?token=${encodeURIComponent(token || "")}`;
}

export function getProjectInvoicePdfUrl(projectId) {
  const token = localStorage.getItem("tiles-crm-token");
  return `${API_BASE_URL}/projects/${projectId}/invoice/pdf?token=${encodeURIComponent(token || "")}`;
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
  getSchemesDashboard: (options = {}) => request(withQuery("/schemes", { limit: options.limit, mason_limit: options.mason_limit }), options),
  getMasons: (options = {}) => request(withQuery("/schemes/masons", { limit: options.limit }), options),
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
  getExpensesDashboard: (options) => request("/expenses", options),
  getLeads: (options = {}) => request(withQuery("/leads", { limit: options.limit }), options),
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
  getInventory: (options = {}) => request(withQuery("/inventory", { limit: options.limit }), options),
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
