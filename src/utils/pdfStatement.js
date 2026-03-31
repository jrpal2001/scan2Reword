import PDFDocument from 'pdfkit';

const formatDateTimeIST = (value) => {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const formatDateOnly = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const formatNumber = (value, digits = 2) => Number(value || 0).toFixed(digits);
const safeText = (value) => (value === null || value === undefined || value === '' ? '-' : String(value));
const formatCurrency = (value) => `INR ${formatNumber(value, 2)}`;

const ensureSpace = (doc, neededHeight = 40) => {
  const maxY = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > maxY) {
    doc.addPage();
    return true;
  }
  return false;
};

const buildRequestedPeriodLabel = (filters = {}) => {
  const { startDate, endDate, startTime, endTime } = filters;
  const hasRange = !!(startDate || endDate || startTime || endTime);
  if (!hasRange) return 'Full transaction history';

  const fromDate = formatDateOnly(startDate) || '-';
  const toDate = formatDateOnly(endDate) || '-';
  const fromTime = startTime || '00:00';
  const toTime = endTime || '23:59';
  return `Date range: ${fromDate} to ${toDate} | Time: ${fromTime} to ${toTime}`;
};

const COLORS = {
  brand: '#0f5132',
  brandSoft: '#e8f5ee',
  heading: '#111827',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#d1d5db',
  white: '#ffffff',
};

const drawSectionTitle = (doc, title) => {
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.heading).text(title);
  doc.moveDown(0.25);
};

const drawUserDetailsBox = (doc, user = {}) => {
  const startX = doc.page.margins.left;
  const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rowGap = 2;
  const lineHeight = 12;
  const innerPad = 12;

  const leftColumn = [
    ['Name', safeText(user.fullName)],
    ['Mobile', safeText(user.mobile)],
    ['Loyalty ID', safeText(user.loyaltyId)],
    ['User Type', safeText(user.userType)],
  ];
  const rightColumn = [
    ['Email', safeText(user.email)],
    ['Status', safeText(user.status)],
    ['Registered On (IST)', formatDateTimeIST(user.createdAt)],
  ];

  const contentRows = Math.max(leftColumn.length, rightColumn.length);
  const boxHeight = innerPad * 2 + contentRows * lineHeight + (contentRows - 1) * rowGap;
  ensureSpace(doc, boxHeight + 8);

  const startY = doc.y;
  doc
    .save()
    .roundedRect(startX, startY, boxWidth, boxHeight, 6)
    .lineWidth(1)
    .strokeColor(COLORS.border)
    .fillAndStroke(COLORS.white, COLORS.border)
    .restore();

  const colWidth = (boxWidth - innerPad * 2 - 12) / 2;
  const leftX = startX + innerPad;
  const rightX = leftX + colWidth + 12;
  const baseY = startY + innerPad;

  leftColumn.forEach(([label, value], idx) => {
    const y = baseY + idx * (lineHeight + rowGap);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.muted).text(`${label}:`, leftX, y, { width: 90, lineBreak: false });
    doc.font('Helvetica').fillColor(COLORS.text).text(value, leftX + 92, y, { width: colWidth - 92, lineBreak: false });
  });

  rightColumn.forEach(([label, value], idx) => {
    const y = baseY + idx * (lineHeight + rowGap);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.muted).text(`${label}:`, rightX, y, { width: 112, lineBreak: false });
    doc.font('Helvetica').fillColor(COLORS.text).text(value, rightX + 114, y, { width: colWidth - 114, lineBreak: false });
  });

  doc.y = startY + boxHeight + 10;
};

const drawSummaryCards = (doc, summary = {}) => {
  const startX = doc.page.margins.left;
  const fullWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cardGap = 8;
  const cardWidth = (fullWidth - cardGap * 3) / 4;
  const cardHeight = 56;
  const datePanelHeight = 44;
  ensureSpace(doc, cardHeight + 10 + datePanelHeight + 12);

  const cards = [
    ['Transactions', formatNumber(summary.transactionCount, 0)],
    ['Total Amount', formatCurrency(summary.totalAmount)],
    ['Total Liters', formatNumber(summary.totalLiters, 3)],
    ['Total Points', formatNumber(summary.totalPoints, 0)],
  ];

  const y = doc.y;
  cards.forEach(([label, value], idx) => {
    const x = startX + idx * (cardWidth + cardGap);
    doc
      .save()
      .roundedRect(x, y, cardWidth, cardHeight, 6)
      .lineWidth(1)
      .strokeColor(COLORS.border)
      .fillAndStroke(COLORS.brandSoft, COLORS.border)
      .restore();
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted).text(label.toUpperCase(), x + 10, y + 10, { width: cardWidth - 20 });
    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.heading).text(value, x + 10, y + 26, { width: cardWidth - 20 });
  });

  const panelY = y + cardHeight + 10;
  doc
    .save()
    .roundedRect(startX, panelY, fullWidth, datePanelHeight, 6)
    .lineWidth(1)
    .strokeColor(COLORS.border)
    .fillAndStroke(COLORS.white, COLORS.border)
    .restore();

  const panelPadding = 10;
  const columnGap = 12;
  const columnWidth = (fullWidth - panelPadding * 2 - columnGap) / 2;
  const leftX = startX + panelPadding;
  const rightX = leftX + columnWidth + columnGap;

  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted).text('FIRST TRANSACTION (IST)', leftX, panelY + 8, { width: columnWidth });
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.heading).text(formatDateTimeIST(summary.firstTransactionAt), leftX, panelY + 21, { width: columnWidth });

  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted).text('LAST TRANSACTION (IST)', rightX, panelY + 8, { width: columnWidth });
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.heading).text(formatDateTimeIST(summary.lastTransactionAt), rightX, panelY + 21, { width: columnWidth });

  doc.y = panelY + datePanelHeight + 10;
};

