import { useState, useEffect, useCallback } from "react";

// ─── Supabase (keep as-is from previous version) ─────────────────
// import { supabase } from './supabase.js';

// ─── Storage (localStorage fallback for demo) ─────────────────────
const STORAGE_KEY = "bball-app-v3";
function loadData() {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : {};
  } catch { return {}; }
}
function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const ym = (date) => date.slice(0, 7);
const fmtYen = (n) => `¥${Number(n || 0).toLocaleString()}`;

function newRecord(date) {
  return {
    date,
    solos: [],
    teams: [],
    games: [],
    otetsudai: [],   // [{menuId, name, amount, count}]
    daySummary: { memo: "", good: "", reflect: "", next: "" },
    parentComment: "",
  };
}

function newLedger() {
  return { id: Date.now(), date: today(), type: "income", category: "", memo: "", amount: "" };
}

// ─── Default otetsudai menus ──────────────────────────────────────
const DEFAULT_OTETSUDAI_MENUS = [
  { id: "o1", name: "皿洗い", amount: 50 },
  { id: "o2", name: "掃除機かけ", amount: 100 },
  { id: "o3", name: "洗濯物たたみ", amount: 50 },
  { id: "o4", name: "ゴミ出し", amount: 30 },
  { id: "o5", name: "買い物", amount: 100 },
];

// ─── Colors ──────────────────────────────────────────────────────
const C = {
  bg: "#0f1117",
  card: "#1a1d27",
  card2: "#222638",
  border: "#2e3248",
  accent: "#4f8ef7",
  green: "#1DB954",
  orange: "#E8A020",
  red: "#e05555",
  yellow: "#f0c040",
  text: "#e8eaf0",
  muted: "#7b80a0",
};

// ─── Styles ──────────────────────────────────────────────────────
const S = {
  app: {
    minHeight: "100vh",
    background: C.bg,
    color: C.text,
    fontFamily: "'Noto Sans JP', 'M PLUS Rounded 1c', sans-serif",
    fontSize: 14,
  },
  header: {
    background: C.card,
    borderBottom: `1px solid ${C.border}`,
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  title: { fontSize: 16, fontWeight: 700, color: C.accent, margin: 0 },
  section: {
    background: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    border: `1px solid ${C.border}`,
  },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 },
  btn: (color = C.accent) => ({
    background: color,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  }),
  btnOutline: (color = C.accent) => ({
    background: "transparent",
    color: color,
    border: `1px solid ${color}`,
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    cursor: "pointer",
  }),
  input: {
    background: C.card2,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    padding: "8px 10px",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  },
  label: { fontSize: 12, color: C.muted, marginBottom: 4, display: "block" },
  row: { display: "flex", gap: 8, marginBottom: 8 },
  tag: (color) => ({
    display: "inline-block",
    background: color + "22",
    color,
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 700,
  }),
  pill: (color) => ({
    background: color,
    color: "#fff",
    borderRadius: 20,
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 700,
    display: "inline-block",
  }),
  drawer: (open) => ({
    position: "fixed",
    top: 0,
    left: 0,
    width: 240,
    height: "100vh",
    background: C.card,
    borderRight: `1px solid ${C.border}`,
    zIndex: 200,
    transform: open ? "translateX(0)" : "translateX(-100%)",
    transition: "transform 0.25s ease",
    padding: 20,
    boxSizing: "border-box",
    overflowY: "auto",
  }),
  overlay: (open) => ({
    display: open ? "block" : "none",
    position: "fixed",
    inset: 0,
    background: "#0009",
    zIndex: 190,
  }),
};

