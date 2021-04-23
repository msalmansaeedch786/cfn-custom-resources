'use strict';

const RandExp = require('randexp');
const KmsUtils = require('../lib/aws/kms-utils');
const ParameterStore = require('../lib/aws/parameter-store-utils');
const CustomResourceProvider = require('./custom-resource-provider');
const { AwsPatterns, FAILED, SUCCESS, MASKED_SECRET, NOT_CREATED } = require('../lib/aws/constants');

const RESOURCE_TYPE = 'Custom::Secret';
const RESOURCE_SCHEMA = [
    { Name: 'Description', Required: false },
    { Name: 'EncryptedSecret', Required: false },
    { Name: 'KmsKeyId', Required: false, AllowedPattern: AwsPatterns.KMS_KEY_ID },
    { Name: 'Name', Required: true, AllowedPattern: AwsPatterns.PARAMETER_NAME },
    { Name: 'NoEcho', Required: false, Type: 'boolean', Default: true },
    { Name: 'PlainSecret', Required: false },
    { Name: 'ReturnSecret', Required: false, Type: 'boolean' },
    { Name: 'RotateOnUpdate', Required: false, Type: 'boolean' },
    { Name: 'SecretPattern', Required: false },
    { Name: 'Tags', Required: false, Type: 'object' }
];

const DEFAULT_SECRET_LENGTH = 32;
const DEFAULT_SECRET_PATTERN = '[A-Za-z0-9_.,!$&;?@]';

/**
 * <p>This class is the implementation for the Custom::Secret custom resource provider.
 *
 * @extends CustomResourceProvider
 */
class SecretProvider extends CustomResourceProvider {

    /**
     * Constructor for the SecretProvider class.
     *
     * @param {Object} log - The global logger from the Lambda handler.
     * @constructor
     */
    constructor(log) {
        super(RESOURCE_TYPE, RESOURCE_SCHEMA);
        this._logger = log;
    }

    /**
     * Get the ResourceType that is provided by this CustomResourceProvider implementation.
     *
     * @returns {string} - The ResourceType that is provided by this CustomResourceProvider implementation.
     */
    static get RESOURCE_TYPE() {
        return RESOURCE_TYPE;
    }

