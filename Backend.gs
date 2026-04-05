// ════════════════════════════════════════════════════════════════
//  College Buddy – Unified Backend v6
//  Google Apps Script
//
//  CHANGES FROM v5:
//  ─────────────────────
//  1. Users → col P: IsActive (blank/TRUE = ok, FALSE = blocked)
//             col Q: PaidFor  (blank = Free | "BCA-1" = paid)
//  2. Classes → col N: ClassId   col O: Access (Paid/blank)
//               col P: ClassDone  col Q: RecordingDone
//               col R: NotesDone  col S: QuizDone
//  3. AllQuiz → col H: Access (Paid/blank)
//  4. New sheet: Courses  (Id,Name,Semester,Degree,ImageLink,EnrollLink,Price,ButtonText)
//  5. New sheet: AttendanceLogs
//     (Timestamp,Mobile,Name,Semester,ClassId,Type,Value,AdminVerified)
//  6. New actions: markAttendance, getCourses, getAttendanceSummary
//  7. loginUser / getProfile → isActive check, isPaid, paidFor
//  8. getClasses → returns classId, access, per-user attendance booleans
//  9. getAllQuizzes → returns access field
//
//  SHEET COLUMN REFERENCE:
//  ────────────────────────
//  USERS:   A:RegisteredAt  B:Name  C:College  D:Semester  E:Email
//           F:Mobile  G:PasswordHash  H:TotalScore  I:TotalClassAttended
//           J:TotalQuizPlayed  K:LoginStreak  L:LastLoginDate
//           M:Degree  N:ReferralCode  O:Referred
//           P:IsActive  Q:PaidFor
//
//  CLASSES: A:Title  B:TeacherName  C:DateTime  D:Description
//           E:JoinLink  F:RecordingLink  G:Semester  H:Status
//           I:Notes  J:Subject  K:Degree  L:QuizLink  M:ImageLink
//           N:ClassId  O:Access  P:ClassDone  Q:RecordingDone
//           R:NotesDone  S:QuizDone
//
//  ALLQUIZ: A:Title  B:Semester  C:TotalPlays  D:Path
//           E:Description  F:Subject  G:Degree  H:Access
//
//  COURSES: A:Id  B:Name  C:Semester  D:Degree  E:ImageLink
//           F:EnrollLink  G:Price  H:ButtonText
//
//  ATTENDANCELOGS: A:Timestamp  B:Mobile  C:Name  D:Semester
//                  E:ClassId  F:Type  G:Value  H:AdminVerified
// ════════════════════════════════════════════════════════════════

const AI_API_KEY = "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";

// ── SHEET NAMES ──────────────────────────────────────────────────
const USERS_SHEET          = 'Users';
const CHAT_HIST_SHEET      = 'AI Chat History';
const CLASSES_SHEET        = 'Classes';
const ALL_QUIZ_SHEET       = 'AllQuiz';
const COURSES_SHEET        = 'Courses';
const ATTENDANCE_LOG_SHEET = 'AttendanceLogs';

// ── USERS COLUMNS ────────────────────────────────────────────────
const U = {
  TS:1, NAME:2, COLLEGE:3, SEMESTER:4, EMAIL:5, MOBILE:6,
  PASS:7, TOTAL_SCORE:8, CLASSES_ATT:9, QUIZ_PLAYED:10,
  LOGIN_STREAK:11, LAST_LOGIN:12,
  DEGREE:13,
  REF_CODE:14,
  REFERRED:15,
  IS_ACTIVE:16,   // blank/TRUE = active | FALSE = blocked
  PAID_FOR:17     // blank = Free | "BCA-1" = paid for BCA sem 1
};

const USERS_HEADER = [
  'Registered At','Name','College','Semester','Email','Mobile',
  'Password (hashed)','Total Score','Classes Attended',
  'Quizzes Played','Login Streak','Last Login Date',
  'Degree','ReferralCode','Referred',
  'IsActive','PaidFor'
];

// ── QUIZ SHEET COLUMNS ───────────────────────────────────────────
const Q = {
  TS:1, NAME:2, MOBILE:3, COLLEGE:4, SEMESTER:5,
  SCORE:6, CORRECT:7, WRONG:8, NEGATIVE:9, TOTAL:10,
  ATTENDED:11, FEEDBACK:12, ANSWERS:13
};
const QUIZ_HEADER = [
  'Timestamp','Name','Mobile','College','Semester',
  'Score','Correct','Wrong','Negative Pts','Total Questions',
  'Attended Class','Feedback','Answers (JSON)'
];

// ── AI CHAT HISTORY COLUMNS ──────────────────────────────────────
const CH = { TS:1, MOBILE:2, NAME:3, MSG:4 };
const CHAT_HEADER = ['Timestamp','Mobile','Name','Message'];

// ── CLASSES COLUMNS ──────────────────────────────────────────────
const CL = {
  TITLE:1, TEACHER:2, DATETIME:3, DESC:4, LINK:5, REC:6,
  SEM:7, STATUS:8, NOTES:9, SUBJECT:10, DEGREE:11,
  QUIZLINK:12, IMAGE:13,
  CLASS_ID:14,       // unique ID e.g. CLS001
  ACCESS:15,         // "Paid" or blank = Free
  CLASS_DONE:16,     // comma-separated mobiles
  REC_DONE:17,       // comma-separated mobiles
  NOTES_DONE:18,     // comma-separated mobiles
  QUIZ_DONE:19       // comma-separated mobiles
};

