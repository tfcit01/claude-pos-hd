// 硬碟更換狀態(多階段)
export const HD_STATUS_OPTIONS = ["未排程", "已排程", "施工中", "已完成", "異常暫緩"];

export const HD_STATUS_COLORS = {
  未排程: "#94A3B8",
  已排程: "#D89614",
  施工中: "#2F6FED",
  已完成: "#16A34A",
  異常暫緩: "#DC2626",
};

export const OS_OPTIONS = ["WIN7", "WIN10"];

// Firestore 欄位對應到 Excel 匯入時可能出現的中文欄名(容錯用)
export const FIELD_ALIASES = {
  storeName: ["店櫃名稱", "店櫃", "storeName"],
  posId: ["POS機號", "POS 機號", "機號", "posId"],
  os: ["作業系統", "OS", "os"],
  hdStatus: ["完成硬碟更換", "硬碟更換狀態", "hdStatus"],
  hdVersion: ["硬碟版號", "hdVersion"],
  printerDriverVer: ["發票機驅動程式版本", "發票機驅動程式", "printerDriverVer"],
};

export const FIELD_LABELS = {
  storeName: "店櫃名稱",
  posId: "POS機號",
  floor: "樓層",
  os: "作業系統",
  hdStatus: "硬碟更換狀態",
  hdVersion: "硬碟版號",
  printerDriverVer: "發票機驅動程式版本",
};
