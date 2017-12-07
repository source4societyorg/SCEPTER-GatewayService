'use strict'

const GatewayService = require('./service')
// This makes it much easier to mock later

const credentialsPath = process.env.CREDENTIALS_PATH || './credentials'
const servicesPath = process.env.SERVICES_PATH || './services'
global.service = new GatewayService(process.env.STAGE, credentialsPath, servicesPath)

module.exports.proxy = (event, context, callback) => {
  const defaultHeaders = {
    'Access-Control-Allow-Origin': '*', // Required for CORS support to work
    'Access-Control-Allow-Credentials': true // Required for cookies, authorization headers with HTTPS
  }

  let response = {
    headers: defaultHeaders,
    isBase64Encoded: false
  }

  const extractErrorCodeFromResponse = (error, defaultCode = 500) => (
    typeof error !== 'undefined' &&
      error !== null &&
      (typeof error.code !== 'undefined' ||
        typeof error.errors !== 'undefined') ? error.code || error.errors.code || defaultCode : defaultCode
  )

  const extractErrorMessageFromResponse = (error, defaultMessage = 'Unexpected Error.') => (
    typeof (error) !== 'undefined' &&
      error !== null &&
      (typeof error.message !== 'undefined' ||
         typeof error.errors !== 'undefined')
      ? error.message || error.errors.message || error : defaultMessage
  )

  const extractAuthenticationToken = (headers) => (
    typeof headers !== 'undefined' ? headers.Authorization : headers
  )

  const extractJwt = (authorization) => (
    typeof authorization !== 'undefined' ? authorization.split(': ')[1] : null
  )

  const prepareErrorResponse = (error) => {
    const code = extractErrorCodeFromResponse(error)
    const message = extractErrorMessageFromResponse(error)
    response.statusCode = code
    response.body = JSON.stringify({
      status: false,
      errors: {code: code, message: message}
    })
    return response
  }

  const prepareSuccessResponse = (data) => {
    response.statusCode = 200
    response.body = JSON.stringify(data)
    return response
  }

  const prepareAccessDeniedResponse = () => {
    response.statusCode = 403
    response.body = JSON.stringify({
      status: false,
      errors: {
        code: 403,
        message: 'Access denied'
      }
    })
    return response
  }

  try {
    const proxyCallback = (err, responseData) => {
      response = typeof err !== 'undefined' && err !== null ? prepareErrorResponse(err) : prepareSuccessResponse(responseData)
      callback(null, response)
    }

    const authCallback = (err, data) => {
      if (typeof err !== 'undefined' && err !== null) {
        response = prepareErrorResponse(err)
        callback(null, response)
      } else {
        if (data === true) {
          service.proxy(emittedEvent, proxyCallback)
        } else {
          response = prepareAccessDeniedResponse()
          callback(null, response)
        }
      }
    }

    const service = global.service
    const authorization = extractAuthenticationToken(event.headers)
    const jwt = extractJwt(authorization)
    const emittedEvent = JSON.parse(event.body) || {}
    service.authorize(authCallback, emittedEvent, jwt)
  } catch (error) {
    response = prepareErrorResponse(error)
    callback(null, response)
  }
}
