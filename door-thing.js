/*
 * Copyright 2010-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

//node.js deps

//npm deps

//app deps
const thingShadow = require('./thing');
const isUndefined = require('./common/lib/is-undefined');

//begin module

//
// Simulate the interaction of a mobile device and a remote thing via the
// AWS IoT service.  The remote thing will be a dimmable color lamp, where
// the individual RGB channels can be set to an intensity between 0 and 255.  
// One process will simulate each side, with testMode being used to distinguish 
// between the mobile app (1) and the remote thing (2).  The remote thing
// will update its state periodically using an 'update thing shadow' operation,
// and the mobile device will listen to delta events to receive the updated
// state information.
//

function doorThing() {
   //
   // Instantiate the thing shadow class.
   //
   args = {  
      "_":[  

      ],
      "help":false,
      "h":false,
      "debug":false,
      "Debug":false,
      "D":false,
      "f":"./certs",
      "certDir":"./certs",
      "certificate-dir":"./certs",
      "F":"./config/aws-iot-config.json",
      "configFile":"./config/aws-iot-config.json",
      "configuration-file":"./config/aws-iot-config.json",
      "protocol":"mqtts",
      "Protocol":"mqtts",
      "P":"mqtts",
      "clientId":"E1076A0D-500B-5BA2-A50D-ACF6F8527D05",
      "i":"E1076A0D-500B-5BA2-A50D-ACF6F8527D05",
      "client-id":"E1076A0D-500B-5BA2-A50D-ACF6F8527D05",
      "privateKey":"./certs/13ed694696-private.pem.key",
      "k":"13ed694696-private.pem.key",
      "private-key":"13ed694696-private.pem.key",
      "clientCert":"./certs/13ed694696-certificate.pem.crt",
      "c":"13ed694696-certificate.pem.crt",
      "client-certificate":"13ed694696-certificate.pem.crt",
      "caCert":"./certs/root-CA.crt",
      "a":"root-CA.crt",
      "ca-certificate":"root-CA.crt",
      "testMode":1,
      "t":1,
      "test-mode":1,
      "baseReconnectTimeMs":4000,
      "r":4000,
      "reconnect-period-ms":4000,
      "keepAlive":300,
      "K":300,
      "keepalive":300,
      "delay":4000,
      "d":4000,
      "delay-ms":4000,
      "Host":"a3riiqm5a27d7f.iot.us-east-2.amazonaws.com",
      "Port":8883,
      "thingName":"home-garage-door"
   }

   if (!(this instanceof doorThing)) {
      return new doorThing();
   }

   const thingShadows = thingShadow({
      keyPath: args.privateKey,
      certPath: args.clientCert,
      caPath: args.caCert,
      clientId: args.clientId,
      region: args.region,
      baseReconnectTimeMs: args.baseReconnectTimeMs,
      keepalive: args.keepAlive,
      protocol: args.Protocol,
      port: args.Port,
      host: args.Host,
      debug: args.Debug
   });

   console.log('thingShadows: ' + JSON.stringify(thingShadows));
   console.log('typeof(thingShadows.register) ' + typeof(thingShadows.register));

   //
   // Operation timeout in milliseconds
   //
   const operationTimeout = 10000;

   const thingName = args.thingName;

   var currentTimeout = null;

   //
   // For convenience, use a stack to keep track of the current client 
   // token; in this example app, this should never reach a depth of more 
   // than a single element, but if your application uses multiple thing
   // shadows simultaneously, you'll need some data structure to correlate 
   // client tokens with their respective thing shadows.
   //
   var stack = [];

   this.genericOperation = function(operation, state) {

      console.log('operation: ' + operation); 
      console.log('state: ' + JSON.stringify(state)); 
      console.log('typeof thingShadows[operation] ' + typeof(thingShadows[operation]));
      var clientToken = thingShadows[operation](thingName, state);

      if (clientToken === null) {
         //
         // The thing shadow operation can't be performed because another one
         // is pending; if no other operation is pending, reschedule it after an 
         // interval which is greater than the thing shadow operation timeout.
         //
         if (currentTimeout !== null) {
            console.log('operation in progress, scheduling retry...');
            currentTimeout = setTimeout(
               function() {
                  genericOperation(operation, state);
               },
               operationTimeout * 2);
         }
      } else {
         //
         // Save the client token so that we know when the operation completes.
         //
         stack.push(clientToken);
      }
   }


   function deviceConnect() {

      console.log('thingShadows: ' + JSON.stringify(thingShadows));
      thingShadows.register(thingName, {
            ignoreDeltas: true
         },
         function(err, failedTopics) {
            if (isUndefined(err) && isUndefined(failedTopics)) {
               console.log('Device thing registered.');
            }
         });
   }

   deviceConnect();

   function handleStatus(thingName, stat, clientToken, stateObject) {
      var expectedClientToken = stack.pop();

      if (expectedClientToken === clientToken) {
         console.log('got \'' + stat + '\' status on: ' + thingName);
      } else {
         console.log('(status) client token mismtach on: ' + thingName);
      }
   }

   function handleDelta(thingName, stateObject) {
      if (args.testMode === 2) {
         console.log('unexpected delta in device mode: ' + thingName);
      } else {
         console.log('delta on: ' + thingName + JSON.stringify(stateObject));
      }
   }

   function handleTimeout(thingName, clientToken) {
      var expectedClientToken = stack.pop();

      if (expectedClientToken === clientToken) {
         console.log('timeout on: ' + thingName);
      } else {
         console.log('(timeout) client token mismtach on: ' + thingName);
      }

      if (args.testMode === 2) {
         genericOperation('update', generateRandomState());
      }
   }

   function handleMessage(thingName, message) {
      cnosole.log('Emitting message');
      this.emit(thingName,message);
   }

   thingShadows.on('connect', function() {
      console.log('connected to AWS IoT');
   });

   thingShadows.on('close', function() {
      console.log('close');
      thingShadows.unregister(thingName);
   });

   thingShadows.on('reconnect', function() {
      console.log('reconnect');
   });

   thingShadows.on('offline', function() {
      //
      // If any timeout is currently pending, cancel it.
      //
      if (currentTimeout !== null) {
         clearTimeout(currentTimeout);
         currentTimeout = null;
      }
      //
      // If any operation is currently underway, cancel it.
      //
      while (stack.length) {
         stack.pop();
      }
      console.log('offline');
   });

   thingShadows.on('error', function(error) {
      console.log('error', error);
   });

   thingShadows.on('message', function(topic, payload) {
      console.log('message', topic, payload.toString());
   });

   thingShadows.on('status', function(thingName, stat, clientToken, stateObject) {
      handleStatus(thingName, stat, clientToken, stateObject);
   });

   thingShadows.on('delta', function(thingName, stateObject) {
      handleDelta(thingName, stateObject);
   });

   thingShadows.on('timeout', function(thingName, clientToken) {
      handleTimeout(thingName, clientToken);
   });
};

doorThing.prototype.publishState = function(state) {
   console.log('Updating state');
   this.genericOperation('update', state);
};


module.exports = doorThing;

if (require.main === module) {
   doorThing();
}

