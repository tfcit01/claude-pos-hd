import { useMemo } from "react";
import { HD_STATUS_OPTIONS, HD_STATUS_COLORS } from "../constants";
import taipei101 from "../assets/taipei101.png";

// 購物中心樓層固定顯示順序(由高到低)
const MALL_ORDER = ["6F", "4F", "3F", "2F", "1F", "B1F", "其他"];

export default function FloorStatusMap({ devices }) {
  const { floorMap, towerFloors, unassignedCount, grandTotal } = useMemo(() => {
    const active = (devices || []).filter((d) => d.status !== "inactive");
    const map = {};
    let unassigned = 0;

    active.forEach((d) => {
      const floor = d.floor;
      if (!floor) {
        unassigned++;
        return;
      }
      if (!map[floor]) {
        map[floor] = { total: 0, byStatus: Object.fromEntries(HD_STATUS_OPTIONS.map((s) => [s, 0])) };
      }
      map[floor].total++;
      if (d.hdStatus && map[floor].byStatus[d.hdStatus] !== undefined) {
        map[floor].byStatus[d.hdStatus]++;
      }
    });

    const tower = Object.keys(map)
      .filter((f) => f.startsWith("大樓"))
      .sort((a, b) => {
        const na = parseInt(a.replace(/[^\d]/g, ""), 10) || 0;
        const nb = parseInt(b.replace(/[^\d]/g, ""), 10) || 0;
        return nb - na; // 樓層高→低
      });

    return { floorMap: map, towerFloors: tower, unassignedCount: unassigned, grandTotal: active.length };
  }, [devices]);

  if (grandTotal === 0) {
    return <div className="empty-state small">尚無設備資料,無法顯示樓層分佈</div>;
  }

  return (
    <div>
      <div className="building-map">
        <div className="bm-col bm-mall">
          <div className="bm-col-title mall">購物中心</div>
          {MALL_ORDER.map((f) => (
            <FloorRow key={f} label={f} data={floorMap[f]} align="right" />
          ))}
        </div>

        <div className="bm-img-col">
          <img src={taipei101} alt="台北101建築外觀" className="bm-img" />
        </div>

        <div className="bm-col bm-tower">
          <div className="bm-col-title tower">大樓</div>
          {towerFloors.length === 0 && <div className="bm-empty">尚無大樓樓層資料</div>}
          {towerFloors.map((f) => (
            <FloorRow key={f} label={f} data={floorMap[f]} align="left" />
          ))}
        </div>
      </div>

      <div className="bm-legend">
        {HD_STATUS_OPTIONS.map((s) => (
          <span key={s} className="legend-item">
            <i style={{ background: HD_STATUS_COLORS[s] }} />
            {s}
          </span>
        ))}
        <span className="legend-item">
          <i style={{ background: "transparent", border: "1px solid var(--border)" }} />
          — 無設備
        </span>
      </div>

      {unassignedCount > 0 && (
        <div className="bm-unassigned">
          另有 {unassignedCount} 台設備尚未設定樓層,可到「設備清單」使用「依機號規則自動補齊樓層」。
        </div>
      )}
    </div>
  );
}

function FloorRow({ label, data, align }) {
  const total = data?.total || 0;

  const bar = total > 0 && (
    <div className="floor-bar" title={`${label}:共 ${total} 台`}>
      {HD_STATUS_OPTIONS.map((s) => {
        const count = data.byStatus[s];
        if (!count) return null;
        return (
          <span
            key={s}
            className="floor-bar-seg"
            style={{ width: `${(count / total) * 100}%`, background: HD_STATUS_COLORS[s] }}
          />
        );
      })}
    </div>
  );

  const countEl =
    total > 0 ? <span className="floor-count">{total} 台</span> : <span className="floor-count muted">—</span>;
  const labelEl = <span className="floor-label">{label}</span>;

  return (
    <div className={`floor-row ${align === "right" ? "align-right" : "align-left"}`}>
      {align === "right" ? (
        <>
          {bar}
          {countEl}
          {labelEl}
        </>
      ) : (
        <>
          {labelEl}
          {bar}
          {countEl}
        </>
      )}
    </div>
  );
}
