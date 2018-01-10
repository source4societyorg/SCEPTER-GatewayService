const handlerUtilities = require('../handlerUtilities')
const GatewayService = require('../service')

test('gateway service constructor builds a new gateway service', () => {
  const service = handlerUtilities.constructGatewayService()
  expect(service).toBeInstanceOf(GatewayService)
})

test('make access denied response builds a response from the appropriate service call and sends it to the callback', (done) => {
  let calledPrepareAccessDeniedResponse = false
  const mockService = {
    prepareAccessDeniedResponse: () => { calledPrepareAccessDeniedResponse = true }
  }
  const mockCallback = () => {
    if (calledPrepareAccessDeniedResponse) {
      done()
    }
  }
  const accessDeniedResponse = handlerUtilities.accessDeniedResponse(mockCallback, mockService)
  accessDeniedResponse()
})
