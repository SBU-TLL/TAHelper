/*** Main Javascript file ***/

var taHelper;

function init() {
  // The roster is regenerated outside the app (makeJSON.py / extractStudentsFromHTML.py),
  // so never let the browser serve a stale copy — a cached roster silently shows
  // the wrong groups, or an outdated role, which renders an empty page.
  var bust = `?v=${Date.now()}`;

  var appInfo = $.get("./js/TAHelper.js"); // TAHelper javascript file
  var courseInfo = $.get(`./json/data.json${bust}`); // student and TA data
  var loginInfo = $.get("./iam.php"); // login information

  // In production the app is served from /<COURSE>/TAHelper/, so the course code
  // comes from the URL. Anywhere else (local dev, a plain docroot) there is no
  // such segment — match() returns null, so fall back instead of throwing and
  // leaving the page blank.
  var course = window.location.href.match(/\/([^\/]*)\/TAHelper/)?.[1];
  document.title = course ? `TAHelper ${course}` : "TAHelper";

  $.when(appInfo, courseInfo, loginInfo).done((_, courseInfo, loginInfo) => {
    taHelper = new TAHelper(courseInfo, loginInfo);
    taHelper.load();
  });
}

$(init);
