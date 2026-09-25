/**
 * DateLib.gs — แปลงวันที่ให้เป็น dd/mm/yyyy (ปี ค.ศ.)
 *
 * ไฟล์นี้ต้องเป็นฟังก์ชันล้วน ๆ (ไม่เรียก SpreadsheetApp ฯลฯ) เพราะโค้ดชุดเดียวกันนี้
 * ถูกส่งไปใช้ในหน้าเว็บด้วย (ดู dateLibSource_ ใน Code.gs) — แก้ที่นี่ที่เดียว ใช้ได้ทั้งสองฝั่ง
 *
 * กติกา:
 *  - ปี พ.ศ. (2400 ขึ้นไป) ลบ 543
 *  - ปี 2 หลัก: ถือเป็น 20xx ถ้าไกลเกินจริง (เกินปีนี้ + 15) ถือเป็น พ.ศ. 25xx
 *  - ไม่มีวัน: วันผลิต = 01, วันหมดอายุ = วันสุดท้ายของเดือน
 */

var MONTH_NAMES_ = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12,
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, JUNE: 6, JULY: 7, AUGUST: 8, SEPTEMBER: 9,
  OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
  'มค': 1, 'กพ': 2, 'มีค': 3, 'เมย': 4, 'พค': 5, 'มิย': 6, 'กค': 7, 'สค': 8, 'กย': 9, 'ตค': 10, 'พย': 11, 'ธค': 12,
  'มกราคม': 1, 'กุมภาพันธ์': 2, 'มีนาคม': 3, 'เมษายน': 4, 'พฤษภาคม': 5, 'มิถุนายน': 6,
  'กรกฎาคม': 7, 'สิงหาคม': 8, 'กันยายน': 9, 'ตุลาคม': 10, 'พฤศจิกายน': 11, 'ธันวาคม': 12
};

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

function daysInMonth_(y, m) { return new Date(y, m, 0).getDate(); }

function toArabicDigits_(s) {
  return String(s).replace(/[๐-๙]/g, function (d) { return String(d.charCodeAt(0) - 0x0E50); });
}

/** ปีใด ๆ → ปี ค.ศ. 4 หลัก หรือ null ถ้าไม่สมเหตุสมผล */
function normYear_(y) {
  y = Number(y);
  if (!isFinite(y) || y < 0 || y % 1) return null;
  var now = new Date().getFullYear();
  if (y < 100) {
    y += 2000;
    if (y > now + 15) y -= 43;           // เช่น "69" → 2069 ไกลเกิน → พ.ศ. 2569 → 2026
  } else if (y >= 2400) {
    y -= 543;                            // พ.ศ. → ค.ศ.
  }
  if (y < 1990 || y > now + 20) return null;
  return y;
}

function monthFromName_(tok) {
  var t = String(tok).toUpperCase().replace(/\./g, '');
  return MONTH_NAMES_[t] || MONTH_NAMES_[t.slice(0, 3)] || null;
}

/**
 * วัน/เดือน/ปี (ตัวเลข) → 'dd/mm/yyyy' หรือ null
 * kind: 'mfg' | 'exp' — ใช้ตัดสินวันเมื่อไม่มีวันที่ระบุ
 */
function normalizeDateParts(day, month, year, kind) {
  var y = normYear_(year);
  var m = Number(month);
  if (y === null || !(m >= 1 && m <= 12) || m % 1) return null;
  var last = daysInMonth_(y, m);
  var d;
  if (day === null || day === undefined || day === '') {
    d = kind === 'exp' ? last : 1;
  } else {
    d = Number(day);
    if (!(d >= 1 && d <= last) || d % 1) return null;
  }
  return pad2_(d) + '/' + pad2_(m) + '/' + y;
}

/**
 * ข้อความวันที่แบบต่าง ๆ → 'dd/mm/yyyy'
 * คืน '' ถ้าว่าง, null ถ้าอ่านไม่ออก
 * รองรับ: 14/02/2026, 14-2-26, 14.02.2569, 2026-02-14, 14 FEB 2026, FEB 2026, 02/2026, 12/69, 20260214, 14022026
 */
function parseDateText(text, kind) {
  if (text === null || text === undefined) return '';
  var s = toArabicDigits_(String(text)).trim();
  if (!s) return '';
  s = s.toUpperCase().replace(/\s+/g, ' ');
  var m, v, re;

  function dmy(d, mo, y) {
    d = d === null ? null : Number(d);
    mo = Number(mo);
    if (mo > 12 && d !== null && d <= 12) { var t = d; d = mo; mo = t; }   // แบบอเมริกัน mm/dd
    return normalizeDateParts(d, mo, y, kind);
  }

  // 8 หลักติดกัน: yyyymmdd หรือ ddmmyyyy
  if ((m = s.match(/(?:^|\D)(\d{8})(?:\D|$)/))) {
    var n = m[1];
    var y4 = Number(n.slice(0, 4));
    if ((y4 >= 1990 && y4 <= 2100) || (y4 >= 2500 && y4 <= 2700)) {
      v = dmy(n.slice(6, 8), n.slice(4, 6), y4);
      if (v) return v;
    }
    v = dmy(n.slice(0, 2), n.slice(2, 4), n.slice(4, 8));
    if (v) return v;
  }
  // yyyy-mm-dd
  if ((m = s.match(/(?:^|\D)(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:\D|$)/))) {
    v = dmy(m[3], m[2], m[1]);
    if (v) return v;
  }
  // dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy, dd mm yyyy
  if ((m = s.match(/(?:^|\D)(\d{1,2})[\/\-. ]+(\d{1,2})[\/\-. ]+(\d{4}|\d{2})(?:\D|$)/))) {
    v = dmy(m[1], m[2], m[3]);
    if (v) return v;
  }
  // dd MON yyyy (FEB, ก.พ., กุมภาพันธ์)
  re = /(?:^|\D)(\d{1,2})[\s\-\/.,]*([A-Zก-๙][A-Zก-๙.]*)[\s\-\/.,]*(\d{4}|\d{2})(?:\D|$)/g;
  while ((m = re.exec(s))) {
    var mo1 = monthFromName_(m[2]);
    if (mo1 && (v = dmy(m[1], mo1, m[3]))) return v;
    re.lastIndex = m.index + 1;
  }
  // MON yyyy
  re = /([A-Zก-๙][A-Zก-๙.]*)[\s\-\/.,]*(\d{4}|\d{2})(?:\D|$)/g;
  while ((m = re.exec(s))) {
    var mo2 = monthFromName_(m[1]);
    if (mo2 && (v = normalizeDateParts(null, mo2, m[2], kind))) return v;
    re.lastIndex = m.index + 1;
  }
  // yyyy-mm
  if ((m = s.match(/(?:^|\D)(\d{4})[\/\-.](\d{1,2})(?:\D|$)/))) {
    v = normalizeDateParts(null, m[2], m[1], kind);
    if (v) return v;
  }
  // mm/yyyy, mm/yy
  if ((m = s.match(/(?:^|\D)(\d{1,2})[\/\-. ]+(\d{4}|\d{2})(?:\D|$)/))) {
    v = normalizeDateParts(null, m[1], m[2], kind);
    if (v) return v;
  }
  return null;
}

/** 'dd/mm/yyyy' → yyyymmdd (ตัวเลข) ไว้เทียบก่อน-หลัง */
function dateSortKey_(s) {
  var p = String(s).split('/');
  return Number(p[2]) * 10000 + Number(p[1]) * 100 + Number(p[0]);
}
