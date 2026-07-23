export interface User {
  // venant de l'API
  userId: string
  userType: User.Type
  userStructure: User.Structure
  userRoles: string[]
  // venant de l'IDP
  given_name: string
  // Optionnels mode invité
  family_name?: string
  email?: string
  preferred_username?: string
}

export namespace User {
  export enum Type {
    JEUNE = 'JEUNE',
    BENEFICIAIRE = 'BENEFICIAIRE',
    CONSEILLER = 'CONSEILLER'
  }

  export enum Structure {
    MILO = 'MILO',
    POLE_EMPLOI_CEJ = 'POLE_EMPLOI',
    POLE_EMPLOI_BRSA = 'POLE_EMPLOI_BRSA',
    POLE_EMPLOI_AIJ = 'POLE_EMPLOI_AIJ',
    FRANCE_TRAVAIL = 'FRANCE_TRAVAIL',
    CONSEIL_DEPT = 'CONSEIL_DEPT',
    AVENIR_PRO = 'AVENIR_PRO',
    FT_ACCOMPAGNEMENT_INTENSIF = 'FT_ACCOMPAGNEMENT_INTENSIF',
    FT_ACCOMPAGNEMENT_GLOBAL = 'FT_ACCOMPAGNEMENT_GLOBAL',
    FT_EQUIP_EMPLOI_RECRUT = 'FT_EQUIP_EMPLOI_RECRUT',
    FT_DEMANDEUR_D_EMPLOI = 'FT_DEMANDEUR_D_EMPLOI',
    FT_NON_DEMANDEUR_D_EMPLOI = 'FT_NON_DEMANDEUR_D_EMPLOI',
    INVITE = 'INVITE'
  }
}

export function estInvite(userStructure: User.Structure): boolean {
  return userStructure === User.Structure.INVITE
}

function estFT(userStructure: User.Structure): boolean {
  return [
    User.Structure.POLE_EMPLOI_CEJ,
    User.Structure.POLE_EMPLOI_AIJ,
    User.Structure.POLE_EMPLOI_BRSA,
    User.Structure.FRANCE_TRAVAIL,
    User.Structure.AVENIR_PRO,
    User.Structure.FT_ACCOMPAGNEMENT_INTENSIF,
    User.Structure.FT_ACCOMPAGNEMENT_GLOBAL,
    User.Structure.FT_EQUIP_EMPLOI_RECRUT,
    User.Structure.FT_DEMANDEUR_D_EMPLOI,
    User.Structure.FT_NON_DEMANDEUR_D_EMPLOI
  ].includes(userStructure)
}

function estConseilDepartemental(userStructure: User.Structure): boolean {
  return userStructure === User.Structure.CONSEIL_DEPT
}

function estConseiller(userType: User.Type): boolean {
  return userType === User.Type.CONSEILLER
}

function estBeneficiaire(userType: User.Type): boolean {
  return [User.Type.JEUNE, User.Type.BENEFICIAIRE].includes(userType)
}

export function estBeneficiaireFTConnect(
  userType: User.Type,
  userStructure: User.Structure
): boolean {
  return (
    estBeneficiaire(userType) &&
    (estFT(userStructure) || estConseilDepartemental(userStructure))
  )
}

export function estConseillerDept(
  userType: User.Type,
  userStructure: User.Structure
): boolean {
  return estConseiller(userType) && estConseilDepartemental(userStructure)
}
