'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));

const DEFAULT_VALUE = 'a-default-value';
const DEFAULT_BOOLEAN_VALUE = true;
const DEFAULT_NUMBER_VALUE = 123456;

const TEST_RESOURCE_SCHEMA = [
    { Name: 'Architecture', Required: { Create: true, Update: true }, Alternates: ['InstanceType'] },
    { Name: 'InstanceType', Required: { Create: true, Update: true }, Alternates: ['Architecture'] },
    { Name: 'LinuxVersion', Required: false, AllowedPattern: '^(Linux|Linux2)$' },
    { Name: 'SecretPath',   Required: false, AllowedPattern: '^/[a-zA-Z0-9_\\.\\-/]+$' },
    { Name: 'Region',       Required: true }
];

const TEST_RESOURCE_SCHEMA_TYPES = [
    { Name: 'NumberProp',   Required: true,  Type: 'number' },
    { Name: 'BooleanProp',  Required: true,  Type: 'boolean' },
    { Name: 'ObjectProp',   Required: true,  Type: 'object' },
    { Name: 'WithDefaultString',  Required: false, Type: 'string',  Default: DEFAULT_VALUE },
    { Name: 'WithDefaultBoolean', Required: false, Type: 'boolean', Default:  DEFAULT_BOOLEAN_VALUE },
    { Name: 'WithDefaultNumber',  Required: false, Type: 'number',  Default: DEFAULT_NUMBER_VALUE }
];

let TEST_EVENT = {
    ResponseURL: 'https://example.com/pre-signed-S3-url-for-response',
    StackId: 'arn:aws:cloudformation:us-west-2:123456789012:stack/stack-name/guid',
    RequestId: '1234',
    ResourceType: 'Custom::CustomResource',
    LogicalResourceId: 'LogicalResourceId1234',
    ResourceProperties: {
        DryRun: true,
        Name: 'TestCustomResourceName'
    }
};

let TEST_CONTEXT = {
    logStreamName: 'key-pair-custom=resource',
};

const CustomResourceProvider = require('../../providers/custom-resource-provider');
const customResourceProvider = new CustomResourceProvider('Custom::Resource', TEST_RESOURCE_SCHEMA);
const typesSchemaCustomResourceProvider = new CustomResourceProvider('Custom::Resource', TEST_RESOURCE_SCHEMA_TYPES);
const noSchemaCustomResourceProvider = new CustomResourceProvider('Custom::NoSchema', null);

