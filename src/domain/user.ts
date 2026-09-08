// Profil (structure × dispositif) renvoyé par l'API : la cible, recopié tel
// quel dans le claim `userProfile`. `userStructure` (legacy) reste émis pour
// l'app mobile et pour les clés Redis (accountId).
export interface Profil {
  structure: Profil.Structure
  dispositif: Profil.Dispositif | null
}

export namespace Profil {
  export enum Structure {
    MILO = 'MILO',
    FRANCE_TRAVAIL = 'FRANCE_TRAVAIL',
    CONSEIL_DEPARTEMENTAL = 'CONSEIL_DEPARTEMENTAL',
    INVITE = 'INVITE'
  }

  export enum Dispositif {
    CEJ = 'CEJ',
    PACEA = 'PACEA',
    BRSA = 'BRSA',
    AIJ = 'AIJ',
    AVENIR_PRO = 'AVENIR_PRO',
    ACCOMPAGNEMENT_INTENSIF = 'ACCOMPAGNEMENT_INTENSIF',
    ACCOMPAGNEMENT_GLOBAL = 'ACCOMPAGNEMENT_GLOBAL',
    EQUIP_EMPLOI_RECRUT = 'EQUIP_EMPLOI_RECRUT',
    DEMANDEUR_D_EMPLOI = 'DEMANDEUR_D_EMPLOI',
    ESPACE_CANDIDAT = 'ESPACE_CANDIDAT'
  }
}

export interface User {
  // venant de l'API
  userId: string
  userType: User.Type
  userStructure: User.Structure
  userProfile?: Profil
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
    FT_ESPACE_CANDIDAT = 'FT_ESPACE_CANDIDAT',
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
    User.Structure.FT_ESPACE_CANDIDAT
  ].includes(userStructure)
}

function estConseilDepartemental(userStructure: User.Structure): boolean {
  return userStructure === User.Structure.CONSEIL_DEPT
}

function estConseiller(userType: User.Type): boolean {
  return userType === User.Type.CONSEILLER
}

function estJeune(userType: User.Type): boolean {
  return userType === User.Type.JEUNE
}

export function estJeuneFTConnect(
  userType: User.Type,
  userStructure: User.Structure
): boolean {
  return (
    estJeune(userType) &&
    (estFT(userStructure) || estConseilDepartemental(userStructure))
  )
}

export function estConseillerDept(
  userType: User.Type,
  userStructure: User.Structure
): boolean {
  return estConseiller(userType) && estConseilDepartemental(userStructure)
}

export function profilDeStructure(userStructure: User.Structure): Profil {
  switch (userStructure) {
    case User.Structure.MILO:
      return { structure: Profil.Structure.MILO, dispositif: null }
    case User.Structure.CONSEIL_DEPT:
      return {
        structure: Profil.Structure.CONSEIL_DEPARTEMENTAL,
        dispositif: null
      }
    case User.Structure.INVITE:
      return { structure: Profil.Structure.INVITE, dispositif: null }
    case User.Structure.FRANCE_TRAVAIL:
      return { structure: Profil.Structure.FRANCE_TRAVAIL, dispositif: null }
    case User.Structure.POLE_EMPLOI_CEJ:
      return ft(Profil.Dispositif.CEJ)
    case User.Structure.POLE_EMPLOI_BRSA:
      return ft(Profil.Dispositif.BRSA)
    case User.Structure.POLE_EMPLOI_AIJ:
      return ft(Profil.Dispositif.AIJ)
    case User.Structure.AVENIR_PRO:
      return ft(Profil.Dispositif.AVENIR_PRO)
    case User.Structure.FT_ACCOMPAGNEMENT_INTENSIF:
      return ft(Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF)
    case User.Structure.FT_ACCOMPAGNEMENT_GLOBAL:
      return ft(Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL)
    case User.Structure.FT_EQUIP_EMPLOI_RECRUT:
      return ft(Profil.Dispositif.EQUIP_EMPLOI_RECRUT)
    case User.Structure.FT_DEMANDEUR_D_EMPLOI:
      return ft(Profil.Dispositif.DEMANDEUR_D_EMPLOI)
    case User.Structure.FT_ESPACE_CANDIDAT:
      return ft(Profil.Dispositif.ESPACE_CANDIDAT)
  }
}

function ft(dispositif: Profil.Dispositif): Profil {
  return { structure: Profil.Structure.FRANCE_TRAVAIL, dispositif }
}
