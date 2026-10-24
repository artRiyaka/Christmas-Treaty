"use strict";

(function () {
  const tones = ["#1e4636", "#3d5c4a", "#6d5a3a", "#4d3f36", "#245c52", "#3e4d63"];
  const moneyFmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

  const ui = {
    confirmDeclineId: null,
    confirmReset: false,
    draftAmount: null
  };
  let lastRouteKey = null;
  let toastTimer = 0;

  CT.uid = function () {
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  };

  CT.token = function () {
    const bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function money(amount) {
    return moneyFmt.format(amount);
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) { return part[0]; }).join("").toUpperCase();
  }

  function tone(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i)) % tones.length;
    return tones[hash];
  }

  function formatWhen(ts) {
    return new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function user() {
    return CT.store.get().user;
  }

  function blankUi() {
    ui.confirmDeclineId = null;
    ui.confirmReset = false;
    ui.draftAmount = null;
  }

  function parseRoute() {
    let raw = location.hash.replace(/^#/, "");
    if (!raw || raw === "/") return { name: "landing" };
    if (!raw.startsWith("/")) raw = "/" + raw;
    const segs = raw.split("/").filter(Boolean);
    const head = segs[0];
    const tail = segs[1] ? decodeURIComponent(segs[1]) : "";
    if (head === "login") return { name: "login" };
    if (head === "home") return { name: "home" };
    if (head === "new") return { name: "new" };
    if (head === "t" && tail) return { name: "treaty", id: tail };
    if (head === "i" && tail) return { name: "invite", token: tail };
    return { name: "missing" };
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 3200);
  }

  function setError(message) {
    const el = document.getElementById("form-error");
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
    if (message) {
      el.classList.remove("shake");
      void el.offsetWidth;
      el.classList.add("shake");
    }
  }

  function makeEvent(treatyId, type, label) {
    return { id: "e_" + CT.uid(), treatyId: treatyId, type: type, label: label, at: Date.now() };
  }

  function trackOnceGlobal(type, label) {
    const state = CT.store.get();
    if (state.journey.some(function (event) { return event.type === type; })) return;
    state.journey.push(makeEvent(null, type, label));
    CT.store.set(state);
  }

  function trackOnceTreaty(treatyId, type, label) {
    const state = CT.store.get();
    if (state.journey.some(function (event) { return event.treatyId === treatyId && event.type === type; })) return;
    state.journey.push(makeEvent(treatyId, type, label));
    CT.store.set(state);
  }

  function trackTreaty(treatyId, type, label) {
    const state = CT.store.get();
    state.journey.push(makeEvent(treatyId, type, label));
    CT.store.set(state);
  }

  function treatyById(id) {
    return CT.store.get().treaties.find(function (treaty) { return treaty.id === id; }) || null;
  }

  function treatyByToken(token) {
    return CT.store.get().treaties.find(function (treaty) { return treaty.token === token; }) || null;
  }

  function mine(treaty, current) {
    return !!current && (treaty.creatorId === current.id || treaty.recipientId === current.id);
  }

  function otherName(treaty, current) {
    if (current && treaty.creatorId === current.id) return treaty.recipientName;
    return treaty.creatorName;
  }

  function theirAmount(treaty) {
    return treaty.recipientAmount == null ? treaty.proposedAmount : treaty.recipientAmount;
  }

  function statusLabel(treaty) {
    if (treaty.status === "pending") return "Awaiting reply";
    if (treaty.status === "declined") return "Declined";
    if (treaty.status === "complete") return "Complete";
    if (treaty.creatorCharityId && treaty.recipientCharityId) return "Ready to give";
    return "Choosing charities";
  }

  function pillClass(treaty) {
    if (treaty.status === "pending") return "pending";
    if (treaty.status === "declined") return "declined";
    if (treaty.status === "complete") return "complete";
    return "accepted";
  }

  function pill(treaty) {
    return '<span class="pill ' + pillClass(treaty) + '">' + esc(statusLabel(treaty)) + "</span>";
  }

  function statusDetail(treaty, current) {
    const other = otherName(treaty, current);
    if (treaty.status === "pending") {
      return treaty.recipientId === current.id ? "Accept, adjust, or decline." : "Waiting for " + other + ".";
    }
    if (treaty.status === "declined") return "Closed without donations.";
    if (treaty.status === "complete") return money(treaty.creatorAmount + theirAmount(treaty)) + " given directly.";
    const creator = treaty.creatorId === current.id;
    if (creator && !treaty.recipientCharityId) return "Choose a charity for " + treaty.recipientName + ".";
    if (!creator && !treaty.creatorCharityId) return "Choose a charity for " + treaty.creatorName + ".";
    if (creator && !treaty.creatorDonated && treaty.creatorCharityId) return "Your donation is ready to make.";
    if (!creator && !treaty.recipientDonated && treaty.recipientCharityId) return "Your donation is ready to make.";
    if ((creator && treaty.creatorDonated) || (!creator && treaty.recipientDonated)) return "Waiting for " + other + " to report their donation.";
    return "Charities are still being chosen.";
  }

  function validateName(name) {
    if (name.length < 2) return "Enter their name.";
    if (name.length > 48) return "Use a shorter name.";
    const current = user();
    if (current && name.toLowerCase() === current.name.toLowerCase()) return "A treaty needs two different people.";
    return "";
  }

  function validateAmount(amount) {
    if (!Number.isFinite(amount) || amount < 1) return "Enter an amount of at least £1.";
    if (amount > 5000) return "For this version, keep each amount at £5,000 or under.";
    if (!Number.isInteger(amount)) return "Use whole pounds.";
    return "";
  }

  function inviteUrl(token) {
    const url = new URL(location.href);
    url.hash = "#/i/" + token;
    url.search = "";
    return url.toString();
  }

  function mark() {
    return '<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><circle cx="13" cy="16" r="7" fill="none" stroke="currentColor" stroke-width="1.6"></circle><circle cx="19" cy="16" r="7" fill="none" stroke="#a68456" stroke-width="1.6"></circle></svg>';
  }

  function steps(treaty) {
    const agreed = treaty.status === "accepted" || treaty.status === "complete";
    const both = treaty.creatorCharityId && treaty.recipientCharityId;
    return [
      { label: "Proposed", state: "done" },
      { label: "Agreed", state: treaty.status === "declined" ? "failed" : agreed ? "done" : "now" },
      { label: "Charities", state: !agreed ? "todo" : both ? "done" : "now" },
      { label: "Given", state: treaty.status === "complete" ? "done" : both ? "now" : "todo" }
    ];
  }

  function stepStateWord(state) {
    if (state === "done") return "Done";
    if (state === "now") return "Current";
    if (state === "failed") return "Closed";
    return "Upcoming";
  }

  function stepsHtml(treaty) {
    return '<ol class="steps" aria-label="Progress">' + steps(treaty).map(function (step) {
      return '<li class="is-' + step.state + '"><span class="vh">' + stepStateWord(step.state) + ": </span>" + esc(step.label) + "</li>";
    }).join("") + "</ol>";
  }

  function eventsFor(id) {
    return CT.store.get().journey.filter(function (event) { return event.treatyId === id; }).sort(function (a, b) { return a.at - b.at; });
  }

  function timelineHtml(treaty) {
    const events = eventsFor(treaty.id);
    if (!events.length) return "";
    return '<section class="panel rise"><h2>Journey</h2><ol class="timeline">' + events.map(function (event) {
      return "<li><div><p>" + esc(event.label) + '</p></div><time datetime="' + new Date(event.at).toISOString() + '">' + esc(formatWhen(event.at)) + "</time></li>";
    }).join("") + "</ol></section>";
  }

  function personCard(treaty, who) {
    const isCreator = who === "creator";
    const name = isCreator ? treaty.creatorName : treaty.recipientName;
    const other = isCreator ? treaty.recipientName : treaty.creatorName;
    const amount = isCreator ? treaty.creatorAmount : theirAmount(treaty);
    const charity = CT.charityById(isCreator ? treaty.creatorCharityId : treaty.recipientCharityId);
    const chosenBy = isCreator ? treaty.recipientName : treaty.creatorName;
    const donated = isCreator ? treaty.creatorDonated : treaty.recipientDonated;
    const proposed = !isCreator && treaty.status === "pending";
    const adjusted = !isCreator && treaty.recipientAmount != null && treaty.recipientAmount !== treaty.proposedAmount;
    let badge = "";
    if (proposed) badge = '<span class="badge">Proposed</span>';
    else if (adjusted) badge = '<span class="badge">Adjusted</span>';
    const destination = charity
      ? "to <strong>" + esc(charity.name) + "</strong>"
      : "Charity still to be chosen by " + esc(chosenBy);
    const chosenLine = charity ? '<p class="soft">Chosen by ' + esc(chosenBy) + "</p>" : "";
    const link = charity
      ? '<p><a class="ext" href="' + esc(charity.url) + '" target="_blank" rel="noopener noreferrer" data-action="donate-link" data-id="' + esc(treaty.id) + '" data-side="' + who + '" data-charity="' + esc(charity.id) + '">Official donation page <span aria-hidden="true">↗</span></a></p>'
      : "";
    return '<article class="person"><div class="person-id"><span class="avatar" style="background:' + tone(name) + '">' + esc(initials(name)) + '</span><div><h3>' + esc(name) + '</h3><p class="soft">Instead of a gift for ' + esc(other) + '</p></div></div><p class="amount">' + money(amount) + badge + '</p><p>' + destination + "</p>" + chosenLine + link + '<p class="given' + (donated ? " is-on" : "") + '">' + (donated ? "Given" : "Not yet given") + "</p></article>";
  }

  function peopleHtml(treaty) {
    return '<section class="people rise" aria-label="Both sides of the agreement">' + personCard(treaty, "creator") + '<div class="and" aria-hidden="true"><span>&</span></div>' + personCard(treaty, "recipient") + "</section>";
  }

  function charityList(treaty, role) {
    const selected = role === "creator" ? treaty.recipientCharityId : treaty.creatorCharityId;
    const locked = role === "creator" ? treaty.recipientDonated : treaty.creatorDonated;
    if (locked && selected) {
      const charity = CT.charityById(selected);
      return "<p>The choice is locked because the donation was reported. <strong>" + esc(charity.name) + "</strong>.</p>";
    }
    const cards = CT.charities.map(function (charity) {
      const chosen = charity.id === selected;
      return '<article class="charity' + (chosen ? " is-chosen" : "") + '" data-blob="' + esc((charity.name + " " + charity.cause).toLowerCase()) + '"><div><h3>' + esc(charity.name) + "</h3><p>" + esc(charity.cause) + '</p></div><div class="charity-actions"><a class="ext" href="' + esc(charity.url) + '" target="_blank" rel="noopener noreferrer">Site <span aria-hidden="true">↗</span></a><button type="button" class="btn btn-small ' + (chosen ? "btn-primary" : "btn-ghost") + '" data-action="choose" data-id="' + esc(treaty.id) + '" data-side="' + role + '" data-charity="' + esc(charity.id) + '" aria-pressed="' + (chosen ? "true" : "false") + '">' + (chosen ? "Chosen" : "Choose") + "</button></div></article>";
    }).join("");
    const current = CT.charityById(selected);
    return '<p class="soft">' + (current ? "Selected: " + esc(current.name) + ". You can still change it." : "Select one charity.") + '</p><div class="search"><input id="charity-search" type="search" placeholder="Search the list" aria-label="Search the list" autocomplete="off"></div><div class="charities">' + cards + '</div><p id="charity-empty" class="hint" hidden>No charity matches that.</p>';
  }

  function outcomeHtml(treaty) {
    const creatorCharity = CT.charityById(treaty.creatorCharityId);
    const recipientCharity = CT.charityById(treaty.recipientCharityId);
    const total = treaty.creatorAmount + theirAmount(treaty);
    return '<section class="outcome rise"><p class="eyebrow light">Complete</p><h2>This treaty is complete.</h2><p class="story">' + esc(treaty.creatorName) + " gave " + money(treaty.creatorAmount) + " to " + esc(creatorCharity ? creatorCharity.name : "a charity") + ". " + esc(treaty.recipientName) + " gave " + money(theirAmount(treaty)) + " to " + esc(recipientCharity ? recipientCharity.name : "a charity") + '.</p><p class="outcome-total">' + money(total) + ' given directly.</p><a class="btn btn-cream" href="#/new">Make another Treaty</a></section>';
  }

  function replyForm(treaty) {
    if (ui.confirmDeclineId === treaty.id) {
      return '<section class="panel rise"><h2>Decline this treaty?</h2><p class="soft">The amounts will not go ahead. Either of you can start a new one later.</p><div class="actions"><button type="button" class="btn btn-danger" data-action="decline" data-id="' + esc(treaty.id) + '">Confirm decline</button><button type="button" class="btn btn-ghost" data-action="decline-back">Keep it open</button></div></section>';
    }
    const value = ui.draftAmount == null ? String(treaty.proposedAmount) : ui.draftAmount;
    return '<section class="panel rise"><h2>Your amount</h2><p class="soft">' + esc(treaty.creatorName) + " proposed " + money(treaty.proposedAmount) + ". Change it if you want to give a different amount.</p><form data-form=\"reply\" data-id=\"" + esc(treaty.id) + '"><p id="form-error" class="form-error" hidden></p><label class="field"><span>You will donate</span><div class="money"><span>£</span><input name="replyAmount" type="number" inputmode="numeric" min="1" max="5000" step="1" value="' + esc(value) + '"></div></label><div class="actions"><button class="btn btn-primary" type="submit">Accept treaty</button><button class="btn btn-danger" type="button" data-action="decline" data-id="' + esc(treaty.id) + '">Decline</button></div></form></section>';
  }

  function donationBlock(treaty, role) {
    const mineIsCreator = role === "creator";
    const charity = CT.charityById(mineIsCreator ? treaty.creatorCharityId : treaty.recipientCharityId);
    const donated = mineIsCreator ? treaty.creatorDonated : treaty.recipientDonated;
    const amount = mineIsCreator ? treaty.creatorAmount : theirAmount(treaty);
    const chooser = mineIsCreator ? treaty.recipientName : treaty.creatorName;
    if (!charity) {
      return '<section class="panel rise"><h2>Your donation</h2><p>' + esc(chooser) + " chooses the charity you will support. That choice is still open.</p></section>";
    }
    if (donated) {
      const other = mineIsCreator ? treaty.recipientName : treaty.creatorName;
      const otherDone = mineIsCreator ? treaty.recipientDonated : treaty.creatorDonated;
      return '<section class="panel rise"><h2>Your donation</h2><p>You reported a gift of ' + money(amount) + " to " + esc(charity.name) + ".</p><p class=\"soft\">" + (otherDone ? "Both sides are in." : "Waiting for " + esc(other) + " to report theirs.") + "</p></section>";
    }
    return '<section class="panel rise"><h2>Your donation</h2><p>Give ' + money(amount) + " to " + esc(charity.name) + ", chosen by " + esc(chooser) + '. The payment happens on their website.</p><div class="actions"><a class="btn btn-primary" href="' + esc(charity.url) + '" target="_blank" rel="noopener noreferrer" data-action="donate-link" data-id="' + esc(treaty.id) + '" data-side="' + (mineIsCreator ? "creator" : "recipient") + '" data-charity="' + esc(charity.id) + '">Donate ' + money(amount) + ' <span aria-hidden="true">↗</span></a><button type="button" class="btn btn-ghost" data-action="donated" data-id="' + esc(treaty.id) + '" data-side="' + role + '">I\'ve donated</button></div></section>';
  }

  function choiceBlock(treaty, role) {
    const forName = role === "creator" ? treaty.recipientName : treaty.creatorName;
    const amount = role === "creator" ? theirAmount(treaty) : treaty.creatorAmount;
    const locked = role === "creator" ? treaty.recipientDonated : treaty.creatorDonated;
    const selected = role === "creator" ? treaty.recipientCharityId : treaty.creatorCharityId;
    if (locked && selected) return "";
    return '<section class="panel rise"><h2>Choose a charity for ' + esc(forName) + "</h2><p>" + esc(forName) + " will donate " + money(amount) + " there, instead of buying a gift. You leave this page to give. Nothing is paid here.</p>" + charityList(treaty, role) + "</section>";
  }

  function tasksHtml(treaty, role) {
    if (treaty.status === "declined") {
      return '<section class="closed rise"><h2>Closed</h2><p class="soft">No donations were arranged.</p><a class="btn btn-primary" href="#/new">Make a Treaty</a></section>';
    }
    if (treaty.status === "pending") return role === "recipient" ? replyForm(treaty) : "";
    if (treaty.status === "complete") return outcomeHtml(treaty);
    return choiceBlock(treaty, role) + donationBlock(treaty, role);
  }

  function linkPanel(treaty) {
    const url = inviteUrl(treaty.token);
    return '<section class="linkbox rise"><div><h2 class="serif" style="font-size:1.45rem">Private link</h2><p class="soft">Only this link opens ' + esc(treaty.recipientName) + '\'s side. It is the whole invitation.</p></div><input id="invite-url" readonly value="' + esc(url) + '" aria-label="Private link" data-action="select-link"><div class="actions"><button type="button" class="btn btn-primary" data-action="copy-link" data-id="' + esc(treaty.id) + '" data-url="' + esc(url) + '">Copy link</button><a class="btn btn-ghost" href="#/i/' + esc(treaty.token) + '">Open their side</a></div></section>';
  }

  function lede(treaty, role) {
    const other = role === "creator" ? treaty.recipientName : treaty.creatorName;
    if (treaty.status === "declined") {
      return role === "recipient" ? "This agreement is closed. A new one can be made whenever you like." : other + " declined. Nothing is owed, and nothing was bought.";
    }
    if (treaty.status === "complete") return "Both donations were made on the charities' own websites.";
    if (treaty.status === "pending") {
      return role === "recipient" ? "Each of you gives an agreed amount to a charity the other person chooses." : other + " can accept, change their amount, or decline.";
    }
    return "Each donation goes to a charity chosen by the other person.";
  }

  function headline(treaty, role) {
    const other = role === "creator" ? treaty.recipientName : treaty.creatorName;
    if (role === "recipient" && treaty.status === "pending") return treaty.creatorName + " wants a treaty with you";
    return "Treaty with " + other;
  }

  function viewingNotice(treaty, viaToken) {
    const current = user();
    if (viaToken && current && treaty.creatorId === current.id) {
      return '<p class="notice rise">Viewing as ' + esc(treaty.recipientName) + ".</p>";
    }
    return "";
  }

  function roleFor(treaty, viaToken) {
    if (viaToken) return "recipient";
    const current = user();
    if (current && treaty.creatorId === current.id) return "creator";
    if (current && treaty.recipientId === current.id) return "recipient";
    return null;
  }

  function widthClass(route) {
    if (route.name === "landing") return "wrap wide";
    if (route.name === "login" || route.name === "new") return "wrap narrow";
    return "wrap";
  }

  function topbar(route, width) {
    const current = user();
    const home = current ? "#/home" : "#/";
    let nav = "";
    if (route.name === "landing" && !current) {
      nav = '<a class="btn btn-text" href="#how" data-action="scroll" data-target="how">How it works</a><a class="btn btn-text" href="#/login" data-next="#/home">Sign in</a><a class="btn btn-primary" href="#/login" data-next="#/new">Make a Treaty</a>';
    } else if (route.name === "landing") {
      nav = '<a class="btn btn-text" href="#how" data-action="scroll" data-target="how">How it works</a><a class="btn btn-ghost" href="#/home">Your treaties</a><a class="btn btn-primary" href="#/new">Make a Treaty</a>';
    } else if (current) {
      nav = '<a class="btn btn-primary" href="#/new" aria-current="' + (route.name === "new" ? "page" : "false") + '">New Treaty</a><span class="who">' + esc(current.name) + '</span><button type="button" class="btn btn-text" data-action="logout">Log out</button>';
    } else {
      nav = '<a class="btn btn-text" href="#/login" data-next="#/home">Sign in</a>';
    }
    return '<header class="topbar"><div class="topbar-inner ' + width + '"><a class="brand" href="' + home + '">' + mark() + "<span>The Christmas Treaty</span></a><nav class=\"nav\" aria-label=\"Primary\">" + nav + "</nav></div></header>";
  }

  function resetControl() {
    if (!ui.confirmReset) return '<button type="button" class="btn btn-text" data-action="reset">Reset demo data</button>';
    return '<span class="reset-confirm">Restore the original treaties? <button type="button" class="btn btn-text" data-action="reset-yes">Confirm reset</button><button type="button" class="btn btn-text" data-action="reset-no">Cancel</button></span>';
  }

  function footer(route, width) {
    const current = user();
    return '<footer class="site-footer"><div class="footer-inner ' + width + '"><p>Donations are made on charity websites. This demonstrative version never holds funds.</p>' + (current ? resetControl() : "<p>© " + new Date().getFullYear() + "</p>") + "</div></footer>";
  }

  function frame(route, inner) {
    const width = widthClass(route);
    return topbar(route, width) + '<main id="content" class="' + width + ' stack" tabindex="-1">' + inner + "</main>" + footer(route, width);
  }

  function landing() {
    const current = user();
    const primary = current ? "#/new" : "#/login";
    const next = current ? "" : ' data-next="#/new"';
    return '<section class="hero rise"><div class="hero-copy"><p class="eyebrow">A quieter kind of Christmas</p><h1>Make a treaty. Skip the unwanted gift.</h1><p class="lede">Unwanted presents cost money, time, and a surprising amount of landfill. Agree with someone that neither of you will buy a gift. Each of you donates what you would have spent — to a charity the other person chooses.</p><div class="actions"><a class="btn btn-primary" href="' + primary + '"' + next + '>Make a Treaty</a><a class="btn btn-ghost" href="#how" data-action="scroll" data-target="how">How it works</a></div></div><div class="sheet-stage" aria-hidden="true"><article class="preview"><p class="eyebrow">Example</p><h2>Maya &amp; Elliot</h2><dl><div><dt>Maya Chen gives</dt><dd class="sum">£40</dd><dd class="muted">to a charity Elliot chooses</dd></div><div class="rule"></div><div><dt>Elliot Ward gives</dt><dd class="sum">£40</dd><dd class="muted">to a charity Maya chooses</dd></div></dl><span class="pill accepted">Ready to give</span></article></div></section><ul class="facts rise"><li><strong>No presents</strong><span>Both sides opt out, together.</span></li><li><strong>No payments here</strong><span>You donate on the charity\'s own website.</span></li><li><strong>Private by link</strong><span>Only the two of you can open a treaty.</span></li></ul><section class="clauses" id="how"><article class="clause rise"><em>Clause 01</em><h2>Propose</h2><p>Name the person, the amount you will give, and the amount you propose they give.</p></article><article class="clause rise"><em>Clause 02</em><h2>Agree</h2><p>They accept, change their amount, or decline. Nothing is bought until you both mean it.</p></article><article class="clause rise"><em>Clause 03</em><h2>Give directly</h2><p>Each of you chooses a charity for the other. Donations happen on the charity\'s own website.</p></article></section><section class="band rise"><div><h2>Two people. Two donations. No wrapping paper.</h2><p>Twenty established charities. You choose where their gift would have gone.</p></div><a class="btn btn-cream" href="' + primary + '"' + next + '>Make a Treaty</a></section>';
  }

  function loginView() {
    return '<section class="auth-screen rise"><div class="page-head"><p class="eyebrow">Welcome</p><h1>Continue</h1><p class="lede">The sign-in is filled in for this demonstrative version.</p></div><form class="auth-card" data-form="login"><label class="field"><span>Name</span><input name="name" value="Alex Carter" readonly aria-readonly="true" autocomplete="off"></label><label class="field"><span>Passcode</span><input name="passcode" type="password" value="treaty" readonly aria-readonly="true" autocomplete="off"></label><button class="btn btn-primary" type="submit" autofocus>Enter</button><p class="hint">Everything is filled in. Continue when you are ready.</p></form></section>';
  }

  function homeView() {
    const current = user();
    const all = CT.store.get().treaties.filter(function (treaty) { return mine(treaty, current); });
    const waiting = all.filter(function (treaty) { return treaty.status === "pending" && treaty.recipientId === current.id; });
    const yours = all.filter(function (treaty) { return waiting.indexOf(treaty) === -1; });
    const rank = { pending: 0, accepted: 1, complete: 2, declined: 3 };
    yours.sort(function (a, b) { return rank[a.status] - rank[b.status] || b.createdAt - a.createdAt; });
    let intro = "Propose a treaty, or open one you already share.";
    if (waiting.length === 1) intro = waiting[0].creatorName + " is waiting for your answer.";
    else if (waiting.length > 1) intro = waiting.length + " people are waiting for your answer.";
    return '<header class="page-head rise"><p class="eyebrow">Your agreements</p><h1>Hello, ' + esc(current.name.split(" ")[0]) + '</h1><p class="lede">' + esc(intro) + '</p></header>' + ledger("Waiting for you", waiting, current) + ledger("Your treaties", yours, current, true);
  }

  function ledger(title, list, current, empty) {
    if (!list.length && !empty) return "";
    const rows = list.length ? list.map(function (treaty) {
      const name = otherName(treaty, current);
      return '<a class="treaty-row" href="#/t/' + esc(treaty.id) + '" aria-label="Treaty with ' + esc(name) + ", " + esc(statusLabel(treaty)) + '"><span class="avatar" style="background:' + tone(name) + '">' + esc(initials(name)) + '</span><span class="row-copy"><span class="row-name">' + esc(name) + '</span><span class="row-detail">' + esc(statusDetail(treaty, current)) + '</span></span><span class="row-end">' + pill(treaty) + '<span class="row-amount">' + money(treaty.creatorAmount) + " · " + money(theirAmount(treaty)) + "</span></span></a>";
    }).join("") : '<div class="empty"><p>No treaties yet.</p><a class="btn btn-primary" href="#/new">Make a Treaty</a></div>';
    return '<section class="rise"><div class="section-label"><h2>' + esc(title) + '</h2></div><div class="ledger">' + rows + "</div></section>";
  }

  function newView() {
    return '<header class="page-head rise"><p class="eyebrow">New agreement</p><h1>Make a Treaty</h1><p class="lede">Name the other person, what you will give, and what you propose they give.</p></header><form class="composer rise" data-form="create"><p id="form-error" class="form-error" hidden></p><label class="field"><span>Their name</span><input name="recipientName" maxlength="48" placeholder="e.g. Jordan Hale" autocomplete="off" required></label><label class="field"><span>You will donate</span><div class="money"><span>£</span><input name="creatorAmount" type="number" inputmode="numeric" min="1" max="5000" step="1" value="40" required></div></label><label class="field"><span>You propose they donate</span><div class="money"><span>£</span><input name="proposedAmount" type="number" inputmode="numeric" min="1" max="5000" step="1" value="40" required></div><span class="hint">This stays in step with your amount until you edit it.</span></label><button class="btn btn-primary" type="submit">Create Treaty</button><p class="hint">A private link is created with the treaty. Only that link opens their side.</p></form>';
  }

  function missingView() {
    return '<header class="page-head rise"><p class="eyebrow">Missing</p><h1>That page is not here.</h1><p class="lede">The link may be incomplete.</p></header><p class="rise"><a class="btn btn-primary" href="#/">Back to the start</a></p>';
  }

  function privateView() {
    return '<header class="page-head rise"><p class="eyebrow">Private</p><h1>This treaty is private.</h1><p class="lede">It opens only for the people in the agreement, or with their private link.</p></header><p class="rise"><a class="btn btn-primary" href="#/home">Your treaties</a></p>';
  }

  function invalidInvite() {
    return '<header class="page-head rise"><p class="eyebrow">Invitation</p><h1>This invitation link is not valid.</h1><p class="lede">Check the link, or start a treaty of your own.</p></header><p class="rise"><a class="btn btn-primary" href="#/">Back to the start</a></p>';
  }

  function treatyView(treaty, role, viaToken) {
    if (treaty.status === "complete") {
      return viewingNotice(treaty, viaToken) + outcomeHtml(treaty) + peopleHtml(treaty) + timelineHtml(treaty);
    }
    const head = '<header class="page-head rise"><p class="eyebrow">' + esc(statusLabel(treaty)) + "</p><h1>" + esc(headline(treaty, role)) + '</h1><p class="lede">' + esc(lede(treaty, role)) + "</p>" + stepsHtml(treaty) + "</header>";
    const link = role === "creator" ? linkPanel(treaty) : "";
    const linkFirst = role === "creator" && treaty.status === "pending";
    return viewingNotice(treaty, viaToken) + head + (linkFirst ? link : "") + peopleHtml(treaty) + tasksHtml(treaty, role) + (linkFirst ? "" : link) + timelineHtml(treaty);
  }

  function titleFor(route) {
    if (route.name === "login") return "Enter · The Christmas Treaty";
    if (route.name === "home") return "Your treaties · The Christmas Treaty";
    if (route.name === "new") return "New Treaty · The Christmas Treaty";
    if (route.name === "treaty") {
      const treaty = treatyById(route.id);
      return treaty ? "Treaty with " + otherName(treaty, user()) + " · The Christmas Treaty" : "Private · The Christmas Treaty";
    }
    if (route.name === "invite") return "Invitation · The Christmas Treaty";
    if (route.name === "missing") return "Not found · The Christmas Treaty";
    return "The Christmas Treaty";
  }

  function noteView(route) {
    if (route.name === "landing") trackOnceGlobal("landing_viewed", "Landing viewed");
    if (route.name === "invite") {
      const treaty = treatyByToken(route.token);
      if (treaty) trackOnceTreaty(treaty.id, "invitation_opened", "Invitation opened");
    }
    if (route.name === "treaty") {
      const treaty = treatyById(route.id);
      const current = user();
      if (treaty && current && treaty.recipientId === current.id) trackOnceTreaty(treaty.id, "invitation_opened", "Invitation opened");
    }
  }

  function redirectAuth(route) {
    const current = user();
    const guarded = route.name === "home" || route.name === "new" || route.name === "treaty";
    if (guarded && !current) {
      sessionStorage.setItem("ct-next", location.hash || "#/home");
      if (location.hash !== "#/login") location.hash = "#/login";
      return true;
    }
    if (route.name === "login" && current) {
      const next = sessionStorage.getItem("ct-next") || "#/home";
      sessionStorage.removeItem("ct-next");
      if (location.hash !== next) {
        location.hash = next;
        return true;
      }
    }
    return false;
  }

  function view(route) {
    if (route.name === "landing") return frame(route, landing());
    if (route.name === "login") return frame(route, loginView());
    if (route.name === "home") return frame(route, homeView());
    if (route.name === "new") return frame(route, newView());
    if (route.name === "missing") return frame(route, missingView());
    if (route.name === "treaty") {
      const treaty = treatyById(route.id);
      if (!treaty || !mine(treaty, user())) return frame(route, privateView());
      return frame(route, treatyView(treaty, roleFor(treaty, false), false));
    }
    if (route.name === "invite") {
      const treaty = treatyByToken(route.token);
      if (!treaty) return frame(route, invalidInvite());
      return frame(route, treatyView(treaty, "recipient", true));
    }
    return frame(route, missingView());
  }

  function render() {
    const route = parseRoute();
    if (redirectAuth(route)) return;
    const key = location.hash || "#/";
    const routeChanged = key !== lastRouteKey;
    if (routeChanged) {
      blankUi();
      lastRouteKey = key;
    }
    noteView(route);
    document.title = titleFor(route);
    const app = document.getElementById("app");
    app.innerHTML = view(route);
    if (routeChanged) {
      app.classList.remove("is-in");
      void app.offsetWidth;
      app.classList.add("is-in");
      window.scrollTo(0, 0);
    } else app.classList.add("is-in");
  }

  function patch(id, mutator) {
    const state = CT.store.get();
    const treaty = state.treaties.find(function (item) { return item.id === id; });
    if (!treaty) return null;
    const changed = mutator(treaty, state);
    if (changed === false) return treaty;
    treaty.updatedAt = Date.now();
    CT.store.set(state);
    return treaty;
  }

  function doLogin() {
    const state = CT.store.get();
    state.user = { id: CT.demoUser.id, name: CT.demoUser.name };
    if (!state.journey.some(function (event) { return event.type === "login"; })) {
      state.journey.push(makeEvent(null, "login", "Signed in"));
    }
    CT.store.set(state);
    const next = sessionStorage.getItem("ct-next") || "#/home";
    sessionStorage.removeItem("ct-next");
    toast("Welcome, Alex");
    go(next);
  }

  function doCreate(form) {
    const data = new FormData(form);
    const name = String(data.get("recipientName") || "").trim().replace(/\s+/g, " ");
    const creatorAmount = Number(data.get("creatorAmount"));
    const proposedAmount = Number(data.get("proposedAmount"));
    const error = validateName(name) || validateAmount(creatorAmount) || validateAmount(proposedAmount);
    if (error) {
      setError(error);
      return;
    }
    const state = CT.store.get();
    const current = state.user;
    const treaty = {
      id: "t_" + CT.uid(),
      token: CT.token(),
      creatorId: current.id,
      creatorName: current.name,
      recipientId: null,
      recipientName: name,
      creatorAmount: creatorAmount,
      proposedAmount: proposedAmount,
      recipientAmount: null,
      creatorCharityId: null,
      recipientCharityId: null,
      creatorDonated: false,
      recipientDonated: false,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    state.treaties.unshift(treaty);
    state.journey.push(makeEvent(treaty.id, "treaty_created", "Treaty proposed"));
    state.journey.push(makeEvent(treaty.id, "invitation_ready", "Private link ready"));
    CT.store.set(state);
    toast("Treaty created");
    go("#/t/" + treaty.id);
  }

  function doAccept(form) {
    const id = form.dataset.id;
    const amount = Number(new FormData(form).get("replyAmount"));
    const error = validateAmount(amount);
    if (error) {
      setError(error);
      return;
    }
    const treaty = treatyById(id);
    if (!treaty || treaty.status !== "pending") return;
    const adjusted = amount !== treaty.proposedAmount;
    patch(id, function (item, state) {
      item.recipientAmount = amount;
      item.status = "accepted";
      if (adjusted) state.journey.push(makeEvent(id, "amount_adjusted", "Amount adjusted from " + money(item.proposedAmount) + " to " + money(amount)));
      state.journey.push(makeEvent(id, "treaty_accepted", "Treaty accepted"));
    });
    toast(adjusted ? "Amount updated" : "Treaty accepted");
    render();
  }

  function doDecline(id) {
    if (ui.confirmDeclineId !== id) {
      ui.confirmDeclineId = id;
      render();
      return;
    }
    patch(id, function (item, state) {
      if (item.status !== "pending") return false;
      item.status = "declined";
      state.journey.push(makeEvent(id, "treaty_declined", "Treaty declined"));
    });
    ui.confirmDeclineId = null;
    toast("Treaty declined");
    render();
  }

  function doChoose(id, side, charityId) {
    const charity = CT.charityById(charityId);
    const treaty = treatyById(id);
    if (!treaty || !charity || treaty.status !== "accepted") return;
    if (side === "creator" && treaty.recipientDonated) return;
    if (side === "recipient" && treaty.creatorDonated) return;
    const already = side === "creator" ? treaty.recipientCharityId === charityId : treaty.creatorCharityId === charityId;
    if (already) return;
    patch(id, function (item, state) {
      const who = side === "creator" ? item.recipientName : item.creatorName;
      if (side === "creator") item.recipientCharityId = charityId;
      else item.creatorCharityId = charityId;
      state.journey.push(makeEvent(id, "charity_chosen", "Charity chosen for " + who + " · " + charity.name));
    });
    toast(charity.name + " selected");
    render();
  }

  function doDonated(id, side) {
    const treaty = treatyById(id);
    if (!treaty || treaty.status !== "accepted") return;
    if (side === "creator" && (!treaty.creatorCharityId || treaty.creatorDonated)) return;
    if (side === "recipient" && (!treaty.recipientCharityId || treaty.recipientDonated)) return;
    let completed = false;
    patch(id, function (item, state) {
      if (side === "creator") item.creatorDonated = true;
      else item.recipientDonated = true;
      const name = side === "creator" ? item.creatorName : item.recipientName;
      state.journey.push(makeEvent(id, "donation_reported", "Donation reported · " + name));
      if (item.creatorDonated && item.recipientDonated) {
        item.status = "complete";
        state.journey.push(makeEvent(id, "treaty_complete", "Treaty complete"));
        completed = true;
      }
    });
    toast(completed ? "Treaty complete" : "Donation recorded");
    render();
  }

  function rememberDonationLink(el) {
    const charity = CT.charityById(el.dataset.charity);
    trackOnceTreaty(el.dataset.id, "donation_link_" + el.dataset.side, "Donation page opened · " + (charity ? charity.name : "Charity"));
  }

  async function copyLink(el) {
    const url = el.dataset.url;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch (err) {
      const input = document.getElementById("invite-url");
      if (input) {
        input.focus();
        input.select();
      }
      toast("Copy the link from the field");
    }
    trackOnceTreaty(el.dataset.id, "link_copied", "Private link copied");
  }

  function onClick(event) {
    const nextLink = event.target.closest("[data-next]");
    if (nextLink && nextLink.getAttribute("href") === "#/login") sessionStorage.setItem("ct-next", nextLink.dataset.next);
    const el = event.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    if (action === "donate-link") {
      rememberDonationLink(el);
      return;
    }
    if (action === "select-link") {
      el.select();
      return;
    }
    if (action === "scroll") {
      event.preventDefault();
      const target = document.getElementById(el.dataset.target);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (el.tagName === "A") return;
    event.preventDefault();
    if (action === "logout") {
      const state = CT.store.get();
      state.user = null;
      CT.store.set(state);
      toast("Signed out");
      go("#/");
    } else if (action === "copy-link") copyLink(el);
    else if (action === "decline") doDecline(el.dataset.id);
    else if (action === "decline-back") {
      ui.confirmDeclineId = null;
      render();
    } else if (action === "choose") doChoose(el.dataset.id, el.dataset.side, el.dataset.charity);
    else if (action === "donated") doDonated(el.dataset.id, el.dataset.side);
    else if (action === "reset") {
      ui.confirmReset = true;
      render();
    } else if (action === "reset-no") {
      ui.confirmReset = false;
      render();
    } else if (action === "reset-yes") {
      const current = user();
      CT.store.reset(current);
      ui.confirmReset = false;
      toast("Demo data restored");
      const route = parseRoute();
      const missingTreaty = route.name === "treaty" && !treatyById(route.id);
      const missingInvite = route.name === "invite" && !treatyByToken(route.token);
      if (missingTreaty || missingInvite) go("#/home");
      else render();
    }
  }

  function onSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.form) return;
    event.preventDefault();
    if (form.dataset.form === "login") doLogin();
    else if (form.dataset.form === "create") doCreate(form);
    else if (form.dataset.form === "reply") doAccept(form);
  }

  function onInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.name === "creatorAmount") {
      const other = document.querySelector("[name=proposedAmount]");
      if (other && other.dataset.touched !== "1") other.value = target.value;
    }
    if (target.name === "proposedAmount") target.dataset.touched = "1";
    if (target.name === "replyAmount") ui.draftAmount = target.value;
    if (target.id === "charity-search") {
      const query = target.value.trim().toLowerCase();
      let shown = 0;
      document.querySelectorAll(".charity").forEach(function (card) {
        const match = !query || (card.dataset.blob || "").indexOf(query) !== -1;
        card.hidden = !match;
        if (match) shown += 1;
      });
      const empty = document.getElementById("charity-empty");
      if (empty) empty.hidden = shown !== 0;
    }
  }

  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  document.addEventListener("input", onInput);
  window.addEventListener("hashchange", render);
  CT.store.load();
  render();
})();
