import { CeremonyMotion } from './ceremony-motion.js';
import { KovilStageRenderer } from './kovil-stage-renderer.js';
import { KovilBackdrop } from './kovil-backdrop.js';

(() => {
  'use strict';

  const STORAGE_KEY = 'compuvate-digital-oil-lamp-v1';
  const LOGIN_USER = 'compuvate';
  const LOGIN_PASSWORD = 'compuvate 123';
  const BOWL_IMAGE = 'assets/gold-oil-bowl.png';
  const DEFAULT_PHOTO = 'assets/first-guest.png';
  const GUEST_DISPLAY_MODES = {
    both: 'Photos, names & designations',
    'photos-only': 'Photos only — no names or designations',
    'names-only': 'Names & designations — no photos',
    'lamps-only': 'Lamps only — no guest photos, names or designations'
  };
  const OFFICIAL_PHOTOS = {
    'Professor Thilini De Silva': DEFAULT_PHOTO,
    'Dr. Rasika Ranaweera': 'assets/guest-rasika.png',
    'Senior Lecturer Nasiketha Sarawanapawan': 'assets/guest-nasiketha.png',
    'Ms. Pavithra Subhashini': 'assets/guest-pavithra.png',
    'Mr. Chamara Rathnayake': '',
    'Mr. Chmindra Aththanayake': 'assets/guest-chmindra.png',
    'Ms. Yasanthika Mathotaarachchi': 'assets/guest-yasanthika.png',
    'Ms. Kavishka Rajapaksha': 'assets/guest-kavishka.png',
    'Semali Perera': ''
  };
  const FONT_STACKS = {
    'Cinzel': 'Cinzel, "Palatino Linotype", Georgia, serif',
    'Cormorant Garamond': '"Cormorant Garamond", Garamond, Georgia, serif',
    'Playfair Display': '"Playfair Display", Georgia, serif',
    'EB Garamond': '"EB Garamond", Garamond, Georgia, serif',
    'Libre Baskerville': '"Libre Baskerville", Baskerville, Georgia, serif',
    'Georgia': 'Georgia, serif',
    'Merriweather': 'Merriweather, Constantia, Georgia, serif',
    'Baskerville': '"Baskerville", "Palatino Linotype", Georgia, serif',
    'Garamond': 'Garamond, Georgia, serif',
    'Times New Roman': '"Times New Roman", serif'
  };
  const DEFAULT_GUESTS = [
    ['Professor Thilini De Silva', 'Deputy Vice Chancellor', DEFAULT_PHOTO],
    ['Dr. Rasika Ranaweera', 'Head, Software Engineering & Computer Security Department', OFFICIAL_PHOTOS['Dr. Rasika Ranaweera']],
    ['Senior Lecturer Nasiketha Sarawanapawan', 'Senior Lecturer', OFFICIAL_PHOTOS['Senior Lecturer Nasiketha Sarawanapawan']],
    ['Ms. Pavithra Subhashini', 'Head, Industry Collaboration Unit, Faculty of Computing', OFFICIAL_PHOTOS['Ms. Pavithra Subhashini']],
    ['Mr. Chamara Rathnayake', 'Senior Lecturer', ''],
    ['Mr. Chmindra Aththanayake', 'Senior Lecturer', OFFICIAL_PHOTOS['Mr. Chmindra Aththanayake']],
    ['Ms. Yasanthika Mathotaarachchi', 'MIC, CompuVate Association / Lecturer, Faculty of Computing', OFFICIAL_PHOTOS['Ms. Yasanthika Mathotaarachchi']],
    ['Ms. Kavishka Rajapaksha', 'Lecturer', OFFICIAL_PHOTOS['Ms. Kavishka Rajapaksha']],
    ['Semali Perera', 'Senior President of CompuVate Association', '']
  ].map(([name, designation, photo], index) => ({ id: `default-${index + 1}`, name, designation, photo }));

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const totalLamps = () => state.rowCounts.reduce((sum, count) => sum + count, 0);
  const ceremonyCount = () => state.guestDisplayMode === 'lamps-only' ? totalLamps() : state.guests.length;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const safePhoto = value => String(value || '').startsWith('data:image/') || String(value || '').startsWith('assets/') ? value : '';
  const avatar = (photo, alt = '') => photo ? `<img src="${escapeHtml(safePhoto(photo))}" alt="${escapeHtml(alt)}">` : '<span class="avatar-placeholder" aria-label="No photo">♟</span>';

  function initialState() {
    return {
      title: 'Problem Lab 1.0', titleFont: 'Cinzel', background: '', backgroundName: '',
      rowCounts: [3, 3, 3], flameSize: 70, flameVolume: 70, lightIntensity: 80,
      guests: DEFAULT_GUESTS.map(guest => ({ ...guest })), photoSeedApplied: true, guestDisplayMode: 'both',
      lit: Array(9).fill(false), current: 0
    };
  }
  function loadState() {
    const fallback = initialState();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || !Array.isArray(saved.guests) || !Array.isArray(saved.rowCounts)) return fallback;
      const counts = saved.rowCounts.map(n => clamp(Math.trunc(Number(n) || 1), 1, 30)).slice(0, 6);
      if (!counts.length || counts.reduce((a, b) => a + b, 0) > 30) return fallback;
      const guests = saved.guests.filter(g => g && typeof g.name === 'string' && typeof g.designation === 'string').slice(0, 30)
        .map((g, index) => ({
          id: String(g.id || `saved-${index}`), name: g.name, designation: g.designation,
          photo: !saved.photoSeedApplied && Object.hasOwn(OFFICIAL_PHOTOS, g.name)
            ? OFFICIAL_PHOTOS[g.name] : safePhoto(g.photo)
        }));
      const sum = counts.reduce((a, b) => a + b, 0);
      return {
        ...fallback, ...saved, rowCounts: counts, guests, photoSeedApplied: true,
        guestDisplayMode: Object.hasOwn(GUEST_DISPLAY_MODES, saved.guestDisplayMode) ? saved.guestDisplayMode : 'both',
        titleFont: FONT_STACKS[saved.titleFont] ? saved.titleFont : fallback.titleFont,
        flameSize: clamp(Number(saved.flameSize) || 70, 10, 100),
        flameVolume: clamp(Number(saved.flameVolume) || 70, 10, 100),
        lightIntensity: clamp(Number(saved.lightIntensity) || 80, 10, 100),
        lit: Array.from({ length: sum }, (_, index) => Boolean(saved.lit?.[index])),
        current: clamp(Number(saved.current) || 0, 0, saved.guestDisplayMode === 'lamps-only' ? sum : guests.length)
      };
    } catch { return fallback; }
  }

  let state = loadState();
  let editingIndex = null;
  let pendingPhoto = '';
  let replacePhotoIndex = null;
  let orderDraft = [];
  let originalOrder = [];
  let confirmCallback = null;
  let toastTimer = null;
  let rehearsalSnapshot = null;
  let presentationRequestPending = false;
  const screen = $('#ceremony-screen');
  const frame = $('#kovil-frame');
  for (const element of [screen.querySelector('.ceremony-header'), screen.querySelector('.ceremony-main'), $('#status-board'), screen.querySelector('.ceremony-controls')]) frame.append(element);
  const backdrop = new KovilBackdrop({ screen, frame, image: $('#kovil-backdrop-image'), canvas: $('#kovil-backdrop-patches') });
  const stageRenderer = new KovilStageRenderer({ screen, frame, canvas: $('#kovil-canvas'), image: $('#kovil-backdrop-image'), board: $('#status-board') });
  const restoreStage = document.createElement('button');
  restoreStage.type = 'button'; restoreStage.className = 'button button-outline'; restoreStage.id = 'restore-approved-stage'; restoreStage.textContent = 'USE APPROVED STAGE';
  $('#background-upload').parentElement.append(restoreStage);
  restoreStage.addEventListener('click', () => { state.background = ''; state.backgroundName = ''; renderSetup(); saveState(); toast('Approved ceremony stage selected.'); });
  screen.addEventListener('kovil-frame-resize', () => stageRenderer.invalidate());
  const motion = new CeremonyMotion({
    screen: $('#ceremony-screen'),
    boardRenderer: stageRenderer,
    sendLamp: message => sendLampMessage('ceremony-lamp-3d', message),
    onBusy: busy => {
      $('#ceremony-lamp-button').disabled = busy || motion?.paused || state.current >= ceremonyCount() || Boolean(state.lit[state.current]);
      $('#next-guest').disabled = busy || motion?.paused || state.current >= ceremonyCount() || !state.lit[state.current];
    }
  });

  function saveState(showMessage = false) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (showMessage) toast('Setup saved on this device.');
      return true;
    } catch {
      toast('Could not save. Try smaller images or free browser storage.', true);
      return false;
    }
  }
  function toast(message, isError = false) {
    const element = $('#toast');
    clearTimeout(toastTimer);
    element.textContent = message;
    element.classList.toggle('error', isError);
    element.classList.add('visible');
    toastTimer = setTimeout(() => element.classList.remove('visible'), 3600);
  }
  function showScreen(name) {
    if (name !== 'ceremony' && motion.busy) motion.cancel();
    if (name !== 'ceremony') {
      setPresentationMode(false);
      if (document.fullscreenElement === $('#ceremony-screen')) document.exitFullscreen().catch(() => {});
    }
    $('#login-screen').hidden = name !== 'login';
    $('#setup-screen').hidden = name !== 'setup';
    $('#ceremony-screen').hidden = name !== 'ceremony';
    if (name === 'ceremony') { clearTimeout(toastTimer); $('#toast').classList.remove('visible'); }
    stageRenderer.setActive(name === 'ceremony');
    if (name === 'ceremony') backdrop.resize();
    sendLampMessage('setup-lamp-3d', { type: 'pause', value: name !== 'setup' });
    sendLampMessage('ceremony-lamp-3d', { type: 'pause', value: name !== 'ceremony' || motion.paused });
    window.scrollTo(0, 0);
  }
  function restoreRehearsal() {
    if (!rehearsalSnapshot) return false;
    state.current = rehearsalSnapshot.current;
    state.lit = [...rehearsalSnapshot.lit];
    rehearsalSnapshot = null;
    $('#ceremony-screen').classList.remove('rehearsal');
    $('#undo-lighting').textContent = '↶  UNDO';
    $('#next-guest').textContent = 'NEXT GUEST  ❯';
    return true;
  }
  function setTitleFont() {
    const stack = FONT_STACKS[state.titleFont] || FONT_STACKS.Georgia;
    $('#event-title').style.fontFamily = stack;
    $('#ceremony-title').style.fontFamily = stack;
  }
  function renderSetup() {
    $('#event-title').value = state.title;
    $('#title-font').value = state.titleFont;
    $('#background-name').textContent = state.backgroundName || 'Approved blue kovil stage';
    $('#flame-size').value = state.flameSize;
    $('#flame-volume').value = state.flameVolume;
    $('#light-intensity').value = state.lightIntensity;
    setTitleFont();
    renderLayout();
    renderGuests();
    renderFlameControls();
    renderDisplaySettings();
  }
  function renderDisplaySettings() {
    $('#display-settings-summary').textContent = GUEST_DISPLAY_MODES[state.guestDisplayMode];
  }
  function openDisplaySettings() {
    $$('#display-settings-form input[name="guestDisplayMode"]').forEach(input => {
      input.checked = input.value === state.guestDisplayMode;
    });
    $('#display-settings-dialog').showModal();
  }
  function setPresentationMode(active, fallback = false) {
    const screen = $('#ceremony-screen');
    const wasActive = screen.classList.contains('presentation-mode');
    screen.classList.toggle('presentation-mode', active);
    screen.classList.toggle('presentation-fallback', active && fallback);
    backdrop.setPresentation(active);
    screen.querySelector('.ceremony-controls').inert = active;
    screen.querySelector('.ceremony-tools').inert = active;
    $('#presentation-exit').hidden = !active || !fallback;
    if (active) {
      $('#ceremony-tools-menu').hidden = true;
      $('#ceremony-tools-toggle').setAttribute('aria-expanded', 'false');
      screen.focus({ preventScroll: true });
    } else if (wasActive && !screen.hidden) $('#presentation-fullscreen').focus({ preventScroll: true });
  }
  async function togglePresentationFullscreen() {
    if (presentationRequestPending) return;
    const screen = $('#ceremony-screen');
    if (screen.classList.contains('presentation-mode')) {
      if (document.fullscreenElement === screen) {
        try { await document.exitFullscreen(); } catch { setPresentationMode(false); }
      } else setPresentationMode(false);
      return;
    }
    presentationRequestPending = true;
    try {
      if (typeof screen.requestFullscreen !== 'function') throw new Error('Native fullscreen unavailable');
      await screen.requestFullscreen({ navigationUI: 'hide' });
      setPresentationMode(document.fullscreenElement === screen);
    } catch {
      // Tablets without the Fullscreen API can still present without operator controls.
      setPresentationMode(true, true);
    } finally { presentationRequestPending = false; }
  }
  function renderLayout() {
    $('#lamp-count').textContent = String(totalLamps());
    $('#row-count').textContent = String(state.rowCounts.length);
    $('#row-controls').innerHTML = state.rowCounts.map((count, index) => `<div class="row-control"><span>⋮⋮ &nbsp; Row ${index + 1}</span><div class="stepper"><button type="button" data-row="${index}" data-delta="-1" aria-label="Remove a lamp from row ${index + 1}" ${count <= 1 ? 'disabled' : ''}>−</button><output>${count}</output><button type="button" data-row="${index}" data-delta="1" aria-label="Add a lamp to row ${index + 1}" ${totalLamps() >= 30 ? 'disabled' : ''}>+</button></div><small>lamps</small></div>`).join('');
    $('#mini-layout').innerHTML = state.rowCounts.map((count, index) => `<div class="mini-row" aria-label="Row ${index + 1}: ${count} lamps">${Array.from({ length: count }, () => `<img src="${BOWL_IMAGE}" alt="">`).join('')}</div>`).join('');
    $('#layout-summary').textContent = `${totalLamps()} lamp${totalLamps() === 1 ? '' : 's'} across ${state.rowCounts.length} row${state.rowCounts.length === 1 ? '' : 's'}`;
    $('#lamp-minus').disabled = totalLamps() <= state.rowCounts.length;
    $('#lamp-plus').disabled = totalLamps() >= 30;
    $('#row-minus').disabled = state.rowCounts.length <= 1;
    $('#row-plus').disabled = state.rowCounts.length >= Math.min(6, 30);
  }
  function renderGuests() {
    $('#guest-count').textContent = `${state.guests.length} guest${state.guests.length === 1 ? '' : 's'}`;
    $('#guest-rows').innerHTML = state.guests.map((guest, index) => `<tr><td>${String(index + 1).padStart(2, '0')}</td><td>${escapeHtml(guest.name)}</td><td>${escapeHtml(guest.designation)}</td><td>${avatar(guest.photo, `${guest.name} photo`)}</td><td><button type="button" class="dots-button" data-menu-index="${index}" aria-label="Actions for ${escapeHtml(guest.name)}" aria-expanded="false">⋮</button></td></tr>`).join('');
  }
  function renderFlameControls() {
    $('#flame-size-value').textContent = `${state.flameSize}%`;
    $('#flame-volume-value').textContent = `${state.flameVolume}%`;
    $('#light-intensity-value').textContent = `${state.lightIntensity}%`;
    $('#flame-size').value = state.flameSize;
    $('#flame-volume').value = state.flameVolume;
    $('#light-intensity').value = state.lightIntensity;
    const scale = (.35 + state.flameSize / 105).toFixed(2);
    const opacity = (.25 + state.lightIntensity / 130).toFixed(2);
    $('#ceremony-screen').style.setProperty('--flame-scale', scale);
    $('#ceremony-screen').style.setProperty('--flame-opacity', opacity);
    const config = { type: 'config', flameSize: state.flameSize, flameVolume: state.flameVolume, lightIntensity: state.lightIntensity };
    sendLampMessage('setup-lamp-3d', config);
    sendLampMessage('ceremony-lamp-3d', config);
  }
  function sendLampMessage(id, message) {
    if (id === 'ceremony-lamp-3d') { stageRenderer.handleMainMessage(message); return; }
    const frame = $('#' + id);
    if (frame?.contentWindow) frame.contentWindow.postMessage({ channel: 'compuvate-lamp-3d', ...message }, location.origin);
  }

  function changeLampTotal(delta) {
    if (delta > 0 && totalLamps() < 30) state.rowCounts[state.rowCounts.length - 1]++;
    if (delta < 0 && totalLamps() > state.rowCounts.length) {
      for (let index = state.rowCounts.length - 1; index >= 0; index--) {
        if (state.rowCounts[index] > 1) { state.rowCounts[index]--; break; }
      }
    }
    renderLayout();
  }
  function changeRowCount(delta) {
    if (delta > 0 && state.rowCounts.length < 6) {
      const donor = state.rowCounts.findIndex(count => count > 1);
      if (donor >= 0) { state.rowCounts[donor]--; state.rowCounts.push(1); }
      else if (totalLamps() < 30) state.rowCounts.push(1);
    }
    if (delta < 0 && state.rowCounts.length > 1) {
      const removed = state.rowCounts.pop();
      state.rowCounts[state.rowCounts.length - 1] += removed;
    }
    renderLayout();
  }
  function changeIndividualRow(index, delta) {
    if (!Number.isInteger(index) || !state.rowCounts[index]) return;
    if (delta > 0 && totalLamps() < 30) state.rowCounts[index]++;
    if (delta < 0 && state.rowCounts[index] > 1) state.rowCounts[index]--;
    renderLayout();
  }

  async function imageFileToDataUrl(file, maxSide) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Choose an image file.');
    const raw = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    const image = new Image(); image.src = raw;
    await image.decode();
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .78);
  }
  function previewPendingPhoto() {
    const image = $('#guest-photo-preview');
    image.hidden = !pendingPhoto;
    $('#guest-photo-placeholder').hidden = Boolean(pendingPhoto);
    if (pendingPhoto) image.src = pendingPhoto;
    else image.removeAttribute('src');
  }
  function openGuestDialog(index = null) {
    hideGuestMenu();
    editingIndex = Number.isInteger(index) ? index : null;
    const guest = editingIndex === null ? null : state.guests[editingIndex];
    $('#guest-dialog-title').textContent = guest ? 'EDIT GUEST' : 'ADD GUEST';
    $('#guest-name').value = guest?.name || '';
    $('#guest-designation').value = guest?.designation || '';
    $('#guest-position').value = guest ? editingIndex + 1 : state.guests.length + 1;
    $('#guest-position').max = String(state.guests.length + (guest ? 0 : 1));
    $('#guest-error').textContent = '';
    $('#guest-photo-file').value = '';
    pendingPhoto = guest?.photo || '';
    previewPendingPhoto();
    $('#guest-dialog').showModal();
    $('#guest-name').focus();
  }
  function saveGuest(event) {
    event.preventDefault();
    const name = $('#guest-name').value.trim();
    const designation = $('#guest-designation').value.trim();
    if (!name || !designation) { $('#guest-error').textContent = 'Enter both the guest name and designation.'; return; }
    if (editingIndex === null && state.guests.length >= 30) { $('#guest-error').textContent = 'Maximum of 30 guests reached.'; return; }
    const position = clamp(Number($('#guest-position').value) || 1, 1, state.guests.length + (editingIndex === null ? 1 : 0));
    const guest = { id: editingIndex === null ? `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : state.guests[editingIndex].id, name, designation, photo: pendingPhoto };
    if (editingIndex !== null) state.guests.splice(editingIndex, 1);
    state.guests.splice(position - 1, 0, guest);
    $('#guest-dialog').close();
    renderGuests();
    toast('Guest saved.');
  }

  function hideGuestMenu() {
    $('#guest-menu').hidden = true;
    $$('.dots-button').forEach(button => button.setAttribute('aria-expanded', 'false'));
  }
  function openGuestMenu(button, index) {
    hideGuestMenu();
    const menu = $('#guest-menu');
    menu.innerHTML = `<button type="button" role="menuitem" data-action="edit">✎ &nbsp; Edit guest</button><button type="button" role="menuitem" data-action="photo">▣ &nbsp; Replace photo</button><button type="button" role="menuitem" data-action="up" ${index === 0 ? 'disabled' : ''}>↑ &nbsp; Move up</button><button type="button" role="menuitem" data-action="down" ${index === state.guests.length - 1 ? 'disabled' : ''}>↓ &nbsp; Move down</button><button type="button" role="menuitem" class="danger" data-action="remove">▣ &nbsp; Remove guest</button>`;
    menu.dataset.index = String(index);
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    const bounds = button.getBoundingClientRect();
    const left = Math.min(window.innerWidth - menu.offsetWidth - 8, bounds.right - menu.offsetWidth);
    const top = Math.min(window.innerHeight - menu.offsetHeight - 8, bounds.bottom + 3);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;
  }
  function swapGuests(a, b) {
    [state.guests[a], state.guests[b]] = [state.guests[b], state.guests[a]];
    renderGuests();
  }
  function handleGuestMenuAction(action, index) {
    hideGuestMenu();
    if (action === 'edit') openGuestDialog(index);
    if (action === 'photo') { openGuestDialog(index); $('#guest-photo-file').click(); }
    if (action === 'up' && index > 0) swapGuests(index, index - 1);
    if (action === 'down' && index < state.guests.length - 1) swapGuests(index, index + 1);
    if (action === 'remove') confirmAction('Remove guest', `Remove ${state.guests[index].name} from the ceremony?`, () => {
      state.guests.splice(index, 1); renderGuests(); toast('Guest removed.');
    });
  }

  function renderOrderList() {
    $('#order-list').innerHTML = orderDraft.map((guest, index) => `<div class="order-item" draggable="true" data-order-index="${index}"><span class="order-handle" title="Drag to reorder">⠿</span><span class="order-number">${String(index + 1).padStart(2, '0')}</span>${avatar(guest.photo, `${guest.name} photo`)}<span class="order-text"><strong>${escapeHtml(guest.name)}</strong><small>${escapeHtml(guest.designation)}</small></span><button type="button" data-move="up" data-index="${index}" aria-label="Move ${escapeHtml(guest.name)} up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="down" data-index="${index}" aria-label="Move ${escapeHtml(guest.name)} down" ${index === orderDraft.length - 1 ? 'disabled' : ''}>↓</button></div>`).join('');
  }
  function openOrderDialog() {
    hideGuestMenu();
    orderDraft = [...state.guests];
    originalOrder = [...state.guests];
    renderOrderList();
    $('#order-dialog').showModal();
  }
  function moveOrder(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= orderDraft.length) return;
    [orderDraft[index], orderDraft[next]] = [orderDraft[next], orderDraft[index]];
    renderOrderList();
  }
  function confirmAction(title, message, callback) {
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = message;
    confirmCallback = callback;
    $('#confirm-dialog').showModal();
  }

  function renderCeremony(animateLamp = false) {
    const screen = $('#ceremony-screen');
    const lampsOnly = state.guestDisplayMode === 'lamps-only';
    const showNames = !lampsOnly && state.guestDisplayMode !== 'photos-only';
    const showPhotos = !lampsOnly && state.guestDisplayMode !== 'names-only';
    screen.dataset.guestDisplay = state.guestDisplayMode;
    $('#ceremony-title').textContent = state.title || 'DIGITAL OIL LAMP CEREMONY';
    setTitleFont();
    backdrop.sync({ title: state.title, titleFont: state.titleFont, background: state.background }).catch(error => console.warn('Background could not be loaded.', error));
    if (state.background) { screen.style.setProperty('--event-background', `url("${state.background}")`); screen.classList.add('has-background'); }
    else { screen.classList.remove('has-background'); screen.style.removeProperty('--event-background'); }
    const done = state.current >= ceremonyCount();
    const guest = state.guests[state.current];
    screen.style.setProperty('--kovil-guest-name-size', `${Math.max(18, Math.min(26, 26 - Math.max(0, (guest?.name.length || 0) - 26) / 5))}px`);
    screen.style.setProperty('--kovil-guest-designation-size', `${(guest?.designation.length || 0) > 90 ? 14 : 17}px`);
    const lit = !done && Boolean(state.lit[state.current]);
    const count = ceremonyCount();
    $('#ceremony-count').textContent = `${String(Math.min(state.current + 1, count)).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
    screen.classList.toggle('lamp-lit', lit);
    $('#ceremony-guest-name').textContent = showNames ? (done ? 'Ceremony Complete' : guest.name) : '';
    $('#ceremony-designation').textContent = showNames ? (done ? 'All invited guests have participated.' : guest.designation) : '';
    const photo = $('#ceremony-photo');
    const hasPhoto = showPhotos && !done && Boolean(safePhoto(guest.photo));
    photo.hidden = !hasPhoto;
    $('#ceremony-photo-placeholder').hidden = !showPhotos || hasPhoto;
    if (hasPhoto) { photo.src = safePhoto(guest.photo); photo.alt = showNames ? `${guest.name} photo` : 'Current guest photo'; }
    else { photo.removeAttribute('src'); photo.alt = ''; }
    const lampButton = $('#ceremony-lamp-button');
    lampButton.disabled = done || lit;
    lampButton.classList.toggle('lit', lit);
    $('#ceremony-hint').innerHTML = done ? '<span>All lamps are lit</span><span>Ceremony complete</span>' : lit ? '<span>Your flame is lit</span><span>Preparing the next guest</span>' : '<span>Touch the lamp</span><span>to begin your moment</span>';
    let guestIndex = 0;
    $('#status-board').style.setProperty('--board-rows', state.rowCounts.length);
    $('#status-grid').innerHTML = state.rowCounts.map(rowCount => `<div class="status-row" style="--row-lamps:${rowCount}">${Array.from({ length: rowCount }, () => {
      const index = guestIndex++;
      const person = state.guests[index];
      const waveDuration = (1.55 + (index % 9) * .13).toFixed(2);
      const waveDelay = (index * .29).toFixed(2);
      const waveDirection = index % 2 ? 'reverse' : 'normal';
      const tokenVisible = !lampsOnly && Boolean(state.lit[index]) && !(animateLamp && index === state.current);
      const initials = (person?.name || '').split(' ').filter(word => !/^(Ms\.|Mr\.|Dr\.|Professor|Senior|Lecturer)$/.test(word)).slice(0, 2).map(word => word[0]).join('');
      const token = lampsOnly ? '' : !showPhotos
        ? `<span class="token-name">${escapeHtml(person?.name || `Guest ${index + 1}`)}</span>`
        : safePhoto(person?.photo)
          ? `<img src="${escapeHtml(safePhoto(person.photo))}" alt="${showNames ? escapeHtml(person.name) : `Guest ${index + 1} photo`}">`
          : showNames ? `<span class="token-initials">${escapeHtml(initials)}</span>` : '<span class="token-photo-placeholder" aria-label="Photo pending">♟</span>';
      const guestToken = lampsOnly ? '' : `<div class="guest-token ${tokenVisible ? 'token-visible' : ''}" data-guest-index="${index}">${token}</div>`;
      return `<div class="status-lamp ${state.lit[index] ? 'lit' : ''} ${index === state.current ? 'active' : ''}" data-index="${index}" title="${escapeHtml(showNames ? (person?.name || `Lamp ${index + 1}`) : `Lamp ${index + 1}`)}">${guestToken}<div class="status-bowl" data-lamp-index="${index}"><img src="${BOWL_IMAGE}" alt=""><span class="flame" style="--wave-duration:${waveDuration}s;--wave-delay:-${waveDelay}s;--wave-direction:${waveDirection}" aria-hidden="true"></span></div><strong>${String(index + 1).padStart(2, '0')}</strong><span class="name">${showNames ? escapeHtml(person?.name || 'Unassigned') : ''}</span></div>`;
    }).join('')}</div>`).join('');
    positionStepLamps();
    $('#next-guest').disabled = done || !state.lit[state.current];
    $('#previous-guest').disabled = state.current <= 0;
    $('#undo-lighting').disabled = !state.lit.some(Boolean);
    renderFlameControls();
    motion.sync({ lit: state.lit, rowCounts: state.rowCounts, flameSize: state.flameSize, flameVolume: state.flameVolume, lightIntensity: state.lightIntensity, title: state.title, guestDisplayMode: state.guestDisplayMode });
    sendLampMessage('ceremony-lamp-3d', animateLamp ? { type: 'ignite' } : { type: 'lit', value: !done && Boolean(state.lit[state.current]) });
  }
  function positionStepLamps() {
    const rowCount = state.rowCounts.length;
    const dense = rowCount > 3;
    $('#ceremony-screen').dataset.kovilDenseRows = String(dense);
    const rowSpacing = rowCount === 1 ? 159 : 159 / (rowCount - 1);
    const rowY = rowCount === 1 ? [717] : Array.from({ length: rowCount }, (_, i) => 640 + i * 159 / (rowCount - 1));
    let index = 0;
    state.rowCounts.forEach((count, row) => {
      const perspective = rowCount === 1 ? .5 : row / (rowCount - 1);
      const left = 446 - 26 * perspective, right = 1222.5 + 28 * perspective;
      const spacing = count === 1 ? 800 : (right - left) / (count - 1);
      const denseLimit = dense ? (rowSpacing - (state.guestDisplayMode === 'lamps-only' ? 6 : 16)) / .53 : Infinity;
      const width = Math.min(57 + 5 * perspective, spacing * .68, denseLimit);
      for (let column = 0; column < count; column++) {
        const slot = $(`.status-lamp[data-index="${index++}"]`);
        slot.style.setProperty('--lamp-x', String(count === 1 ? 835.5 : left + column * spacing));
        slot.style.setProperty('--lamp-y', String(rowY[row]));
        slot.style.setProperty('--lamp-width', String(width));
        slot.style.setProperty('--lamp-height', String(width * .53));
        slot.style.setProperty('--token-width', String(Math.min(38, spacing * .55, dense ? rowSpacing - width * .53 - 3 : Infinity)));
      }
    });
    $('#status-board').setAttribute('aria-label', `${totalLamps()} lamps in ${rowCount} rows on the ceremony steps`);
    stageRenderer.invalidate();
  }
  function generateCeremony() {
    restoreRehearsal();
    if (!state.title.trim()) { toast('Enter an event title.', true); $('#event-title').focus(); return; }
    if (state.guestDisplayMode !== 'lamps-only' && state.guests.length !== totalLamps()) {
      const difference = totalLamps() - state.guests.length;
      toast(difference > 0 ? `Add ${difference} guest${difference === 1 ? '' : 's'} to match the lamps.` : `Remove ${-difference} guest${difference === -1 ? '' : 's'} or add more lamps.`, true);
      return;
    }
    if (!saveState()) return;
    motion.cancel();
    $('#next-guest').textContent = 'NEXT GUEST  ❯';
    state.lit = Array(totalLamps()).fill(false);
    state.current = 0;
    saveState();
    renderCeremony();
    showScreen('ceremony');
  }

  // Login: a local ceremony-operator gate. It is not a network authentication service.
  $('#login-form').addEventListener('submit', event => {
    event.preventDefault();
    const user = $('#login-username').value.trim();
    const pass = $('#login-password').value;
    if (user === LOGIN_USER && pass === LOGIN_PASSWORD) {
      try { sessionStorage.setItem('compuvate-login', 'yes'); } catch { /* Local files may disallow session storage. */ }
      $('#login-password').value = '';
      $('#login-error').textContent = '';
      renderSetup();
      showScreen('setup');
    } else $('#login-error').textContent = 'Username or password is incorrect.';
  });
  $('#event-title').addEventListener('input', event => { state.title = event.target.value; });
  $('#title-font').addEventListener('change', event => { state.titleFont = event.target.value; setTitleFont(); });
  $('#background-upload').addEventListener('click', () => $('#background-file').click());
  $('#background-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { state.background = await imageFileToDataUrl(file, 1920); state.backgroundName = file.name; $('#background-name').textContent = file.name; toast('Background image added.'); }
    catch (error) { toast(error.message || 'Could not load image.', true); }
    event.target.value = '';
  });
  $('#lamp-minus').addEventListener('click', () => changeLampTotal(-1));
  $('#lamp-plus').addEventListener('click', () => changeLampTotal(1));
  $('#row-minus').addEventListener('click', () => changeRowCount(-1));
  $('#row-plus').addEventListener('click', () => changeRowCount(1));
  $('#row-controls').addEventListener('click', event => {
    const button = event.target.closest('button[data-row]');
    if (button) changeIndividualRow(Number(button.dataset.row), Number(button.dataset.delta));
  });
  $('#flame-size').addEventListener('input', event => { state.flameSize = Number(event.target.value); renderFlameControls(); });
  $('#flame-volume').addEventListener('input', event => { state.flameVolume = Number(event.target.value); renderFlameControls(); });
  $('#light-intensity').addEventListener('input', event => { state.lightIntensity = Number(event.target.value); renderFlameControls(); });
  $('#setup-lamp-3d').addEventListener('load', () => { renderFlameControls(); sendLampMessage('setup-lamp-3d', { type: 'pause', value: $('#setup-screen').hidden }); });
  $('#ceremony-lamp-3d').addEventListener('load', () => {
    renderFlameControls();
    sendLampMessage('ceremony-lamp-3d', { type: 'lit', value: state.current < ceremonyCount() && Boolean(state.lit[state.current]) });
    sendLampMessage('ceremony-lamp-3d', { type: 'pause', value: $('#ceremony-screen').hidden || motion.paused });
  });
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.data?.channel !== 'compuvate-lamp-3d' || event.data.type !== 'ready') return;
    for (const id of ['setup-lamp-3d', 'ceremony-lamp-3d']) {
      if (event.source !== $('#' + id).contentWindow) continue;
      renderFlameControls();
      const hidden = id === 'setup-lamp-3d' ? $('#setup-screen').hidden : $('#ceremony-screen').hidden || motion.paused || $('#ceremony-screen').classList.contains('finale-running');
      sendLampMessage(id, { type: 'pause', value: hidden });
    }
  });
  $$('.range-control button[data-adjust]').forEach(button => button.addEventListener('click', () => {
    const property = button.dataset.adjust;
    state[property] = clamp(state[property] + Number(button.dataset.delta), 10, 100);
    renderFlameControls();
  }));
  $('#save-setup').addEventListener('click', () => saveState(true));
  $('#generate').addEventListener('click', generateCeremony);
  $('#display-settings').addEventListener('click', openDisplaySettings);
  $('#display-settings-form').addEventListener('submit', event => {
    event.preventDefault();
    const selected = $('#display-settings-form input[name="guestDisplayMode"]:checked')?.value;
    if (!Object.hasOwn(GUEST_DISPLAY_MODES, selected)) return;
    const previous = state.guestDisplayMode;
    state.guestDisplayMode = selected;
    if (!saveState()) { state.guestDisplayMode = previous; return; }
    renderDisplaySettings();
    $('#display-settings-dialog').close();
    toast('Display settings saved.');
  });
  $('#add-guest').addEventListener('click', () => openGuestDialog());
  $('#choose-guest-photo').addEventListener('click', () => $('#guest-photo-file').click());
  $('#guest-photo-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { pendingPhoto = await imageFileToDataUrl(file, 700); previewPendingPhoto(); }
    catch (error) { $('#guest-error').textContent = error.message || 'Could not load photo.'; }
    event.target.value = '';
  });
  $('#guest-form').addEventListener('submit', saveGuest);
  $('#position-minus').addEventListener('click', () => { $('#guest-position').value = Math.max(1, Number($('#guest-position').value) - 1); });
  $('#position-plus').addEventListener('click', () => { $('#guest-position').value = Math.min(Number($('#guest-position').max), Number($('#guest-position').value) + 1); });
  $('#guest-rows').addEventListener('click', event => {
    const button = event.target.closest('button[data-menu-index]');
    if (button) { event.stopPropagation(); openGuestMenu(button, Number(button.dataset.menuIndex)); }
  });
  $('#guest-menu').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (button && !button.disabled) handleGuestMenuAction(button.dataset.action, Number($('#guest-menu').dataset.index));
  });
  document.addEventListener('click', event => { if (!event.target.closest('#guest-menu') && !event.target.closest('.dots-button')) hideGuestMenu(); });
  window.addEventListener('resize', hideGuestMenu);
  $('#edit-order').addEventListener('click', openOrderDialog);
  $('#order-list').addEventListener('click', event => {
    const button = event.target.closest('button[data-move]');
    if (button) moveOrder(Number(button.dataset.index), button.dataset.move === 'up' ? -1 : 1);
  });
  let dragIndex = null;
  $('#order-list').addEventListener('dragstart', event => { const row = event.target.closest('.order-item'); if (row) { dragIndex = Number(row.dataset.orderIndex); row.classList.add('dragging'); } });
  $('#order-list').addEventListener('dragover', event => { if (event.target.closest('.order-item')) event.preventDefault(); });
  $('#order-list').addEventListener('drop', event => {
    event.preventDefault();
    const target = event.target.closest('.order-item');
    if (target && dragIndex !== null) { const [moved] = orderDraft.splice(dragIndex, 1); orderDraft.splice(Number(target.dataset.orderIndex), 0, moved); renderOrderList(); }
    dragIndex = null;
  });
  $('#order-list').addEventListener('dragend', () => { dragIndex = null; $$('.order-item.dragging').forEach(row => row.classList.remove('dragging')); });
  $('#reset-order').addEventListener('click', () => { orderDraft = [...originalOrder]; renderOrderList(); });
  $('#save-order').addEventListener('click', () => { state.guests = [...orderDraft]; $('#order-dialog').close(); renderGuests(); toast('Seniority order saved.'); });
  $$('[data-close]').forEach(button => button.addEventListener('click', () => $('#' + button.dataset.close).close()));
  $('#confirm-accept').addEventListener('click', () => { $('#confirm-dialog').close(); const callback = confirmCallback; confirmCallback = null; if (callback) callback(); });

  $('#ceremony-lamp-button').addEventListener('click', () => {
    if (motion.busy || motion.paused || state.current >= ceremonyCount() || state.lit[state.current]) return;
    const index = state.current;
    const guest = state.guests[index];
    state.lit[state.current] = true;
    saveState();
    renderCeremony(true);
    motion.lightGuest({
      index, guest, last: index === ceremonyCount() - 1,
      onAdvance: () => { state.current = index + 1; saveState(); renderCeremony(); },
      onComplete: () => { state.current = ceremonyCount(); saveState(); }
    });
  });
  $('#next-guest').addEventListener('click', () => {
    if (motion.busy || motion.paused) return;
    if (state.current >= ceremonyCount()) {
      motion.cancel(); state.current = ceremonyCount() - 1; renderCeremony(); state.current = ceremonyCount();
      motion.runFinale(); return;
    }
    if (state.lit[state.current]) {
      state.current++; saveState();
      if (state.current >= ceremonyCount()) motion.runFinale(); else renderCeremony();
    }
  });
  $('#operator-next').addEventListener('click', () => $('#next-guest').click());
  $('#previous-guest').addEventListener('click', () => { if (state.current > 0) { motion.cancel(); restoreRehearsal(); state.current = Math.max(0, state.current - 1); saveState(); renderCeremony(); } });
  $('#undo-lighting').addEventListener('click', () => {
    motion.cancel();
    if (restoreRehearsal()) { renderCeremony(); toast('Finale closed.'); return; }
    const index = state.lit.findLastIndex(Boolean);
    if (index >= 0) { state.lit[index] = false; state.current = index; saveState(); renderCeremony(); toast('Last lighting undone.'); }
  });
  $('#reset-ceremony').addEventListener('click', () => confirmAction('Reset ceremony', 'Turn off all lamps and return to the first guest?', () => {
    motion.cancel(); restoreRehearsal(); state.lit = Array(totalLamps()).fill(false); state.current = 0; saveState(); renderCeremony(); toast('Ceremony reset.');
  }));
  $('#back-to-setup').addEventListener('click', () => { motion.cancel(); restoreRehearsal(); renderSetup(); showScreen('setup'); });
  function startImmediateFinale(preview = false) {
    motion.cancel(); restoreRehearsal();
    rehearsalSnapshot = { current: state.current, lit: [...state.lit] };
    state.lit = Array(totalLamps()).fill(true); state.current = ceremonyCount() - 1; renderCeremony();
    state.current = ceremonyCount();
    $('#ceremony-screen').classList.toggle('rehearsal', preview);
    $('#undo-lighting').textContent = preview ? '↶  EXIT PREVIEW' : '↶  EXIT FINALE';
    motion.runFinale();
  }
  $('#preview-finale').addEventListener('click', () => startImmediateFinale(true));
  $('#pause-ceremony').addEventListener('click', () => {
    motion.setPaused(!motion.paused);
    $('#ceremony-lamp-button').disabled = motion.busy || motion.paused || state.current >= ceremonyCount() || Boolean(state.lit[state.current]);
    $('#next-guest').disabled = motion.busy || motion.paused || (state.current < ceremonyCount() && !state.lit[state.current]);
  });
  $('#ceremony-tools-toggle').addEventListener('click', () => {
    $('#operator-next').disabled = $('#next-guest').disabled;
    $('#operator-next').textContent = state.current >= ceremonyCount() ? 'REPLAY FINALE' : 'NEXT GUEST';
    const menu = $('#ceremony-tools-menu');
    menu.hidden = !menu.hidden;
    $('#ceremony-tools-toggle').setAttribute('aria-expanded', String(!menu.hidden));
  });
  $('#ceremony-tools-menu').addEventListener('click', event => {
    if (event.target.closest('button')) {
      $('#ceremony-tools-menu').hidden = true;
      $('#ceremony-tools-toggle').setAttribute('aria-expanded', 'false');
    }
  });
  $('#fullscreen-ceremony').addEventListener('click', togglePresentationFullscreen);
  $('#presentation-fullscreen').addEventListener('click', togglePresentationFullscreen);
  $('#presentation-exit').addEventListener('click', togglePresentationFullscreen);
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === $('#ceremony-screen')) setPresentationMode(true);
    else if (!$('#ceremony-screen').classList.contains('presentation-fallback')) setPresentationMode(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      hideGuestMenu(); $('#ceremony-tools-menu').hidden = true; $('#ceremony-tools-toggle').setAttribute('aria-expanded', 'false');
      if ($('#ceremony-screen').classList.contains('presentation-mode')) {
        if (document.fullscreenElement === $('#ceremony-screen')) document.exitFullscreen().catch(() => setPresentationMode(false));
        else setPresentationMode(false);
      }
    }
    if ($('#ceremony-screen').hidden || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (event.code === 'Space' || event.key === ' ') {
      if (document.querySelector('dialog[open]') || document.activeElement.isContentEditable) return;
      event.preventDefault();
      if (event.repeat || $('#ceremony-screen').dataset.phase?.startsWith('finale-')) return;
      startImmediateFinale();
      return;
    }
    if (event.key === 'Enter') {
      if (document.activeElement !== document.body && document.activeElement !== $('#ceremony-lamp-button') && document.activeElement !== $('#ceremony-screen')) return;
      event.preventDefault(); $('#ceremony-lamp-button').click();
    }
    if (event.key === 'ArrowRight') $('#next-guest').click();
    if (event.key === 'ArrowLeft') $('#previous-guest').click();
  });

  renderSetup();
  window.__kovilIntegration = Object.freeze({ get state() { return structuredClone(state); }, motion, stageRenderer, backdrop });
  let signedIn = false;
  try { signedIn = sessionStorage.getItem('compuvate-login') === 'yes'; } catch { /* Require login when storage is unavailable. */ }
  showScreen(signedIn ? 'setup' : 'login');
})();
