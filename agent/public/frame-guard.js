// Wide screens show the conversation and the missions inside a drawn phone (phone.html, team 18/11).
// Runs first in <head>: a top-level page on a wide, tall screen reloads itself inside the frame.
// Real phones (narrow, or short in landscape) and the page already inside the frame are left alone.
(function () {
  try {
    if (window.top !== window.self) { document.documentElement.classList.add('in-phone'); return; }
    if (window.innerWidth < 700 || window.innerHeight < 600) return;
    var here = location.pathname + location.search + location.hash;
    location.replace('/phone.html?src=' + encodeURIComponent(here));
  } catch (e) { /* never block the app */ }
})();
