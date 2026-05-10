const API_BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "/api");

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

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getHeaders(options.includeAuth !== false),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
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
  login: (payload) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
      includeAuth: false,
    }),
  seedAdmin: (payload) =>
    request("/auth/seed-admin", {
      method: "POST",
      body: JSON.stringify(payload),
      includeAuth: false,
    }),
  getStats: () => request("/leads/dashboard/stats"),
  getFollowupBoard: () => request("/leads/dashboard/followups"),
  getOperationsBoard: () => request("/leads/dashboard/operations"),
  getSchemesDashboard: () => request("/schemes"),
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
  getComplaintsDashboard: () => request("/complaints"),
  getNotifications: () => request("/notifications"),
  getPlumbingDashboard: () => request("/plumbing"),
  getProjectsDashboard: () => request("/projects"),
  getExpensesDashboard: () => request("/expenses"),
  getLeads: () => request("/leads"),
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
  getFollowups: (leadId) => request(`/leads/${leadId}/followups`),
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
  getPayments: (leadId) => request(`/leads/${leadId}/payments`),
  createPayment: (leadId, payload) =>
    request(`/leads/${leadId}/payments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getOperationsTasks: (leadId) => request(`/leads/${leadId}/operations-tasks`),
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
  getQuotations: (leadId) => request(`/leads/${leadId}/quotations`),
  createQuotation: (leadId, payload) =>
    request(`/leads/${leadId}/quotations`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getLeadPlumbingJobs: (leadId) => request(`/plumbing/lead/${leadId}`),
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
  getInventory: () => request("/inventory"),
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
  getDealers: () => request("/dealers"),
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
  getUsers: () => request("/users"),
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