const CLASSES_HEADER = [
  'Title','TeacherName','DateTime','Description','JoinLink','RecordingLink',
  'Semester','Status','Notes','Subject','Degree','QuizLink','ImageLink',
  'ClassId','Access','ClassDone','RecordingDone','NotesDone','QuizDone'
];

// ── ALLQUIZ COLUMNS ──────────────────────────────────────────────
const AQ = {
  TITLE:1, SEM:2, PLAYS:3, PATH:4, DESC:5,
  SUBJECT:6, DEGREE:7,
  ACCESS:8   // "Paid" or blank = Free
};

// ── COURSES COLUMNS ──────────────────────────────────────────────
const CR = {
  ID:1, NAME:2, SEM:3, DEGREE:4, IMAGE:5,
  ENROLL:6, PRICE:7, BTN_TEXT:8
};
const COURSES_HEADER = [
  'Id','Name','Semester','Degree','ImageLink',
  'EnrollLink','Price','ButtonText'
];

// ── ATTENDANCE LOG COLUMNS ────────────────────────────────────────
const AL = {
  TS:1, MOBILE:2, NAME:3, SEMESTER:4,
  CLASS_ID:5, TYPE:6, VALUE:7, ADMIN_VERIFIED:8
};
const ATTENDANCE_HEADER = [
  'Timestamp','Mobile','Name','Semester',
  'ClassId','Type','Value','AdminVerified'
];


// ════════════════════════════════════════════════════════════════
//  doPost
// ════════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    switch (data.action) {
      case 'registerUser':    return registerUser(data);
      case 'submitQuiz':      return submitQuiz(data);
      case 'logChat':         return logChatMessage(data);
      case 'aiChat':          return handleAiChatPost(data);
      case 'markAttendance':  return markAttendance(data);
      default:                return jsonRes({ status:'error', message:'Unknown action: ' + data.action });
    }
  } catch (err) {
    return jsonRes({ status:'error', message: err.message });
  }
}

// ════════════════════════════════════════════════════════════════
//  doGet
// ════════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    const p = e.parameter;
    switch (p.action) {
      case 'registerUser':          return registerUser(p);
      case 'loginUser':             return loginUser(p.mobile, p.password);
      case 'checkSubmission':       return checkSubmission(p.quiz, p.mobile);
      case 'getLeaderboard':        return getLeaderboard(p.quiz);
      case 'getClasses':            return getClasses(p.semester, p.degree, p.mobile);
      case 'getAllQuizzes':          return getAllQuizzes(p.semester, p.degree);
      case 'getProfile':            return getProfile(p.mobile);
      case 'aiChat':                return handleAiChatGet(p.messages);
      case 'getAllTimeLeaderboard':  return getAllTimeLeaderboard(p.mobile);
      case 'getCourses':            return getCourses(p.semester, p.degree);
      case 'getAttendanceSummary':  return getAttendanceSummary(p.mobile, p.semester, p.degree);
      default:                      return jsonRes({ status:'error', message:'Unknown action: ' + p.action });
    }
  } catch (err) {
    return jsonRes({ status:'error', message: err.message });
  }
}


// ════════════════════════════════════════════════════════════════
//  PAID ACCESS HELPER
//  Checks if user is paid for a given degree+semester combo.
//  paidFor format: "BCA-1" or comma-separated "BCA-1,BCA-2"
// ════════════════════════════════════════════════════════════════
function isPaidUser(paidFor, degree, semester) {
  if (!paidFor || String(paidFor).trim() === '') return false;
  const key    = (String(degree).trim() + '-' + String(semester).trim()).toLowerCase();
  const tokens = String(paidFor).split(',').map(x => x.trim().toLowerCase());
  return tokens.includes(key);
}


// ════════════════════════════════════════════════════════════════
//  GENERATE REFERRAL CODE
// ════════════════════════════════════════════════════════════════
function generateRefCode(sheet) {
  const existingCodes = new Set();
  if (sheet.getLastRow() >= 2) {
    const codes = sheet.getRange(2, U.REF_CODE, sheet.getLastRow() - 1, 1).getValues();
    codes.forEach(r => existingCodes.add(String(r[0]).trim().toLowerCase()));
  }
  let code, attempts = 0;
  do {
    const rand = Math.floor(Math.random() * 0xFFFFFF);
    code = rand.toString(16).padStart(6, '0');
    if (++attempts > 1000) break;
  } while (existingCodes.has(code));
  return code;
}


// ════════════════════════════════════════════════════════════════
//  REGISTER USER
// ════════════════════════════════════════════════════════════════
function registerUser(data) {
  const mobile = String(data.mobile   || '').trim();
  const name   = String(data.name     || '').trim();
  const pass   = String(data.password || '').trim();
  const degree = String(data.degree   || '').trim();

  if (!mobile || !name || !pass)
    return jsonRes({ status:'error', message:'Required fields missing' });

  const sheet = getOrCreateSheet(USERS_SHEET, USERS_HEADER, '#1b3a5c');

  if (userExistsByMobile(sheet, mobile))
    return jsonRes({ status:'error', message:'Yeh number already registered hai. Login karein!' });

  const refCode = generateRefCode(sheet);
  const refBy   = String(data.ref || '').trim().toLowerCase();
  if (refBy) addReferral(sheet, refBy, mobile);

  sheet.appendRow([
    data.timestamp || now(),
    name,
    data.college  || '',
    data.semester || '',
    data.email    || '',
    mobile,
    hashString(pass),
    0, 0, 0, 1,
    todayStr(),
    degree,
    refCode,
    '',     // Referred
    true,   // IsActive — new users active by default
    '',     // PaidFor  — empty = Free
  ]);

  return jsonRes({
    status: 'ok',
    user: { name, college: data.college, semester: data.semester, degree, mobile, refCode }
  });
}

