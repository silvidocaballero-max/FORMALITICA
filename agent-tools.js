/* Formalítica · Herramientas WebMCP para agentes en el navegador.
   Solo se registran si el navegador ofrece navigator.modelContext. */
(function () {
  var mc = navigator.modelContext;
  if (!mc) return;

  var BASE = "https://compratuformacion.com";
  var AQUI = (document.currentScript && document.currentScript.src) || location.href;
  var FORMACIONES = [
    { id: "master-en-cursos-online", nombre: "Máster en Cursos Online", autor: "Marcelo Rodríguez", tema: "crear y vender cursos online", precio: "227 US$", nota: "16/20", veredicto: "Recomendable con reservas" },
    { id: "cake-designer", nombre: "Cake Designer (Diseñador de Pasteles)", autor: "Manuel Guerrero", tema: "repostería y diseño de tartas", precio: "228,69 €", nota: "15/19", veredicto: "Recomendable con reservas" },
    { id: "insta-leads", nombre: "Insta Leads", autor: "Alex Just", tema: "captación de clientes en Instagram", precio: "1.408,44 €", nota: "14/20", veredicto: "Recomendable con reservas" },
    { id: "metodo-mikel-vazquez", nombre: "El Método Mikel Vázquez", autor: "Mikel Vázquez", tema: "trading Wyckoff y VSA", precio: "108,90 €", nota: "en curso", veredicto: "Análisis en curso" }
  ];
  FORMACIONES.forEach(function (f) {
    f.url = BASE + "/formaciones/" + f.id + "-opiniones/";
    f.markdown = f.url + "index.md";
  });

  function texto(obj) {
    return { content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] };
  }
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  var tools = [
    {
      name: "listar_formaciones",
      description: "Devuelve las formaciones online analizadas por Formalítica con su nota (puntos cumplidos sobre puntos analizados), precio, veredicto y enlace al análisis completo. Admite un texto opcional para filtrar por nombre, autor o tema.",
      inputSchema: {
        type: "object",
        properties: { buscar: { type: "string", description: "Texto para filtrar por nombre, autor o tema, por ejemplo «trading» o «repostería»." } }
      },
      execute: async function (input) {
        var q = norm(input && input.buscar);
        var res = FORMACIONES.filter(function (f) {
          return !q || norm(f.nombre + " " + f.autor + " " + f.tema).indexOf(q) !== -1;
        });
        return texto(res.length ? res : "No hay ninguna formación analizada que coincida con «" + input.buscar + "».");
      }
    },
    {
      name: "leer_analisis",
      description: "Devuelve en Markdown el análisis completo de una formación: los 20 puntos, pros y contras, opinión personal, preguntas frecuentes y fuentes.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", enum: FORMACIONES.map(function (f) { return f.id; }), description: "Identificador de la formación (lo devuelve listar_formaciones)." } },
        required: ["id"]
      },
      execute: async function (input) {
        var f = FORMACIONES.filter(function (x) { return x.id === input.id; })[0];
        if (!f) return texto("Formación no encontrada.");
        var r = await fetch(new URL("formaciones/" + f.id + "-opiniones/index.md", AQUI));
        return texto(r.ok ? await r.text() : "No se pudo leer el análisis. Ábrelo en " + f.url);
      }
    }
  ];

  try {
    if (typeof mc.registerTool === "function") {
      tools.forEach(function (t) { mc.registerTool(t); });
    } else if (typeof mc.provideContext === "function") {
      mc.provideContext({ tools: tools });
    }
  } catch (e) { /* el navegador no admite WebMCP: no pasa nada */ }
})();
