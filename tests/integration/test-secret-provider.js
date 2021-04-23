'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));

var lambda = require('../../index');
const SecretProvider = require('../../providers/secret-provider');
const ParameterStore = require('../../lib/aws/parameter-store-utils');
const {FAILED, SUCCESS, MASKED_SECRET, NOT_CREATED } = require('../../lib/aws/constants');

const TEST_KMS_KEY_ID = 'alias/northbaylabs/cfn-custom-resources-dev';
const TEST_PLAIN_TEXT = 'A Simple Test String';
const TEST_ENCRYPTED_TEXT = 'AQICAHibwJ3P9ZA345kvN+gy/ozSacksueJvawuWCdL8pAW0FgEAaTxoTzjJukGG' +
        'EpjtCi3gAAAAcjBwBgkqhkiG9w0BBwagYzBhAgEAMFwGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMpSJA' +
        'nL7lQm45P1sbAgEQgC/UWKwWEbNwV2sl34zHnRyGIhQVhy+fBv8q/pKObzuXzed1595DtaqN1SaTdnxBdQ==';
const REAOURCE_PROPERTY_NAME = '/northbaylabs/test/my-secret';
const MISSING_PROPERTIES = 'missing properties';

var TEST_EVENT = {
    ResponseURL: 'https://httpbin.org/put',
    StackId: 'arn:aws:cloudformation:us-east-1:123456789012:stack/stack-name/guid',
    RequestId: '1234',
    ResourceType: SecretProvider.RESOURCE_TYPE,
    LogicalResourceId: 'LogicalResourceId1234',
    ResourceProperties: {
        Name: '/northbaylabs/test/my-secret'
    },
    OldResourceProperties: {
    }
};

async function deleteTestParameter(parameterName) {
    try {
        await ParameterStore.deleteSecret(parameterName);
    } catch (err) { /* ignore */ }
}

const TEST_CONTEXT = {
    logStreamName: 'secret-provider-logstream',
    done: function () { },
    getRemainingTimeInMillis: function () { return 600000; }
};

