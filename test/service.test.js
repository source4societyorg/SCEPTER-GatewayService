
const immutable = require('immutable')
const serviceUtility = require('@source4society/scepter-service-utility-lib')
test('Service constructor sets preestablished defaults', () => {
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  expect(service.stage).toEqual('test')
  expect(service.credentials).toEqual(immutable.fromJS(require('./credentials')))
  expect(service.services).toEqual(immutable.fromJS(require('./services')))
  expect(service.parameters).toEqual(immutable.fromJS(require('./parameters')))
})

test('processRequest prepares request ', () => {
  const mockEvent = {headers: 'mockheaders'}
  const mockExtractAuthenticationToken = (headers) => {
    expect(headers).toEqual('mockheaders')
    return 'mockauthorization'
  }
  const mockExtractJwt = (authorization) => {
    expect(authorization).toEqual('mockauthorization')
    return 'mockjwt'
  }
  const mockValidateEventBody = (event) => {
    expect(event).toEqual(mockEvent)
  }
  const mockProcessEvent = (event) => {
    expect(event).toEqual(mockEvent)
    return 'mockemittedevent'
  }

  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  service.extractAuthenticationToken = mockExtractAuthenticationToken
  service.extractJwt = mockExtractJwt
  service.validateEventBody = mockValidateEventBody
  service.processEvent = mockProcessEvent
  service.processRequest(mockEvent)
  expect(service.jwt).toEqual('mockjwt')
  expect(service.emittedEvent).toEqual('mockemittedevent')
})

test('validateEventBody throws error if event or event.body is empty', () => {
  const mockEmptyEvent = null
  const mockEmptyEventBody = {}
  const mockValidEvent = { body: { hasproperties: true } }
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  expect(() => service.validateEventBody(mockEmptyEvent)).toThrow()
  expect(() => service.validateEventBody(mockEmptyEventBody)).toThrow()
  service.validateEventBody(mockValidEvent)
})

test('processEvent extracts event data and accounts for results from azure functions', () => {
  const mockEventBody = { hasProperties: true }
  const mockEventAzure = { body: JSON.stringify(JSON.stringify(mockEventBody)) }
  const mockEventOther = { body: JSON.stringify(mockEventBody) }
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  expect(service.processEvent(mockEventAzure)).toEqual(mockEventBody)
  expect(service.processEvent(mockEventOther)).toEqual(mockEventBody)
})

test('proxyRequest initiates proxy sequence', (done) => {
  const mockCallback = () => {}
  function * mockProxyRequestSequence (finalcallback, sequenceCallback) {
    expect(finalcallback).toEqual(mockCallback)
    expect(typeof sequenceCallback).toEqual('function')
    done()
  }
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  service.proxyRequestSequence = mockProxyRequestSequence
  service.proxyRequest(mockCallback)
})

test('proxyRequestSequence authorizes the requests then proxies it to the appropriate handler', (done) => {
  const mockResult = 'mockresult'
  const mockUserData = {
    hasProperties: true
  }
  const mockFinalCallback = (err, data) => {
    expect(err).toBeNull()
    expect(data).toEqual('mockresult')
    done()
  }
  const mockAuthorize = () => {
    return mockUserData
  }
  const mockProxy = (userData, sequenceCallback) => {
    expect(userData).toEqual(mockUserData)
    setTimeout(() => sequenceCallback(null, mockResult), 10)
  }
  const mockValidateSuccessStatus = (result, finalCallback) => {
    expect(result).toEqual(mockResult)
    expect(finalCallback).toEqual(mockFinalCallback)
  }

  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  service.authorize = mockAuthorize
  service.proxy = mockProxy
  service.valiateSuccessStatus = mockValidateSuccessStatus
  serviceUtility.initiateHandledSequence((finalCallback, sequenceCallback) => service.proxyRequestSequence(finalCallback, sequenceCallback), mockFinalCallback)
})

