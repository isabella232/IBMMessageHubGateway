/**
 * Copyright 2015-2017 IBM
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
/**
 * Licensed Materials - Property of IBM
 * © Copyright IBM Corp. 2015-2017
 */

    // This should pull from PubNub bot_object

var producer;
var exports = module.exports = {};

/**
 * Constructs a Kafka Producer and registers listeners on the most common events
 * 
 * @param {object} Kafka - an instance of the node-rdkafka module
 * @param {object} producer_opts - producer configuration
 * @param {string} topicName - name of the topic to produce to
 * @param {function} shutdown - shutdown function
 * @return {Producer} - the Kafka Producer instance
*/
exports.buildProducer = function(Kafka, producer_opts, topicName, shutdown, pubnub) {


    // Create Kafka producer
    producer = new Kafka.Producer(producer_opts);
    producer.setPollInterval(100);

    // Register listener for debug information; only invoked if debug option set in driver_options
    producer.on('event.log', function(log) {
        console.log(log);
    });

    // Register error listener
    producer.on('event.error', function(err) {
        console.error('Error from producer:' + JSON.stringify(err));
    });

    // Register delivery report listener
    producer.on('delivery-report', function(err, dr) {
        if (err) {
            console.error('Delivery report: Failed sending message ' + dr.value);
            console.error(err);
            // We could retry sending the message
        } else {
            console.log('Message produced, offset: ' + dr.offset);
        }
    });

    function sendMessages(counter, topic, partition) {


        var qMessage = "";
        var key = 'Key';

        pubnub.addListener({
            status: function(statusEvent) {
                if (statusEvent.category === "PNConnectedCategory") {
                    console.log("PubNub: Connected!");
                }
            },
            message: function(envelope) {
                //console.log("PubNub: New Message!", envelope.message);
                qMessage = new Buffer(envelope.message);

                // Short sleep for flow control in this sample app
                // to make the output easily understandable

                try {
                    producer.produce(topic, partition, qMessage, key);
                    //counter++;
                } catch (err) {
                    console.error('Failed sending message ' + qMessage);
                    console.error(err);
                    //timeout = 5000; // Longer wait before retrying
                }

            },
            presence: function(presenceEvent) {
                console.log("PubNub: New Presence Event!", presenceEvent);
            }
        });

    }

    // Register callback invoked when producer has connected
    producer.on('ready', function() {
        console.log('The producer has started');

        // request metadata for all topics
        producer.getMetadata({
            timeout: 10000
        }, 
        function(err, metadata) {
            if (err) {
                console.error('Error getting metadata: ' + JSON.stringify(err));
                shutdown(-1);
            } else {
                console.log('Producer obtained metadata: ' + JSON.stringify(metadata));
                var topicsByName = metadata.topics.filter(function(t) {
                    return t.name === topicName;
                });
                if (topicsByName.length === 0) {
                    console.error('ERROR - Topic ' + topicName + ' does not exist. Exiting');
                    shutdown(-1);
                }
            }
        });

        // Create a topic object for the Producer to allow passing topic settings
        var topicOpts = { 'request.required.acks': -1 };
        var topic = producer.Topic(topicName, topicOpts);
        console.log('Topic object created with opts ' + JSON.stringify(topicOpts));
        var counter = 0;

        // Start sending messages
        console.log("PubNub: Subscribing!");
        pubnub.subscribe({
            channels: ['bot']
        });
        sendMessages(counter, topic, 0);

    });
    return producer;
}