describe('SecretProvider', () => {
    describe('Create()', () => {
        it('should return SUCCESS status when called with valid ResourceProperties (ReturnSecret=true)', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.ResourceProperties.Tags = [{ 'Key': 'Stage', 'Value': 'Dev' }];
            await deleteTestParameter(TEST_EVENT.ResourceProperties.Name);

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Version).to.be.an('number');
            expect(result.Data.Secret).to.be.a('string');
            expect(result.Data.Secret).to.not.equal(MASKED_SECRET);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS status when called with valid ResourceProperties (Length, SecretPattern)', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Length = null;
            TEST_EVENT.ResourceProperties.ReturnSecret = false;
            TEST_EVENT.ResourceProperties.SecretPattern = '^\\d+$';
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;

            // Act
            await ParameterStore.deleteSecret(TEST_EVENT.ResourceProperties.Name);
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Version).to.be.an('number');
            expect(result.Data.Secret).to.equal(MASKED_SECRET);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS status when called with valid ResourceProperties (EncryptedSecret)', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Length = null;
            TEST_EVENT.ResourceProperties.SecretPattern = null;
            TEST_EVENT.ResourceProperties.ReturnSecret = false;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.ResourceProperties.EncryptedSecret = TEST_ENCRYPTED_TEXT;

            // Act
            await ParameterStore.deleteSecret(TEST_EVENT.ResourceProperties.Name);
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Version).to.be.an('number');
            expect(result.Data.Secret).to.equal(MASKED_SECRET);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS status when called with valid ResourceProperties (PlainSecret)', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.EncryptedSecret = null;
            TEST_EVENT.ResourceProperties.ReturnSecret = false;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.ResourceProperties.PlainSecret = 'optional-plain-text-value-for-the-secret';

            // Act
            await ParameterStore.deleteSecret(TEST_EVENT.ResourceProperties.Name);
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Version).to.be.an('number');
            expect(result.Data.Secret).to.equal(MASKED_SECRET);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED status when called with invalid ResourceProperties (Name)', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Name = null;
            TEST_EVENT.ResourceProperties.PlainSecret = null;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase(MISSING_PROPERTIES);
            expect(result.Reason).to.contain('Name');
            expect(result.Data).to.be.undefined;
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED status when called with invalid ResourceProperties (EncryptedSecret)', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.ResourceProperties.EncryptedSecret = TEST_PLAIN_TEXT ;

            // Act
            await ParameterStore.deleteSecret(TEST_EVENT.ResourceProperties.Name);
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('secret is not Base64 encoded');
            expect(result.Data).to.be.undefined;
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);
    });

    describe('Update()', () => {
        it('should return SUCCESS status and Secret when called with a new Name', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.EncryptedSecret = null;
            TEST_EVENT.ResourceProperties.SecretPattern = null;
            TEST_EVENT.ResourceProperties.Length = null;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.PhysicalResourceId = NOT_CREATED;
            TEST_EVENT.ResourceProperties.Tags = null;

            TEST_EVENT.OldResourceProperties.EncryptedSecret = null;
            TEST_EVENT.OldResourceProperties.SecretPattern = null;
            TEST_EVENT.OldResourceProperties.Name = null;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.OldResourceProperties.Length = null;
            await deleteTestParameter(TEST_EVENT.ResourceProperties.Name);

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('Updated properties');
            expect(result.Reason).to.containIgnoreCase('Name');
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Version).to.be.an('number');
            expect(result.Data.Secret).to.be.a('string');
            expect(result.Data.Secret).to.not.equal(MASKED_SECRET);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(4000);

        it('should return SUCCESS status and with only a change to the Description property and RotateOnUpdate is false', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.Description = 'Secret Parameter Description';
            TEST_EVENT.ResourceProperties.ReturnSecret = false;
            TEST_EVENT.ResourceProperties.EncryptedSecret = null;
            TEST_EVENT.ResourceProperties.SecretPattern = null;
            TEST_EVENT.ResourceProperties.Length = 32;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.Name;
            TEST_EVENT.ResourceProperties.Tags = null;

            TEST_EVENT.OldResourceProperties.Description = null;
            TEST_EVENT.OldResourceProperties.EncryptedSecret = null;
            TEST_EVENT.OldResourceProperties.SecretPattern = null;
            TEST_EVENT.OldResourceProperties.Length = 32;
            TEST_EVENT.OldResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.OldResourceProperties.Tags = null;
            await ParameterStore.putSecret({ Name: TEST_EVENT.ResourceProperties.Name,
                Value: TEST_PLAIN_TEXT, Tags: TEST_EVENT.ResourceProperties.Tags }, true);

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('Description');
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Version).to.be.an('number');
            expect(result.Data.Secret).to.equal(MASKED_SECRET);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(4000);

        it('should return SUCCESS status and Secret when called with no changed properties and RotateOnUpdate is true', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.Description = null;
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.EncryptedSecret = null;
            TEST_EVENT.ResourceProperties.SecretPattern = null;
            TEST_EVENT.ResourceProperties.Length = 32;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.Name;
            TEST_EVENT.ResourceProperties.Tags = null;

            TEST_EVENT.OldResourceProperties.Description = null;
            TEST_EVENT.OldResourceProperties.EncryptedSecret = null;
            TEST_EVENT.OldResourceProperties.SecretPattern = null;
            TEST_EVENT.OldResourceProperties.Length = 32;
            TEST_EVENT.OldResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.OldResourceProperties.Tags = null;
            await ParameterStore.putSecret({ Name: TEST_EVENT.ResourceProperties.Name,
                Value: TEST_PLAIN_TEXT, Tags: TEST_EVENT.ResourceProperties.Tags}, true);

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('Ignoring Update');
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Version).to.be.an('number');
            expect(result.Data.Secret).to.equal(TEST_PLAIN_TEXT);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(4000);


        it('should return SUCCESS status and Secret when called with Length changed', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.EncryptedSecret = null;
            TEST_EVENT.ResourceProperties.SecretPattern = null;
            TEST_EVENT.ResourceProperties.Length = 40;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.Name;
            TEST_EVENT.ResourceProperties.Tags = null;

            TEST_EVENT.OldResourceProperties.EncryptedSecret = null;
            TEST_EVENT.OldResourceProperties.SecretPattern = null;
            TEST_EVENT.OldResourceProperties.Length = 32;
            TEST_EVENT.OldResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.OldResourceProperties.Tags = null;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('Length');
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Version).to.be.an('number');
            expect(result.Data.Secret).to.have.length(TEST_EVENT.ResourceProperties.Length);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(4000);

        it('should return SUCCESS status when called with a change only to SecretPattern and Tags', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.Length = null;
            TEST_EVENT.ResourceProperties.SecretPattern = '^[a-zA-Z]{1,10}$';
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.ResourceProperties.Tags = null;

            TEST_EVENT.OldResourceProperties.Length = null;
            TEST_EVENT.OldResourceProperties.SecretPattern = null;
            TEST_EVENT.OldResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.OldResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.OldResourceProperties.Tags = [{ 'Key': 'Stage', 'Value': 'Dev' }];

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('SecretPattern');
            expect(result.Reason).to.containIgnoreCase('Tags');
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Secret).to.not.be.null;
            expect(result.Data.Secret).to.not.equal(TEST_PLAIN_TEXT);
            expect(result.Data.Version).to.be.an('number');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS status when called with a change to EncryptedSecret', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.Length = null;
            TEST_EVENT.ResourceProperties.ReturnSecret = false;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.ResourceProperties.SecretPattern = '[0-9a-f]{4}\\-[0-9a-f]{4}\\-[0-9a-f]{4}\\-[0-9a-f]{4}';
            TEST_EVENT.ResourceProperties.EncryptedSecret = TEST_ENCRYPTED_TEXT;
            TEST_EVENT.ResourceProperties.Tags = null;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.Name;

            TEST_EVENT.OldResourceProperties.Length = null;
            TEST_EVENT.OldResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.OldResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.OldResourceProperties.SecretPattern = '[0-9a-f]{4}\\-[0-9a-f]{4}\\-[0-9a-f]{4}\\-[0-9a-f]{4}';
            TEST_EVENT.OldResourceProperties.EncryptedSecret = null;
            TEST_EVENT.OldResourceProperties.Tags = null;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('[EncryptedSecret]');
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Version).to.be.an('number');
            expect(result.Data.Secret).to.equal(MASKED_SECRET);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS status when called with an EncryptedSecret and RotateOnUpdate', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.Length = null;
            TEST_EVENT.ResourceProperties.ReturnSecret = false;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = true;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.ResourceProperties.SecretPattern = null;
            TEST_EVENT.ResourceProperties.EncryptedSecret = TEST_ENCRYPTED_TEXT;
            TEST_EVENT.ResourceProperties.Tags = null;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.Name;

            TEST_EVENT.OldResourceProperties.Length = null;
            TEST_EVENT.OldResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.OldResourceProperties.SecretPattern = null;
            TEST_EVENT.OldResourceProperties.EncryptedSecret = TEST_ENCRYPTED_TEXT;
            TEST_EVENT.OldResourceProperties.Tags = null;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('[RotateOnUpdate]');
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Version).to.be.an('number');
            expect(result.Data.Secret).to.equal(MASKED_SECRET);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS status when called with a change to PlainSecret', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.EncryptedSecret = null;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.Name;
            TEST_EVENT.ResourceProperties.PlainSecret = 'plain-text-value-for-the-secret';

            TEST_EVENT.OldResourceProperties.EncryptedSecret = null;
            TEST_EVENT.OldResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.OldResourceProperties.PlainSecret = null;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('[PlainSecret]');
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Secret).to.equal(TEST_EVENT.ResourceProperties.PlainSecret);
            expect(result.Data.Version).to.be.an('number');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS status when called with a PlainSecret and RotateOnUpdate', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.RotateOnUpdate = true;
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.EncryptedSecret = null;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.Name;
            TEST_EVENT.ResourceProperties.PlainSecret = 'plain-text-value-for-the-secret';

            TEST_EVENT.OldResourceProperties.EncryptedSecret = null;
            TEST_EVENT.OldResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.OldResourceProperties.PlainSecret = TEST_EVENT.ResourceProperties.PlainSecret;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('[RotateOnUpdate]');
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Secret).to.equal(TEST_EVENT.ResourceProperties.PlainSecret);
            expect(result.Data.Version).to.be.an('number');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS status when called with only a change to KmsKeyId', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.OldResourceProperties.KmsKeyId = TEST_KMS_KEY_ID;
            TEST_EVENT.ResourceProperties.PlainSecret = 'plain-text-value-for-the-secret';
            TEST_EVENT.ResourceProperties.Length = null;
            TEST_EVENT.ResourceProperties.SecretPattern = null;
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.Name;
            TEST_EVENT.ResourceProperties.Tags = null;

            TEST_EVENT.OldResourceProperties.KmsKeyId = null;
            TEST_EVENT.OldResourceProperties.PlainSecret = 'plain-text-value-for-the-secret';
            TEST_EVENT.OldResourceProperties.Length = null;
            TEST_EVENT.OldResourceProperties.SecretPattern = null;
            TEST_EVENT.OldResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.OldResourceProperties.Tags = null;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('KmsKeyId');
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Secret).to.not.be.null;
            expect(result.Data.Secret).to.not.equal(TEST_PLAIN_TEXT);
            expect(result.Data.Version).to.be.an('number');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(4000);

        it('should return SUCCESS status when called with only a change to KmsKeyId', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.OldResourceProperties.KmsKeyId = TEST_KMS_KEY_ID;
            TEST_EVENT.ResourceProperties.PlainSecret = null;
            TEST_EVENT.ResourceProperties.Length = null;
            TEST_EVENT.ResourceProperties.SecretPattern = null;
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.Name;
            TEST_EVENT.ResourceProperties.Tags = null;

            TEST_EVENT.OldResourceProperties.KmsKeyId = null;
            TEST_EVENT.OldResourceProperties.PlainSecret = null;
            TEST_EVENT.OldResourceProperties.Length = null;
            TEST_EVENT.OldResourceProperties.SecretPattern = null;
            TEST_EVENT.OldResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.OldResourceProperties.Tags = null;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('KmsKeyId');
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.Data.Secret).to.not.be.null;
            expect(result.Data.Secret).to.not.equal(TEST_PLAIN_TEXT);
            expect(result.Data.Secret).to.not.equal(MASKED_SECRET);
            expect(result.Data.Version).to.be.an('number');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(4000);

        it('should return FAILED status when when changing Name to an existing parameter', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.PhysicalResourceId = NOT_CREATED;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('cannot overwrite existing');
            expect(result.Data).to.be.undefined;
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(4000);

        it('should return FAILED status when called with missing Name property', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.Name = null;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase(MISSING_PROPERTIES);
            expect(result.Reason).to.contain('Name');
            expect(result.Data).to.be.undefined;
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED status when called with invalid ResourceProperties (EncryptedSecret)', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.EncryptedSecret = TEST_PLAIN_TEXT;
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.PhysicalResourceId = REAOURCE_PROPERTY_NAME;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('not Base64 encoded');
            expect(result.Data).to.be.undefined;
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);
    });

    describe('Delete()', () => {
        it('should return SUCCESS status when called with valid ResourceProperties', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.Name = REAOURCE_PROPERTY_NAME;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.Name;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS status and ignored when called with PhysicalResourceId set to resource-not-created', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.Name = NOT_CREATED;
            TEST_EVENT.PhysicalResourceId = NOT_CREATED;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('ignoring');
            expect(result.Data.Name).to.equal(NOT_CREATED);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(4000);

        it('should return SUCCESS status and ignored when called with PhysicalResourceId set to a non-existent parameter', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.Name = 'i-am-so-secret-that-i-cant-be-found';
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.Name;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('ignoring');
            expect(result.PhysicalResourceId).to.containIgnoreCase(TEST_EVENT.PhysicalResourceId);
            expect(result.Data.Name).to.equal(TEST_EVENT.ResourceProperties.Name);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(4000);

        it('should return FAILED status when called with missing Name property', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.Name = null;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase(MISSING_PROPERTIES);
            expect(result.Reason).to.contain('Name');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(4000);

        it('should return FAILED status when called with PhysicalResourceId being too long', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.Name = '/longsecret'.repeat(200);
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.Name;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('length less than');
        }).timeout(4000);
    });
});