// ═══════════════════════════════════════════════════
//  College Buddy — common.js
//  Include this in every HTML page via:
//    <script src="../common.js"></script>
// ═══════════════════════════════════════════════════

// ── CONFIG ──────────────────────────────────────────
// const SHEET_URL = 'https://script.google.com/macros/s/AKfycbxWhNlrltWhCdgXIYivMvSY1vbwhQCAiN9cKaHihZNOfYM29_TVilI1lJn9WQMW4ZU/exec'; // ← old file
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyVbZe-9YCRT_JTgnJGPfraAjGQC2Oyzv38M8TDtHbE6rnx1QnfYz0gNCoFj4JgQoK-CQ/exec'; // ← replace

const BASE_URL = "https://collegebuddy7.github.io/neo";
// ── SCORING ─────────────────────────────────────────
const PTS_FAST   = 15;
const PTS_MEDIUM = 10;
const PTS_SLOW   =  7;
const PTS_WRONG  = -3;
const FAST_SEC   =  5;
const MEDIUM_SEC = 15;

const COLLEGES = [
  "A.B.S. College, Lalganj","B.M.D. College, Dayalpur","CN College, Sahebganj",
 "B.M.D. College, Dayalpur",
  "CN College, Sahebganj",
  "Dr. R.M.L.S. College, Muzaffarpur",
  "Indu Devi Ranjeet Kumar Prakash",
  "J.L. College, Hajipur",
  "J.L.N.M. College, Ghorasahan",
  "L.N.T. College, Muzaffarpur",
  "L.N. College, Bhagwanpur",
  "L.N.D. College, Motihari",
  "L.S. College, Muzaffarpur",
  "M.S.M. Samata College, Jandah",
  "M.S.S.G. College, Areraj",
  "M.D.D.M. College, Muzaffarpur",
  "M.J.K. College, Bettiah",
  "M.P.S. Sc. College, Muzaffarpur",
  "M.S. College, Motihari",
  "Nitishwar College, Muzaffarpur",
  "Ranjeet Kumar Prakash",
  "R.D.S. College, Muzaffarpur",
  "R.L.S.Y. College, Bettiah",
  "R.N. College, Hajipur",
  "R.S.S.M. College, Sitamarhi",
  "R.S.S. Sc. College, Sitamarhi",
  "Rameshwar Mahavidyalaya, Muzaffarpur",
  "S.R.A.P. College, Barachakia",
  "S.L.K. College, Sitamarhi",
  "S.N.S. College, Motihari",
  "S.R.K.G. College, Sitamarhi",
  "T. P. Verma College, Narkatiyaganj",
  "Umesh Kumar Ranjeet Vidayalya",
  "Vaishali Institute of Business and Rural Management, Muzaffarpur","Other"
];

// ── SESSION ──────────────────────────────────────────
const LS_USER = 'cb_user_v3';

function getUser()       { try { return JSON.parse(localStorage.getItem(LS_USER)); } catch(_){ return null; } }
function saveUser(u)     { localStorage.setItem(LS_USER, JSON.stringify(u)); }
function clearUser()     { localStorage.removeItem(LS_USER); }
function requireAuth(redirectTo) {
  const u = getUser();
  if (!u) { window.location.href = (redirectTo || '../login/') + '?next=' + encodeURIComponent(window.location.href); }
  return u;
}

// ── API HELPERS ──────────────────────────────────────
async function apiGet(params) {
  const qs  = new URLSearchParams(params).toString();
  const res = await fetch(SHEET_URL + '?' + qs);
  return res.json();
}
async function apiPost(body) {
  const res = await fetch(SHEET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}
// fire-and-forget (no-cors, for quiz submission)
function apiPostNC(body) {
  fetch(SHEET_URL, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

// ── TOAST ─────────────────────────────────────────────
function showToast(msg, type = 'default') {
  let el = document.getElementById('__cb_toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '__cb_toast';
    el.style.cssText = `position:fixed;bottom:5.5rem;left:50%;transform:translateX(-50%);
      padding:.52rem 1.15rem;border-radius:99px;font-family:'Poppins',sans-serif;
      font-size:.77rem;font-weight:600;z-index:9999;opacity:0;transition:opacity .2s;
      pointer-events:none;white-space:nowrap;max-width:90vw;text-overflow:ellipsis;overflow:hidden;`;
    document.body.appendChild(el);
  }
  const colors = { default:'#1e293b', success:'#14532d', error:'#7f1d1d', warn:'#78350f' };
  el.style.background = colors[type] || colors.default;
  el.style.color = '#fff';
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2800);
}

// ── UTILS ────────────────────────────────────────────
function esc(s)   { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function enc(s)   { return encodeURIComponent(s); }
function now()    { return new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}); }
function todayStr(){ return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}); }

function getTimePts(seconds) {
  if (seconds < FAST_SEC)   return PTS_FAST;
  if (seconds < MEDIUM_SEC) return PTS_MEDIUM;
  return PTS_SLOW;
}

// ── AI CHAT SYSTEM PROMPT ─────────────────────────────
const AI_SYSTEM_PROMPT = `You are "My Buddy", a friendly AI study companion for college students in Bihar, India.

CRITICAL LANGUAGE RULE:
- Detect the language of the user's message
- If Hindi (Devanagari or Roman Hindi) → reply ONLY in Hindi/Hinglish. Do NOT add English translation.
- If English → reply ONLY in English. Do NOT add Hindi translation.
- If Hinglish → reply ONLY in Hinglish. Do NOT add English translation in brackets.
- NEVER write the same thing in two languages. Pick one and stick to it.

Personality:
- Warm, encouraging, like a smart senior/dost
- Expert in college subjects: DSA, Programming, OS, DBMS, Networks, Math etc.
- Concise and clear responses with helpful examples
- Use emojis naturally, not excessively
- Address the student by their first name occasionally`;