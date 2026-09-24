/*** Javascript file for controlling interactions between TAHelperModel and TAHelperUI ***/

class TAHelper {
  constructor (courseInfo, loginInfo) {
    // Both are plain objects now: the roster is unwrapped by the caller and the
    // identity comes from the page rather than a second HTTP request.
    this.courseInfo = courseInfo;
    this.loginInfo = loginInfo;
    // console.log(this.courseInfo, this.loginInfo)
  }


  load() {
    // load model and gui scripts — absolute, because the code is shared by
    // every course while the page lives under /<COURSE>/
    var model = $.get("/js/TAHelperModel.js");
    var ui = $.get("/js/TAHelperUI.js");

    $.when(model, ui).done(() => {
      this.model = new TAHelperModel(this.courseInfo, this.loginInfo);

      var user = this.model.getLoginID();
      var userInfo = this.model.getUserInfo(user);
      var studInfo = this.model.getAllStudsForUser(user);
      var TAInfo= this.model.getAllTAs();
      var sectionInfo=this.model.getSectionInfo();
       console.log(TAInfo)
       this.ui = new TAHelperUI(userInfo, studInfo,TAInfo,sectionInfo);

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

        $('#content').on('request:group-attendance', (evt, evaluatorID, groupID, students) => {
          this.loadGroupAttendance(evaluatorID, groupID, students);
        });

        // install an event listener to be triggered when a group attendance request is made
        $('#content').on('request:group-attendance-percent', (evt, evaluatorID, groupID, students) => {
          this.loadAttendancePercent(evaluatorID, groupID, students);
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

        // install an event listener to be triggered when a roster load request is made
        $('#content').on('request:admin-load-roster', (evt, file) => {
          this.loadRoster(file);
        });

        $('#content').on('request:admin-save-roster', (evt, assignments) => {
          this.saveRosterAssignments(assignments);
        });

        $('#content').on('request:admin-upload-images', (evt, file) => {
          this.uploadImages(file);
        });
      });
    });
  }

  uploadImages(file) {
    this.ui.showLoader();

    var formData = new FormData();
    formData.append('imageZip', file);
    $.ajax({url: 'dashboardUpload.php', method: 'POST', data: formData, processData: false, contentType: false})
    .done(() => {
      this.ui.hideLoader();
      this.ui.showSavedLabel('images');
    }).fail(xhr => {
      this.ui.hideLoader();
      alert(xhr.responseText || 'The roster could not be loaded.');
    });
  }

  loadRoster(file) {
    this.ui.showLoader();

    var formData = new FormData();
    formData.append('roster', file);
    $.ajax({url: 'roster.php', method: 'POST', data: formData, processData: false, contentType: false})
    .done(() => {
      this.ui.hideLoader();
      this.ui.showSavedLabel('load');
    }).fail(xhr => {
      this.ui.hideLoader();
      alert(xhr.responseText || 'The roster could not be loaded.');
    });
  }

  saveRosterAssignments(assignments) {
    this.ui.showLoader();
    $.ajax({
      url: 'roster.php',
      method: 'POST',
      data: JSON.stringify({action: 'assign', ...assignments}),
      contentType: 'application/json'
    }).done(() => {
      this.ui.updateState();
      this.ui.hideLoader();
      this.ui.showSavedLabel('assign');
    }).fail(xhr => {
      this.ui.hideLoader();
      alert(xhr.responseText || 'The roster assignments could not be saved.');
    });
  }

  /* Loads attendance indicators for a group */
  loadGroupAttendance (evaluatorID, groupID, students) {
    students.forEach(student => {
      var filename = `${groupID}_${student.NetID}`;
      $.getJSON(`evaluationInfo.php?type=student&date=${this.getCurrentDate()}&evaluator=${evaluatorID}&group=${groupID}&filename=${filename}`)
        .done(form => this.ui.updateAttendanceStatus(student.NetID, form[0] && form[0].Value));
    });
  }

  /* Loads attendance percentage for a group */
  loadAttendancePercent (evaluatorID, groupID, students) {
    var total = students.length;
    var attendance = {'Present': 0, 'Absent': 0, '+10min_late': 0, 'Unknown': total, 'Total': total};

    var requests = students.map(student => {
      var filename = `${groupID}_${student.NetID}`;
      return $.getJSON(`evaluationInfo.php?type=student&date=${this.getCurrentDate()}&evaluator=${evaluatorID}&group=${groupID}&filename=${filename}`)
        .done(form => {
          if(form[0] && form[0].Value) {
            attendance[form[0].Value]++;
            attendance['Unknown']--;
          }
        });
    })
    Promise.all(requests).then(() => {
      this.ui.updateAttendancePercent(groupID, attendance);
    });
  }

  /* Initializes or retrieves a new or existing form */
  loadForm (type, evaluatorID=null, groupID=null, studentID=null) {
    var studentIDs = (type == "student" && Array.isArray(studentID)) ? studentID : null; //Check for multiple students
    if (studentIDs && studentIDs.length > 1) { //Load default template
      var templateFilename = `${groupID}___default__`;
      var templateUrl = `evaluationInfo.php?type=student&date=${this.getCurrentDate()}&evaluator=${evaluatorID}&group=${groupID}&filename=${templateFilename}`;
      this.ui.showLoader();
      $.getJSON(templateUrl).done(result => {
        this.ui.hideLoader();
        this.ui.showStudForm(result, null, groupID, studentIDs);
      });
      return;
    }
    if (studentIDs) { //Format back to single student
      studentID = studentIDs[0];
    }
    var datetime = this.getCurrentDate();
    var filename = (type == "student") ? `${groupID}_${studentID}` : `${groupID}`;
    var url = `evaluationInfo.php?type=${type}&date=${datetime}&evaluator=${evaluatorID}&group=${groupID}&filename=${filename}`;
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
    var studentIDs = (type == "student" && Array.isArray(studentID)) ? studentID : [studentID]; //Format to array
    var requests = studentIDs.map(currentStudentID => {
      var filename = (type == "student") ? `${groupID}_${currentStudentID}` : `${groupID}`;
      var url = `evaluationInfo.php?type=${type}&date=${datetime}&evaluator=${evaluatorID}&group=${groupID}&filename=${filename}`;
      var studentData = {
        ...data,
        "Details": {
          ...data.Details,
          "Student Name": this.getStudentName(currentStudentID)
        }
      }
      return $.post(url, {data: studentData}).done(() => {
        if(type == "student") {
          this.ui.updateAttendanceStatus(currentStudentID, data["Response Data"][0]);
        }
      });
    });

    $.when.apply($, requests).done(() => {
      this.ui.setHasUnsavedChanges(false);
      this.ui.updateState();
    }).fail(() => {
      console.log("Failed to update form");
    });
  }

  getStudentName (studentID) {
    var student = this.ui.studInfo.flat().find(stud => stud.NetID == studentID);
    return student ? student.Name : "";
  }


  /* Download responses from the database */
  downloadResponses (type, data=null) {
    var url = `responseInfo.php?request=download&type=${type}`;
    // console.log(type, data, url)
    $.post(url, {data: data}).done(result => {
      var hiddenElement = document.createElement('a');
      hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(result);
      hiddenElement.target = '_blank';
      // Name the export after the course actually being viewed; this was
      // hardcoded to BIO201, so every course exported under that name.
      hiddenElement.download = `${window.TAHELPER_COURSE || 'TAHelper'} Evaluations.csv`;
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
