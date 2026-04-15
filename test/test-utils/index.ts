/* eslint-disable no-process-env */
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiExclude from 'chai-exclude'
import dirtyChai from 'dirty-chai'
import { createSandbox } from 'sinon'
import * as sinon from 'sinon'
import sinonChai from 'sinon-chai'
import { stubClass } from './types.js'
import type { StubbedClass } from './types.js'
import { stubInterface } from '@salesforce/ts-sinon'
import type { StubbedType } from '@salesforce/ts-sinon'
import * as apm from 'elastic-apm-node'
import { setAPMInstance } from '../../src/utils/monitoring/apm.init.js'

chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.use(chaiExclude)
chai.use(dirtyChai)

const expect = chai.expect
export { createSandbox, expect, sinon }

export { stubClass }
export type { StubbedClass }

const instanceMock: StubbedType<apm.Agent> = stubInterface(createSandbox())
setAPMInstance(instanceMock)
