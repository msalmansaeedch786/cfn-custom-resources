'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));

const { FAILED, SUCCESS, NOT_CREATED } =require('../../lib/aws/constants');
const lambda = require('../../index');
const LogGroupSubscriptionProvider = require('../../providers/loggroup-subscription-provider');
const logGroupSubscriptionProvider = new LogGroupSubscriptionProvider({ info: function() { /* ignore */ } });

const LAMBDA_DESTINATION_ARN = 'arn:aws:lambda:us-east-1:431919702679:function:CloudWatchLogsHandler-dev';
const KINESIS_DESTINATION_ARN = 'arn:aws:kinesis:us-east-1:431919702679:stream/NorthBayLabsTesting';
const BAD_DESTINATION_ARN = 'arn:aws:sms:us-east-1:123456789012:stream/NorthBayLabsTesting';

const LOG_GROUP_NAME = '/aws/lambda/SimpleLambdaFunction-dev';
const FILTER_NAME = 'StreamLogsFromCloudWatch';
const FILTER_PATTERN = '?ERROR ?WARN';
const ROLE_ARN = 'arn:aws:iam::431919702679:role/CWLtoKinesisRole';
const DISTRIBUTION = 'Random';
const MISSING_PROPERTIES = 'missing properties';
const LAMBDA_FILTER_NAME = 'LambdaStream_CloudWatchLogsHandler-dev';
const KINESIS_FILTER_NAME = 'KinesisStream_NorthBayLabsTesting';

const TEST_EVENT = {
    ResponseURL: 'https://httpbin.org/put',
    StackId: 'arn:aws:cloudformation:us-east-1:123456789012:fake-stack/fake-stack-id-for-testing',
    RequestId: '1234',
    ResourceType: LogGroupSubscriptionProvider.RESOURCE_TYPE,
    LogicalResourceId: 'LogicalResourceId1234',
    ResourceProperties: {
        LogGroupName: LOG_GROUP_NAME,
        FilterPattern: FILTER_PATTERN,
        DestinationArn: LAMBDA_DESTINATION_ARN,
    },
    OldResourceProperties: {
    }
};

const TEST_CONTEXT = {
    logStreamName: 'loggroup-subscription-logstream',
    done: function () { },
    getRemainingTimeInMillis: function () { return 60000; }
};


