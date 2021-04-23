'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));
chai.use(require('chai-as-promised'));

const lambda = require('../../index.js');
const KeyPairProvider = require('../../providers/keypair-provider');
const ImportKeyPairProvider = require('../../providers/import-keypair-provider');
const AccessKeyProvider = require('../../providers/accesskey-provider');
const SecretProvider = require('../../providers/secret-provider');
const AmiInfoProvider = require('../../providers/amiinfo-provider');
const LogGroupSubscriptionProvider = require('../../providers/loggroup-subscription-provider');

let TEST_EVENT = {
    ResponseURL: 'https://example.com/pre-signed-S3-url-for-response',
    StackId: 'arn:aws:cloudformation:us-west-2:123456789012:stack/stack-name/guid',
    RequestId: '1234',
    ResourceType: 'Custom::KeyPair',
    LogicalResourceId: 'LogicalResourceId1234',
    ResourceProperties: {
        DryRun: true,
        Name: 'TestKeyPairName'
    }
};

let TEST_CONTEXT = {
    logStreamName: 'key-pair-logstream',
};

describe('lambda.handler()', () => {
    describe('Custom::ImportKeyPair', () => {
        describe('Create()', () =>{
            it('should return SUCCESS status when called with valid parameter', async () => {
                // Arrange
                TEST_EVENT.ResourceType = ImportKeyPairProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Create';
                TEST_EVENT.ResourceProperties.DryRunData = { Name: TEST_EVENT.ResourceProperties.Name };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            });
        });

        describe('Update()', () =>{
            it('should return SUCCESS status when called with valid parameter', async () => {
                // Arrange
                TEST_EVENT.ResourceType = KeyPairProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Update';
                TEST_EVENT.ResourceProperties.DryRunData = { Name: TEST_EVENT.ResourceProperties.Name };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            });
        });

        describe('Delete()', () =>{
            it('should return SUCCESS status when called with valid parameter', async () => {
                // Arrange
                TEST_EVENT.ResourceType = KeyPairProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Delete';
                TEST_EVENT.ResourceProperties.DryRunData = { Name: TEST_EVENT.ResourceProperties.Name };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            });
        });
    });

    describe('Custom::KeyPair', () => {
        describe('Create()', () => {
            it('should return SUCCESS status when called with valid Name', async () => {
                // Arrange
                TEST_EVENT.ResourceType = KeyPairProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Create';
                TEST_EVENT.ResourceProperties.DryRunData = { Name: TEST_EVENT.ResourceProperties.Name };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            });
        });

        describe('Update()', () => {
            it('should return SUCCESS status when called with valid Name', async () => {
                // Arrange
                TEST_EVENT.ResourceType = KeyPairProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Update';
                TEST_EVENT.ResourceProperties.DryRunData = { Name: TEST_EVENT.ResourceProperties.Name };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            });
        });

        describe('Delete()', () => {
            it('should return SUCCESS status when called with valid Name', async () => {
                // Arrange
                TEST_EVENT.ResourceType = KeyPairProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Delete';
                TEST_EVENT.ResourceProperties.DryRunData = { Name: TEST_EVENT.ResourceProperties.Name };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            });
        });
    });

    describe('Custom::AccessKey', () => {
        describe('Create()', () => {
            it('should return SUCCESS status when called with valid Name', async () => {
                // Arrange
                TEST_EVENT.ResourceType = AccessKeyProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Create';
                TEST_EVENT.ResourceProperties.DryRunData = { Name: TEST_EVENT.ResourceProperties.Name };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            });
        });

        describe('Update()', () => {
            it('should return SUCCESS status when called with valid Name', async () => {
                // Arrange
                TEST_EVENT.ResourceType = AccessKeyProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Update';
                TEST_EVENT.ResourceProperties.DryRunData = { Name: TEST_EVENT.ResourceProperties.Name };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            });
        });

        describe('Delete()', () => {
            it('should return SUCCESS status when called with valid Name', async () => {
                // Arrange
                TEST_EVENT.ResourceType = AccessKeyProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Delete';
                TEST_EVENT.ResourceProperties.DryRunData = { Name: TEST_EVENT.ResourceProperties.Name };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            });
        });
    });

    describe('Custom::Secret', () => {
        describe('Create()', () => {
            it('should return SUCCESS status when called with valid Name', async () => {
                // Arrange
                TEST_EVENT.ResourceType = SecretProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Create';
                TEST_EVENT.ResourceProperties.DryRunData = { Name: TEST_EVENT.ResourceProperties.Name };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            });
        });

        describe('Update()', () => {
            it('should return SUCCESS status when called with valid Name', async () => {
                // Arrange
                TEST_EVENT.ResourceType = SecretProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Update';
                TEST_EVENT.ResourceProperties.DryRunData = { Name: TEST_EVENT.ResourceProperties.Name };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            });
        });

        describe('Delete()', () => {
            it('should return SUCCESS status when called with valid Name', async () => {
                // Arrange
                TEST_EVENT.ResourceType = SecretProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Delete';
                TEST_EVENT.ResourceProperties.DryRunData = { Name: TEST_EVENT.ResourceProperties.Name };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            });
        });
    });

    describe('Custom::AMIInfo ', () => {
        describe('Create()', () => {
            it('should return SUCCESS status when called with valid Id', async () => {
                // Arrange
                TEST_EVENT.ResourceType = AmiInfoProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Create';
                TEST_EVENT.ResourceProperties.DryRunData = { Id: 'ami-1234567890abcd' };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Id).to.equal(TEST_EVENT.ResourceProperties.DryRunData.Id);
            });
        });

        describe('Update()', () => {
            it('should return SUCCESS status when called with valid Id', async () => {
                // Arrange
                TEST_EVENT.ResourceType = AmiInfoProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Update';
                TEST_EVENT.ResourceProperties.DryRunData = { Id: 'ami-1234567890abcd' };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Id).to.equal(TEST_EVENT.ResourceProperties.DryRunData.Id);
            });
        });

        describe('Delete()', () => {
            it('should return SUCCESS status when called with valid Id', async () => {
                // Arrange
                TEST_EVENT.ResourceType = AmiInfoProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Delete';
                TEST_EVENT.ResourceProperties.DryRunData = { Id: 'ami-1234567890abcd' };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.Id).to.equal(TEST_EVENT.ResourceProperties.DryRunData.Id);
            });
        });
    });

    describe('Custom::LogGroupSubscription', () => {
        describe('Create()', () => {
            it('should return SUCCESS status when called with valid LogGroupName and FilterName', async () => {
            // Arrange
                TEST_EVENT.ResourceType = LogGroupSubscriptionProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Create';
                TEST_EVENT.ResourceProperties.DryRunData = { LogGroupName: 'LogGroupName', FilterName: 'FilterName' };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.LogGroupName).to.equal(TEST_EVENT.ResourceProperties.DryRunData.LogGroupName);
            });
        });

        describe('Update()', () => {
            it('should return SUCCESS status when called with valid LogGroupName and FilterName', async () => {
                // Arrange
                TEST_EVENT.ResourceType = LogGroupSubscriptionProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Update';
                TEST_EVENT.ResourceProperties.DryRunData = { LogGroupName: 'LogGroupName', FilterName: 'FilterName' };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.LogGroupName).to.equal(TEST_EVENT.ResourceProperties.DryRunData.LogGroupName);
            });
        });

        describe('Delete()', () => {
            it('should return SUCCESS status when called with valid LogGroupName and FilterName', async () => {
                // Arrange
                TEST_EVENT.ResourceType = LogGroupSubscriptionProvider.RESOURCE_TYPE;
                TEST_EVENT.RequestType = 'Delete';
                TEST_EVENT.ResourceProperties.DryRunData = { LogGroupName: 'LogGroupName', FilterName: 'FilterName' };

                // Act
                let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

                // Assert
                expect(result).to.be.an('object');
                expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
                expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
                expect(result.Data.LogGroupName).to.equal(TEST_EVENT.ResourceProperties.DryRunData.LogGroupName);
            });
        });
    });

    describe('Invalid RequestType', () => {
        it('should return a FAILED status when event contains an invalid RequestType', async () => {
            // Arrange
            TEST_EVENT.ResourceType = KeyPairProvider.RESOURCE_TYPE;
            TEST_EVENT.RequestType = 'Get';

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('FAILED');
            expect(result.Reason).to.be.a('string');
            expect(result.Reason).to.containIgnoreCase('Invalid RequestType');
        });
    });

    describe('Unsupported ResourceType', () => {
        it('should return a FAILED status when event contains an unsupported ResourceType', async () => {
            // Arrange
            TEST_EVENT.ResourceType = 'Custom::UnsupportedResource';
            TEST_EVENT.RequestType = 'Create';

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('FAILED');
            expect(result.Reason).to.be.a('string');
            expect(result.Reason).to.containIgnoreCase('Unsupported ResourceType');
        });
    });
});