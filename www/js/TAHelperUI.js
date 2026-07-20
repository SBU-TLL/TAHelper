/* JavaScript file for handling UI in TAHelper */

const ROLES = {
  ADMIN: {
    PROFESSOR: "Professor",
    GTA: "GTA"
  },
  UGTA: "Group Facilitator"
}

class TAHelperUI {
  constructor (userInfo, studInfo) {
    this.userInfo = userInfo;
    this.userRole = userInfo.Type;
    this.studInfo = studInfo;
    // console.log(this.userInfo, this.studInfo)

    this.state = {
      imagesLoaded: 0,
      imagesToLoad: 0,
      hasUnsavedChanges: false,
      waitingOnSavePrompt: false,
      waitingOnClearPrompt: false,
      enableGroupEvaluations: false
    };
  }

  /* State setter methods */
  setHasUnsavedChanges (val) { this.state.hasUnsavedChanges = val; }
  setWaitingOnSavePrompt (val) { this.state.waitingOnSavePrompt = val; }
  setWaitingOnClearPrompt (val) { this.state.waitingOnClearPrompt = val; }
  setEnableGroupEvaluations (val) { this.state.enableGroupEvaluations = val; }

  /*  */
  updateState() {
    if (!this.state.hasUnsavedChanges) {
      this.showSavedLabel();

      if (this.state.waitingOnSavePrompt) {
        this.handleBackRequest();
        this.handleModalCloseRequest();
      }
    }
  }

  /* Add menu options to the top of the page */
  initMenu() {
    this.addBackBtn();
    this.addDropdownMenu();
  }

  /* Displays the starting page that user sees when logged in */
  showHomePage() {
    return new Promise((resolve, _) => {
      switch (this.userRole) {
        case ROLES.ADMIN.PROFESSOR:
        case ROLES.ADMIN.GTA:
          this.showSessions();
          break;
        case ROLES.UGTA:
          this.showSessionGroups();
          break;
        default:
          console.log("Invalid role: ", this.userRole)
      }
      
      this.initMenu();
      resolve("done");
    });
  }


  /* Displays all of the sessions that the user is responsible for */
  showSessions() {
    // convert to set to remove duplicates, then back to array
    var sessions = new Set(this.userInfo.Group.map(id => id.split('-')[0]));
    var sessionDivs = Array.from(sessions).map(sessionID => $('<div/>', {
      id: `${sessionID}`,
      class: `session card-item flexChildren`
    }).append($('<div/>', {
      class: `flexText header-font`,
      html: `Session ${sessionID}`
    })).click(evt => this.handleClickEvent($(evt.currentTarget))));

    this.addToParentById("content" /* parent container */, sessionDivs);
  }


  /* Displays all of the groups that the user is responsible for */
  showSessionGroups (sessionID=null) {
    var groups = (sessionID) ? this.userInfo.Group.filter(key => key.split('-')[0] == sessionID) : this.userInfo.Group;
    var groupDivs = groups.map(groupID => $('<div/>', {
      id: `${groupID}`,
      class: `session-group card-item flexChildren`
    }).append($('<div/>', {
      class: `flexText subheader-font subheader-color1`,
      html: `Session ${groupID.split('-')[0]}`
    }), $('<div/>', {
      class: `flexText header-font`,
      html: `Group ${groupID.split('-')[1]}`
    })).click(evt => this.handleClickEvent($(evt.currentTarget))));

    this.addToParentById("content" /* parent container */, groupDivs);
  }


