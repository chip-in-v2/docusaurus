#!/usr/bin/env node

import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { existsSync, mkdirSync } from "node:fs"
import unzipper from "unzipper"
import { inspect } from "node:util"
import { logger } from "@docusaurus/logger"
import { DOCUSAURUS_VERSION } from "@docusaurus/utils"
import { runCLI } from "@docusaurus/core/lib/index.js"
import beforeCli from "@docusaurus/core/bin/beforeCli.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const OPS_FRONTIER_PROJECT_ROOT = process.env.OPS_FRONTIER_PROJECT_ROOT || process.cwd()
const OPS_FRONTIER_DOCUSAURUS_PATH = `${OPS_FRONTIER_PROJECT_ROOT}/.chip-in-docusaurus`
process.env.OPS_FRONTIER_DOCS_PATH = `${OPS_FRONTIER_PROJECT_ROOT}/docs`

if (!existsSync(process.env.OPS_FRONTIER_DOCS_PATH)) {
    logger.error(`Error: ${process.env.OPS_FRONTIER_DOCS_PATH} does not exist.`)
    process.exit(1)
}
logger.info(`Document path set to ${process.env.OPS_FRONTIER_DOCS_PATH}`)

if (process.argv.length < 3) {
    logger.error("Usage: chip-in-docusaurus <command> [options]")
    process.exit(1)
} else if (process.argv[2] === "build" || process.argv[2] === "start") {
    // Check if OPS_FRONTIER_DOCUSAURUS_PATH exists, create it and unzip if not
    if (!existsSync(OPS_FRONTIER_DOCUSAURUS_PATH)) {
        logger.info(`Docusaurus directory does not exist. Creating: ${OPS_FRONTIER_DOCUSAURUS_PATH}`)
        mkdirSync(OPS_FRONTIER_DOCUSAURUS_PATH, { recursive: true })

        const zipFilePath = join(__dirname, "chip-in-docusaurus.zip")
        if (existsSync(zipFilePath)) {
            logger.info(`Unzipping ${zipFilePath} to ${OPS_FRONTIER_DOCUSAURUS_PATH}`)
            try {
                const directory = await unzipper.Open.file(zipFilePath)
                await directory.extract({ path: OPS_FRONTIER_DOCUSAURUS_PATH })
                logger.info(`Successfully unzipped ${zipFilePath} to ${OPS_FRONTIER_DOCUSAURUS_PATH}`)
            } catch (error) {
                logger.error(`Error unzipping ${zipFilePath}:`, error)
                process.exit(1)
            }
        } else {
            logger.error(`Error: ${zipFilePath} not found.`)
            process.exit(1)
        }
    } else {
        logger.info(
            `${OPS_FRONTIER_DOCUSAURUS_PATH} already exists. Not unzipping. If you want to reinitialize, delete the directory and run the command again.`,
        )
    }
}

const args = ["docusaurus", ...process.argv.slice(1)]
// カレントディレクトリを OPS_FRONTIER_DOCUSAURUS_PATH に変更
try {
    process.chdir(OPS_FRONTIER_DOCUSAURUS_PATH)
    logger.info(`Current directory changed to ${process.cwd()} as docusaurus site root`)
} catch (err) {
    logger.error(`Error: chdir: ${err}`)
    process.exit(1)
}

// Env variables are initialized to dev, but can be overridden by each command
// For example, "docusaurus build" overrides them to "production"
// See also https://github.com/facebook/docusaurus/issues/8599
process.env.BABEL_ENV ??= "development"
process.env.NODE_ENV ??= "development"

/**
 * @param {unknown} error
 */
function handleError(error) {
    logger.info("")

    // We need to use inspect with increased depth to log the full causal chain
    // By default Node logging has depth=2
    // see also https://github.com/nodejs/node/issues/51637
    logger.error(inspect(error, { depth: Infinity }))

    logger.info`Docusaurus version: number=${DOCUSAURUS_VERSION}
Node version: number=${process.version}`
    process.exit(1)
}

process.on("unhandledRejection", handleError)

try {
    await beforeCli()
    // @ts-expect-error: we know it has at least 2 args
    await runCLI(args)
} catch (e) {
    handleError(e)
}
