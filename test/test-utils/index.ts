/* eslint-disable no-process-env */
import { createSandbox } from 'sinon'
import * as sinon from 'sinon'
import { StubbedClass, stubClass } from './types'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import * as apm from 'elastic-apm-node'
import { setAPMInstance } from '../../src/utils/monitoring/apm.init'
import { initializeTestKeyPair } from './jwt-test-helper'

// @ts-expect-error - top-level await is supported by vitest but not by TS with current config
await initializeTestKeyPair()

export { createSandbox, sinon }

export { stubClass, StubbedClass }

const instanceMock: StubbedType<apm.Agent> = stubInterface(createSandbox())
setAPMInstance(instanceMock)
