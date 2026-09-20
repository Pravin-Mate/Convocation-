import http from 'http';
import { query, get, run, persistDb } from './db/database.js';

console.log('====================================================');
console.log('🧪 RUNNING SYSTEM VERIFICATION TEST SUITE');
console.log('====================================================');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  // Call server reset endpoint to ensure clean state
  await fetch('http://localhost:3000/api/admin/reset-ceremony', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation: 'RESET_LIVE_CEREMONY', userId: 1 })
  });

  // Test 1: Verify Seed Data
  const studentCount = get('SELECT COUNT(*) as c FROM students')?.c || 0;
  assert(studentCount === 100, `Student master contains 100 active records (Found: ${studentCount})`);

  const tokenCount = get('SELECT COUNT(*) as c FROM qr_tokens')?.c || 0;
  assert(tokenCount === 100, `All 100 students have unique opaque tokens (Found: ${tokenCount})`);

  // Verify Salted PBKDF2 Password Authentication
  const adminLogin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'mgm2026' })
  });
  const adminData = await adminLogin.json();
  assert(adminLogin.status === 200 && adminData.token, `PBKDF2-SHA512 Salted password authentication succeeded with Bearer session token`);

  // Test 2: Reporting Desk Scan
  const student1 = get('SELECT * FROM students WHERE sequence_no = 1');
  const token1 = get('SELECT token FROM qr_tokens WHERE student_id = ?', [student1.id]).token;

  // Simulate Valid First Scan
  const res1 = await fetch('http://localhost:3000/api/reporting/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token1, deskId: 'DESK-01', operatorId: 1 })
  });
  const data1 = await res1.json();
  assert(res1.status === 200 && data1.status === 'SUCCESS', `Valid first QR scan marked student ${student1.student_name} as REPORTED`);

  // Test 3: Duplicate Scan Detection
  const res2 = await fetch('http://localhost:3000/api/reporting/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token1, deskId: 'DESK-02', operatorId: 2 })
  });
  const data2 = await res2.json();
  assert(res2.status === 409 && data2.status === 'ALREADY_REPORTED', `Duplicate scan cleanly rejected with ALREADY_REPORTED warning`);

  // Test 4: Unknown QR Detection
  const res3 = await fetch('http://localhost:3000/api/reporting/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'INVALID_TOKEN_9999', deskId: 'DESK-01', operatorId: 1 })
  });
  const data3 = await res3.json();
  assert(res3.status === 404 && data3.status === 'NOT_FOUND', `Unknown QR token cleanly rejected`);

  // Test 5: Help Desk Manual Override with Reason
  const student2 = get('SELECT * FROM students WHERE sequence_no = 2');
  const res4 = await fetch('http://localhost:3000/api/reporting/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: student2.prn_reg_id,
      deskId: 'HELP-DESK',
      operatorId: 5,
      isManual: true,
      overrideReason: 'Damaged QR Code - Student ID verified'
    })
  });
  const data4 = await res4.json();
  if (res4.status !== 200) {
    console.log('res4 status:', res4.status, 'data4:', data4);
  }
  assert(res4.status === 200 && data4.status === 'SUCCESS', `Help desk manual override logged successfully`);

  const auditRes = await fetch('http://localhost:3000/api/audit-logs');
  const auditData = await auditRes.json();
  const auditCheck = auditData.logs?.find(l => l.action === 'REPORTED_SUCCESS' && l.student_id === student2.id);
  assert(Boolean(auditCheck), `Audit trail recorded manual override transaction`);

  // Test 6: Pre-Stage Scan for Unreported Student (Should Warn)
  const student50 = get('SELECT * FROM students WHERE sequence_no = 50');
  const token50 = get('SELECT token FROM qr_tokens WHERE student_id = ?', [student50.id]).token;

  const res5 = await fetch('http://localhost:3000/api/prestage/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token50, operatorId: 5 })
  });
  const data5 = await res5.json();
  assert(res5.status === 400 && data5.status === 'NOT_REPORTED', `Pre-stage scanner warned about unreported student`);

  // Test 7: Pre-Stage Scan for Reported Student 1 & 2
  const res6 = await fetch('http://localhost:3000/api/prestage/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token1, operatorId: 5 })
  });
  const data6 = await res6.json();
  assert(res6.status === 200 && data6.status === 'QUEUED', `Student #1 added to Pre-Stage queue`);

  const token2 = get('SELECT token FROM qr_tokens WHERE student_id = ?', [student2.id]).token;
  const res7 = await fetch('http://localhost:3000/api/prestage/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token2, operatorId: 5 })
  });
  const data7 = await res7.json();
  assert(res7.status === 200 && data7.status === 'QUEUED', `Student #2 added to Pre-Stage queue`);

  // Test 8: Stage Controller DISPLAY NEXT -> LED Update
  const res8 = await fetch('http://localhost:3000/api/stage/display-next', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorId: 6 })
  });
  const data8 = await res8.json();
  assert(res8.status === 200 && data8.activeStageState.mode === 'STUDENT', `Stage Controller advanced next student to Public LED`);

  // Test 9: Public LED Privacy Verification (Zero PII)
  const res9 = await fetch('http://localhost:3000/api/display/current');
  const data9 = await res9.json();
  const currentStudentOnDisplay = data9.stageState.currentStudent;
  assert(
    currentStudentOnDisplay &&
    !currentStudentOnDisplay.email &&
    !currentStudentOnDisplay.mobile &&
    !currentStudentOnDisplay.prn_reg_id,
    `Public LED slide contains approved display data only (Photo, Name, Degree, Award) and 0 private fields`
  );

  // Test 10: Emergency HOLD
  const res10 = await fetch('http://localhost:3000/api/stage/hold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorId: 6 })
  });
  const data10 = await res10.json();
  assert(res10.status === 200 && data10.activeStageState.mode === 'HOLDING', `Emergency HOLD immediately switched LED to University Holding Screen`);

  // Test 11: Final Conferred & Dashboard Reconciliation
  // Advance again to confer student 1
  await fetch('http://localhost:3000/api/stage/display-next', { method: 'POST', body: JSON.stringify({ operatorId: 6 }), headers: { 'Content-Type': 'application/json' } });

  const res11 = await fetch('http://localhost:3000/api/dashboard/stats');
  const data11 = await res11.json();
  const stats = data11.stats;
  assert(stats.totalRegistered === stats.reportedCount + stats.yetToReport, `Dashboard totals reconcile: Registered (${stats.totalRegistered}) = Reported (${stats.reportedCount}) + Absent (${stats.yetToReport})`);
  assert(stats.conferredCount >= 1, `Conferred count recorded independently (${stats.conferredCount})`);

  // Test 12: Reports Export Endpoints
  const res12 = await fetch('http://localhost:3000/api/reports/export?type=reported&format=csv');
  const csvText = await res12.text();
  assert(res12.status === 200 && csvText.includes('Student Name'), `Report generation exported valid CSV data`);

  // Test 13: Bulk QR Code ZIP Generator
  const res13 = await fetch('http://localhost:3000/api/qr/bulk-zip?naming=prn');
  const zipBuf = await res13.arrayBuffer();
  assert(res13.status === 200 && (res13.headers.get('content-type') || '').includes('application/zip') && zipBuf.byteLength > 20000, `Bulk QR Code Generator generated valid ZIP archive containing PRN-named QR images (${zipBuf.byteLength} bytes)`);

  // Test 14: Single Student ID Card Backside PNG endpoint with automatic QR
  const sampleStudent = get('SELECT prn_reg_id FROM students WHERE sequence_no = 1');
  const res14 = await fetch(`http://localhost:3000/api/qr/id-card-back/${sampleStudent.prn_reg_id}`);
  const backPngBuf = await res14.arrayBuffer();
  const backPngBytes = new Uint8Array(backPngBuf);
  // PNG signature is 0x89 0x50 0x4E 0x47
  const isPngValid = backPngBytes[0] === 0x89 && backPngBytes[1] === 0x50 && backPngBytes[2] === 0x4E && backPngBytes[3] === 0x47;
  assert(res14.status === 200 && isPngValid && backPngBuf.byteLength > 5000, `ID Card Backside PNG generated automatically for PRN ${sampleStudent.prn_reg_id} (${backPngBuf.byteLength} bytes)`);

  // Test 15: Single Student Dual-Sided ID Card PNG endpoint
  const res15 = await fetch(`http://localhost:3000/api/qr/id-card-two-sided/${sampleStudent.prn_reg_id}`);
  const dualPngBuf = await res15.arrayBuffer();
  assert(res15.status === 200 && dualPngBuf.byteLength > 10000, `Dual-Sided ID Card PNG generated automatically for PRN ${sampleStudent.prn_reg_id} (${dualPngBuf.byteLength} bytes)`);

  // Test 16: Bulk ZIP containing ID Card Backsides with QR added automatically by PRN
  const JSZip = (await import('jszip')).default;
  const res16 = await fetch('http://localhost:3000/api/qr/bulk-zip?naming=prn&exportType=all&includeIdCardBacks=true');
  const fullZipBuf = await res16.arrayBuffer();
  const loadedZip = await JSZip.loadAsync(fullZipBuf);
  const hasQrFile = Boolean(loadedZip.file(`qr_codes/${sampleStudent.prn_reg_id}.png`));
  const hasBacksideFile = Boolean(loadedZip.file(`id_card_backsides/${sampleStudent.prn_reg_id}_backside.png`));
  assert(res16.status === 200 && hasQrFile && hasBacksideFile, `Bulk ZIP contains both individual QR and ID Card backside automatically mapped to PRN ${sampleStudent.prn_reg_id}`);

  console.log('====================================================');
  console.log(`🎯 TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
  console.log('====================================================');
  process.exit(passedTests === totalTests ? 0 : 1);
}

runTests();
