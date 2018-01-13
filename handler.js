'use strict'
const universalProxy = require('./handler.proxyRequest').proxyRequest
const awsProxy = (event, context, callback) => universalProxy(event, context, callback)
const azureProxy = (context, req) => universalProxy(req, context, context.done)
switch(process.env.PROVIDER) {
  case 'azure':
    module.exports.proxyRequest = azureProxy
  default:
    module.exports.proxyRequest = awsProxy
}