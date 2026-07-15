const CONFIG_KEY = 'iodCdpConfig';
const REGISTRATIONS_KEY = 'iodCdpRegistrations';
const AUTH_SESSION_KEY = 'iodCdpAdminAuthenticated';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30000;

const DEFAULT_CONFIG = {
  eyebrow: 'Institute of Directors-Ghana presents',
  title: 'Continuous Development Program',
  edition: '2026.',
  description: 'Register for the upcoming Continuous Development Program hosted by the Institute of Directors-Ghana. Complete your details and confirm payment to secure your place.',
  date: 'See official poster',
  time: 'See official poster',
  venue: 'IoD-Ghana',
  fee: '—',
  paymentAmount: '—',
  momoNetwork: 'See official poster',
  momoNumber: 'Use number on poster',
  momoAccountName: 'INSTITUTE OF DIRECTORS-GHANA',
  bankAccounts: [{
    id: 'bank-1',
    bankName: 'See official poster',
    branch: '',
    accountName: 'INSTITUTE OF DIRECTORS-GHANA',
    accountNumber: 'Use account on poster'
  }],
  registrationOpen: true,
  showPoster: true,
  showEventDetails: true,
  showFee: true,
  posterDataUrl: ''
};

const headings = {
  overview: 'Dashboard overview',
  content: 'Programme content',
  payments: 'Payment settings',
  registrations: 'Registrations',
  security: 'Security'
};

const fieldMap = {
  adminEyebrow: 'eyebrow',
  adminTitle: 'title',
  adminEdition: 'edition',
  adminDescription: 'description',
  adminDate: 'date',
  adminTime: 'time',
  adminVenue: 'venue',
  adminFee: 'fee',
  adminPaymentAmount: 'paymentAmount',
  adminMomoNetwork: 'momoNetwork',
  adminMomoNumber: 'momoNumber',
  adminMomoAccountName: 'momoAccountName'
};

let config = readJson(CONFIG_KEY, DEFAULT_CONFIG);
if (config.title === 'CDP') config.title = 'Continuous Development Program';
if (config.fee === 'See poster') config.fee = '—';
if (config.paymentAmount === 'See official poster') config.paymentAmount = '—';
if (!Array.isArray(config.bankAccounts) || !config.bankAccounts.length) {
  config.bankAccounts = [...DEFAULT_CONFIG.bankAccounts];
}
let registrations = readJson(REGISTRATIONS_KEY, []);
let posterDataUrl = config.posterDataUrl || '';
let failedLoginAttempts = 0;
let lockedUntil = 0;
let pendingDeletion = null;
let deleteTrigger = null;

function revealDashboard() {
  document.querySelector('#loginScreen').hidden = true;
  document.querySelector('#adminShell').hidden = false;
}

function revealLogin() {
  document.querySelector('#adminShell').hidden = true;
  document.querySelector('#loginScreen').hidden = false;
  document.querySelector('#adminPassword').value = '';
  document.querySelector('#adminPassword').focus();
}

async function handleLogin(event) {
  event.preventDefault();
  const error = document.querySelector('#loginError');
  const button = document.querySelector('#loginButton');
  const now = Date.now();

  if (now < lockedUntil) {
    error.textContent = `Too many attempts. Try again in ${Math.ceil((lockedUntil - now) / 1000)} seconds.`;
    return;
  }

  button.disabled = true;
  error.textContent = '';
  const submittedHash = await hashPassword(document.querySelector('#adminPassword').value);
  button.disabled = false;

  if (submittedHash === getAdminPasswordHash()) {
    failedLoginAttempts = 0;
    sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
    revealDashboard();
    return;
  }

  failedLoginAttempts += 1;
  document.querySelector('#adminPassword').value = '';
  if (failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
    failedLoginAttempts = 0;
    lockedUntil = Date.now() + LOCKOUT_DURATION;
    error.textContent = 'Too many attempts. Sign-in is locked for 30 seconds.';
  } else {
    error.textContent = `Incorrect password. ${MAX_LOGIN_ATTEMPTS - failedLoginAttempts} attempts remaining.`;
  }
  document.querySelector('#adminPassword').focus();
}

