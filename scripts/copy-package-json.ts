import { FileSystem, Path } from "@effect/platform"
import { NodeContext } from "@effect/platform-node"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  yield* Effect.log("[Build] Copying package.json and schema files ...")

  // Copy schema files to dist/schemas
  const schemasDir = path.join("dist", "schemas")
  const sourceSchemas = path.join("src", "services", "Queue", "schemas")

  yield* fs.makeDirectory(schemasDir, { recursive: true }).pipe(
    Effect.catchAll(() => Effect.void) // Ignore if directory exists
  )

  const schemaFiles = yield* fs.readDirectory(sourceSchemas)
  yield* Effect.forEach(schemaFiles, (file) => {
    if (file.endsWith(".sql")) {
      const sourcePath = path.join(sourceSchemas, file)
      const destPath = path.join(schemasDir, file)
      return fs.copy(sourcePath, destPath)
    }
    return Effect.void
  })

  yield* Effect.log("[Build] Schema files copied to dist/schemas")
  yield* Effect.log("[Build] Copying package.json ...")
  const json: any = yield* fs.readFileString("package.json").pipe(Effect.map(JSON.parse))
  const pkg = {
    name: json.name,
    version: json.version,
    type: json.type,
    description: json.description,
    main: "bin.cjs",
    bin: { [json.name]: "bin.cjs" },
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
  yield* fs.writeFileString(path.join("dist", "package.json"), JSON.stringify(pkg, null, 2))
  yield* Effect.log("[Build] Build completed.")
}).pipe(Effect.provide(NodeContext.layer))

Effect.runPromise(program).catch(console.error)
