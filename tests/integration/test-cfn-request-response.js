'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
chai.use(require("chai-as-promised"));
const expect = chai.expect;

const cfnResponse = require('../../lib/aws/cfn-resource-response');

var TEST_EVENT = {
    ResourceType: 'Custom::Type',
    RequestType: 'Create',
    StackId : 'arn:aws:cloudformation:us-west-2:123456789012:stack/stack-name/guid',
    RequestId : '1234',
    LogicalResourceId : 'LogicalResourceId1234',
};

const TEST_CONTEXT = {
    logStreamName: 'test-cfn-request-response-logstream'
};

describe('cfn-request-response', () => {
    describe('sendResponse()', () => {
        it('should be rejected when ResponseURL is invalid', () => {
            // Arrange
            TEST_EVENT.ResponseURL = 'http://127.0.0.1:23456';

            // Act and Assert
            return expect(cfnResponse.sendResponse(TEST_EVENT, TEST_CONTEXT, 'SUCCESS', { ID: '1234567890' }, true))
                .to.eventually.be.rejectedWith(Error).with.property('message').contains('ECONNREFUSED');
        });

        it('should return response from when ResponseURL is valid', async () => {
            // Arrange
            TEST_EVENT.ResponseURL = 'https://httpbin.org/xml';

            // Act
            let result = await cfnResponse.sendResponse(TEST_EVENT, TEST_CONTEXT, 'SUCCESS', { ID: '1234567890' }, true);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('SUCCESS');
            expect(result.CfnResponse).to.not.be.null;
        });
    });
});