'use strict'
const universalProxy = require('./handler.proxy').proxy
const awsProxy = (event, context, callback) => (universalProxy(event, context, callback))()
const azureProxy = (context, req) => (universalProxy(req, context, context.done))()
switch(process.env.PROVIDER) {
  case 'azure':
    module.exports.proxy = azureProxy
  default:
    module.exports.proxy = awsProxy
}