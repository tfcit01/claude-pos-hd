import * as XLSX from "xlsx";
import { FIELD_ALIASES, HD_STATUS_OPTIONS } from "../constants";

const CANONICAL_FIELDS = ["storeName", "posId", "os", "hdStatus", "hdVersion", "printerDriverVer"];
const COMPARE_FIELDS = ["storeName", "os", "hdStatus", "hdVersion", "printerDriverVer"];

function normalizeHeader(h) {
  return String(h ?? "").trim().toLowerCase();
}

function buildHeaderMap(headerRow) {
  const map = {}; // columnIndex -> canonical field
  headerRow.forEach((raw, idx) => {
    const h = normalizeHeader(raw);
    if (!h) return;
    for (const field of CANONICAL_FIELDS) {
      const aliases = FIELD_ALIASES[field].map(normalizeHeader);
      if (aliases.includes(h)) {
        map[idx] = field;
        break;
      }
    }
  });
  return map;
}

function normalizeStatus(raw) {
  const v = String(raw ?? "").trim();
  if (HD_STATUS_OPTIONS.includes(v)) return v;
  if (["是", "已完成", "完成", "yes", "y", "true"].includes(v.toLowerCase())) return "已完成";
  if (["否", "未完成", "no", "n", "false", ""].includes(v.toLowerCase())) return "未排程";
  return v; // 保留原始值,交由使用者於畫面上判斷
}

function normalizeOs(raw) {
  const v = String(raw ?? "").trim().toUpperCase();
  if (v.includes("10")) return "WIN10";
  if (v.includes("7")) return "WIN7";
  return v;
}

/**
 * 解析 Excel 檔案為標準化的設備資料陣列
 * 回傳 { rows, unmappedColumns, missingRequiredFields }
 */
export async function parseExcelFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (raw.length === 0) {
    return { rows: [], unmappedColumns: [], missingRequiredFields: ["整份檔案沒有內容"] };
  }

  const headerRow = raw[0];
  const colMap = buildHeaderMap(headerRow);
  const mappedFields = new Set(Object.values(colMap));
  const missingRequiredFields = ["storeName", "posId"].filter((f) => !mappedFields.has(f));
  const unmappedColumns = headerRow.filter((_, idx) => !(idx in colMap) && String(headerRow[idx]).trim() !== "");

  const rows = [];
  for (let r = 1; r < raw.length; r++) {
    const line = raw[r];
    if (!line || line.every((c) => String(c).trim() === "")) continue;
    const entry = {};
    Object.entries(colMap).forEach(([idx, field]) => {
      entry[field] = String(line[idx] ?? "").trim();
    });
    if (!entry.posId) continue; // 沒有機號的列略過
    entry.os = normalizeOs(entry.os);
    entry.hdStatus = normalizeStatus(entry.hdStatus);
    rows.push(entry);
  }

  return { rows, unmappedColumns, missingRequiredFields };
}

/**
 * 比對匯入資料與現有 Firestore 資料
 * @param {Array} importRows 已標準化的匯入資料
 * @param {Array} existingDevices 現有 pos_devices(僅 active)
 */
export function computeDiff(importRows, existingDevices) {
  const existingMap = new Map(existingDevices.map((d) => [d.posId, d]));
  const importIds = new Set(importRows.map((r) => r.posId));

  const added = [];
  const changed = [];

  for (const row of importRows) {
    const existing = existingMap.get(row.posId);
    if (!existing) {
      added.push(row);
      continue;
    }
    const fieldChanges = COMPARE_FIELDS.filter(
      (f) => (existing[f] ?? "") !== (row[f] ?? "")
    ).map((f) => ({ field: f, oldValue: existing[f] ?? "", newValue: row[f] ?? "" }));
    if (fieldChanges.length > 0) {
      changed.push({ posId: row.posId, row, existing, fieldChanges });
    }
  }

  const missing = existingDevices.filter((d) => !importIds.has(d.posId));

  return { added, changed, missing };
}