  /* Displays all of the students in the group */
  showStudsInGroup (groupID) {
    var groupInfo = this.studInfo.filter(grp => grp.length > 0 && grp[0].Group == groupID)[0];
    if (groupInfo == undefined) { // no students in the selected group
      this.showNoStudLabel(groupID);
      return;
    }

    // hide contents until student images have all been loaded in
    this.state.imagesToLoad = groupInfo.length;
    this.showLoader();

    // include link to group evaluation form
    if (this.state.enableGroupEvaluations) {
      this.addGroupEvalLink(groupID);
      this.showGroupEvalLink();
    } else {
      this.hideGroupEvalLink(groupID);
    }

    var studDivs = groupInfo.map(student => $('<div/>', {
      id: `${student.NetID}`,
      class: `student subcard-item flexChildren`,
    }).append($('<img/>', {
      class: `profile`,
      // src: `images/${i.Name.replaceAll(' ','_').replaceAll('\'','-') + "," + i.SID}.jpg}` // students might have names with special characters
      src: `images/${student.Name},${student.SID}.jpg`,
      onload: () => this.handleImageLoaded(),
      // onerror: `this.src='images/no-image-available.jpg'` // alt image if none found
    }), $('<div/>', {
      class: `student-info flexText`
    }).append($('<label/>', {
      class: `subheader-width subheader-font`,
      html: `${student.Name}`
    }), $('<label/>', {
      class: `subheader-color2`,
      html: `NetID: ${student.NetID}`
    }))).click(evt => this.handleClickEvent($(evt.currentTarget))));

    this.addToParentById(groupID /* parent container */, studDivs);
  }


  /* Displays student questionnaire form */
  showStudForm (template, studentID) {
    // TODO: group evaluation div takes a while to disappear
    $('#group-evaluation-div').remove();
    this.addToParentById(studentID, this.makeForm("student", template));
  }


  /* Displays group evaluation questions and responses */
  showGroupForm (template, groupID) {
    $('#group-evaluation-div').remove();
    this.addToParentById(groupID, this.makeForm("group", template));
  }


  /* Creates and returns a questionnaire form using the given template */
  makeForm (type, template) {
    // console.log(type, template)
    var formType = (type == "student") ? "stud-eval" : "group-eval";
    var formElements = template.map((data, i) => $('<div/>', {
      id: `question-${i}`, // question-[questionID]
      class: `form-element ${data["Type"]}`
    }).append(...this.makeFormInput(`${formType}-${i}`, data)));

    var saveDiv = $('<div/>', {
      id: `form-save-div`
    }).append($('<label/>', { // initially hidden until user saves form
      id: `form-saved-label`,
      for: `form-save-button`,
      html: `All changes have been saved.`
    }).hide(), $('<button/>', {
      id: `form-save-button`,
      class: `save-button`,
      html: `Save`
    }).click(evt => this.handleSaveRequest()));

    var form = $('<form/>', {
      class: (type == "group") ? `group-form` : ``,
      onsubmit: "return false" /* call handler instead */
    });

    return form.append(formElements, saveDiv);
  }

  /* Constructs and returns a DOM element with the given data */
  makeFormInput (questionID, data) {
    const inputTypes = {
      "TB": "text",
      "TA": "textarea",
      "SC": "radio",
      "MC": "checkbox"
    };

    var question = data["Question"];
    var questionType = data["Type"];
    var options = data["Answer Choices"];
    // console.log(questionID, question, questionType, options)
    switch (questionType) {
      case "SC": case "MC":
        var optionElements = Object.values(options).map((opt, i) => {
          let input = $('<input/>', {
            id: `${questionID}-${i}`, // question-[questionID]-[optionNumber]
            type: inputTypes[questionType],
            name: `${questionID}`,
            checked: (opt == data["Value"])
          }).click(() => { this.setHasUnsavedChanges(true) });

          let label = $('<label/>', {
            class: `form-option`,
            for: `${questionID}-${i}`,
            html: `${opt}`
          });
          
          return input.add(label);
        });

        return $('<fieldset/>').append($('<legend>', {
          class: `question-label`,
          html: `${question}`
        }), optionElements);
      case "TA":
        let textarea = $('<textarea/>', {
          id: `${questionID}-${question}`
        }).change(() => { this.setHasUnsavedChanges(true); });
        textarea.html(data["Value"]);

        let label = $('<label/>', {
          class: `question-label`,
          for: `${questionID}-${question}`,
          html: `${question}`
        });

        return label.add(textarea);
      default:
        console.log("Unknown question type: ", questionType);
        return null;
    }
  }

