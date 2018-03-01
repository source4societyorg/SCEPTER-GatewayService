'use strict'
const immutable = require('immutable')
const utilities = require('@source4society/scepter-utility-lib')
const serviceUtility = require('@source4society/scepter-service-utility-lib')
const spawnLib = require('child_process').spawn
const jsonwebtokenLib = require('jsonwebtoken')
const AWSSDK = require('aws-sdk')
const requestLib = require('request')

class GatewayService {
  constructor (
    injectedStage,
    injectedCredentialsPath,
    injectedServicesPath,
    injectedParametersPath,
    injectedProvider,
    injectedSpawn,
    injectedJsonWebToken,
    injectedRequest,
    injectedAWS
  ) {
    const provider = utilities.valueOrDefault(injectedProvider, process.env.PROVIDER)
    const stage = utilities.valueOrDefault(injectedStage, 'development')
    const spawn = utilities.valueOrDefault(injectedSpawn, spawnLib)
    const credentialsPath = utilities.valueOrDefault(injectedCredentialsPath, './credentials.json')
    const parametersPath = utilities.valueOrDefault(injectedParametersPath, './parameters.json')
    const servicesPath = utilities.valueOrDefault(injectedServicesPath, './services.json')
    const jsonwebtoken = utilities.valueOrDefault(injectedJsonWebToken, jsonwebtokenLib)
    const request = utilities.valueOrDefault(injectedRequest, requestLib)
    const AWS = utilities.valueOrDefault(injectedAWS, AWSSDK)
    this.credentials = immutable.fromJS(require(credentialsPath))
    this.services = immutable.fromJS(require(servicesPath))
    this.parameters = immutable.fromJS(require(parametersPath))
    this.stage = stage
    this.spawn = spawn
    this.jsonwebtoken = jsonwebtoken
    this.request = request
    this.provider = provider
    this.defaultHeaders = {
      'Access-Control-Allow-Origin': '*', // Required for CORS support to work
      'Access-Control-Allow-Credentials': true, // Required for cookies, authorization headers with HTTPS
      'Content-Type': 'application/json'
    }
    this.response = {
      headers: this.defaultHeaders,
      isBase64Encoded: false
    }
    switch (this.provider) {
      case 'aws':
        this.AWS = AWS
        this.account = this.credentials.getIn(['environments', this.stage, 'provider', 'aws', 'account'], '')
        this.region = this.credentials.getIn(['environments', this.stage, 'provider', 'aws', 'region'], '')
        break
    }
  }

  processRequest (event) {
    const authorization = this.extractAuthenticationToken(event.headers)
    const jwt = this.extractJwt(authorization)
    this.validateEventBody(event)
    let emittedEvent = this.processEvent(event)
    this.jwt = jwt
    this.emittedEvent = emittedEvent
    this.emittedEventType = emittedEvent.type
  }

  validateEventBody (event) {
    if (utilities.isEmpty(event) || utilities.isEmpty(event.body)) {
      throw new Error('Event body is undefined')
    }
  }

  processEvent (event) {
    let emittedEvent = JSON.parse(event.body)
    if (typeof emittedEvent === 'string') {
      emittedEvent = JSON.parse(emittedEvent) // For azure
    }
    return emittedEvent
  }

  proxyRequest (callback) {
    serviceUtility.initiateHandledSequence(this.proxyRequestSequence.bind(this), callback)
  }

  * proxyRequestSequence (finalCallback, sequenceCallback) {
    const userData = this.authorize()
    const result = yield this.proxy(userData, sequenceCallback)
    this.validateSuccessStatus(result, finalCallback)
    finalCallback(null, result)
  }

  authorize (injectedEventType, injectedJwt, injectedStage, injectedJsonWebToken, injectedCredentials) {
    const eventType = utilities.valueOrDefault(injectedEventType, this.emittedEventType)
    const jwt = utilities.valueOrDefault(injectedJwt, this.jwt)
    const stage = utilities.valueOrDefault(injectedStage, this.stage)
    const jsonwebtoken = utilities.valueOrDefault(injectedJsonWebToken, this.jsonwebtoken)
    const credentials = utilities.valueOrDefault(injectedCredentials, this.credentials)
    const security = this.getServiceValue(eventType, stage, 'security', [])
    const userAuthData = this.extractUserDataFromJwt(jwt, stage, jsonwebtoken, credentials)
    this.validateAuthorization(eventType, security, userAuthData)
    return userAuthData
  }

