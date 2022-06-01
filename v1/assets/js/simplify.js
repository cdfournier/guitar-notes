window.addEventListener('DOMContentLoaded', function(simplify) {
  if(localStorage.getItem('simplify') === 'true') {
    $('section.chords').removeClass('show');
    $('section.chords.simplified').addClass('show');
    $('input#switch-simplify').prop('checked',true);
  }
  else {
    localStorage.setItem('simplify',false);
  }
});
$('input#switch-simplify').click(function() {
  $('section.chords').toggleClass('show');
  if(localStorage.getItem('simplify') === 'true') {
    $('section.chords.simplified').removeClass('show');
    $('input#switch-simplify').prop('checked',false);
    localStorage.setItem('simplify',false);
  }
  else {
    $('input#switch-simplify').prop('checked',true);
    localStorage.setItem('simplify',true);
  }
});
