window.addEventListener('DOMContentLoaded', function(simplify) {
  if(sessionStorage.getItem('simplify') === 'true') {
    $('section.chords').removeClass('show');
    $('section.chords.simplified').addClass('show');
    $('input#switch-simplify').prop('checked',true);
  }
  else {
    sessionStorage.setItem('simplify',false);
  }
});
$('input#switch-simplify').click(function() {
  $('section.chords').toggleClass('show');
  if(sessionStorage.getItem('simplify') === 'true') {
    $('section.chords.simplified').removeClass('show');
    $('input#switch-simplify').prop('checked',false);
    sessionStorage.setItem('simplify',false);
  }
  else {
    $('input#switch-simplify').prop('checked',true);
    sessionStorage.setItem('simplify',true);
  }
});

window.addEventListener('DOMContentLoaded', function(theme) {
  if(sessionStorage.getItem('theme') === 'true') {
    $('body').toggleClass('dark');
    $('input#switch-theme').prop('checked',true);
  }
  else {
    sessionStorage.setItem('theme',false);
  }
});
$('input#switch-theme').click(function() {
  $('body').toggleClass('dark');
  if(sessionStorage.getItem('theme') === 'true') {
    $('input#switch-theme').prop('checked',false);
    sessionStorage.setItem('theme',false);
  }
  else {
    $('input#switch-theme').prop('checked',true);
    sessionStorage.setItem('theme',true);
  }
});
