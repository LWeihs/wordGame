const Globals = require('./globals');

function runStaticServer() {
    const port = process.env.PORT || Globals.ports.static_server;

    //get dependencies
    const express = require('express');
    const path = require('path');

    //make css, js, html files, and images static
    const app = express();
    app.use(express.static(path.resolve(__dirname + '/../client/css/dist')));
    app.use(express.static(path.resolve(__dirname + '/../client/js/dist')));
    app.use(express.static(path.resolve(__dirname + '/../resources')));
    app.use(express.static(path.resolve(__dirname + '/../node_modules/socket.io-client/dist')));

    //define routes for lobby and game content
    app.get('/', (req, res) => {
        res.sendFile(path.resolve(__dirname + '/../client/static/lobby.html'));
    });

    app.get('/game', (req, res) => {
        res.sendFile(path.resolve(__dirname + '/../client/static/game.html'));
    });

    //listen on port, return the created server instance
    return app.listen(port, () => {
        console.log(`Static server serves on port ${port}`);
    });
}

module.exports = runStaticServer;