// ── Add referral ─────────────────────────────────────────────────
function addReferral(sheet, refCodeInput, newMobile) {
  const normalized = refCodeInput.toLowerCase().trim();
  if (!normalized) return;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const stored = String(rows[i][U.REF_CODE - 1] || '').toLowerCase().trim();
    if (stored !== normalized) continue;
    const existing = String(rows[i][U.REFERRED - 1] || '').trim();
    const list     = existing ? existing.split(',').map(x => x.trim()).filter(Boolean) : [];
    if (!list.includes(newMobile)) {
      list.push(newMobile);
      sheet.getRange(i + 1, U.REFERRED).setValue(list.join(','));
    }
    break;
  }
}


// ════════════════════════════════════════════════════════════════
//  LOGIN USER
// ════════════════════════════════════════════════════════════════
function loginUser(mobile, password) {
  mobile = String(mobile || '').trim();
  if (!mobile || !password)
    return jsonRes({ status:'error', message:'Mobile aur password chahiye.' });

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet || sheet.getLastRow() < 2)
    return jsonRes({ status:'invalid', message:'User nahi mila. Pehle register karein.' });

  const passHash = hashString(String(password).trim());
  const rows     = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][U.MOBILE - 1]).trim() !== mobile) continue;

    // ── Active check ──────────────────────────────────────────
    const isActiveRaw = rows[i][U.IS_ACTIVE - 1];
    const isActive    = isActiveRaw === '' || isActiveRaw === true ||
                        String(isActiveRaw).toLowerCase() === 'true';
    if (!isActive)
      return jsonRes({ status:'blocked', message:'Account deactivated hai. Support se contact karein.' });

    if (rows[i][U.PASS - 1] !== passHash)
      return jsonRes({ status:'invalid', message:'Wrong password. Try again.' });

    // ── Login streak ──────────────────────────────────────────
    const lastLogin = String(rows[i][U.LAST_LOGIN - 1] || '').trim();
    const today     = todayStr();
    const yesterday = offsetDate(-1);
    let   streak    = Number(rows[i][U.LOGIN_STREAK - 1]) || 0;

    if      (lastLogin === today)     { /* same day */ }
    else if (lastLogin === yesterday) { streak++; }
    else                              { streak = 1; }

    sheet.getRange(i + 1, U.LOGIN_STREAK).setValue(streak);
    sheet.getRange(i + 1, U.LAST_LOGIN).setValue(today);

    // ── Paid status ───────────────────────────────────────────
    const paidFor  = String(rows[i][U.PAID_FOR  - 1] || '').trim();
    const degree   = String(rows[i][U.DEGREE    - 1] || '').trim();
    const semester = String(rows[i][U.SEMESTER  - 1] || '').trim();
    const isPaid   = isPaidUser(paidFor, degree, semester);

    return jsonRes({
      status: 'ok',
      user: {
        name:            rows[i][U.NAME        - 1],
        college:         rows[i][U.COLLEGE     - 1],
        semester,
        email:           rows[i][U.EMAIL       - 1],
        degree,
        mobile,
        totalScore:      Number(rows[i][U.TOTAL_SCORE - 1]) || 0,
        classesAttended: Number(rows[i][U.CLASSES_ATT - 1]) || 0,
        quizPlayed:      Number(rows[i][U.QUIZ_PLAYED - 1]) || 0,
        refCode:         String(rows[i][U.REF_CODE    - 1] || ''),
        loginStreak:     streak,
        isActive:        true,
        isPaid,
        paidFor,
      }
    });
  }

  return jsonRes({ status:'invalid', message:'Mobile number registered nahi hai. Pehle register karein!' });
}


