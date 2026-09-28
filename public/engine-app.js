(function () {
  "use strict";
  console.log("Family Frame engine loading…");
  // Full engine will be loaded from local full file if this stub is present.
  // Redirect notice for incomplete deploy
  document.addEventListener("DOMContentLoaded", function () {
    var empty = document.getElementById("empty-state");
    if (empty) {
      empty.innerHTML = "<div class=\"empty-icon\">📷</div><h3>Loading full engine…</h3><p>If this stays blank, open the local index.html from the project folder for all features.</p>";
    }
  });
})();