// ─── Main App ────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("diary");     // diary | otetsudaiMenu | ledger | stats
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today());
  const [allData, setAllData] = useState(() => loadData());

  // meta
  const [otetsudaiMenus, setOtetsudaiMenus] = useState(
    () => allData.__otetsudaiMenus || DEFAULT_OTETSUDAI_MENUS
  );
  const [ledger, setLedger] = useState(() => allData.__ledger || []);

  // records keyed by date
  const [records, setRecords] = useState(() => allData.__records || {});

  // persist
  useEffect(() => {
    const d = { __otetsudaiMenus: otetsudaiMenus, __ledger: ledger, __records: records };
    saveData(d);
    setAllData(d);
  }, [otetsudaiMenus, ledger, records]);

  const getRecord = (date) => records[date] || newRecord(date);
  const setRecord = (date, rec) => setRecords(prev => ({ ...prev, [date]: rec }));

  // ── Otetsudai totals ──────────────────────────────────────────
  const otetsudaiTotals = useCallback(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisYear = `${now.getFullYear()}`;
    let monthly = 0, yearly = 0;
    Object.entries(records).forEach(([date, rec]) => {
      const amt = (rec.otetsudai || []).reduce((s, o) => s + (o.amount * (o.count || 1)), 0);
      if (date.startsWith(thisMonth)) monthly += amt;
      if (date.startsWith(thisYear)) yearly += amt;
    });
    return { monthly, yearly };
  }, [records]);

  const { monthly: monthlyOte, yearly: yearlyOte } = otetsudaiTotals();

  // ── Ledger totals ─────────────────────────────────────────────
  const ledgerTotals = useCallback(() => {
    const income = ledger.filter(e => e.type === "income").reduce((s, e) => s + Number(e.amount || 0), 0);
    const expense = ledger.filter(e => e.type === "expense").reduce((s, e) => s + Number(e.amount || 0), 0);
    return { income, expense, balance: income - expense };
  }, [ledger]);

  const { income: totalIncome, expense: totalExpense, balance } = ledgerTotals();

  const nav = (p) => { setPage(p); setDrawerOpen(false); };

  return (
    <div style={S.app}>
      {/* Overlay */}
      <div style={S.overlay(drawerOpen)} onClick={() => setDrawerOpen(false)} />

      {/* Drawer */}
      <div style={S.drawer(drawerOpen)}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.accent, marginBottom: 24 }}>🏀 メニュー</div>
        {[
          { key: "diary", icon: "📅", label: "日々の記録" },
          { key: "otetsudaiMenu", icon: "🧹", label: "お手伝いリスト" },
          { key: "ledger", icon: "💰", label: "小遣い帳" },
          { key: "stats", icon: "📊", label: "統計" },
        ].map(({ key, icon, label }) => (
          <div
            key={key}
            onClick={() => nav(key)}
            style={{
              padding: "12px 10px",
              borderRadius: 10,
              marginBottom: 6,
              cursor: "pointer",
              background: page === key ? C.accent + "22" : "transparent",
              color: page === key ? C.accent : C.text,
              fontWeight: page === key ? 700 : 400,
              fontSize: 14,
            }}
          >
            {icon} {label}
          </div>
        ))}

        {/* Otetsudai summary in drawer */}
        <div style={{ marginTop: 24, padding: 12, background: C.card2, borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>🧹 お手伝い収入</div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>今月 <span style={{ color: C.orange, fontWeight: 700 }}>{fmtYen(monthlyOte)}</span></div>
          <div style={{ fontSize: 12 }}>今年 <span style={{ color: C.yellow, fontWeight: 700 }}>{fmtYen(yearlyOte)}</span></div>
        </div>
      </div>

      {/* Header */}
      <header style={S.header}>
        <button
          style={{ background: "none", border: "none", cursor: "pointer", color: C.text, fontSize: 20, padding: 0 }}
          onClick={() => setDrawerOpen(true)}
        >☰</button>
        <div style={S.title}>
          {page === "diary" && "📅 日々の記録"}
          {page === "otetsudaiMenu" && "🧹 お手伝いリスト"}
          {page === "ledger" && "💰 小遣い帳"}
          {page === "stats" && "📊 統計"}
        </div>
        <div style={{ width: 32 }} />
      </header>

      {/* Otetsudai top bar */}
      <div style={{ background: C.card2, borderBottom: `1px solid ${C.border}`, padding: "8px 16px", display: "flex", gap: 16 }}>
        <span style={{ fontSize: 12 }}>🧹 今月 <strong style={{ color: C.orange }}>{fmtYen(monthlyOte)}</strong></span>
        <span style={{ fontSize: 12 }}>📅 今年 <strong style={{ color: C.yellow }}>{fmtYen(yearlyOte)}</strong></span>
        <span style={{ fontSize: 12 }}>💰 残高 <strong style={{ color: balance >= 0 ? C.green : C.red }}>{fmtYen(balance)}</strong></span>
      </div>

      {/* Pages */}
      <main style={{ padding: "12px 12px 80px" }}>
        {page === "diary" && (
          <DiaryPage
            date={selectedDate}
            setDate={setSelectedDate}
            record={getRecord(selectedDate)}
            setRecord={(rec) => setRecord(selectedDate, rec)}
            otetsudaiMenus={otetsudaiMenus}
          />
        )}
        {page === "otetsudaiMenu" && (
          <OtetsudaiMenuPage menus={otetsudaiMenus} setMenus={setOtetsudaiMenus} />
        )}
        {page === "ledger" && (
          <LedgerPage ledger={ledger} setLedger={setLedger} totalIncome={totalIncome} totalExpense={totalExpense} balance={balance} />
        )}
        {page === "stats" && (
          <StatsPage records={records} ledger={ledger} />
        )}
      </main>
    </div>
  );
}

