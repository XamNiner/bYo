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
//app.get(‘/’, function (req, res) {
//res.sendfile(__dirname + '/pip/index.html');
//});

// Chatroom - names of all users
var usernames = {};
//available rooms to join
var rooms = ['room1', 'room2', 'room3'];
//track people in room
var roommates = [];

//socket io event handling
io.on('connection', function (socket) {
    var address = socket.handshake.address;
    //client emits add:user to add new user to the room
    socket.on('add:user', function(username) {
        console.log('added new user');
        //store the name
        socket.username = username;
        
        //add client name to list of users
        usernames[username] = username;
        
        //set the standard room
        socket.room = 'room1';
        
        //join the room
        socket.join('room1');
        
        //send client affirmation message
        socket.emit('update:chat', 'SERVER', 'you have connected to room1');
        
        //tell members of room one that a new client has connected
        socket.broadcast.to('room1').emit('update:chat', 'SERVER', username + ' has connected with ip: '+address);
        socket.emit('update:rooms', rooms, 'room1');
    });
    
    //clients send a new message
    socket.on('send:msg', function(data) {
        //update the chat in the assigned room
        io.sockets.in(socket.room).emit('update:chat', socket.username, data);
        console.log('Send Message: '+JSON.stringify(data));
    });
    
    //changing from one room to another
    socket.on('switch:room', function(newroom) {
       //leave the old room
        socket.leave(socket.room);
        console.log('Leaving room '+socket.room);
        
        //join new room
        socket.join(newroom);
        socket.emit('update:chat', 'SERVER', 'You have connected to room '+newroom);
        console.log('Now entering room '+newroom);
        
        //tell old room that you have quit
        socket.broadcast.to(socket.room).emit('update:chat', 'SERVER', socket.username + ' has quit the room.');
        
        //update the socket session room title
        socket.room = newroom;
        
        //emit join event to all clients in new room
        socket.broadcast.to(socket.room).emit('update:chat', 'SERVER', socket.username + ' has joined the room.');
        socket.emit('update:rooms', rooms, newroom);
    });
    
    //handle client disconnect
    socket.on('disconnect', function() {
        //delete the assigned username from the list of users
        console.log(socket.username + ' has disconnected.');
        delete usernames[socket.username];
        
        //update username list
        io.sockets.emit('update:user', usernames);
        
        //global text echo that user left
        socket.broadcast.emit('update:chat', 'SERVER', socket.username + ' has disconnected.');
        socket.leave(socket.room);
    });
    
    //NEW Socket events to establish peer connection
    //offer sdp to another peer
    socket.on('send:offer', function(offer) {
       io.sockets.in(socket.room).emit('message', {
            offer: offer       
       }); 
    });
    
    //send sdp answer to the caller
    socket.on('send:answer', function(answer){
        io.sockets.in(socket.room).emit('message', {
            answer: answer 
        });
    });
    
    socket.on('new:ice', function(candidate) {
        io.sockets.in(socket.room).emit('message', {
            candidate: candidate
        });
    });
});