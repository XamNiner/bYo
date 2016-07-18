'use strict'

var app = angular.module('chatApp', [])


app.factory('socket', function ($rootScope) {
  var socket = io.connect();
  return {
    on: function (eventName, callback) {
      socket.on(eventName, function () {  
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(socket, args);
        });
      });
    },
    emit: function (eventName, data, callback) {
      socket.emit(eventName, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(socket, args);
          }
        });
      })
    }
  };
});

app.controller('ChatCtrl', function($scope, socket) {
    //check the client properties
    var isChannelReady = false,     //room is filled by two clients
        isInitiator = false,        //client is calling another peer
        isStarted = false;          //camera permission granted, getUserMedia available
    
    //peer connection to exchange ice candidates
    var pc,
        turnReady;
    
    //p2p media streams
    var localStream,
        remoteStream;
    
    //STUN/TURN server config for the peer connection
    var pcConfig = {
        'iceServers': [{
            'url': 'stun:stun.l.google.com:19302'
        }]
    };

    //setup what peers are to receive during connection
    var sdpConstraints = {
        'mandatory': {
            'OfferToReceiveVideo': true,
            'OfferToReceiveAudio': true
        }
    };
    
    //join room using socketio
    var room = '123';
    
    if(room != ''){
        socket.emit('create:join', room);
        console.log('Attempted to join room: '+room);
    }
    
    //handle 3 room states full, create, join
    //created a new empty channel
    socket.on('created', function(room) {
        console.log('Created the room: '+room);
        //created new room --> initiates the peer connection
        isInitiator = true;
    });
    
    //chosen channel is full
    socket.on('full', function(room) {
        console.log('The room is currently occupied');
    });
    
    //somebody joined your channel
    socket.on('join', function(room) {
        console.log('Another peer wants to join '+room);
        console.log('This peer is the initiator of the room');
        isChannelReady = true;
    });
    
    //you joined another peers channel
    socket.on('joined', function(room) {
        console.log('Entered the room '+room); 
        isChannelReady = true;    
    });
    
    //helps to log
    socket.on('log', function(array) {
        console.log.apply(console, array);
    });
    
    function sendMessage(message) {
        console.log('Client sending message: ', message);
        socket.emit('message', message);
    }
    //handle message events between the server and client
    socket.on('message', function(message) {
       console.log('Client received the message: '+message);
        if (message === 'got user media') {
            maybeStart();
        } 
        //receiving a new sdp offer from a peer
        else if (message.type === 'offer') {
            if (!isInitiator && !isStarted) {
                maybeStart();
            }
            pc.setRemoteDescription(new RTCSessionDescription(message));
            //send sdp answer to the caller
            doAnswer();
        }
        //caller is receiving the sdp answer to his sdp offer
        else if (message.type === 'answer' && isStarted) {
            pc.setRemoteDescription(new RTCSessionDescription(message));
        }
        //receive a new ice candidate
        else if (meesage.type === 'candidate' && isStarted) {
            var candidate = new RTCIceCandidate({
                sdpMLineIndex: message.label,
                candidate: message.candidate
            });
            pc.addIceCandidate(candidate);
        }
        else if (message = 'bye' && isStarted) {
            handleRemoteHangup();
        } 
    });
    
    
    //display video streams
    //video/audio streams for p2p webcam communication
    var localVideo = document.getElementById('localVideo'),
        remoteVideo = document.getElementById('remoteVideo');
    
    //gain permissions
    navigator.mediaDevices.getUserMedia({
        audio:true,
        video: true
    })
    .then(gotStream())
    .catch(function(e) {
        alert('Get user media error: '+e.name)
    });
    
    function gotStream(stream) {
        console.log('Adding the local stream');
        localVideo.src = window.URL.createObjectURL(stream);
        localStream = stream;
        //successfully acquired camera and mic permissions
        sendMessage('got user media');
        //try to establish the peer connection
        if (isInitiator) {
            maybeStart();
        }
    }
    
    var constraints = {
    video: true
    };

    console.log('Getting user media with constraints', constraints);

    //check if turnserver still works!!!
    if (location.hostname !== 'localhost') {
      requestTurn(
        'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
      );
    }
    
    function maybeStart() {
        console.log('Maybe start connection: ', isStarted, localStream, isChannelReady);
        //check if stream and conditions are fulfilled before starting the peer connection
        if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
            console.log('>>>>>>creating peer connection');
            createPeerConnection();
            pc.addLocalStream(localStream);
            isStarted = true;
            console.log('isInitiator', isInitiator);
            //call the other peer if you initiated the room
            if (isInitiator) {
                doCall();
            }
        }
    }
    
    //before closing the browser window hangup any existing call
    window.onbeforeunload = function() {
        sendMessage('bye');
    };
    
    function createPeerConnection() {
        try {
            pc = new RTCPeerConnection(null);
            pc.onaddstream = handleRemoteStreamAdded;
            pc.onicecandidate = handleIceCandidate;
            pc.onremovestream = handleRemoteStreamRemoved;
            console.log('Created new RTCPeerConnection');
        }catch (e) {
            alert('Could not create RTC peerConnection object.');
            console.log('Failed to create peer connection, error: ' + e.message);
            return;
        }
    }
    
    function handleIceCandidate(evt) {
        console.log('ICE candidate event: ', evt);
        if (evt.candidate) {
            sendMessage({
               type: candidate,
                label: evt.candidate.sdpMLineIndex,
                id: evt.candidate.sdpMid,
                candidate: evt.candidate.candidate
            });
        } else {
            console.log('End of candidates');
        }
    }
    
    function handleRemoteStreamAdded(evt) {
        console.log('Stream added: ', evt);
        remoteVideo.src = window.URL.createObjectURL(evt.stream);
        remoteStream = evt.stream;
    }
    
    function handleRemoteStreamRemoved(evt) {
        console.log('Stream removed ', evt);
    }
    
    function handleCreateOfferError(event) {
        console.log('createOffer() error: ', event);
    }
    
    function doCall() {
       console.log('Sending new offer to peer');
        pc.createOffer(setLocalandSendMessage, handleCreateOfferError);
    }
    
    //callee send sdp answer to the caller/initiator
    function doAnswer() {
        console.log('Sending answer to the caller');
        pc.createAnswer().then(
        setLocalandSendMessage, onCreateSessionDescriptionError);
    }
    
    //set local session description and inform other peer
    function setLocalandSendMessage(sessionDescription) {
        console.log('sending message: ', sessionDescription);
        pc.setLocalDescription(sessionDescription);
        sendMessage(sessionDescription);
    }
    
    function onCreateSessionDescriptionError(e) {
        trace('Error setting the session description: ' + e.toString());
    }
    
    //use the backup turn server if the stun doesnt work
    function requestTurn(turnURL) {
        var turnExists = false;
        for (var i in pcConfig.iceServers) {
            if (pcConfig.iceServers[i].url.substr(0, 5) === 'turn:') {
            turnExists = true;
            turnReady = true;
            break;
            }
        }
        if (!turnExists) {
            console.log('Getting TURN server from ', turnURL);
        // No TURN server. Get one from computeengineondemand.appspot.com:
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var turnServer = JSON.parse(xhr.responseText);
                console.log('Got TURN server: ', turnServer);
                pcConfig.iceServers.push({
                'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
                'credential': turnServer.password
                });
                turnReady = true;
            }
            };
            xhr.open('GET', turnURL, true);
            xhr.send();
        }
    }
    
    //terminate a running call between 2 peers
    function hangup() {
        stop;
        sendMessage('bye');
        console.log('Hanging up.');
    }
    
    function handleRemoteHangup() {
        console.log('Session terminated');
        stop();
        isInitiator = false;
    }
    
    function stop(){
        isStarted = false;
        console.log('Terminating peer connection');
        pc.close();
        pc = '';
    }
    
    //
})