  /* Creates and displays a modal in the foreground */
  makeModal (type) {
    const headerLabel = {
      "download": "Download Options",
      "clear": "Clear Options",
      "confirm-save": "Confirm Changes",
      "confirm-clear": "Confirm Clear"
    };
    const footerLabel = {
      "download": ["Download"],
      "clear": ["Clear"],
      "confirm-save": ["Save Changes", "Discard Changes"],
      "confirm-clear": ["Download then clear", "Clear without downloading"]
    }

    // Add modal header
    var modalHeader = $('<div/>', {
      class: 'modal-header',
      html: `${headerLabel[type]}`
    }).append($('<span/>', {
      class: 'modal-close-button',
      html: '&times;' // unicode char for 'x' symbol
    }).click(evt => this.handleModalCloseRequest()));
    
    // Add modal footer buttons
    var modalFooter = $('<div/>', {
      class: 'modal-footer',
    }).append($('<button/>', {
      class: 'modal-request-button',
      html: `${footerLabel[type][0]}`
    }).click(evt => this.handleModalSubmitRequest(type)));

    if (footerLabel[type].length > 1) {
      modalFooter.append($('<button/>', {
        class: 'modal-request-button',
        html: `${footerLabel[type][1]}`
      }).click(evt => this.handleModalCancelRequest()));
    }

    // Add modal body content
    var modalBody = $('<div/>', {
      class: 'modal-body'
    });

    switch(type) {
      case "download":
      case "clear":
        let optionAll = this.makeSelectionModal(type, "all", null);
        let optionGroups = this.makeSelectionModal(type, "session-group", this.userInfo.Group);
        if (this.userRole in ROLES.ADMIN) {
          let optionEvaluators = this.makeSelectionModal(type, "evaluator", this.userInfo.Evaluators);
          modalBody.append(optionAll, optionEvaluators, optionGroups);
        } else {
          modalBody.append(optionAll, optionGroups);
        }
        break 
      case "confirm-save":
      case "confirm-clear":
        let prompt = this.makeConfirmationModal(type);
        modalBody.append(prompt);
        break
      default:
        console.log("Unknown modal type: ", type)
        return;
    }

    // Glue together modal parts
    var modalDiv = $('<div/>', {
      id: `${type}-modal`,
      class: 'modal'
    }).append($('<div/>', {
      class: `modal-content ${(type.includes("confirm")) ? 'modal-content-short':''}`,
    }).append(modalHeader, modalBody, modalFooter));

    this.addToParentById('content' /* parent container */, modalDiv);
  }

