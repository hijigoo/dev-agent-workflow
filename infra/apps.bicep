targetScope = 'resourceGroup'

@description('Short lowercase prefix used for Container App names.')
@minLength(3)
@maxLength(18)
param namePrefix string

@description('Name of the existing Azure Container Registry.')
param registryName string

@description('Name of the existing Container Apps managed environment.')
param environmentName string

@description('Name of the existing user-assigned pull identity.')
param pullIdentityName string

@description('Immutable image tag, normally the Git commit SHA.')
@minLength(7)
param imageTag string

@description('Tags applied to each Container App.')
param tags object = {
  environment: 'poc'
  workload: 'cloud-agent-demo'
  managedBy: 'bicep'
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: registryName
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: environmentName
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: pullIdentityName
}

module meetingApi './modules/container-app.bicep' = {
  name: 'meeting-api'
  params: {
    appName: '${namePrefix}-meeting-api'
    environmentId: environment.id
    pullIdentityId: pullIdentity.id
    registryLoginServer: registry.properties.loginServer
    image: '${registry.properties.loginServer}/meeting-api:${imageTag}'
    targetPort: 8000
    externalIngress: false
    minReplicas: 0
    maxReplicas: 2
    environmentVariables: [
      {
        name: 'MEETING_API_DATABASE'
        value: '/tmp/meeting_rooms.sqlite3'
      }
    ]
    tags: tags
  }
}

module workIntake './modules/container-app.bicep' = {
  name: 'work-intake'
  params: {
    appName: '${namePrefix}-work-intake'
    environmentId: environment.id
    pullIdentityId: pullIdentity.id
    registryLoginServer: registry.properties.loginServer
    image: '${registry.properties.loginServer}/work-intake:${imageTag}'
    targetPort: 8001
    externalIngress: true
    minReplicas: 0
    maxReplicas: 2
    environmentVariables: [
      {
        name: 'WORK_INTAKE_DATABASE'
        value: '/tmp/work_items.sqlite3'
      }
    ]
    tags: tags
  }
}

module web './modules/container-app.bicep' = {
  name: 'web'
  params: {
    appName: '${namePrefix}-web'
    environmentId: environment.id
    pullIdentityId: pullIdentity.id
    registryLoginServer: registry.properties.loginServer
    image: '${registry.properties.loginServer}/web:${imageTag}'
    targetPort: 80
    externalIngress: true
    minReplicas: 1
    maxReplicas: 2
    environmentVariables: [
      {
        name: 'MEETING_API_ORIGIN'
        value: 'https://${meetingApi.outputs.fqdn}'
      }
    ]
    tags: tags
  }
}

output webUrl string = 'https://${web.outputs.fqdn}'
output workIntakeUrl string = 'https://${workIntake.outputs.fqdn}'
output meetingApiName string = meetingApi.outputs.name
output workIntakeName string = workIntake.outputs.name
