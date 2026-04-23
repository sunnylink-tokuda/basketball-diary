import { useState, useCallback } from "react";

const C = {
  bg: "#0f1117", card: "#1a1d27", card2: "#222638", border: "#2e3248",
  accent: "#4f8ef7", green: "#1DB954", orange: "#E8A020", red: "#e05555",
  yellow: "#f0c040", text: "#e8eaf0", muted: "#7b80a0",
};

const fmtYen = (n) => `¥${Number(n || 0).toLocaleString()}`;
const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_MENUS = [
  { id: "o1", name: "皿洗い", amount: 50 },
  { id: "o2", name: "掃除機かけ", amount: 100 },
  { id: "o3", name: "洗濯物たたみ", amount: 50 },
  { id: "o4", name: "ゴミ出し", amount: 30 },
  { id: "o5", name: "買い物お手伝い", amount: 100 },
];

const S = {
  app: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Noto Sans JP', sans-serif", fontSize: 14 },
  header: { background: C.card, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 },
  section: { background: C.card, borderRadius: 12, padding: 14, marginBottom: 12, border: `1px solid ${C.border}` },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 },
  btn: (color = C.accent) => ({ background: color, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }),
  btnOutline: (color = C.accent) => ({ background: "transparent", color, border: `1px solid ${color}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }),
  input: { background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none" },
  label: { fontSize: 11, color: C.muted, marginBottom: 3, display: "block" },
  row: { display: "flex", gap: 8, marginBottom: 8 },
  drawer: (open) => ({ position: "fixed", top: 0, left: 0, width: 220, height: "100vh", background: C.card, borderRight: `1px solid ${C.border}`, zIndex: 200, transform: open ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.25s ease", padding: 20, boxSizing: "border-box", overflowY: "auto" }),
  overlay: (open) => ({ display: open ? "block" : "none", position: "fixed", inset: 0, background: "#0009", zIndex: 190 }),
};

function newRecord() { return { solos: [], teams: [], games: [], otetsudai: [], daySummary: { memo: "", good: "", reflect: "", next: "" }, parentComment: "" }; }
function newLedger(type = "income") { return { id: Date.now(), date: today(), type, category: "", memo: "", amount: "" }; }

export default function App() {
  const [page, setPage] = useState("diary");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today());
  const [records, setRecords] = useState({});
  const [otetsudaiMenus, setOtetsudaiMenus] = useState(DEFAULT_MENUS);
  const [ledger, setLedger] = useState([]);

  const getRecord = (date) => records[date] || newRecord();
  const setRecord = (date, rec) => setRecords(prev => ({ ...prev, [date]: rec }));

  const oteTotals = useCallback(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisYear = `${now.getFullYear()}`;
    let monthly = 0, yearly = 0;
    Object.entries(records).forEach(([date, rec]) => {
      const amt = (rec.otetsudai || []).reduce((s, o) => s + Number(o.amount) * (Number(o.count) || 1), 0);
      if (date.startsWith(thisMonth)) monthly += amt;
      if (date.startsWith(thisYear)) yearly += amt;
    });
    return { monthly, yearly };
  }, [records]);

  const ledgerTotals = useCallback(() => {
    const income = ledger.filter(e => e.type === "income").reduce((s, e) => s + Number(e.amount || 0), 0);
    const expense = ledger.filter(e => e.type === "expense").reduce((s, e) => s + Number(e.amount || 0), 0);
    return { income, expense, balance: income - expense };
  }, [ledger]);

  const { monthly, yearly } = oteTotals();
  const { income, expense, balance } = ledgerTotals();

  const nav = (p) => { setPage(p); setDrawerOpen(false); };

  const PAGES = [
    { key: "diary", icon: "📅", label: "日々の記録" },
    { key: "otetsudaiMenu", icon: "🧹", label: "お手伝いリスト" },
    { key: "ledger", icon: "💰", label: "小遣い帳" },
    { key: "stats", icon: "📊", label: "統計" },
  ];

  return (
    <div style={S.app}>
      <div style={S.overlay(drawerOpen)} onClick={() => setDrawerOpen(false)} />
      <div style={S.drawer(drawerOpen)}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.accent, marginBottom: 20 }}>🏀 メニュー</div>
        {PAGES.map(({ key, icon, label }) => (
          <div key={key} onClick={() => nav(key)} style={{ padding: "11px 10px", borderRadius: 10, marginBottom: 4, cursor: "pointer", background: page === key ? C.accent + "22" : "transparent", color: page === key ? C.accent : C.text, fontWeight: page === key ? 700 : 400 }}>
            {icon} {label}
          </div>
        ))}
        <div style={{ marginTop: 20, padding: 12, background: C.card2, borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>🧹 お手伝い収入</div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>今月 <strong style={{ color: C.orange }}>{fmtYen(monthly)}</strong></div>
          <div style={{ fontSize: 12 }}>今年 <strong style={{ color: C.yellow }}>{fmtYen(yearly)}</strong></div>
        </div>
      </div>

      <header style={S.header}>
        <button onClick={() => setDrawerOpen(true)} style={{ background: "none", border: "none", color: C.text, fontSize: 20, cursor: "pointer", padding: 0 }}>☰</button>
        <span style={{ fontWeight: 700, fontSize: 15, color: C.accent }}>{PAGES.find(p => p.key === page)?.icon} {PAGES.find(p => p.key === page)?.label}</span>
        <div style={{ width: 28 }} />
      </header>

      <div style={{ background: C.card2, borderBottom: `1px solid ${C.border}`, padding: "7px 16px", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12 }}>🧹 今月 <strong style={{ color: C.orange }}>{fmtYen(monthly)}</strong></span>
        <span style={{ fontSize: 12 }}>📅 今年 <strong style={{ color: C.yellow }}>{fmtYen(yearly)}</strong></span>
        <span style={{ fontSize: 12 }}>💰 残高 <strong style={{ color: balance >= 0 ? C.green : C.red }}>{fmtYen(balance)}</strong></span>
      </div>

      <main style={{ padding: "12px 12px 80px" }}>
        {page === "diary" && <DiaryPage date={selectedDate} setDate={setSelectedDate} record={getRecord(selectedDate)} setRecord={(r) => setRecord(selectedDate, r)} menus={otetsudaiMenus} />}
        {page === "otetsudaiMenu" && <OtetsudaiMenuPage menus={otetsudaiMenus} setMenus={setOtetsudaiMenus} />}
        {page === "ledger" && <LedgerPage ledger={ledger} setLedger={setLedger} income={income} expense={expense} balance={balance} />}
        {page === "stats" && <StatsPage records={records} ledger={ledger} />}
      </main>
    </div>
  );
}

function DiaryPage({ date, setDate, record, setRecord, menus }) {
  const upd = (key, val) => setRecord({ ...record, [key]: val });
  return (
    <div>
      <div style={{ ...S.section, display: "flex", alignItems: "center", gap: 10 }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...S.input, width: "auto" }} />
        <span style={{ color: C.muted, fontSize: 12 }}>の記録</span>
      </div>
      <OtetsudaiInput items={record.otetsudai || []} setItems={v => upd("otetsudai", v)} menus={menus} />
      <SolosInput solos={record.solos || []} setSolos={v => upd("solos", v)} />
      <TeamsInput teams={record.teams || []} setTeams={v => upd("teams", v)} />
      <GamesInput games={record.games || []} setGames={v => upd("games", v)} />
      <div style={S.section}>
        <div style={S.sectionTitle}>📝 一日まとめ</div>
        {[["memo","今日のメモ"],["good","良かった点"],["reflect","反省点"],["next","次回の目標"]].map(([k,label]) => (
          <div key={k} style={{ marginBottom: 8 }}>
            <label style={S.label}>{label}</label>
            <textarea style={{ ...S.input, minHeight: 40, resize: "vertical" }} value={record.daySummary?.[k] || ""} onChange={e => upd("daySummary", { ...record.daySummary, [k]: e.target.value })} placeholder={label + "..."} />
          </div>
        ))}
      </div>
      <div style={S.section}>
        <div style={S.sectionTitle}>💬 親からのコメント</div>
        <textarea style={{ ...S.input, minHeight: 56, resize: "vertical" }} value={record.parentComment || ""} onChange={e => upd("parentComment", e.target.value)} placeholder="コメントを入力..." />
      </div>
    </div>
  );
}

function OtetsudaiInput({ items, setItems, menus }) {
  const total = items.reduce((s, o) => s + Number(o.amount) * (Number(o.count) || 1), 0);
  const toggle = (m) => {
    const exists = items.find(i => i.menuId === m.id);
    if (exists) setItems(items.filter(i => i.menuId !== m.id));
    else setItems([...items, { menuId: m.id, name: m.name, amount: m.amount, count: 1 }]);
  };
  const setCount = (menuId, count) => setItems(items.map(i => i.menuId === menuId ? { ...i, count: Number(count) } : i));

  return (
    <div style={{ ...S.section, borderLeft: `3px solid ${C.orange}` }}>
      <div style={{ ...S.sectionTitle, display: "flex", justifyContent: "space-between" }}>
        <span>🧹 お手伝い</span>
        <span style={{ color: C.orange, fontWeight: 700 }}>{fmtYen(total)}</span>
      </div>
      {menus.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>「お手伝いリスト」でメニューを登録してください</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {menus.map(m => {
          const active = items.find(i => i.menuId === m.id);
          return (
            <button key={m.id} onClick={() => toggle(m)} style={{ ...S.btnOutline(active ? C.orange : C.muted), background: active ? C.orange + "22" : "transparent", fontSize: 12 }}>
              {m.name} {fmtYen(m.amount)}
            </button>
          );
        })}
      </div>
      {items.map(item => (
        <div key={item.menuId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ flex: 1, fontSize: 13 }}>{item.name}</span>
          <span style={{ fontSize: 11, color: C.muted }}>回数</span>
          <input type="number" min={1} value={item.count || 1} onChange={e => setCount(item.menuId, e.target.value)} style={{ ...S.input, width: 52, textAlign: "center" }} />
          <span style={{ color: C.orange, fontWeight: 700, minWidth: 58, textAlign: "right" }}>{fmtYen(Number(item.amount) * (Number(item.count) || 1))}</span>
        </div>
      ))}
    </div>
  );
}

function OtetsudaiMenuPage({ menus, setMenus }) {
  const [form, setForm] = useState({ name: "", amount: "" });
  const [editing, setEditing] = useState(null);
  const save = () => {
    if (!form.name || !form.amount) return;
    if (editing !== null) {
      setMenus(menus.map((m, i) => i === editing ? { ...m, name: form.name, amount: Number(form.amount) } : m));
      setEditing(null);
    } else {
      setMenus([...menus, { id: `o${Date.now()}`, name: form.name, amount: Number(form.amount) }]);
    }
    setForm({ name: "", amount: "" });
  };
  const startEdit = (i) => { setForm({ name: menus[i].name, amount: menus[i].amount }); setEditing(i); };
  return (
    <div>
      <div style={S.section}>
        <div style={S.sectionTitle}>➕ {editing !== null ? "編集" : "新規追加"}</div>
        <div style={S.row}>
          <div style={{ flex: 2 }}>
            <label style={S.label}>お手伝い名</label>
            <input style={S.input} placeholder="例：皿洗い" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>金額（円）</label>
            <input type="number" style={S.input} placeholder="50" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.btn(C.orange)} onClick={save}>{editing !== null ? "更新" : "追加"}</button>
          {editing !== null && <button style={S.btnOutline(C.muted)} onClick={() => { setEditing(null); setForm({ name: "", amount: "" }); }}>キャンセル</button>}
        </div>
      </div>
      <div style={S.section}>
        <div style={S.sectionTitle}>📋 登録済みリスト ({menus.length}件)</div>
        {menus.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>まだ登録がありません</div>}
        {menus.map((m, i) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}`, gap: 8 }}>
            <span style={{ flex: 1, fontSize: 13 }}>{m.name}</span>
            <span style={{ color: C.orange, fontWeight: 700 }}>{fmtYen(m.amount)}</span>
            <button style={S.btnOutline(C.accent)} onClick={() => startEdit(i)}>編集</button>
            <button style={S.btnOutline(C.red)} onClick={() => setMenus(menus.filter((_, j) => j !== i))}>削除</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LedgerPage({ ledger, setLedger, income, expense, balance }) {
  const [form, setForm] = useState(newLedger());
  const [filter, setFilter] = useState("all");
  const add = () => {
    if (!form.amount) return;
    setLedger([{ ...form, id: Date.now() }, ...ledger]);
    setForm(newLedger(form.type));
  };
  const filtered = filter === "all" ? ledger : ledger.filter(e => e.type === filter);
  return (
    <div>
      <div style={{ ...S.section, display: "flex", gap: 8 }}>
        {[["収入合計", income, C.green], ["支出合計", expense, C.red], ["残高", balance, balance >= 0 ? C.accent : C.red]].map(([label, val, color]) => (
          <div key={label} style={{ flex: 1, textAlign: "center", background: C.card2, borderRadius: 10, padding: "10px 4px" }}>
            <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color }}>{fmtYen(val)}</div>
          </div>
        ))}
      </div>
      <div style={S.section}>
        <div style={S.sectionTitle}>➕ 入力</div>
        <div style={S.row}>
          <div>
            <label style={S.label}>種別</label>
            <select style={{ ...S.input, width: "auto" }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
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
            <input style={S.input} placeholder="お小遣い / お手伝い..." value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>金額（円）</label>
            <input type="number" style={S.input} placeholder="500" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
        </div>
        <label style={S.label}>メモ</label>
        <input style={{ ...S.input, marginBottom: 10 }} placeholder="メモ..." value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
        <button style={S.btn(form.type === "income" ? C.green : C.red)} onClick={add}>追加</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[["all","すべて"],["income","収入"],["expense","支出"]].map(([k,l]) => (
          <button key={k} style={filter === k ? S.btn(C.accent) : S.btnOutline(C.muted)} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div style={S.section}>
        <div style={S.sectionTitle}>📒 出納帳 ({filtered.length}件)</div>
        {filtered.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>記録がありません</div>}
        {filtered.map(e => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}`, gap: 8 }}>
            <span style={{ background: (e.type === "income" ? C.green : C.red) + "22", color: e.type === "income" ? C.green : C.red, borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{e.type === "income" ? "収入" : "支出"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.category || "—"}{e.memo ? ` · ${e.memo}` : ""}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{e.date}</div>
            </div>
            <div style={{ fontWeight: 700, color: e.type === "income" ? C.green : C.red, fontSize: 14, whiteSpace: "nowrap" }}>{e.type === "income" ? "+" : "-"}{fmtYen(e.amount)}</div>
            <button style={S.btnOutline(C.red)} onClick={() => setLedger(ledger.filter(x => x.id !== e.id))}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsPage({ records, ledger }) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const monthlyOte = Array.from({ length: 12 }, (_, i) => {
    const m = `${thisYear}-${String(i + 1).padStart(2, "0")}`;
    const total = Object.entries(records).filter(([d]) => d.startsWith(m)).reduce((s, [, r]) => s + (r.otetsudai || []).reduce((ss, o) => ss + Number(o.amount) * (Number(o.count) || 1), 0), 0);
    return { label: `${i + 1}月`, total };
  });
  const maxOte = Math.max(...monthlyOte.map(d => d.total), 1);
  const ledgerByMonth = {};
  ledger.forEach(e => {
    const m = e.date?.slice(0, 7);
    if (!m) return;
    if (!ledgerByMonth[m]) ledgerByMonth[m] = { income: 0, expense: 0 };
    ledgerByMonth[m][e.type] += Number(e.amount || 0);
  });
  return (
    <div>
      <div style={S.section}>
        <div style={S.sectionTitle}>🧹 {thisYear}年 お手伝い月別収入</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110 }}>
          {monthlyOte.map(({ label, total }) => (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              {total > 0 && <div style={{ fontSize: 8, color: C.orange, marginBottom: 2 }}>{fmtYen(total)}</div>}
              <div style={{ width: "100%", height: `${(total / maxOte) * 72}px`, minHeight: total > 0 ? 4 : 0, background: C.orange, borderRadius: "3px 3px 0 0" }} />
              <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={S.section}>
        <div style={S.sectionTitle}>💰 小遣い帳 月別まとめ</div>
        {Object.keys(ledgerByMonth).length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>データがありません</div>}
        {Object.entries(ledgerByMonth).sort(([a], [b]) => b.localeCompare(a)).map(([m, { income, expense }]) => (
          <div key={m} style={{ display: "flex", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}`, gap: 8 }}>
            <span style={{ flex: 1, fontWeight: 600 }}>{m}</span>
            <span style={{ color: C.green, fontSize: 12 }}>+{fmtYen(income)}</span>
            <span style={{ color: C.red, fontSize: 12 }}>-{fmtYen(expense)}</span>
            <span style={{ color: income - expense >= 0 ? C.accent : C.red, fontWeight: 700 }}>{fmtYen(income - expense)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SolosInput({ solos, setSolos }) {
  const add = () => setSolos([...solos, { id: Date.now(), startTime: "", endTime: "", memo: "" }]);
  const upd = (id, k, v) => setSolos(solos.map(s => s.id === id ? { ...s, [k]: v } : s));
  return (
    <div style={{ ...S.section, borderLeft: `3px solid #1D9E75` }}>
      <div style={{ ...S.sectionTitle, display: "flex", justifyContent: "space-between" }}>
        <span>🏃 自主練</span>
        <button style={S.btnOutline("#1D9E75")} onClick={add}>＋追加</button>
      </div>
      {solos.map(s => (
        <div key={s.id} style={{ background: C.card2, borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={S.row}>
            <div style={{ flex: 1 }}><label style={S.label}>開始</label><input type="time" style={S.input} value={s.startTime} onChange={e => upd(s.id, "startTime", e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={S.label}>終了</label><input type="time" style={S.input} value={s.endTime} onChange={e => upd(s.id, "endTime", e.target.value)} /></div>
            <button style={{ ...S.btnOutline(C.red), alignSelf: "flex-end" }} onClick={() => setSolos(solos.filter(x => x.id !== s.id))}>×</button>
          </div>
          <label style={S.label}>メモ</label>
          <input style={S.input} value={s.memo} onChange={e => upd(s.id, "memo", e.target.value)} placeholder="練習内容..." />
        </div>
      ))}
    </div>
  );
}

function TeamsInput({ teams, setTeams }) {
  const add = () => setTeams([...teams, { id: Date.now(), teamName: "", startTime: "", endTime: "", content: "" }]);
  const upd = (id, k, v) => setTeams(teams.map(t => t.id === id ? { ...t, [k]: v } : t));
  return (
    <div style={{ ...S.section, borderLeft: `3px solid #378ADD` }}>
      <div style={{ ...S.sectionTitle, display: "flex", justifyContent: "space-between" }}>
        <span>🤝 チーム練習</span>
        <button style={S.btnOutline("#378ADD")} onClick={add}>＋追加</button>
      </div>
      {teams.map(t => (
        <div key={t.id} style={{ background: C.card2, borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={S.row}>
            <div style={{ flex: 2 }}><label style={S.label}>チーム名</label><input style={S.input} value={t.teamName} onChange={e => upd(t.id, "teamName", e.target.value)} placeholder="チーム名..." /></div>
            <button style={{ ...S.btnOutline(C.red), alignSelf: "flex-end" }} onClick={() => setTeams(teams.filter(x => x.id !== t.id))}>×</button>
          </div>
          <div style={S.row}>
            <div style={{ flex: 1 }}><label style={S.label}>開始</label><input type="time" style={S.input} value={t.startTime} onChange={e => upd(t.id, "startTime", e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={S.label}>終了</label><input type="time" style={S.input} value={t.endTime} onChange={e => upd(t.id, "endTime", e.target.value)} /></div>
          </div>
          <label style={S.label}>内容</label>
          <input style={S.input} value={t.content} onChange={e => upd(t.id, "content", e.target.value)} placeholder="練習内容..." />
        </div>
      ))}
    </div>
  );
}

function GamesInput({ games, setGames }) {
  const add = () => setGames([...games, { id: Date.now(), opponent: "", myScore: "", oppScore: "", good: "", reflect: "" }]);
  const upd = (id, k, v) => setGames(games.map(g => g.id === id ? { ...g, [k]: v } : g));
  return (
    <div style={{ ...S.section, borderLeft: `3px solid #D85A30` }}>
      <div style={{ ...S.sectionTitle, display: "flex", justifyContent: "space-between" }}>
        <span>🏆 試合</span>
        <button style={S.btnOutline("#D85A30")} onClick={add}>＋追加</button>
      </div>
      {games.map(g => (
        <div key={g.id} style={{ background: C.card2, borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={S.row}>
            <div style={{ flex: 2 }}><label style={S.label}>相手チーム</label><input style={S.input} value={g.opponent} onChange={e => upd(g.id, "opponent", e.target.value)} placeholder="相手チーム..." /></div>
            <button style={{ ...S.btnOutline(C.red), alignSelf: "flex-end" }} onClick={() => setGames(games.filter(x => x.id !== g.id))}>×</button>
          </div>
          <div style={S.row}>
            <div style={{ flex: 1 }}><label style={S.label}>自チーム</label><input type="number" style={S.input} value={g.myScore} onChange={e => upd(g.id, "myScore", e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={S.label}>相手</label><input type="number" style={S.input} value={g.oppScore} onChange={e => upd(g.id, "oppScore", e.target.value)} /></div>
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
