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

  logger.info(`#-#-#-#-#-#-# INICIO DO PROCESSO #-#-#-#-#-#-#`);

  await Promise.all(
    ["101-103", "701-781", "901"].map((dir) =>
      createDirectoryIfNotExists(resolve(outputDirEvents, dir))
    )
  );

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
    const cpfSecondEvent =
      searchAtributeValue(secondEvent, "cpfTrab") ??
      searchAtributeValue(secondEvent, "cpfBenef");
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
    const fileContents = new Map();

    // Aplicando async.mapLimit
    await async.mapLimit(files, 5, async (file) => {
      const filePath = resolve(inputDirEvents, file);
      if (await validateFileDir(filePath)) {
        const xml = await fs.readFile(filePath, "utf-8");
        const event = await parser.parseString(xml);
        fileContents.set(file, event);
      }
    });

    for (const [file, event] of fileContents) {
      logger.info(`------- INICIOU PROCESSO NO ARQUIVO: ${file} -------`);

      if (!isAdmission(event)) {
        logger.info(`------- O ARQUIVO: ${file} NÃO É ADMISSÃO -------`);
        continue;
      }

      const category = findCategory(event);
      const directorySended = returnDirToCategory(category);

      for (const [secondFile, secondEvent] of fileContents) {
        if (file === secondFile) continue;

        if (!isAdmission(secondEvent) && matchCpf(event, secondEvent)) {
          await moveFile(
            resolve(inputDirEvents, secondFile),
            resolve(directorySended, secondFile)
          );
          logger.info(
            `------- SEGUNDO ARQUIVO: ${secondFile} MOVIDO PARA ${directorySended} -------`
          );
        }
      }

      await moveFile(
        resolve(inputDirEvents, file),
        resolve(directorySended, file)
      );
      logger.info(
        `------- ARQUIVO ADMISSAO: ${file} FOI MOVIDO PARA A PASTA DE SAIDA -------`
      );
    }
  } catch (error) {
    logger.error(`ERRO AO AGRUPAR CATEGORIAS:`, error);
  }

  logger.info(`#-#-#-#-#-#-# FIM DO PROCESSO #-#-#-#-#-#-#`);
};
