import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
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
  const [selected, setSelected] = useState({}); // id -> true
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [busy, setBusy] = useState(false);

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

  // 篩選條件改變時,清掉不在目前清單中的選取項目
  useEffect(() => {
    setSelected((prev) => {
      const visibleIds = new Set(filtered.map((d) => d.id));
      const next = {};
      Object.keys(prev).forEach((id) => {
        if (prev[id] && visibleIds.has(id)) next[id] = true;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, osFilter, statusFilter, devices]);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const allVisibleChecked = filtered.length > 0 && filtered.every((d) => selected[d.id]);

  const toggleAllVisible = (checked) => {
    setSelected((prev) => {
      const next = { ...prev };
      filtered.forEach((d) => (next[d.id] = checked));
      return next;
    });
  };

  const handleDeactivate = async (device) => {
    if (!window.confirm(`確定要停用機號 ${device.posId} 嗎?(資料保留,不會刪除歷史紀錄)`)) return;
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

  const hardDeleteDevices = async (list) => {
    setBusy(true);
    const chunks = [];
    for (let i = 0; i < list.length; i += 450) chunks.push(list.slice(i, i + 450));
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((d) => batch.delete(doc(db, "pos_devices", d.id)));
      await batch.commit();
      for (const d of chunk) {
        await logHistory({
          posId: d.posId,
          action: "manual_delete",
          field: null,
          oldValue: null,
          newValue: "永久刪除設備",
          operator: user.email,
        });
      }
    }
    setSelected({});
    setBusy(false);
  };

  const handleDeleteOne = async (device) => {
    if (!window.confirm(`確定要「永久刪除」機號 ${device.posId} 嗎?此動作無法復原(歷史紀錄仍會保留)。`)) return;
    await hardDeleteDevices([device]);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`確定要「永久刪除」已選取的 ${selectedIds.length} 筆設備嗎?此動作無法復原。`)) return;
    const targets = filtered.filter((d) => selected[d.id]);
    await hardDeleteDevices(targets);
  };

  const handleDeleteAllFiltered = async () => {
    await hardDeleteDevices(filtered);
    setConfirmDeleteAll(false);
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
        <button
          className="btn-ghost danger-outline"
          onClick={() => setConfirmDeleteAll(true)}
          disabled={filtered.length === 0 || busy}
        >
          刪除全部(目前清單 {filtered.length} 筆)
        </button>
      </div>

      {selectedIds.length > 0 && (
        <div className="selection-bar">
          <span>已選取 {selectedIds.length} 筆</span>
          <button className="btn-ghost" onClick={() => setSelected({})}>取消選取</button>
          <button className="btn-primary danger" onClick={handleDeleteSelected} disabled={busy}>
            {busy ? "刪除中…" : `刪除選取項目 (${selectedIds.length})`}
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="checkbox-col">
                <input
                  type="checkbox"
                  checked={allVisibleChecked}
                  onChange={(e) => toggleAllVisible(e.target.checked)}
                />
              </th>
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
              <tr key={d.id} className={selected[d.id] ? "row-selected" : ""}>
                <td className="checkbox-col">
                  <input
                    type="checkbox"
                    checked={!!selected[d.id]}
                    onChange={(e) => setSelected((s) => ({ ...s, [d.id]: e.target.checked }))}
                  />
                </td>
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
                  <button className="btn-link" onClick={() => handleDeactivate(d)}>停用</button>
                  <button className="btn-link danger" onClick={() => handleDeleteOne(d)}>刪除</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">找不到符合條件的設備</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditModal device={editing} onClose={() => setEditing(null)} operator={user.email} />
      )}

      {confirmDeleteAll && (
        <DeleteAllModal
          count={filtered.length}
          busy={busy}
          onCancel={() => setConfirmDeleteAll(false)}
          onConfirm={handleDeleteAllFiltered}
        />
      )}
    </div>
  );
}

function DeleteAllModal({ count, busy, onCancel, onConfirm }) {
  const [text, setText] = useState("");
  const ready = text.trim() === "刪除";

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>⚠️ 永久刪除 {count} 筆設備</h2>
        <p className="modal-warning">
          此動作會將目前清單上顯示的 {count} 筆設備從資料庫**永久刪除**,無法復原(歷史紀錄本身會保留,但設備資料不會)。
          若只是想暫時移除、日後還想找回,請改用「停用」。
        </p>
        <label className="confirm-input-label">
          請輸入「刪除」以確認
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="刪除" autoFocus />
        </label>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>取消</button>
          <button className="btn-primary danger" onClick={onConfirm} disabled={!ready || busy}>
            {busy ? "刪除中…" : "確認永久刪除"}
          </button>
        </div>
      </div>
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
