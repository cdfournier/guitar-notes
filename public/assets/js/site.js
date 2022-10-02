// COLOR MODE CONTROLS
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

// WELCOME LOGO
window.addEventListener('DOMContentLoaded', function(visited) {
  if(localStorage.getItem('visited') === 'true') {
    $('.welcome').toggleClass('dismissed');
  }
  else {
    localStorage.setItem('visited',true);
  }
  });
  $('button.dismiss-welcome').click( function() {
    $('.welcome').addClass('dismissed');
  });


// ALERTS
window.addEventListener('DOMContentLoaded', function(alerts) {
  $('.alert').addClass('show');
    setTimeout(function() {
      $('.alert').removeClass('show') }, 10000);
  });
  $('.alert .message button.close').click( function() {
    $('.alert').removeClass('show');
  });
  $('.info button').click( function() {
    $('.alert').addClass('show');
    setTimeout(function() {
      $('.alert').removeClass('show') }, 10000);
  });
