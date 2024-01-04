const { createLogger, format, transports } = require("winston");
const { combine, timestamp, label, json } = format;

const path = require("path");

const logDir = "api/logs";

const ignoreErrors = format((info, opts) => {
  if (info.level === "error") {
    return false;
  }
  return info;
});

const logger = createLogger({
  level: "info",
  format: combine(timestamp(), json()),
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
