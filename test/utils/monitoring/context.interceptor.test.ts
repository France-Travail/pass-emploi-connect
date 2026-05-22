import { ExecutionContext, CallHandler } from '@nestjs/common'
import { of } from 'rxjs'
import { ContextInterceptor } from '../../../src/utils/monitoring/context.interceptor'
import {
  ContextKey,
  RequestContext
} from '../../../src/utils/monitoring/request-context'

describe('ContextInterceptor', () => {
  it('démarre le contexte et y pose http.request.id et interaction.uid', () => {
    // Given
    const context = new RequestContext()
    const interceptor = new ContextInterceptor(context)
    const request = { id: 'req-1', params: { interactionId: 'uid-9' } }
    const executionContext = {
      switchToHttp: (): { getRequest: () => object } => ({
        getRequest: () => request
      })
    } as unknown as ExecutionContext
    const next: CallHandler = { handle: () => of('ok') }

    // When
    interceptor.intercept(executionContext, next)

    // Then
    expect(context.get(ContextKey.HTTP_REQUEST_ID)).toEqual('req-1')
    expect(context.get(ContextKey.INTERACTION_ID)).toEqual('uid-9')
  })

  it('ne pose pas interaction.uid si absent des params', () => {
    // Given
    const context = new RequestContext()
    const interceptor = new ContextInterceptor(context)
    const executionContext = {
      switchToHttp: (): { getRequest: () => object } => ({
        getRequest: () => ({ id: 'req-2' })
      })
    } as unknown as ExecutionContext
    const next: CallHandler = { handle: () => of('ok') }

    // When
    interceptor.intercept(executionContext, next)

    // Then
    expect(context.get(ContextKey.INTERACTION_ID)).toBeUndefined()
    expect(context.get(ContextKey.HTTP_REQUEST_ID)).toEqual('req-2')
  })
})
