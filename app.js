const $=id=>document.getElementById(id);
const storeKey='adhdHealthOSCompletePlus';
let db=JSON.parse(localStorage.getItem(storeKey)||'{"entries":[],"settings":{"theme":"light","scheme":"copper"}}');

const adhdMetrics=[
{id:'focus',label:'Focus',weight:25,inverse:false},
{id:'initiation',label:'Task initiation',weight:20,inverse:false},
{id:'switching',label:'Task switching',weight:15,inverse:false},
{id:'emotional',label:'Emotional regulation',weight:15,inverse:false},
{id:'noise',label:'Mental noise',weight:15,inverse:true},
{id:'irritability',label:'Irritability',weight:10,inverse:true}
];
const moodMetrics=[
{id:'mood',label:'Mood'},
{id:'motivation',label:'Motivation'},
{id:'anxiety',label:'Anxiety'},
{id:'irritMood',label:'Irritability'}
];
let vals={focus:5,initiation:5,switching:5,emotional:5,noise:5,irritability:5,mood:5,motivation:5,anxiety:5,irritMood:5};
let dirty=false;

function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function rating(s){return s>=90?'Excellent':s>=75?'Good':s>=60?'Average':s>=40?'Poor':'Severe'}
function save(){localStorage.setItem(storeKey,JSON.stringify(db));dirty=false;render()}
function mins(t){if(!t)return null;const [h,m]=t.split(':').map(Number);return h*60+m}
function diffMins(a,b){let x=mins(a),y=mins(b);if(x===null||y===null)return null;if(y<x)y+=1440;return y-x}
function todayTitle(){document.getElementById('todayTitle').textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
function setDirty(){dirty=true; $('entryStatus').textContent='Unsaved'; $('entryStatus').classList.remove('saved')}

function applySettings(){
 document.body.className='';
 if(db.settings.theme==='dark')document.body.classList.add('dark');
 if(db.settings.theme==='amoled')document.body.classList.add('amoled');
 if(db.settings.scheme && db.settings.scheme!=='copper')document.body.classList.add(db.settings.scheme);
 $('theme').value=db.settings.theme||'light';$('scheme').value=db.settings.scheme||'copper';
}
function buildSliders(list,wrapId){
 const wrap=$(wrapId);wrap.innerHTML='';
 list.forEach(m=>{
  const row=document.createElement('div');row.className='row';
  row.innerHTML=`<div class="rowTop"><span>${m.label}</span><span id="${m.id}Val">${vals[m.id]}</span></div><input id="${m.id}" type="range" min="0" max="10" value="${vals[m.id]}">`;
  wrap.appendChild(row);
  $(m.id).addEventListener('input',e=>{vals[m.id]=Number(e.target.value);$(m.id+'Val').textContent=vals[m.id];setDirty();render()});
 });
}
function engineADHD(){
 let weighted=0;adhdMetrics.forEach(m=>{weighted+=(m.inverse?10-vals[m.id]:vals[m.id])*m.weight});
 const score=Math.round(weighted/10);
 const exec=Math.round(((vals.focus+vals.initiation+vals.switching+vals.emotional)/40)*100);
 const symptom=Math.round((((10-vals.noise)+(10-vals.irritability))/20)*100);
 return{score,exec,symptom,rating:rating(score)};
}
function engineSleep(){
 const sleepStart=$('sleepTime').value||$('bedtime').value, wake=$('wakeTime').value;
 let duration=diffMins(sleepStart,wake);duration=duration===null?8:duration/60;
 const latency=diffMins($('bedtime').value,$('sleepTime').value);
 const quality=Number($('quality').value)||0,wakings=Number($('wakings').value)||0;
 let durScore=duration<=0?0:duration<=8?(duration/8)*50:duration<=9?50:Math.max(35,50-((duration-9)*5));
 const score=Math.round(clamp(durScore+(quality/10)*40+Math.max(0,10-wakings*2),0,100));
 return{score,rating:rating(score),risk:score>=75?'LOW':score>=60?'MEDIUM':'HIGH',duration:Number(duration.toFixed(1)),latency:latency===null?null:latency,wakings,quality,debt:Number(Math.max(0,8-duration).toFixed(1))};
}
function engineMed(adhd,sleep){
 const crash=clamp(Number($('crashSeverity').value)||0,0,10), caffeine=Number($('caffeine').value)||0, protein=$('protein').value==='yes', missed=$('missedDose').value==='yes';
 let caffeinePenalty=caffeine>300?10:caffeine>150?5:0;
 const lifestyle=(protein?5:-3)-caffeinePenalty-(missed?25:0);
 const raw=adhd.score*.70+(sleep.score-50)*.20-crash*3+lifestyle+20;
 const score=Math.round(clamp(raw,0,100));
 let risk='HIGH';if(crash<=3&&sleep.score>=75&&score>=75)risk='LOW';else if(crash<=6&&sleep.score>=60&&score>=60)risk='MEDIUM';
 return{score,rating:rating(score),risk,lifestyle,missed,adherence:adherencePercent()};
}
function adherencePercent(){
 const entries=db.entries.slice(-30);if(!entries.length)return '--';
 const taken=entries.filter(e=>!e.med.missed).length;return Math.round((taken/entries.length)*100)+'%';
}
function engineMood(){
 const positive=(vals.mood+vals.motivation+(10-vals.anxiety)+(10-vals.irritMood))/40;
 return{score:Math.round(positive*100),rating:rating(Math.round(positive*100))};
}
function engineHealth(sleep){
 let score=50;if(sleep.score>=75)score+=20;else if(sleep.score<60)score-=10;
 const protein=Number($('proteinGrams').value)||($('protein').value==='yes'?100:0);
 if(protein>=150)score+=15;else if(protein>=80)score+=10;else if(protein>0)score+=5;
 const caffeine=Number($('caffeine').value)||0;if(caffeine>300)score-=15;else if(caffeine>150)score-=5;
 if(Number($('water').value)>=2)score+=5;if($('gym').value==='yes')score+=10;if(Number($('steps').value)>=8000)score+=10;
 return{score:Math.round(clamp(score,0,100)),rating:rating(score)};
}
function currentEntry(){
 const adhd=engineADHD(),sleep=engineSleep(),med=engineMed(adhd,sleep),mood=engineMood(),health=engineHealth(sleep);
 const crashDuration=diffMins($('crashTime').value,$('recoveryTime').value) || Number($('recoveryMinutes').value)||0;
 const hyperfocus={activity:$('hyperfocusActivity').value,minutes:Number($('hyperfocusMinutes').value)||0,type:$('hyperfocusType').value,afterCrash:$('hyperfocusAfterCrash').value==='Yes'};
 const sideEffects=[...document.querySelectorAll('.side:checked')].map(x=>x.value);
 const dailyScore=Math.round(adhd.score*.35+sleep.score*.20+med.score*.25+mood.score*.10+health.score*.10);
 const risk=(sleep.score<60||med.risk==='HIGH'||Number($('crashSeverity').value)>=7)?'HIGH':(sleep.score<75||med.risk==='MEDIUM')?'MEDIUM':'LOW';
 return{date:new Date().toISOString(),values:{...vals},adhd,sleep,med,mood,health,dailyScore,risk,medName:$('medName').value,dose:$('dose').value,medTime:$('medTime').value,caffeine:Number($('caffeine').value)||0,proteinBreakfast:$('protein').value==='yes',sideEffects,crash:{time:$('crashTime').value,recovery:$('recoveryTime').value,severity:Number($('crashSeverity').value)||0,duration:crashDuration,symptoms:$('crashSymptoms').value},hyperfocus,weight:Number($('weight').value)||0,bodyFat:Number($('bodyFat').value)||0,bp:$('bp').value,pulse:Number($('pulse').value)||0,steps:Number($('steps').value)||0,water:Number($('water').value)||0,proteinGrams:Number($('proteinGrams').value)||0,gym:$('gym').value};
}
function insights(){
 const es=db.entries, out=[];
 if(es.length<3)out.push('Need at least 3 entries for stronger correlation insights.');
 const high=es.filter(e=>e.sleep.duration>=8), low=es.filter(e=>e.sleep.duration<7);
 if(high.length&&low.length)out.push(`Focus is ${(avg(high.map(e=>e.values.focus))-avg(low.map(e=>e.values.focus))).toFixed(1)}/10 different on 8h+ sleep days.`);
 const prod=es.reduce((a,e)=>a+(e.hyperfocus.type==='Productive'?e.hyperfocus.minutes:0),0), total=es.reduce((a,e)=>a+e.hyperfocus.minutes,0);
 if(total)out.push(`${Math.round((prod/total)*100)}% of logged hyperfocus time is productive.`);
 const crashes=es.filter(e=>e.crash.time); if(crashes.length){const am=avg(crashes.map(e=>mins(e.crash.time)));out.push(`Average crash time is ${String(Math.floor(am/60)).padStart(2,'0')}:${String(Math.round(am%60)).padStart(2,'0')}.`)}
 const caffeineHigh=es.filter(e=>e.caffeine>150), caffeineLow=es.filter(e=>e.caffeine<=150);
 if(caffeineHigh.length&&caffeineLow.length)out.push(`High caffeine days average ADHD ${avg(caffeineHigh.map(e=>e.adhd.score)).toFixed(1)} vs ${avg(caffeineLow.map(e=>e.adhd.score)).toFixed(1)} on lower caffeine days.`);
 return out;
}
function weeklyReview(){
 const es=db.entries.slice(-7);if(!es.length)return'No weekly data yet.';
 return`Entries: ${es.length}
Average ADHD: ${avg(es.map(e=>e.adhd.score)).toFixed(1)}/100
Average Sleep: ${avg(es.map(e=>e.sleep.score)).toFixed(1)}/100
Average Medication: ${avg(es.map(e=>e.med.score)).toFixed(1)}%
Average Mood: ${avg(es.map(e=>e.mood.score)).toFixed(1)}/100
Average Health: ${avg(es.map(e=>e.health.score)).toFixed(1)}/100
Average Daily Score: ${avg(es.map(e=>e.dailyScore)).toFixed(1)}/100
Medication adherence: ${adherencePercent()}`;
}
function report(){
 const es=db.entries;if(!es.length)return'No entries saved yet.';
 return`ADHD HEALTH OS CLINICIAN REPORT

Entries: ${es.length}
Average ADHD Score: ${avg(es.map(e=>e.adhd.score)).toFixed(1)}/100
Average Sleep Score: ${avg(es.map(e=>e.sleep.score)).toFixed(1)}/100
Average Medication Effectiveness: ${avg(es.map(e=>e.med.score)).toFixed(1)}%
Average Mood Score: ${avg(es.map(e=>e.mood.score)).toFixed(1)}/100
Average Health Score: ${avg(es.map(e=>e.health.score)).toFixed(1)}/100
Medication Adherence: ${adherencePercent()}

Common Side Effects:
${[...new Set(es.flatMap(e=>e.sideEffects))].join(', ') || 'None logged'}

Insights:
${insights().map(x=>'- '+x).join('\n')}

Weekly Review:
${weeklyReview()}

Generated: ${new Date().toLocaleString('en-GB')}`;
}
function smartRecommendation(e){
 if(e.risk==='HIGH')return'High risk day: reduce expectations, hydrate, eat protein, and avoid extra caffeine.';
 if(e.sleep.score<75)return'Sleep is limiting today. Keep tasks simple and watch for an earlier crash.';
 if(e.med.score>=75&&e.adhd.score>=75)return'Good setup today. Keep routine consistent.';
 return'Stable but mixed. Keep logging to build reliable patterns.';
}
function chart(label, values, max=100){
 if(!values.length)return`<div class="barWrap"><b>${label}</b><p class="muted">No data yet</p></div>`;
 return `<div class="barWrap"><b>${label}</b>${values.slice(-10).map(v=>`<div class="bar" style="width:${Math.max(3,Math.min(100,(v/max)*100))}%"></div>`).join('')}</div>`;
}
function render(){
 const e=currentEntry();$('qualityVal').textContent=$('quality').value;
 $('dashAdhd').textContent=e.adhd.score+'/100';$('dashSleep').textContent=e.sleep.score+'/100';$('dashMed').textContent=e.med.score+'%';$('dashRisk').textContent=e.risk;$('dailyScore').textContent=e.dailyScore;$('systemSummary').textContent=`${e.risk} risk · Daily score ${e.dailyScore}/100`;$('recommendation').textContent=smartRecommendation(e);
 $('scoreCircle').className='scoreCircle '+(e.risk==='HIGH'?'high':e.risk==='MEDIUM'?'med':'low');
 $('adhdScore') && ($('adhdScore').textContent=e.adhd.score+'/100');$('execScore') && ($('execScore').textContent=e.adhd.exec+'/100');$('symptomScore') && ($('symptomScore').textContent=e.adhd.symptom+'/100');$('adhdRating') && ($('adhdRating').textContent=e.adhd.rating);$('moodScore') && ($('moodScore').textContent=e.mood.score+'/100');$('motivationOut') && ($('motivationOut').textContent=vals.motivation+'/10');
 $('medEffectiveness').textContent=e.med.score+'%';$('adherenceOut').textContent=adherencePercent();$('medCrashRisk').textContent=e.med.risk;$('lifestyleImpact').textContent=e.med.lifestyle>=0?'+'+e.med.lifestyle:e.med.lifestyle;
 $('sleepScore').textContent=e.sleep.score+'/100';$('recoveryRisk').textContent=e.sleep.risk;$('durationOut').textContent=e.sleep.duration+'h';$('latencyOut').textContent=e.sleep.latency===null?'--':e.sleep.latency+'m';$('crashDurationOut').textContent=e.crash.duration?e.crash.duration+'m':'--';$('healthScore').textContent=e.health.score+'/100';
 const weights=db.entries.filter(x=>x.weight).map(x=>x.weight);$('weightTrend').textContent=weights.length>1?(weights.at(-1)-weights[0]).toFixed(1)+'lb':'--';
 const total=db.entries.reduce((a,x)=>a+x.hyperfocus.minutes,0),prod=db.entries.reduce((a,x)=>a+(x.hyperfocus.type==='Productive'?x.hyperfocus.minutes:0),0);$('productiveHyperfocusOut').textContent=total?Math.round(prod/total*100)+'%':'--';$('hyperfocusWeek').textContent=total?total+'m':'--';
 $('actionPlan').innerHTML=[
  `<div class="insight"><b>Medication</b>${e.med.score}% effectiveness · ${e.med.risk} crash risk</div>`,
  `<div class="insight"><b>Sleep</b>${e.sleep.duration}h · ${e.sleep.score}/100 · ${e.sleep.risk} recovery risk</div>`,
  `<div class="insight"><b>ADHD</b>${e.adhd.score}/100 · ${e.adhd.rating}</div>`
 ].join('');
 $('snapshot').innerHTML=chart('Daily Score',db.entries.map(x=>x.dailyScore))+chart('ADHD Score',db.entries.map(x=>x.adhd.score))+chart('Sleep Score',db.entries.map(x=>x.sleep.score))+chart('Medication Effectiveness',db.entries.map(x=>x.med.score));
 $('insightList').innerHTML=insights().map(x=>`<div class="insight">${x}</div>`).join('');$('weeklyReview').textContent=weeklyReview();
 $('chartArea').innerHTML=chart('Daily Score',db.entries.map(x=>x.dailyScore))+chart('ADHD Score',db.entries.map(x=>x.adhd.score))+chart('Sleep Score',db.entries.map(x=>x.sleep.score))+chart('Medication Effectiveness',db.entries.map(x=>x.med.score))+chart('Mood Score',db.entries.map(x=>x.mood.score))+chart('Health Score',db.entries.map(x=>x.health.score));
 renderHistory();
}
function renderHistory(){
 const recent=$('recentEntries'), hist=$('historyList');
 if(!db.entries.length){recent.innerHTML='<p class="muted">No saved entries yet.</p>'; if(hist)hist.innerHTML=recent.innerHTML; return}
 const html=db.entries.slice().reverse().map((e,idx)=>`<div class="entry"><b>${new Date(e.date).toLocaleString('en-GB')} · Daily ${e.dailyScore}/100 · ${e.risk}</b>ADHD ${e.adhd.score} · Sleep ${e.sleep.score} · Med ${e.med.score}% · Mood ${e.mood.score}<button class="secondary" onclick="deleteEntry(${db.entries.length-1-idx})">Delete Entry</button></div>`).join('');
 recent.innerHTML=html.split('</div>').slice(0,3).join('</div>');
 if(hist)hist.innerHTML=html;
}
window.deleteEntry=function(i){if(confirm('Delete this entry?')){db.entries.splice(i,1);save()}}

function resetForm(){
 document.querySelectorAll('input').forEach(i=>{ if(i.type==='checkbox') i.checked=false; else if(!['range','file'].includes(i.type)) i.value=''; });
 $('quality').value=8; vals={focus:5,initiation:5,switching:5,emotional:5,noise:5,irritability:5,mood:5,motivation:5,anxiety:5,irritMood:5};
 document.querySelectorAll('input[type=range]').forEach(r=>{ if(r.id==='quality') return; r.value=5; if($(r.id+'Val')) $(r.id+'Val').textContent=5; });
 $('wakings').value=1;$('caffeine').value=100;$('crashSeverity').value=5;$('protein').value='yes';$('missedDose').value='no';render();setDirty();
}
function init(){
 todayTitle();buildSliders(adhdMetrics,'adhdSliders');buildSliders(moodMetrics,'moodSliders');applySettings();
 document.querySelectorAll('input,select').forEach(el=>{el.addEventListener('input',()=>{setDirty();render()});el.addEventListener('change',()=>{setDirty();render()})});
 document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button,.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.tab).classList.add('active')});
 $('saveFullEntryBtn').onclick=()=>{db.entries.push(currentEntry());save();$('entryStatus').textContent='Saved';$('entryStatus').classList.add('saved');alert('Entry saved')};
 $('resetFormBtn').onclick=resetForm;
 $('generateReportBtn').onclick=()=>{$('reportText').textContent=report()};
 $('downloadReportBtn').onclick=()=>{const blob=new Blob([report()],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='adhd-health-report.txt';a.click()};
 $('exportBtn').onclick=$('exportJsonBtn').onclick=()=>{const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='adhd-health-os-backup.json';a.click()};
 $('importBtn').onclick=()=>{const f=$('importFile').files[0];if(!f)return alert('Choose a backup file first');const r=new FileReader();r.onload=e=>{db=JSON.parse(e.target.result);save();alert('Imported')};r.readAsText(f)};
 $('saveSettingsBtn').onclick=()=>{db.settings={theme:$('theme').value,scheme:$('scheme').value};applySettings();save();alert('Settings saved')};
 $('clearBtn').onclick=()=>{if(confirm('Clear all data?')){db={entries:[],settings:db.settings};save()}};
 render();
}
init();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}))}
