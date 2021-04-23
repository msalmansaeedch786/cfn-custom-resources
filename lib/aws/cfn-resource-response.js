'use strict';

const request = require('request');

/**
 * This function sends the standard CloudFormation custom resource response to
 * the pre-signed S3 URL provided in the event.
 *
 * See [Custom Resource Response Objects]{@link https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/crpg-ref-responses.html}
 * for more information.
 *
 * @param {Object} event - the Custom Resource Request, required
 * @param {Object} context - the Labmda context, this object provides methods and properties that provide
 * information about the invocation, function, and execution environment.
 * @param {string} responseStatus - the status for the response, required
 * @param {Object} responseData - data specific to the created custom resource, this object will be
 * overlayed on the JSON that is sent back to CloudFormation.
 * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response
 */
function sendResponse(event, context, responseStatus, responseData) {

    // Do a shallow copy of the provided data and amend it with properties provided in the event.
    let responseBody = Object.assign({}, responseData);
    responseBody.Status = responseStatus;
    responseBody.StackId = event.StackId;
    responseBody.RequestId = event.RequestId;
    responseBody.LogicalResourceId = event.LogicalResourceId;

    // If this is a DryRun return the responseBody with some additional data in it.
    if (event.ResourceProperties && event.ResourceProperties.DryRun) {
        responseBody.DryRun = true;
        responseBody.RequestType = event.RequestType;
        responseBody.ResourceType = event.ResourceType;
        responseBody.RequestId = event.RequestId;
        return (Promise.resolve(responseBody));
    }

    let data = JSON.stringify(responseBody);
    let options = {
        method: 'PUT',
        url: event.ResponseURL,
        body: data,
        json: false,
        headers: {
            'content-type': '',
            'content-length': data.length
        }
    };

    // Set up and return a promise for the results
    return new Promise((resolve, reject) => {
        request(options, (error, response) => {

            if (error) {
                return reject(error);
            }

            let results = Object.assign({}, responseData);
            results.RequestType = event.RequestType;
            results.ResourceType = event.ResourceType;
            results.Status = responseStatus;

            // Populate the CfnResponse with JSON if it is JSON
            results.CfnResponse = response.body;
            let jsonObject = extractObjectIfJson(response.body);
            if (jsonObject) {
                results.CfnResponse = jsonObject;
            }

            return (resolve(results));
        });
    });
}

/**
 * Returns an Object if the string contains JSON, otherwise returns null.
 *
 * @param {string} message - The string that may contain JSON.
 * @returns {Object} - An Object if the string contains JSON, otherwise returns null.
 * @private
 */
function extractObjectIfJson(message) {

    var jsonStart = message.indexOf('{');
    if (jsonStart < 0) return null;
    var jsonSubString = message.substring(jsonStart);
    try {
        return (JSON.parse(jsonSubString));
    } catch (err) {
        return (null);
    }
}

module.exports = { sendResponse };
