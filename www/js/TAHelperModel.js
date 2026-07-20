/* JavaScript file for handling data in TAHelper */

class TAHelperModel {
  constructor (courseInfo, loginInfo) {
    this.courseInfo = courseInfo;
    this.loginInfo = loginInfo;
    // console.log(this.courseInfo, this.loginInfo)
  }

  /* Returns the name of the user currently logged in */
  getLoginName() {
    return `${this.loginInfo.nickname} ${this.loginInfo.sn}`;
  }

  /* Returns the netID of the user currently logged in */
  getLoginID() {
    return this.loginInfo.cn;
  }

  /* Returns information on all of the evaluators in the course */
  getAllTAs() {
    return this.courseInfo["TA Groups"];
  }

  /* Returns information on all of the students in the course */
  getAllStuds() {
    return this.courseInfo["Student Groups"];
  }

  /* Returns data on the student evaluation form template */
  getStudEvalTemplate() {
    return this.courseInfo["Student Evaluation Template"];
  }

  /* Returns data on the group evaluation form template */
  getGroupEvalTemplate() {
    return this.courseInfo["Group Evaluation Template"];
  }

  /* Returns user information for a specific user */
  getUserInfo (username) {
    return this.courseInfo["TA Groups"][username];
  }

  /* Returns the user role for a specific user */
  getUserRole (username) {
    return this.getUserInfo(username)["Type"];
  }

  /* Returns information on all of the groups that the user oversees */
  getUserGroups (username) {
    return this.getUserInfo(username)["Group"];
  }

  /* Returns array of all of the students in the group */
  getAllStudsInGroup (groupID) {
    var students = this.getAllStuds();
    return Object.values(students).filter(studInfo => { return studInfo.Group == groupID });
      // .map(key => Object.assign(students[key], {hexID: key}));
  }

  /* Return array of all of the students in the groups that the user is responsible for */
  getAllStudsForUser (username) {
    var userGroups = this.getUserGroups(username);
    return userGroups.map(group => this.getAllStudsInGroup(group));
  }
  
}
