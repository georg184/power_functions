/* UI and complete learner-state adapter for the power-function generator. */
(function () {
  'use strict';
  const APP_VERSION = '20261011.173544';
  const core = window.PowerFunctionsCore;
  const bridge = window.MuWeaveModuleBridge || null;
  const storageKey = 'power-functions-state-v1';
  const root = document.getElementById('app');
  const messages = {
    de: {
      title: 'Potenzfunktionen', numbers: 'Nur Zahlen', parameters: 'Mit Parametern',
      back: 'Zur Auswahl', count: 'Aufgaben', level: 'Schwierigkeit', progressive: 'Aufbauend',
      easy: 'Einfach', medium: 'Mittel', hard: 'Anspruchsvoll', generate: 'Neue Aufgaben',
      showAll: 'Alle Lösungen anzeigen', hideAll: 'Alle Lösungen verbergen', solution: 'Musterlösung',
      instruction: 'Bringe die Funktionsterme auf Standardform. Bestimme jeweils die unabhängige Variable, den Grad und den Skalierungsfaktor.',
      parameterNote: 'Zusätzliche Buchstaben sind feste reelle Zahlen ungleich 0.',
      numberNote: 'Die unabhängige Variable darf alle reellen Werte annehmen.',
      variable: 'Variable', degree: 'Grad', coefficient: 'Skalierungsfaktor', standard: 'Standardform',
      given: 'Ausgangsterm', powers: 'Potenzen auf die Faktoren verteilen; Potenz einer Potenz ausrechnen.',
      collect: 'Zahlen multiplizieren und Exponenten gleicher Basen addieren.',
      factor: 'Die gemeinsame Potenz ausklammern und die Zahlen zusammenfassen.',
      combine: 'Die Zahlen in der Klammer zusammenfassen.',
      cancel: 'Gemeinsame Faktoren kürzen; Exponenten gleicher Basen subtrahieren.',
      domain: 'Definitionsbereich', hole: 'Beim Kürzen bleibt der ursprünglich ausgeschlossene Wert erhalten.',
      extension: 'Mit dieser Ergänzung entsteht eine Potenzfunktion auf ganz',
      reveal: 'Musterlösung zu Aufgabe', languages: 'Sprache', loading: 'Formeln werden geladen …',
      changed: 'Neue Aufgaben sind bereit.', disabled: 'Speichern ist gesperrt. Die Aufgaben bleiben sichtbar; Änderungen sind deaktiviert.',
      mathError: 'Die Formeldarstellung konnte nicht geladen werden. Bitte die Seite neu laden.',
      stateError: 'Die gespeicherten Aufgaben konnten nicht geladen werden. Der gespeicherte Stand wurde nicht überschrieben.',
      versionError: 'Die Dateien gehören zu verschiedenen App-Versionen. Bitte die Seite vollständig neu laden.',
      saveError: 'Dieser Browser kann den Stand nicht dauerhaft speichern. Die aktuellen Aufgaben bleiben auf dieser Seite verfügbar.'
    },
    en: {
      title: 'Power functions', numbers: 'Numbers only', parameters: 'With parameters',
      back: 'Choose a mode', count: 'Exercises', level: 'Difficulty', progressive: 'Progressive',
      easy: 'Easy', medium: 'Intermediate', hard: 'Advanced', generate: 'New exercises',
      showAll: 'Show all solutions', hideAll: 'Hide all solutions', solution: 'Worked solution',
      instruction: 'Rewrite each function in standard form. Identify the independent variable, degree and coefficient.',
      parameterNote: 'Additional letters are fixed nonzero real numbers.',
      numberNote: 'The independent variable may take any real value.',
      variable: 'Variable', degree: 'Degree', coefficient: 'Coefficient', standard: 'Standard form',
      given: 'Original expression', powers: 'Distribute powers over factors; multiply exponents in a power of a power.',
      collect: 'Multiply numerical factors and add exponents with the same base.',
      factor: 'Factor out the common power and combine the numerical coefficients.',
      combine: 'Combine the numbers inside the parentheses.',
      cancel: 'Cancel common factors; subtract exponents with the same base.',
      domain: 'Domain', hole: 'Cancellation does not restore the originally excluded value.',
      extension: 'This extension defines a power function on all of',
      reveal: 'Worked solution for exercise', languages: 'Language', loading: 'Loading formulas …',
      changed: 'New exercises are ready.', disabled: 'Saving is disabled. Exercises remain visible; changes are disabled.',
      mathError: 'Formula rendering could not be loaded. Please reload the page.',
      stateError: 'The saved exercises could not be loaded. The saved state has not been overwritten.',
      versionError: 'Files from different app versions were loaded. Please reload the entire page.',
      saveError: 'This browser cannot save the state persistently. The current exercises remain available on this page.'
    },
    fr: {
      title: 'Fonctions puissances', numbers: 'Nombres seuls', parameters: 'Avec paramètres',
      back: 'Choisir un mode', count: 'Exercices', level: 'Difficulté', progressive: 'Progressive',
      easy: 'Facile', medium: 'Intermédiaire', hard: 'Avancée', generate: 'Nouveaux exercices',
      showAll: 'Afficher toutes les solutions', hideAll: 'Masquer toutes les solutions', solution: 'Solution détaillée',
      instruction: 'Écris chaque fonction sous forme standard. Détermine la variable indépendante, le degré et le coefficient.',
      parameterNote: 'Les lettres supplémentaires désignent des nombres réels fixes non nuls.',
      numberNote: 'La variable indépendante peut prendre toute valeur réelle.',
      variable: 'Variable', degree: 'Degré', coefficient: 'Coefficient', standard: 'Forme standard',
      given: 'Expression initiale', powers: 'Distribuer les puissances sur les facteurs ; multiplier les exposants d’une puissance de puissance.',
      collect: 'Multiplier les facteurs numériques et additionner les exposants de même base.',
      factor: 'Mettre la puissance commune en facteur et regrouper les coefficients numériques.',
      combine: 'Regrouper les nombres entre parenthèses.',
      cancel: 'Simplifier les facteurs communs ; soustraire les exposants de même base.',
      domain: 'Domaine de définition', hole: 'La simplification ne rétablit pas la valeur initialement exclue.',
      extension: 'Ce prolongement définit une fonction puissance sur tout',
      reveal: 'Solution détaillée de l’exercice', languages: 'Langue', loading: 'Chargement des formules …',
      changed: 'Les nouveaux exercices sont prêts.', disabled: 'L’enregistrement est désactivé. Les exercices restent visibles ; les modifications sont désactivées.',
      mathError: 'Le rendu des formules n’a pas pu être chargé. Recharge la page.',
      stateError: 'Les exercices enregistrés n’ont pas pu être chargés. L’état enregistré n’a pas été écrasé.',
      versionError: 'Des fichiers de versions différentes ont été chargés. Recharge entièrement la page.',
      saveError: 'Ce navigateur ne peut pas enregistrer durablement l’état. Les exercices actuels restent disponibles sur cette page.'
    }
  };
  let state = {schema: 1, language: 'de', mode: null, count: 10, level: 'progressive', seed: 0, revealed: []};
  let tasks = [], locked = false, ready = false, queue = Promise.resolve();
  const text = key => messages[state.language][key];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const math = source => `<span class="math">\\(\\displaystyle ${escape(source)}\\)</span>`;
  const snapshot = () => ready ? core.validateState(state) : bridge?.getState() ?? null;

  /** Stop mutations on an explicit infrastructure failure, retaining the current worksheet. */
  function fail(key) {
    locked = true;
    document.getElementById('notice').textContent = text(key);
    root.querySelectorAll('button, select, summary').forEach(element => {
      if (element.tagName === 'SUMMARY') element.setAttribute('aria-disabled', 'true');
      else element.disabled = true;
    });
  }
  if (!core || core.VERSION !== APP_VERSION || window.GG_APP_VERSION !== APP_VERSION ||
      !window.GGTypography || window.GGTypography.VERSION !== '1.1.0') {
    fail('versionError');
    return;
  }

  function publish() {
    if (!ready || locked) return;
    if (bridge) {
      if (!bridge.isEnabled()) { fail('disabled'); return; }
      bridge.updateState(snapshot());
      bridge.reportProgress({tasks: tasks.length, solutionsRevealed: state.revealed.length});
    } else {
      try { localStorage.setItem(storageKey, JSON.stringify(snapshot())); }
      catch { document.getElementById('notice').textContent = text('saveError'); }
    }
  }

  /** Serialize typesetting so fast UI actions cannot race different sheets. */
  function typeset() {
    queue = queue.then(async () => {
      if (!window.MathJax?.startup?.promise) throw new Error('MathJax unavailable');
      await window.MathJax.startup.promise;
      if (!window.MathJax.typesetPromise) throw new Error('MathJax unavailable');
      await window.MathJax.typesetPromise([root]);
      if (root.querySelector('mjx-merror, [data-mjx-error]')) throw new Error('Invalid formula');
      if (bridge?.isInitialized()) bridge.reportPreferredHeight(Math.ceil(document.body.getBoundingClientRect().height));
      root.dataset.mathReady = 'true';
    }).catch(() => fail('mathError'));
    return queue;
  }

  function solution(task) {
    const equation = `${task.functionName}(${task.variable})`;
    const steps = task.stages.slice(1).map(step => `<li><p>${escape(text(step.rule))}</p><div class="equation">${math(`${equation}=${core.latex(step.expression)}`)}</div></li>`).join('');
    const restricted = task.excludedZero ? `\\mathbb{R}\\setminus\\{0\\}` : '\\mathbb{R}';
    return `<div class="solution-body"><ol class="steps">${steps}</ol>
      <div class="answer"><strong>${escape(text('standard'))}</strong><div class="equation">${math(`${equation}=${core.latex(task.standard)}`)}</div>
      <dl><div><dt>${text('variable')}</dt><dd>${math(task.variable)}</dd></div><div><dt>${text('degree')}</dt><dd>${math(String(task.degree))}</dd></div>
      <div><dt>${text('coefficient')}</dt><dd>${math(core.latex(task.coefficient))}</dd></div></dl></div>
      <p>${text('domain')}: ${math(restricted)}.</p>
      ${task.excludedZero ? `<p class="domain-note">${text('hole')} ${math(`${task.variable}\\ne 0`)}.</p><p>${text('extension')} ${math('\\mathbb{R}')}: ${math(`${task.functionName}(0)=0`)}.</p>` : ''}</div>`;
  }

  function render() {
    if (locked) return;
    const focused = root.contains(document.activeElement) ? document.activeElement.id : '';
    window.MathJax?.typesetClear?.([root]);
    window.GGTypography.apply({'--size-small': -1, '--size-body': 0, '--size-heading': 1, '--size-title': 3}, bridge);
    const context = bridge?.getModuleContext();
    document.documentElement.dataset.presentation = context?.presentation || 'full';
    document.documentElement.lang = state.language;
    document.title = text('title');
    root.setAttribute('aria-label', text('title'));
    tasks = core.generateSheet(state);
    const language = `<label class="language"><span>${text('languages')}</span><select id="language">${core.LANGUAGES.map(code => `<option value="${code}" ${state.language === code ? 'selected' : ''}>${({de: 'Deutsch', en: 'English', fr: 'Français'})[code]}</option>`).join('')}</select></label>`;
    const heading = `<header class="page-header"><h1>${text('title')}</h1>${language}</header>`;
    if (!state.mode) {
      root.innerHTML = `${heading}<div class="mode-buttons"><button data-mode="numbers">${text('numbers')}</button><button data-mode="parameters">${text('parameters')}</button></div>`;
    } else {
      root.innerHTML = `${heading}<div class="mode-heading"><button class="back" id="back">← ${text('back')}</button><h2>${text(state.mode)}</h2></div>
        <div class="toolbar"><label>${text('count')}<select id="count">${core.COUNTS.map(n => `<option value="${n}" ${state.count === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>${text('level')}<select id="level">${core.LEVELS.map(level => `<option value="${level}" ${state.level === level ? 'selected' : ''}>${text(level)}</option>`).join('')}</select></label>
        <button class="primary" id="generate">${text('generate')}</button><button id="toggle-all">${text(state.revealed.length === tasks.length ? 'hideAll' : 'showAll')}</button></div>
        <div class="instructions"><p>${text('instruction')}</p><p>${text(state.mode === 'parameters' ? 'parameterNote' : 'numberNote')}</p></div>
        <ol class="exercises">${tasks.map((task, index) => `<li class="exercise" data-task="${index}"><div class="question"><strong class="marker">${String.fromCharCode(97 + index)})</strong><div class="formula">${math(`${task.functionName}(${task.variable})=${core.latex(task.expression)}`)}</div></div>
          ${task.excludedZero ? `<p class="restriction">${math(`${task.variable}\\ne 0`)}</p>` : ''}
          <details data-solution="${index}" ${state.revealed.includes(index) ? 'open' : ''}><summary aria-label="${text('reveal')} ${String.fromCharCode(97 + index)}">${text('solution')}</summary>${state.revealed.includes(index) ? solution(task) : ''}</details></li>`).join('')}</ol>`;
    }
    root.dataset.mathReady = 'false';
    if (focused) document.getElementById(focused)?.focus({preventScroll: true});
    typeset();
  }

  function newSheet(mode = state.mode) {
    state.mode = mode;
    state.seed = crypto.getRandomValues(new Uint32Array(1))[0];
    state.revealed = [];
    render();
    publish();
    document.getElementById('status').textContent = text('changed');
  }

  root.addEventListener('click', event => {
    if (locked) { event.preventDefault(); return; }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.mode) { state.count = button.dataset.mode === 'numbers' ? 10 : 6; newSheet(button.dataset.mode); }
    else if (button.id === 'generate') newSheet();
    else if (button.id === 'back') { state.mode = null; state.revealed = []; render(); publish(); }
    else if (button.id === 'toggle-all') {
      state.revealed = state.revealed.length === tasks.length ? [] : tasks.map((_, i) => i);
      render(); publish();
    }
  });
  root.addEventListener('change', event => {
    if (locked) return;
    if (event.target.id === 'language') { state.language = event.target.value; render(); publish(); }
    else if (event.target.id === 'count') { state.count = Number(event.target.value); newSheet(); }
    else if (event.target.id === 'level') { state.level = event.target.value; newSheet(); }
  });
  root.addEventListener('toggle', event => {
    const details = event.target;
    if (locked || !details.matches('details[data-solution]') || !root.contains(details)) return;
    const index = Number(details.dataset.solution), wasOpen = state.revealed.includes(index);
    if (details.open === wasOpen) return;
    if (details.open) {
      state.revealed.push(index);
      details.insertAdjacentHTML('beforeend', solution(tasks[index]));
    } else {
      state.revealed = state.revealed.filter(i => i !== index);
      window.MathJax?.typesetClear?.([details]);
      details.querySelector('.solution-body')?.remove();
    }
    document.getElementById('toggle-all').textContent = text(state.revealed.length === tasks.length ? 'hideAll' : 'showAll');
    typeset(); publish();
  }, true);
  // Wheel scrolling belongs to the page, including over closed selects.
  root.addEventListener('wheel', event => {
    if (event.target.matches('select')) event.target.blur();
  }, {passive: true});

  function initialize(restored) {
    if (ready) { if (bridge && !bridge.isEnabled()) fail('disabled'); return; }
    if (restored !== null && restored !== undefined) {
      try { state = core.validateState(restored); }
      catch { fail('stateError'); return; }
    }
    ready = true;
    document.getElementById('notice').textContent = '';
    render();
  }
  if (bridge) {
    bridge.setSnapshotProvider(snapshot);
    bridge.subscribeState(initialize);
    if (bridge.isInitialized()) initialize(bridge.getState());
    window.addEventListener('message', () => { if (ready && !bridge.isEnabled()) fail('disabled'); });
  } else {
    let restored = null, saved = null, storageAvailable = true;
    try { saved = localStorage.getItem(storageKey); }
    catch { storageAvailable = false; }
    if (saved) {
      try { restored = JSON.parse(saved); }
      catch { fail('stateError'); return; }
    }
    initialize(restored);
    if (!storageAvailable && !locked) document.getElementById('notice').textContent = text('saveError');
  }
  new ResizeObserver(() => {
    if (bridge?.isInitialized()) bridge.reportPreferredHeight(Math.ceil(document.body.getBoundingClientRect().height));
  }).observe(document.body);
})();
