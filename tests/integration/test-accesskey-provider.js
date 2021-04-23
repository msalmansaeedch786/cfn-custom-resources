'use strict';
/* eslint-disable require-atomic-updates */

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));

const lambda = require('../../index');
const { FAILED, SUCCESS, MASKED_SECRET, NOT_CREATED } = require('../../lib/aws/constants');
const AccessKeyProvider = require('../../providers/accesskey-provider');
const accessKeyProvider = new AccessKeyProvider({ info: function() { /* ignore */ } });

const TEST_USER_1 = 'test-user1';
const TEST_SECRET_PATH_1 = '/northbaylabs/test/test-user1';

const TEST_USER_2 = 'test-user2';
const TEST_SECRET_PATH_2 = '/northbaylabs/test/test-user2';

const TEST_USER_3 = 'test-user3';
const TEST_SECRET_PATH_3 = '/northbaylabs/test/test-user3';

const BAD_SECRET_PATH = 'ssm';
const BAD_SECRET_PATH_ERROR_MSG = 'Parameter name: can\'t be prefixed with "ssm"';

const BAD_DESCRIPTION = 'This is a long description, '.repeat(40);
const BAD_DESCRIPTION_ERROR_MSG = 'length less than or equal to';

const TEST_KMS_KEY_ID = 'alias/northbaylabs/cfn-custom-resources-dev';
const TEST_TAGS = [{ Key: 'Stage', Value: 'Dev' }, { Key: 'ParameterType', Value: 'LicenseKey' }];
var TEST_EVENT = {
    ResponseURL: 'https://httpbin.org/put',
    StackId: 'arn:aws:cloudformation:us-west-2:123456789012:stack/stack-name/guid',
    RequestId: '1234',
    ResourceType: AccessKeyProvider.RESOURCE_TYPE,
    LogicalResourceId: 'LogicalResourceId1234',
    ResourceProperties: {
        UserName: 'test-user1',
        SecretPath: '/northbaylabs/test/test-user1',
        Description: 'optional-description',
        ReturnSecret: 'true',
        ReturnSmtpPassword: false,
        RotateOnUpdate: false
    },
    OldResourceProperties: {
    }
};

const TEST_CONTEXT = {
    logStreamName: 'access-key-logstream',
    done: function () { },
    getRemainingTimeInMillis: function () { return 60000; }
};

