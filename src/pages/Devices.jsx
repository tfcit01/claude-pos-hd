import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { HD_STATUS_COLORS, HD_STATUS_OPTIONS, OS_OPTIONS, FIELD_LABELS } from "../constants";
import { logHistory } from "../lib/history";

export default function Devices() {
  const { user } = useAuth();
  const [devices, setDevices] = useState(null);
  const [search, setSearch] = useState("");
  const [osFilter, setOsFilter] = useState("全部");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [editing, setEditing] = useState(null); // device object or null

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pos_devices"), (snap) => {
      setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    if (!devices) return [];
    return devices
      .filter((d) => d.status !== "inactive")
      .filter((d) => (osFilter === "全部" ? true : d.os === osFilter))
      .filter((d) => (statusFilter === "全部" ? true : d.hdStatus === statusFilter))
      .filter((d) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          d.posId?.toLowerCase().includes(q) ||
          d.storeName?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.posId || "").localeCompare(b.posId || ""));
  }, [devices, search, osFilter, statusFilter]);

  const handleDelete = async (device) => {
    if (!window.confirm(`確定要停用機號 ${device.posId} 嗎?(不會刪除歷史紀錄)`)) return;
    await updateDoc(doc(db, "pos_devices", device.id), {
      status: "inactive",
      lastUpdated: serverTimestamp(),
      lastUpdatedBy: user.email,
    });
    await logHistory({
      posId: device.posId,
      action: "manual_edit",
      field: "status",
      oldValue: "active",
      newValue: "inactive",
      operator: user.email,
    });
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>設備清單</h1>
        <p>{devices ? `共 ${filtered.length} 筆(全部 ${devices.filter((d) => d.status !== "inactive").length} 台)` : "載入中…"}</p>
      </header>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="搜尋 POS機號 或 店櫃名稱"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={osFilter} onChange={(e) => setOsFilter(e.target.value)}>
          <option>全部</option>
          {OS_OPTIONS.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option>全部</option>
          {HD_STATUS_OPTIONS.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>POS機號</th>
              <th>店櫃名稱</th>
              <th>作業系統</th>
              <th>硬碟更換狀態</th>
              <th>硬碟版號</th>
              <th>發票機驅動版本</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id}>
                <td className="mono">{d.posId}</td>
                <td>{d.storeName}</td>
                <td>{d.os}</td>
                <td>
                  <span className="status-pill" style={{ "--c": HD_STATUS_COLORS[d.hdStatus] }}>
                    {d.hdStatus}
                  </span>
                </td>
                <td className="mono">{d.hdVersion || "—"}</td>
                <td className="mono">{d.printerDriverVer || "—"}</td>
                <td className="row-actions">
                  <button className="btn-link" onClick={() => setEditing(d)}>編輯</button>
                  <button className="btn-link danger" onClick={() => handleDelete(d)}>停用</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">找不到符合條件的設備</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditModal device={editing} onClose={() => setEditing(null)} operator={user.email} />
      )}
    </div>
  );
}

function EditModal({ device, onClose, operator }) {
  const [form, setForm] = useState({ ...device });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const changedFields = ["storeName", "os", "hdStatus", "hdVersion", "printerDriverVer"].filter(
      (k) => (device[k] ?? "") !== (form[k] ?? "")
    );

    if (changedFields.length > 0) {
      await updateDoc(doc(db, "pos_devices", device.id), {
        ...Object.fromEntries(changedFields.map((k) => [k, form[k]])),
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: operator,
      });
      for (const field of changedFields) {
        await logHistory({
          posId: device.posId,
          action: "manual_edit",
          field: FIELD_LABELS[field],
          oldValue: device[field] ?? "",
          newValue: form[field] ?? "",
          operator,
        });
      }
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>編輯設備 · {device.posId}</h2>
        <div className="modal-grid">
          <label>
            店櫃名稱
            <input value={form.storeName || ""} onChange={(e) => set("storeName", e.target.value)} />
          </label>
          <label>
            作業系統
            <select value={form.os || ""} onChange={(e) => set("os", e.target.value)}>
              {OS_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            硬碟更換狀態
            <select value={form.hdStatus || ""} onChange={(e) => set("hdStatus", e.target.value)}>
              {HD_STATUS_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            硬碟版號
            <input value={form.hdVersion || ""} onChange={(e) => set("hdVersion", e.target.value)} />
          </label>
          <label className="span-2">
            發票機驅動程式版本
            <input
              value={form.printerDriverVer || ""}
              onChange={(e) => set("printerDriverVer", e.target.value)}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "儲存中…" : "儲存變更"}
          </button>
        </div>
      </div>
    </div>
  );
}
