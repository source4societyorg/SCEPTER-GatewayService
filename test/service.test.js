const GatewayService = require('../service')
const serviceconfig = require('./services')
const credentialconfig = require('./credentials')
const jsonwebtoken = require('jsonwebtoken')

test('proxy function will spawn process for local provider and return payload if status is true', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  service.services = serviceconfig
  service.credentials = credentialconfig

  // mock function invocation result (note real result will be in bytes)
  const result = JSON.stringify({status: true, result: {message: 'Payload goes in the result field'}})
  // mock EventEmitter
  const onMock = (eventName, callback) => callback(result)
  // mock the spawn function
  service.spawn = (command, args, options) => ({stdout: {on: onMock}})

  const finalCallback = (err, data) => {
    expect(data).toEqual(JSON.parse(result))
    expect(err).toBeNull()
    done()
  }

  service.proxy({type: 'TEST_ANONYMOUS', payload: {}}, true, finalCallback)
})

test('proxy function will spawn process for local provider and return error if status is false', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  service.services = serviceconfig
  service.credentials = credentialconfig

  // mock function invocation result (note real result will be in bytes)
  const result = JSON.stringify({status: false, errors: {message: 'Payload goes in the error field', code: 403}})
  // mock EventEmitter
  const onMock = (eventName, callback) => callback(result)
  // mock the spawn function
  service.spawn = (command, args, options) => ({stdout: {on: onMock}})

  const finalCallback = (err, data) => {
    expect(err).toEqual(JSON.parse(result).errors)
    expect(data).toBeUndefined()
    done()
  }

  service.proxy({type: 'TEST_ANONYMOUS', payload: {}}, true, finalCallback)
})

test('proxy function will use AWS SDK to invoke aws:lambda provider and return payload if status is true', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  service.services = serviceconfig
  service.credentials = credentialconfig

  // mock function invocation result (note real result will be in bytes)
  const result = {Payload: {status: true, result: {message: 'Payload'}}}
  // mock Lambda.invoke
  const invokeMock = (options, callback) => callback(null, result)

  // mock the AWS.Lambda function
  service.AWS = {Lambda: function (region) { return ({invoke: invokeMock}) }}

  const finalCallback = (err, data) => {
    expect(err).toBeNull()
    expect(data).toEqual(result.Payload)
    done()
  }

  service.proxy({type: 'TEST_LAMBDA', payload: {}}, true, finalCallback)
})

test('Constructor will set stage when passed as argument', () => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  expect(service.stage).toBe('test')
})

test('Credentials and Services are properly defined', () => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  service.services = serviceconfig
  service.credentials = credentialconfig
  expect(service.credentials).not.toBeUndefined()
  expect(service.services).not.toBeUndefined()
  expect(service.credentials.environments).not.toBeUndefined()
  expect(service.services.environments).not.toBeUndefined()
  expect(service.credentials.environments[service.stage]).not.toBeUndefined()
  expect(service.credentials.environments[service.stage].jwtKeySecret).not.toBeUndefined()
  expect(service.services.environments[service.stage]).not.toBeUndefined()
  expect(service.services.environments[service.stage].provider).not.toBeUndefined()
  expect(service.credentials.environments[service.stage].provider).not.toBeUndefined()
  expect(service.services.environments[service.stage].configuration).not.toBeUndefined()
  expect(service.credentials.environments[service.stage].configuration).not.toBeUndefined()
})

test('authorize function will reject invalid jwt', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  service.services = serviceconfig
  service.credentials = credentialconfig

  const callback = (err, data) => {
    expect(err).not.toBeNull()
    expect(err).not.toBeUndefined()
    expect(data).toBeUndefined()
    done()
  }

  service.authorize({type: 'AUTHORIZE', payload: {jwt: 'fake'}}, 'fake', callback)
})

test('authorize function will accept valid jwt and authorized role', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  const userdata = {username: 'test', roles: ['TEST']}
  service.services = serviceconfig
  service.credentials = credentialconfig

  const callback = (err, data) => {
    expect(data).not.toBeUndefined()
    expect(err).toBeNull()
    done()
  }

  const jwt = jsonwebtoken.sign(userdata, service.credentials.environments[service.stage].jwtKeySecret)
  service.authorize({type: 'TEST', payload: {}}, jwt, callback)
})

