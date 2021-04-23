'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));

const ParameterStore = require('../../lib/aws/parameter-store-utils');

describe('parameter-store-utils', () => {
    describe('getParameterName()', () => {
        it('should return the correct value with no trailing / on path and no leading / on name', async () => {
            // Arrange
            let path = '/path/to/parameter';
            let name = 'parameter-name';
            let expected = '/path/to/parameter/parameter-name';

            // Act
            let result = ParameterStore.getParameterName(path, name);

            // Assert
            expect(result).to.equal(expected);
        });

        it('should return the correct value with no trailing / on path and a leading / on name', async () => {
            // Arrange
            let path = '/path/to/parameter';
            let name =  '/parameter-name';
            let expected = '/path/to/parameter/parameter-name';

            // Act
            let result = ParameterStore.getParameterName(path, name);

            // Assert
            expect(result).to.equal(expected);
        });

        it('should return the correct value with a trailing / on path and no leading / on name', async () => {
            // Arrange
            let path = '/path/to/parameter/';
            let name =  'parameter-name';
            let expected = '/path/to/parameter/parameter-name';

            // Act
            let result = ParameterStore.getParameterName(path, name);

            // Assert
            expect(result).to.equal(expected);
        });

        it('should return the correct value with a trailing / on path and a leading / on name', async () => {
            // Arrange
            let path = '/path/to/parameter/';
            let name =  '/parameter-name';
            let expected = '/path/to/parameter/parameter-name';

            // Act
            let result = ParameterStore.getParameterName(path, name);

            // Assert
            expect(result).to.equal(expected);
        });

        it('should return the correct value with a null path and a null name', async () => {
            // Arrange
            let path = null;
            let name =  null;
            let expected = null;

            // Act
            let result = ParameterStore.getParameterName(path, name);

            // Assert
            expect(result).to.equal(expected);
        });

        it('should return the correct value with null path and a leading / on name', async () => {
            // Arrange
            let path = null;
            let name =  '/parameter-name';
            let expected = '/parameter-name';

            // Act
            let result = ParameterStore.getParameterName(path, name);

            // Assert
            expect(result).to.equal(expected);
        });

        it('should return the correct value with a null path and a null name', async () => {
            // Arrange
            let path = null;
            let name =  null;
            let expected = null;

            // Act
            let result = ParameterStore.getParameterName(path, name);

            // Assert
            expect(result).to.equal(expected);
        });
    });

    describe('tagsAreEqual()', () => {
        it('should return true when tag arrays are equal', async () => {
            // Arrange
            let tags1 = [{ 'Key': 'Stage', 'Value': 'Dev' }];
            let tags2 = tags1;

            // Act
            let result = ParameterStore.tagsAreEqual(tags1, tags2);

            // Assert
            expect(result).to.be.true;
        });

        it('should return true when tag arrays are both null', async () => {
            // Arrange
            let tags1 = null;
            let tags2 = null;

            // Act
            let result = ParameterStore.tagsAreEqual(tags1, tags2);

            // Assert
            expect(result).to.be.true;
        });

        it('should return false when one tag array is null', async () => {
            // Arrange
            let tags1 = null;
            let tags2 = [];

            // Act
            let result = ParameterStore.tagsAreEqual(tags1, tags2);

            // Assert
            expect(result).to.be.false;
        });

        it('should return false when one tag array is null', async () => {
            // Arrange
            let tags1 = [];
            let tags2 = null;

            // Act
            let result = ParameterStore.tagsAreEqual(tags1, tags2);

            // Assert
            expect(result).to.be.false;
        });

        it('should return false when tag arrays are not eqaul lengths', async () => {
            // Arrange
            let tags1 = [{ 'Key': 'Stage', 'Value': 'Dev' }];
            let tags2 = [];

            // Act
            let result = ParameterStore.tagsAreEqual(tags1, tags2);

            // Assert
            expect(result).to.be.false;
        });

        it('should return false when tag arrays have different keys', async () => {
            // Arrange
            let tags1 = [{ 'Key': 'Env', 'Value': 'Dev' }];
            let tags2 = [{ 'Key': 'Stage', 'Value': 'Dev' }];

            // Act
            let result = ParameterStore.tagsAreEqual(tags1, tags2);

            // Assert
            expect(result).to.be.false;
        });

        it('should return false when tag arrays have same keys with different values', async () => {
            // Arrange
            let tags1 = [{ 'Key': 'Stage', 'Value': 'Prod' }];
            let tags2 = [{ 'Key': 'Stage', 'Value': 'Dev' }];

            // Act
            let result = ParameterStore.tagsAreEqual(tags1, tags2);

            // Assert
            expect(result).to.be.false;
        });
    });
});