async function changeAdminPassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const currentPassword = document.querySelector('#currentAdminPassword').value;
  const newPassword = document.querySelector('#newAdminPassword').value;
  const confirmation = document.querySelector('#confirmAdminPassword').value;
  const message = document.querySelector('#passwordChangeMessage');
  const button = document.querySelector('#changePasswordButton');

  message.className = 'password-change-message';
  message.textContent = '';

  if (!currentPassword || !newPassword || !confirmation) {
    message.textContent = 'Complete all password fields.';
    return;
  }

  if (newPassword.length < 4) {
    message.textContent = 'The new password must contain at least 4 characters.';
    return;
  }

  if (newPassword !== confirmation) {
    message.textContent = 'The new passwords do not match.';
    return;
  }

  button.disabled = true;
  const [currentHash, newHash] = await Promise.all([
    hashPassword(currentPassword),
    hashPassword(newPassword)
  ]);
  button.disabled = false;

  if (currentHash !== getAdminPasswordHash()) {
    message.textContent = 'The current password is incorrect.';
    document.querySelector('#currentAdminPassword').focus();
    return;
  }

  if (currentHash === newHash) {
    message.textContent = 'Choose a new password that is different from the current password.';
    document.querySelector('#newAdminPassword').focus();
    return;
  }

  localStorage.setItem(ADMIN_PASSWORD_HASH_KEY, newHash);
  form.reset();
  message.classList.add('success');
  message.textContent = 'Password updated. Signing you out…';
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  window.setTimeout(() => {
    revealLogin();
    openSection('overview');
    message.className = 'password-change-message';
    message.textContent = '';
  }, 900);
}

function logout() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  revealLogin();
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ? (Array.isArray(fallback) ? value : { ...fallback, ...value }) : (Array.isArray(fallback) ? [...fallback] : { ...fallback });
  } catch {
    return Array.isArray(fallback) ? [...fallback] : { ...fallback };
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function showToast(message) {
  const toast = document.querySelector('#adminToast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 2200);
}

function formatGhs(value) {
  const amount = String(value || '—').trim();
  return /^GHS\b/i.test(amount) ? amount : `GHS ${amount}`;
}

function openSection(sectionName) {
  document.querySelectorAll('.dashboard-section').forEach((section) => {
    section.classList.toggle('active', section.dataset.page === sectionName);
  });
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.section === sectionName);
  });
  document.querySelector('#pageHeading').textContent = headings[sectionName];
  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSidebar() {
  document.querySelector('#sidebar').classList.add('open');
  document.querySelector('#sidebarOverlay').classList.add('visible');
  document.querySelector('#menuButton').setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
  document.querySelector('#sidebar').classList.remove('open');
  document.querySelector('#sidebarOverlay').classList.remove('visible');
  document.querySelector('#menuButton').setAttribute('aria-expanded', 'false');
}