  extractUserDataFromJwt (jwt, stage, injectedJsonWebToken, injectedCredentials) {
    let keySecret = null
    let userAuthData = null
    const jsonwebtoken = utilities.valueOrDefault(injectedJsonWebToken, this.jsonwebtoken)
    const credentials = utilities.valueOrDefault(injectedCredentials, this.credentials)
    if (utilities.isEmpty(jwt)) {
      return null
    }
    keySecret = credentials.getIn(['environments', stage, 'jwtKeySecret'], '')
    jsonwebtoken.verify(jwt, keySecret)
    userAuthData = jsonwebtoken.decode(jwt)
    return userAuthData
  }

  validateAuthorization (eventType, security, injectedUserAuthData) {
    const userAuthData = utilities.valueOrDefault(injectedUserAuthData, {})
    const userRoles = userAuthData.roles
    if (!this.roleIsAuthorized(security, userRoles)) {
      throw new Error('Access denied')
    }
    return userAuthData
  }

  roleIsAuthorized (injectedSecurity, injectedUserRoles) {
    const security = utilities.valueOrDefault(injectedSecurity, [])
    const userRoles = utilities.valueOrDefault(injectedUserRoles, [])
    return (
      (!utilities.isEmpty(security) && (security.indexOf('ROLE_ANONYMOUS') > -1)) ||
      security.some((value) => userRoles.indexOf(value) > -1)
    )
  }

  proxy (
    userData,
    proxyCallback,
    injectedProvider,
    injectedStage,
    injectedServiceEvent,
    injectedServiceName,
    injectedFolder,
    injectedFunction,
    injectedShell,
    injectedAccount,
    injectedRegion,
    injectedParameters
  ) {
    const stage = utilities.valueOrDefault(injectedStage, this.stage)
    const serviceEvent = utilities.valueOrDefault(injectedServiceEvent, this.emittedEvent)
    const eventType = serviceEvent.type
    const parameters = utilities.valueOrDefault(injectedParameters, this.parameters)
    const provider = utilities.valueOrDefault(injectedProvider, this.getServiceValue(eventType, stage, 'provider'))
    const serviceName = utilities.valueOrDefault(injectedServiceName, this.getServiceValue(eventType, stage, 'serviceName'))
    const func = utilities.valueOrDefault(injectedFunction, this.getServiceValue(eventType, stage, 'function'))
    const shell = utilities.valueOrDefault(injectedShell, parameters.get('shell', '/bin/bash'))
    const folder = utilities.valueOrDefault(injectedFolder, `../${serviceName}`)
    let payload = serviceEvent.payload
    payload.authenticatedUserData = userData
    switch (provider) {
      case 'local':
        serviceUtility.initiateSequence(this.invokeLocalFunctionSequence(proxyCallback, payload, func, folder, shell), proxyCallback)
        break
      case 'azure:http':
      serviceUtility.initiateSequence(this.invokeViaAzureHttpSequence(proxyCallback, payload, func), proxyCallback)
        break
      case 'aws:lambda':
        const account = utilities.valueOrDefault(injectedAccount, this.account)
        const region = utilities.valueOrDefault(injectedRegion, this.region)
        serviceUtility.initiateSequence(this.invokeLambdaSequence(proxyCallback, payload, stage, func, serviceName, account, region), proxyCallback)
        break
      default:
        proxyCallback(new Error('Invalid provider'))
    }
  }

  * invokeViaAzureHttpSequence (finalCallback, payload, func, injectedRequest) {
    const request = utilities.valueOrDefault(injectedRequest, this.request)
    let sequenceCallback = yield
    const response = yield request({ url: func, json: true, body: payload }, (error, response, body) => sequenceCallback(error, body))
    const result = JSON.parse(response)
    finalCallback(null, result)
  }

