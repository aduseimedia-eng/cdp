const form = document.querySelector('#registrationForm');
const steps = [...document.querySelectorAll('.form-step')];
const stepLabel = document.querySelector('.form-card-head .step-label');
const formTitle = document.querySelector('.form-card-head h2');
const formSubtitle = document.querySelector('.form-card-head p');
const progressBars = [...document.querySelectorAll('.form-progress span')];
const processItems = [...document.querySelectorAll('.process-list > div')];
const continueButton = document.querySelector('#continueButton');
const backButton = document.querySelector('#backButton');
const successState = document.querySelector('#successState');
const formHeader = document.querySelector('.form-card-head');
const toast = document.querySelector('#toast');
const receiptInput = document.querySelector('#receipt');
const uploadLabel = document.querySelector('#uploadLabel');
const fileError = document.querySelector('#fileError');
const closedState = document.querySelector('#closedState');

const CONFIG_KEY = 'iodCdpConfig';
const REGISTRATIONS_KEY = 'iodCdpRegistrations';
const REGISTRATION_DRAFT_KEY = 'iodCdpRegistrationDraft';
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

let currentStep = 1;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 2200);
}

function validateField(field) {
  const wrapper = field.closest('.field');
  const isValid = field.checkValidity();
  if (wrapper) wrapper.classList.toggle('invalid', !isValid);
  return isValid;
}

function validateStep(stepNumber) {
  const step = document.querySelector(`[data-step="${stepNumber}"]`);
  const fields = [...step.querySelectorAll('input:not([type="file"]), select')];
  let valid = true;

  fields.forEach((field) => {
    if (!validateField(field)) valid = false;
  });

  const consent = step.querySelector('[name="whatsappConsent"]');
  if (consent) {
    const consentLabel = consent.closest('.check-field');
    const consentError = step.querySelector('.check-error');
    consentLabel.classList.toggle('invalid', !consent.checked);
    consentError.classList.toggle('visible', !consent.checked);
    if (!consent.checked) valid = false;
  }

  if (!valid) {
    const invalidElement = step.querySelector('.invalid input, .invalid select');
    invalidElement?.focus();
  }
  return valid;
}

function setStep(stepNumber, shouldScroll = true) {
  currentStep = stepNumber;
  document.body.classList.toggle('payment-step-active', stepNumber === 2);
  steps.forEach((step) => step.classList.toggle('active', Number(step.dataset.step) === stepNumber));
  progressBars.forEach((bar, index) => bar.classList.toggle('active', index < stepNumber));
  processItems.forEach((item, index) => item.classList.toggle('active', index < stepNumber));
  stepLabel.textContent = `Step ${stepNumber} of 2`;
  formTitle.textContent = stepNumber === 1 ? 'Participant details' : 'Payment confirmation';
  formSubtitle.textContent = stepNumber === 1 ? 'Fields marked with * are required.' : 'Enter the details from your payment receipt.';
  saveRegistrationDraft();
  if (shouldScroll) document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveRegistrationDraft() {
  const fields = {};
  [...form.elements].forEach((field) => {
    if (!field.name || field.type === 'file' || field.type === 'submit' || field.type === 'button') return;
    fields[field.name] = field.type === 'checkbox' ? field.checked : field.value;
  });

  try {
    sessionStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify({ step: currentStep, fields }));
  } catch {
    // The form remains usable when browser storage is unavailable.
  }
}

function restoreRegistrationDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(REGISTRATION_DRAFT_KEY));
    if (!draft?.fields) return;

    Object.entries(draft.fields).forEach(([name, value]) => {
      const field = form.elements.namedItem(name);
      if (!field || field.type === 'file') return;
      if (field.type === 'checkbox') field.checked = Boolean(value);
      else field.value = value;
    });

    const restoredStep = Number(draft.step) === 2 ? 2 : 1;
    updatePaymentDisplay(loadConfig(), form.elements.network.value, String(draft.fields.bankAccount || ''));
    setStep(restoredStep, false);
  } catch {
    sessionStorage.removeItem(REGISTRATION_DRAFT_KEY);
  }
}

continueButton.addEventListener('click', () => {
  if (validateStep(1)) setStep(2);
});

backButton.addEventListener('click', () => setStep(1));

form.addEventListener('input', (event) => {
  if (event.target.name === 'whatsapp') {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10);
  }
  if (event.target.matches('input, select')) validateField(event.target);
  if (event.target.name === 'whatsappConsent') {
    event.target.closest('.check-field').classList.remove('invalid');
    document.querySelector('.check-error').classList.remove('visible');
  }
  saveRegistrationDraft();
});

form.addEventListener('change', saveRegistrationDraft);

