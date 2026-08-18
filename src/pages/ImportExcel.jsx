import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { parseExcelFile, computeDiff } from "../lib/excelDiff";
import { logHistory } from "../lib/history";
import { computeFloorFromPosId } from "../lib/floor";
import { FIELD_LABELS, HD_STATUS_OPTIONS, OS_OPTIONS } from "../constants";

const STEPS = ["upload", "review", "done"];

export default function ImportExcel() {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [step, setStep] = useState("upload");
  const [fileName, setFileName] = useState("");
  const [parseWarnings, setParseWarnings] = useState(null);
  const [diff, setDiff] = useState(null);
  const [existingDevices, setExistingDevices] = useState(null);
  const [selectedAdded, setSelectedAdded] = useState({});
  const [selectedChanged, setSelectedChanged] = useState({});
  const [missingActions, setMissingActions] = useState({}); // posId -> 'keep' | 'deactivate'
  const [applying, setApplying] = useState(false);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pos_devices"), (snap) => {
      setExistingDevices(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => d.status !== "inactive")
      );
    });
    return unsub;
  }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !existingDevices) return;
    setFileName(file.name);
    const { rows, unmappedColumns, missingRequiredFields } = await parseExcelFile(file);

    if (missingRequiredFields.length > 0) {
      setParseWarnings({ fatal: true, missingRequiredFields, unmappedColumns });
      return;
    }

    const d = computeDiff(rows, existingDevices);
    setDiff(d);
    setSelectedAdded(Object.fromEntries(d.added.map((r) => [r.posId, true])));
    setSelectedChanged(Object.fromEntries(d.changed.map((c) => [c.posId, true])));
    setMissingActions(Object.fromEntries(d.missing.map((m) => [m.posId, "keep"])));
    setParseWarnings(unmappedColumns.length > 0 ? { fatal: false, unmappedColumns } : null);
    setStep("review");
  };

  const handleApply = async () => {
    setApplying(true);
    const batch = writeBatch(db);
    let addCount = 0, updateCount = 0, deactivateCount = 0;
    const historyEntries = [];

    for (const row of diff.added) {
      if (!selectedAdded[row.posId]) continue;
      const ref = doc(collection(db, "pos_devices"), row.posId);
      batch.set(ref, {
        storeName: row.storeName || "",
        posId: row.posId,
        floor: computeFloorFromPosId(row.posId),
        os: row.os || "",
        hdStatus: row.hdStatus && HD_STATUS_OPTIONS.includes(row.hdStatus) ? row.hdStatus : "未排程",
        hdVersion: row.hdVersion || "",
        printerDriverVer: row.printerDriverVer || "",
        scheduledDate: "",
        completedDate: "",
        pauseReason: "",
        status: "active",
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: user.email,
      });
      addCount++;
      historyEntries.push({ posId: row.posId, action: "import_add", field: null, oldValue: null, newValue: "新增設備", operator: user.email });
    }

    for (const c of diff.changed) {
      if (!selectedChanged[c.posId]) continue;
      const ref = doc(collection(db, "pos_devices"), c.existing.id);
      const patch = {};
      c.fieldChanges.forEach((fc) => (patch[fc.field] = fc.newValue));
      batch.update(ref, { ...patch, lastUpdated: serverTimestamp(), lastUpdatedBy: user.email });
      updateCount++;
      c.fieldChanges.forEach((fc) =>
        historyEntries.push({
          posId: c.posId,
          action: "import_update",
          field: FIELD_LABELS[fc.field],
          oldValue: fc.oldValue,
          newValue: fc.newValue,
          operator: user.email,
        })
      );
    }

    for (const m of diff.missing) {
      if (missingActions[m.posId] !== "deactivate") continue;
      const ref = doc(collection(db, "pos_devices"), m.id);
      batch.update(ref, { status: "inactive", lastUpdated: serverTimestamp(), lastUpdatedBy: user.email });
      deactivateCount++;
      historyEntries.push({ posId: m.posId, action: "import_deactivate", field: "status", oldValue: "active", newValue: "inactive", operator: user.email });
    }

    await batch.commit();
    for (const h of historyEntries) await logHistory(h);

    setSummary({ addCount, updateCount, deactivateCount });
    setApplying(false);
    setStep("done");
  };

  const reset = () => {
    setStep("upload");
    setDiff(null);
    setParseWarnings(null);
    setSummary(null);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Excel 匯入</h1>
        <p>依 POS機號比對現有資料,人工確認後才會更新至系統</p>
      </header>

      <div className="stepper">
        {["上傳檔案", "比對確認", "完成"].map((label, i) => (
          <div key={label} className={"step" + (STEPS[i] === step ? " active" : "")}>
            <span className="step-num">{i + 1}</span>
            {label}
          </div>
        ))}
      </div>

      {step === "upload" && (
        <div className="upload-card">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} />
          <p className="upload-hint">
            檔案需包含欄位:店櫃名稱、POS機號、作業系統、完成硬碟更換、硬碟版號、發票機驅動程式版本(欄位名稱可有些微差異,系統會自動辨識)
          </p>
          {parseWarnings?.fatal && (
            <div className="form-error">
              找不到必要欄位:{parseWarnings.missingRequiredFields.join("、")}。請確認 Excel 第一列為欄位標題。
            </div>
          )}
        </div>
      )}

      {step === "review" && diff && (
        <ReviewPanel
          fileName={fileName}
          diff={diff}
          parseWarnings={parseWarnings}
          selectedAdded={selectedAdded}
          setSelectedAdded={setSelectedAdded}
          selectedChanged={selectedChanged}
          setSelectedChanged={setSelectedChanged}
          missingActions={missingActions}
          setMissingActions={setMissingActions}
          onCancel={reset}
          onApply={handleApply}
          applying={applying}
        />
      )}

      {step === "done" && summary && (
        <div className="done-card">
          <div className="done-icon">✓</div>
          <h2>匯入完成</h2>
          <ul>
            <li>新增 {summary.addCount} 台</li>
            <li>更新 {summary.updateCount} 台</li>
            <li>標記停用 {summary.deactivateCount} 台</li>
          </ul>
          <button className="btn-primary" onClick={reset}>再匯入一次</button>
        </div>
      )}
    </div>
  );
}

