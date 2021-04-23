'use strict';

const AWS = require('aws-sdk');

/** Constant for ParameterNotFound error type */
const PARAMETER_NOT_FOUND = 'ParameterNotFound';

/** Constant for paramter deleted with deleteParameterIfExists() */
const PARAMETER_DELETED = 'ParameterDeleted';

/**
 * Delete a parameter from the SSM Parameter Store.
 *
 * @param {string} parameterName - The name of the parameter string to delete
 * @param {string} region - The AWS region of for the SSM Parameter Store, optional
 * @returns {Promise} A promise for the delete parameter operation
 */
function deleteParameter(parameterName, region) {
    let ssm = (region ? new AWS.SSM({ region: region }) : new AWS.SSM());
    return (ssm.deleteParameter({ Name: parameterName }).promise());
}

/**
 * Delete a parameter if it exists, will not throw an error if the parameter is not found.
 *
 * @param {string} parameterName - The name of the parameter string to delete
 * @param {string} region - The AWS region of for the SSM Parameter Store, optional
 * @returns {Promise} A promise for the delete parameter operation
 */
async function deleteParameterIfExists(parameterName, region) {

    let ssm = (region ? new AWS.SSM({ region: region }) : new AWS.SSM());
    try {
        await ssm.deleteParameter({ Name: parameterName }).promise();
        return Promise.resolve(PARAMETER_DELETED);
    } catch(err) {
        if (err.name === PARAMETER_NOT_FOUND) {
            return Promise.resolve(PARAMETER_NOT_FOUND);
        } else {
            return Promise.reject(err);
        }
    }
}

/**
 * Delete an array of parameters from the SSM Parameter Store.
 *
 * @param {Array} parameterNames - An array holding the names of the parameters to delete
 * @param {string} region - The AWS region of for the SSM Parameter Store, optional
 * @returns {Promise} A promise for the delete parameters operation
 */
function deleteParameters(parameterNames, region) {
    let ssm = (region ? new AWS.SSM({ region: region }) : new AWS.SSM());
    return (ssm.deleteParameters({ Names: parameterNames }).promise());
}

/**
 * Delete an encrypted string from the SSM Parameter Store.
 *
 * @param {string} secretName - The name of the encrypted string to delete
 * @param {string} region - The AWS region of for the SSM Parameter Store, optional
 * @returns {Promise} A promise for the delete parameter operation
 */
function deleteSecret(secretName, region) {
    return  deleteParameter(secretName, region);
}

/**
 * Get a plain text parameter  from the SSM Parameter Store.
 *
 * @param {string} parameterName - The name of the string parameter to delete
 * @param {string} region - The AWS region of for the SSM Parameter Store, optional
 * @returns {Promise} A promise for the get parameter operation
 */
function getParameter(parameterName, region) {
    let ssm = (region ? new AWS.SSM({ region: region }) : new AWS.SSM());
    return (ssm.getParameter({ Name: parameterName }).promise());
}

/**
 * Gets the specified parameter and returns a Promise fot the Parameter object.
 * Will not throw an Error if the parameter is not found, will instead return undefined.
 * The Parameter object fulfilled by the promise will contains the following data:
 *
 * Name (String) — The name of the parameter.
 * Type (String) — The type of parameter. Will be 'String'.
 * Version (Integer) - The parameter version.
 * SourceResult (String) - Applies to parameters that reference information in other AWS services.
 *                         SourceResult is the raw result or response from the source.
 * LastModifiedDate (Date) - Date the parameter was last changed or updated and the parameter version was created.
 * ARN (String) - The Amazon Resource Name (ARN) of the parameter.
 *
 * @param {string} secretName - The name of the secret parameter you wish to get. Required.
 * @param {string} region - The AWS region of for the SSM Parameter Store. Optional.
 * @returns {Promise} - A promise that when fulfilled will contain the parameter data.
 */
async function getParameterIfExists(parameterName, region) {

    try {
        let ssm = (region ? new AWS.SSM({ region: region }) : new AWS.SSM());
        let results = await ssm.getParameter({ Name: parameterName }).promise();
        return Promise.resolve(results.Parameter);
    } catch(err) {
        if (err.name === PARAMETER_NOT_FOUND) {
            return Promise.resolve(undefined);
        } else {
            return Promise.reject(err);
        }
    }
}