describe('CustomResourceProvider', () => {
    describe('validateProperties()', () => {

        it('should validate when called with a valid property that must start with a slash', () => {
            // Arrange
            let properties = {
                Region: 'us-east-1',
                SecretPath: '/iam-a-validpath/level1/'
            };

            // Act and Assert
            expect(() => { customResourceProvider.validateProperties(properties, 'Delete'); }).to.not.throw(Error);
        });

        it('should validate when called with valid properties', () => {
            // Arrange
            let properties = {
                Architecture: null,
                InstanceType: 't3.small',
                LinuxVersion: 'Linux',
                Region: 'us-east-1'
            };

            // Act and Assert
            expect(() => { customResourceProvider.validateProperties(properties, 'Create'); }).to.not.throw(Error);
        });

        it('should validate when called with a required property with a value of 0', () => {
            // Arrange
            let properties = {
                NumberProp: 0,
                BooleanProp: true,
                ObjectProp: { s: 'str' }
            };

            // Act and Assert
            expect(() => { typesSchemaCustomResourceProvider.validateProperties(properties, 'Update'); }).to.not.throw(Error);
        });

        it('should validate when called with a required property with a value of false', () => {
            // Arrange
            let properties = {
                NumberProp: 1,
                BooleanProp: false,
                ObjectProp: { s: 'str' }
            };

            // Act and Assert
            expect(() => { typesSchemaCustomResourceProvider.validateProperties(properties, 'Update'); }).to.not.throw(Error);
        });

        it('should validate when called with a required property with a value of {}', () => {
            // Arrange
            let properties = {
                NumberProp: 1,
                BooleanProp: true,
                ObjectProp: {}
            };

            // Act and Assert
            expect(() => { typesSchemaCustomResourceProvider.validateProperties(properties, 'Update'); }).to.not.throw(Error);
        });

        it('should validate when called with a required property with a value of {}', () => {
            // Arrange
            let properties = {
                NumberProp: 1,
                BooleanProp: true,
                ObjectProp: {}
            };

            // Act and Assert
            expect(() => { typesSchemaCustomResourceProvider.validateProperties(properties, 'Update'); }).to.not.throw(Error);
        });

        it('should validate when custom resource has no property schema', () => {
            // Arrange
            let properties = {
                Architecture: null,
                InstanceType: 't3.small',
                LinuxVersion: 'Linux',
                Region: 'us-east-1'
            };

            // Act and Assert
            expect(() => { noSchemaCustomResourceProvider.validateProperties(properties, 'Create'); }).to.not.throw(Error);
        });

        it('should validate when called with a valid property that must start with a slash', () => {
            // Arrange
            let properties = {
                Region: 'us-east-1',
                SecretPath: '/iam-a-validpath/level1/'
            };

            // Act and Assert
            expect(() => { customResourceProvider.validateProperties(properties, 'Delete'); }).to.not.throw(Error);
        });

        it('should validate when called with missing properties that are not required for method', () => {
            // Arrange
            let properties = {
                Architecture: null,
                InstanceType: null,
                LinuxVersion: null,
                Region: 'us-east-1'
            };

            // Act and Assert
            expect(() => { customResourceProvider.validateProperties(properties, 'Delete'); }).to.not.throw(Error);
        });

        it('should validate when called with a valid property that must start with a slash', () => {
            // Arrange
            let properties = {
                Region: 'us-east-1',
                SecretPath: '/iam-a-validpath/level1/'
            };

            // Act and Assert
            expect(() => { customResourceProvider.validateProperties(properties, 'Delete'); }).to.not.throw(Error);
        });

        it('should validate and return default values when properties with defaults are not set', () => {
            // Arrange
            let properties = {
                NumberProp: 1,
                BooleanProp: true,
                ObjectProp: {},
                WithDefaultString: null,
                WithDefaultBoolean: undefined,
                WithDefaultNumber: undefined
            };

            // Act and Assert
            expect(() => { typesSchemaCustomResourceProvider.validateProperties(properties, 'Delete'); }).to.not.throw(Error);
            expect(properties.WithDefaultString).to.equal(DEFAULT_VALUE);
            expect(properties.WithDefaultBoolean).to.equal(DEFAULT_BOOLEAN_VALUE);
            expect(properties.WithDefaultNumber).to.equal(DEFAULT_NUMBER_VALUE);
        });

        it('should validate and not overwrite a properties with a default value that is set', () => {
            // Arrange
            let properties = {
                NumberProp: 1,
                BooleanProp: true,
                ObjectProp: {},
                WithDefaultString: 'I-have-a-value',
                WithDefaultBoolean: 'false',
                WithDefaultNumber: 9876543210
            };

            // Act and Assert
            expect(() => { typesSchemaCustomResourceProvider.validateProperties(properties, 'Delete'); }).to.not.throw(Error);
            expect(properties.WithDefaultString).to.equal('I-have-a-value');
            expect(properties.WithDefaultBoolean).to.equal(false);
            expect(properties.WithDefaultNumber).to.equal(9876543210);
        });

        it('should throw Error when called with a property that must start with a slash but does not', () => {
            // Arrange
            let properties = {
                Region: 'us-east-1',
                SecretPath: 'iam-not-a-validpath/level1/'
            };

             // Act and Assert
             expect(() => { customResourceProvider.validateProperties(properties, 'Delete'); }).to.throw(Error)
                .that.has.property('message').that.containIgnoreCase('invalid')
                .and.not.containIgnoreCase('missing');
        });

        it('should throw Error when called with invalid property value', () => {
            // Arrange
            let properties = {
                Architecture: null,
                InstanceType: 't3.small',
                LinuxVersion: 'Linux3', // Invalid value
                Region: 'us-east-1'
            };

            // Act and Assert
            expect(() => { customResourceProvider.validateProperties(properties, 'Create'); }).to.throw(Error)
                .that.has.property('message').that.containIgnoreCase('invalid')
                .and.not.containIgnoreCase('missing');
        });

        it('should throw Error when called with missing property value', () => {
            // Arrange
            let properties = {
                Architecture: null,
                InstanceType: 't3.small',
                Region: null  // Missing property
            };

            // Act and Assert
            expect(() => { customResourceProvider.validateProperties(properties, 'Create'); }).to.throw(Error)
                .that.has.property('message').that.containIgnoreCase('missing')
                .and.not.containIgnoreCase('invalid');
        });

        it('should throw Error when called with missing and invalid property value', () => {
            // Arrange
            let properties = {
                Architecture: null,
                InstanceType: 't3.small',
                LinuxVersion: 'AmazonLinux', // Invalid property
                Region: null                 // Missing property
            };

            // Act and Assert
            expect(() => { customResourceProvider.validateProperties(properties, 'Create'); }).to.throw(Error)
                .that.has.property('message').that.containIgnoreCase('missing')
                .and.that.containIgnoreCase('invalid');
        });

        it('should throw Error when called with a required property being an empty string', () => {
            // Arrange
            let properties = {
                Architecture: null,
                InstanceType: 't3.small',
                LinuxVersion: 'Linux2',
                Region: '' // Empty property
            };

            // Act and Assert
            expect(() => { customResourceProvider.validateProperties(properties, 'Create'); }).to.throw(Error)
                .that.has.property('message').that.containIgnoreCase('missing')
                .and.not.containIgnoreCase('invalid');
        });

        it('should throw Error when called with a property value of the wrong type', () => {
            // Arrange
            let properties = {
                NumberProp: '123',
                BooleanProp: 'truey',
                ObjectProp: {}
            };

            // Act and Assert
            expect(() => { typesSchemaCustomResourceProvider.validateProperties(properties, 'Create'); }).to.throw(Error)
                .that.has.property('message').that.containIgnoreCase('invalid')
                .and.that.containIgnoreCase('NumberProp')
                .and.that.containIgnoreCase('BooleanProp')
                .and.not.containIgnoreCase('ObjectProp')
                .and.not.containIgnoreCase('missing');
        });

        it('should throw Error when called with missing property value', () => {
            // Arrange
            let properties = {
                BooleanProp: true
            };

            // Act and Assert
            expect(() => { typesSchemaCustomResourceProvider.validateProperties(properties, 'Create'); }).to.throw(Error)
                .that.has.property('message').that.containIgnoreCase('missing')
                .and.that.containIgnoreCase('NumberProp')
                .and.that.containIgnoreCase('ObjectProp')
                .and.not.containIgnoreCase('BooleanProp')
                .and.not.containIgnoreCase('invalid');
        });

        it('should throw Error when called with missing and invalid property value', () => {
            // Arrange
            let properties = {
                NumberProp: '1234',
                BooleanProp: true
            };

            // Act and Assert
            expect(() => { typesSchemaCustomResourceProvider.validateProperties(properties, 'Create'); }).to.throw(Error)
                .that.has.property('message').that.containIgnoreCase('missing')
                .and.that.containIgnoreCase('invalid')
                .and.that.containIgnoreCase('NumberProp')
                .and.that.containIgnoreCase('ObjectProp')
                .and.not.containIgnoreCase('BooleanProp');
        });

        it('should throw Error when called with a required object property being a non-empty string', () => {
            // Arrange
            let properties = {
                NumberProp: 1234,
                BooleanProp: true,
                ObjectProp: 'not-empty'
            };

            // Act and Assert
            expect(() => { typesSchemaCustomResourceProvider.validateProperties(properties, 'Create'); }).to.throw(Error)
                .that.has.property('message').that.containIgnoreCase('invalid')
                .and.that.containIgnoreCase('ObjectProp')
                .and.not.containIgnoreCase('missing')
                .and.not.containIgnoreCase('NumberProp')
                .and.not.containIgnoreCase('BooleanProp');
        });

        it('should throw Error when called with missing properties object', () => {
            // Arrange, Act, and Assert
            expect(() => { customResourceProvider.validateProperties(null, 'Create'); }).to.throw(Error)
                .that.has.property('message').that.containIgnoreCase('missing')
                .and.not.containIgnoreCase('invalid');
        });
    });

    describe('Create()', () =>{
        it('should return FAILED status when Create() is called', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Create';

            // Act
            let result = await customResourceProvider.Create(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('FAILED');
            expect(result.Reason).to.be.a('string');
        });
    });

    describe('Delete()', () =>{
        it('should return FAILED status when Delete() is called', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Delete';

            // Act
            let result = await customResourceProvider.Update(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('FAILED');
            expect(result.Reason).to.be.a('string');
        });
    });

    describe('Update()', () =>{
        it('should return FAILED status when Update() is called', async () => {
            // Arrange
            TEST_EVENT.RequestType = 'Update';

            // Act
            let result = await customResourceProvider.Delete(TEST_EVENT, TEST_CONTEXT);

            // Assert
            expect(result).to.be.an('object');
            expect(result.RequestType).to.equal(TEST_EVENT.RequestType);
            expect(result.ResourceType).to.equal(TEST_EVENT.ResourceType);
            expect(result.Status).to.equal('FAILED');
            expect(result.Reason).to.be.a('string');
        });
    });
});