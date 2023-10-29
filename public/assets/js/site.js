// COLOR MODE CONTROLS
window.addEventListener('DOMContentLoaded', function (theme) {
  if (localStorage.getItem('theme') === 'true') {
    $('html').toggleClass('dark');
    $('input#switch-theme').prop('checked', true);
  }
  else {
    localStorage.setItem('theme', false);
  }
});
$('input#switch-theme').click(function () {
  $('html').toggleClass('dark');
  if (localStorage.getItem('theme') === 'true') {
    $('input#switch-theme').prop('checked', false);
    localStorage.setItem('theme', false);
  }
  else {
    $('input#switch-theme').prop('checked', true);
    localStorage.setItem('theme', true);
  }
});

// WELCOME LOGO
window.addEventListener('DOMContentLoaded', function (visited) {
  if (localStorage.getItem('visited') === 'true') {
    $('.welcome').toggleClass('dismissed');
  }
  else {
    localStorage.setItem('visited', true);
  }
});
$('button.dismiss-welcome').click(function () {
  $('.welcome').addClass('dismissed');
});

// ALERTS
window.addEventListener('DOMContentLoaded', function (alerts) {
  $('.alert').addClass('show');
  setTimeout(function () {
    $('.alert').removeClass('show')
  }, 10000);
});
$('.alert .message button.close').click(function () {
  $('.alert').removeClass('show');
});
$('.info button').click(function () {
  $('.alert').addClass('show');
  setTimeout(function () {
    $('.alert').removeClass('show')
  }, 10000);
});

// CLOCK
function showTime() {
  var date = new Date();
  var h = date.getHours(); // 0 - 23
  var m = date.getMinutes(); // 0 - 59
  var s = date.getSeconds(); // 0 - 59
  var session = "AM";

  if (h == 0) {
    h = 12;
  }

  if (h > 12) {
    h = h - 12;
    session = "PM";
  }

  h = (h < 10) ? "0" + h : h;
  m = (m < 10) ? "0" + m : m;
  s = (s < 10) ? "0" + s : s;

  // var time = h + ":" + m + ":" + s + " " + session;
  var time = h + ":" + m + " " + session;
  document.getElementById("clock").innerText = time;
  document.getElementById("clock").textContent = time;

  setTimeout(showTime, 60000);
}

showTime();