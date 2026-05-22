import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { ContextKey, RequestContext } from './request-context'

// Démarre le RequestContext en début de requête et y pose http.request.id.
// interaction.uid est posé ici quand il est présent en param de route
// (/{idp}/connect/:interactionId) ; pour le callback broker il est posé plus
// tard par IdpService une fois interactionDetails() résolu.
@Injectable()
export class ContextInterceptor implements NestInterceptor {
  constructor(private readonly context: RequestContext) {}

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler
  ): Observable<unknown> {
    this.context.start()

    const request = executionContext.switchToHttp().getRequest()
    this.context.set(ContextKey.HTTP_REQUEST_ID, request.id)

    const interactionId = request.params?.interactionId
    if (interactionId) {
      this.context.set(ContextKey.INTERACTION_ID, interactionId)
    }

    return next.handle()
  }
}