const buildTransactionLines = (tx = {}) => {
  const campaignIds = Array.isArray(tx.campaignIds) && tx.campaignIds.length
    ? tx.campaignIds.map((id) => String(id)).join(', ')
    : safeText(tx.campaignId);

  const operatorLabel = tx.staffCode ? `${safeText(tx.operatorName)} (${safeText(tx.staffCode)})` : safeText(tx.operatorName);
  const liters = tx.liters === null || tx.liters === undefined ? '-' : formatNumber(tx.liters, 3);

  return [
    `Bill No: ${safeText(tx.billNumber)} | Status: ${safeText(tx.status)}`,
    `Pump: ${safeText(tx.pumpName)} (${safeText(tx.pumpCode)})`,
    `Operator: ${operatorLabel}`,
    `Fuel Type: ${safeText(tx.fuelType)} | Payment: ${safeText(tx.paymentMode)}`,
    `Amount: ${formatCurrency(tx.amount)} | Liters: ${liters} | Points Earned: ${formatNumber(tx.pointsEarned, 0)}`,
    `Vehicle ID: ${safeText(tx.vehicleId)} | Campaign IDs: ${safeText(campaignIds)}`,
    `Attachments: ${Array.isArray(tx.attachments) ? tx.attachments.length : 0} | Created: ${formatDateTimeIST(tx.createdAt)} | Updated: ${formatDateTimeIST(tx.updatedAt)}`,
  ];
};

const drawTransactionCard = (doc, tx = {}, index = 0) => {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.page.margins.left;
  const innerPad = 10;
  const lineGap = 2;
  const headerHeight = 24;
  const lines = buildTransactionLines(tx);
  const textWidth = pageWidth - innerPad * 2;

  const textHeights = lines.map((line) =>
    doc.heightOfString(line, {
      width: textWidth,
      align: 'left',
    })
  );

  const contentHeight = textHeights.reduce((sum, h) => sum + h, 0) + lineGap * (lines.length - 1);
  const cardHeight = headerHeight + innerPad * 2 + contentHeight;

  const addedPage = ensureSpace(doc, cardHeight + 8);
  if (addedPage) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.heading).text('Transactions (Continued)');
    doc.moveDown(0.3);
  }

  const startY = doc.y;
  doc
    .save()
    .roundedRect(startX, startY, pageWidth, cardHeight, 6)
    .lineWidth(1)
    .strokeColor(COLORS.border)
    .fillAndStroke(COLORS.white, COLORS.border)
    .restore();

  doc
    .save()
    .roundedRect(startX, startY, pageWidth, headerHeight, 6)
    .fill(COLORS.brandSoft)
    .restore();

  const headerText = `#${index + 1}  ${formatDateTimeIST(tx.createdAt)}  |  Bill: ${safeText(tx.billNumber)}`;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.brand).text(headerText, startX + innerPad, startY + 7, {
    width: pageWidth - innerPad * 2,
  });

  let textY = startY + headerHeight + innerPad;
  lines.forEach((line, idx) => {
    doc.fontSize(8.5).font('Helvetica').fillColor(COLORS.text).text(line, startX + innerPad, textY, { width: textWidth });
    textY += textHeights[idx] + lineGap;
  });

  doc.y = startY + cardHeight + 8;
};

const addPageNumbers = (doc) => {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(i);
    const footerX = doc.page.margins.left;
    const footerY = doc.page.height - doc.page.margins.bottom - 10;
    const footerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor(COLORS.muted)
      .text(`Page ${i + 1} of ${range.count}`, footerX, footerY, {
        width: footerWidth,
        align: 'right',
      });
  }
};

/**
 * Build user transaction statement PDF.
 * @param {Object} data
 * @param {Object} data.user
 * @param {Array} data.transactions
 * @param {Object} data.summary
 * @param {Object} data.filters
 * @returns {Promise<Buffer>}
 */
export const generateUserStatementPdf = (data = {}) =>
  new Promise((resolve, reject) => {
    const { user = {}, transactions = [], summary = {}, filters = {} } = data;
    const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const headerHeight = 82;
    const headerX = doc.page.margins.left;
    const headerY = doc.y;

    doc
      .save()
      .roundedRect(headerX, headerY, contentWidth, headerHeight, 8)
      .lineWidth(1)
      .strokeColor(COLORS.border)
      .fillAndStroke(COLORS.brandSoft, COLORS.border)
      .restore();

    doc.fontSize(20).font('Helvetica-Bold').fillColor(COLORS.brand).text('YSP Fuel Plus', headerX, headerY + 14, {
      width: contentWidth,
      align: 'center',
    });
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.heading).text('User Transaction Statement', headerX + 14, headerY + 40);
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.text).text(`Generated At (IST): ${formatDateTimeIST(new Date())}`, headerX + 14, headerY + 61);
    doc.text(`Requested Period: ${buildRequestedPeriodLabel(filters)}`, headerX + 210, headerY + 61, { width: contentWidth - 224 });

    doc.y = headerY + headerHeight + 14;

    drawSectionTitle(doc, 'User Details');
    drawUserDetailsBox(doc, user);

    drawSectionTitle(doc, 'Summary');
    drawSummaryCards(doc, summary);

    drawSectionTitle(doc, 'Transactions');
    doc.moveDown(0.2);

    if (!transactions.length) {
      doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted).text('No transactions found for the selected filter.');
      addPageNumbers(doc);
      doc.end();
      return;
    }

    transactions.forEach((tx, index) => {
      drawTransactionCard(doc, tx, index);
    });

    addPageNumbers(doc);
    doc.end();
  });
