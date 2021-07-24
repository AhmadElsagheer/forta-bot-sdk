import os from 'os'
import { join } from "path"
import { asClass, asFunction, asValue, createContainer, InjectionMode } from "awilix"
import Web3 from 'web3'
import shell from 'shelljs'
import axios, { AxiosRequestConfig } from 'axios'
import provideInit from "./commands/init"
import provideRun from "./commands/run"
import providePublish from "./commands/publish"
import AgentController from "./commands/run/server/agent.controller"
import { provideRunTransaction } from "./commands/run/run.transaction"
import { provideRunBlock } from "./commands/run/run.block"
import { provideRunBlockRange } from "./commands/run/run.block.range"
import { provideRunFile } from "./commands/run/run.file"
import { provideRunLive } from "./commands/run/run.live"
import provideRunServer from "./commands/run/server"
import { getJsonFile } from "./utils"
import AgentRegistry from "./commands/publish/agent.registry"
import { provideRunBlockHandlers } from "./utils/run.block.handlers"
import { provideRunTransactionHandlersOnBlock } from "./utils/run.transaction.handlers.on.block"
import { provideRunTransactionHandlersOnTransaction } from "./utils/run.transaction.handlers.on.transaction"
import { provideGetAgentHandlers } from "./utils/get.agent.handlers"
import { provideGetKeyfile } from "./utils/get.keyfile"
import { provideCreateKeyfile } from "./utils/create.keyfile"
import { FortaConfig } from "."

const FORTA_KEYSTORE = join(os.homedir(), ".forta")
const FORTA_CONFIG_FILENAME = "forta.config.json"

export default function configureContainer() {
  const container = createContainer({ injectionMode: InjectionMode.CLASSIC });

  const bindings = {
    container: asValue(container),
    isProduction: asValue(process.env.NODE_ENV === 'production'),
    isDebug: asFunction((fortaConfig: FortaConfig) => fortaConfig.debug),
    shell: asFunction((isDebug: boolean) => {
      shell.config.silent = isDebug ? false : true
      return shell
    }).singleton(),

    init: asFunction(provideInit),
    run: asFunction(provideRun),
    publish: asFunction(providePublish),

    runProdServer: asFunction(provideRunServer),
    runTransaction: asFunction(provideRunTransaction),
    runBlock: asFunction(provideRunBlock),
    runBlockRange: asFunction(provideRunBlockRange),
    runFile: asFunction(provideRunFile),
    runLive: asFunction(provideRunLive),

    getAgentHandlers: asFunction(provideGetAgentHandlers),
    runBlockHandlers: asFunction(provideRunBlockHandlers),
    runTransactionHandlersOnBlock: asFunction(provideRunTransactionHandlersOnBlock),
    runTransactionHandlersOnTransaction: asFunction(provideRunTransactionHandlersOnTransaction),
    getJsonFile: asValue(getJsonFile),
    getKeyfile: asFunction(provideGetKeyfile),
    createKeyfile: asFunction(provideCreateKeyfile),

    fortaKeystore: asValue(FORTA_KEYSTORE),
    fortaConfig: asFunction(() => {
      let config = {}
      // try to read from config file (could throw error if one does not exist yet i.e. when running init command)
      try { config = getJsonFile(`./${FORTA_CONFIG_FILENAME}`) } catch (e) {}
      return config
    }).singleton(),

    agentController: asClass(AgentController),
    port: asValue(process.env.AGENT_GRPC_PORT || "50051"),

    imageRepositoryUrl: asFunction((fortaConfig: FortaConfig) => {
      return fortaConfig.imageRepositoryUrl || "disco.forta.network"
    }),
    agentRegistry: asClass(AgentRegistry),
    agentRegistryContractAddress: asFunction((fortaConfig: FortaConfig) => {
      return fortaConfig.agentRegistryContractAddress || "0xBD7F842Cb96dFF147d6b9b4c9f8e56acF76A969B"
    }),
    agentRegistryJsonRpcUrl: asFunction((fortaConfig: FortaConfig) => {
      return fortaConfig.agentRegistryJsonRpcUrl || "https://goerli-light.eth.linkpool.io/"
    }),

    jsonRpcUrl: asFunction((fortaConfig: FortaConfig) => {
      if (!fortaConfig.jsonRpcUrl) {
        throw new Error(`no jsonRpcUrl provided in ${FORTA_CONFIG_FILENAME}`)
      }
      return fortaConfig.jsonRpcUrl
    }),
    web3: asFunction((jsonRpcUrl: string) => {
      const provider = jsonRpcUrl.startsWith('ws') ? 
        new Web3.providers.WebsocketProvider(jsonRpcUrl) : 
        new Web3.providers.HttpProvider(jsonRpcUrl)
      return new Web3(provider)
    }).singleton(),
    web3AgentRegistry: asFunction((agentRegistryJsonRpcUrl: string) => new Web3(agentRegistryJsonRpcUrl)).singleton(),

    ipfsGatewayUrl: asFunction((fortaConfig: FortaConfig) => {
      if (!fortaConfig.ipfsGatewayUrl) {
        throw new Error(`no ipfsGatewayUrl provided in ${FORTA_CONFIG_FILENAME}`)
      }
      return fortaConfig.ipfsGatewayUrl
    }),
    ipfsGatewayAuthHeader: asFunction((ipfsGatewayUrl: string, fortaConfig: FortaConfig) => {
      if (ipfsGatewayUrl.includes('ipfs.infura.io') && !fortaConfig.ipfsGatewayAuthHeader) {
        throw new Error(`no ipfsGatewayAuthHeader provided in ${FORTA_CONFIG_FILENAME}`)
      }
      return fortaConfig.ipfsGatewayAuthHeader
    }),
    ipfsHttpClient: asFunction((ipfsGatewayUrl: string, ipfsGatewayAuthHeader: string) => {
      const options: AxiosRequestConfig = { baseURL: ipfsGatewayUrl }
      if (ipfsGatewayAuthHeader) {
        options['headers'] = {
          authorization: ipfsGatewayAuthHeader
        }
      }
      return axios.create(options)
    }).singleton()
  };
  container.register(bindings);

  return container;
};