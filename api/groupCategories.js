const fs = require("node:fs").promises;
const { resolve } = require("node:path");
const xml2js = require("xml2js");

const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });

module.exports = async function groupCategories(inputDir, outputDir) {
  const inputDirEvents = resolve(inputDir);
  const outputDirEvents = resolve(outputDir);
  const moveFile = async (inputDir, outputDir) => {
    try {
      await fs.rename(inputDir, outputDir);
    } catch (err) {
      console.error(err);
    }
  };

  const validateFileDir = async (caminho) => {
    try {
      await fs.access(caminho);
      return true;
    } catch (error) {
      return false;
    }
  };

  const createDirectoryIfNotExists = async (directory) => {
    try {
      if (!(await validateFileDir(directory))) {
        // await mkdirp(directory);
        await fs.mkdir(directory, { recursive: true });
      }
    } catch (err) {
      console.error(err);
    }
  };

  console.log(`#-#-#-#-#-#-# INITIAL PROCESS GROUP BY CATEGORY #-#-#-#-#-#-#`);

  [
    resolve(outputDirEvents, "101-103"),
    resolve(outputDirEvents, "701-781"),
    resolve(outputDirEvents, "901"),
  ].forEach(async (directory) => {
    await createDirectoryIfNotExists(directory);
  });

  const findCategory = (event) => {
    return (
      event?.eSocial?.evtAdmissao?.vinculo?.infoContrato?.codCateg ??
      event?.eSocial?.retornoProcessamentoDownload?.evento?.eSocial?.evtAdmissao
        ?.vinculo?.infoContrato?.codCateg ??
      null
    );
  };

  const isAdmission = (event) => {
    return event?.eSocial?.evtAdmissao
      ? true
      : event?.eSocial?.retornoProcessamentoDownload?.evento?.eSocial
          ?.evtAdmissao
      ? true
      : false;
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

    if (cpfSecondEvent !== undefined && cpfSecondEvent == cpfEvent) {
      return true;
    } else {
      if (inscSecondEvent !== undefined && inscSecondEvent == cpfEvent) {
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

  try {
    const files = await fs.readdir(inputDirEvents);

    for (const file of files) {
      const filePath = resolve(inputDirEvents, file);

      if (await validateFileDir(filePath)) {
        console.log(`------- START PROCCESS FILE: ${file} -------`);

        try {
          const xml = await fs.readFile(filePath, "utf-8");
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
            console.log(`------- File is admission!: ${file} -------`);
            const category = findCategory(event);
            console.log(
              `------- File: ${file}  category: ${JSON.stringify(
                category
              )}-------`
            );

            const directorySended = returnDirToCategory(category);

            const secondFiles = await fs.readdir(inputDirEvents);

            for (const secondFile of secondFiles) {
              const secondFilePath = resolve(inputDirEvents, secondFile);
              const secondXml = await fs.readFile(secondFilePath, "utf-8");

              let jsonSecondXmlFile;
              parser.parseString(secondXml, (err, result) => {
                if (err) {
                  console.error(err);
                  return;
                }
                jsonSecondXmlFile = JSON.stringify(result, null, 2);
              });

              const secondEvent = JSON.parse(jsonSecondXmlFile);

              if (!isAdmission(secondEvent) && matchCpf(event, secondEvent)) {
                await moveFile(
                  secondFilePath,
                  resolve(directorySended, secondFile)
                );
                console.log(
                  `------- Second File!: ${secondFile} moved to ${secondFilePath} -------`
                );
              } else {
                console.log(
                  `------- Second File!: ${secondFile} is not moved -  match cpf? ${matchCpf(
                    event,
                    secondEvent
                  )} -------`
                );
              }
            }

            await moveFile(filePath, resolve(directorySended, file));

            console.log(
              `------- File admission moved to output path!: ${file} -------`
            );
          } else {
            console.log(`------- File is not admission!: ${file} -------`);
          }

          console.log(`------- FINISH VALIDATE FILE: ${file} -------`);
        } catch (error) {
          console.log(error);
        }
      } else {
        console.log(`this file ${file} is not accesible`);
      }
    }
  } catch (error) {
    console.error(error);
  }

  console.log(`#-#-#-#-#-#-# FINISH PROCESS GROUP BY CATEGORY #-#-#-#-#-#-#`);
};