// ════════════════════════════════════════════════════════════════
//  GET PROFILE
// ════════════════════════════════════════════════════════════════
function getProfile(mobile) {
  if (!mobile) return jsonRes({ status:'error', message:'mobile required' });

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) return jsonRes({ status:'error', message:'Users sheet missing' });

  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][U.MOBILE - 1]).trim() !== String(mobile).trim()) continue;

    // ── Active check ──────────────────────────────────────────
    const isActiveRaw = rows[i][U.IS_ACTIVE - 1];
    const isActive    = isActiveRaw === '' || isActiveRaw === true ||
                        String(isActiveRaw).toLowerCase() === 'true';

    // ── Referral data ─────────────────────────────────────────
    const referred   = String(rows[i][U.REFERRED - 1] || '').trim();
    const refMobiles = referred ? referred.split(',').map(x => x.trim()).filter(Boolean) : [];
    const refCount   = refMobiles.length;
    const refList    = [];
    refMobiles.forEach(mob => {
      for (let j = 1; j < rows.length; j++) {
        if (String(rows[j][U.MOBILE - 1]).trim() === mob) {
          refList.push({ name: rows[j][U.NAME - 1], college: rows[j][U.COLLEGE - 1] });
          break;
        }
      }
    });

    // ── Paid status ───────────────────────────────────────────
    const paidFor  = String(rows[i][U.PAID_FOR  - 1] || '').trim();
    const degree   = String(rows[i][U.DEGREE    - 1] || '').trim();
    const semester = String(rows[i][U.SEMESTER  - 1] || '').trim();
    const isPaid   = isPaidUser(paidFor, degree, semester);

    return jsonRes({
      status: 'ok',
      user: {
        name:            rows[i][U.NAME        - 1],
        college:         rows[i][U.COLLEGE     - 1],
        semester,
        email:           rows[i][U.EMAIL       - 1],
        degree,
        mobile,
        totalScore:      Number(rows[i][U.TOTAL_SCORE  - 1]) || 0,
        classesAttended: Number(rows[i][U.CLASSES_ATT  - 1]) || 0,
        quizPlayed:      Number(rows[i][U.QUIZ_PLAYED  - 1]) || 0,
        loginStreak:     Number(rows[i][U.LOGIN_STREAK - 1]) || 0,
        refCode:         String(rows[i][U.REF_CODE     - 1] || ''),
        refCount,
        refList,
        isActive,
        isPaid,
        paidFor,
      }
    });
  }

  return jsonRes({ status:'error', message:'User not found' });
}


// ════════════════════════════════════════════════════════════════
//  GET CLASSES
//  Now also accepts mobile param for per-user attendance booleans.
//  Paid classes hidden for Free users.
// ════════════════════════════════════════════════════════════════
function getClasses(semesterParam, degreeParam, mobileParam) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CLASSES_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return jsonRes({ status:'ok', classes:[] });

  const filterSem    = String(semesterParam || '').trim();
  const filterDegree = String(degreeParam   || '').trim().toLowerCase();
  const mobile       = String(mobileParam   || '').trim();
  const adminMode    = (filterSem === 'all');

  // ── Resolve user's paid status ────────────────────────────
  let userIsPaid = false;
  if (mobile) {
    const uSheet = ss.getSheetByName(USERS_SHEET);
    if (uSheet) {
      const uRows = uSheet.getDataRange().getValues();
      for (let i = 1; i < uRows.length; i++) {
        if (String(uRows[i][U.MOBILE - 1]).trim() === mobile) {
          const paidFor = String(uRows[i][U.PAID_FOR - 1] || '').trim();
          userIsPaid    = isPaidUser(paidFor, filterDegree, filterSem);
          break;
        }
      }
    }
  }

  const rows    = sheet.getDataRange().getValues();
  const classes = [];

  for (let i = 1; i < rows.length; i++) {
    const rowSem    = String(rows[i][CL.SEM    - 1] || '').trim();
    const rowDegree = String(rows[i][CL.DEGREE - 1] || '').trim().toLowerCase();
    const access    = String(rows[i][CL.ACCESS - 1] || '').trim().toLowerCase();
    const isPaid    = access === 'paid';

    if (!adminMode) {
      if (filterSem && rowSem !== filterSem) continue;
      if (rowDegree !== '' && filterDegree !== '' && rowDegree !== filterDegree) continue;
      // Hide paid classes from free users
      if (isPaid && !userIsPaid) continue;
    }

    // ── Per-user attendance flags ─────────────────────────────
    let classDone = false, recordingDone = false, notesDone = false, quizDone = false;
    if (mobile) {
      classDone     = mobileInList(rows[i][CL.CLASS_DONE - 1], mobile);
      recordingDone = mobileInList(rows[i][CL.REC_DONE   - 1], mobile);
      notesDone     = mobileInList(rows[i][CL.NOTES_DONE - 1], mobile);
      quizDone      = mobileInList(rows[i][CL.QUIZ_DONE  - 1], mobile);
    }

    classes.push({
      title:         rows[i][CL.TITLE   - 1],
      teacher:       rows[i][CL.TEACHER - 1],
      datetime:      rows[i][CL.DATETIME- 1],
      desc:          rows[i][CL.DESC    - 1],
      link:          rows[i][CL.LINK    - 1],
      recording:     rows[i][CL.REC     - 1],
      semester:      rowSem,
      status:        String(rows[i][CL.STATUS  - 1] || 'upcoming').toLowerCase().trim(),
      notes:         rows[i][CL.NOTES   - 1],
      subject:       String(rows[i][CL.SUBJECT - 1] || '').trim(),
      degree:        String(rows[i][CL.DEGREE  - 1] || '').trim(),
      quizlink:      String(rows[i][CL.QUIZLINK- 1] || '').trim(),
      image:         String(rows[i][CL.IMAGE   - 1] || '').trim(),
      classId:       String(rows[i][CL.CLASS_ID- 1] || '').trim(),
      access:        access || 'free',
      classDone,
      recordingDone,
      notesDone,
      quizDone,
    });
  }

  return jsonRes({ status:'ok', classes });
}