receiptInput.addEventListener('change', () => {
  const [file] = receiptInput.files;
  fileError.classList.remove('visible');
  if (!file) {
    uploadLabel.textContent = 'Upload payment receipt';
    return;
  }
  if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
    receiptInput.value = '';
    uploadLabel.textContent = 'Upload payment receipt';
    fileError.classList.add('visible');
    return;
  }
  uploadLabel.textContent = file.name;
});

const copyButton = document.querySelector('.copy-button');
if (copyButton) {
  copyButton.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const value = button.dataset.copy;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const temporaryInput = document.createElement('textarea');
      temporaryInput.value = value;
      temporaryInput.style.position = 'fixed';
      temporaryInput.style.opacity = '0';
      document.body.append(temporaryInput);
      temporaryInput.select();
      const copied = document.execCommand('copy');
      temporaryInput.remove();
      if (!copied) {
        showToast(`Copy this number: ${value}`);
        return;
      }
    }
    button.classList.add('copied');
    showToast('Payment number copied');
    window.setTimeout(() => button.classList.remove('copied'), 1200);
  });
}

const programPoster = document.querySelector('#programPoster');
const posterPlaceholder = document.querySelector('#posterPlaceholder');
if (programPoster) {
  const showPoster = () => {
    programPoster.hidden = false;
    posterPlaceholder.hidden = true;
  };
  programPoster.addEventListener('load', showPoster);
  if (programPoster.complete && programPoster.naturalWidth > 0) showPoster();
}

function loadConfig() {
  try {
    const config = { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY)) };
    if (config.title === 'CDP') config.title = 'Continuous Development Program';
    if (config.fee === 'See poster') config.fee = '—';
    if (config.paymentAmount === 'See official poster') config.paymentAmount = '—';
    if (!Array.isArray(config.bankAccounts) || !config.bankAccounts.length) config.bankAccounts = DEFAULT_CONFIG.bankAccounts;
    return config;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function formatGhs(value) {
  const amount = String(value || '—').trim();
  return /^GHS\b/i.test(amount) ? amount : `GHS ${amount}`;
}

function updatePaymentDisplay(config, selectedMethod, selectedBankId = '') {
  const paymentBox = document.querySelector('#payment');
  const isBank = selectedMethod === 'Bank transfer';
  const bankField = document.querySelector('#bankAccountField');
  const bankSelect = document.querySelector('#bankAccountSelect');
  paymentBox.hidden = !selectedMethod;
  bankField.hidden = !isBank || config.bankAccounts.length <= 1;
  bankSelect.required = isBank && config.bankAccounts.length > 1;

  let selectedBank = config.bankAccounts[0];
  if (isBank) {
    const requestedBankId = selectedBankId || bankSelect.value || selectedBank?.id;
    bankSelect.replaceChildren();
    config.bankAccounts.forEach((bank) => {
      const option = document.createElement('option');
      option.value = bank.id;
      option.textContent = bank.bankName || 'Unnamed bank';
      bankSelect.append(option);
    });
    selectedBank = config.bankAccounts.find((bank) => bank.id === requestedBankId) || config.bankAccounts[0];
    bankSelect.value = selectedBank?.id || '';
  }

  if (!selectedMethod) return;

  const badge = document.querySelector('#paymentBadge');
  badge.textContent = isBank ? 'Bank' : 'MoMo';
  badge.classList.toggle('bank', isBank);
  setText('#paymentProviderLabel', isBank ? 'Bank / branch' : 'Network');
  setText('#paymentProviderValue', isBank ? [selectedBank?.bankName, selectedBank?.branch].filter(Boolean).join(' · ') : config.momoNetwork);
  setText('#paymentMerchant', isBank ? selectedBank?.accountName : config.momoAccountName);
  setText('#paymentAccountLabel', isBank ? 'Account number' : 'MoMo number');
  const paymentNumber = String(isBank ? selectedBank?.accountNumber || '' : config.momoNumber || '').trim();
  setText('#paymentInstructions', paymentNumber);
  if (copyButton) {
    const canCopy = Boolean(paymentNumber) && !/^(use|see)\b/i.test(paymentNumber);
    copyButton.dataset.copy = canCopy ? paymentNumber : '';
    copyButton.hidden = !canCopy;
    copyButton.setAttribute('aria-label', isBank ? 'Copy bank account number' : 'Copy MoMo number');
    copyButton.title = isBank ? 'Copy bank account number' : 'Copy MoMo number';
  }
  document.querySelector('#paymentPhoneField').hidden = isBank;
  document.querySelector('#paymentPhoneInput').required = !isBank;
}

