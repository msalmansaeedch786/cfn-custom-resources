'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));
chai.use(require("chai-as-promised"));

const TEST_PARAM_NAME = '/northbaylabs/params/test-param1';
const TEST_PARAM_VALUE = 'I am plain old text!';

const TEST_SECRET_NAME = '/northbaylabs/secrets/test-secret';
const TEST_SECRET_VALUE = 'Do not read this, it is a secret!';

const TEST_TAGS12 = [{Key: 'tag1', Value: 'tag1-VALUE'}, {Key: 'tag2', Value: 'tag2-VALUE'}];
const TEST_TAGS34 = [{Key: 'tag3', Value: 'tag3-VALUE'}, {Key: 'tag4', Value: 'tag4-VALUE'}];

const TEST_TAG_NAMES12 = ['tag1', 'tag2'];
const TEST_TAG_NAMES34 = ['tag3', 'tag4'];

const TEST_REGION = process.env.AWS_REGION || 'us-east-1';
if (!process.env.AWS_REGION) process.env.AWS_REGION = TEST_REGION;

const parameterStore = require('../../lib/aws/parameter-store-utils');

async function deleteTestParameters() {
    try {
        await parameterStore.deleteParameter(TEST_PARAM_NAME);
    } catch(err) { /* ignore */ }

    try {
        await parameterStore.deleteSecret(TEST_SECRET_NAME);
    } catch(err) { /* ignore */ }
}

function sleep(millis) {
    return new Promise(function (resolve) {
        setTimeout(function () { resolve(); }, millis);
    });
}