test('authorize gets the security for the service and the user credentials then passes them to the validateAuthorization method', () => {
  const mockUserData = { hasProperties: 'userdata' }
  const mockEventType = { hasProperties: 'eventtype' }
  const mockStage = 'mockstage'
  const mockJsonWebToken = { hasProperties: 'jsonwebtoken' }
  const mockSecurity = ['MOCK_ROLES']
  const mockCredentials = { hasProperties: 'mockcredentials' }
  const mockJwt = 'mockjwt'

  const mockGetServiceValue = (eventType, stage, value, defaultValue) => {
    expect(eventType).toEqual(mockEventType)
    expect(stage).toEqual(mockStage)
    expect(value).toEqual('security')
    expect(defaultValue).toEqual([])
    return mockSecurity
  }

  const mockExtractUserDataFromJwt = (jwt, stage, jsonwebtoken, credentials) => {
    expect(jwt).toEqual(mockJwt)
    expect(stage).toEqual(mockStage)
    expect(jsonwebtoken).toEqual(mockJsonWebToken)
    expect(credentials).toEqual(mockCredentials)
    return mockUserData
  }

  const mockValidateAuthorization = (eventType, security, userAuthData) => {
    expect(eventType).toEqual(mockEventType)
    expect(security).toEqual(mockSecurity)
    expect(userAuthData).toEqual(userAuthData)
  }
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  service.validateAuthorization = mockValidateAuthorization
  service.extractUserDataFromJwt = mockExtractUserDataFromJwt
  service.getServiceValue = mockGetServiceValue
  expect(service.authorize(mockEventType, mockJwt, mockStage, mockJsonWebToken, mockCredentials)).toEqual(mockUserData)
})

test('extractUserDataFromJwt returns null if jwt is empty, otherwise uses jsonwebtoken library to decode jwt', () => {
  const mockJwt = 'mockjwt'
  const mockStage = 'mockstage'
  const mockUserData = { hasProperties: true }
  const mockKeySecret = 'mockkeysecret'
  const mockCredentials = {
    getIn: (keys, defaultValue) => {
      expect(keys).toEqual(['environments', mockStage, 'jwtKeySecret'])
      expect(defaultValue).toEqual('')
      return mockKeySecret
    }
  }
  const mockJsonWebToken = {
    verify: (jwt, keySecret) => {
      expect(jwt).toEqual(mockJwt)
      expect(keySecret).toEqual(mockKeySecret)
      return true
    },
    decode: (jwt) => {
      expect(jwt).toEqual('mockjwt')
      return mockUserData
    }
  }

  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  expect(service.extractUserDataFromJwt(null, mockStage, mockJsonWebToken, mockCredentials)).toEqual(null)
  expect(service.extractUserDataFromJwt(mockJwt, mockStage, mockJsonWebToken, mockCredentials)).toEqual(mockUserData)
})

test('validateAuthorization throws error if role is not authorized, otherwise returns user auth data', () => {
  const mockEventType = 'mockeventtype'
  const mockSecurity = ['MOCKROLES']
  const mockUserRoles = ['MOCKROLES']
  const mockUserAuthData = { roles: mockUserRoles }
  const mockRoleIsAuthorized = (security, userRoles) => {
    expect(security).toEqual(mockSecurity)
    expect(userRoles).toEqual(mockUserRoles)
    return true
  }

  const mockRoleIsUnauthorized = (security, userRoles) => {
    expect(security).toEqual(mockSecurity)
    expect(userRoles).toEqual(mockUserRoles)
    return false
  }

  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  service.roleIsAuthorized = mockRoleIsUnauthorized
  expect(() => service.validateAuthorization(mockEventType, mockSecurity, mockUserAuthData)).toThrow()
  service.roleIsAuthorized = mockRoleIsAuthorized
  expect(service.validateAuthorization(mockEventType, mockSecurity, mockUserAuthData)).toEqual(mockUserAuthData)
})