// ════════════════════════════════════════════════════════════════
//  GET ALL QUIZZES
//  Paid quizzes hidden for Free users.
// ════════════════════════════════════════════════════════════════
function getAllQuizzes(semesterParam, degreeParam, mobileParam) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ALL_QUIZ_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return jsonRes({ status:'ok', quizzes:[] });

  const filterSem    = String(semesterParam || '').trim();
  const filterDegree = String(degreeParam   || '').trim().toLowerCase();
  const mobile       = String(mobileParam   || '').trim();
  const adminMode    = (filterSem === 'all');

  // ── Resolve user's paid status ────────────────────────────
  let userIsPaid = false;
  if (mobile) {
    const uSheet = ss.getSheetByName(USERS_SHEET);
    if (uSheet) {
      const uRows = uSheet.getDataRange().getValues();
      for (let i = 1; i < uRows.length; i++) {
        if (String(uRows[i][U.MOBILE - 1]).trim() === mobile) {
          const paidFor = String(uRows[i][U.PAID_FOR - 1] || '').trim();
          userIsPaid    = isPaidUser(paidFor, filterDegree, filterSem);
          break;
        }
      }
    }
  }

  const rows    = sheet.getDataRange().getValues();
  const quizzes = [];

  for (let i = 1; i < rows.length; i++) {
    const rowSem    = String(rows[i][AQ.SEM    - 1] || '').trim();
    const rowDegree = String(rows[i][AQ.DEGREE - 1] || '').trim().toLowerCase();
    const access    = String(rows[i][AQ.ACCESS - 1] || '').trim().toLowerCase();
    const isPaid    = access === 'paid';

    if (!adminMode) {
      if (filterSem && rowSem !== filterSem) continue;
      if (rowDegree !== '' && filterDegree !== '' && rowDegree !== filterDegree) continue;
      if (isPaid && !userIsPaid) continue;
    }

    // ── Build full CSV path ───────────────────────────────────
    // Path column stores just the filename e.g. "cviva1"
    // Full path = ../data/sem{semester}/{filename}.csv
    const rawPath = String(rows[i][AQ.PATH - 1] || '').trim();
    const csvPath = '../data/sem' + rowSem + '/' + rawPath + '.csv';

    quizzes.push({
      title:    rows[i][AQ.TITLE   - 1],
      semester: rowSem,
      plays:    Number(rows[i][AQ.PLAYS - 1]) || 0,
      path:     rawPath,
      csvPath,
      desc:     rows[i][AQ.DESC    - 1],
      subject:  String(rows[i][AQ.SUBJECT - 1] || '').trim(),
      degree:   String(rows[i][AQ.DEGREE  - 1] || '').trim(),
      access:   access || 'free',
    });
  }

  return jsonRes({ status:'ok', quizzes });
}


// ════════════════════════════════════════════════════════════════
//  GET COURSES
//  Filter by semester + degree (blank degree in sheet = all).
// ════════════════════════════════════════════════════════════════
function getCourses(semesterParam, degreeParam) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(COURSES_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return jsonRes({ status:'ok', courses:[] });

  const filterSem    = String(semesterParam || '').trim();
  const filterDegree = String(degreeParam   || '').trim().toLowerCase();

  const rows    = sheet.getDataRange().getValues();
  const courses = [];

  for (let i = 1; i < rows.length; i++) {
    const rowSem    = String(rows[i][CR.SEM    - 1] || '').trim();
    const rowDegree = String(rows[i][CR.DEGREE - 1] || '').trim().toLowerCase();

    // Semester must match exactly
    if (filterSem && rowSem !== filterSem) continue;
    // Degree: blank = everyone; filled = must match
    if (rowDegree !== '' && filterDegree !== '' && rowDegree !== filterDegree) continue;

    courses.push({
      id:         String(rows[i][CR.ID      - 1] || '').trim(),
      name:       rows[i][CR.NAME    - 1],
      semester:   rowSem,
      degree:     rows[i][CR.DEGREE  - 1],
      image:      String(rows[i][CR.IMAGE   - 1] || '').trim(),
      enrollLink: String(rows[i][CR.ENROLL  - 1] || '').trim(),
      price:      rows[i][CR.PRICE   - 1],
      buttonText: String(rows[i][CR.BTN_TEXT- 1] || 'Enroll Now').trim(),
    });
  }

  return jsonRes({ status:'ok', courses });
}