function createBankId() {
  return `bank-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

function updateBankRemoveButtons() {
  const buttons = [...document.querySelectorAll('.remove-bank-button')];
  buttons.forEach((button) => {
    button.disabled = buttons.length === 1;
    button.title = buttons.length === 1 ? 'At least one bank account is required' : 'Remove this bank';
  });
}

function addBankAccountEditor(account = {}) {
  const list = document.querySelector('#bankAccountsList');
  const editor = document.createElement('article');
  editor.className = 'bank-account-editor';
  editor.dataset.bankId = account.id || createBankId();
  editor.innerHTML = `
    <div class="bank-account-editor-head"><strong></strong><button class="remove-bank-button" type="button">Remove</button></div>
    <div class="admin-grid two">
      <div class="admin-field"><label>Bank name</label><input data-bank-field="bankName" type="text"></div>
      <div class="admin-field"><label>Branch <small>(optional)</small></label><input data-bank-field="branch" type="text"></div>
      <div class="admin-field"><label>Account name</label><input data-bank-field="accountName" type="text"></div>
      <div class="admin-field"><label>Account number</label><input data-bank-field="accountNumber" type="text"></div>
    </div>`;

  editor.querySelector('[data-bank-field="bankName"]').value = account.bankName || '';
  editor.querySelector('[data-bank-field="branch"]').value = account.branch || '';
  editor.querySelector('[data-bank-field="accountName"]').value = account.accountName || '';
  editor.querySelector('[data-bank-field="accountNumber"]').value = account.accountNumber || '';
  editor.querySelector('.remove-bank-button').addEventListener('click', () => {
    editor.remove();
    renumberBankEditors();
    updateBankRemoveButtons();
  });
  list.append(editor);
  renumberBankEditors();
  updateBankRemoveButtons();
}

function renumberBankEditors() {
  document.querySelectorAll('.bank-account-editor').forEach((editor, index) => {
    editor.querySelector('.bank-account-editor-head strong').textContent = `Bank account ${index + 1}`;
  });
}

function renderBankAccounts() {
  document.querySelector('#bankAccountsList').replaceChildren();
  config.bankAccounts.forEach((account) => addBankAccountEditor(account));
}

function collectBankAccounts() {
  return [...document.querySelectorAll('.bank-account-editor')].map((editor) => ({
    id: editor.dataset.bankId,
    bankName: editor.querySelector('[data-bank-field="bankName"]').value.trim(),
    branch: editor.querySelector('[data-bank-field="branch"]').value.trim(),
    accountName: editor.querySelector('[data-bank-field="accountName"]').value.trim(),
    accountNumber: editor.querySelector('[data-bank-field="accountNumber"]').value.trim()
  }));
}

function populateForms() {
  Object.entries(fieldMap).forEach(([id, key]) => {
    document.querySelector(`#${id}`).value = config[key] || '';
  });
  document.querySelector('#adminRegistrationOpen').checked = config.registrationOpen;
  document.querySelector('#adminShowPoster').checked = config.showPoster;
  document.querySelector('#adminShowEventDetails').checked = config.showEventDetails;
  document.querySelector('#adminShowFee').checked = config.showFee;
  updateDescriptionCount();
  renderPosterPreview();
  renderBankAccounts();
}

function collectConfig() {
  Object.entries(fieldMap).forEach(([id, key]) => {
    config[key] = document.querySelector(`#${id}`).value.trim();
  });
  config.registrationOpen = document.querySelector('#adminRegistrationOpen').checked;
  config.showPoster = document.querySelector('#adminShowPoster').checked;
  config.showEventDetails = document.querySelector('#adminShowEventDetails').checked;
  config.showFee = document.querySelector('#adminShowFee').checked;
  config.posterDataUrl = posterDataUrl;
  config.bankAccounts = collectBankAccounts();
  return config;
}

function saveAll() {
  try {
    collectConfig();
    writeJson(CONFIG_KEY, config);
    updateDashboard();
    showToast('Changes saved to the public page');
  } catch (error) {
    showToast(error.name === 'QuotaExceededError' ? 'Poster is too large to save' : 'Could not save changes');
  }
}

function updateDescriptionCount() {
  document.querySelector('#descriptionCount').textContent = document.querySelector('#adminDescription').value.length;
}

function renderPosterPreview() {
  const preview = document.querySelector('#adminPosterPreview');
  preview.replaceChildren();
  if (!posterDataUrl) {
    const label = document.createElement('span');
    label.textContent = 'Poster preview';
    preview.append(label);
    return;
  }
  const image = document.createElement('img');
  image.src = posterDataUrl;
  image.alt = 'Selected CDP poster preview';
  preview.append(image);
}

function updateDashboard() {
  const pending = registrations.filter((item) => item.status !== 'Verified').length;
  const verified = registrations.filter((item) => item.status === 'Verified').length;
  document.querySelector('#totalRegistrations').textContent = registrations.length;
  document.querySelector('#pendingRegistrations').textContent = pending;
  document.querySelector('#verifiedRegistrations').textContent = verified;
  document.querySelector('#navRegistrationCount').textContent = registrations.length;
  document.querySelector('#summaryTitle').textContent = `${config.title} ${config.edition}`.trim();
  document.querySelector('#summaryDate').textContent = config.date;
  document.querySelector('#summaryTime').textContent = config.time;
  document.querySelector('#summaryVenue').textContent = config.venue;
  document.querySelector('#summaryFee').textContent = formatGhs(config.fee);

  const status = document.querySelector('#publishStatus');
  status.classList.toggle('closed', !config.registrationOpen);
  status.lastChild.textContent = config.registrationOpen ? ' Registration open' : ' Registration closed';
  renderRecentRegistrations();
  renderRegistrations(document.querySelector('#registrationSearch').value);
}

