var app = angular.module('chatApp', [])


app.factory('socket', function() {
    var socket = io.connect('http://localhost:3000');
    return socket;
})

app.controller('ChatCtrl', function($scope, socket) {
    //client side implementation
    var channelReady = false;
    //ask for username upon connection
    socket.on('connect', function() {
        //prompt user to enter a username
        socket.emit('add:user', prompt("Enter a username!"));
        //established socket connection with server
        channelReady = true; //can send data to other peers
    });
    
    //listen for chat updates from the server
    socket.on('update:chat', function(username, data) {
        $('#conversation').append('<b>'+username+' :</b> ' + data + '<br>');
    });
    
    //listen for room changes
    socket.on('update:rooms', function(rooms, current_room) {
        $('#rooms').empty();
        $.each(rooms, function(key, value) {
            if (value == current_room) {
                $('#rooms').append('<div>'+ value + '</div>');
            } else {
                $('#rooms').append('<div> <a href="#" onclick="switchRoom(\''+value+'\')">' + value + '</a></div>');
            }
        });
    });
    
    //switch to a different room
    function switchRoom(room) {
        socket.emit('switch:room', room);
    }
    
    //active once page is loaded
    $(function() {
        //client clicks send
        $('#datasend').click(function() {
            var message = $('#data').val();
            //clear the text field
            $('#data').val('');
            //emit the message to other clients
            socket.emit('send:msg', message);
        });
        
        //client hits enter
        $('#data').keypress(function(e) {
            if(e.which == 13) {
                $(this).blur();
                $('#datasend').focus().click();
            }
        });
    });
    
    //ui elements 
    var myVideo = document.getElementById('myVideo'),
        theirVideo = document.getElementById('theirVideo'),
        vidCallButton = document.getElementById('vidCallButton'),
        endCallButton = document.getElementById('endCallButton');
            
    
    //establish a new peer connection
    var peerConn = null,
        //set stun and turn (backup) servers
        peerConnCfg = {'iceServers': 
        [{'url': 'stun:stun.services.mozilla.com'}, {'url': 'stun:stun.l.google.com:19302'}]
        };
    
    //show your own camera stream
    $scope.getCam = function(){
        navigator.getUserMedia({video:true, audio:true}, function(stream) {
        var video = document.getElementById('myVideo');
        video.src = URL.createObjectURL(stream);
        }, function(err) {
            console.log('An error occured: '+err.name);
        }); 
    };
    
    //assign listener to the connection buttons
    vidCallButton.addEventListener("click", initCall());
    endCallButton.addEventListener("click", endCall());
    
    //call a remote peer
    function initCall(){
        prepareCall();
        navigator.getUserMedia({audio:true, video:true}, function(stream) {
            myVideo.src = URL.createObjectURL(stream);
            peerConn.addStream(stream);
            createAndSendOffer();
        }, function(error){console.log(error);});
    }
    
    //create new connection and add listeners
    function prepareCall() {
        
    }
    
    //end a running call with a peer
    function endCall() {
        
    }
    
    //special message from another peer
    socket.on('message', onMessage);
    
    function onMessage(evt) {
        var signal = JSON.parse(evt.data);
        //auto answer to call
        if (!peerConn) {
            answerCall();
        }
        if (signal.sdp) {
            peerConn.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.candidate) {
            peerConn.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else if (signal.closeConnection) {
            endCall;
        }
    }
    
    
})
