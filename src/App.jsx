import { useState, useEffect } from "react";
import { supabase } from './supabase.js';

const COLOR = { solo: "#1D9E75", team: "#378ADD", game: "#D85A30", both: "#7F77DD" };

function newGame(){return {opponent:"",myScore:"",oppScore:"",playTime:"",shot2a:"",shot2m:"",shot3a:"",shot3m:"",fta:"",ftm:"",ast:"",reb:"",stl:"",tov:"",foul:"",good:"",reflect:""};};
function newDaySummary(){return {memo:"",good:"",reflect:"",next:"",parentComment:""};};

async function loadFromSupabase() {
  const { data, error } = await supabase.from('records').select('*');
  if (error) { console.error(error); return {}; }
  const result = {};
  data.forEach(row => { result[row.date] = row.data; });
  return result;
}

async function saveToSupabase(date, dayData) {
  const { error } = await supabase
    .from('records')
    .upsert({ date, data: dayData, updated_at: new Date().toISOString() });
  if (error) console.error(error);
}

const btnS=(ex={})=>({padding:"7px 14px",fontSize:13,borderRadius:"8px",border:"0.5px solid #ccc",background:"#fff",color:"#333",cursor:"pointer",...ex});
const lbl={display:"block",fontSize:13,color:"#666",marginBottom:4,fontWeight:500};
const cardS={background:"#f5f5f3",borderRadius:"12px",padding:"12px 14px",marginBottom:12};
const numInp={textAlign:"center",padding:"6px 4px",borderRadius:"8px",border:"0.5px solid #ccc",background:"#fff",color:"#333",width:"100%",boxSizing:"border-box"};
const timeInp={padding:"6px 8px",borderRadius:"8px",border:"0.5px solid #ccc",background:"#fff",color:"#333",fontSize:15,width:"100%",boxSizing:"border-box"};
const taS={width:"100%",boxSizing:"border-box",resize:"vertical",padding:"7px 10px",borderRadius:"8px",border:"0.5px solid #ccc",fontSize:14,color:"#333",background:"#fff"};
const inpS={width:"100%",boxSizing:"border-box",padding:"7px 10px",borderRadius:"8px",border:"0.5px solid #ccc",fontSize:14,color:"#333",background:"#fff"};

function calcSoloMins(solo){
  if(!solo||!solo.startTime||!solo.endTime) return 0;
  const[sh,sm]=solo.startTime.split(":").map(Number);
  const[eh,em]=solo.endTime.split(":").map(Number);
  const d=(eh*60+em)-(sh*60+sm);
  return d>0?d:0;
}

function sumGames(games){
  const s={shot2a:0,shot2m:0,shot3a:0,shot3m:0,fta:0,ftm:0,ast:0,reb:0,stl:0,tov:0,foul:0,mins:0,count:0};
  games.forEach(g=>{
    s.shot2a+=parseInt(g.shot2a)||0; s.shot2m+=parseInt(g.shot2m)||0;
    s.shot3a+=parseInt(g.shot3a)||0; s.shot3m+=parseInt(g.shot3m)||0;
    s.fta+=parseInt(g.fta)||0; s.ftm+=parseInt(g.ftm)||0;
    s.ast+=parseInt(g.ast)||0; s.reb+=parseInt(g.reb)||0;
    s.stl+=parseInt(g.stl)||0; s.tov+=parseInt(g.tov)||0;
    s.foul+=parseInt(g.foul)||0;
    s.mins+=parseInt(g.playTime)||0; s.count++;
  });
  s.pts=s.shot2m*2+s.shot3m*3+s.ftm;
  const totalA=s.shot2a+s.shot3a,totalM=s.shot2m+s.shot3m;
  s.fgPct=totalA>0?Math.round(totalM/totalA*100):null;
  s.p2Pct=s.shot2a>0?Math.round(s.shot2m/s.shot2a*100):null;
  s.p3Pct=s.shot3a>0?Math.round(s.shot3m/s.shot3a*100):null;
  s.ftPct=s.fta>0?Math.round(s.ftm/s.fta*100):null;
  return s;
}

function computeMonthStats(records,year,month){
  let soloDay=0,soloMins=0,gameCount=0;
  const gamesAll=[];
  Object.entries(records).forEach(([ds,rec])=>{
    const[y,m]=ds.split("-").map(Number);
    if(y!==year||m!==month+1) return;
    if(rec.solo){soloDay++;soloMins+=calcSoloMins(rec.solo);}
    if(rec.games&&rec.games.length>0){gameCount+=rec.games.length;gamesAll.push(...rec.games);}
  });
  return{soloDay,soloMins,gameStats:gamesAll.length>0?sumGames(gamesAll):null,gameCount};
}

