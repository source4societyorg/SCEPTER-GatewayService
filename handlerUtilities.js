const GatewayService = require('./service')

const handlerUtilities = {
  constructGatewayService: (environment, credentialsPath, servicesPath, parametersPath) => (
    new GatewayService(environment, credentialsPath, servicesPath, parametersPath)
  ),
  accessDeniedResponse: (callback, service) => () => {
    let response = service.prepareAccessDeniedResponse()
    callback(null, response)
  },
  ENVIRONMENT: process.env.stage || 'dev',
  SERVICE_PATH: process.env.SERVICES_PATH || './services',
  CREDENTIALS_PATH: process.env.CREDENTIALS_PATH || './credentials',
  PARAMETERS_PATH: process.env.PARAMETERS_PATH || './parameters'
}

module.exports = handlerUtilities
