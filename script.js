/* =========================================================
   Period — Timetable Assistant
   Single-file build: all HTML/CSS/JS together for the
   prototype stage. Everything persists via localStorage.
   ========================================================= */

const STORAGE_KEY = 'periodAppData';
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function defaultData(){
  return { classes: [], subjects: [], attendance: {}, assignments: [], settings: { theme: 'light', pGroup: '', tGroup: '', course: '', section: '', openRouterKey: '' }, notifiedLog: {} };
}
function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultData();
    const parsed = JSON.parse(raw);
    const merged = Object.assign(defaultData(), parsed);
    merged.settings = Object.assign(defaultData().settings, parsed.settings || {});
    return merged;
  }catch(e){ return defaultData(); }
}
function saveData(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

let state = loadData();

function uid(){ return Math.random().toString(36).slice(2,10); }

/* ---------------- THEME ---------------- */
function applyTheme(){
  document.body.setAttribute('data-theme', state.settings.theme);
  document.getElementById('themeLabel').textContent = state.settings.theme === 'dark' ? 'Dark mode' : 'Light mode';
}
document.getElementById('themeToggle').addEventListener('click', ()=>{
  state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
  saveData(); applyTheme();
});
applyTheme();
document.getElementById('myCourse').value = state.settings.course || '';
document.getElementById('mySection').value = state.settings.section || '';
document.getElementById('myPGroup').value = state.settings.pGroup || '';
document.getElementById('myTGroup').value = state.settings.tGroup || '';
document.getElementById('myCourse').addEventListener('change', e=>{ state.settings.course = e.target.value.trim(); saveData(); });
document.getElementById('mySection').addEventListener('change', e=>{ state.settings.section = e.target.value; saveData(); });
document.getElementById('myPGroup').addEventListener('change', e=>{ state.settings.pGroup = e.target.value; saveData(); });
document.getElementById('myTGroup').addEventListener('change', e=>{ state.settings.tGroup = e.target.value; saveData(); });

// Note: there's no UI field for state.settings.openRouterKey anymore (removed so
// this can be published without exposing a key-entry box). The AI-assisted photo/
// PDF reading below still works if openRouterKey is set some other way — e.g. by
// running `localStorage` edits yourself, or hardcoding a default in defaultData()
// above for a personal/private copy of this app.

// Best-effort match of an imported row's text against a subject you've already
// saved (by code, abbreviation, or name). Used only to pre-select the chip in the
// review grid — it no longer hides rows that don't match, so you can still see and
// tap-select anything the AI or file found, even for subjects you haven't added yet.
function findBestSubjectMatch(rawText){
  if(!state.subjects.length) return null;
  const t = rawText.toLowerCase();
  const tCompact = t.replace(/\s+/g,'');
  let best = null;
  state.subjects.forEach(s=>{
    if(best) return;
    const code = (s.code||'').toLowerCase().replace(/\s+/g,'');
    const abbv = (s.abbv||'').toLowerCase().replace(/\s+/g,'');
    const name = (s.name||'').toLowerCase();
    if((code && tCompact.includes(code)) || (abbv && tCompact.includes(abbv)) || (name && t.includes(name))) best = s.id;
  });
  return best;
}

/* ---------------- NAVIGATION ---------------- */
const titles = {
  dashboard: ['Dashboard', "Here's how your day looks."],
  subjects: ['Subjects', "Tell Lecture what you're studying."],
  timetable: ['Timetable', 'Manage every class you attend.'],
  attendance: ['Attendance', 'Track how you\'re doing, subject by subject.'],
  assignments: ['Assignments', 'Everything due, in one place.']
};
function goToView(v){
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active', v && b.dataset.view===v));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.view===v));
  document.querySelectorAll('.view').forEach(s=>s.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  document.getElementById('pageTitle').textContent = titles[v][0];
  document.getElementById('pageSub').textContent = titles[v][1];
  document.getElementById('searchResults').style.display='none';
  renderAll();
}
function switchView(v){
  document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('active'));
  goToView(v);
}
document.querySelectorAll('.nav-item').forEach(btn=>{
  btn.addEventListener('click', ()=>goToView(btn.dataset.view));
});

/* ---------------- MODAL HELPERS ---------------- */
function openModal(id){ document.getElementById(id).classList.add('active'); }
function closeModal(id){ document.getElementById(id).classList.remove('active'); }
document.querySelectorAll('.overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target === ov) ov.classList.remove('active'); });
});

/* ---------------- SUBJECT CRUD ---------------- */
document.getElementById('addSubjectBtn').addEventListener('click', ()=>openSubjectModal());
document.getElementById('addSubjectBtnEmpty').addEventListener('click', ()=>openSubjectModal());

function openSubjectModal(subj){
  document.getElementById('subjectModalTitle').textContent = subj ? 'Edit subject' : 'Add subject';
  document.getElementById('subjectId').value = subj ? subj.id : '';
  document.getElementById('subjectName').value = subj ? subj.name : '';
  document.getElementById('subjectCode').value = subj ? subj.code : '';
  document.getElementById('subjectCredits').value = subj ? (subj.credits ?? '') : '';
  document.getElementById('subjectFaculty').value = subj ? subj.faculty : '';
  document.getElementById('subjectRoom').value = subj ? subj.room : '';
  openModal('subjectModalOverlay');
}
document.getElementById('saveSubjectBtn').addEventListener('click', ()=>{
  const name = document.getElementById('subjectName').value.trim();
  if(!name){ alert('Please give the subject a name.'); return; }
  const id = document.getElementById('subjectId').value;
  const obj = {
    id: id || uid(), name,
    code: document.getElementById('subjectCode').value.trim(),
    credits: document.getElementById('subjectCredits').value ? Number(document.getElementById('subjectCredits').value) : null,
    faculty: document.getElementById('subjectFaculty').value.trim(),
    room: document.getElementById('subjectRoom').value.trim()
  };
  if(id){
    const idx = state.subjects.findIndex(s=>s.id===id);
    if(idx>-1) state.subjects[idx]=obj;
  } else {
    state.subjects.push(obj);
  }
  saveData(); closeModal('subjectModalOverlay'); renderAll();
});
function deleteSubject(id){
  if(!confirm('Remove this subject? Classes already on your timetable using this name will stay as they are.')) return;
  state.subjects = state.subjects.filter(s=>s.id!==id);
  saveData(); renderAll();
}
function renderSubjects(){
  const wrap = document.getElementById('subjectsListContainer');
  document.getElementById('subjectEmpty').style.display = state.subjects.length ? 'none' : 'block';
  wrap.innerHTML = state.subjects.map(s=>`
    <div class="attend-row">
      <div>
        <div class="attend-subject">${escapeHtml(s.name)} ${s.code?`<span class="tag-chip" style="margin-left:6px;">${escapeHtml(s.code)}</span>`:''} ${s.credits?`<span class="tag-chip">${s.credits} cr</span>`:''}</div>
        <div class="attend-nums">${escapeHtml(s.faculty||'no default faculty')} · ${escapeHtml(s.room||'no default room')}</div>
      </div>
      <div style="display:flex;gap:4px;">
        <button class="icon-btn" onclick='openSubjectModal(${JSON.stringify(s).replace(/'/g,"&#39;")})' title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="icon-btn" onclick="deleteSubject('${s.id}')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`).join('');
}

/* ---------------- CLASS CRUD ---------------- */
document.getElementById('addClassBtn').addEventListener('click', ()=>openClassModal());
document.getElementById('addClassBtnEmpty').addEventListener('click', ()=>openClassModal());

function openClassModal(cls){
  document.getElementById('classModalTitle').textContent = cls ? 'Edit class' : 'Add class';
  document.getElementById('classId').value = cls ? cls.id : '';
  document.getElementById('classSubject').value = cls ? cls.subject : '';
  document.getElementById('classFaculty').value = cls ? cls.faculty : '';
  document.getElementById('classRoom').value = cls ? cls.room : '';
  document.getElementById('classDay').value = cls ? cls.day : 'Monday';
  document.getElementById('classStart').value = cls ? cls.start : '';
  document.getElementById('classEnd').value = cls ? cls.end : '';
  const dl = document.getElementById('classSubjectList');
  dl.innerHTML = state.subjects.map(s=>`<option value="${escapeHtml(s.name)}">`).join('');
  openModal('classModalOverlay');
}
// Autofill faculty/room when the typed subject matches one you've already defined
document.getElementById('classSubject').addEventListener('input', e=>{
  const match = state.subjects.find(s=>s.name.toLowerCase()===e.target.value.trim().toLowerCase());
  if(match){
    if(!document.getElementById('classFaculty').value) document.getElementById('classFaculty').value = match.faculty;
    if(!document.getElementById('classRoom').value) document.getElementById('classRoom').value = match.room;
  }
});

