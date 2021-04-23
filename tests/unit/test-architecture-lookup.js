'use strict';

const { describe, it } = require('mocha');
const chai = require('chai');
const expect = chai.expect;

const architectureLookup = require('../../providers/architecture-lookup');

describe('architecture-lookup', () => {
    describe('architectureLookup()', () => {
        it('should return HVM_ARM architecture for a1.medium instance type', () => {
            // Act
            var result = architectureLookup('a1.medium');

            // Assert
            expect(result).to.equal('HVM_ARM');
        });

        it('should return HVM architecture for m5.large instance type', () => {
            // Act
            var result = architectureLookup('m5.large');

            // Assert
            expect(result).to.equal('HVM');
        });

        it('should return undefined for invalid instance type',  () => {
            // Act
            var result = architectureLookup('t12.micro');

            // Assert
            expect(result).to.be.undefined;
        });

        it('should return null when instance type is null',  () => {
            // Act
            var result = architectureLookup(null);

            // Assert
            expect(result).to.be.null;
        });
    });
});