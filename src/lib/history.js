import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * 寫入一筆稽核歷史紀錄
 * @param {object} p
 * @param {string} p.posId
 * @param {"manual_edit"|"import_add"|"import_update"|"import_deactivate"} p.action
 * @param {string} p.field
 * @param {*} p.oldValue
 * @param {*} p.newValue
 * @param {string} p.operator
 */
export async function logHistory({ posId, action, field, oldValue, newValue, operator }) {
  await addDoc(collection(db, "history"), {
    posId,
    action,
    field: field ?? null,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
    operator,
    timestamp: serverTimestamp(),
  });
}

export const ACTION_LABELS = {
  manual_edit: "手動編輯",
  import_add: "匯入新增",
  import_update: "匯入異動",
  import_deactivate: "匯入標記停用",
};
