/**
 * Expected Salary Slip PDF generator.
 * Uses the reusable pdfBuilder utility to produce a professional salary slip.
 */
import {
  createPdfDocument,
  drawBanner,
  drawSubtitle,
  drawDivider,
  drawSectionHeading,
  drawKeyValuePairs,
  drawTable,
  drawTotalRow,
  drawFooter,
  pipePdfToResponse,
} from "../../utils/pdfBuilder.js";

const formatCurrency = (amount) => {
  return `PKR ${Number(amount || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Generates and streams an Expected Salary Slip PDF to the response.
 *
 * @param {Object} res       - Express response object
 * @param {Object} slipData  - The salary calculation data
 * @param {Object} slipData.employee   - { id, name, designation }
 * @param {Object} slipData.calculation - { start_date, end_date, present_days, leave_days, ... }
 * @param {Number} slipData.basicSalary - Employee's basic salary
 * @param {Number} slipData.dailySalary - basicSalary / 23
 */
export const generateExpectedSalarySlipPdf = (res, slipData) => {
  const { employee, calculation, basicSalary, dailySalary } = slipData;
  const doc = createPdfDocument();

  let y = doc.page.margins.top;

  // ── Company Banner ──
  y = drawBanner(doc, {
    text: "Pay Slip",
    y,
    fontSize: 20,
    height: 50,
  });

  y += 10;

  y = drawSubtitle(doc, {
    text: `Period: ${calculation.start_date}  to  ${calculation.end_date}`,
    y,
    fontSize: 10,
  });

  y = drawDivider(doc, y);

  // ── Employee Details Section ──
  y = drawSectionHeading(doc, { text: "Employee Information", y });

  y = drawKeyValuePairs(doc, [
    { label: "Employee ID", value: employee.id },
    { label: "Employee Name", value: employee.name || "N/A" },
    { label: "Designation", value: employee.designation || "N/A" },
    { label: "Basic Salary", value: formatCurrency(basicSalary) },
    { label: "Daily Salary (÷23)", value: formatCurrency(dailySalary) },
  ], { y });

  y += 5;
  y = drawDivider(doc, y);

  // ── Attendance Summary Section ──
  y = drawSectionHeading(doc, { text: "Attendance Summary", y });

  const attendanceHeaders = [
    { label: "Description", width: 280, align: "left" },
    { label: "Days / Hours", width: 110, align: "center" },
    { label: "Amount (PKR)", width: 110, align: "right" },
  ];

  const attendanceRows = [
    ["Present Days", String(calculation.present_days), formatCurrency(calculation.expected_attendance_salary)],
    ["Leave Days (Paid)", String(calculation.leave_days), "Included Above"],
  ];

  y = drawTable(doc, attendanceHeaders, attendanceRows, { y });

  y += 5;
  y = drawDivider(doc, y);

  // ── Overtime Summary Section ──
  y = drawSectionHeading(doc, { text: "Overtime Summary", y });

  const overtimeHeaders = [
    { label: "Description", width: 280, align: "left" },
    { label: "Value", width: 110, align: "center" },
    { label: "Amount (PKR)", width: 110, align: "right" },
  ];

  const overtimeRows = [
    [
      "Total Overtime",
      `${calculation.total_overtime_hours} hrs (${calculation.total_overtime_minutes} min)`,
      formatCurrency(calculation.expected_overtime_salary),
    ],
  ];

  y = drawTable(doc, overtimeHeaders, overtimeRows, { y });

  y += 5;
  y = drawDivider(doc, y);

  // ── Earnings Breakdown Section ──
  y = drawSectionHeading(doc, { text: "Earnings Breakdown", y });

  const earningsHeaders = [
    { label: "Component", width: 350, align: "left" },
    { label: "Amount (PKR)", width: 150, align: "right" },
  ];

  const earningsRows = [
    ["Attendance Salary", formatCurrency(calculation.expected_attendance_salary)],
    ["Overtime Salary", formatCurrency(calculation.expected_overtime_salary)],
  ];

  y = drawTable(doc, earningsHeaders, earningsRows, { y });

  y += 5;

  // ── Grand Total ──
  y = drawTotalRow(doc, {
    label: "Expected Net Salary",
    value: formatCurrency(calculation.expected_net_salary),
    y,
    fontSize: 14,
  });

  // ── Footer ──
  const now = new Date();
  const generatedAt = now.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });
  drawFooter(doc, { generatedAt });

  // ── Stream to response ──
  const filename = `expected_salary_${employee.id}_${calculation.start_date}_${calculation.end_date}.pdf`;
  pipePdfToResponse(doc, res, filename);
};
