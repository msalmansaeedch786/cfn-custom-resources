'use strict';

const AWS = require('aws-sdk');
const CWL_API_VERSION = '2014-03-28';

const ArnUtils = require('../lib/aws/arn-utils');
const { AwsPatterns, FAILED, SUCCESS, NOT_CREATED } = require('../lib/aws/constants');
const CustomResourceProvider = require('./custom-resource-provider');

const RESOURCE_TYPE = 'Custom::LogGroupSubscription';
const RESOURCE_SCHEMA = [
    { Name: 'DestinationArn', Required: { Create: true, Update: true }, AllowedPattern: AwsPatterns.ARN },
    { Name: 'Distribution', AllowedPattern: '^(Random|ByLogStream)$' },
    { Name: 'FilterName' },
    { Name: 'FilterPattern' },
    { Name: 'ForceSubscription', Required: false, Type: 'boolean'},
    { Name: 'LogGroupName', Required: true, AllowedPattern: AwsPatterns.LOG_GROUP_NAME },
    { Name: 'RoleArn', AllowedPattern: AwsPatterns.ARN },
];

/**
* This class is the implementation for the Custom::LogGroupSubscription custom resource provider.
 *
 * @extends CustomResourceProvider
 */
class LogGroupSubscriptionProvider extends CustomResourceProvider {

    constructor(log) {
        super(RESOURCE_TYPE, RESOURCE_SCHEMA);
        this._logger = log;
    }

    /**
     * Get the ResourceType that is provided by this CustomResourceProvider implementation.
     *
     * @returns {string} - The ResourceType that is provided by this CustomResourceProvider implementation
     */
    static get RESOURCE_TYPE() {
        return (RESOURCE_TYPE);
    }

