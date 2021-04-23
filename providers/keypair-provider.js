'use strict';

const CustomResourceProvider = require('./custom-resource-provider');
const ParameterStore = require('../lib/aws/parameter-store-utils');
const KeyPairUtils = require('../lib/aws/keypair-utils');
const { AwsNames, AwsPatterns, FAILED, SUCCESS, NOT_CREATED } = require('../lib/aws/constants');

const RESOURCE_TYPE = 'Custom::KeyPair';
const RESOURCE_SCHEMA = [
    { Name: 'Description', Required: false },
    { Name: 'KeyName', Required: true, AllowedPattern: AwsPatterns.KEY_PAIR_NAME },
    { Name: 'KmsKeyId', Required: false, AllowedPattern: AwsPatterns.KMS_KEY_ID },
    { Name: 'NoEcho', Required: false, Type: 'boolean', Default: true },
    { Name: 'RotateOnUpdate', Required: false, Type: 'boolean' },
    { Name: 'SecretPath', Required: true, AllowedPattern: AwsPatterns.PARAMETER_PATH },
    { Name: 'Tags', Required: false, Type: 'object' }
];

/**
 * This class is the implementation for the Custom::KeyPair custom resource provider.
 *
 * @extends CustomResourceProvider
 */
class KeyPairProvider extends CustomResourceProvider {

    constructor(log) {
        super(RESOURCE_TYPE, RESOURCE_SCHEMA);
        if (log) {
            this._logger = log;
        } else {
            this._logger = { info: function() { /* ignore */ } };
        }
    }

    /**
     * Get the ResourceType that is provided by this CustomResourceProvider implementation.
     *
     * @returns the ResourceType that is provided by this CustomResourceProvider implementation
     */
    static get RESOURCE_TYPE() {
        return (RESOURCE_TYPE);
    }

