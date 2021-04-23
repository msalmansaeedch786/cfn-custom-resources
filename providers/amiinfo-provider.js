'use strict';

const AWS = require('aws-sdk');

const CustomResourceProvider = require('./custom-resource-provider');
const architectureLookup = require('./architecture-lookup');
const { AwsPatterns, FAILED, SUCCESS, NOT_CREATED } = require('../lib/aws/constants');

const RESOURCE_TYPE = 'Custom::AMIInfo';
const RESOURCE_SCHEMA = [
    { Name: 'Architecture', Required: { Create: true, Update: true }, Alternates: ['InstanceType'] },
    { Name: 'InstanceType', Required: { Create: true, Update: true }, Alternates: ['Architecture'] },
    { Name: 'LinuxVersion', Required: false, AllowedPattern: AwsPatterns.LINUX_VERSION },
    { Name: 'Region', Required: { Create: true, Update: true }}
];

// Map instance architectures to an Amazon Linux AMI path in the Parameter Store
const ARCH_TO_AMZN_AMI_PATH = new Map([
    ['HVM',     '/aws/service/ami-amazon-linux-latest/amzn-ami-hvm-x86_64-gp2'],
    ['HVM_EBS', '/aws/service/ami-amazon-linux-latest/amzn-ami-hvm-x86_64-ebs'],
    ['PV',      '/aws/service/ami-amazon-linux-latest/amzn-ami-pv-x86_64-ebs'],
    ['MIN_HVM', '/aws/service/ami-amazon-linux-latest/amzn-ami-minimal-hvm-x86_64-ebs'],
    ['MIN_PV',  '/aws/service/ami-amazon-linux-latest/amzn-ami-minimal-pv-x86_64-ebs']
]);

const ARCH_TO_AMZN2_AMI_PATH = new Map([
    ['HVM',     '/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2'],
    ['HVM_ARM', '/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-arm64-gp2'],
    ['HVM_EBS', '/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-ebs'],
    ['MIN_HVM', '/aws/service/ami-amazon-linux-latest/amzn2-ami-minimal-hvm-x86_64-ebs'],
    ['MIN_HVM_ARM', '/aws/service/ami-amazon-linux-latest/amzn2-ami-minimal-hvm-x86_64-ebs']
]);

// Constants for Amazon Linux/Linux2 GPU AMI name patterns for describeImages
const ARCH_TO_AMZN_GPU_AMI_PATTERN = 'amzn-ami-graphics-*-x86_64-ebs*';
const ARCH_TO_AMZN2_GPU_AMI_PATTERN = 'amzn2-ami-graphics-hvm-*-x86_64-gp2*';

/**
 * <p>This class is the implementation for the Custom::AMIInfo custom resource provider.  The custom resource is the
 * AMI ID based on the AWS region and architecture.</p>
 * 
 * ResourceProperties definition:
 * Region: The AWS region to get the AMI ID for
 * Architecture: The architecture to get the AMI ID for
 * InstanceType: The EC2 instance type to get the image for
 * LinuxVersion: 'Linux' or 'Linux2' (defaults to 'Linux2')
 *
 * NOTE: Either Architecture or InstanceType must be provided not both,  This custom resource will look up the
 * Architecture for the provided instance type, if both Architecture and InstanceType are provided the
 * Architecture will be used for the AMI lookup.
 *
 * @extends CustomResourceProvider
 */
class AmiInfoProvider extends CustomResourceProvider {

    /**
     * Constructor for the AmiInfoProvider class.
     *
     * @param {Object} log - The global logger from the Lambda handler
     * @constructor
     */
    constructor(log) {
        super(RESOURCE_TYPE, RESOURCE_SCHEMA);
        this._logger = log;
    }

    /**
     * Get the ResourceType that is provided by this CustomResourceProvider implementation.
     *
     * @returns {string} - The ResourceType that is provided by this CustomResourceProvider implementation.
     */
    static get RESOURCE_TYPE() {
        return (RESOURCE_TYPE);
    }

    /**
     * For AMI information, 'Create' simply fetches the current AMI information and returns it.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Create(event, context) {
        let result = await this.getAmiInfo(event);
        return this.sendResponse(event, context, result.responseStatus, result.responseData);
    }

    /**
     * Called when the Delete RequestType is specified, this is a non-operation for AMI information,
     * so SUCCESS is simply responded.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event.
     * @param {Object} context - the Lambda invocation context.
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Delete(event, context) {
        return this.sendResponse(event, context, SUCCESS, { PhysicalResourceId: event.PhysicalResourceId });
    }

    /**
     * For AMI information, 'Update' simply fetches the current AMI information and returns it.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event
     * @param {Object} context - the Lambda invocation context
     * @returns {Promise} - A Promise of the response from the ResponseURL and other data related to the response.
     */
    async Update(event, context) {
        let result = await this.getAmiInfo(event);
        return this.sendResponse(event, context, result.responseStatus, result.responseData);
    }

