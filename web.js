// Setup basic express server
var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server);

var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/pip'));

//socket io event handling
io.on('connection', function (socket) {
    var address = socket.handshake.address;
    var id = 12;
    
    
    // convenience function to log server messages on the client
    function log() {
        var array = ['Message from server:'];
        array.push.apply(array, arguments);
        socket.emit('log', array);
    }
    
    //sending messages from client to server
    socket.on('message', function(message) {
        log('Client sent message: ', message);
        socket.broadcast.emit('message', message);
    });
    
    //create or join a room
    socket.on('create:join', function(room) {
        log('Request to create or join room: ', room);
        
        var numclients = io.sockets.sockets.length;
        
        log('Room '+room+' now has '+numclients+' clients.');
        //create
        if (numclients === 1) {
            socket.join(room);
            log('Client ID: ' + socket.id + ' has created room '+ room);
            socket.emit('created', room, socket.id);
        }
        //join
        else if (numclients === 2) {
            log('Client ID: '+ socket.id +' has joined the room '+ room);
            //tell room initiator that someone else is joining
            io.sockets.in(room).emit('join', room);
            socket.join(room);
            socket.emit('joined', room, socket.id);
        }
        //maximum number clients reached
        else {  
            socket.emit('full', room);    
        }
    });
    
    socket.on('bye', function() {
        log('Client sent bye.');
    });
});