const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const groupCategories = require("./groupCategories");

app.use(bodyParser.json());

app.post("/run", async (req, res) => {
  const inputDir = req.body.inputDir;
  const outputDir = req.body.outputDir;

  await groupCategories(inputDir, outputDir);

  return res.send({ menssage: "ok" });
});

app.listen(3333, () => {
  console.log("API Running to 3333");
});