  /* Constructs and returns a DOM element with the given data */
  makeSelectionModal (type, inputGroup, data) {
    // console.log(type, data)
    var sectionID = `section-${inputGroup}`;
    var capitalizeType = type.charAt(0).toUpperCase() + type.slice(1);

    var modalElem = $('<div/>', {
      id: `${sectionID}`,
      class: `modal-element`
    });

    var header = $('<label/>', {
      class: `modal-element-header`,
      html: `${capitalizeType} responses from selected ${inputGroup}(s)`
    });

    var selectAllInput = $('<input/>', {
      id: `${sectionID}-option-all`,
      type: `checkbox`,
      name: `${sectionID}`,
    }).change(evt => this.updateInputGroup(evt.currentTarget));
    var selectAllLabel = $('<label/>', {
      for: `${sectionID}-option-all`,
      html: (inputGroup == "all") ? `${capitalizeType} all responses` : 'Select/Unselect all<br>'
    });
    var selectAll = $('<div/>', {
      id: `${sectionID}-all`,
    }).append(selectAllInput, selectAllLabel);

    switch (inputGroup) {
      case "all":
        // TODO: add option to download group responses
        return modalElem.append(selectAll);
      case "evaluator":
        var evaluators = data.map(ta => {
          let evaluatorInput = $('<input/>', {
            id: `${sectionID}-option-${ta.NetID}`,
            class: `sub-option`,
            type: `checkbox`,
            name: `${sectionID}`
          }).change(evt => this.updateInputGroup(evt.currentTarget));
          let evaluatorLabel = $('<label/>', {
            for: `${sectionID}-option-${ta.NetID}`,
            html: `${ta.Name} [${ta.NetID}]<br>`
          });
          return $('<div/>', {
            id: `${sectionID}-${ta.NetID}`,
          }).append(evaluatorInput, evaluatorLabel);
        });

        return modalElem.append(header, selectAll, evaluators);
      case "session-group":
        let sessionIDs = Array.from(this.userInfo.Group, x => x.split('-')[0]);
        let uniqueSessionIDs = Array.from(new Set(sessionIDs));
        // console.log(uniqueSessionIDs)

        var sessionGroups = uniqueSessionIDs.map(sessionID => {
          let sessionInput = $('<input/>', {
            id: `section-session-option-${sessionID}`,
            class: `sub-option`,
            type: `checkbox`,
            name: `${sectionID}-${sessionID}`,
          }).change(evt => this.updateInputGroup(evt.currentTarget));
          let sessionLabel = $('<label/>', {
            for: `section-session-option-${sessionID}`,
            html: `Session ${sessionID}<br>`
          });

          let groups = data.filter(x => x.includes(sessionID)).map(groupID => {
            let groupInput = $('<input/>', {
              id: `section-group-option-${groupID}`,
              class: `sub-sub-option`,
              type: `checkbox`,
              name: `${sectionID}-${sessionID}`
            }).change(evt => this.updateInputGroup(evt.currentTarget));
            let groupLabel = $('<label/>', {
              for: `section-group-option-${groupID}`,
              html: `Group ${groupID}<br>`
            });
            return $('<div/>', { // initially hidden
              id: `section-group-${groupID}`
            }).append(groupInput, groupLabel).hide();
          });

          return $('<div/>', {
            id: `section-session-${sessionID}`
          }).append(sessionInput, sessionLabel, ...groups);
        });
        return modalElem.append(header, selectAll, sessionGroups);
      default:
        console.log("Unknown input group for modal construction: ", inputGroup)
        return;
    }
  }

  /*  */
  makeConfirmationModal (type) {
    const promptLabel = {
      "confirm-save": "There are <b><u>unsaved changes</u></b> on the page you are currently on. Would you like to save before returning to the previous page?",
      "confirm-clear": "This action will <b><u>delete all of the selected responses</u></b> from the database. Would you like to download those responses before clearing them?"
    };

    var modalElem = $('<div/>', {
      id: `${type}`,
      class: `modal-element`
    });

    switch (type) {
      case "confirm-save":
      case "confirm-clear":
        let prompt = $('<label/>', { html: `${promptLabel[type]}` });
        return modalElem.append(prompt);
      default:
        console.log("Unknown modal type for modal construction: ", type)
        return;
    }
  }


  /* Handles click event when a group is selected */
  handleClickEvent (clickedItem) {
    // console.log(clickedItem)
    clickedItem.off("click"); // removes click event listener to prevent registering multiple clicks

    var clickedID = clickedItem.attr("id");
    var clickedClass = clickedItem.attr("class").split(' ')[0];
    // console.log(clickedID, clickedClass);
    switch (clickedClass) {
      case "session":
        this.removeItemsByClass(clickedClass);
        this.showSessionGroups(clickedID);
        if (this.userRole in ROLES.ADMIN) {
          this.showBackBtn();
        }
        break
      case "session-group":
        let clickedSubheaderText = $(clickedItem.children()[0]);
        let clickedHeaderText = $(clickedItem.children()[1]);
        let text = clickedSubheaderText.html() + " | " + clickedHeaderText.html();
        clickedHeaderText.html(text);
        clickedHeaderText.addClass("header-width");
        clickedSubheaderText.remove();

        this.expandCardItem(clickedItem);
        this.removeItemsByClass(clickedClass, clickedID);
        this.showStudsInGroup(clickedID);
        this.showBackBtn();
        break
      case "student":
        let clickedProfile = $(clickedItem.children()[0]);
        // let clickedInfo = $(clickedItem.children()[1]);
        // console.log(clickedProfile, clickedInfo)
        clickedProfile.addClass("profile-left");

        this.expandCardItem(clickedItem);
        this.removeItemsByClass(clickedClass, clickedID);
        this.showBackBtn();

        // notify TAHelper that a student has been selected
        let groupID = $(clickedItem.parent()[0]).attr("id");
        $("#content").trigger('request:student-eval', [this.userInfo.NetID, groupID, clickedID]);
        break
      default:
        console.log("Invalid class: " + clickedClass)
    }
  }