    /**
     * Create a secret and store it in the Parameter Store as an encrypted string.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Create(event, context) {

        const properties = event.ResourceProperties;
        let responseStatus = FAILED;
        let responseData = {};
        try {

            let secretValue = null;
            if (properties.EncryptedSecret) {
                secretValue = await KmsUtils.decryptKmsSecret(properties.EncryptedSecret);
            } else if (properties.PlainSecret) {
                secretValue = properties.PlainSecret;
            } else {
                secretValue = this.getRandomSecretValue(properties);
            }

            let params = {
                Name: properties.Name,
                Value: secretValue,
                Description: properties.Description,
                Tags: properties.Tags,
                KeyId: (properties.KmsKeyId || undefined),
            };

            // Store the secret in the Parameter Store, this will throw an exception if the secret already exists
            this._logger.info({ message: 'Storing secret', Name: properties.Name });
            let result = await ParameterStore.putSecret(params, false);

            responseStatus = SUCCESS;
            responseData.NoEcho = properties.NoEcho;
            responseData.PhysicalResourceId = properties.Name;
            responseData.Reason = 'Created secret parameter';
            responseData.Data = { Name: properties.Name, Version: result.Version };
            if (properties.ReturnSecret === true) {
                responseData.Data.Secret = secretValue;
            } else {
                responseData.Data.Secret = MASKED_SECRET;
            }

        } catch (err) {
            responseData = { Reason: err.message, PhysicalResourceId: NOT_CREATED };
        }

        return (this.sendResponse(event, context, responseStatus, responseData));
    }

    /**
     * Delete a secret custom resource and its associated secret in the Parameter Store.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Delete(event, context) {

        const properties = event.ResourceProperties;
        let responseStatus = FAILED;
        let responseData = {};
        try {

            let secretName = event.PhysicalResourceId;
            if (secretName && secretName !== NOT_CREATED) {
                this._logger.info({ message: 'Deleting secret', PhysicalResourceId: event.PhysicalResourceId });
                let results = await ParameterStore.deleteParameterIfExists(secretName);
                responseData.Reason = (results === ParameterStore.PARAMETER_NOT_FOUND ?
                    'Ignoring secret, secret not found' : 'Deleted secret');
            } else {
                responseData.Reason = `Ignoring secret, Name=${secretName}`;
            }

            responseStatus = SUCCESS;
            responseData.PhysicalResourceId = secretName;
            responseData.Data = { Name: properties.Name };

        } catch (err) {
            responseData = { Reason: err.message };
        }

        return (this.sendResponse(event, context, responseStatus, responseData));
    }

    /**
     * Update a secret custom resource and update it's data that was stored in the Parameter Store as an encrypted secret.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Update(event, context) {

        const properties = event.ResourceProperties;
        const oldProperties = event.OldResourceProperties;
        let responseStatus = FAILED;
        let responseData = {};
        try {

            let newParameter = false;
            let changedProperties = [];
            if (event.PhysicalResourceId === NOT_CREATED || properties.Name !== oldProperties.Name) {
                let results = await ParameterStore.getSecretIfExists(properties.Name);
                if (results) {
                    let msg = `Update cannot overwrite existing parameter, Name=${properties.Name}`;
                    return (this.sendResponse(event, context, FAILED, { Reason: msg, PhysicalResourceId: NOT_CREATED }));
                }

                newParameter = true;
                changedProperties.push('Name');
            }

            let rotateOnUpdate = properties.RotateOnUpdate;
            let shouldUpdateRandomSecret = (rotateOnUpdate === true ||
                properties.KmsKeyId !== oldProperties.KmsKeyId ||
                properties.SecretPattern !== oldProperties.SecretPattern ||
                properties.Length !== oldProperties.Length ||
                event.PhysicalResourceId === NOT_CREATED);
            let secretValue = null;
            let version = null;
            if (properties.EncryptedSecret && (properties.EncryptedSecret !== oldProperties.EncryptedSecret || rotateOnUpdate === true)) {
                secretValue = await KmsUtils.decryptKmsSecret(properties.EncryptedSecret);
                changedProperties.push(properties.EncryptedSecret !== oldProperties.EncryptedSecret ? 'EncryptedSecret' : 'RotateOnUpdate');
            } else if (properties.PlainSecret && (properties.PlainSecret !== oldProperties.PlainSecret || rotateOnUpdate === true)) {
                secretValue = properties.PlainSecret;
                changedProperties.push(properties.PlainSecret !== oldProperties.PlainSecret ? 'PlainSecret' : 'RotateOnUpdate');
            } else if (!properties.EncryptedSecret && !properties.PlainSecret && shouldUpdateRandomSecret) {
                secretValue = this.getRandomSecretValue(properties);
                changedProperties.push(properties.SecretPattern !== oldProperties.SecretPattern ? 'SecretPattern' :
                    properties.Length !== oldProperties.Length ? 'Length' :
                    properties.KmsKeyId !== oldProperties.KmsKeyId ? 'KmsKeyId' : 'RotateOnUpdate');
            }  else {
                let storedSecret = await ParameterStore.getSecret(event.PhysicalResourceId);
                secretValue = storedSecret.Parameter.Value;
                version = storedSecret.Parameter.Version;
            }

            if (properties.Description !== oldProperties.Description) {
                changedProperties.push('Description');
            }

            // If the KmsKeyId changed and is not in the changedProperties add it
            if (properties.KmsKeyId !== oldProperties.KmsKeyId && !changedProperties.includes('KmsKeyId')) {
                changedProperties.push('KmsKeyId');
            }

            // If we have an updatedValue store the secret
            if (changedProperties.length > 0) {
                let params = {
                    Name: properties.Name,
                    Value: secretValue,
                    Description: properties.Description || '',
                    KeyId: (properties.KmsKeyId || undefined),
                    Tags: (newParameter ? properties.Tags : undefined)
                };

                this._logger.info({ message: 'Updating secret', Name: properties.Name, OldName: oldProperties.Name });
                let storedSecret = await ParameterStore.putSecret(params, !newParameter);
                version = storedSecret.Version;
            }

            // If not a new parameter and the tags have changed update the tags
            if (!newParameter && !ParameterStore.tagsAreEqual(oldProperties.Tags, properties.Tags)) {
                this._logger.info({ message: 'Updating tags on secret', Name: properties.Name });
                await ParameterStore.setTags(properties.Name, properties.Tags);
                changedProperties.push('Tags');
            }

            let reason = (changedProperties.length > 0 ?
                    `Updated properties: [${changedProperties.join(', ')}]` :
                    'Ignoring Update request, no property changes');
            responseStatus = SUCCESS;
            responseData.NoEcho = properties.NoEcho;
            responseData.PhysicalResourceId = properties.Name;
            responseData.Reason = reason;
            responseData.Data = { Name: properties.Name, Version: version };
            if (properties.ReturnSecret === true) {
                responseData.Data.Secret = secretValue;
            } else {
                responseData.Data.Secret = MASKED_SECRET;
            }

        } catch (err) {
            responseData = { Reason: err.message, PhysicalResourceId: NOT_CREATED };
        }

        return (this.sendResponse(event, context, responseStatus, responseData));
    }

    /**
     * Create a random secret based on given pattern or according to the default one with given or default length.
     * @param {{Object}} properties - the CloudFormation Custom Resource Properties.
     * @returns {string} - The randomly generated string based on pattern and length.
     */
    getRandomSecretValue(properties) {
        if (!properties.SecretPattern) {

            let pattern = DEFAULT_SECRET_PATTERN;
            let length = properties.Length || DEFAULT_SECRET_LENGTH;
            pattern += `{${length}}`;

            return new RandExp(pattern).gen();
        } else {
            return new RandExp(properties.SecretPattern).gen();
        }
    }
}

exports['default'] = SecretProvider;
module.exports = exports['default'];