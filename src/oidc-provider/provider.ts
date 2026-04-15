import OidcProvider, { errors, interactionPolicy } from 'oidc-provider'

export type Provider = OidcProvider

export type ProviderClass = {
  new (...args: ConstructorParameters<typeof OidcProvider>): Provider
}

export type OidcProviderModule = {
  Provider: ProviderClass
  interactionPolicy: typeof interactionPolicy
  errors: typeof errors
}

/**
 * The OIDC provider module token. It's used to inject the OIDC provider as a dependency like so:
 * ```ts
 * @Inject(OIDC_PROVIDER_MODULE) private readonly oidcProviderModule: OidcProviderModule
 * ```
 */
export const OIDC_PROVIDER_MODULE = 'OIDC_PROVIDER_MODULE'

export const OidcProviderModuleProvider = {
  provide: OIDC_PROVIDER_MODULE,
  useFactory: (): OidcProviderModule => ({
    Provider: OidcProvider,
    interactionPolicy,
    errors
  })
}
