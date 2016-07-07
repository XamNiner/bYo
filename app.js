var express = require('express'),
    app = express(), 
    server = require('http').createServer(app), //http server implementation
    io = require('socket.io').listen(server); //sockets listen on server port
    //library to allow peer2peer connection

//server logic
var port = process.env.PORT || 3000;

server.listen(port, function() {
   console.log('Server listening on port: %d',port); 
});

//routing
app.use(express.static(__dirname+ '/public'));
app.use(express.static(__dirname+ '/bower_components'));

app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

//chatroom
var numUsers = 0;

//handle socket.io events
io.sockets.on('connection', function(socket) {
    var name = 'guest';
    var users = [];
    var address = socket.handshake.address;
    var addedUser = true;
    console.log('working');
    
    io.sockets.emit('init', {
        name: name    
    });
    
    io.sockets.emit('user:joined', {
        name: name,
        ip: address
    });
    
    //send text msg to other clients
    socket.on('send:msg', function(data) {
        console.log('sending message: '+JSON.stringify(data));
        io.sockets.emit('get:msg', data) //emit the message to all sockets
    });
    
    //client disconnecting from server
    socket.on('disconnect', function(){
        console.log('User has disconnected');
        //io.sockets.emit('user:left', {
          //  name: name
        //});
        //extra
        if (addedUser) {
            --numUsers;
            //tell other clients that client has left
            socket.broadcast.emit('user:left', {
                username: socket.username,
                numUsers: numUsers
            });
        }
    });
    
    //sending stream element to all other peers
    socket.on('send:stream', function(data) {
       io.sockets.emit('get:vid', data); 
    });
    
    
    //new events for the chat
    socket.on('new message', function(data) {
        socket.broadcast.emit('new message', {
              username: socket.username,
              message: data
        });
    });
    
    socket.on('add:user', function(username) {
        if(addedUser) 
            return;
        //store name in socket session
        socket.username = username;
        console.log('Changed name to '+username);
        ++numUsers;
        console.log('There are now '+numUsers+' User online.')
        addedUser = true;
        socket.emit('login', {
            numUsers: numUsers
        });
        //tell all clients that somebody connected
        socket.broadcast.emit('user:joined', {
            username: socket.username,
            numUsers: numUsers
        });
    });
})