function initials(item) {
  return `${item.firstName?.[0] || ''}${item.lastName?.[0] || ''}`.toUpperCase() || 'CD';
}

function displayName(item) {
  return [item.title, item.firstName, item.lastName].filter(Boolean).join(' ');
}

function renderRecentRegistrations() {
  const list = document.querySelector('#recentRegistrations');
  list.replaceChildren();
  if (!registrations.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-small';
    empty.textContent = 'No registrations yet.';
    list.append(empty);
    return;
  }

  registrations.slice(0, 4).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'recent-item';
    const avatar = document.createElement('span');
    avatar.className = 'recent-avatar';
    avatar.textContent = initials(item);
    const details = document.createElement('p');
    const name = document.createElement('strong');
    name.textContent = displayName(item);
    const reference = document.createElement('small');
    reference.textContent = [item.paymentProvider, item.reference].filter(Boolean).join(' · ');
    details.append(name, reference);
    const status = document.createElement('span');
    status.className = `status-badge ${item.status === 'Verified' ? 'verified' : ''}`;
    status.textContent = item.status || 'Pending';
    row.append(avatar, details, status);
    list.append(row);
  });
}

function renderRegistrations(searchTerm = '') {
  const body = document.querySelector('#registrationsTable');
  body.replaceChildren();
  const term = searchTerm.trim().toLowerCase();
  const filtered = registrations.filter((item) => {
    const haystack = `${item.title || ''} ${item.firstName} ${item.lastName} ${item.email} ${item.organization || ''} ${item.whatsapp} ${item.reference} ${item.transactionId}`.toLowerCase();
    return haystack.includes(term);
  });

  if (!filtered.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'empty-table';
    cell.textContent = term ? 'No registrations match your search.' : 'No registrations have been submitted.';
    row.append(cell);
    body.append(row);
    return;
  }

  filtered.forEach((item) => {
    const row = document.createElement('tr');
    const participant = document.createElement('td');
    participant.className = 'participant-cell';
    participant.dataset.label = 'Participant';
    const participantName = document.createElement('strong');
    participantName.textContent = displayName(item);
    const participantEmail = document.createElement('small');
    participantEmail.textContent = [item.email, item.organization].filter(Boolean).join(' · ');
    participant.append(participantName, participantEmail);

    const whatsapp = document.createElement('td');
    whatsapp.dataset.label = 'WhatsApp';
    whatsapp.textContent = `+233 ${item.whatsapp}`;

    const transaction = document.createElement('td');
    transaction.dataset.label = 'Transaction';
    const transactionId = document.createElement('span');
    transactionId.className = 'transaction-id';
    transactionId.textContent = item.transactionId;
    const reference = document.createElement('span');
    reference.className = 'reference-text';
    reference.textContent = item.reference;
    transaction.append(transactionId, reference);

    const submitted = document.createElement('td');
    submitted.dataset.label = 'Submitted';
    submitted.textContent = new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.submittedAt));

    const statusCell = document.createElement('td');
    statusCell.dataset.label = 'Status';
    const select = document.createElement('select');
    select.className = `status-select ${item.status === 'Verified' ? 'verified' : ''}`;
    select.setAttribute('aria-label', `Status for ${displayName(item)}`);
    ['Pending', 'Verified'].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      option.selected = item.status === value;
      select.append(option);
    });
    select.addEventListener('change', () => updateRegistrationStatus(item.reference, select.value));
    statusCell.append(select);

    const actions = document.createElement('td');
    actions.dataset.label = 'Actions';
    if (item.receiptName) {
      const receiptButton = document.createElement('button');
      receiptButton.className = 'view-receipt-button';
      receiptButton.type = 'button';
      receiptButton.textContent = 'View receipt';
      receiptButton.setAttribute('aria-label', `View payment receipt for ${displayName(item)}`);
      receiptButton.addEventListener('click', () => viewReceipt(item.reference));
      actions.append(receiptButton);
    }
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-registration-button';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', `Delete registration for ${displayName(item)}`);
    deleteButton.addEventListener('click', () => deleteRegistration(item.reference, displayName(item)));
    actions.append(deleteButton);
    row.append(participant, whatsapp, transaction, submitted, statusCell, actions);
    body.append(row);
  });
}

