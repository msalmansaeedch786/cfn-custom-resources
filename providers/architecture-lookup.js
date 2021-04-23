'use strict';

/**
 * Maps an instance type to a Architecture that will be used to select the image.
 */
const INSTANCE_TYPE_TO_ARCH = new Map([

    // General Purpose ARM64
    ['a1.medium',  'HVM_ARM'],
    ['a1.large',   'HVM_ARM'],
    ['a1.xlarge',  'HVM_ARM'],
    ['a1.2xlarge', 'HVM_ARM'],
    ['a1.4xlarge', 'HVM_ARM'],
    // END General Purpose ARM64

    // General Purpose
    ['m4.large',    'HVM'],
    ['m4.xlarge',   'HVM'],
    ['m4.2xlarge',  'HVM'],
    ['m4.4xlarge',  'HVM'],
    ['m4.10xlarge', 'HVM'],
    ['m4.16xlarge', 'HVM'],

    ['m5.large',    'HVM'],
    ['m5.xlarge',   'HVM'],
    ['m5.2xlarge',  'HVM'],
    ['m5.4xlarge',  'HVM'],
    ['m5.8xlarge',  'HVM'],
    ['m5.12xlarge', 'HVM'],
    ['m5.24xlarge', 'HVM'],
    ['m5.metal',    'HVM'],

    ['m5a.large',    'HVM'],
    ['m5a.xlarge',   'HVM'],
    ['m5a.2xlarge',  'HVM'],
    ['m5a.4xlarge',  'HVM'],
    ['m5a.8xlarge',  'HVM'],
    ['m5a.12xlarge', 'HVM'],
    ['m5a.16xlarge', 'HVM'],
    ['m5a.24xlarge', 'HVM'],

    ['m5ad.large',    'HVM'],
    ['m5ad.xlarge',   'HVM'],
    ['m5ad.2xlarge',  'HVM'],
    ['m5ad.4xlarge',  'HVM'],
    ['m5ad.12xlarge', 'HVM'],
    ['m5ad.24xlarge', 'HVM'],

    ['m5d.large',    'HVM'],
    ['m5d.xlarge',   'HVM'],
    ['m5d.2xlarge',  'HVM'],
    ['m5d.4xlarge',  'HVM'],
    ['m5d.8xlarge',  'HVM'],
    ['m5d.12xlarge', 'HVM'],
    ['m5d.16xlarge', 'HVM'],
    ['m5d.24xlarge', 'HVM'],
    ['m5d.metal',    'HVM'],

    ['t2.nano',    'HVM'],
    ['t2.micro',   'HVM'],
    ['t2.small',   'HVM'],
    ['t2.medium',  'HVM'],
    ['t2.large',   'HVM'],
    ['t2.xlarge',  'HVM'],
    ['t2.2xlarge', 'HVM'],

    ['t3.nano',    'HVM'],
    ['t3.micro',   'HVM'],
    ['t3.small',   'HVM'],
    ['t3.medium',  'HVM'],
    ['t3.large',   'HVM'],
    ['t3.xlarge',  'HVM'],
    ['t3.2xlarge', 'HVM'],

    ['t3a.nano',    'HVM'],
    ['t3a.micro',   'HVM'],
    ['t3a.small',   'HVM'],
    ['t3a.medium',  'HVM'],
    ['t3a.large',   'HVM'],
    ['t3a.xlarge',  'HVM'],
    ['t3a.2xlarge', 'HVM'],
    // END General Purpose

    // Compute Optimized
    ['c4.large',   'HVM'],
    ['c4.xlarge',  'HVM'],
    ['c4.2xlarge', 'HVM'],
    ['c4.4xlarge', 'HVM'],
    ['c4.8xlarge', 'HVM'],

    ['c5.large',    'HVM'],
    ['c5.xlarge',   'HVM'],
    ['c5.2xlarge',  'HVM'],
    ['c5.4xlarge',  'HVM'],
    ['c5.9xlarge',  'HVM'],
    ['c5.12xlarge', 'HVM'],
    ['c5.18xlarge', 'HVM'],
    ['c5.24xlarge', 'HVM'],

    ['c5d.large',    'HVM'],
    ['c5d.xlarge',   'HVM'],
    ['c5d.2xlarge',  'HVM'],
    ['c5d.4xlarge',  'HVM'],
    ['c5d.9xlarge',  'HVM'],
    ['c5d.18xlarge', 'HVM'],

    ['c5n.large',    'HVM'],
    ['c5n.xlarge',   'HVM'],
    ['c5n.2xlarge',  'HVM'],
    ['c5n.4xlarge',  'HVM'],
    ['c5n.9xlarge',  'HVM'],
    ['c5n.18xlarge', 'HVM'],
    ['c5n.metal',    'HVM'],
    // END Compute Optimized

    // FPGA Instances
    ['f1.2xlarge',  'HVM'],
    ['f1.4xlarge',  'HVM'],
    ['f1.16xlarge', 'HVM'],
    // END FPGA Instances

    // GPU Instances
    ['g2.2xlarge', 'HVM_GPU'],
    ['g2.8xlarge', 'HVM_GPU'],

    ['g3.xlarge',   'HVM_GPU'],
    ['g3.4xlarge',  'HVM_GPU'],
    ['g3.8xlarge',  'HVM_GPU'],
    ['g3.16xlarge', 'HVM_GPU'],

    ['p2.xlarge',   'HVM_GPU'],
    ['p2.8xlarge',  'HVM_GPU'],
    ['p2.16xlarge', 'HVM_GPU'],

    ['p3.2xlarge',  'HVM_GPU'],
    ['p3.8xlarge',  'HVM_GPU'],
    ['p3.16xlarge', 'HVM_GPU'],

    ['p3dn.24xlarge', 'HVM_GPU'],
    // END GPU Instances

    // Memory Optimized
    ['r4.xlarge',   'HVM'],
    ['r4.2xlarge',  'HVM'],
    ['r4.4xlarge',  'HVM'],
    ['r4.8xlarge',  'HVM'],
    ['r4.16xlarge', 'HVM'],

    ['r5.large',    'HVM'],
    ['r5.xlarge',   'HVM'],
    ['r5.2xlarge',  'HVM'],
    ['r5.4xlarge',  'HVM'],
    ['r5.8xlarge',  'HVM'],
    ['r5.12xlarge', 'HVM'],
    ['r5.16xlarge', 'HVM'],
    ['r5.24xlarge', 'HVM'],
    ['r5.metal',    'HVM'],

    ['r5a.large',    'HVM'],
    ['r5a.xlarge',   'HVM'],
    ['r5a.2xlarge',  'HVM'],
    ['r5a.4xlarge',  'HVM'],
    ['r5a.8xlarge',  'HVM'],
    ['r5a.12xlarge', 'HVM'],
    ['r5a.16xlarge', 'HVM'],
    ['r5a.24xlarge', 'HVM'],

    ['r5ad.large',    'HVM'],
    ['r5ad.xlarge',   'HVM'],
    ['r5ad.2xlarge',  'HVM'],
    ['r5ad.4xlarge',  'HVM'],
    ['r5ad.12xlarge', 'HVM'],
    ['r5ad.24xlarge', 'HVM'],

    ['r5d.large',    'HVM'],
    ['r5d.xlarge',   'HVM'],
    ['r5d.2xlarge',  'HVM'],
    ['r5d.4xlarge',  'HVM'],
    ['r5d.8xlarge',  'HVM'],
    ['r5d.12xlarge', 'HVM'],
    ['r5d.16xlarge', 'HVM'],
    ['r5d.24xlarge', 'HVM'],
    ['r5d.metal',    'HVM'],

    ['x1.16xlarge', 'HVM'],
    ['x1.32xlarge', 'HVM'],

    ['x1e.xlarge',   'HVM'],
    ['x1e.2xlarge',  'HVM'],
    ['x1e.4xlarge',  'HVM'],
    ['x1e.8xlarge',  'HVM'],
    ['x1e.16xlarge', 'HVM'],
    ['x1e.32xlarge', 'HVM'],

    ['z1d.large',    'HVM'],
    ['z1d.xlarge',   'HVM'],
    ['z1d.2xlarge',  'HVM'],
    ['z1d.3xlarge',  'HVM'],
    ['z1d.6xlarge',  'HVM'],
    ['z1d.12xlarge', 'HVM'],
    ['z1d.metal',    'HVM'],
    // END Memory Optimized

    // Storage Optimized
    ['d2.xlarge',  'HVM'],
    ['d2.2xlarge', 'HVM'],
    ['d2.4xlarge', 'HVM'],
    ['d2.8xlarge', 'HVM'],

    ['h1.2xlarge',  'HVM'],
    ['h1.4xlarge',  'HVM'],
    ['h1.8xlarge',  'HVM'],
    ['h1.16xlarge', 'HVM'],

    ['i2.xlarge',  'HVM'],
    ['i2.2xlarge', 'HVM'],
    ['i2.4xlarge', 'HVM'],
    ['i2.8xlarge', 'HVM'],

    ['i3.large',    'HVM'],
    ['i3.xlarge',   'HVM'],
    ['i3.2xlarge',  'HVM'],
    ['i3.4xlarge',  'HVM'],
    ['i3.8xlarge',  'HVM'],
    ['i3.16xlarge', 'HVM'],
    ['i3.metal',    'HVM'],

    ['i3en.large',    'HVM'],
    ['i3en.xlarge',   'HVM'],
    ['i3en.2xlarge',  'HVM'],
    ['i3en.3xlarge',  'HVM'],
    ['i3en.6xlarge',  'HVM'],
    ['i3en.12xlarge', 'HVM'],
    ['i3en.24xlarge', 'HVM'],
    ['i3en.metal',    'HVM']
    // END Storage Optimized
]);

/**
 * Returns the architecture type for the specified EC2 instance type, or undefined if not found.
 *
 * @param {string} instanceType - EC2 instance type to lookup the architecture for.
 * @returns {string} - The architecture type for the specified EC2 instance type, or undefined if not found.
 */
function architectureLookup(instanceType) {
    return (!instanceType ? null : INSTANCE_TYPE_TO_ARCH.get(instanceType));
}

module.exports = architectureLookup;