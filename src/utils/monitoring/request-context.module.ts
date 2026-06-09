import { Global, Module } from '@nestjs/common'
import { RequestContext } from './request-context'

// Global : RequestContext est injectable partout sans réimporter le module.
@Global()
@Module({
  providers: [RequestContext],
  exports: [RequestContext]
})
export class RequestContextModule {}