test('authorize function will reject jwt when user doesnt have the proper role access', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  const userdata = {username: 'test', roles: ['NO_ACCESS']}
  service.services = serviceconfig
  service.credentials = credentialconfig

  const callback = (err, data) => {
    expect(data).toBeNull()
    expect(err).not.toBeNull()
    expect(err).not.toBeUndefined()
    done()
  }

  const jwt = jsonwebtoken.sign(userdata, service.credentials.environments[service.stage].jwtKeySecret)
  service.authorize({type: 'TEST', payload: {}}, jwt, callback)
})

test('authorize function will reject expired jwt', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  const userdata = {username: 'test', roles: ['TEST']}
  service.services = serviceconfig
  service.credentials = credentialconfig

  const callback = (err, data) => {
    expect(data).toBeUndefined()
    expect(err).not.toBeNull()
    expect(err).not.toBeUndefined()
    done()
  }

  const jwt = jsonwebtoken.sign(userdata, service.credentials.environments[service.stage].jwtKeySecret, {expiresIn: '-1d'})
  service.authorize({type: 'TEST', payload: {}}, jwt, callback)
})

test('authorize function will reject jwt with invalid signature', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  const userdata = {username: 'test', roles: ['TEST']}
  service.services = serviceconfig
  service.credentials = credentialconfig

  const callback = (err, data) => {
    expect(data).toBeUndefined()
    expect(err).not.toBeNull()
    expect(err).not.toBeUndefined()
    done()
  }

  const jwt = jsonwebtoken.sign(userdata, 'fakekey')
  service.authorize({type: 'TEST', payload: {}}, jwt, callback)
})

test('authorize function will authorize events with anonymous access even when jwt not provided', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  service.services = serviceconfig
  service.credentials = credentialconfig

  const callback = (err, data) => {
    expect(data).toBe(true)
    expect(err).toBeNull()
    done()
  }

  service.authorize({type: 'TEST_ANONYMOUS', payload: {}}, '', callback)
})

test('authorize function will authorize events with anonymous access when jwt valid', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  const userdata = {username: 'test', roles: ['TEST']}
  service.services = serviceconfig
  service.credentials = credentialconfig

  const callback = (err, data) => {
    expect(data).not.toBeUndefined()
    expect(err).toBeNull()
    done()
  }

  const jwt = jsonwebtoken.sign(userdata, service.credentials.environments[service.stage].jwtKeySecret, {expiresIn: '1d'})
  service.authorize({type: 'TEST_ANONYMOUS', payload: {}}, jwt, callback)
})

test('service will prepare an access denied response when function invoked', () => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  const response = service.prepareAccessDeniedResponse()
  expect(response.headers).not.toBeUndefined()
  expect(response.statusCode).toEqual(403)
  expect(response.body).toEqual('{"status":false,"errors":{"code":403,"message":"Access denied"}}')
})

test('service will prepare a success response when function invoked with data', () => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  const mockData = {somedata: 'sometestdata'}
  const response = service.prepareSuccessResponse(mockData)
  expect(response.headers).not.toBeUndefined()
  expect(response.statusCode).toEqual(200)
  expect(response.body).toEqual(JSON.stringify(mockData))
})

test('all branches of extracting error message from response', () => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  let message = ''
  let mockError1
  let mockError2 = {message: 'test message'}
  let mockError3 = {errors: {message: 'test message'}}
  let mockError4 = {}
  let mockError5 = 'test message'

  message = service.extractErrorMessageFromResponse(mockError1, 'default')
  expect(message).toEqual('default')
  message = service.extractErrorMessageFromResponse(mockError2)
  expect(message).toEqual('test message')
  message = service.extractErrorMessageFromResponse(mockError3)
  expect(message).toEqual('test message')
  message = service.extractErrorMessageFromResponse(mockError4)
  expect(message).toEqual('Unexpected Error.')
  message = service.extractErrorMessageFromResponse(mockError5)
  expect(message).toEqual('test message')
})