// ─── Diary Page ───────────────────────────────────────────────────
function DiaryPage({ date, setDate, record, setRecord, otetsudaiMenus }) {
  const upd = (key, val) => setRecord({ ...record, [key]: val });

  return (
    <div>
      {/* Date picker */}
      <div style={{ ...S.section, display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ ...S.input, width: "auto" }}
        />
        <span style={{ color: C.muted, fontSize: 12 }}>の記録</span>
      </div>

      {/* お手伝い */}
      <OtetsudaiInput
        items={record.otetsudai || []}
        setItems={(v) => upd("otetsudai", v)}
        menus={otetsudaiMenus}
      />

      {/* 自主練 */}
      <SolosInput solos={record.solos || []} setSolos={(v) => upd("solos", v)} />

      {/* チーム練習 */}
      <TeamsInput teams={record.teams || []} setTeams={(v) => upd("teams", v)} />

      {/* 試合 */}
      <GamesInput games={record.games || []} setGames={(v) => upd("games", v)} />

      {/* 一日まとめ */}
      <DaySummaryInput summary={record.daySummary || {}} setSummary={(v) => upd("daySummary", v)} />

      {/* 親からのコメント */}
      <div style={S.section}>
        <div style={S.sectionTitle}>💬 親からのコメント</div>
        <textarea
          style={{ ...S.input, minHeight: 60, resize: "vertical" }}
          value={record.parentComment || ""}
          onChange={e => upd("parentComment", e.target.value)}
          placeholder="コメントを入力..."
        />
      </div>
    </div>
  );
}