document.getElementById('saveClassBtn').addEventListener('click', ()=>{
  const subject = document.getElementById('classSubject').value.trim();
  const start = document.getElementById('classStart').value;
  const end = document.getElementById('classEnd').value;
  if(!subject || !start || !end){ alert('Please fill in subject, start time and end time.'); return; }
  const id = document.getElementById('classId').value;
  const obj = {
    id: id || uid(),
    subject, faculty: document.getElementById('classFaculty').value.trim(),
    room: document.getElementById('classRoom').value.trim(),
    day: document.getElementById('classDay').value,
    start, end
  };
  if(id){
    const idx = state.classes.findIndex(c=>c.id===id);
    if(idx>-1) state.classes[idx]=obj;
  } else {
    state.classes.push(obj);
  }
  saveData(); closeModal('classModalOverlay'); renderAll();
});

function deleteClass(id){
  if(!confirm('Delete this class? This will not remove past attendance records.')) return;
  state.classes = state.classes.filter(c=>c.id!==id);
  saveData(); renderAll();
}

/* ---------------- ASSIGNMENT CRUD ---------------- */
document.getElementById('addAssignBtn').addEventListener('click', ()=>openAssignModal());
document.getElementById('addAssignBtnEmpty').addEventListener('click', ()=>openAssignModal());

function openAssignModal(a){
  document.getElementById('assignModalTitle').textContent = a ? 'Edit assignment' : 'Add assignment';
  document.getElementById('assignId').value = a ? a.id : '';
  document.getElementById('assignTitle').value = a ? a.title : '';
  document.getElementById('assignSubject').value = a ? a.subject : '';
  document.getElementById('assignDesc').value = a ? a.description : '';
  document.getElementById('assignDue').value = a ? a.dueDate : '';
  document.getElementById('assignPriority').value = a ? a.priority : 'medium';
  const dl = document.getElementById('subjectList');
  const subjNames = [...new Set([...state.subjects.map(s=>s.name), ...state.classes.map(c=>c.subject)])];
  dl.innerHTML = subjNames.map(s=>`<option value="${escapeHtml(s)}">`).join('');
  openModal('assignModalOverlay');
}

document.getElementById('saveAssignBtn').addEventListener('click', ()=>{
  const title = document.getElementById('assignTitle').value.trim();
  if(!title){ alert('Please give the assignment a title.'); return; }
  const id = document.getElementById('assignId').value;
  const obj = {
    id: id || uid(),
    title,
    subject: document.getElementById('assignSubject').value.trim(),
    description: document.getElementById('assignDesc').value.trim(),
    dueDate: document.getElementById('assignDue').value,
    priority: document.getElementById('assignPriority').value,
    status: id ? (state.assignments.find(a=>a.id===id)?.status || 'pending') : 'pending'
  };
  if(id){
    const idx = state.assignments.findIndex(a=>a.id===id);
    if(idx>-1) state.assignments[idx]=obj;
  } else {
    state.assignments.push(obj);
  }
  saveData(); closeModal('assignModalOverlay'); renderAll();
});
function toggleAssignDone(id){
  const a = state.assignments.find(x=>x.id===id);
  if(!a) return;
  a.status = a.status === 'done' ? 'pending' : 'done';
  saveData(); renderAll();
}
function deleteAssign(id){
  if(!confirm('Delete this assignment?')) return;
  state.assignments = state.assignments.filter(a=>a.id!==id);
  saveData(); renderAll();
}

/* ---------------- ESCAPE HELPER ---------------- */
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ---------------- TIME HELPERS ---------------- */
function toMinutes(t){ const [h,m]=t.split(':').map(Number); return h*60+m; }
function fmtTime(t){
  if(!t) return '';
  const [h,m] = t.split(':').map(Number);
  const ampm = h>=12 ? 'PM':'AM';
  const h12 = h%12===0?12:h%12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}
function classesForDay(dayName){
  return state.classes.filter(c=>c.day===dayName).sort((a,b)=>toMinutes(a.start)-toMinutes(b.start));
}

/* ---------------- RENDER: DASHBOARD ---------------- */
function renderDashboard(){
  const now = new Date();
  const todayName = DAYS[now.getDay()];
  const tomorrowName = DAYS[(now.getDay()+1)%7];
  const todays = classesForDay(todayName);
  const tomorrows = classesForDay(tomorrowName);
  const nowMin = now.getHours()*60+now.getMinutes();

  document.getElementById('todayDateLabel').textContent = now.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
  tickClock();

  document.getElementById('statTodayCount').textContent = todays.length;
  document.getElementById('statTodayFoot').textContent = todays.length ? `${todays.length} class${todays.length>1?'es':''} today` : 'no classes scheduled';
  document.getElementById('statSubjects').textContent = new Set(state.classes.map(c=>c.subject)).size;

  // attendance %
  let totalConducted=0, totalAttended=0;
  Object.values(state.attendance).forEach(recs=>{
    recs.forEach(r=>{ totalConducted++; if(r.status==='present') totalAttended++; });
  });
  document.getElementById('statAttendance').textContent = totalConducted ? Math.round(totalAttended/totalConducted*100)+'%' : '—';

  const pending = state.assignments.filter(a=>a.status!=='done');
  const overdue = pending.filter(a=>a.dueDate && a.dueDate < todayISO());
  document.getElementById('statAssignments').textContent = pending.length;
  document.getElementById('statAssignFoot').textContent = overdue.length ? `${overdue.length} overdue` : 'nothing overdue';
  document.getElementById('statAssignFoot').style.color = overdue.length ? 'var(--red)' : '';

  // timeline
  const tl = document.getElementById('todayTimeline');
  tl.innerHTML = '';
  if(todays.length===0){
    tl.innerHTML = '<div class="empty-note">No classes today — nothing on the timeline.</div>';
  } else {
    tl.innerHTML = '<div class="timeline-rail"></div>';
    let nextClass = null;
    todays.forEach(c=>{
      const s=toMinutes(c.start), e=toMinutes(c.end);
      let cls='';
      if(nowMin>=s && nowMin<e) cls='current';
      else if(nowMin>=e) cls='done';
      else if(!nextClass && nowMin<s) nextClass=c;
      const {name, code} = splitSubjectCode(c.subject);
      tl.innerHTML += `
        <div class="tl-item ${cls}">
          <div class="tl-time">${fmtTime(c.start)}</div>
          <div class="tl-dot"></div>
          <div class="tl-card">
            <div class="tl-subject">${escapeHtml(name)}${cls==='current'?'<span class="tl-badge">now</span>':''}</div>
            <div class="tl-meta">${code?escapeHtml(code)+' · ':''}${escapeHtml(c.room||'—')}${c.faculty?' · '+escapeHtml(c.faculty):''} · ${fmtTime(c.start)}–${fmtTime(c.end)}</div>
          </div>
        </div>`;
    });
    // now-line position
    const first = toMinutes(todays[0].start), last = toMinutes(todays[todays.length-1].end);
    if(nowMin>=first-30 && nowMin<=last+30){
      const span = Math.max(last-first, 1);
      const pct = Math.min(Math.max((nowMin-first)/span,0),1)*100;
      const line = document.createElement('div');
      line.className='now-line'; line.setAttribute('data-time', now.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}));
      line.style.top = pct+'%';
      tl.appendChild(line);
    }
    // next class card
    if(nextClass){
      const mins = toMinutes(nextClass.start)-nowMin;
      const {name, code} = splitSubjectCode(nextClass.subject);
      document.getElementById('nextClassBody').innerHTML = `
        <div class="next-class-name">${escapeHtml(name)}</div>
        <div class="next-class-meta">${code?escapeHtml(code)+' · ':''}${escapeHtml(nextClass.room||'—')}${nextClass.faculty?' · '+escapeHtml(nextClass.faculty):''}<br>${fmtTime(nextClass.start)} – ${fmtTime(nextClass.end)}</div>
        <div class="countdown">in ${mins<60?mins+' min':Math.floor(mins/60)+'h '+(mins%60)+'m'}</div>`;
    } else {
      const current = todays.find(c=>{const s=toMinutes(c.start),e=toMinutes(c.end);return nowMin>=s&&nowMin<e;});
      if(current){
        const {name, code} = splitSubjectCode(current.subject);
        document.getElementById('nextClassBody').innerHTML = `
          <div class="next-class-name">${escapeHtml(name)} is in progress</div>
          <div class="next-class-meta">${code?escapeHtml(code)+' · ':''}${escapeHtml(current.room||'—')}${current.faculty?' · '+escapeHtml(current.faculty):''}<br>ends at ${fmtTime(current.end)}</div>`;
      } else {
        document.getElementById('nextClassBody').innerHTML = `<div class="next-class-name">No more classes today</div><div class="next-class-meta">You're done for the day.</div>`;
      }
    }
  }

  // tomorrow mini
  const tomBox = document.getElementById('tomorrowMini');
  tomBox.innerHTML = tomorrows.length ? tomorrows.map(c=>{
    const {name, code} = splitSubjectCode(c.subject);
    return `<div class="assign-mini"><div>
        <div class="assign-mini-title">${escapeHtml(name)}</div>
        <div class="assign-mini-sub">${fmtTime(c.start)}${code?' · '+escapeHtml(code):''} · ${escapeHtml(c.room||'—')}</div>
      </div></div>`;
  }).join('') : '<div class="empty-note">Nothing scheduled.</div>';

  // due soon mini
  const dueSoon = state.assignments.filter(a=>a.status!=='done').sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')).slice(0,4);
  const dueBox = document.getElementById('dueSoonMini');
  dueBox.innerHTML = dueSoon.length ? dueSoon.map(a=>{
    const overdue = a.dueDate && a.dueDate < todayISO();
    const color = {high:'var(--red)',medium:'var(--amber)',low:'var(--teal)'}[a.priority];
    return `<div class="assign-mini"><div>
        <div class="assign-mini-title"><span class="priority-dot" style="background:${color}"></span>${escapeHtml(a.title)}</div>
        <div class="assign-mini-sub" style="${overdue?'color:var(--red);font-weight:600;':''}">${a.dueDate? (overdue?'overdue · ':'due ')+a.dueDate : 'no due date'}</div>
      </div></div>`;
  }).join('') : '<div class="empty-note">All caught up.</div>';
}

