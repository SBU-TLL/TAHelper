/*** Main Javascript file ***/

var taHelper;

function init() {
  // The roster is regenerated outside the app (see the roster build scripts), so
  // never let the browser serve a stale copy — a cached dataDev.json silently
  // shows the wrong groups, or an outdated role, which renders an empty page.
  var bust = `?v=${Date.now()}`;

  var appInfo = $.get("./js/TAHelper.js"); // TAHelper javascript file
  var courseInfo = $.get(`./json/dataDev.json${bust}`); // student and TA data
  var loginInfo = $.get("./iam.php"); // login information

  $.when(appInfo, courseInfo, loginInfo).done((_, courseInfo, loginInfo) => {
    taHelper = new TAHelper(courseInfo, loginInfo);
    taHelper.load();
  });
}

$(init);
