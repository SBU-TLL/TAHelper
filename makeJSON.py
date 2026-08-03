import httplib2
import os
import sys
import json
import hashlib
from  googleapiclient import discovery
from google.oauth2 import service_account
from datetime import datetime
# os.chdir(os.path.dirname(sys.argv[0]))
# jsonPath = "/home/tltmedia/TAHelper/json/"

jsonFile = sys.argv[1]
jsonPath = f'/home/tltsecure/apache2/htdocs/{jsonFile}/TAHelper/json/'
dataFile = jsonPath +  "data.json"
templateFile = jsonPath + "templates.json"
logFile=jsonPath + "log.json"
if jsonFile == "BIO201":
        spreadsheet_id = '1XeDA3TBySqsxHoARclYosenT4iD-0KCpjz_pY8FMVMc'
elif jsonFile == "BIO354":
        spreadsheet_id = '1etbhipm05Wp6WSdAISXBe9-b_2bgynyMk-xf8-0NYUU'

try:
        scopes = ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/spreadsheets"]
        secret_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'client_secret.json')
        credentials = service_account.Credentials.from_service_account_file(secret_file, scopes=scopes)
        service = discovery.build('sheets', 'v4', credentials=credentials)

        # spreadsheet_id = '1RKqbw8S8wrfkD8_MQgU1XwFvpbhj-IRcVZ0FZtK6r5I'
        sheetService = service.spreadsheets()
        sheet_metadata = sheetService.get(spreadsheetId=spreadsheet_id).execute()
        sheets = sheet_metadata.get('sheets', '')

        adminRoles = ["Professor", "GTAs"]
        allData = {"TA Groups": {},"Section Info":{"Section":{}}, "Student Groups": {}}
        allTAs = list()
        allGroups = set()
        for sheetName in allData.keys():
                sheet = sheetService.values().get(spreadsheetId=spreadsheet_id,range=sheetName).execute()
                vals = sheet["values"][1:]
                header = sheet["values"][0]
                print(sheet)
                for i in vals:
                        #session = i[header.index("Section")].strip()
                        #group = i[header.index("Group")].strip()
                        #groupID = session + '-' + group
                        #allGroups.add(groupID)

                        if sheetName == "Section Info":
                                sectionID = i[header.index("Section")].strip()
                                time = i[header.index("Time")].strip()
                                allData[sheetName]["Section"][sectionID]=time
                                continue
                        else:
                                fullName = (i[header.index("First Name")].strip() + " " + i[header.index("Last Name")].strip())
                                netID = i[header.index("NetID")].strip()



                        if sheetName == "Student Groups":
                                sid = i[header.index("Student ID")].strip()
                                hashedSID = hashlib.sha256(sid.encode('utf-8')).hexdigest() # hashes student IDs
                                key = hashedSID
                                warning = i[header.index("Warning")].strip()
                                #print (i[header.index("Warning")])
                        else: # TA Groups
                                role = i[header.index("Type")].strip()
                                key = netID
                        if not key in allData[sheetName].keys():
                                allData[sheetName][key] = {"Name": fullName, "NetID": netID, "Group": [],"GTAGroups":[]}
                                if sheetName == "Student Groups":
                                        allData[sheetName][key]["Warning"] =warning
                                        allData[sheetName][key]["SID"] = hashedSID
                                else: # TA Groups
                                        allTAs.append({"Name": fullName, "NetID": netID})
                                        allData[sheetName][key]["Type"] = role
                                        if role in adminRoles and not "Hybrid" in allData[sheetName][key]:
                                                continue # skip populating group data until end of loop
                        else:
                                try:
                                        if allData[sheetName][key]["Type"] != i[header.index("Type")].strip():
                                                alData[sheetName][key]["Hybrid"]=True
                                except:
                                        hybridNOP=True
                        session = i[header.index("Section")].strip()
                        group = i[header.index("Group")].strip()
                        groupID = session + '-' + group
                        allGroups.add(groupID)

                        if sheetName == "Student Groups":
                                allData[sheetName][key]["Group"] = groupID
                        else: # TA Groups
                                #allData[sheetName][key]["Group"].append
                                if  "Hybrid" in allData[sheetName][key]:
                                        allData[sheetName][key]["GTAGroups"].append(groupID)
                                allData[sheetName][key]["Group"].append(groupID)
                        #       #allData[sheetName][key]["Type"].append(role)


        allTemplates = {"Student Evaluation": [], "Group Evaluation": []}
        for sheetName in allTemplates.keys():
                sheet = sheetService.values().get(spreadsheetId=spreadsheet_id,range=sheetName).execute()
                vals = sheet["values"][1:]
                header = sheet["values"][0]
                for i in vals:
                        question = i[header.index("Question")].strip()
                        questionType = i[header.index("Type")].strip()
                        default=""
                        if questionType == "TA" or questionType == "TB":
                                choices = []
                        else: # SC or MC type question
                                choices = i[header.index("Answer Choices")].strip().split(',')
                                if len(i)-1 >= header.index("Default"):
                                        default=  i[header.index("Default")]
                        # print(question, inputType, choices)
                        entry={"Type": questionType, "Question": question,"Answer Choices": choices}
                        if default!="":
                                entry["Default"]= default
                        allTemplates[sheetName].append(entry)

        sortFunc = lambda e : e["NetID"]
        allTAs.sort(key=sortFunc)

        allGroups = list(allGroups)
        print(allGroups)
        sortFunc = lambda e : int(e.split('-')[1]) # first sort by group ids (numerical)
        allGroups.sort(key=sortFunc)
        sortFunc = lambda e : e.split('-')[0] # then sort by sessions (alphabetic)
        allGroups.sort(key=sortFunc)
        #print(allTAs, allGroups)

        # Admin roles should be able to access all students and TAs (evaluators)
        for i in allData["TA Groups"].values():
                role = i["Type"]
                if role in adminRoles:
                        i["Group"] = allGroups
                        i["Evaluators"] = allTAs

        # print(allData)
        with open(dataFile, 'w') as f:
                f.writelines(json.dumps(allData, sort_keys=True, indent=4, separators=(',', ': ')))

        # print(allTemplates)
        with open(templateFile, 'w') as f:
                f.writelines(json.dumps(allTemplates, sort_keys=True, indent=4, separators=(',', ': ')))

        now = datetime.now()
        dt_string = now.strftime("%d/%m/%Y %H:%M:%S")
        with open(logFile, 'w') as f:
                f.writelines(json.dumps({'lastImport':dt_string}, sort_keys=True, indent=4, separators=(',', ': ')))
        print("Done")


except OSError as e:
        print(e)