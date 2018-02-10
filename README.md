# SCEPTER-GatewayService

[![scepter-logo](http://res.cloudinary.com/source-4-society/image/upload/v1514622047/scepter_hzpcqt.png)](https://github.com/source4societyorg/SCEPTER-core)

[![js-standard-style](https://cdn.rawgit.com/standard/standard/master/badge.svg)](http://standardjs.com)

[![Build Status](https://travis-ci.org/source4societyorg/SCEPTER-GatewayService.svg?branch=master)](https://travis-ci.org/source4societyorg/SCEPTER-GatewayService)

[![codecov](https://codecov.io/gh/source4societyorg/SCEPTER-GatewayService/branch/master/graph/badge.svg)](https://codecov.io/gh/source4societyorg/SCEPTER-GatewayService)

[![Serverless](http://public.serverless.com/badges/v1.svg)](http://serverless.com)

## Installation

We recommend forking this repository.

If you are using the [SCEPTER](https://www.github.com/source4societyorg/SCEPTER-core) framework you can install this service using the `service:add` scepter command [SCEPTER-command-service](https://github.com/source4societyorg/SCEPTER-command-service)

This will clone the service into your services folder as a submodule.

Alternatively if you are running this as a standalone service, you can simply `git clone` this repository or it's fork, and setup the configuration files locally.

If you are running the commands via powershell, be sure to install the windows-build-tools with the following command:

    npm install --global --production windows-build-tools

For Ubuntu, for nodejs 6.10 node-gyp won't install unless you install the following packages:

    apt-get install libsecret-1-dev 
    apt-get install g++-4.8 

## Configuration

The `serverless.yml` is not checked in to this repository as the `config/serverless_template_aws.yml` and `config/serverless_template_azure.yml` files will replace the `serverless.yml` file when using SCEPTER commands such as `service:deploy` and `service:invoke` [Read More about these commands](https://github.com/source4societyorg/SCEPTER-command-service). If you are not using SCEPTER, pick a provider template and copy that to `serverless.yml`. Most likely you will want to fork the repository and ensure that the file is committed.

The services.json requires you to setup a configuration for every service you wish to access via the gateway. These services can be invoked locally, via AWS Lambdas, or the Azure http url presently. Support for AWS SNS and Azure Events/Service messaging coming soon. The environment is referenced by the stage parameter (see [serverless.com](http://www.serverless.com) for information on how to set the stage parameter on invocation or deploy). 

Each service has a default provider that can be specified as `local`, `aws:lambda`, or `azure:http`. Support for the other cloud function services are forthcoming. You can override the default provider for a service by specifying the provider key within your specific services configuration. The key corresponding to your services configuration will match the `type` property on the gateways payload object.

The roles that are allowed access to the service as listed in the `security` property as an array.

For local invocation, the serviceName should correspond to the folder within the `services` directory if you are using [SCEPTER](https://www.github.com/source4societyorg/SCEPTER-core). If not, then you can specify the path to the folder that contains your service here. Note that by default the cwd of the service path when invocing local services is the parent folder of this service. 

    {
         "environments": {
            "test": {
                "provider": "local",  //The global provider will default to local
                "configuration": {
                    "AUTHENTICATE": {
                        "serviceName": "AuthenticationService",
                        "function": "authenticate",                   
                        "security": ["ROLE_ANONYMOUS"]                    
                    }, 
                    "TEST": {
                        "serviceName": "TestService",
                        "function": "test",                   
                        "security": ["TEST"],
                        "provider": "aws:lambda' //Overrides local with aws:lambda and will call the TestService-test lambda and test endpoint
                    }, 
                    "TEST_ANONYMOUS": {
                        "serviceName": "TestService",
                        "function": "https://<appName>-testservice-test.azurewebsites.net/api/functionName?code=<apiKey>",                  
                        "security": ["ROLE_ANONYMOUS"],
                        "provider: "azure:http"         
                    },
                    "TEST_REJECTION": {
                        "serviceName": "TestService",
                        "function": "test",                   
                        "security": ["TEST_REJECT"]                    
                    }, 
                    "TEST_LAMBDA": {
                        "serviceName": "TestService", 
                        "function": "test", 
                        "security": ["ROLE_ANONYMOUS"], 
                        "provider": "aws:lambda"
                    }
                }
            }
         }
    }


## Deployment

See [Serverless.com](https://www.serverles.com) and [SCEPTER-command-service](https://github.com/source4societyorg/SCEPTER-command-service) for information on how to deploy services to various cloud providers without having to modify configuration files. 

## Example

This is typically deployed as an http endpoint that can be triggered via a POST request. The body of the post should include a json string with the event type and payload so that the system can map it to the proper service and invoke it using the provider configured in the services.json file.

Example service payload :

    {
        "type": AUTHENTICATION,
        "payload": {
            "username": "someuser",
            "password": "somepassword",
        }
    }

The response will be returned as a json string in the response body of the request. Responses from services are expected to follow the following format for failed services:

    {
      status: false,
      errors: {code: 500, message: 'Some error'}
    }

For successful services

    {
      status: true,
      result: {} //Your result object can contain the result of your service call
    }

The gateway will return a response similar to the following, with the service result in the body property (the example service used it from the [SCEPTER-AuthenticationService](https://github.com/source4societyorg/SCEPTER-AuthenticationService) service):

    {
      "headers": {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true
      },
      "isBase64Encoded": false,
      "statusCode": 200,
      "body": "{\"status\":true,\"result\":{\"jwt\":\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXNzd29yZEhhc2giOiIkMmEkMDgkb3Bsa28yZW9FQTFLNTZZa2lkQzJ6LkRReHI0YnFjR201V3dIcHh4MW0va3J1Li9UVFhFLjYiLCJ1c2VybmFtZSI6Im5yYWNhZG1pbiIsInJvbGVzIjpbIk5SQUNfQURNSU4iXSwidXNlcklkIjoiMzRjMmJkZDItYTg2My00NDg5LTkyNzQtZmY4Y2JkYjkxZGM2IiwiaWF0IjoxNTEyOTc1NjA3LCJleHAiOjE1MTU1Njc2MDd9.bJliJ9Q1xeHJ1MrtuJEd18x5Y2IemDe5bnGKNCn0LoA\"}}"  
    }

## Tests

To run tests and eslint, run `yarn test`.

Before running tests, you need to be sure that you have a `test` environment credential configuration set created. These are provided by default in the test folder and are automaticaly referenced by the test library,