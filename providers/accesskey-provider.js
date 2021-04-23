'use strict';

const crypto = require('crypto');
const AWS = require('aws-sdk');
const ParameterStore = require('../lib/aws/parameter-store-utils');
const { AwsNames, AwsPatterns, FAILED, SUCCESS, MASKED_SECRET, NOT_CREATED } = require('../lib/aws/constants');
const CustomResourceProvider = require('./custom-resource-provider');

const RESOURCE_TYPE = 'Custom::AccessKey';
const RESOURCE_SCHEMA = [
    { Name: 'Description', Required: false, Type: 'string' },
    { Name: 'KmsKeyId', Required: false, Type: 'string', AllowedPattern: AwsPatterns.KMS_KEY_ID },
    { Name: 'NoEcho', Required: false, Type: 'boolean', Default: true },
    { Name: 'ReturnSecret', Required: false, Type: 'boolean' },
    { Name: 'ReturnSmtpPassword', Required: false, Type: 'boolean' },
    { Name: 'RotateOnUpdate', Required: false, Type: 'boolean' },
    { Name: 'SecretPath', Required: true, Type: 'string' },
    { Name: 'Tags', Required: false, Type: 'object' },
    { Name: 'UserName', Required: true, Type: 'string', AllowedPattern: AwsPatterns.USER_NAME }
];

/**
 * This class is the implementation for the Custom::AccessKey custom resource provider.
 *
 * @extends CustomResourceProvider
 */
class AccessKeyProvider extends CustomResourceProvider {

    constructor(log) {
        super(RESOURCE_TYPE, RESOURCE_SCHEMA, log);
        this._logger = log;
    }

    /**
     * Get the ResourceType that is provided by this CustomResourceProvider implementation.
     *
     * @returns the ResourceType that is provided by this CustomResourceProvider implementation.
     */
    static get RESOURCE_TYPE() {
        return (RESOURCE_TYPE);
    }

