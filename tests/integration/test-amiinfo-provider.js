'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));

var lambda = require('../../index');
const AmiInfoProvider = require('../../providers/amiinfo-provider');

var TEST_EVENT = {
    ResponseURL : 'https://httpbin.org/put',
    StackId : 'arn:aws:cloudformation:us-east-1:123456789012:stack/stack-name/guid',
    RequestId : '1234',
    ResourceType : AmiInfoProvider.RESOURCE_TYPE,
    LogicalResourceId : 'LogicalResourceId1234',
    ResourceProperties : {
        Region: 'us-east-1',
        Architecture: 'HVM'
    }
};

const HVM_GPU = 'HVM_GPU';

const TEST_CONTEXT = {
    logStreamName: 'key-pair-logstream',
    done: function() {},
    getRemainingTimeInMillis: function() { return 60000; }
};

describe('AmiInfoProvider', () => {
    describe('Create()', () => {
        it('should return SUCCESS status and Id when called with HVM architecture',  async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Architecture = 'HVM';

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('SUCCESS');
            expect(result.Data.Id).to.startWith('ami-');
            expect(result.PhysicalResourceId).to.equal(result.Data.Id);
            expect(result.CfnResponse).to.be.an('object');
        });

        it('should return SUCCESS status and Id called with HVM_GPU architecture', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Architecture = HVM_GPU;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('SUCCESS');
            expect(result.Data.Id).to.startWith('ami-');
            expect(result.PhysicalResourceId).to.equal(result.Data.Id);
            expect(result.CfnResponse).to.be.an('object');
        });

        it('should return SUCCESS status and Id when called with HVM_GPU architecture and linux version', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Architecture = HVM_GPU;
            TEST_EVENT.ResourceProperties.LinuxVersion = 'Linux';

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('SUCCESS');
            expect(result.Data.Id).to.startWith('ami-');
            expect(result.PhysicalResourceId).to.equal(result.Data.Id);
            expect(result.CfnResponse).to.be.an('object');
        });

        it('should return SUCCESS status and Id when called with valid instance type', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Architecture = null;
            TEST_EVENT.ResourceProperties.InstanceType = 'm5.xlarge';
            TEST_EVENT.ResourceProperties.LinuxVersion = 'Linux2';

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('SUCCESS');
            expect(result.Data.Id).to.startWith('ami-');
            expect(result.PhysicalResourceId).to.equal(result.Data.Id);
            expect(result.CfnResponse).to.be.an('object');
        });

        it('should return SUCCESS status and Id when called with valid instance type and Linux version', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Architecture = null;
            TEST_EVENT.ResourceProperties.InstanceType = 't3.small';
            TEST_EVENT.ResourceProperties.LinuxVersion = 'Linux';

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('SUCCESS');
            expect(result.Data.Id).to.startWith('ami-');
            expect(result.PhysicalResourceId).to.equal(result.Data.Id);
            expect(result.CfnResponse).to.be.an('object');
        });

        it('should return SUCCESS status and different AMI Ids for different regions', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Region = 'us-east-1';
            TEST_EVENT.ResourceProperties.Architecture = HVM_GPU;
            TEST_EVENT.ResourceProperties.InstanceType = null;
            TEST_EVENT.ResourceProperties.LinuxVersion = null;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('SUCCESS');
            expect(result.Data.Id).to.startWith('ami-');
            expect(result.PhysicalResourceId).to.equal(result.Data.Id);
            expect(result.CfnResponse).to.be.an('object');

            // Arrange
            TEST_EVENT.ResourceProperties.Region = 'us-west-1'; /* eslint-disable-line require-atomic-updates */

            // Act
            var result1 = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result1).to.be.an('object');
            expect(result1.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result1.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result1.Status).to.equal('SUCCESS');
            expect(result1.Data.Id).to.startWith('ami-');
            expect(result.PhysicalResourceId).to.equal(result.Data.Id);
            expect(result.Data.Id).to.not.equal(result1.Data.Id);
        });

        it('should return SUCCESS status and Id with HVM architecture and non-json response',  async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResponseURL = 'https://cfn-custom-resources.requestcatcher.com/';

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('SUCCESS');
            expect(result.Data.Id).to.startWith('ami-');
            expect(result.PhysicalResourceId).to.equal(result.Data.Id);
            expect(result.CfnResponse).to.not.be.an('object');
        });

        it('should return FAILED status and Id with me-south-1',  async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResponseURL = 'https://cfn-custom-resources.requestcatcher.com/';
            TEST_EVENT.ResourceProperties.Region = 'me-south-1';

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('FAILED');
            expect(result.Reason).to.be.a('string');
        });


        it('should return FAILED status and missing properties message when called without a region', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Region = null;
            TEST_EVENT.ResourceProperties.Architecture = 'HVM';
            TEST_EVENT.ResourceProperties.InstanceType = null;
            TEST_EVENT.ResourceProperties.LinuxVersion = 'Linux2';
            TEST_EVENT.ResponseURL = 'https://httpbin.org/put';

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('FAILED');
            expect(result.Reason).to.containIgnoreCase('missing');
            expect(result.Reason).to.containIgnoreCase('region');
            expect(result.Reason).to.not.containIgnoreCase('architecture');
        });

        it('should return FAILED status and missing properties message when called with null properties', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Region = null;
            TEST_EVENT.ResourceProperties.Architecture = null;
            TEST_EVENT.ResourceProperties.InstanceType = null;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('FAILED');
            expect(result.Reason).to.containIgnoreCase('missing');
            expect(result.Reason).to.containIgnoreCase('region');
            expect(result.Reason).to.containIgnoreCase('architecture');
            expect(result.Reason).to.containIgnoreCase('instancetype');
        });

        it('should return FAILED status and unsupported message when called with invalid architecture', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Region = 'us-east-1';
            TEST_EVENT.ResourceProperties.Architecture = 'UNSUPPORTED';
            TEST_EVENT.ResourceProperties.InstanceType = null;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('FAILED');
            expect(result.Reason).to.containIgnoreCase('unsupported');
            expect(result.Reason).to.containIgnoreCase('architecture');
        });

        it('should return FAILED status and unsupported message when called with invalid instance type', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Region = 'us-east-1';
            TEST_EVENT.ResourceProperties.Architecture = null;
            TEST_EVENT.ResourceProperties.InstanceType = 'xyz.huge';

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('FAILED');
            expect(result.Reason).to.containIgnoreCase('unsupported');
            expect(result.Reason).to.containIgnoreCase('instancetype');
        });

        it('should return FAILED status and invalid message when called with invalid Linux version', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Region = 'us-east-1';
            TEST_EVENT.ResourceProperties.Architecture = 'HVM';
            TEST_EVENT.ResourceProperties.InstanceType = null;
            TEST_EVENT.ResourceProperties.LinuxVersion = 'LinuxIsAwesome';

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('FAILED');
            expect(result.Reason).to.containIgnoreCase('invalid');
            expect(result.Reason).to.containIgnoreCase('linuxversion');
        });

        it('should return FAILED status and error message when called with invalid region', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.Region = 'us-east-123';
            TEST_EVENT.ResourceProperties.Architecture = 'HVM';
            TEST_EVENT.ResourceProperties.InstanceType = null;
            TEST_EVENT.ResourceProperties.LinuxVersion = null;

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('FAILED');
            expect(result.Reason).to.be.a('string');
        });
    });

    describe('Update()', () => {
        it('should return SUCCESS status when called with valid ResourceProperties', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.Region = 'us-east-1';
            TEST_EVENT.ResourceProperties.Architecture = 'HVM';

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('SUCCESS');
            expect(result.Data.Id).to.startWith('ami-');
            expect(result.PhysicalResourceId).to.equal(result.Data.Id);
            expect(result.CfnResponse).to.be.an('object');
        });
    });

    describe('Delete()', () => {
        it('should return SUCCESS when Delete() is called', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';

            // Act
            var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('SUCCESS');
            expect(result.CfnResponse).to.be.an('object');
        });
    });
});