test('all branches of extracting error codes from response', () => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  let code = -1
  let mockError1 = { code: 403 }
  let mockError2 = { errors: { code: 403 } }
  let mockError3 = { code: undefined }
  let mockError4 = { code: 'not a number' }
  let mockError5 = 'test message'
  let mockError6 = { errors: { code: {} } }

  code = service.extractErrorCodeFromResponse(mockError1)
  expect(code).toEqual(403)
  code = service.extractErrorCodeFromResponse(mockError2)
  expect(code).toEqual(403)
  code = service.extractErrorCodeFromResponse(mockError3)
  expect(code).toEqual(500)
  code = service.extractErrorCodeFromResponse(mockError4, 401)
  expect(code).toEqual(401)
  code = service.extractErrorCodeFromResponse(mockError5)
  expect(code).toEqual(500)
  code = service.extractErrorCodeFromResponse(mockError6)
  expect(code).toEqual(500)
  code = service.extractErrorCodeFromResponse()
  expect(code).toEqual(500)
})

test('role access returns the role access specified in configuration or an empty array by default', () => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  let security = service.getRoleAccess('undefined service')
  expect(security).toEqual([])
  security = service.getRoleAccess('TEST')
  expect(security).toEqual(serviceconfig.environments['test'].configuration['TEST'].security)
  security = service.getRoleAccess('DEFAULT_SECURITY')
  expect(security).toEqual([])
})

test('extracting jwt from headers', () => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  const mockHeaderWithoutAuth = { otherheader: 'no auth here' }
  let header = service.extractAuthenticationToken({ 'Authorization': 'Bearer: jwttoken' })
  let token = service.extractJwt(header)
  expect(token).toEqual('jwttoken')
  header = service.extractAuthenticationToken(mockHeaderWithoutAuth)
  expect(header).toEqual(mockHeaderWithoutAuth)
  token = service.extractJwt()
  expect(token).toBeNull()
  header = service.extractAuthenticationToken()
  expect(header).toBeUndefined()
})

test('default credential settings', () => {
  const service = new GatewayService('test2', './test/credentials.json', './test/services.json')
  expect(service.account).toEqual('')
  expect(service.region).toEqual('')
})

test('aws lambda invocation returns a payload on callback or defaults to null', () => {
  let mockResultData
  const invokeMock = (params, callback) => callback(null, mockResultData)
  const mockLambda = function (region) { return ({invoke: invokeMock}) }
  let mockInvocationCallback = (err, data) => {
    expect(err).toBeNull()
    expect(data).toBeNull()
  }
  let service = new GatewayService('test2', './test/credentials.json', './test/services.json')
  service.functionInvocationCallback = mockInvocationCallback
  service.AWS = { Lambda: mockLambda }
  service.invokeLambda()
  mockResultData = { nopayload: 'nopayload' }
  service.invokeLambda()
  mockResultData = { Payload: 'payload' }
  mockInvocationCallback = (err, data) => {
    expect(err).toBeNull()
    expect(data).not.toBeUndefined()
    expect(data).toEqual('payload')
  }
  service.functionInvocationCallback = mockInvocationCallback
  service.invokeLambda()
})

test('function invocation callback parses data if it is a string and handles errors', (done) => {
  let service = new GatewayService('test2', './test/credentials.json', './test/services.json')
  let mockProxyCallback = (err, data) => {
    expect(err).toBeNull()
    expect(data).not.toBeUndefined()
  }
  service.functionInvocationCallback(null, '{"status":true,"data":"test"}', mockProxyCallback)
  mockProxyCallback = (err, data) => {
    expect(err).not.toBeNull()
  }
  service.functionInvocationCallback(new Error('test error'), null, mockProxyCallback)
  service.functionInvocationCallback(null, {status: false, errors: new Error('test error')}, mockProxyCallback)
  mockProxyCallback = (err, data) => {
    expect(err).not.toBeNull()
    expect(err).not.toBeUndefined()
    done()
  }
  service.functionInvocationCallback(null, JSON.stringify({status: false, errors: new Error('test error')}), mockProxyCallback)
})