function todayISO(){ const d=new Date(); return d.toISOString().slice(0,10); }

// Splits a subject string like "Organization Behaviour-I (BBA201)" into its name
// and code, so the dashboard can show Name · Code · Room clearly instead of one blob.
function splitSubjectCode(subj){
  const m = String(subj||'').match(/^(.*)\s\(([^)]+)\)\s*$/);
  return m ? {name:m[1].trim(), code:m[2].trim()} : {name:String(subj||''), code:''};
}

/* ---------------- RENDER: TIMETABLE ---------------- */
function renderTimetable(){
  const body = document.getElementById('ttTableBody');
  const sorted = [...state.classes].sort((a,b)=> DAYS.indexOf(a.day)-DAYS.indexOf(b.day) || toMinutes(a.start)-toMinutes(b.start));
  document.getElementById('ttEmpty').style.display = sorted.length ? 'none' : 'block';
  document.getElementById('ttTable').style.display = sorted.length ? 'table' : 'none';
  body.innerHTML = sorted.map(c=>`
    <tr>
      <td><span class="day-chip">${c.day.slice(0,3)}</span></td>
      <td class="mono">${fmtTime(c.start)}–${fmtTime(c.end)}</td>
      <td>${escapeHtml(c.subject)}</td>
      <td>${escapeHtml(c.faculty||'—')}</td>
      <td>${escapeHtml(c.room||'—')}</td>
      <td style="white-space:nowrap;">
        <button class="icon-btn" onclick='openClassModal(${JSON.stringify(c).replace(/'/g,"&#39;")})' title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="icon-btn" onclick="deleteClass('${c.id}')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    </tr>`).join('');
}

/* ---------------- RENDER: ATTENDANCE ---------------- */
function renderAttendance(){
  const subjects = [...new Set(state.classes.map(c=>c.subject))];
  document.getElementById('attendMonthLabel').textContent = new Date().toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const list = document.getElementById('attendList');
  if(subjects.length===0){
    document.getElementById('attendEmpty').style.display='block';
    list.innerHTML=''; return;
  }
  document.getElementById('attendEmpty').style.display='none';
  list.innerHTML = subjects.map(subj=>{
    const recs = state.attendance[subj] || [];
    const conducted = recs.length;
    const attended = recs.filter(r=>r.status==='present').length;
    const missed = conducted - attended;
    const pct = conducted ? Math.round(attended/conducted*100) : 100;
    const low = pct < 75 && conducted>0;
    return `
      <div class="attend-row">
        <div>
          <div class="attend-subject">${escapeHtml(subj)}</div>
          <div class="attend-nums">${conducted} conducted · ${attended} attended · ${missed} missed</div>
          ${low ? `<div class="attend-warning">⚠ Below 75% minimum requirement</div>` : ''}
          <div class="bar-track" style="margin-top:8px;"><div class="bar-fill ${low?'low':''}" style="width:${pct}%;"></div></div>
        </div>
        <div class="attend-pct ${low?'low':''}">${conducted?pct+'%':'—'}</div>
      </div>`;
  }).join('');
}

/* ---------------- RENDER: ASSIGNMENTS ---------------- */
function renderAssignments(){
  const list = document.getElementById('assignList');
  const sorted = [...state.assignments].sort((a,b)=>{
    if(a.status!==b.status) return a.status==='done'?1:-1;
    return (a.dueDate||'9999').localeCompare(b.dueDate||'9999');
  });
  document.getElementById('assignEmpty').style.display = sorted.length?'none':'block';
  list.innerHTML = sorted.map(a=>{
    const overdue = a.status!=='done' && a.dueDate && a.dueDate < todayISO();
    return `
      <div class="assign-card ${overdue?'overdue':''}">
        <button class="assign-check ${a.status==='done'?'done':''}" onclick="toggleAssignDone('${a.id}')"></button>
        <div class="assign-body">
          <div class="assign-title ${a.status==='done'?'done':''}">${escapeHtml(a.title)}</div>
          ${a.description?`<div class="assign-desc">${escapeHtml(a.description)}</div>`:''}
          <div class="assign-tags">
            ${a.subject?`<span class="tag-chip">${escapeHtml(a.subject)}</span>`:''}
            ${a.dueDate?`<span class="tag-chip ${overdue?'overdue-tag':''}">${overdue?'overdue · ':'due '}${a.dueDate}</span>`:''}
            <span class="tag-chip ${a.priority}">${a.priority} priority</span>
          </div>
        </div>
        <button class="icon-btn" onclick='openAssignModal(${JSON.stringify(a).replace(/'/g,"&#39;")})' title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="icon-btn" onclick="deleteAssign('${a.id}')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>`;
  }).join('');
}

function renderAll(){
  renderDashboard(); renderSubjects(); renderTimetable(); renderAttendance(); renderAssignments();
}

/* ---------------- GLOBAL SEARCH ---------------- */
document.getElementById('globalSearch').addEventListener('input', e=>{
  const q = e.target.value.trim().toLowerCase();
  const box = document.getElementById('searchResults');
  if(!q){ box.style.display='none'; return; }
  const classHits = state.classes.filter(c=>[c.subject,c.faculty,c.room,c.day].some(v=>(v||'').toLowerCase().includes(q)));
  const assignHits = state.assignments.filter(a=>[a.title,a.subject,a.description].some(v=>(v||'').toLowerCase().includes(q)));
  box.style.display='block';
  if(classHits.length===0 && assignHits.length===0){
    box.innerHTML = `<div class="empty-note">No matches for "${escapeHtml(e.target.value)}".</div>`;
    return;
  }
  let html='';
  if(classHits.length){
    html += `<h3 style="font-size:13px;margin:0 0 8px;">Classes</h3>`;
    html += classHits.map(c=>`<div class="assign-mini"><div>
      <div class="assign-mini-title">${escapeHtml(c.subject)}</div>
      <div class="assign-mini-sub">${c.day} · ${fmtTime(c.start)} · ${escapeHtml(c.faculty||'—')} · ${escapeHtml(c.room||'—')}</div>
    </div></div>`).join('');
  }
  if(assignHits.length){
    html += `<h3 style="font-size:13px;margin:14px 0 8px;">Assignments</h3>`;
    html += assignHits.map(a=>`<div class="assign-mini"><div>
      <div class="assign-mini-title">${escapeHtml(a.title)}</div>
      <div class="assign-mini-sub">${escapeHtml(a.subject||'')} ${a.dueDate?'· due '+a.dueDate:''}</div>
    </div></div>`).join('');
  }
  box.innerHTML = html;
});

