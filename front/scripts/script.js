document
  .getElementById("myForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const inputDir = document.getElementById("inputDir").value;
    const outputDir = document.getElementById("outputDir").value;

    fetch("http://localhost:3333/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputDir,
        outputDir,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        alert(`Success`);
      })
      .catch((error) => {
        alert(`Erro ao enviar requisição para o servidor: ${error}`);
        console.error(error);
      });
  });
