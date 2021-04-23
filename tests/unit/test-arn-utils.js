'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;

const ArnUtils = require('../../lib/aws/arn-utils');

const TEST_LAMBDA_ARN = 'arn:aws:lambda:us-east-1:123456789012:function:CFNCustomResourcesFunction-dev';
const TEST_SSM_ARN = 'arn:aws:ssm:us-east-1:123456789012:parameter/myParameterName';
const TEST_RESOURCE_ONLY_ARN = 'arn:aws:ssm:us-east-1:123456789012:MyResourceName';
const TEST_NO_REGION_ACCOUNT_ID = 'arn:aws:ssm:::MyResourceName';


describe('arn-utils', () => {
    describe('buildArn()', () => {
        it('should return the correct ARN from the provided info', () => {
            // Arrange
            let referenceArn = TEST_LAMBDA_ARN;
            let service = 'ec2';
            let resourceType = 'key';
            let resource = 'KeyName';

            // Act
            let arn = ArnUtils.buildArn(referenceArn, service, resourceType, resource);
            let result = ArnUtils.parseArn(arn);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Arn).to.equal(arn);
            expect(result.Partition).to.equal('aws');
            expect(result.Service).to.equal(service);
            expect(result.Region).to.equal('us-east-1');
            expect(result.AccountId).to.equal('123456789012');
            expect(result.ResourceType).to.equal(resourceType);
            expect(result.Resource).to.equal(resource);
        });
    });

    describe('parseArn()', () => {
        it('should return a properly parsed ARN object when a valid Lambda ARN is provided', () => {
            // Arrange
            let arn = TEST_LAMBDA_ARN;

            // Act
            let result = ArnUtils.parseArn(arn);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Arn).to.equal(arn);
            expect(result.Partition).to.equal('aws');
            expect(result.Service).to.equal('lambda');
            expect(result.Region).to.equal('us-east-1');
            expect(result.AccountId).to.equal('123456789012');
            expect(result.ResourceType).to.equal('function');
            expect(result.Resource).to.equal('CFNCustomResourcesFunction-dev'); 
        });

        it('should return a properly parsed ARN object when a valid SSM parameter ARN is provided', () => {
            // Arrange
            let arn = TEST_SSM_ARN;

            // Act
            let result = ArnUtils.parseArn(arn);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Arn).to.equal(arn);
            expect(result.Partition).to.equal('aws');
            expect(result.Service).to.equal('ssm');
            expect(result.Region).to.equal('us-east-1');
            expect(result.AccountId).to.equal('123456789012');
            expect(result.ResourceType).to.equal('parameter');
            expect(result.Resource).to.equal('myParameterName');
        });

        it('should return a properly parsed ARN object when a valid resource only ARN is provided', () => {
            // Arrange
            let arn = TEST_RESOURCE_ONLY_ARN;

            // Act
            let result = ArnUtils.parseArn(arn);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Arn).to.equal(arn);
            expect(result.Partition).to.equal('aws');
            expect(result.Service).to.equal('ssm');
            expect(result.Region).to.equal('us-east-1');
            expect(result.AccountId).to.equal('123456789012');
            expect(result.ResourceType).to.be.undefined;
            expect(result.Resource).to.equal('MyResourceName');
        });

        it('should return a properly parsed ARN object when ARN missing region and account ID is provided', () => {
            // Arrange
            let arn = TEST_NO_REGION_ACCOUNT_ID;

            // Act
            let result = ArnUtils.parseArn(arn);

            // Assert
            expect(result).to.be.an('object');
            expect(result.Arn).to.equal(arn);
            expect(result.Partition).to.equal('aws');
            expect(result.Service).to.equal('ssm');
            expect(result.Region).to.equal('');
            expect(result.AccountId).to.equal('');
            expect(result.ResourceType).to.be.undefined;
            expect(result.Resource).to.equal('MyResourceName'); 
        });

        it('should return null when called with an invalid ARN', () => {
            // Arrange
            let arn = '1:2:3:4';

            // Act
            let result = ArnUtils.parseArn(arn);

            // Assert
            expect(result).to.be.null;
        });
    });
});