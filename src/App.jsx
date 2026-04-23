import { useState } from "react";

const C = {
  solo: "#1D9E75", team: "#378ADD", game: "#D85A30",
  train: "#7F77DD", otetsudai: "#E8A020", both: "#888",
  bg: "#F7F6F3", card: "#FFFFFF", border: "#E8E6E0",
  text: "#1A1A1A", sub: "#888", accent: "#1A1A1A",
};

const TEAM_OPTIONS = ["キングス","EMBC","KINGDOME","T's","その他"];

// ── init helpers ──────────────────────────────────────────
const newSolo = () => ({ id: uid(), drills: [], startTime: "", endTime: "", memo: "" });
const newTeam = () => ({ id: uid(), teamName: "", startTime: "", endTime: "", content: "", taught: "", good: "", improve: "", next: "" });
const newGame = () => ({ id: uid(), opponent: "", myScore: "", oppScore: "", playTime: "", shot2a: "", shot2m: "", shot3a: "", shot3m: "", fta: "", ftm: "", ast: "", reb: "", stl: "", tov: "", foul: "", good: "", reflect: "" });
const newOtetsudai = () => ({ items: [] });
const newGoal = () => ({ basketball: "", study: "", life: "", training: "" });
const newLedger = () => ({ id: uid(), type: "income", category: "", memo: "", amount: "", date: todayStr() });

function uid() { return Math.random().toString(36).slice(2); }
function todayStr() { const n = new Date(); return `${n.getFullYear()}-${p2(n.getMonth()+1)}-${p2(n.getDate())}`; }
function p2(n) { return String(n).padStart(2, "0"); }
function fmtDate(y, m, d) { return `${y}-${p2(m+1)}-${p2(d)}`; }
function fmtYen(n) { return "¥" + Number(n || 0).toLocaleString(); }
function calcMins(s, e) { if (!s || !e) return 0; const [sh,sm]=s.split(":").map(Number), [eh,em]=e.split(":").map(Number); return Math.max(0,(eh*60+em)-(sh*60+sm)); }
function minsLabel(m) { if (!m) return "0分"; const h=Math.floor(m/60),mn=m%60; return h>0?`${h}時間${mn?""+mn+"分":""}`:`${mn}分`; }

