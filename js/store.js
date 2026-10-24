"use strict";

window.CT = window.CT || {};

(function () {
  const KEY = "ct.mvp.v1";
  let state = null;

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      /* Demonstrative storage can be unavailable. The session still runs in memory. */
    }
  }

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
      if (parsed && Array.isArray(parsed.treaties) && Array.isArray(parsed.journey)) {
        state = parsed;
        return state;
      }
    } catch (err) {
      state = null;
    }
    state = CT.createSeed();
    persist();
    return state;
  }

  function get() {
    return state;
  }

  function set(next) {
    state = next;
    persist();
  }

  function reset(user) {
    state = CT.createSeed();
    state.user = user || null;
    persist();
  }

  CT.store = { load: load, get: get, set: set, reset: reset };
})();