  /* Handles click event for back button */
  handleBackRequest() {
    var selectedStudent = $('.selected-student');
    var selectedGroup = $('.selected-group');
    var selectedGrpID = selectedGroup.attr("id");
    // console.log(selectedStudent, selectedGroup, selectedGrpID)

    // determine which page to backtrack to
    if (selectedStudent.length == 0) {
      var selectedGroup = $('.selected-group');
      if (selectedGroup.length == 0) { // backing up from all groups to all sessions
        this.removeItemsByClass("session-group");
        this.showSessions();
        this.hideBackBtn();
      } else {
        // check for group evluation form
        var groupForm = $('.group-form');
        if (groupForm.length == 0) { // backing up from selected group to all groups
          selectedGroup.remove();
          if (!(this.userRole in ROLES.ADMIN)) {
            this.hideBackBtn();
            this.showSessionGroups();
          } else {
            var selectedSessionID = selectedGrpID.split('-')[0];
            this.showSessionGroups(selectedSessionID);
          }
        } else { // backing up from group evaluation form to students in selected group
          // ask for confirmation if unsaved changes are detected
          if (this.state.hasUnsavedChanges) {
            this.setWaitingOnSavePrompt(true);
            this.makeModal("confirm-save");
          } else {
            groupForm.remove();
            this.showStudsInGroup(selectedGrpID);
          }
        }        
      }
    } else { // backing up from selected student to students in selected group
      // ask for confirmation if unsaved changes are detected
      if (this.state.hasUnsavedChanges) {
        this.setWaitingOnSavePrompt(true);
        this.makeModal("confirm-save");
      } else {
        selectedStudent.remove();
        this.showStudsInGroup(selectedGrpID);
      }
    }
  }


  /* Handles click event for save button */
  handleSaveRequest() {
    if (!this.state.hasUnsavedChanges) { return; }

    // TODO: somehow this is being triggered when visible label is clicked
    $("#form-saved-label").hide(); // hides saved label until changes have been saved

    var changes = [];
    $('.form-element').map((_, question) => {
      var questionType = $(question).attr("class").split(' ')[1];
      switch (questionType) {
        case "SC": case "MC":
          let inputGroup = $(question).find("input");
          let inputGroupName = $(inputGroup[0]).attr("name");
          let checked = $(`input[type=radio][name=${inputGroupName}]:checked`).next().html();
          changes.push((checked != undefined) ? checked : "");
          break
        case "TA":
          let textarea = $(question).find("textarea");
          let text = textarea.val();
          changes.push(text);
          break
        default:
          console.log("Unknown question type: ", questionType);
          return;
      }
    });

    // add form details to data sent over to TAHelper
    var data = {"Details": null, "Response Data": changes};
    var selected = ($('.selected-student').length > 0) ? $('.selected-student') : $('.selected-group');
    var selectedID = selected.attr("id");
    var formType = selected.attr("class").split(' ')[0];

    if (formType == "student") {
      var groupID = selected.parent().attr("id");
      var group = this.studInfo.filter(grp => grp.filter(stud => stud.Group == groupID).length > 0)[0];
      var studDetails = group.filter(stud => stud.NetID == selectedID)[0];
      data["Details"] = {"Student Name": studDetails.Name};
    } else { // session-group
      formType = formType.split('-')[1];
      // data["Details"] = {"Group": selectedID};
    }

    // notify TAHelper that form has been changed and save request was made
    var evaluatorID = this.userInfo.NetID;
    if (formType == "student") {
      $('#content').trigger('request:save-eval', [formType, evaluatorID, groupID, selectedID, data]);
    } else { // session-group
      $('#content').trigger('request:save-eval', [formType, evaluatorID, selectedID, null, data]);
    }
  }


