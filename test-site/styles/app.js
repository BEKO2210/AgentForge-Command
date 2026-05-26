/* test-site — progressive enhancement (owner: frontend).
   Pages work without JS; this script adds the API live probe and
   client-side form validation. */
(function () {
  "use strict";

  // --- /api/hello live probe (landing page) ------------------------------
  var probeBtn = document.getElementById("api-probe");
  var probeOut = document.getElementById("api-output");

  if (probeBtn && probeOut) {
    probeBtn.addEventListener("click", function () {
      probeBtn.disabled = true;
      probeOut.setAttribute("data-state", "loading");
      probeOut.textContent = "Lade /api/hello …";

      fetch("/api/hello", { headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          probeOut.setAttribute("data-state", "ok");
          probeOut.textContent = JSON.stringify(data, null, 2);
        })
        .catch(function (err) {
          probeOut.setAttribute("data-state", "error");
          probeOut.textContent =
            "Fehler beim Abruf: " + (err && err.message ? err.message : err) +
            "\n(Backend bereits gestartet? `node test-site/server/server.js`)";
        })
        .then(function () {
          probeBtn.disabled = false;
        });
    });
  }

  // --- Contact form: client-side validation + demo confirmation ---------
  var form   = document.getElementById("contact-form");
  if (!form) return;

  var status = document.getElementById("form-status");
  var fields = [
    { id: "name",    err: "name-error",    test: function (v) { return v.trim().length >= 2; } },
    { id: "email",   err: "email-error",   test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); } },
    { id: "message", err: "message-error", test: function (v) { return v.trim().length >= 5; } }
  ];

  function clearError(spec) {
    var input = document.getElementById(spec.id);
    var err   = document.getElementById(spec.err);
    if (input) input.removeAttribute("aria-invalid");
    if (err)   err.hidden = true;
  }
  function showError(spec) {
    var input = document.getElementById(spec.id);
    var err   = document.getElementById(spec.err);
    if (input) input.setAttribute("aria-invalid", "true");
    if (err)   err.hidden = false;
  }

  fields.forEach(function (spec) {
    var input = document.getElementById(spec.id);
    if (!input) return;
    input.addEventListener("input", function () {
      if (spec.test(input.value)) clearError(spec);
    });
  });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var firstInvalid = null;
    fields.forEach(function (spec) {
      var input = document.getElementById(spec.id);
      if (!input) return;
      if (!spec.test(input.value)) {
        showError(spec);
        if (!firstInvalid) firstInvalid = input;
      } else {
        clearError(spec);
      }
    });

    if (firstInvalid) {
      if (status) {
        status.hidden = false;
        status.setAttribute("data-state", "error");
        status.textContent = "Bitte die markierten Felder korrigieren.";
      }
      firstInvalid.focus();
      return;
    }

    var name = document.getElementById("name").value.trim();
    if (status) {
      status.hidden = false;
      status.setAttribute("data-state", "ok");
      status.textContent =
        "Danke, " + name + " — Nachricht entgegengenommen. " +
        "(Demo: es wurde nichts versendet.)";
    }
    form.reset();
  });

  form.addEventListener("reset", function () {
    fields.forEach(clearError);
    if (status) {
      status.hidden = true;
      status.removeAttribute("data-state");
      status.textContent = "";
    }
  });
})();