function applyPublicConfig() {
  const config = loadConfig();
  setText('#programmeEyebrow', config.eyebrow);
  setText('#programmeTitle', config.title);
  setText('#programmeEdition', config.edition);
  setText('#programmeDescription', config.description);
  setText('#programmeDate', config.date);
  setText('#programmeTime', config.time);
  setText('#programmeVenue', config.venue);
  setText('#programmeFee', formatGhs(config.fee));
  setText('#paymentAmount', formatGhs(config.paymentAmount));
  updatePaymentDisplay(config, form.elements.network.value);

  const posterCard = document.querySelector('#posterCard');
  const eventMeta = document.querySelector('#eventMeta');
  const priceLine = document.querySelector('#priceLine');
  if (posterCard) posterCard.hidden = !config.showPoster;
  if (eventMeta) eventMeta.hidden = !config.showEventDetails;
  if (priceLine) priceLine.hidden = !config.showFee;

  if (programPoster && config.posterDataUrl) {
    programPoster.src = config.posterDataUrl;
    programPoster.hidden = false;
    posterPlaceholder.hidden = true;
  } else if (programPoster) {
    if (!programPoster.src.endsWith('/assets/cdp-poster.jpg')) {
      programPoster.src = 'assets/cdp-poster.jpg';
    }
    const staticPosterAvailable = programPoster.complete && programPoster.naturalWidth > 0;
    programPoster.hidden = !staticPosterAvailable;
    posterPlaceholder.hidden = staticPosterAvailable;
  }

  if (!config.registrationOpen) {
    document.body.classList.add('registration-is-closed');
    form.style.display = 'none';
    formHeader.style.display = 'none';
    successState.classList.remove('active');
    closedState.classList.add('active');
  } else if (!successState.classList.contains('active')) {
    document.body.classList.remove('registration-is-closed');
    form.style.display = '';
    formHeader.style.display = '';
    closedState.classList.remove('active');
  }
}

function storeRegistration(registration) {
  try {
    const registrations = JSON.parse(localStorage.getItem(REGISTRATIONS_KEY)) || [];
    registrations.unshift(registration);
    localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(registrations));
  } catch {
    showToast('Registration received, but this browser could not save a local copy.');
  }
}

form.elements.network.addEventListener('change', (event) => {
  updatePaymentDisplay(loadConfig(), event.target.value);
});
document.querySelector('#bankAccountSelect').addEventListener('change', (event) => {
  updatePaymentDisplay(loadConfig(), 'Bank transfer', event.target.value);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!validateStep(2)) return;

  // Production integration point: send FormData to a secure backend. The backend
  // must verify the transaction before triggering an approved WhatsApp template.
  const data = new FormData(form);
  const reference = `IOD-CDP-${Date.now().toString().slice(-6)}`;
  const submissionConfig = loadConfig();
  const selectedBank = submissionConfig.bankAccounts.find((bank) => bank.id === data.get('bankAccount'));
  storeRegistration({
    reference,
    title: data.get('title'),
    firstName: data.get('firstName'),
    lastName: data.get('lastName'),
    email: data.get('email'),
    organization: data.get('organization'),
    whatsapp: data.get('whatsapp'),
    role: data.get('role'),
    network: data.get('network'),
    bankAccountId: data.get('bankAccount'),
    paymentProvider: data.get('network') === 'Bank transfer' ? selectedBank?.bankName || 'Bank transfer' : submissionConfig.momoNetwork,
    paymentPhone: data.get('paymentPhone'),
    transactionId: data.get('transactionId'),
    receiptName: data.get('receipt')?.name || '',
    status: 'Pending',
    submittedAt: new Date().toISOString()
  });
  sessionStorage.removeItem(REGISTRATION_DRAFT_KEY);
  document.body.classList.remove('payment-step-active');
  document.querySelector('#successName').textContent = data.get('firstName');
  document.querySelector('#referenceNumber').textContent = reference;
  form.style.display = 'none';
  formHeader.style.display = 'none';
  successState.classList.add('active');
  processItems.forEach((item) => item.classList.add('active'));
  document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.querySelector('#newRegistration').addEventListener('click', () => {
  sessionStorage.removeItem(REGISTRATION_DRAFT_KEY);
  form.reset();
  document.querySelectorAll('.invalid').forEach((item) => item.classList.remove('invalid'));
  document.querySelectorAll('.error-text').forEach((item) => item.classList.remove('visible'));
  uploadLabel.textContent = 'Upload payment receipt';
  successState.classList.remove('active');
  form.style.display = '';
  formHeader.style.display = '';
  setStep(1);
});

document.querySelectorAll('.accordion details').forEach((detail) => {
  detail.addEventListener('toggle', () => {
    if (!detail.open) return;
    document.querySelectorAll('.accordion details').forEach((other) => {
      if (other !== detail) other.open = false;
    });
  });
});

const yearElement = document.querySelector('#year');
if (yearElement) yearElement.textContent = new Date().getFullYear();
applyPublicConfig();
restoreRegistrationDraft();
window.addEventListener('storage', (event) => {
  if (event.key === CONFIG_KEY) applyPublicConfig();
});
