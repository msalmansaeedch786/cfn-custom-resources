'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));

const keyPairStore = require('../../lib/aws/keypair-utils');

let TEST_KEY_NAME = '/northbaylabs/my-imported-keypair';
let TEST_PUBLIC_KEY_MATERIAL = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCvhkoFEKhMacwt1gZhx3ap7rP2GOxYOc2DtqTF2' +
    'bg8PJ693Bj1QxRzedmAzApdSUNrJjPspndEt5fMdQamxEt8TrmHba+R6qE17YyOgmcVgDoGIKI7vvzuikcc2Z8AGB6OCDYW7GObvFsHf' +
    'b5Kgul1gK4kjMmHhO4VKlOfzAgkIbEtzH6/+gMRFmxFx0t4Yvz6CjUy1EteoxtWR5Y1V3Up1BVTrU+hS8MkN/hFzWnhwzTtMiNzyd2E6' +
    'SjPBLHMjOaACXD89bOnMQbobzETzPxNW35oPSbyoLMGdDj33GeGKcShVrIZpqm6EQwQgTfBULdXT/cffUoDNKx35Xl11Mn7 temp-key';
const EXPECTED_EXCEPTION = 'Expected exception was not thrown, it was not!';

describe('keypair-utils', () => {
    describe('importKeyPair()', () => {
        it('should throw an exception with a invalid parameter public key material', async () => {
            // Arrange
            let keyName = TEST_KEY_NAME;
            let publicKeyMaterial = 'sha-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCvhkoFEK/hMacwt1gZhx3ap/7rP2GOx temp-key';

            // Act and Assert
            try {
                await keyPairStore.importKeyPair(keyName, publicKeyMaterial);
                expect.fail(null, null, EXPECTED_EXCEPTION);
            } catch(err) {
                expect(err.name).to.containIgnoreCase('invalidkey');
            }
        });

        it('should import keypair with a valid parameter', async () => {
            // Arrange
            let keyName = TEST_KEY_NAME;
            let publicKeyMaterial = TEST_PUBLIC_KEY_MATERIAL;
            try { await keyPairStore.deleteKeyPair(keyName); } catch(err) { /* ignore */ }

            // Act
            let result = await keyPairStore.importKeyPair(keyName, publicKeyMaterial);

            // Assert
            expect(result).to.be.an('object');
            expect(result.KeyFingerprint).to.not.be.null;
        });

        it('should throw an exception when imported key pair already exists', async () => {
            // Arrange
            let keyName = TEST_KEY_NAME;
            let publicKeyMaterial = TEST_PUBLIC_KEY_MATERIAL;

             // Act and Assert
             try {
                await keyPairStore.importKeyPair(keyName, publicKeyMaterial);
                expect.fail(null, null, EXPECTED_EXCEPTION);
            } catch(err) {
                expect(err.name).to.containIgnoreCase('duplicate');
            }
        });
    });

    describe('createKeyPair()', () => {
        it('should create key pair with keyName specified', async () => {
            // Arrange
            let keyName = TEST_KEY_NAME;
            try { await keyPairStore.deleteKeyPair(keyName); } catch(err) { /* ignore */ }

            // Act
            let result = await keyPairStore.createKeyPair(keyName);

            // Assert
            expect(result).to.not.be.null;
        });
    });

    describe('deleteKeyPair()', () => {
        it('should delete key pair with keyName specified', async () => {
            // Arrange
            let keyName = TEST_KEY_NAME;

            // Act
            let result = await keyPairStore.deleteKeyPair(keyName);

            // Assert
            expect(result).to.not.be.null;
        });
    });
});