function ReviewPanel({
  fileName, diff, parseWarnings,
  selectedAdded, setSelectedAdded,
  selectedChanged, setSelectedChanged,
  missingActions, setMissingActions,
  onCancel, onApply, applying,
}) {
  const addedCount = Object.values(selectedAdded).filter(Boolean).length;
  const changedCount = Object.values(selectedChanged).filter(Boolean).length;
  const deactivateCount = Object.values(missingActions).filter((v) => v === "deactivate").length;
  const noChanges = diff.added.length === 0 && diff.changed.length === 0 && diff.missing.length === 0;

  return (
    <div className="review-panel">
      <div className="review-file">
        已解析檔案:<strong>{fileName}</strong>
        {parseWarnings && !parseWarnings.fatal && parseWarnings.unmappedColumns.length > 0 && (
          <div className="form-warning">
            未辨識欄位(已忽略):{parseWarnings.unmappedColumns.join("、")}
          </div>
        )}
      </div>

      {noChanges && <div className="empty-state small">Excel 內容與現有資料完全一致,沒有需要異動的項目。</div>}

      {diff.added.length > 0 && (
        <section className="diff-section">
          <h3>🆕 新增 ({diff.added.length})</h3>
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" checked={addedCount === diff.added.length} onChange={(e) => setSelectedAdded(Object.fromEntries(diff.added.map((r) => [r.posId, e.target.checked])))} /></th>
                <th>POS機號</th><th>店櫃名稱</th><th>作業系統</th><th>硬碟更換狀態</th>
              </tr>
            </thead>
            <tbody>
              {diff.added.map((r) => (
                <tr key={r.posId}>
                  <td><input type="checkbox" checked={!!selectedAdded[r.posId]} onChange={(e) => setSelectedAdded((s) => ({ ...s, [r.posId]: e.target.checked }))} /></td>
                  <td className="mono">{r.posId}</td>
                  <td>{r.storeName}</td>
                  <td>{r.os}</td>
                  <td>{r.hdStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {diff.changed.length > 0 && (
        <section className="diff-section">
          <h3>🔄 異動 ({diff.changed.length})</h3>
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" checked={changedCount === diff.changed.length} onChange={(e) => setSelectedChanged(Object.fromEntries(diff.changed.map((c) => [c.posId, e.target.checked])))} /></th>
                <th>POS機號</th><th>店櫃名稱</th><th>異動欄位</th>
              </tr>
            </thead>
            <tbody>
              {diff.changed.map((c) => (
                <tr key={c.posId}>
                  <td><input type="checkbox" checked={!!selectedChanged[c.posId]} onChange={(e) => setSelectedChanged((s) => ({ ...s, [c.posId]: e.target.checked }))} /></td>
                  <td className="mono">{c.posId}</td>
                  <td>{c.existing.storeName}</td>
                  <td>
                    {c.fieldChanges.map((fc) => (
                      <div key={fc.field} className="field-diff">
                        <span className="field-name">{FIELD_LABELS[fc.field]}</span>
                        <span className="old-val">{fc.oldValue || "（空）"}</span>
                        <span className="arrow">→</span>
                        <span className="new-val">{fc.newValue || "（空）"}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {diff.missing.length > 0 && (
        <section className="diff-section">
          <h3>⚠️ 資料庫多出的機號,此次 Excel 未列出 ({diff.missing.length})</h3>
          <table>
            <thead>
              <tr><th>POS機號</th><th>店櫃名稱</th><th>處理方式</th></tr>
            </thead>
            <tbody>
              {diff.missing.map((m) => (
                <tr key={m.posId}>
                  <td className="mono">{m.posId}</td>
                  <td>{m.storeName}</td>
                  <td>
                    <select
                      value={missingActions[m.posId] || "keep"}
                      onChange={(e) => setMissingActions((s) => ({ ...s, [m.posId]: e.target.value }))}
                    >
                      <option value="keep">保留不動</option>
                      <option value="deactivate">標記停用</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="review-actions">
        <button className="btn-ghost" onClick={onCancel}>取消</button>
        <button className="btn-primary" onClick={onApply} disabled={applying || noChanges}>
          {applying ? "套用中…" : `套用勾選項目(新增${addedCount}‧更新${changedCount}‧停用${deactivateCount})`}
        </button>
      </div>
    </div>
  );
}
