'use strict'
const immutable = require('immutable')
class GatewayService {
  constructor (stage = 'dev', credentialsPath = process.env.CREDENTIALS_PATH, servicesPath = process.env.SERVICES_PATH) {
    const { spawn } = require('child_process')
    const jsonwebtoken = require('jsonwebtoken')
    this.credentials = immutable.fromJS(require(credentialsPath))
    this.services = immutable.fromJS(require(servicesPath))
    this.stage = stage
    this.spawn = spawn
    this.jsonwebtoken = jsonwebtoken
    this.request = require('request')
    switch (process.env.PROVIDER) {
      case 'azure':
        break
      case 'aws':
        this.AWS = require('aws-sdk')
        this.account = this.credentials.getIn(['environments', this.stage, 'provider', 'aws', 'account'], '')
        this.region = this.credentials.getIn(['environments', this.stage, 'provider', 'aws', 'region'], '')
        break
      default:
    }

    this.utilities = require('@source4society/scepter-utility-lib')

    this.defaultHeaders = {
      'Access-Control-Allow-Origin': '*', // Required for CORS support to work
      'Access-Control-Allow-Credentials': true, // Required for cookies, authorization headers with HTTPS
      'Content-Type': 'application/json'
    }

    this.response = {
      headers: this.defaultHeaders,
      isBase64Encoded: false
    }
  }

  authorize (serviceEvent, jwt, authCallback) {
    try {
      const eventType = serviceEvent.type
      let security = this.getRoleAccess(eventType)
      let keySecret = null
      let userAuthData = true
      let userRoles = []
      if (!this.utilities.isEmpty(jwt)) {
        keySecret = this.credentials.getIn(['environments', this.stage, 'jwtKeySecret'], '')
        this.jsonwebtoken.verify(jwt, keySecret)
        userAuthData = this.jsonwebtoken.decode(jwt)
        userRoles = userAuthData.roles
      }

      if (!this.utilities.isEmpty(security) && ((security.indexOf('ROLE_ANONYMOUS') > -1) || security.some((value) => userRoles.indexOf(value) > -1))) {
        authCallback(null, userAuthData)
      } else {
        authCallback({message: 'Access denied', code: 403}, null)
      }
    } catch (err) {
      authCallback({message: err.message, code: 403})
    }
  }

  proxy (serviceEvent, userData, proxyCallback) {
    const eventType = serviceEvent.type
    const provider = this.services.getIn(['environments', this.stage, 'configuration', eventType, 'provider'], this.services.getIn(['environments', this.stage, 'provider']))
    const serviceName = this.services.getIn(['environments', this.stage, 'configuration', eventType, 'serviceName'])
    const folder = '../' + serviceName
    const func = this.services.getIn(['environments', this.stage, 'configuration', eventType, 'function'])
    const shell = this.services.getIn(['environments', this.stage, 'configuration', eventType, 'shell'], '/bin/bash')
    let payload = serviceEvent.payload

    payload.authenticatedUserData = userData

    switch (provider) {
      case 'local':
        this.invokeLocalFunction(proxyCallback, payload, func, folder, shell)
        break
      case 'azure:http':
        this.invokeViaAzureHttp(proxyCallback, payload, func)
        break
      case 'aws:lambda':
        this.invokeLambda(proxyCallback, payload, func, serviceName, this.account, this.region)
        break
    }
  }

  invokeViaAzureHttp (proxyCallback, payload, func) {
    this.request({
      url: func,
      json: true,
      body: payload
    },
    (error, response, body) => this.functionInvocationCallback(error, !this.utilities.isEmpty(body) ? body || null : null, proxyCallback, false)
    )
  }

  invokeLambda (proxyCallback, payload, func, serviceName, account, region) {
    let lambda = new this.AWS.Lambda({region: region})
    lambda.invoke({
      FunctionName: account + ':' + serviceName + '-' + this.stage + '-' + func,
      Payload: JSON.stringify(payload, null, 2)
    }, (err, data) => this.functionInvocationCallback(err, !this.utilities.isEmpty(data) ? data.Payload || null : null, proxyCallback, true))
  }

  invokeLocalFunction (proxyCallback, payload, func, folder, shell) {
    let command = './node_modules/.bin/sls invoke local -f ' + func + ' -d ' + JSON.stringify(JSON.stringify(payload)) + ' 2>&1'
    let invocation = this.spawn(command, [], {
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: folder,
      shell: shell
    })
    invocation.stdout.on('data', (data) => this.functionInvocationCallback(null, data, proxyCallback, true))
  }

  functionInvocationCallback (err, data, proxyCallback, parse = false) {
    try {
      const result = typeof data === 'string' ? JSON.parse(data.toString('utf8')) || data : data
      if (this.utilities.isEmpty(err) &&
        (!this.utilities.isEmpty(result) &&
          (result.status === true || this.utilities.isEmpty(result.status))
        )
      ) {
        proxyCallback(null, result)
      } else {
        proxyCallback(this.utilities.isEmpty(result) ? err : (this.utilities.isEmpty(result.errors) ? result : result.errors))
      }
    } catch (error) {
      proxyCallback(error)
    }
  }

  getRoleAccess (eventType) {
    return !this.utilities.isEmpty(this.services.getIn(['environments', this.stage, 'configuration', eventType]))
      ? this.services.getIn(['environments', this.stage, 'configuration', eventType, 'security'], []) : []
  }

  extractErrorCodeFromResponse (error, defaultCode = 500) {
    let statusCode = defaultCode
    if (!this.utilities.isEmpty(error) && (!this.utilities.isEmpty(error.code) || !this.utilities.isEmpty(error.errors))) {
      if (!this.utilities.isEmpty(error.code)) {
        statusCode = error.code
      } else if (!this.utilities.isEmpty(error.errors.code)) {
        statusCode = error.errors.code
      }
    }

    if (isNaN(statusCode)) {
      statusCode = defaultCode
    }
    return statusCode
  }

  extractErrorMessageFromResponse (error, defaultMessage = 'Unexpected Error.') {
    let errorMessage = !this.utilities.isEmpty(error) && (!this.utilities.isEmpty(error.message) || !this.utilities.isEmpty(error.errors))
      ? error.message || error.errors.message : (typeof error === 'string' ? error : defaultMessage)
    return errorMessage
  }

  extractAuthenticationToken (headers) {
    return typeof headers !== 'undefined' ? headers.Authorization || null : null
  }

  extractJwt (authorization) {
    return this.utilities.isEmpty(authorization) ? null : authorization.split(': ')[1]
  }

  prepareErrorResponse (error) {
    const code = this.extractErrorCodeFromResponse(error)
    const message = this.extractErrorMessageFromResponse(error)
    this.response.statusCode = code
    this.response.status = code
    this.response.body = JSON.stringify({
      status: false,
      errors: {code: code, message: message}
    })
    return this.response
  }

  prepareSuccessResponse (data) {
    this.response.statusCode = 200
    this.response.status = 200
    this.response.body = JSON.stringify(data)
    return this.response
  }

  prepareAccessDeniedResponse () {
    this.response.statusCode = 403
    this.response.status = 403
    this.response.body = JSON.stringify({
      status: false,
      errors: {
        code: 403,
        message: 'Access denied'
      }
    })
    return this.response
  }
};

module.exports = GatewayService
