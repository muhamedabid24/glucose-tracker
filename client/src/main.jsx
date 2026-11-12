import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api';
import './styles.css';
const SLOTS = ['Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner'];
const tokenKey = 'sweety-token';
function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenKey) || '');
  const [register, setRegister] = useState(false);
  const [notice, setNotice] = useState(null);
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState('');
  const [retry, setRetry] = useState(0);
  function logout(message) { sessionStorage.removeItem(tokenKey); setToken(''); setNotice(message ? { error: true, text: message } : null); }
  useEffect(() => {
    const controller = new AbortController();
    setConfigError('');
    api('/config', { signal: controller.signal }).then(setConfig).catch(error => {
      if (error.name !== 'AbortError') setConfigError('Cannot connect to the API. Check that the server is running.');
    });
    return () => controller.abort();
  }, [retry]);
  return <div className="shell">
    <header className="topbar"><a className="brand" href="/" aria-label="Sweety home"><span className="brand-icon">s</span>sweety<span className="brand-dot">.</span></a><span className="top-label">YOUR PERSONAL GLUCOSE JOURNAL</span>{token && <button className="quiet" onClick={() => logout()}>Log out ?</button>}</header>
    {notice && <div role={notice.error ? 'alert' : 'status'} className={`notice ${notice.error ? 'error' : 'success'}`}>{notice.text}<button aria-label="Dismiss message" onClick={() => setNotice(null)}>?</button></div>}
    {!token ? <Auth register={register} setRegister={setRegister} onLogin={value => {sessionStorage.setItem(tokenKey,value);setToken(value);setNotice(null);}} notice={setNotice}/> :
      config ? <Dashboard token={token} config={config} notice={setNotice} logout={logout}/> : <main className="panel connection" role="status">{configError || 'Connecting to your journal?'}{configError && <button onClick={() => setRetry(value => value + 1)}>Retry connection</button>}</main>}
    <footer>Made for the everyday. <span>A personal journal, not medical advice.</span></footer>
  </div>;
}
function Auth({ register, setRegister, onLogin, notice }) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function submit(event) {
    event.preventDefault();setBusy(true);setError('');
    const data=Object.fromEntries(new FormData(event.currentTarget));
    if (new TextEncoder().encode(data.password).length > 72) {setError('Password must be at most 72 UTF-8 bytes.');setBusy(false);return;}
    try {
      const result=await api('/auth/'+(register?'register':'login'),{method:'POST',body:data});
      if(register){setRegister(false);notice({text:'Account created. Log in to start your journal.'});}
      else onLogin(result.token);
    } catch(error){setError(error.message === 'Failed to fetch' ? 'Cannot reach the API. Check that the server is running.' : error.message);}
    finally{setBusy(false);}
  }
  return <main className="auth-layout">
    <section className="auth-intro"><span className="eyebrow">A LITTLE CHECK-IN. A CLEARER PICTURE.</span><h1>Small moments.<br/><em>Better understanding.</em></h1><p>Keep your glucose readings in one calm place. See your patterns, one day at a time.</p><div className="illustration" aria-hidden="true"><div className="orbit"></div><span className="spark">?</span><div className="sample"><span>YOUR DAILY CHECK-IN</span><strong>108 <small>mg/dl</small></strong><div className="sample-line">? ? ? ? ? ? ? ? ?</div><span>A habit worth keeping.</span></div></div></section>
    <section className="panel auth-card"><span className="eyebrow">WELCOME TO SWEETY</span><h2>{register?'Start your journal':'Welcome back'}</h2><p>{register?'A simple space for your daily readings.':'Your next check-in starts here.'}</p><form onSubmit={submit} key={String(register)}>
      {register && <label>Full name<input name="name" autoComplete="name" placeholder="Your name" maxLength="100" required/></label>}
      <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength="255" required/></label>
      <label>Password<input name="password" type="password" autoComplete={register?'new-password':'current-password'} placeholder={register?'At least 8 characters':'Your password'} minLength={register?8:undefined} required/></label>
      {error && <p role="alert" className="field-error">{error}</p>}
      <button className="primary full" disabled={busy}>{busy?'Please wait?':register?'Create account ?':'Log in ?'}</button>
    </form><p className="switch">{register?'Already have an account?':'New here?'} <button onClick={() => {setError('');setRegister(!register);}}>{register?'Log in':'Create an account'}</button></p></section>
  </main>;
}
function Dashboard({ token, config, notice, logout }) {
  const [date,setDate] = useState(config.today);
  const [history,setHistory] = useState([]);
  const [reports,setReports] = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const [editing,setEditing] = useState(null);
  const [deleting,setDeleting] = useState(null);
  const [deleteBusy,setDeleteBusy] = useState(false);
  const formRef = useRef(null);
  const fail = error => { if(error.status===401)logout(error.message);else notice({error:true,text:error.message}); };
  useEffect(() => {
    const controller=new AbortController();setLoading(true);setError('');
    const options={token,signal:controller.signal};
    Promise.all([api('/readings',options),...['daily','mtd','monthly'].map(type => api(`/reports?date=${date}&type=${type}`,options))])
      .then(([list,...stats]) => {setHistory(list.readings);setReports(stats);})
      .catch(error => {if(error.name!=='AbortError'){if(error.status===401)logout(error.message);else setError(error.message);}})
      .finally(() => {if(!controller.signal.aborted)setLoading(false);});
    return () => controller.abort();
  },[date,revision,token]);
  async function remove() {
    setDeleteBusy(true);
    try{await api('/readings/'+deleting.id,{token,method:'DELETE'});if(editing?.id===deleting.id)setEditing(null);setDeleting(null);setRevision(v=>v+1);notice({text:'Reading deleted.'});}
    catch(error){fail(error);}finally{setDeleteBusy(false);}
  }
  return <main>
    <div className="dashboard-heading"><div><span className="eyebrow">YOUR HEALTH, ONE DAY AT A TIME</span><h1>Your glucose journal<span className="brand-dot">.</span></h1><p>A daily habit. A clearer view of your numbers.</p></div><label className="date-picker">REPORT DATE<input type="date" value={date} max={config.today} min="1900-01-01" onChange={e=>{if(e.target.value && e.target.validity.valid)setDate(e.target.value);}}/><small>{config.timezone}</small></label></div>
    {error && <div className="notice error" role="alert">{error}<button onClick={()=>setRevision(v=>v+1)}>Retry</button></div>}
    <div className="dashboard-grid"><section className="panel reading-form" ref={formRef}><div className="section-icon">?</div><h2>{editing?'Edit reading':'Add a reading'}</h2><p>A quick check-in for your journal.</p><ReadingForm key={editing?.id || 'new'} editing={editing} token={token} config={config} selectedDate={date} onCancel={()=>setEditing(null)} onSaved={message=>{setEditing(null);setRevision(v=>v+1);notice({text:message});}} onUnauthorized={logout}/></section>
    <section className="reports" aria-busy={loading}><div className="section-title"><h2>Your snapshot</h2><span className="unit">ALL VALUES IN mg/dl</span></div>{loading?<div className="panel skeleton" role="status">Loading your reports?</div>:reports && reports.map((report,i)=><Report key={report.type} report={report} title={['Daily','Month to date','Previous month'][i]} />)}</section></div>
    <section className="panel history"><div className="section-title"><div><span className="eyebrow">THE BIGGER PICTURE</span><h2>Reading history</h2></div><span className="badge">{loading?'?':history.length} readings</span></div><p>Your complete journal, with the latest dates first.</p>
      {loading?<p role="status">Loading readings?</p>:!history.length?<div className="empty">Your journal starts with one reading. Add your first check-in above.</div>:<div className="table-scroll"><table><thead><tr><th>Date</th><th>Slot</th><th>Glucose</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{history.map(row=><tr key={row.id}><td>{formatDate(row.date)}</td><td>{row.slot}</td><td><strong>{row.value}</strong> <span className="muted">mg/dl</span></td><td className="actions"><button onClick={()=>{setEditing(row);formRef.current?.scrollIntoView({behavior:'smooth',block:'start'});}}>Edit</button><button className="danger" onClick={()=>setDeleting(row)}>Delete</button></td></tr>)}</tbody></table></div>}
    </section>
    {deleting && <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="delete-title" className="panel modal"><h2 id="delete-title">Delete this reading?</h2><p>{formatDate(deleting.date)} ? {deleting.slot} ? {deleting.value} mg/dl</p><p>This action cannot be undone.</p><div className="button-row"><button autoFocus disabled={deleteBusy} onClick={()=>setDeleting(null)}>Keep reading</button><button className="primary danger-bg" disabled={deleteBusy} onClick={remove}>{deleteBusy?'Deleting?':'Delete reading'}</button></div></section></div>}
  </main>;
}
function ReadingForm({ editing, token, config, selectedDate, onCancel, onSaved, onUnauthorized }) {
  const [date,setDate]=useState(editing?.date || selectedDate);
  const [slot,setSlot]=useState(editing?.slot || SLOTS[0]);
  const [value,setValue]=useState(editing?.value ?? '');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(event){
    event.preventDefault();setError('');
    if(value==='' || !Number.isInteger(Number(value)) || Number(value)<40 || Number(value)>600){setError('Enter a whole number from 40 to 600 mg/dl.');return;}
    if(!date || date>config.today){setError('Choose a date that is not in the future.');return;}
    setBusy(true);
    try{const result=await api('/readings'+(editing?'/'+editing.id:''),{token,method:editing?'PUT':'POST',body:{date,slot,value:Number(value)}});if(!editing)setValue('');onSaved(result.message);}
    catch(error){if(error.status===401)onUnauthorized(error.message);else setError(error.message==='Failed to fetch'?'Cannot reach the API. Please try again.':error.message);}
    finally{setBusy(false);}
  }
  return <form onSubmit={submit}><label>Date<input type="date" min="1900-01-01" max={config.today} value={date} onChange={e=>setDate(e.target.value)} required/></label><label>Time of day<select value={slot} onChange={e=>setSlot(e.target.value)}>{SLOTS.map(slot=><option key={slot}>{slot}</option>)}</select></label><label>Glucose value <span className="muted">(mg/dl)</span><input type="number" inputMode="numeric" min="40" max="600" step="1" placeholder="e.g. 108" value={value} onChange={e=>setValue(e.target.value)} required/><small>Whole numbers between 40 and 600.</small></label>{error&&<p className="field-error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Saving?':editing?'Save changes':'? Add reading'}</button>{editing&&<button type="button" className="full" disabled={busy} onClick={onCancel}>Cancel editing</button>}<p className="form-note">One reading per slot. Up to four a day.</p></form>;
}
function formatDate(date){return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));}
function Report({report,title}){
  return <article className="panel report"><div className="section-title"><h3>{title}</h3><span className="report-date">{formatDate(report.start)}{report.start!==report.end?' ? '+formatDate(report.end):''}</span></div>{!report.count?<p className="empty">No readings for this period. Your next check-in will appear here.</p>:<><dl className="stats">{[['Highest',report.highest],['Lowest',report.lowest],['Average',report.average.toFixed(1)],['Readings',report.count]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{report.type==='daily'&&<ul className="daily-list">{report.readings.map(row=><li key={row.id}><span>{row.slot}</span><strong>{row.value} <small>mg/dl</small></strong></li>)}</ul>}</>}</article>;
}
createRoot(document.getElementById('root')).render(<App/>);
