/**
 * 依 POS機號開頭字元自動判斷所在樓層
 * 規則對照(依優先順序比對,越具體的規則排越前面):
 *   L601        → 大樓88F
 *   L602        → 6F
 *   B1 / C0 / CB → B1F
 *   L1 / CL     → 1F
 *   L2 / CM     → 2F
 *   L3 / CN     → 3F
 *   L4          → 4F
 *   L5          → 其他
 *   T + 1~2碼數字 → 大樓{N}F(例:T1→大樓1F,T35622→大樓35F)
 * 無法判斷則回傳空字串,由使用者手動填寫
 */
export function computeFloorFromPosId(posId) {
  const id = (posId || "").trim().toUpperCase();
  if (!id) return "";

  if (id.startsWith("L601")) return "大樓88F";
  if (id.startsWith("L602")) return "6F";
  if (id.startsWith("B1") || id.startsWith("C0") || id.startsWith("CB")) return "B1F";
  if (id.startsWith("L1") || id.startsWith("CL")) return "1F";
  if (id.startsWith("L2") || id.startsWith("CM")) return "2F";
  if (id.startsWith("L3") || id.startsWith("CN")) return "3F";
  if (id.startsWith("L4")) return "4F";
  if (id.startsWith("L5")) return "其他";

  if (id.startsWith("T")) {
    const m = id.match(/^T(\d{1,2})/);
    if (m) return `大樓${parseInt(m[1], 10)}F`;
  }

  return "";
}
