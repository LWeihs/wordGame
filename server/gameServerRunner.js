const Globals = require('./globals');

function runGameServer(static_server) {
    //set up socket.IO chat server
    const GameServer = require('./gameServer').GameServer;

    const server = static_server ? static_server : Globals.ports.game_server;
    const game_server = new GameServer(server);
    game_server.start();
}

module.exports = runGameServer;