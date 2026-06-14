const $ = id => document.getElementById(id);
const storeKey = 'adhdHealthOSAlpha';
let db = JSON.parse(localStorage.getItem(storeKey) || '{"adhd":[],"sleep":[],"meds":[]}');

const adhdMetrics = [
  {id:'focus', label:'Focus', weight:25, inverse:false},
  {id:'initiation', label:'Task initiation', weight:20, inverse:false},
  {id:'switching', label:'Task switching', weight:15, inverse:false},
  {id:'emotional', label:'Emotional regulation', weight:15, inverse:false},
  {id:'noise', label:'Mental noise', weight:15, inverse:true},
  {id:'irritability', label:'Irritability', weight:10, inverse:true}
];

let adhdValues = {focus:5, initiation:5, switching:5, emotional:5, noise:5, irritability:5};

function save(){localStorage.setItem(storeKey, JSON.stringify(db)); renderDashboard(); renderHistory();}

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
      calculateAdhd();
      calculateMedication();
      renderDashboard();
    });
  });
}

function rating(score){
  if(score >= 90) return 'Excellent';
  if(score >= 75) return 'Good';
  if(score >= 60) return 'Average';
  if(score >= 40) return 'Poor';
  return 'Severe';
}

function calculateAdhd(){
  let weighted = 0;
  adhdMetrics.forEach(m=>{
    const adjusted = m.inverse ? 10 - adhdValues[m.id] : adhdValues[m.id];
    weighted += adjusted * m.weight;
  });
  const score = Math.round(weighted / 10);
  const exec = Math.round(((adhdValues.focus + adhdValues.initiation + adhdValues.switching + adhdValues.emotional) / 40) * 100);
  const symptom = Math.round((((10-adhdValues.noise) + (10-adhdValues.irritability)) / 20) * 100);
  $('adhdScore').textContent = score;
  $('adhdRating').textContent = rating(score);
  $('execScore').textContent = exec;
  $('symptomScore').textContent = symptom;
  return {score, exec, symptom, rating: rating(score), values:{...adhdValues}};
}

function calculateSleep(){
  const duration = Number($('duration').value) || 0;
  const quality = Number($('quality').value) || 0;
  const wakings = Number($('wakings').value) || 0;
  let durScore;
  if(duration <= 0) durScore = 0;
  else if(duration <= 8) durScore = (duration / 8) * 50;
  else if(duration <= 9) durScore = 50;
  else durScore = Math.max(35, 50 - ((duration - 9) * 5));
  const qualScore = (quality / 10) * 40;
  const wakeScore = Math.max(0, 10 - (wakings * 2));
  const score = Math.round(Math.max(0, Math.min(100, durScore + qualScore + wakeScore)));
  const debt = Math.max(0, 8 - duration);
  let risk = 'HIGH';
  if(score >= 75) risk = 'LOW';
  else if(score >= 60) risk = 'MEDIUM';
  $('qualityVal').textContent = quality;
  $('sleepScore').textContent = score;
  $('sleepRating').textContent = rating(score);
  $('sleepDebt').textContent = debt.toFixed(1) + 'h';
  $('recoveryRisk').textContent = risk;
  return {score, rating: rating(score), risk, duration, quality, wakings, sleepDebt:Number(debt.toFixed(1)), bedtime:$('bedtime').value, waketime:$('waketime').value};
}

function calculateMedication(){
  const adhd = calculateAdhd().score;
  const sleep = calculateSleep().score;
  const crash = Math.max(0, Math.min(10, Number($('crashSeverity').value) || 0));
  const caffeine = Math.max(0, Number($('caffeine').value) || 0);
  const protein = $('protein').value === 'yes';
  const base = adhd * 0.70;
  const sleepImpact = (sleep - 50) * 0.20;
  const crashPenalty = crash * 3;
  const proteinBonus = protein ? 5 : -3;
  let caffeinePenalty = 0;
  if(caffeine > 300) caffeinePenalty = 10;
  else if(caffeine > 150) caffeinePenalty = 5;
  const lifestyle = proteinBonus - caffeinePenalty;
  const raw = base + sleepImpact - crashPenalty + lifestyle + 20;
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  let risk = 'HIGH';
  if(crash <= 3 && sleep >= 75 && score >= 75) risk = 'LOW';
  else if(crash <= 6 && sleep >= 60 && score >= 60) risk = 'MEDIUM';
  $('effectivenessScore').textContent = score;
  $('medRating').textContent = rating(score);
  $('medCrashRisk').textContent = risk;
  $('lifestyleImpact').textContent = lifestyle >= 0 ? '+' + lifestyle : lifestyle;
  return {score, rating:rating(score), risk, adhdScore:adhd, sleepScore:sleep, crashSeverity:crash, caffeine, proteinBreakfast:protein, dose:$('dose').value, lifestyleImpact:lifestyle};
}

