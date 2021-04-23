'use strict';

const AWS = require('aws-sdk');
const { BASE64_REGEX } = require('./constants');

/**
 *  Decrypt a KMS encrypted secret and return the results as plain text.
 *
 * @param {string} encryptedSecret - A Base64 encoded KMS encrypted secret.
 * @param {string} region - An optional AWS region.
 * @returns {Promise} - A promise that when fulfilled contains the decrypted secret as plain text.
 */
function decryptKmsSecret(encryptedSecret, region) {

    if (!isBase64(encryptedSecret)) {
        return (Promise.reject(new Error('Provided secret is not Base64 encoded.')));
    }

    // Return a Promise that will return the decrypted secret data
    let buf = Buffer.from(encryptedSecret, 'base64');
    const params = {
        CiphertextBlob: buf
    };

    // Setup the KMS instance with an option region
    let kms = (region ? new AWS.KMS({ region: region }) : new AWS.KMS());

    // Set up and return a promise for the plain text results
    return new Promise((resolve, reject) => {
        kms.decrypt(params, (error, data) => {
            if (error) {
                return reject(error);
            } else {
                return resolve(data.Plaintext.toString());
            }
        });
    });
}

/**
 * Checks if the provided string is base64 encoded.
 *
 * @param {string} str - A string to check if it is Base64 encoded.
 * @returns {Boolean} - True if str is a Base64 encoded string, otherwise returns false.
 */
function isBase64(str) {

    if (!(str instanceof String) && !(typeof str == 'string')) {
        return (false);
    }

    /* eslint-disable security/detect-non-literal-regexp */
    return new RegExp(BASE64_REGEX, 'gi').test(str);
}

module.exports = { decryptKmsSecret, isBase64 };