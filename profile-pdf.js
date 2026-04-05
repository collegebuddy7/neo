// ═══════════════════════════════════════════════
//  College Buddy — profile-pdf.js
//  Generates a downloadable profile card PDF.
//
//  Dependencies (loaded via CDN in dashboard):
//    html2canvas  → https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
//    jsPDF        → https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
//    QRCode       → https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js
//
//  Usage (from dashboard.js):
//    await generateProfilePDF(user);
// ═══════════════════════════════════════════════

async function generateProfilePDF(user) {
  // Load CDN scripts if not already loaded
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', 'QRCode');

  // Build the card DOM (off-screen)
  const card = buildCardElement(user);
  document.body.appendChild(card);

  // Render QR code inside the card
  const refLink = window.location.origin + '/login/?ref=' + (user.refCode || '').toUpperCase();
  await renderQR(card.querySelector('#pdf-qr'), refLink);

  // Wait a tick for fonts / QR to paint
  await sleep(300);

  try {
    const canvas = await html2canvas(card, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#1b3a5c',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;

    // Card size: 90 × 140 mm (like a big business card)
    const pdf = new jsPDF({ unit: 'mm', format: [90, 140], orientation: 'portrait' });
    pdf.addImage(imgData, 'PNG', 0, 0, 90, 140);
    pdf.save('CollegeBuddy_' + (user.name || 'Profile').replace(/\s+/g, '_') + '.pdf');
  } finally {
    document.body.removeChild(card);
  }
}

// ── Build the visual card element ────────────────
function buildCardElement(u) {
  const wrap = document.createElement('div');
  wrap.id = 'pdf-card-wrap';
  wrap.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 360px;
    background: linear-gradient(160deg, #1b3a5c 0%, #254e7a 45%, #1a5e38 100%);
    border-radius: 20px;
    overflow: hidden;
    font-family: 'Sora', 'Nunito', sans-serif;
    color: #fff;
    padding: 0;
    z-index: -1;
  `;

  const initials = (u.name || 'S').charAt(0).toUpperCase();
  const statsRows = [
    { label: 'Total Score',      value: u.totalScore      || 0 },
    { label: 'Classes Attended', value: u.classesAttended || 0 },
    { label: 'Quizzes Played',   value: u.quizPlayed      || 0 },
    { label: 'Login Streak',     value: (u.loginStreak    || 1) + ' day' + ((u.loginStreak||1) > 1 ? 's' : '') },
    { label: 'Referrals',        value: u.refCount        || 0 },
  ];

  const statsHtml = statsRows.map(s => `
    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08);">
      <span style="font-size:11px;color:rgba(255,255,255,.6);font-weight:600;">${s.label}</span>
      <span style="font-size:13px;font-weight:800;color:#f5a623;">${s.value}</span>
    </div>`).join('');

  wrap.innerHTML = `
    <!-- Header stripe -->
    <div style="background:rgba(0,0,0,.18);padding:18px 20px 16px;display:flex;align-items:center;gap:14px;">
      <div style="width:54px;height:54px;border-radius:50%;
                  background:linear-gradient(135deg,#52a823,#3d8019);
                  display:flex;align-items:center;justify-content:center;
                  font-size:22px;font-weight:800;color:#fff;flex-shrink:0;
                  box-shadow:0 4px 14px rgba(82,168,35,.5);">
        ${initials}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:16px;font-weight:800;color:#fff;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${escPDF(u.name || 'Student')}
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,.55);margin-top:3px;">
          ${escPDF(u.degree || '')} · Sem ${escPDF(u.semester || '—')}
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,.45);margin-top:2px;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${escPDF(u.college || '')}
        </div>
      </div>
      <!-- CB Logo placeholder -->
      <div style="font-size:22px;flex-shrink:0;">🎓</div>
    </div>

    <!-- Body -->
    <div style="padding:14px 20px;">

      <!-- Stats -->
      <div style="margin-bottom:14px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;
                    letter-spacing:.06em;color:rgba(255,255,255,.4);margin-bottom:4px;">
          My Stats
        </div>
        ${statsHtml}
      </div>

      <!-- Referral code + QR row -->
      <div style="background:rgba(255,255,255,.07);border-radius:12px;
                  padding:12px 14px;display:flex;align-items:center;gap:14px;">
        <div style="flex:1;">
          <div style="font-size:9px;color:rgba(255,255,255,.45);font-weight:600;
                      text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">
            My Referral Code
          </div>
          <div style="font-size:20px;font-weight:800;color:#f5a623;letter-spacing:.1em;">
            ${escPDF((u.refCode || '').toUpperCase())}
          </div>
          <div style="font-size:9px;color:rgba(255,255,255,.4);margin-top:4px;">
            Scan QR or use code to join →
          </div>
        </div>
        <!-- QR code renders here -->
        <div id="pdf-qr" style="background:#fff;border-radius:8px;padding:6px;
                                  width:64px;height:64px;flex-shrink:0;"></div>
      </div>

      <!-- Footer branding -->
      <div style="margin-top:14px;text-align:center;border-top:1px solid rgba(255,255,255,.08);padding-top:10px;">
        <div style="font-size:12px;font-weight:800;color:rgba(255,255,255,.7);">College Buddy</div>
        <div style="font-size:9px;color:rgba(255,255,255,.35);margin-top:2px;">
          Bihar ka Education Platform · collegebuddy.in
        </div>
      </div>
    </div>`;

  return wrap;
}

// ── Render QR code into element ──────────────────
function renderQR(el, text) {
  return new Promise((resolve) => {
    if (!el) { resolve(); return; }
    try {
      new QRCode(el, {
        text:          text,
        width:         52,
        height:        52,
        colorDark:     '#1b3a5c',
        colorLight:    '#ffffff',
        correctLevel:  QRCode.CorrectLevel.M,
      });
      setTimeout(resolve, 200); // give QR time to paint
    } catch(_) {
      resolve();
    }
  });
}

// ── Load script helper (idempotent) ─────────────
function loadScript(src, globalCheck) {
  return new Promise((resolve, reject) => {
    if (window[globalCheck]) { resolve(); return; }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── Sleep helper ─────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Safe HTML escape for inline strings ──────────
function escPDF(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}