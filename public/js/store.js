/* ─── DTC Admin — Application State Store ───────────────────────────────── */

'use strict';

/**
 * Single source of truth for all runtime data.
 * Components read from Store and call Store.set*() to update.
 * This replaces scattered `let` globals across the old single file.
 */
const Store = (() => {
  let _adminKey      = '';
  let _products      = [];
  let _revenue       = { total: 0, byProduct: {}, byReseller: {}, resellerTotal: 0, directTotal: 0 };
  let _settings      = {};
  let _templates     = [];
  let _tokens        = {};
  let _emailLog      = [];
  let _customers     = [];
  let _resellers     = [];
  let _keys          = [];
  let _keyStock      = {};
  let _instructions  = { sets: {} };
  let _dashFilter    = 'all';
  let _custFilter    = 'all';
  let _currentUser   = {};

  return {
    // ── Admin key ────────────────────────────────────────────────────────────
    get adminKey()     { return _adminKey; },
    setAdminKey(k)     { _adminKey = k; },

    // ── Current logged-in user ───────────────────────────────────────────────
    get currentUser()  { return _currentUser; },
    setCurrentUser(u)  { _currentUser = u || {}; },

    // ── Tokens (links) ───────────────────────────────────────────────────────
    get tokens()       { return _tokens; },
    setTokens(t)       { _tokens = t || {}; },

    // ── Email log ────────────────────────────────────────────────────────────
    get emailLog()     { return _emailLog; },
    setEmailLog(l)     { _emailLog = l || []; },

    // ── Instruction sets ──────────────────────────────────────────────────────
    get instructions() { return _instructions; },
    setInstructions(i) { _instructions = i || { sets: {} }; },
    upsertInstruction(set) { _instructions.sets[set.id] = set; },
    deleteInstruction(id)  { delete _instructions.sets[id]; },

    // ── Dashboard filter ──────────────────────────────────────────────────────
    get dashFilter()   { return _dashFilter; },
    setDashFilter(f)   { _dashFilter = f; },

    // ── Customer filter ───────────────────────────────────────────────────────
    get custFilter()   { return _custFilter; },
    setCustFilter(f)   { _custFilter = f; },

    // ── Products ──────────────────────────────────────────────────────────────
    get products()     { return _products; },
    setProducts(p)     { _products = p || []; },

    // ── Revenue ───────────────────────────────────────────────────────────────
    get revenue()      { return _revenue; },
    setRevenue(r)      { _revenue = r || { total: 0, byProduct: {}, byReseller: {}, resellerTotal: 0, directTotal: 0 }; },

    // ── Settings ──────────────────────────────────────────────────────────────
    get settings()     { return _settings; },
    setSettings(s)     { _settings = s || {}; },

    // ── Templates (for dropdowns) ─────────────────────────────────────────────
    get templates()    { return _templates; },
    setTemplates(t)    { _templates = t || []; },

    // ── Customers (registry) ─────────────────────────────────────────────────
    get customers()    { return _customers; },
    setCustomers(c)    { _customers = c || []; },
    get resellers()    { return _resellers; },
    setResellers(r)    { _resellers = r || []; },
    get keys()         { return _keys; },
    setKeys(k)         { _keys = k || []; },
    get keyStock()     { return _keyStock; },
    setKeyStock(s)     { _keyStock = s || {}; },

    // ── Bulk load after login ─────────────────────────────────────────────────
    load({ tokens, emailLog, revenue, customers, resellers, keys, keyStock, settings, currentUser }) {
      this.setTokens(tokens);
      this.setEmailLog(emailLog);
      if (revenue)     this.setRevenue(revenue);
      if (customers)   this.setCustomers(customers);
      if (resellers)   this.setResellers(resellers);
      if (keys)        this.setKeys(keys);
      if (keyStock)    this.setKeyStock(keyStock);
      if (settings)    _settings = { ..._settings, ...settings };
      if (currentUser) _currentUser = currentUser;
    },
  };
})();
