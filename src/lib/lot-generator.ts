// --- 1. 賞味期限の自動計算（製造日 + 5年6ヶ月） ---
export function calculateExpiryDate(manufacturingDateStr: string): string {
  if (!manufacturingDateStr) return "";
  const mDate = new Date(manufacturingDateStr);
  
  // 5年進める
  mDate.setFullYear(mDate.getFullYear() + 5);
  // 6ヶ月進める
  mDate.setMonth(mDate.getMonth() + 6);
  
  // yyyy-mm-dd形式で返す
  return mDate.toISOString().split('T')[0];
}

// --- 2. Lot番号の自動計算 ---
// 日付変換表（タ行抜きの31文字）
const dayKatakanaMap =[
  "", // 0日はなし
  "ア", "イ", "ウ", "エ", "オ", // 1〜5
  "カ", "キ", "ク", "ケ", "コ", // 6〜10
  "サ", "シ", "ス", "セ", "ソ", // 11〜15 (13=ス)
  "ナ", "ニ", "ヌ", "ネ", "ノ", // 16〜20
  "ハ", "ヒ", "フ", "ヘ", "ホ", // 21〜25
  "マ", "ミ", "ム", "メ", "モ", // 26〜30
  "ヤ"                          // 31
];

// 月変換表（A〜L）
const monthAlphaMap =["", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

export function generateLotNumber(manufacturingDateStr: string, productId: string, dailySequence: number = 1): string {
  if (!manufacturingDateStr || !productId) return "";
  
  const mDate = new Date(manufacturingDateStr);
  const year2 = String(mDate.getFullYear()).slice(-2); // 例: 2026 -> "26"
  const month = mDate.getMonth() + 1; // 1〜12
  const day = mDate.getDate(); // 1〜31
  
  const monthAlpha = monthAlphaMap[month];
  const dayKatakana = dayKatakanaMap[day];
  const day2Digit = String(day).padStart(2, '0'); // 例: 5 -> "05"

  // 製品IDの先頭文字等で種類を判別 (ルールに基づく)
  if (productId.startsWith('MA') || productId.startsWith('FD')) {
    // MA/FD複合製品: yy + MA/FD + 連番2桁 (例: 26MA01)
    const baseId = productId.split('-')[0]; // "MA-C3" -> "MA"
    const seqStr = String(dailySequence).padStart(2, '0');
    return `${year2}${baseId}${seqStr}`;
  } 
  else if (productId === 'YC50' || productId === 'YO50') {
    // YC50/YO50: dd(2桁) + 月alpha + 年2桁 + 製品ID (例: 13B26YC50)
    return `${day2Digit}${monthAlpha}${year2}${productId}`;
  } 
  else {
    // 通常品: カタカナ(日付) + 月alpha + 年2桁 + 製品ID (例: スB26SB)
    return `${dayKatakana}${monthAlpha}${year2}${productId}`;
  }
}