'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;

const KmsUtils = require('../../lib/aws/kms-utils');

describe('kms-utils', () => {
    describe('isBase64()', () => {
        it('should return true when a base64 encoded string is provided as input', () => {
            // Arrange
            let base64String = Buffer.from('this is is the plain text 1234567890').toString('base64');

            // Act
            let result = KmsUtils.isBase64(base64String);

            // Assert
            expect(result).to.be.a('boolean');
            expect(result).to.be.true;
        });

        it('should return false when a non-base64 encoded string is provided as input', () => {
            // Arrange
            let plainText = 'this is is the plain text';

            // Act
            let result = KmsUtils.isBase64(plainText);

            // Assert
            expect(result).to.be.a('boolean');
            expect(result).to.be.false;
        });

        it('should return false when a non-string is provided as input', () => {
            // Arrange
            let base64String = Buffer.from('this is is the plain text 1234567890').toString('base64');
            let obj = { base64Encoded: base64String };

            // Act
            let result = KmsUtils.isBase64(obj);

            // Assert
            expect(result).to.be.a('boolean');
            expect(result).to.be.false;
        });
    });
});