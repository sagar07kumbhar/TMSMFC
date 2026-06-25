import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Grid, Alert, IconButton
} from '@mui/material';
import { Add, Delete, LockOutlined } from '@mui/icons-material';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import usePermissions from '../hooks/usePermissions';

const STATUS_STYLE = {
  planned:     { bg:'#f1f5f9', color:'#475569' },
  in_progress: { bg:'#dbeafe', color:'#1e40af' },
  completed:   { bg:'#dcfce7', color:'#166534' },
  cancelled:   { bg:'#fee2e2', color:'#991b1b' },
};

const Badge = ({ label, style }) => (
  <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500, background:style?.bg||'#f1f5f9', color:style?.color||'#475569' }}>{label}</span>
);

const fmt = n => `₹${(+n||0).toLocaleString('en-IN')}`;

// Fix date from DB — strips time part if present
const fixDate = d => d ? String(d).slice(0, 10) : '';

const BLANK_OWNED = {
  trip_number:'', lr_number:'', trip_date: new Date().toISOString().slice(0,10),
  trip_type:'owned', truck_id:'', driver_id:'',
  consignee_id:'', from_location:'', to_location:'',
  distance_km:'', weight_tons:'', freight_amount:'', advance_paid:'',
  detention_charges:0, kata_charges:0, loading_charges:0, unloading_charges:0,
  gst_type:'exempt', gst_rate:0, status:'planned', notes:''
};

const BLANK_BROKER = {
  trip_number:'', lr_number:'', trip_date: new Date().toISOString().slice(0,10),
  trip_type:'brokerage',
  broker_owner_name:'', broker_owner_phone:'', broker_truck_number:'', broker_driver_name:'',
  commission_percent:5,
  consignee_id:'', from_location:'', to_location:'',
  distance_km:'', weight_tons:'', freight_amount:'', advance_paid:'',
  broker_advance_paid:0, gst_type:'exempt', gst_rate:0, status:'planned', notes:''
};

const EXPENSE_TYPES = [
  { value:'diesel',           label:'Diesel' },
  { value:'toll',             label:'Toll' },
  { value:'rto',              label:'RTO / Border' },
  { value:'repair',           label:'Breakdown / Repair' },
  { value:'driver_allowance', label:'Driver allowance' },
  { value:'other',            label:'Other' },
];

function validate(form) {
  const errs = {};
  if (!form.lr_number)       errs.lr_number    = 'LR number required';
  if (!form.trip_date)       errs.trip_date    = 'Date required';
  if (!form.from_location)   errs.from_location = 'From required';
  if (!form.to_location)     errs.to_location   = 'To required';
  if (!form.freight_amount || +form.freight_amount <= 0) errs.freight_amount = 'Freight amount required';
  if (form.trip_type === 'owned') {
    if (!form.truck_id)  errs.truck_id  = 'Select a truck';
    if (!form.driver_id) errs.driver_id = 'Select a driver';
  }
  if (form.trip_type === 'brokerage') {
    if (!form.broker_owner_name)   errs.broker_owner_name   = 'Owner name required';
    if (!form.broker_truck_number) errs.broker_truck_number = 'Truck number required';
  }
  return errs;
}

