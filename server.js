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

//peer ids for all users
var peerIds = {};

//available rooms to join
var rooms = ['room1', 'room2', 'room3'];
//track people in room
var roommates = [];

//count number of users
var userNumber = 0;

//socket io event handling
io.on('connection', function (socket) {
    var address = socket.handshake.address;
    var id = 12;
    
    //logging server events
    function log() {
        var array = ['Message from server:'];
        array.push.apply(array, arguments);
        socket.emit('log', array);
    }
    
    //client emits add:user to add new user to the room
    socket.on('add:user', function(username) {
        //give the user a unique id
        socket.broadcast.emit('add:id', id);
        id++;
        userNumber++;
        console.log('next id is '+id);
        console.log('added new user');
        //store the name
        socket.username = username;
        
        //add client name to list of users
        var zu = username+' - SocketID: '+socket.id;
        usernames[username] = zu;
        io.sockets.emit('update:user', usernames);
        io.sockets.emit('get:pid', peerIds);
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
    
    //sending rtc peer connection messages between peers
    socket.on('message',function(message) {
        //send to all other clients excluding creator
        log('Client send message: ', message);
        socket.broadcast.emit('message', message);
    });
    
    //sending message to a specific socket
    socket.on('private:msg', function(data) {
        log('The message: ', data.message);
        log('The Senders ID - ', data.sender);
        log('The Receivers ID -', data.receiver);
        //log('Sending the private message from ',send_id,': ', message ,' to socket id: ' , rec_id);
        io.sockets.emit('get:pvtmsg', data);
    });
    
    //handle client disconnect
    socket.on('disconnect', function() {
        log('User disconnected');
        //delete the assigned username from the list of users
        console.log(socket.username + ' has disconnected.');
        delete usernames[socket.username];
        //update username list
        io.sockets.emit('update:user', usernames);
        userNumber--;
        
        //delete the peer id 
        delete peerIds[socket.pid];
        //update the peer id list
        io.sockets.emit('get:pid', peerIds);
        //global text echo that user left
        socket.broadcast.emit('update:chat', 'SERVER', socket.username + ' has disconnected.');
        
        //hangup on a call associated with the quitting peer
        socket.broadcast.emit('message', 'bye');
        socket.leave(socket.room);
    });
    
    //change peer id
    socket.on('update:pid', function(pid) {
        log('updating pid');
        //delete old pid
        delete peerIds[socket.pid];
        
        //store the peer id
        socket.pid = pid;
        peerIds[pid] = pid;
        //send new list of peer ids 
        io.sockets.emit('get:pid', peerIds);
    });
    
    //------------------------------
    //testing some functionality
    socket.on('test', function() {
       socket.broadcast.emit('testing'); 
    });
    
    socket.on('make:request', function(clientId) {
        io.sockets.emit('got:requested', clientId);
    });
});