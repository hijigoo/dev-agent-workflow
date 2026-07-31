@description('Container App resource name.')
param appName string

@description('Container Apps managed environment resource ID.')
param environmentId string

@description('User-assigned managed identity resource ID used for ACR pull.')
param pullIdentityId string

@description('ACR login server.')
param registryLoginServer string

@description('Immutable container image reference.')
param image string

@description('Container target port.')
param targetPort int

@description('Whether ingress is internet-facing.')
param externalIngress bool

@description('Minimum number of replicas.')
@minValue(0)
param minReplicas int

@description('Maximum number of replicas.')
@minValue(1)
param maxReplicas int

@description('Environment variables passed to the container.')
param environmentVariables array = []

@description('HTTP health endpoint.')
param healthPath string = '/health'

@description('Tags applied to the Container App.')
param tags object = {}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: resourceGroup().location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${pullIdentityId}': {}
    }
  }
  properties: {
    environmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      maxInactiveRevisions: 5
      ingress: {
        external: externalIngress
        allowInsecure: false
        targetPort: targetPort
        transport: 'auto'
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: registryLoginServer
          identity: pullIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: appName
          image: image
          env: environmentVariables
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: healthPath
                port: targetPort
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: healthPath
                port: targetPort
                scheme: 'HTTP'
              }
              initialDelaySeconds: 3
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
output name string = app.name