export default function Trips() {
  const [trips, setTrips]           = useState([]);
  const [trucks, setTrucks]         = useState([]);
  const [drivers, setDrivers]       = useState([]);
  const [consignees, setConsignees] = useState([]);
  const [filter, setFilter]         = useState('all');
  const [activeTab, setActiveTab]   = useState('owned');
  const [open, setOpen]             = useState(false);
  const [form, setForm]             = useState(BLANK_OWNED);
  const [expenses, setExpenses]     = useState([]); // trip expenses rows
  const [editing, setEditing]       = useState(null);
  const [lrLoading, setLrLoading]   = useState(false);
  const [errors, setErrors]         = useState({});
  const [touched, setTouched]       = useState({});
  const showToast = useToast();
  const { can, isAdmin, isStaff1 } = usePermissions();

  const showFreightInList = can('show_freight_in_list');
  const showFreightInForm = can('show_freight_amount');
  const canDelete         = can('can_delete_trip');

  const load = async () => {
    try { const r = await api.get('/trips'); setTrips(r.data.data || []); } catch {}
    try { const r = await api.get('/trucks'); setTrucks(r.data || []); } catch {}
    try { const r = await api.get('/drivers'); setDrivers(r.data || []); } catch {}
    try { const r = await api.get('/consignees'); setConsignees(r.data || []); } catch {}
  };
  useEffect(() => { load(); }, []);

  const openForm = async (trip = null, type = 'owned') => {
    setEditing(trip?.id || null);
    setErrors({}); setTouched({});
    if (trip) {
      // FIX: strip time from date fields coming from DB
      setForm({
        ...trip,
        trip_date:        fixDate(trip.trip_date),
        truck_id:         trip.truck_id   || '',
        driver_id:        trip.driver_id  || '',
        consignee_id:     trip.consignee_id || '',
      });
      setActiveTab(trip.trip_type || 'owned');
      // Load existing expenses
      try {
        const r = await api.get(`/trip-expenses?trip_id=${trip.id}`);
        setExpenses(r.data || []);
      } catch { setExpenses([]); }
    } else {
      setLrLoading(true);
      let lr_number = '';
      try { const r = await api.get('/trips/next-lr'); lr_number = r.data.lr_number; } catch {}
      finally { setLrLoading(false); }
      const blank = type === 'owned' ? BLANK_OWNED : BLANK_BROKER;
      setForm({ ...blank, trip_number: `TRIP-${Date.now().toString().slice(-6)}`, lr_number });
      setActiveTab(type);
      setExpenses([]);
    }
    setOpen(true);
  };

  const switchTab = (t) => {
    setActiveTab(t); setErrors({}); setTouched({});
    const blank = t === 'owned' ? BLANK_OWNED : BLANK_BROKER;
    setForm(p => ({ ...blank, trip_number: p.trip_number, lr_number: p.lr_number, trip_date: p.trip_date, consignee_id: p.consignee_id }));
    setExpenses([]);
  };

  // Expense row helpers
  const addExpense = () => setExpenses(p => [...p, { expense_type: 'diesel', amount: '', description: '', expense_date: form.trip_date }]);
  const updateExpense = (i, k, v) => setExpenses(p => p.map((e, idx) => idx === i ? { ...e, [k]: v } : e));
  const removeExpense = (i) => setExpenses(p => p.filter((_, idx) => idx !== i));

  const totalExpenses = expenses.reduce((s, e) => s + (+e.amount || 0), 0);

  const save = async () => {
    const allTouched = {}; Object.keys(form).forEach(k => allTouched[k] = true); setTouched(allTouched);
    const errs = validate(form); setErrors(errs);
    if (Object.keys(errs).length > 0) { showToast('Please fix the errors', 'error'); return; }
    try {
      const res = editing
        ? await api.put(`/trips/${editing}`, form)
        : await api.post('/trips', form);

      const tripId = editing || res.data.id;

      // Save expenses — delete existing then re-insert
      if (tripId && expenses.length > 0) {
        try {
          // Delete old expenses for this trip
          if (editing) await api.delete(`/trip-expenses?trip_id=${tripId}`).catch(() => {});
          // Save new ones
          for (const exp of expenses) {
            if (+exp.amount > 0) {
              await api.post('/trip-expenses', { ...exp, trip_id: tripId, expense_date: exp.expense_date || form.trip_date });
            }
          }
        } catch {}
      }

      setOpen(false); load();
      if (!editing && res.data.invoice_number) {
        showToast(`Trip saved! Invoice ${res.data.invoice_number} auto-generated`, 'success');
      } else {
        showToast(editing ? 'Trip updated' : 'Trip saved', 'success');
      }
    } catch (e) { showToast(e.response?.data?.error || 'Failed to save', 'error'); }
  };

  const del = async id => {
    if (!confirm('Delete this trip?')) return;
    try { await api.delete(`/trips/${id}`); load(); showToast('Trip deleted', 'info'); }
    catch { showToast('Failed to delete', 'error'); }
  };

  const f = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (touched[k]) { setErrors(validate({ ...form, [k]: v })); }
  };
  const blur = k => { setTouched(p => ({ ...p, [k]: true })); setErrors(validate(form)); };

  const filtered = filter === 'all' ? trips : trips.filter(t => t.trip_type === filter);

  // Live calculators
  const ownedCalc = () => {
    const fr  = +form.freight_amount || 0;
    const det = (+form.detention_charges || 0) + (+form.kata_charges || 0) + (+form.loading_charges || 0) + (+form.unloading_charges || 0);
    const drv = (+form.distance_km || 0) * 5;
    const ext = totalExpenses; // diesel + toll etc
    return { fr, det, drv, ext, net: fr - det - drv - ext, due: fr - (+form.advance_paid || 0) };
  };

  const brokerCalc = () => {
    const fr   = +form.freight_amount || 0;
    const p    = +form.commission_percent || 0;
    const comm = fr * p / 100;
    return { fr, comm, p, ownerPay: fr - comm, due: fr - (+form.advance_paid || 0), ownerRem: (fr - comm) - (+form.broker_advance_paid || 0) };
  };

  const cols = ['LR No.', 'Date', 'Route', 'Type', 'Vehicle', 'Consignee',
    ...(showFreightInList ? ['Freight', 'Advance', 'Due'] : []),
    'Status', ''];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ bgcolor:'#fff', borderRadius:'8px 8px 0 0', border:'0.5px solid #e2e6ef', borderBottom:'none', p:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <Box sx={{ display:'flex', gap:1 }}>
          {['all','owned','brokerage'].map(v => (
            <Button key={v} size="small" variant={filter===v?'contained':'outlined'} onClick={() => setFilter(v)}
              sx={{ fontSize:11.5, py:0.4, minWidth:0, bgcolor:filter===v?'#1a2744':'transparent', borderColor:'#e2e6ef', color:filter===v?'#fff':'#6b7a99' }}>
              {v==='all'?'All':v.charAt(0).toUpperCase()+v.slice(1)}
            </Button>
          ))}
        </Box>
        <Box sx={{ display:'flex', gap:1 }}>
          <Button size="small" variant="outlined" startIcon={<Add/>} onClick={() => openForm(null,'owned')}
            sx={{ fontSize:11.5, borderColor:'#2563eb', color:'#2563eb' }}>Own trip</Button>
          {isAdmin && (
            <Button size="small" variant="contained" startIcon={<Add/>} onClick={() => openForm(null,'brokerage')}
              sx={{ fontSize:11.5, bgcolor:'#f59e0b', '&:hover':{ bgcolor:'#d97706' } }}>Brokerage trip</Button>
          )}
        </Box>
      </Box>

      {isStaff1 && (
        <Box sx={{ bgcolor:'#eff6ff', border:'0.5px solid #bfdbfe', borderTop:'none', p:'7px 14px', display:'flex', alignItems:'center', gap:1 }}>
          <LockOutlined sx={{ fontSize:14, color:'#2563eb' }}/>
          <Typography sx={{ fontSize:11, color:'#1e40af' }}>Financial data is hidden. Contact admin to view revenue and invoice details.</Typography>
        </Box>
      )}

      <Box sx={{ bgcolor:'#fafbfc', border:'0.5px solid #e2e6ef', borderTop:'none', borderBottom:'0.5px solid #e2e6ef', p:'8px 14px' }}>
        <input placeholder="Search LR number, route, truck, consignee..." style={{ width:'100%', padding:'5px 8px', border:'0.5px solid #e2e6ef', borderRadius:5, fontSize:12, outline:'none', background:'white', color:'inherit' }}/>
      </Box>

      <Box sx={{ bgcolor:'#fff', border:'0.5px solid #e2e6ef', borderTop:'none', borderRadius:'0 0 8px 8px', overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
          <thead>
            <tr style={{ background:'#fafbfc' }}>
              {cols.map(h => (
                <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:500, color:'#6b7a99', borderBottom:'0.5px solid #e2e6ef', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} style={{ borderBottom:'0.5px solid #e2e6ef' }}
                onMouseEnter={e => e.currentTarget.style.background='#f8f9fc'}
                onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                <td style={{ padding:'9px 12px' }}><b style={{ fontSize:12 }}>{t.lr_number||t.trip_number}</b></td>
                <td style={{ padding:'9px 12px', fontSize:12, color:'#6b7a99' }}>
                  {new Date(t.trip_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                </td>
                <td style={{ padding:'9px 12px', fontSize:12 }}>{t.from_location}→{t.to_location}</td>
                <td style={{ padding:'9px 12px' }}>
                  <Badge label={t.trip_type} style={t.trip_type==='owned'?{bg:'#dbeafe',color:'#1e40af'}:{bg:'#fef3c7',color:'#92400e'}}/>
                </td>
                <td style={{ padding:'9px 12px', fontSize:12 }}>{t.truck_number||t.broker_truck_number||'—'}</td>
                <td style={{ padding:'9px 12px', fontSize:12 }}>{t.consignee_name||'—'}</td>
                {showFreightInList && <>
                  <td style={{ padding:'9px 12px', fontSize:12 }}>
                    {fmt(t.freight_amount)}
                    {t.trip_type==='brokerage' && <div style={{ fontSize:10, color:'#92400e' }}>Comm: {fmt(t.commission_amount)}</div>}
                  </td>
                  <td style={{ padding:'9px 12px', fontSize:12 }}>{fmt(t.advance_paid)}</td>
                  <td style={{ padding:'9px 12px', fontSize:12, color:+t.balance_due>0?'#d97706':'#16a34a', fontWeight:+t.balance_due>0?500:400 }}>
                    {+t.balance_due>0?fmt(t.balance_due):'—'}
                  </td>
                </>}
                <td style={{ padding:'9px 12px' }}>
                  <Badge label={t.status.replace('_',' ')} style={STATUS_STYLE[t.status]}/>
                </td>
                <td style={{ padding:'9px 12px', whiteSpace:'nowrap' }}>
                  <button onClick={() => openForm(t, t.trip_type)} style={{ marginRight:5, padding:'3px 9px', border:'0.5px solid #e2e6ef', borderRadius:4, fontSize:11, cursor:'pointer', background:'#fff', color:'inherit' }}>Edit</button>
                  {canDelete && <button onClick={() => del(t.id)} style={{ padding:'3px 9px', border:'0.5px solid #fca5a5', borderRadius:4, fontSize:11, cursor:'pointer', background:'#fff', color:'#dc2626' }}>Del</button>}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={cols.length} style={{ padding:'32px', textAlign:'center', color:'#6b7a99', fontSize:12 }}>No trips found. Add your first trip.</td></tr>
            )}
          </tbody>
        </table>
      </Box>

      {/* ── DIALOG ── */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ fontSize:15, fontWeight:500, pb:1, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          {editing ? 'Edit Trip' : 'Add New Trip'}
          {!editing && (
            <Box sx={{ display:'flex', gap:0.5 }}>
              <Button size="small" variant={activeTab==='owned'?'contained':'outlined'} onClick={() => switchTab('owned')}
                sx={{ fontSize:12, bgcolor:activeTab==='owned'?'#1a2744':'transparent', borderColor:'#2563eb', color:activeTab==='owned'?'#fff':'#2563eb' }}>
                🚛 Owned
              </Button>
              {isAdmin && (
                <Button size="small" variant={activeTab==='brokerage'?'contained':'outlined'} onClick={() => switchTab('brokerage')}
                  sx={{ fontSize:12, bgcolor:activeTab==='brokerage'?'#f59e0b':'transparent', borderColor:'#f59e0b', color:activeTab==='brokerage'?'#fff':'#92400e' }}>
                  🤝 Brokerage
                </Button>
              )}
            </Box>
          )}
        </DialogTitle>

        <DialogContent sx={{ pt:1 }}>
          {activeTab==='brokerage' && (
            <Alert severity="info" sx={{ mb:2, fontSize:12 }}>
              <b>Brokerage:</b> You collect full freight, deduct your commission, transfer rest to owner. No diesel/toll/expenses on your side.
            </Alert>
          )}

          <Grid container spacing={2}>
            {/* ── LEFT COLUMN ── */}
            <Grid item xs={12} md={8}>

              {/* Section 1: LR & Route */}
              <Box sx={{ bgcolor:'#fafbfc', border:'0.5px solid #e2e6ef', borderRadius:'6px', p:'12px', mb:1.5 }}>
                <Typography sx={{ fontSize:10, fontWeight:600, color:'#6b7a99', textTransform:'uppercase', letterSpacing:'0.06em', mb:1.2 }}>LR & Route details</Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={4}>
                    <TextField label="LR Number *" fullWidth value={form.lr_number}
                      onChange={e => f('lr_number', e.target.value)} onBlur={() => blur('lr_number')}
                      error={touched.lr_number && !!errors.lr_number} helperText={touched.lr_number && errors.lr_number}
                      InputProps={{ endAdornment: lrLoading ? <CircularProgress size={14}/> : null }}
                      sx={{ '& .MuiOutlinedInput-root':{ bgcolor:'rgba(37,99,235,0.04)' } }}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    {/* FIX: value always uses fixDate to strip time, and shows correctly on edit */}
                    <TextField label="LR Date *" type="date" fullWidth
                      value={fixDate(form.trip_date)}
                      onChange={e => f('trip_date', e.target.value)}
                      onBlur={() => blur('trip_date')}
                      error={touched.trip_date && !!errors.trip_date}
                      helperText={touched.trip_date && errors.trip_date}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField select label="Status" fullWidth value={form.status} onChange={e => f('status', e.target.value)}>
                      {['planned','in_progress','completed','cancelled'].map(s => (
                        <MenuItem key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={5}>
                    <TextField label="From *" fullWidth value={form.from_location}
                      onChange={e => f('from_location', e.target.value)} onBlur={() => blur('from_location')}
                      error={touched.from_location && !!errors.from_location} helperText={touched.from_location && errors.from_location}
                      placeholder="e.g. Pune"/>
                  </Grid>
                  <Grid item xs={5}>
                    <TextField label="To *" fullWidth value={form.to_location}
                      onChange={e => f('to_location', e.target.value)} onBlur={() => blur('to_location')}
                      error={touched.to_location && !!errors.to_location} helperText={touched.to_location && errors.to_location}
                      placeholder="e.g. Mumbai"/>
                  </Grid>
                  <Grid item xs={2}>
                    <TextField label="KM" type="number" fullWidth value={form.distance_km} onChange={e => f('distance_km', e.target.value)}/>
                  </Grid>
                  <Grid item xs={4}>
                    <TextField label="Weight (tons)" type="number" fullWidth value={form.weight_tons} onChange={e => f('weight_tons', e.target.value)}/>
                  </Grid>
                  <Grid item xs={8}>
                    <TextField select label="Consignee" fullWidth value={form.consignee_id} onChange={e => f('consignee_id', e.target.value)}>
                      <MenuItem value=""><em>— Select consignee —</em></MenuItem>
                      {consignees.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Notes" fullWidth value={form.notes || ''} onChange={e => f('notes', e.target.value)} multiline rows={1}/>
                  </Grid>
                </Grid>
              </Box>

              {/* Section 2a: Vehicle & Driver (owned) */}
              {activeTab === 'owned' && (
                <Box sx={{ bgcolor:'#eff6ff', border:'0.5px solid #bfdbfe', borderRadius:'6px', p:'12px', mb:1.5 }}>
                  <Typography sx={{ fontSize:10, fontWeight:600, color:'#1e40af', textTransform:'uppercase', letterSpacing:'0.06em', mb:1.2 }}>Vehicle & Driver</Typography>
                  <Grid container spacing={1.5}>
                    <Grid item xs={6}>
                      <TextField select label="Truck *" fullWidth value={form.truck_id}
                        onChange={e => f('truck_id', e.target.value)} onBlur={() => blur('truck_id')}
                        error={touched.truck_id && !!errors.truck_id} helperText={touched.truck_id && errors.truck_id}>
                        <MenuItem value=""><em>— Select truck —</em></MenuItem>
                        {trucks.map(t => <MenuItem key={t.id} value={t.id}>{t.truck_number} — {t.truck_type||''}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField select label="Driver *" fullWidth value={form.driver_id}
                        onChange={e => f('driver_id', e.target.value)} onBlur={() => blur('driver_id')}
                        error={touched.driver_id && !!errors.driver_id} helperText={touched.driver_id && errors.driver_id}>
                        <MenuItem value=""><em>— Select driver —</em></MenuItem>
                        {drivers.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                      </TextField>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Section 2b: External owner (brokerage) */}
              {activeTab === 'brokerage' && (
                <Box sx={{ bgcolor:'#fffbeb', border:'0.5px solid #fcd34d', borderRadius:'6px', p:'12px', mb:1.5 }}>
                  <Typography sx={{ fontSize:10, fontWeight:600, color:'#92400e', textTransform:'uppercase', letterSpacing:'0.06em', mb:1.2 }}>External truck owner</Typography>
                  <Grid container spacing={1.5}>
                    <Grid item xs={6}><TextField label="Owner name *" fullWidth value={form.broker_owner_name} onChange={e => f('broker_owner_name',e.target.value)} onBlur={() => blur('broker_owner_name')} error={touched.broker_owner_name&&!!errors.broker_owner_name} helperText={touched.broker_owner_name&&errors.broker_owner_name}/></Grid>
                    <Grid item xs={6}><TextField label="Owner phone" fullWidth value={form.broker_owner_phone||''} onChange={e => f('broker_owner_phone',e.target.value)}/></Grid>
                    <Grid item xs={6}><TextField label="Truck number *" fullWidth value={form.broker_truck_number||''} onChange={e => f('broker_truck_number',e.target.value)} onBlur={() => blur('broker_truck_number')} error={touched.broker_truck_number&&!!errors.broker_truck_number} helperText={touched.broker_truck_number&&errors.broker_truck_number} placeholder="e.g. MH04GH7788"/></Grid>
                    <Grid item xs={6}><TextField label="Driver name" fullWidth value={form.broker_driver_name||''} onChange={e => f('broker_driver_name',e.target.value)}/></Grid>
                  </Grid>
                </Box>
              )}

              {/* Section 3: Freight & Billing */}
              {showFreightInForm && (
                <Box sx={{ bgcolor:'#fafbfc', border:'0.5px solid #e2e6ef', borderRadius:'6px', p:'12px', mb:1.5 }}>
                  <Typography sx={{ fontSize:10, fontWeight:600, color:'#6b7a99', textTransform:'uppercase', letterSpacing:'0.06em', mb:1.2 }}>Freight & billing</Typography>
                  <Grid container spacing={1.5}>
                    <Grid item xs={4}><TextField label="Freight amount ₹ *" type="number" fullWidth value={form.freight_amount} onChange={e => f('freight_amount',e.target.value)} onBlur={() => blur('freight_amount')} error={touched.freight_amount&&!!errors.freight_amount} helperText={touched.freight_amount&&errors.freight_amount}/></Grid>
                    <Grid item xs={4}><TextField label="Advance received ₹" type="number" fullWidth value={form.advance_paid} onChange={e => f('advance_paid',e.target.value)}/></Grid>
                    {activeTab === 'owned' && <>
                      <Grid item xs={4}><TextField label="Detention ₹" type="number" fullWidth value={form.detention_charges} onChange={e => f('detention_charges',e.target.value)}/></Grid>
                      <Grid item xs={4}><TextField label="Kata ₹" type="number" fullWidth value={form.kata_charges} onChange={e => f('kata_charges',e.target.value)}/></Grid>
                      <Grid item xs={4}><TextField label="Loading ₹" type="number" fullWidth value={form.loading_charges} onChange={e => f('loading_charges',e.target.value)}/></Grid>
                      <Grid item xs={4}><TextField label="Unloading ₹" type="number" fullWidth value={form.unloading_charges} onChange={e => f('unloading_charges',e.target.value)}/></Grid>
                    </>}
                    {activeTab === 'brokerage' && <>
                      <Grid item xs={4}><TextField label="Commission %" type="number" fullWidth value={form.commission_percent} onChange={e => f('commission_percent',e.target.value)}/></Grid>
                      <Grid item xs={4}><TextField label="Advance to owner ₹" type="number" fullWidth value={form.broker_advance_paid} onChange={e => f('broker_advance_paid',e.target.value)}/></Grid>
                      <Grid item xs={4}><TextField select label="Owner pay status" fullWidth value={form.broker_payment_status||'pending'} onChange={e => f('broker_payment_status',e.target.value)}>
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="advance_paid">Advance paid</MenuItem>
                        <MenuItem value="settled">Settled</MenuItem>
                      </TextField></Grid>
                    </>}
                    <Grid item xs={4}><TextField select label="GST type" fullWidth value={form.gst_type} onChange={e => f('gst_type',e.target.value)}>
                      <MenuItem value="exempt">Exempt</MenuItem>
                      <MenuItem value="cgst_sgst">CGST+SGST (Intra-state)</MenuItem>
                      <MenuItem value="igst">IGST (Inter-state)</MenuItem>
                    </TextField></Grid>
                    <Grid item xs={4}><TextField label="GST %" type="number" fullWidth value={form.gst_rate} onChange={e => f('gst_rate',e.target.value)}/></Grid>
                  </Grid>
                </Box>
              )}

              {/* Section 4: Trip expenses — Diesel, Toll, RTO etc (owned only) */}
              {activeTab === 'owned' && showFreightInForm && (
                <Box sx={{ bgcolor:'#fff8f0', border:'0.5px solid #fed7aa', borderRadius:'6px', p:'12px' }}>
                  <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:1.2 }}>
                    <Typography sx={{ fontSize:10, fontWeight:600, color:'#9a3412', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                      Trip expenses — Diesel, Toll, RTO, Repair etc.
                    </Typography>
                    <Button size="small" startIcon={<Add/>} onClick={addExpense}
                      sx={{ fontSize:11, color:'#9a3412', borderColor:'#fed7aa', border:'0.5px solid' }}>
                      Add expense
                    </Button>
                  </Box>

                  {expenses.length === 0 && (
                    <Typography sx={{ fontSize:12, color:'#9a3412', opacity:0.6, py:1 }}>
                      No expenses added. Click "Add expense" to log diesel, toll, RTO charges etc.
                    </Typography>
                  )}

                  {expenses.map((exp, i) => (
                    <Grid container spacing={1} key={i} sx={{ mb:1, alignItems:'center' }}>
                      <Grid item xs={3}>
                        <TextField select size="small" fullWidth value={exp.expense_type} onChange={e => updateExpense(i,'expense_type',e.target.value)} label="Type">
                          {EXPENSE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                        </TextField>
                      </Grid>
                      <Grid item xs={2}>
                        <TextField size="small" type="number" fullWidth value={exp.amount} onChange={e => updateExpense(i,'amount',e.target.value)} label="Amount ₹"/>
                      </Grid>
                      <Grid item xs={4}>
                        <TextField size="small" fullWidth value={exp.description||''} onChange={e => updateExpense(i,'description',e.target.value)} label="Description" placeholder="e.g. Diesel at Pune pump"/>
                      </Grid>
                      <Grid item xs={2}>
                        <TextField size="small" type="date" fullWidth value={fixDate(exp.expense_date)||fixDate(form.trip_date)} onChange={e => updateExpense(i,'expense_date',e.target.value)} InputLabelProps={{ shrink:true }} label="Date"/>
                      </Grid>
                      <Grid item xs={1}>
                        <IconButton size="small" onClick={() => removeExpense(i)} sx={{ color:'#dc2626' }}>
                          <Delete fontSize="small"/>
                        </IconButton>
                      </Grid>
                    </Grid>
                  ))}

                  {expenses.length > 0 && (
                    <Box sx={{ display:'flex', justifyContent:'flex-end', mt:0.5, pt:1, borderTop:'0.5px solid #fed7aa' }}>
                      <Typography sx={{ fontSize:12, color:'#9a3412', fontWeight:500 }}>
                        Total expenses: {fmt(totalExpenses)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Grid>

            {/* ── RIGHT COLUMN — Calculator ── */}
            {showFreightInForm && (
              <Grid item xs={12} md={4}>
                <Box sx={{ bgcolor:'#1a2744', borderRadius:'8px', p:'14px', color:'#fff', position:'sticky', top:0 }}>
                  <Typography sx={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:'0.06em', mb:1.5 }}>
                    {activeTab === 'owned' ? 'Live profit calculator' : 'Commission calculator'}
                  </Typography>

                  {activeTab === 'owned' && (() => {
                    const c = ownedCalc();
                    return (
                      <>
                        <Box sx={{ display:'flex', justifyContent:'space-between', py:'5px', fontSize:12 }}>
                          <span style={{ color:'rgba(255,255,255,0.6)' }}>Freight</span>
                          <span>{fmt(c.fr)}</span>
                        </Box>
                        <Box sx={{ display:'flex', justifyContent:'space-between', py:'5px', fontSize:12 }}>
                          <span style={{ color:'rgba(255,255,255,0.6)' }}>Detention/Kata/Load</span>
                          <span style={{ color:'#fca5a5' }}>− {fmt(c.det)}</span>
                        </Box>
                        <Box sx={{ display:'flex', justifyContent:'space-between', py:'5px', fontSize:12 }}>
                          <span style={{ color:'rgba(255,255,255,0.6)' }}>Diesel + Toll + Other</span>
                          <span style={{ color:'#fca5a5' }}>− {fmt(c.ext)}</span>
                        </Box>
                        <Box sx={{ display:'flex', justifyContent:'space-between', py:'5px', fontSize:12 }}>
                          <span style={{ color:'rgba(255,255,255,0.6)' }}>Driver extra ({form.distance_km||0}km × ₹5)</span>
                          <span style={{ color:'#fca5a5' }}>− {fmt(c.drv)}</span>
                        </Box>
                        <Box sx={{ borderTop:'1px solid rgba(255,255,255,0.15)', mt:1, pt:1, display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:600 }}>
                          <span>Net profit</span>
                          <span style={{ color: c.net >= 0 ? '#4ade80' : '#f87171' }}>{fmt(c.net)}</span>
                        </Box>
                        <Box sx={{ display:'flex', justifyContent:'space-between', mt:0.8, fontSize:12 }}>
                          <span style={{ color:'rgba(255,255,255,0.6)' }}>Balance due from client</span>
                          <span style={{ color:'#fbbf24' }}>{fmt(c.due)}</span>
                        </Box>
                        {!editing && +form.freight_amount > 0 && (
                          <Box sx={{ mt:1.5, p:'8px', bgcolor:'rgba(255,255,255,0.08)', borderRadius:'5px', fontSize:11, color:'rgba(255,255,255,0.7)' }}>
                            Invoice will auto-generate on save
                          </Box>
                        )}
                      </>
                    );
                  })()}

                  {activeTab === 'brokerage' && (() => {
                    const c = brokerCalc();
                    return (
                      <>
                        <Box sx={{ display:'flex', justifyContent:'space-between', py:'5px', fontSize:12 }}>
                          <span style={{ color:'rgba(255,255,255,0.6)' }}>Freight collected</span>
                          <span>{fmt(c.fr)}</span>
                        </Box>
                        <Box sx={{ borderTop:'1px solid rgba(255,255,255,0.1)', my:1 }}/>
                        <Box sx={{ display:'flex', justifyContent:'space-between', py:'5px', fontSize:14, fontWeight:600 }}>
                          <span style={{ color:'#4ade80' }}>Your commission ({c.p}%)</span>
                          <span style={{ color:'#4ade80' }}>{fmt(c.comm)}</span>
                        </Box>
                        <Box sx={{ display:'flex', justifyContent:'space-between', py:'5px', fontSize:12 }}>
                          <span style={{ color:'rgba(255,255,255,0.6)' }}>Pay to truck owner</span>
                          <span style={{ color:'#93c5fd' }}>{fmt(c.ownerPay)}</span>
                        </Box>
                        <Box sx={{ bgcolor:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'5px', p:'8px', my:1, fontSize:11, color:'#fbbf24' }}>
                          No diesel / toll / expenses on your side
                        </Box>
                        <Box sx={{ borderTop:'1px solid rgba(255,255,255,0.15)', pt:1 }}>
                          <Box sx={{ display:'flex', justifyContent:'space-between', fontSize:12, mb:0.5 }}>
                            <span style={{ color:'rgba(255,255,255,0.6)' }}>Balance due from consignee</span>
                            <span style={{ color:'#fbbf24' }}>{fmt(c.due)}</span>
                          </Box>
                          <Box sx={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                            <span style={{ color:'rgba(255,255,255,0.6)' }}>Still owe to owner</span>
                            <span style={{ color: c.ownerRem > 0 ? '#f87171' : '#4ade80' }}>{fmt(Math.max(0, c.ownerRem))}</span>
                          </Box>
                        </Box>
                      </>
                    );
                  })()}
                </Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px:3, pb:2.5, gap:1 }}>
          <Button onClick={() => setOpen(false)} sx={{ color:'#6b7a99' }}>Cancel</Button>
          <Button variant="contained" onClick={save} sx={{ bgcolor:'#1a2744', px:3, fontSize:13 }}>
            {editing ? 'Update trip' : 'Save trip'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
