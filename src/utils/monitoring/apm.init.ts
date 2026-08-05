/* eslint-disable */
import APM from 'elastic-apm-node'

let instance: APM.Agent | undefined

const serviceName = process.env.APM_SERVICE_NAME || 'pass-emploi-connect-local'
const secretToken = process.env.APM_SECRET_TOKEN || ''
const serverUrl = process.env.APM_URL || ''
const environment = process.env.ENVIRONMENT || 'development'
const active = process.env.APM_IS_ACTIVE === 'true'
const serviceVersion = process.env.npm_package_version

const config: APM.AgentConfigOptions = {
  serviceName,
  secretToken,
  serverUrl,
  environment,
  active,
  serviceVersion,
  // Depuis elastic-apm-node v4, logUncaughtExceptions n'existe plus : l'agent
  // logue systématiquement les exceptions non catchées qu'il capture.
  captureExceptions: true
}

export const initializeAPMAgent = (): void => {
  instance = APM.start(config)
}

export const setAPMInstance = (stubInstance: APM.Agent): void => {
  instance = stubInstance
}

export const getAPMInstance = (): APM.Agent => {
  if (!instance) {
    throw new Error('APM Agent is not initialized (run initializeAPMAgent) ')
  }
  return instance
}
