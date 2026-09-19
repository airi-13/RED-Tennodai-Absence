const SHEET_NAME = "申請一覧";

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({success:true, message:"backend ok"}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const key = e && e.parameter ? String(e.parameter.key || "") : "";
    const expected = PropertiesService.getScriptProperties().getProperty("API_SECRET");
    if (!expected || key !== expected) {
      return jsonResponse({success:false, message:"Unauthorized"}, 401);
    }

    const data = JSON.parse(e.postData.contents || "{}");
    return jsonResponse(submitApplication(data), 200);
  } catch (error) {
    console.error(error);
    return jsonResponse({success:false, mailSuccess:false, message:error.message || "申請処理中にエラーが発生しました。"}, 200);
  }
}

function jsonResponse(data, status) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function submitApplication(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("申請一覧シートが見つかりません。");
  if (!data) throw new Error("申請データを取得できませんでした。");

  const studentId = String(data.studentId || "").trim();
  const studentName = String(data.studentName || "").trim();
  const absenceDate = String(data.absenceDate || "").trim();
  const absencePeriods = Array.isArray(data.absencePeriods) ? data.absencePeriods : [];
  const makeupDateUndecided = data.makeupDateUndecided === true;
  let makeupDate = String(data.makeupDate || "").trim();
  let makeupPeriods = Array.isArray(data.makeupPeriods) ? data.makeupPeriods : [];
  const email = String(data.email || "").trim();
  const notes = String(data.notes || "").trim();

  if (!/^\d+$/.test(studentId)) throw new Error("生徒IDは半角数字で入力してください。");
  if (!studentName) throw new Error("生徒名を入力してください。");
  if (!absenceDate) throw new Error("欠席希望日を入力してください。");
  if (!absencePeriods.length) throw new Error("欠席時間を選択してください。");
  if (!email) throw new Error("メールアドレスを入力してください。");
  if (!isValidEmail(email)) throw new Error("メールアドレスの形式を確認してください。");

  checkDateAndPeriods(absenceDate, absencePeriods);

  if (makeupDateUndecided) {
    makeupDate = "未定";
    makeupPeriods = ["未定"];
  } else {
    if (!makeupDate) throw new Error("振替希望日を入力してください。");
    if (!makeupPeriods.length) throw new Error("振替希望時間を選択してください。");
    checkMakeupDateWithinFourWeeks(absenceDate, makeupDate);
    checkDateAndPeriods(makeupDate, makeupPeriods);
  }

  const absenceDateText = formatJapaneseDate(absenceDate);
  const absencePeriodsText = absencePeriods.map(getPeriodText).join("、");
  const makeupDateText = makeupDateUndecided ? "未定" : formatJapaneseDate(makeupDate);
  const makeupPeriodsText = makeupDateUndecided ? "未定" : makeupPeriods.map(getPeriodText).join("、");

  const mailBody =
    "以下の内容で欠席・振替申請を受け付けました。\n\n" +
    "生徒ID：" + studentId + "\n\n" +
    "生徒名：" + studentName + "\n\n" +
    "欠席希望日：" + absenceDateText + "\n\n" +
    "欠席時間：" + absencePeriodsText + "\n\n" +
    "振替希望日：" + makeupDateText + "\n\n" +
    "振替希望時間：" + makeupPeriodsText + "\n\n" +
    "連絡事項：" + (notes || "なし");

  let mailSuccess = true;
  try {
    MailApp.sendEmail({to:email, subject:"欠席・振替申請を受け付けました", body:mailBody});
  } catch (mailError) {
    mailSuccess = false;
    console.error("メール送信エラー: " + mailError.message);
  }

  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 3).setNumberFormat("@");
  sheet.getRange(row, 1, 1, 10).setValues([[
    mailSuccess ? "未確認" : "メールエラー",
    new Date(), studentId, studentName, absenceDateText, absencePeriodsText,
    makeupDateText, makeupPeriodsText, email, notes
  ]]);

  return {success:true, mailSuccess:mailSuccess};
}

function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

function checkDateAndPeriods(dateString, periods) {
  const date = parseDate(dateString);
  if (!date) throw new Error("正しい日付を入力してください。");
  const day = date.getDay();
  const available = {2:["④","⑤","⑥","⑦","⑧"],3:["③","④","⑤","⑥","⑦"],4:["④","⑤","⑥","⑦","⑧"],5:["③","④","⑤","⑥","⑦"],6:["①","②","③","④","⑤"]};
  if (day === 0 || day === 1) throw new Error("休校日です");
  if (!Array.isArray(periods) || periods.length === 0) throw new Error("時間枠を選択してください。");
  const uniquePeriods = [...new Set(periods)];
  if (uniquePeriods.length !== periods.length) throw new Error("同じ時間枠が重複しています。");
  const allowed = available[day] || [];
  periods.forEach(p => { if (allowed.indexOf(p) === -1 && p !== "未定") throw new Error("選択した時間枠は、その曜日には設定されていません。"); });
}

function checkMakeupDateWithinFourWeeks(absenceDateString, makeupDateString) {
  const absenceDate = parseDate(absenceDateString), makeupDate = parseDate(makeupDateString);
  if (!absenceDate || !makeupDate) throw new Error("正しい日付を入力してください。");
  const minDate = new Date(absenceDate), maxDate = new Date(absenceDate);
  maxDate.setDate(maxDate.getDate() + 28);
  minDate.setHours(0,0,0,0); maxDate.setHours(0,0,0,0); makeupDate.setHours(0,0,0,0);
  if (makeupDate < minDate || makeupDate > maxDate) throw new Error("振替日は欠席日から4週間以内で指定してください。");
}

function parseDate(dateString) {
  if (!dateString) return null;
  const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year=Number(match[1]), month=Number(match[2])-1, day=Number(match[3]);
  const date=new Date(year,month,day); date.setHours(0,0,0,0);
  return date.getFullYear()===year && date.getMonth()===month && date.getDate()===day ? date : null;
}

function formatJapaneseDate(dateString) {
  const date=parseDate(dateString); if(!date) throw new Error("正しい日付を入力してください。");
  const weekdays=["日","月","火","水","木","金","土"];
  return (date.getMonth()+1)+"月"+date.getDate()+"日（"+weekdays[date.getDay()]+"）";
}

function getPeriodText(period) {
  const times={"①":"15:00～15:40","②":"15:45～16:25","③":"16:30～17:10","④":"17:15～17:55","⑤":"18:00～18:40","⑥":"18:45～19:25","⑦":"19:30～20:10","⑧":"20:15～20:55"};
  return times[period] ? period+" "+times[period] : period;
}

function testMail() {
  MailApp.sendEmail({
    to:Session.getEffectiveUser().getEmail(),
    subject:"欠席・振替申請システムのテストメール",
    body:"メール送信権限の確認です。\nこのメールが届けば、MailAppの権限設定は完了しています。"
  });
}