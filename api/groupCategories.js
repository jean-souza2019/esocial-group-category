const fs = require("node:fs").promises;
const { resolve } = require("node:path");
const xml2js = require("xml2js");
const logger = require("./shared/logger");

const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });

module.exports = async function groupCategories(
  inputDirEvents,
  outputDirEvents
) {
  const moveFile = async (inputDir, outputDir) => {
    try {
      await fs.rename(inputDir, outputDir);
    } catch (err) {
      logger.error(err);
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
      logger.error(err);
    }
  };

  logger.info(`#-#-#-#-#-#-# INICIO DO PROCESSO #-#-#-#-#-#-#`);

  await Promise.all([
    resolve(outputDirEvents, "101-103"),
    resolve(outputDirEvents, "701-781"),
    resolve(outputDirEvents, "901"),
  ].map(createDirectoryIfNotExists));

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
    const fileData = [];

    for (const file of files) {
      const filePath = resolve(inputDirEvents, file);
      if (await validateFileDir(filePath)) {
        logger.info(`------- INICIANDO LEITURA ARQUIVO: ${file} -------`);
        const xml = await fs.readFile(filePath, "utf-8");
        const event = await parser.parseString(xml);
        fileData.push({ file, filePath, event });
      }
    }

    for (const { file, filePath, event } of fileData) {
      if (isAdmission(event)) {
        logger.info(`------- ARQUIVO: ${file} É ADMISSAO! -------`);
        const category = findCategory(event);
        const directorySended = returnDirToCategory(category);

        logger.info(
          `------- ARQUIVO: ${file} CATEGORIA: ${category}  DIRETÓRIO CATEGORIA: ${directorySended} -------`
        );

        const movePromises = fileData
          .filter(
            ({ event: secondEvent }) =>
              !isAdmission(secondEvent) && matchCpf(event, secondEvent)
          )
          .map(({ filePath: secondFilePath, file: secondFile }) =>
            moveFile(secondFilePath, resolve(directorySended, secondFile))
          );

        await Promise.all(movePromises);
        await moveFile(filePath, resolve(directorySended, file));
      }

      logger.info(`------- FINALIZADO VALIDAÇÃO DO ARQUIVO: ${file} -------`);
    }
  } catch (error) {
    logger.error(error);
  }

  logger.info(`#-#-#-#-#-#-# FIM DO PROCESSO #-#-#-#-#-#-#`);
};
