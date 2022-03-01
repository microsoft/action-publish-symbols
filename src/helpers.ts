import path from 'path'
import * as core from '@actions/core'
import fs from 'fs'

export function getTempPath(): string {
  const tempFolder = process.env['RUNNER_TEMP'] as string
  return tempFolder
}

export function getTempFileName(): string {
  const suffix = '.txt'

  let tempFileName = path.join(getTempPath(), `tmp${makeid(6)}${suffix}`)

  let fileExists = fs.existsSync(tempFileName)

  // We don't want this to run forever.  If the retry loop runs more than 5 times, fail
  let retryCount = 1

  // If for some reason the file already exists, generate a new one.
  while (fileExists && retryCount < 5) {
    core.debug(`File ${tempFileName} already exists, recreating a new file`)
    tempFileName = path.join(getTempPath(), `tmp${makeid(6)}${suffix}`)
    fileExists = fs.existsSync(tempFileName)
    retryCount++
  }

  // If we get to this point, and the file still exists, throw an exception
  if (fileExists) {
    const errorMessage = `Unable to create unique temp file name after ${retryCount + 1} attempts`
    core.error(errorMessage)
    throw Error(errorMessage)
  }

  return tempFileName
}

export function makeid(length: number): string {
  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

export function parseBoolean(input: string): boolean {
  return input.toLowerCase() === 'true' || input.toLowerCase() === '1' ? true : false
}

export function getInputWithDefault(inputName: string, defaultValue: string): string {
  const inputValue = core.getInput(inputName)

  return inputValue.trim().length !== 0 ? inputValue : defaultValue
}

export function getEnvVar(envVar: string): string {
  return process.env[envVar] as string
}
