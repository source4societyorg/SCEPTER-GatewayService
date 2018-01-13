const GatewayService = require('./service')

const handlerUtilities = {
  constructGatewayService: (environment, credentialsPath, servicesPath) => (
    new GatewayService(environment, credentialsPath, servicesPath)
  ),
  accessDeniedResponse: (callback, service) => () => {
    let response = service.prepareAccessDeniedResponse()
    callback(null, response)
  },
  ENVIRONMENT: process.env.stage || 'dev',
  SERVICE_PATH: process.env.SERVICES_PATH || './services',
  CREDENTIALS_PATH: process.env.CREDENTIALS_PATH || './credentials'
}

module.exports = handlerUtilities
