'use strict';
var https = require('https'),
    request = require('request');
var agentOptions,
    agent,
    appConfig = require('./grunt_config.json');

var loginInfo = {
    consumer_key: 'iXyhYOR6pJl9TtYyYSzoiBXiB6sa',
    consumer_secret: '6_9n4Hqz7j8jGQ0P6A6gjcGWXCka',
    username: appConfig.login.username,
    password: appConfig.login.password,
    app_type: 'native'
};

var loginURL = appConfig.login.url.replace('{targetHost}', appConfig.targetHost);

var agentOptions = {
    host: loginURL,
    port: 443,
    path: '/',
    rejectUnauthorized: false
};

// Insecure way
var agent = new https.Agent(agentOptions);


module.exports = function (callback) {
    request.post({
        url: 'https://' +loginURL +appConfig.login.path,
        agent: agent,
        form: loginInfo,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json"
        },
        timeout: 3000
    }, function (err, resp, body) {
        try {
            var jsonBody = JSON.parse(body);
            callback(jsonBody.login);
        } catch (error) {
            callback({});
        }
    });
};
