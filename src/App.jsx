import { useState, useEffect } from "react";
import { supabase } from './supabase.js';

const COLOR = { solo: "#1D9E75", team: "#378ADD", game: "#D85A30", train: "#7F77DD", both: "#888" };
const TEAM_OPTIONS = ["キングス","EMBC","KINGDOME","T's","その他"];

function newGame(){return {opponent:"",myScore:"",oppScore:"",playTime:"",shot2a:"",shot2m:"",shot3a:"",shot3m:"",fta:"",ftm:"",ast:"",reb:"",stl:"",tov:"",foul:"",good:"",reflect:""};};
function newDaySummary(){return {memo:"",good:"",reflect:"",next:""};};
function newMonthGoal(){return {basketball:"",study:"",life:"",training:""};};
function newSolo(){return {drills:[],startTime:"",endTime:"",memo:""};};
function newTeam(){return {teamName:"",startTime:"",endTime:"",content:"",taught:"",good:"",improve:"",next:""};};
function newMonthReview(){return {
  goal:{basketball:{good:"",improve:"",next:""},study:{good:"",improve:"",next:""},life:{good:"",improve:"",next:""},training:{good:"",improve:"",next:""}},
  practice:{solo:{good:"",improve:"",next:""},team:{good:"",improve:"",next:""},game:{good:"",improve:"",next:""}}
};};

async function loadFromSupabase(){
  try{
    const{data,error}=await supabase.from('records').select('*');
    if(error){console.error(error);return{records:{},monthGoals:{},monthReviews:{},soloMenus:[],trainMenus:[]};}
    const result={records:{},monthGoals:{},monthReviews:{},soloMenus:[],trainMenus:[]};
    data.forEach(row=>{
      if(row.date==='__meta__') Object.assign(result,row.data);
      else{
        const rec={...row.data};
        if(rec.solo&&!rec.solos){rec.solos=[rec.solo];delete rec.solo;}
        if(rec.team&&!rec.teams){rec.teams=[rec.team];delete rec.team;}
        result.records[row.date]=rec;
      }
    });
    return result;
  }catch{return{records:{},monthGoals:{},monthReviews:{},soloMenus:[],trainMenus:[]};}
}

async function saveDayToSupabase(date,dayData){
  const{error}=await supabase.from('records').upsert({date,data:dayData,updated_at:new Date().toISOString()});
  if(error) console.error(error);
}

async function saveMetaToSupabase(meta){
  const{error}=await supabase.from('records').upsert({date:'__meta__',data:meta,updated_at:new Date().toISOString()});
  if(error) console.error(error);
}

const btnS=(ex={})=>({padding:"7px 14px",fontSize:13,borderRadius:"8px",border:"0.5px solid #ccc",background:"#fff",color:"#333",cursor:"pointer",...ex});
const lbl={display:"block",fontSize:13,color:"#666",marginBottom:4,fontWeight:500};
const cardS={background:"#f5f5f3",borderRadius:"12px",padding:"12px 14px",marginBottom:12};
const numInp={textAlign:"center",padding:"6px 4px",borderRadius:"8px",border:"0.5px solid #ccc",background:"#fff",color:"#333",width:"100%",boxSizing:"border-box"};
const timeInp={padding:"6px 8px",borderRadius:"8px",border:"0.5px solid #ccc",background:"#fff",color:"#333",fontSize:15,width:"100%",boxSizing:"border-box"};
const taS={width:"100%",boxSizing:"border-box",resize:"vertical",padding:"7px 10px",borderRadius:"8px",border:"0.5px solid #ccc",fontSize:14,color:"#333",background:"#fff"};
const inpS={width:"100%",boxSizing:"border-box",padding:"7px 10px",borderRadius:"8px",border:"0.5px solid #ccc",fontSize:14,color:"#333",background:"#fff"};

function fmtDate(y,m,d){return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
function calcMins(start,end){if(!start||!end)return 0;const[sh,sm]=start.split(":").map(Number);const[eh,em]=end.split(":").map(Number);const d=(eh*60+em)-(sh*60+sm);return d>0?d:0;}
function minsToLabel(m){if(!m)return "0分";const h=Math.floor(m/60),mn=m%60;return h>0?`${h}時間${mn>0?mn+"分":""}`:`${mn}分`;}
function round1(v){return Math.round(v*10)/10;}
function getFiscalYear(year,month){return month>=3?year:year-1;}

function sumGames(games){
  const s={shot2a:0,shot2m:0,shot3a:0,shot3m:0,fta:0,ftm:0,ast:0,reb:0,stl:0,tov:0,foul:0,mins:0,count:0};
  games.forEach(g=>{
    s.shot2a+=parseInt(g.shot2a)||0;s.shot2m+=parseInt(g.shot2m)||0;
    s.shot3a+=parseInt(g.shot3a)||0;s.shot3m+=parseInt(g.shot3m)||0;
    s.fta+=parseInt(g.fta)||0;s.ftm+=parseInt(g.ftm)||0;
    s.ast+=parseInt(g.ast)||0;s.reb+=parseInt(g.reb)||0;
    s.stl+=parseInt(g.stl)||0;s.tov+=parseInt(g.tov)||0;
    s.foul+=parseInt(g.foul)||0;s.mins+=parseInt(g.playTime)||0;s.count++;
  });
  s.pts=s.shot2m*2+s.shot3m*3+s.ftm;
  const tA=s.shot2a+s.shot3a,tM=s.shot2m+s.shot3m;
  s.fgPct=tA>0?Math.round(tM/tA*100):null;
  s.p2Pct=s.shot2a>0?Math.round(s.shot2m/s.shot2a*100):null;
  s.p3Pct=s.shot3a>0?Math.round(s.shot3m/s.shot3a*100):null;
  s.ftPct=s.fta>0?Math.round(s.ftm/s.fta*100):null;
  return s;
}

function computeMonthStats(records,year,month){
  let soloDay=0,soloMins=0,teamDay=0,teamMins=0,trainDay=0,gameCount=0;
  const gamesAll=[];
  const teamBreakdown={};
  Object.entries(records).forEach(([ds,rec])=>{
    const[y,m]=ds.split("-").map(Number);
    if(y!==year||m!==month+1) return;
    const solos=rec.solos||[];
    if(solos.length>0){soloDay++;solos.forEach(s=>{soloMins+=calcMins(s.startTime,s.endTime);});}
    const teams=rec.teams||[];
    if(teams.length>0){
      teamDay++;
      teams.forEach(t=>{
        const mins=calcMins(t.startTime,t.endTime);
        teamMins+=mins;
        const name=t.teamName||"未設定";
        if(!teamBreakdown[name]) teamBreakdown[name]={count:0,mins:0};
        teamBreakdown[name].count++;teamBreakdown[name].mins+=mins;
      });
    }
    if(rec.training?.menus?.length>0) trainDay++;
    if(rec.games?.length>0){gameCount+=rec.games.length;gamesAll.push(...rec.games);}
  });
  return{soloDay,soloMins,teamDay,teamMins,teamBreakdown,trainDay,gameCount,gameStats:gamesAll.length>0?sumGames(gamesAll):null};
}

function computeMultiMonthStats(records,monthList){
  const combined={soloDay:0,soloMins:0,teamDay:0,teamMins:0,trainDay:0,gameCount:0,teamBreakdown:{}};
  const gamesAll=[];
  monthList.forEach(({year,month})=>{
    const s=computeMonthStats(records,year,month);
    combined.soloDay+=s.soloDay;combined.soloMins+=s.soloMins;
    combined.teamDay+=s.teamDay;combined.teamMins+=s.teamMins;
    combined.trainDay+=s.trainDay;combined.gameCount+=s.gameCount;
    Object.entries(s.teamBreakdown).forEach(([name,v])=>{
      if(!combined.teamBreakdown[name]) combined.teamBreakdown[name]={count:0,mins:0};
      combined.teamBreakdown[name].count+=v.count;combined.teamBreakdown[name].mins+=v.mins;
    });
    Object.entries(records).forEach(([ds,rec])=>{
      const[y,m]=ds.split("-").map(Number);
      if(y===year&&m===month+1&&rec.games?.length>0) gamesAll.push(...rec.games);
    });
  });
  combined.gameStats=gamesAll.length>0?sumGames(gamesAll):null;
  return combined;
}

function avgStats(stats,months){
  if(!months||months===0) return null;
  const avg={
    soloDay:round1(stats.soloDay/months),soloMins:round1(stats.soloMins/months),
    teamDay:round1(stats.teamDay/months),teamMins:round1(stats.teamMins/months),
    trainDay:round1(stats.trainDay/months),gameCount:round1(stats.gameCount/months),
    teamBreakdown:{},isAvg:true,monthCount:months,
  };
  Object.entries(stats.teamBreakdown||{}).forEach(([name,v])=>{
    avg.teamBreakdown[name]={count:round1(v.count/months),mins:round1(v.mins/months)};
  });
  if(stats.gameStats){
    const g=stats.gameStats;
    avg.gameStats={
      pts:round1(g.pts/months),mins:round1(g.mins/months),count:round1(g.count/months),
      shot2a:round1(g.shot2a/months),shot2m:round1(g.shot2m/months),
      shot3a:round1(g.shot3a/months),shot3m:round1(g.shot3m/months),
      fta:round1(g.fta/months),ftm:round1(g.ftm/months),
      ast:round1(g.ast/months),reb:round1(g.reb/months),
      stl:round1(g.stl/months),tov:round1(g.tov/months),foul:round1(g.foul/months),
      p2Pct:g.p2Pct,p3Pct:g.p3Pct,ftPct:g.ftPct,fgPct:g.fgPct,
    };
  }
  return avg;
}

function getCompletedMonths(records,baseYear,baseMonth,count){
  const result=[];
  let y=baseYear,m=baseMonth;
  for(let i=0;i<count;i++){
    m--;if(m<0){m=11;y--;}
    result.push({year:y,month:m});
  }
  return result;
}

function getFiscalMonths(records,fiscalYear,today){
  const months=[];
  for(let m=3;m<=14;m++){
    const realMonth=m%12;
    const realYear=m<12?fiscalYear:fiscalYear+1;
    const isCompleted=realYear<today.getFullYear()||(realYear===today.getFullYear()&&realMonth<today.getMonth());
    if(isCompleted) months.push({year:realYear,month:realMonth});
  }
  return months;
}

function StatBox({label,value,onChange}){
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <span style={{fontSize:11,color:"#666",textAlign:"center",lineHeight:1.3}}>{label}</span>
      <input type="number" min="0" value={value||""} onChange={e=>onChange(e.target.value)} style={{...numInp,fontSize:15}}/>
    </div>
  );
}