    /**
     * Create an AccessKey custom resource and store it in the Parameter Store as an encrypted secret.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Create(event, context) {

        let properties = event.ResourceProperties;
        let responseStatus = FAILED;
        let responseData = {};
        let accessKey = null;
        try {

            // First see if any of the AccessKey parameters are stored on the provided SecretPath, if so return FAILED
            let parameters = await this.getAccessKeyParameters(properties.SecretPath, true);
            if (parameters && parameters.size != 0) {
                let msg = `Cannot overwrite existing AccessKey parameters, SecretPath=${properties.SecretPath}`;
                return (this.sendResponse(event, context, FAILED, { Reason: msg, PhysicalResourceId: NOT_CREATED }));
            }

            // Create the AccessKey and calculate the SMTP password
            accessKey = await this.createAccessKey(properties.UserName);
            let smtpPassword = this.calculateSmtpPassword(accessKey.SecretAccessKey);

            // Store all the values in the Parameter Store
            let accessKeyValues = {
                AccessKeyId: accessKey.AccessKeyId,
                SecretAccessKey: accessKey.SecretAccessKey,
                SmtpPassword: smtpPassword
            };
            await this.storeAccessKeyParameters(accessKeyValues, properties, false, properties.Tags);

            responseStatus = SUCCESS;
            responseData.NoEcho = properties.NoEcho;
            responseData.PhysicalResourceId = accessKey.AccessKeyId;
            responseData.Data = {
                AccessKeyId: accessKey.AccessKeyId,
                SecretPath: properties.SecretPath,
                UserName: accessKey.UserName
            };

            if (properties.ReturnSecret === true) {
                responseData.Data.SecretAccessKey = accessKey.SecretAccessKey;
            } else {
                responseData.Data.SecretAccessKey = MASKED_SECRET;
            }

            if (properties.ReturnSmtpPassword === true) {
                responseData.Data.SmtpPassword = smtpPassword;
            } else {
                responseData.Data.SmtpPassword = MASKED_SECRET;
            }

        } catch(err) {

            // If the AccessKey was created delete it
            if (accessKey && accessKey.AccessKeyId) {
                try {
                    await this.deleteAccessKey(accessKey.UserName, accessKey.AccessKeyId);
                } catch(deleteErr) {
                    /* istanbul ignore next */
                    this._logger.warn({ message: 'Error deleting AccessKey',
                        UserName: accessKey.UserName, AccessKeyId: accessKey.AccessKeyId });
                }
            }

            responseData = { Reason: err.message, PhysicalResourceId: NOT_CREATED };
        }

        return (this.sendResponse(event, context, responseStatus, responseData));
    }

    /**
     * Delete the AccessKey custom resource and its associated parameters in the Parameter Store.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event
     * @param {Object} context - the Lambda invocation context
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Delete(event, context) {

        let responseStatus = FAILED;
        let responseData = {};
        let properties = event.ResourceProperties;
        let accessKeyId = event.PhysicalResourceId;
        if (accessKeyId && accessKeyId !== NOT_CREATED) {

            try {

                // Delete the AccessKey
                try {
                    await this.deleteAccessKey(properties.UserName, accessKeyId);
                } catch(err) {
                    // Ignore not found AccessKey
                }

                // Delete the stored AccessKey parameters. but only if the AccessKeyId parameter is equal to the AccessKey being deleted.
                let parameterName = ParameterStore.getParameterName(properties.SecretPath, AwsNames.ACCESS_KEY_ID);
                let accessKeyIdParameter = await ParameterStore.getParameterIfExists(parameterName);
                if (accessKeyIdParameter && accessKeyIdParameter.Value === accessKeyId) {
                    await this.deleteAccessKeyParameters(properties);
                }

            } catch(err) {
                responseData = { Reason: err.message, PhysicalResourceId: accessKeyId };
                return (this.sendResponse(event, context, FAILED, responseData));
            }
        }

        responseStatus = SUCCESS;
        responseData.PhysicalResourceId = accessKeyId;
        responseData.Data = {
            AccessKeyId: accessKeyId,
            UserName: properties.UserName
        };

        return (this.sendResponse(event, context, responseStatus, responseData));
    }

    /**
     * Update an AccessKey custom resource and update its associated parameters stored in the Parameter Store.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event
     * @param {Object} context - the Lambda invocation context
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Update(event, context) {

        let properties = event.ResourceProperties;
        let oldProperties = event.OldResourceProperties;
        let accessKeyId = event.PhysicalResourceId;
        let accessKey = null;
        let responseStatus = FAILED;
        let responseData = {};
        try {

            // First check if any of the AccessKey parameters are stored at the provided SecretPath, if so return FAILED status
            if (oldProperties.SecretPath !== properties.SecretPath) {
                let parameters = await this.getAccessKeyParameters(properties.SecretPath, true);
                if (parameters && parameters.size != 0) {
                    let msg = `Cannot overwrite existing AccessKey parameters, SecretPath=${properties.SecretPath}`;
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

            // Used to put the data that can be returned to CloudFormation
            let accessKeyValues = null;

            // Something has changed or RotateOnUpdate is true, create a new AccessKey
            if (event.PhysicalResourceId === NOT_CREATED ||
                    properties.RotateOnUpdate === true ||
                    properties.UserName !== oldProperties.UserName ||
                    properties.SecretPath !== oldProperties.SecretPath ||
                    properties.KmsKeyId !== oldProperties.KmsKeyId) {

                // Add the changed properties to the changedProperties array.
                if (properties.RotateOnUpdate === true) changedProperties.push('RotateOnUpdate');
                if (properties.UserName !== oldProperties.UserName) changedProperties.push('UserName');
                if (properties.SecretPath !== oldProperties.SecretPath) changedProperties.push('SecretPath');
                if (properties.KmsKeyId !== oldProperties.KmsKeyId) changedProperties.push('KmsKeyId');

                // Normally we let CloudFormation delete resources when the PhysicalResourceId changes, but
                // because of the limited number of AccessKeys available, we delete it here, Delete will
                // still be invoked by CloudFormation which will try and delete it again without failure
                if (event.PhysicalResourceId !== NOT_CREATED) {
                    try {
                        await this.deleteAccessKey(oldProperties.UserName, accessKeyId);
                    } catch(err) {
                        // Ignore not found AccessKey
                    }

                    // Delete the old parameters if SecretPath has changed
                    if (oldProperties.SecretPath && properties.SecretPath !== oldProperties.SecretPath) {
                        await this.deleteAccessKeyParameters(oldProperties);
                    }
                }

                // Create the new AccessKey and calculate the SMTP password
                accessKey = await this.createAccessKey(properties.UserName);
                let smtpPassword = this.calculateSmtpPassword(accessKey.SecretAccessKey);
                accessKeyValues = {
                    AccessKeyId: accessKey.AccessKeyId,
                    SecretAccessKey: accessKey.SecretAccessKey,
                    SmtpPassword: smtpPassword
                };

                // Store all the AccessKey info in the Parameter Store
                let overwrite = (properties.SecretPath === oldProperties.SecretPath);
                await this.storeAccessKeyParameters(accessKeyValues, properties, overwrite, parameterTags);

            } else {

                let accessKeyParameters = await this.getAccessKeyParameters(properties.SecretPath);
                if (accessKeyParameters.size != 3) {
                    let msg = `Invalid resource state, missing AccessKey parameters, SecretPath=${properties.SecretPath}`;
                    responseData = { Reason: msg, PhysicalResourceId: NOT_CREATED };
                    return this.sendResponse(event, context, FAILED, responseData);
                }

                let secretAccessKey = accessKeyParameters.get(AwsNames.SECRET_ACCESS_KEY).Value;
                let smtpPassword = accessKeyParameters.get(AwsNames.SES_SMTP_PASSWORD).Value;
                accessKeyValues = {
                    AccessKeyId: accessKeyId,
                    SecretAccessKey: secretAccessKey,
                    SmtpPassword: smtpPassword
                };

                // Update the AccessKey parameters Description and Tags if there were changes to either
                if (properties.Description !== oldProperties.Description) {
                    // Update both the parameters with the new Description and the tags if there are any tag changes 
                    await this.storeAccessKeyParameters(accessKeyValues, properties, true, parameterTags);
                } else if (parameterTags) {
                    // Just update the tags
                    await this.storeAccessKeyParameters(null, properties, true, parameterTags);
                }
            }

            let reason = (changedProperties.length > 0 ?
                `Updated properties: [${changedProperties.join(', ')}]` :
                'Ignoring Update request, no property changes');
            responseStatus = SUCCESS;
            responseData.Reason = reason;
            responseData.PhysicalResourceId = accessKeyValues.AccessKeyId;
            responseData.NoEcho = properties.NoEcho;
            responseData.Data = { 
                AccessKeyId: accessKeyValues.AccessKeyId,
                SecretPath: properties.SecretPath,
                UserName: properties.UserName
            };

            if (properties.ReturnSecret === true) {
                responseData.Data.SecretAccessKey = accessKeyValues.SecretAccessKey;
            } else {
                responseData.Data.SecretAccessKey = MASKED_SECRET;
            }

            if (properties.ReturnSmtpPassword === true) {
                responseData.Data.SmtpPassword = accessKeyValues.SmtpPassword;
            } else {
                responseData.Data.SmtpPassword = MASKED_SECRET;
            }

        } catch(err) {
            if (accessKey !== null) {
                try {
                    await this.deleteAccessKeyParameters(properties);
                } catch(deleteErr) {
                    /* istanbul ignore next */
                    this._logger.warn({ message: 'Error deleting AccessKey parameters', AccessKeyId: accessKey.AccessKeyId });
                }

                try {
                    await this.deleteAccessKey(accessKey.UserName, accessKey.AccessKeyId);
                } catch(deleteErr) {
                    /* istanbul ignore next */
                    this._logger.warn({ message: 'Error deleting AccessKey', AccessKeyId: accessKey.AccessKeyId });
                }
            }

            responseData = { Reason: err.message, PhysicalResourceId: NOT_CREATED };
        }

        return this.sendResponse(event, context, responseStatus, responseData);
    }

    /**
     * Create the SES SMTP password.
     *
     * @param {String} secretAccessKey - secret key of an IAM User.
     * @returns {String} - Calculated SES SMTP password of for the Secret Access Key.
     */
    calculateSmtpPassword(secretAccessKey) {

        // Values that are required to calculate the signature. These values will never change.
        const SMTP_MESSAGE = 'SendRawEmail';
        const SMTP_VERSION = Buffer.from([0x02]);

        // Compute an HMAC-SHA256 key from the AWS secret access key.
        let signature = crypto.createHmac('sha256', secretAccessKey).update(SMTP_MESSAGE).digest();

        // Prepend the version number to the signature.
        let signatureAndVersion = Buffer.concat([SMTP_VERSION, signature]);

        // Base64-encode the string that contains the version number and signature.
        return signatureAndVersion.toString('base64');
    }

    /**
     * Create an AccessKey using the IAM API.
     *
     * @param {String} userName - an user name of the IAM user to create
     * @returns {Promise} - A Promise for the created AccessKey
     */
    createAccessKey(userName) {

        this._logger.info({ message: 'Creating AccessKey', UserName: userName });
        let iam = new AWS.IAM({});

        // Set up and return a promise for the AccessKey results
        return new Promise((resolve, reject) => {
            iam.createAccessKey({ UserName: userName }, (error, data) => {
                if (error) {
                    return reject(error);
                } else {
                    return resolve(data.AccessKey);
                }
            });
        });
    }

    /**
     * Delete the AccessKey specified by the username and access key ID.
     *
     * @param {String} userName - The username that the access key belongs to.
     * @param {String} accessKeyId - The access key ID to delete
     * @returns {Promise} a Promise for the results of the AccessKey deletion.
     */
    deleteAccessKey(userName, accessKeyId) {
        this._logger.info({ message: 'Deleting AccessKey', AccessKeyId: accessKeyId, UserName: userName });
        let iam = new AWS.IAM({});
        return iam.deleteAccessKey({ AccessKeyId: accessKeyId, UserName: userName }).promise();
    }

    /**
     * Delete the 'access_key_id', 'secret_access_key', and 'ses_smtp_password' parameters from the Parameter Store.
     *
     * @param {Object} properties - The ResourceProperties provided by CloudFormation
     */
    async deleteAccessKeyParameters(properties) {

        this._logger.info({
            message: 'Deleting AccessKey parameters',
            SecretPath: properties.SecretPath
        });

        let parameterNames = [
            ParameterStore.getParameterName(properties.SecretPath, AwsNames.ACCESS_KEY_ID),
            ParameterStore.getParameterName(properties.SecretPath, AwsNames.SECRET_ACCESS_KEY),
            ParameterStore.getParameterName(properties.SecretPath, AwsNames.SES_SMTP_PASSWORD)
        ];

        for(let parameterName of parameterNames) {
            let result = await ParameterStore.deleteParameterIfExists(parameterName);
            this._logger.info({ message: 'deleteParameterIfExists', parameterName, result });
        }
    }

    /**
     * Deletes the AccessKey and associated parameters if the parameters for an AccessKey resource
     * are found at the provided parameter path.
     *
     * @param {string} secretPath - The parameter path where the parameters should be located.
     * @param {string} userName  - The username that the AccessKey should belong to.
     * @returns {Promise} - Returns a promise that will resolve once the resources have all been deleted.
     */
    async deleteAccessKeyResources(secretPath, userName) {

        // First get the parameters, if they are all present, then delete them, if not return false
        let accessKeyParameters = await this.getAccessKeyParameters(secretPath);
        if (accessKeyParameters.size != 3) {
            return Promise.resolve();
        }

        // Get the value of the AccessKeyId parameter
        let accessKeyId = accessKeyParameters.get(AwsNames.ACCESS_KEY_ID).Value;

        // Delete the AccessKey specified in the parammeter
        try {
            await this.deleteAccessKey(userName, accessKeyId);
        } catch(err) {
            // Ignore not found AccessKey
        }

        // Delete the stored AccessKey parameters
        accessKeyParameters.forEach(async (param) => {
            await ParameterStore.deleteParameterIfExists(param.Name);
        });

        return Promise.resolve();
    }

    /**
     * Get a Map of the 'access_key_id', 'secret_access_key', and 'ses_smtp_password' parameters.
     *
     * @param {String} secretPath - The path where vthe key pair parameters are stored.
     * @param {Boolean} firstOnly - Return only the first found, otherwise returns all parameters that were found.
     * @returns {Map} - A Promise that when fulfilled contains a Map of the fetched key pair parameters.
     */
    getAccessKeyParameters(secretPath, firstOnly) {
        let parametersNames = [AwsNames.ACCESS_KEY_ID];
        let secretNames = [AwsNames.SECRET_ACCESS_KEY, AwsNames.SES_SMTP_PASSWORD];
        return ParameterStore.getParameters(secretPath, parametersNames, secretNames, firstOnly);
    }

    /**
     * Store the AccessKey related data in the Parameter STore.
     *
     * @param {Object} values - AccessKey related data to store.
     * @param {*} properties CloudFormation ResourceProperties.
     * @param {boolean} overwrite - putParameter() overwrite setting.
     * @param, {Array} tags - An array of tag Key/Value pairs for the parameter tags.
     */
    async storeAccessKeyParameters(values, properties, overwrite, tags) {

        const accessKeyIdName = ParameterStore.getParameterName(properties.SecretPath, AwsNames.ACCESS_KEY_ID);
        const secretAccessKeyName = ParameterStore.getParameterName(properties.SecretPath, AwsNames.SECRET_ACCESS_KEY);
        const sesSmtpPasswordName = ParameterStore.getParameterName(properties.SecretPath, AwsNames.SES_SMTP_PASSWORD);

        // If AccessKey data was provided store its data in the Parameter Store
        if (values) {

            this._logger.info({
                message: 'Storing AccessKey parameters',
                SecretPath: properties.SecretPath,
                AccessKeyId: values.AccessKeyId,
                overwrite
            });

            // If overwrite is true we cannot store tags while storing parameters
            const accessKeyIdParams = {
                Name: accessKeyIdName,
                Value: values.AccessKeyId,
                Description: `${properties.Description || 'AccessKey'} - Access Key ID`,
                Tags: tags
            };

            const secretAccessKeyParams = {
                Name: secretAccessKeyName,
                Value: values.SecretAccessKey,
                Description: `${properties.Description || 'AccessKey'} - Secret Access Key`,
                KeyId: (properties.KmsKeyId || undefined),
                Tags: tags
            };

            const sesSmtpPasswordParams = {
                Name: sesSmtpPasswordName,
                Value: values.SmtpPassword,
                Description: `${properties.Description || 'AccessKey'} - SES SMTP Password`,
                KeyId: (properties.KmsKeyId || undefined),
                Tags: tags
            };

            await ParameterStore.putParameter(accessKeyIdParams, overwrite);
            await ParameterStore.putSecret(secretAccessKeyParams, overwrite);
            await ParameterStore.putSecret(sesSmtpPasswordParams, overwrite);
        }

        // When Updating overwrite will be true and tags cannot be applied, 
        // so the tags need to be set with setTags()
        if (tags && overwrite) {

            this._logger.info({
                message: 'Setting AccessKey parameter tags',
                SecretPath: properties.SecretPath
            });

            await ParameterStore.setTags(accessKeyIdName, tags);
            await ParameterStore.setTags(secretAccessKeyName, tags);
            await ParameterStore.setTags(sesSmtpPasswordName, tags);
        }
    }
}

exports['default'] = AccessKeyProvider;
module.exports = exports['default'];