    /**
     * Create an EC2 key pair custom resource and store it in the Parameter Store as an encrypted secret.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Create(event, context) {

        let properties = event.ResourceProperties;
        let responseStatus = FAILED;
        let responseData = {};
        let keyPair = null;
        let keyName = properties.KeyName;
        try {

            // First see if any of the KeyPair parameters are stored on the provided SecretPath, if so return FAILED
            let parameters = await this.getKeyPairParameters(properties.SecretPath, true);
            if (parameters && parameters.size != 0) {
                let msg = `Cannot overwrite existing KeyPair parameters, SecretPath=${properties.SecretPath}`;
                return (this.sendResponse(event, context, FAILED, { Reason: msg, PhysicalResourceId: NOT_CREATED }));
            }

            // Create the KeyPair. if it already exists an error will be thrown
            this._logger.info({ message: 'Creating KeyPair', KeyName: keyName });
            keyPair = await KeyPairUtils.createKeyPair(keyName);

            await this.storeKeyPairParameters(keyPair, properties, false, properties.Tags);
            responseData.PhysicalResourceId = keyName;
            responseData.NoEcho = properties.NoEcho;
            responseData.Data = {
                KeyFingerprint: keyPair.KeyFingerprint,
                KeyName: keyName,
                SecretPath: properties.SecretPath
            };

            responseStatus = SUCCESS;

        } catch(err) {

            // If the KeyPair was created here, delete it
            if (keyPair !== null) {
                try {
                    await KeyPairUtils.deleteKeyPair(keyName);
                } catch(deleteErr) { 
                    /* istanbul ignore next */
                    this._logger.warn({ message: 'Error deleting KeyPair', KeyName: keyName });
                }
            }

            responseData = { Reason: err.message, PhysicalResourceId: NOT_CREATED };
        }

        return (this.sendResponse(event, context, responseStatus, responseData));
    }

    /**
     * Delete the KeyPair and associated parameters for the custom resource.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Delete(event, context) {

        let responseStatus = FAILED;
        let responseData = {};
        const keyName = event.PhysicalResourceId;
        if (keyName && keyName !== NOT_CREATED) {

            try {
                this._logger.info({ message: 'Deleting KeyPair', KeyName: keyName });
                await KeyPairUtils.deleteKeyPair(keyName);

                // Delete the stored key pair parameters. but only if the KeyName parameter is equal to the KeyPair being deleted.
                let properties = event.ResourceProperties;
                let parameterName = ParameterStore.getParameterName(properties.SecretPath, AwsNames.KEY_NAME);
                let keyNameParameter = await ParameterStore.getParameterIfExists(parameterName);
                if (keyNameParameter && keyNameParameter.Value === keyName) {
                    await this.deleteKeyPairParameters(properties);
                }

                responseData.PhysicalResourceId = keyName;
                responseData.Data = { KeyName: keyName };
                responseStatus = SUCCESS;

            } catch(err) {
                responseData = { Reason: err.message, PhysicalResourceId: event.PhysicalResourceId };
            }

        } else {
            responseData.PhysicalResourceId = keyName;
            responseData.Data = { KeyName: keyName };
            responseStatus = SUCCESS;
        }

        return (this.sendResponse(event, context, responseStatus, responseData));
    }

    /**
     * Update an EC2 key pair custom resource and update it's data that was stored in the Parameter Store as an encrypted secret.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Update(event, context) {

        const oldProperties = event.OldResourceProperties;
        const properties = event.ResourceProperties;
        const keyName = properties.KeyName;
        let keyPair = null;
        let keyFingerprint = null;
        let responseStatus = FAILED;
        let responseData = {};
        try {

            // First check if any of the KeyPair parameters are stored at the provided SecretPath, if so return FAILED status
            if (properties.SecretPath !== oldProperties.SecretPath) {
                let parameters = await this.getKeyPairParameters(properties.SecretPath, true);
                if (parameters && parameters.size != 0) {
                    let msg = `Cannot overwrite existing KeyPair parameters, SecretPath=${properties.SecretPath}`;
                    return (this.sendResponse(event, context, FAILED, { Reason: msg, PhysicalResourceId: NOT_CREATED }));
                }
            }

            // Set up an array to keep track of what properties changed
            let changedProperties = [];

            // If there are differences between old and new tags or the SecretPath is changing we need to set tags
            let parameterTags = null;
            if (!ParameterStore.tagsAreEqual(properties.Tags, oldProperties.Tags)) {
                parameterTags = properties.Tags;
                changedProperties.push('Tags');
            } else if (properties.SecretPath !== oldProperties.SecretPath) {
                parameterTags = properties.Tags;
            }

            // Did the Description change, if so add it to the changed properties
            if (properties.Description !== oldProperties.Description) {
                changedProperties.push('Description');
            }

            // Something has changed or RotateOnUpdate is true, create a new KeyPair
            if (event.PhysicalResourceId === NOT_CREATED ||
                    properties.RotateOnUpdate === true ||
                    properties.KeyName !== oldProperties.KeyName ||
                    properties.SecretPath !== oldProperties.SecretPath ||
                    properties.KmsKeyId !== oldProperties.KmsKeyId) {

                // Add the changed properties to the changedProperties array.
                if (properties.RotateOnUpdate === true) changedProperties.push('RotateOnUpdate');
                if (properties.KeyName !== oldProperties.KeyName) changedProperties.push('KeyName');
                if (properties.SecretPath !== oldProperties.SecretPath) changedProperties.push('SecretPath');
                if (properties.KmsKeyId !== oldProperties.KmsKeyId) changedProperties.push('KmsKeyId');

                // Delete the KeyPair if the name is not changing
                if (properties.KeyName === oldProperties.KeyName) {
                    await KeyPairUtils.deleteKeyPair(keyName);
                }

                this._logger.info({ message: 'Creating KeyPair', KeyName: properties.KeyName });
                keyPair = await KeyPairUtils.createKeyPair(keyName);
                keyFingerprint = keyPair.KeyFingerprint;

                let overwrite = (properties.SecretPath === oldProperties.SecretPath);
                await this.storeKeyPairParameters(keyPair, properties, overwrite, parameterTags);

                // Delete the old parameters if SecretPath has changed
                if (event.PhysicalResourceId !== NOT_CREATED && oldProperties.SecretPath &&
                        properties.SecretPath !== oldProperties.SecretPath) {
                    await this.deleteKeyPairParameters(oldProperties);
                }

            } else {

                let keyPairParameters = await this.getKeyPairParameters(properties.SecretPath);
                if (keyPairParameters.size != 3) {
                    let msg = `Invalid resource state, missing KeyPair parameters, SecretPath=${properties.SecretPath}`;
                    responseData = { Reason: msg, PhysicalResourceId: NOT_CREATED };
                    return this.sendResponse(event, context, FAILED, responseData);
                }

                // Need to fetch the keyFingerprint using describeKeyPair, this will throw an error
                // if the key pair doesn't exist
                let keyPairInfo = await KeyPairUtils.describeKeyPair(keyName);
                keyFingerprint = keyPairInfo.KeyFingerprint;

                // Update the KeyPair parameters Description and Tags if there were changes to either
                if (properties.Description !== oldProperties.Description) {
                    // Update both the parameters with the new Description and the tags if there are any tag changes
                    keyPairInfo.KeyMaterial = keyPairParameters.get(AwsNames.KEY_MATERIAL).Value;
                    await this.storeKeyPairParameters(keyPairInfo, properties, true, parameterTags);
                } else if (parameterTags) {
                    // Just update the tags
                    await this.storeKeyPairParameters(null, properties, true, parameterTags);
                }
            }

            let reason = (changedProperties.length > 0 ?
                `Updated properties: [${changedProperties.join(', ')}]` :
                'Ignoring Update request, no property changes');
            responseStatus = SUCCESS;
            responseData.Reason = reason;
            responseData.PhysicalResourceId = keyName;
            responseData.NoEcho = properties.NoEcho;
            responseData.Data = {
                KeyFingerprint: keyFingerprint,
                KeyName: keyName,
                SecretPath: properties.SecretPath
            };

        } catch(err) {

            if (keyPair !== null) {
                try {
                    await this.deleteKeyPairParameters(properties);
                } catch(deleteErr) {
                    /* istanbul ignore next */
                    this._logger.warn({ message: 'Error deleting KeyPair parameters', KeyName: keyName });
                }

                try {
                    await KeyPairUtils.deleteKeyPair(keyName);
                } catch(deleteErr) {
                    /* istanbul ignore next */
                    this._logger.warn({ message: 'Error deleting KeyPair', KeyName: keyName });
                }
            }

            responseData = { Reason: err.message, PhysicalResourceId: NOT_CREATED };
        }

        return this.sendResponse(event, context, responseStatus, responseData);
    }

    /**
     * 
     * @param {Object} keyPair - KeyPair data returned by AWS
     * @param {*} properties CloudFormation ResourceProperties
     * @param {boolean} overwrite - Overwrite tags of paramters
     */
    async storeKeyPairParameters(keyPair, properties, overwrite, tags) {

        this._logger.info({
            message: 'Storing KeyPair parameters',
            SecretPath: properties.SecretPath,
            KeyName: properties.KeyName,
            overwrite,
            storeTags: (tags !== null && tags !== undefined)
        });
 
        const keyFingerprintName = ParameterStore.getParameterName(properties.SecretPath, AwsNames.KEY_FINGERPRINT);
        const keyMaterialName = ParameterStore.getParameterName(properties.SecretPath, AwsNames.KEY_MATERIAL);
        const keyNameName = ParameterStore.getParameterName(properties.SecretPath, AwsNames.KEY_NAME);

        // If a keyPair data was provided store its data in the Parameter Store
        if (keyPair) {

            // If overwrite is true we cannot store tags while storing parameters
            const keyFingerprintParams = {
                Name: keyFingerprintName,
                Value: keyPair.KeyFingerprint,
                Description: `${properties.Description || 'KeyPair'} - Key Fingerprint`,
                Tags: tags
            };

            const keyMaterialParams = {
                Name: keyMaterialName,
                Value: keyPair.KeyMaterial,
                Description: `${properties.Description || 'KeyPair'} - Key Material`,
                KeyId: (properties.KmsKeyId || undefined),
                Tags: tags
            };

            const keyNameParams = {
                Name: keyNameName,
                Value: keyPair.KeyName,
                Description: `${properties.Description || 'KeyPair'} - Key Name`,
                Tags: tags
            };

            await ParameterStore.putParameter(keyFingerprintParams, overwrite);
            await ParameterStore.putSecret(keyMaterialParams, overwrite);
            await ParameterStore.putParameter(keyNameParams, overwrite);
        }

        // When Updating overwrite will be true and tags cannot be applied, 
        // so the tags need to be set with setTags()
        if (tags && overwrite) {
            await ParameterStore.setTags(keyFingerprintName, properties.Tags);
            await ParameterStore.setTags(keyMaterialName, properties.Tags);
            await ParameterStore.setTags(keyNameName, properties.Tags);
        }
    }

    /**
     * Delete all the Parameter Store parameters associated with theis KeyPair.
     *
     * @param {Object} properties - The ResourceProperties provided by CloudFormation
     */
    async deleteKeyPairParameters(properties) {

        this._logger.info({
            message: 'Deleting KeyPair parameters',
            SecretPath: properties.SecretPath,
            KeyName: properties.KeyName
        });

        let parameterNames = [
            ParameterStore.getParameterName(properties.SecretPath, AwsNames.KEY_FINGERPRINT),
            ParameterStore.getParameterName(properties.SecretPath, AwsNames.KEY_MATERIAL),
            ParameterStore.getParameterName(properties.SecretPath, AwsNames.KEY_NAME)
        ];

        for(let parameterName of parameterNames) {
            let results = await ParameterStore.deleteParameterIfExists(parameterName);
            this._logger.info({ message: 'deleteParameterIfExists', parameterName, results });
        }
    }

    /**
     * Get a Map of the 'key_fingerprint', 'key_material', and 'key_name' parameters.
     *
     * @param {String} secretPath - The path where vthe key pair parameters are stored.
     * @param {Boolean} firstOnly - Return only the first found, otherwise returns all parameters that were found.
     * @returns {Map} - A Promise that when fulfilled contains a Map of the fetched key pair parameters.
     */
    getKeyPairParameters(secretPath, firstOnly) {
        let parametersNames = [AwsNames.KEY_NAME, AwsNames.KEY_FINGERPRINT];
        let secretNames = [AwsNames.KEY_MATERIAL];
        return ParameterStore.getParameters(secretPath, parametersNames, secretNames, firstOnly);
    }
}

exports['default'] = KeyPairProvider;
module.exports = exports['default'];