  * invokeLambdaSequence (finalCallback, payload, stage, func, serviceName, account, region, injectAWS, injectParameters) {
    let sequenceCallback = yield
    const AWS = utilities.valueOrDefault(injectAWS, this.AWS)
    const parameters = utilities.valueOrDefault(injectParameters, this.parameters)
    const lambda = new AWS.Lambda({region: region})
    const response = yield lambda.invoke({
      FunctionName: `${account}:${parameters.get('appName')}-${serviceName}-${stage}-${func}`,
      Payload: JSON.stringify(payload, null, 2)
    }, sequenceCallback)
    const result = JSON.parse(response.Payload)
    finalCallback(null, result)
  }

  * invokeLocalFunctionSequence (finalCallback, payload, func, folder, shell, injectedSpawn) {
    let sequenceCallback = yield
    const spawn = utilities.valueOrDefault(injectedSpawn, this.spawn)
    const commandPrefix = utilities.ifTrueElseDefault(shell === 'powershell', 'powershell.exe -Command ', '')
    const stringifiedPayload = JSON.stringify(payload)
    const modifiedPayload = utilities.ifTrueElseDefault(shell === 'powershell', stringifiedPayload.replace(/"/g, '\\\\\\"'), stringifiedPayload)
    const command = `${commandPrefix}./node_modules/.bin/sls invoke local -f ${func} -d '${modifiedPayload}'`
    let bytes = null
    let invocation = spawn(command, [], {
      stdio: 'pipe',
      cwd: folder,
      shell: true
    })

    let loop = true
    invocation.stdout.on('data', (data) => sequenceCallback(null, data))
    invocation.on('close', (code) => sequenceCallback(null, null))
    while (loop) {
      loop = yield // Loop through output until process close
      bytes = utilities.valueOrDefault(loop, bytes) // take latest non empty line of bytes
    }
    const output = utilities.valueOrDefault(bytes.toString('utf8'), '')
    const result = JSON.parse(output)
    finalCallback(null, result)
  }

  extractErrorMessageForResponse (injectedError, injectedDefaultMessage, injectedStage) {
    const error = utilities.valueOrDefault(injectedError, {})
    const stage = utilities.valueOrDefault(injectedStage, this.stage)
    const defaultMessage = utilities.valueOrDefault(injectedDefaultMessage, error)
    let errorMessage = utilities.ifTrueElseDefault(stage === 'development', error.stack, error.message)
    errorMessage = utilities.valueOrDefault(errorMessage, defaultMessage)
    return errorMessage
  }

  extractAuthenticationToken (headers) {
    const headerData = utilities.valueOrDefault(headers, {})
    return headerData.Authorization
  }

  extractJwt (authorization) {
    return utilities.isEmpty(authorization) ? null : authorization.split(': ')[1]
  }

  prepareErrorResponse (error, injectedProvider, injectedResponse) {
    const provider = utilities.valueOrDefault(injectedProvider, this.provider)
    let response = utilities.valueOrDefault(injectedResponse, this.response)
    const message = this.extractErrorMessageForResponse(error)
    const key = utilities.ifTrueElseDefault(provider === 'aws', 'statusCode', 'status')
    response[key] = 403
    response.body = JSON.stringify({
      status: false,
      errors: {message: message}
    })
    return response
  }

  prepareSuccessResponse (data, injectedProvider, injectedResponse) {
    const provider = utilities.valueOrDefault(injectedProvider, this.provider)
    let response = utilities.valueOrDefault(injectedResponse, this.response)
    const key = utilities.ifTrueElseDefault(provider === 'aws', 'statusCode', 'status')
    response[key] = 200
    response.body = JSON.stringify(data)
    return response
  }

  prepareAccessDeniedResponse () {
    this.prepareErrorResponse(new Error('Access denied'))
  }

  getServiceValue (eventType, stage, value, defaultValue, injectedServices) {
    const services = utilities.valueOrDefault(injectedServices, this.services)
    const result = services.getIn(['environments', stage, 'configuration', eventType, value], services.getIn(['environments', stage, value]))
    return utilities.valueOrDefault(result, defaultValue)
  }

  validateSuccessStatus (result) {
    if (result.status === false) {
      throw new Error(utilities.valueOrDefault(result.error, 'Unknown Error'))
    }
  }
};

module.exports = GatewayService
