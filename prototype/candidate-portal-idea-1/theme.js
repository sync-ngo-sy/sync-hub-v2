(function () {
  var q = new URLSearchParams(location.search).get('theme');
  var saved = q || localStorage.getItem('sync-theme');
  if (saved === 'dark' || saved === 'light') {
    document.documentElement.setAttribute('data-theme', saved);
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('.themer');
    if (!b) return;
    var now = document.documentElement.getAttribute('data-theme');
    if (!now) now = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var next = now === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('sync-theme', next);
    // seals read their colours from the tokens, so they must be struck again
    if (window.restrikeSeals) window.restrikeSeals();
  });
})();
