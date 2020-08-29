const Globals = require('./globals');

function runGameServer() {
    //set up socket.IO chat server
    const GameServer = require('./gameServer').GameServer;

    const game_server = new GameServer(Globals.ports.game_server);
    game_server.start();
}

module.exports = runGameServer;