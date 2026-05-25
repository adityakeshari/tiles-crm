import PDFDocument from "pdfkit";

export function streamQuotationPdf({ lead, quotation, items }, res) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const companyName = process.env.COMPANY_NAME || "Tiles CRM Showroom";
  const companyPhone = process.env.COMPANY_PHONE || "";
  const companyAddress = process.env.COMPANY_ADDRESS || "";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=quotation-${quotation.id}.pdf`
  );

  doc.pipe(res);

  doc.fontSize(24).fillColor("#0B1E3C").text(companyName, { align: "center" });
  doc.fontSize(12).fillColor("#555555").text("Tiles Showroom Quotation", { align: "center" });
  if (companyPhone) {
    doc.text(`Contact: ${companyPhone}`, { align: "center" });
  }
  if (companyAddress) {
    doc.text(companyAddress, { align: "center" });
  }
  doc.moveDown();
  doc.fontSize(11).text(`Quotation ID: ${quotation.id}`);
  doc.text(`Customer: ${lead.name}`);
  doc.text(`Phone: ${lead.phone}`);
  doc.text(`Location: ${lead.location || "-"}`);
  doc.text(`Requirement: ${lead.requirement || "-"}`);
  doc.text(`Created: ${new Date(quotation.created_at).toLocaleString()}`);
  doc.moveDown();

  doc.fontSize(14).text("Items", { underline: true });
  doc.moveDown(0.5);

  items.forEach((item, index) => {
    doc
      .fontSize(11)
      .text(
        `${index + 1}. ${item.product_name} | ${item.tile_size || "Standard"} | ${item.quantity_sqft} sqft x Rs ${item.unit_price} = Rs ${item.amount}`
      );
  });

  doc.moveDown();
  doc.fontSize(14).text("Summary", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Subtotal: Rs ${quotation.subtotal}`);
  doc.text(`Discount: Rs ${quotation.discount}`);
  doc.text(`Transport: Rs ${quotation.transport_cost}`);
  doc.text(`Final Amount: Rs ${quotation.final_amount}`);
  doc.text(`Status: ${quotation.status}`);
  doc.moveDown(0.4);
  doc
    .fontSize(10)
    .fillColor("#B45309")
    .text("Quotation valid only for today. Rates may change from next day.");

  doc.moveDown(2);
  doc
    .fontSize(10)
    .fillColor("#555555")
    .text("Thank you for choosing our showroom. This layout is optimized for print and sharing.", { align: "center" });

  doc.end();
}
