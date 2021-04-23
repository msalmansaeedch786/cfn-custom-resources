/* eslint require-atomic-updates: error */
'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));

const lambda = require('../../index');
const ImportKeyPairProvider = require('../../providers/import-keypair-provider');
const KeyPairUtils = require('../../lib/aws/keypair-utils');
const { FAILED, SUCCESS, NOT_CREATED } = require('../../lib/aws/constants');

const TEST_KEY_PAIR_NAME = '/northbaylabs/my-imported-keypair';
const TEST_PUBLIC_KEY_MATERIAL = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCvhkoFEKhMacwt1gZhx3ap7rP2GOxYOc2DtqTF2bg8PJ693B' +
    'j1QxRzedmAzApdSUNrJjPspndEt5fMdQamxEt8TrmHba+R6qE17YyOgmcVgDoGIKI7vvzuikcc2Z8AGB6OCDYW7GObvFsHfb5Kgul1gK4kjMmH' +
    'hO4VKlOfzAgkIbEtzH6/+gMRFmxFx0t4Yvz6CjUy1EteoxtWR5Y1V3Up1BVTrU+hS8MkN/hFzWnhwzTtMiNzyd2E6SjPBLHMjOaACXD89bOnMQ' +
    'bobzETzPxNW35oPSbyoLMGdDj33GeGKcShVrIZpqm6EQwQgTfBULdXT/cffUoDNKx35Xl11Mn7 temp-key';
const PUBLIC_KEY_MATERIAL = 'AAAAB3NzaC1yc2EAAAADAQABAAABAQCvhkoFEKhMacwt1gZhx3/+gMRFmxS8MkN/hFzWn==';
const TEST_EVENT = {
    ResponseURL: 'https://httpbin.org/put',
    StackId: 'arn:aws:cloudformation:us-east-1:123456789012:stack/stack-name/guid',
    RequestId: '1234',
    ResourceType: ImportKeyPairProvider.RESOURCE_TYPE,
    LogicalResourceId: 'LogicalResourceId1234',
    ResourceProperties: {
        KeyName: TEST_KEY_PAIR_NAME,
        PublicKeyMaterial: TEST_PUBLIC_KEY_MATERIAL
    },
    OldResourceProperties: {
    }
};

const TEST_CONTEXT = {
    logStreamName: 'key-pair-logstream',
    done: function () { },
    getRemainingTimeInMillis: function () { return 60000; }
};

async function deleteKeyPair(keyPairName) {
     try {
        await KeyPairUtils.deleteKeyPair(keyPairName);
    } catch(err) {
        // Ignored
    }
}