function deleteRegistration(reference, participantName) {
  pendingDeletion = reference;
  deleteTrigger = document.activeElement;
  document.querySelector('#deleteParticipantName').textContent = participantName;
  document.querySelector('#deleteModal').hidden = false;
  document.querySelector('#cancelDeleteButton').focus();
}

async function viewReceipt(reference) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  try {
    const response = await fetch(`/api/admin/registrations/${encodeURIComponent(reference)}/receipt`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Could not load this receipt.');
    const url = URL.createObjectURL(await response.blob());
    window.open(url, '_blank', 'noopener');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    showToast(error.message || 'Could not load this receipt.');
  }
}

function closeDeleteModal() {
  document.querySelector('#deleteModal').hidden = true;
  pendingDeletion = null;
  deleteTrigger?.focus();
  deleteTrigger = null;
}

function confirmRegistrationDeletion() {
  if (!pendingDeletion) return;
  registrations = registrations.filter((item) => item.reference !== pendingDeletion);
  writeJson(REGISTRATIONS_KEY, registrations);
  document.querySelector('#deleteModal').hidden = true;
  pendingDeletion = null;
  deleteTrigger = null;
  updateDashboard();
  showToast('Registration deleted');
}

function updateRegistrationStatus(reference, status) {
  const registration = registrations.find((item) => item.reference === reference);
  if (!registration) return;
  registration.status = status;
  writeJson(REGISTRATIONS_KEY, registrations);
  updateDashboard();
  showToast(`Registration marked ${status.toLowerCase()}`);
}

const ADMIN_TOKEN_KEY = 'iodCdpAdminToken';

async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) logout();
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Request failed.');
  return response.status === 204 ? null : response.json();
}

async function loadAdminData() {
  [config, registrations] = await Promise.all([apiRequest('/api/config'), apiRequest('/api/admin/registrations')]);
  config = { ...DEFAULT_CONFIG, ...config };
  posterDataUrl = config.posterDataUrl || '';
  populateForms();
  updateDashboard();
}

handleLogin = async function(event) {
  event.preventDefault();
  const error = document.querySelector('#loginError');
  const button = document.querySelector('#loginButton');
  button.disabled = true; error.textContent = '';
  try {
    const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: document.querySelector('#adminPassword').value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not sign in.');
    sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token);
    await loadAdminData();
    revealDashboard();
  } catch (error) { error && (document.querySelector('#loginError').textContent = error.message); }
  finally { button.disabled = false; }
};

logout = function() { sessionStorage.removeItem(ADMIN_TOKEN_KEY); sessionStorage.removeItem(AUTH_SESSION_KEY); revealLogin(); };

saveAll = async function() {
  try { collectConfig(); config = await apiRequest('/api/config', { method: 'PUT', body: JSON.stringify(config) }); updateDashboard(); showToast('Changes saved and published.'); }
  catch (error) { showToast(error.message || 'Could not save changes.'); }
};

changeAdminPassword = async function(event) {
  event.preventDefault();
  const message = document.querySelector('#passwordChangeMessage');
  const newPassword = document.querySelector('#newAdminPassword').value;
  if (newPassword !== document.querySelector('#confirmAdminPassword').value) { message.textContent = 'The new passwords do not match.'; return; }
  try {
    await apiRequest('/api/admin/password', { method: 'PUT', body: JSON.stringify({ currentPassword: document.querySelector('#currentAdminPassword').value, newPassword }) });
    event.currentTarget.reset(); message.className = 'password-change-message success'; message.textContent = 'Password updated.';
  } catch (error) { message.className = 'password-change-message'; message.textContent = error.message; }
};

confirmRegistrationDeletion = async function() {
  if (!pendingDeletion) return;
  try { await apiRequest(`/api/admin/registrations/${encodeURIComponent(pendingDeletion)}`, { method: 'DELETE' }); registrations = registrations.filter((item) => item.reference !== pendingDeletion); closeDeleteModal(); updateDashboard(); showToast('Registration deleted.'); }
  catch (error) { showToast(error.message || 'Could not delete registration.'); }
};

