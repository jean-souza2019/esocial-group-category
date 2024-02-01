const fs = require("node:fs").promises;
const { resolve } = require("node:path");
const xml2js = require("xml2js");
const async = require("async");
const logger = require("./shared/logger");

const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });

module.exports = async function groupCategories(inputDir, outputDir) {
  const inputDirEvents = resolve(inputDir);
  const outputDirEvents = resolve(outputDir);
  
  const moveFile = async (inputDir, outputDir) => {
    try {
      await fs.rename(inputDir, outputDir);
    } catch (err) {
      logger.error(err);
    }
  };

  const validateFileDir = async (path) => {
    try {
      await fs.access(path);
      return true;
    } catch (error) {
      return false;
    }
  };

  const createDirectoryIfNotExists = async (directory) => {
    try {
      if (!(await validateFileDir(directory))) {
        await fs.mkdir(directory, { recursive: true });
      }
    } catch (err) {
      logger.error(err);
    }
  };

  logger.info(
    `----------------------------------------------------------------------------------------------------`
  );
  logger.info(`#-#-#-#-#-#-# INICIO DO PROCESSO #-#-#-#-#-#-#`);

  await Promise.all(
    ["101-103", "701-781", "901"].map((dir) =>
      createDirectoryIfNotExists(resolve(outputDirEvents, dir))
    )
  );

  const findCategory = (event, typeEvent) => {
    if (typeEvent === '2300') {
      return (
        event?.eSocial?.retornoProcessamentoDownload?.evento?.eSocial
          ?.evtTSVInicio?.infoTSVInicio?.codCateg ??
        event?.eSocial?.retornoProcessamentoDownload?.recibo?.eSocial
          ?.retornoEvento?.recibo?.contrato?.infoContrato?.codCateg ??
        null
      );
    }
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

  const is2300 = (event) => {
    return event?.eSocial?.evtTSVInicio
      ? true
      : event?.eSocial?.retornoProcessamentoDownload?.evento?.eSocial
          ?.evtTSVInicio
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

  const matchCpf = (cpfEvent, cpfSecondEvent, subscriptionSecondEvent) => {
    if (cpfSecondEvent !== undefined && cpfSecondEvent == cpfEvent) {
      return true;
    } else {
      if (
        subscriptionSecondEvent !== undefined &&
        subscriptionSecondEvent == cpfEvent
      ) {
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
    const fileContents = new Map();
    const fileAdmission2300Contents = new Map();
    let fileLength = 0;
    let fileReadingLength = 0;

    await async.mapLimit(files, 20, async (file) => {
      const filePath = resolve(inputDirEvents, file);
      if (await validateFileDir(filePath)) {
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
        const isAddmissionEvent = isAdmission(event);
        const is2300Event = is2300(event);
        const typeEvent = isAddmissionEvent ? 'admissao' : is2300Event ? '2300' : null 
        const category = findCategory(event, typeEvent);
        const newEvent = {
          category,
          isAddmissionEvent,
          is2300Event,
        };

        if (isAddmissionEvent || is2300Event) {
          const cpfEvent = searchAtributeValue(event, "cpfTrab");
          newEvent.cpfEvent = cpfEvent;

          fileAdmission2300Contents.set(file, newEvent);
          // logger.info(`------- O ARQUIVO: ${file} É ${isAddmissionEvent ? 'ADMISSÃO' : '2300'} -------`);
        } else {
          const cpfEvent =
            searchAtributeValue(event, "cpfTrab") ??
            searchAtributeValue(event, "cpfBenef");
          const subscriptionEvent = searchAtributeValue(event, "nrInsc");

          newEvent.cpfEvent = cpfEvent;
          newEvent.subscriptionEvent = subscriptionEvent;

          fileContents.set(file, newEvent);
          // logger.info(`------- O ARQUIVO: ${file} NÃO É ADMISSÃO -------`);
        }

        fileLength += 1;
        logger.info(
          `******* LEITURA TOTAL DE ARQUIVOS: ${fileLength} *******`
        );
      }
    });

    for (const [fileName, event] of fileAdmission2300Contents) {
      // logger.info(`------- INICIOU PROCESSO NO ARQUIVO: ${file} -------`);

      const directorySended = returnDirToCategory(event.category);
      
      fileReadingLength += 1;

      if (event.isAddmissionEvent) {
        for (const [secondFileName, secondEvent] of fileContents) {
          if (
            matchCpf(
              event.cpfEvent,
              secondEvent.cpfEvent,
              secondEvent.subscriptionEvent
            )
          ) {
            await moveFile(
              resolve(inputDirEvents, secondFileName),
              resolve(directorySended, secondFileName)
            );
            // logger.info(
            //   `------- SEGUNDO ARQUIVO: ${secondFile} MOVIDO PARA ${directorySended} -------`
            // );
            fileContents.delete(secondFileName);
            fileReadingLength += 1;
          }
        }
      }

      await moveFile(
        resolve(inputDirEvents, fileName),
        resolve(directorySended, fileName)
      );
      // logger.info(
      //   `------- ARQUIVO ${event.isAddmissionEvent ? 'ADMISSÃO' : '2300'}: ${file} FOI MOVIDO PARA A PASTA DE SAIDA -------`
      // );
      fileAdmission2300Contents.delete(fileName);

      logger.info(
        `******* PROCESSAMENTO TOTAL DE ARQUIVOS: ${fileReadingLength} *******`
      );
    }
  } catch (error) {
    logger.error(`ERRO AO AGRUPAR CATEGORIAS:`, error);
  }

  logger.info(`#-#-#-#-#-#-# FIM DO PROCESSO #-#-#-#-#-#-#`);
};