describe('ImportKeyPair', () => {
    describe('Create()', () => {
        it('should return SUCCESS status and KeyFingerPrint when called with valid ResourceProperties', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME;
            await deleteKeyPair(TEST_EVENT.ResourceProperties.KeyName);

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Data.KeyFingerprint).to.be.a('string');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(4000);

        it('should return FAILED status when called with missing ResourceProperties', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.KeyName = null;
            TEST_EVENT.ResourceProperties.PublicKeyMaterial = null;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('missing');
            expect(result.Reason).to.containIgnoreCase('keyname');
            expect(result.Reason).to.containIgnoreCase('publickeymaterial');
        }).timeout(4000);

        it('should return FAILED status when called with invalid PublicKeyMaterial', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME;
            TEST_EVENT.ResourceProperties.PublicKeyMaterial = 'AAAAB3NzaC1yc2EAAAADAQABAAABAQCvhkoFEKhMacwt1gZhx3ap7rP2GOxYOc2DtqTF2bg8PJ693Bj1QxRzedmAzApdSUNrJjPspndEt5fMdQamxEt8TrmHba+R6qE17YyOgmcVgDoGIKI7vvzuikcc2Z8AGB6OCDYW7GObvFsHfb5Kgul1gK4kjMmHhO4VKlOfzAgkIbEtzH6/+gMRFmxFx0t4Yvz6CjUy1EteoxtWR5Y1V3Up1BVTrU+hS8MkN/hFzWnhwzTtMiNzyd2E6SjPBLHMjOaACXD89bOnMQbobzETzPxNW35oPSbyoLMGdDj33GeGKcShVrIZpqm6EQwQgTfBULdXT/cffUoDNKx35Xl11Mn7';

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('not in valid openssh');
        }).timeout(6000);
    });

    describe('Delete()', () => {
        it('should return SUCCESS status when called with valid KeyName', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME;
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

        it('should return SUCCESS status when called with a non-existing PhysicalResourceId', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.KeyName = '/northbaylabs/thiskeypairdoesnotexists';
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(4000);
    });

    describe('Update()', () => {
        it('should return SUCCESS status and KeyFingerPrint when called with a KeyName change', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.PublicKeyMaterial = TEST_PUBLIC_KEY_MATERIAL;
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME;
            TEST_EVENT.OldResourceProperties.PublicKeyMaterial = TEST_PUBLIC_KEY_MATERIAL;
            TEST_EVENT.OldResourceProperties.KeyName = NOT_CREATED;
            TEST_EVENT.PhysicalResourceId = NOT_CREATED;
            await deleteKeyPair(TEST_EVENT.ResourceProperties.KeyName);

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Data.KeyFingerprint).to.be.a('string');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS status and KeyFingerPrint when called with no property changes', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.PublicKeyMaterial = TEST_PUBLIC_KEY_MATERIAL;
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME;
            TEST_EVENT.OldResourceProperties.PublicKeyMaterial = TEST_PUBLIC_KEY_MATERIAL;
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Data.KeyFingerprint).to.be.a('string');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS status when called with a change to the PublicKeyMaterial', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.PublicKeyMaterial = TEST_PUBLIC_KEY_MATERIAL;
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME;
            TEST_EVENT.OldResourceProperties.PublicKeyMaterial = 'bad public key material';
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Data.KeyFingerprint).to.be.a('string');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED status when called with no property changes and a non-existing KeyName', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.PublicKeyMaterial = TEST_PUBLIC_KEY_MATERIAL;
            TEST_EVENT.ResourceProperties.KeyName = '/northbaylabs/idonotexists';
            TEST_EVENT.OldResourceProperties.PublicKeyMaterial = TEST_PUBLIC_KEY_MATERIAL;
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('does not exist');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED status when called with invalid PublicKeyMaterial', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME;
            TEST_EVENT.ResourceProperties.PublicKeyMaterial = PUBLIC_KEY_MATERIAL;
            TEST_EVENT.OldResourceProperties.PublicKeyMaterial = TEST_PUBLIC_KEY_MATERIAL;
            TEST_EVENT.OldResourceProperties.KeyName = TEST_EVENT.ResourceProperties.KeyName;
            TEST_EVENT.PhysicalResourceId = TEST_EVENT.ResourceProperties.KeyName;
            await deleteKeyPair(TEST_EVENT.ResourceProperties.KeyName);

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('Key is not in valid OpenSSH');
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
        }).timeout(4000);

        it('should return FAILED status when called with invalid PublicKeyMaterial and PhysicalResourceId set to resource-not-created', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.KeyName = TEST_KEY_PAIR_NAME;
            TEST_EVENT.ResourceProperties.PublicKeyMaterial = PUBLIC_KEY_MATERIAL;
            TEST_EVENT.OldResourceProperties.PublicKeyMaterial = TEST_PUBLIC_KEY_MATERIAL;
            TEST_EVENT.OldResourceProperties.KeyName = NOT_CREATED;
            TEST_EVENT.PhysicalResourceId = NOT_CREATED;
            await deleteKeyPair(TEST_EVENT.ResourceProperties.KeyName);

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('Key is not in valid OpenSSH');
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
        }).timeout(4000);

        it('should return FAILED status when called with missing ResourceProperties', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.KeyName = null;
            TEST_EVENT.ResourceProperties.PublicKeyMaterial = null;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('missing');
            expect(result.Reason).to.containIgnoreCase('keyname');
            expect(result.Reason).to.containIgnoreCase('publickeymaterial');
        }).timeout(4000);
    });
});
