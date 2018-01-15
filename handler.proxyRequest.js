'use strict'

const utilities = require('@source4society/scepter-utility-lib')
const handlerUtilities = require('./handlerUtilities')

const getMakeAuthCallback = (service, accessDeniedResponse, callbackHandler, errorHandler, successHandler) => (emittedEvent) => (authData) => {
  if (authData) {
    service.proxy(emittedEvent, authData, (err, data) => callbackHandler(err, data, errorHandler, successHandler))
  } else {
    accessDeniedResponse()
  }
}

const proxyRequest = (
  event,
  context,
  callback,
  constructService = handlerUtilities.constructGatewayService,
  env = handlerUtilities.ENVIRONMENT,
  servicesPath = handlerUtilities.SERVICE_PATH,
  credentialsPath = handlerUtilities.CREDENTIALS_PATH,
  callbackHandler = utilities.standardCallbackHandler,
  getMakeAuthCallbackDependency = getMakeAuthCallback,
  getErrorHandlerDependency = utilities.standardErrorHandler,
  getSuccessHandlerDependency = utilities.standardSuccessHandler,
  getAccessDeniedResponseDependency = handlerUtilities.accessDeniedResponse
) => {
  // inject dependencies
  const service = constructService(env, credentialsPath, servicesPath)
  const errorHandler = getErrorHandlerDependency(callback, service)
  const successHandler = getSuccessHandlerDependency(callback, service)
  const accessDeniedResponse = getAccessDeniedResponseDependency(callback, service)
  const makeAuthCallback = getMakeAuthCallbackDependency(service, accessDeniedResponse, callbackHandler, errorHandler, successHandler)

  // Execute service call
  try {
    const authorization = service.extractAuthenticationToken(event.headers)
    const jwt = service.extractJwt(authorization)
    if (utilities.isEmpty(event) || utilities.isEmpty(event.body)) {
      throw new Error('Event body is undefined')
    }
    let emittedEvent = JSON.parse(event.body)
    if (typeof emittedEvent === 'string') {
      emittedEvent = JSON.parse(emittedEvent) // For azure
    }
    service.authorize(emittedEvent, jwt, (err, data) => callbackHandler(err, data, errorHandler, makeAuthCallback(emittedEvent)))
  } catch (error) {
    errorHandler(error)
  }
}

module.exports.getMakeAuthCallback = getMakeAuthCallback
module.exports.proxyRequest = proxyRequest