// ════════════════════════════════════════════════════════════════
//  MARK ATTENDANCE  (POST)
//
//  Body: { mobile, name, semester, classId, type, value }
//  type  = "Class" | "Recording" | "Notes" | "Quiz"
//  value = "Yes"
//
//  Guard: one entry per mobile+classId+type (check AttendanceLogs).
//  Also appends mobile to the matching column in Classes sheet.
// ════════════════════════════════════════════════════════════════
function markAttendance(data) {
  const mobile  = String(data.mobile  || '').trim();
  const name    = String(data.name    || '').trim();
  const sem     = String(data.semester|| '').trim();
  const classId = String(data.classId || '').trim();
  const type    = String(data.type    || '').trim();   // Class|Recording|Notes|Quiz
  const value   = String(data.value   || 'Yes').trim();

  if (!mobile || !classId || !type)
    return jsonRes({ status:'error', message:'mobile, classId and type are required' });

  // Validate type
  const validTypes = ['Class','Recording','Notes','Quiz'];
  if (!validTypes.includes(type))
    return jsonRes({ status:'error', message:'Invalid type. Must be Class|Recording|Notes|Quiz' });

  // ── Duplicate check in AttendanceLogs ─────────────────────
  const logSheet = getOrCreateSheet(ATTENDANCE_LOG_SHEET, ATTENDANCE_HEADER, '#2d3748');
  if (logSheet.getLastRow() >= 2) {
    const logRows = logSheet.getDataRange().getValues();
    for (let i = 1; i < logRows.length; i++) {
      if (
        String(logRows[i][AL.MOBILE   - 1]).trim() === mobile   &&
        String(logRows[i][AL.CLASS_ID - 1]).trim() === classId  &&
        String(logRows[i][AL.TYPE     - 1]).trim() === type
      ) {
        return jsonRes({ status:'duplicate', message:'Already marked' });
      }
    }
  }

  // ── Append to AttendanceLogs ──────────────────────────────
  logSheet.appendRow([now(), mobile, name, sem, classId, type, value, '']);

  // ── Update Classes sheet column ───────────────────────────
  const clSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CLASSES_SHEET);
  if (clSheet && clSheet.getLastRow() >= 2) {
    const clRows = clSheet.getDataRange().getValues();
    for (let i = 1; i < clRows.length; i++) {
      if (String(clRows[i][CL.CLASS_ID - 1]).trim() !== classId) continue;

      // Determine which column to update
      let col;
      if      (type === 'Class')     col = CL.CLASS_DONE;
      else if (type === 'Recording') col = CL.REC_DONE;
      else if (type === 'Notes')     col = CL.NOTES_DONE;
      else if (type === 'Quiz')      col = CL.QUIZ_DONE;

      if (!col) break;

      const existing = String(clRows[i][col - 1] || '').trim();
      const list     = existing ? existing.split(',').map(x => x.trim()).filter(Boolean) : [];
      if (!list.includes(mobile)) {
        list.push(mobile);
        clSheet.getRange(i + 1, col).setValue(list.join(','));
      }
      break;
    }
  }

  return jsonRes({ status:'ok', message:'Attendance marked!' });
}


// ════════════════════════════════════════════════════════════════
//  GET ATTENDANCE SUMMARY
//  Returns counts for the summary bar on the Classes tab.
//  classDone / classTotal etc. for a given mobile+semester+degree
// ════════════════════════════════════════════════════════════════
function getAttendanceSummary(mobileParam, semesterParam, degreeParam) {
  const mobile       = String(mobileParam   || '').trim();
  const filterSem    = String(semesterParam || '').trim();
  const filterDegree = String(degreeParam   || '').trim().toLowerCase();

  if (!mobile || !filterSem)
    return jsonRes({ status:'error', message:'mobile and semester required' });

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CLASSES_SHEET);
  if (!sheet || sheet.getLastRow() < 2)
    return jsonRes({ status:'ok', classDone:0, classTotal:0, recordingDone:0, recordingTotal:0,
                     notesDone:0, notesTotal:0, quizDone:0, quizTotal:0 });

  const rows = sheet.getDataRange().getValues();

  let classTotal=0, classDone=0;
  let recTotal=0,   recDone=0;
  let notesTotal=0, notesDone=0;
  let quizTotal=0,  quizDone=0;

  for (let i = 1; i < rows.length; i++) {
    const rowSem    = String(rows[i][CL.SEM    - 1] || '').trim();
    const rowDegree = String(rows[i][CL.DEGREE - 1] || '').trim().toLowerCase();

    if (rowSem !== filterSem) continue;
    if (rowDegree !== '' && filterDegree !== '' && rowDegree !== filterDegree) continue;

    // Count totals (all classes in their semester/degree)
    classTotal++;
    if (String(rows[i][CL.REC     - 1] || '').trim()) recTotal++;
    if (String(rows[i][CL.NOTES   - 1] || '').trim()) notesTotal++;
    if (String(rows[i][CL.QUIZLINK- 1] || '').trim()) quizTotal++;

    // Count done (mobile in the comma-separated list)
    if (mobileInList(rows[i][CL.CLASS_DONE - 1], mobile)) classDone++;
    if (mobileInList(rows[i][CL.REC_DONE   - 1], mobile)) recDone++;
    if (mobileInList(rows[i][CL.NOTES_DONE - 1], mobile)) notesDone++;
    if (mobileInList(rows[i][CL.QUIZ_DONE  - 1], mobile)) quizDone++;
  }

  return jsonRes({
    status: 'ok',
    classDone,    classTotal,
    recordingDone: recDone,   recordingTotal: recTotal,
    notesDone,    notesTotal,
    quizDone,     quizTotal,
  });
}


// ════════════════════════════════════════════════════════════════
//  SUBMIT QUIZ
// ════════════════════════════════════════════════════════════════
function submitQuiz(data) {
  const quiz   = sanitizeName(data.quiz);
  const mobile = String(data.mobile || '').trim();
  if (!quiz || !mobile)
    return jsonRes({ status:'error', message:'quiz and mobile required' });

  const sheet = getOrCreateSheet(quiz, QUIZ_HEADER, '#1a5e38');

  if (isAlreadySubmitted(sheet, mobile))
    return jsonRes({ status:'duplicate', message:'Already submitted' });

  sheet.appendRow([
    data.timestamp        || now(),
    String(data.name      || ''),
    mobile,
    String(data.college   || ''),
    String(data.semester  || ''),
    Number(data.score)     || 0,
    Number(data.correct)   || 0,
    Number(data.wrong)     || 0,
    Number(data.negative)  || 0,
    Number(data.total)     || 0,
    String(data.attendedClass || ''),
    String(data.feedback      || ''),
    String(data.answers       || '{}'),
  ]);

  updateUserStats(mobile, { scoreDelta: Number(data.score) || 0, quizDelta: 1 });
  incrementQuizPlays(data.quiz);

  return jsonRes({ status:'ok' });
}


