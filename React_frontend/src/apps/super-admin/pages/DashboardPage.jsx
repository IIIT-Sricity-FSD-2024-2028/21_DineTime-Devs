import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { useAdmin } from '../context/AdminContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { mapUserStatus, TEAM_LABELS, TICKET_STATUS_LABELS } from '../utils/mappers.js';

const navItems = [
  ['dashboard', 'Dashboard', 'fa-chart-line'],
  ['restaurants', 'Restaurants', 'fa-building'],
  ['users', 'User Management', 'fa-users'],
  ['reservations', 'Reservations', 'fa-calendar-check'],
  ['notifications', 'Broadcast Center', 'fa-bullhorn'],
  ['subadmins', 'Sub-Admin Teams', 'fa-user-shield'],
  ['escalated', 'Escalated Issues', 'fa-triangle-exclamation'],
];

export function DashboardPage() {
  const { logout, profile } = useAuth();
  const { data, syncAdminState, addAuditLog, getRestaurantDisplay, getUserDisplay, getReservationDisplay } = useAdmin();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = sessionStorage.getItem('dt_active_tab_v6') || 'dashboard';
    return tab === 'audit' ? 'dashboard' : tab;
  });
  const [filters, setFilters] = useState({ restaurants: '', restaurantStatus: '', users: '', userRole: '', userStatus: '', resDate: new Date().toLocaleDateString('en-CA'), resType: 'restaurantName', resQuery: '', resStatus: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '', message: '', color: '#2E7D32' });
  const [subAdminModal, setSubAdminModal] = useState(false);
  const [subAdminForm, setSubAdminForm] = useState({ name: '', email: '', password: '', team: 'support', location_id: '', city: '', address: '', pincode: '', country: 'India', showNewLocation: false });
  const [locations, setLocations] = useState([]);
  const [resolveTicket, setResolveTicket] = useState({ open: false, id: '', notes: '' });

  useEffect(() => {
    syncAdminState().catch((error) => showToast(error.message || 'Unable to sync admin dashboard.', 'error'));
    const timer = setInterval(() => syncAdminState().catch(() => {}), 15000);
    const focus = () => syncAdminState().catch(() => {});
    window.addEventListener('focus', focus);
    return () => { clearInterval(timer); window.removeEventListener('focus', focus); };
  }, []);

  function switchTab(tab) {
    setActiveTab(tab);
    sessionStorage.setItem('dt_active_tab_v6', tab);
  }

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function changePassword(event) {
    event.preventDefault();
    if (passwordForm.next.length < 6) {
      setPasswordForm((form) => ({ ...form, message: 'New password must be at least 6 characters.', color: '#C62828' }));
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordForm((form) => ({ ...form, message: 'Password confirmation does not match.', color: '#C62828' }));
      return;
    }
    try {
      await apiRequest('/super-admin/password', { method: 'PATCH', body: JSON.stringify({ user_id: profile?.id || '', current_password: passwordForm.current, new_password: passwordForm.next }) });
      setPasswordForm({ current: '', next: '', confirm: '', message: 'Security key updated.', color: '#2E7D32' });
      addAuditLog('Updated super user security key');
    } catch (error) {
      setPasswordForm((form) => ({ ...form, message: error.message || 'Unable to update password.', color: '#C62828' }));
    }
  }

  async function sendBroadcast(event) {
    event.preventDefault();
    const form = event.target;
    const audience = form.audience.value;
    const message = form.message.value.trim();
    const roleMap = { diners: 'diner', managers: 'manager', staff: 'staff' };
    await apiRequest('/notifications/broadcast', { method: 'POST', body: JSON.stringify({ role: roleMap[audience], message, type: 'broadcast' }) });
    await syncAdminState();
    form.reset();
    showToast('Broadcast message sent successfully.');
    addAuditLog(`Sent broadcast to ${audience}`);
  }

  async function openSubAdminModal() {
    setSubAdminForm({ name: '', email: '', password: '', team: 'support', location_id: '', city: '', address: '', pincode: '', country: 'India', showNewLocation: false });
    setSubAdminModal(true);
  }

  async function loadLocations() {
    const res = await apiRequest('/restaurants/locations');
    setLocations(res?.data || []);
  }

  useEffect(() => {
    if (subAdminForm.team === 'verification') loadLocations().catch((error) => showToast(error.message, 'error'));
  }, [subAdminForm.team]);

  async function createNewLocation() {
    const { city, address, pincode, country } = subAdminForm;
    if (!city || !address || !pincode) {
      showToast('Please fill in city, address, and pincode for the new location.', 'error');
      return;
    }
    const created = await apiRequest('/restaurants/locations', { method: 'POST', body: JSON.stringify({ city, address, pincode, country: country || 'India' }) });
    await loadLocations();
    setSubAdminForm((form) => ({ ...form, location_id: created?.data?.id || '', city: '', address: '', pincode: '', country: 'India', showNewLocation: false }));
    showToast(`Location "${city}" added.`);
  }

  async function saveSubAdmin(event) {
    event.preventDefault();
    if (subAdminForm.team === 'verification' && !subAdminForm.location_id) {
      showToast('Please select a location for this Verification Team account.', 'error');
      return;
    }
    try {
      await apiRequest('/sub-admin', { method: 'POST', body: JSON.stringify({ name: subAdminForm.name, email: subAdminForm.email, password: subAdminForm.password, team: subAdminForm.team, location_id: subAdminForm.location_id || undefined }) });
      setSubAdminModal(false);
      showToast(`${TEAM_LABELS[subAdminForm.team]} account created for ${subAdminForm.name}.`);
      addAuditLog(`Created ${TEAM_LABELS[subAdminForm.team]} sub-admin: ${subAdminForm.email}`);
      await syncAdminState();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function toggleSubAdminStatus(id, currentStatus) {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await apiRequest(`/sub-admin/${id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
    showToast(`Sub-admin account ${nextStatus === 'active' ? 'activated' : 'suspended'}.`);
    addAuditLog(`Set sub-admin ${id} to ${nextStatus}`);
    await syncAdminState();
  }

  async function deleteSubAdmin(id) {
    if (!window.confirm('This will permanently remove this sub-admin account. Continue?')) return;
    await apiRequest(`/sub-admin/${id}`, { method: 'DELETE' });
    showToast('Sub-admin account deleted.');
    addAuditLog(`Deleted sub-admin ${id}`);
    await syncAdminState();
  }

  async function resolveEscalated(event) {
    event.preventDefault();
    await apiRequest(`/support/tickets/${resolveTicket.id}/resolve`, { method: 'PATCH', body: JSON.stringify({ resolution_notes: resolveTicket.notes, admin_id: profile?.id || '' }) });
    setResolveTicket({ open: false, id: '', notes: '' });
    showToast('Ticket marked as resolved.');
    addAuditLog(`Resolved escalated ticket ${resolveTicket.id}`);
    await syncAdminState();
  }

  const activeReservations = data.reservations.filter((reservation) => !['cancelled', 'completed', 'no_show'].includes(reservation.reservation_status));
  const dinerCount = data.users.filter((user) => user.role === 'diner').length;
  const pendingRestaurants = data.restaurants.filter((restaurant) => restaurant.status !== 'active').length;
  const totalCapacity = data.tables.length || data.restaurants.reduce((sum, restaurant) => sum + Number(restaurant.total_tables || 0), 0);

  const context = { data, filters, setFilter, getRestaurantDisplay, getUserDisplay, getReservationDisplay, activeReservations, dinerCount, pendingRestaurants, totalCapacity, switchTab, passwordForm, setPasswordForm, changePassword, sendBroadcast, openSubAdminModal, toggleSubAdminStatus, deleteSubAdmin, setResolveTicket };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo"><i className="fa-solid fa-utensils" style={{ marginRight: 8 }} /> DineTime <span style={{ fontSize: '0.65rem', color: '#A3B5A4', display: 'block', letterSpacing: 1, marginTop: 4 }}>SUPER USER</span></div>
        {navItems.map(([id, label, icon]) => <div key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => switchTab(id)}><i className={`fa-solid ${icon}`} /> {label}</div>)}
        <div className="nav-item" style={{ marginTop: 'auto', color: '#fca5a5' }} onClick={logout}><i className="fa-solid fa-right-from-bracket" /> Terminate Session</div>
      </aside>
      <div className="main-wrapper"><main className="main-content">
        {activeTab === 'dashboard' && <GlobalDashboard {...context} />}
        {activeTab === 'restaurants' && <RestaurantsView {...context} />}
        {activeTab === 'users' && <UsersView {...context} />}
        {activeTab === 'reservations' && <ReservationsView {...context} />}
        {activeTab === 'notifications' && <NotificationsView {...context} />}
        {activeTab === 'subadmins' && <SubAdminsView {...context} />}
        {activeTab === 'escalated' && <EscalatedView {...context} />}
      </main></div>
      <SubAdminModal open={subAdminModal} close={() => setSubAdminModal(false)} form={subAdminForm} setForm={setSubAdminForm} locations={locations} save={saveSubAdmin} createNewLocation={createNewLocation} />
      <ResolveModal resolveTicket={resolveTicket} setResolveTicket={setResolveTicket} resolveEscalated={resolveEscalated} />
    </div>
  );
}

function GlobalDashboard({ data, activeReservations, dinerCount, pendingRestaurants, switchTab, passwordForm, setPasswordForm, changePassword }) {
  const recent = [...data.reservations].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 3);
  return (
    <section className="dashboard-view" style={{ paddingTop: 100, paddingBottom: 0 }}>
      <div className="dashboard-header"><div><h1>Global Dashboard</h1><p>Real-time platform health and metrics.</p></div></div>
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <Kpi color="#1976D2" label="Total Bookings" value={activeReservations.length} />
        <Kpi color="#9C27B0" label="TOTAL DINERS USING PLATFORM" value={dinerCount} small />
        <Kpi color="#5F7A61" label="Total Restaurants" value={data.restaurants.length} />
        <Kpi color="#C62828" label="Pending Approvals" value={pendingRestaurants} valueStyle={{ color: '#C62828' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
        <div className="panel"><div className="panel-head"><div className="panel-title">Recent System Activity</div></div><div className="panel-body" style={{ padding: 0 }}>{recent.length ? recent.map((reservation, index) => <RecentActivity key={reservation.id} reservation={reservation} data={data} divider={index < recent.length - 1} />) : <div style={{ padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No recent activity yet.</div>}</div></div>
        <div className="panel"><div className="panel-head"><div className="panel-title">Quick Actions</div></div><div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}><QuickAction icon="fa-building" color="var(--primary-green)" label="View Restaurants" onClick={() => switchTab('restaurants')} /><QuickAction icon="fa-bullhorn" color="#1976D2" label="Compose Broadcast Message" onClick={() => switchTab('notifications')} /></div></div>
      </div>
      <div className="panel" style={{ marginTop: '1.5rem' }}><div className="panel-head"><div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><i className="fa-solid fa-shield-halved" style={{ color: 'var(--primary-green)' }} /> Security Settings</div></div><div className="panel-body" style={{ padding: '1.5rem' }}><form onSubmit={changePassword} style={{ maxWidth: 500 }}><div className="form-group" style={{ marginBottom: '1.2rem' }}><label>Current Master Password</label><input type="password" required placeholder="Enter current root access key" value={passwordForm.current} onChange={(event) => setPasswordForm((form) => ({ ...form, current: event.target.value }))} /></div><div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}><div className="form-group" style={{ flex: 1, margin: 0 }}><label>New Master Password</label><input type="password" required placeholder="New secure key" value={passwordForm.next} onChange={(event) => setPasswordForm((form) => ({ ...form, next: event.target.value }))} /></div><div className="form-group" style={{ flex: 1, margin: 0 }}><label>Confirm New Password</label><input type="password" required placeholder="Match new key" value={passwordForm.confirm} onChange={(event) => setPasswordForm((form) => ({ ...form, confirm: event.target.value }))} /></div></div><div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><button type="submit" style={darkButton}>Update Security Key</button>{passwordForm.message && <span style={{ fontSize: '0.85rem', fontWeight: 500, color: passwordForm.color }}>{passwordForm.message}</span>}</div></form></div></div>
    </section>
  );
}

function RestaurantsView({ data, filters, setFilter, getRestaurantDisplay, activeReservations, totalCapacity }) {
  const rows = data.restaurants.map(getRestaurantDisplay).filter((r) => (!filters.restaurants || r.name.toLowerCase().includes(filters.restaurants.toLowerCase()) || r.city.toLowerCase().includes(filters.restaurants.toLowerCase()) || r.id.toLowerCase().includes(filters.restaurants.toLowerCase()) || r.managerName.toLowerCase().includes(filters.restaurants.toLowerCase())) && (!filters.restaurantStatus || r.status === filters.restaurantStatus));
  return <section className="dashboard-view"><div className="dashboard-header"><div><h1>Restaurant Management</h1><p>Read-only directory. Restaurant details are managed by their owning manager.</p></div></div><div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}><Kpi color="#5F7A61" label="Total Restaurants" value={data.restaurants.length} /><Kpi color="#1976D2" label="Active Bookings" value={activeReservations.length} /><Kpi color="#F57F17" label="Capacity" value={`${totalCapacity} seats`} /></div><FilterBar><SearchInput value={filters.restaurants} onChange={(value) => setFilter('restaurants', value)} placeholder="Search Restaurants by name, city, or ID..." /><Select value={filters.restaurantStatus} onChange={(value) => setFilter('restaurantStatus', value)} options={['', 'Verified', 'Pending']} labels={['All Statuses', 'Verified', 'Pending']} /></FilterBar><Table headers={['Restaurant', 'Capacity & Bookings', 'Restaurant Manager', 'Status']} rows={rows.map((r) => <tr key={r.id}><td><code style={{ color: 'var(--text-muted)' }}>{r.id}</code><br /><b style={{ display: 'inline-block', marginTop: 4 }}>{r.name}</b><br /><span style={muted}>{r.cuisine} - {r.city}</span></td><td>{r.tables} tables<br /><span style={muted}>{r.activeReservations} active bookings</span></td><td>{r.managerName}</td><td style={{ color: r.status === 'Verified' ? '#2E7D32' : '#F57F17', fontWeight: 700 }}>{r.status}</td></tr>)} /></section>;
}

function UsersView({ data, filters, setFilter, getUserDisplay }) {
  const rows = data.users.filter((u) => !['super_user', 'support_admin', 'finance_admin', 'verification_admin'].includes(u.role)).map(getUserDisplay).filter((u) => (!filters.users || u.id.toLowerCase().includes(filters.users.toLowerCase()) || u.name.toLowerCase().includes(filters.users.toLowerCase()) || u.email.toLowerCase().includes(filters.users.toLowerCase()) || u.role.toLowerCase().includes(filters.users.toLowerCase())) && (!filters.userRole || u.role === filters.userRole) && (!filters.userStatus || u.status === filters.userStatus));
  return <section className="dashboard-view"><div className="dashboard-header"><div><h1>User Management</h1><p>Read-only directory of Diners, Restaurant Managers, and Restaurant Staff.</p></div></div><FilterBar><SearchInput value={filters.users} onChange={(value) => setFilter('users', value)} placeholder="Search Users by ID, name, email, or role..." /><Select value={filters.userRole} onChange={(value) => setFilter('userRole', value)} options={['', 'Diner', 'Restaurant Manager', 'Restaurant Staff']} labels={['All Roles', 'Diner', 'Restaurant Manager', 'Restaurant Staff']} /><Select value={filters.userStatus} onChange={(value) => setFilter('userStatus', value)} options={['', 'Active', 'Suspended']} labels={['All Statuses', 'Active', 'Suspended']} /></FilterBar><Table headers={['User Details', 'System Role', 'Linked Restaurant', 'Account Status']} rows={rows.map((u) => <tr key={u.id}><td><code style={{ color: 'var(--text-muted)' }}>{u.id}</code><br /><b style={{ display: 'inline-block', marginTop: 4 }}>{u.name}</b><br /><span style={muted}>{u.email}</span></td><td>{u.role}</td><td>{u.node}</td><td style={{ color: u.status === 'Active' ? '#2E7D32' : '#C62828', fontWeight: 700 }}>{u.status}</td></tr>)} /></section>;
}

function ReservationsView({ data, filters, setFilter, getReservationDisplay }) {
  const rows = data.reservations.map(getReservationDisplay).filter((r) => (!filters.resDate || r.date === filters.resDate) && (!filters.resStatus || r.status === filters.resStatus) && (!filters.resQuery || ({ restaurantName: r.restaurantName, restaurantId: r.restaurantId, dinerName: r.dinerName, dinerId: r.dinerId }[filters.resType] || '').toLowerCase().includes(filters.resQuery.toLowerCase())));
  return <section className="dashboard-view"><div className="dashboard-header"><div><h1>Reservations</h1><p>Read-only view of bookings, check-ins, and no-shows globally.</p></div></div><FilterBar><div className="form-group" style={{ margin: 0, flex: 1 }}><input type="date" value={filters.resDate} onChange={(event) => setFilter('resDate', event.target.value)} style={{ marginBottom: 0 }} /></div><Select value={filters.resType} onChange={(value) => setFilter('resType', value)} options={['restaurantName', 'restaurantId', 'dinerName', 'dinerId']} labels={['Restaurant Name', 'Restaurant ID', 'Diner Name', 'Diner ID']} /><SearchInput value={filters.resQuery} onChange={(value) => setFilter('resQuery', value)} placeholder="Type to search..." /><Select value={filters.resStatus} onChange={(value) => setFilter('resStatus', value)} options={['', 'Booking', 'Customer Check-In', 'No-Show', 'Completed']} labels={['All Booking Statuses', 'Booking', 'Customer Check-In', 'No-Show', 'Completed']} /></FilterBar><Table headers={['Booking ID & Date', 'Diner', 'Restaurant', 'Party Size', 'Booking Status']} rows={rows.map((r) => <tr key={r.id}><td><code style={{ color: 'var(--text-muted)' }}>{r.id}</code><br /><span style={{ fontSize: '0.75rem' }}>{r.date} {r.time}</span></td><td><code style={chip}>{r.dinerId}</code><br /><b style={{ display: 'inline-block', marginTop: 4 }}>{r.dinerName}</b></td><td><code style={chip}>{r.restaurantId}</code><br /><b style={{ display: 'inline-block', marginTop: 4 }}>{r.restaurantName}</b></td><td>{r.party}</td><td><ReservationBadge status={r.status} /></td></tr>)} /></section>;
}

function NotificationsView({ sendBroadcast }) {
  return <section className="dashboard-view"><div className="dashboard-header"><div><h1>Broadcast Center</h1><p>Send platform-wide alerts.</p></div></div><div className="panel" style={{ maxWidth: '100%' }}><div className="panel-head"><div className="panel-title">Compose Message</div></div><div className="panel-body" style={{ padding: '1.5rem' }}><form onSubmit={sendBroadcast}><div className="form-group" style={{ marginBottom: '1.2rem' }}><label>Target Audience</label><select name="audience" required><option value="all">All Users</option><option value="diners">Diners Only</option><option value="managers">Restaurant Managers Only</option><option value="staff">Restaurant Staff Only</option></select></div><div className="form-group" style={{ marginBottom: '1.5rem' }}><label>Message</label><textarea name="message" rows="4" required placeholder="Type broadcast message..." style={{ resize: 'vertical' }} /></div><button type="submit" style={{ ...greenButton, display: 'inline-flex', alignItems: 'center', gap: 8 }}><i className="fa-solid fa-bullhorn" style={{ color: '#fca5a5' }} /> Send Broadcast</button></form></div></div></section>;
}

function SubAdminsView({ data, openSubAdminModal, toggleSubAdminStatus, deleteSubAdmin }) {
  const counts = { support: 0, finance: 0, verification: 0 };
  data.subAdmins.forEach((admin) => { if (counts[admin.team] !== undefined) counts[admin.team] += 1; });
  return <section className="dashboard-view"><div className="dashboard-header"><div><h1>Sub-Admin Teams</h1><p>Create and manage Customer Support, Finance, and Verification team accounts.</p></div><button className="btn-primary" onClick={openSubAdminModal}><i className="fa-solid fa-user-plus" /> Add Sub-Admin</button></div><div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}><Kpi color="#1976D2" label="Customer Support Team" value={counts.support} /><Kpi color="#F57F17" label="Finance Team" value={counts.finance} /><Kpi color="#6A1B9A" label="Verification Team" value={counts.verification} /></div><Table headers={['Name & Email', 'Team', 'Status', 'Created', 'Actions']} rows={data.subAdmins.map((admin) => <tr key={admin.id}><td><strong>{admin.name}</strong><br /><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{admin.email}</span></td><td>{TEAM_LABELS[admin.team] || admin.team}{admin.team === 'verification' && admin.location_id ? <><br /><span style={muted}>{admin.location_id}</span></> : null}</td><td>{mapUserStatus(admin.status)}</td><td>{new Date(admin.created_at).toLocaleDateString('en-GB')}</td><td style={{ textAlign: 'right' }}><button className="btn-sm btn-outline" onClick={() => toggleSubAdminStatus(admin.id, admin.status)}>{admin.status === 'active' ? 'Suspend' : 'Activate'}</button> <button className="btn-sm btn-outline" style={{ color: '#C1121F' }} onClick={() => deleteSubAdmin(admin.id)}><i className="fa-solid fa-trash" /></button></td></tr>)} empty="No sub-admin accounts yet." /></section>;
}

function EscalatedView({ data, setResolveTicket }) {
  const escalated = data.tickets.filter((ticket) => ticket.status === 'escalated_super_admin');
  return <section className="dashboard-view"><div className="dashboard-header"><div><h1>Escalated Issues</h1><p>Technical issues the Customer Support team has escalated to you. All other tickets are visible below for reference only.</p></div></div><div className="panel"><div className="panel-head"><div className="panel-title">Needs Your Action</div></div><table style={{ margin: 0, width: '100%' }}><thead><tr><th>Ticket</th><th>Raised By</th><th>Subject</th><th>Support Notes</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead><tbody>{escalated.length ? escalated.map((ticket) => <tr key={ticket.id}><td>{ticket.id}</td><td>{ticket.raised_by_role === 'diner' ? 'Diner' : 'Restaurant Manager'} ({ticket.raised_by_user_id})</td><td>{ticket.subject}<br /><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{ticket.description}</span></td><td>{ticket.resolution_notes || '-'}</td><td style={{ textAlign: 'right' }}><button className="btn-sm btn-outline" onClick={() => setResolveTicket({ open: true, id: ticket.id, notes: '' })}>Resolve</button></td></tr>) : <tr><td colSpan="5" style={emptyCell}>No issues currently escalated to you.</td></tr>}</tbody></table></div><div className="panel" style={{ marginTop: '1.5rem' }}><div className="panel-head"><div className="panel-title">All Support Tickets (View Only)</div></div><table style={{ margin: 0, width: '100%' }}><thead><tr><th>Ticket</th><th>Raised By</th><th>Category</th><th>Subject</th><th>Status</th></tr></thead><tbody>{data.tickets.length ? data.tickets.map((ticket) => <tr key={ticket.id}><td>{ticket.id}</td><td>{ticket.raised_by_role === 'diner' ? 'Diner' : 'Restaurant Manager'}</td><td style={{ textTransform: 'capitalize' }}>{ticket.category}</td><td>{ticket.subject}</td><td>{TICKET_STATUS_LABELS[ticket.status] || ticket.status}</td></tr>) : <tr><td colSpan="5" style={emptyCell}>No support tickets yet.</td></tr>}</tbody></table></div></section>;
}

function SubAdminModal({ open, close, form, setForm, locations, save, createNewLocation }) {
  if (!open) return null;
  return <div className="modal-overlay open"><div className="modal-content" style={{ maxWidth: 450 }}><h2 style={modalTitle}>Add Sub-Admin</h2><form onSubmit={save}><div className="form-group"><label>Full Name *</label><input required value={form.name} onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))} /></div><div className="form-group"><label>Email Address *</label><input type="email" required value={form.email} onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))} /></div><div className="form-group"><label>Password *</label><input type="password" minLength="6" required placeholder="Set the login password" value={form.password} onChange={(event) => setForm((f) => ({ ...f, password: event.target.value }))} /></div><div className="form-group"><label>Team *</label><select required value={form.team} onChange={(event) => setForm((f) => ({ ...f, team: event.target.value }))}><option value="support">Customer Support</option><option value="finance">Finance Team</option><option value="verification">Verification Team</option></select></div>{form.team === 'verification' && <div className="form-group"><label>Assigned Location *</label><select value={form.location_id} onChange={(event) => setForm((f) => ({ ...f, location_id: event.target.value }))}><option value="">Select a location</option>{locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.city} - {loc.address}</option>)}</select><button type="button" onClick={() => setForm((f) => ({ ...f, showNewLocation: !f.showNewLocation }))} style={linkButton}><i className="fa-solid fa-plus" /> {form.showNewLocation ? 'Cancel' : 'Add a new location'}</button>{form.showNewLocation && <div style={{ border: '1px solid var(--border-light)', borderRadius: 8, padding: '0.9rem', marginTop: '0.4rem', background: 'var(--bg-light)' }}><div className="form-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.8rem' }}>City *</label><input placeholder="e.g. Pune" value={form.city} onChange={(event) => setForm((f) => ({ ...f, city: event.target.value }))} /></div><div className="form-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.8rem' }}>Area / Address *</label><input placeholder="e.g. Koregaon Park, Pune" value={form.address} onChange={(event) => setForm((f) => ({ ...f, address: event.target.value }))} /></div><div style={{ display: 'flex', gap: '0.6rem' }}><div className="form-group" style={{ flex: 1 }}><label style={{ fontSize: '0.8rem' }}>Pincode *</label><input maxLength="6" placeholder="560001" value={form.pincode} onChange={(event) => setForm((f) => ({ ...f, pincode: event.target.value.replace(/[^0-9]/g, '') }))} /></div><div className="form-group" style={{ flex: 1 }}><label style={{ fontSize: '0.8rem' }}>Country *</label><input value={form.country} onChange={(event) => setForm((f) => ({ ...f, country: event.target.value }))} /></div></div><button type="button" onClick={createNewLocation} className="btn-sm" style={{ ...greenButton, fontSize: '0.8rem' }}>Create Location</button></div>}</div>}<div className="modal-actions" style={modalActions}><button type="button" onClick={close} className="btn-outline" style={{ padding: '0.6rem 1.2rem', borderRadius: 6 }}>Cancel</button><button type="submit" style={greenButton}>Save Sub-Admin</button></div></form></div></div>;
}

function ResolveModal({ resolveTicket, setResolveTicket, resolveEscalated }) {
  if (!resolveTicket.open) return null;
  return <div className="modal-overlay open"><div className="modal-content" style={{ maxWidth: 480 }}><h2 style={modalTitle}>Resolve Escalated Ticket</h2><form onSubmit={resolveEscalated}><div className="form-group"><label>Resolution Notes *</label><textarea rows="4" required placeholder="Explain what was done to resolve this." value={resolveTicket.notes} onChange={(event) => setResolveTicket((current) => ({ ...current, notes: event.target.value }))} /></div><div className="modal-actions" style={modalActions}><button type="button" onClick={() => setResolveTicket({ open: false, id: '', notes: '' })} className="btn-outline" style={{ padding: '0.6rem 1.2rem', borderRadius: 6 }}>Cancel</button><button type="submit" style={greenButton}>Mark Resolved</button></div></form></div></div>;
}

function Kpi({ color, label, value, small, valueStyle }) {
  return <div className="kpi-card" style={{ borderLeftColor: color }}><h4 style={small ? { fontSize: '0.65rem' } : undefined}>{label}</h4><p className="value" style={valueStyle}>{value}</p></div>;
}

function Table({ headers, rows, empty = 'No records found.' }) {
  return <div className="table-container"><table><thead><tr>{headers.map((header) => <th key={header} style={header === 'Actions' ? { textAlign: 'right' } : undefined}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows : <tr><td colSpan={headers.length} style={emptyCell}>{empty}</td></tr>}</tbody></table></div>;
}

function FilterBar({ children }) {
  return <div className="filter-bar" style={{ marginBottom: '1.5rem' }}>{children}</div>;
}

function SearchInput({ value, onChange, placeholder }) {
  return <div className="form-group" style={{ margin: 0, flex: 1, position: 'relative' }}><i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)', fontSize: '0.9rem' }} /><input type="text" placeholder={placeholder} style={{ paddingLeft: 35, width: '100%', marginBottom: 0 }} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function Select({ value, onChange, options, labels }) {
  return <div className="form-group" style={{ margin: 0, minWidth: 180 }}><select value={value} onChange={(event) => onChange(event.target.value)} style={{ marginBottom: 0, width: '100%' }}>{options.map((option, index) => <option key={option || 'all'} value={option}>{labels[index]}</option>)}</select></div>;
}

function QuickAction({ icon, color, label, onClick }) {
  return <button className="btn-outline" onClick={onClick} style={{ textAlign: 'left', padding: '0.8rem', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-light)', border: '1px solid var(--border-light)' }}><i className={`fa-solid ${icon}`} style={{ color }} /> <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-dark)' }}>{label}</span></button>;
}

function RecentActivity({ reservation, data, divider }) {
  const user = data.users.find((u) => u.id === reservation.user_id);
  const restaurant = data.restaurants.find((r) => r.id === reservation.restaurant_id);
  return <div style={{ display: 'flex', gap: '1rem', padding: '1rem 1.25rem', borderBottom: divider ? '1px solid var(--border-light)' : undefined, alignItems: 'center' }}><i className="fa-solid fa-calendar-check" style={{ color: '#1976D2', fontSize: '1.1rem', width: 20, textAlign: 'center' }} /><div style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-dark)' }}>New reservation: {user?.name || 'A diner'} at {restaurant?.name || 'a restaurant'}</div></div>;
}

function ReservationBadge({ status }) {
  if (status === 'Customer Check-In') return <span className="badge badge-green"><i className="fa-solid fa-check" /> Check-In</span>;
  if (status === 'No-Show') return <span className="badge badge-red"><i className="fa-solid fa-triangle-exclamation" /> No-Show</span>;
  if (status === 'Completed') return <span className="badge badge-green"><i className="fa-solid fa-flag-checkered" /> Completed</span>;
  return <span className="badge badge-blue"><i className="fa-solid fa-calendar" /> Booking</span>;
}

const muted = { fontSize: '0.75rem', color: 'var(--text-muted)' };
const chip = { background: '#f0f0f0', padding: '2px 4px', borderRadius: 4, color: 'var(--text-muted)', fontSize: '0.7rem' };
const emptyCell = { textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' };
const darkButton = { background: 'var(--text-dark)', color: 'white', padding: '0.6rem 1.2rem', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' };
const greenButton = { background: 'var(--primary-green)', color: 'white', padding: '0.6rem 1.2rem', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 };
const modalTitle = { marginTop: 0, borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', fontSize: '1.2rem' };
const modalActions = { borderTop: '1px solid var(--border-light)', paddingTop: '1.2rem', marginTop: '0.5rem' };
const linkButton = { background: 'none', border: 'none', color: 'var(--primary-green)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: '0.4rem 0', textAlign: 'left' };
