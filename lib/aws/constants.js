'use strict';

/** CloudFormation FAILED status. */
const FAILED = 'FAILED';

/** CloudFormation SUCCESS status. */
const SUCCESS = 'SUCCESS';

/** Used by the various properties to mask secret values when the  user wishes it to not be returned. */
const MASKED_SECRET = '*********';

/** Used for the PhysicalResourceId when it was not created due to an error. */
const NOT_CREATED = 'resource-not-created';

/**
 * A regular expression that is used to verify a Base64 encoded string.
 * Accepts strings with leading and trailing whitespace.
 */
const BASE64_REGEX = '^[ \\s]*(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?[ \\s]*$';

const AwsPatterns = Object.freeze({
    ACCESS_KEY_ID:  '^[A-Z0-9]+$',
    ARN:            '^arn:aws:([0-9a-zA-Z-]*):([0-9a-zA-Z-]*):(\\d+):([0-9a-zA-Z-]*)([:/])([0-9a-zA-Z\\-_./]+)$',
    BASE64:         BASE64_REGEX,
    KEY_PAIR_NAME:  '^[a-zA-Z0-9_\\.\\-/]+$',
    KMS_KEY_ID:     '^(arn:|alias\\/|[0-9a-fA-F]+-)[a-zA-Z0-9:/_-]+$',
    LINUX_VERSION:  '^(Linux|Linux2)$',
    LOG_GROUP_NAME: '^[\\.\\-_/#A-Za-z0-9]+$',
    PARAMETER_NAME: '^([a-zA-Z0-9./_-]+)$',
    PARAMETER_PATH: '^/[a-zA-Z0-9_\\.\\-/]+$',
    USER_NAME:      '^[\\w+=,.@-]+$'
});

const AwsNames = Object.freeze({
    ACCESS_KEY_ID:     'access_key_id',
    KEY_FINGERPRINT:   'key_fingerprint',
    KEY_MATERIAL:      'key_material',
    KEY_NAME:          'key_name',
    SECRET_ACCESS_KEY: 'secret_access_key',
    SES_SMTP_PASSWORD: 'ses_smtp_password'
});

module.exports = { AwsNames, AwsPatterns, BASE64_REGEX, FAILED, SUCCESS, MASKED_SECRET, NOT_CREATED };