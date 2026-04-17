// We're importing both the default and the named exports from the oidc-provider package.
import type ESMProvider from 'oidc-provider'
import type { errors, interactionPolicy } from 'oidc-provider'

/**
 * We re-export the type so the consumer doesn't have to import it from the oidc-provider package and be forced to ignore the type error.
 */
export type Provider = ESMProvider

/**
 * A type representing the actual provider class provided by the `oidc-provider` package and not the instance.
 */
export type ProviderClass = {
  new (...args: ConstructorParameters<typeof ESMProvider>): Provider
}

/**
 * A type representing the `oidc-provider` module.
 * Useful when we pass the around as a parameter.
 */
export type OidcProviderModule = {
  Provider: ProviderClass
  interactionPolicy: typeof interactionPolicy
  errors: typeof errors
}

type AllowedPackage = 'oidc-provider'
/**
 * Dynamically imports a package. Useful when we want to import an ES module into CommonJS.
 *
 * **Note:** We couldn't use only `await import(packageName)` because it still throws the ESM error.
 * @see https://github.com/microsoft/TypeScript/issues/43329#issuecomment-811606238
 *
 * @param packageName
 */
const dynamicImport = async <ReturnType>(
  packageName: AllowedPackage
): Promise<ReturnType> => new Function(`return import('${packageName}')`)()

/**
 * The OIDC provider module token. It's used to inject the OIDC provider as a dependency like so:
 * ```ts
 * @Inject(OIDC_PROVIDER_MODULE) private readonly oidcProviderModule: OidcProviderModule
 * ```
 */
export const OIDC_PROVIDER_MODULE = 'OIDC_PROVIDER_MODULE'

/**
 * A factory provider that provides the OIDC provider module.
 */
export const OidcProviderModuleProvider = {
  provide: OIDC_PROVIDER_MODULE,
  useFactory: async (): Promise<OidcProviderModule> => {
    const { default: ProviderClass, ...rest } = await dynamicImport<
      { default: ProviderClass } & Omit<OidcProviderModule, 'Provider'>
    >('oidc-provider')

    return {
      Provider: ProviderClass,
      ...rest
    }
  }
}
