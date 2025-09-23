import * as fs from "node:fs/promises"
import * as path from "node:path"

async function main() {
  console.log("timestamp=" + new Date().toISOString() + " level=INFO fiber=#1 message=\"[Build] Copying package.json ...\"")

  // Read original package.json
  const json = JSON.parse(await fs.readFile("package.json", "utf-8"))

  // Create simplified package.json for distribution
  const pkg = {
    name: json.name,
    version: json.version,
    type: json.type,
    description: json.description,
    main: "bin.js",
    bin: { [json.name]: "bin.js" },
    engines: json.engines,
    dependencies: json.dependencies,
    peerDependencies: json.peerDependencies,
    repository: json.repository,
    author: json.author,
    license: json.license,
    bugs: json.bugs,
    homepage: json.homepage,
    tags: json.tags,
    keywords: json.keywords
  }

  await fs.writeFile(path.join("dist", "package.json"), JSON.stringify(pkg, null, 2))
  console.log("timestamp=" + new Date().toISOString() + " level=INFO fiber=#1 message=\"[Build] Build completed.\"")
}

main().catch(console.error)
