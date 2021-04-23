'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));

const lambda = require('../../index');
const AmiInfoProvider = require('../../providers/amiinfo-provider');

var TEST_EVENT = {
    ResponseURL : 'https://httpbin.org/put',
    StackId : 'arn:aws:cloudformation:us-west-2:123456789012:stack/stack-name/guid',
    RequestId : '1234',
    LogicalResourceId : 'LogicalResourceId1234',
    ResourceProperties : {
        Region: 'us-east-1',
        Architecture: 'HVM64'
    }
};

const TEST_CONTEXT = {
    logStreamName: 'test-handler-logstream',
};

describe('index.handler()', () => {
    it('should return FAILED status and invalid RequestType when called with an invalid RequestType', async () => {
        // Arrange
        TEST_EVENT.ResourceType =  AmiInfoProvider.RESOURCE_TYPE;
        TEST_EVENT.RequestType = 'Get';

        // Act
        var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

        // Assert
        expect(result).to.be.an('object');
        expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
        expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
        expect(result.Status).to.equal('FAILED');
        expect(result.Reason).to.containIgnoreCase('Invalid RequestType');
    });

    it('should return FAILED status and unsupported ResourceType when called with an invalid ResourceType', async () => {
        // Arrange
        TEST_EVENT.ResourceType = 'Custom::UnsupportedResource';
        TEST_EVENT.RequestType = 'Create';

        // Act
        var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

        // Assert
        expect(result).to.be.an('object');
        expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
        expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
        expect(result.Status).to.equal('FAILED');
        expect(result.Reason).to.containIgnoreCase('Unsupported ResourceType');
    });

    it('should return FAILED status when called with ResourceProperties being undefined', async () => {
        // Arrange
        TEST_EVENT.ResourceProperties = undefined;
        TEST_EVENT.ResourceType =  AmiInfoProvider.RESOURCE_TYPE;
        TEST_EVENT.RequestType = 'Create';

        // Act
        var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

        // Assert
        expect(result).to.be.an('object');
        expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
        expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
        expect(result.Status).to.equal('FAILED');
        expect(result.Reason).to.containIgnoreCase('ResourceProperties is missing');
    });

    it('should return SUCCESS status with a function timeout set',  async () => {
        // Arrange
        TEST_EVENT.ResourceType =  AmiInfoProvider.RESOURCE_TYPE;
        TEST_EVENT.RequestType = 'Create';
        TEST_EVENT.ResourceProperties = { Architecture: 'HVM', Region: 'us-east-1' };
        TEST_CONTEXT.getRemainingTimeInMillis = function() { return 60000; };
        const callback = (err) => {
            console.log(err);
        };

        // Act
        var result = await lambda.handler(TEST_EVENT, TEST_CONTEXT, callback);

        // Assert
        expect(result).to.be.an('object');
        expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
        expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
        expect(result.Status).to.equal('SUCCESS');
        expect(result.Data.Id).to.startWith('ami-');
        expect(result.CfnResponse).to.be.an('object');
    });
});
