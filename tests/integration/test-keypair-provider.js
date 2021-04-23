'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));
chai.use(require("chai-as-promised"));

const lambda = require('../../index');
const KeyPairUtils = require('../../lib/aws/keypair-utils');
const { FAILED, SUCCESS, NOT_CREATED } = require('../../lib/aws/constants');
const KeyPairProvider = require('../../providers/keypair-provider');
const keyPairProvider = new KeyPairProvider(null);

const TEST_KEY_PAIR_NAME_1 = 'test-keypair1';
const TEST_SECRET_PATH_1 = '/test/path1';

const TEST_SECRET_PATH_2 = '/test/path2';
const TEST_KEY_PAIR_NAME_2 = 'test-keypair2';

const TEST_KEY_PAIR_NAME_NEW = `${TEST_KEY_PAIR_NAME_1}-new`;
const TEST_SECRET_PATH_NEW = `${TEST_SECRET_PATH_1}-new`;

const TEST_KMS_KEY_ID = 'alias/northbaylabs/cfn-custom-resources-dev';
const TEST_TAGS = [{ "Key" : "Stage", "Value" : "Dev" }];

var TEST_EVENT = {
    ResponseURL : 'https://httpbin.org/put',
    StackId : 'arn:aws:cloudformation:us-east-1:123456789012:stack/stack-name/guid',
    RequestId : '1234',
    ResourceType : KeyPairProvider.RESOURCE_TYPE,
    LogicalResourceId : 'LogicalResourceId1234',
    ResourceProperties : {
        Description: "",
        KeyName: "",
        KmsKeyId: "",
        SecretPath: "",
        Tags : TEST_TAGS
    },
    OldResourceProperties : {
    }
};

const TEST_CONTEXT = {
    logStreamName: 'key-pair-logstream',
    getRemainingTimeInMillis: function() { return 60000; }
};