    /**
     * Utilizes either parameter store or describeImages to get the AMI ID specified 
     * by architecture or instance type.
     *
     * @param {Object} event - the CloudFormation Custom Resource Request event
     * @returns {Object} - An object with the CloudFormation response status and data.
     * @private
     */
    async getAmiInfo(event) {

        // Validate the EC2 instance type if provided
        let properties = event.ResourceProperties;
        let instanceTypeArchitecture = architectureLookup(properties.InstanceType);
        if (properties.InstanceType && !instanceTypeArchitecture) {
            let msg = `Unsupported InstanceType '${properties.InstanceType}'`;
            return { responseStatus: FAILED, responseData: { PhysicalResourceId: NOT_CREATED, Reason: msg }};
        }

        // Default the LinuxVersion to 'Linux2' if not set
        let linuxVersion = properties.LinuxVersion || 'Linux2';

        // Architecture is the overriding property and we default to 'HVM' if not provided
        let architecture = properties.Architecture || instanceTypeArchitecture;

        // Use describeImages for the GPU specialized image, and Parameter Store for all others.  This is done
        // because the Parameter Store is more accurate and faster, but it does not have the GPU specialized
        // AMI info in it.
        let results = await (architecture == 'HVM_GPU' ?
            this.getGpuAmiViaDescribeImages(linuxVersion, properties.Region) :
            this.getAmiViaParameterStore(architecture, linuxVersion, properties.Region));

        return results;
    }

    /**
     * Get the AMI ID for the specified architecture, Amazon Linux version and region.  Utilizes the
     * latest image info that Amazon stores in the SSM Parameter Store.
     *
     * @param {string} architecture - The virtulization architecture.
     * @param {string} linuxVersion - The Amazon Linux version, will be either 'Linux' or 'Linux2'
     * @param {string} region - The AWS region to get the image for.
     * @returns {Object} - An object with the CloudFormation response status and data.
     */
    async getAmiViaParameterStore(architecture, linuxVersion, region) {

        let amiPath = (linuxVersion === 'Linux' ? ARCH_TO_AMZN_AMI_PATH.get(architecture) : ARCH_TO_AMZN2_AMI_PATH.get(architecture));
        if (!amiPath) {
            return { responseStatus: FAILED, responseData: { Reason: `Invalid Architecture '${architecture}'` }};
        }

        let responseStatus = FAILED;
        let responseData = {};
        try {

            // Use the SSM Parameter Store to fetch the latest Amazon Linux version, it is region specific
            this._logger.info({ message: 'Using SSM Parameter Store to get AMI ID', architecture, linuxVersion, region });

            let savedAwsConfig = AWS.config;
            AWS.config = { region: region };
            let ssm = new AWS.SSM();
            AWS.config = savedAwsConfig;

            let params = { Names: [amiPath] };
            let results = await ssm.getParameters(params).promise();
            let amiId = results.Parameters[0].Value;
            responseData.PhysicalResourceId = amiId;
            responseData.Data = { Id: amiId };
            responseStatus = SUCCESS;

        } catch(err) {
            responseData = { PhysicalResourceId: NOT_CREATED, Reason: err.message };
        }

        return { responseStatus, responseData };
    }

    /**
     * Get the GPU specialized AMI image ID for the specified Amazon Linux version and region.
     * Utilizes describeImages to get the matching image.
     *
     * @param {string} linuxVersion  - The Amazon Linux version, will be either 'Linux' or 'Linux2'
     * @param {string} region - The AWS region to get the image for.
     * @returns {Object} - An object with the CloudFormation response status and data.
     */
    async getGpuAmiViaDescribeImages(linuxVersion, region) {

        let amiPattern = (linuxVersion === 'Linux' ? ARCH_TO_AMZN_GPU_AMI_PATTERN : ARCH_TO_AMZN2_GPU_AMI_PATTERN);
        let params = {
            Filters: [{ Name: 'name', Values: [amiPattern] }],
            Owners: ['679593333241']
        };

        let responseStatus = FAILED;
        let responseData = {};
        try {
            this._logger.info({ message: 'Using describeImages() to get GPU specialized AMI ID', linuxVersion, region });
            let ec2 = new AWS.EC2({region: region});
            let describeImagesResult = await ec2.describeImages(params).promise();
            let images = describeImagesResult.Images;

            // Sort images by name in descending order. The names contain the AMI version, formatted as YYYY.MM.Ver.
            images.sort(function(x, y) { return y.Name.localeCompare(x.Name); });
            for (let image of images) {
                responseData.PhysicalResourceId = image.ImageId;
                responseData.Data = { Id: image.ImageId };
                responseStatus = SUCCESS;
                break;
            }

        } catch(err) {
            responseData = { PhysicalResourceId: NOT_CREATED, Reason: err.message };
        }

        return { responseStatus, responseData };
    }
}

exports['default'] = AmiInfoProvider;
module.exports = exports['default'];