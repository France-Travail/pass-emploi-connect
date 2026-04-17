/* eslint-disable no-process-env */
import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiExclude from 'chai-exclude'
import { createSandbox } from 'sinon'
import * as sinon from 'sinon'
import sinonChai from 'sinon-chai'
import { StubbedClass, stubClass } from './types'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import * as apm from 'elastic-apm-node'
import { setAPMInstance } from '../../src/utils/monitoring/apm.init'

use(sinonChai)
use(chaiAsPromised)
use(chaiExclude)

export { createSandbox, expect, sinon }

export { stubClass, StubbedClass }

const instanceMock: StubbedType<apm.Agent> = stubInterface(createSandbox())
setAPMInstance(instanceMock)