// ════════════════════════════════════════════════════════════════
//  CHECK SUBMISSION
// ════════════════════════════════════════════════════════════════
function checkSubmission(quizParam, mobile) {
  if (!quizParam || !mobile) return jsonRes({ alreadySubmitted:false });
  const quiz  = sanitizeName(quizParam);
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(quiz);
  if (!sheet) return jsonRes({ alreadySubmitted:false });

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][Q.MOBILE - 1]).trim() === String(mobile).trim()) {
      return jsonRes({
        alreadySubmitted: true,
        name:     rows[i][Q.NAME     - 1],
        score:    rows[i][Q.SCORE    - 1],
        correct:  rows[i][Q.CORRECT  - 1],
        wrong:    rows[i][Q.WRONG    - 1],
        negative: rows[i][Q.NEGATIVE - 1],
        total:    rows[i][Q.TOTAL    - 1],
        answers:  rows[i][Q.ANSWERS  - 1],
      });
    }
  }
  return jsonRes({ alreadySubmitted:false });
}


// ════════════════════════════════════════════════════════════════
//  LEADERBOARD (per quiz)
// ════════════════════════════════════════════════════════════════
function getLeaderboard(quizParam) {
  if (!quizParam) return jsonRes({ status:'error', message:'quiz param missing' });
  const quiz  = sanitizeName(quizParam);
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(quiz);
  if (!sheet || sheet.getLastRow() < 2) return jsonRes({ status:'ok', scores:[] });

  const rows   = sheet.getDataRange().getValues();
  const scores = [];
  for (let i = 1; i < rows.length; i++) {
    const name    = String(rows[i][Q.NAME    - 1] || '').trim();
    const score   = Number(rows[i][Q.SCORE   - 1]) || 0;
    const mobile  = String(rows[i][Q.MOBILE  - 1] || '').trim();
    const college = String(rows[i][Q.COLLEGE - 1] || '').trim();
    if (name) scores.push({ name, score, mobile, college });
  }
  scores.sort((a, b) => b.score - a.score);
  return jsonRes({ status:'ok', scores });
}


// ════════════════════════════════════════════════════════════════
//  ALL-TIME LEADERBOARD
// ════════════════════════════════════════════════════════════════
function getAllTimeLeaderboard(currentMobile) {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const aqSheet = ss.getSheetByName(ALL_QUIZ_SHEET);
  if (!aqSheet) return jsonRes({ status:'ok', scores:[] });

  const aqRows   = aqSheet.getDataRange().getValues();
  const scoreMap = {};

  for (let i = 1; i < aqRows.length; i++) {
    const rawPath   = String(aqRows[i][AQ.PATH - 1] || '').trim();
    const rowSem    = String(aqRows[i][AQ.SEM  - 1] || '').trim();
    if (!rawPath) continue;

    // Build sheet name from sanitized quiz name
    const sheetName = sanitizeName(rawPath);
    const qs        = ss.getSheetByName(sheetName);
    if (!qs || qs.getLastRow() < 2) continue;

    const qRows = qs.getDataRange().getValues();
    for (let j = 1; j < qRows.length; j++) {
      const mob   = String(qRows[j][Q.MOBILE  - 1] || '').trim();
      const score = Number(qRows[j][Q.SCORE   - 1]) || 0;
      const nm    = String(qRows[j][Q.NAME    - 1] || '').trim();
      const col   = String(qRows[j][Q.COLLEGE - 1] || '').trim();
      if (!mob) continue;
      if (!scoreMap[mob]) scoreMap[mob] = { name:nm, college:col, mobile:mob, score:0, quizzes:0 };
      scoreMap[mob].score   += score;
      scoreMap[mob].quizzes += 1;
    }
  }

  const allScores = Object.values(scoreMap).sort((a, b) => b.score - a.score);

  // Attach rank to current mobile
  let userRank = null;
  allScores.forEach((s, idx) => {
    if (s.mobile === currentMobile) userRank = idx + 1;
  });

  return jsonRes({ status:'ok', scores: allScores, userRank });
}


// ════════════════════════════════════════════════════════════════
//  LOG CHAT MESSAGE
// ════════════════════════════════════════════════════════════════
function logChatMessage(data) {
  const sheet = getOrCreateSheet(CHAT_HIST_SHEET, CHAT_HEADER, '#2d3748');
  sheet.appendRow([
    data.timestamp || now(),
    String(data.mobile  || ''),
    String(data.name    || ''),
    String(data.message || ''),
  ]);
  return jsonRes({ status:'ok' });
}


// ════════════════════════════════════════════════════════════════
//  AI CHAT
// ════════════════════════════════════════════════════════════════
function handleAiChatPost(data) {
  const messages = data.messages || [{ role:'user', content: data.message }];
  return jsonRes({ reply: callNvidiaAI(messages) });
}
function handleAiChatGet(messagesParam) {
  const messages = JSON.parse(decodeURIComponent(messagesParam));
  return jsonRes({ reply: callNvidiaAI(messages) });
}
function callNvidiaAI(messages) {
  const response = UrlFetchApp.fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + AI_API_KEY,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    },
    payload: JSON.stringify({
      model:       'meta/llama-3.1-8b-instruct',
      messages,
      temperature: 0.7,
      max_tokens:  1024,
      stream:      false,
    }),
  });
  const result = JSON.parse(response.getContentText());
  return result.choices[0].message.content;
}


