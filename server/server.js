const runStaticServer = require('./staticServer');
const runGameServer = require('./gameServerRunner');

const server = runStaticServer();
runGameServer(server);