/**
 * Get a Map of the parameters and secrets on the provided path.  If firstOnly is true, will return
 * with the first found results.
 *
 * @param {String} path - The path where vthe parameters and secrets are stored.
 * @param {Array} parameters - An array holding the parameter names to fetch.
 * @param {Array} encryptedParameters - An array holding the names of encrypted parameters to fetch.
 * @param {Boolean} firstOnly - If true, will return with the first found results, otherwise returns all results.
 * @returns {Map} - A Promise that when fulfilled contains a Map of the fetched parameters and secrets
 */
async function getParameters(path, parameters, encryptedParameters, firstOnly) {

    let parameterMap = new Map();

    // Fetch the non-encrypted parameters
    if (parameters) {
        for (let name of parameters) {
            let parameterName = getParameterName(path, name);
            let results = await getParameterIfExists(parameterName);
            if (results) {
                parameterMap.set(name, results);
                if (firstOnly) {
                    return Promise.resolve(parameterMap);
                }
            }
        }
    }

    // Fetch the encrypted parameters
    if (encryptedParameters) {
        for (let name of encryptedParameters) {
            let parameterName = getParameterName(path, name);
            let results = await getSecretIfExists(parameterName);
            if (results) {
                parameterMap.set(name, results);
                if (firstOnly) {
                    return Promise.resolve(parameterMap);
                }
            }
        }
    }

    return Promise.resolve(parameterMap);
}

/**
 * Gets the full name for the parameter based on the provided path and parameter name.
 *
 * @param {string} path - The path to prefix the parameter name with.
 * @param {string} name - The parameter name.
 * @returns {string} - A full parameter name prefixed with the provided path.
 */
function getParameterName(path, name) {

    name = (name ? name.trim() : null);
    if (!name) {
        return name;
    }

    path = (path ? path.trim() : null);
    if (!path) {
        return name;
    }

    if (path.endsWith('/')) {
        return `${path}${name.startsWith('/') ? name.substring(1) : name}`;
    } else {
        return `${path}${name.startsWith('/') ? '' : '/'}${name}`;
    }
}

/**
 * Get an encrypted string from the SSM Parameter Store.
 *
 * @param {string} secretName - The name of the encrypted string to delete
 * @param {string} region - The AWS region of for the SSM Parameter Store, optional
 * @returns {Promise} A promise for the get parameter operation
 */
function getSecret(secretName, region) {
    let ssm = (region ? new AWS.SSM({ region: region }) : new AWS.SSM());
    return (ssm.getParameter({ Name: secretName, WithDecryption: true }).promise());
}

/**
 * Gets the specified secret parameter and returns a Promise fot the Parameter object.
 * Will not throw an Error if the secret parameter is not found, will instead return undefined.
 * The Parameter object fulfilled by the promise will contains the following data:
 *
 * Name (String) — The name of the parameter.
 * Type (String) — The type of parameter. Will be 'SecureString'.
 * Version (Integer) - The parameter version.
 * SourceResult (String) - Applies to parameters that reference information in other AWS services.
 *                         SourceResult is the raw result or response from the source.
 * LastModifiedDate (Date) - Date the parameter was last changed or updated and the parameter version was created.
 * ARN (String) - The Amazon Resource Name (ARN) of the parameter.
 *
 * @param {string} secretName - The name of the secret parameter you wish to get. Required.
 * @param {string} region - The AWS region of for the SSM Parameter Store. Optional.
 * @returns {Promise} - A promise that when fulfilled will contain the secret parameter data.
 */
async function getSecretIfExists(secretName, region) {

    try {
        let ssm = (region ? new AWS.SSM({ region: region }) : new AWS.SSM());
        let results = await ssm.getParameter({ Name: secretName, WithDecryption: true }).promise();
        return Promise.resolve(results.Parameter);
    } catch(err) {
        if (err.name === PARAMETER_NOT_FOUND) {
            return Promise.resolve(undefined);
        } else {
            return Promise.reject(err);
        }
    }
}

/**
 * Add a parameter string to the SSM Parameter Store.
 *
 * Note: Will only apply Tags if overwrite is false.
 *
 * @param {Object} parameterParams - Holds the configuration for the parameter. Is comprised of the following properties:
 * Name (required), Value (required), Description, Tags, and Region.
 * @param {Boolean} overwrite - Overwrite an existing parameter. If not specified, will default to "false".
 * @returns {Promise} A promise for the put parameter operation
 */
function putParameter(parameterParams, overwrite) {

    var params = {
        Name: parameterParams.Name,
        Description: parameterParams.Description,
        Value: parameterParams.Value,
        Type: 'String',
        Overwrite: overwrite || false
    };

    if (!overwrite && parameterParams.Tags) {
        params.Tags = parameterParams.Tags;
    }

    let ssm = (parameterParams.Region ? new AWS.SSM({ region: parameterParams.Region }) : new AWS.SSM());
    return (ssm.putParameter(params).promise());
}

