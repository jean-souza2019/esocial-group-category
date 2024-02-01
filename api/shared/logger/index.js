const { createLogger, format, transports } = require("winston");
const { combine, json } = format;

const timestamp = () =>
  new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

const customTimestamp = format((info, opts) => {
  info.timestamp = timestamp();
  return info;
});


const path = require("path");

const logDir = "api/logs";

const ignoreErrors = format((info, _) =>
  info.level === "error" ? false : info
);

const logger = createLogger({
  level: "info",
  format: combine(customTimestamp(), json()),
  transports: [
    new transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
    }),
    new transports.File({
      filename: path.join(logDir, "info.log"),
      format: ignoreErrors(),
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.simple(),
    })
  );
}

module.exports = logger;
