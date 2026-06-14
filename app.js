const $ = id => document.getElementById(id);
const storeKey = 'adhdHealthOSAllEngines';
let db = JSON.parse(localStorage.getItem(storeKey) || '{"entries":[]}');

const adhdMetrics = [
  {id:'focus', label:'Focus', weight:25, inverse:false},
  {id:'initiation', label:'Task initiation', weight:20, inverse:false},
  {id:'switching', label:'Task switching', weight:15, inverse:false},
  {id:'emotional', label:'Emotional regulation', weight:15, inverse:false},
  {id:'noise', label:'Mental noise', weight:15, inverse:true},
  {id:'irritability', label:'Irritability', weight:10, inverse:true}
];
let adhdValues = {focus:5, initiation:5, switching:5, emotional:5, noise:5, irritability:5};

function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
function rating(score){
  if(score >= 90) return 'Excellent';
  if(score >= 75) return 'Good';
  if(score >= 60) return 'Average';
  if(score >= 40) return 'Poor';
  return 'Severe';
}
function avg(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null; }
function save(){ localStorage.setItem(storeKey, JSON.stringify(db)); render(); }

function buildAdhdSliders(){
  const wrap = $('adhdSliders');
  wrap.innerHTML = '';
  adhdMetrics.forEach(m=>{
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="rowTop"><span>${m.label}</span><span id="${m.id}Val">${adhdValues[m.id]}</span></div><input id="${m.id}" type="range" min="0" max="10" value="${adhdValues[m.id]}">`;
    wrap.appendChild(row);
    $(m.id).addEventListener('input', e=>{
      adhdValues[m.id] = Number(e.target.value);
      $(m.id+'Val').textContent = adhdValues[m.id];
      render();
    });
  });
}

function engineADHD(values){
  let weighted = 0;
  adhdMetrics.forEach(m=>{
    const adjusted = m.inverse ? 10 - values[m.id] : values[m.id];
    weighted += adjusted * m.weight;
  });
  const score = Math.round(weighted / 10);
  const exec = Math.round(((values.focus + values.initiation + values.switching + values.emotional) / 40) * 100);
  const symptom = Math.round((((10-values.noise) + (10-values.irritability)) / 20) * 100);
  return {score, exec, symptom, rating: rating(score)};
}

function engineSleep(duration, quality, wakings){
  let durScore;
  if(duration <= 0) durScore = 0;
  else if(duration <= 8) durScore = (duration / 8) * 50;
  else if(duration <= 9) durScore = 50;
  else durScore = Math.max(35, 50 - ((duration - 9) * 5));
  const qualScore = (quality / 10) * 40;
  const wakeScore = Math.max(0, 10 - (wakings * 2));
  const score = Math.round(clamp(durScore + qualScore + wakeScore,0,100));
  const debt = Math.max(0, 8 - duration);
  let risk = score >= 75 ? 'LOW' : score >= 60 ? 'MEDIUM' : 'HIGH';
  return {score, rating: rating(score), risk, debt:Number(debt.toFixed(1)), durationScore:Math.round(durScore), qualityScore:Math.round(qualScore), wakingScore:Math.round(wakeScore)};
}

function engineMedication(adhdScore, sleepScore, crashSeverity, protein, caffeine){
  const base = adhdScore * 0.70;
  const sleepImpact = (sleepScore - 50) * 0.20;
  const crashPenalty = crashSeverity * 3;
  const proteinBonus = protein ? 5 : -3;
  let caffeinePenalty = caffeine > 300 ? 10 : caffeine > 150 ? 5 : 0;
  const lifestyle = proteinBonus - caffeinePenalty;
  const raw = base + sleepImpact - crashPenalty + lifestyle + 20;
  const score = Math.round(clamp(raw,0,100));
  let risk = 'HIGH';
  if(crashSeverity <= 3 && sleepScore >= 75 && score >= 75) risk = 'LOW';
  else if(crashSeverity <= 6 && sleepScore >= 60 && score >= 60) risk = 'MEDIUM';
  return {score, rating:rating(score), risk, lifestyle, base:Math.round(base), sleepImpact:Math.round(sleepImpact), crashPenalty:Math.round(crashPenalty)};
}

function engineHealth(weight, sleepScore, protein, caffeine){
  let score = 50;
  if(sleepScore >= 75) score += 20; else if(sleepScore < 60) score -= 10;
  if(protein >= 100) score += 15; else if(protein > 0) score += 8;
  if(caffeine > 300) score -= 15; else if(caffeine > 150) score -= 5;
  if(weight > 0) score += 5;
  return {score:Math.round(clamp(score,0,100)), rating:rating(Math.round(clamp(score,0,100)))};
}

function engineDailyRisk(adhd, sleep, med, caffeine, crashSeverity){
  let risk = 0;
  if(adhd.score < 60) risk += 2;
  if(sleep.score < 60) risk += 2;
  if(med.risk === 'HIGH') risk += 2;
  if(caffeine > 300) risk += 1;
  if(crashSeverity >= 7) risk += 2;
  if(risk >= 5) return 'HIGH';
  if(risk >= 3) return 'MEDIUM';
  return 'LOW';
}

function engineCorrelations(entries){
  if(entries.length < 3) return ['Need at least 3 entries for correlation insights.'];
  const sleepHigh = entries.filter(e=>e.sleepDuration >= 8);
  const sleepLow = entries.filter(e=>e.sleepDuration < 7);
  const proteinYes = entries.filter(e=>e.proteinBreakfast);
  const proteinNo = entries.filter(e=>!e.proteinBreakfast);
  const insights = [];

  if(sleepHigh.length && sleepLow.length){
    const highFocus = avg(sleepHigh.map(e=>e.values.focus));
    const lowFocus = avg(sleepLow.map(e=>e.values.focus));
    const diff = highFocus - lowFocus;
    insights.push(`Focus is ${diff >= 0 ? 'higher' : 'lower'} by ${Math.abs(diff).toFixed(1)}/10 on 8h+ sleep days.`);
  }
  if(proteinYes.length && proteinNo.length){
    const yesCrash = avg(proteinYes.map(e=>e.crashSeverity));
    const noCrash = avg(proteinNo.map(e=>e.crashSeverity));
    const diff = noCrash - yesCrash;
    insights.push(`Crash severity is ${diff >= 0 ? 'lower' : 'higher'} by ${Math.abs(diff).toFixed(1)}/10 on protein breakfast days.`);
  }
  const avgCrash = avg(entries.filter(e=>e.crashTime).map(e=>{
    const [h,m]=e.crashTime.split(':').map(Number); return h*60+m;
  }));
  if(avgCrash){
    const h = Math.floor(avgCrash/60).toString().padStart(2,'0');
    const m = Math.round(avgCrash%60).toString().padStart(2,'0');
    insights.push(`Average crash time is ${h}:${m}.`);
  }
  return insights;
}

function engineWeekly(entries){
  const recent = entries.slice(-7);
  if(!recent.length) return 'No weekly data yet.';
  const adhdAvg = avg(recent.map(e=>e.adhd.score)).toFixed(1);
  const sleepAvg = avg(recent.map(e=>e.sleep.score)).toFixed(1);
  const medAvg = avg(recent.map(e=>e.med.score)).toFixed(1);
  const sleepHours = avg(recent.map(e=>e.sleepDuration)).toFixed(1);
  const best = recent.reduce((a,b)=>a.dailyScore>b.dailyScore?a:b);
  return `Last ${recent.length} entries
ADHD average: ${adhdAvg}/100
Sleep average: ${sleepAvg}/100
Medication effectiveness average: ${medAvg}%
Average sleep: ${sleepHours}h
Best day: ${new Date(best.date).toLocaleDateString('en-GB')} (${best.dailyScore}/100)`;
}

function currentEntry(){
  const sleepDuration = Number($('duration').value)||0;
  const quality = Number($('quality').value)||0;
  const wakings = Number($('wakings').value)||0;
  const caffeine = Number($('caffeine').value)||0;
  const crashSeverity = clamp(Number($('crashSeverity').value)||0,0,10);
  const proteinBreakfast = $('protein').value === 'yes';
  const proteinGrams = proteinBreakfast ? 100 : 0;
  const weight = Number($('weight').value)||0;
  const adhd = engineADHD(adhdValues);
  const sleep = engineSleep(sleepDuration, quality, wakings);
  const med = engineMedication(adhd.score, sleep.score, crashSeverity, proteinBreakfast, caffeine);
  const health = engineHealth(weight, sleep.score, proteinGrams, caffeine);
  const dailyRisk = engineDailyRisk(adhd, sleep, med, caffeine, crashSeverity);
  const dailyScore = Math.round((adhd.score*0.40)+(sleep.score*0.25)+(med.score*0.25)+(health.score*0.10));
  return {
    date:new Date().toISOString(),
    values:{...adhdValues},
    sleepDuration, quality, wakings,
    dose:$('dose').value,
    caffeine, proteinBreakfast,
    crashSeverity, crashTime:$('crashTime').value,
    weight,
    hyperfocusActivity:$('hyperfocusActivity').value,
    hyperfocusMinutes:Number($('hyperfocusMinutes').value)||0,
    adhd, sleep, med, health, dailyRisk, dailyScore
  };
}

function smartInsight(e){
  if(e.dailyRisk === 'HIGH') return 'HIGH risk: poor sleep, high symptoms or crash severity may affect today. Keep expectations realistic.';
  if(e.sleep.score < 60) return 'Sleep is the weak link today. Focus and crash risk may be worse.';
  if(e.med.risk === 'HIGH') return 'Medication effectiveness is being pulled down by crash severity, sleep or caffeine.';
  if(e.adhd.score >= 75 && e.sleep.score >= 75) return 'Strong setup today. ADHD and sleep scores are both good.';
  return 'Stable day. Keep logging to build reliable patterns.';
}

function render(){
  const e = currentEntry();
  $('qualityVal').textContent = $('quality').value;
  $('adhdScore').textContent = e.adhd.score + '/100';
  $('execScore').textContent = e.adhd.exec + '/100';
  $('symptomScore').textContent = e.adhd.symptom + '/100';
  $('sleepScore').textContent = e.sleep.score + '/100';
  $('sleepDebt').textContent = e.sleep.debt + 'h';
  $('recoveryRisk').textContent = e.sleep.risk;
  $('effectivenessScore').textContent = e.med.score + '%';
  $('crashRisk').textContent = e.med.risk;
  $('lifeScore').textContent = e.dailyScore + '/100';
  $('healthScore').textContent = e.health.score + '/100';
  $('dashAdhd').textContent = e.adhd.score + '/100';
  $('dashSleep').textContent = e.sleep.score + '/100';
  $('dashMed').textContent = e.med.score + '%';
  $('dashRisk').textContent = e.dailyRisk;
  $('dailyScore').textContent = e.dailyScore;
  $('systemSummary').textContent = `${e.dailyRisk} risk · ${rating(e.dailyScore)} daily score`;
  $('smartInsight').innerHTML = `<div class="insight"><b>${e.dailyRisk} Risk</b>${smartInsight(e)}</div>`;
  $('correlations').innerHTML = engineCorrelations(db.entries).map(x=>`<div class="insight">${x}</div>`).join('');
  $('weeklyReview').textContent = engineWeekly(db.entries);
  renderHistory();
}

function renderHistory(){
  const box = $('historyList');
  if(!db.entries.length){ box.innerHTML='<p class="muted">No saved entries yet.</p>'; return; }
  box.innerHTML = db.entries.slice().reverse().map(e=>`
    <div class="entry">
      <b>${new Date(e.date).toLocaleString('en-GB')} · Daily ${e.dailyScore}/100 · Risk ${e.dailyRisk}</b>
      ADHD ${e.adhd.score}/100 · Sleep ${e.sleep.score}/100 · Med ${e.med.score}% · Crash ${e.crashSeverity}/10
    </div>
  `).join('');
}

function generateReport(){
  const entries = db.entries;
  if(!entries.length){ $('reportText').textContent = 'No entries saved yet.'; return ''; }
  const report = `ADHD HEALTH OS REPORT

Entries: ${entries.length}

Average ADHD Score: ${avg(entries.map(e=>e.adhd.score)).toFixed(1)}/100
Average Sleep Score: ${avg(entries.map(e=>e.sleep.score)).toFixed(1)}/100
Average Medication Effectiveness: ${avg(entries.map(e=>e.med.score)).toFixed(1)}%
Average Sleep Duration: ${avg(entries.map(e=>e.sleepDuration)).toFixed(1)}h
Average Crash Severity: ${avg(entries.map(e=>e.crashSeverity)).toFixed(1)}/10

Correlation Insights:
${engineCorrelations(entries).map(x=>'- '+x).join('\\n')}

Weekly Review:
${engineWeekly(entries)}

Generated: ${new Date().toLocaleString('en-GB')}`;
  $('reportText').textContent = report;
  return report;
}

document.querySelectorAll('.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tabs button,.tab').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.tab).classList.add('active');
  });
});

$('saveTodayBtn').addEventListener('click', ()=>{ db.entries.push(currentEntry()); save(); alert('Daily entry saved.'); });
$('clearBtn').addEventListener('click', ()=>{ if(confirm('Clear all saved data?')){ db={entries:[]}; save(); }});
$('exportBtn').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(db,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='adhd-health-os-all-engines.json'; a.click();
});
$('generateReportBtn').addEventListener('click', generateReport);
$('downloadReportBtn').addEventListener('click', ()=>{
  const report = generateReport();
  if(!report) return;
  const blob = new Blob([report], {type:'text/plain'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='adhd-health-os-report.txt'; a.click();
});

document.querySelectorAll('input,select').forEach(el=>{ el.addEventListener('input', render); el.addEventListener('change', render); });

buildAdhdSliders();
render();
