(() => {
  'use strict';

  const menuButton = document.querySelector('.menu-button');
  const primaryNav = document.getElementById('primary-navigation');
  if (menuButton && primaryNav) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!open));
      primaryNav.classList.toggle('is-open', !open);
    });
    primaryNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        menuButton.setAttribute('aria-expanded', 'false');
        primaryNav.classList.remove('is-open');
      });
    });
  }

  // ── .is-checked fallback for browsers without :has() support ─────────────
  // Mirrors the CSS :has(input:checked) rules for .choice-chip, .select-card,
  // .checkbox-list label, and .confirmation-check.
  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!input.matches('input[type="radio"], input[type="checkbox"]')) return;
    const selector = '.choice-chip, .select-card, .checkbox-list label, .confirmation-check';
    const parent = input.closest(selector);
    if (!parent) return;

    if (input.type === 'radio') {
      // deselect all siblings in the same fieldset/group
      const fieldset = input.closest('fieldset, .choice-row, .choice-grid, .card-grid');
      if (fieldset) {
        fieldset.querySelectorAll(`input[name="${CSS.escape(input.name)}"]`).forEach((sibling) => {
          sibling.closest(selector)?.classList.remove('is-checked');
        });
      }
    }
    parent.classList.toggle('is-checked', input.checked);
  });

  const eligibilityForm = document.getElementById('eligibility-form');
  const eligibilityResult = document.getElementById('eligibility-result');
  if (eligibilityForm && eligibilityResult) {
    eligibilityForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!eligibilityForm.checkValidity()) {
        eligibilityForm.reportValidity();
        return;
      }
      const data = new FormData(eligibilityForm);
      const recentCare = data.get('recent-care');
      const collaborate = data.get('collaborate');
      const term = data.get('term');
      eligibilityResult.classList.remove('is-warning');

      if (recentCare === 'yes' && collaborate === 'yes' && term === 'yes') {
        eligibilityResult.innerHTML = '<strong>You appear to meet the basic published criteria.</strong><br>You may be ready to complete the short interest form and speak with a PFAC coordinator.';
      } else if (recentCare === 'no' || collaborate === 'no' || term === 'no') {
        eligibilityResult.classList.add('is-warning');
        eligibilityResult.innerHTML = '<strong>A conversation may still be useful.</strong><br>A PFAC coordinator could explain other ways to participate or clarify the requirements.';
      } else {
        eligibilityResult.classList.add('is-warning');
        eligibilityResult.innerHTML = '<strong>You may still be a possible fit.</strong><br>Select “I’m not sure” in the interest form and ask the PFAC team for more details.';
      }
      eligibilityResult.focus();
    });
  }

  const councilFilter = document.getElementById('council-filter');
  const councilCards = Array.from(document.querySelectorAll('.council-card'));
  if (councilFilter) {
    councilFilter.addEventListener('change', () => {
      const value = councilFilter.value;
      councilCards.forEach((card) => {
        const categories = card.dataset.category.split(/\s+/);
        card.hidden = value !== 'all' && !categories.includes(value) && !categories.includes('all');
      });
    });
  }

  const mobileCta = document.querySelector('.mobile-cta');
  const applicationSection = document.getElementById('apply');
  if (mobileCta && applicationSection && 'IntersectionObserver' in window) {
    const applicationObserver = new IntersectionObserver((entries) => {
      mobileCta.classList.toggle('is-hidden', entries.some((entry) => entry.isIntersecting));
    }, { threshold: 0.02 });
    applicationObserver.observe(applicationSection);
  }

  const interestForm = document.getElementById('interest-form');
  if (!interestForm) return;

  const formSteps = Array.from(document.querySelectorAll('.form-step'));
  const progressSteps = Array.from(document.querySelectorAll('[data-progress-step]'));
  const progressFill = document.getElementById('progress-fill');
  const backButton = document.getElementById('back-button');
  const nextButton = document.getElementById('next-button');
  const submitButton = document.getElementById('submit-button');
  const errorSummary = document.getElementById('form-error-summary');
  const reviewPanel = document.getElementById('review-panel');
  const applicationShell = document.getElementById('application-shell');
  const confirmationPanel = document.getElementById('confirmation-panel');
  const confirmationDetails = document.getElementById('confirmation-details');
  const interestReason = document.getElementById('interest-reason');
  const interestCounter = document.getElementById('interest-counter');
  const startOverButton = document.getElementById('start-over');
  const printButton = document.getElementById('print-summary');
  let currentStep = 1;

  const pretty = (value) => {
    if (value === null || value === undefined || value === '') return 'Not provided';
    return String(value);
  };

  const valuesFor = (name) => Array.from(interestForm.querySelectorAll(`[name="${CSS.escape(name)}"]:checked`)).map((item) => item.value);

  const setStep = (step, focusHeading = true) => {
    currentStep = Math.min(Math.max(step, 1), formSteps.length);
    formSteps.forEach((section) => {
      const active = Number(section.dataset.step) === currentStep;
      section.hidden = !active;
      section.classList.toggle('is-active', active);
    });
    progressSteps.forEach((item) => {
      const number = Number(item.dataset.progressStep);
      item.classList.toggle('is-current', number === currentStep);
      item.classList.toggle('is-complete', number < currentStep);
    });
    progressFill.style.width = `${currentStep * 25}%`;
    backButton.hidden = currentStep === 1;
    nextButton.hidden = currentStep === formSteps.length;
    submitButton.hidden = currentStep !== formSteps.length;
    errorSummary.hidden = true;
    if (currentStep === formSteps.length) buildReview();
    if (focusHeading) {
      const heading = formSteps[currentStep - 1].querySelector('h3');
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const showErrors = (messages, firstInvalid) => {
    errorSummary.innerHTML = `<strong>Please correct the following:</strong><ul>${messages.map((message) => `<li>${message}</li>`).join('')}</ul>`;
    errorSummary.hidden = false;
    errorSummary.focus();
    if (firstInvalid) firstInvalid.setAttribute('aria-invalid', 'true');
  };

  const clearInvalidMarkers = () => {
    interestForm.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  };

  const validateStep = (step) => {
    clearInvalidMarkers();
    const messages = [];
    let firstInvalid = null;
    const section = formSteps[step - 1];
    const requiredFields = Array.from(section.querySelectorAll('[required]'));

    requiredFields.forEach((field) => {
      if (!field.checkValidity()) {
        if (!firstInvalid) firstInvalid = field;
        const label = field.closest('.field-group')?.querySelector('label, legend')?.textContent.trim()
          || field.closest('label')?.textContent.trim()
          || 'A required field';
        if (!messages.includes(label)) messages.push(label);
      }
    });

    if (step === 2 && valuesFor('role').length === 0) {
      const field = section.querySelector('[name="role"]');
      if (!firstInvalid) firstInvalid = field;
      messages.push('Select at least one role: patient, family member, caregiver, or other supporter.');
    }

    if (step === 3 && valuesFor('council').length === 0) {
      const field = section.querySelector('[name="council"]');
      if (!firstInvalid) firstInvalid = field;
      messages.push('Select at least one council or choose “I’m not sure.”');
    }

    if (messages.length > 0) {
      showErrors(messages, firstInvalid);
      return false;
    }
    errorSummary.hidden = true;
    return true;
  };

  const formValue = (name) => {
    const checked = interestForm.querySelector(`[name="${CSS.escape(name)}"]:checked`);
    if (checked) return checked.value;
    return interestForm.elements[name]?.value || '';
  };

  const reviewItems = () => [
    ['Name', pretty(formValue('fullName'))],
    ['Preferred name', pretty(formValue('preferredName'))],
    ['Email', pretty(formValue('email'))],
    ['Phone', pretty(formValue('phone'))],
    ['Preferred contact', pretty(formValue('contactPreference'))],
    ['Applying as', pretty(valuesFor('role').join(', '))],
    ['Care within past three years', pretty(formValue('careWithinThreeYears'))],
    ['General area of care', pretty(formValue('careArea'))],
    ['Council interest', pretty(valuesFor('council').join(', '))],
    ['Participation preference', pretty(formValue('participation'))],
    ['Why interested', pretty(formValue('interestReason'))],
    ['Contact about participation support', pretty(formValue('supportContact'))]
  ];

  const buildReview = () => {
    reviewPanel.innerHTML = reviewItems().map(([label, value]) => `
      <dl class="review-row">
        <dt>${label}</dt>
        <dd>${escapeHtml(value)}</dd>
      </dl>
    `).join('');
  };

  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  nextButton.addEventListener('click', () => {
    if (validateStep(currentStep)) setStep(currentStep + 1);
  });
  backButton.addEventListener('click', () => setStep(currentStep - 1));

  interestForm.addEventListener('input', (event) => {
    if (event.target.matches('[aria-invalid="true"]')) event.target.removeAttribute('aria-invalid');
    if (event.target === interestReason) {
      interestCounter.textContent = `${interestReason.value.length} of 750 characters`;
    }
  });

  document.querySelectorAll('.choose-council').forEach((button) => {
    button.addEventListener('click', () => {
      const targetValue = button.dataset.council;
      const target = Array.from(document.querySelectorAll('[name="council"]')).find((item) => item.value === targetValue);
      if (target) target.checked = true;
      document.getElementById('apply').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => document.getElementById('full-name').focus(), 650);
    });
  });

  interestForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateStep(currentStep)) return;

    const reference = `DEMO-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const councils = valuesFor('council').join(', ') || 'Not selected';
    confirmationDetails.innerHTML = `
      <strong>Sample confirmation reference: ${reference}</strong>
      <p><strong>Applicant:</strong> ${escapeHtml(formValue('fullName'))}</p>
      <p><strong>Council interest:</strong> ${escapeHtml(councils)}</p>
      <p><strong>What a live site should say next:</strong> A PFAC coordinator will review the interest form and contact the applicant within a stated number of business days.</p>
    `;
    interestForm.hidden = true;
    document.querySelector('.progress-wrap').hidden = true;
    confirmationPanel.hidden = false;
    confirmationPanel.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      const headerHeight = document.querySelector('.site-header')?.offsetHeight || 72;
      const targetY = confirmationPanel.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
      window.scrollTo({ top: Math.max(targetY, 0), behavior: 'smooth' });
    });
  });

  startOverButton.addEventListener('click', () => {
    interestForm.reset();
    interestReason.value = '';
    interestCounter.textContent = '0 of 750 characters';
    interestForm.hidden = false;
    document.querySelector('.progress-wrap').hidden = false;
    confirmationPanel.hidden = true;
    setStep(1, false);
    applicationShell.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => document.getElementById('full-name').focus(), 500);
  });

  printButton.addEventListener('click', () => window.print());
  setStep(1, false);
})();
