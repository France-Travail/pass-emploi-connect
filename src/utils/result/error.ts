export interface DomainError {
  readonly code: string
  readonly message: string
  readonly reason?: string
  readonly email?: string
  readonly nom?: string
  readonly prenom?: string
}

export class AuthError implements DomainError {
  static CODE = 'AUTH_ERROR'
  code: string = AuthError.CODE
  readonly message: string
  readonly reason: string

  constructor(message: string) {
    this.message = message
    this.reason = message
  }
}

export class JWTError implements DomainError {
  static CODE = 'JWT_ERROR'
  code: string = JWTError.CODE
  readonly message: string

  constructor(code: string) {
    this.message = `JWT Error`
    this.code = code
  }
}

export class NonTrouveError implements DomainError {
  static CODE = 'NON_TROUVE'
  readonly code: string = NonTrouveError.CODE
  readonly message: string

  constructor(entityType: string, critereRecherche = '') {
    this.message = `${entityType} ${critereRecherche} non trouvé(e)`
  }
}

export class UtilisateurNonTraitable implements DomainError {
  static CODE = 'UTILISATEUR_NON_TRAITABLE'
  readonly code: string = UtilisateurNonTraitable.CODE
  readonly message: string
  readonly reason?: string
  readonly email?: string
  readonly nom?: string
  readonly prenom?: string

  constructor(reason?: string, email?: string, nom?: string, prenom?: string) {
    this.message = 'Utilisateur non traitable'
    this.reason = reason
    this.email = email
    this.nom = nom
    this.prenom = prenom
  }
}
