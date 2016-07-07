var app = angular.module('chatApp', ['webcam'])


app.factory('socket', function() {
    var socket = io.connect('http://localhost:3000');
    return socket;
})

app.controller('ChatCtrl', function($scope, socket, VideoStream, $sce) {
    var username,
        connected = false;
    
    $scope.msgs = [];
    $scope.messageLog = '';
    $scope.name = '';
    
    //set user name and submit names of connected clients
    socket.on('init', function (data) {
        $scope.name = data.name;
        username = data.name;
        $scope.users = data.users;
    });
    
    socket.on('user:joined', function(data){
        var jmsg = new Date()+' - '+ username + ' has joined the room.';
        var jmsg2 = new Date()+' - '+ username+ ' has address: '+data.ip;
        $scope.msgs.push(jmsg);
        $scope.msgs.push(jmsg2);
        console.log('New user joined');
        $scope.$digest();
        //$scope.users.push(data.name);
        //send stream to all connected peers
        var stream;
        //VideoStream.get().then(function(s){
          //  stream = s;
            //
            //stream = URL.createObjectURL(stream);
        //})
        //socket.emit('send:stream', stream);
    });
    
    socket.on('user:left', function(data){
        var lmsg = new Date() + ' - '+ data.username + ' left the room.'+ data.numUsers; 
        $scope.msgs.push(lmsg);
        $scope.$digest();
    });
    
    $scope.sendMsg = function() {
        socket.emit('send:msg', $scope.msg.text);
        $scope.msg.text = '';
    }
    
    socket.on('get:msg', function(data){
        var gmsg = new Date()+' - '+$scope.name+': '+data;
        $scope.msgs.push(gmsg);
        //instantly refresh the model
        $scope.$digest();
    })
    
    //socket.on('get:vid', function(data) {
      //  var stream = data;
        //$scope.getLocalVideo = function() {
          //  return $sce.trustAsResourceUrl(stream);
    //})
    
    //CAMERA
    var _vid = null,
        padData = null;
    
    //dimension and position of cam display
    $scope.padOpts = {x: 0, y: 0, w: 25, h: 25};
    
    $scope.channel = {

    }; //receives video element
    $scope.camError = false; //no access granted or no browser support
    
    //display error message on failure
    $scope.onError = function(err) {
        $scope.$apply(
            function() {
                $scope.camError = err;
            }
        );
    };
    
    //access to webcam was granted
    $scope.onSuccess = function() {
        _vid = $scope.channel.video; //captured video data
        $scope.$apply(
            function() {
                $scope.padOpts.w = _vid.width;
                $scope.padOpts.h = _vid.height;
            }
        );
    };
    
    //do something when stream is running
    $scope.onStream = function(stream) {      
    };
    
    //----------------------------------------------
    
    //new variables for the chat
    var $window = $(window),
        $usernameInput = $('.usernameInput'),
        $messages = $('.messages'),
        $inputMessage = $('.inputMessage');
    
    var $loginPage = $('.login.page'),
        $chatPage = $('.chat.page');
    
    //enter user name
    var username,
        connected = false,
        $currentInput = $usernameInput.focus();
    
    function addParticipantsMessage(data) {
        var message = '';
        if (data.numUsers === 1) {
            message += "there is 1 participant.";
        } else {
            message += "there are" + data.numUsers + "participants.";
        }
        log(message);
    }
    
    function setUsername() {
        username = cleanInput($usernameInput.val().trim());
        
        //check validity
        if (username) {
            $loginPage.fadeOut();
            $chatPage.show();
            $loginPage.off('click');
            $currentInput = $inputMessage.focus();
            
            //tell server new name
            socket.emit('add user', username);
        }
    }
    
    function sendMessage() {
        var message = $inputMessage.val();
        message = cleanInput(message);
        if(message && connected) {
            $inputMessage.val('');
            addChatMessage({
                username: username,
                message: message
            });
            socket.emit('new message', message);
        }
    }
    
    //logging messages
    function log(message, options){
        var $el = $('<li>').addClass('log').text(message);
        addMessageElement($el, options);
    }
    
    //set color for a username
    function getUsernameColor(username) {
        //compute hash color value
        var hash = 7;
        for (var i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + (hash << 5) - hash;
        }
        //calculate a new color
        var index = Math.abs(hash % COLORS.length);
        return COLORS[index];
    }
     
    //socket events to handle
    //display connection message for new clients
    socket.on('login', function(data) {
        connected = true;
        //msg display
        var message = "Welcome to the chat";
        log(message, {
            prepend: true
        });
        addParticipantsMessage(data);
    });
    
    //server emits new message
    socket.on('new message', function(data) {
        addChatMessage(data);
    });
    
    socket.on('user joined', function(data) {
       log(data.username+ ' joined');
        addParticipantsMessage(data);
    });
    
    socket.on('user left', function(data) {
        log(data.username + ' left');
        addParticipantsMessage(data);
        removeChatTyping(data);
    });
})