describe('parameter-store-utils', () => {

    deleteTestParameters();

    describe('putParameter()', () => {
        it('should throw an exception with a invalid parameter name', async () => {
            // Arrange
            let params = {
                Name: 'i am an invalid parameter name!',
                Value: 'a value',
                Tags: []
            };

            // Act and Assert
            expect(parameterStore.putParameter(params)).to.be.eventually.rejectedWith(Error)
                .that.has.property('name').that.containIgnoreCase('ValidationException');
        });

        it('should store a parameter with no region specified', async () => {
            // Arrange
            let params = {
                Name: TEST_PARAM_NAME,
                Value: TEST_PARAM_VALUE
            };

            // Act
            let result = await parameterStore.putParameter(params, true);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Version).to.not.be.null;
        });

        it('should store parameter with a region specified', async () => {
            // Arrange
            let params = {
                Name: TEST_PARAM_NAME,
                Value: TEST_PARAM_VALUE,
                Region: TEST_REGION
            };

            // Act
            let result = await parameterStore.putParameter(params, true);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Version).to.not.be.null;
        });

        it('should store parameter that already exists with overwrite = true', async () => {
            // Arrange
            let params = {
                Name: TEST_PARAM_NAME,
                Value: TEST_PARAM_VALUE,
                Region: TEST_REGION
            };
            await parameterStore.putParameter(params, true);

            // Act
            let result = await parameterStore.putParameter(params, true);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Version).to.not.be.null;
        });

        it('should throw exception when storing a parameter that already exists with overwrite = false', async () => {
            // Arrange
            let params = {
                Name: TEST_PARAM_NAME,
                Value: TEST_PARAM_VALUE,
                Region: TEST_REGION
            };
            await parameterStore.putParameter(params, true);

            // Act and Assert
            expect(parameterStore.putParameter(params)).to.be.eventually.rejectedWith(Error)
                .that.has.property('name').that.containIgnoreCase('ParameterAlreadyExists');
        });
    });

    describe('getParameter()', () => {
        it('should return correct value with no region specified', async () => {
            // Arrange
            let params = {
                Name: TEST_PARAM_NAME,
                Value: TEST_PARAM_VALUE
            };

            // Act
            await parameterStore.putParameter(params, true);
            let result = await parameterStore.getParameter(TEST_PARAM_NAME);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Parameter.Name).to.equal(TEST_PARAM_NAME);
            expect(result.Parameter.Value).to.equal(TEST_PARAM_VALUE);
            expect(result.Parameter.Type).to.equal('String');
        });

        it('should return correct value with a region specified', async () => {
            // Act
            let result = await parameterStore.getParameter(TEST_PARAM_NAME, TEST_REGION);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Parameter.Name).to.equal(TEST_PARAM_NAME);
            expect(result.Parameter.Value).to.equal(TEST_PARAM_VALUE);
            expect(result.Parameter.Type).to.equal('String');
        });
    });

    describe('deleteParameter()', () => {
        it('should delete parameter with no region specified', async () => {
            // Arrange
            let params = {
                Name: TEST_PARAM_NAME,
                Value: TEST_PARAM_VALUE
            };

            // Act
            await parameterStore.putParameter(params, true);
            let result = await parameterStore.deleteParameter(TEST_PARAM_NAME);

            // Assert
            expect(result).to.not.be.null;
        });

        it('should delete parameter with a region specified', async () => {
            // Arrange
            let params = {
                Name: TEST_PARAM_NAME,
                Value: TEST_PARAM_VALUE,
                Region: TEST_REGION
            };

            // Act
            await parameterStore.putParameter(params, true);
            let result = await parameterStore.deleteParameter(TEST_PARAM_NAME, TEST_REGION);

            // Assert
            expect(result).to.not.be.null;
        });
    });

    describe('deleteParameterIfExists()', () => {
        it('should delete parameter with no region specified', async () => {
            // Arrange
            let params = {
                Name: TEST_PARAM_NAME,
                Value: TEST_PARAM_VALUE
            };

            // Act
            await parameterStore.putParameter(params, true);
            let result = await parameterStore.deleteParameterIfExists(TEST_PARAM_NAME);

            // Assert
            expect(result).to.not.be.null;
        });

        it('should delete parameter with a region specified', async () => {
            // Arrange
            let params = {
                Name: TEST_PARAM_NAME,
                Value: TEST_PARAM_VALUE,
                Region: TEST_REGION
            };

            // Act
            await parameterStore.putParameter(params, true);
            let result = await parameterStore.deleteParameterIfExists(TEST_PARAM_NAME, TEST_REGION);

            // Assert
            expect(result).to.not.be.null;
        });
    });

    describe('deleteParameters()', () => {
        it('should delete parameters with no region specified', async () => {
            // Arrange
            let name = TEST_PARAM_NAME;
            let nameA = TEST_PARAM_NAME + '-a';
            let nameB = TEST_PARAM_NAME + '-b';
            await parameterStore.putParameter({ Name: name, Value: 'value' }, true);
            await parameterStore.putParameter({ Name: nameA, Value: 'value-a' }, true);
            await parameterStore.putParameter({ Name: nameB, Value: 'value-b' }, true);

            // Act
            let result = await parameterStore.deleteParameters([name, nameA, nameB]);

            // Assert
            expect(result).to.not.be.null;
        });

        it('should delete parameters with a region specified', async () => {
             // Arrange
             let name = TEST_PARAM_NAME;
             let nameA = TEST_PARAM_NAME + '-a';
             let nameB = TEST_PARAM_NAME + '-b';
             await parameterStore.putParameter({ Name: name, Value: 'value' }, true);
             await parameterStore.putParameter({ Name: nameA, Value: 'value-a' }, true);
             await parameterStore.putParameter({ Name: nameB, Value: 'value-b' }, true);

             // Act
             let result = await parameterStore.deleteParameters([name, nameA, nameB], TEST_REGION);

             // Assert
             expect(result).to.not.be.null;
        });
    });

    describe('putSecret()', () => {
        it('should store a secret with no region specified', async () => {
            // Arrange
            let secretParams = {
                Name: TEST_SECRET_NAME,
                Value: TEST_SECRET_VALUE,
                Tags: []
            };

            // Act
            let result = await parameterStore.putSecret(secretParams);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Version).to.not.be.null;
        });

        it('should store a secret with a region specified', async () => {
            // Arrange
            let secretParams = {
                Name: TEST_SECRET_NAME,
                Value: TEST_SECRET_VALUE,
                Region: TEST_REGION
            };

            // Act
            let result = await parameterStore.putSecret(secretParams, true);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Version).to.not.be.null;
        });
    });

    describe('getSecret()', () => {
        it('should return correct value with a region specified', async () => {
            // Act
            let result = await parameterStore.getSecret(TEST_SECRET_NAME, TEST_REGION);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Parameter.Name).to.equal(TEST_SECRET_NAME);
            expect(result.Parameter.Value).to.equal(TEST_SECRET_VALUE);
            expect(result.Parameter.Type).to.equal('SecureString');
        });

        it('should return correct value with no region specified', async () => {
            // Act
            let result = await parameterStore.getSecret(TEST_SECRET_NAME);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Parameter.Name).to.equal(TEST_SECRET_NAME);
            expect(result.Parameter.Value).to.equal(TEST_SECRET_VALUE);
            expect(result.Parameter.Type).to.equal('SecureString');
        });
    });

    describe('deleteSecret()', () => {
        it('should delete secret with no region specified', async () => {
            // Act
            let result = await parameterStore.deleteSecret(TEST_SECRET_NAME);

            // Assert
            expect(result).to.not.be.null;
        });

        it('should delete secret with a region specified', async () => {
            // Arrange
            let secretParams = {
                Name: TEST_SECRET_NAME,
                Value: TEST_SECRET_VALUE,
                Region: TEST_REGION
            };

            // Act
            await parameterStore.putSecret(secretParams, true);
            let result = await parameterStore.deleteSecret(TEST_SECRET_NAME, TEST_REGION);

            // Assert
            expect(result).to.not.be.null;
        });
    });

    describe('setTags(()', () => {
        it('should add no tags when no tags specified', async () => {
             // Arrange
             let params = {
                Name: TEST_PARAM_NAME,
                Value: TEST_PARAM_VALUE
            };

            // Act
            await parameterStore.putParameter(params, true);
            let result = await parameterStore.setTags(TEST_PARAM_NAME);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Current).to.eql([]);
            expect(result.Removed).to.eql([]);
        });

        it('should add tags when tags are specified', async () => {

            // Give AWS sometime to process the resource changes
            await sleep(2000);

            // Act
            let result = await parameterStore.setTags(TEST_PARAM_NAME, TEST_TAGS12);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Current).to.eql(TEST_TAG_NAMES12);
            expect(result.Removed).to.eql([]);
        }).timeout(4000);

        it('should add and remove tags when tags are specified', async () => {

            // Give AWS sometime to process the resource changes
            await sleep(2000);

            // Act
            let result = await parameterStore.setTags(TEST_PARAM_NAME, TEST_TAGS34);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Current).to.eql(TEST_TAG_NAMES34);
            expect(result.Removed).to.eql(TEST_TAG_NAMES12);
        }).timeout(4000);

        it('should remove all tags when no tags are specified', async () => {

            // Give AWS sometime to process the resource changes
            await sleep(2000);

            // Act
            let result = await parameterStore.setTags(TEST_PARAM_NAME, [], TEST_REGION);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Current).to.eql([]);
        }).timeout(4000);
    });

        describe('deleteParameters()', () => {
        it('should delete parameters with no region specified', async () => {
            // Arrange
            let name = TEST_PARAM_NAME;
            let nameA = TEST_PARAM_NAME + '-a';
            let nameB = TEST_PARAM_NAME + '-b';
            await parameterStore.putParameter({ Name: name, Value: 'value' }, true);
            await parameterStore.putParameter({ Name: nameA, Value: 'value-a' }, true);
            await parameterStore.putParameter({ Name: nameB, Value: 'value-b' }, true);

            // Act
            let result = await parameterStore.deleteParameters([name, nameA, nameB]);

            // Assert
            expect(result).to.not.be.null;
        });

        it('should delete parameters with a region specified', async () => {
             // Arrange
             let name = TEST_PARAM_NAME;
             let nameA = TEST_PARAM_NAME + '-a';
             let nameB = TEST_PARAM_NAME + '-b';
             await parameterStore.putParameter({ Name: name, Value: 'value' }, true);
             await parameterStore.putParameter({ Name: nameA, Value: 'value-a' }, true);
             await parameterStore.putParameter({ Name: nameB, Value: 'value-b' }, true);

             // Act
             let result = await parameterStore.deleteParameters([name, nameA, nameB], TEST_REGION);

             // Assert
             expect(result).to.not.be.null;
        });
    });

    describe('getParameterIfExists()', () => {
        it('should get the parameter with no region specified', async () => {
            // Arrange
            let params = {
                Name: TEST_PARAM_NAME,
                Value: TEST_PARAM_VALUE
            };
            await parameterStore.putParameter(params, true);

            // Act
            let result = await parameterStore.getParameterIfExists(TEST_PARAM_NAME);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Name).to.equal(TEST_PARAM_NAME);
            expect(result.Value).to.equal(TEST_PARAM_VALUE);
        });

        it('should return undefined if the parameter does not exist', async () => {
            // Arrange
            await parameterStore.deleteParameterIfExists(TEST_PARAM_NAME);

            // Act
            let result = await parameterStore.getParameterIfExists(TEST_PARAM_NAME);

            // Assert
            expect(result).to.be.undefined;
        });

        it('should throw an Error if invalid region is provided', async () => {
            // Arrange
            let region = 'us-west-123';

            // Act and Assert
            expect(parameterStore.getParameterIfExists(TEST_PARAM_NAME, region))
                .to.be.eventually.rejectedWith(Error)
                .that.has.property('name').that.containIgnoreCase('UnknownEndpoint')
                .and.not.containIgnoreCase('ParameterNotFound');
        });
    });

    describe('getSecretIfExists()', () => {
        it('should get the secret with no region specified', async () => {
            // Arrange
            let params = {
                Name: TEST_SECRET_NAME,
                Value: TEST_SECRET_VALUE
            };
            await parameterStore.putSecret(params, true);

            // Act
            let result = await parameterStore.getSecretIfExists(TEST_SECRET_NAME);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Name).to.equal(TEST_SECRET_NAME);
            expect(result.Value).to.equal(TEST_SECRET_VALUE);
        });

        it('should return undefined if the secret does not exist', async () => {
            // Arrange
            await parameterStore.deleteParameterIfExists(TEST_SECRET_NAME);

            // Act
            let result = await parameterStore.getSecretIfExists(TEST_SECRET_NAME);

            // Assert
            expect(result).to.be.undefined;
        });

        it('should throw an Error if invalid region is provided', async () => {
            // Arrange
            let region = 'us-west-123';

            // Act and Assert
            expect(parameterStore.getSecretIfExists(TEST_SECRET_NAME, region))
                .to.be.eventually.rejectedWith(Error)
                .that.has.property('name').that.containIgnoreCase('UnknownEndpoint')
                .and.not.containIgnoreCase('ParameterNotFound');
        });
    });

    describe('getParameters()', () => {
        it('should get a Map of parameters with only parameters specified', async () => {
            // Arrange
            let params = {
                Name: TEST_PARAM_NAME,
                Value: TEST_PARAM_VALUE
            };

            // Act
            await parameterStore.putParameter(params, true);
            let result = await parameterStore.getParameters(null, [TEST_PARAM_NAME], null, false);

            // Assert
            expect(result).to.not.be.null;
            let secret = result.get(TEST_PARAM_NAME);
            expect(secret).to.be.an('object');
            expect(secret.Name).to.equal(TEST_PARAM_NAME);
            expect(secret.Value).to.equal(TEST_PARAM_VALUE); 
        });

        it('should get a Map of parameters with only encryptedParameters specified', async () => {
            // Arrange
            let secretParams = {
                Name: TEST_SECRET_NAME,
                Value: TEST_SECRET_VALUE
            };

            // Act
            await parameterStore.putSecret(secretParams, true);
            let result = await parameterStore.getParameters(null, null, [TEST_SECRET_NAME], true);

            // Assert
            expect(result).to.not.be.null;
            let secret = result.get(TEST_SECRET_NAME);
            expect(secret).to.be.an('object');
            expect(secret.Name).to.equal(TEST_SECRET_NAME);
            expect(secret.Value).to.equal(TEST_SECRET_VALUE); 
        });
    });
});