describe('KeyPairProvider', async () => {

    // Delete all the test resources used in this test.
    // We do this to make sure we are at a known state.
    describe('Test Set Up', () => {
        it('should delete KeyPair resources', async () => {
            await KeyPairUtils.deleteKeyPair(TEST_KEY_PAIR_NAME_1);
            await keyPairProvider.deleteKeyPairParameters({ SecretPath: TEST_SECRET_PATH_1 });
            await KeyPairUtils.deleteKeyPair(TEST_KEY_PAIR_NAME_2);
            await keyPairProvider.deleteKeyPairParameters({ SecretPath: TEST_SECRET_PATH_2 });
            await KeyPairUtils.deleteKeyPair(TEST_KEY_PAIR_NAME_1 + '-kms');
            await keyPairProvider.deleteKeyPairParameters({ SecretPath: TEST_SECRET_PATH_1 + '-kms'});
            await KeyPairUtils.deleteKeyPair(TEST_KEY_PAIR_NAME_NEW);
            await keyPairProvider.deleteKeyPairParameters(TEST_SECRET_PATH_NEW);
            await KeyPairUtils.deleteKeyPair(TEST_KEY_PAIR_NAME_1 + '-temp');
        }).timeout(12000);
    });

    describe('Create()', () => {
        it('should return SUCCESS when called with valid KeyName and KmsKeyId is null',  async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_1;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.KmsKeyId = null;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.KeyFingerprint).to.be.a('string');
            expect(result.Data.KeyName).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.SecretPath).to.equal(TEST_EVENT.ResourceProperties.SecretPath);
        }).timeout(6000);

        it('should return SUCCESS status when KmsKeyId value is given',  async () => {
            // Arrange
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_2;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_2;
            TEST_EVENT.ResourceProperties.KmsKeyId = TEST_KMS_KEY_ID;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.KeyName).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.SecretPath).to.equal(TEST_EVENT.ResourceProperties.SecretPath);
            expect(result.Data.KeyFingerprint).to.be.a('string');
        }).timeout(8000);

        it('should return FAILED status when SecretPath already exists',  async () => {
            // Arrange
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_1 + '-temp';
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.Tags = null;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('Cannot overwrite existing');
        }).timeout(6000);

        it('Should return FAILED status when KmsKeyId does not exist', async () => {
            // Arrange
            TEST_EVENT.ResourceProperties.KeyName = `${TEST_KEY_PAIR_NAME_1}-kms`;
            TEST_EVENT.ResourceProperties.SecretPath = `${TEST_SECRET_PATH_1}-kms`;
            TEST_EVENT.ResourceProperties.KmsKeyId = 'arn:aws:kms:us-east-1:123456789012:key/does-not-exists';

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.Reason).to.containIgnoreCase('Invalid keyId');
        }).timeout(6000);

        it('Should return FAILED status when trying to create keypair with existing KeyName', async () => {
            // Arrange
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_1;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.KmsKeyId = null;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.Reason).to.containIgnoreCase('Cannot overwrite existing');
        }).timeout(6000);

        it('should return FAILED when called with an invalid SecretPath',  async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.KeyName = `${TEST_KEY_PAIR_NAME_1}-badpath`;
            TEST_EVENT.ResourceProperties.SecretPath = '/alongpath'.repeat(210);
            TEST_EVENT.ResourceProperties.KmsKeyId = null;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
        }).timeout(8000);
    });

    describe('Update()', () => {
        it('should return SUCCESS status when called with only tags updated', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.Description = null;
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_1;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.KmsKeyId = null;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.ResourceProperties.Tags = TEST_TAGS;
            TEST_EVENT.OldResourceProperties.Description = null;
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.OldResourceProperties.KmsKeyId = null;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('[Tags]');
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.KeyName).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.SecretPath).to.equal(TEST_EVENT.ResourceProperties.SecretPath);
            expect(result.Data.KeyFingerprint).to.be.a('string');
        }).timeout(8000);

        it('should return SUCCESS status when called with a change to KeyName', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_NEW;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.KmsKeyId = null;
            TEST_EVENT.ResourceProperties.Tags = null;
            TEST_EVENT.OldResourceProperties.KeyName = 'test-keypair1';
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.OldResourceProperties.KmsKeyId = null;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('[KeyName]');
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.KeyName).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.SecretPath).to.equal(TEST_EVENT.ResourceProperties.SecretPath);
            expect(result.Data.KeyFingerprint).to.be.a('string');
        }).timeout(8000);

        it('should return SUCCESS status when called with a change to SecretPath only', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_NEW;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_NEW;
            TEST_EVENT.ResourceProperties.KmsKeyId = null;
            TEST_EVENT.ResourceProperties.Tags = null;
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.OldResourceProperties.KmsKeyId = null;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;
            await keyPairProvider.deleteKeyPairParameters(TEST_EVENT.ResourceProperties);

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('[SecretPath]');
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.KeyName).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.SecretPath).to.equal(TEST_EVENT.ResourceProperties.SecretPath);
            expect(result.Data.KeyFingerprint).to.be.a('string');
        }).timeout(8000);
    
        it('should return SUCCESS status when called with a change to KmsKeyId only', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_NEW;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_NEW;
            TEST_EVENT.ResourceProperties.KmsKeyId = null;
            TEST_EVENT.ResourceProperties.Tags = null;
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.OldResourceProperties.KmsKeyId = TEST_KMS_KEY_ID;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('[KmsKeyId]');
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.KeyName).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.SecretPath).to.equal(TEST_EVENT.ResourceProperties.SecretPath);
            expect(result.Data.KeyFingerprint).to.be.a('string');
        }).timeout(8000);

        it('should return SUCCESS status when called with a change to Description only', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.Description = 'Updated KeyPair Description';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_NEW;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_NEW;
            TEST_EVENT.ResourceProperties.KmsKeyId = null;
            TEST_EVENT.ResourceProperties.Tags = null;
            TEST_EVENT.OldResourceProperties.Description = null;
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.OldResourceProperties.KmsKeyId = null;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('[Description]');
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.KeyName).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.SecretPath).to.equal(TEST_EVENT.ResourceProperties.SecretPath);
            expect(result.Data.KeyFingerprint).to.be.a('string');
        }).timeout(8000);

        it('should return SUCCESS status when called with a change to Description only', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.Description = null;
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_NEW;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_NEW;
            TEST_EVENT.ResourceProperties.KmsKeyId = null;
            TEST_EVENT.ResourceProperties.Tags = null;
            TEST_EVENT.OldResourceProperties.Description = 'Updated KeyPair Description';
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.OldResourceProperties.KmsKeyId = null;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('[Description]');
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.KeyName).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.SecretPath).to.equal(TEST_EVENT.ResourceProperties.SecretPath);
            expect(result.Data.KeyFingerprint).to.be.a('string');
        }).timeout(8000);

        it('should return FAILED status when SecretPath has missing parameters and there are no property changes', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_NEW;
            TEST_EVENT.ResourceProperties.SecretPath = `${TEST_SECRET_PATH_1}-missing`;
            TEST_EVENT.ResourceProperties.KmsKeyId = null;
            TEST_EVENT.ResourceProperties.Tags = null;
            TEST_EVENT.ResourceProperties.Description = null;
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.OldResourceProperties.KmsKeyId = null;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.OldResourceProperties.Description = null;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.Reason).to.containIgnoreCase('missing KeyPair parameters');
        }).timeout(6000);

        it('should return FAILED status when changing SecretPath to existing parameters', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_NEW;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_NEW;
            TEST_EVENT.ResourceProperties.KmsKeyId = null;
            TEST_EVENT.ResourceProperties.Tags = TEST_TAGS;
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.OldResourceProperties.KmsKeyId = null;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.Reason).to.containIgnoreCase('Cannot overwrite existing KeyPair parameters');
        }).timeout(6000);

        it('should return FAILED status when called with KeyName that does not exist', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.KeyName = `${TEST_KEY_PAIR_NAME_1}-non-existing-keyname`;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_NEW;
            TEST_EVENT.ResourceProperties.KmsKeyId = null;
            TEST_EVENT.ResourceProperties.Tags = null;
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.OldResourceProperties.KmsKeyId = null;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Reason).to.containIgnoreCase('does not exist');
        }).timeout(6000);

        it('should return SUCCESS status when called with RotateOnUpdate is true', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_NEW;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = true;
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('[RotateOnUpdate]');
            expect(result.Data.KeyName).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.SecretPath).to.equal(TEST_EVENT.ResourceProperties.SecretPath);
            expect(result.Data.KeyFingerprint).to.be.a('string');
        }).timeout(8000);

        it('should return SUCCESS status when called with no property changes', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_NEW;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Data.KeyName).to.equal(TEST_EVENT.ResourceProperties.KeyName);
            expect(result.Data.SecretPath).to.equal(TEST_EVENT.ResourceProperties.SecretPath);
            expect(result.Data.KeyFingerprint).to.be.a('string');
        }).timeout(8000);

        it('should return FAILED status when called with RotateOnUpdate is true and invalid SecretPath', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_NEW;
            TEST_EVENT.ResourceProperties.SecretPath = '/alongpath'.repeat(210);
            TEST_EVENT.ResourceProperties.RotateOnUpdate = true;
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.Reason).to.containIgnoreCase('validation error');
        }).timeout(6000);
    });

    describe('Delete()', () => {
        it('should return SUCCESS when called with valid properties', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_2;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_2;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS when called with valid properties a non-existing KeyName', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.KeyName = `${TEST_KEY_PAIR_NAME_1}-non-existing-keyname`;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS when called with PhysicalResourceId set to resource-not-created', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.KeyName = NOT_CREATED;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED when called with a SecretPath that is too long', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME_NEW;
            TEST_EVENT.ResourceProperties.SecretPath = '/alongpath'.repeat(210);
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.be.a('string');
        }).timeout(6000);
    });
});
