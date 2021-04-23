'use strict';

const AWS = require('aws-sdk');
const EC2 = new AWS.EC2({});

/**
 * Calls the AWS EC2 API to create a key pair and returns an Promise.
 *
 * @param {*} keyName the name of the key pair to create
 * @returns a Promise for the AWS request
 */
function createKeyPair(keyName) {
    return (EC2.createKeyPair({ KeyName: keyName }).promise());
}

/**
 * Calls the AWS EC2 API to import a key pair and returns an Promise.
 *
 * @param {*} keyName the name of the key pair to import
 * @param {*} publicKeyMaterial the public key material to import
 * @returns a Promise for the AWS request
 */
function importKeyPair(keyName, publicKeyMaterial) {
    let encodedPublicMaterial = Buffer.from(publicKeyMaterial);
    return (EC2.importKeyPair({ KeyName: keyName, PublicKeyMaterial: encodedPublicMaterial }).promise());
}

/**
 * Calls the AWS EC2 API to delete a key pair and returns an Promise.
 *
 * @param {*} keyName the name of the key pair to delete
 * @returns a Promise for the AWS request
 */
function deleteKeyPair(keyName) {
    return (EC2.deleteKeyPair({ KeyName: keyName }).promise());
}

/**
 * Calls the AWS EC2 API to describe a key pair and returns an Promise.
 *
 * @param {*} keyName the name of the key pair to describe
 * @returns a Promise for the AWS request
 */
async function describeKeyPair(keyName) {
    // Set up and return a promise for the plain text results
    return new Promise((resolve, reject) => {
        EC2.describeKeyPairs({ KeyNames: [keyName] }, (error, data) => {
            if (error) {
                return reject(error);
            } else {
                return resolve(data.KeyPairs[0]);
            }
        });
    });
}

module.exports = { createKeyPair, importKeyPair, deleteKeyPair, describeKeyPair };
