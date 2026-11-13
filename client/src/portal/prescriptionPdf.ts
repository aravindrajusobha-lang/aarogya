import { jsPDF } from 'jspdf';

/**
 * Builds a clean A4 prescription PDF in the browser and downloads it.
 * Labels are English because jsPDF's built-in fonts cannot render Telugu/Devanagari glyphs.
 */
export function downloadPrescriptionPdf(rx: any, patientName: string): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const green: [number, number, number] = [31, 138, 76];
  const width = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFillColor(...green);
  doc.rect(0, 0, width, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE', width / 2, 7.5, { align: 'center' });

  doc.setTextColor(19, 38, 27);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Aarogya-Drishti Prescription', 14, (y += 6));
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 100, 95);
  doc.text(`Prescription ID: ${rx.prescriptionId || '-'}`, 14, (y += 6));
  doc.text(`Date: ${rx.createdAt ? new Date(rx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}`, width - 14, y, { align: 'right' });

  doc.setDrawColor(...green);
  doc.line(14, (y += 4), width - 14, y);

  const field = (label: string, value: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(110, 120, 115); doc.setFontSize(8);
    doc.text(label.toUpperCase(), x, yy);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(19, 38, 27); doc.setFontSize(11);
    doc.text(doc.splitTextToSize(value || '-', 85), x, yy + 5);
  };
  y += 8;
  field('Patient', `${patientName} (${rx.patientId || '-'})`, 14, y);
  field('Doctor', `${rx.doctorName || '-'}${rx.doctorSpecialty ? `, ${rx.doctorSpecialty}` : ''}`, width / 2 + 2, y);
  y += 14;
  field('Facility', rx.hospitalName || '-', 14, y);
  field('Follow-up', rx.followUpDate ? new Date(rx.followUpDate).toLocaleDateString('en-IN') : 'As advised', width / 2 + 2, y);
  y += 16;

  // Medicines table
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(19, 38, 27);
  doc.text('Medicines', 14, y);
  y += 4;
  const cols = [14, 78, 112, 152, 176];
  doc.setFillColor(227, 243, 232);
  doc.rect(14, y, width - 28, 8, 'F');
  doc.setFontSize(9); doc.setTextColor(23, 109, 59);
  ['Medicine', 'Dose', 'Frequency', 'Days'].forEach((h, i) => doc.text(h, cols[i] + 2, y + 5.5));
  y += 8;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(19, 38, 27);
  (rx.medicines || []).forEach((m: any, index: number) => {
    const nameLines = doc.splitTextToSize(String(m.medicineName || '-'), 60);
    const instrLines = m.instructions ? doc.splitTextToSize(`Note: ${m.instructions}`, 60) : [];
    const rowH = Math.max(8, (nameLines.length + instrLines.length) * 4.5 + 3);
    if (y + rowH > 270) { doc.addPage(); y = 20; }
    if (index % 2) { doc.setFillColor(247, 250, 248); doc.rect(14, y, width - 28, rowH, 'F'); }
    doc.setFontSize(10); doc.text(nameLines, cols[0] + 2, y + 5);
    if (instrLines.length) { doc.setFontSize(8); doc.setTextColor(110, 120, 115); doc.text(instrLines, cols[0] + 2, y + 5 + nameLines.length * 4.5); doc.setTextColor(19, 38, 27); }
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(String(m.dosage || '-'), 30), cols[1] + 2, y + 5);
    doc.text(doc.splitTextToSize(String(m.frequency || '-'), 36), cols[2] + 2, y + 5);
    doc.text(String(m.durationDays ?? '-'), cols[3] + 2, y + 5);
    y += rowH;
  });
  if (!(rx.medicines || []).length) { doc.setFontSize(10); doc.text('No medicines listed.', 16, y + 6); y += 10; }

  const tests = (rx.labTestsRecommended || []).filter(Boolean);
  if (tests.length) {
    y += 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Tests advised', 14, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    tests.forEach((test: string) => { y += 6; doc.text(`- ${test}`, 16, y); });
  }

  doc.setFontSize(8); doc.setTextColor(140, 150, 145);
  doc.text('Issued through Aarogya-Drishti (simulation). Verify with your doctor before use.', width / 2, 287, { align: 'center' });
  doc.save(`prescription-${rx.prescriptionId || 'aarogya'}.pdf`);
}
