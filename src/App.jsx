import { useState, useEffect } from “react”;
import { supabase } from ‘./supabase.js’;

const COLOR = { solo: “#1D9E75”, team: “#378ADD”, game: “#D85A30”, both: “#7F77DD” };

function newGame(){return {opponent:””,myScore:””,oppScore:””,playTime:””,shot2a:””,shot2m:””,shot3a:””,shot3m:””,fta:””,ftm:””,ast:””,reb:””,stl:””,tov:””,foul:””,good:””,reflect:””};};
function newDaySummary(){return {memo:””,good:””,reflect:””,next:””,parentComment:””};};

async function loadFromSupabase() {
const { data, error } = await supabase.from(‘records’).select(’*’);
if (error) { console.error(error); return {}; }
const result = {};
data.forEach(row => { result[row.date] = row.data; });
return result;
}

async function saveToSupabase(date, dayData) {
const { error } = await supabase
.from(‘records’)
.upsert({ date, data: dayData, updated_at: new Date().toISOString() });
if (error) console.error(error);
}

const btnS=(ex={})=>({padding:“7px 14px”,fontSize:13,borderRadius:“8px”,border:“0.5px solid #ccc”,background:”#fff”,color:”#333”,cursor:“pointer”,…ex});
const lbl={display:“block”,fontSize:13,color:”#666”,marginBottom:4,fontWeight:500};
const cardS={background:”#f5f5f3”,borderRadius:“12px”,padding:“12px 14px”,marginBottom:12};
const numInp={textAlign:“center”,padding:“6px 4px”,borderRadius:“8px”,border:“0.5px solid #ccc”,background:”#fff”,color:”#333”,width:“100%”,boxSizing:“border-box”};
const timeInp={padding:“6px 8px”,borderRadius:“8px”,border:“0.5px solid #ccc”,background:”#fff”,color:”#333”,fontSize:15,width:“100%”,boxSizing:“border-box”};
const taS={width:“100%”,boxSizing:“border-box”,resize:“vertical”,padding:“7px 10px”,borderRadius:“8px”,border:“0.5px solid #ccc”,fontSize:14,color:”#333”,background:”#fff”};
const inpS={width:“100%”,boxSizing:“border-box”,padding:“7px 10px”,borderRadius:“8px”,border:“0.5px solid #ccc”,fontSize:14,color:”#333”,background:”#fff”};

function calcSoloMins(solo){
if(!solo||!solo.startTime||!solo.endTime) return 0;
const[sh,sm]=solo.startTime.split(”:”).map(Number);
const[eh,em]=solo.endTime.split(”:”).map(Number);
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
const[y,m]=ds.split(”-”).map(Number);
if(y!==year||m!==month+1) return;
if(rec.solo){soloDay++;soloMins+=calcSoloMins(rec.solo);}
if(rec.games&&rec.games.length>0){gameCount+=rec.games.length;gamesAll.push(…rec.games);}
});
return{soloDay,soloMins,gameStats:gamesAll.length>0?sumGames(gamesAll):null,gameCount};
}

function computeYearStats(records,year){
let soloDay=0,soloMins=0;
const gamesAll=[];
Object.entries(records).forEach(([ds,rec])=>{
const[y]=ds.split(”-”).map(Number);
if(y!==year) return;
if(rec.solo){soloDay++;soloMins+=calcSoloMins(rec.solo);}
if(rec.games&&rec.games.length>0) gamesAll.push(…rec.games);
});
return{soloDay,soloMins,gameStats:gamesAll.length>0?sumGames(gamesAll):null,gameCount:gamesAll.length};
}

function fmtDate(y,m,d){return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}

function StatBlock({title,color,soloDay,soloMins,gameCount,gameStats}){
const hrs=Math.floor(soloMins/60),mins=soloMins%60;
const soloLabel=soloMins>0?(hrs>0?`${hrs}時間${mins>0?mins+"分":""}`:`${soloMins}分`):“0分”;
return(
<div style={{background:”#f5f5f3”,borderRadius:“12px”,padding:“14px”,marginBottom:12}}>
<p style={{fontSize:13,fontWeight:500,color,margin:“0 0 12px”}}>{title}</p>
<p style={{fontSize:11,color:”#888”,margin:“0 0 6px”,fontWeight:500}}>自主練</p>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:6,marginBottom:12}}>
{[[“練習日数”,soloDay+“日”],[“合計時間”,soloLabel]].map(([l,v])=>(
<div key={l} style={{background:”#fff”,borderRadius:“8px”,padding:“8px”,textAlign:“center”}}>
<p style={{fontSize:11,color:”#888”,margin:“0 0 2px”}}>{l}</p>
<p style={{fontSize:16,fontWeight:500,color:”#333”,margin:0}}>{v}</p>
</div>
))}
</div>
{gameStats?(
<div>
<p style={{fontSize:11,color:”#888”,margin:“0 0 6px”,fontWeight:500}}>試合</p>
<div style={{display:“grid”,gridTemplateColumns:“repeat(3,1fr)”,gap:6,marginBottom:6}}>
{[[“試合数”,gameCount+“試合”],[“出場時間”,gameStats.mins+“分”],[“得点”,gameStats.pts+“点”]].map(([l,v])=>(
<div key={l} style={{background:”#fff”,borderRadius:“8px”,padding:“8px”,textAlign:“center”}}>
<p style={{fontSize:11,color:”#888”,margin:“0 0 2px”}}>{l}</p>
<p style={{fontSize:15,fontWeight:500,color:”#333”,margin:0}}>{v}</p>
</div>
))}
</div>
<div style={{background:”#fff”,borderRadius:“8px”,padding:“10px”,marginBottom:6}}>
<div style={{display:“grid”,gridTemplateColumns:“36px 1fr 1fr”,gap:“5px 8px”,alignItems:“center”}}>
<span/><span style={{fontSize:11,color:”#888”,textAlign:“center”}}>試投/決定</span><span style={{fontSize:11,color:”#888”,textAlign:“center”}}>成功率</span>
{[
[“2P”,gameStats.shot2m+”/”+gameStats.shot2a,gameStats.p2Pct],
[“3P”,gameStats.shot3m+”/”+gameStats.shot3a,gameStats.p3Pct],
[“FT”,gameStats.ftm+”/”+gameStats.fta,gameStats.ftPct],
[“FG”,(gameStats.shot2m+gameStats.shot3m)+”/”+(gameStats.shot2a+gameStats.shot3a),gameStats.fgPct]
].map(([l,v,pct])=>[
<span key={l+“l”} style={{fontSize:12,fontWeight:500,color:”#333”}}>{l}</span>,
<span key={l+“v”} style={{fontSize:13,textAlign:“center”,color:”#333”}}>{v}</span>,
<span key={l+“p”} style={{fontSize:13,textAlign:“center”,color:”#333”}}>{pct!=null?pct+”%”:”-”}</span>
])}
</div>
</div>
<div style={{display:“grid”,gridTemplateColumns:“repeat(5,1fr)”,gap:6}}>
{[[“AST”,gameStats.ast],[“REB”,gameStats.reb],[“STL”,gameStats.stl],[“TO”,gameStats.tov],[“Foul”,gameStats.foul]].map(([l,v])=>(
<div key={l} style={{background:”#fff”,borderRadius:“8px”,padding:“8px”,textAlign:“center”}}>
<p style={{fontSize:11,color:”#888”,margin:“0 0 2px”}}>{l}</p>
<p style={{fontSize:14,fontWeight:500,color:”#333”,margin:0}}>{v}</p>
</div>
))}
</div>
</div>
):(
<div style={{background:”#fff”,borderRadius:“8px”,padding:“10px”,textAlign:“center”}}>
<p style={{fontSize:13,color:”#aaa”,margin:0}}>試合記録なし</p>
</div>
)}
</div>
);
}

function StatBox({label,value,onChange}){
return(
<div style={{display:“flex”,flexDirection:“column”,alignItems:“center”,gap:4}}>
<span style={{fontSize:11,color:”#666”,textAlign:“center”,lineHeight:1.3}}>{label}</span>
<input type=“number” min=“0” value={value||””} onChange={e=>onChange(e.target.value)} style={{…numInp,fontSize:15}} />
</div>
);
}

function GameForm({game,onChange,onDelete,index,total}){
const p2m=parseInt(game.shot2m)||0,p3m=parseInt(game.shot3m)||0,ftm=parseInt(game.ftm)||0;
const calcPts=p2m*2+p3m*3+ftm;
const sf=k=>v=>onChange({…game,[k]:v});
const myS=parseInt(game.myScore),oppS=parseInt(game.oppScore);
const res=(game.myScore!==””&&game.oppScore!==””&&!isNaN(myS)&&!isNaN(oppS))?(myS>oppS?“勝ち”:myS<oppS?“負け”:“引き分け”):null;
return(
<div style={{border:`1px solid ${COLOR.game}44`,borderRadius:“12px”,padding:“14px”,marginBottom:14,background:”#fff”}}>
<div style={{display:“flex”,alignItems:“center”,justifyContent:“space-between”,marginBottom:12}}>
<span style={{fontSize:14,fontWeight:500,color:COLOR.game}}>第{index+1}試合</span>
{total>1&&<button onClick={onDelete} style={{…btnS(),fontSize:12,padding:“4px 10px”,color:”#888”}}>削除</button>}
</div>
<label style={lbl}>対戦相手</label>
<input placeholder=“チーム名” value={game.opponent||””} onChange={e=>sf(“opponent”)(e.target.value)} style={{…inpS,marginBottom:12}} />
<label style={lbl}>試合結果（得点入力）</label>
<div style={{display:“flex”,alignItems:“center”,gap:10,marginBottom:12}}>
<div style={{flex:1}}><p style={{fontSize:11,color:”#888”,margin:“0 0 4px”,textAlign:“center”}}>自チーム</p><input type=“number” min=“0” placeholder=“0” value={game.myScore||””} onChange={e=>sf(“myScore”)(e.target.value)} style={{…numInp,fontSize:20,fontWeight:500,padding:“8px”}} /></div>
<span style={{fontSize:18,color:”#bbb”,marginTop:16}}>–</span>
<div style={{flex:1}}><p style={{fontSize:11,color:”#888”,margin:“0 0 4px”,textAlign:“center”}}>相手チーム</p><input type=“number” min=“0” placeholder=“0” value={game.oppScore||””} onChange={e=>sf(“oppScore”)(e.target.value)} style={{…numInp,fontSize:20,fontWeight:500,padding:“8px”}} /></div>
{res&&<span style={{marginTop:16,fontSize:12,padding:“4px 10px”,borderRadius:12,background:res===“勝ち”?”#EAF3DE”:res===“負け”?”#FCEBEB”:”#F1EFE8”,color:res===“勝ち”?”#3B6D11”:res===“負け”?”#A32D2D”:”#5F5E5A”,whiteSpace:“nowrap”}}>{res}</span>}
</div>
<label style={lbl}>出場時間（分）</label>
<input type=“number” min=“0” placeholder=“例：20” value={game.playTime||””} onChange={e=>sf(“playTime”)(e.target.value)} style={{…inpS,marginBottom:12}} />
<p style={{...lbl,marginBottom:8}}>シュート統計</p>
<div style={{background:”#f5f5f3”,borderRadius:“8px”,padding:“10px”,marginBottom:12}}>
<div style={{display:“grid”,gridTemplateColumns:“40px 1fr 1fr”,gap:“6px 10px”,alignItems:“center”,marginBottom:8}}>
<span/><span style={{fontSize:11,color:”#888”,textAlign:“center”}}>試投数</span><span style={{fontSize:11,color:”#888”,textAlign:“center”}}>決定数</span>
{[[“2P”,“shot2a”,“shot2m”],[“3P”,“shot3a”,“shot3m”],[“FT”,“fta”,“ftm”]].map(([label,ka,km])=>[
<span key={label} style={{fontSize:13,fontWeight:500,color:”#333”}}>{label}</span>,
<input key={ka} type=“number
