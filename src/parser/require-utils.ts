import path from "path"
import type ModuleClass from "module"

/**
 * createRequire
 */
function createRequire(
    filename: string,
): ReturnType<typeof ModuleClass.createRequire> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports, @typescript-eslint/naming-convention -- special require
    const Module = require("module")
    const fn: (
        fileName: string,
    ) => // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any
    any =
        // Added in v12.2.0
        Module.createRequire ||
        // Added in v10.12.0, but deprecated in v12.2.0.
        Module.createRequireFromPath ||
        // Polyfill - This is not executed on the tests on node@>=10.
        /* istanbul ignore next */
        ((filename2: string) => {
            const mod = new Module(filename2)

            mod.filename = filename2
            mod.paths = Module._nodeModulePaths(path.dirname(filename2))
            mod._compile("module.exports = require;", filename2)
            return mod.exports
        })
    return fn(filename)
}

/**
 * Checks if the given string is a linter path.
 */
function isLinterPath(p: string) {
    return (
        p.includes(
            `eslint${path.sep}lib${path.sep}linter${path.sep}linter.js`,
        ) || p.includes(`eslint${path.sep}lib${path.sep}linter.js`)
    )
}

/**
 * Get module from Linter
 */
export function requireFromLinter<T>(module: string): T | null {
    // Lookup the loaded eslint
    const linterPath = Object.keys(require.cache).find(isLinterPath)
    if (linterPath) {
        try {
            return createRequire(linterPath)(module)
        } catch {
            // ignore
        }
    }
    return null
}

/**
 * Get module from Cwd
 */
export function requireFromCwd<T>(module: string): T | null {
    try {
        const cwd = process.cwd()
        const relativeTo = path.join(cwd, "__placeholder__.js")
        return createRequire(relativeTo)(module)
    } catch {
        // ignore
    }
    return null
}