// ─── Otetsudai Input (daily) ──────────────────────────────────────
function OtetsudaiInput({ items, setItems, menus }) {
  const totalAmt = items.reduce((s, o) => s + (Number(o.amount) * (Number(o.count) || 1)), 0);

  const toggle = (menu) => {
    const exists = items.find(i => i.menuId === menu.id);
    if (exists) {
      setItems(items.filter(i => i.menuId !== menu.id));
    } else {
      setItems([...items, { menuId: menu.id, name: menu.name, amount: menu.amount, count: 1 }]);
    }
  };

  const setCount = (menuId, count) => {
    setItems(items.map(i => i.menuId === menuId ? { ...i, count: Number(count) } : i));
  };

  return (
    <div style={{ ...S.section, borderLeft: `3px solid ${C.orange}` }}>
      <div style={{ ...S.sectionTitle, display: "flex", justifyContent: "space-between" }}>
        <span>🧹 お手伝い</span>
        <span style={{ color: C.orange }}>{fmtYen(totalAmt)}</span>
      </div>

      {menus.length === 0 && (
        <div style={{ color: C.muted, fontSize: 12 }}>「お手伝いリスト」でメニューを登録してください</div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {menus.map(menu => {
          const active = items.find(i => i.menuId === menu.id);
          return (
            <button
              key={menu.id}
              onClick={() => toggle(menu)}
              style={{
                ...S.btnOutline(active ? C.orange : C.muted),
                background: active ? C.orange + "22" : "transparent",
                fontSize: 12,
              }}
            >
              {menu.name} {fmtYen(menu.amount)}
            </button>
          );
        })}
      </div>

      {items.map(item => (
        <div key={item.menuId} style={{ ...S.row, alignItems: "center" }}>
          <span style={{ flex: 1, fontSize: 13 }}>{item.name}</span>
          <span style={{ color: C.muted, fontSize: 12, marginRight: 4 }}>回数</span>
          <input
            type="number"
            min={1}
            value={item.count || 1}
            onChange={e => setCount(item.menuId, e.target.value)}
            style={{ ...S.input, width: 56, textAlign: "center" }}
          />
          <span style={{ color: C.orange, fontSize: 13, fontWeight: 700, minWidth: 60, textAlign: "right" }}>
            {fmtYen(Number(item.amount) * (Number(item.count) || 1))}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Otetsudai Menu Page ──────────────────────────────────────────
function OtetsudaiMenuPage({ menus, setMenus }) {
  const [form, setForm] = useState({ name: "", amount: "" });
  const [editing, setEditing] = useState(null);

  const add = () => {
    if (!form.name || !form.amount) return;
    if (editing !== null) {
      setMenus(menus.map((m, i) => i === editing ? { ...m, name: form.name, amount: Number(form.amount) } : m));
      setEditing(null);
    } else {
      setMenus([...menus, { id: `o${Date.now()}`, name: form.name, amount: Number(form.amount) }]);
    }
    setForm({ name: "", amount: "" });
  };

  const del = (id) => setMenus(menus.filter(m => m.id !== id));

  const startEdit = (i) => {
    setForm({ name: menus[i].name, amount: menus[i].amount });
    setEditing(i);
  };

  return (
    <div>
      <div style={S.section}>
        <div style={S.sectionTitle}>➕ {editing !== null ? "編集" : "新規追加"}</div>
        <div style={S.row}>
          <div style={{ flex: 2 }}>
            <label style={S.label}>お手伝い名</label>
            <input
              style={S.input}
              placeholder="例：皿洗い"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>金額（円）</label>
            <input
              type="number"
              style={S.input}
              placeholder="50"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
          </div>
        </div>
        <button style={S.btn(C.orange)} onClick={add}>
          {editing !== null ? "更新" : "追加"}
        </button>
        {editing !== null && (
          <button style={{ ...S.btnOutline(C.muted), marginLeft: 8 }} onClick={() => { setEditing(null); setForm({ name: "", amount: "" }); }}>
            キャンセル
          </button>
        )}
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>📋 登録済みリスト</div>
        {menus.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>まだ登録がありません</div>}
        {menus.map((m, i) => (
          <div key={m.id} style={{ ...S.row, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ flex: 1, fontSize: 13 }}>{m.name}</span>
            <span style={{ color: C.orange, fontWeight: 700, fontSize: 13, marginRight: 10 }}>{fmtYen(m.amount)}</span>
            <button style={S.btnOutline(C.accent)} onClick={() => startEdit(i)}>編集</button>
            <button style={{ ...S.btnOutline(C.red), marginLeft: 6 }} onClick={() => del(m.id)}>削除</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ledger Page ──────────────────────────────────────────────────
function LedgerPage({ ledger, setLedger, totalIncome, totalExpense, balance }) {
  const [form, setForm] = useState(newLedger());
  const [filter, setFilter] = useState("all");

  const addEntry = () => {
    if (!form.amount) return;
    setLedger([{ ...form, id: Date.now() }, ...ledger]);
    setForm(newLedger());
  };

  const del = (id) => setLedger(ledger.filter(e => e.id !== id));

  const filtered = filter === "all" ? ledger : ledger.filter(e => e.type === filter);

  return (
    <div>
      {/* Totals */}
      <div style={{ ...S.section, display: "flex", gap: 10 }}>
        {[
          { label: "収入合計", val: totalIncome, color: C.green },
          { label: "支出合計", val: totalExpense, color: C.red },
          { label: "残高", val: balance, color: balance >= 0 ? C.accent : C.red },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ flex: 1, textAlign: "center", background: C.card2, borderRadius: 10, padding: "10px 4px" }}>
            <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color }}>{fmtYen(val)}</div>
          </div>
        ))}
      </div>

      {/* Input form */}
      <div style={S.section}>
        <div style={S.sectionTitle}>➕ 入力</div>
        <div style={S.row}>
          <div>
            <label style={S.label}>種別</label>
            <select
              style={{ ...S.input, width: "auto" }}
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            >
              <option value="income">💚 収入</option>
              <option value="expense">❤️ 支出</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>日付</label>
            <input type="date" style={S.input} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
        </div>
        <div style={S.row}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>カテゴリ</label>
            <input style={S.input} placeholder="お小遣い / お手伝い / おやつ..." value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>金額（円）</label>
            <input type="number" style={S.input} placeholder="500" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={S.label}>メモ</label>
          <input style={S.input} placeholder="メモ..." value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
        </div>
        <button style={S.btn(form.type === "income" ? C.green : C.red)} onClick={addEntry}>追加</button>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[["all", "すべて"], ["income", "収入"], ["expense", "支出"]].map(([key, label]) => (
          <button
            key={key}
            style={filter === key ? S.btn(C.accent) : S.btnOutline(C.muted)}
            onClick={() => setFilter(key)}
          >{label}</button>
        ))}
      </div>

      {/* Ledger list */}
      <div style={S.section}>
        <div style={S.sectionTitle}>📒 出納帳</div>
        {filtered.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>記録がありません</div>}
        {filtered.map(e => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}`, gap: 8 }}>
            <span style={S.tag(e.type === "income" ? C.green : C.red)}>{e.type === "income" ? "収入" : "支出"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>{e.category || "—"} {e.memo ? `・${e.memo}` : ""}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{e.date}</div>
            </div>
            <div style={{ fontWeight: 700, color: e.type === "income" ? C.green : C.red, fontSize: 14, minWidth: 60, textAlign: "right" }}>
              {e.type === "income" ? "+" : "-"}{fmtYen(e.amount)}
            </div>
            <button style={S.btnOutline(C.red)} onClick={() => del(e.id)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stats Page ────────────────────────────────────────────────────
function StatsPage({ records, ledger }) {
  const now = new Date();
  const thisYear = now.getFullYear();

  // Build monthly otetsudai data for the year
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    const key = `${thisYear}-${m}`;
    const total = Object.entries(records)
      .filter(([date]) => date.startsWith(key))
      .reduce((s, [, rec]) => s + (rec.otetsudai || []).reduce((ss, o) => ss + (Number(o.amount) * (Number(o.count) || 1)), 0), 0);
    return { month: `${i + 1}月`, total };
  });

  const maxVal = Math.max(...monthlyData.map(d => d.total), 1);

  // Ledger by month
  const ledgerByMonth = {};
  ledger.forEach(e => {
    const m = e.date?.slice(0, 7);
    if (!m) return;
    if (!ledgerByMonth[m]) ledgerByMonth[m] = { income: 0, expense: 0 };
    if (e.type === "income") ledgerByMonth[m].income += Number(e.amount || 0);
    else ledgerByMonth[m].expense += Number(e.amount || 0);
  });

  return (
    <div>
      {/* お手伝い月別グラフ */}
      <div style={S.section}>
        <div style={S.sectionTitle}>🧹 {thisYear}年 お手伝い月別収入</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
          {monthlyData.map(({ month, total }) => (
            <div key={month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 9, color: C.orange, marginBottom: 2 }}>{total > 0 ? fmtYen(total) : ""}</div>
              <div style={{
                width: "100%",
                height: `${(total / maxVal) * 70}px`,
                minHeight: total > 0 ? 4 : 0,
                background: C.orange,
                borderRadius: "3px 3px 0 0",
              }} />
              <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>{month}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 小遣い帳 月別まとめ */}
      <div style={S.section}>
        <div style={S.sectionTitle}>💰 小遣い帳 月別まとめ</div>
        {Object.keys(ledgerByMonth).length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>データがありません</div>}
        {Object.entries(ledgerByMonth).sort(([a], [b]) => b.localeCompare(a)).map(([m, { income, expense }]) => (
          <div key={m} style={{ ...S.row, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{m}</span>
            <span style={{ color: C.green, fontSize: 12, marginRight: 8 }}>+{fmtYen(income)}</span>
            <span style={{ color: C.red, fontSize: 12, marginRight: 8 }}>-{fmtYen(expense)}</span>
            <span style={{ color: income - expense >= 0 ? C.accent : C.red, fontWeight: 700, fontSize: 13 }}>{fmtYen(income - expense)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Solos Input (simplified) ────────────────────────────────────
function SolosInput({ solos, setSolos }) {
  const add = () => setSolos([...solos, { id: Date.now(), startTime: "", endTime: "", drills: [], memo: "" }]);
  const upd = (id, key, val) => setSolos(solos.map(s => s.id === id ? { ...s, [key]: val } : s));
  const del = (id) => setSolos(solos.filter(s => s.id !== id));

  return (
    <div style={{ ...S.section, borderLeft: `3px solid #1D9E75` }}>
      <div style={{ ...S.sectionTitle, display: "flex", justifyContent: "space-between" }}>
        <span>🏃 自主練</span>
        <button style={S.btnOutline("#1D9E75")} onClick={add}>＋追加</button>
      </div>
      {solos.map(s => (
        <div key={s.id} style={{ background: C.card2, borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={S.row}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>開始</label>
              <input type="time" style={S.input} value={s.startTime} onChange={e => upd(s.id, "startTime", e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>終了</label>
              <input type="time" style={S.input} value={s.endTime} onChange={e => upd(s.id, "endTime", e.target.value)} />
            </div>
            <button style={{ ...S.btnOutline(C.red), alignSelf: "flex-end" }} onClick={() => del(s.id)}>×</button>
          </div>
          <label style={S.label}>メモ</label>
          <input style={S.input} value={s.memo} onChange={e => upd(s.id, "memo", e.target.value)} placeholder="練習内容..." />
        </div>
      ))}
    </div>
  );
}

// ─── Teams Input (simplified) ─────────────────────────────────────
function TeamsInput({ teams, setTeams }) {
  const add = () => setTeams([...teams, { id: Date.now(), teamName: "", startTime: "", endTime: "", content: "", good: "", improve: "" }]);
  const upd = (id, key, val) => setTeams(teams.map(t => t.id === id ? { ...t, [key]: val } : t));
  const del = (id) => setTeams(teams.filter(t => t.id !== id));

  return (
    <div style={{ ...S.section, borderLeft: `3px solid #378ADD` }}>
      <div style={{ ...S.sectionTitle, display: "flex", justifyContent: "space-between" }}>
        <span>🤝 チーム練習</span>
        <button style={S.btnOutline("#378ADD")} onClick={add}>＋追加</button>
      </div>
      {teams.map(t => (
        <div key={t.id} style={{ background: C.card2, borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={S.row}>
            <div style={{ flex: 2 }}>
              <label style={S.label}>チーム名</label>
              <input style={S.input} value={t.teamName} onChange={e => upd(t.id, "teamName", e.target.value)} placeholder="チーム名..." />
            </div>
            <button style={{ ...S.btnOutline(C.red), alignSelf: "flex-end" }} onClick={() => del(t.id)}>×</button>
          </div>
          <div style={S.row}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>開始</label>
              <input type="time" style={S.input} value={t.startTime} onChange={e => upd(t.id, "startTime", e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>終了</label>
              <input type="time" style={S.input} value={t.endTime} onChange={e => upd(t.id, "endTime", e.target.value)} />
            </div>
          </div>
          <label style={S.label}>内容</label>
          <input style={S.input} value={t.content} onChange={e => upd(t.id, "content", e.target.value)} placeholder="練習内容..." />
        </div>
      ))}
    </div>
  );
}

// ─── Games Input (simplified) ─────────────────────────────────────
function GamesInput({ games, setGames }) {
  const add = () => setGames([...games, { id: Date.now(), opponent: "", myScore: "", oppScore: "", good: "", reflect: "" }]);
  const upd = (id, key, val) => setGames(games.map(g => g.id === id ? { ...g, [key]: val } : g));
  const del = (id) => setGames(games.filter(g => g.id !== id));

  return (
    <div style={{ ...S.section, borderLeft: `3px solid #D85A30` }}>
      <div style={{ ...S.sectionTitle, display: "flex", justifyContent: "space-between" }}>
        <span>🏆 試合</span>
        <button style={S.btnOutline("#D85A30")} onClick={add}>＋追加</button>
      </div>
      {games.map(g => (
        <div key={g.id} style={{ background: C.card2, borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={S.row}>
            <div style={{ flex: 2 }}>
              <label style={S.label}>相手チーム</label>
              <input style={S.input} value={g.opponent} onChange={e => upd(g.id, "opponent", e.target.value)} placeholder="相手チーム..." />
            </div>
            <button style={{ ...S.btnOutline(C.red), alignSelf: "flex-end" }} onClick={() => del(g.id)}>×</button>
          </div>
          <div style={S.row}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>自チーム得点</label>
              <input type="number" style={S.input} value={g.myScore} onChange={e => upd(g.id, "myScore", e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>相手得点</label>
              <input type="number" style={S.input} value={g.oppScore} onChange={e => upd(g.id, "oppScore", e.target.value)} />
            </div>
          </div>
          <label style={S.label}>良かった点</label>
          <input style={{ ...S.input, marginBottom: 6 }} value={g.good} onChange={e => upd(g.id, "good", e.target.value)} placeholder="良かった点..." />
          <label style={S.label}>反省点</label>
          <input style={S.input} value={g.reflect} onChange={e => upd(g.id, "reflect", e.target.value)} placeholder="反省点..." />
        </div>
      ))}
    </div>
  );
}

// ─── Day Summary ──────────────────────────────────────────────────
function DaySummaryInput({ summary, setSummary }) {
  const upd = (key, val) => setSummary({ ...summary, [key]: val });
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>📝 一日まとめ</div>
      {[["memo", "今日のメモ"], ["good", "良かった点"], ["reflect", "反省点"], ["next", "次回への目標"]].map(([key, label]) => (
        <div key={key} style={{ marginBottom: 8 }}>
          <label style={S.label}>{label}</label>
          <textarea
            style={{ ...S.input, minHeight: 44, resize: "vertical" }}
            value={summary[key] || ""}
            onChange={e => upd(key, e.target.value)}
            placeholder={label + "..."}
          />
        </div>
      ))}
    </div>
  );
}