// ════════════════════════════════════════════════════════════════
//  HELPER — update user stats
// ════════════════════════════════════════════════════════════════
function updateUserStats(mobile, { scoreDelta = 0, quizDelta = 0, classAttDelta = 0 }) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][U.MOBILE - 1]).trim() !== String(mobile).trim()) continue;
    const r = i + 1;
    if (scoreDelta)    sheet.getRange(r, U.TOTAL_SCORE).setValue((Number(rows[i][U.TOTAL_SCORE - 1]) || 0) + scoreDelta);
    if (quizDelta)     sheet.getRange(r, U.QUIZ_PLAYED).setValue((Number(rows[i][U.QUIZ_PLAYED - 1]) || 0) + quizDelta);
    if (classAttDelta) sheet.getRange(r, U.CLASSES_ATT).setValue((Number(rows[i][U.CLASSES_ATT - 1]) || 0) + classAttDelta);
    break;
  }
}

function incrementQuizPlays(quizRaw) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ALL_QUIZ_SHEET);
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const path = String(rows[i][AQ.PATH - 1] || '').trim();
    if (path === String(quizRaw || '').trim()) {
      sheet.getRange(i + 1, AQ.PLAYS).setValue((Number(rows[i][AQ.PLAYS - 1]) || 0) + 1);
      break;
    }
  }
}


// ════════════════════════════════════════════════════════════════
//  SHEET HELPERS
// ════════════════════════════════════════════════════════════════
function getOrCreateSheet(name, header, bgColor) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    writeHeader(sheet, header, bgColor || '#1b3a5c');
  }
  return sheet;
}
function writeHeader(sheet, header, bgColor) {
  sheet.appendRow(header);
  const rng = sheet.getRange(1, 1, 1, header.length);
  rng.setFontWeight('bold');
  rng.setBackground(bgColor);
  rng.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, header.length);
}
function userExistsByMobile(sheet, mobile) {
  if (sheet.getLastRow() < 2) return false;
  const mobs = sheet.getRange(2, U.MOBILE, sheet.getLastRow() - 1, 1).getValues();
  return mobs.some(r => String(r[0]).trim() === mobile);
}
function isAlreadySubmitted(sheet, mobile) {
  if (sheet.getLastRow() < 2) return false;
  const mobs = sheet.getRange(2, Q.MOBILE, sheet.getLastRow() - 1, 1).getValues();
  return mobs.some(r => String(r[0]).trim() === mobile);
}

// ── Check if mobile exists in a comma-separated cell value ───────
function mobileInList(cellValue, mobile) {
  if (!cellValue || !mobile) return false;
  const list = String(cellValue).split(',').map(x => x.trim()).filter(Boolean);
  return list.includes(String(mobile).trim());
}


// ════════════════════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════════════════════
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return 'h' + Math.abs(hash).toString(16);
}
function sanitizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9_\-\/]/g, '_')
    .substring(0, 200);
}
function now() {
  return new Date().toLocaleString('en-IN', { timeZone:'Asia/Kolkata' });
}
function todayStr() {
  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
}
function offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd');
}
function jsonRes(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ════════════════════════════════════════════════════════════════
//  MIGRATION HELPER — run once from Apps Script editor
//  Upgrades old referral codes to new random hex format.
// ════════════════════════════════════════════════════════════════
function migrateRefCodesToHex() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) { Logger.log('Users sheet not found'); return; }

  const rows = sheet.getDataRange().getValues();
  const existingCodes = new Set(
    rows.slice(1).map(r => String(r[U.REF_CODE - 1] || '').toLowerCase().trim())
  );

  let changed = 0;
  for (let i = 1; i < rows.length; i++) {
    const current = String(rows[i][U.REF_CODE - 1] || '').trim();
    if (/^[0-9a-f]{6}$/.test(current.toLowerCase())) continue;
    existingCodes.delete(current.toLowerCase());
    let newCode;
    do {
      const rand = Math.floor(Math.random() * 0xFFFFFF);
      newCode = rand.toString(16).padStart(6, '0');
    } while (existingCodes.has(newCode));
    existingCodes.add(newCode);
    sheet.getRange(i + 1, U.REF_CODE).setValue(newCode);
    Logger.log('Row ' + (i+1) + ' [' + rows[i][U.NAME-1] + ']: ' + current + ' → ' + newCode);
    changed++;
  }
  Logger.log('Done. ' + changed + ' code(s) updated.');
}


// ════════════════════════════════════════════════════════════════
//  SETUP HELPER — run once to create all required sheets
//  Go to: Run → setupAllSheets
// ════════════════════════════════════════════════════════════════
function setupAllSheets() {
  getOrCreateSheet(USERS_SHEET,          USERS_HEADER,      '#1b3a5c');
  getOrCreateSheet(CLASSES_SHEET,        CLASSES_HEADER,    '#1b3a5c');
  getOrCreateSheet(COURSES_SHEET,        COURSES_HEADER,    '#7c3aed');
  getOrCreateSheet(ATTENDANCE_LOG_SHEET, ATTENDANCE_HEADER, '#0f766e');
  getOrCreateSheet(CHAT_HIST_SHEET,      CHAT_HEADER,       '#2d3748');
  Logger.log('All sheets created/verified.');
}