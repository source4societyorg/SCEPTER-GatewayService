process.env.CREDENTIALS_PATH = './test/credentials.json'
process.env.SERVICES_PATH = './test/services.json'
const handler = require('../handler')

test('Handler will respond with success response on proper authentication', (done) => {
  // mock the service class
  const result = {status: true, result: {message: 'Things worked out'}}
  const mockAuthorize = (authCallback, event, jwt) => authCallback(null, true)
  const mockProxy = (event, proxyCallback) => proxyCallback(null, result)
  const callback = (err, data) => {
    expect(err).toBeNull()
    expect(data.statusCode).toBe(200)
    expect(data.body).toEqual(JSON.stringify(result))
    done()
  }

  global.service = {
    authorize: mockAuthorize,
    proxy: mockProxy
  }

  handler.proxy({body: JSON.stringify({type: 'TEST_ANONYMOUS', payload: {}})}, null, callback)
})

test('Handler will respond with 403 code when authorization failed', (done) => {
  // mock the service class
  const result = {status: false, errors: {code: 403, message: 'Access denied'}}
  const mockAuthorize = (authCallback, event, jwt) => authCallback(null, false)
  const mockProxy = (event, proxyCallback) => proxyCallback(null, result)
  const callback = (err, data) => {
    expect(err).toBeNull()
    expect(data.statusCode).toBe(403)
    expect(data.body).toEqual(JSON.stringify(result))
    done()
  }

  global.service = {
    authorize: mockAuthorize,
    proxy: mockProxy
  }

  handler.proxy({body: JSON.stringify({type: 'TEST_ANONYMOUS', payload: {}})}, null, callback)
})

test('Handler will respond with access denied response when proxy returns error', (done) => {
  // mock the service class
  const result = {status: false, errors: {code: 403, message: 'Access denied'}}
  const mockAuthorize = (authCallback, event, jwt) => authCallback(null, true)
  const mockProxy = (event, proxyCallback) => proxyCallback(result, null)
  const callback = (err, data) => {
    expect(err).toBeNull()
    expect(data.statusCode).toBe(403)
    expect(data.body).toEqual(JSON.stringify(result))
    done()
  }

  global.service = {
    authorize: mockAuthorize,
    proxy: mockProxy
  }

  handler.proxy({body: JSON.stringify({type: 'TEST_ANONYMOUS', payload: {}})}, null, callback)
})

test('Handler will respond with error code and response when authorization throws an error', (done) => {
  // mock the service class
  const mockAuthorize = (authCallback, event, jwt) => { throw new Error('some error') }
  const callback = (err, data) => {
    expect(err).toBeNull()
    expect(data.statusCode).toBe(500)
    done()
  }

  global.service = {
    authorize: mockAuthorize
  }

  handler.proxy({body: JSON.stringify({type: 'TEST_ANONYMOUS', payload: {}})}, null, callback)
})

test('Handler will respond with error code and response when authorization returns an error', (done) => {
  // mock the service class
  const mockAuthorize = (authCallback, event, jwt) => authCallback({code: 500, message: 'Some error'})
  const callback = (err, data) => {
    expect(err).toBeNull()
    expect(data.statusCode).toBe(500)
    done()
  }

  global.service = {
    authorize: mockAuthorize
  }

  handler.proxy({body: JSON.stringify({type: 'TEST_ANONYMOUS', payload: {}})}, null, callback)
})