function computeYearStats(records,year){
  let soloDay=0,soloMins=0;
  const gamesAll=[];
  Object.entries(records).forEach(([ds,rec])=>{
    const[y]=ds.split("-").map(Number);
    if(y!==year) return;
    if(rec.solo){soloDay++;soloMins+=calcSoloMins(rec.solo);}
    if(rec.games&&rec.games.length>0) gamesAll.push(...rec.games);
  });
  return{soloDay,soloMins,gameStats:gamesAll.length>0?sumGames(gamesAll):null,gameCount:gamesAll.length};
}

function fmtDate(y,m,d){return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}

function StatBlock({title,color,soloDay,soloMins,gameCount,gameStats}){
  const hrs=Math.floor(soloMins/60),mins=soloMins%60;
  const soloLabel=soloMins>0?(hrs>0?`${hrs}時間${mins>0?mins+"分":""}`:`${soloMins}分`):"0分";
  return(
    <div style={{background:"#f5f5f3",borderRadius:"12px",padding:"14px",marginBottom:12}}>
      <p style={{fontSize:13,fontWeight:500,color,margin:"0 0 12px"}}>{title}</p>
      <p style={{fontSize:11,color:"#888",margin:"0 0 6px",fontWeight:500}}>自主練</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
        {[["練習日数",soloDay+"日"],["合計時間",soloLabel]].map(([l,v])=>(
          <div key={l} style={{background:"#fff",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
            <p style={{fontSize:11,color:"#888",margin:"0 0 2px"}}>{l}</p>
            <p style={{fontSize:16,fontWeight:500,color:"#333",margin:0}}>{v}</p>
          </div>
        ))}
      </div>
      {gameStats?(
        <div>
          <p style={{fontSize:11,color:"#888",margin:"0 0 6px",fontWeight:500}}>試合</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:6}}>
            {[["試合数",gameCount+"試合"],["出場時間",gameStats.mins+"分"],["得点",gameStats.pts+"点"]].map(([l,v])=>(
              <div key={l} style={{background:"#fff",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
                <p style={{fontSize:11,color:"#888",margin:"0 0 2px"}}>{l}</p>
                <p style={{fontSize:15,fontWeight:500,color:"#333",margin:0}}>{v}</p>
              </div>
            ))}
          </div>
          <div style={{background:"#fff",borderRadius:"8px",padding:"10px",marginBottom:6}}>
            <div style={{display:"grid",gridTemplateColumns:"36px 1fr 1fr",gap:"5px 8px",alignItems:"center"}}>
              <span/><span style={{fontSize:11,color:"#888",textAlign:"center"}}>試投/決定</span><span style={{fontSize:11,color:"#888",textAlign:"center"}}>成功率</span>
              {[
                ["2P",gameStats.shot2m+"/"+gameStats.shot2a,gameStats.p2Pct],
                ["3P",gameStats.shot3m+"/"+gameStats.shot3a,gameStats.p3Pct],
                ["FT",gameStats.ftm+"/"+gameStats.fta,gameStats.ftPct],
                ["FG",(gameStats.shot2m+gameStats.shot3m)+"/"+(gameStats.shot2a+gameStats.shot3a),gameStats.fgPct]
              ].map(([l,v,pct])=>[
                <span key={l+"l"} style={{fontSize:12,fontWeight:500,color:"#333"}}>{l}</span>,
                <span key={l+"v"} style={{fontSize:13,textAlign:"center",color:"#333"}}>{v}</span>,
                <span key={l+"p"} style={{fontSize:13,textAlign:"center",color:"#333"}}>{pct!=null?pct+"%":"-"}</span>
              ])}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
            {[["AST",gameStats.ast],["REB",gameStats.reb],["STL",gameStats.stl],["TO",gameStats.tov],["Foul",gameStats.foul]].map(([l,v])=>(
              <div key={l} style={{background:"#fff",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
                <p style={{fontSize:11,color:"#888",margin:"0 0 2px"}}>{l}</p>
                <p style={{fontSize:14,fontWeight:500,color:"#333",margin:0}}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      ):(
        <div style={{background:"#fff",borderRadius:"8px",padding:"10px",textAlign:"center"}}>
          <p style={{fontSize:13,color:"#aaa",margin:0}}>試合記録なし</p>
        </div>
      )}
    </div>
  );
}

function StatBox({label,value,onChange}){
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <span style={{fontSize:11,color:"#666",textAlign:"center",lineHeight:1.3}}>{label}</span>
      <input type="number" min="0" value={value||""} onChange={e=>onChange(e.target.value)} style={{...numInp,fontSize:15}} />
    </div>
  );
}

function GameForm({game,onChange,onDelete,index,total}){
  const p2m=parseInt(game.shot2m)||0,p3m=parseInt(game.shot3m)||0,ftm=parseInt(game.ftm)||0;
  const calcPts=p2m*2+p3m*3+ftm;
  const sf=k=>v=>onChange({...game,[k]:v});
  const myS=parseInt(game.myScore),oppS=parseInt(game.oppScore);
  const res=(game.myScore!==""&&game.oppScore!==""&&!isNaN(myS)&&!isNaN(oppS))?(myS>oppS?"勝ち":myS<oppS?"負け":"引き分け"):null;
  return(
    <div style={{border:`1px solid ${COLOR.game}44`,borderRadius:"12px",padding:"14px",marginBottom:14,background:"#fff"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontSize:14,fontWeight:500,color:COLOR.game}}>第{index+1}試合</span>
        {total>1&&<button onClick={onDelete} style={{...btnS(),fontSize:12,padding:"4px 10px",color:"#888"}}>削除</button>}
      </div>
      <label style={lbl}>対戦相手</label>
      <input placeholder="チーム名" value={game.opponent||""} onChange={e=>sf("opponent")(e.target.value)} style={{...inpS,marginBottom:12}} />
      <label style={lbl}>試合結果（得点入力）</label>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{flex:1}}><p style={{fontSize:11,color:"#888",margin:"0 0 4px",textAlign:"center"}}>自チーム</p><input type="number" min="0" placeholder="0" value={game.myScore||""} onChange={e=>sf("myScore")(e.target.value)} style={{...numInp,fontSize:20,fontWeight:500,padding:"8px"}} /></div>
        <span style={{fontSize:18,color:"#bbb",marginTop:16}}>–</span>
        <div style={{flex:1}}><p style={{fontSize:11,color:"#888",margin:"0 0 4px",textAlign:"center"}}>相手チーム</p><input type="number" min="0" placeholder="0" value={game.oppScore||""} onChange={e=>sf("oppScore")(e.target.value)} style={{...numInp,fontSize:20,fontWeight:500,padding:"8px"}} /></div>
        {res&&<span style={{marginTop:16,fontSize:12,padding:"4px 10px",borderRadius:12,background:res==="勝ち"?"#EAF3DE":res==="負け"?"#FCEBEB":"#F1EFE8",color:res==="勝ち"?"#3B6D11":res==="負け"?"#A32D2D":"#5F5E5A",whiteSpace:"nowrap"}}>{res}</span>}
      </div>
      <label style={lbl}>出場時間（分）</label>
      <input type="number" min="0" placeholder="例：20" value={game.playTime||""} onChange={e=>sf("playTime")(e.target.value)} style={{...inpS,marginBottom:12}} />
      <p style={{...lbl,marginBottom:8}}>シュート統計</p>
      <div style={{background:"#f5f5f3",borderRadius:"8px",padding:"10px",marginBottom:12}}>
        <div style={{display:"grid",gridTemplateColumns:"40px 1fr 1fr",gap:"6px 10px",alignItems:"center",marginBottom:8}}>
          <span/><span style={{fontSize:11,color:"#888",textAlign:"center"}}>試投数</span><span style={{fontSize:11,color:"#888",textAlign:"center"}}>決定数</span>
          {[["2P","shot2a","shot2m"],["3P","shot3a","shot3m"],["FT","fta","ftm"]].map(([label,ka,km])=>[
            <span key={label} style={{fontSize:13,fontWeight:500,color:"#333"}}>{label}</span>,
            <input key={ka} type="number" min="0" value={game[ka]||""} onChange={e=>sf(ka)(e.target.value)} style={numInp} />,
            <input key={km} type="number" min="0" value={game[km]||""} onChange={e=>sf(km)(e.target.value)} style={numInp} />
          ])}
        </div>
        <div style={{borderTop:"0.5px solid #ddd",paddingTop:8,display:"flex",justifyContent:"flex-end",gap:6,alignItems:"center"}}>
          <span style={{fontSize:12,color:"#888"}}>計算上の得点</span>
          <span style={{fontSize:18,fontWeight:500,color:COLOR.game}}>{calcPts}点</span>
        </div>
      </div>
      <p style={{...lbl,marginBottom:8}}>スタッツ</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:12}}>
        <StatBox label="AST" value={game.ast} onChange={sf("ast")} />
        <StatBox label="REB" value={game.reb} onChange={sf("reb")} />
        <StatBox label="STL" value={game.stl} onChange={sf("stl")} />
        <StatBox label="TO" value={game.tov} onChange={sf("tov")} />
        <StatBox label="Foul" value={game.foul} onChange={sf("foul")} />
      </div>
      <label style={lbl}>この試合の上手くいったこと</label>
      <textarea rows={2} placeholder="この試合で良かったプレーなど" value={game.good||""} onChange={e=>sf("good")(e.target.value)} style={{...taS,marginBottom:10}} />
      <label style={lbl}>この試合の反省点</label>
      <textarea rows={2} placeholder="この試合で改善したいこと" value={game.reflect||""} onChange={e=>sf("reflect")(e.target.value)} style={taS} />
    </div>
  );
}

function GameCard({game,index}){
  const p2m=parseInt(game.shot2m)||0,p3m=parseInt(game.shot3m)||0,ftm=parseInt(game.ftm)||0;
  const calcPts=p2m*2+p3m*3+ftm;
  const myS=parseInt(game.myScore),oppS=parseInt(game.oppScore);
  const res=(game.myScore!==""&&game.oppScore!==""&&!isNaN(myS)&&!isNaN(oppS))?(myS>oppS?"勝ち":myS<oppS?"負け":"引き分け"):null;
  return(
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
        <span style={{fontSize:13,fontWeight:500,color:COLOR.game}}>第{index+1}試合</span>
        {game.opponent&&<span style={{fontSize:13,color:"#888"}}>vs {game.opponent}</span>}
        {(game.myScore!==""||game.oppScore!=="")&&<span style={{fontSize:13,color:"#333",fontWeight:500}}>{game.myScore||0} – {game.oppScore||0}</span>}
        {res&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:res==="勝ち"?"#EAF3DE":res==="負け"?"#FCEBEB":"#F1EFE8",color:res==="勝ち"?"#3B6D11":res==="負け"?"#A32D2D":"#5F5E5A"}}>{res}</span>}
        {game.playTime&&<span style={{fontSize:12,color:"#888",marginLeft:"auto"}}>{game.playTime}分</span>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4,marginBottom:4}}>
        {[["2P",(game.shot2m||0)+"/"+(game.shot2a||0)],["3P",(game.shot3m||0)+"/"+(game.shot3a||0)],["FT",(game.ftm||0)+"/"+(game.fta||0)],["得点",calcPts+"点"],["AST",game.ast||"-"]].map(([l,v])=>(
          <div key={l} style={{background:"#fff",borderRadius:"8px",padding:"5px 4px",textAlign:"center"}}>
            <p style={{fontSize:10,color:"#888",margin:"0 0 2px"}}>{l}</p>
            <p style={{fontSize:13,fontWeight:500,color:"#333",margin:0}}>{v}</p>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:6}}>
        {[["REB",game.reb],["STL",game.stl],["TO",game.tov],["Foul",game.foul]].map(([l,v])=>(
          <div key={l} style={{background:"#fff",borderRadius:"8px",padding:"5px 4px",textAlign:"center"}}>
            <p style={{fontSize:10,color:"#888",margin:"0 0 2px"}}>{l}</p>
            <p style={{fontSize:13,fontWeight:500,color:"#333",margin:0}}>{v||"-"}</p>
          </div>
        ))}
      </div>
      {game.good&&<div style={{marginBottom:4}}><span style={{fontSize:11,color:"#888"}}>上手くいったこと　</span><span style={{fontSize:13,color:"#333",whiteSpace:"pre-wrap"}}>{game.good}</span></div>}
      {game.reflect&&<div><span style={{fontSize:11,color:"#888"}}>反省点　</span><span style={{fontSize:13,color:"#333",whiteSpace:"pre-wrap"}}>{game.reflect}</span></div>}
    </div>
  );
}

export default function App(){
  const [records,setRecords]=useState({});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [view,setView]=useState("calendar");
  const [today]=useState(()=>new Date());
  const [calYear,setCalYear]=useState(today.getFullYear());
  const [calMonth,setCalMonth]=useState(today.getMonth());
  const [sel,setSel]=useState(null);
  const [editMode,setEditMode]=useState(null);
  const [soloForm,setSoloForm]=useState({});
  const [teamForm,setTeamForm]=useState({});
  const [gamesList,setGamesList]=useState([newGame()]);
  const [daySummary,setDaySummary]=useState(newDaySummary());
  const [drillInput,setDrillInput]=useState("");
  const [statsTab,setStatsTab]=useState("month");
  const [parentComment,setParentComment]=useState("");

  useEffect(()=>{
    loadFromSupabase().then(data=>{setRecords(data);setLoading(false);});
  },[]);

  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const getRec=ds=>records[ds]||{};

  function dotColor(ds){
    const r=getRec(ds);
    const types=["solo","team","games"].filter(t=>t==="games"?r[t]&&r[t].length>0:r[t]);
    if(types.length>=2) return COLOR.both;
    if(types[0]==="solo") return COLOR.solo;
    if(types[0]==="team") return COLOR.team;
    if(types[0]==="games") return COLOR.game;
    return null;
  }

  function openDay(day){
    const ds=fmtDate(calYear,calMonth,day);
    setSel(ds);
    setParentComment(records[ds]?.parentComment||"");
    setEditMode(null);
    setView("day");
  }

  function startEdit(type){
    const r=getRec(sel);
    if(type==="solo"){setSoloForm(r.solo||{drills:[],startTime:"",endTime:"",memo:""});setDrillInput("");}
    else if(type==="team") setTeamForm(r.team||{team:"",content:"",taught:"",good:"",improve:"",next:""});
    else{setGamesList(r.games&&r.games.length>0?r.games.map(g=>({...newGame(),...g})):[newGame()]);setDaySummary(r.daySummary||newDaySummary());}
    setEditMode(type);
  }

  async function saveEdit(){
    setSaving(true);
    let data;
    if(editMode==="solo") data={solo:soloForm};
    else if(editMode==="team") data={team:teamForm};
    else data={games:gamesList,daySummary};
    const newDayData={...(records[sel]||{}),...data};
    await saveToSupabase(sel,newDayData);
    setRecords(prev=>({...prev,[sel]:newDayData}));
    setSaving(false);
    setEditMode(null);
  }

  async function saveParentComment(){
    setSaving(true);
    const newDayData={...(records[sel]||{}),parentComment};
    await saveToSupabase(sel,newDayData);
    setRecords(prev=>({...prev,[sel]:newDayData}));
    setSaving(false);
  }

  async function delRecord(type){
    setSaving(true);
    const rec={...(records[sel]||{})};
    if(type==="games"){delete rec.games;delete rec.daySummary;}else delete rec[type];
    let newRecords;
    if(Object.keys(rec).length===0){
      await supabase.from('records').delete().eq('date',sel);
      newRecords={...records};delete newRecords[sel];
    } else {
      await saveToSupabase(sel,rec);
      newRecords={...records,[sel]:rec};
    }
    setRecords(newRecords);
    setSaving(false);
    setEditMode(null);
  }

  function addDrill(){const v=drillInput.trim();if(!v)return;setSoloForm(f=>({...f,drills:[...(f.drills||[]),v]}));setDrillInput("");}
  function removeDrill(i){setSoloForm(f=>({...f,drills:f.drills.filter((_,j)=>j!==i)}));}

  const soloMinsPreview=(()=>{if(!soloForm.startTime||!soloForm.endTime)return null;const[sh,sm]=soloForm.startTime.split(":").map(Number);const[eh,em]=soloForm.endTime.split(":").map(Number);const d=(eh*60+em)-(sh*60+sm);return d>0?d:null;})();

  const prevM=()=>{if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1);};
  const nextM=()=>{if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1);};
  const wdays=["日","月","火","水","木","金","土"];
  const monthStats=computeMonthStats(records,calYear,calMonth);
  const yearStats=computeYearStats(records,calYear);

  if(loading) return(<div style={{padding:"3rem",textAlign:"center",color:"#888",fontSize:15}}>読み込み中...</div>);

  if(view==="day"){
    const rec=getRec(sel);
    const[y,m,d]=sel.split("-");
    const label=`${parseInt(y)}年${parseInt(m)}月${parseInt(d)}日`;

    if(editMode==="solo") return(
      <div style={{padding:"1rem",maxWidth:520,margin:"0 auto"}}>
        <button onClick={()=>setEditMode(null)} style={btnS()}>← 戻る</button>
        <h2 style={{fontSize:18,fontWeight:500,margin:"1rem 0 1.25rem",color:"#333"}}>自主練を記録</h2>
        <label style={lbl}>練習時間</label>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,alignItems:"center",marginBottom:4}}>
          <input type="time" value={soloForm.startTime||""} onChange={e=>setSoloForm(f=>({...f,startTime:e.target.value}))} style={timeInp} />
          <span style={{fontSize:13,color:"#888",textAlign:"center"}}>〜</span>
          <input type="time" value={soloForm.endTime||""} onChange={e=>setSoloForm(f=>({...f,endTime:e.target.value}))} style={timeInp} />
        </div>
        {soloMinsPreview?<p style={{fontSize:12,color:"#888",margin:"0 0 14px",textAlign:"right"}}>{soloMinsPreview}分間</p>:<div style={{marginBottom:14}}/>}
        <label style={lbl}>練習メニュー</label>
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <input placeholder="例：レッグスルー50本" value={drillInput} onChange={e=>setDrillInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addDrill()} style={{flex:1,padding:"7px 10px",borderRadius:"8px",border:"0.5px solid #ccc",background:"#fff",color:"#333",fontSize:14}} />
          <button onClick={addDrill} style={btnS({borderColor:COLOR.solo,color:COLOR.solo,padding:"7px 14px"})}>追加</button>
        </div>
        {(soloForm.drills||[]).length>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:14}}>
            {soloForm.drills.map((d,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#f5f5f3",borderRadius:"8px",padding:"7px 10px"}}>
                <span style={{fontSize:13,color:"#333",flex:1}}>{d}</span>
                <button onClick={()=>removeDrill(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#aaa",fontSize:16,lineHeight:1,padding:"0 2px"}}>×</button>
              </div>
            ))}
          </div>
        )}
        <label style={lbl}>メモ・感想</label>
        <textarea rows={4} placeholder="気づきや課題など" value={soloForm.memo||""} onChange={e=>setSoloForm(f=>({...f,memo:e.target.value}))} style={{...taS,marginBottom:16}} />
        <div style={{display:"flex",gap:8}}>
          <button onClick={saveEdit} disabled={saving} style={btnS({background:COLOR.solo,color:"#fff",border:"none",flex:1,opacity:saving?0.7:1})}>{saving?"保存中...":"保存"}</button>
          {rec.solo&&<button onClick={()=>delRecord("solo")} disabled={saving} style={btnS({color:"#e24b4a",borderColor:"#e24b4a"})}>削除</button>}
        </div>
      </div>
    );

    if(editMode==="team"){
      const fields=[
        {k:"team",l:"チーム",ph:"チーム名"},
        {k:"content",l:"練習内容",ph:"今日の練習メニュー"},
        {k:"taught",l:"教えてもらったこと",ph:"コーチや先輩から"},
        {k:"good",l:"上手くできたこと",ph:"うまくいったプレー"},
        {k:"improve",l:"改善すること",ph:"次につながる課題"},
        {k:"next",l:"次回の練習に向けて",ph:"次回意識したいこと"}
      ];
      return(
        <div style={{padding:"1rem",maxWidth:520,margin:"0 auto"}}>
          <button onClick={()=>setEditMode(null)} style={btnS()}>← 戻る</button>
          <h2 style={{fontSize:18,fontWeight:500,margin:"1rem 0 1.25rem",color:"#333"}}>チーム練習日記</h2>
          {fields.map(({k,l,ph})=>(
            <div key={k}>
              <label style={lbl}>{l}</label>
              {k==="team"
                ?<input placeholder={ph} value={teamForm[k]||""} onChange={e=>setTeamForm(f=>({...f,[k]:e.target.value}))} style={{...inpS,marginBottom:12}} />
                :<textarea rows={3} placeholder={ph} value={teamForm[k]||""} onChange={e=>setTeamForm(f=>({...f,[k]:e.target.value}))} style={{...taS,marginBottom:12}} />
              }
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={saveEdit} disabled={saving} style={btnS({background:COLOR.team,color:"#fff",border:"none",flex:1,opacity:saving?0.7:1})}>{saving?"保存中...":"保存"}</button>
            {rec.team&&<button onClick={()=>delRecord("team")} disabled={saving} style={btnS({color:"#e24b4a",borderColor:"#e24b4a"})}>削除</button>}
          </div>
        </div>
      );
    }

    if(editMode==="games") return(
      <div style={{padding:"1rem",maxWidth:520,margin:"0 auto"}}>
        <button onClick={()=>setEditMode(null)} style={btnS()}>← 戻る</button>
        <h2 style={{fontSize:18,fontWeight:500,margin:"1rem 0 1.25rem",color:"#333"}}>試合記録</h2>
        {gamesList.map((g,i)=>(
          <GameForm key={i} game={g} index={i} total={gamesList.length}
            onChange={updated=>setGamesList(list=>list.map((x,j)=>j===i?updated:x))}
            onDelete={()=>setGamesList(list=>list.filter((_,j)=>j!==i))} />
        ))}
        <button onClick={()=>setGamesList(l=>[...l,newGame()])} style={btnS({width:"100%",marginBottom:20,borderColor:COLOR.game,color:COLOR.game})}>+ 試合を追加</button>
        <div style={{borderTop:`2px solid ${COLOR.game}44`,paddingTop:16,marginBottom:16}}>
          <p style={{fontSize:15,fontWeight:500,color:COLOR.game,margin:"0 0 14px"}}>今日の試合まとめ</p>
          {[{k:"memo",l:"今日の試合の感想",ph:"全体を通して感じたこと"},{k:"good",l:"今日の試合の上手くいったこと",ph:"今日良かったプレーや成長を感じたこと"},{k:"reflect",l:"今日の試合の反省点",ph:"今日改善すべきだったこと"},{k:"next",l:"次回に向けて",ph:"次の試合で意識したいこと"}].map(({k,l,ph})=>(
            <div key={k}><label style={lbl}>{l}</label><textarea rows={2} placeholder={ph} value={daySummary[k]||""} onChange={e=>setDaySummary(f=>({...f,[k]:e.target.value}))} style={{...taS,marginBottom:12}} /></div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={saveEdit} disabled={saving} style={btnS({background:COLOR.game,color:"#fff",border:"none",flex:1,opacity:saving?0.7:1})}>{saving?"保存中...":"保存"}</button>
          {rec.games&&rec.games.length>0&&<button onClick={()=>delRecord("games")} disabled={saving} style={btnS({color:"#e24b4a",borderColor:"#e24b4a"})}>削除</button>}
        </div>
      </div>
    );

    const games=rec.games||[];
    const ds2=rec.daySummary||{};
    const totals=games.length>0?sumGames(games):null;
    const recSoloMins=calcSoloMins(rec.solo);
    return(
      <div style={{padding:"1rem",maxWidth:520,margin:"0 auto"}}>
        <button onClick={()=>setView("calendar")} style={btnS()}>← カレンダー</button>
        <h2 style={{fontSize:18,fontWeight:500,margin:"1rem 0 1.25rem",color:"#333"}}>{label}</h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:20}}>
          {[{type:"solo",label:"自主練",color:COLOR.solo},{type:"team",label:"チーム練習",color:COLOR.team},{type:"games",label:"試合",color:COLOR.game}].map(({type,label,color})=>(
            <button key={type} onClick={()=>startEdit(type)} style={btnS({borderColor:color,color:color,fontSize:12,padding:"8px 4px",textAlign:"center"})}>
              {type==="games"?games.length>0?"試合を編集":"+ 試合":rec[type]?`${label}を編集`:`+ ${label}`}
            </button>
          ))}
        </div>

        {rec.solo&&(
          <div style={cardS}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:COLOR.solo,flexShrink:0}}/>
              <span style={{fontWeight:500,fontSize:15,color:"#333"}}>自主練</span>
              {rec.solo.startTime&&rec.solo.endTime&&<span style={{fontSize:12,color:"#888",marginLeft:"auto"}}>{rec.solo.startTime}〜{rec.solo.endTime}{recSoloMins>0?` (${recSoloMins}分)`:""}</span>}
            </div>
            {(rec.solo.drills||[]).length>0&&<div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:8}}>{rec.solo.drills.map((d,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:5,height:5,borderRadius:"50%",background:COLOR.solo,flexShrink:0}}/><span style={{fontSize:13,color:"#333"}}>{d}</span></div>)}</div>}
            {rec.solo.memo&&<p style={{fontSize:13,color:"#666",margin:0,whiteSpace:"pre-wrap"}}>{rec.solo.memo}</p>}
          </div>
        )}

        {rec.team&&(
          <div style={cardS}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:COLOR.team,flexShrink:0}}/>
              <span style={{fontWeight:500,fontSize:15,color:"#333"}}>チーム練習</span>
              {rec.team.team&&<span style={{fontSize:13,color:"#888",marginLeft:"auto"}}>{rec.team.team}</span>}
            </div>
            {[{k:"content",l:"練習内容"},{k:"taught",l:"教えてもらったこと"},{k:"good",l:"上手くできたこと"},{k:"improve",l:"改善すること"},{k:"next",l:"次回に向けて"}].map(({k,l})=>rec.team[k]?<div key={k} style={{marginBottom:6}}><p style={{fontSize:12,color:"#888",margin:"0 0 2px"}}>{l}</p><p style={{fontSize:13,color:"#333",margin:0,whiteSpace:"pre-wrap"}}>{rec.team[k]}</p></div>:null)}
          </div>
        )}

        {games.length>0&&(
          <div style={cardS}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:COLOR.game,flexShrink:0}}/>
              <span style={{fontWeight:500,fontSize:15,color:"#333"}}>試合</span>
              <span style={{fontSize:12,color:"#888",marginLeft:"auto"}}>{games.length}試合</span>
            </div>
            {totals&&games.length>1&&(
              <div style={{background:"#fff",borderRadius:"8px",padding:"10px 12px",marginBottom:14,border:`0.5px solid ${COLOR.game}44`}}>
                <p style={{fontSize:12,fontWeight:500,color:COLOR.game,margin:"0 0 8px"}}>本日の合計</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:4}}>
                  {[["出場",totals.mins>0?totals.mins+"分":"-"],["得点",totals.pts+"点"],["2P",totals.shot2m+"/"+totals.shot2a],["3P",totals.shot3m+"/"+totals.shot3a]].map(([l,v])=>(
                    <div key={l} style={{textAlign:"center"}}><p style={{fontSize:10,color:"#888",margin:"0 0 2px"}}>{l}</p><p style={{fontSize:14,fontWeight:500,color:"#333",margin:0}}>{v}</p></div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4,borderTop:"0.5px solid #ddd",paddingTop:6,marginTop:4}}>
                  {[["FT",totals.ftm+"/"+totals.fta],["AST",totals.ast],["REB",totals.reb],["STL",totals.stl],["TO",totals.tov]].map(([l,v])=>(
                    <div key={l} style={{textAlign:"center"}}><p style={{fontSize:10,color:"#888",margin:"0 0 2px"}}>{l}</p><p style={{fontSize:13,fontWeight:500,color:"#333",margin:0}}>{v||0}</p></div>
                  ))}
                </div>
              </div>
            )}
            {games.map((g,i)=>(<div key={i}>{i>0&&<div style={{borderTop:"0.5px solid #ddd",margin:"10px 0"}}/>}<GameCard game={g} index={i} /></div>))}
            {(ds2.memo||ds2.good||ds2.reflect||ds2.next)&&(
              <div style={{borderTop:`1.5px solid ${COLOR.game}33`,marginTop:12,paddingTop:12}}>
                <p style={{fontSize:13,fontWeight:500,color:COLOR.game,margin:"0 0 10px"}}>今日の試合まとめ</p>
                {[{k:"memo",l:"感想"},{k:"good",l:"上手くいったこと"},{k:"reflect",l:"反省点"},{k:"next",l:"次回に向けて"}].map(({k,l})=>ds2[k]?<div key={k} style={{marginBottom:7}}><p style={{fontSize:12,color:"#888",margin:"0 0 2px"}}>{l}</p><p style={{fontSize:13,color:"#333",margin:0,whiteSpace:"pre-wrap"}}>{ds2[k]}</p></div>:null)}
              </div>
            )}
          </div>
        )}

        {!rec.solo&&!rec.team&&games.length===0&&<p style={{fontSize:14,color:"#bbb",textAlign:"center",marginTop:32}}>まだ記録がありません</p>}

        <div style={{marginTop:16,borderTop:"0.5px solid #ddd",paddingTop:14}}>
          <p style={{fontSize:13,fontWeight:500,color:COLOR.team,margin:"0 0 8px"}}>両親からのコメント</p>
          {rec.parentComment&&(
            <div style={{background:"#EBF5FF",borderRadius:"8px",padding:"10px 12px",marginBottom:10,border:`0.5px solid ${COLOR.team}44`}}>
              <p style={{fontSize:13,color:"#333",margin:0,whiteSpace:"pre-wrap"}}>{rec.parentComment}</p>
            </div>
          )}
          <textarea rows={3} placeholder="お父さん・お母さんからのコメントを入力..." value={parentComment} onChange={e=>setParentComment(e.target.value)} style={{...taS,marginBottom:8,borderColor:COLOR.team+"66"}} />
          <button onClick={saveParentComment} disabled={saving} style={btnS({background:COLOR.team,color:"#fff",border:"none",width:"100%",opacity:saving?0.7:1})}>
            {saving?"保存中...":"コメントを保存"}
          </button>
        </div>
      </div>
    );
  }

  return(
    <div style={{padding:"1rem",maxWidth:480,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={prevM} style={btnS({padding:"6px 12px"})}>‹</button>
        <span style={{fontSize:17,fontWeight:500,color:"#333"}}>{calYear}年{calMonth+1}月</span>
        <button onClick={nextM} style={btnS({padding:"6px 12px"})}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {wdays.map((w,i)=><div key={w} style={{textAlign:"center",fontSize:12,color:i===0?"#E24B4A":i===6?"#378ADD":"#888",padding:"4px 0"}}>{w}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:20}}>
        {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
        {Array.from({length:daysInMonth}).map((_,i)=>{
          const day=i+1,ds=fmtDate(calYear,calMonth,day),dot=dotColor(ds);
          const isToday=ds===fmtDate(today.getFullYear(),today.getMonth(),today.getDate());
          const dow=(firstDay+i)%7;
          return(
            <button key={day} onClick={()=>openDay(day)} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"6px 0",border:"0.5px solid",borderColor:isToday?COLOR.solo:"#ddd",borderRadius:"8px",background:isToday?"#E1F5EE":"#fff",cursor:"pointer",minHeight:44,gap:4}}>
              <span style={{fontSize:14,fontWeight:isToday?500:400,color:dow===0?"#E24B4A":dow===6?"#378ADD":"#333"}}>{day}</span>
              {dot&&<span style={{width:7,height:7,borderRadius:"50%",background:dot}}/>}
            </button>
          );
        })}
      </div>
      <div style={{display:"flex",gap:12,marginBottom:16,justifyContent:"center",flexWrap:"wrap"}}>
        {[{c:COLOR.solo,l:"自主練"},{c:COLOR.team,l:"チーム練習"},{c:COLOR.game,l:"試合"},{c:COLOR.both,l:"複数"}].map(({c,l})=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:c}}/>
            <span style={{fontSize:12,color:"#888"}}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{borderTop:"0.5px solid #ddd",paddingTop:16}}>
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {[{id:"month",label:`${calMonth+1}月の集計`},{id:"year",label:`${calYear}年の集計`}].map(({id,label})=>(
            <button key={id} onClick={()=>setStatsTab(id)} style={{...btnS(),flex:1,fontWeight:statsTab===id?500:400,borderColor:statsTab===id?"#888":"#ccc",background:statsTab===id?"#f5f5f3":"#fff"}}>{label}</button>
          ))}
        </div>
        {statsTab==="month"
          ?<StatBlock title={`${calYear}年${calMonth+1}月`} color={COLOR.solo} soloDay={monthStats.soloDay} soloMins={monthStats.soloMins} gameCount={monthStats.gameCount} gameStats={monthStats.gameStats} />
          :<StatBlock title={`${calYear}年`} color={COLOR.team} soloDay={yearStats.soloDay} soloMins={yearStats.soloMins} gameCount={yearStats.gameCount} gameStats={yearStats.gameStats} />
        }
      </div>
    </div>
  );
}