/**
 * Add an encrypted string to the SSM Parameter Store.
 *
 * Note: Will only apply Tags if overwrite is false.
 * 
 * @param {Object} secretParams - Holds the configuration for the secret. Is comprised of the following properties:
 * Name (required), Value (required), Description, Tags, Region, and KeyId.
 * @param {Boolean} overwrite - Overwrite an existing parameter. If not specified, will default to "false".
 * @returns {Promise} A promise for the put parameter operation
 */
function putSecret(secretParams, overwrite) {

    var params = {
        Name: secretParams.Name,
        Description: secretParams.Description,
        Value: secretParams.Value,
        Type: 'SecureString',
        Overwrite: overwrite || false,
        KeyId: secretParams.KeyId
    };

    if (!overwrite && secretParams.Tags) {
        params.Tags = secretParams.Tags;
    }

    let ssm = (secretParams.Region ? new AWS.SSM({ region: secretParams.Region }) : new AWS.SSM());
    return (ssm.putParameter(params).promise());
}

/**
 * Sets a parameter's tags to the provided tag list.  If the tag lis is null or empty
 * all tags will be removed from the parameter.
 *
 * @param {string} parameterName - The name of parameter to set the tags for. (required)
 * @param {Array<Map>} tags - The tags to set on the parameter, if null or empty
 * all tags will be removed from the parameter.
 * @param {string} region - An optional region.
 * @returns {Promise} - A promise for an object holding the tags that were set on
 * and removed from the parameter.
 */
async function setTags(parameterName, tags, region) {

    // Construct an array of the new set of tag names
    let tagsToAdd = [];
    if (tags) {
        tags.forEach((tag) => {
            tagsToAdd.push(tag.Key);
        });
    }

    let params = {
        ResourceType: 'Parameter',
        ResourceId: parameterName
    };
    let ssm = (region ? new AWS.SSM({ region: region }) : new AWS.SSM());

    // Get the current tags from the parameter
    let result = await ssm.listTagsForResource(params).promise();
    let currentTags = result.TagList;

    // Construct a list of tags to delete
    let tagsToRemove = [];
    if (currentTags && currentTags.length > 0) {
        currentTags.forEach((tag) => {
            let tagName = tag.Key;
            if (!tagsToAdd.includes(tagName)) {
                tagsToRemove.push(tagName);
            }
        });
    }

    // If there are no tags to add or remove then theres nothing to do
    if (tagsToAdd.length == 0 && tagsToRemove.length == 0) {
        return (Promise.resolve({ Current: [], Removed: []}));
    }

    // Delete all tags not in the new tags list
    if (tagsToRemove.length > 0) {
        params.TagKeys = tagsToRemove;
        await ssm.removeTagsFromResource(params).promise();
        delete params.TagKeys;
    }

    // If there are tags to add, add them
    if (tagsToAdd.length > 0) {
        params.Tags = tags;
        await ssm.addTagsToResource(params).promise();
    }

    return (Promise.resolve({ Current: tagsToAdd, Removed: tagsToRemove }));
}

/**
 * Compares two arrays of AWS Tag objects for equality.
 *
 * @param {Array} tags1 - An array of AWS Tag objects to compare to tags2
 * @param {Array} tags2 - AN array of AWS Tag objects to compare to tags1
 * @returns {Boolean} - Returns true if the AWS Tag arrays are equal, otherwise returns false.
 */
function tagsAreEqual(tags1, tags2) {

    if (!tags1 && !tags2) {
        return true;
    }

    if ((tags1 && !tags2) || (!tags1 && tags2)) {
        return false;
    }

    if (tags1.length != tags2.length) {
        return false;
    }

    let tags1Keys = [];
    tags1.forEach((tag) => {
        tags1Keys.push(tag.Key);
    });

    for (let tag2 of tags2) {

        let index = tags1Keys.indexOf(tag2.Key);
        if (index < 0) {
            return false;
        }

        /* eslint-disable security/detect-object-injection */
        let tag1 = tags1[index];
        if (tag1.Value !== tag2.Value) {
            return false;
        }
    }

    return true;
}

module.exports = { deleteParameter, deleteParameterIfExists, deleteParameters, deleteSecret,
    getParameter, getParameterIfExists, getParameterName, getParameters, getSecret, getSecretIfExists,
    putParameter, putSecret, setTags, tagsAreEqual, PARAMETER_NOT_FOUND, PARAMETER_DELETED };