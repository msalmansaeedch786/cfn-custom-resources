'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));

const TEST_PLAINT_TEXT = 'A Simple Test String';
const TEST_ENCRYPTED_TEXT = 'AQICAHibwJ3P9ZA345kvN+gy/ozSacksueJvawuWCdL8pAW0FgEAaTxoTzjJukGG' +
        'EpjtCi3gAAAAcjBwBgkqhkiG9w0BBwagYzBhAgEAMFwGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMpSJA' +
        'nL7lQm45P1sbAgEQgC/UWKwWEbNwV2sl34zHnRyGIhQVhy+fBv8q/pKObzuXzed1595DtaqN1SaTdnxBdQ==';

const TEST_REGION = process.env.AWS_REGION || 'us-east-1';
if (!process.env.AWS_REGION) process.env.AWS_REGION = TEST_REGION;

const KmsUtils = require('../../lib/aws/kms-utils');

describe('kms-utils', () => {
    describe('decryptKmsSecret()', () => {
        it('should return decrypted string when a valid encrypted string is provided', async () => {
            // Arrange
            let encryptedString = TEST_ENCRYPTED_TEXT;

            // Act
            let result = await KmsUtils.decryptKmsSecret(encryptedString);

            // Assert
            expect(result).to.be.a('string');
            expect(result).to.equal(TEST_PLAINT_TEXT);
        });

        it('should return decrypted string when a valid encrypted string and region are provided', async () => {
            // Arrange
            let encryptedString = TEST_ENCRYPTED_TEXT;

            // Act
            let result = await KmsUtils.decryptKmsSecret(encryptedString, TEST_REGION);

            // Assert
            expect(result).to.be.a('string');
            expect(result).to.equal(TEST_PLAINT_TEXT);
        });

        it('should throw InvalidCiphertextException when a non-encrypted string is provided', async () => {
            // Arrange
            let base64String = Buffer.from('this is is the plain text 1234567890').toString('base64');

            // Act and Assert
            try {
                await KmsUtils.decryptKmsSecret(base64String);
                expect.fail(null, null, 'Expected exception was not thrown, it was not!');
            } catch(err) {
                expect(err.name).to.equal('InvalidCiphertextException');
            }
        });
    });
});