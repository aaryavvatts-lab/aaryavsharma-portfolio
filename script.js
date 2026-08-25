document.addEventListener('DOMContentLoaded', function(){
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links){
    toggle.addEventListener('click', function(){
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  var btn = document.getElementById('splitToggle');
  if (btn){
    var label = document.getElementById('toggleLabel');
    var nums = document.querySelectorAll('#reversalList .num[data-quick]');
    var showingHonest = false;
    btn.addEventListener('click', function(){
      showingHonest = !showingHonest;
      btn.setAttribute('aria-pressed', showingHonest ? 'true' : 'false');
      label.textContent = showingHonest ? 'show the honest split' : 'show the quick split';
      nums.forEach(function(el){
        el.style.opacity = '0';
        setTimeout(function(){
          if (showingHonest){
            el.textContent = el.getAttribute('data-honest');
            el.className = 'num ' + el.getAttribute('data-honest-class');
          } else {
            el.textContent = el.getAttribute('data-quick');
            el.className = 'num ' + el.getAttribute('data-quick-class');
          }
          el.style.opacity = '1';
        }, 160);
      });
    });
  }
});
