window.addEventListener('DOMContentLoaded', function(theme) {
  if(localStorage.getItem('theme') === 'true') {
    $('html').toggleClass('dark');
    $('input#switch-theme').prop('checked',true);
  }
  else {
    localStorage.setItem('theme',false);
  }
});
$('input#switch-theme').click(function() {
  $('html').toggleClass('dark');
  if(localStorage.getItem('theme') === 'true') {
    $('input#switch-theme').prop('checked',false);
    localStorage.setItem('theme',false);
  }
  else {
    $('input#switch-theme').prop('checked',true);
    localStorage.setItem('theme',true);
  }
});
