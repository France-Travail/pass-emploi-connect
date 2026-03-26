/* eslint-disable no-process-env */
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiExclude from 'chai-exclude'
import dirtyChai from 'dirty-chai'
import { createSandbox } from 'sinon'
import * as sinon from 'sinon'
import sinonChai from 'sinon-chai'
import { StubbedClass, stubClass } from './types'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import * as apm from 'elastic-apm-node'
import { setAPMInstance } from '../../src/utils/monitoring/apm.init'

chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.use(chaiExclude)
chai.use(dirtyChai)

const expect = chai.expect
export { createSandbox, expect, sinon }

export { stubClass, StubbedClass }

const instanceMock: StubbedType<apm.Agent> = stubInterface(createSandbox())
setAPMInstance(instanceMock)