test('roleIsAuthorized returns true if security allows anonymous access or user has permitted role', () => {
  const mockAnonymousSecurity = ['ROLE_ANONYMOUS']
  const mockUserAccessRole = ['ROLE_PERMITTED']
  const mockUserNoAccessRole = ['ROLE_DENIED']
  const mockSecurityRole = ['ROLE_PERMITTED']
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  expect(service.roleIsAuthorized(mockAnonymousSecurity)).toBeTruthy()
  expect(service.roleIsAuthorized(mockAnonymousSecurity, mockUserAccessRole)).toBeTruthy()
  expect(service.roleIsAuthorized(mockAnonymousSecurity, mockUserNoAccessRole)).toBeTruthy()
  expect(service.roleIsAuthorized()).not.toBeTruthy()
  expect(service.roleIsAuthorized(mockSecurityRole, mockUserNoAccessRole)).not.toBeTruthy()
  expect(service.roleIsAuthorized(mockSecurityRole, mockUserAccessRole)).toBeTruthy()
})

test('proxy routes invalid provider error to callback', (done) => {
  const mockPayload = { hasProperties: 'mockpayload' }
  const mockServiceEvent = { payload: mockPayload }
  const mockStage = 'mockstage'
  const mockFuncName = 'mockfuncname'
  const mockFolder = 'mockfolder'
  const mockShell = 'mockshell'
  const mockServiceName = 'mockservicename'
  const mockAccount = 'mockAccount'
  const mockRegion = 'mockRegion'
  const mockCallback = (err, data) => {
    expect(err).toEqual(new Error('Invalid provider'))
    expect(data).toBeUndefined()
    done()
  }
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  service.proxy(null, mockCallback, null, mockStage, mockServiceEvent, mockServiceName, mockFolder, mockFuncName, mockShell, mockAccount, mockRegion)
})

test('proxy routes aws provider to aws invocation handler', (done) => {
  const mockCallback = () => {}
  const mockPayload = { hasProperties: 'mockpayload' }
  const mockServiceEvent = { payload: mockPayload }
  const mockStage = 'mockstage'
  const mockFuncName = 'mockfuncname'
  const mockFolder = 'mockfolder'
  const mockShell = 'mockshell'
  const mockServiceName = 'mockservicename'
  const mockAccount = 'mockAccount'
  const mockRegion = 'mockRegion'
  const mockInvokeLocalFunctionSequence = (proxyCallback, payload, func, folder, shell) => {
    throw new Error('Incorrect handler')
  }
  const mockInvokeViaAzureHttpSequence = (proxyCallback, payload, func) => {
    throw new Error('Incorrect handler')
  }
  function * mockInvokeLamdaSequence (proxyCallback, payload, stage, func, serviceName, account, region) {
    expect(proxyCallback).toEqual(mockCallback)
    expect(payload).toEqual(mockPayload)
    expect(stage).toEqual(mockStage)
    expect(func).toEqual(mockFuncName)
    expect(serviceName).toEqual(mockServiceName)
    expect(account).toEqual(mockAccount)
    expect(region).toEqual(mockRegion)
    done()
  }

  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  service.invokeLambdaSequence = mockInvokeLamdaSequence
  service.invokeLocalFunctionSequence = mockInvokeLocalFunctionSequence
  service.invokeViaAzureHttpSequence = mockInvokeViaAzureHttpSequence
  service.proxy(null, mockCallback, 'aws:lambda', mockStage, mockServiceEvent, mockServiceName, mockFolder, mockFuncName, mockShell, mockAccount, mockRegion)
})