function StatBlock({title,color,stats,isAvg}){
  if(!stats) return(
    <div style={{background:"#f5f5f3",borderRadius:"12px",padding:"20px",textAlign:"center",marginBottom:12}}>
      <p style={{fontSize:13,color:"#aaa",margin:0}}>データがまだありません</p>
    </div>
  );
  const{soloDay,soloMins,teamDay,teamMins,teamBreakdown,trainDay,gameCount,gameStats}=stats;
  const teamEntries=Object.entries(teamBreakdown||{}).sort((a,b)=>b[1].count-a[1].count);
  const suffix=isAvg?"／月":"";
  return(
    <div style={{background:"#f5f5f3",borderRadius:"12px",padding:"14px",marginBottom:12}}>
      <p style={{fontSize:13,fontWeight:500,color,margin:"0 0 12px"}}>{title}</p>
      <p style={{fontSize:11,color:"#888",margin:"0 0 6px",fontWeight:500}}>自主練</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
        {[["練習日数",soloDay+"日"+suffix],["合計時間",minsToLabel(Math.round(soloMins))]].map(([l,v])=>(
          <div key={l} style={{background:"#fff",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
            <p style={{fontSize:11,color:"#888",margin:"0 0 2px"}}>{l}</p>
            <p style={{fontSize:15,fontWeight:500,color:"#333",margin:0}}>{v}</p>
          </div>
        ))}
      </div>
      <div style={{borderTop:"0.5px solid #ddd",marginBottom:12}}/>
      <p style={{fontSize:11,color:"#888",margin:"0 0 6px",fontWeight:500}}>トレーニング</p>
      <div style={{background:"#fff",borderRadius:"8px",padding:"8px",textAlign:"center",marginBottom:12}}>
        <p style={{fontSize:11,color:"#888",margin:"0 0 2px"}}>練習日数</p>
        <p style={{fontSize:15,fontWeight:500,color:"#333",margin:0}}>{trainDay}日{suffix}</p>
      </div>
      <div style={{borderTop:"0.5px solid #ddd",marginBottom:12}}/>
      <p style={{fontSize:11,color:"#888",margin:"0 0 6px",fontWeight:500}}>チーム練習</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:teamEntries.length>0?8:12}}>
        {[["練習日数",teamDay+"日"+suffix],["合計時間",minsToLabel(Math.round(teamMins))]].map(([l,v])=>(
          <div key={l} style={{background:"#fff",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
            <p style={{fontSize:11,color:"#888",margin:"0 0 2px"}}>{l}</p>
            <p style={{fontSize:15,fontWeight:500,color:"#333",margin:0}}>{v}</p>
          </div>
        ))}
      </div>
      {teamEntries.length>0&&(
        <div style={{marginBottom:12}}>
          {teamEntries.map(([name,{count,mins}])=>(
            <div key={name} style={{display:"flex",alignItems:"center",gap:8,background:"#fff",borderRadius:"8px",padding:"7px 10px",marginBottom:4}}>
              <span style={{fontSize:12,fontWeight:500,color:COLOR.team,minWidth:70}}>{name}</span>
              <span style={{fontSize:12,color:"#888"}}>{count}回{suffix}</span>
              <span style={{fontSize:12,color:"#888",marginLeft:"auto"}}>{minsToLabel(Math.round(typeof mins==="number"?mins:0))}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{borderTop:"0.5px solid #ddd",marginBottom:12}}/>
      {gameStats&&gameStats.count>0?(
        <div>
          <p style={{fontSize:11,color:"#888",margin:"0 0 6px",fontWeight:500}}>試合</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:6}}>
            {[["試合数",Math.round(gameStats.count)+"試合"+(isAvg?"／月":"")],["出場時間",Math.round(gameStats.mins)+"分"],["得点",Math.round(gameStats.pts)+"点"]].map(([l,v])=>(
              <div key={l} style={{background:"#fff",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
                <p style={{fontSize:11,color:"#888",margin:"0 0 2px"}}>{l}</p>
                <p style={{fontSize:14,fontWeight:500,color:"#333",margin:0}}>{v}</p>
              </div>
            ))}
          </div>
          {!isAvg&&gameStats.count>0&&(
            <div style={{background:"#fff",borderRadius:"8px",padding:"8px 10px",marginBottom:6}}>
              <p style={{fontSize:11,color:"#888",margin:"0 0 6px",fontWeight:500}}>1試合あたり平均</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:4}}>
                {[["出場時間",round1(gameStats.mins/gameStats.count)+"分"],["得点",round1(gameStats.pts/gameStats.count)+"点"]].map(([l,v])=>(
                  <div key={l} style={{textAlign:"center"}}>
                    <p style={{fontSize:10,color:"#888",margin:"0 0 2px"}}>{l}</p>
                    <p style={{fontSize:13,fontWeight:500,color:"#333",margin:0}}>{v}</p>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
                {[["AST",round1(gameStats.ast/gameStats.count)],["REB",round1(gameStats.reb/gameStats.count)],["STL",round1(gameStats.stl/gameStats.count)],["TO",round1(gameStats.tov/gameStats.count)],["Foul",round1(gameStats.foul/gameStats.count)]].map(([l,v])=>(
                  <div key={l} style={{textAlign:"center"}}>
                    <p style={{fontSize:10,color:"#888",margin:"0 0 2px"}}>{l}</p>
                    <p style={{fontSize:13,fontWeight:500,color:"#333",margin:0}}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{background:"#fff",borderRadius:"8px",padding:"10px",marginBottom:6}}>
            <div style={{display:"grid",gridTemplateColumns:"36px 1fr 1fr 1fr",gap:"5px 6px",alignItems:"center"}}>
              <span/><span style={{fontSize:11,color:"#888",textAlign:"center"}}>決定/試投</span><span style={{fontSize:11,color:"#888",textAlign:"center"}}>成功率</span><span style={{fontSize:11,color:"#888",textAlign:"center"}}>{isAvg?"":"1試合平均"}</span>
              {[
                ["2P",Math.round(gameStats.shot2m)+"/"+Math.round(gameStats.shot2a),gameStats.p2Pct,gameStats.count>0?round1(gameStats.shot2m/gameStats.count)+"/"+round1(gameStats.shot2a/gameStats.count):"-"],
                ["3P",Math.round(gameStats.shot3m)+"/"+Math.round(gameStats.shot3a),gameStats.p3Pct,gameStats.count>0?round1(gameStats.shot3m/gameStats.count)+"/"+round1(gameStats.shot3a/gameStats.count):"-"],
                ["FT",Math.round(gameStats.ftm)+"/"+Math.round(gameStats.fta),gameStats.ftPct,gameStats.count>0?round1(gameStats.ftm/gameStats.count)+"/"+round1(gameStats.fta/gameStats.count):"-"],
                ["FG",Math.round(gameStats.shot2m+gameStats.shot3m)+"/"+Math.round(gameStats.shot2a+gameStats.shot3a),gameStats.fgPct,"-"]
              ].map(([l,v,pct,avg])=>[
                <span key={l+"l"} style={{fontSize:12,fontWeight:500,color:"#333"}}>{l}</span>,
                <span key={l+"v"} style={{fontSize:12,textAlign:"center",color:"#333"}}>{v}</span>,
                <span key={l+"p"} style={{fontSize:12,textAlign:"center",color:"#333"}}>{pct!=null?pct+"%":"-"}</span>,
                <span key={l+"a"} style={{fontSize:12,textAlign:"center",color:"#888"}}>{isAvg?"":avg}</span>
              ])}
            </div>
          </div>
          <p style={{fontSize:11,color:"#888",margin:"0 0 4px",fontWeight:500}}>合計スタッツ</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
            {[["AST",Math.round(gameStats.ast)],["REB",Math.round(gameStats.reb)],["STL",Math.round(gameStats.stl)],["TO",Math.round(gameStats.tov)],["Foul",Math.round(gameStats.foul)]].map(([l,v])=>(
              <div key={l} style={{background:"#fff",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
                <p style={{fontSize:11,color:"#888",margin:"0 0 2px"}}>{l}</p>
                <p style={{fontSize:13,fontWeight:500,color:"#333",margin:0}}>{v}</p>
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

function ReviewSection({review,onSave,saving,goalKey}){
  const[form,setForm]=useState(()=>review||newMonthReview());
  const[editing,setEditing]=useState(false);
  const[open,setOpen]=useState(false);
  useEffect(()=>{
    setForm(review||newMonthReview());
    setEditing(false);
    setOpen(false);
  },[goalKey,review]);
  const sf=(section,key,field)=>v=>setForm(f=>({...f,[section]:{...f[section],[key]:{...f[section][key],[field]:v}}}));
  const goalItems=[{k:"basketball",l:"🏀 バスケ"},{k:"study",l:"📚 勉強"},{k:"life",l:"🌱 生活"},{k:"training",l:"💪 トレーニング"}];
  const practiceItems=[{k:"solo",l:"🏀 自主練"},{k:"team",l:"👥 チーム練習"},{k:"game",l:"🏆 試合"}];
  const reviewFields=[{f:"good",l:"できたこと"},{f:"improve",l:"改善すること"},{f:"next",l:"来月に向けて"}];

  if(!review&&!editing){
    return(
      <div style={{...cardS,marginTop:4}}>
        <button onClick={()=>setEditing(true)} style={btnS({width:"100%",borderColor:"#ccc",color:"#666"})}>
          + 月間振り返りを入力する
        </button>
      </div>
    );
  }

  if(!editing){
    return(
      <div style={{...cardS,marginTop:4}}>
        <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:14,fontWeight:500,color:"#333"}}>月間振り返り</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={e=>{e.stopPropagation();setEditing(true);setOpen(true);}} style={btnS({fontSize:12,padding:"4px 10px"})}>編集</button>
            <span style={{fontSize:16,color:"#888",lineHeight:1}}>{open?"▲":"▼"}</span>
          </div>
        </button>
        {open&&(
          <div style={{marginTop:12}}>
            {[{label:"目標振り返り",items:goalItems,section:"goal"},{label:"練習振り返り",items:practiceItems,section:"practice"}].map(({label,items,section})=>(
              <div key={section} style={{marginBottom:12}}>
                <p style={{fontSize:12,fontWeight:500,color:"#888",margin:"0 0 8px"}}>{label}</p>
                {items.map(({k,l})=>{
                  const d=form[section]?.[k]||{};
                  if(!d.good&&!d.improve&&!d.next) return null;
                  return(
                    <div key={k} style={{marginBottom:8}}>
                      <p style={{fontSize:12,fontWeight:500,color:"#555",margin:"0 0 4px"}}>{l}</p>
                      {reviewFields.map(({f,l:fl})=>d[f]?<div key={f} style={{marginBottom:3}}><span style={{fontSize:11,color:"#888"}}>{fl}　</span><span style={{fontSize:13,color:"#333",whiteSpace:"pre-wrap"}}>{d[f]}</span></div>:null)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return(
    <div style={{...cardS,marginTop:4}}>
      <p style={{fontSize:14,fontWeight:500,color:"#333",margin:"0 0 14px"}}>月間振り返り</p>
      {[{label:"目標の振り返り",items:goalItems,section:"goal"},{label:"練習の振り返り",items:practiceItems,section:"practice"}].map(({label,items,section})=>(
        <div key={section} style={{marginBottom:16}}>
          <p style={{fontSize:12,fontWeight:500,color:"#888",margin:"0 0 10px",borderBottom:"0.5px solid #ddd",paddingBottom:6}}>{label}</p>
          {items.map(({k,l})=>(
            <div key={k} style={{marginBottom:12,background:"#fff",borderRadius:"8px",padding:"10px"}}>
              <p style={{fontSize:13,fontWeight:500,color:"#555",margin:"0 0 8px"}}>{l}</p>
              {reviewFields.map(({f,l:fl})=>(
                <div key={f} style={{marginBottom:6}}>
                  <label style={{...lbl,fontSize:12,marginBottom:2}}>{fl}</label>
                  <textarea rows={2} placeholder={fl+"を入力"} value={form[section]?.[k]?.[f]||""} onChange={e=>sf(section,k,f)(e.target.value)} style={{...taS,fontSize:13}}/>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{onSave(form);setEditing(false);}} disabled={saving} style={btnS({background:"#333",color:"#fff",border:"none",flex:1,opacity:saving?0.7:1})}>{saving?"保存中...":"保存"}</button>
        <button onClick={()=>setEditing(false)} style={btnS()}>キャンセル</button>
      </div>
    </div>
  );
}

function SoloForm({solo,index,total,onChange,onDelete,soloMenus}){
  const[drillInput,setDrillInput]=useState("");
  const mins=calcMins(solo.startTime,solo.endTime)||null;
  function addDrill(){const v=drillInput.trim();if(!v)return;onChange({...solo,drills:[...(solo.drills||[]),v]});setDrillInput("");}
  function removeDrill(i){onChange({...solo,drills:solo.drills.filter((_,j)=>j!==i)});}
  return(
    <div style={{border:`1px solid ${COLOR.solo}44`,borderRadius:"12px",padding:"14px",marginBottom:14,background:"#fff"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontSize:14,fontWeight:500,color:COLOR.solo}}>第{index+1}回</span>
        {total>1&&<button onClick={onDelete} style={{...btnS(),fontSize:12,padding:"4px 10px",color:"#888"}}>削除</button>}
      </div>
      <label style={lbl}>練習時間</label>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,alignItems:"center",marginBottom:4}}>
        <input type="time" value={solo.startTime||""} onChange={e=>onChange({...solo,startTime:e.target.value})} style={timeInp}/>
        <span style={{fontSize:13,color:"#888",textAlign:"center"}}>〜</span>
        <input type="time" value={solo.endTime||""} onChange={e=>onChange({...solo,endTime:e.target.value})} style={timeInp}/>
      </div>
      {mins?<p style={{fontSize:12,color:"#888",margin:"0 0 12px",textAlign:"right"}}>{mins}分間</p>:<div style={{marginBottom:12}}/>}
      <label style={lbl}>練習メニュー</label>
      <div style={{display:"flex",gap:6,marginBottom:8}}>
        <input placeholder="例：レッグスルー50本" value={drillInput} onChange={e=>setDrillInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addDrill()} style={{flex:1,padding:"7px 10px",borderRadius:"8px",border:"0.5px solid #ccc",background:"#fff",color:"#333",fontSize:14}}/>
        <button onClick={addDrill} style={btnS({borderColor:COLOR.solo,color:COLOR.solo,padding:"7px 14px"})}>追加</button>
      </div>
      {soloMenus.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
          {soloMenus.map((m,i)=>(
            <button key={i} onClick={()=>onChange({...solo,drills:[...(solo.drills||[]),m]})} style={{fontSize:12,padding:"4px 10px",borderRadius:12,border:`0.5px solid ${COLOR.solo}`,background:"#E1F5EE",color:COLOR.solo,cursor:"pointer"}}>{m}</button>
          ))}
        </div>
      )}
      {(solo.drills||[]).length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
          {solo.drills.map((d,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#f5f5f3",borderRadius:"8px",padding:"7px 10px"}}>
              <span style={{fontSize:13,color:"#333",flex:1}}>{d}</span>
              <button onClick={()=>removeDrill(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#aaa",fontSize:16,lineHeight:1,padding:"0 2px"}}>×</button>
            </div>
          ))}
        </div>
      )}
      <label style={lbl}>メモ・感想</label>
      <textarea rows={3} placeholder="気づきや課題など" value={solo.memo||""} onChange={e=>onChange({...solo,memo:e.target.value})} style={taS}/>
    </div>
  );
}

function TeamForm({team,index,total,onChange,onDelete}){
  const mins=calcMins(team.startTime,team.endTime)||null;
  return(
    <div style={{border:`1px solid ${COLOR.team}44`,borderRadius:"12px",padding:"14px",marginBottom:14,background:"#fff"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontSize:14,fontWeight:500,color:COLOR.team}}>第{index+1}回</span>
        {total>1&&<button onClick={onDelete} style={{...btnS(),fontSize:12,padding:"4px 10px",color:"#888"}}>削除</button>}
      </div>
      <label style={lbl}>チーム</label>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
        {TEAM_OPTIONS.map(t=>(
          <button key={t} onClick={()=>onChange({...team,teamName:t})} style={{padding:"7px 16px",fontSize:13,borderRadius:20,border:"0.5px solid",borderColor:team.teamName===t?COLOR.team:"#ccc",background:team.teamName===t?"#EBF5FF":"#fff",color:team.teamName===t?COLOR.team:"#666",cursor:"pointer",fontWeight:team.teamName===t?500:400}}>{t}</button>
        ))}
      </div>
      <label style={lbl}>練習時間</label>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,alignItems:"center",marginBottom:4}}>
        <input type="time" value={team.startTime||""} onChange={e=>onChange({...team,startTime:e.target.value})} style={timeInp}/>
        <span style={{fontSize:13,color:"#888",textAlign:"center"}}>〜</span>
        <input type="time" value={team.endTime||""} onChange={e=>onChange({...team,endTime:e.target.value})} style={timeInp}/>
      </div>
      {mins?<p style={{fontSize:12,color:"#888",margin:"0 0 12px",textAlign:"right"}}>{mins}分間</p>:<div style={{marginBottom:12}}/>}
      {[{k:"content",l:"練習内容",ph:"今日の練習メニュー"},{k:"taught",l:"教えてもらったこと",ph:"コーチや先輩から"},{k:"good",l:"上手くできたこと",ph:"うまくいったプレー"},{k:"improve",l:"改善すること",ph:"次につながる課題"},{k:"next",l:"次回の練習に向けて",ph:"次回意識したいこと"}].map(({k,l,ph})=>(
        <div key={k}><label style={lbl}>{l}</label><textarea rows={2} placeholder={ph} value={team[k]||""} onChange={e=>onChange({...team,[k]:e.target.value})} style={{...taS,marginBottom:10}}/></div>
      ))}
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
      <input placeholder="チーム名" value={game.opponent||""} onChange={e=>sf("opponent")(e.target.value)} style={{...inpS,marginBottom:12}}/>
      <label style={lbl}>試合結果（得点入力）</label>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{flex:1}}><p style={{fontSize:11,color:"#888",margin:"0 0 4px",textAlign:"center"}}>自チーム</p><input type="number" min="0" placeholder="0" value={game.myScore||""} onChange={e=>sf("myScore")(e.target.value)} style={{...numInp,fontSize:20,fontWeight:500,padding:"8px"}}/></div>
        <span style={{fontSize:18,color:"#bbb",marginTop:16}}>–</span>
        <div style={{flex:1}}><p style={{fontSize:11,color:"#888",margin:"0 0 4px",textAlign:"center"}}>相手チーム</p><input type="number" min="0" placeholder="0" value={game.oppScore||""} onChange={e=>sf("oppScore")(e.target.value)} style={{...numInp,fontSize:20,fontWeight:500,padding:"8px"}}/></div>
        {res&&<span style={{marginTop:16,fontSize:12,padding:"4px 10px",borderRadius:12,background:res==="勝ち"?"#EAF3DE":res==="負け"?"#FCEBEB":"#F1EFE8",color:res==="勝ち"?"#3B6D11":res==="負け"?"#A32D2D":"#5F5E5A",whiteSpace:"nowrap"}}>{res}</span>}
      </div>
      <label style={lbl}>出場時間（分）</label>
      <input type="number" min="0" placeholder="例：20" value={game.playTime||""} onChange={e=>sf("playTime")(e.target.value)} style={{...inpS,marginBottom:12}}/>
      <p style={{...lbl,marginBottom:8}}>シュート統計</p>
      <div style={{background:"#f5f5f3",borderRadius:"8px",padding:"10px",marginBottom:12}}>
        <div style={{display:"grid",gridTemplateColumns:"40px 1fr 1fr",gap:"6px 10px",alignItems:"center",marginBottom:8}}>
          <span/><span style={{fontSize:11,color:"#888",textAlign:"center"}}>試投数</span><span style={{fontSize:11,color:"#888",textAlign:"center"}}>決定数</span>
          {[["2P","shot2a","shot2m"],["3P","shot3a","shot3m"],["FT","fta","ftm"]].map(([label,ka,km])=>[
            <span key={label} style={{fontSize:13,fontWeight:500,color:"#333"}}>{label}</span>,
            <input key={ka} type="number" min="0" value={game[ka]||""} onChange={e=>sf(ka)(e.target.value)} style={numInp}/>,
            <input key={km} type="number" min="0" value={game[km]||""} onChange={e=>sf(km)(e.target.value)} style={numInp}/>
          ])}
        </div>
        <div style={{borderTop:"0.5px solid #ddd",paddingTop:8,display:"flex",justifyContent:"flex-end",gap:6,alignItems:"center"}}>
          <span style={{fontSize:12,color:"#888"}}>計算上の得点</span>
          <span style={{fontSize:18,fontWeight:500,color:COLOR.game}}>{calcPts}点</span>
        </div>
      </div>
      <p style={{...lbl,marginBottom:8}}>スタッツ</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:12}}>
        <StatBox label="AST" value={game.ast} onChange={sf("ast")}/>
        <StatBox label="REB" value={game.reb} onChange={sf("reb")}/>
        <StatBox label="STL" value={game.stl} onChange={sf("stl")}/>
        <StatBox label="TO" value={game.tov} onChange={sf("tov")}/>
        <StatBox label="Foul" value={game.foul} onChange={sf("foul")}/>
      </div>
      <label style={lbl}>この試合の上手くいったこと</label>
      <textarea rows={2} placeholder="この試合で良かったプレーなど" value={game.good||""} onChange={e=>sf("good")(e.target.value)} style={{...taS,marginBottom:10}}/>
      <label style={lbl}>この試合の反省点</label>
      <textarea rows={2} placeholder="この試合で改善したいこと" value={game.reflect||""} onChange={e=>sf("reflect")(e.target.value)} style={taS}/>
    </div>
  );
}

function MenuListPage({color,menus,onSave}){
  const[items,setItems]=useState(menus);
  const[input,setInput]=useState("");
  const[editIndex,setEditIndex]=useState(null);
  const[editValue,setEditValue]=useState("");
  const[dirty,setDirty]=useState(false);
  function add(){const v=input.trim();if(!v)return;setItems(i=>[...i,v]);setInput("");setDirty(true);}
  function remove(i){setItems(p=>p.filter((_,j)=>j!==i));setDirty(true);}
  function startEdit(i){setEditIndex(i);setEditValue(items[i]);}
  function saveEdit(){
    if(editIndex===null) return;
    const v=editValue.trim();
    if(!v){setEditIndex(null);return;}
    setItems(p=>p.map((x,j)=>j===editIndex?v:x));
    setEditIndex(null);setEditValue("");setDirty(true);
  }
  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        <input placeholder="メニューを入力" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} style={{flex:1,padding:"7px 10px",borderRadius:"8px",border:"0.5px solid #ccc",background:"#fff",color:"#333",fontSize:14}}/>
        <button onClick={add} style={btnS({borderColor:color,color:color,padding:"7px 14px"})}>追加</button>
      </div>
      {items.length>0?(
        <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:16}}>
          {items.map((m,i)=>(
            <div key={i} style={{background:"#f5f5f3",borderRadius:"8px",padding:"7px 12px"}}>
              {editIndex===i?(
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input value={editValue} onChange={e=>setEditValue(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEdit()} style={{flex:1,padding:"5px 8px",borderRadius:"6px",border:`1px solid ${color}`,fontSize:14,color:"#333",background:"#fff"}} autoFocus/>
                  <button onClick={saveEdit} style={btnS({fontSize:12,padding:"4px 10px",borderColor:color,color:color})}>保存</button>
                  <button onClick={()=>setEditIndex(null)} style={btnS({fontSize:12,padding:"4px 10px"})}>×</button>
                </div>
              ):(
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14,color:"#333",flex:1}}>{m}</span>
                  <button onClick={()=>startEdit(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#888",fontSize:13,padding:"0 4px"}}>編集</button>
                  <button onClick={()=>remove(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#aaa",fontSize:18,lineHeight:1,padding:"0 2px"}}>×</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ):<p style={{fontSize:13,color:"#bbb",textAlign:"center",margin:"2rem 0"}}>メニューがまだありません</p>}
      {dirty&&<button onClick={()=>{onSave(items);setDirty(false);}} style={btnS({background:color,color:"#fff",border:"none",width:"100%"})}>保存</button>}
    </div>
  );
}

export default function App(){
  const[appData,setAppData]=useState({records:{},monthGoals:{},monthReviews:{},soloMenus:[],trainMenus:[]});
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[page,setPage]=useState("calendar");
  const[menuOpen,setMenuOpen]=useState(false);
  const[view,setView]=useState("calendar");
  const[today]=useState(()=>new Date());
  const[calYear,setCalYear]=useState(today.getFullYear());
  const[calMonth,setCalMonth]=useState(today.getMonth());
  const[sel,setSel]=useState(null);
  const[editMode,setEditMode]=useState(null);
  const[solosList,setSolosList]=useState([newSolo()]);
  const[teamsList,setTeamsList]=useState([newTeam()]);
  const[trainForm,setTrainForm]=useState({menus:[]});
  const[trainInput,setTrainInput]=useState("");
  const[gamesList,setGamesList]=useState([newGame()]);
  const[daySummary,setDaySummary]=useState(newDaySummary());
  const[statsTab,setStatsTab]=useState("month");
  const[parentComment,setParentComment]=useState("");
  const[editingParentComment,setEditingParentComment]=useState(false);
  const[editingGoal,setEditingGoal]=useState(false);
  const[goalForm,setGoalForm]=useState(newMonthGoal());

  useEffect(()=>{loadFromSupabase().then(d=>{setAppData(d);setLoading(false);});},[]);

  const records=appData.records||{};
  const monthGoals=appData.monthGoals||{};
  const monthReviews=appData.monthReviews||{};
  const goalKey=`${calYear}-${String(calMonth+1).padStart(2,"0")}`;
  const currentGoal=monthGoals[goalKey]||newMonthGoal();
  const currentReview=monthReviews[goalKey]||null;

  async function persistDay(date,dayData){
    setAppData(p=>({...p,records:{...p.records,[date]:dayData}}));
    await saveDayToSupabase(date,dayData);
  }

  async function persistMeta(meta){
    const newData={...appData,...meta};
    setAppData(newData);
    await saveMetaToSupabase({monthGoals:newData.monthGoals,monthReviews:newData.monthReviews,soloMenus:newData.soloMenus,trainMenus:newData.trainMenus});
  }

  const recent3Months=getCompletedMonths(records,calYear,calMonth,3);
  const recent3Stats=computeMultiMonthStats(records,recent3Months);
  const recent3Avg=recent3Months.length>0?avgStats(recent3Stats,recent3Months.length):null;
  const fiscalYear=getFiscalYear(calYear,calMonth);
  const fiscalMonths=getFiscalMonths(records,fiscalYear,today);
  const fiscalStats=fiscalMonths.length>0?computeMultiMonthStats(records,fiscalMonths):null;

  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const getRec=ds=>records[ds]||{};

  function dotColor(ds){
    const r=getRec(ds);
    const hasSolo=!!(r.solos?.length>0),hasTeam=!!(r.teams?.length>0),hasGame=!!(r.games?.length>0),hasTrain=!!(r.training?.menus?.length>0);
    const count=[hasSolo,hasTeam,hasGame,hasTrain].filter(Boolean).length;
    if(count>=2) return COLOR.both;
    if(hasSolo) return COLOR.solo;if(hasTeam) return COLOR.team;if(hasGame) return COLOR.game;if(hasTrain) return COLOR.train;
    return null;
  }

  function openDay(day){
    const ds=fmtDate(calYear,calMonth,day);
    setSel(ds);setParentComment(records[ds]?.parentComment||"");
    setEditingParentComment(!records[ds]?.parentComment);setEditMode(null);setView("day");
  }

  function startEdit(type){
    const r=getRec(sel);
    if(type==="solo") setSolosList(r.solos?.length>0?r.solos.map(s=>({...newSolo(),...s})):[newSolo()]);
    else if(type==="team") setTeamsList(r.teams?.length>0?r.teams.map(t=>({...newTeam(),...t})):[newTeam()]);
    else if(type==="training"){setTrainForm(r.training||{menus:[]});setTrainInput("");}
    else{setGamesList(r.games?.length>0?r.games.map(g=>({...newGame(),...g})):[newGame()]);setDaySummary(r.daySummary||newDaySummary());}
    setEditMode(type);
  }

  async function saveEdit(){
    setSaving(true);
    let data;
    if(editMode==="solo") data={solos:solosList};
    else if(editMode==="team") data={teams:teamsList};
    else if(editMode==="training") data={training:trainForm};
    else data={games:gamesList,daySummary};
    const newRec={...(records[sel]||{}),...data};
    await persistDay(sel,newRec);
    setSaving(false);setEditMode(null);
  }

  async function saveParentComment(){
    setSaving(true);
    const newRec={...(records[sel]||{}),parentComment};
    await persistDay(sel,newRec);
    setSaving(false);
  }

  async function delRecord(type){
    setSaving(true);
    const rec={...(records[sel]||{})};
    if(type==="games"){delete rec.games;delete rec.daySummary;}else delete rec[type];
    let newRecords;
    if(!Object.keys(rec).length){
      await supabase.from('records').delete().eq('date',sel);
      newRecords={...records};delete newRecords[sel];
    } else {
      await persistDay(sel,rec);
      newRecords={...records,[sel]:rec};
    }
    setAppData(p=>({...p,records:newRecords}));
    setSaving(false);setEditMode(null);
  }

  async function saveGoal(){
    const newGoals={...monthGoals,[goalKey]:goalForm};
    await persistMeta({monthGoals:newGoals});
    setEditingGoal(false);
  }

  async function saveReview(form){
    setSaving(true);
    const newReviews={...monthReviews,[goalKey]:form};
    await persistMeta({monthReviews:newReviews});
    setSaving(false);
  }

  function addTrain(){const v=trainInput.trim();if(!v)return;setTrainForm(f=>({...f,menus:[...(f.menus||[]),v]}));setTrainInput("");}
  function removeTrain(i){setTrainForm(f=>({...f,menus:f.menus.filter((_,j)=>j!==i)}));}

  const prevM=()=>{if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1);};
  const nextM=()=>{if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1);};
  const wdays=["日","月","火","水","木","金","土"];
  const monthStats=computeMonthStats(records,calYear,calMonth);

  if(loading) return(<div style={{padding:"3rem",textAlign:"center",color:"#888",fontSize:15}}>読み込み中...</div>);

  const HamburgerMenu=()=>(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:100,display:"flex"}}>
      <div style={{width:240,background:"#fff",boxShadow:"2px 0 12px rgba(0,0,0,0.12)",padding:"1rem",display:"flex",flexDirection:"column",gap:4}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <span style={{fontSize:16,fontWeight:500,color:"#333"}}>メニュー</span>
          <button onClick={()=>setMenuOpen(false)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#888",lineHeight:1}}>×</button>
        </div>
        {[{id:"calendar",label:"📅　カレンダー",color:"#333"},{id:"soloMenu",label:"🏀　自主練メニュー",color:COLOR.solo},{id:"trainMenu",label:"💪　トレーニングメニュー",color:COLOR.train}].map(({id,label,color})=>(
          <button key={id} onClick={()=>{setPage(id);setMenuOpen(false);setView("calendar");}} style={{...btnS(),textAlign:"left",padding:"12px 14px",fontWeight:page===id?500:400,borderColor:page===id?"#ccc":"transparent",background:page===id?"#f5f5f3":"transparent",color,fontSize:14}}>{label}</button>
        ))}
      </div>
      <div style={{flex:1,background:"rgba(0,0,0,0.3)"}} onClick={()=>setMenuOpen(false)}/>
    </div>
  );

  const HamBtn=()=>(
    <button onClick={()=>setMenuOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px",display:"flex",flexDirection:"column",gap:4}}>
      {[0,1,2].map(i=><span key={i} style={{display:"block",width:20,height:2,background:"#555",borderRadius:1}}/>)}
    </button>
  );

  if(page==="soloMenu") return(
    <div style={{padding:"1rem",maxWidth:520,margin:"0 auto"}}>
      {menuOpen&&<HamburgerMenu/>}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}><HamBtn/><span style={{fontSize:16,fontWeight:500,color:"#333"}}>自主練メニュー</span></div>
      <MenuListPage key="solo" color={COLOR.solo} menus={appData.soloMenus||[]} onSave={async items=>await persistMeta({soloMenus:items})}/>
    </div>
  );

  if(page==="trainMenu") return(
    <div style={{padding:"1rem",maxWidth:520,margin:"0 auto"}}>
      {menuOpen&&<HamburgerMenu/>}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}><HamBtn/><span style={{fontSize:16,fontWeight:500,color:"#333"}}>トレーニングメニュー</span></div>
      <MenuListPage key="train" color={COLOR.train} menus={appData.trainMenus||[]} onSave={async items=>await persistMeta({trainMenus:items})}/>
    </div>
  );

  if(view==="day"){
    const rec=getRec(sel);
    const[y,m,d]=sel.split("-");
    const label=`${parseInt(y)}年${parseInt(m)}月${parseInt(d)}日`;
    const games=rec.games||[];
    const ds2=rec.daySummary||{};
    const totals=games.length>0?sumGames(games):null;
    const solos=rec.solos||[];
    const teams=rec.teams||[];

    if(editMode==="solo") return(
      <div style={{padding:"1rem",maxWidth:520,margin:"0 auto"}}>
        <button onClick={()=>setEditMode(null)} style={btnS()}>← 戻る</button>
        <h2 style={{fontSize:18,fontWeight:500,margin:"1rem 0 1.25rem",color:"#333"}}>自主練を記録</h2>
        {solosList.map((s,i)=>(
          <SoloForm key={i} solo={s} index={i} total={solosList.length}
            onChange={updated=>setSolosList(list=>list.map((x,j)=>j===i?updated:x))}
            onDelete={()=>setSolosList(list=>list.filter((_,j)=>j!==i))}
            soloMenus={appData.soloMenus||[]}/>
        ))}
        <button onClick={()=>setSolosList(l=>[...l,newSolo()])} style={btnS({width:"100%",marginBottom:16,borderColor:COLOR.solo,color:COLOR.solo})}>+ 自主練を追加</button>
        <div style={{display:"flex",gap:8}}>
          <button onClick={saveEdit} disabled={saving} style={btnS({background:COLOR.solo,color:"#fff",border:"none",flex:1,opacity:saving?0.7:1})}>{saving?"保存中...":"保存"}</button>
          {solos.length>0&&<button onClick={()=>delRecord("solos")} disabled={saving} style={btnS({color:"#e24b4a",borderColor:"#e24b4a"})}>削除</button>}
        </div>
      </div>
    );

    if(editMode==="team") return(
      <div style={{padding:"1rem",maxWidth:520,margin:"0 auto"}}>
        <button onClick={()=>setEditMode(null)} style={btnS()}>← 戻る</button>
        <h2 style={{fontSize:18,fontWeight:500,margin:"1rem 0 1.25rem",color:"#333"}}>チーム練習日記</h2>
        {teamsList.map((t,i)=>(
          <TeamForm key={i} team={t} index={i} total={teamsList.length}
            onChange={updated=>setTeamsList(list=>list.map((x,j)=>j===i?updated:x))}
            onDelete={()=>setTeamsList(list=>list.filter((_,j)=>j!==i))}/>
        ))}
        <button onClick={()=>setTeamsList(l=>[...l,newTeam()])} style={btnS({width:"100%",marginBottom:16,borderColor:COLOR.team,color:COLOR.team})}>+ チーム練習を追加</button>
        <div style={{display:"flex",gap:8}}>
          <button onClick={saveEdit} disabled={saving} style={btnS({background:COLOR.team,color:"#fff",border:"none",flex:1,opacity:saving?0.7:1})}>{saving?"保存中...":"保存"}</button>
          {teams.length>0&&<button onClick={()=>delRecord("teams")} disabled={saving} style={btnS({color:"#e24b4a",borderColor:"#e24b4a"})}>削除</button>}
        </div>
      </div>
    );

    if(editMode==="training") return(
      <div style={{padding:"1rem",maxWidth:520,margin:"0 auto"}}>
        <button onClick={()=>setEditMode(null)} style={btnS()}>← 戻る</button>
        <h2 style={{fontSize:18,fontWeight:500,margin:"1rem 0 1.25rem",color:"#333"}}>トレーニングを記録</h2>
        <label style={lbl}>メニュー</label>
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <input placeholder="例：腕立て30回" value={trainInput} onChange={e=>setTrainInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTrain()} style={{flex:1,padding:"7px 10px",borderRadius:"8px",border:"0.5px solid #ccc",background:"#fff",color:"#333",fontSize:14}}/>
          <button onClick={addTrain} style={btnS({borderColor:COLOR.train,color:COLOR.train,padding:"7px 14px"})}>追加</button>
        </div>
        {(appData.trainMenus||[]).length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
            {appData.trainMenus.map((m,i)=>(
              <button key={i} onClick={()=>setTrainForm(f=>({...f,menus:[...(f.menus||[]),m]}))} style={{fontSize:12,padding:"4px 10px",borderRadius:12,border:`0.5px solid ${COLOR.train}`,background:"#EEEDFE",color:COLOR.train,cursor:"pointer"}}>{m}</button>
            ))}
          </div>
        )}
        {(trainForm.menus||[]).length>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:16}}>
            {trainForm.menus.map((m,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#f5f5f3",borderRadius:"8px",padding:"7px 10px"}}>
                <span style={{fontSize:13,color:"#333",flex:1}}>{m}</span>
                <button onClick={()=>removeTrain(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#aaa",fontSize:16,lineHeight:1,padding:"0 2px"}}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button onClick={saveEdit} disabled={saving} style={btnS({background:COLOR.train,color:"#fff",border:"none",flex:1,opacity:saving?0.7:1})}>{saving?"保存中...":"保存"}</button>
          {rec.training&&<button onClick={()=>delRecord("training")} disabled={saving} style={btnS({color:"#e24b4a",borderColor:"#e24b4a"})}>削除</button>}
        </div>
      </div>
    );

    if(editMode==="games") return(
      <div style={{padding:"1rem",maxWidth:520,margin:"0 auto"}}>
        <button onClick={()=>setEditMode(null)} style={btnS()}>← 戻る</button>
        <h2 style={{fontSize:18,fontWeight:500,margin:"1rem 0 1.25rem",color:"#333"}}>試合記録</h2>
        {gamesList.map((g,i)=>(
          <GameForm key={i} game={g} index={i} total={gamesList.length}
            onChange={updated=>setGamesList(list=>list.map((x,j)=>j===i?updated:x))}
            onDelete={()=>setGamesList(list=>list.filter((_,j)=>j!==i))}/>
        ))}
        <button onClick={()=>setGamesList(l=>[...l,newGame()])} style={btnS({width:"100%",marginBottom:20,borderColor:COLOR.game,color:COLOR.game})}>+ 試合を追加</button>
        <div style={{borderTop:`2px solid ${COLOR.game}44`,paddingTop:16,marginBottom:16}}>
          <p style={{fontSize:15,fontWeight:500,color:COLOR.game,margin:"0 0 14px"}}>今日の試合まとめ</p>
          {[{k:"memo",l:"今日の試合の感想",ph:"全体を通して感じたこと"},{k:"good",l:"今日の試合の上手くいったこと",ph:"今日良かったプレーや成長"},{k:"reflect",l:"今日の試合の反省点",ph:"今日改善すべきだったこと"},{k:"next",l:"次回に向けて",ph:"次の試合で意識したいこと"}].map(({k,l,ph})=>(
            <div key={k}><label style={lbl}>{l}</label><textarea rows={2} placeholder={ph} value={daySummary[k]||""} onChange={e=>setDaySummary(f=>({...f,[k]:e.target.value}))} style={{...taS,marginBottom:12}}/></div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={saveEdit} disabled={saving} style={btnS({background:COLOR.game,color:"#fff",border:"none",flex:1,opacity:saving?0.7:1})}>{saving?"保存中...":"保存"}</button>
          {games.length>0&&<button onClick={()=>delRecord("games")} disabled={saving} style={btnS({color:"#e24b4a",borderColor:"#e24b4a"})}>削除</button>}
        </div>
      </div>
    );

    return(
      <div style={{padding:"1rem",maxWidth:520,margin:"0 auto"}}>
        <button onClick={()=>setView("calendar")} style={btnS()}>← カレンダー</button>
        <h2 style={{fontSize:18,fontWeight:500,margin:"1rem 0 1.25rem",color:"#333"}}>{label}</h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
          {[{type:"solo",label:"自主練",color:COLOR.solo},{type:"team",label:"チーム練習",color:COLOR.team}].map(({type,label,color})=>(
            <button key={type} onClick={()=>startEdit(type)} style={btnS({borderColor:color,color:color,fontSize:12,padding:"8px 4px",textAlign:"center"})}>
              {type==="solo"?solos.length>0?"自主練を編集":"+ 自主練":teams.length>0?"チーム練習を編集":"+ チーム練習"}
            </button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:20}}>
          {[{type:"training",label:"トレーニング",color:COLOR.train},{type:"games",label:"試合",color:COLOR.game}].map(({type,label,color})=>(
            <button key={type} onClick={()=>startEdit(type)} style={btnS({borderColor:color,color:color,fontSize:12,padding:"8px 4px",textAlign:"center"})}>
              {type==="games"?games.length>0?"試合を編集":"+ 試合":rec[type]?`${label}を編集`:`+ ${label}`}
            </button>
          ))}
        </div>

        {solos.length>0&&(
          <div style={cardS}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:COLOR.solo,flexShrink:0}}/>
              <span style={{fontWeight:500,fontSize:15,color:"#333"}}>自主練</span>
              <span style={{fontSize:12,color:"#888",marginLeft:"auto"}}>{solos.length}回</span>
            </div>
            {solos.map((s,i)=>(
              <div key={i}>
                {i>0&&<div style={{borderTop:"0.5px solid #ddd",margin:"10px 0"}}/>}
                {solos.length>1&&<p style={{fontSize:12,fontWeight:500,color:COLOR.solo,margin:"0 0 6px"}}>第{i+1}回</p>}
                {s.startTime&&s.endTime&&<p style={{fontSize:12,color:"#888",margin:"0 0 6px",textAlign:"right"}}>{s.startTime}〜{s.endTime}{calcMins(s.startTime,s.endTime)>0?` (${calcMins(s.startTime,s.endTime)}分)`:""}</p>}
                {(s.drills||[]).length>0&&<div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:6}}>{s.drills.map((d,j)=><div key={j} style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:5,height:5,borderRadius:"50%",background:COLOR.solo,flexShrink:0}}/><span style={{fontSize:13,color:"#333"}}>{d}</span></div>)}</div>}
                {s.memo&&<p style={{fontSize:13,color:"#666",margin:0,whiteSpace:"pre-wrap"}}>{s.memo}</p>}
              </div>
            ))}
          </div>
        )}

        {teams.length>0&&(
          <div style={cardS}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:COLOR.team,flexShrink:0}}/>
              <span style={{fontWeight:500,fontSize:15,color:"#333"}}>チーム練習</span>
              <span style={{fontSize:12,color:"#888",marginLeft:"auto"}}>{teams.length}回</span>
            </div>
            {teams.map((t,i)=>(
              <div key={i}>
                {i>0&&<div style={{borderTop:"0.5px solid #ddd",margin:"10px 0"}}/>}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  {teams.length>1&&<span style={{fontSize:12,fontWeight:500,color:COLOR.team}}>第{i+1}回</span>}
                  {t.teamName&&<span style={{fontSize:12,padding:"2px 8px",borderRadius:10,background:"#EBF5FF",color:COLOR.team}}>{t.teamName}</span>}
                  {t.startTime&&t.endTime&&<span style={{fontSize:12,color:"#888",marginLeft:"auto"}}>{t.startTime}〜{t.endTime}{calcMins(t.startTime,t.endTime)>0?` (${calcMins(t.startTime,t.endTime)}分)`:""}</span>}
                </div>
                {[{k:"content",l:"練習内容"},{k:"taught",l:"教えてもらったこと"},{k:"good",l:"上手くできたこと"},{k:"improve",l:"改善すること"},{k:"next",l:"次回に向けて"}].map(({k,l})=>t[k]?<div key={k} style={{marginBottom:6}}><p style={{fontSize:12,color:"#888",margin:"0 0 2px"}}>{l}</p><p style={{fontSize:13,color:"#333",margin:0,whiteSpace:"pre-wrap"}}>{t[k]}</p></div>:null)}
              </div>
            ))}
          </div>
        )}

        {rec.training?.menus?.length>0&&(
          <div style={cardS}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:COLOR.train,flexShrink:0}}/>
              <span style={{fontWeight:500,fontSize:15,color:"#333"}}>トレーニング</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              {rec.training.menus.map((m,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:5,height:5,borderRadius:"50%",background:COLOR.train,flexShrink:0}}/><span style={{fontSize:13,color:"#333"}}>{m}</span></div>)}
            </div>
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
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                  {[["出場",totals.mins>0?totals.mins+"分":"-"],["得点",totals.pts+"点"],["2P",totals.shot2m+"/"+totals.shot2a],["3P",totals.shot3m+"/"+totals.shot3a]].map(([l,v])=>(
                    <div key={l} style={{textAlign:"center"}}><p style={{fontSize:10,color:"#888",margin:"0 0 2px"}}>{l}</p><p style={{fontSize:14,fontWeight:500,color:"#333",margin:0}}>{v}</p></div>
                  ))}
                </div>
              </div>
            )}
            {games.map((g,i)=>{
              const p2m=parseInt(g.shot2m)||0,p3m=parseInt(g.shot3m)||0,ftm=parseInt(g.ftm)||0;
              const calcPts=p2m*2+p3m*3+ftm;
              const myS=parseInt(g.myScore),oppS=parseInt(g.oppScore);
              const res=(g.myScore!==""&&g.oppScore!==""&&!isNaN(myS)&&!isNaN(oppS))?(myS>oppS?"勝ち":myS<oppS?"負け":"引き分け"):null;
              return(
                <div key={i}>
                  {i>0&&<div style={{borderTop:"0.5px solid #ddd",margin:"10px 0"}}/>}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:500,color:COLOR.game}}>第{i+1}試合</span>
                    {g.opponent&&<span style={{fontSize:13,color:"#888"}}>vs {g.opponent}</span>}
                    {(g.myScore!==""||g.oppScore!=="")&&<span style={{fontSize:13,color:"#333",fontWeight:500}}>{g.myScore||0} – {g.oppScore||0}</span>}
                    {res&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:res==="勝ち"?"#EAF3DE":res==="負け"?"#FCEBEB":"#F1EFE8",color:res==="勝ち"?"#3B6D11":res==="負け"?"#A32D2D":"#5F5E5A"}}>{res}</span>}
                    {g.playTime&&<span style={{fontSize:12,color:"#888",marginLeft:"auto"}}>{g.playTime}分</span>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4,marginBottom:4}}>
                    {[["2P",(g.shot2m||0)+"/"+(g.shot2a||0)],["3P",(g.shot3m||0)+"/"+(g.shot3a||0)],["FT",(g.ftm||0)+"/"+(g.fta||0)],["得点",calcPts+"点"],["AST",g.ast||"-"]].map(([l,v])=>(
                      <div key={l} style={{background:"#fff",borderRadius:"8px",padding:"5px 4px",textAlign:"center"}}><p style={{fontSize:10,color:"#888",margin:"0 0 2px"}}>{l}</p><p style={{fontSize:13,fontWeight:500,color:"#333",margin:0}}>{v}</p></div>
                    ))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:6}}>
                    {[["REB",g.reb],["STL",g.stl],["TO",g.tov],["Foul",g.foul]].map(([l,v])=>(
                      <div key={l} style={{background:"#fff",borderRadius:"8px",padding:"5px 4px",textAlign:"center"}}><p style={{fontSize:10,color:"#888",margin:"0 0 2px"}}>{l}</p><p style={{fontSize:13,fontWeight:500,color:"#333",margin:0}}>{v||"-"}</p></div>
                    ))}
                  </div>
                  {g.good&&<div style={{marginBottom:4}}><span style={{fontSize:11,color:"#888"}}>上手くいったこと　</span><span style={{fontSize:13,color:"#333",whiteSpace:"pre-wrap"}}>{g.good}</span></div>}
                  {g.reflect&&<div><span style={{fontSize:11,color:"#888"}}>反省点　</span><span style={{fontSize:13,color:"#333",whiteSpace:"pre-wrap"}}>{g.reflect}</span></div>}
                </div>
              );
            })}
            {(ds2.memo||ds2.good||ds2.reflect||ds2.next)&&(
              <div style={{borderTop:`1.5px solid ${COLOR.game}33`,marginTop:12,paddingTop:12}}>
                <p style={{fontSize:13,fontWeight:500,color:COLOR.game,margin:"0 0 10px"}}>今日の試合まとめ</p>
                {[{k:"memo",l:"感想"},{k:"good",l:"上手くいったこと"},{k:"reflect",l:"反省点"},{k:"next",l:"次回に向けて"}].map(({k,l})=>ds2[k]?<div key={k} style={{marginBottom:7}}><p style={{fontSize:12,color:"#888",margin:"0 0 2px"}}>{l}</p><p style={{fontSize:13,color:"#333",margin:0,whiteSpace:"pre-wrap"}}>{ds2[k]}</p></div>:null)}
              </div>
            )}
          </div>
        )}

        {solos.length===0&&teams.length===0&&!rec.training&&games.length===0&&<p style={{fontSize:14,color:"#bbb",textAlign:"center",marginTop:32}}>まだ記録がありません</p>}

        <div style={{marginTop:16,borderTop:"0.5px solid #ddd",paddingTop:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <p style={{fontSize:13,fontWeight:500,color:COLOR.team,margin:0}}>両親からのコメント</p>
            {rec.parentComment&&!editingParentComment&&<button onClick={()=>{setParentComment(rec.parentComment);setEditingParentComment(true);}} style={btnS({fontSize:12,padding:"4px 10px"})}>編集</button>}
          </div>
          {rec.parentComment&&!editingParentComment?(
            <div style={{background:"#EBF5FF",borderRadius:"8px",padding:"10px 12px",border:`0.5px solid ${COLOR.team}44`}}>
              <p style={{fontSize:13,color:"#333",margin:0,whiteSpace:"pre-wrap"}}>{rec.parentComment}</p>
            </div>
          ):(
            <div>
              <textarea rows={3} placeholder="お父さん・お母さんからのコメントを入力..." value={parentComment} onChange={e=>setParentComment(e.target.value)} style={{...taS,marginBottom:8,borderColor:COLOR.team+"66"}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={async()=>{await saveParentComment();setEditingParentComment(false);}} disabled={saving} style={btnS({background:COLOR.team,color:"#fff",border:"none",flex:1,opacity:saving?0.7:1})}>{saving?"保存中...":"コメントを保存"}</button>
                {rec.parentComment&&<button onClick={()=>setEditingParentComment(false)} style={btnS()}>キャンセル</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const tabDefs=[
    {id:"month",label:`${calMonth+1}月`},
    {id:"avg3",label:"3ヶ月平均"},
    {id:"fiscal",label:`${fiscalYear}年度`},
  ];

  return(
    <div style={{padding:"1rem",maxWidth:480,margin:"0 auto"}}>
      {menuOpen&&<HamburgerMenu/>}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button onClick={()=>setMenuOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px",display:"flex",flexDirection:"column",gap:4}}>
          {[0,1,2].map(i=><span key={i} style={{display:"block",width:20,height:2,background:"#555",borderRadius:1}}/>)}
        </button>
        <button onClick={prevM} style={btnS({padding:"6px 12px"})}>‹</button>
        <span style={{fontSize:17,fontWeight:500,color:"#333",flex:1,textAlign:"center"}}>{calYear}年{calMonth+1}月</span>
        <button onClick={nextM} style={btnS({padding:"6px 12px"})}>›</button>
      </div>

      <div style={{background:"#f5f5f3",borderRadius:"12px",padding:"12px 14px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <span style={{fontSize:13,fontWeight:500,color:"#555"}}>{calMonth+1}月の目標</span>
          <button onClick={()=>{setGoalForm({...currentGoal});setEditingGoal(true);}} style={btnS({fontSize:12,padding:"4px 10px"})}>編集</button>
        </div>
        {editingGoal?(
          <div>
            {[{k:"basketball",l:"🏀 バスケ"},{k:"study",l:"📚 勉強"},{k:"life",l:"🌱 生活"},{k:"training",l:"💪 トレーニング"}].map(({k,l})=>(
              <div key={k} style={{marginBottom:8}}>
                <label style={{...lbl,marginBottom:2}}>{l}</label>
                <input value={goalForm[k]||""} onChange={e=>setGoalForm(f=>({...f,[k]:e.target.value}))} placeholder="目標を入力" style={{...inpS,fontSize:13,padding:"6px 10px"}}/>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={saveGoal} style={btnS({background:"#333",color:"#fff",border:"none",flex:1,fontSize:13})}>保存</button>
              <button onClick={()=>setEditingGoal(false)} style={btnS({fontSize:13})}>キャンセル</button>
            </div>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[{k:"basketball",l:"🏀 バスケ"},{k:"study",l:"📚 勉強"},{k:"life",l:"🌱 生活"},{k:"training",l:"💪 トレーニング"}].map(({k,l})=>(
              <div key={k} style={{background:"#fff",borderRadius:"8px",padding:"7px 10px"}}>
                <p style={{fontSize:10,color:"#888",margin:"0 0 2px"}}>{l}</p>
                <p style={{fontSize:12,color:currentGoal[k]?"#333":"#bbb",margin:0}}>{currentGoal[k]||"未設定"}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {wdays.map((w,i)=><div key={w} style={{textAlign:"center",fontSize:12,color:i===0?"#E24B4A":i===6?"#378ADD":"#888",padding:"4px 0"}}>{w}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:16}}>
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

      <div style={{display:"flex",gap:10,marginBottom:16,justifyContent:"center",flexWrap:"wrap"}}>
        {[{c:COLOR.solo,l:"自主練"},{c:COLOR.team,l:"チーム練習"},{c:COLOR.game,l:"試合"},{c:COLOR.train,l:"トレーニング"},{c:COLOR.both,l:"複数"}].map(({c,l})=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:c}}/>
            <span style={{fontSize:11,color:"#888"}}>{l}</span>
          </div>
        ))}
      </div>

      <div style={{borderTop:"0.5px solid #ddd",paddingTop:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4,marginBottom:14}}>
          {tabDefs.map(({id,label})=>(
            <button key={id} onClick={()=>setStatsTab(id)} style={{...btnS(),fontSize:12,padding:"7px 4px",fontWeight:statsTab===id?500:400,borderColor:statsTab===id?"#888":"#ccc",background:statsTab===id?"#f5f5f3":"#fff"}}>{label}</button>
          ))}
        </div>
        {statsTab==="month"&&<StatBlock title={`${calYear}年${calMonth+1}月の集計`} color={COLOR.solo} stats={monthStats}/>}
        {statsTab==="avg3"&&(
          recent3Avg
            ?<StatBlock title={`直近3ヶ月平均（${recent3Months.length}ヶ月分）`} color="#9B59B6" stats={recent3Avg} isAvg={true}/>
            :<div style={{background:"#f5f5f3",borderRadius:"12px",padding:"20px",textAlign:"center",marginBottom:12}}><p style={{fontSize:13,color:"#aaa",margin:0}}>前月以前のデータが必要です</p></div>
        )}
        {statsTab==="fiscal"&&(
          fiscalStats
            ?<StatBlock title={`${fiscalYear}年度（4月〜3月）${fiscalMonths.length}ヶ月分`} color={COLOR.team} stats={fiscalStats}/>
            :<div style={{background:"#f5f5f3",borderRadius:"12px",padding:"20px",textAlign:"center",marginBottom:12}}><p style={{fontSize:13,color:"#aaa",margin:0}}>データがまだありません</p></div>
        )}
        <ReviewSection review={currentReview} onSave={saveReview} saving={saving} goalKey={goalKey}/>
      </div>
    </div>
  );
}
