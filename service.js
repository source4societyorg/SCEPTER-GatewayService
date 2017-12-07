'use strict'

class GatewayService {
  constructor (stage = 'dev', credentialsPath = './credentials.json', servicesPath = './services.json') {
    const { spawn } = require('child_process')
    const jsonwebtoken = require('jsonwebtoken')
    const AWS = require('aws-sdk')
    this.credentials = require(credentialsPath)
    this.services = require(servicesPath)
    this.stage = stage
    this.spawn = spawn
    this.jsonwebtoken = jsonwebtoken
    this.AWS = AWS
  }

  authorize (authCallback, event, jwt) {
    const eventType = event.type
    const keySecret = this.credentials.environments[this.stage].jwtKeySecret
    const security = this.getRoleAccess(eventType)
    let userData = null
    let userRoles = []
    if (jwt !== null && typeof jwt !== 'undefined' && jwt !== '') {
      try {
        this.jsonwebtoken.verify(jwt, keySecret)
        userData = this.jsonwebtoken.decode(jwt)
        userRoles = userData.roles
      } catch (err) {
        authCallback({message: err.message, code: 403})
        return
      }
    }

    if ((security.indexOf('ROLE_ANONYMOUS') > -1) || security.some((value) => userRoles.indexOf(value) > -1)) {
      authCallback(null, true)
    } else {
      authCallback({message: 'Access denied', code: 403}, null)
    }
  }

  proxy (event, proxyCallback) {
    const eventType = event.type
    const payload = event.payload
    const provider = this.services.environments[this.stage].configuration[eventType].provider || this.services.environments[this.stage].provider
    const serviceName = this.services.environments[this.stage].configuration[eventType].serviceName
    const folder = '../' + serviceName
    const func = this.services.environments[this.stage].configuration[eventType].function
    const shell = this.services.environments[this.stage].configuration[eventType].shell || '/bin/bash'
    const account = this.credentials.environments[this.stage].configuration.account || ''
    const region = this.credentials.environments[this.stage].configuration.region || ''

    switch (provider) {
      case 'local':
        this.invokeLocalFunction(proxyCallback, payload, func, folder, shell)
        break
      case 'aws:lambda':
        this.invokeLambda(proxyCallback, payload, func, serviceName, account, region)
        break
    }
  }

  invokeLambda (proxyCallback, payload, func, serviceName, account, region) {
    let lambda = new this.AWS.Lambda({region: region})
    lambda.invoke({
      FunctionName: account + ':' + serviceName + '-' + this.stage + '-' + func,
      Payload: JSON.stringify(payload, null, 2)
    }, (err, data) => this.functionInvocationCallback(err, typeof data !== 'undefined' && data !== null ? data.Payload || null : null, proxyCallback, true))
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
    const result = typeof data === 'string' ? JSON.parse(data.toString('utf8')) : data
    if ((typeof err !== 'undefined' && err !== null) || result.status !== true) {
      proxyCallback(err || result.errors)
    } else {
      proxyCallback(null, result)
    }
  }

  getRoleAccess (eventType) {
    return typeof this.services.environments[this.stage].configuration[eventType] !== 'undefined'
      ? this.services.environments[this.stage].configuration[eventType].security || [] : []
  }
};

module.exports = GatewayService
