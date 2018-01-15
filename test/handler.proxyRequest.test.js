process.env.CREDENTIALS_PATH = './test/credentials.json'
process.env.SERVICES_PATH = './test/services.json'
const handler = require('../handler.proxyRequest')

test('proxyRequest handler will invoke the service by extracting an authentication token and then passing it to the services authorization function', (done) => {
  process.env.environment = 'test'

  const testRequest = require('./testRequest.json')
  const mockServiceFunction = () => 'mockresult'
  const mockService = {
    authorize: () => done(),
    extractAuthenticationToken: mockServiceFunction,
    extractJwt: mockServiceFunction
  }
  const mockServiceConstructor = () => mockService
  handler.proxyRequest(testRequest, null, null, mockServiceConstructor)
})

test('make authorization callback will produce a callback capable of calling the service.proxy function on success, return an access denied response on error', (done) => {
  let proxyServiceWasCalledSuccessfully = false
  const mockEvent = { type: 'MOCK_EVENT', payload: {} }
  const mockService = { proxy: () => { proxyServiceWasCalledSuccessfully = true } }
  const mockAccessDeniedResponse = () => { expect(proxyServiceWasCalledSuccessfully).toBe(true); done() }
  const makeAuthCallback = handler.getMakeAuthCallback(mockService, mockAccessDeniedResponse)
  const authCallback = makeAuthCallback(mockEvent)
  authCallback(true)
  authCallback(false)
})

test('proxyRequest handler will catch errors and redirect to the injected error handler', (done) => {
  process.env.environment = 'test'
  process.env.CREDENTIALS_PATH = './test/credentials.json'
  process.env.SERVICES_PATH = './test/services.json'
  const testRequest = require('./testRequest.json')
  const mockGetDependency = () => () => true
  const mockGetErrorHandlerDependency = () => (error) => { expect(error.message).toEqual('test error'); done() }
  const mockService = {
    extractAuthenticationToken: () => { throw new Error('test error') }
  }
  const mockServiceConstructor = () => mockService
  handler.proxyRequest(testRequest, null, null, mockServiceConstructor, undefined, undefined, undefined, mockGetDependency, mockGetDependency, mockGetErrorHandlerDependency)
})

test('proxyRequest handler returns valid response on success with valid input', (done) => {
  process.env.environment = 'test'
  process.env.CREDENTIALS_PATH = './test/credentials.json'
  process.env.SERVICES_PATH = './test/services.json'

  const mockCallback = (err, data) => {
    expect(err).toBeNull()
    expect(data).not.toBeUndefined()
    done()
  }

  const testRequest = require('./testRequest.json')
  handler.proxyRequest(testRequest, null, mockCallback)
})

test('that proxyRequest throws error if request body is undefined', (done) => {
  const mockServiceConstructor = () => ({
    extractAuthenticationToken: () => ({}),
    extractJwt: () => ({})
  })
  const mockCallback = () => done()
  const mockGetDependency = () => () => ({})
  const mockErrorHandler = () => (error) => {
    expect(error.message).toEqual('Event body is undefined')
    done()
  }

  handler.proxyRequest(
    { },
    undefined,
    mockCallback,
    mockServiceConstructor,
    undefined,
    undefined,
    undefined,
    undefined,
    mockGetDependency,
    mockErrorHandler
  )
})

test('that proxyRequest parses JSON body twice for Azure', (done) => {
  const mockServiceConstructor = () => ({
    extractAuthenticationToken: () => ({}),
    extractJwt: () => ({}),
    authorize: () => done()
  })
  const mockCallback = () => done()

  handler.proxyRequest(
    { body: JSON.stringify('{ "type": "TEST", "payload": {} }') },
    undefined,
    mockCallback,
    mockServiceConstructor
  )
})
