from pydoc import HTMLRepr
from bs4 import BeautifulSoup
import re
import glob
import hashlib
import os
import shutil;
from PIL import Image
tmp="Temp"
blankImage="no-image.png"
img = Image.new("RGB", (800, 1280), (255, 255, 255))
img.save("%s" %(blankImage), "PNG")
if not os.path.exists(tmp):
    os.makedirs(tmp)
def hashSID(id):
    return hashlib.sha256(id).hexdigest()
htmlFiles= glob.glob('*.html')
for htmlFile in htmlFiles:
    #print (htmlFile)
    resourceDir="%s_files" % htmlFile.split(".html")[0]

    with open("%s/SA_LEARNING_MANAGEMENT.SS_FACULTY.html" % resourceDir ) as x: html = x.read()
    soup = BeautifulSoup(html,"html.parser")
    solarIDspan =  soup.find_all("span",{"id":re.compile("MAIN_EMPLID")})
    solarID =[i.encode_contents() for i in solarIDspan]
    firstLastNameSpan =  soup.find_all("span",{"id":re.compile("MAIN_SNAME")})

    firstLastName =[i.encode_contents() for i in firstLastNameSpan]
    imageSrc=[]
    imageDiv =  soup.find_all("div",{"id":re.compile("EMPL_PHOTO_EMPLOYEE_PHOTO")})
    print (firstLastName)
    for i in imageDiv:
        imgTag= i.find("img")
        if not imgTag:
            src=blankImage #"%s/%s" %(resourceDir,blankImage)
        else:
            src="%s/%s" %(resourceDir,imgTag['src'].split("/")[1])
        imageSrc.append(src)
    
    for i in range(len(solarID)):
     
        name= firstLastName[i].strip().decode("utf-8", "replace")
        sid = solarID[i] #.strip().decode("utf-8", "replace")
        print (name,sid)
        hashedSID =  hashSID(sid)
        shutil.copyfile(imageSrc[i], "./Temp/%s,%s.jpg" % (name, hashedSID))