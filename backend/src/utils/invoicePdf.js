import PDFDocument from "pdfkit";

function formatCurrency(value) {
  return `Rs ${Number(value || 0)}`;
}

export function streamProjectInvoicePdf({ project }, res) {
  const doc = new PDFDocument({ size: "A4", margin: 42 });
  const companyName = process.env.COMPANY_NAME || "Tiles CRM Showroom";
  const companyPhone = process.env.COMPANY_PHONE || "";
  const companyAddress = process.env.COMPANY_ADDRESS || "";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=invoice-${project.project_code || project.id}.pdf`);

  doc.pipe(res);

  doc.fontSize(22).fillColor("#0B1E3C").text(companyName, { align: "center" });
  doc.fontSize(12).fillColor("#555555").text("Project Invoice", { align: "center" });
  if (companyPhone) {
    doc.text(`Contact: ${companyPhone}`, { align: "center" });
  }
  if (companyAddress) {
    doc.text(companyAddress, { align: "center" });
  }

  doc.moveDown(1.5);
  doc.fontSize(11).fillColor("#111111");
  doc.text(`Invoice Ref: ${project.project_code}`);
  doc.text(`Project: ${project.project_name}`);
  doc.text(`Customer: ${project.lead_name}`);
  doc.text(`Phone: ${project.lead_phone}`);
  doc.text(`Location: ${project.lead_location || "-"}`);
  doc.text(`Status: ${project.status}`);
  doc.text(`Generated: ${new Date().toLocaleString()}`);

  doc.moveDown();
  doc.fontSize(14).fillColor("#0B1E3C").text("Revenue Summary", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(11).fillColor("#111111");
  doc.text(`Tiles Revenue: ${formatCurrency(project.tiles_sales_revenue)}`);
  doc.text(`Plumbing Revenue: ${formatCurrency(project.plumbing_revenue)}`);
  doc.text(`Received Payment: ${formatCurrency(project.received_payment)}`);
  doc.text(`Pending Payment: ${formatCurrency(project.pending_payment)}`);

  doc.moveDown();
  doc.fontSize(14).fillColor("#0B1E3C").text("Cost and Profit", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(11).fillColor("#111111");
  doc.text(`Labour / Mistri Token Cost: ${formatCurrency(project.labour_token_cost)}`);
  doc.text(`Plumbing Material Cost: ${formatCurrency(project.plumbing_material_cost)}`);
  doc.text(`Net Profit: ${formatCurrency(project.net_profit)}`);
  doc.text(`Profit Margin: ${project.profit_margin || 0}%`);

  doc.moveDown();
  doc.fontSize(14).fillColor("#0B1E3C").text("Dispatch Summary", { underline: true });
  doc.moveDown(0.4);
  if (Array.isArray(project.dispatches) && project.dispatches.length) {
    project.dispatches.forEach((dispatch, index) => {
      doc.fontSize(10).fillColor("#111111").text(
        `${index + 1}. ${dispatch.item_name} | Qty ${dispatch.quantity} | ${dispatch.status} | ${dispatch.vehicle_number || "No vehicle"}`
      );
    });
  } else {
    doc.fontSize(10).fillColor("#666666").text("No dispatch entries recorded.");
  }

  doc.moveDown(1.5);
  doc.fontSize(10).fillColor("#666666").text("This invoice is generated from the CRM for showroom operational use.", {
    align: "center",
  });

  doc.end();
}

export function streamBillingInvoicePdf({ invoice, items, payments, type = "gst_invoice" }, res) {
  const doc = new PDFDocument({ size: "A4", margin: 38 });
  const companyName = process.env.COMPANY_NAME || "AIBA Tiles Agency";
  const companyPhone = process.env.COMPANY_PHONE || "";
  const companyAddress = process.env.COMPANY_ADDRESS || "";
  const companyGstin = process.env.COMPANY_GSTIN || "";
  const companyEmail = process.env.COMPANY_EMAIL || "";
  const isEstimate = type === "estimate";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=${isEstimate ? "estimate" : "invoice"}-${invoice.invoice_number || invoice.id}.pdf`
  );

  doc.pipe(res);

  doc.fontSize(22).fillColor("#0B1E3C").text(companyName, { align: "center" });
  doc.fontSize(12).fillColor("#555555").text(isEstimate ? "Estimate" : "GST Invoice", { align: "center" });
  if (companyPhone) {
    doc.text(`Contact: ${companyPhone}`, { align: "center" });
  }
  if (companyEmail) {
    doc.text(`Email: ${companyEmail}`, { align: "center" });
  }
  if (companyAddress) {
    doc.text(companyAddress, { align: "center" });
  }
  if (companyGstin && !isEstimate) {
    doc.text(`GSTIN: ${companyGstin}`, { align: "center" });
  }

  doc.moveDown(1.2);
  doc.fontSize(11).fillColor("#111111");
  doc.text(`${isEstimate ? "Estimate" : "Invoice"} No: ${invoice.invoice_number || "-"}`);
  doc.text(`Invoice Date: ${invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString("en-IN") : "-"}`);
  doc.text(`Customer: ${invoice.customer_name || "-"}`);
  doc.text(`Mobile: ${invoice.customer_mobile || "-"}`);
  doc.text(`Address: ${invoice.customer_address || "-"}`);
  doc.text(`Site: ${invoice.site_reference || invoice.project_name || "-"}`);
  doc.text(`Payment Status: ${invoice.payment_status || "unpaid"}`);
  doc.text(`Approval Status: ${invoice.status || "draft"}`);
  if (invoice.lead_name) {
    doc.text(`Lead Reference: ${invoice.lead_name}`);
  }

  doc.moveDown();
  doc.fontSize(14).fillColor("#0B1E3C").text("Invoice Items", { underline: true });
  doc.moveDown(0.45);
  doc.fontSize(10).fillColor("#111111");

  items.forEach((item, index) => {
    doc.text(
      `${index + 1}. ${item.product_name} | ${item.quantity} ${item.unit} x Rs ${item.rate} | Discount Rs ${item.discount} | GST ${item.gst_percent}% | Total Rs ${item.total}`
    );
  });

  doc.moveDown();
  doc.fontSize(14).fillColor("#0B1E3C").text("Summary", { underline: true });
  doc.moveDown(0.45);
  doc.fontSize(11).fillColor("#111111");
  doc.text(`Subtotal: Rs ${invoice.subtotal || 0}`);
  doc.text(`Discount: Rs ${invoice.total_discount || 0}`);
  doc.text(`GST: Rs ${invoice.gst_amount || 0}`);
  doc.text(`Transport: Rs ${invoice.transport_charge || 0}`);
  doc.text(`Additional Charge: Rs ${invoice.additional_charge || 0}`);
  doc.text(`Grand Total: Rs ${invoice.grand_total || 0}`);
  doc.text(`Received: Rs ${invoice.received_amount || 0}`);
  doc.text(`Remaining: Rs ${invoice.remaining_amount || 0}`);

  doc.moveDown();
  doc.fontSize(14).fillColor("#0B1E3C").text("Payment Ledger", { underline: true });
  doc.moveDown(0.45);
  if (Array.isArray(payments) && payments.length) {
    payments.forEach((payment, index) => {
      doc.fontSize(10).fillColor("#111111").text(
        `${index + 1}. Rs ${payment.amount} | ${payment.payment_mode} | ${payment.received_by_name || "CRM User"} | ${new Date(payment.received_at).toLocaleString("en-IN")}`
      );
    });
  } else {
    doc.fontSize(10).fillColor("#666666").text("No payments recorded yet.");
  }

  if (invoice.notes) {
    doc.moveDown();
    doc.fontSize(12).fillColor("#0B1E3C").text("Notes", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#111111").text(invoice.notes);
  }

  doc.moveDown(1.2);
  doc.fontSize(10).fillColor("#666666").text(
    `Generated from ${companyName} CRM. This document is optimized for A4 print and WhatsApp sharing.`,
    { align: "center" }
  );

  doc.end();
}