  /* Handles click event for group evaluation button */
  handleGroupEvalRequest (groupID) {
    $('.student').fadeOut(300 /* smooth animation */, () => {
      this.removeItemsByClass("student");
      $('#group-evaluation-div').addClass("group");
    });

    // notify TAHelper that user is requesting for the group evaluation form
    $('#content').trigger('request:group-eval', [this.userInfo.NetID, groupID]);
  }

  /*  */
  handleImageLoaded() {
    this.state.imagesLoaded++;
    if (this.state.imagesToLoad == this.state.imagesLoaded) {
      this.state.imagesToLoad = 0;
      this.state.imagesLoaded = 0;
      this.hideLoader();
    }
  }
  
  /*  */
  handleModalSubmitRequest (modalType) {
    return new Promise((resolve, _) => {
      switch (modalType) {
        case "clear":
          if (!this.state.waitingOnClearPrompt) {
            this.makeModal("confirm-clear");
            this.setWaitingOnClearPrompt(true);
            break;
          } // fall through intentional
        case "download":
          var data = {"Evaluators": [this.userInfo.NetID], "Groups": null};

          // prioritize select all options that are checked
          var checkedAll = $(`input[type=checkbox][name=section-all]:checked`);
          if (checkedAll.length > 0) {
            if (this.userRole in ADMIN.ROLES) {
              $('#content').trigger(`request:${modalType}-eval`, ["all", null]);
            } else {
              $('#content').trigger(`request:${modalType}-eval`, ["mix", data]);
            }
            break;
          }
  
          // find all modal options that are checked
          var checkedEvaluators = $(`input[type=checkbox][name=section-evaluator]:checked`);
          var checkedGroups = $(`input[type=checkbox][name*=section-session-group-]:not([id*=session]):checked`);
          // console.log(checkedEvaluators, checkedGroups)
          if (checkedEvaluators.length == 0 && checkedGroups.length == 0) { return; }
  
          if (checkedEvaluators.length > 0) {
            let checkedAll = checkedEvaluators.filter((_, checked) => $(checked).attr("id").endsWith("-all"));
            if (checkedAll.length > 0) {
              var allEvaluators = Object.values(this.userInfo.Evaluators).map(evaluator => evaluator.NetID);
              data["Evaluators"] = allEvaluators;
            } else {
              var evaluators = checkedEvaluators.map((_, evaluator) => $(evaluator).attr("id").split('-')[3]);
              data["Evaluators"] = Array.from(evaluators);
            }
          }
  
          if (checkedGroups.length > 0) {
            var groups = checkedGroups.map((_, group) => $(group).attr("id").split('-option-')[1]);
            data["Groups"] = Array.from(groups);
          }
  
          // notify TAHelper that a download or clear request has been made
          // console.log(data)
          $('#content').trigger(`request:${modalType}-eval`, ["mix", data]);
          break;
        case "confirm-save":
          this.handleSaveRequest();
          // cleanup handled by updateState(), called after save request is completed
          break;
        case "confirm-clear":
          // clear request is sent out after download request
          this.handleModalSubmitRequest("download").then(() => {
            this.handleModalSubmitRequest("clear").then(() => {
              this.handleModalCloseRequest();
            });
          });
          break;
        default:
          console.log("Unknown modal type: ", modalType)
          break;
      }

      resolve("done");
    });
  }

  /*  */
  handleModalCancelRequest() {
    if (this.state.waitingOnSavePrompt) {
      this.setHasUnsavedChanges(false);
      this.handleBackRequest();
    } else if (this.state.waitingOnClearPrompt) {
      this.handleModalSubmitRequest("clear"); // this time, passes through the if case in the handler
    }

    this.handleModalCloseRequest();
  }

