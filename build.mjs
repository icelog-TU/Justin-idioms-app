import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const SHELL_HEAD = readFileSync(new URL("./src/shell-head.html", import.meta.url), "utf8");
const SHELL_TAIL = "\n</script>\n</body>\n</html>\n";

const result = await build({
  entryPoints: ["src/entry.jsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2018",
  jsx: "automatic",
  legalComments: "eof",
  define: { "process.env.NODE_ENV": '"production"' },
  write: false,
});

const bundleText = result.outputFiles[0].text;

writeFileSync("Justin-idioms.html", SHELL_HEAD + bundleText + SHELL_TAIL);
console.log("Built Justin-idioms.html (" + (SHELL_HEAD.length + bundleText.length) + " bytes)");
