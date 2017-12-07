const GatewayService = require('../service');
const jsonwebtoken = require('jsonwebtoken');
const serviceconfig = require('./services');
const credentialconfig = require('./credentials');

test('proxy function will spawn process for local provider and return payload if status is true', (done) => {
    const service = new GatewayService('test', './test/credentials.json', './test/services.json');
    service.services = serviceconfig;
    service.credentials = credentialconfig;

    //mock function invocation result (note real result will be in bytes)
    const result = JSON.stringify({status: true, result: {message: 'Payload goes in the result field'}});
    //mock EventEmitter
    const onMock = (eventName, callback) => callback(result);
    //mock the spawn function
    service.spawn = (command, args, options) => ({stdout: {on: onMock}  });

    const finalCallback = (err, data) => {
        expect(data).toEqual(JSON.parse(result));
        expect(err).toBeNull();  
        done();
    };

    service.proxy({type: 'TEST_ANONYMOUS', payload: {}}, finalCallback);
});

test('proxy function will spawn process for local provider and return error if status is false', (done) => {
    const service = new GatewayService('test', './test/credentials.json', './test/services.json');
    service.services = serviceconfig;
    service.credentials = credentialconfig;

    //mock function invocation result (note real result will be in bytes)
    const result = JSON.stringify({status: false, errors:{message: 'Payload goes in the error field', code: 403}});
    //mock EventEmitter
    const onMock = (eventName, callback) => callback(result);
    //mock the spawn function
    service.spawn = (command, args, options) => ({stdout: {on: onMock} });

    const finalCallback = (err, data) => {
        expect(err).toEqual(JSON.parse(result).errors);
        expect(data).toBeUndefined();  
        done();
    };

    service.proxy({type: 'TEST_ANONYMOUS', payload: {}}, finalCallback);
});

test('proxy function will use AWS SDK to invoke aws:lambda provider and return payload if status is true', (done) => {
    const service = new GatewayService('test', './test/credentials.json', './test/services.json');
    service.services = serviceconfig;
    service.credentials = credentialconfig;

    //mock function invocation result (note real result will be in bytes)
    const result = {Payload:{status: true, result:{message:'Payload'}}};
    //mock Lambda.invoke
    const invokeMock = (options, callback) => callback(null, result);
    
    //mock the AWS.Lambda function
    service.AWS = {Lambda: function (region) { return ({invoke: invokeMock}) }};
 
    const finalCallback = (err, data) => {
        expect(err).toBeNull();
        expect(data).toEqual(result.Payload);  
        done();
    };

    service.proxy({type: 'TEST_LAMBDA', payload: {}}, finalCallback);
});


