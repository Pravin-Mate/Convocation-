import sharp from 'sharp';
import QRCode from 'qrcode';

/**
 * Generate official MGM University Convocation ID Card Backside SVG
 * Automatically embeds the QR code matching the student's PRN
 */
export async function generateIdCardBackSvg(student) {
  const width = 640;
  const height = 1000;
  const prn = student.prn_reg_id || `ID_${student.id}`;
  const name = escapeXml(student.student_name || 'Graduate Student');
  const degree = escapeXml(student.programme_degree || '');
  const school = escapeXml(student.school_institute || 'MGM University');
  const seq = student.sequence_no || '—';
  const token = student.qr_token || `PASS_${student.id}`;
  const medal = student.award_medal ? escapeXml(student.award_medal) : '';

  // Generate crisp QR SVG
  const qrSvgRaw = await QRCode.toString(token, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
  
  // Extract pure SVG content without xml declaration and outer svg wrapper
  const qrInner = qrSvgRaw
    .replace(/<\?xml.*?\?>/g, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '');

  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="headerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fbbf24" />
        <stop offset="100%" stop-color="#d97706" />
      </linearGradient>
      <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.12"/>
      </filter>
    </defs>

    <!-- Outer Card Background (Standard CR80 Vertical Aspect Ratio) -->
    <rect x="12" y="12" width="${width - 24}" height="${height - 24}" rx="26" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    
    <!-- Gold Dashed Border & Cutting Line Guide -->
    <rect x="22" y="22" width="${width - 44}" height="${height - 44}" rx="20" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-dasharray="6,4"/>

    <!-- Lanyard Slot Punch Indicator -->
    <rect x="${width / 2 - 32}" y="32" width="64" height="12" rx="6" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>

    <!-- Header Navy Bar -->
    <rect x="36" y="58" width="${width - 72}" height="84" rx="12" fill="url(#headerGrad)"/>
    <text x="${width / 2}" y="88" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#ffffff" letter-spacing="1">MGM UNIVERSITY</text>
    <text x="${width / 2}" y="110" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#fbbf24">CONVOCATION CEREMONY 2026</text>
    <text x="${width / 2}" y="128" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#94a3b8" letter-spacing="1.5">OFFICIAL CONVOCATION ID CARD • BACKSIDE</text>

    <!-- Prominent PRN Identification Banner -->
    <rect x="52" y="156" width="${width - 104}" height="42" rx="8" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5"/>
    <text x="${width / 2}" y="183" font-family="Courier, monospace, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#92400e">PRN NO: ${prn}</text>

    <!-- High-Resolution Centered QR Code Area -->
    <rect x="${width / 2 - 135}" y="212" width="270" height="270" rx="16" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" filter="url(#cardShadow)"/>
    
    <!-- Embedded QR Graphic -->
    <g transform="translate(${width / 2 - 120}, 227) scale(0.95)">
      ${qrInner}
    </g>

    <!-- Student Credentials Box -->
    <rect x="52" y="498" width="${width - 104}" height="${medal ? 86 : 74}" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
    <text x="${width / 2}" y="524" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#0f172a">${name}</text>
    <text x="${width / 2}" y="544" font-family="Arial, Helvetica, sans-serif" font-size="12" text-anchor="middle" fill="#475569">${degree} • ${school}</text>
    <text x="${width / 2}" y="562" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#059669">STAGE SEQUENCE ORDER: #${seq}</text>
    ${medal ? `<text x="${width / 2}" y="578" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#b45309">${medal}</text>` : ''}

    <!-- Verification Instructions Box -->
    <rect x="52" y="${medal ? 594 : 582}" width="${width - 104}" height="258" rx="10" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
    <text x="72" y="${medal ? 620 : 608}" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">BACKSIDE ID CARD &amp; ENTRY PROTOCOLS:</text>
    
    <text x="72" y="${medal ? 648 : 636}" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#334155">• 1. Present this QR at Convocation Reporting Counter (Desks 01–05).</text>
    <text x="72" y="${medal ? 673 : 661}" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#334155">• 2. Attendee status will automatically turn green upon scan.</text>
    <text x="72" y="${medal ? 698 : 686}" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#334155">• 3. Marshal will re-scan this QR at Pre-Stage Ramp for sequence check.</text>
    <text x="72" y="${medal ? 723 : 711}" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#334155">• 4. Do not fold, damage, or transfer this card to any other person.</text>
    <text x="72" y="${medal ? 748 : 736}" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#334155">• 5. Valid strictly for MGM Convocation 2026 official degree conferral.</text>

    <line x1="72" y1="${medal ? 766 : 754}" x2="${width - 72}" y2="${medal ? 766 : 754}" stroke="#cbd5e1" stroke-width="1"/>
    
    <text x="72" y="${medal ? 788 : 776}" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="bold" fill="#475569">HELPDESK / LOST PASS RE-ISSUANCE:</text>
    <text x="72" y="${medal ? 806 : 794}" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#64748b">Visit Ground Floor Help Desk Counter for instant manual override / re-print.</text>
    <text x="72" y="${medal ? 824 : 812}" font-family="Courier, monospace, sans-serif" font-size="10" fill="#64748b">Verification Token: ${token}</text>

    <!-- Footer Seal & Security Band -->
    <rect x="52" y="${medal ? 862 : 850}" width="${width - 104}" height="54" rx="8" fill="url(#headerGrad)"/>
    <text x="${width / 2}" y="${medal ? 885 : 873}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#fbbf24">OFFICIAL REGISTRAR &amp; CONTROLLER OF EXAMINATIONS</text>
    <text x="${width / 2}" y="${medal ? 903 : 891}" font-family="Courier, monospace, sans-serif" font-size="10" text-anchor="middle" fill="#94a3b8">AUTOMATICALLY LINKED TO PRN: ${prn} • MGM UNIVERSITY</text>
  </svg>
  `;
}

/**
 * Generate official MGM University Convocation ID Card Frontside SVG
 */
export function generateIdCardFrontSvg(student) {
  const width = 640;
  const height = 1000;
  const prn = student.prn_reg_id || `ID_${student.id}`;
  const name = escapeXml(student.student_name || 'Graduate Student');
  const degree = escapeXml(student.programme_degree || '');
  const school = escapeXml(student.school_institute || 'MGM University');
  const spec = student.specialization ? escapeXml(student.specialization) : '';
  const seq = student.sequence_no || '—';
  const medal = student.award_medal ? escapeXml(student.award_medal) : '';

  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="headerGradFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
      <filter id="photoShadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.15"/>
      </filter>
    </defs>

    <!-- Outer Card Background -->
    <rect x="12" y="12" width="${width - 24}" height="${height - 24}" rx="26" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <rect x="22" y="22" width="${width - 44}" height="${height - 44}" rx="20" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-dasharray="6,4"/>

    <!-- Lanyard Hole Slot Marker -->
    <rect x="${width / 2 - 32}" y="32" width="64" height="12" rx="6" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>

    <!-- Header Navy Bar with University Title -->
    <rect x="36" y="58" width="${width - 72}" height="100" rx="12" fill="url(#headerGradFront)"/>
    <text x="${width / 2}" y="92" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" text-anchor="middle" fill="#ffffff" letter-spacing="1">MGM UNIVERSITY</text>
    <text x="${width / 2}" y="116" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#fbbf24">CONVOCATION CEREMONY 2026</text>
    <text x="${width / 2}" y="136" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#94a3b8" letter-spacing="1.5">OFFICIAL GRADUATE IDENTITY CARD • FRONT</text>

    <!-- Student Photo Placeholder / Box -->
    <rect x="${width / 2 - 90}" y="180" width="180" height="210" rx="14" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2" filter="url(#photoShadow)"/>
    <circle cx="${width / 2}" cy="265" r="45" fill="#cbd5e1"/>
    <path d="M ${width / 2 - 60} 370 C ${width / 2 - 60} 325, ${width / 2 + 60} 325, ${width / 2 + 60} 370 Z" fill="#94a3b8"/>
    <rect x="${width / 2 - 75}" y="360" width="150" height="20" rx="4" fill="rgba(15,23,42,0.7)"/>
    <text x="${width / 2}" y="374" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#ffffff">GRADUATE CANDIDATE</text>

    <!-- Student Name -->
    <text x="${width / 2}" y="430" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="bold" text-anchor="middle" fill="#0f172a">${name}</text>
    
    <!-- PRN Highlight Pill -->
    <rect x="${width / 2 - 140}" y="445" width="280" height="36" rx="18" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5"/>
    <text x="${width / 2}" y="469" font-family="Courier, monospace, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#92400e">PRN: ${prn}</text>

    <!-- Degree & Academic Details -->
    <rect x="52" y="500" width="${width - 104}" height="150" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
    <text x="74" y="530" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" fill="#64748b">PROGRAMME / DEGREE:</text>
    <text x="74" y="552" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="bold" fill="#0f172a">${degree}</text>

    <text x="74" y="580" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" fill="#64748b">SCHOOL / FACULTY:</text>
    <text x="74" y="600" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" fill="#334155">${school}</text>

    ${spec ? `
      <text x="74" y="624" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" fill="#64748b">SPECIALIZATION:</text>
      <text x="74" y="640" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#475569">${spec}</text>
    ` : ''}

    <!-- Stage Sequence & Honors Banner -->
    <rect x="52" y="665" width="${width - 104}" height="70" rx="12" fill="#0f172a"/>
    <text x="${width / 2}" y="695" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#d4af37">STAGE SEQUENCE #${seq}</text>
    <text x="${width / 2}" y="718" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="600" text-anchor="middle" fill="#94a3b8">OFFICIAL CEREMONIAL PROCESSION ORDER</text>

    ${medal ? `
      <rect x="52" y="748" width="${width - 104}" height="42" rx="8" fill="#fffbeb" stroke="#d97706" stroke-width="1.5"/>
      <text x="${width / 2}" y="774" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#b45309">${medal}</text>
    ` : ''}

    <!-- Security Notice & QR Reference -->
    <rect x="52" y="${medal ? 802 : 752}" width="${width - 104}" height="80" rx="10" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
    <text x="${width / 2}" y="${medal ? 828 : 778}" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#0f172a">AUTOMATED QR CODE EMBEDDED ON BACK</text>
    <text x="${width / 2}" y="${medal ? 848 : 798}" font-family="Arial, Helvetica, sans-serif" font-size="11" text-anchor="middle" fill="#475569">Turn over for Counter Attendance Scan &amp; Pre-Stage Verification.</text>
    <text x="${width / 2}" y="${medal ? 866 : 816}" font-family="Courier, monospace, sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#059669">MATCHING PRN: ${prn}</text>

    <!-- Footer Bar -->
    <rect x="52" y="${medal ? 892 : 842}" width="${width - 104}" height="54" rx="8" fill="url(#headerGradFront)"/>
    <text x="${width / 2}" y="${medal ? 915 : 865}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#fbbf24">OFFICIAL REGISTRAR &amp; CONTROLLER OF EXAMINATIONS</text>
    <text x="${width / 2}" y="${medal ? 933 : 883}" font-family="Courier, monospace, sans-serif" font-size="10" text-anchor="middle" fill="#94a3b8">MGM UNIVERSITY, CHHATRAPATI SAMBHAJINAGAR</text>
  </svg>
  `;
}

/**
 * Render ID Card Backside as PNG buffer using sharp
 */
export async function generateIdCardBackPng(student) {
  const svg = await generateIdCardBackSvg(student);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Render ID Card Frontside as PNG buffer using sharp
 */
export async function generateIdCardFrontPng(student) {
  const svg = generateIdCardFrontSvg(student);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Render a Two-Sided Combined ID Card (Front & Back side-by-side with cut/fold lines)
 */
export async function generateTwoSidedIdCardSvg(student) {
  const cardWidth = 640;
  const cardHeight = 1000;
  const gap = 40;
  const totalWidth = cardWidth * 2 + gap + 40;
  const totalHeight = cardHeight + 60;

  const frontSvg = generateIdCardFrontSvg(student);
  const backSvg = await generateIdCardBackSvg(student);

  // Extract inner elements of front and back
  const cleanFront = frontSvg
    .replace(/<\?xml.*?\?>/g, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '');

  const cleanBack = backSvg
    .replace(/<\?xml.*?\?>/g, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '');

  return `
  <svg width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f8fafc"/>
    
    <!-- Title / Instructions -->
    <text x="${totalWidth / 2}" y="24" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#475569">
      MGM UNIVERSITY CONVOCATION 2026 • OFFICIAL STUDENT ID CARD (PRN: ${student.prn_reg_id})
    </text>

    <!-- Center Fold / Cut Guide -->
    <line x1="${cardWidth + 20 + gap / 2}" y1="30" x2="${cardWidth + 20 + gap / 2}" y2="${totalHeight - 20}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="8,6"/>
    <text x="${cardWidth + 20 + gap / 2}" y="${totalHeight - 8}" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#94a3b8">
      FOLD OR CUT HERE
    </text>

    <!-- Side A: FRONT -->
    <g transform="translate(20, 30)">
      ${cleanFront}
    </g>

    <!-- Side B: BACK (With Automatic QR matching PRN) -->
    <g transform="translate(${cardWidth + 20 + gap}, 30)">
      ${cleanBack}
    </g>
  </svg>
  `;
}

export async function generateTwoSidedIdCardPng(student) {
  const svg = await generateTwoSidedIdCardSvg(student);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function escapeXml(unsafe) {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
