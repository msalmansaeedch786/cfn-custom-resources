'use strict';

const CfnResponse = require('./lib/aws/cfn-resource-response');
const { FAILED } = require('./lib/aws/constants');


// Get the lambda logger and enable log.debug ()
const log = require('lambda-log');
log.options.debug = process.env.LOG_DEBUG === 'true' || false;

// If SUPPRESS_LOG_OUTPUT is true, set up logging suppression for info and warn levels
/* istanbul ignore next */
if (process.env.SUPPRESS_LOG_OUTPUT === 'true') {
    log.info = function() { return false; };
    log.warn = function() { return false; };
}

// Set up the available custom resource providers
const AccessKeyProvider = require('./providers/accesskey-provider');
const AmiInfoProvider = require('./providers/amiinfo-provider');
const ImportKeyPairProvider = require('./providers/import-keypair-provider');
const KeyPairProvider = require('./providers/keypair-provider');
const LogGroupSubscriptionProvider = require('./providers/loggroup-subscription-provider');
const SecretProvider = require('./providers/secret-provider');
const customResourceProviders = new Map()
    .set(AccessKeyProvider.RESOURCE_TYPE, new AccessKeyProvider(log))
    .set(AmiInfoProvider.RESOURCE_TYPE, new AmiInfoProvider(log))
    .set(ImportKeyPairProvider.RESOURCE_TYPE, new ImportKeyPairProvider(log))
    .set(KeyPairProvider.RESOURCE_TYPE, new KeyPairProvider(log))
    .set(LogGroupSubscriptionProvider.RESOURCE_TYPE, new LogGroupSubscriptionProvider(log))
    .set(SecretProvider.RESOURCE_TYPE, new SecretProvider(log));

/**
 * This is the Lambda handler for the extensible custom resource provider.
 *
 * @param {Object} event - the CloudFormation Custom Resource Request event.
 * @param {Object} context - the Lambda invocation context.
 * @param {function} callback - The Lambda callback function.
 * @returns {Object} - An object that holds the results of the custom resource processing.
 */
exports.handler = async (event, context, callback) => {

    let resourceType = event.ResourceType;
    let requestType = event.RequestType;
    log.info({
        message: 'Received custom resource request',
        ResourceType: resourceType,
        RequestType: requestType,
        PhysicalResourceId: event.PhysicalResourceId
    });
    log.debug(event);

    // If ResourceProperties is missing then we cannot continue, respond with a FAILED status
    if (!event.ResourceProperties) {
        let msg = 'ResourceProperties is missing.';
        log.warn({
            Status: FAILED,
            ResourceType: resourceType,
            RequestType: requestType,
            Reason: msg
        });
        return await CfnResponse.sendResponse(event, context, FAILED, { Reason: msg });
    }

    // Get the custom resource provider for the ResourceType, if not valid let CloudFormation know
    // and return the results from the CloudFormation response
    let provider = customResourceProviders.get(resourceType);
    if (!provider) {
        let msg = `Unsupported ResourceType [${resourceType}]`;
        log.warn({
            Status: FAILED,
            ResourceType: resourceType,
            RequestType: requestType,
            Reason: msg
        });
        return await CfnResponse.sendResponse(event, context, FAILED, { Reason: msg });
    }

    // Make sure the RequestType is valid, if not let CloudFormation know
    // and return the results from the CloudFormation response
    if (!['Create', 'Delete', 'Update'].includes(requestType)) {
        let msg = `Invalid RequestType [${requestType}]`;
        log.warn({
            Status: FAILED,
            ResourceType: resourceType,
            RequestType: requestType,
            Reason: msg
        });
        msg = `${msg}, must be "Create" | "Delete" | "Update"`;
        return await CfnResponse.sendResponse(event, context, FAILED, { Reason: msg });
    }

    // If DryRun is true, then call the dryRun() method on the provider and return it's results
    if (event.ResourceProperties.DryRun === true) {
        return await provider.dryRun(event, context);
    }

    // Validate the ResourceProperties using the provider for the specified ResourceType
    try {
        provider.validateProperties(event.ResourceProperties, event.RequestType);
    } catch(err) {
        log.warn({
            Status: FAILED,
            ResourceType: resourceType,
            RequestType: requestType,
            Reason: err.message
        });
        return await CfnResponse.sendResponse(event, context, FAILED, { Reason: err.message });
    }

    // Install a watchdog timer to send a response to CloudFormation if this function times out
    let functionTimeout = null;
    if (typeof context.getRemainingTimeInMillis === 'function' && typeof callback === 'function') {

        /* istanbul ignore next */
        let timeoutHandler = async () => {
            // Send a FAILED status to CloudFormation then call the callback function with the error
            let msg = `${event.ResourceType} custom resource provider timed out.`;
            log.error({
                Status: FAILED,
                ResourceType: resourceType,
                RequestType: requestType,
                Reason: msg
            });
            CfnResponse.sendResponse(event, context, FAILED, { Reason: msg });
            callback(new Error(msg));
        };

        // Set up the timer so it triggers 1 second before the function would timeout
        functionTimeout = setTimeout(timeoutHandler, context.getRemainingTimeInMillis() - 1000);
    }

    // Call the method associated with the RequestType.
    let cfnMethod = (requestType == 'Create' ? provider.Create : requestType == 'Delete' ? provider.Delete : provider.Update);
    let results = await cfnMethod.call(provider, event, context);
    clearTimeout(functionTimeout);
    log.debug("RESULTS: ", results);

    log.info({
        message: 'Finished processing custom resource request',
        Status: results.Status,
        ResourceType: resourceType,
        RequestType: requestType,
        PhysicalResourceId: results.PhysicalResourceId,
        Reason: results.Reason
    });

    return (results);
};
