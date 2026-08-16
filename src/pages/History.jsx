import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { db } from "../firebase";
import { ACTION_LABELS } from "../lib/history";

export default function History() {
  const [records, setRecords] = useState(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("全部");

  useEffect(() => {
    const q = query(collection(db, "history"), orderBy("timestamp", "desc"), limit(500));
    const unsub = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    if (!records) return [];
    return records
      .filter((r) => (actionFilter === "全部" ? true : r.action === actionFilter))
      .filter((r) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return r.posId?.toLowerCase().includes(q) || r.operator?.toLowerCase().includes(q);
      });
  }, [records, search, actionFilter]);

  return (
    <div className="page">
      <header className="page-header">
        <h1>歷史紀錄</h1>
        <p>所有匯入與手動編輯的異動軌跡(僅供新增,不可竄改)</p>
      </header>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="搜尋 POS機號 或 操作人員"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option>全部</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>時間</th>
              <th>POS機號</th>
              <th>類型</th>
              <th>欄位</th>
              <th>舊值 → 新值</th>
              <th>操作人員</th>
            </tr>
          </thead>
          <tbody>
            {records === null && (
              <tr><td colSpan={6} className="empty-row">載入中…</td></tr>
            )}
            {records !== null && filtered.length === 0 && (
              <tr><td colSpan={6} className="empty-row">尚無紀錄</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="mono">{formatTime(r.timestamp)}</td>
                <td className="mono">{r.posId}</td>
                <td>{ACTION_LABELS[r.action] || r.action}</td>
                <td>{r.field || "—"}</td>
                <td>
                  {r.field ? (
                    <span className="field-diff inline">
                      <span className="old-val">{r.oldValue || "（空）"}</span>
                      <span className="arrow">→</span>
                      <span className="new-val">{r.newValue || "（空）"}</span>
                    </span>
                  ) : "—"}
                </td>
                <td>{r.operator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatTime(ts) {
  if (!ts?.toDate) return "…";
  return ts.toDate().toLocaleString("zh-TW", { hour12: false });
}