// ── styles ────────────────────────────────────────────────
const font = "'Noto Sans JP', sans-serif";
const B = { fontFamily: font, boxSizing: "border-box" };
const btn = (ex={}) => ({ ...B, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, background: C.card, color: C.text, cursor: "pointer", ...ex });
const inp = { ...B, width: "100%", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 11px", fontSize: 14, background: C.card, outline: "none" };
const ta = { ...inp, resize: "vertical", minHeight: 64 };
const lbl = { fontSize: 11, fontWeight: 600, color: C.sub, letterSpacing: 0.5, marginBottom: 4, display: "block" };
const card = { background: C.card, borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${C.border}` };

// ── stat helpers ──────────────────────────────────────────
function otetsudaiTotal(records, year, month) {
  let t = 0;
  Object.entries(records).forEach(([ds, rec]) => {
    const [y, m] = ds.split("-").map(Number);
    if (y !== year || m !== month+1) return;
    (rec.otetsudai?.items || []).forEach(it => { t += (Number(it.amount)||0) * (Number(it.count)||1); });
  });
  return t;
}
function otetsudaiYearTotal(records, year) {
  let t = 0;
  Object.entries(records).forEach(([ds, rec]) => {
    if (!ds.startsWith(String(year))) return;
    (rec.otetsudai?.items || []).forEach(it => { t += (Number(it.amount)||0) * (Number(it.count)||1); });
  });
  return t;
}

// ── sub-components ────────────────────────────────────────

function Tag({ color, children }) {
  return <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 10, border: `1px solid ${color}44`, background: color+"18", color, fontWeight: 600 }}>{children}</span>;
}

function SoloForm({ solo, idx, total, onChange, onDel, soloMenus }) {
  const [di, setDi] = useState("");
  const mins = calcMins(solo.startTime, solo.endTime);
  const addDrill = () => { const v=di.trim(); if(!v)return; onChange({...solo,drills:[...solo.drills,v]}); setDi(""); };
  return (
    <div style={{ border: `1px solid ${C.solo}33`, borderRadius: 10, padding: 12, marginBottom: 10, background: "#F0FAF6" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
        <Tag color={C.solo}>第{idx+1}回</Tag>
        {total>1 && <button onClick={onDel} style={btn({ fontSize:11, padding:"3px 8px", color:"#999" })}>削除</button>}
      </div>
      <label style={lbl}>練習時間</label>
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:6, alignItems:"center", marginBottom:4 }}>
        <input type="time" value={solo.startTime} onChange={e=>onChange({...solo,startTime:e.target.value})} style={inp}/>
        <span style={{ color:C.sub, fontSize:12 }}>〜</span>
        <input type="time" value={solo.endTime} onChange={e=>onChange({...solo,endTime:e.target.value})} style={inp}/>
      </div>
      {mins>0&&<p style={{fontSize:11,color:C.sub,textAlign:"right",margin:"2px 0 10px"}}>{mins}分間</p>}
      <label style={lbl}>練習メニュー</label>
      <div style={{ display:"flex", gap:6, marginBottom:6 }}>
        <input value={di} onChange={e=>setDi(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addDrill()} placeholder="例：レッグスルー50本" style={{...inp,flex:1}}/>
        <button onClick={addDrill} style={btn({borderColor:C.solo,color:C.solo,padding:"8px 12px"})}>追加</button>
      </div>
      {soloMenus.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{soloMenus.map((m,i)=><button key={i} onClick={()=>onChange({...solo,drills:[...solo.drills,m.name||m]})} style={{...B,border:`1px solid ${C.solo}`,borderRadius:12,padding:"3px 10px",fontSize:11,background:"#E1F5EE",color:C.solo,cursor:"pointer"}}>{m.name||m}</button>)}</div>}
      {solo.drills.length>0&&<div style={{marginBottom:8}}>{solo.drills.map((d,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",background:"#fff",borderRadius:6,marginBottom:3}}><span style={{flex:1,fontSize:13}}>{d}</span><button onClick={()=>onChange({...solo,drills:solo.drills.filter((_,j)=>j!==i)})} style={{...B,border:"none",background:"none",cursor:"pointer",color:"#ccc",fontSize:15}}>×</button></div>)}</div>}
      <label style={lbl}>メモ</label>
      <textarea value={solo.memo} onChange={e=>onChange({...solo,memo:e.target.value})} rows={2} placeholder="気づきや課題など" style={ta}/>
    </div>
  );
}

function TeamForm({ team, idx, total, onChange, onDel }) {
  const mins = calcMins(team.startTime, team.endTime);
  return (
    <div style={{ border:`1px solid ${C.team}33`, borderRadius:10, padding:12, marginBottom:10, background:"#EEF6FF" }}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
        <Tag color={C.team}>第{idx+1}回</Tag>
        {total>1&&<button onClick={onDel} style={btn({fontSize:11,padding:"3px 8px",color:"#999"})}>削除</button>}
      </div>
      <label style={lbl}>チーム</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
        {TEAM_OPTIONS.map(t=><button key={t} onClick={()=>onChange({...team,teamName:t})} style={{...B,border:`1px solid ${team.teamName===t?C.team:C.border}`,borderRadius:16,padding:"5px 12px",fontSize:12,background:team.teamName===t?"#EBF5FF":"#fff",color:team.teamName===t?C.team:C.sub,cursor:"pointer",fontWeight:team.teamName===t?600:400}}>{t}</button>)}
      </div>
      <label style={lbl}>練習時間</label>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,alignItems:"center",marginBottom:4}}>
        <input type="time" value={team.startTime} onChange={e=>onChange({...team,startTime:e.target.value})} style={inp}/>
        <span style={{color:C.sub,fontSize:12}}>〜</span>
        <input type="time" value={team.endTime} onChange={e=>onChange({...team,endTime:e.target.value})} style={inp}/>
      </div>
      {mins>0&&<p style={{fontSize:11,color:C.sub,textAlign:"right",margin:"2px 0 10px"}}>{mins}分間</p>}
      {[["content","練習内容","今日の練習メニュー"],["taught","教えてもらったこと","コーチや先輩から"],["good","上手くできたこと","うまくいったプレー"],["improve","改善すること","課題"],["next","次回に向けて","次回意識したいこと"]].map(([k,l,ph])=>(
        <div key={k} style={{marginBottom:8}}>
          <label style={lbl}>{l}</label>
          <textarea rows={2} placeholder={ph} value={team[k]||""} onChange={e=>onChange({...team,[k]:e.target.value})} style={ta}/>
        </div>
      ))}
    </div>
  );
}

function OtetsudaiForm({ form, onChange, menus }) {
  const total = (form.items||[]).reduce((s,it)=>s+(Number(it.amount)||0)*(Number(it.count)||1),0);
  function addFromMenu(m) {
    const ex=(form.items||[]).find(it=>it.menuId===m.id);
    if(ex) onChange({...form,items:(form.items||[]).map(it=>it.menuId===m.id?{...it,count:(Number(it.count)||1)+1}:it)});
    else onChange({...form,items:[...(form.items||[]),{menuId:m.id,name:m.name,amount:m.amount,count:1}]});
  }
  function addCustom() { onChange({...form,items:[...(form.items||[]),{menuId:null,name:"",amount:"",count:1}]}); }
  function upd(i,k,v) { onChange({...form,items:(form.items||[]).map((it,j)=>j===i?{...it,[k]:v}:it)}); }
  function del(i) { onChange({...form,items:(form.items||[]).filter((_,j)=>j!==i)}); }
  return (
    <div style={{border:`1px solid ${C.otetsudai}33`,borderRadius:10,padding:12,marginBottom:10,background:"#FFFBF0"}}>
      <div style={{marginBottom:menus.length>0?10:0}}>
        {menus.length>0&&<>
          <label style={lbl}>メニューから追加</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
            {menus.map((m,i)=><button key={i} onClick={()=>addFromMenu(m)} style={{...B,border:`1px solid ${C.otetsudai}`,borderRadius:12,padding:"4px 10px",fontSize:11,background:"#FFF8EC",color:C.otetsudai,cursor:"pointer"}}>{m.name} <span style={{color:"#bbb"}}>+{fmtYen(m.amount)}</span></button>)}
          </div>
        </>}
      </div>
      {(form.items||[]).map((it,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
          <input value={it.name} onChange={e=>upd(i,"name",e.target.value)} placeholder="内容" style={{...B,flex:2,border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 8px",fontSize:13,background:"#fff"}}/>
          <input type="number" min="1" value={it.count||1} onChange={e=>upd(i,"count",e.target.value)} style={{...B,width:42,border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 4px",fontSize:13,textAlign:"center",background:"#fff"}}/>
          <span style={{fontSize:11,color:C.sub}}>回</span>
          <input type="number" min="0" value={it.amount||""} onChange={e=>upd(i,"amount",e.target.value)} placeholder="金額" style={{...B,width:72,border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 6px",fontSize:13,textAlign:"right",background:"#fff"}}/>
          <span style={{fontSize:11,color:C.sub}}>円</span>
          <button onClick={()=>del(i)} style={{...B,border:"none",background:"none",cursor:"pointer",color:"#ccc",fontSize:16}}>×</button>
        </div>
      ))}
      <button onClick={addCustom} style={btn({width:"100%",borderColor:C.otetsudai,color:C.otetsudai,marginTop:4,marginBottom:total>0?10:0})}>+ 手入力で追加</button>
      {total>0&&<div style={{background:"#FFF8EC",borderRadius:8,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,color:C.sub}}>今日の合計</span><span style={{fontSize:16,fontWeight:700,color:C.otetsudai}}>{fmtYen(total)}</span></div>}
    </div>
  );
}

// ── MenuListPage ──────────────────────────────────────────
function MenuListPage({ color, menus, onSave, withAmount }) {
  const [items, setItems] = useState(menus);
  const [inp2, setInp2] = useState("");
  const [amt, setAmt] = useState("");
  const [dirty, setDirty] = useState(false);
  function add() {
    const v=inp2.trim(); if(!v)return;
    setItems(p=>[...p, withAmount?{id:uid(),name:v,amount:Number(amt)||0}:v]);
    setInp2(""); setAmt(""); setDirty(true);
  }
  function remove(i) { setItems(p=>p.filter((_,j)=>j!==i)); setDirty(true); }
  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:6}}>
        <input value={inp2} onChange={e=>setInp2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder={withAmount?"お手伝い内容":"メニュー名"} style={{...inp,flex:1}}/>
        {withAmount&&<input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="金額" style={{...inp,width:80,textAlign:"right"}}/>}
        <button onClick={add} style={btn({borderColor:color,color:color})}>追加</button>
      </div>
      {withAmount&&<p style={{fontSize:11,color:"#bbb",margin:"0 0 10px"}}>1回あたりの金額（円）</p>}
      {items.map((m,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:C.card,borderRadius:8,border:`1px solid ${C.border}`,marginBottom:5}}>
          <span style={{flex:1,fontSize:13}}>{withAmount?m.name:m}</span>
          {withAmount&&<span style={{fontSize:13,fontWeight:600,color}}>{fmtYen(m.amount)}</span>}
          <button onClick={()=>remove(i)} style={{...B,border:"none",background:"none",cursor:"pointer",color:"#ccc",fontSize:16}}>×</button>
        </div>
      ))}
      {dirty&&<button onClick={()=>{onSave(items);setDirty(false);}} style={btn({background:color,color:"#fff",border:"none",width:"100%",marginTop:8})}>保存</button>}
      {!items.length&&<p style={{textAlign:"center",color:"#ccc",fontSize:13,margin:"2rem 0"}}>まだ登録がありません</p>}
    </div>
  );
}

// ── LedgerPage ────────────────────────────────────────────
function LedgerPage({ ledger, onSave, records }) {
  const now = new Date();
  const [yr, setYr] = useState(now.getFullYear());
  const [mo, setMo] = useState(now.getMonth());
  const [mode, setMode] = useState("month");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(newLedger());

  const prefix = mode==="month" ? `${yr}-${p2(mo+1)}` : String(yr);
  const entries = (ledger||[]).filter(e=>e.date&&e.date.startsWith(prefix)).sort((a,b)=>b.date.localeCompare(a.date));
  const income = entries.filter(e=>e.type==="income").reduce((s,e)=>s+(Number(e.amount)||0),0);
  const expense = entries.filter(e=>e.type==="expense").reduce((s,e)=>s+(Number(e.amount)||0),0);
  const ote = mode==="month" ? otetsudaiTotal(records,yr,mo) : otetsudaiYearTotal(records,yr);

  async function save() {
    if(!form.amount||!form.date) return;
    onSave([...(ledger||[]),{...form,id:uid(),amount:Number(form.amount)}]);
    setShowForm(false); setForm(newLedger());
  }

  return (
    <div style={{padding:"0 1px"}}>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {["month","year"].map(m=><button key={m} onClick={()=>setMode(m)} style={btn({flex:1,fontWeight:mode===m?700:400,background:mode===m?"#1A1A1A":"#fff",color:mode===m?"#fff":C.text,border:`1px solid ${mode===m?"#1A1A1A":C.border}`})}>{m==="month"?"月別":"年間"}</button>)}
      </div>

      {mode==="month"&&(
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <button onClick={()=>{mo===0?(setYr(y=>y-1),setMo(11)):setMo(m=>m-1)}} style={btn({padding:"6px 12px"})}>‹</button>
          <span style={{flex:1,textAlign:"center",fontWeight:700}}>{yr}年{mo+1}月</span>
          <button onClick={()=>{mo===11?(setYr(y=>y+1),setMo(0)):setMo(m=>m+1)}} style={btn({padding:"6px 12px"})}>›</button>
        </div>
      )}
      {mode==="year"&&(
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <button onClick={()=>setYr(y=>y-1)} style={btn({padding:"6px 12px"})}>‹</button>
          <span style={{flex:1,textAlign:"center",fontWeight:700}}>{yr}年</span>
          <button onClick={()=>setYr(y=>y+1)} style={btn({padding:"6px 12px"})}>›</button>
        </div>
      )}

      {/* サマリー */}
      <div style={{background:"#1A1A1A",borderRadius:14,padding:16,marginBottom:14,color:"#fff"}}>
        <p style={{fontSize:11,color:"#888",margin:"0 0 12px"}}>{mode==="month"?`${yr}年${mo+1}月`:`${yr}年`}の集計</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
          {[["収入",income+ote,"#4CAF50"],["支出",expense,"#F44336"],["残高",income+ote-expense,"#64B5F6"]].map(([l,v,cl])=>(
            <div key={l} style={{textAlign:"center"}}>
              <p style={{fontSize:10,color:"#888",margin:"0 0 4px"}}>{l}</p>
              <p style={{fontSize:16,fontWeight:700,color:cl,margin:0}}>{fmtYen(v)}</p>
            </div>
          ))}
        </div>
        <div style={{background:"#ffffff18",borderRadius:8,padding:"8px 12px",display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:11,color:"#aaa"}}>🧹 お手伝い収入</span>
          <span style={{fontSize:13,fontWeight:700,color:C.otetsudai}}>{fmtYen(ote)}</span>
        </div>
      </div>

      <button onClick={()=>setShowForm(s=>!s)} style={btn({width:"100%",marginBottom:10,fontWeight:600})}>
        {showForm?"▲ 閉じる":"＋ 収入・支出を追加"}
      </button>

      {showForm&&(
        <div style={{...card,marginBottom:12}}>
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {["income","expense"].map(t=><button key={t} onClick={()=>setForm(f=>({...f,type:t}))} style={btn({flex:1,fontWeight:form.type===t?700:400,background:form.type===t?(t==="income"?"#E8F5E9":"#FFEBEE"):"#fff",borderColor:form.type===t?(t==="income"?"#388E3C":"#D32F2F"):C.border,color:form.type===t?(t==="income"?"#388E3C":"#D32F2F"):C.text})}>{t==="income"?"収入 💰":"支出 💸"}</button>)}
          </div>
          <label style={lbl}>日付</label>
          <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{...inp,marginBottom:8}}/>
          <label style={lbl}>カテゴリ・内容</label>
          <input value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="例：お小遣い、ゲーム" style={{...inp,marginBottom:8}}/>
          <label style={lbl}>金額（円）</label>
          <input type="number" min="0" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0" style={{...inp,marginBottom:8}}/>
          <label style={lbl}>メモ</label>
          <input value={form.memo} onChange={e=>setForm(f=>({...f,memo:e.target.value}))} placeholder="任意" style={{...inp,marginBottom:12}}/>
          <button onClick={save} style={btn({background:"#1A1A1A",color:"#fff",border:"none",width:"100%",fontWeight:600})}>保存</button>
        </div>
      )}

      {entries.length===0&&<p style={{textAlign:"center",color:"#ccc",fontSize:13,margin:"2rem 0"}}>記録がありません</p>}
      {entries.map(e=>(
        <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:C.card,borderRadius:10,border:`1px solid ${C.border}`,marginBottom:6}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:e.type==="income"?"#4CAF50":"#F44336",flexShrink:0}}/>
          <div style={{flex:1}}>
            <p style={{fontSize:13,fontWeight:600,color:C.text,margin:"0 0 2px"}}>{e.category||"（カテゴリなし）"}</p>
            <p style={{fontSize:11,color:C.sub,margin:0}}>{e.date}{e.memo&&" · "+e.memo}</p>
          </div>
          <span style={{fontSize:15,fontWeight:700,color:e.type==="income"?"#388E3C":"#D32F2F"}}>{e.type==="income"?"+":"-"}{fmtYen(e.amount)}</span>
          <button onClick={()=>onSave((ledger||[]).filter(x=>x.id!==e.id))} style={{...B,border:"none",background:"none",cursor:"pointer",color:"#ddd",fontSize:16}}>×</button>
        </div>
      ))}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const [records, setRecords] = useState({});
  const [monthGoals, setMonthGoals] = useState({});
  const [soloMenus, setSoloMenus] = useState([]);
  const [trainMenus, setTrainMenus] = useState([]);
  const [otetsudaiMenus, setOtetsudaiMenus] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [page, setPage] = useState("calendar"); // calendar|soloMenu|trainMenu|otetsudaiMenu|ledger
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState("calendar"); // calendar|day
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [sel, setSel] = useState(null);
  const [editMode, setEditMode] = useState(null);
  // day edit state
  const [solosList, setSolosList] = useState([newSolo()]);
  const [teamsList, setTeamsList] = useState([newTeam()]);
  const [gamesList, setGamesList] = useState([newGame()]);
  const [trainMenuLocal, setTrainMenuLocal] = useState([]);
  const [trainInp, setTrainInp] = useState("");
  const [otetsudaiLocal, setOtetsudaiLocal] = useState(newOtetsudai());
  const [parentComment, setParentComment] = useState("");
  const [editingParent, setEditingParent] = useState(false);
  const [goalEdit, setGoalEdit] = useState(false);
  const [goalForm, setGoalForm] = useState(newGoal());

  const todayDs = fmtDate(now.getFullYear(), now.getMonth(), now.getDate());
  const getRec = ds => records[ds] || {};
  const goalKey = `${calYear}-${p2(calMonth+1)}`;
  const currentGoal = monthGoals[goalKey] || newGoal();

  const oteMon = otetsudaiTotal(records, calYear, calMonth);
  const oteYear = otetsudaiYearTotal(records, calYear);

  function updRec(ds, data) {
    setRecords(r => ({ ...r, [ds]: { ...(r[ds]||{}), ...data } }));
  }

  function openDay(day) {
    const ds = fmtDate(calYear, calMonth, day);
    const rec = getRec(ds);
    setSel(ds);
    setParentComment(rec.parentComment||"");
    setEditingParent(!rec.parentComment);
    setEditMode(null);
    setView("day");
  }

  function startEdit(type) {
    const rec = getRec(sel);
    if(type==="solo") setSolosList(rec.solos?.length>0?[...rec.solos.map(s=>({...newSolo(),...s}))]:[newSolo()]);
    else if(type==="team") setTeamsList(rec.teams?.length>0?[...rec.teams.map(t=>({...newTeam(),...t}))]:[newTeam()]);
    else if(type==="games") setGamesList(rec.games?.length>0?[...rec.games.map(g=>({...newGame(),...g}))]:[newGame()]);
    else if(type==="training") { setTrainMenuLocal(rec.training?.menus||[]); setTrainInp(""); }
    else if(type==="otetsudai") setOtetsudaiLocal(rec.otetsudai||newOtetsudai());
    setEditMode(type);
  }

  function saveEdit() {
    let data;
    if(editMode==="solo") data={solos:solosList};
    else if(editMode==="team") data={teams:teamsList};
    else if(editMode==="games") data={games:gamesList};
    else if(editMode==="training") data={training:{menus:trainMenuLocal}};
    else if(editMode==="otetsudai") data={otetsudai:otetsudaiLocal};
    updRec(sel, data);
    setEditMode(null);
  }

  // calendar helpers
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();

  function dotColors(ds) {
    const r = getRec(ds);
    const flags = [r.solos?.length>0?C.solo:null, r.teams?.length>0?C.team:null, r.games?.length>0?C.game:null, r.training?.menus?.length>0?C.train:null, r.otetsudai?.items?.length>0?C.otetsudai:null].filter(Boolean);
    return flags;
  }

  const prevM = () => { if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1); };
  const nextM = () => { if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1); };

  // ── Hamburger Menu ──
  const HamMenu = () => (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
      <div style={{width:240,background:"#fff",boxShadow:"4px 0 20px rgba(0,0,0,0.12)",padding:16,display:"flex",flexDirection:"column",gap:4}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:15,fontWeight:700}}>メニュー</span>
          <button onClick={()=>setMenuOpen(false)} style={{...B,border:"none",background:"none",cursor:"pointer",fontSize:22,color:C.sub}}>×</button>
        </div>
        {[
          {id:"calendar",icon:"📅",label:"カレンダー"},
          {id:"soloMenu",icon:"🏀",label:"自主練メニュー"},
          {id:"trainMenu",icon:"💪",label:"トレーニングメニュー"},
          {id:"otetsudaiMenu",icon:"🧹",label:"お手伝いリスト"},
          {id:"ledger",icon:"💰",label:"小遣い帳"},
        ].map(({id,icon,label})=>(
          <button key={id} onClick={()=>{setPage(id);setMenuOpen(false);setView("calendar");}} style={{...btn(),textAlign:"left",padding:"11px 14px",fontWeight:page===id?700:400,background:page===id?"#F7F6F3":"transparent",border:`1px solid ${page===id?C.border:"transparent"}`,fontSize:14}}>
            {icon}　{label}
          </button>
        ))}
      </div>
      <div style={{flex:1,background:"rgba(0,0,0,0.25)"}} onClick={()=>setMenuOpen(false)}/>
    </div>
  );

  const HamBtn = () => (
    <button onClick={()=>setMenuOpen(true)} style={{...B,border:"none",background:"none",cursor:"pointer",padding:4,display:"flex",flexDirection:"column",gap:4}}>
      {[0,1,2].map(i=><span key={i} style={{display:"block",width:20,height:2,background:C.text,borderRadius:1}}/>)}
    </button>
  );

  // ── Page: メニュー系 ──
  if(page==="soloMenu") return(
    <div style={{...B,background:C.bg,minHeight:"100vh",padding:16}}>
      {menuOpen&&<HamMenu/>}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <HamBtn/><span style={{fontSize:16,fontWeight:700}}>🏀 自主練メニュー</span>
      </div>
      <MenuListPage color={C.solo} menus={soloMenus} onSave={setSoloMenus}/>
    </div>
  );
  if(page==="trainMenu") return(
    <div style={{...B,background:C.bg,minHeight:"100vh",padding:16}}>
      {menuOpen&&<HamMenu/>}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <HamBtn/><span style={{fontSize:16,fontWeight:700}}>💪 トレーニングメニュー</span>
      </div>
      <MenuListPage color={C.train} menus={trainMenus} onSave={setTrainMenus}/>
    </div>
  );
  if(page==="otetsudaiMenu") return(
    <div style={{...B,background:C.bg,minHeight:"100vh",padding:16}}>
      {menuOpen&&<HamMenu/>}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <HamBtn/><span style={{fontSize:16,fontWeight:700}}>🧹 お手伝いリスト</span>
      </div>
      <p style={{fontSize:12,color:C.sub,margin:"0 0 14px"}}>お手伝いの内容と1回あたりの金額を設定できます</p>
      <MenuListPage color={C.otetsudai} menus={otetsudaiMenus} onSave={setOtetsudaiMenus} withAmount={true}/>
    </div>
  );
  if(page==="ledger") return(
    <div style={{...B,background:C.bg,minHeight:"100vh",padding:16}}>
      {menuOpen&&<HamMenu/>}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <HamBtn/><span style={{fontSize:16,fontWeight:700}}>💰 小遣い帳</span>
      </div>
      <LedgerPage ledger={ledger} onSave={setLedger} records={records}/>
    </div>
  );

  // ── Day View ──
  if(view==="day" && sel) {
    const rec = getRec(sel);
    const [y,m,d] = sel.split("-");
    const label = `${parseInt(y)}年${parseInt(m)}月${parseInt(d)}日`;
    const solos = rec.solos||[];
    const teams = rec.teams||[];
    const games = rec.games||[];
    const oteItems = rec.otetsudai?.items||[];
    const oteTotal = oteItems.reduce((s,it)=>s+(Number(it.amount)||0)*(Number(it.count)||1),0);

    // edit subviews
    if(editMode==="solo") return(
      <div style={{...B,background:C.bg,minHeight:"100vh",padding:16}}>
        <button onClick={()=>setEditMode(null)} style={btn({marginBottom:16})}>← 戻る</button>
        <h2 style={{fontSize:17,fontWeight:700,margin:"0 0 16px"}}>🏀 自主練を記録</h2>
        {solosList.map((s,i)=><SoloForm key={s.id} solo={s} idx={i} total={solosList.length} onChange={u=>setSolosList(l=>l.map((x,j)=>j===i?u:x))} onDel={()=>setSolosList(l=>l.filter((_,j)=>j!==i))} soloMenus={soloMenus}/>)}
        <button onClick={()=>setSolosList(l=>[...l,newSolo()])} style={btn({width:"100%",borderColor:C.solo,color:C.solo,marginBottom:14})}>＋ 自主練を追加</button>
        <div style={{display:"flex",gap:8}}>
          <button onClick={saveEdit} style={btn({flex:1,background:C.solo,color:"#fff",border:"none",fontWeight:700})}>保存</button>
          {solos.length>0&&<button onClick={()=>{updRec(sel,{solos:[]});setEditMode(null);}} style={btn({color:"#e24b4a",borderColor:"#e24b4a"})}>削除</button>}
        </div>
      </div>
    );
    if(editMode==="team") return(
      <div style={{...B,background:C.bg,minHeight:"100vh",padding:16}}>
        <button onClick={()=>setEditMode(null)} style={btn({marginBottom:16})}>← 戻る</button>
        <h2 style={{fontSize:17,fontWeight:700,margin:"0 0 16px"}}>👥 チーム練習日記</h2>
        {teamsList.map((t,i)=><TeamForm key={t.id} team={t} idx={i} total={teamsList.length} onChange={u=>setTeamsList(l=>l.map((x,j)=>j===i?u:x))} onDel={()=>setTeamsList(l=>l.filter((_,j)=>j!==i))}/>)}
        <button onClick={()=>setTeamsList(l=>[...l,newTeam()])} style={btn({width:"100%",borderColor:C.team,color:C.team,marginBottom:14})}>＋ チーム練習を追加</button>
        <div style={{display:"flex",gap:8}}>
          <button onClick={saveEdit} style={btn({flex:1,background:C.team,color:"#fff",border:"none",fontWeight:700})}>保存</button>
          {teams.length>0&&<button onClick={()=>{updRec(sel,{teams:[]});setEditMode(null);}} style={btn({color:"#e24b4a",borderColor:"#e24b4a"})}>削除</button>}
        </div>
      </div>
    );
    if(editMode==="training") return(
      <div style={{...B,background:C.bg,minHeight:"100vh",padding:16}}>
        <button onClick={()=>setEditMode(null)} style={btn({marginBottom:16})}>← 戻る</button>
        <h2 style={{fontSize:17,fontWeight:700,margin:"0 0 16px"}}>💪 トレーニング</h2>
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <input value={trainInp} onChange={e=>setTrainInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(()=>{const v=trainInp.trim();if(!v)return;setTrainMenuLocal(l=>[...l,v]);setTrainInp("");})()}  placeholder="例：腕立て30回" style={{...inp,flex:1}}/>
          <button onClick={()=>{const v=trainInp.trim();if(!v)return;setTrainMenuLocal(l=>[...l,v]);setTrainInp("");}} style={btn({borderColor:C.train,color:C.train})}>追加</button>
        </div>
        {trainMenus.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>{trainMenus.map((m,i)=><button key={i} onClick={()=>setTrainMenuLocal(l=>[...l,m])} style={{...B,border:`1px solid ${C.train}`,borderRadius:12,padding:"4px 10px",fontSize:11,background:"#EEEDFE",color:C.train,cursor:"pointer"}}>{m}</button>)}</div>}
        {trainMenuLocal.map((m,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:C.card,borderRadius:8,border:`1px solid ${C.border}`,marginBottom:5}}><span style={{flex:1,fontSize:13}}>{m}</span><button onClick={()=>setTrainMenuLocal(l=>l.filter((_,j)=>j!==i))} style={{...B,border:"none",background:"none",cursor:"pointer",color:"#ccc",fontSize:16}}>×</button></div>)}
        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button onClick={saveEdit} style={btn({flex:1,background:C.train,color:"#fff",border:"none",fontWeight:700})}>保存</button>
          {rec.training?.menus?.length>0&&<button onClick={()=>{updRec(sel,{training:{menus:[]}});setEditMode(null);}} style={btn({color:"#e24b4a",borderColor:"#e24b4a"})}>削除</button>}
        </div>
      </div>
    );
    if(editMode==="otetsudai") return(
      <div style={{...B,background:C.bg,minHeight:"100vh",padding:16}}>
        <button onClick={()=>setEditMode(null)} style={btn({marginBottom:16})}>← 戻る</button>
        <h2 style={{fontSize:17,fontWeight:700,margin:"0 0 16px"}}>🧹 お手伝いを記録</h2>
        <OtetsudaiForm form={otetsudaiLocal} onChange={setOtetsudaiLocal} menus={otetsudaiMenus}/>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <button onClick={saveEdit} style={btn({flex:1,background:C.otetsudai,color:"#fff",border:"none",fontWeight:700})}>保存</button>
          {oteItems.length>0&&<button onClick={()=>{updRec(sel,{otetsudai:newOtetsudai()});setEditMode(null);}} style={btn({color:"#e24b4a",borderColor:"#e24b4a"})}>削除</button>}
        </div>
      </div>
    );

    // day summary view
    return(
      <div style={{...B,background:C.bg,minHeight:"100vh",padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <button onClick={()=>setView("calendar")} style={btn()}>← カレンダー</button>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{ const [yy,mm,dd]=sel.split("-").map(Number); const dt=new Date(yy,mm-1,dd-1); setSel(fmtDate(dt.getFullYear(),dt.getMonth(),dt.getDate())); setCalYear(dt.getFullYear()); setCalMonth(dt.getMonth()); setEditMode(null); }} style={btn({padding:"6px 10px"})}>‹</button>
            <button onClick={()=>{ const [yy,mm,dd]=sel.split("-").map(Number); const dt=new Date(yy,mm-1,dd+1); setSel(fmtDate(dt.getFullYear(),dt.getMonth(),dt.getDate())); setCalYear(dt.getFullYear()); setCalMonth(dt.getMonth()); setEditMode(null); }} style={btn({padding:"6px 10px"})}>›</button>
          </div>
        </div>
        <h2 style={{fontSize:17,fontWeight:700,margin:"0 0 16px"}}>{label}</h2>

        {/* action buttons */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
          <button onClick={()=>startEdit("solo")} style={btn({borderColor:C.solo,color:C.solo,fontSize:12})}>{solos.length>0?"🏀 自主練を編集":"＋ 自主練"}</button>
          <button onClick={()=>startEdit("team")} style={btn({borderColor:C.team,color:C.team,fontSize:12})}>{teams.length>0?"👥 チーム練習を編集":"＋ チーム練習"}</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:20}}>
          <button onClick={()=>startEdit("training")} style={btn({borderColor:C.train,color:C.train,fontSize:12})}>{rec.training?.menus?.length>0?"💪 編集":"＋ トレーニング"}</button>
          <button onClick={()=>startEdit("games")} style={btn({borderColor:C.game,color:C.game,fontSize:12})}>{games.length>0?"🏆 試合を編集":"＋ 試合"}</button>
          <button onClick={()=>startEdit("otetsudai")} style={btn({borderColor:C.otetsudai,color:C.otetsudai,fontSize:12})}>{oteItems.length>0?"🧹 編集":"＋ お手伝い"}</button>
        </div>

        {/* お手伝い */}
        {oteItems.length>0&&<div style={card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{fontWeight:700}}>🧹 お手伝い</span><span style={{fontWeight:700,color:C.otetsudai}}>{fmtYen(oteTotal)}</span></div>{oteItems.map((it,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,marginBottom:4}}><span style={{width:5,height:5,borderRadius:"50%",background:C.otetsudai,flexShrink:0}}/><span style={{flex:1}}>{it.name}</span>{Number(it.count)>1&&<span style={{color:C.sub,fontSize:11}}>×{it.count}</span>}<span style={{color:C.otetsudai,fontWeight:600}}>{fmtYen((Number(it.amount)||0)*(Number(it.count)||1))}</span></div>)}</div>}

        {/* 自主練 */}
        {solos.length>0&&<div style={card}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span style={{width:8,height:8,borderRadius:"50%",background:C.solo}}/><span style={{fontWeight:700}}>自主練</span><Tag color={C.solo}>{solos.length}回</Tag></div>{solos.map((s,i)=><div key={i}>{i>0&&<hr style={{border:"none",borderTop:`1px solid ${C.border}`,margin:"10px 0"}}/>}{solos.length>1&&<p style={{fontSize:12,fontWeight:700,color:C.solo,margin:"0 0 6px"}}>第{i+1}回</p>}{s.startTime&&s.endTime&&<p style={{fontSize:11,color:C.sub,textAlign:"right",margin:"0 0 6px"}}>{s.startTime}〜{s.endTime} ({calcMins(s.startTime,s.endTime)}分)</p>}{s.drills.length>0&&<div style={{marginBottom:6}}>{s.drills.map((d,j)=><div key={j} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,marginBottom:2}}><span style={{width:4,height:4,borderRadius:"50%",background:C.solo}}/>{d}</div>)}</div>}{s.memo&&<p style={{fontSize:13,color:"#555",margin:0,whiteSpace:"pre-wrap"}}>{s.memo}</p>}</div>)}</div>}

        {/* チーム練習 */}
        {teams.length>0&&<div style={card}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span style={{width:8,height:8,borderRadius:"50%",background:C.team}}/><span style={{fontWeight:700}}>チーム練習</span><Tag color={C.team}>{teams.length}回</Tag></div>{teams.map((t,i)=><div key={i}>{i>0&&<hr style={{border:"none",borderTop:`1px solid ${C.border}`,margin:"10px 0"}}/>}<div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>{teams.length>1&&<Tag color={C.team}>第{i+1}回</Tag>}{t.teamName&&<Tag color={C.team}>{t.teamName}</Tag>}{t.startTime&&t.endTime&&<span style={{fontSize:11,color:C.sub,marginLeft:"auto"}}>{t.startTime}〜{t.endTime}</span>}</div>{[["content","練習内容"],["taught","教えてもらったこと"],["good","上手くできたこと"],["improve","改善すること"],["next","次回に向けて"]].map(([k,l])=>t[k]?<div key={k} style={{marginBottom:6}}><p style={{fontSize:11,color:C.sub,margin:"0 0 2px"}}>{l}</p><p style={{fontSize:13,color:C.text,margin:0,whiteSpace:"pre-wrap"}}>{t[k]}</p></div>:null)}</div>)}</div>}

        {/* トレーニング */}
        {rec.training?.menus?.length>0&&<div style={card}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{width:8,height:8,borderRadius:"50%",background:C.train}}/><span style={{fontWeight:700}}>トレーニング</span></div>{rec.training.menus.map((m,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,marginBottom:3}}><span style={{width:4,height:4,borderRadius:"50%",background:C.train}}/>{m}</div>)}</div>}

        {solos.length===0&&teams.length===0&&!rec.training?.menus?.length&&games.length===0&&oteItems.length===0&&<p style={{textAlign:"center",color:"#ccc",fontSize:13,margin:"2rem 0"}}>まだ記録がありません</p>}

        {/* 両親コメント */}
        <div style={{marginTop:16,borderTop:`1px solid ${C.border}`,paddingTop:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <p style={{fontSize:13,fontWeight:700,color:C.team,margin:0}}>両親からのコメント</p>
            {rec.parentComment&&!editingParent&&<button onClick={()=>{setParentComment(rec.parentComment);setEditingParent(true);}} style={btn({fontSize:11,padding:"4px 8px"})}>編集</button>}
          </div>
          {rec.parentComment&&!editingParent?(
            <div style={{background:"#EBF5FF",borderRadius:8,padding:"10px 12px",border:`1px solid ${C.team}33`}}>
              <p style={{fontSize:13,color:C.text,margin:0,whiteSpace:"pre-wrap"}}>{rec.parentComment}</p>
            </div>
          ):(
            <div>
              <textarea rows={3} placeholder="お父さん・お母さんからのコメント..." value={parentComment} onChange={e=>setParentComment(e.target.value)} style={{...ta,marginBottom:8,borderColor:C.team+"55"}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{updRec(sel,{parentComment});setEditingParent(false);}} style={btn({flex:1,background:C.team,color:"#fff",border:"none",fontWeight:700})}>保存</button>
                {rec.parentComment&&<button onClick={()=>setEditingParent(false)} style={btn()}>キャンセル</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Calendar View ──
  return(
    <div style={{...B,background:C.bg,minHeight:"100vh",padding:16}}>
      {menuOpen&&<HamMenu/>}

      {/* header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <HamBtn/>
        <button onClick={prevM} style={btn({padding:"6px 12px"})}>‹</button>
        <span style={{flex:1,textAlign:"center",fontSize:17,fontWeight:700}}>{calYear}年{calMonth+1}月</span>
        <button onClick={nextM} style={btn({padding:"6px 12px"})}>›</button>
      </div>

      {/* お手伝いバナー */}
      <div style={{background:"#1A1A1A",borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",gap:12,color:"#fff"}}>
        <div style={{flex:1,textAlign:"center"}}>
          <p style={{fontSize:10,color:"#888",margin:"0 0 3px"}}>🧹 {calMonth+1}月のお手伝い</p>
          <p style={{fontSize:18,fontWeight:700,color:C.otetsudai,margin:0}}>{fmtYen(oteMon)}</p>
        </div>
        <div style={{width:1,background:"#333"}}/>
        <div style={{flex:1,textAlign:"center"}}>
          <p style={{fontSize:10,color:"#888",margin:"0 0 3px"}}>📅 {calYear}年 年間合計</p>
          <p style={{fontSize:18,fontWeight:700,color:C.otetsudai,margin:0}}>{fmtYen(oteYear)}</p>
        </div>
      </div>

      {/* 月目標 */}
      <div style={{...card,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:700}}>{calMonth+1}月の目標</span>
          <button onClick={()=>{setGoalForm({...currentGoal});setGoalEdit(true);}} style={btn({fontSize:11,padding:"4px 8px"})}>編集</button>
        </div>
        {goalEdit?(
          <div>
            {[["basketball","🏀 バスケ"],["study","📚 勉強"],["life","🌱 生活"],["training","💪 トレーニング"]].map(([k,l])=>(
              <div key={k} style={{marginBottom:8}}>
                <label style={lbl}>{l}</label>
                <input value={goalForm[k]||""} onChange={e=>setGoalForm(f=>({...f,[k]:e.target.value}))} placeholder="目標を入力" style={inp}/>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={()=>{setMonthGoals(g=>({...g,[goalKey]:goalForm}));setGoalEdit(false);}} style={btn({flex:1,background:"#1A1A1A",color:"#fff",border:"none",fontWeight:700})}>保存</button>
              <button onClick={()=>setGoalEdit(false)} style={btn()}>キャンセル</button>
            </div>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[["basketball","🏀 バスケ"],["study","📚 勉強"],["life","🌱 生活"],["training","💪 トレーニング"]].map(([k,l])=>(
              <div key={k} style={{background:C.bg,borderRadius:8,padding:"8px 10px"}}>
                <p style={{fontSize:10,color:C.sub,margin:"0 0 2px"}}>{l}</p>
                <p style={{fontSize:12,color:currentGoal[k]?C.text:"#ccc",margin:0}}>{currentGoal[k]||"未設定"}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* calendar grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {["日","月","火","水","木","金","土"].map((w,i)=><div key={w} style={{textAlign:"center",fontSize:11,fontWeight:700,color:i===0?"#E53935":i===6?"#1976D2":C.sub,padding:"4px 0"}}>{w}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:14}}>
        {Array.from({length:firstDay}).map((_,i)=><div key={"e"+i}/>)}
        {Array.from({length:daysInMonth}).map((_,i)=>{
          const day=i+1, ds=fmtDate(calYear,calMonth,day);
          const isToday=ds===todayDs;
          const dow=(firstDay+i)%7;
          const dots=dotColors(ds);
          return(
            <button key={day} onClick={()=>openDay(day)} style={{...B,border:`1px solid ${isToday?"#1A1A1A":C.border}`,borderRadius:9,padding:"6px 2px",background:isToday?"#1A1A1A":"#fff",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,minHeight:46}}>
              <span style={{fontSize:13,fontWeight:isToday?700:400,color:isToday?"#fff":dow===0?"#E53935":dow===6?"#1976D2":C.text}}>{day}</span>
              {dots.length>0&&<div style={{display:"flex",gap:2,flexWrap:"wrap",justifyContent:"center"}}>{dots.slice(0,3).map((c,j)=><span key={j} style={{width:5,height:5,borderRadius:"50%",background:c}}/>)}</div>}
            </button>
          );
        })}
      </div>

      {/* 凡例 */}
      <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:8}}>
        {[[C.solo,"自主練"],[C.team,"チーム練習"],[C.game,"試合"],[C.train,"トレーニング"],[C.otetsudai,"お手伝い"]].map(([c,l])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:c}}/>
            <span style={{fontSize:10,color:C.sub}}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
