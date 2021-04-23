'use strict';

const cfnResponse = require('../lib/aws/cfn-resource-response');
const { FAILED, SUCCESS } = require('../lib/aws/constants');

/**
 * This is the base class for custom resource providers.
 */
class CustomResourceProvider {

    /**
     * This constructor must be called by subclasses passing in the custom resource type as the only parameter.
     *
     * @param {string} resourceType - the CloudFormation custom resource type handled by this provider implementation
     */
    constructor(resourceType, propertiesSchema, log) {
        this.resourceType = resourceType;
        this.propertiesSchema = propertiesSchema;
        this._logger = log;
    }

    /**
     * Create the specified custom resource. This default implementation responds to CloudFormation
     * with a FAILED Status.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event
     * @param {Object} context - the Lambda invocation context
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Create(event, context) {
        return (this.sendResponse(event, context, FAILED,
            { Reason: `"Create" RequestType is not supported by the "${this.resourceType}" resource provider.` }));
    }

    /**
     * Delete the specified custom resource. This default implementation responds to CloudFormation
     * with a FAILED Status.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event
     * @param {Object} context - the Lambda invocation context
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Delete(event, context) {
        return (this.sendResponse(event, context, FAILED,
            { Reason: `"Delete" RequestType is not supported by the "${this.resourceType}" resource provider.` }));
    }

    /**
     * Update the specified custom resource. This default implementation responds to CloudFormation
     * with a FAILED Status.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event
     * @param {Object} context - the Lambda invocation context
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Update(event, context) {
        return (this.sendResponse(event, context, FAILED,
            { Reason: `"Update" RequestType is not supported by the "${this.resourceType}" resource provider.` }));
    }

    /**
     * This method sends the standard CloudFormation custom resource response to
     * the pre-signed S3 URL provided in the event.
     *
     * @param {Object} event - the Custom Resource Request, required
     * @param {Object} context - the Labmda context, this object provides methods and properties that provide
     * information about the invocation, function, and execution environment.
     * @param {string} responseStatus - the status for the repsonse, required
     * @param {Object} responseData - data specific to the created custom resource, optional
     * @param {Boolean} noEcho - indicates whether to mask the output of the custom resource when retrieved bwhen using 
     * the Fn::GetAtt function. If set to true, all returned values are masked with asterisks (*****), optional
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response
     * @protected
     */
    sendResponse(event, context, responseStatus, responseData, noEcho) {
        return (cfnResponse.sendResponse(event, context, responseStatus, responseData, noEcho));
    }

    /**
     * Creates a dry run response, typically used to test locally.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event
     * @returns {Object} - An object that contains a dry run response
     * @protected
     */
    dryRun(event) {

        // Create the response body
        let responseBody = {
            DryRun: true,
            RequestType: event.RequestType,
            ResourceType: event.ResourceType,
            Status: SUCCESS,
            PhysicalResourceId: event.PhysicalResourceId,
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
            Data: event.ResourceProperties.DryRunData
        };

        return (responseBody);
    }

    /**
     * Validates the ResourceProperties based on the custom resources properties schema.
     *
     * @param {Object} properties - The ResourceProperties to validate.
     * @param {string} cfnMethod - The CloudFormation method to validate properties for (Create | Delete | Update).
     * @throws {Error} - If the supplied properties is missing properties or has invalid properties will throw an Error
     * with the validation message in the message property and 'ValidationException' as the name property.
     */
    validateProperties(properties, cfnMethod) {

        // Make sure the ResourceProperties were actually provided, if not throw an error
        if (!properties) {
            let error = new Error('ResourceProperties is missing.');
            error.name = 'ValidationException';
            throw error;
        }

        // No schema was specified, then nothing to validate, get outta here.
        let schema = this.propertiesSchema;
        if (!schema || schema.length == 0) {
            return;
        }

        // Examine the properties to see if they are missing or invalid.
        /* eslint-disable security/detect-object-injection */
        let missingProperties = [];
        let invalidProperties = [];
        schema.forEach((spec) => {

            let specName = spec.Name;

            // The property is present, validate its value
            let propertyValue = (Object.prototype.hasOwnProperty.call(properties, specName) ? properties[specName] : null);
            if (typeof propertyValue === 'string') propertyValue = propertyValue.trim();
            if (propertyValue !== null && propertyValue !== undefined && propertyValue !== '') {

                let isValid = true;
                let dataType = spec.Type || 'string';
                if (dataType == 'boolean') {
                    if (propertyValue === true || propertyValue === 'true') {
                        properties[specName] = true;
                    } else if (propertyValue === false || propertyValue === 'false') {
                        properties[specName] = false;
                    } else {
                        isValid = false;
                    }
                } else if (typeof propertyValue === dataType) {
                    if (dataType === 'string') {
                        let allowedPattern = (spec.AllowedPattern ? spec.AllowedPattern.trim() : null);
                        if (allowedPattern) {
                            if (!propertyValue || !propertyValue.match(allowedPattern)) {
                                isValid = false;
                            }
                        }
                    }
                } else {
                    isValid = false;
                }

                if (!isValid) {
                    invalidProperties.push(specName);
                    if (this._logger) {
                        this._logger.warn({
                            message: 'Invalid property',
                            propertyName: specName,
                            expectedType: dataType,
                            actualType: (typeof propertyValue)
                        });
                    }
                }

            } else if (spec.Required && (spec.Required[cfnMethod] === true || spec.Required === true)) {

                // The property value is missing, see if there is an alternate property that is not missing
                let missingName = specName;
                let alternates = spec.Alternates;
                if (alternates && alternates.length > 0) {
                    for(let alternateName of alternates) {

                        // If we have an alternate property present, then this missing property is not missing
                        let alternatePropertyValue = (properties[alternateName] ? properties[alternateName].trim() : null);
                        if (alternatePropertyValue) {
                            missingName = null;
                        }
                    }
                }

                if (missingName) {
                    missingProperties.push(missingName);
                    if (this._logger) {
                        this._logger.warn({ message: 'Missing required property', propertyName: specName });
                    }
                }

            } else if (spec.Default !== null && spec.Default !== undefined && spec.Default !== '' ) {
                properties[specName] = spec.Default;
            }
        });

        // Create the validation error message
        let validationMessage = null;
        if (invalidProperties.length > 0) {
            validationMessage = `Invalid Properties: [${invalidProperties.join(', ')}]`;
        }

        // Add the missing properties to the message if there are any
        if (missingProperties.length > 0) {
            let msg = `Missing Properties: [${missingProperties.join(', ')}]`;
            if (validationMessage) {
                validationMessage = `${validationMessage}\n${msg}`;
            } else {
                validationMessage = msg;
            }
        }

        // If we have validation issues then throw an error with the validationMessage as the message
        if (validationMessage) {
            let error = new Error(validationMessage);
            error.name = 'ValidationException';
            throw error;
        }
    }
}


exports['default'] = CustomResourceProvider;
module.exports = exports['default'];