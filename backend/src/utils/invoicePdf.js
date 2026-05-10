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