  /* Handles click event for modal close button */
  handleModalCloseRequest() {
    var modals = $('[id$=-modal]');
    if (modals.length > 0) {
      var topLevelModal = modals[modals.length-1];
      var topLevelID = $(topLevelModal).attr("id");
      if (topLevelID.includes("confirm")) {
        var confirmType = topLevelID.split('-')[1];
        switch (confirmType) {
          case "save":
            this.setWaitingOnSavePrompt(false);
            break 
          case "clear":
            this.setWaitingOnClearPrompt(false);
            break
          default:
            console.log("Unknown confirmation modal type: ", confirmType)
            return;
        }
      }
      topLevelModal.remove(); // only close the top-level modal
    }
  }

  /*  */
  updateInputGroup (inputElem) {
    var optionClass = inputElem.getAttribute("class");
    var inputGroup = inputElem.name;
    var isChecked = inputElem.checked;
    // console.log(inputElem, optionClass, inputGroup, isChecked)
    switch (optionClass) {
      case null: // select all option
        if (inputGroup.includes("session-group")) {
          // need to manually select all group options, change event not propagating dynamically
          let sessionIDs = Array.from(this.userInfo.Group, x => x.split('-')[0]);
          let uniqueSessionIDs = Array.from(new Set(sessionIDs));
          uniqueSessionIDs.map(sessionID => this.selectAll(`${inputGroup}-${sessionID}`, isChecked));
          
          // show group options once checked at least once
          if (isChecked) {
            let sessionDivs = $(inputElem).parent().siblings().slice(1); // ignore header label
            sessionDivs.each((_, session) => {
              let groupDivs = $(session).children ().slice(2); // ignore select all input and label
              groupDivs.each((_, group) =>  $(group).show());
            });
          }
        } else {
          this.selectAll(inputGroup, isChecked);
        }
        break
      case "sub-option": 
        if (inputGroup.includes("session-group")) {
          // show group options once checked at least once
          let groupDivs = $(inputElem).siblings().slice(1);
          groupDivs.each((_, group) => $(group).show());

          // uncheck select all option if at least one option is unchecked
          this.selectAll(inputGroup, isChecked);
          this.uncheckSelectAll(inputGroup.slice(0, -2), "-all"); // drop session ID
        } else {
          if (!isChecked) {
            this.uncheckSelectAll(inputGroup, "-all");
          }
        }
        break
      case "sub-sub-option":
        if (inputGroup.includes("session-group")) {
          this.uncheckSelectAll(inputGroup);
        }
        break
      default:
        console.log("Unknown modal input class: ", optionClass)
        return;
    }
  }

  /* Adds a group evaluation link to the selected group page */
  addGroupEvalLink (groupID) {
    var grpEvalLink = $('<a/>', {
      href: `#`,
      id: `group-evaluation-link`,
      html: `Add a Group Evaluation`
    }).click(evt => this.handleGroupEvalRequest(groupID));

    var grpEvalDiv = $('<div/>', {
      id: `group-evaluation-div`
    }).hide(); // initially hidden

    grpEvalDiv.append(grpEvalLink);
    this.addToParentById(`${groupID}`, grpEvalDiv);
  }

  /* Adds a back button to the top of the page */
  addBackBtn() {
    var backBtn = $('<button/>', { // initially hidden
      id: 'backBtn',
      class: `menu-button`,
      html: 'Back'
    }).click(evt => this.handleBackRequest()).hide();

    this.addToParentById('left-menu' /* parent container */, backBtn);
  }