/* ---------------- NOTIFICATIONS ---------------- */
// Mobile browsers (Android Chrome and most others) refuse to run
// `new Notification(...)` called directly from the page — they require a
// service worker and registration.showNotification() instead. This registers
// sw.js (must sit next to this HTML file on the server) and falls back to the
// plain constructor for desktop browsers that still allow it.
let swRegistration = null;
function setNotifDiagnostic(text){
  const el = document.getElementById('notifDiagnostic');
  if(el) el.textContent = text;
}
async function initServiceWorker(){
  if(!('serviceWorker' in navigator)){
    setNotifDiagnostic('This browser has no serviceWorker support at all — notifications cannot work here.');
    return;
  }
  try{
    swRegistration = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
     
  }catch(e){
    console.warn('Service worker registration failed:', e);
    swRegistration = null;
    setNotifDiagnostic('Service worker FAILED to register: ' + e.message + ' — check that sw.js is uploaded in the same folder as this page and reachable at ' + location.href.replace(/[^/]*$/,'') + 'sw.js');
  }
}
initServiceWorker();

function showAppNotification(title, options){
  if(!('Notification' in window)){ setNotifDiagnostic('This browser has no Notification API at all.'); return; }
  if(Notification.permission !== 'granted'){ setNotifDiagnostic('Permission is "' + Notification.permission + '", not granted — notifications are blocked.'); return; }
  if(swRegistration && swRegistration.showNotification){
    swRegistration.showNotification(title, options)
      .then(()=> setNotifDiagnostic('Sent via service worker OK just now.'))
      .catch(e=> setNotifDiagnostic('Service worker showNotification() failed: ' + e.message));
  } else {
    try{
      new Notification(title, options);
      setNotifDiagnostic('Sent via new Notification() directly (no service worker) just now.');
    }
    catch(e){ setNotifDiagnostic('Notification blocked: ' + e.message + ' — this browser needs a working service worker and none is registered.'); }
  }
}

function updateNotifBanner(){
  const askBanner = document.getElementById('notifBanner');
  const deniedBanner = document.getElementById('notifDeniedBanner');
  const testBanner = document.getElementById('notifTestBanner');
  askBanner.style.display='none'; deniedBanner.style.display='none'; testBanner.style.display='none';
  if(!('Notification' in window)){ return; }
  if(Notification.permission === 'granted') testBanner.style.display='flex';
  else if(Notification.permission === 'denied') deniedBanner.style.display='flex';
  else askBanner.style.display='flex';
}
document.getElementById('enableNotifBtn').addEventListener('click', ()=>{
  if('Notification' in window) Notification.requestPermission().then(updateNotifBanner);
});
document.getElementById('testNotifBtn').addEventListener('click', ()=>{
  showAppNotification('Test notification', { body: 'If you can see this, notifications are working correctly.' });
  showToast({ title:'Test: sample class starting', sub:'Are you present or absent?', onPresent:()=>{}, onAbsent:()=>{} });
});
updateNotifBanner();
if('Notification' in window && Notification.permission === 'default'){
  Notification.requestPermission().then(updateNotifBanner);
}

function showToast({title, sub, onPresent, onAbsent}){
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className='toast';
  el.innerHTML = `
    <div class="toast-title">${escapeHtml(title)}</div>
    <div class="toast-sub">${escapeHtml(sub)}</div>
    <div class="toast-actions">
      <button class="toast-btn present">Present</button>
      <button class="toast-btn absent">Absent</button>
    </div>`;
  el.querySelector('.present').addEventListener('click', ()=>{ onPresent(); el.remove(); });
  el.querySelector('.absent').addEventListener('click', ()=>{ onAbsent(); el.remove(); });
  stack.appendChild(el);
  setTimeout(()=>{ if(el.parentNode) el.remove(); }, 90000);
}

function recordAttendance(cls, status){
  if(!state.attendance[cls.subject]) state.attendance[cls.subject]=[];
  state.attendance[cls.subject].push({ date: todayISO(), status });
  saveData(); renderAll();
}

function checkNotifications(){
  const now = new Date();
  const todayName = DAYS[now.getDay()];
  const nowMin = now.getHours()*60+now.getMinutes();
  const todayKey = todayISO();
  classesForDay(todayName).forEach(c=>{
    const startMin = toMinutes(c.start);
    const reminderKey = `${c.id}_${todayKey}_reminder`;
    const startKey = `${c.id}_${todayKey}_start`;

    if(startMin-15===nowMin && !state.notifiedLog[reminderKey]){
      state.notifiedLog[reminderKey]=true; saveData();
      showAppNotification('Class in 15 minutes', { body: `${c.subject} · ${c.room||''}` });
    }
    if(startMin===nowMin && !state.notifiedLog[startKey]){
      state.notifiedLog[startKey]=true; saveData();
      showAppNotification(`${c.subject} is starting`, { body: 'Are you present or absent?' });
      showToast({
        title: `${c.subject} just started`,
        sub: 'Are you present or absent?',
        onPresent: ()=>recordAttendance(c,'present'),
        onAbsent: ()=>recordAttendance(c,'absent')
      });
    }
  });
}
setInterval(checkNotifications, 20000);
setInterval(renderDashboard, 20000); // keep live clock / current class in sync

// High-priority assignments repeat-notify (roughly hourly) while the app is
// open and they're still not marked done — medium/low priority stay silent
// here and just show in the Assignments list instead.
function checkAssignmentReminders(){
  const now = Date.now();
  const REPEAT_MS = 60*60*1000; // once per hour per assignment
  state.assignments.forEach(a=>{
    if(a.status==='done' || a.priority!=='high') return;
    const key = `assignRemind_${a.id}`;
    const last = state.notifiedLog[key] || 0;
    if(now - last < REPEAT_MS) return;
    state.notifiedLog[key] = now; saveData();
    const overdue = a.dueDate && a.dueDate < todayISO();
    showAppNotification(`⏰ High priority: ${a.title}`, {
      body: overdue ? `Overdue${a.subject?' · '+a.subject:''}` : `${a.dueDate?'Due '+a.dueDate:'No due date'}${a.subject?' · '+a.subject:''}`,
      tag: key // replaces the previous notification with this same tag instead of stacking
    });
  });
}
checkAssignmentReminders();
setInterval(checkAssignmentReminders, 5*60*1000); // check every 5 min; each assignment still only fires ~hourly

/* ---------------- FILE IMPORT (PDF / EXCEL / CSV) ---------------- */
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
uploadZone.addEventListener('click', ()=>fileInput.click());
uploadZone.addEventListener('dragover', e=>{ e.preventDefault(); uploadZone.classList.add('drag'); });
uploadZone.addEventListener('dragleave', ()=>uploadZone.classList.remove('drag'));
uploadZone.addEventListener('drop', e=>{
  e.preventDefault(); uploadZone.classList.remove('drag');
  if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); });

let importedRows = [];