test('proxy routes azure provider to azure invocation handler', (done) => {
  const mockCallback = () => {}
  const mockPayload = { hasProperties: 'mockpayload' }
  const mockServiceEvent = { payload: mockPayload }
  const mockStage = 'mockstage'
  const mockFuncName = 'mockfuncname'
  const mockFolder = 'mockfolder'
  const mockShell = 'mockshell'
  const mockServiceName = 'mockservicename'
  const mockAccount = 'mockAccount'
  const mockRegion = 'mockRegion'
  function * mockInvokeLocalFunctionSequence (proxyCallback, payload, func, folder, shell) {
    throw new Error('Incorrect handler')
  }
  function * mockInvokeViaAzureHttpSequence (proxyCallback, payload, func) {
    expect(proxyCallback).toEqual(mockCallback)
    expect(payload).toEqual(mockPayload)
    expect(func).toEqual(mockFuncName)
    done()
  }
  function * mockInvokeLamdaSequence (proxyCallback, payload, stage, func, serviceName, account, region) {
    throw new Error('Incorrect handler')
  }

  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  service.invokeLambdaSequence = mockInvokeLamdaSequence
  service.invokeLocalFunctionSequence = mockInvokeLocalFunctionSequence
  service.invokeViaAzureHttpSequence = mockInvokeViaAzureHttpSequence
  service.proxy(null, mockCallback, 'azure:http', mockStage, mockServiceEvent, mockServiceName, mockFolder, mockFuncName, mockShell, mockAccount, mockRegion)
})

test('proxy routes local provider to local invocation handler', (done) => {
  const mockCallback = () => {}
  const mockPayload = { hasProperties: 'mockpayload' }
  const mockServiceEvent = { payload: mockPayload }
  const mockStage = 'mockstage'
  const mockFuncName = 'mockfuncname'
  const mockFolder = 'mockfolder'
  const mockShell = 'mockshell'
  const mockServiceName = 'mockservicename'
  const mockAccount = 'mockAccount'
  const mockRegion = 'mockRegion'
  function * mockInvokeLocalFunctionSequence (proxyCallback, payload, func, folder, shell) {
    expect(proxyCallback).toEqual(mockCallback)
    expect(payload).toEqual(mockPayload)
    expect(func).toEqual(mockFuncName)
    expect(folder).toEqual(mockFolder)
    expect(shell).toEqual(mockShell)
    done()
  }
  function * mockInvokeViaAzureHttpSequence (proxyCallback, payload, func) {
    throw new Error('Incorrect handler')
  }
  function * mockInvokeLamdaSequence (proxyCallback, payload, stage, func, serviceName, account, region) {
    throw new Error('Incorrect handler')
  }

  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  service.invokeLambdaSequence = mockInvokeLamdaSequence
  service.invokeLocalFunctionSequence = mockInvokeLocalFunctionSequence
  service.invokeViaAzureHttpSequence = mockInvokeViaAzureHttpSequence
  service.proxy(null, mockCallback, 'local', mockStage, mockServiceEvent, mockServiceName, mockFolder, mockFuncName, mockShell, mockAccount, mockRegion)
})

test('invokeViaAzureHttpSequence makes an http request to azure function and passes result through callback', (done) => {
  const mockBody = { hasProperties: 'mockbody' }
  const mockBodyStringified = JSON.stringify(mockBody)
  const mockFunc = 'mockfunc'
  const mockPayload = { hasProperties: 'mockpayload' }

  const mockCallback = (err, data) => {
    expect(err).toBeNull()
    expect(data).toEqual(mockBody)
    done()
  }
  const mockRequest = (parameters, callback) => {
    expect(parameters.url).toEqual(mockFunc)
    expect(parameters.json).toBeTruthy()
    expect(parameters.body).toEqual(mockPayload)
    expect(typeof callback).toEqual('function')
    setTimeout(() => callback(null, null, mockBodyStringified), 10)
  }

  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  serviceUtility.initiateSequence(service.invokeViaAzureHttpSequence(mockCallback, mockPayload, mockFunc, mockRequest), mockCallback)
})