  /* Adds a dropdown menu to the page */
  addDropdownMenu() {
    var drpdwnBtn = $('<button/>', {
      id: 'dropdownBtn',
      class: `menu-button`,
      html: 'Menu'
    });
    var drpdwnMenu = $('<div/>', {
      id: 'dropdownMenu',
      class: 'dropdown-content'
    });

    var downloadBtn = $('<button/>', {
      id: 'download-responses-button',
      class: 'download-button',
      title: 'Download responses in CSV format',
      html: 'Download Responses'
    }).click(evt => this.makeModal("download"));
    var clearBtn = $('<button/>', {
      id: 'clear-responses-button',
      class: 'clear-button',
      title: 'Clear responses in database',
      html: 'Clear Responses'
    }).click(evt => this.makeModal("clear"));

    if (this.userRole in ROLES.ADMIN) {
      drpdwnMenu.append(downloadBtn, clearBtn);
    } else {
      drpdwnMenu.append(downloadBtn);
    }

    this.addToParentById('right-menu' /* parent container */, drpdwnBtn);
    this.addToParentById('right-menu' /* parent container */, drpdwnMenu);
  }

  /* */
  showLoader() { $(".loader").fadeIn('fast'); }
  hideLoader() { $(".loader").fadeOut(); }
  
  /*  */
  showGroupEvalLink() { $("group-evaluation-div").show(); }
  hideGroupEvalLink() { $("group-evaluation-div").hide(); }

  /* Notifies the user that there are no students in the selected group */
  showNoStudLabel (groupID) { 
    var noStudLabel = $('<label/>', {
      id: `no-students-label`,
      html: `No students in this group`
    });
    this.addToParentById(`${groupID}`, noStudLabel);
  }

  /* Notifies the user that form has been saved to database */
  showSavedLabel() { $("#form-saved-label").show(); }

  /* Turns back button visible or invisible */
  showBackBtn() { $('#backBtn').show(); }
  hideBackBtn() { $('#backBtn').hide(); }

  /* Turns left menu button visible or invisible */
  showDropdownBtn() { $('#dropdownBtn').show(); }
  hideDropdownBtn() { $('#dropdownBtn').hide(); }

  /* Turns download button visible or invisible */
  showDownloadAllBtn() { $('#dwnAllBtn').show(); }
  hideDownloadAllBtn() { $('#dwnAllBtn').hide(); }

  /* Turns download button visible or invisible */
  showDownloadTABtn() { $('#dwnTABtn').show(); }
  hideDownloadTABtn() { $('#dwnTABtn').hide(); }

  /* Turns download button visible or invisible */
  showDownloadGroupBtn() { $('#dwnGroupBtn').show(); }
  hideDownloadGroupBtn() { $('#dwnGroupBtn').hide(); }

  /* Adds child to parent div specified by ID */
  addToParentById (divID, child) {
    $(`#${divID}`).append(child);
  }

  /* Adds child to parent div specified by class */
  addToParentByClass (divClass, child) {
    $(`.${divClass}`).append(child);
  }

  /* Removes all items with the same class name. An optional argument for an exception can be provided. */
  removeItemsByClass (className, exceptID=null) {
    // console.log(exceptID)
    for (var i of $(`.${className}`)) {
      if ( $(i).attr("id") != exceptID) {
        $(i).remove();
      }
    }
  }

  /* Expands selected item to window size and hide all other items in same class */
  expandCardItem (item) {
    item.parent().animate({ display: "block" });
    item.removeClass("flexChildren").addClass("flexContainer");
    item.animate({ height: "100%" });

    // var itemID = item.attr("id");
    var itemClass = item.attr("class").split(" ")[0];
    switch (itemClass) {
      case "session-group":
        item.addClass("selected-group");
        break;
      case "student":
        item.addClass("selected-student");
        break;
      default:
        console.log("Unexpected call for expandCardItem() on HTML DOM element with class: ", itemClass);
        return;
    }
  }

  /* Unchecks a 'Select All' input for a name group */
  uncheckSelectAll (inputGroup, append=null) {
    var selectAll = $(`input[type=checkbox][name=${inputGroup}]${(append != null) ? `[id$=${append}]`:''}`)[0];
    selectAll.checked = false;
  }

  /* Checks or unchecks all checkbox inputs that belong to a name group with a specific id */
  selectAll (inputGroup, isChecked) {
    $(`input[type=checkbox][name=${inputGroup}]`).each((_, option) => {
      option.checked = isChecked;
    });
  }

}
