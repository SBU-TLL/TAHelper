/*** Main Javascript file ***/

var taHelper;

function init() {
  // The roster is regenerated outside the app (makeJSON.py / extractStudentsFromHTML.py),
  // so never let the browser serve a stale copy — a cached roster silently shows
  // the wrong groups, or an outdated role, which renders an empty page.
  // Absolute: the code is shared by every course. Relative: the data belongs to
  // whichever course directory this page was served from (/BIO201/, /BIO354/…),
  // which is what keeps the two courses apart.
  var appInfo = $.get("/js/TAHelper.js"); // TAHelper javascript file
  var courseInfo = $.get(`./roster.php?f=data&v=${Date.now()}`); // student and TA data

  // The course code is emitted by the page (lib/app_shell.php). It used to
  // be scraped out of the URL with /\/([^\/]*)\/TAHelper/, which only matched
  // the old /<COURSE>/TAHelper/ deployment and silently produced no course
  // anywhere else.
  var course = window.TAHELPER_COURSE;
  document.title = course ? `TAHelper ${course}` : "TAHelper";

  // Identity is emitted by the page itself (lib/app_shell.php); it used to cost
  // an extra round trip to iam.php for values the server already had.
  $.when(appInfo, courseInfo).done((_, courseInfo) => {
    taHelper = new TAHelper(courseInfo[0], window.TAHELPER_USER);
    taHelper.load();
  });
}

$(init);