    /**
     * Creates a CloudWatch subscription filter custom resource for a given log group.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Create(event, context) {

        let properties = event.ResourceProperties;
        let filterName = properties.FilterName;
        let logGroupName = properties.LogGroupName;
        let responseStatus = FAILED;
        let responseData = {};
        try {

            if (!filterName) {
                // Will throw an exception if DestinationArn is not a Lambda or Kinesis stream
                filterName = this.getFilterNameFromArn(properties.DestinationArn);
            }

            // If ForceSubscription is true, delete an existing subscription filter, otherwise it is an error
            let results = await this.describeSubscriptionFilters(logGroupName);
            let subscriptionFilters = results.subscriptionFilters;
            if (subscriptionFilters && subscriptionFilters.length > 0) {
                if (properties.ForceSubscription) {
                    let existingFilterName = subscriptionFilters[0].filterName;
                    await this.deleteSubscriptionFilter(logGroupName, existingFilterName);
                } else {
                    throw new Error('Cannot overwrite existing subscription filter');
                }
            }

            // This will fail if there is an existing subscription filter that does not match filterName
            await this.putSubscriptionFilter(this.getSubscriptionFilterParams(properties, filterName));

            responseStatus = SUCCESS;
            responseData.PhysicalResourceId = `${logGroupName}:${filterName}`;
            responseData.Data = { LogGroupName: logGroupName, FilterName: filterName };

        } catch(err) {
            let msg = `error=${err.message}, type=${err.name}`;
            responseData = { Reason: msg, PhysicalResourceId: NOT_CREATED };
        }

        return this.sendResponse(event, context, responseStatus, responseData);
    }

    /**
     * Deletes a subscription filter custom resource for a given log group.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Delete(event, context) {

        let responseStatus = FAILED;
        let responseData = {};
        let physicalResourceId = event.PhysicalResourceId;
        let properties = event.ResourceProperties;
        if (!physicalResourceId || physicalResourceId === NOT_CREATED) {

            responseStatus = SUCCESS;
            responseData.Reason = 'Resource not created';
            responseData.PhysicalResourceId = physicalResourceId;
            responseData.Data = { LogGroupName: properties.LogGroupName, FilterName: properties.FilterName };
            return this.sendResponse(event, context, responseStatus, responseData);
        }

        try {

            let { logGroupName, filterName } = this.parsePhysicalResourceId(physicalResourceId);
            let results = await this.describeSubscriptionFilters(logGroupName);
            let subscriptionFilters = results.subscriptionFilters;
            if (!subscriptionFilters || subscriptionFilters.length === 0) {

                // If there are no subscription filters on the log group, then it is a success
                responseStatus = SUCCESS;
                responseData.Reason = `Missing subscription filter, LogGroupName=${logGroupName}`;
                responseData.PhysicalResourceId = physicalResourceId;
                responseData.Data = { LogGroupName: logGroupName, FilterName: filterName };

            } else {

                let existingFilterName = subscriptionFilters[0].filterName;
                if (existingFilterName === filterName) {

                    // The filterNames match, delete it
                    await this.deleteSubscriptionFilter(logGroupName, filterName);
                    responseStatus = SUCCESS;
                    responseData.PhysicalResourceId = physicalResourceId;
                    responseData.Data = { LogGroupName: logGroupName, FilterName: filterName };

                } else {
                    let msg = `FilterName mismatch, FilterName=${filterName}, ExistingFilterName=${existingFilterName}`;
                    responseData = { Reason: msg, PhysicalResourceId: physicalResourceId };
                }
            }

        } catch(err) {
            let msg = `error=${err.message}, type=${err.name}`;
            responseData = { Reason: msg, PhysicalResourceId: physicalResourceId };
        }

        return this.sendResponse(event, context, responseStatus, responseData);
    }

    /**
     * Update a log group's subscription filter custom resource.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Update(event, context) {

        let oldProperties = event.OldResourceProperties;
        let properties = event.ResourceProperties;
        let physicalResourceId = event.PhysicalResourceId;
        let responseStatus = FAILED;
        let responseData = {};
        // If the subscription filter was created make sure LogGroupName and FilterName have not changed
        if (physicalResourceId !== NOT_CREATED) {
            let readOnlyChanges = [];
            if (properties.LogGroupName !== oldProperties.LogGroupName) readOnlyChanges.push('LogGroupName');
            if (properties.FilterName !== oldProperties.FilterName) readOnlyChanges.push('FilterName');
            if (readOnlyChanges.length > 0) {
                let msg = `Cannot update read-only properties: [${readOnlyChanges.join(', ')}]`;
                responseData = { Reason: msg, PhysicalResourceId: physicalResourceId };
                return this.sendResponse(event, context, responseStatus, responseData);
            }
        }

        try {

            let { logGroupName, filterName } = this.parsePhysicalResourceId(physicalResourceId, properties);
            let existingFilterName = null;
            let results = await this.describeSubscriptionFilters(logGroupName);
            let subscriptionFilters = results.subscriptionFilters;
            if (subscriptionFilters && subscriptionFilters.length > 0) {

                // The existing subscription filter must match the one from the PhysicalResourceId,
                // unless the resource was not created and ForceUpdate is true
                existingFilterName = subscriptionFilters[0].filterName;
                if (existingFilterName !== filterName &&
                        (!properties.ForceSubscription || physicalResourceId !== NOT_CREATED)) {

                    let msg = `FilterName mismatch, FilterName=${filterName}, ExistingFilterName=${existingFilterName}`;
                    responseData = { Reason: msg, PhysicalResourceId: physicalResourceId };
                    return this.sendResponse(event, context, responseStatus, responseData);
                }
            }

            // Get the new FilterName if the resource was not created.
            if (!physicalResourceId || physicalResourceId === NOT_CREATED) {
                if (!filterName) {
                    // Will throw an exception if DestinationArn is not a Lambda or Kinesis stream
                    filterName = this.getFilterNameFromArn(properties.DestinationArn);
                }
            }

            let changedProperties = [];
            if (properties.DestinationArn !== oldProperties.DestinationArn) changedProperties.push('DestinationArn');
            if (properties.Distribution !== oldProperties.Distribution) changedProperties.push('Distribution');
            if (filterName !== existingFilterName) changedProperties.push('FilterName');
            if (properties.FilterPattern !== oldProperties.FilterPattern) changedProperties.push('FilterPattern');
            if (properties.LogGroupName !== oldProperties.LogGroupName) changedProperties.push('LogGroupName');

            if (changedProperties.length > 0 || physicalResourceId === NOT_CREATED) {

                // If we have an existing subscription filter and the subscription filter resource
                // was not created then we must delete the existing filter first
                if (physicalResourceId === NOT_CREATED && existingFilterName) {
                    await this.deleteSubscriptionFilter(oldProperties.LogGroupName, existingFilterName);
                }

                let subscriptionParams = this.getSubscriptionFilterParams(properties, filterName);
                await this.putSubscriptionFilter(subscriptionParams);
                responseStatus = SUCCESS;
                responseData.Reason =`Updated properties: [${changedProperties.join(', ')}]`;
                responseData.PhysicalResourceId = `${logGroupName}:${filterName}`;
                responseData.Data = { LogGroupName: logGroupName, FilterName: filterName };

            } else {

                responseStatus = SUCCESS;
                responseData.Reason = 'Ignoring Update request, no property changes.';
                responseData.PhysicalResourceId = physicalResourceId;
                responseData.Data = { LogGroupName: logGroupName, FilterName: filterName };
            }

        } catch(err) {
            let msg = `error=${err.message}, type=${err.name}`;
            responseData = { Reason: msg, PhysicalResourceId: physicalResourceId };
        }

        return this.sendResponse(event, context, responseStatus, responseData);
    }

    /**
     * Build a FilterName from the provided DestinationArn.
     *
     * @param {string} destinationArn - The DestinationArn
     * @return {string} - A filter name based on the provided DestinationArn
     * @throws An error if the DestinationArn is not for a Lambda or Kinesis stream.
     */
    getFilterNameFromArn(destinationArn) {

        // construct new filter name
        let parsedArn = ArnUtils.parseArn(destinationArn);
        if (parsedArn.Service === 'lambda') {
            return `LambdaStream_${parsedArn.Resource}`;
        } else if(parsedArn.Service === 'kinesis') {
            return `KinesisStream_${parsedArn.Resource}`;
        }

        let err = new Error('DestinationArn must be a Lambda or a Kinesis stream');
        err.name = 'InvalidDestinationArn';
        throw err;
    }

