# SCEPTER-GatewayService

[![Build Status](https://travis-ci.org/source4societyorg/SCEPTER-GatewayService.svg?branch=master)](https://travis-ci.org/source4societyorg/SCEPTER-GatewayService)
[![Serverless](http://public.serverless.com/badges/v1.svg)](http://serverless.com)

## Installation

We recommend forking this repository.

If you are using the [SCEPTER](https://www.github.com/source4societyorg/SCEPTER-core) framework you can install this service using the following command from your project folder:

    node bin/scepter.js service:add git@github.com:source4societyorg/SCEPTER-GatewayService.git GatewayService

You can replace the github uri with the uri of your forked repository.

This will clone the service into your services folder as a submodule, and run `yarn install` as well as `yarn test`. We are currently working on initialization scripts that will help setup configuration files after running this command. 

Alternatively if you are running this as a standalone service, you can simply `git clone` this repository or it's fork, and setup the configuration files locally.

## Configuration

The repository comes with `./credentials.json` and `services.json` simlinked to their respective files in `../../config/` by default. If you are using [SCEPTER](https://www.github.com/source4societyorg/SCEPTER-core) then those files are likely already present. If you are using this service as a standalone service, then you can replace those simlinks with their appropriate files. 

Currently the library only supports the `aws` provider, but we hope to support others in the future.

To setup the `credentials.json` you can use the following boilerplate (just prefill your credentials):

    {
        "environments": {
            "dev": {
                "provider": "aws",
                "configuration": {
                    "accessKeyId": "yourawskey",
                    "secretAccessKey": "yourawssecret",
                    "region":"us-east-1",
                    "account":"123456789", 
                    "maxRetries":2
                }, 
                "jwtKeySecret": "chooseasecret", 
                "tokenDuration": "30d",
            }
        }
    }

The services.json requires you to setup a configuration for every service you wish to access via the gateway. These services can be invoked locally or over AWS Lambdas presently. The gateway does not use SNS yet so at the moment if you invoke a lambda this lambda will also run until the second lambda completes, so it is a good idea to keep them short. The environment is referenced by the stage parameter (see [serverless.com](http://www.serverless.com) for information on how to set the stage parameter on invocation or deploy). 

Each service has a default provider that can be specified as `local` or `aws:lambda`. Support for the other cloud function services are forthcoming. You can override the default provider for a service by specifying the provider key within your specific services configuration. The key corresponding to your services configuration will match the `type` property on the gateways payload object.

The roles that are allowed access to the service as listed in the `security` property.

For local invocation, the serviceName should correspond to the folder within the `services` directory if you are using [SCEPTER](https://www.github.com/source4societyorg/SCEPTER-core). If not, then you can specify the path to the folder that contains your service here. Note that by default the cwd of the service path when invocing local services is the parent folder of this service. 

    {
         "environments": {
            "test": {
                "provider": "local", 
                "configuration": {
                    "AUTHENTICATE": {
                        "serviceName": "AuthenticationService",
                        "function": "authenticate",                   
                        "security": ["ROLE_ANONYMOUS"]                    
                    }, 
                    "TEST": {
                        "serviceName": "TestService",
                        "function": "test",                   
                        "security": ["TEST"]                    
                    }, 
                    "TEST_ANONYMOUS": {
                        "serviceName": "TestService",
                        "function": "test",                   
                        "security": ["ROLE_ANONYMOUS"]                    
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

See [Serverless.com](https://www.serverles.com) for information on how to deploy services to various cloud providers. 

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