function renderDashboard(){
  const adhd = calculateAdhd();
  const sleep = calculateSleep();
  const med = calculateMedication();
  const combined = Math.round((adhd.score * 0.45) + (sleep.score * 0.25) + (med.score * 0.30));
  $('dashAdhd').textContent = adhd.score + '/100';
  $('dashSleep').textContent = sleep.score + '/100';
  $('dashMed').textContent = med.score + '%';
  $('dashRisk').textContent = med.risk;
  $('dailyScore').textContent = combined;
  $('combinedStatus').textContent = `Combined daily score ${combined}/100 · ${rating(combined)}`;
  $('quickInsight').textContent = buildInsight(adhd, sleep, med);
}

function buildInsight(adhd, sleep, med){
  if(sleep.score < 60) return 'Sleep is likely dragging today down. Expect focus and crash risk to be worse.';
  if(med.risk === 'HIGH') return 'Crash risk is high. Check sleep, crash severity, caffeine and food intake.';
  if(adhd.score >= 75 && sleep.score >= 75) return 'Good setup today: ADHD and sleep scores are both strong.';
  if(adhd.values.noise >= 7) return 'Mental noise is high today, even if other scores look okay.';
  return 'Scores are usable. Keep logging to build patterns.';
}

function renderHistory(){
  const box = $('historyList');
  const all = [
    ...db.adhd.map(x=>({...x,type:'ADHD'})),
    ...db.sleep.map(x=>({...x,type:'Sleep'})),
    ...db.meds.map(x=>({...x,type:'Medication'}))
  ].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!all.length){ box.innerHTML = '<p class="muted">No saved entries yet.</p>'; return; }
  box.innerHTML = all.map(x=>{
    let detail = '';
    if(x.type==='ADHD') detail = `${x.score}/100 · ${x.rating}`;
    if(x.type==='Sleep') detail = `${x.score}/100 · ${x.duration}h sleep · risk ${x.risk}`;
    if(x.type==='Medication') detail = `${x.score}% · ${x.dose || 'No dose'} · risk ${x.risk}`;
    return `<div class="entry"><b>${x.type}: ${detail}</b><span class="muted">${new Date(x.date).toLocaleString('en-GB')}</span></div>`;
  }).join('');
}

document.querySelectorAll('.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tabs button,.tab').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.tab).classList.add('active');
  });
});

$('saveAdhdBtn').addEventListener('click', ()=>{ db.adhd.push({date:new Date().toISOString(), ...calculateAdhd()}); save(); alert('ADHD entry saved.'); });
$('saveSleepBtn').addEventListener('click', ()=>{ db.sleep.push({date:new Date().toISOString(), ...calculateSleep()}); save(); alert('Sleep entry saved.'); });
$('saveMedBtn').addEventListener('click', ()=>{ db.meds.push({date:new Date().toISOString(), ...calculateMedication()}); save(); alert('Medication entry saved.'); });
$('clearBtn').addEventListener('click', ()=>{ if(confirm('Clear all data?')){ db={adhd:[],sleep:[],meds:[]}; save(); }});
$('exportBtn').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(db,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='adhd-health-os-alpha.json'; a.click(); URL.revokeObjectURL(url);
});

['duration','quality','wakings','bedtime','waketime','dose','caffeine','protein','crashSeverity'].forEach(id=>{
  $(id).addEventListener('input', renderDashboard);
  $(id).addEventListener('change', renderDashboard);
});

buildAdhdSliders();
renderDashboard();
renderHistory();