test('invokeLambdaSequence makes an SDK request to aws lambda and passes result through callback', (done) => {
  const mockPayloadResponse = { hasProperties: true }
  const mockBody = { Payload: JSON.stringify(mockPayloadResponse) }
  const mockFunc = 'mockfunc'
  const mockPayload = { hasProperties: 'mockpayload' }
  const mockStage = 'mockstage'
  const mockServiceName = 'mockservicename'
  const mockAccount = 'mockaccount'
  const mockRegion = 'mockregion'
  const mockAppName = 'mockappname'
  const mockCallback = (err, data) => {
    expect(err).toBeNull()
    expect(data).toEqual(mockPayloadResponse)
    done()
  }

  const mockAWS = {
    Lambda: class {
      constructor () {
        return {
          invoke: (parameters, sequenceCallback) => {
            expect(parameters.FunctionName).toEqual(`${mockAccount}:${mockAppName}-${mockServiceName}-${mockStage}-${mockFunc}`)
            expect(parameters.Payload).toEqual(JSON.stringify(mockPayload, null, 2))
            setTimeout(() => sequenceCallback(null, mockBody), 10)
          }
        }
      }
    }
  }
  const mockParameters = {
    get: (value) => {
      expect(value).toEqual('appName')
      return mockAppName
    }
  }

  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  serviceUtility.initiateSequence(service.invokeLambdaSequence(mockCallback, mockPayload, mockStage, mockFunc, mockServiceName, mockAccount, mockRegion, mockAWS, mockParameters), mockCallback)
})

test('invokeLocalFunctionSequence uses yarn to call serverless invoke local', (done) => {
  const mockResponse = { hasProperties: 'mockresponse' }
  const mockFunc = 'mockfunc'
  const mockPayload = { hasProperties: 'mockpayload' }
  const mockFolder = 'mockfolder'
  const mockShell = 'mockshell'
  const mockBytes = {
    toString: (encoding) => {
      expect(encoding).toEqual('utf8')
      return JSON.stringify(mockResponse)
    }
  }
  const mockStdioOptions = {
    stdio: 'pipe',
    cwd: mockFolder,
    shell: true
  }
  const mockInvocation = {
    stdout: {
      on: (eventName, lambda) => {
        expect(eventName).toEqual('data')
        setTimeout(() => lambda(mockBytes), 10)
      }
    },
    on: (eventName, lambda) => {
      expect(eventName).toEqual('close')
      setTimeout(() => lambda(null), 20)
    }
  }
  const mockSpawnNotPowershell = (command, args, stdioOptions) => {
    expect(command).toEqual(`./node_modules/.bin/sls invoke local -f ${mockFunc} -d '{"hasProperties":"mockpayload"}'`)
    expect(args).toEqual([])
    expect(stdioOptions).toEqual(mockStdioOptions)
    return mockInvocation
  }
  const mockSpawnPowershell = (command, args, stdioOptions) => {
    expect(command).toEqual(`powershell.exe -Command ./node_modules/.bin/sls invoke local -f ${mockFunc} -d '{\\\\\\"hasProperties\\\\\\":\\\\\\"mockpayload\\\\\\"}'`)
    expect(args).toEqual([])
    expect(stdioOptions).toEqual(mockStdioOptions)
    return mockInvocation
  }

  const mockCallback = (err, data) => {
    expect(err).toBeNull()
    expect(data).toEqual(mockResponse)
  }

  const mockCallbackFinal = (err, data) => {
    expect(err).toBeNull()
    expect(data).toEqual(mockResponse)
    done()
  }
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  serviceUtility.initiateSequence(service.invokeLocalFunctionSequence(mockCallback, mockPayload, mockFunc, mockFolder, mockShell, mockSpawnNotPowershell), mockCallback)
  serviceUtility.initiateSequence(service.invokeLocalFunctionSequence(mockCallbackFinal, mockPayload, mockFunc, mockFolder, 'powershell', mockSpawnPowershell), mockCallbackFinal)
})