    /**
     * Gets a params object to pass to the CloudWatchLogs.putSubscription() call.
     *
     * @param {Object} properties - The ResourceProperties to use to create the params
     * @param {string} filterName - The FilterName property for the params. Optional. 
     * @returns {Object} - An object holding the params for the CloudWatchLogs.putSubscription() call.
     */
    getSubscriptionFilterParams(properties, filterName) {
        return  {
            logGroupName: properties.LogGroupName,
            filterName: filterName,
            filterPattern: properties.FilterPattern || '',
            destinationArn: properties.DestinationArn,
            roleArn: (properties.RoleArn || undefined),
            distribution: (properties.Distribution || undefined)
        };
    }

    /**
     * Parses the PhysicalResourceId to get the log group and filter name.
     *
     * @param {string} physicalResourceId - The PhysicalResourceId provided by CloudFormation.
     * @param {Object} properties - The ResourceProperties provided by CloudFormation.  Used to populate
     * logGroupName and filterName id PhysicalResourceId = 'resource-not-created'.
     * @returns {Object} - Returns an object holding the parsed logGroupName and filterName.
     */
    parsePhysicalResourceId(physicalResourceId, properties) {

        if (!physicalResourceId || physicalResourceId === NOT_CREATED) {
            return { logGroupName: properties.LogGroupName, filterName: properties.FilterName };
        }

        // Get the logGroupName and filterName from the PhysicalResourceId
        // This will return throw an error if PhysicalResourceId is invalid
        let idParts = physicalResourceId.split(':');
        if (idParts.length === 2) {
            return { logGroupName: idParts[0], filterName: idParts[1] };
        } else {
            let err = new Error(`Invalid PhysicalResourceId, PhysicalResourceId=${physicalResourceId}`);
            err.name = 'InvalidPhysicalResourceId';
            throw err;
        }
    }

    /**
     * Delete the specified subscription filter from the specified log group.
     *
     * @param {string} logGroupName - The CloudWatch log group name to delete the specified
     * subscription filter from. Required.
     * @param {string} filterName - The name of the subscription filter to delete. Required.
     * @returns {Promise} - A Promise for the results from deleteSubscriptionFilter
     */
    deleteSubscriptionFilter(logGroupName, filterName) {
        this._logger.info({ message: 'Deleting subscription filter', LogGroupName: logGroupName, FilterName: filterName });
        let cwl = new AWS.CloudWatchLogs({ apiVersion: CWL_API_VERSION });
        let params = { logGroupName: logGroupName, filterName: filterName };
        return cwl.deleteSubscriptionFilter(params).promise();
    }

    /**
     * Get a list of subscription filters attached to the specified log group.
     *
     * @param {string} logGroupName - The CloudWatch log group name to describe the subscription filters for. Required.
     * @returns {Promise} - A Promise for the results from describeSubscriptionFilters
     */
    describeSubscriptionFilters(logGroupName) {
        let cwl = new AWS.CloudWatchLogs({ apiVersion: CWL_API_VERSION });
        let params = { logGroupName: logGroupName };
        return cwl.describeSubscriptionFilters(params).promise();
    }

    /**
     * Add the specified subscription filter on to the specified log group.
     *
     * @param {Object} params - The parameters for the subscription filter.
     * @returns {Promise} - A Promise for the results from putSubscriptionFilter
     */
    putSubscriptionFilter(params) {
        this._logger.info({ message: 'Setting subscription filter', LogGroupName: params.logGroupName, FilterName: params.filterName });
        let cwl = new AWS.CloudWatchLogs({ apiVersion: CWL_API_VERSION });
        return cwl.putSubscriptionFilter(params).promise();
    }
}

exports['default'] = LogGroupSubscriptionProvider;
module.exports = exports['default'];