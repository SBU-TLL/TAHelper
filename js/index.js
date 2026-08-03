/*** Main Javascript file ***/

var taHelper;

function init() {
  var appInfo = $.get("./js/TAHelper.js"); // TAHelper javascript file
  var courseInfo = $.get("./json/data.json"); // student and TA data
  var loginInfo = $.get("./iam.php"); // login information
  var course=window.location.href.match(/\/([^\/]*)\/TAHelper/)[1];
  document.title=`TAHelper ${course}`
  $.when(appInfo, courseInfo, loginInfo).done((_, courseInfo, loginInfo) => {
    taHelper = new TAHelper(courseInfo, loginInfo);
    taHelper.load();
  });
}

$(init);
