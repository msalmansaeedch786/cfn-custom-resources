'use strict';

const CustomResourceProvider = require('./custom-resource-provider');
const KeyPairUtils = require('../lib/aws/keypair-utils');
const { FAILED, SUCCESS, NOT_CREATED } = require('../lib/aws/constants');

const RESOURCE_TYPE = 'Custom::ImportKeyPair';
const RESOURCE_SCHEMA = [
    { Name: 'KeyName', Required: true },
    { Name: 'PublicKeyMaterial', Required: { Create: true, Update: true } }
];

/**
* This class is the implementation for the Custom::ImportKeyPair custom resource provider.
 *
 * @extends CustomResourceProvider
 */
class ImportKeyPairProvider extends CustomResourceProvider {

    constructor(log) {
        super(RESOURCE_TYPE, RESOURCE_SCHEMA, log);
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
     * Create the imported key pair custom resource.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Create(event, context) {

        let properties = event.ResourceProperties;
        let responseStatus = FAILED;
        let responseData = {};
        try {

            this._logger.info({ message: 'Importing KeyPair', KeyName: properties.KeyName });
            let results = await KeyPairUtils.importKeyPair(properties.KeyName, properties.PublicKeyMaterial);
            responseData.PhysicalResourceId = results.KeyName;
            responseData.Data = { KeyName: results.KeyName, KeyFingerprint: results.KeyFingerprint };
            responseStatus = SUCCESS;

        } catch(err) {
            responseData = { Reason: err.message, PhysicalResourceId: NOT_CREATED };
        }

        return (this.sendResponse(event, context, responseStatus, responseData));
    }

    /**
     * Delete a imported key pair custom resource.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Delete(event, context) {

        let properties = event.ResourceProperties;
        let responseStatus = FAILED;
        let responseData = {};
        try {

            // Delete the EC2 key pair
            this._logger.info({ message: 'Deleting KeyPair', KeyName: event.PhysicalResourceId });
            await KeyPairUtils.deleteKeyPair(event.PhysicalResourceId);
            responseStatus = SUCCESS;
            responseData.PhysicalResourceId = properties.KeyName;
            responseData.Data = { KeyName: properties.KeyName };

        } catch(err) {
            /* istanbul ignore next - This error will never happen, but we have to be safe */
            responseData = { Reason: err.message, PhysicalResourceId: event.PhysicalResourceId };
        }

        return (this.sendResponse(event, context, responseStatus, responseData));
    }

    /**
     * Update a imported key pair custom resource.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Update(event, context) {

        let oldProperties = event.OldResourceProperties;
        let properties = event.ResourceProperties;
        let responseStatus = FAILED;
        let responseData = {};
        if ((oldProperties.KeyName && oldProperties.KeyName !== properties.KeyName) ||
            (oldProperties.PublicKeyMaterial && oldProperties.PublicKeyMaterial !== properties.PublicKeyMaterial) ||
            event.PhysicalResourceId === NOT_CREATED) {

            try {

                // First Delete KeyPair if KeyName is not changing
                if (event.PhysicalResourceId !== NOT_CREATED && oldProperties.KeyName === properties.KeyName) {
                    this._logger.info({ message: 'Deleting current KeyPair', KeyName: properties.KeyName });
                    await KeyPairUtils.deleteKeyPair(properties.KeyName);
                }

                this._logger.info({ message: 'Importing KeyPair', KeyName: properties.KeyName });
                let results = await KeyPairUtils.importKeyPair(properties.KeyName, properties.PublicKeyMaterial);
                responseData.PhysicalResourceId = results.KeyName;
                responseData.Data = { KeyName: results.KeyName, KeyFingerprint: results.KeyFingerprint };
                responseStatus = SUCCESS;

            } catch(err) {
                responseData = { Reason: err.message, PhysicalResourceId: NOT_CREATED };
            }

        } else {
            try {

                this._logger.info({ message: 'Getting KeyPair info.', KeyName: properties.KeyName });
                let results = await KeyPairUtils.describeKeyPair(properties.KeyName);
                responseStatus = SUCCESS;
                responseData.Reason = 'Ignoring Update request, no property changes.';
                responseData.PhysicalResourceId = properties.KeyName;
                responseData.Data = { KeyName: properties.KeyName, KeyFingerprint: results.KeyFingerprint };

            } catch(err) {
                responseData = { Reason: err.message, PhysicalResourceId: NOT_CREATED };
            }
        }

        return (this.sendResponse(event, context, responseStatus, responseData));
    }
}

exports['default'] = ImportKeyPairProvider;
module.exports = exports['default'];