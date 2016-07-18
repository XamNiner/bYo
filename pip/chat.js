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
    //client side implementation
    $scope.calling = false;     //check if client is currently in a call
    $scope.userNames = [];      //list of usernames
    var channelReady = false;   //check if localStream is available before calling
    var praxis = 'pr23';        //praxis number to create a peer id
    
    $scope.id = 5;
    
    //own name
    $scope.name = null;
    
    //show warning if no user media found or camera access granted
    $scope.noMedia = false;
    $scope.noCamera = false;
    
    //check if getUserMedia is available
    if (navigator.mediaDevices === undefined) {
            $scope.noMedia = true;
    }
    
    
    //ask for username upon connection
    socket.on('connect', function() {
        //prompt user to enter a username
       $scope.name = prompt('Enter a username!');
        socket.emit('add:user', $scope.name);
    });
    
    //listen for chat updates from the server
    socket.on('update:chat', function(username, data) {
        $('#conversation').append('<b>'+username+' :</b> ' + data + '<br>');
    });
    
    //assign unique id to the client
    socket.on('add:id', function(id) {
       $scope.id = id; 
    });
    
    //listen for user changes
    socket.on('update:user', function(uData) {
        $scope.userNames = uData;
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
    
    //logging the server messages
    socket.on('log', function(array) {
        console.log.apply(console, array);
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
    
    //------------------------------------------------------
    //ui elements 
    var myVideo = document.getElementById('myVideo'),
        theirVideo = document.getElementById('theirVideo');
    
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
            $scope.noCamera = true;
            console.log('An error occured: '+err.name);
        }); 
    };

    $scope.gumError = false; 
    
    var isChannelReady = false; //wait till another client connects to the room
    var isInitiator = false;
    var isStarted = false;
    var localStream;
    var pc;     //p2p connection 
    var remoteStream;
    var turnReady; //turn server als fallback

    var pcConfig = {
      'iceServers': [{
        'url': 'stun:stun.l.google.com:19302'
      }]
    };

    // Set up audio and video regardless of what devices are present.
    var sdpConstraints = {
      'mandatory': {
        'OfferToReceiveAudio': true,
        'OfferToReceiveVideo': true
      } 
    };
    
    //room shenanigans
    //
    //send connection messages
    function sendMessage(message) {
        console.log('Client sending message: ', message);
        socket.emit('message', message);
    }

    // This client receives a message
    socket.on('message', function(message) {
        console.log('Client received message:', message);
        //client is called by another peer
        //setup a new peer connection
        if (message.type === 'offer') {
            console.log('received an offer');
            if (!isInitiator && !isStarted) {
                beginAnswering();
            }
            pc.setRemoteDescription(new RTCSessionDescription(message));
            doAnswer();
        } else if (message.type === 'answer' && isStarted) {
            pc.setRemoteDescription(new RTCSessionDescription(message));
        } else if (message.type === 'candidate' && isStarted) {
            var candidate = new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate
        });
        pc.addIceCandidate(candidate);
        } else if (message === 'bye' && isStarted) {
            handleRemoteHangup();
        }
    });
    
    //init a new peer connection upon receiving an sdp offer
    function beginAnswering() {
        console.log('Channel is ready: '+ isChannelReady);
        //receiveLocalVideo();
        console.log('Started: '+isStarted+' LocalStream: '+ localStream +' Channel Ready? '+ isChannelReady);
        if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
            console.log('ENTERED!!!')
            //change button access - able to hang up on the caller
            $scope.gumedia = true;
            $scope.inCall = true;
        
            //create new RTCPeerConnection
        
            createPeerConnection();
            pc.addStream(localStream);
            isStarted = true;
        }
    }

    var localVideo = document.getElementById('localVideo'),
        remoteVideo = document.getElementById('remoteVideo');
        $scope.gumedia = true;
        $scope.inCall = false;
    
    //function for button click
    $scope.getLocalVideo = function(){
        receiveLocalVideo();
    }

    function receiveLocalVideo() {
        if (navigator.mediaDevices.getUserMedia !== 'undefined') {
            //get the video stream
            $scope.gumedia = false;
            console.log('getUserMedia active');
            navigator.mediaDevices.getUserMedia({audio: true, video: true})
            .then(createStream)
            .catch(function(e) {
                $scope.noCamera = true;
                alert('getUserMedia error: ' + e.name);
            });
            console.log('AFTER STREAM');
        } else {
            $scope.noMedia = true;
            console.log('getUserMedia is not supported in this browser!');
        }
    }
    
    function createStream(stream){
        console.log('Adding local stream');
        localVideo.src = window.URL.createObjectURL(stream);
        localStream = stream;
        console.log('The local stream has been initialized: '+localStream);
        sendMessage('got user media');
        //got local stream --> can begin calling other peers
        isChannelReady = true;
    }
    
    $scope.onCall = function() {
        console.log('Init a new peer connection');
        console.log('Started: '+isStarted+' LocalStream: '+(typeof localStream)+' Channel Ready? '+ isChannelReady);
        if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
            //change button access
            $scope.gumedia = true;
            $scope.inCall = true;
        
            //init a new peer connection
            createPeerConnection();
            pc.addStream(localStream);
            isStarted = true;
            isInitiator = true;
            //send the sdp offer to another peer
            doCall();
        }
    }
    
    
    function createPeerConnection(){
        try {
            console.log('>>>>>> creating peer connection');
            pc = new RTCPeerConnection(null);
            
            //add event handler
            pc.onicecandidate = handleIceCandidate;
            pc.onaddstream = handleRemoteStreamAdded;
            pc.onremovestream = handleRemoteStreamRemove;
        }catch (e) {
            console.log('Failed to create PeerConnection, exception: ' + e.message);
            alert('Cannot create RTCPeerConnection object.');
        }
        return;
    }
    
    //add new ice candidates
    function handleIceCandidate(evt) {
        console.log('New ICE candidate: ', evt);
        
        if(evt.candidate) {
            sendMessage({
                type: 'candidate',
                label: evt.candidate.sdpMLineIndex,
                id: evt.candidate.sdpMid,
                candidate: evt.candidate.candidate
            });
        } else {
            console.log('End of candidates');
        }
    }
    
    //add another peers video stream to your browser
    function handleRemoteStreamAdded(evt) {
        console.log('Remote stream added.');
        remoteVideo.src = window.URL.createObjectURL(evt.stream);
        remoteStream = evt.stream;
    }
    
    //problem sending the offer to another peer
    function handleCreateOfferError(evt) {
        console.log('Create SDP-offer error: ', evt);
    }
    
    //delete a remote stream
    function handleRemoteStreamRemove(evt) {
        console.log('Removed a remote stream Event: ', evt);
    }
    
    //construction of new sdp offer
    function doCall() {
        console.log('Sending offer to peer');
        pc.createOffer(setLocalandSendMessage, handleCreateOfferError);
    }
    
    //construction of new sdp answer
    function doAnswer(sessionDescription) {
        console.log('Sending answer to peer');
        pc.createAnswer().then(
        setLocalandSendMessage, onCreateSessionDescriptionError);
    }
    
    function onCreateSessionDescriptionError(error){
        console.log('Encountered an error while creating the SessionDescription: ', error);    
    }
            
    function setLocalandSendMessage(sessionDescription) {
        console.log('Sending the sesssion description: ', sessionDescription);
        //set the session description locally
        sendMessage(sessionDescription);
        pc.setLocalDescription(sessionDescription);
    }
        
    //---------------------------------------------------
    //stop a running p2p call
    $scope.hangUp = function() {
        console.log('Stopping the running call');
        stop();
        isInitiator = false;
        //disable hangup allow calling again
        $scope.inCall = false;
        sendMessage('bye');
        
        //delete the video track 
        //var vidTrack = remoteStream.getVideoTracks();
        //remoteStream.removeTrack(vidTrack[0]);
    };
    
    //the caller has ended the call
    function handleRemoteHangup() {
        console.log('Caller has ended the call');
        stop();
        $scope.inCall = false;
    }
    
    function stop() {
        console.log('Stopping peer connection');
        isStarted = false;
        //close the connection
        pc.removeStream(remoteStream);
        pc.close;
        pc = null;
    }
    
    //end any calls when reloading or closing the page
    window.onbeforeunload = function() {
        sendMessage('bye');
    }
    
    //----------------------------------
    //send peer connection request to this id
    $scope.peerId;  //id of the object to be called
    $scope.ownId;   //set last id numbers yourself 
    $scope.setId = 42; //standard
    
    //add your own id suffix
    $scope.makeId = function() {
        //create an id from praxis number, username and suffix
        //complete version
        $scope.setId = praxis+''+$scope.name+''+$scope.ownId;
        console.log('Setting own id from '+$scope.setId+' to '+$scope.ownId);
        //send complete peer id to all clients
        socket.emit('update:pid', $scope.setId);
    }
    
    //show Ids of all connected peers(+ own)
    socket.on('get:pid', function(peerIds) {
        console.log('updating the peer ids');
        $scope.pids = peerIds; 
    });
    
    //request a peer connection from another client
    $scope.sendRequest = function() {
        console.log('sending request to establish peer connection');
        var message = 'request';
        console.log('Check - '+$scope.setId+' - '+$scope.peerId);
        var a = $scope.setId,
            b = $scope.peerId,
            data = {
                sender: a,
                receiver: b,
                message: message
            };
        sendPrivateMessage(data);
        console.log('Value in peerId '+$scope.peerId);
        //socket.emit('make:request', $scope.peerId);
    }
    
    socket.on('got:requested', function(clientId) {
        //another peer sent a connection request
        //check id if client is being called
        console.log('Peer requested connection.');
        if (clientId === $scope.setId) {
            console.log('You are being called!');
            var p = window.confirm('Accept the peers call?');
            if (p == true) {
                console.log('Pressed okay');
            } else {
                console.log('Pressed cancel');
            }
        } else {
            console.log('Not you!');
        }
    });
    
    //emitting private message to another peer
    function sendPrivateMessage(data) {
        console.log('Sender id: '+data.sender+' and Receiver id: '+data.receiver);
        console.log('Sending private message: '+ data.message);
        socket.emit('private:msg', data);
    }
    
    //deal with private messages
    socket.on('get:pvtmsg', function(data) {
        //peer connection request from another client
        if (data.receiver === $scope.setId) {
            console.log('Got the right client');
            if (data.message === 'request') {
                console.log('>>>>>>>>>>>request start')
                var p = window.confirm("Accept another peers request to establish a peer connection?");
                if (p == true) {
                    //accepted
                    console.log('Accepted the other clients request!');
                    txt = "You pressed OK!";
                    //accepting the peers call
                    var answer = {
                            sender: data.receiver,
                            receiver: data.sender,
                            message: 'answer'
                    };
                    //send answer to caller
                    sendPrivateMessage(answer);
                } else {
                    //refused connection
                    console.log('Denied the other clients request!');
                    txt = "Pressed Cancel!";
                    //send refusal back to sender
                    var denied = {
                            sender: data.receiver,
                            receiver: data.sender,
                            message: 'denied'
                    };
                    sendPrivateMessage(denied);
                }    
            } else if (data.message === 'answer') {
                console.log('Client with id - '+data.sender+' answered your call.');
                
                //other peer accepted the request - init new peer connection
                
                
            } else if (data.message === 'denied') {
                console.log('Client with id - '+data.sender+' refused the connection.');
                //display refusal
                window.alert('Client refused your connection! Please try again.');
            } else {
                console.log('Received remote message!');
            } 
        }
    });
})