describe('LogGroupSubscriptionProvider', () => {

    describe('deleteSubscriptionFilter()', () => {
        it('should delete test LogGroupSubscription resources pre-test', async () => {
            try { await logGroupSubscriptionProvider.deleteSubscriptionFilter(LOG_GROUP_NAME, FILTER_NAME); } catch(err) { /* ignore */ }
            try { await logGroupSubscriptionProvider.deleteSubscriptionFilter(LOG_GROUP_NAME, LAMBDA_FILTER_NAME); } catch(err) {   /* ignore */ }
            try { await logGroupSubscriptionProvider.deleteSubscriptionFilter(LOG_GROUP_NAME, KINESIS_FILTER_NAME); } catch(err) { /* ignore */ }
        }).timeout(8000);
    });

    describe('Create()', () => {
        it('should return FAILED when given invalid DestinationArn', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.ResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.ResourceProperties.DestinationArn = 'arn:aws:kinesis:us-east-7:123456789012:stream/NorthBayLabsTesting';
            TEST_EVENT.ResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.ResourceProperties.Distribution = DISTRIBUTION;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('InvalidParameterException');
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS when given complete and valid ResourceProperties', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.DestinationArn = LAMBDA_DESTINATION_ARN;
            TEST_EVENT.ResourceProperties.FilterName = undefined;
            TEST_EVENT.ResourceProperties.RoleArn = undefined;
            TEST_EVENT.ResourceProperties.FilterPattern = undefined;
            TEST_EVENT.ResourceProperties.Distribution = undefined;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.PhysicalResourceId).to.contain(TEST_EVENT.ResourceProperties.LogGroupName);
            expect(result.PhysicalResourceId).to.contain(':LambdaStream_');
            expect(result.Data.LogGroupName).to.equal(TEST_EVENT.ResourceProperties.LogGroupName);
            expect(result.Data.FilterName).to.contain('LambdaStream_');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS when calling Create with ForceSubscription true and an existing subscription filter', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.FilterName = undefined;
            TEST_EVENT.ResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.ResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.ResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.ResourceProperties.ForceSubscription = true;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.PhysicalResourceId).to.contain(TEST_EVENT.ResourceProperties.LogGroupName);
            expect(result.PhysicalResourceId).to.contain('KinesisStream_');
            expect(result.Data.LogGroupName).to.equal(TEST_EVENT.ResourceProperties.LogGroupName);
            expect(result.Data.FilterName).to.contain('KinesisStream_');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS when calling Create with ForceSubscription true and an existing subscription filter', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.ResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.ResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.ResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.ResourceProperties.ForceSubscription = true;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.PhysicalResourceId).to.contain(TEST_EVENT.ResourceProperties.LogGroupName);
            expect(result.PhysicalResourceId).to.contain(FILTER_NAME);
            expect(result.Data.LogGroupName).to.equal(TEST_EVENT.ResourceProperties.LogGroupName);
            expect(result.Data.FilterName).to.equal(FILTER_NAME);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED status when called with FilterName undefined and a bad DestinationArn', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.DestinationArn = BAD_DESTINATION_ARN;
            TEST_EVENT.ResourceProperties.FilterName = undefined;
            TEST_EVENT.ResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.ResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.ResourceProperties.ForceSubscription = false;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.contain('InvalidDestinationArn');
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED when calling Create with ForceSubscription false and an existing subscription filter', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.ResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.ResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.ResourceProperties.ForceSubscription = false;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('Cannot overwrite existing subscription filter');
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED when given missing DestinationArn', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.ResourceProperties.DestinationArn = null;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.be.not.null;
            expect(result.Reason).to.containIgnoreCase(MISSING_PROPERTIES);
            expect(result.Reason).to.contain('DestinationArn');
            expect(result.CfnResponse).to.be.an('object');
        });

        it('should return FAILED when given invalid LogGroupName', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties = {
                LogGroupName: 'Invalid@Name',
                FilterName: FILTER_NAME,
                FilterPattern: FILTER_PATTERN,
                DestinationArn: LAMBDA_DESTINATION_ARN,
            };

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.be.not.null;
            expect(result.Reason).to.containIgnoreCase('invalid properties');
            expect(result.Reason).to.containIgnoreCase('LogGroupName');
            expect(result.CfnResponse).to.be.an('object');
        });

        it('should return FAILED when given invalid DestinationArn', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';
            TEST_EVENT.ResourceProperties.DestinationArn = 'InvalidDestinationArn';

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.be.not.null;
            expect(result.Reason).to.containIgnoreCase('invalid properties');
            expect(result.Reason).to.containIgnoreCase('DestinationArn');
            expect(result.CfnResponse).to.be.an('object');
        });
    });

    describe('Update()', () => {
        it('should return SUCCESS status when with no property changes', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.ForceSubscription = true;
            TEST_EVENT.ResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.ResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.ResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.ResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.ResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.ResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.OldResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.OldResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.OldResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.OldResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.OldResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.OldResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.PhysicalResourceId = LOG_GROUP_NAME + ':' + FILTER_NAME;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('Ignoring Update request');
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.PhysicalResourceId);
            expect(result.Data.LogGroupName).to.equal(TEST_EVENT.ResourceProperties.LogGroupName);
            expect(result.Data.FilterName).to.equal(FILTER_NAME);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS when with FilterName and LogGroupName changed, and PhysicalResourceId set to resource-not-created', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.ForceSubscription = true;
            TEST_EVENT.ResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.ResourceProperties.FilterName = undefined;
            TEST_EVENT.ResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.ResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.ResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.ResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.OldResourceProperties.LogGroupName = undefined;
            TEST_EVENT.OldResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.OldResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.OldResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.OldResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.OldResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.PhysicalResourceId = NOT_CREATED;
            try { await logGroupSubscriptionProvider.deleteSubscriptionFilter(LOG_GROUP_NAME, FILTER_NAME); } catch(err) { /* ignore */ }

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('Updated properties');
            expect(result.Reason).to.containIgnoreCase('FilterName');
            expect(result.Reason).to.containIgnoreCase('LogGroupName');
            expect(result.PhysicalResourceId).to.contain(LOG_GROUP_NAME);
            expect(result.PhysicalResourceId).to.contain(KINESIS_FILTER_NAME);
            expect(result.Data.LogGroupName).to.equal(LOG_GROUP_NAME);
            expect(result.Data.FilterName).to.equal(KINESIS_FILTER_NAME);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS status when with no property changes and PhysicalResourceId set to resource-not-created', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.ForceSubscription = true;
            TEST_EVENT.ResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.ResourceProperties.FilterName = LAMBDA_FILTER_NAME;
            TEST_EVENT.ResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.ResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.ResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.ResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.OldResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.OldResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.OldResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.OldResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.OldResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.OldResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.PhysicalResourceId = NOT_CREATED;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('Updated properties');
            expect(result.Reason).to.containIgnoreCase('[FilterName]');
            expect(result.PhysicalResourceId).to.contain(LOG_GROUP_NAME);
            expect(result.PhysicalResourceId).to.contain(LAMBDA_FILTER_NAME);
            expect(result.Data.LogGroupName).to.equal(LOG_GROUP_NAME);
            expect(result.Data.FilterName).to.equal(LAMBDA_FILTER_NAME);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS when all properties except LogGroupName and FilterName have been changed', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.ForceSubscription = false;
            TEST_EVENT.ResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.ResourceProperties.FilterName = LAMBDA_FILTER_NAME;
            TEST_EVENT.ResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.ResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.ResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.ResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.OldResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.OldResourceProperties.FilterName = LAMBDA_FILTER_NAME;
            TEST_EVENT.OldResourceProperties.FilterPattern = null;
            TEST_EVENT.OldResourceProperties.DestinationArn = null;
            TEST_EVENT.OldResourceProperties.RoleArn = null;
            TEST_EVENT.OldResourceProperties.Distribution = null;
            TEST_EVENT.PhysicalResourceId = LOG_GROUP_NAME + ':' + LAMBDA_FILTER_NAME;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.PhysicalResourceId);
            expect(result.Data.LogGroupName).to.equal(LOG_GROUP_NAME);
            expect(result.Data.FilterName).to.equal(LAMBDA_FILTER_NAME);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED status when with no property changes and an invalid PhysicalResourceId', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.ForceSubscription = true;
            TEST_EVENT.ResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.ResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.ResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.ResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.ResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.ResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.OldResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.OldResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.OldResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.OldResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.OldResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.OldResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.PhysicalResourceId = LOG_GROUP_NAME + '||' + FILTER_NAME;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('InvalidPhysicalResourceId');
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.PhysicalResourceId);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED when only FilterName has changed', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.ForceSubscription = false;
            TEST_EVENT.ResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.ResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.ResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.ResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.ResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.ResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.OldResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.OldResourceProperties.FilterName = LAMBDA_FILTER_NAME;
            TEST_EVENT.OldResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.OldResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.OldResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.OldResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.PhysicalResourceId = LOG_GROUP_NAME + ':' + LAMBDA_FILTER_NAME;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('Cannot update read-only properties');
            expect(result.Reason).to.contain('FilterName');
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.PhysicalResourceId);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED when only LogGroupName has changed', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.ForceSubscription = false;
            TEST_EVENT.ResourceProperties.LogGroupName = '/aws/lambda/ThisFunctionDoesNotExist';
            TEST_EVENT.ResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.ResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.ResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.ResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.ResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.OldResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.OldResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.OldResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.OldResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.OldResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.OldResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.PhysicalResourceId = LOG_GROUP_NAME + ':' + FILTER_NAME;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('Cannot update read-only properties');
            expect(result.Reason).to.contain('LogGroupName');
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.PhysicalResourceId);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED when PhysicalResourceId does not match the current subscription filter', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';
            TEST_EVENT.ResourceProperties.ForceSubscription = false;
            TEST_EVENT.ResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.ResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.ResourceProperties.FilterPattern = FILTER_PATTERN;
            TEST_EVENT.ResourceProperties.DestinationArn = KINESIS_DESTINATION_ARN;
            TEST_EVENT.ResourceProperties.RoleArn = ROLE_ARN;
            TEST_EVENT.ResourceProperties.Distribution = DISTRIBUTION;
            TEST_EVENT.OldResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.OldResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.OldResourceProperties.FilterPattern = null;
            TEST_EVENT.OldResourceProperties.DestinationArn = null;
            TEST_EVENT.OldResourceProperties.RoleArn = null;
            TEST_EVENT.OldResourceProperties.Distribution = null;
            TEST_EVENT.PhysicalResourceId = LOG_GROUP_NAME + ':MisMatchFilterName';

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.containIgnoreCase('FilterName mismatch');
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.PhysicalResourceId);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);
    });

    describe('Delete()', () => {
        it('should return FAILED when the PhysicalResourceId does not match the existing subscription filter', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.ResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.PhysicalResourceId = LOG_GROUP_NAME + ':MisMatchFilterName';

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.be.not.null;
            expect(result.Reason).to.contain('FilterName mismatch');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS when given complete and valid ResourceProperties', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.FilterName = LAMBDA_FILTER_NAME;
            TEST_EVENT.ResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.PhysicalResourceId = LOG_GROUP_NAME + ':' + LAMBDA_FILTER_NAME;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Data.LogGroupName).to.equal(TEST_EVENT.ResourceProperties.LogGroupName);
            expect(result.Data.FilterName).to.equal(TEST_EVENT.ResourceProperties.FilterName);
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.PhysicalResourceId);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS when called with a deleted subscription filter', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.FilterName = LAMBDA_FILTER_NAME;
            TEST_EVENT.ResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.PhysicalResourceId = LOG_GROUP_NAME + ':' + LAMBDA_FILTER_NAME;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('Missing subscription filter');
            expect(result.Data.LogGroupName).to.equal(TEST_EVENT.ResourceProperties.LogGroupName);
            expect(result.Data.FilterName).to.equal(TEST_EVENT.ResourceProperties.FilterName);
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.PhysicalResourceId);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return SUCCESS when PhysicalResourceId is set to resource-not-created', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.ResourceProperties.LogGroupName = LOG_GROUP_NAME;
            TEST_EVENT.PhysicalResourceId = NOT_CREATED;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(SUCCESS);
            expect(result.Reason).to.containIgnoreCase('Resource not created');
            expect(result.PhysicalResourceId).to.equal(NOT_CREATED);
            expect(result.Data.LogGroupName).to.equal(TEST_EVENT.ResourceProperties.LogGroupName);
            expect(result.Data.FilterName).to.equal(FILTER_NAME);
            expect(result.PhysicalResourceId).to.equal(TEST_EVENT.PhysicalResourceId);
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);

        it('should return FAILED when given non existent LogGroupName', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';
            TEST_EVENT.ResourceProperties.FilterName = FILTER_NAME;
            TEST_EVENT.ResourceProperties.LogGroupName = '/aws/lambda/ThisFunctionDoesNotExist';
            TEST_EVENT.PhysicalResourceId = '/aws/lambda/ThisFunctionDoesNotExist:' + FILTER_NAME;

            // Act
            let result = await lambda.handler(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal(FAILED);
            expect(result.Reason).to.be.not.null;
            expect(result.Reason).to.containIgnoreCase('log group does not exist');
            expect(result.CfnResponse).to.be.an('object');
        }).timeout(6000);
    });
});