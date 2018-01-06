const GatewayService = require('../service')
const jsonwebtoken = require('jsonwebtoken')
const credentialconfig = require('./credentials')
const serviceconfig = require('./services')

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

  service.authorize(callback, {type: 'AUTHORIZE', payload: {jwt: 'fake'}}, 'fake')
})

test('authorize function will accept valid jwt and authorized role', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  service.services = serviceconfig
  service.credentials = credentialconfig

  const callback = (err, data) => {
    expect(data).toBe(true)
    expect(err).toBeNull()
    done()
  }

  const jwt = jsonwebtoken.sign({username: 'test', roles: ['TEST']}, service.credentials.environments[service.stage].jwtKeySecret)
  service.authorize(callback, {type: 'TEST', payload: {}}, jwt)
})

test('authorize function will reject jwt when user doesnt have the proper role access', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  service.services = serviceconfig
  service.credentials = credentialconfig

  const callback = (err, data) => {
    expect(data).toBeNull()
    expect(err).not.toBeNull()
    expect(err).not.toBeUndefined()
    done()
  }

  const jwt = jsonwebtoken.sign({username: 'test', roles: ['NO_ACCESS']}, service.credentials.environments[service.stage].jwtKeySecret)
  service.authorize(callback, {type: 'TEST', payload: {}}, jwt)
})

test('authorize function will reject expired jwt', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  service.services = serviceconfig
  service.credentials = credentialconfig

  const callback = (err, data) => {
    expect(data).toBeUndefined()
    expect(err).not.toBeNull()
    expect(err).not.toBeUndefined()
    done()
  }

  const jwt = jsonwebtoken.sign({username: 'test', roles: ['TEST']}, service.credentials.environments[service.stage].jwtKeySecret, {expiresIn: '-1d'})
  service.authorize(callback, {type: 'TEST', payload: {}}, jwt)
})

test('authorize function will reject jwt with invalid signature', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  service.services = serviceconfig
  service.credentials = credentialconfig

  const callback = (err, data) => {
    expect(data).toBeUndefined()
    expect(err).not.toBeNull()
    expect(err).not.toBeUndefined()
    done()
  }

  const jwt = jsonwebtoken.sign({username: 'test', roles: ['TEST']}, 'fakekey')
  service.authorize(callback, {type: 'TEST', payload: {}}, jwt)
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

  service.authorize(callback, {type: 'TEST_ANONYMOUS', payload: {}}, '')
})

test('authorize function will authorize events with anonymous access when jwt valid', (done) => {
  const service = new GatewayService('test', './test/credentials.json', './test/services.json')
  service.services = serviceconfig
  service.credentials = credentialconfig

  const callback = (err, data) => {
    expect(data).toBe(true)
    expect(err).toBeNull()
    done()
  }

  const jwt = jsonwebtoken.sign({username: 'test', roles: ['TEST']}, service.credentials.environments[service.stage].jwtKeySecret, {expiresIn: '1d'})
  service.authorize(callback, {type: 'TEST_ANONYMOUS', payload: {}}, jwt)
})