test('extractErrorMessageForResponse should extract the message from error object if it exists', () => {
  const mockError = new Error('test error')
  const mockDefaultMessage = 'mockdefaultmessage'
  const mockStage = 'mockstage'
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  expect(service.extractErrorMessageForResponse(mockError, mockDefaultMessage, mockStage)).toEqual('test error')
  expect(service.extractErrorMessageForResponse(mockError, mockDefaultMessage, 'development')).toEqual(mockError.stack)
  expect(service.extractErrorMessageForResponse({}, mockDefaultMessage, mockStage)).toEqual(mockDefaultMessage)
})

test('extractAuthenticationToken should return the Authorization header if it exists in the object passed in', () => {
  const mockHeaderData = {
    Authorization: 'mockauthorization'
  }
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  expect(service.extractAuthenticationToken(mockHeaderData)).toEqual('mockauthorization')
})

test('extractJwt should return the jwt token if it exists in the string as a standard bearer token', () => {
  const mockAuthorization = 'Bearer: mockjwt'
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  expect(service.extractJwt(mockAuthorization)).toEqual('mockjwt')
  expect(service.extractJwt()).toBeNull()
})

test('prepareErrorResponse will return a proper http response, even when the provider is azure', () => {
  const mockAwsResponse = {
    statusCode: 403,
    body: '{"status":false,"errors":{"message":"test error"}}',
    headers: {
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    'isBase64Encoded': false
  }
  const mockAzureResponse = {
    status: 403,
    body: '{"status":false,"errors":{"message":"test error"}}',
    headers: {
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    'isBase64Encoded': false
  }

  const mockError = new Error('test error')
  const mockProvider = 'mockprovider'
  const mockAzureProvider = 'azure'
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  expect(service.prepareErrorResponse(mockError, mockProvider, mockAwsResponse)).toEqual(mockAwsResponse)
  expect(service.prepareErrorResponse(mockError, mockAzureProvider, mockAzureResponse)).toEqual(mockAzureResponse)
})

test('prepareSuccessResponse will return a proper http response, even when the provider is azure', () => {
  const mockData = { hasProperties: 'mockdata' }

  const mockAwsResponse = {
    statusCode: 200,
    body: JSON.stringify(mockData),
    headers: {
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    'isBase64Encoded': false
  }
  const mockAzureResponse = {
    status: 200,
    body: JSON.stringify(mockData),
    headers: {
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    'isBase64Encoded': false
  }

  const mockProvider = 'mockprovider'
  const mockAzureProvider = 'azure'
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  expect(service.prepareSuccessResponse(mockData, mockProvider, mockAwsResponse)).toEqual(mockAwsResponse)
  expect(service.prepareSuccessResponse(mockData, mockAzureProvider, mockAzureResponse)).toEqual(mockAzureResponse)
})

test('prepareAccessDeniedResponse will return a proper http response, even when the provider is azure', (done) => {
  const mockPrepareErrorResponse = (error) => {
    expect(error).toEqual(new Error('Access denied'))
    done()
  }
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  service.prepareErrorResponse = mockPrepareErrorResponse
  service.prepareAccessDeniedResponse()
})

test('getServiceValue will return property value in services config', () => {
  const mockEventType = 'mockeventtype'
  const mockStage = 'mockstage'
  const mockValue = 'mockvalue'
  const mockDefaultValue = 'mockdefaltvalue'
  const mockServices = {
    getIn: (keys, defaultValue) => {
      expect(Array.isArray(keys)).toBeTruthy()
      return true
    }
  }
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  expect(service.getServiceValue(mockEventType, mockStage, mockValue, mockDefaultValue, mockServices)).toBeTruthy()
})

test('validateSuccessStatus throws error if invocation response has a false status', () => {
  const mockResult = { status: false }
  const mockValidResult = { status: true }
  const GatewayService = require('../service')
  const service = new GatewayService('test', './test/credentials', './test/services', './test/parameters', 'aws')
  expect(() => service.validateSuccessStatus(mockResult)).toThrow()
  service.validateSuccessStatus(mockValidResult)
})
