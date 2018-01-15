'use strict'
const universalProxy = require('./handler.proxyRequest').proxyRequest
const awsProxy = (event, context, callback) => universalProxy(event, context, callback)
const azureProxy = (context, req) => universalProxy(req, context, (err, res) => { context.done(err, res) })
switch (process.env.PROVIDER) {
  case 'azure':    
    module.exports.proxyRequest = azureProxy
    break
  default:
    module.exports.proxyRequest = awsProxy
}