describe('AccessKeyProvider ', () => {

    // Used to keep track of the last successful AccessKeyId.
    let testUser1AccessKeyId = null;
    let testUser2AccessKeyId = null;

    describe('deleteAccessKeyResources()', () => {
        it('should delete test AccessKey resources pre-test', async () => {

            await accessKeyProvider.deleteAccessKeyResources(TEST_SECRET_PATH_1, TEST_USER_1);
            await accessKeyProvider.deleteAccessKeyResources(TEST_SECRET_PATH_2, TEST_USER_2);
            await accessKeyProvider.deleteAccessKeyResources(TEST_SECRET_PATH_3, TEST_USER_3);

            // Give AWS some time to get the parameters flushed from their caches.
            // If this is not done create may fail.
            await new Promise(function (resolve) { setTimeout(function () { resolve(); }, 1000); });

        }).timeout(12000);
    });

    describe('Create()', () => {
        it('should return FAILED when called with a Description that is too long', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_1;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.ReturnSecret = false;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = false;
            TEST_EVENT.ResourceProperties.Description = BAD_DESCRIPTION;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase(BAD_DESCRIPTION_ERROR_MSG);
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.Data).to.be.undefined;
        }).timeout(10000);

        it('should return SUCCESS and access keys with smtp password when valid UserName and SecretPath is given', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_1;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = true;
            TEST_EVENT.ResourceProperties.Description = null;
            TEST_EVENT.ResourceProperties.Tags = TEST_TAGS;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);
            testUser1AccessKeyId = result.PhysicalResourceId;

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Data.AccessKeyId).to.be.a('string');
            expect(result.PhysicalResourceId).to.equal(result.Data.AccessKeyId);
            expect(result.Data.UserName).to.equal(TEST_EVENT.ResourceProperties.UserName);
            expect(result.Data.SecretAccessKey).to.be.a('string');
            expect(result.Data.SmtpPassword).to.be.a('string');
        }).timeout(10000);

        it('should return SUCCESS and access key but not secret key when ReturnSecret is false', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_2;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_2;
            TEST_EVENT.ResourceProperties.ReturnSecret = false;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = false;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);
            testUser2AccessKeyId = result.PhysicalResourceId;

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Data.AccessKeyId).to.be.a('string');
            expect(result.PhysicalResourceId).to.equal(result.Data.AccessKeyId);
            expect(result.Data.UserName).to.equal(TEST_EVENT.ResourceProperties.UserName);
            expect(result.Data.SecretAccessKey).to.equal(MASKED_SECRET);
            expect(result.Data.SmtpPassword).to.equal(MASKED_SECRET);
        }).timeout(10000);

        it('should return FAILED status when parameter already exist', async () => {

            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_1;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = true;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('parameters');
            expect(result.Reason).to.containIgnoreCase('Cannot overwrite existing');
            expect(result.Data).to.be.undefined;
        }).timeout(6000);

        it('should return FAILED when required property UserName does not exist', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.UserName = 'no-one';
            TEST_EVENT.ResourceProperties.SecretPath = '/northbaylabs/test/no-one';
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = true;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('user');
            expect(result.Reason).to.containIgnoreCase('cannot be found');
            expect(result.Data).to.be.undefined;
        }).timeout(6000);

        it('should return FAILED when required property UserName is not provided', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.UserName = null;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = true;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('missing');
            expect(result.Reason).to.containIgnoreCase('[UserName]');
            expect(result.Data).to.be.undefined;
        });

        it('should return FAILED status when required property SecretPath is not provided', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_1;
            TEST_EVENT.ResourceProperties.SecretPath = null;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('missing');
            expect(result.Reason).to.containIgnoreCase('secretpath');
            expect(result.Data).to.be.undefined;
        });
    });
 
    describe('Update()', () => {
        it('should return SUCCESS status and new AccessKey when called with no property changes and RotateOnUpdate true', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_1;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = true;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = true;
            TEST_EVENT.ResourceProperties.Tags = null;
            TEST_EVENT.ResourceProperties.Description = null;
            TEST_EVENT.ResourceProperties.KmsKeyId = null;
            TEST_EVENT.OldResourceProperties.UserName = TEST_EVENT.ResourceProperties.UserName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.OldResourceProperties.Description = null;
            TEST_EVENT.OldResourceProperties.KmsKeyId = null;
            TEST_EVENT.PhysicalResourceId = testUser1AccessKeyId;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);
            testUser1AccessKeyId = result.Data.AccessKeyId;

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('[RotateOnUpdate]');
            expect(result.Data.AccessKeyId).to.be.a('string');
            expect(result.PhysicalResourceId).to.equal(result.Data.AccessKeyId);
            expect(result.Data.UserName).to.equal(TEST_EVENT.ResourceProperties.UserName);
            expect(result.Data.SecretAccessKey).to.be.a('string');
            expect(result.Data.SmtpPassword).to.be.a('string');
        }).timeout(60000);

        it('should return SUCCESS status and ignoring reason when called with no property changes', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_1;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = true;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.OldResourceProperties.UserName = TEST_EVENT.ResourceProperties.UserName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.OldResourceProperties.Description = null;
            TEST_EVENT.PhysicalResourceId = testUser1AccessKeyId;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('Ignoring Update');
            expect(result.Data.AccessKeyId).to.be.a('string');
            expect(result.Data.AccessKeyId).to.equal(testUser1AccessKeyId);
            expect(result.PhysicalResourceId).to.equal(result.Data.AccessKeyId);
            expect(result.Data.UserName).to.equal(TEST_EVENT.ResourceProperties.UserName);
            expect(result.Data.SecretAccessKey).to.be.a('string');
            expect(result.Data.SecretAccessKey).to.not.equal(MASKED_SECRET);
            expect(result.Data.SmtpPassword).to.be.a('string');
            expect(result.Data.SmtpPassword).to.not.equal(MASKED_SECRET);
        }).timeout(12000);

        it('should return SUCCESS status, existing AccessKey, and secrets when called with Description changed', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_1;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = true;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.ResourceProperties.Description = 'This is some new detail about AccessKey';
            TEST_EVENT.ResourceProperties.Tags = null;
            TEST_EVENT.OldResourceProperties.UserName = TEST_EVENT.ResourceProperties.UserName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.OldResourceProperties.Description = null;
            TEST_EVENT.PhysicalResourceId = testUser1AccessKeyId;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('Description');
            expect(result.Data.AccessKeyId).to.be.a('string');
            expect(result.Data.AccessKeyId).to.equal(testUser1AccessKeyId);
            expect(result.PhysicalResourceId).to.equal(testUser1AccessKeyId);
            expect(result.Data.UserName).to.equal(TEST_EVENT.ResourceProperties.UserName);
            expect(result.Data.SecretAccessKey).to.be.a('string');
            expect(result.Data.SecretAccessKey).to.not.equal(MASKED_SECRET);
            expect(result.Data.SmtpPassword).to.be.a('string');
            expect(result.Data.SmtpPassword).to.not.equal(MASKED_SECRET);
        }).timeout(12000);

        it('should return SUCCESS status and no secrets when called with existing valid resource and new tags', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_1;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.ResourceProperties.ReturnSecret = false;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = false;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.ResourceProperties.Description = null;
            TEST_EVENT.ResourceProperties.Tags = TEST_TAGS;
            TEST_EVENT.OldResourceProperties.UserName = TEST_EVENT.ResourceProperties.UserName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.PhysicalResourceId = testUser1AccessKeyId;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('Tags');
            expect(result.Data.AccessKeyId).to.be.a('string');
            expect(result.Data.AccessKeyId).to.equal(testUser1AccessKeyId);
            expect(result.PhysicalResourceId).to.equal(result.Data.AccessKeyId);
            expect(result.Data.UserName).to.equal(TEST_EVENT.ResourceProperties.UserName);
            expect(result.Data.SecretAccessKey).to.equal(MASKED_SECRET);
            expect(result.Data.SmtpPassword).to.equal(MASKED_SECRET);
        }).timeout(12000);

        it('should return SUCCESS status when RotateOnUpdate is true and Description, Tags, and KmsKeyId are changed', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_2;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_2;
            TEST_EVENT.ResourceProperties.ReturnSecret = false;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = false;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = true;
            TEST_EVENT.ResourceProperties.Description = 'This is some new detail about accesskey';
            TEST_EVENT.ResourceProperties.Tags = TEST_TAGS;
            TEST_EVENT.ResourceProperties.KmsKeyId = TEST_KMS_KEY_ID;
            TEST_EVENT.OldResourceProperties.UserName = TEST_USER_2;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_SECRET_PATH_2;
            TEST_EVENT.OldResourceProperties.Tags = null;
            TEST_EVENT.OldResourceProperties.KmsKeyId = null;
            TEST_EVENT.PhysicalResourceId = testUser2AccessKeyId;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);
            testUser2AccessKeyId = result.PhysicalResourceId;

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('KmsKeyId');
            expect(result.Reason).to.containIgnoreCase('Description');
            expect(result.Reason).to.containIgnoreCase('Tags');
            expect(result.Data.AccessKeyId).to.be.a('string');
            expect(result.Data.AccessKeyId).to.not.equal(TEST_EVENT.PhysicalResourceId);
            expect(result.PhysicalResourceId).to.equal(result.Data.AccessKeyId);
            expect(result.Data.UserName).to.equal(TEST_EVENT.ResourceProperties.UserName);
            expect(result.Data.SecretAccessKey).to.equal(MASKED_SECRET);
            expect(result.Data.SmtpPassword).to.equal(MASKED_SECRET);
        }).timeout(12000);

        it('should return SUCCESS status when UserName and SecretPath property changed', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_3;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_3;
            TEST_EVENT.ResourceProperties.ReturnSecret = false;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = false;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.ResourceProperties.Description = null;
            TEST_EVENT.ResourceProperties.Tags = null;
            TEST_EVENT.ResourceProperties.KmsKeyId = null;
            TEST_EVENT.OldResourceProperties.UserName = TEST_USER_2;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_SECRET_PATH_2;
            TEST_EVENT.PhysicalResourceId = testUser2AccessKeyId;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);
            testUser2AccessKeyId = result.PhysicalResourceId;

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('SecretPath');
            expect(result.Reason).to.containIgnoreCase('UserName');
            expect(result.Data.AccessKeyId).to.be.a('string');
            expect(result.Data.AccessKeyId).to.not.equal(TEST_EVENT.PhysicalResourceId);
            expect(result.PhysicalResourceId).to.equal(result.Data.AccessKeyId);
            expect(result.Data.UserName).to.equal(TEST_EVENT.ResourceProperties.UserName);
            expect(result.Data.SecretAccessKey).to.equal(MASKED_SECRET);
            expect(result.Data.SmtpPassword).to.equal(MASKED_SECRET);
        }).timeout(12000);

        it('should return FAILED status when trying to overwrite an existing SecretPath', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_3;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_3;
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = true;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.OldResourceProperties.UserName = TEST_USER_2;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_SECRET_PATH_2;
            TEST_EVENT.PhysicalResourceId = testUser2AccessKeyId;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('Cannot overwrite existing AccessKey parameters');
            expect(result.Data).to.be.undefined;
        }).timeout(8000);

        it('should return FAILED status when AccessKey resource does not exist and RotateOnUpdate is false', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_2;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_2;
            TEST_EVENT.ResourceProperties.ReturnSecret = true;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = true;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.OldResourceProperties.UserName = TEST_EVENT.ResourceProperties.UserName;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_EVENT.ResourceProperties.SecretPath;
            TEST_EVENT.PhysicalResourceId = testUser2AccessKeyId;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('Invalid resource state');
        }).timeout(8000);

        it('should return FAILED when called with no changes except an invalid Description', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_3;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_3;
            TEST_EVENT.ResourceProperties.Description = BAD_DESCRIPTION;
            TEST_EVENT.ResourceProperties.ReturnSecret = false;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = false;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.OldResourceProperties.UserName = TEST_USER_3;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_SECRET_PATH_3;
            TEST_EVENT.OldResourceProperties.Description = null;
            TEST_EVENT.PhysicalResourceId = testUser2AccessKeyId;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase(BAD_DESCRIPTION_ERROR_MSG);
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.Data).to.be.undefined;
        }).timeout(6000);

        it('should return FAILED when called with PhysicalResourceId set to resource-not-created and an invalid Description', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_2;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_2;
            TEST_EVENT.ResourceProperties.Description = BAD_DESCRIPTION;
            TEST_EVENT.ResourceProperties.ReturnSecret = false;
            TEST_EVENT.ResourceProperties.ReturnSmtpPassword = false;
            TEST_EVENT.ResourceProperties.RotateOnUpdate = false;
            TEST_EVENT.OldResourceProperties.UserName = TEST_USER_2;
            TEST_EVENT.OldResourceProperties.SecretPath = TEST_SECRET_PATH_2;
            TEST_EVENT.OldResourceProperties.Description = null;
            TEST_EVENT.PhysicalResourceId = NOT_CREATED;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase(BAD_DESCRIPTION_ERROR_MSG);
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.Data).to.be.undefined;
        }).timeout(6000);
    });

    describe('Delete()', () => {
        it('should return SUCCESS when called with existing resource', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_1;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.PhysicalResourceId = testUser1AccessKeyId;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.PhysicalResourceId).to.equal(testUser1AccessKeyId);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(8000);

        it('should return SUCCESS when called with PhysicalResourceId set to resource-not-created', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_1;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.PhysicalResourceId = NOT_CREATED;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(4000);

        it('should return SUCCESS when called with an AccessKey and parameters that do not exist', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_1;
            TEST_EVENT.ResourceProperties.SecretPath = TEST_SECRET_PATH_1;
            TEST_EVENT.PhysicalResourceId = testUser1AccessKeyId;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.PhysicalResourceId).to.equal(testUser1AccessKeyId);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED status when called with a SecretPath prefixed with ssm', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.UserName = TEST_USER_1;
            TEST_EVENT.ResourceProperties.SecretPath = BAD_SECRET_PATH;
            TEST_EVENT.PhysicalResourceId = 'non-existent-access-key';

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase(BAD_SECRET_PATH_ERROR_MSG);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);
    });

    describe('deleteAccessKeyResources()', () => {
        it('should delete test AccessKey resources post-test', async () => {
            await accessKeyProvider.deleteAccessKeyResources(TEST_SECRET_PATH_1, TEST_USER_1);
            await accessKeyProvider.deleteAccessKeyResources(TEST_SECRET_PATH_2, TEST_USER_2);
            await accessKeyProvider.deleteAccessKeyResources(TEST_SECRET_PATH_3, TEST_USER_3);
        }).timeout(10000);
    });
});