function handleFile(file){
  const status = document.getElementById('importStatus');
  if(state.subjects.length === 0){
    status.innerHTML = `Tip: add your subjects first (<a href="#" onclick="switchView('subjects');return false;" style="color:var(--teal-deep);text-decoration:underline;">go to Subjects →</a>) and Lecture will pre-select matching classes for you. Reading your file now either way…`;
  } else {
    status.textContent = `Reading ${file.name}…`;
  }
  const ext = file.name.split('.').pop().toLowerCase();

  if(ext==='csv'){
    const reader = new FileReader();
    reader.onload = e=>{ parseTableText(e.target.result); status.textContent=''; };
    reader.readAsText(file);
  } else if(ext==='xlsx' || ext==='xls'){
    if(typeof XLSX === 'undefined'){ status.textContent='Excel reader not available offline — try adding classes manually below.'; return; }
    const reader = new FileReader();
    reader.onload = e=>{
      const wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
      if(wb.SheetNames.length > 1){
        openSheetPicker(wb, status);
      } else {
        status.textContent = `Reading sheet "${wb.SheetNames[0]}"…`;
        processWorkbookSheets(wb, wb.SheetNames, status);
      }
    };
    reader.readAsArrayBuffer(file);
  } else if(['jpg','jpeg','png','webp'].includes(ext)){
    const reader = new FileReader();
    reader.onload = async e=>{
      const dataUrl = e.target.result;
      if(state.settings.openRouterKey){
        status.textContent = 'Asking AI to read your photo… this can take a moment.';
        try{
          const rows = await aiExtractRowsMultiModel('image', dataUrl, status);
          if(!rows.length){ status.textContent = "The AI couldn't find any classes in that photo. Try a clearer photo, or add classes manually below."; return; }
          status.textContent = `AI found ${rows.length} possible classes — review below before saving.`;
          openReviewModal(rows);
        }catch(err){
          console.error(err);
          status.textContent = 'AI reading failed ('+err.message+'). Falling back to on-device OCR…';
          await ocrFallback(dataUrl, status);
        }
      } else {
        await ocrFallback(dataUrl, status);
      }
    };
    reader.readAsDataURL(file);
  } else if(ext==='pdf'){
    if(typeof pdfjsLib === 'undefined'){ status.textContent='PDF reader not available offline — try adding classes manually below.'; return; }
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const reader = new FileReader();
    reader.onload = async e=>{
      let pdf;
      try{
        pdf = await pdfjsLib.getDocument({data: new Uint8Array(e.target.result)}).promise;
      }catch(err){
        console.error(err);
        status.textContent = "Couldn't open that PDF — it may be corrupted or password-protected. Try adding classes manually below.";
        return;
      }
      let text='';
      try{
        for(let i=1;i<=pdf.numPages;i++){
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(it=>it.str).join(' ') + '\n';
        }
      }catch(err){ console.error(err); }
      const looksScanned = text.replace(/\s/g,'').length < 40; // almost no extractable text = likely a scanned/image PDF

      if(state.settings.openRouterKey){
        try{
          let rows;
          if(!looksScanned){
            status.textContent = 'Asking 3 free AI models to read the PDF text in parallel…';
            rows = await aiExtractRowsMultiModel('text', text, status);
          } else {
            status.textContent = 'This PDF looks scanned — rendering pages as images for the AI…';
            const pagesToRead = Math.min(pdf.numPages, 5);
            rows = [];
            for(let i=1;i<=pagesToRead;i++){
              const imgUrl = await renderPdfPageToDataURL(pdf, i);
              status.textContent = `Reading page ${i} of ${pagesToRead} with 3 free models in parallel…`;
              const pageRows = await aiExtractRowsMultiModel('image', imgUrl, status);
              rows = rows.concat(pageRows);
            }
          }
          if(!rows.length){ status.textContent = "The AI couldn't find any classes in that PDF. Try adding classes manually below."; return; }
          status.textContent = `AI found ${rows.length} possible classes — review below before saving.`;
          openReviewModal(rows);
        }catch(err){
          console.error(err);
          status.textContent = 'AI reading failed ('+err.message+'). Falling back to local text parsing…';
          parsePdfText(text);
        }
      } else if(looksScanned){
        status.textContent = "This PDF looks like a scanned image — local text extraction can't read it. Add an OpenRouter key above for AI reading, or add classes manually below.";
      } else {
        parsePdfText(text);
        status.textContent='';
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    status.textContent = 'Unsupported file type. Please use PDF, Excel (.xlsx), CSV, or a photo (.jpg/.png).';
  }
}

// On-device OCR fallback (used when no OpenRouter key is set, or AI reading fails)
async function ocrFallback(dataUrl, status){
  if(typeof Tesseract === 'undefined'){ status.textContent='On-device photo reading is not available right now. Add a free OpenRouter key above for AI reading instead, or add classes manually below.'; return; }
  status.textContent = 'Reading text from your photo on-device… this can take a moment.';
  try{
    const { data: { text } } = await Tesseract.recognize(dataUrl, 'eng');
    parsePdfText(text);
    if(document.getElementById('importStatus').textContent.startsWith('Reading')) status.textContent='';
  }catch(err){
    console.error(err);
    status.textContent = "Couldn't read that photo clearly — try a sharper, well-lit photo, add an OpenRouter key above for AI reading, or add classes manually below.";
  }
}

// Render a PDF page to a PNG data URL (used to send scanned PDF pages to a vision model)
async function renderPdfPageToDataURL(pdf, pageNum, scale=1.6){
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({scale});
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width; canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({canvasContext:ctx, viewport}).promise;
  return canvas.toDataURL('image/png');
}

// The 3 free OpenRouter models Lecture cross-checks against each other for photo/PDF reading
const FREE_MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
];

// Send an image or raw text to a free OpenRouter vision/text model and get back
// structured class rows. Your API key is read from local storage and sent directly
// from this browser to openrouter.ai — nothing passes through any server of ours.
async function aiExtractRows(kind, payload, model){
  const key = state.settings.openRouterKey;
  model = model || FREE_MODELS[0];
  if(!key) throw new Error('No OpenRouter API key set');
  const instructions = `You extract class timetable entries from ${kind==='image' ? 'a photo or scan of a college timetable' : 'raw text extracted from a college timetable PDF'}. Return ONLY a JSON array (no markdown fences, no commentary, no explanation) of objects, one per class slot, with exactly these keys: "day" (full weekday name, e.g. "Monday"), "start" (24-hour "HH:MM"), "end" (24-hour "HH:MM"), "subject" (string), "faculty" (string, empty string if unknown), "room" (string, empty string if unknown), "batch" (string like "P1", "P3", "T2" if this slot names a parallel practical/tutorial batch, else empty string). If a single time slot contains several stacked parallel classes (different batches or elective choices), output a separate object for each one — do not merge them. Do not invent information that isn't visible.`;
  const userContent = kind==='image'
    ? [ {type:'text', text: instructions}, {type:'image_url', image_url:{url: payload}} ]
    : [ {type:'text', text: instructions + '\n\nTimetable text:\n' + String(payload).slice(0, 12000)} ];

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
      'HTTP-Referer': location.href,
      'X-Title': 'Lecture — Timetable Assistant'
    },
    body: JSON.stringify({
      model,
      messages: [{ role:'user', content: userContent }],
      temperature: 0.1
    })
  });
  if(!resp.ok){
    let detail = '';
    try{ detail = (await resp.json()).error?.message || ''; }catch(e){}
    throw new Error(`OpenRouter ${resp.status}${detail? ': '+detail : ''}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  const match = content.match(/\[[\s\S]*\]/);
  if(!match) throw new Error('The model did not return a recognizable list of classes');
  let raw;
  try{ raw = JSON.parse(match[0]); }catch(e){ throw new Error('Could not parse the model\'s response as JSON'); }

  const rows = raw.map(r=>{
    const day = DAYS.find(d=>d.toLowerCase().startsWith(String(r.day||'').toLowerCase().slice(0,3))) || 'Monday';
    const rawText = `${r.subject||''} ${r.faculty||''} ${r.room||''} ${r.batch||''}`;
    return {
      id: uid(), day,
      start: normalizeTime(r.start) || (/^\d{1,2}:\d{2}$/.test(String(r.start||''))? r.start : '09:00'),
      end: normalizeTime(r.end) || (/^\d{1,2}:\d{2}$/.test(String(r.end||''))? r.end : '10:00'),
      subject: (r.subject || 'Untitled subject') + (r.batch ? ` (${r.batch})` : ''),
      faculty: r.faculty || '',
      room: r.room || '',
      _raw: rawText,
      _model: model,
      _source: 'ai'
    };
  });

  rows.forEach(r=> delete r._raw);
  return rows;
}

// Runs all 3 free models on the same image/text at the same time, then merges their
// answers: identical classes found by more than one model are combined into a single
// chip (marked "✓ N models agree"), and each row is checked against your saved
// subjects so matching classes are pre-selected in the review grid.
async function aiExtractRowsMultiModel(kind, payload, status){
  if(status) status.textContent = `Asking ${FREE_MODELS.length} free AI models to read this in parallel…`;
  const settled = await Promise.allSettled(FREE_MODELS.map(m => aiExtractRows(kind, payload, m)));
  let combined = [];
  let okCount = 0;
  let lastError = null;
  settled.forEach((res, i)=>{
    if(res.status === 'fulfilled'){ okCount++; combined = combined.concat(res.value); }
    else { lastError = res.reason; console.warn('Model failed:', FREE_MODELS[i], res.reason); }
  });
  if(okCount === 0) throw (lastError || new Error('All 3 models failed to respond'));
  return combined;
}

// Excel merges a class that visually spans several stacked rows/columns into one
// cell — only the top-left cell keeps the value, the rest come back blank. This
// copies that value into every cell of the merged range so nothing goes missing.
// Shows every sheet name in the workbook as a tappable row, plus an "All sheets
// combined" option, so a big master file doesn't get parsed all at once by default.
function openSheetPicker(wb, status){
  const list = document.getElementById('sheetPickerList');
  const rowHtml = name => `
    <button class="pill-btn ghost" style="display:flex;width:100%;justify-content:flex-start;margin-bottom:8px;" data-sheet="${escapeHtml(name)}">
      ${escapeHtml(name)}
    </button>`;
  list.innerHTML = wb.SheetNames.map(rowHtml).join('') +
    `<button class="pill-btn" style="display:flex;width:100%;justify-content:center;margin-top:6px;" id="sheetPickerAllBtn">All sheets combined</button>`;
  list.querySelectorAll('button[data-sheet]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      closeModal('sheetPickerModalOverlay');
      status.textContent = `Reading sheet "${btn.dataset.sheet}"…`;
      processWorkbookSheets(wb, [btn.dataset.sheet], status);
    });
  });
  document.getElementById('sheetPickerAllBtn').addEventListener('click', ()=>{
    closeModal('sheetPickerModalOverlay');
    status.textContent = `Reading all ${wb.SheetNames.length} sheets…`;
    processWorkbookSheets(wb, wb.SheetNames, status);
  });
  openModal('sheetPickerModalOverlay');
}

// Parses only the given sheet name(s) from the workbook — merged cells (used to
// make one class visually span several stacked rows/columns) are expanded first,
// so every cell holds its real value instead of coming back blank.
function processWorkbookSheets(wb, sheetNames, status){
  const sheetRows = sheetNames.map(name=>{
    const sheet = wb.Sheets[name];
    const rows2d = XLSX.utils.sheet_to_json(sheet, {header:1, defval:''});
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    expandMergedCells(rows2d, sheet['!merges']||[], range.s.c, range.s.r);
    return rows2d;
  });
  // Build one combined legend (Subject Code / Name / Faculty abbreviations) from
  // whichever sheet(s) have that table, so every sheet's classes can use it.
  const legend = { byCode:{}, facultyByAbbv:{} };
  sheetRows.forEach(rows2d=>{
    const l = parseLegendTable(rows2d);
    Object.assign(legend.byCode, l.byCode);
    Object.assign(legend.facultyByAbbv, l.facultyByAbbv);
  });
  let allParsed = [];
  let anyGridFound = false;
  sheetRows.forEach(rows2d=>{
    const gridRows = parseGridRows2D(rows2d, legend);
    if(gridRows){ anyGridFound = true; allParsed = allParsed.concat(gridRows); }
  });
  if(anyGridFound){
    const legendNote = Object.keys(legend.byCode).length ? ` Matched against the subject/faculty legend table too.` : '';
    status.textContent = `Read ${sheetNames.length} sheet(s) as a grid — found ${allParsed.length} possible classes.${legendNote}`;
    if(allParsed.length===0){ status.textContent = "Found a timetable grid but no classes in it — try adding classes manually below."; return; }
    openReviewModal(allParsed);
  } else {
    // Not grid-shaped — fall back to the flat text reader
    let combined = '';
    sheetNames.forEach(nm=> combined += XLSX.utils.sheet_to_csv(wb.Sheets[nm]) + '\n');
    status.textContent = `Read ${sheetNames.length} sheet(s) — parsing…`;
    parseTableText(combined);
  }
}

// sheet_to_json's array index 0 is NOT always Excel column A — if a
// sheet's real used range starts later (e.g. "!ref" is "B1:L1000" because column A
// is entirely empty), array index 0 actually represents column B. But "!merges"
// coordinates are always absolute (column A = 0), so they must be shifted by the
// range's starting column/row before being used as array indices — otherwise every
// merged value (day labels, single classes spanning a tall stacked-row block) gets
// written one column off, and rows that should match a day silently get skipped.
function expandMergedCells(rows2d, merges, colOffset=0, rowOffset=0){
  merges.forEach(m=>{
    const sr = m.s.r - rowOffset, sc = m.s.c - colOffset, er = m.e.r - rowOffset, ec = m.e.c - colOffset;
    const val = (rows2d[sr] || [])[sc];
    if(val === undefined || val === '' || val === null) return;
    for(let r=sr; r<=er; r++){
      if(!rows2d[r]) rows2d[r] = [];
      for(let c=sc; c<=ec; c++){
        if(r===sr && c===sc) continue;
        rows2d[r][c] = val;
      }
    }
  });
}

const TIME_RANGE_RE = /\b(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})\b/;

// The real header row (e.g. "8:00-9:00 … 5:00-6:00") usually isn't row 1 — there
// are title/banner rows above it. Scan the first ~25 rows and pick whichever one
// has the most cells that look like a time range.
function findHeaderRowIndex(rows2d){
  let bestIdx = -1, bestCount = 0;
  const scanLimit = Math.min(rows2d.length, 25);
  for(let r=0; r<scanLimit; r++){
    const count = (rows2d[r]||[]).filter(c=> TIME_RANGE_RE.test(String(c||''))).length;
    if(count > bestCount){ bestCount = count; bestIdx = r; }
  }
  return bestCount >= 2 ? bestIdx : -1;
}

// Timetable headers are usually written without AM/PM ("12:00-1:00", "1:00-2:00" …)
// since they just keep increasing through the day. This walks the columns left to
// right and bumps each hour by 12 whenever it would otherwise go backwards, so
// "1:00" after "12:00" correctly becomes 13:00 (1 PM) instead of 1 AM.
function resolveSequentialTimeColumns(header, timeColIdx){
  let prevHour = null;
  const resolved = {};
  timeColIdx.forEach(ci=>{
    const m = String(header[ci]||'').match(TIME_RANGE_RE);
    if(!m){ resolved[ci] = {start:'09:00', end:'10:00'}; return; }
    const nextHour = (raw)=>{ let h = raw % 12; while(prevHour !== null && h < prevHour) h += 12; prevHour = h; return h; };
    const startH = nextHour(parseInt(m[1],10));
    const startM = m[2] ? parseInt(m[2],10) : 0;
    const endH = nextHour(parseInt(m[3],10));
    const endM = m[4] ? parseInt(m[4],10) : 0;
    resolved[ci] = {
      start: String(startH).padStart(2,'0')+':'+String(startM).padStart(2,'0'),
      end: String(endH).padStart(2,'0')+':'+String(endM).padStart(2,'0')
    };
  });
  return resolved;
}

const NON_CLASS_LABELS = /^(break\s*time|activity\s*time|lunch\s*break|free\s*Lecture)$/i;
const normCode = c => String(c||'').replace(/\s+/g,'').toUpperCase();

// Reads the legend/abbreviation table many timetables print below the grid itself:
// Subject Code | Subject Name | Nature | Abbv. | Faculty | Abbv. — and builds lookup
// maps so class cells like "BBA207 SSPD PJ SEC.C P1 MB303" can be expanded into a
// real subject name and real faculty name instead of staying as raw short forms.
function parseLegendTable(rows2d){
  const legend = { byCode:{}, facultyByAbbv:{} };
  let headerIdx = -1;
  for(let r=0; r<rows2d.length; r++){
    if((rows2d[r]||[]).some(c => String(c||'').toLowerCase().includes('subject code'))){ headerIdx = r; break; }
  }
  if(headerIdx === -1) return legend;
  const header = (rows2d[headerIdx]||[]).map(c=>String(c||'').toLowerCase().trim());
  const codeCol = header.findIndex(h=>h.includes('subject code'));
  const nameCol = header.findIndex(h=>h.includes('subject name'));
  const facultyCol = header.findIndex(h=>h.includes('faculty'));
  const abbvCols = header.map((h,i)=> h.includes('abbv') ? i : -1).filter(i=>i>=0);
  const subjAbbvCol = abbvCols.find(i=> facultyCol===-1 || i < facultyCol);
  const facultyAbbvCol = abbvCols.find(i=> facultyCol!==-1 && i > facultyCol);
  if(codeCol === -1) return legend;

  for(let r=headerIdx+1; r<rows2d.length; r++){
    const row = rows2d[r] || [];
    const code = String(row[codeCol]||'').trim();
    if(!code) continue;
    const name = nameCol>=0 ? String(row[nameCol]||'').trim() : '';
    const subjAbbv = subjAbbvCol!==undefined ? String(row[subjAbbvCol]||'').trim() : '';
    const facultyNames = facultyCol>=0 ? String(row[facultyCol]||'').split(',').map(s=>s.trim()).filter(Boolean) : [];
    const facultyAbbvs = facultyAbbvCol!==undefined ? String(row[facultyAbbvCol]||'').split(',').map(s=>s.trim()).filter(Boolean) : [];
    if(name) legend.byCode[normCode(code)] = { name, abbv: subjAbbv };
    facultyAbbvs.forEach((ab,i)=>{ if(ab) legend.facultyByAbbv[ab.toLowerCase()] = facultyNames[i] || facultyNames[0] || ab; });
  }
  return legend;
}

// Builds a regex for an abbreviation like "OB1" or "HRM2" that also matches the
// hyphenated form real timetables often use in the grid itself ("OB-1", "HRM-2").
function abbvToFlexibleRegex(abbv){
  const m = String(abbv||'').match(/^([A-Za-z]+)(\d+)$/);
  const body = m ? (m[1]+'[-\\s]?'+m[2]) : String(abbv||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('\\b'+body+'\\b','i');
}

// Turns a raw grid-cell entry like "BBA207 SSPD PJ SEC.C P1 MB303" into separate
// subject / faculty / room / batch fields, using the legend table to expand the
// subject code into its real name and the faculty initials into a real name.
function parseClassEntryText(entry, legend){
  let text = entry.trim();
  const batchMatch = text.match(/\b([PT][1-4])\b/i);
  const batch = batchMatch ? batchMatch[1].toUpperCase() : '';
  const codeMatch = text.match(/\b([A-Z]{2,6}\s?\d{2,4}[A-Z]?)\b/);
  const code = codeMatch ? normCode(codeMatch[1]) : '';
  const legendEntry = code ? legend.byCode[code] : null;

  let remaining = text;
  if(codeMatch) remaining = remaining.replace(codeMatch[0], ' ');
  if(legendEntry && legendEntry.abbv) remaining = remaining.replace(abbvToFlexibleRegex(legendEntry.abbv), ' ');
  if(batchMatch) remaining = remaining.replace(batchMatch[0], ' ');
  remaining = remaining.replace(/\bSEC\.?\s*[-:]?\s*[A-D]\b/gi, ' ');

  const tokens = remaining.split(/\s+/).map(t=>t.trim()).filter(Boolean);
  let room = '';
  for(let i=tokens.length-1; i>=0; i--){
    if(/\d/.test(tokens[i])){
      let start = i;
      if(start>0 && /lab/i.test(tokens[start-1])) start--; // e.g. "MBLAB 1" is one room name, not faculty+room
      room = tokens.slice(start).join(' ');
      tokens.splice(start);
      break;
    }
  }
  let facultyRaw = tokens.join(' ').trim();
  const faculty = legend.facultyByAbbv[facultyRaw.toLowerCase()] || facultyRaw;

  const subjectName = legendEntry ? legendEntry.name : (code || text);
  const subject = code ? `${subjectName} (${code})` : subjectName;
  return { subject, faculty, room, batch };
}

// Shared grid reader: days down the side (found anywhere in the row, since merged
// day cells only carry a value on their first row before expansion), fixed time
// columns across the top. Works for both Excel sheets (merge-expanded) and CSV/PDF
// text tables. Returns null if the input doesn't look grid-shaped at all, so the
// caller can fall back to flat-row reading instead. Nothing is filtered out here —
// every class in the sheet is returned; picking which ones are yours happens by
// tapping chips in the review grid.
function parseGridRows2D(rows2d, legend){
  legend = legend || { byCode:{}, facultyByAbbv:{} };
  const headerIdx = findHeaderRowIndex(rows2d);
  if(headerIdx === -1) return null;
  const header = rows2d[headerIdx];
  const timeColIdx = [];
  header.forEach((h,i)=>{ if(TIME_RANGE_RE.test(String(h||''))) timeColIdx.push(i); });
  const slots = resolveSequentialTimeColumns(header, timeColIdx);

  const parsed = [];
  for(let r=headerIdx+1; r<rows2d.length; r++){
    const row = rows2d[r] || [];
    const day = DAYS.find(d => row.some(c => String(c||'').trim() === d));
    if(!day) continue; // legend rows, signatures, blank separators — none of these equal a day name
    timeColIdx.forEach(ci=>{
      const cellRaw = String(row[ci]||'').trim();
      if(!cellRaw) return;
      const {start, end} = slots[ci];
      // a cell can hold several stacked parallel classes (P1/P2/P3, or an elective choice)
      cellRaw.split(/\n|\/(?=\s*[A-Z0-9])/).forEach(entry=>{
        entry = entry.trim();
        if(!entry || NON_CLASS_LABELS.test(entry)) return;
        const fields = parseClassEntryText(entry, legend);
        parsed.push({ id: uid(), day, start, end, ...fields, _source:'file', _raw: entry });
      });
    });
  }

  return parsed;
}

// Basic CSV/table parser: tries the real grid layout first, falls back to loosely
// reading Day / Start / End / Subject / Faculty / Room from flat rows.
function parseTableText(text){
  const lines = text.split(/\r?\n/);
  if(lines.every(l=>!l.trim())){ document.getElementById('importStatus').textContent='No rows found in that file.'; return; }
  const rows2d = lines.map(line=>line.split(/,|\t/).map(c=>c.trim().replace(/^"|"$/g,'')));
  const legend = parseLegendTable(rows2d);

  const gridRows = parseGridRows2D(rows2d, legend);
  let parsed;
  if(gridRows && gridRows.length){
    parsed = gridRows;
  } else {
    // Not grid-shaped — fall back to reading it as flat rows: Day, Start-End, Subject, Faculty, Room
    parsed = [];
    const nonBlank = rows2d.filter(r=>r.some(c=>c));
    const header = (nonBlank[0]||[]).map(c=>c.toLowerCase());
    let dataRows = nonBlank;
    if(header.some(h=>h.includes('day')||h.includes('subject')||h.includes('time'))) dataRows = nonBlank.slice(1);
    dataRows.forEach(cols=>{
      if(cols.length<2) return;
      const dayCol = cols.find(c=>DAYS.some(d=>d.toLowerCase().startsWith(c.toLowerCase().slice(0,3)))) || cols[0];
      const day = DAYS.find(d=>d.toLowerCase().startsWith((dayCol||'').toLowerCase().slice(0,3))) || 'Monday';
      const timeMatch = cols.join(' ').match(/(\d{1,2}:\d{2}\s?[APap]?[Mm]?)\s*[-–to]+\s*(\d{1,2}:\d{2}\s?[APap]?[Mm]?)/);
      const start = timeMatch ? normalizeTime(timeMatch[1]) : '';
      const end = timeMatch ? normalizeTime(timeMatch[2]) : '';
      const remaining = cols.filter(c=> c!==dayCol && !/\d{1,2}:\d{2}/.test(c));
      const raw = cols.join(' ');
      parsed.push({
        id: uid(), day,
        start: start||'09:00', end: end||'10:00',
        subject: remaining[0]||'Untitled subject',
        faculty: remaining[1]||'', room: remaining[2]||'', _source:'file', _raw: raw
      });
    });
  }
  if(parsed.length===0){ document.getElementById('importStatus').textContent="Couldn't find any classes in that file — try adding classes manually below."; return; }
  openReviewModal(parsed);
}

// Loose parser for raw PDF text (best-effort — everything still goes through the tap-to-select grid before saving)
function parsePdfText(text){
  const dayPattern = DAYS.map(d=>d.slice(0,3)).join('|');
  const re = new RegExp(`(${dayPattern})[a-z]*[:\\-\\s]+(.*?)(?=(${dayPattern})[a-z]*[:\\-\\s]|$)`,'gis');
  const parsed = [];
  let match;
  while((match = re.exec(text)) !== null){
    const dayAbbr = match[1];
    const day = DAYS.find(d=>d.toLowerCase().startsWith(dayAbbr.toLowerCase()));
    const chunk = match[2];
    const timeRe = /(\d{1,2}:\d{2}\s?[APap]?[Mm]?)\s*[-–to]+\s*(\d{1,2}:\d{2}\s?[APap]?[Mm]?)\s*([^0-9]+?)(?=\d{1,2}:\d{2}|$)/g;
    let tm;
    while((tm = timeRe.exec(chunk)) !== null){
      const rest = tm[3].trim().split(/\s{2,}|,|;/).map(s=>s.trim()).filter(Boolean);
      parsed.push({
        id: uid(), day: day||'Monday',
        start: normalizeTime(tm[1]), end: normalizeTime(tm[2]),
        subject: rest[0] || 'Untitled subject', faculty: rest[1]||'', room: rest[2]||'', _source:'file', _raw: tm[0]
      });
    }
  }
  if(parsed.length===0){
    document.getElementById('importStatus').textContent = "Couldn't find any classes in that PDF — check the file isn't a scanned image (use AI reading above for those), or add classes manually below.";
    return;
  }
  openReviewModal(parsed);
}

function normalizeTime(t){
  if(!t) return '';
  t = t.trim();
  const m = t.match(/(\d{1,2}):(\d{2})\s?([APap][Mm])?/);
  if(!m) return '';
  let h = parseInt(m[1],10); const min = m[2];
  if(m[3]){
    const pm = m[3].toLowerCase()==='pm';
    if(pm && h<12) h+=12;
    if(!pm && h===12) h=0;
  }
  return `${String(h).padStart(2,'0')}:${min}`;
}

const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// Unlike passesGroupFilter (which no longer blocks anything), this only returns true
// when the row actually names your P-group/T-group/section — used purely to decide
// what's pre-selected, never to hide a row.
function hasPositiveGroupMatch(rawText){
  const t = String(rawText||'').toUpperCase();
  const {pGroup, tGroup, section} = state.settings;
  if(pGroup && new RegExp('\\b'+pGroup+'\\b').test(t)) return true;
  if(tGroup && new RegExp('\\b'+tGroup+'\\b').test(t)) return true;
  if(section && new RegExp('\\bSEC(?:TION)?\\.?\\s*[-:]?\\s*'+section+'\\b').test(t)) return true;
  return false;
}

function openReviewModal(rows){
  // score each candidate against your saved subjects and your P/T-group settings
  // (pre-select if either matches) — nothing is ever hidden here, only pre-checked
  let scored = rows.map(r=>({
    ...r,
    matchedSubjectId: findBestSubjectMatch(`${r.subject} ${r.faculty||''}`),
    _groupMatch: hasPositiveGroupMatch(r._raw || `${r.subject} ${r.faculty||''} ${r.room||''} ${r.batch||''}`)
  }));
  importedRows = dedupeReviewRows(scored);
  importedRows.forEach(r=>{ if(r.selected === undefined) r.selected = !!(r.matchedSubjectId || r._groupMatch); });
  document.getElementById('importReplaceToggle').checked = true;
  document.getElementById('reviewWarning').style.display = 'none';
  renderReviewGrid();
  openModal('reviewModalOverlay');
}

// Merge candidates that clearly point at the same class slot (same day, same start/end,
// same subject text once normalized) — this is what lets 3 parallel AI models, or
// duplicate rows across sheets, collapse into one tappable chip instead of three.
function dedupeReviewRows(rows){
  const map = new Map();
  rows.forEach(r=>{
    const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    // Same subject in the same slot is still a DIFFERENT class if it has a different
    // batch, faculty, or room (e.g. P1/P2/P3 running in parallel) — only collapse
    // rows that are genuinely identical (like a merged cell repeating 3x down a block).
    const key = [r.day, r.start, r.end, norm(r.subject), norm(r.batch), norm(r.room)].join('|');
    if(map.has(key)){
      const ex = map.get(key);
      ex._agree = (ex._agree||1) + 1;
      if(!ex.matchedSubjectId && r.matchedSubjectId) ex.matchedSubjectId = r.matchedSubjectId;
    } else {
      map.set(key, {...r, _agree: 1});
    }
  });
  return Array.from(map.values());
}

function renderReviewGrid(){
  const table = document.getElementById('reviewGridTable');
  if(!importedRows.length){
    table.innerHTML = '<tr><td style="padding:20px;color:var(--ink-soft);">No classes detected in that file.</td></tr>';
    updateReviewCount();
    return;
  }
  const slotKey = r => r.start + '–' + r.end;
  const slots = Array.from(new Set(importedRows.map(slotKey))).sort((a,b)=> a.split('–')[0].localeCompare(b.split('–')[0]));
  const daysPresent = DAY_ORDER.filter(d => importedRows.some(r=>r.day===d));

  let html = '<thead><tr><th>Day</th>' + slots.map(s=>{
    const [st,en] = s.split('–');
    return `<th>${fmtTimeShort(st)}–${fmtTimeShort(en)}</th>`;
  }).join('') + '</tr></thead><tbody>';

  daysPresent.forEach(day=>{
    html += `<tr><td class="daycell">${day.slice(0,3)}</td>`;
    slots.forEach(slot=>{
      const chips = importedRows.filter(r=> r.day===day && slotKey(r)===slot);
      html += '<td class="slotcell">';
      chips.forEach(r=>{
        const {name, code} = splitSubjectCode(r.subject);
        html += `<div class="grid-chip ${r.selected?'selected':''}" onclick="toggleReviewChip('${r.id}')">
          <div class="gc-subj">${escapeHtml(name)}</div>
          ${code ? `<div class="gc-meta">${escapeHtml(code)}</div>` : ''}
          ${(r.faculty||r.room) ? `<div class="gc-meta">${escapeHtml(r.faculty||'')}${r.faculty&&r.room?' · ':''}${escapeHtml(r.room||'')}</div>` : ''}
          ${(r._agree>1 && r._source==='ai') ? `<span class="gc-badge">✓ ${r._agree} models agree</span>` : ''}
        </div>`;
      });
      html += '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;
  updateReviewCount();
}
function fmtTimeShort(t){
  if(!t) return '';
  const [h,m] = t.split(':').map(Number);
  const ap = h>=12 ? 'pm':'am'; let hh = h%12; if(hh===0) hh=12;
  return hh + (m ? ':'+String(m).padStart(2,'0') : '') + ap;
}
function toggleReviewChip(id){
  const r = importedRows.find(x=>x.id===id);
  if(r){ r.selected = !r.selected; renderReviewGrid(); }
}
function selectAllReviewChips(val){
  importedRows.forEach(r=> r.selected = val);
  renderReviewGrid();
}
function updateReviewCount(){
  const n = importedRows.filter(r=>r.selected).length;
  document.getElementById('reviewSelectedCount').textContent = n + ' selected';
}
document.getElementById('confirmImportBtn').addEventListener('click', ()=>{
  const selected = importedRows.filter(r=>r.selected);
  const warn = document.getElementById('reviewWarning');
  if(!selected.length){
    warn.textContent = 'Tap at least one class to add it to your timetable.';
    warn.style.display = 'block';
    return;
  }
  warn.style.display = 'none';
  const toAdd = selected.map(r=>({ id: uid(), day:r.day, start:r.start, end:r.end, subject:r.subject, faculty:r.faculty||'', room:r.room||'' }));
  const replace = document.getElementById('importReplaceToggle').checked;
  if(replace) state.classes = toAdd;
  else state.classes.push(...toAdd);
  saveData(); closeModal('reviewModalOverlay'); renderAll();
  document.getElementById('importStatus').textContent = replace
    ? `Your timetable now has ${toAdd.length} class(es).`
    : `Added ${toAdd.length} class(es) alongside your existing timetable.`;
  importedRows = [];
});

/* ---------------- INIT ---------------- */
function tickClock(){
  const now = new Date();
  const timeStr = now.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const el = document.getElementById('liveClock');
  if(el) el.textContent = timeStr;
  const kpi = document.getElementById('statLiveClock');
  if(kpi) kpi.textContent = timeStr;
  const dateEl = document.getElementById('statLiveDate');
  if(dateEl) dateEl.textContent = now.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
}
renderAll();
tickClock();
// Re-align to the real clock every tick (setInterval alone can drift a little over time)
function scheduleClockTick(){
  tickClock();
  const msToNextSecond = 1000 - (Date.now() % 1000);
  setTimeout(scheduleClockTick, msToNextSecond);
}
scheduleClockTick();
