import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { HD_STATUS_OPTIONS, HD_STATUS_COLORS } from "../constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import FloorStatusMap from "../components/FloorStatusMap";

const REMAINING_COLOR = "#D8DEE8";

export default function Dashboard() {
  const [devices, setDevices] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pos_devices"), (snap) => {
      setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const stats = useMemo(() => {
    if (!devices) return null;
    const active = devices.filter((d) => d.status !== "inactive");
    const byStatus = HD_STATUS_OPTIONS.map((s) => ({
      name: s,
      value: active.filter((d) => d.hdStatus === s).length,
    }));
    const byOs = ["WIN7", "WIN10"].map((os) => {
      const osDevices = active.filter((d) => d.os === os);
      const total = osDevices.length;
      const done = osDevices.filter((d) => d.hdStatus === "已完成").length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      return { name: os, total, done, remaining: total - done, pctLabel: total ? `${pct}%` : "" };
    });
    const total = active.length;
    const done = byStatus.find((s) => s.name === "已完成")?.value ?? 0;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { byStatus, byOs, total, done, pct };
  }, [devices]);

  if (!stats) {
    return <div className="page-loading">載入設備資料中…</div>;
  }

  if (stats.total === 0) {
    return (
      <div className="empty-state">
        <h2>還沒有任何設備資料</h2>
        <p>請先前往「Excel 匯入」頁面上傳全館 POS 設備清單。</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>儀表板</h1>
        <p>全館 {stats.total} 台設備 · 硬碟更換進度總覽</p>
      </header>

      <section className="progress-hero">
        <div className="progress-hero-num">
          {stats.pct}<span>%</span>
        </div>
        <div className="progress-hero-body">
          <div className="progress-hero-label">
            已完成 {stats.done} / {stats.total} 台
          </div>
          <div className="stacked-bar">
            {stats.byStatus.map((s) =>
              s.value > 0 ? (
                <div
                  key={s.name}
                  className="stacked-seg"
                  style={{
                    width: `${(s.value / stats.total) * 100}%`,
                    background: HD_STATUS_COLORS[s.name],
                  }}
                  title={`${s.name}: ${s.value}`}
                />
              ) : null
            )}
          </div>
          <div className="stacked-legend">
            {stats.byStatus.map((s) => (
              <span key={s.name} className="legend-item">
                <i style={{ background: HD_STATUS_COLORS[s.name] }} />
                {s.name} {s.value}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="stat-grid">
        {stats.byStatus.map((s) => (
          <div className="stat-card" key={s.name}>
            <span className="stat-dot" style={{ background: HD_STATUS_COLORS[s.name] }} />
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.name}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="dashboard-row">
        <div className="chart-card building-card">
          <h3>硬碟狀態分佈</h3>
          <FloorStatusMap devices={devices} />
        </div>

        <div className="chart-card os-card">
          <h3>作業系統分布</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.byOs} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
              <XAxis dataKey="name" stroke="#7C8698" fontSize={13} />
              <YAxis stroke="#7C8698" fontSize={13} allowDecimals={false} />
              <Tooltip
                formatter={(value, key) => [value, key === "done" ? "已完成" : "未完成"]}
              />
              <Bar dataKey="done" stackId="os" fill={HD_STATUS_COLORS["已完成"]} radius={[0, 0, 0, 0]} />
              <Bar dataKey="remaining" stackId="os" fill={REMAINING_COLOR} radius={[6, 6, 0, 0]}>
                <LabelList dataKey="pctLabel" position="top" fontSize={13} fontWeight={700} fill="#16A34A" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="os-legend">
            <span className="legend-item"><i style={{ background: HD_STATUS_COLORS["已完成"] }} />已完成</span>
            <span className="legend-item"><i style={{ background: REMAINING_COLOR }} />未完成</span>
          </div>
        </div>
      </section>
    </div>
  );
}
