const fs = require("node:fs");
const { resolve } = require("node:path");
const xml2js = require("xml2js");
const mkdirp = require("mkdirp");

const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });

// const inputDirEvents = resolve(__dirname, "events", "input");
// const outputDirEvents = resolve(__dirname, "events", "output");
module.exports = function groupCategories(inputDirEvents, outputDirEvents) {
  const moveFile = (inputDir, outputDir) => {
    fs.rename(inputDir, outputDir, (err) => {
      if (err) {
        console.error(err);
      }
    });
  };

  const createDirectoryIfNotExists = (directory) => {
    if (!fs.existsSync(directory)) {
      mkdirp.sync(directory);
    }
  };

  console.log(`#-#-#-#-#-#-# INITIAL PROCESS GROUP BY CATEGORY #-#-#-#-#-#-#`);

  [
    resolve(outputDirEvents, "101-103"),
    resolve(outputDirEvents, "701-781"),
    resolve(outputDirEvents, "901"),
  ].map((directory) => {
    createDirectoryIfNotExists(directory);
  });

  const findCategory = (event) => {
    return event?.eSocial?.evtAdmissao?.vinculo?.infoContrato?.codCateg ?? null;
  };

  const isAdmission = (event) => {
    return event?.eSocial?.evtAdmissao ? true : false;
  };

  const returnDirToCategory = (category) => {
    switch (true) {
      case category >= 101 && category <= 103:
        return resolve(outputDirEvents, "101-103");
      case category >= 701 && category <= 781:
        return resolve(outputDirEvents, "701-781");
      case category == 901:
        return resolve(outputDirEvents, "901");
      default:
        return resolve(outputDirEvents, "others");
    }
  };

  const matchCpf = (event, secondEvent) => {
    const cpfEvent = searchAtributeValue(event, "cpfTrab");
    const cpfSecondEvent = searchAtributeValue(secondEvent, "cpfTrab");
    const inscSecondEvent = searchAtributeValue(secondEvent, "nrInsc");

    if (cpfSecondEvent != undefined && cpfSecondEvent == cpfEvent) {
      return true;
    } else {
      if (inscSecondEvent != undefined && inscSecondEvent == cpfEvent) {
        return true;
      }
    }
    return false;
  };

  const searchAtributeValue = (object, keyFind) => {
    for (let key in object) {
      if (key === keyFind) {
        return object[key];
      } else if (typeof object[key] === "object") {
        const result = searchAtributeValue(object[key], keyFind);
        if (result !== undefined) return result;
      }
    }
  };

  fs.readdirSync(inputDirEvents).forEach((file) => {
    if (fs.existsSync(resolve(inputDirEvents, file))) {
      console.log(`------- START PROCCESS FILE: ${file} -------`);

      const xml = fs.readFileSync(resolve(inputDirEvents, file), "utf-8");

      let jsonXmlFile;
      parser.parseString(xml, (err, result) => {
        if (err) {
          console.error(err);
          return;
        }

        jsonXmlFile = JSON.stringify(result, null, 2);
      });

      const event = JSON.parse(jsonXmlFile);

      if (isAdmission(event)) {
        const category = findCategory(event);
        const directorySended = returnDirToCategory(category);

        fs.readdirSync(inputDirEvents).forEach((secondFile) => {
          const xml = fs.readFileSync(
            resolve(inputDirEvents, secondFile),
            "utf-8"
          );

          let jsonXmlFile;
          parser.parseString(xml, (err, result) => {
            if (err) {
              console.error(err);
              return;
            }

            jsonXmlFile = JSON.stringify(result, null, 2);
          });

          const secondEvent = JSON.parse(jsonXmlFile);

          if (!isAdmission(secondEvent) && matchCpf(event, secondEvent)) {
            moveFile(
              resolve(inputDirEvents, secondFile),
              resolve(directorySended, secondFile)
            );
          }
        });
        moveFile(resolve(inputDirEvents, file), resolve(directorySended, file));
      }

      console.log(`------- FINISH VALIDATE FILE: ${file} -------`);
    }
  });
  console.log(`#-#-#-#-#-#-# FINISH PROCESS GROUP BY CATEGORY #-#-#-#-#-#-#`);
};
