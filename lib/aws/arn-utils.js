
/**
 * Parses an AWS ARN into its parts and returns an object with the parts as properties.
 *
 * @param {string} arn - A string in AWS ARN format
 * @return {Object} - An object with the following properties:
 * Arn, Partition, Service, Region, AccountId, ResourceType, Resource
 */
function parseArn(arn) {

    let elements = arn.split(':');
    if (elements.length < 6) {
        return null;
    }

    let parsedArn = {
        Arn: arn,
        Partition: elements[1],
        Service: elements[2],
        Region: elements[3],
        AccountId: elements[4],
        Resource: elements.slice(5).join(':'),
        ResourceType: undefined
    };

    if (parsedArn.Resource.includes('/')) {
        let slashIndex = parsedArn.Resource.indexOf('/');
        parsedArn.ResourceType = parsedArn.Resource.substring(0, slashIndex);
        parsedArn.Resource = parsedArn.Resource.substring(slashIndex + 1);
    } else if (parsedArn.Resource.includes(':')) {
        let parts = parsedArn.Resource.split(':');
        parsedArn.ResourceType = parts[0];
        parsedArn.Resource = parts[1];
    }

    return parsedArn;
}

/**
 * Builds an AWS ARN from the provided info.
 *
 * @param {string} referenceArn - An ARN to use as a reference, will pull region and account ID from this ARN. 
 * @param {string} service - The service for the ARN.
 * @param {string} resourceType - The resource type for the ARN.
 * @param {string} resource - The resource for the ARN.
 * @returns {string} - The formatted ARN with the provided info.
 */
function buildArn(referenceArn, service, resourceType, resource) {
    let parsedArn =  parseArn(referenceArn);
    return `arn:aws:${service}:${parsedArn.Region}:${parsedArn.AccountId}:${resourceType}/${resource}`;
}

module.exports = { buildArn, parseArn };