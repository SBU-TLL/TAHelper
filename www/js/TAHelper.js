/*** Javascript file for controlling interactions between TAHelperModel and TAHelperUI ***/

class TAHelper {
  constructor (courseInfo, loginInfo) {
    this.courseInfo = courseInfo[0];
    this.loginInfo = loginInfo[0];
    // console.log(this.courseInfo, this.loginInfo)
  }


  load() {
    // load model and gui scripts
    var model = $.get("./js/TAHelperModel.js");
    var ui = $.get("./js/TAHelperUI.js");

    $.when(model, ui).done(() => {
      this.model = new TAHelperModel(this.courseInfo, this.loginInfo);

      var user = this.model.getLoginID();
      var userInfo = this.model.getUserInfo(user);
      var studInfo = this.model.getAllStudsForUser(user);
      this.ui = new TAHelperUI(userInfo, studInfo);
      // console.log(this.model, this.ui)

      this.ui.showHomePage().then(() => {
        this.ui.hideLoader();

        // install an event listener to be triggered when a student has been selected
        $('#content').on('request:student-eval', (evt, evaluatorID, groupID, studentID) => {
          // console.log(evaluatorID, groupID, studentID)
          this.loadForm("student", evaluatorID, groupID, studentID);
        });

        // install an event listener to be triggered when a student has been selected
        $('#content').on('request:group-eval', (evt, evaluatorID, groupID) => {
          // console.log(evaluatorID, groupID)
          this.loadForm("group", evaluatorID, groupID);
        });

        // install an event listener to be triggered when a save button is clicked
        $('#content').on('request:save-eval', (evt, formType, evaluatorID, groupID, studentID, data) => {
          // console.log(evaluatorID, evaluatorID, groupID, studentID, data)
          this.updateForm(formType, evaluatorID, groupID, studentID, data);
        });

        // install an event listener to be triggered when a download request is made
        $('#content').on('request:download-eval', (evt, dataType, data) => {
          // console.log(dataType, data);
          this.downloadResponses(dataType, data);
        });

        // install an event listener to be triggered when a clear request is made
        $('#content').on('request:clear-eval', (evt, dataType, data) => {
          // console.log(dataType, data);
          this.clearResponses(dataType, data);
        });
      });
    });
  }


  /* Initializes or retrieves a new or existing form */
  loadForm (type, evaluatorID=null, groupID=null, studentID=null) {
    var datetime = this.getCurrentDate();
    var filename = (type == "student") ? `${evaluatorID}_${groupID}_${studentID}` : `${evaluatorID}_${groupID}`;
    var url = `evaluationInfo.php?type=${type}&date=${datetime}&filename=${filename}`;
    // console.log(url)
    
    this.ui.showLoader();
    $.getJSON(url).done(result => {
      // console.log(result)
      this.ui.hideLoader();
      switch (type) {
        case "student":
          this.ui.showStudForm(result, studentID);
          break
        case "group":
          this.ui.showGroupForm(result, groupID);
          break
        default:
          console.log("Invalid form type: ", type)
          return;
      }
    });
  }


  /* Post updated form results to the appropriate file in database */
  updateForm (type, evaluatorID=null, groupID=null, studentID=null, data) {
    var datetime = this.getCurrentDate();
    var filename = (type == "student") ? `${evaluatorID}_${groupID}_${studentID}` : `${evaluatorID}_${groupID}`;
    var url = `evaluationInfo.php?type=${type}&date=${datetime}&filename=${filename}`;

    $.post(url, {data: data}).done(() => {
      this.ui.setHasUnsavedChanges(false);
      this.ui.updateState();
    }).fail(() => {
      console.log("Failed to update form");
    });
  }


  /* Download responses from the database */
  downloadResponses (type, data=null) {
    var url = `responseInfo.php?request=download&type=${type}`;
    // console.log(type, data, url)

    $.post(url, {data: data}).done(result => {
      var hiddenElement = document.createElement('a');
      hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(result);
      hiddenElement.target = '_blank';
      hiddenElement.download = 'BIO201 Evaluations.csv';
      hiddenElement.click();
      console.log("done")
    });
  }


  /* Clear responses in the database */
  clearResponses (type, data=null) {
    var url = `responseInfo.php?request=clear&type=${type}`;
    $.post(url, {data: data}).done(() => {
      // TODO: show some sort of alert to user that request was completed
      console.log("done")
    });
  }

  
  /* Returns the current date in YYYY-MM-DD string format */
  getCurrentDate() {
    var datetime = new Date();
    let year = datetime.getFullYear();
    let month = (datetime.getMonth()+1 < 10) ? `0${datetime.getMonth()+1}` : datetime.getMonth()+1;
    let date = (datetime.getDate() < 10) ? `0${datetime.getDate()}` : datetime.getDate();
    return `${year}-${month}-${date}`;
  }

}