updateRegistrationStatus = async function(reference, status) {
  try { await apiRequest(`/api/admin/registrations/${encodeURIComponent(reference)}`, { method: 'PATCH', body: JSON.stringify({ status }) }); const registration = registrations.find((item) => item.reference === reference); if (registration) registration.status = status; updateDashboard(); showToast(`Registration marked ${status.toLowerCase()}.`); }
  catch (error) { showToast(error.message || 'Could not update registration.'); }
};

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportCsv() {
  if (!registrations.length) {
    showToast('There are no registrations to export');
    return;
  }
  const headings = ['Reference', 'Title', 'First name', 'Last name', 'Organization', 'Email', 'WhatsApp', 'Role', 'Payment method', 'Payment provider', 'Payment phone', 'Transaction ID', 'Status', 'Submitted'];
  const lines = registrations.map((item) => [item.reference, item.title, item.firstName, item.lastName, item.organization, item.email, item.whatsapp, item.role, item.network, item.paymentProvider, item.paymentPhone, item.transactionId, item.status, item.submittedAt].map(csvCell).join(','));
  const blob = new Blob([[headings.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `cdp-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => openSection(item.dataset.section)));
document.querySelectorAll('[data-go-section]').forEach((item) => item.addEventListener('click', () => openSection(item.dataset.goSection)));
document.querySelector('#menuButton').addEventListener('click', () => document.querySelector('#sidebar').classList.contains('open') ? closeSidebar() : openSidebar());
document.querySelector('#sidebarOverlay').addEventListener('click', closeSidebar);
document.querySelector('#saveAllButton').addEventListener('click', saveAll);
document.querySelector('#contentForm').addEventListener('submit', (event) => event.preventDefault());
document.querySelector('#paymentForm').addEventListener('submit', (event) => event.preventDefault());
document.querySelector('#changePasswordForm').addEventListener('submit', changeAdminPassword);
document.querySelector('#showChangePasswords').addEventListener('change', (event) => {
  const inputType = event.currentTarget.checked ? 'text' : 'password';
  ['#currentAdminPassword', '#newAdminPassword', '#confirmAdminPassword'].forEach((selector) => {
    document.querySelector(selector).type = inputType;
  });
});
document.querySelector('#adminDescription').addEventListener('input', updateDescriptionCount);
document.querySelector('#registrationSearch').addEventListener('input', (event) => renderRegistrations(event.target.value));
document.querySelector('#exportButton').addEventListener('click', exportCsv);
document.querySelector('#addBankButton').addEventListener('click', () => addBankAccountEditor());
document.querySelector('#cancelDeleteButton').addEventListener('click', closeDeleteModal);
document.querySelector('#deleteModalBackdrop').addEventListener('click', closeDeleteModal);
document.querySelector('#confirmDeleteButton').addEventListener('click', confirmRegistrationDeletion);
document.querySelector('#loginForm').addEventListener('submit', handleLogin);
document.querySelector('#logoutButton').addEventListener('click', logout);
document.querySelector('#togglePassword').addEventListener('click', (event) => {
  const input = document.querySelector('#adminPassword');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  event.currentTarget.textContent = showing ? 'Show' : 'Hide';
  event.currentTarget.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});

document.querySelector('#adminPoster').addEventListener('change', (event) => {
  const [file] = event.target.files;
  const error = document.querySelector('#posterError');
  error.textContent = '';
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
    event.target.value = '';
    error.textContent = 'Choose a JPG, PNG or WEBP image smaller than 2MB.';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    posterDataUrl = reader.result;
    renderPosterPreview();
  });
  reader.readAsDataURL(file);
});

document.querySelector('#removePosterButton').addEventListener('click', () => {
  posterDataUrl = '';
  document.querySelector('#adminPoster').value = '';
  renderPosterPreview();
  showToast('Poster removed. Save to publish this change.');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !document.querySelector('#deleteModal').hidden) closeDeleteModal();
});

window.addEventListener('storage', (event) => {
  if (event.key === REGISTRATIONS_KEY) {
    registrations = readJson(REGISTRATIONS_KEY, []);
    updateDashboard();
  }
});

populateForms();
updateDashboard();
