// Base repository interfaces
export * from './base'

// Specific repository interfaces
export * from './users'
export * from './checks'
export * from './organizations'
export * from './dictionaries'
export * from './violations'
export * from './user-invitations'

// Repository container interface
export interface RepositoryContainer {
  users: import('./users').UsersRepository
  checks: import('./checks').ChecksRepository
  organizations: import('./organizations').OrganizationsRepository
  dictionaries: import('./dictionaries').DictionariesRepository
  violations: import('./violations').ViolationsRepository
  userInvitations: import('./user-invitations').UserInvitationsRepository
}