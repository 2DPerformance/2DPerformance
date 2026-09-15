(() => {
  const form = document.querySelector('#spreadFootingForm');
  const results = document.querySelector('.results');
  const stateBanner = document.querySelector('#stateBanner');
  const stateTitle = document.querySelector('#stateTitle');
  const stateCopy = document.querySelector('#stateCopy');
  const footerState = document.querySelector('#footerState');
  const validationNote = document.querySelector('#formValidationNote');
  const runAnalysisButton = document.querySelector('#runAnalysis');
  const printLockSnapshot = document.querySelector('#printLockSnapshot');
  const printLockRevision = document.querySelector('#printLockRevision');
  const printLockBasis = document.querySelector('#printLockBasis');
  const printLockStatus = document.querySelector('#printLockStatus');
  const printLockDate = document.querySelector('#printLockDate');
  const printLockFooter = document.querySelector('#printLockFooter');
  const printCalculationReportButton = document.querySelector('#printCalculationReport');
  const printReportStatus = document.querySelector('#printReportStatus');
  const tabs = [...document.querySelectorAll('[role="tab"][data-tab]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"][data-panel]')];
  const modelStage = document.querySelector('.model-stage');
  const bearingStage = document.querySelector('.bearing-stage');
  const modelViewLabel = document.querySelector('#modelViewLabel');
  const modelDisplayStatus = document.querySelector('[data-model-display-status]');
  const modelDisplayShell = document.querySelector('[data-model-display-shell]');
  const bearingViewAnnouncement = document.querySelector('#bearingViewAnnouncement');
  const modelInspectorAnnouncement = document.querySelector('#modelInspectorAnnouncement');
  const tutorialStart = document.querySelector('#tutorialStart');
  const guidedTutorial = document.querySelector('#guidedTutorial');
  const tutorialStepLabel = document.querySelector('#tutorialStepLabel');
  const tutorialStepTitle = document.querySelector('#tutorialStepTitle');
  const tutorialStepCopy = document.querySelector('#tutorialStepCopy');
  const tutorialProgressBar = document.querySelector('#tutorialProgressBar');
  const tutorialProgressText = document.querySelector('#tutorialProgressText');
  const tutorialBack = document.querySelector('[data-tutorial-action="back"]');
  const tutorialNext = document.querySelector('[data-tutorial-action="next"]');
  const tutorialRestart = document.querySelector('[data-tutorial-action="restart"]');
  const tutorialExit = document.querySelector('[data-tutorial-action="exit"]');
  const documentFocusButtons = [...document.querySelectorAll('[data-document-focus]')];
  const documentFocusStatus = document.querySelector('#documentFocusStatus');
  const documentAccessNote = document.querySelector('#documentAccessNote');
  const projectInformationPanel = document.querySelector('.project-information--workspace');
  const projectInformationStatus = document.querySelector('[data-project-status]');
  const projectInformationStatusLabel = document.querySelector('[data-project-status-label]');
  const projectInformationToggleLabel = document.querySelector('[data-project-toggle-label]');
  const designProfileSelect = document.querySelector('#designStandardProfileId');
  const profileApplicabilityRow = document.querySelector('[data-profile-applicability]');
  const loadApplicabilityConfirmedInput = document.querySelector('#loadApplicabilityConfirmed');
  const designModeSelect = document.querySelector('#designMode');
  const forceDisplayUnitSelect = document.querySelector('#forceDisplayUnit');
  const designModePanel = document.querySelector('.auto-design-mode');
  const designModeBadge = document.querySelector('#designModeBadge');
  const autoDesignReadout = document.querySelector('#autoDesignReadout');
  const thicknessInputLabel = document.querySelector('#thicknessInputLabel');
  const runAnalysisLabel = runAnalysisButton?.querySelector('[data-run-label]');
  const autoRebarControls = [...document.querySelectorAll('[data-auto-rebar-control]')];
  const loadCombinationInput = document.querySelector('#loadCombinationId');
  const beta1Display = document.querySelector('#beta1Display');
  const foundationTopReadout = document.querySelector('#foundationTopReadout');
  const forceInputControls = [...document.querySelectorAll('[data-force-input]')];
  const forceUnitLabels = [...document.querySelectorAll('[data-force-unit]')];
  const KGF_TO_KN = 0.00980665;
  const ACI_D_L_PROFILE_ID = 'SF-SDM-ACI31819-DL-R1';
  const normalizeForceDisplayUnit = (unit) => unit === 'kN' ? 'kN' : 'kg';
  let activeForceDisplayUnit = normalizeForceDisplayUnit(forceDisplayUnitSelect?.value);
  let activeDocumentFocus = null;
  let documentFocusReturn = null;
  let spreadFootingEnginePromise = null;
  let calculationRuntimePromise = null;
  let designProfileInitializationPromise = null;
  let spreadFootingEngine = null;
  let designProfileManifest = Object.freeze([]);
  let enabledDesignProfiles = Object.freeze([]);
  let resolvedDraftProfile = null;
  let activeCalculationSnapshot = null;
  let calculationRunGeneration = 0;
  let snapshot3dInstance = null;
  let snapshotBearing3dInstance = null;
  let snapshotSymbolic3dInstance = null;
  let modelEvidence = null;
  let hasCompletedSnapshot = false;

  const normalizeProjectInformationValue = (value) => String(value || '').trim().replace(/\s+/g, ' ');
  const updateProjectInformationStatus = () => {
    if (!projectInformationPanel) return;
    const requiredControls = [...projectInformationPanel.querySelectorAll('[data-project-required]')];
    const pendingControls = requiredControls.filter((control) => {
      const value = normalizeProjectInformationValue(control.value);
      const exampleValue = normalizeProjectInformationValue(control.dataset.exampleValue);
      return !value || value === exampleValue;
    });
    const isReady = pendingControls.length === 0;
    const state = isReady ? 'ready' : 'attention';
    projectInformationPanel.dataset.projectCompletion = state;
    if (projectInformationStatus) {
      projectInformationStatus.dataset.state = state;
      projectInformationStatus.title = isReady
        ? 'แทนค่าตัวอย่างด้วยข้อมูลจริงสำหรับหัวรายงานครบแล้ว'
        : 'เปิดแถบนี้และแทนค่าตัวอย่างก่อนคำนวณหรือออกเอกสาร';
    }
    if (projectInformationStatusLabel) {
      projectInformationStatusLabel.textContent = isReady
        ? 'ข้อมูลโครงการพร้อม'
        : `ต้องกรอก ${pendingControls.length} รายการ`;
    }
    if (projectInformationToggleLabel) {
      projectInformationToggleLabel.textContent = projectInformationPanel.open
        ? 'ย่อข้อมูล'
        : 'เปิดกรอกข้อมูล';
    }
    requiredControls.forEach((control) => {
      control.closest('.field')?.classList.toggle('is-project-pending', pendingControls.includes(control));
    });
  };

  const flowSurfaceSlots = new Map(
    [...document.querySelectorAll('[data-sf-slot]')].map((element) => {
      const slot = element.dataset.sfSlot;
      const mode = element.dataset.sfSlotMode || 'inner';
      return [
        slot,
        Object.freeze({
          slot,
          mode,
          markup: mode === 'replace' ? element.outerHTML : element.innerHTML,
          text: element.textContent,
          initiallyHidden: element.hidden,
        }),
      ];
    })
  );
  const modelSelectDefaultLabels = new Map(
    [...document.querySelectorAll('[data-select-mark]')].map((element) => [
      element.dataset.selectMark,
      element.textContent,
    ])
  );
  const FOOTING_DESIGN_BASIS = Object.freeze({
    profile: '',
    basisStatus: 'owner_authorized_engineering_review',
    support: 'calculation-review',
    governingStandard: 'กำลังโหลด Design Standard profile จาก Engine',
    method: 'Strength Design · รุ่นตรวจวิศวกรรม',
    engineReference: 'ACI 318-19 · Chapters 13 / 21 / 22',
    loadCombination: 'กำลังโหลดชุดน้ำหนักจาก Engine',
    pairingStatus: 'CALCULATION PROFILE · กำลังโหลด',
  });

  window.__spreadFootingDesignBasis = FOOTING_DESIGN_BASIS;

  const applyDesignBasisPresentation = (presentation = FOOTING_DESIGN_BASIS) => {
    document.querySelectorAll('[data-basis-field]').forEach((element) => {
      const value = presentation[element.dataset.basisField];
      if (typeof value !== 'string') return;
      if (element instanceof HTMLSelectElement) {
        const matchedOption = [...element.options].find((option) => option.value === value || option.textContent.trim() === value);
        if (matchedOption) element.value = matchedOption.value;
        return;
      }
      if (element.matches('input, textarea')) {
        element.value = value;
        return;
      }
      element.textContent = value;
    });
  };

  applyDesignBasisPresentation();

  const loadSpreadFootingEngine = async () => {
    if (!spreadFootingEnginePromise) {
      spreadFootingEnginePromise = import('/spread-footing-engine.mjs?v=20260801-08')
        .then((engine) => {
          spreadFootingEngine = engine;
          return engine;
        })
        .catch((error) => {
          spreadFootingEnginePromise = null;
          throw error;
        });
    }
    return spreadFootingEnginePromise;
  };

  const loadCombinationPresentation = (combination) => [
    combination?.standard,
    combination?.clause,
    combination?.equation,
  ].filter(Boolean).join(' · ');

  const profileVerificationLabel = (status) => ({
    OWNER_AUTHORIZED_SPEC_PENDING_INDEPENDENT_REVIEW:
      'Owner อนุมัติสเปก · รอตรวจอิสระ',
  }[status] || status || '—');

  const profilePresentation = (profile, combination, snapshot = null) => {
    if (!profile) return FOOTING_DESIGN_BASIS;
    const profileId = profile.profileId || '';
    const memberStandard = profile.memberStandard?.displayLabel
      || [profile.memberStandard?.standard, profile.memberStandard?.edition].filter(Boolean).join(' ');
    const loadStandard = profile.loadStandard?.displayLabel
      || [profile.loadStandard?.standard, profile.loadStandard?.edition].filter(Boolean).join(' ');
    const loadCombination = loadCombinationPresentation(combination)
      || loadStandard
      || FOOTING_DESIGN_BASIS.loadCombination;
    const loadEquation = combination?.equation || '';
    const loadStandardWithEquation = loadEquation && !loadStandard.includes(loadEquation)
      ? `${loadStandard} · ${loadEquation}`
      : loadStandard;
    const profileOrigin = snapshot?.ok
      ? `โปรไฟล์จากผลคำนวณ · ${snapshot.id || profileId}`
      : 'ยังไม่มีผลคำนวณ';
    return {
      profileId,
      governingStandard: profile.displayLabel || profileId,
      method: profile.method || FOOTING_DESIGN_BASIS.method,
      engineReference: memberStandard || FOOTING_DESIGN_BASIS.engineReference,
      loadCombination,
      pairingStatus: `CALCULATION PROFILE · ${profileId}`,
      displayLabel: profile.displayLabel || profileId,
      memberStandard: memberStandard || '—',
      loadStandard: loadStandard || '—',
      loadStandardWithEquation: loadStandardWithEquation || '—',
      scope: profile.scope || 'Calculation Review profile',
      verificationStatus: profileVerificationLabel(profile.verificationStatus),
      complianceStatus: profile.complianceClaim === false
        ? 'ไม่อ้างการรับรองมาตรฐานทั้งฉบับ'
        : 'ต้องตรวจสถานะการอ้างอิงจาก Profile manifest',
      profileOrigin,
      ledgerTitle: `ฐานการออกแบบ · ${profileId}`,
      evidence: [
        `Profile manifest ${profile.sourceRegisterVersion || '—'}`,
        `สถานะ ${profile.verificationStatus || '—'}`,
        profile.complianceClaim === false ? 'ไม่ใช่คำอ้างการรับรองมาตรฐานทั้งฉบับ' : '',
      ].filter(Boolean).join(' · '),
      footerProfile: `${profileId} · หน่วยแรง ${activeForceDisplayUnit} · t · m · cm · ksc · Engine ใช้ SI ภายใน`,
    };
  };

  const profileLoadCombination = (profile) => {
    const combinationId = profile?.allowedCombinationIds?.[0];
    return combinationId
      ? spreadFootingEngine?.SPREAD_FOOTING_LOAD_COMBINATIONS?.[combinationId] || null
      : null;
  };

  const profileCatalogSource = (profile) => {
    const sources = Array.isArray(profile?.sources) ? profile.sources : [];
    if (!sources.length) {
      const sourceNote = document.createElement('p');
      sourceNote.className = 'design-profile-catalog__source-note';
      sourceNote.textContent = 'ข้อมูลเอกสารทางการยังไม่ถูกบันทึกใน Engine manifest';
      return [sourceNote];
    }
    return sources.map((source) => {
      const row = document.createElement(source.sourceUrl ? 'a' : 'span');
      row.className = 'design-profile-catalog__source';
      row.textContent = [source.standard, source.clause, source.sourceTitle]
        .filter(Boolean)
        .join(' · ');
      if (source.sourceUrl) {
        row.href = source.sourceUrl;
        row.target = '_blank';
        row.rel = 'noopener noreferrer';
      }
      return row;
    });
  };

  const renderProfileCatalog = (selectedProfileId = '') => {
    const details = document.querySelector('[data-profile-catalog]');
    const summary = document.querySelector('[data-profile-catalog-summary]');
    const container = document.querySelector('[data-profile-catalog-body]');
    if (!details || !summary || !container || !enabledDesignProfiles.length) return;

    summary.textContent = `โปรไฟล์ที่ใช้คำนวณได้ · ${enabledDesignProfiles.length} โปรไฟล์`;
    details.dataset.profileCount = String(enabledDesignProfiles.length);
    details.dataset.executableCount = String(enabledDesignProfiles.length);
    delete details.dataset.disabledCount;

    const rows = enabledDesignProfiles.map((profile) => {
      const combination = profileLoadCombination(profile);
      const row = document.createElement('article');
      const isSelected = profile.profileId === selectedProfileId;
      row.className = 'design-profile-catalog__row';
      row.dataset.profileId = profile.profileId;
      row.dataset.profileState = 'enabled';
      row.dataset.selected = String(isSelected);

      const header = document.createElement('header');
      const title = document.createElement('b');
      title.textContent = profile.displayLabel || profile.profileId;
      const state = document.createElement('em');
      state.textContent = isSelected ? 'กำลังใช้' : 'พร้อมคำนวณ';
      header.append(title, state);

      const metadata = document.createElement('dl');
      const entries = [
        ['รหัสโปรไฟล์', profile.profileId],
        ['มาตรฐานชิ้นส่วน', profile.memberStandard?.displayLabel || '—'],
        ['ชุดน้ำหนัก + สมการ', loadCombinationPresentation(combination) || profile.loadStandard?.displayLabel || '—'],
        ['สถานะการตรวจ', profileVerificationLabel(profile.verificationStatus)],
        ['ขอบเขตการอ้างอิง', profile.complianceClaim === false ? 'ไม่อ้างการรับรองมาตรฐานทั้งฉบับ' : '—'],
        ['ทะเบียนแหล่งอ้างอิง', profile.sourceRegisterVersion || '—'],
      ];
      entries.forEach(([term, definition]) => {
        const pair = document.createElement('div');
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = term;
        dd.textContent = definition;
        pair.append(dt, dd);
        metadata.append(pair);
      });

      const sourceRegister = document.createElement('div');
      sourceRegister.className = 'design-profile-catalog__sources';
      const sourceTitle = document.createElement('span');
      sourceTitle.textContent = 'ข้อมูลเอกสารทางการ';
      sourceRegister.append(sourceTitle, ...profileCatalogSource(profile));
      row.append(header, metadata, sourceRegister);
      return row;
    });
    container.replaceChildren(...rows);
  };

  const renderProfileSources = (profile) => {
    const container = document.querySelector('[data-profile-sources]');
    if (!container || !profile) return;
    const heading = document.createElement('span');
    heading.textContent = 'เอกสารหลักจาก Engine profile manifest';
    const links = document.createElement('nav');
    links.className = 'basis-source-links';
    links.setAttribute('aria-label', 'เปิดเอกสารอ้างอิงทางการของ Profile');
    const rows = profile.sources.map((source) => {
      const row = document.createElement('p');
      const title = document.createElement('b');
      const role = document.createElement('em');
      title.textContent = [source.standard, source.clause].filter(Boolean).join(' · ');
      role.textContent = source.role || 'source';
      row.append(title, role);
      if (source.sourceUrl) {
        const link = document.createElement('a');
        link.href = source.sourceUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = source.sourceTitle || title.textContent;
        links.append(link);
      }
      return row;
    });
    container.replaceChildren(heading, ...rows, links);
  };

  const applyProfilePresentation = (profile = resolvedDraftProfile, snapshot = activeCalculationSnapshot) => {
    const snapshotProfile = snapshot?.designBasis?.resolvedProfile;
    const presentationProfile = snapshotProfile || profile;
    const combinationId = snapshot?.designBasis?.combinationId
      || snapshot?.designBasis?.loadCombination?.id
      || loadCombinationInput?.value;
    const snapshotCombination = snapshot?.designBasis?.loadCombination;
    const combination = snapshotCombination
      || spreadFootingEngine?.SPREAD_FOOTING_LOAD_COMBINATIONS?.[combinationId];
    const presentation = profilePresentation(presentationProfile, combination, snapshot);
    applyDesignBasisPresentation(presentation);
    document.querySelectorAll('[data-profile-field]').forEach((element) => {
      const value = presentation[element.dataset.profileField];
      if (typeof value === 'string') element.textContent = value;
    });
    document.querySelectorAll('[data-basis-surface]').forEach((element) => {
      element.dataset.basisProfile = presentationProfile?.profileId || '';
      element.dataset.basisCombination = combinationId || '';
      element.dataset.basisMethod = presentationProfile?.method || 'UNRESOLVED_PROFILE';
    });
    renderProfileSources(presentationProfile);
    renderProfileCatalog(presentationProfile?.profileId || '');
    window.__spreadFootingDesignBasis = Object.freeze({ ...presentation });
  };

  const syncProfileReadOnlyEvidence = () => {
    if (!spreadFootingEngine || !resolvedDraftProfile) return;
    if (form.elements.phiFlexure) {
      form.elements.phiFlexure.value = Number(resolvedDraftProfile.phiFlexure).toFixed(2);
    }
    if (form.elements.phiShear) {
      form.elements.phiShear.value = Number(resolvedDraftProfile.phiShear).toFixed(2);
    }
    const currentDraft = Object.fromEntries(new FormData(form).entries());
    const normalized = spreadFootingEngine.normalizeSpreadFootingDraft?.(currentDraft);
    const beta1 = Number(normalized?.materials?.beta1);
    if (beta1Display instanceof HTMLInputElement) {
      beta1Display.value = Number.isFinite(beta1) ? beta1.toFixed(2) : '';
    }
    const beta1Policy = resolvedDraftProfile.beta1Policy;
    const beta1Help = document.querySelector('#beta1Help');
    if (beta1Help && beta1Policy) {
      beta1Help.textContent = `${beta1Policy.standard} ${beta1Policy.clause} · ช่วง ${beta1Policy.minimum.toFixed(2)}–${beta1Policy.maximum.toFixed(2)} · Engine คำนวณจาก f′c`;
    }
    const phiFlexureHelp = document.querySelector('#phiFlexureHelp');
    if (phiFlexureHelp) {
      phiFlexureHelp.textContent = `${resolvedDraftProfile.memberStandard.displayLabel} · Engine ล็อก φ = ${Number(resolvedDraftProfile.phiFlexure).toFixed(2)}`;
    }
    const phiShearHelp = document.querySelector('#phiShearHelp');
    if (phiShearHelp) {
      phiShearHelp.textContent = `${resolvedDraftProfile.memberStandard.displayLabel} · Engine ล็อก φ = ${Number(resolvedDraftProfile.phiShear).toFixed(2)}`;
    }
    applyProfilePresentation(resolvedDraftProfile);
  };

  const syncLoadApplicabilityControl = ({ reset = false } = {}) => {
    const requiresConfirmation = resolvedDraftProfile?.profileId === ACI_D_L_PROFILE_ID;
    if (!(loadApplicabilityConfirmedInput instanceof HTMLInputElement)) return requiresConfirmation;
    if (reset) loadApplicabilityConfirmedInput.checked = false;
    if (profileApplicabilityRow) profileApplicabilityRow.hidden = !requiresConfirmation;
    loadApplicabilityConfirmedInput.disabled = !requiresConfirmation;
    loadApplicabilityConfirmedInput.required = requiresConfirmation;
    loadApplicabilityConfirmedInput.setAttribute('aria-required', String(requiresConfirmation));
    loadApplicabilityConfirmedInput.setCustomValidity(
      requiresConfirmation && !loadApplicabilityConfirmedInput.checked
        ? 'ยืนยันว่า Lr, S และ R ไม่ใช้กับกรณีตรวจนี้ก่อนคำนวณด้วยโปรไฟล์ ACI 318-19 D+L'
        : ''
    );
    return requiresConfirmation;
  };

  const syncProfileAndCombination = ({ resetApplicability = false } = {}) => {
    if (!spreadFootingEngine || !enabledDesignProfiles.length) return false;
    const selectedProfile = spreadFootingEngine.resolveSpreadFootingDesignStandardProfile(
      designProfileSelect.value
    );
    const nextCombinationId = selectedProfile?.allowedCombinationIds?.[0] || '';
    loadCombinationInput.value = nextCombinationId;
    resolvedDraftProfile = spreadFootingEngine.resolveSpreadFootingDesignStandardProfile(
      designProfileSelect.value,
      loadCombinationInput.value
    );
    if (!resolvedDraftProfile) {
      designProfileSelect.setCustomValidity('โปรไฟล์นี้ยังไม่มีชุดน้ำหนักที่ Engine รองรับ');
      syncLoadApplicabilityControl({ reset: true });
      applyProfilePresentation(null);
      return false;
    }
    designProfileSelect.setCustomValidity('');
    syncLoadApplicabilityControl({ reset: resetApplicability });
    syncProfileReadOnlyEvidence();
    return true;
  };

  const populateDesignProfileControls = (engine) => {
    designProfileManifest = engine.SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_MANIFEST;
    if (!Array.isArray(designProfileManifest) || !designProfileManifest.length) {
      throw new TypeError('Engine profile manifest is unavailable');
    }
    enabledDesignProfiles = Object.freeze(
      designProfileManifest.filter((profile) => profile?.enabled === true)
    );
    if (!enabledDesignProfiles.length) {
      throw new TypeError('Engine profile manifest has no executable profile');
    }

    const executableGroup = document.createElement('optgroup');
    executableGroup.label = `เปิดใช้คำนวณแล้ว · ${enabledDesignProfiles.length} โปรไฟล์`;
    executableGroup.dataset.profileGroup = 'enabled';
    enabledDesignProfiles.forEach((profile) => {
      const option = document.createElement('option');
      option.value = profile.profileId;
      option.textContent = profile.displayLabel;
      option.dataset.profileState = 'enabled';
      executableGroup.append(option);
    });
    designProfileSelect.replaceChildren(executableGroup);

    const defaultCombinationId = engine.DEFAULT_SPREAD_FOOTING_DRAFT.combination;
    const defaultProfile = enabledDesignProfiles.find((profile) =>
      profile.allowedCombinationIds.includes(defaultCombinationId)
    ) || enabledDesignProfiles[0];
    designProfileSelect.value = defaultProfile.profileId;
    loadCombinationInput.value = defaultProfile.allowedCombinationIds[0];
    designProfileSelect.selectedOptions[0].defaultSelected = true;
    designProfileSelect.setAttribute('aria-busy', 'false');
    window.__spreadFootingDesignStandardProfileManifest = enabledDesignProfiles;
    syncProfileAndCombination();
  };

  const isAutoDesignMode = () => designModeSelect?.value === 'AUTO_UPSIZE';

  const forceUnitLabel = (dimension, unit = activeForceDisplayUnit) => {
    if (dimension === 'moment') return unit === 'kN' ? 'kN·m' : 'kg·m';
    return unit;
  };

  const forceInputValueFromKg = (valueKg, unit = activeForceDisplayUnit) => {
    const numeric = Number(valueKg);
    if (!Number.isFinite(numeric)) return '';
    const displayed = unit === 'kN' ? numeric * KGF_TO_KN : numeric;
    const digits = unit === 'kN' ? 5 : 3;
    return String(Number(displayed.toFixed(digits)));
  };

  const forceInputValueToKg = (value, unit = activeForceDisplayUnit) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return value;
    const canonicalKg = unit === 'kN' ? numeric / KGF_TO_KN : numeric;
    return String(Number(canonicalKg.toFixed(6)));
  };

  const formattedForceFromKn = (valueKn, unit = activeForceDisplayUnit) => {
    const numeric = Number(valueKn);
    if (!Number.isFinite(numeric)) return '—';
    const value = unit === 'kN' ? numeric : numeric / KGF_TO_KN;
    return `${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: unit === 'kN' ? 2 : 0,
      minimumFractionDigits: 0,
      useGrouping: true,
    }).format(value)} ${unit}`;
  };

  const refreshRenderedForceLabels = () => {
    document.querySelectorAll('[data-symbolic-pu-value][data-force-kn]').forEach((element) => {
      element.textContent = formattedForceFromKn(element.dataset.forceKn);
      element.dataset.forceDisplayUnit = activeForceDisplayUnit;
    });
  };

  const syncForceUnitPresentation = ({ convertValues = false } = {}) => {
    const nextUnit = normalizeForceDisplayUnit(forceDisplayUnitSelect?.value);
    const previousUnit = activeForceDisplayUnit;
    forceInputControls.forEach((control) => {
      if (!control.dataset.forceMinKg && control.min !== '') control.dataset.forceMinKg = control.min;
      if (!control.dataset.forceMaxKg && control.max !== '') control.dataset.forceMaxKg = control.max;
    });
    if (convertValues && previousUnit !== nextUnit) {
      forceInputControls.forEach((control) => {
        const canonicalKg = forceInputValueToKg(control.value, previousUnit);
        control.value = forceInputValueFromKg(canonicalKg, nextUnit);
      });
    }
    activeForceDisplayUnit = nextUnit;
    forceUnitLabels.forEach((label) => {
      label.textContent = forceUnitLabel(label.dataset.forceUnit, nextUnit);
    });
    forceInputControls.forEach((control) => {
      if (control.dataset.forceMinKg) {
        control.min = forceInputValueFromKg(control.dataset.forceMinKg, nextUnit);
      }
      if (control.dataset.forceMaxKg) {
        control.max = forceInputValueFromKg(control.dataset.forceMaxKg, nextUnit);
      }
    });
    form.dataset.forceDisplayUnit = nextUnit;
    results.dataset.forceDisplayUnit = nextUnit;
    window.__spreadFootingDisplayUnits = Object.freeze({
      force: nextUnit,
      engine: 'SI',
      kgfToKn: KGF_TO_KN,
    });
    refreshRenderedForceLabels();
    applyProfilePresentation(resolvedDraftProfile, activeCalculationSnapshot);
  };

  const defaultAutoDesignReadout = () => (
    isAutoDesignMode()
      ? 'กรอกแรงและขนาดเริ่มต้น · ระบบเลือก T และเหล็กด้วยสมการเดิม'
      : 'ตรวจ A × B × T และเหล็กตามค่าที่กรอก · ไม่เปลี่ยนขนาดให้'
  );

  const syncDesignModePresentation = ({ preserveReadout = false } = {}) => {
    const autoMode = isAutoDesignMode();
    if (designModePanel) designModePanel.dataset.mode = autoMode ? 'auto' : 'manual';
    if (designModeBadge) designModeBadge.textContent = autoMode ? 'AUTO' : 'MANUAL';
    if (thicknessInputLabel) {
      thicknessInputLabel.textContent = autoMode ? 'T ความหนาเริ่มต้น' : 'T ความหนาที่กำหนด';
    }
    if (runAnalysisLabel) {
      runAnalysisLabel.textContent = autoMode
        ? 'ออกแบบฐานรากอัตโนมัติ'
        : 'ตรวจขนาดฐานรากที่กำหนด';
    }
    autoRebarControls.forEach((control) => {
      if (control instanceof HTMLSelectElement) {
        control.disabled = autoMode;
        control.setAttribute('aria-disabled', String(autoMode));
      } else if (control instanceof HTMLInputElement) {
        control.readOnly = autoMode;
        control.setAttribute('aria-readonly', String(autoMode));
      }
    });
    if (!preserveReadout && autoDesignReadout) {
      delete autoDesignReadout.dataset.state;
      autoDesignReadout.textContent = defaultAutoDesignReadout();
    }
  };

  const syncFormAdapters = () => {
    const thicknessCm = Number(form.elements.thickness?.value);
    const foundationDepthM = Number(form.elements.foundationDepth?.value);
    const foundationTopM = foundationDepthM - thicknessCm / 100;
    const depthControl = form.elements.foundationDepth;
    const foundationTopControl = form.elements.foundationTop;

    if (foundationTopControl && Number.isFinite(foundationTopM)) {
      foundationTopControl.value = String(Number(foundationTopM.toFixed(6)));
    }
    if (foundationTopReadout) {
      foundationTopReadout.textContent = Number.isFinite(foundationTopM)
        ? `${foundationTopM.toFixed(2)} m`
        : '—';
    }
    if (depthControl instanceof HTMLInputElement) {
      depthControl.setCustomValidity(
        Number.isFinite(foundationTopM) && foundationTopM >= 0
          ? ''
          : 'H ต้องไม่น้อยกว่าความหนาฐาน T'
      );
    }

    const commonBarDia = form.elements.commonBarDia?.value;
    if (commonBarDia) {
      if (form.elements.barDiaA) form.elements.barDiaA.value = commonBarDia;
      if (form.elements.barDiaB) form.elements.barDiaB.value = commonBarDia;
    }

  };

  syncDesignModePresentation();
  syncForceUnitPresentation();
  syncFormAdapters();

  const getMarkupDefaultValue = (element) => {
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      return element.defaultChecked ? 'checked' : 'unchecked';
    }
    if (element instanceof HTMLSelectElement) {
      const defaultOption = [...element.options].find((option) => option.defaultSelected) || element.options[0];
      return defaultOption?.value ?? '';
    }
    return element.defaultValue;
  };

  const captureDefaultInputValues = () => Object.freeze(Object.fromEntries(
    [...form.elements]
      .filter((element) => element.name)
      .map((element) => [element.name, getMarkupDefaultValue(element)])
  ));
  let defaultInputValues = captureDefaultInputValues();

  const matchesDefaultInputValues = () => {
    syncFormAdapters();
    return Object.entries(defaultInputValues).every(
      ([name, value]) => {
        const control = form.elements[name];
        if (control instanceof HTMLInputElement && control.type === 'checkbox') {
          return (control.checked ? 'checked' : 'unchecked') === value;
        }
        return control?.value === value;
      }
    );
  };

  const loadCalculationRuntime = async () => {
    if (!calculationRuntimePromise) {
      calculationRuntimePromise = Promise.all([
        loadSpreadFootingEngine(),
        import('/spread-footing-snapshot-renderers.mjs?v=20260801-08'),
        import('/spread-footing-snapshot-3d.mjs?v=20260801-08'),
      ])
        .then(([engine, renderers, snapshot3d]) => Object.freeze({ engine, renderers, snapshot3d }))
        .catch((error) => {
          calculationRuntimePromise = null;
          throw error;
        });
    }
    return calculationRuntimePromise;
  };

  const initializeDesignProfileControls = async () => {
    if (!designProfileInitializationPromise) {
      designProfileInitializationPromise = loadSpreadFootingEngine()
        .then((engine) => {
          populateDesignProfileControls(engine);
          defaultInputValues = captureDefaultInputValues();
          updateFormValidity();
          return engine;
        })
        .catch((error) => {
          designProfileInitializationPromise = null;
          designProfileSelect.setAttribute('aria-busy', 'false');
          designProfileSelect.disabled = true;
          designProfileSelect.setCustomValidity('โหลด Profile manifest จาก Engine ไม่สำเร็จ');
          validationNote.textContent = `ยังคำนวณไม่ได้ · ${error.message}`;
          throw error;
        });
    }
    return designProfileInitializationPromise;
  };

  const getSlotElement = (slot) => [...document.querySelectorAll('[data-sf-slot]')]
    .find((element) => element.dataset.sfSlot === slot) || null;

  const syncModelEvidencePresentation = (selection = null, announce = false) => {
    const placeholder = '—';
    if (!modelEvidence) {
      document.querySelectorAll('[data-model-mark-label], [data-select-mark]').forEach((element) => {
        if (element.dataset.modelMarkLabel) element.textContent = placeholder;
        else if (element.dataset.selectMark) {
          element.textContent = modelSelectDefaultLabels.get(element.dataset.selectMark) || placeholder;
        }
      });
      ['modelLayer', 'modelDetail', 'modelDepth', 'modelCheck', 'modelTrace', 'modelAuth'].forEach((id) => {
        const element = document.querySelector(`#${id}`);
        if (element) element.textContent = placeholder;
      });
      const selection = document.querySelector('#modelSelection');
      if (selection) selection.textContent = 'รอผลคำนวณ';
      if (modelInspectorAnnouncement) modelInspectorAnnouncement.textContent = '';
      return;
    }
    document.querySelectorAll('[data-model-mark-label]').forEach((element) => {
      const evidence = modelEvidence[element.dataset.modelMarkLabel];
      if (evidence?.mark) element.textContent = evidence.mark;
    });
    document.querySelectorAll('[data-select-mark]').forEach((button) => {
      const evidence = modelEvidence[button.dataset.selectMark];
      if (evidence?.controlLabel || evidence?.mark) {
        button.textContent = evidence.controlLabel || evidence.mark;
      }
    });
    const selectedKey = selection
      || document.querySelector('[data-select-mark].is-active')?.dataset.selectMark
      || 'barA';
    const evidence = modelEvidence[selectedKey];
    if (!evidence) return;
    document.querySelector('#modelSelection').textContent = evidence.title;
    document.querySelector('#modelLayer').textContent = evidence.layer;
    document.querySelector('#modelDetail').textContent = evidence.detail;
    document.querySelector('#modelDepth').textContent = evidence.depth;
    document.querySelector('#modelCheck').textContent = evidence.check;
    document.querySelector('#modelTrace').textContent = evidence.trace;
    document.querySelector('#modelAuth').textContent = evidence.auth;
    if (modelInspectorAnnouncement) {
      const announcement = `เลือก ${evidence.title} · Trace ${evidence.trace}`;
      if (announce || modelInspectorAnnouncement.textContent !== announcement) {
        modelInspectorAnnouncement.textContent = announcement;
      }
    }
  };

  const restoreFlowSlots = () => {
    for (const record of flowSurfaceSlots.values()) {
      const element = getSlotElement(record.slot);
      if (!element) {
        throw new Error(`ไม่พบตำแหน่ง Flow ${record.slot} สำหรับคืนค่า`);
      }
      if (record.mode === 'replace') {
        const template = document.createElement('template');
        template.innerHTML = record.markup.trim();
        const replacement = template.content.firstElementChild;
        if (!replacement) throw new Error(`คืนค่า Flow ${record.slot} ไม่สำเร็จ`);
        element.replaceWith(replacement);
        continue;
      }
      if (record.mode === 'text') element.textContent = record.text;
      else element.innerHTML = record.markup;
      element.hidden = record.initiallyHidden;
    }
  };

  const clearPanelSnapshotTrace = () => {
    panels.forEach((panel) => {
      delete panel.dataset.snapshotId;
      delete panel.dataset.payloadHash;
      delete panel.dataset.calculationFingerprint;
      delete panel.dataset.fingerprint;
      delete panel.dataset.snapshotSurface;
    });
  };

  const createSnapshotCanvas = ({ id, className, label, describedBy }) => {
    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.className = className;
    canvas.dataset.snapshot3d = '';
    canvas.tabIndex = -1;
    canvas.setAttribute('role', 'region');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('aria-label', label);
    if (describedBy) canvas.setAttribute('aria-describedby', describedBy);
    return canvas;
  };

  const disposeCalculation3D = () => {
    snapshot3dInstance?.dispose?.();
    snapshot3dInstance = null;
    snapshotBearing3dInstance?.dispose?.();
    snapshotBearing3dInstance = null;
    snapshotSymbolic3dInstance?.dispose?.();
    snapshotSymbolic3dInstance = null;
    const symbolicStage = document.querySelector('[data-symbolic-3d-stage]');
    modelStage?.classList.remove('is-webgl-ready', 'is-webgl-loading');
    bearingStage?.classList.remove('is-webgl-ready', 'is-webgl-loading');
    symbolicStage?.classList.remove('is-webgl-ready', 'is-webgl-loading');
    modelStage?.setAttribute('aria-busy', 'false');
    bearingStage?.setAttribute('aria-busy', 'false');
    symbolicStage?.setAttribute('aria-busy', 'false');
    modelStage?.querySelectorAll('[data-snapshot-3d-status]').forEach((element) => element.remove());
    bearingStage?.querySelectorAll('[data-snapshot-3d-status]').forEach((element) => element.remove());
    document.querySelector('#spreadFooting3d')?.remove();
    document.querySelector('#summaryBearing3d')?.remove();
    document.querySelector('#analysisSymbolic3d')?.remove();
    document.querySelectorAll('[data-layer], [data-select-mark], [data-model-display]').forEach((control) => {
      control.disabled = true;
      control.setAttribute('aria-pressed', 'false');
      control.classList.remove('is-active');
    });
    const overviewButton = document.querySelector('[data-model-display="overview"]');
    overviewButton?.classList.add('is-active');
    overviewButton?.setAttribute('aria-pressed', 'true');
    modelStage?.setAttribute('data-model-display-mode', 'overview');
    modelDisplayShell?.setAttribute('data-model-display-shell', 'overview');
    if (modelDisplayStatus) modelDisplayStatus.textContent = 'รอผลคำนวณ';
  };

  const clearCalculationSurfaces = ({ restoreStatic = true } = {}) => {
    disposeCalculation3D();
    if (restoreStatic) restoreFlowSlots();
    clearPanelSnapshotTrace();
    modelEvidence = null;
    syncModelEvidencePresentation();
  };

  const getSnapshotHash = (snapshot) => snapshot?.payloadHash || snapshot?.hash || '';
  const getSnapshotFingerprint = (snapshot) => snapshot?.fingerprint || '';
  const getSnapshotCalculationFingerprint = (snapshot) =>
    snapshot?.calculationFingerprint || snapshot?.fingerprint || '';

  const parseSurfaceMarkup = (markup, surface) => {
    if (typeof markup !== 'string' || !markup.trim()) {
      throw new Error(`ไม่มีพื้นผิวผลลัพธ์ ${surface} จากชุดผลคำนวณ`);
    }
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    return template.content;
  };

  const resolveHydrationRegion = (region, surfaceDocuments) => {
    let markup = typeof region.html === 'string' ? region.html : '';
    for (const fragment of region.fragments || []) {
      const source = surfaceDocuments.get(fragment.surface);
      const node = source?.querySelector(fragment.selector);
      if (!node) {
        throw new Error(`ไม่พบชิ้นส่วน ${fragment.surface}:${fragment.selector} สำหรับ ${region.slot}`);
      }
      markup += fragment.take === 'inner' ? node.innerHTML : node.outerHTML;
    }
    return Object.freeze({
      slot: region.slot,
      mode: region.mode || 'inner',
      markup,
      text: typeof region.text === 'string' ? region.text : '',
    });
  };

  const createReplacementElement = (current, markup, slot) => {
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    let replacement = template.content.firstElementChild;
    if (!replacement) {
      throw new Error(`ชิ้นส่วน ${slot} ไม่มีราก DOM`);
    }
    if (template.content.children.length !== 1) {
      if (!(current instanceof HTMLElement)) {
        throw new Error(`ชิ้นส่วน ${slot} ต้องมีราก DOM เพียงหนึ่งรายการ`);
      }
      replacement = current.cloneNode(false);
      replacement.innerHTML = markup;
    }
    const mergedClasses = new Set([...current.classList, ...replacement.classList]);
    replacement.setAttribute('class', [...mergedClasses].join(' '));
    for (const attribute of current.attributes) {
      const preserve = attribute.name === 'id'
        || attribute.name === 'role'
        || attribute.name === 'tabindex'
        || attribute.name.startsWith('aria-')
        || attribute.name.startsWith('data-sf-slot')
        || attribute.name === 'data-snapshot-3d-fallback';
      if (preserve) replacement.setAttribute(attribute.name, attribute.value);
    }
    return replacement;
  };

  const renderCalculationSurfaces = (snapshot, hydrationPlan) => {
    const payloadHash = getSnapshotHash(snapshot);
    const fingerprint = getSnapshotFingerprint(snapshot);
    const calculationFingerprint = getSnapshotCalculationFingerprint(snapshot);
    if (
      hydrationPlan?.snapshotId !== snapshot.id
      || hydrationPlan?.payloadHash !== payloadHash
      || hydrationPlan?.fingerprint !== fingerprint
      || hydrationPlan?.calculationFingerprint !== calculationFingerprint
    ) {
      throw new Error('แผนแสดงผลไม่ตรงกับหลักฐานผลคำนวณที่ล็อกไว้');
    }

    const surfaceMap = hydrationPlan.markup || {};
    const surfaceDocuments = new Map(
      panels.map((panel) => {
        const surface = panel.dataset.panel;
        const documentFragment = parseSurfaceMarkup(surfaceMap[surface], surface);
        const rendererRoot = documentFragment.firstElementChild;
        if (
          !rendererRoot
          || rendererRoot.dataset.snapshotSurface !== surface
          || rendererRoot.dataset.snapshotId !== snapshot.id
          || rendererRoot.dataset.payloadHash !== payloadHash
          || rendererRoot.dataset.calculationFingerprint !== calculationFingerprint
          || rendererRoot.dataset.fingerprint !== fingerprint
        ) {
          throw new Error(`หลักฐานผลคำนวณของพื้นผิว ${surface} ไม่ตรงกับ Engine`);
        }
        return [surface, documentFragment];
      })
    );
    const prepared = panels.map((panel) => {
      const panelPlan = hydrationPlan.panels?.[panel.dataset.panel];
      if (!panelPlan || !Array.isArray(panelPlan.regions)) {
        throw new Error(`ไม่มี hydration plan สำหรับพื้นผิว ${panel.dataset.panel}`);
      }
      const regions = panelPlan.regions.map((region) => {
        const target = getSlotElement(region.slot);
        if (!target || !panel.contains(target)) {
          throw new Error(`ตำแหน่ง ${region.slot} ไม่อยู่ในพื้นผิว ${panel.dataset.panel}`);
        }
        return Object.freeze({
          panel,
          target,
          ...resolveHydrationRegion(region, surfaceDocuments),
        });
      });
      for (const region of regions) {
        if (panel.dataset.panel !== 'calc' && /data-equation-id=|sf-equation-record|sf-equation-ledger/.test(region.markup)) {
          throw new Error(`สมการฉบับเต็มหลุดออกนอกแท็บรายการคำนวณที่ ${panel.dataset.panel}`);
        }
      }
      return Object.freeze({ panel, regions });
    });

    clearCalculationSurfaces();
    try {
      for (const { panel, regions } of prepared) {
        panel.dataset.snapshotSurface = panel.dataset.panel;
        panel.dataset.snapshotId = snapshot.id;
        panel.dataset.payloadHash = payloadHash;
        panel.dataset.calculationFingerprint = calculationFingerprint;
        panel.dataset.fingerprint = fingerprint;
        for (const region of regions) {
          const current = getSlotElement(region.slot);
          if (!current || !panel.contains(current)) {
            throw new Error(`ตำแหน่ง ${region.slot} เปลี่ยนระหว่าง hydrate`);
          }
          if (region.mode === 'replace') {
            current.replaceWith(createReplacementElement(current, region.markup, region.slot));
          } else if (region.mode === 'text') {
            current.textContent = region.text;
          } else {
            current.innerHTML = region.markup;
          }
        }
      }
      modelEvidence = structuredClone(hydrationPlan.modelEvidence || {});
      syncModelEvidencePresentation();
    } catch (error) {
      restoreFlowSlots();
      clearPanelSnapshotTrace();
      modelEvidence = null;
      syncModelEvidencePresentation();
      throw error;
    }
  };

  const snapshotBasisPresentation = (snapshot) => {
    const designBasis = snapshot?.designBasis || {};
    const loadCombination = designBasis.loadCombination || designBasis.combination || snapshot?.results?.loads?.combination || {};
    const loadCombinationLabel = typeof loadCombination === 'string'
      ? loadCombination
      : loadCombination.label || loadCombination.display || loadCombination.equation;
    return {
      governingStandard: designBasis.displayLabel
        || designBasis.resolvedProfile?.displayLabel
        || designBasis.governingStandardLabel
        || designBasis.profileLabel
        || `${designBasis.profileId || FOOTING_DESIGN_BASIS.profile} · สูตรกำลัง ACI 318-19`,
      method: designBasis.methodLabel || designBasis.method || FOOTING_DESIGN_BASIS.method,
      engineReference: designBasis.memberStrengthStandard
        || designBasis.memberStandard?.displayLabel
        || designBasis.resolvedProfile?.memberStandard?.displayLabel
        || designBasis.engineReferenceLabel
        || designBasis.strengthStandard
        || FOOTING_DESIGN_BASIS.engineReference,
      loadCombination: loadCombinationLabel
        || loadCombinationPresentation(
          spreadFootingEngine?.SPREAD_FOOTING_LOAD_COMBINATIONS?.[
            form.elements.combination?.value
          ]
        )
        || FOOTING_DESIGN_BASIS.loadCombination,
      pairingStatus: `ผลคำนวณพร้อม · CALCULATION PROFILE ${designBasis.profileId || ''}`,
    };
  };

  const updateSnapshotBasisAttributes = (snapshot) => {
    const designBasis = snapshot?.designBasis || {};
    const overall = snapshot?.results?.overall || {};
    document.querySelectorAll('[data-basis-surface]').forEach((element) => {
      element.dataset.basisProfile = designBasis.profileId || FOOTING_DESIGN_BASIS.profile;
      element.dataset.basisGoverning = designBasis.governingStandardId || 'PROJECT_OWNER_REVIEW';
      element.dataset.basisMethod = designBasis.methodId || 'STRENGTH_DESIGN_REVIEW';
      element.dataset.basisEngine = snapshot.engineId || 'structvault.spread-footing';
      element.dataset.basisCombination = designBasis.combinationId
        || designBasis.loadCombination?.id
        || form.elements.combination?.value
        || '';
      element.dataset.basisStatus = overall.status || 'ENGINEERING_REVIEW_REQUIRED';
      element.dataset.basisSupport = 'calculation-review';
      element.dataset.snapshotId = snapshot.id;
      element.dataset.payloadHash = getSnapshotHash(snapshot);
    });
  };

  const readCalculationDraft = () => {
    syncFormAdapters();
    syncProfileReadOnlyEvidence();
    const draft = Object.fromEntries(new FormData(form).entries());
    for (const fieldName of ['deadLoad', 'liveLoad', 'mx', 'my']) {
      if (fieldName in draft) {
        draft[fieldName] = forceInputValueToKg(draft[fieldName]);
      }
    }
    return draft;
  };

  const applyAutoDesignSnapshotToForm = (snapshot) => {
    const selection = snapshot?.designSelection;
    if (!selection || selection.mode !== 'AUTO_UPSIZE') return;
    const { selected, requested } = selection;
    const assignments = {
      footingX: selected.footingXM,
      footingY: selected.footingYM,
      thickness: selected.thicknessM * 100,
      foundationDepth: selected.foundationBottomDepthM,
      commonBarDia: `DB${selected.diameterAMm}`,
      barsA: selected.barsA,
      barsB: selected.barsB,
    };
    Object.entries(assignments).forEach(([name, value]) => {
      const control = form.elements[name];
      if (control && value !== null && value !== undefined) control.value = String(value);
    });
    syncFormAdapters();
    syncDesignModePresentation({ preserveReadout: true });
    if (!autoDesignReadout) return;
    const requestedLabel = `${requested.footingXM.toFixed(2)} × ${requested.footingYM.toFixed(2)} × ${(requested.thicknessM * 100).toFixed(0)} cm`;
    const selectedLabel = `${selected.footingXM.toFixed(2)} × ${selected.footingYM.toFixed(2)} × ${(selected.thicknessM * 100).toFixed(0)} cm`;
    autoDesignReadout.dataset.state = 'selected';
    autoDesignReadout.textContent = `Auto เลือก ${requestedLabel} → ${selectedLabel} · ทิศ A ${selected.barsA}-DB${selected.diameterAMm} · ทิศ B ${selected.barsB}-DB${selected.diameterBMm}`;
  };

  const describeSnapshotFailure = (snapshotOrError) => {
    if (snapshotOrError instanceof Error && snapshotOrError.message) return snapshotOrError.message;
    const candidates = [
      snapshotOrError?.message,
      snapshotOrError?.error?.message,
      ...(Array.isArray(snapshotOrError?.errors) ? snapshotOrError.errors : []),
      ...(Array.isArray(snapshotOrError?.validation?.errors) ? snapshotOrError.validation.errors : []),
      ...(Array.isArray(snapshotOrError?.issues) ? snapshotOrError.issues : []),
    ];
    const readable = candidates
      .map((item) => typeof item === 'string' ? item : item?.message || item?.label || item?.code)
      .filter(Boolean);
    return readable.slice(0, 3).join(' · ') || 'Engine ไม่สามารถสร้างผลคำนวณจากข้อมูลชุดนี้ได้';
  };

  const markFlowControllerReady = () => {
    results.dataset.controllerState = 'ready';
    results.setAttribute('aria-busy', 'false');
  };

  const clearResultSnapshotTrace = () => {
    delete results.dataset.snapshotId;
    delete results.dataset.payloadHash;
    delete results.dataset.calculationFingerprint;
    delete results.dataset.fingerprint;
  };

  const printableReportPages = () =>
    [...document.querySelectorAll('#panel-report .report-sheet[data-report-page]')];

  const isCurrentReportPrintable = () => {
    if (results.dataset.snapshotState !== 'ready' || !activeCalculationSnapshot) return false;
    const pages = printableReportPages();
    if (pages.length !== 2) return false;
    return pages.every((page, index) =>
      page.dataset.reportPage === String(index + 1)
      && page.dataset.snapshotId === activeCalculationSnapshot.id
    );
  };

  const syncPrintAccess = () => {
    const isPrintable = isCurrentReportPrintable();
    document.body.dataset.printAuthorization = isPrintable ? 'authorized' : 'locked';
    if (printCalculationReportButton) {
      printCalculationReportButton.disabled = !isPrintable;
      printCalculationReportButton.setAttribute('aria-disabled', String(!isPrintable));
    }
    if (printReportStatus) {
      printReportStatus.textContent = isPrintable
        ? 'รายงาน A4 พร้อมพิมพ์ 2 หน้า · ในกล่องพิมพ์เลือกบันทึกเป็น PDF ได้'
        : 'คำนวณให้ได้ผลปัจจุบันครบก่อนพิมพ์รายงาน A4';
    }
    return isPrintable;
  };

  const syncPanelExposure = () => {
    const isReady = results.dataset.snapshotState === 'ready';
    tabs.forEach((tab) => {
      tab.disabled = !isReady;
      tab.setAttribute('aria-disabled', String(!isReady));
    });
    panels.forEach((panel) => {
      const isActive = panel.classList.contains('is-active');
      panel.hidden = !isReady || !isActive;
      panel.setAttribute('aria-hidden', String(!isReady || !isActive));
      panel.inert = !isReady || !isActive;
    });
    syncDocumentFocusAccess();
    syncPrintAccess();
  };

  const updateFormValidity = () => {
    const constrainedControls = [...form.querySelectorAll('input, select')];
    const invalidControls = constrainedControls.filter((control) => !control.checkValidity());
    constrainedControls.forEach((control) => {
      control.setAttribute('aria-invalid', String(!control.checkValidity()));
    });
    form.dataset.validity = invalidControls.length ? 'invalid' : 'valid';
    validationNote.textContent = invalidControls.length
      ? `ช่วงข้อมูลไม่ถูกต้อง · ตรวจ ${invalidControls.length} ช่องที่ทำเครื่องหมายไว้`
      : 'ช่วงข้อมูลถูกต้อง · พร้อมคำนวณฐานรากแผ่';
  };

  const setLifecycleCopy = ({ state, title, copy, footer }) => {
    stateBanner.hidden = false;
    results.dataset.snapshotState = state;
    stateTitle.textContent = title;
    stateCopy.textContent = copy;
    footerState.textContent = footer;
  };

  const applyEmptyReadyState = ({ resetInputs = false } = {}) => {
    calculationRunGeneration += 1;
    activeCalculationSnapshot = null;
    hasCompletedSnapshot = false;
    delete window.__spreadFootingCalculationSnapshot;
    clearCalculationSurfaces();
    clearResultSnapshotTrace();
    applyProfilePresentation();
    if (resetInputs) {
      form.reset();
      activeForceDisplayUnit = normalizeForceDisplayUnit(forceDisplayUnitSelect?.value);
      syncForceUnitPresentation();
    }
    syncDesignModePresentation();
    syncProfileAndCombination();
    syncFormAdapters();
    syncProfileReadOnlyEvidence();
    applyProfilePresentation();
    markFlowControllerReady();
    results.classList.remove('is-stale', 'is-running', 'is-ready');
    stateBanner.className = 'state-banner state-banner--idle';
    setLifecycleCopy({
      state: 'empty-ready',
      title: 'พร้อมกรอกข้อมูล · ยังไม่มีผลคำนวณ',
      copy: 'Flow 01–08 แสดงลำดับงานไว้เพื่อการเรียนรู้ และจะเปิดพร้อมกันเมื่อคำนวณสำเร็จ',
      id: 'ยังไม่มีผลคำนวณ',
      time: 'ผลลัพธ์ยังล็อก',
      subtitle: 'กรอกข้อมูลแล้วคำนวณเพื่อเปิด Flow 01–08',
      footer: 'พร้อมรับข้อมูล · ยังไม่มีผลคำนวณ',
    });
    printLockSnapshot.textContent = 'ยังไม่มีผลคำนวณ';
    printLockRevision.textContent = '—';
    printLockBasis.textContent = `${resolvedDraftProfile?.profileId || 'UNRESOLVED PROFILE'} · CALCULATION PROFILE`;
    printLockStatus.textContent = 'ยังไม่มีผลคำนวณ';
    printLockDate.textContent = '—';
    printLockFooter.textContent = 'ยังไม่มีผลคำนวณ · ยังพิมพ์ไม่ได้';
    runAnalysisButton.disabled = false;
    runAnalysisButton.removeAttribute('aria-disabled');
    updateFormValidity();
    syncPanelExposure();
  };

  const setIdleState = () => {
    applyEmptyReadyState({ resetInputs: true });
    updateProjectInformationStatus();
  };

  const setDirtyState = () => {
    calculationRunGeneration += 1;
    activeCalculationSnapshot = null;
    delete window.__spreadFootingCalculationSnapshot;
    clearCalculationSurfaces();
    clearResultSnapshotTrace();
    applyProfilePresentation();
    syncDesignModePresentation();
    markFlowControllerReady();
    results.classList.remove('is-stale', 'is-running', 'is-ready');
    stateBanner.className = 'state-banner state-banner--idle';
    setLifecycleCopy({
      state: 'empty-ready',
      title: 'ข้อมูลพร้อมแก้ไข · ยังไม่มีผลคำนวณ',
      copy: 'ค่าปัจจุบันยังไม่ถูกคำนวณ ระบบจึงไม่แสดงตัวเลข Diagram, 3D, A4 หรือชุดแบบ',
      id: 'ยังไม่มีผลคำนวณ',
      time: 'กดคำนวณเมื่อข้อมูลพร้อม',
      subtitle: 'ข้อมูลเปลี่ยนได้ ผลลัพธ์จะเปิดหลังคำนวณสำเร็จ',
      footer: 'พร้อมรับข้อมูล · ยังไม่มีผลคำนวณ',
    });
    printLockSnapshot.textContent = 'ยังไม่มีผลคำนวณปัจจุบัน';
    printLockStatus.textContent = 'ข้อมูลยังไม่ถูกคำนวณ';
    printLockDate.textContent = '—';
    printLockFooter.textContent = 'ยังไม่มีผลคำนวณ · ยังพิมพ์ไม่ได้';
    runAnalysisButton.disabled = false;
    updateFormValidity();
    syncPanelExposure();
  };

  const setStaleState = () => {
    calculationRunGeneration += 1;
    activeCalculationSnapshot = null;
    delete window.__spreadFootingCalculationSnapshot;
    clearCalculationSurfaces();
    clearResultSnapshotTrace();
    applyProfilePresentation();
    markFlowControllerReady();
    results.classList.add('is-stale');
    results.classList.remove('is-running', 'is-ready');
    stateBanner.className = 'state-banner state-banner--stale';
    setLifecycleCopy({
      state: 'stale',
      title: 'ข้อมูลเปลี่ยนแล้ว · ผลเดิมถูกระงับ',
      copy: 'ระบบลบผลเดิมทุกพื้นผิวแล้ว กดคำนวณฐานรากแผ่อีกครั้งเพื่อสร้างผลคำนวณใหม่',
      id: 'STALE',
      time: 'ไม่มีผลคำนวณปัจจุบัน',
      subtitle: 'ผลเดิมถูกลบจนกว่าจะคำนวณใหม่',
      footer: 'ผลล้าสมัย · ไม่มีผลคำนวณปัจจุบัน',
    });
    printLockSnapshot.textContent = 'ผลล้าสมัย / ไม่มีผลคำนวณปัจจุบัน';
    printLockStatus.textContent = 'ข้อมูลเปลี่ยนแล้ว · ห้ามใช้ผลเดิม';
    printLockFooter.textContent = 'STALE · ยังพิมพ์ไม่ได้';
    runAnalysisButton.disabled = false;
    updateFormValidity();
    syncPanelExposure();
  };

  const setRunningState = () => {
    activeCalculationSnapshot = null;
    delete window.__spreadFootingCalculationSnapshot;
    clearCalculationSurfaces();
    clearResultSnapshotTrace();
    applyProfilePresentation();
    results.dataset.controllerState = 'running';
    results.classList.add('is-running');
    results.classList.remove('is-ready');
    results.setAttribute('aria-busy', 'true');
    stateBanner.className = 'state-banner state-banner--running';
    setLifecycleCopy({
      state: 'running',
      title: 'กำลังคำนวณฐานรากแผ่',
      copy: 'กำลังคำนวณและตรวจ Trace ให้ครบทุกพื้นผิว',
      id: 'กำลังคำนวณ',
      time: 'ผลลัพธ์ยังล็อก',
      subtitle: 'กำลังเตรียม Flow 01–08 จากข้อมูลชุดเดียว',
      footer: 'RUNNING · ไม่มีผลลัพธ์ที่อนุญาตให้อ่าน',
    });
    printLockSnapshot.textContent = 'กำลังคำนวณ';
    printLockStatus.textContent = 'กำลังคำนวณ · ยังไม่มีรายงานพร้อมพิมพ์';
    printLockDate.textContent = '—';
    printLockFooter.textContent = 'RUNNING · ยังพิมพ์ไม่ได้';
    validationNote.textContent = 'กำลังคำนวณและตรวจ Trace…';
    if (autoDesignReadout && isAutoDesignMode()) {
      autoDesignReadout.dataset.state = 'selected';
      autoDesignReadout.textContent = 'กำลังค้นหาขนาดฐาน ความหนา และชุดเหล็กที่ผ่านสมการเดิม…';
    }
    runAnalysisButton.disabled = true;
    syncPanelExposure();
  };

  const setCalculationErrorState = (message) => {
    activeCalculationSnapshot = null;
    delete window.__spreadFootingCalculationSnapshot;
    clearCalculationSurfaces();
    clearResultSnapshotTrace();
    applyProfilePresentation();
    results.dataset.controllerState = 'error';
    results.classList.remove('is-running', 'is-ready');
    results.classList.add('is-stale');
    results.setAttribute('aria-busy', 'false');
    stateBanner.className = 'state-banner state-banner--error';
    setLifecycleCopy({
      state: 'error',
      title: 'ไม่สร้างผลคำนวณ · ระงับผลลัพธ์',
      copy: message,
      id: 'ERROR / NO RESULT',
      time: 'ไม่มีผลคำนวณที่ใช้งานได้',
      subtitle: 'การคำนวณไม่สำเร็จ',
      footer: 'ERROR / NO RESULT · ไม่มีผลคำนวณ',
    });
    printLockSnapshot.textContent = 'ERROR / ไม่มีผลคำนวณ';
    printLockStatus.textContent = 'การคำนวณไม่สำเร็จ · ไม่มีผลลัพธ์';
    printLockFooter.textContent = 'ERROR · ยังพิมพ์ไม่ได้';
    validationNote.textContent = `ยังคำนวณไม่ได้ · ${message}`;
    if (autoDesignReadout && isAutoDesignMode()) {
      autoDesignReadout.dataset.state = 'error';
      autoDesignReadout.textContent = message;
    }
    runAnalysisButton.disabled = false;
    syncPanelExposure();
  };

  const setCalculationReadyState = (snapshot) => {
    activeCalculationSnapshot = snapshot;
    hasCompletedSnapshot = true;
    window.__spreadFootingCalculationSnapshot = snapshot;
    applyDesignBasisPresentation(snapshotBasisPresentation(snapshot));
    applyProfilePresentation(resolvedDraftProfile, snapshot);
    updateSnapshotBasisAttributes(snapshot);
    results.dataset.controllerState = 'ready';
    results.dataset.snapshotState = 'ready';
    results.dataset.snapshotId = snapshot.id;
    results.dataset.payloadHash = getSnapshotHash(snapshot);
    results.dataset.calculationFingerprint = getSnapshotCalculationFingerprint(snapshot);
    results.dataset.fingerprint = getSnapshotFingerprint(snapshot);
    results.classList.remove('is-stale', 'is-running');
    results.classList.add('is-ready', 'is-flow-sweep');
    results.setAttribute('aria-busy', 'false');
    stateBanner.className = 'state-banner state-banner--idle';
    stateTitle.textContent = 'คำนวณเสร็จแล้ว';
    stateCopy.textContent = 'ผลทุกแท็บมาจากชุดผลคำนวณเดียวกัน';
    stateBanner.hidden = true;
    const createdAt = snapshot.createdAt ? new Date(snapshot.createdAt) : null;
    footerState.textContent = `${snapshot.id} · FLOW 01–08 SYNCHRONIZED`;
    printLockSnapshot.textContent = snapshot.id;
    printLockRevision.textContent = 'Calculation Review';
    printLockBasis.textContent = `${snapshot.designBasis?.profileId || FOOTING_DESIGN_BASIS.profile} · CALCULATION PROFILE`;
    printLockStatus.textContent = 'คำนวณแล้ว · ผลพร้อมตรวจ';
    printLockDate.textContent = createdAt && !Number.isNaN(createdAt.valueOf())
      ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(createdAt)
      : '—';
    printLockFooter.textContent = `${snapshot.id} · พร้อมพิมพ์รายงาน A4 2 หน้า`;
    validationNote.textContent = snapshot.designSelection?.mode === 'AUTO_UPSIZE'
      ? 'Auto Design เสร็จแล้ว · ขนาดและเหล็กที่เลือกบันทึกอยู่ในชุดผลเดียวกัน'
      : 'คำนวณแล้ว · ทุกแท็บใช้ผลและ Trace ชุดเดียวกัน';
    runAnalysisButton.disabled = false;
    syncPanelExposure();
    if (modelDisplayStatus) {
      modelDisplayStatus.textContent = 'กำลังเตรียมโมเดล 3D จากผลคำนวณ';
    }
    window.setTimeout(() => results.classList.remove('is-flow-sweep'), 260);
  };

  const runSpreadFootingAnalysis = async () => {
    try {
      await initializeDesignProfileControls();
    } catch (error) {
      setCalculationErrorState(describeSnapshotFailure(error));
      return;
    }
    syncProfileAndCombination();
    updateFormValidity();
    if (!form.checkValidity()) {
      calculationRunGeneration += 1;
      setCalculationErrorState('ตรวจค่าที่อยู่นอกช่วงหรือช่องบังคับให้ครบก่อนคำนวณ');
      form.querySelector(':invalid')?.closest('details')?.setAttribute('open', '');
      form.reportValidity();
      return;
    }

    const runGeneration = ++calculationRunGeneration;
    let snapshotCommitted = false;
    setRunningState();

    try {
      const { engine, renderers, snapshot3d } = await loadCalculationRuntime();
      const calculationDraft = readCalculationDraft();
      const snapshot = isAutoDesignMode()
        ? await engine.createSpreadFootingAutoDesignSnapshot(calculationDraft)
        : await engine.createSpreadFootingSnapshot(calculationDraft);
      if (runGeneration !== calculationRunGeneration) return;
      if (!snapshot?.ok) throw new Error(describeSnapshotFailure(snapshot));
      if (snapshot.designSelection?.mode === 'AUTO_UPSIZE') {
        applyAutoDesignSnapshotToForm(snapshot);
      }

      const hydrationPlan = await Promise.resolve(
        renderers.renderSpreadFootingSnapshotHydrationPlan(snapshot, {
          forceUnit: activeForceDisplayUnit,
        })
      );
      if (runGeneration !== calculationRunGeneration) return;

      renderCalculationSurfaces(snapshot, hydrationPlan);
      if (runGeneration !== calculationRunGeneration) return;
      setCalculationReadyState(snapshot);
      snapshotCommitted = true;

      const model = engine.selectSpreadFooting3DData(snapshot).data;
      let pendingSnapshot3d = null;
      let pendingBearing3d = null;
      let pendingSymbolic3d = null;
      const threePanel = document.querySelector('#panel-three');
      const threeContainer = threePanel?.querySelector('.model-stage');
      const threeFallback = threePanel?.querySelector('[data-snapshot-3d-fallback]');
      if (threeContainer) {
        const threeCanvas = createSnapshotCanvas({
          id: 'spreadFooting3d',
          className: 'model-webgl',
          label: 'พื้นที่สามมิติจากผลคำนวณ',
          describedBy: 'modelKeyboardHelp modelInspectorAnnouncement',
        });
        threeContainer.insertBefore(threeCanvas, threeFallback || null);
        threeCanvas.dataset.snapshotId = snapshot.id;
        threeCanvas.dataset.payloadHash = getSnapshotHash(snapshot);
        threeCanvas.dataset.calculationFingerprint = getSnapshotCalculationFingerprint(snapshot);
        pendingSnapshot3d = await snapshot3d.initSpreadFootingSnapshot3D({
          container: threeContainer,
          canvas: threeCanvas,
          snapshot,
          model,
        });
        if (runGeneration !== calculationRunGeneration) {
          pendingSnapshot3d?.dispose?.();
          return;
        }
        if (pendingSnapshot3d?.ready) {
          const activeView = document.querySelector('[data-view].is-active')?.dataset.view || 'iso';
          pendingSnapshot3d.setView?.(activeView);
          pendingSnapshot3d.setDisplayMode?.('overview');
          document.querySelectorAll('[data-layer]').forEach((button) => {
            button.classList.add('is-active');
            button.setAttribute('aria-pressed', 'true');
            pendingSnapshot3d.setLayer?.(button.dataset.layer, true);
          });
          const defaultSelection = document.querySelector('[data-select-mark="barA"]');
          defaultSelection?.classList.add('is-active');
          defaultSelection?.setAttribute('aria-pressed', 'true');
          const selectedLayer = defaultSelection?.dataset.selectMark || 'barA';
          pendingSnapshot3d.selectLayer?.(selectedLayer);
        }
      }
      const summaryPanel = document.querySelector('#panel-summary');
      const bearingContainer = summaryPanel?.querySelector('.bearing-stage');
      const bearingFallback = summaryPanel?.querySelector('[data-snapshot-3d-fallback]');
      if (bearingContainer) {
        const bearingCanvas = createSnapshotCanvas({
          id: 'summaryBearing3d',
          className: 'bearing-webgl',
          label: 'สนามแรงดันดินสามมิติจากผลคำนวณ',
        });
        bearingContainer.insertBefore(bearingCanvas, bearingFallback || null);
        bearingCanvas.dataset.snapshotId = snapshot.id;
        bearingCanvas.dataset.payloadHash = getSnapshotHash(snapshot);
        bearingCanvas.dataset.calculationFingerprint = getSnapshotCalculationFingerprint(snapshot);
        pendingBearing3d = await snapshot3d.initSpreadFootingSnapshot3D({
          container: bearingContainer,
          canvas: bearingCanvas,
          snapshot,
          model,
        });
        if (runGeneration !== calculationRunGeneration) {
          pendingSnapshot3d?.dispose?.();
          pendingBearing3d?.dispose?.();
          return;
        }
        if (pendingBearing3d?.ready) {
          pendingBearing3d.setLayer?.('barA', false);
          pendingBearing3d.setLayer?.('barB', false);
          pendingBearing3d.setLayer?.('critical', false);
          pendingBearing3d.setLayer?.('dowel', false);
          pendingBearing3d.setView?.('iso');
        }
      }
      const analysisPanel = document.querySelector('#panel-analysis');
      const symbolicContainer = analysisPanel?.querySelector('[data-symbolic-3d-stage]');
      const symbolicFallback = symbolicContainer?.querySelector('[data-snapshot-3d-fallback]');
      if (symbolicContainer) {
        const symbolicCanvas = createSnapshotCanvas({
          id: 'analysisSymbolic3d',
          className: 'symbolic-response-webgl',
          label: 'ภาพสามมิติเชิงสัญลักษณ์ของเส้นทางแรงฐานราก ไม่ใช่ผลการทรุดตัว',
          describedBy: 'sfSymbolic3dStatus',
        });
        symbolicContainer.insertBefore(symbolicCanvas, symbolicFallback || null);
        symbolicCanvas.dataset.snapshotId = snapshot.id;
        symbolicCanvas.dataset.payloadHash = getSnapshotHash(snapshot);
        symbolicCanvas.dataset.calculationFingerprint = getSnapshotCalculationFingerprint(snapshot);
        pendingSymbolic3d = await snapshot3d.initSpreadFootingSymbolicResponse3D({
          container: symbolicContainer,
          canvas: symbolicCanvas,
          snapshot,
          model,
        });
        if (runGeneration !== calculationRunGeneration) {
          pendingSnapshot3d?.dispose?.();
          pendingBearing3d?.dispose?.();
          pendingSymbolic3d?.dispose?.();
          return;
        }
      }
      if (runGeneration !== calculationRunGeneration) {
        pendingSnapshot3d?.dispose?.();
        pendingBearing3d?.dispose?.();
        pendingSymbolic3d?.dispose?.();
        return;
      }
      snapshot3dInstance = pendingSnapshot3d;
      snapshotBearing3dInstance = pendingBearing3d;
      snapshotSymbolic3dInstance = pendingSymbolic3d;
      if (snapshot3dInstance?.ready) {
        document.querySelectorAll('[data-layer], [data-select-mark], [data-model-display]').forEach((control) => {
          control.disabled = false;
        });
        setModelDisplayMode('overview', document.querySelector('[data-model-display="overview"]'));
      } else if (modelDisplayStatus) {
        modelDisplayStatus.textContent = 'ใช้ภาพ SVG สำรอง · โมเดล WebGL ไม่พร้อมใช้งาน';
      }
    } catch (error) {
      if (runGeneration !== calculationRunGeneration) return;
      if (snapshotCommitted) {
        disposeCalculation3D();
        console.warn('Spread footing interactive 3D unavailable; result fallback remains active.');
        return;
      }
      setCalculationErrorState(describeSnapshotFailure(error));
    }
  };

  const activateTab = (nextTab, moveFocus = false) => {
    const panelName = nextTab.dataset.tab;
    tabs.forEach((tab) => {
      const isActive = tab === nextTab;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });
    panels.forEach((panel) => {
      const isActive = panel.dataset.panel === panelName;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    });
    syncPanelExposure();
    if (panelName === 'three') {
      if (results.dataset.snapshotState === 'ready' && snapshot3dInstance?.ready) {
        requestAnimationFrame(() => snapshot3dInstance?.resize?.());
      }
    }
    if (panelName === 'summary') {
      if (results.dataset.snapshotState === 'ready' && snapshotBearing3dInstance?.ready) {
        requestAnimationFrame(() => snapshotBearing3dInstance?.resize?.());
      }
    }
    if (panelName === 'analysis') {
      if (results.dataset.snapshotState === 'ready' && snapshotSymbolic3dInstance?.ready) {
        requestAnimationFrame(() => snapshotSymbolic3dInstance?.resize?.());
      }
    }
    if (moveFocus) nextTab.focus();
  };

  const moveTabFocus = (currentTab, key) => {
    const currentIndex = tabs.indexOf(currentTab);
    let nextIndex = currentIndex;
    if (key === 'ArrowRight' || key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
    if (key === 'ArrowLeft' || key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (key === 'Home') nextIndex = 0;
    if (key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === currentIndex && !['Home', 'End'].includes(key)) return;
    activateTab(tabs[nextIndex], true);
  };

  const TUTORIAL_STEPS = Object.freeze([
    {
      title: 'ข้อมูลโครงการ',
      copy: 'เปิด “ข้อมูลหัวรายงาน” เมื่อต้องการแก้ชื่อโครงการ เลขที่เอกสาร Revision และผู้ลงนาม ข้อมูลส่วนนี้ถูกพับไว้เพื่อลดความรก และแสดงตรงกันใน A4 กับชุดแบบ',
      anchors: ['project'],
    },
    {
      title: 'เลือกฐานการออกแบบและตรวจแหล่งอ้างอิง',
      copy: 'ตรวจ f′c, fy, φ ดัด, φ เฉือน และ β1 ที่ Engine คำนวณจาก f′c ค่า φ ถูกล็อกตาม Profile; เปิดหลักฐานมาตรฐานเมื่อต้องการดูเลขข้อและลิงก์ทางการ',
      anchors: ['basis'],
    },
    {
      title: 'รูปทรงและตำแหน่งเสา',
      copy: 'ตรวจขนาดเสา A/B ขนาดฐาน A/B ความหนา T ความลึกท้องฐาน H และระยะหุ้ม ระบบหา “ระดับผิวบนฐาน = H − T” อัตโนมัติให้ทุกผลอ้างมิติชุดเดียวกัน',
      anchors: ['geometry'],
    },
    {
      title: 'น้ำหนักบรรทุกและดิน',
      copy: 'กรอก D, L และ SBC จากรายงานดินหรือวิศวกรปฐพี ชุดรวมน้ำหนักถูกกำหนดจากโปรไฟล์มาตรฐานที่เลือกโดยอัตโนมัติ รุ่น R1 รับ Mx/My เพื่อแสดงแรงดันใช้งานได้ แต่การตรวจกำลังที่มีโมเมนต์ต้องใช้การแยกแรงตาม D/L ซึ่งยังไม่รวมในรุ่นนี้',
      anchors: ['loads', 'soil'],
    },
    {
      title: 'เหล็กเสริมและระยะหุ้ม',
      copy: 'เลือกขนาด DB เดียวและจำนวนเหล็กทิศ A/B ระบบส่งขนาดเดียวกันให้ทั้งสองทิศ แต่ยังคำนวณ dA/dB แยกตามชั้นเหล็กจริงในรูปตัดและ 3D',
      anchors: ['rebar'],
    },
    {
      title: 'กดคำนวณฐานรากแผ่',
      copy: 'ตรวจช่องกรอกให้ครบแล้วกด “คำนวณฐานรากแผ่” ระบบจะตรวจขอบเขต R1 และสร้างผลคำนวณใหม่ เมื่อแก้ค่าใดภายหลัง ผลเดิมจะล้าสมัยและถูกลบจนกดคำนวณอีกครั้ง',
      anchors: ['snapshot'],
      tab: 'summary',
    },
    {
      title: 'อ่านค่า D/C และการวิเคราะห์',
      copy: 'อ่าน Demand, Capacity/Allowable และ D/C แล้วตรวจ BMD/SFD: รุ่น R1 แสดง |M| ของกรณีผิวล่างดึง; M+ คือโมเมนต์ดัดหงาย ส่วน M− คือโมเมนต์ดัดคว่ำ/ผิวบนดึงซึ่งยังไม่มีเส้นผลในรุ่นนี้',
      anchors: ['dc'],
      tab: 'dc',
    },
    {
      title: 'ตรวจรูปตัด เหล็ก และ 3D',
      copy: 'เทียบแปลน รูปตัด และ H-01/H-02 ก่อนเปิด 3D จากนั้นเปลี่ยนมุมมอง เปิดปิดชั้นข้อมูล และเลือก Inspector โดยห้ามสรุปผลจากภาพเพียงอย่างเดียว',
      anchors: ['three'],
      tab: 'three',
    },
    {
      title: 'ตรวจ A4 และรายการคำนวณ',
      copy: 'อ่านรายงาน A4 ตามลำดับหลักฐาน 01–07 แล้วเปิดรายการคำนวณเพื่อตรวจสูตร การแทนค่า หน่วย สมมติฐาน เลขข้อ และ URL ต้นทาง ทุกหน้าใช้รหัสผลคำนวณและ Payload Hash ชุดเดียวกัน',
      anchors: ['report'],
      tab: 'report',
    },
    {
      title: 'ตรวจชุดแบบและสถานะก่อสร้าง',
      copy: 'ตรวจ SF-01, SF-02, SF-03, ตารางเหล็ก และข้อมูลความปลอดภัยประจำแผ่นให้ตรงกัน เอกสารทั้งหมดยังเป็น NOT FOR CONSTRUCTION / NOT RELEASED BBS การพิมพ์ ส่งออก ผลิต และใช้ก่อสร้างยังล็อก',
      anchors: ['drawing'],
      tab: 'drawing',
    },
  ]);

  let tutorialStepIndex = 0;
  let tutorialReturnFocus = null;

  const clearTutorialHighlight = () => {
    document.querySelectorAll('.is-tutorial-highlight, [data-tutorial-current="true"]').forEach((element) => {
      element.classList.remove('is-tutorial-highlight');
      delete element.dataset.tutorialCurrent;
    });
  };

  const renderTutorialStep = () => {
    if (!guidedTutorial || guidedTutorial.hidden) return;
    const step = TUTORIAL_STEPS[tutorialStepIndex];
    if (!step) return;

    if (step.anchors.includes('project') && projectInformationPanel) {
      projectInformationPanel.open = true;
      updateProjectInformationStatus();
    }

    if (step.tab) {
      const stepTab = tabs.find((tab) => tab.dataset.tab === step.tab);
      if (stepTab) activateTab(stepTab);
    }

    clearTutorialHighlight();
    const targets = step.anchors.flatMap((anchor) => [
      ...document.querySelectorAll(`[data-tutorial-anchor="${anchor}"]`),
    ]);
    targets.forEach((target) => {
      target.classList.add('is-tutorial-highlight');
      target.dataset.tutorialCurrent = 'true';
    });

    const stepNumber = tutorialStepIndex + 1;
    const progress = (stepNumber / TUTORIAL_STEPS.length) * 100;
    tutorialStepLabel.textContent = `ขั้นที่ ${stepNumber} จาก ${TUTORIAL_STEPS.length}`;
    tutorialStepTitle.textContent = step.title;
    tutorialStepCopy.textContent = step.copy;
    tutorialProgressText.textContent = `${stepNumber} / ${TUTORIAL_STEPS.length}`;
    tutorialProgressBar.style.width = `${progress}%`;
    tutorialBack.disabled = tutorialStepIndex === 0;
    tutorialNext.textContent = tutorialStepIndex === TUTORIAL_STEPS.length - 1 ? 'เสร็จสิ้น' : 'ถัดไป';

    const visibleTarget = targets.find((target) => !target.closest('[hidden]')) || targets[0];
    requestAnimationFrame(() => {
      visibleTarget?.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
  };

  const closeTutorial = ({ restoreFocus = true } = {}) => {
    if (!guidedTutorial || !tutorialStart) return;
    guidedTutorial.hidden = true;
    delete document.body.dataset.tutorialState;
    tutorialStart.setAttribute('aria-expanded', 'false');
    clearTutorialHighlight();
    if (restoreFocus) {
      const returnTarget = tutorialReturnFocus?.isConnected ? tutorialReturnFocus : tutorialStart;
      requestAnimationFrame(() => returnTarget.focus({ preventScroll: true }));
    }
    tutorialReturnFocus = null;
  };

  const openTutorial = () => {
    if (!guidedTutorial || !tutorialStart) return;
    tutorialReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : tutorialStart;
    tutorialStepIndex = 0;
    guidedTutorial.hidden = false;
    document.body.dataset.tutorialState = 'open';
    tutorialStart.setAttribute('aria-expanded', 'true');
    renderTutorialStep();
    tutorialExit?.focus({ preventScroll: true });
  };

  const DOCUMENT_FOCUS_TARGETS = Object.freeze({
    report: Object.freeze({ tab: 'report', target: '#panel-report .document-review-toolbar', label: 'รายงาน A4' }),
    calc: Object.freeze({ tab: 'calc', target: '#panel-calc .document-review-toolbar', label: 'รายการคำนวณ' }),
    drawing: Object.freeze({ tab: 'drawing', target: '#panel-drawing .drawing-grid', label: 'ชุดแบบ' }),
  });

  function syncDocumentFocusAccess() {
    const isReady = results.dataset.snapshotState === 'ready' && Boolean(activeCalculationSnapshot);
    if (!isReady && activeDocumentFocus) {
      activeDocumentFocus = null;
      documentFocusReturn = null;
      document.body.classList.remove('is-document-focus');
      delete document.body.dataset.documentFocus;
    }
    documentFocusButtons.forEach((button) => {
      const isActive = isReady && activeDocumentFocus === button.dataset.documentFocus;
      button.disabled = !isReady;
      button.setAttribute('aria-disabled', String(!isReady));
      button.setAttribute('aria-pressed', String(isActive));
      const label = isActive
        ? button.dataset.labelActive
        : isReady
          ? button.dataset.labelReady
          : button.dataset.labelLocked;
      const labelTarget = button.querySelector('[data-document-focus-label]');
      if (labelTarget && label) labelTarget.textContent = label;
    });
    if (documentAccessNote) {
      documentAccessNote.textContent = isReady
        ? 'รายงาน A4 และรายการคำนวณพร้อมเปิดจากผลคำนวณปัจจุบัน'
        : 'รายงาน A4 และรายการคำนวณจะเปิดเมื่อคำนวณสำเร็จ';
    }
    if (!activeDocumentFocus && documentFocusStatus) {
      documentFocusStatus.textContent = isReady
        ? 'รายงาน A4 และรายการคำนวณพร้อมเปิด'
        : 'รายงาน A4 และรายการคำนวณยังไม่เปิด เนื่องจากยังไม่มีผลคำนวณปัจจุบัน';
    }
  }

  const setDocumentFocus = (scope, sourceButton = null) => {
    const isReady = results.dataset.snapshotState === 'ready' && Boolean(activeCalculationSnapshot);
    if (!isReady) {
      syncDocumentFocusAccess();
      return;
    }
    if (!scope || scope === activeDocumentFocus) {
      const returnTarget = documentFocusReturn;
      activeDocumentFocus = null;
      documentFocusReturn = null;
      document.body.classList.remove('is-document-focus');
      delete document.body.dataset.documentFocus;
      syncDocumentFocusAccess();
      if (documentFocusStatus) {
        documentFocusStatus.textContent = 'กลับสู่โต๊ะคำนวณแล้ว';
      }
      if (returnTarget?.isConnected) {
        requestAnimationFrame(() => returnTarget.focus({ preventScroll: true }));
      }
      return;
    }

    const config = DOCUMENT_FOCUS_TARGETS[scope];
    if (!config) return;
    const scopeTab = tabs.find((tab) => tab.dataset.tab === config.tab);
    if (scopeTab) activateTab(scopeTab);

    activeDocumentFocus = scope;
    documentFocusReturn = sourceButton || document.querySelector(`[data-document-focus="${scope}"]`);
    document.body.classList.add('is-document-focus');
    document.body.dataset.documentFocus = scope;
    syncDocumentFocusAccess();
    if (documentFocusStatus) {
      documentFocusStatus.textContent = `เปิด${config.label}เต็มหน้าแล้ว กด Escape หรือปุ่มกลับโต๊ะคำนวณเพื่อออก`;
    }
    const focusTarget = document.querySelector(config.target);
    requestAnimationFrame(() => {
      focusTarget?.focus({ preventScroll: true });
      focusTarget?.scrollIntoView({ block: 'start', inline: 'nearest' });
    });
  };

  const printCalculationReport = () => {
    if (!syncPrintAccess()) {
      if (printReportStatus) {
        printReportStatus.textContent = 'ยังพิมพ์ไม่ได้ · กรุณาคำนวณใหม่ให้ได้ผลคำนวณปัจจุบันก่อน';
      }
      return;
    }
    if (printReportStatus) {
      printReportStatus.textContent = 'กำลังเปิดกล่องพิมพ์ · เลือก “บันทึกเป็น PDF” เพื่อสร้างไฟล์รายงาน 2 หน้า';
    }
    window.print();
  };

  const setModelView = (view, sourceButton) => {
    document.querySelectorAll('[data-view]').forEach((button) => {
      const isActive = button === sourceButton;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    document.querySelectorAll('[data-model-scene]').forEach((scene) => {
      const isActive = scene.dataset.modelScene === view;
      scene.classList.toggle('is-active', isActive);
      scene.style.display = isActive ? '' : 'none';
    });
    modelStage.dataset.modelView = view;
    const viewLabels = {
      top: 'มุมมองด้านบน',
      front: 'มุมมองด้านหน้า',
      right: 'มุมมองด้านขวา',
      iso: 'มุมมองไอโซเมตริก',
    };
    modelViewLabel.textContent = viewLabels[view] || 'มุมมองกำหนดเอง';
    if (results.dataset.snapshotState === 'ready' && snapshot3dInstance?.ready) {
      snapshot3dInstance.setView?.(view);
    }
  };

  const handleInputChange = (event) => {
    if (event.target?.matches?.('[data-project-required]')) {
      updateProjectInformationStatus();
    }
    if (event.target === forceDisplayUnitSelect) {
      syncForceUnitPresentation({ convertValues: true });
      updateFormValidity();
      return;
    }
    if (event.target === designProfileSelect) {
      syncProfileAndCombination({ resetApplicability: true });
      updateFormValidity();
    }
    if (event.target === loadApplicabilityConfirmedInput) {
      syncLoadApplicabilityControl();
      updateFormValidity();
    }
    if (event.target === designModeSelect) {
      syncDesignModePresentation();
    }
    syncFormAdapters();
    syncProfileReadOnlyEvidence();
    if (hasCompletedSnapshot) setStaleState();
    else setDirtyState();
  };

  const setModelDisplayMode = (mode, sourceButton, announce = false) => {
    const nextMode = mode === 'rebar' ? 'rebar' : 'overview';
    document.querySelectorAll('[data-model-display]').forEach((button) => {
      const isActive = button === sourceButton || button.dataset.modelDisplay === nextMode;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    modelStage.dataset.modelDisplayMode = nextMode;
    modelDisplayShell?.setAttribute('data-model-display-shell', nextMode);
    if (results.dataset.snapshotState === 'ready' && snapshot3dInstance?.ready) {
      snapshot3dInstance.setDisplayMode?.(nextMode);
    }
    const status = nextMode === 'rebar'
      ? 'เปิดชั้นเหล็ก · ลดความทึบวัสดุรอบข้างเท่านั้น · ตำแหน่งเหล็กและระยะหุ้มไม่เปลี่ยน'
      : 'ภาพรวม · คอนกรีต เหล็ก และแรงดันแสดงตำแหน่งจริงจากผลคำนวณ';
    if (modelDisplayStatus) modelDisplayStatus.textContent = status;
    if (announce && modelInspectorAnnouncement) {
      modelInspectorAnnouncement.textContent = status;
    }
  };

  form.addEventListener('input', handleInputChange);
  form.addEventListener('change', handleInputChange);
  projectInformationPanel?.addEventListener('input', handleInputChange);
  projectInformationPanel?.addEventListener('change', handleInputChange);
  projectInformationPanel?.addEventListener('toggle', updateProjectInformationStatus);
  runAnalysisButton.addEventListener('click', () => {
    void runSpreadFootingAnalysis();
  });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    if (matchesDefaultInputValues()) applyEmptyReadyState();
    else setDirtyState();
  });
  document.querySelector('#resetDefaults')?.addEventListener('click', setIdleState);
  document.querySelector('.back-button').addEventListener('click', () => {
    const surface = new URLSearchParams(window.location.search).get('surface');
    if (surface === 'member' && window.parent !== window) {
      window.parent.postMessage({ type: '2dp:spread-footing-back' }, window.location.origin);
      return;
    }
    try {
      const referrerUrl = new URL(document.referrer);
      if (window.history.length > 1 && referrerUrl.origin === window.location.origin) {
        window.history.back();
        return;
      }
    } catch {
      // Missing or malformed referrers fail closed to the known root route.
    }
    window.location.assign('/');
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      moveTabFocus(tab, event.key);
    });
  });

  tutorialStart?.addEventListener('click', () => {
    if (guidedTutorial?.hidden !== false) {
      openTutorial();
      return;
    }
    closeTutorial();
  });
  tutorialBack?.addEventListener('click', () => {
    tutorialStepIndex = Math.max(0, tutorialStepIndex - 1);
    renderTutorialStep();
  });
  tutorialNext?.addEventListener('click', () => {
    if (tutorialStepIndex >= TUTORIAL_STEPS.length - 1) {
      closeTutorial();
      return;
    }
    tutorialStepIndex += 1;
    renderTutorialStep();
  });
  tutorialRestart?.addEventListener('click', () => {
    tutorialStepIndex = 0;
    renderTutorialStep();
  });
  tutorialExit?.addEventListener('click', () => closeTutorial());

  documentFocusButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setDocumentFocus(button.dataset.documentFocus, button);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (activeDocumentFocus) {
      event.preventDefault();
      setDocumentFocus(null);
      return;
    }
    if (guidedTutorial?.hidden === false) {
      event.preventDefault();
      closeTutorial();
    }
  });

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => setModelView(button.dataset.view, button));
  });

  document.querySelectorAll('[data-model-display]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled || results.dataset.snapshotState !== 'ready') return;
      setModelDisplayMode(button.dataset.modelDisplay, button, true);
    });
  });

  document.querySelectorAll('[data-bearing-view]').forEach((button) => {
    button.addEventListener('click', () => {
      if (results.dataset.snapshotState === 'ready' && snapshotBearing3dInstance?.ready) {
        snapshotBearing3dInstance.setView?.(button.dataset.bearingView);
      }
    });
  });
  printCalculationReportButton?.addEventListener('click', printCalculationReport);
  window.addEventListener('beforeprint', syncPrintAccess);
  window.addEventListener('afterprint', () => {
    if (printReportStatus && isCurrentReportPrintable()) {
      printReportStatus.textContent = 'ปิดกล่องพิมพ์แล้ว · รายงาน A4 ยังพร้อมพิมพ์หรือบันทึก PDF';
    }
  });

  document.querySelector('[data-bearing-action="fit"]')?.addEventListener('click', () => {
    if (results.dataset.snapshotState === 'ready' && snapshotBearing3dInstance?.ready) {
      snapshotBearing3dInstance.fit?.();
      if (bearingViewAnnouncement) {
        bearingViewAnnouncement.textContent = 'จัดสนามแรงดันดินจากผลคำนวณให้อยู่พอดีกับพื้นที่แสดงผลแล้ว';
      }
    }
  });

  document.querySelector('[data-model-action="fit"]')?.addEventListener('click', () => {
    if (results.dataset.snapshotState === 'ready' && snapshot3dInstance?.ready) {
      snapshot3dInstance.fit?.();
    }
  });

  document.querySelectorAll('[data-layer]').forEach((button) => {
    button.addEventListener('click', () => {
      const isActive = !button.classList.contains('is-active');
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
      document.querySelectorAll(`[data-model-layer="${button.dataset.layer}"]`).forEach((layer) => {
        layer.style.display = isActive ? '' : 'none';
      });
      if (results.dataset.snapshotState === 'ready' && snapshot3dInstance?.ready) {
        snapshot3dInstance.setLayer?.(button.dataset.layer, isActive);
      }
    });
  });

  modelEvidence = null;
  syncModelEvidencePresentation();

  document.querySelectorAll('[data-select-mark]').forEach((button) => {
    button.addEventListener('click', () => {
      const evidence = modelEvidence?.[button.dataset.selectMark];
      if (!evidence) return;
      document.querySelectorAll('[data-select-mark]').forEach((markButton) => {
        const isActive = markButton === button;
        markButton.classList.toggle('is-active', isActive);
        markButton.setAttribute('aria-pressed', String(isActive));
      });
      document.querySelectorAll('[data-model-layer]').forEach((layer) => {
        layer.classList.toggle('is-selected', layer.dataset.modelLayer === button.dataset.selectMark);
      });
      syncModelEvidencePresentation(button.dataset.selectMark, true);
      if (results.dataset.snapshotState === 'ready' && snapshot3dInstance?.ready) {
        snapshot3dInstance.selectLayer?.(button.dataset.selectMark);
      }
    });
  });

  activateTab(tabs[0]);
  setModelView('iso', document.querySelector('[data-view="iso"]'));
  updateProjectInformationStatus();
  applyEmptyReadyState();
  void initializeDesignProfileControls().then(async () => {
    const { mountConcreteProjectControls } = await import('/concrete-project-store.mjs');
    // Existing form input contract only; hidden authority and derived/read-only
    // evidence are reconstructed by the current engine/profile adapters.
    const inputControls = [...form.elements].filter(control => control.name && control.type !== 'hidden' && !control.readOnly && !control.dataset.derivedField && ['INPUT','SELECT','TEXTAREA'].includes(control.tagName));
    const capture = () => ({ version: 1, fields: Object.fromEntries(inputControls.map(control => [control.name, control.type === 'checkbox' ? control.checked : control.value])) });
    const validate = input => input?.version === 1 && Object.keys(input).length === 2 && input.fields && Object.keys(input.fields).length === inputControls.length && inputControls.every(control => {
      const value = input.fields[control.name];
      return control.type === 'checkbox' ? typeof value === 'boolean' : typeof value === 'string' && value.length < 4096 && (control.tagName !== 'SELECT' || [...control.options].some(option => option.value === value));
    });
    const apply = input => {
      if (!validate(input)) throw new Error('ข้อมูลฐานรากแผ่ไม่ครบ');
      setDirtyState();
      inputControls.forEach(control => { if (control.type === 'checkbox') control.checked = input.fields[control.name]; else control.value = input.fields[control.name]; });
      syncProfileAndCombination({ resetApplicability: false });
      syncForceUnitPresentation({ convertValues: false }); syncDesignModePresentation(); syncFormAdapters();
      updateProjectInformationStatus(); updateFormValidity(); setDirtyState();
    };
    window.SVSpreadFootingProjectInputs = Object.freeze({ capture, validate, apply });
    window.SVSpreadFootingProjectStore = mountConcreteProjectControls({ card: 'spread-footing', host: document.querySelector('.topbar__actions'), capture, validate, apply });
  }).catch(() => {
    updateFormValidity();
  });
})();
