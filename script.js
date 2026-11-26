(() => {
  'use strict';
  const STORAGE_KEY = 'nairaflow.v1';
  const categories = [
    { name: 'Food', icon: '🍔', color: '#e8a25d', tint: '#fff3e8' },
    { name: 'Transport', icon: '🚕', color: '#6da4d7', tint: '#edf5fc' },
    { name: 'Data & Airtime', icon: '📱', color: '#9b83cc', tint: '#f3effa' },
    { name: 'Bills', icon: '🧾', color: '#55a776', tint: '#edf7ef' },
    { name: 'Shopping', icon: '🛍️', color: '#e27e88', tint: '#fff0f1' },
    { name: 'Entertainment', icon: '🎮', color: '#e5bd58', tint: '#fff9e8' },
    { name: 'Health', icon: '💊', color: '#56aaa5', tint: '#eaf7f5' },
    { name: 'Education', icon: '📚', color: '#6387bf', tint: '#eef2fa' },
    { name: 'Others', icon: '📦', color: '#98a39a', tint: '#f1f3f0' }
  ];
  const defaultState = () => ({ name: 'Priscilla', currency: 'NGN', dark: false, budgets: {}, categoryBudgets: {}, transactions: [] });
  let state = loadState();
  let categoryChart = null, analyticsChart = null, trendChart = null;
  let previousThreshold = 0;
  const $ = id => document.getElementById(id);
  const currentMonthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const monthTitle = (date = new Date()) => date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return defaultState();
      return { ...defaultState(), ...saved, budgets: saved.budgets && typeof saved.budgets === 'object' ? saved.budgets : {}, categoryBudgets: saved.categoryBudgets && typeof saved.categoryBudgets === 'object' ? saved.categoryBudgets : {}, transactions: Array.isArray(saved.transactions) ? saved.transactions.filter(t => t && t.id && t.date && t.title) : [] };
    } catch { return defaultState(); }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { toast('Your browser could not save this change. Check available storage.', 'error'); }
  }
  function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function money(value) {
    const currency = ['NGN', 'USD', 'GBP', 'EUR'].includes(state.currency) ? state.currency : 'NGN';
    try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(safeNumber(value)); }
    catch { return `₦${Math.round(safeNumber(value)).toLocaleString()}`; }
  }
  const animatedValues = new Map();
  function animateMoney(element, target) {
    const next = safeNumber(target), previous = animatedValues.get(element.id);
    animatedValues.set(element.id, next);
    if (previous === undefined || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { element.textContent = money(next); return; }
    const start = performance.now(), duration = 420;
    const frame = now => { const progress = Math.min(1, (now - start) / duration); const eased = 1 - Math.pow(1 - progress, 3); element.textContent = money(previous + (next - previous) * eased); if (progress < 1) requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }
  function currentTransactions() { const key = currentMonthKey(); return state.transactions.filter(t => t.date.slice(0, 7) === key); }
  function monthlyBudget() { return Math.max(0, safeNumber(state.budgets[currentMonthKey()])); }
  function spent(transactions = currentTransactions()) { return transactions.reduce((total, t) => total + Math.max(0, safeNumber(t.amount)), 0); }
  function categoryInfo(name) { return categories.find(c => c.name === name) || categories[categories.length - 1]; }
  function localISODate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function displayDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const sameYear = y === new Date().getFullYear();
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  }
  function toast(message, type = 'success') {
    const region = $('toastRegion');
    const node = document.createElement('div'); node.className = `toast ${type === 'warning' ? 'warning' : type === 'error' ? 'error' : ''}`; node.textContent = message;
    region.append(node); setTimeout(() => { node.style.opacity = '0'; node.style.transform = 'translateY(5px)'; setTimeout(() => node.remove(), 220); }, 3400);
  }
  function setProgress(element, ratio) {
    element.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
    element.classList.toggle('warn', ratio >= .7 && ratio < .9); element.classList.toggle('danger', ratio >= .9);
  }
  function transactionMarkup(t) {
    const cat = categoryInfo(t.category);
    return `<div class="transaction-row" data-id="${escapeHTML(t.id)}"><span class="category-icon" style="background:${cat.tint}">${cat.icon}</span><div class="transaction-info"><span class="transaction-title" title="${escapeHTML(t.title)}">${escapeHTML(t.title)}</span><div class="transaction-meta"><span class="category-badge" style="background:${cat.tint};color:${cat.color}">${escapeHTML(t.category)}</span><span>${displayDate(t.date)}</span><span>·</span><span>${escapeHTML(t.payment || 'Other')}</span></div></div><strong class="transaction-amount">−${money(t.amount)}</strong><span class="row-actions"><button class="row-action edit-transaction" title="Edit transaction" aria-label="Edit ${escapeHTML(t.title)}">✎</button><button class="row-action delete-transaction" title="Delete transaction" aria-label="Delete ${escapeHTML(t.title)}">×</button></span></div>`;
  }
  function emptyMarkup(title, message, action = true) { return `<div class="empty-state"><div class="empty-art">🌱</div><strong>${title}</strong><p>${message}</p>${action ? '<button class="primary-button empty-add">＋ Add your first expense</button>' : ''}</div>`; }
  function renderTransactions() {
    const monthItems = currentTransactions().sort((a, b) => b.date.localeCompare(a.date) || safeNumber(b.createdAt) - safeNumber(a.createdAt));
    $('recentTransactions').innerHTML = monthItems.length ? monthItems.slice(0, 5).map(transactionMarkup).join('') : emptyMarkup('Your story starts here', 'Add your first expense and your dashboard will begin to take shape.');
    const query = $('searchInput').value.trim().toLowerCase(), category = $('categoryFilter').value, range = $('dateFilter').value, sort = $('sortFilter').value;
    let items = state.transactions.filter(t => (!query || `${t.title} ${t.description || ''} ${t.category}`.toLowerCase().includes(query)) && (category === 'all' || t.category === category));
    if (range === 'month') items = items.filter(t => t.date.slice(0, 7) === currentMonthKey());
    if (range === '30' || range === '90') { const threshold = new Date(); threshold.setDate(threshold.getDate() - Number(range)); const cutoff = localISODate(threshold); items = items.filter(t => t.date >= cutoff); }
    items.sort((a, b) => sort === 'oldest' ? a.date.localeCompare(b.date) || safeNumber(a.createdAt) - safeNumber(b.createdAt) : sort === 'high' ? safeNumber(b.amount) - safeNumber(a.amount) : sort === 'low' ? safeNumber(a.amount) - safeNumber(b.amount) : b.date.localeCompare(a.date) || safeNumber(b.createdAt) - safeNumber(a.createdAt));
    $('allTransactions').innerHTML = items.length ? items.map(transactionMarkup).join('') : emptyMarkup(state.transactions.length ? 'No matching transactions' : 'Nothing recorded yet', state.transactions.length ? 'Try changing your search or filters.' : 'Your saved expenses will appear here.', !state.transactions.length);
  }
  function renderBudgets(total, budget, ratio) {
    const remaining = budget - total;
    $('progressSpent').textContent = money(total); $('progressBudget').textContent = money(budget); $('progressPercent').textContent = `${Math.round(ratio * 100)}% used`; $('progressLeft').textContent = `${money(Math.max(0, remaining))} remaining`; setProgress($('mainProgress'), ratio);
    $('detailBudget').textContent = money(budget); $('detailSpent').textContent = money(total); $('detailRemaining').textContent = money(remaining); $('detailPercent').textContent = `${Math.round(ratio * 100)}% used`; $('detailProgress').style.width = `${Math.min(100, ratio * 100)}%`; $('detailProgress').className = `progress-fill${ratio >= .9 ? ' danger' : ratio >= .7 ? ' warn' : ''}`;
    $('detailStatus').textContent = remaining < 0 ? `${money(Math.abs(remaining))} over budget` : ratio >= .9 ? 'Almost at your limit' : ratio >= .7 ? 'Keep an eye on spending' : 'Looking good';
    $('budgetNotice').hidden = !(budget > 0 && ratio >= .8);
    if (budget > 0 && ratio >= 1) { $('budgetNotice').textContent = `You are ${money(total - budget)} over your monthly budget.`; $('budgetNotice').className = 'budget-notice danger'; }
    else if (budget > 0 && ratio >= .8) { $('budgetNotice').textContent = `You have used ${Math.round(ratio * 100)}% of your monthly budget. Keep an eye on the rest of the month.`; $('budgetNotice').className = 'budget-notice'; }
  }
  function spendingByCategory(items = currentTransactions()) { return items.reduce((acc, t) => { const key = categories.some(c => c.name === t.category) ? t.category : 'Others'; acc[key] = (acc[key] || 0) + Math.max(0, safeNumber(t.amount)); return acc; }, {}); }
  function renderCharts() {
    if (typeof Chart === 'undefined') return;
    const values = spendingByCategory(), entries = categories.map(c => ({ ...c, amount: values[c.name] || 0 })).filter(c => c.amount > 0);
    const total = entries.reduce((sum, c) => sum + c.amount, 0);
    const labels = entries.length ? entries.map(c => c.name) : ['No spending']; const data = entries.length ? entries.map(c => c.amount) : [1]; const colors = entries.length ? entries.map(c => c.color) : ['#edf1ec'];
    const opts = { responsive: true, maintainAspectRatio: false, cutout: '76%', plugins: { legend: { display: false }, tooltip: { enabled: entries.length > 0, callbacks: { label: context => `${context.label}: ${money(context.raw)}` } } } };
    const config = { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4, spacing: 3, borderRadius: 5 }] }, options: opts };
    if (categoryChart) categoryChart.destroy(); if (analyticsChart) analyticsChart.destroy();
    categoryChart = new Chart($('categoryChart'), JSON.parse(JSON.stringify(config)));
    analyticsChart = new Chart($('analyticsCategoryChart'), JSON.parse(JSON.stringify(config)));
    $('chartTotal').textContent = money(total);
    const legend = entries.length ? entries.map(c => `<span class="legend-item"><i class="legend-dot" style="background:${c.color}"></i>${escapeHTML(c.name)}</span>`).join('') : '<span class="legend-item">Add expenses to see a breakdown</span>';
    $('chartLegend').innerHTML = legend;
    $('analyticsLegend').innerHTML = entries.length ? entries.map(c => `<span class="legend-item"><span class="legend-left"><i class="legend-dot" style="background:${c.color}"></i>${escapeHTML(c.name)}</span><strong>${money(c.amount)}</strong></span>`).join('') : '<span class="legend-item">Add expenses to see your category insights.</span>';
    const now = new Date(), monthNames = [], trendValues = [];
    for (let i = 5; i >= 0; i--) { const month = new Date(now.getFullYear(), now.getMonth() - i, 1); const key = currentMonthKey(month); monthNames.push(month.toLocaleDateString(undefined, { month: 'short' })); trendValues.push(spent(state.transactions.filter(t => t.date.slice(0, 7) === key))); }
    if (trendChart) trendChart.destroy();
    trendChart = new Chart($('trendChart'), { type: 'line', data: { labels: monthNames, datasets: [{ data: trendValues, borderColor: '#32824a', backgroundColor: 'rgba(50,130,74,.10)', fill: true, tension: .38, pointRadius: 3, pointBackgroundColor: '#32824a', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => money(ctx.raw) } } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: '#96a097', font: { size: 10 } } }, y: { beginAtZero: true, grid: { color: '#edf0eb' }, border: { display: false }, ticks: { color: '#96a097', font: { size: 9 }, callback: value => compactMoney(value) } } } } });
  }
  function compactMoney(n) { const v = safeNumber(n); return v >= 1000000 ? `${(v / 1000000).toFixed(1)}m` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v); }
  function renderCategoryBudgets(values) {
    const grid = $('categoryBudgets');
    const configured = categories.filter(c => safeNumber(state.categoryBudgets[currentMonthKey()]?.[c.name]) > 0);
    if (!configured.length) { grid.innerHTML = `<article class="panel category-budget-card">${emptyMarkup('No category limits yet', 'Set optional spending targets to keep an eye on individual categories.', false)}<button class="secondary-button add-category-empty">＋ Set category budget</button></article>`; return; }
    grid.innerHTML = configured.map(c => { const limit = safeNumber(state.categoryBudgets[currentMonthKey()][c.name]), amount = values[c.name] || 0, ratio = limit ? amount / limit : 0; return `<article class="category-budget-card"><div class="cat-header"><span class="category-icon" style="background:${c.tint}">${c.icon}</span><strong>${c.name}</strong><button class="cat-edit" data-category="${escapeHTML(c.name)}" aria-label="Edit ${escapeHTML(c.name)} budget">✎</button></div><div class="cat-values"><span>${money(amount)} spent</span><strong>${money(limit)} limit</strong></div><div class="progress-track"><div class="progress-fill${ratio >= .9 ? ' danger' : ratio >= .7 ? ' warn' : ''}" style="width:${Math.min(100,ratio*100)}%"></div></div><div class="progress-meta"><span>${Math.round(ratio*100)}% used</span><span>${ratio > 1 ? `${money(amount-limit)} over` : `${money(limit-amount)} left`}</span></div></article>`; }).join('');
  }
  function render() {
    const items = currentTransactions(), total = spent(items), budget = monthlyBudget(), ratio = budget > 0 ? total / budget : 0;
    const today = new Date(), elapsed = today.getDate(), average = total / elapsed;
    $('monthLabel').textContent = monthTitle().toUpperCase(); $('todayLabel').textContent = today.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); $('budgetDatePill').textContent = monthTitle(); $('analyticsMonth').textContent = monthTitle(); $('budgetMonthTitle').textContent = `${monthTitle()} spending plan`;
    const hour = today.getHours(), salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; $('greeting').innerHTML = `${salutation}, ${escapeHTML(state.name || 'there')} <span>✦</span>`;
    $('sidebarName').textContent = state.name || 'Your account'; $('sidebarAvatar').textContent = (state.name || 'N').charAt(0).toUpperCase(); $('topAvatar').textContent = (state.name || 'N').charAt(0).toUpperCase();
    animateMoney($('budgetTotal'), budget); animateMoney($('spentTotal'), total); animateMoney($('remainingTotal'), budget - total); animateMoney($('averageTotal'), average);
    $('budgetFoot').textContent = budget ? `${monthTitle()} plan` : 'Set a budget to get started'; $('spentFoot').textContent = `${items.length} ${items.length === 1 ? 'expense' : 'expenses'} this month`; $('remainingFoot').textContent = budget && total > budget ? 'Over your monthly budget' : 'Available to spend';
    renderBudgets(total, budget, ratio);
    const byCategory = spendingByCategory(items), ranked = Object.entries(byCategory).sort((a,b) => b[1]-a[1]);
    $('topCategory').textContent = ranked.length ? ranked[0][0] : 'No spending yet'; $('topCategoryAmount').textContent = ranked.length ? money(ranked[0][1]) : '—'; $('transactionCount').textContent = `${items.length} ${items.length === 1 ? 'transaction' : 'transactions'}`;
    $('summaryTip').textContent = !items.length ? 'Add your first expense to see your spending insights.' : ratio >= 1 && budget ? 'You have passed your monthly limit. Review your plan to stay on track.' : ratio >= .8 && budget ? 'You are close to your budget limit. A little awareness goes a long way.' : `You have spent ${Math.round(ratio*100)}% of your monthly budget so far.`;
    $('analyticsBudgetUsed').textContent = `${Math.round(ratio*100)}%`; $('analyticsTop').textContent = ranked.length ? ranked[0][0] : '—'; $('analyticsTopAmount').textContent = ranked.length ? money(ranked[0][1]) : 'No spending yet'; $('analyticsLow').textContent = ranked.length ? ranked[ranked.length-1][0] : '—'; $('analyticsLowAmount').textContent = ranked.length ? money(ranked[ranked.length-1][1]) : 'No spending yet'; $('analyticsDaily').textContent = money(average);
    renderTransactions(); renderCategoryBudgets(byCategory); renderCharts();
    document.body.classList.toggle('dark', !!state.dark); $('darkModeToggle').checked = !!state.dark; $('currencySelect').value = state.currency || 'NGN';
    const currencyNames = { NGN: 'Nigerian Naira (₦)', USD: 'US Dollar ($)', GBP: 'British Pound (£)', EUR: 'Euro (€)' }, currencyName = currencyNames[state.currency] || currencyNames.NGN;
    $('currencyValue').textContent = currencyName; document.querySelectorAll('.custom-option').forEach(option => { const selected = option.dataset.value === (state.currency || 'NGN'); option.classList.toggle('selected', selected); option.setAttribute('aria-selected', String(selected)); });
    $('nameInput').value = state.name || ''; $('settingsBudgetInput').value = budget || '';
    const newThreshold = budget > 0 && ratio >= 1 ? 100 : budget > 0 && ratio >= .8 ? 80 : 0;
    if (newThreshold > previousThreshold) toast(newThreshold === 100 ? 'You have exceeded your monthly budget.' : 'You have reached 80% of your monthly budget.', 'warning');
    previousThreshold = newThreshold;
  }
  function showModal(id) { const modal = $(id); modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); const field = modal.querySelector('input:not([type=hidden]),select,textarea'); if (field) setTimeout(() => field.focus(), 30); document.body.style.overflow = 'hidden'; }
  function hideModals() { document.querySelectorAll('.modal-backdrop.open').forEach(modal => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }); document.body.style.overflow = ''; }
  function openExpense(transaction = null) {
    $('expenseForm').reset(); $('expenseError').textContent = ''; $('expenseDate').value = localISODate(); $('expenseId').value = transaction?.id || '';
    $('expenseModalTitle').textContent = transaction ? 'Edit expense' : 'Add an expense'; $('expenseSubmit').textContent = transaction ? 'Save changes' : 'Save expense';
    if (transaction) { $('expenseTitle').value = transaction.title; $('expenseAmount').value = transaction.amount; $('expenseCategory').value = transaction.category; $('expenseDate').value = transaction.date; $('expensePayment').value = transaction.payment || 'Other'; $('expenseDescription').value = transaction.description || ''; }
    syncCustomSelects();
    showModal('expenseModal');
  }
  function populateSelects() {
    const options = categories.map(c => `<option value="${escapeHTML(c.name)}">${c.icon} ${escapeHTML(c.name)}</option>`).join(''); $('expenseCategory').innerHTML = options; $('categoryBudgetCategory').innerHTML = options;
    $('categoryFilter').innerHTML = '<option value="all">All categories</option>' + categories.map(c => `<option value="${escapeHTML(c.name)}">${c.icon} ${escapeHTML(c.name)}</option>`).join('');
    syncCustomSelects();
  }
  function syncCustomSelects() {
    document.querySelectorAll('.custom-select[data-select-id]').forEach(wrapper => {
      const native = $(wrapper.dataset.selectId); if (!native) return;
      const selected = native.options[native.selectedIndex];
      wrapper.querySelector('.custom-select-value').textContent = selected?.textContent || '';
      wrapper.querySelector('.custom-select-options').innerHTML = [...native.options].map(option => `<button type="button" class="custom-option${option.selected ? ' selected' : ''}" role="option" aria-selected="${option.selected}" data-value="${escapeHTML(option.value)}">${escapeHTML(option.textContent)}<span class="option-check">✓</span></button>`).join('');
    });
  }
  function closeCustomSelectMenus() {
    document.querySelectorAll('.custom-select[data-select-id]').forEach(wrapper => { wrapper.classList.remove('open'); wrapper.querySelector('.custom-select-options').hidden = true; wrapper.querySelector('.custom-select-trigger').setAttribute('aria-expanded', 'false'); });
  }
  function navigate(page) {
    const valid = ['dashboard','transactions','budgets','analytics','settings'].includes(page) ? page : 'dashboard';
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active-page')); $(`${valid}Page`).classList.add('active-page');
    document.querySelectorAll('[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === valid)); $('pageName').textContent = valid.charAt(0).toUpperCase() + valid.slice(1); history.replaceState(null, '', `#${valid}`); window.scrollTo({ top: 0, behavior: 'smooth' });
    if (valid === 'analytics') setTimeout(renderCharts, 40);
  }
  function bindEvents() {
    document.querySelectorAll('[data-page]').forEach(link => link.addEventListener('click', e => { e.preventDefault(); navigate(link.dataset.page); }));
    document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
    document.querySelectorAll('.close-modal').forEach(button => button.addEventListener('click', hideModals));
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', e => { if (e.target === backdrop) hideModals(); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCurrencyMenu(); closeCustomSelectMenus(); hideModals(); } });
    document.addEventListener('click', e => {
      const trigger = e.target.closest('.custom-select-value-trigger');
      if (trigger) { const wrapper = trigger.closest('.custom-select'); const opening = wrapper.querySelector('.custom-select-options').hidden; closeCustomSelectMenus(); if (opening) { wrapper.classList.add('open'); wrapper.querySelector('.custom-select-options').hidden = false; trigger.setAttribute('aria-expanded', 'true'); } return; }
      const option = e.target.closest('.custom-select[data-select-id] .custom-option');
      if (option) { const wrapper = option.closest('.custom-select'); const native = $(wrapper.dataset.selectId); native.value = option.dataset.value; native.dispatchEvent(new Event('change', { bubbles: true })); syncCustomSelects(); closeCustomSelectMenus(); return; }
      if (!e.target.closest('.custom-select[data-select-id]')) closeCustomSelectMenus();
    });
    $('addExpenseBtn').addEventListener('click', () => openExpense()); $('addExpenseBtn2').addEventListener('click', () => openExpense());
    $('recentTransactions').addEventListener('click', transactionAction); $('allTransactions').addEventListener('click', transactionAction);
    document.querySelectorAll('#searchInput,#categoryFilter,#dateFilter,#sortFilter').forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', renderTransactions));
    $('expenseForm').addEventListener('submit', e => {
      e.preventDefault(); const title = $('expenseTitle').value.trim(), amount = Number($('expenseAmount').value), date = $('expenseDate').value;
      if (!title || !date || !Number.isFinite(amount) || amount <= 0) { $('expenseError').textContent = 'Add a title, valid date, and amount greater than zero.'; return; }
      if (date > localISODate()) { $('expenseError').textContent = 'Choose today or an earlier date for an expense.'; return; }
      const id = $('expenseId').value, old = state.transactions.find(t => t.id === id);
      const transaction = { id: id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`), title, amount, date, category: $('expenseCategory').value, payment: $('expensePayment').value, description: $('expenseDescription').value.trim(), createdAt: old?.createdAt || Date.now() };
      if (old) state.transactions = state.transactions.map(t => t.id === id ? transaction : t); else state.transactions.push(transaction);
      saveState(); hideModals(); render(); toast(old ? 'Expense updated.' : 'Expense added. Your dashboard is up to date.');
    });
    $('editBudgetBtn').addEventListener('click', () => { $('budgetInput').value = monthlyBudget() || ''; showModal('budgetModal'); });
    $('budgetForm').addEventListener('submit', e => { e.preventDefault(); const value = Number($('budgetInput').value); if (!Number.isFinite(value) || value < 0) return; state.budgets[currentMonthKey()] = value; saveState(); hideModals(); render(); toast('Monthly budget saved.'); });
    $('settingsBudgetForm').addEventListener('submit', e => { e.preventDefault(); const value = Number($('settingsBudgetInput').value); if (!Number.isFinite(value) || value < 0) { toast('Enter a valid budget amount.', 'error'); return; } state.budgets[currentMonthKey()] = value; saveState(); render(); toast('Monthly budget saved.'); });
    $('categoryBudgetBtn').addEventListener('click', () => { $('categoryBudgetAmount').value = ''; syncCustomSelects(); showModal('categoryBudgetModal'); });
    $('categoryBudgets').addEventListener('click', e => { if (e.target.closest('.add-category-empty')) { $('categoryBudgetAmount').value = ''; syncCustomSelects(); showModal('categoryBudgetModal'); } const edit = e.target.closest('.cat-edit'); if (edit) { $('categoryBudgetCategory').value = edit.dataset.category; $('categoryBudgetAmount').value = state.categoryBudgets[currentMonthKey()]?.[edit.dataset.category] || ''; syncCustomSelects(); showModal('categoryBudgetModal'); } });
    $('categoryBudgetForm').addEventListener('submit', e => { e.preventDefault(); const category = $('categoryBudgetCategory').value, amount = Number($('categoryBudgetAmount').value); if (!Number.isFinite(amount) || amount < 0) return; const key = currentMonthKey(); state.categoryBudgets[key] ||= {}; if (amount === 0) delete state.categoryBudgets[key][category]; else state.categoryBudgets[key][category] = amount; saveState(); hideModals(); render(); toast('Category budget saved.'); });
    $('profileForm').addEventListener('submit', e => { e.preventDefault(); const name = $('nameInput').value.trim(); if (!name) { toast('Enter a display name.', 'error'); return; } state.name = name; saveState(); render(); toast('Your display name was updated.'); });
    $('currencySelect').addEventListener('change', e => { state.currency = e.target.value; saveState(); render(); toast('Currency display updated.'); });
    $('currencyTrigger').addEventListener('click', () => { const opening = $('currencyOptions').hidden; closeCurrencyMenu(); if (opening) { $('currencyDropdown').classList.add('open'); $('currencyOptions').hidden = false; $('currencyTrigger').setAttribute('aria-expanded', 'true'); } });
    $('currencyOptions').addEventListener('click', e => { const option = e.target.closest('.custom-option'); if (!option) return; $('currencySelect').value = option.dataset.value; closeCurrencyMenu(); $('currencySelect').dispatchEvent(new Event('change', { bubbles: true })); });
    document.addEventListener('click', e => { if (!e.target.closest('#currencyDropdown')) closeCurrencyMenu(); });
    $('darkModeToggle').addEventListener('change', e => { state.dark = e.target.checked; saveState(); document.body.classList.toggle('dark', state.dark); }); $('themeToggle').addEventListener('click', () => { state.dark = !state.dark; saveState(); document.body.classList.toggle('dark', state.dark); $('darkModeToggle').checked = state.dark; });
    $('sidebarSettings').addEventListener('click', () => navigate('settings')); $('topAvatar').addEventListener('click', () => navigate('settings'));
    $('clearDataBtn').addEventListener('click', () => showModal('clearDataModal'));
    $('confirmClearDataBtn').addEventListener('click', () => { state.transactions = []; state.budgets = {}; state.categoryBudgets = {}; saveState(); hideModals(); render(); toast('Your finance data has been cleared.'); });
    $('chartPeriod').addEventListener('click', () => toast('The dashboard chart shows this month. Use Analytics to explore six-month trends.'));
    document.addEventListener('click', e => { if (e.target.closest('.empty-add')) openExpense(); });
    window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
  }
  function transactionAction(e) {
    const row = e.target.closest('.transaction-row'); if (!row) return; const transaction = state.transactions.find(t => t.id === row.dataset.id); if (!transaction) return;
    if (e.target.closest('.edit-transaction')) openExpense(transaction);
    if (e.target.closest('.delete-transaction') && confirm(`Delete “${transaction.title}”?`)) { state.transactions = state.transactions.filter(t => t.id !== transaction.id); saveState(); render(); toast('Expense deleted.'); }
  }
  function closeCurrencyMenu() { const dropdown = $('currencyDropdown'); if (!dropdown) return; dropdown.classList.remove('open'); $('currencyOptions').hidden = true; $('currencyTrigger').setAttribute('aria-expanded', 'false'); }
  populateSelects(); bindEvents(); render(); navigate(location.hash.slice(1));
})();
